<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\AppUser;
use App\Support\Messages;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Montage file storage. Ports handleGetUploadUrl / handleGetFileUrl / handleDeleteFile
 * (manage-users/index.ts:833-878), replacing the Supabase `montage-files` bucket with the
 * private `montage` disk (03-API-SPECIFICATION.md §8).
 *
 * Object keys keep the reference's convention exactly — "{user_id}/{ms}-{sanitized}" — so
 * bucket contents can be copied across without rewriting the paths already stored in
 * saved_quotes as "storage:<path>".
 *
 * Two signing strategies, chosen by the disk driver:
 *  - S3 issues genuine presigned URLs, so the browser PUTs and GETs the object store
 *    directly, exactly as it did against Supabase.
 *  - Local has no such concept, so the URLs point at this API's own `signed` routes.
 * Either way the client contract is unchanged: PUT the file to `upload_url`, open
 * `signed_url` to read. The client sends no credentials on those requests, which is why
 * the URL itself has to carry the authorization.
 */
class StorageService
{
    public const DISK = 'montage';

    /** Matches the reference's 1-hour download expiry (index.ts:860). */
    private const DOWNLOAD_TTL_MINUTES = 60;

    /**
     * Uploads are a single immediate PUT, so this only has to outlive the transfer.
     * Shorter than the download window on purpose: a leaked upload URL is a write
     * primitive, a leaked download URL only exposes one already-known object.
     */
    private const UPLOAD_TTL_MINUTES = 30;

    /**
     * Extensions that may be rendered inline, and the Content-Type they are pinned to.
     * Deliberately excludes SVG, which is an XML document that can carry script. See
     * download().
     *
     * @var array<string,string>
     */
    private const INLINE_TYPES = [
        'pdf' => 'application/pdf',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
    ];

    /**
     * The concrete adapter rather than the Filesystem contract: `response()`,
     * `temporaryUrl()` and `temporaryUploadUrl()` all live on the adapter.
     */
    private function disk(): FilesystemAdapter
    {
        /** @var FilesystemAdapter $disk */
        $disk = Storage::disk(self::DISK);

        return $disk;
    }

    private function isS3(): bool
    {
        return config('filesystems.disks.'.self::DISK.'.driver') === 's3';
    }

    // ── keys & ownership ─────────────────────────────────────────────────────

    /**
     * "{user_id}/{milliseconds}-{sanitized_filename}" — index.ts:841, whose character class
     * is reproduced verbatim.
     *
     * Note it keeps `.`, so "../../x" becomes ".._.._x" — the dots survive but the
     * separators do not, which is what makes traversal impossible: the key ends up with
     * exactly one `/`, the user prefix.
     */
    public function objectKey(AppUser $user, string $fileName): string
    {
        // The /u modifier matters: JS replaces per CHARACTER, so an Arabic filename yields
        // one underscore per letter. Without it PCRE works per byte and every Arabic letter
        // would become two, producing keys that differ from the ones already in the bucket.
        // It returns null on malformed UTF-8, hence the byte-wise fallback.
        $safeName = preg_replace('/[^a-zA-Z0-9._-]/u', '_', $fileName)
            ?? preg_replace('/[^a-zA-Z0-9._-]/', '_', $fileName);

        $timestamp = (int) now()->getPreciseTimestamp(3);

        return "{$user->id}/{$timestamp}-{$safeName}";
    }

    /**
     * Every path must sit under the caller's own prefix.
     *
     * The reference scopes uploads by prefix but never re-checks on download or delete, so
     * any authenticated user could read or destroy another tenant's montage files by
     * guessing a path. `03 §8` calls for closing that, and this is where it closes.
     */
    public function assertOwned(AppUser $user, string $path): void
    {
        if (! str_starts_with($path, "{$user->id}/")) {
            throw ApiException::forbidden(Messages::NOT_AUTHORIZED);
        }
    }

    // ── signed URLs ──────────────────────────────────────────────────────────

    /**
     * @return array{path:string,upload_url:string,token:string}
     */
    public function uploadUrl(AppUser $user, string $fileName): array
    {
        $path = $this->objectKey($user, $fileName);
        $expiresAt = now()->addMinutes(self::UPLOAD_TTL_MINUTES);

        $url = $this->isS3()
            ? $this->disk()->temporaryUploadUrl($path, $expiresAt)['url']
            : URL::temporarySignedRoute('files.upload', $expiresAt, ['path' => $path]);

        return [
            'path' => $path,
            'upload_url' => $url,
            // Supabase returned an opaque upload token here. Nothing in the SPA reads it
            // (both call sites destructure and discard it), but it is part of the declared
            // return type in src/lib/userApi.ts, so the key stays — carrying the signature
            // that actually authorizes the PUT.
            'token' => $this->signatureOf($url),
        ];
    }

    public function downloadUrl(AppUser $user, string $path): string
    {
        $this->assertOwned($user, $path);

        $expiresAt = now()->addMinutes(self::DOWNLOAD_TTL_MINUTES);

        return $this->isS3()
            ? $this->disk()->temporaryUrl($path, $expiresAt)
            : URL::temporarySignedRoute('files.download', $expiresAt, ['path' => $path]);
    }

    // ── object operations ────────────────────────────────────────────────────

    public function delete(AppUser $user, string $path): void
    {
        $this->assertOwned($user, $path);

        // Deleting a key that is already gone is not an error, matching the reference and
        // making the endpoint idempotent.
        $this->disk()->delete($path);
    }

    public function put(string $path, string $contents): void
    {
        $this->disk()->put($path, $contents);
    }

    public function exists(string $path): bool
    {
        return $this->disk()->exists($path);
    }

    /**
     * Serve an object from the local disk.
     *
     * Against Supabase these files came from a *different* origin, so rendering one could
     * never reach the app. Serving them from our own domain changes that: an uploaded
     * .html or .svg rendered inline would execute script on the API's origin, and a signed
     * download URL needs no credentials — so a tenant could upload a payload, mint a URL
     * and send it to an admin, whose browser would run it against their own localStorage
     * (where the SPA keeps its session). Hence:
     *
     *  - only a safelist of inert types is served inline, everything else downloads as
     *    application/octet-stream (SVG included — it can carry script);
     *  - `nosniff` stops the browser second-guessing the declared type;
     *  - the sandbox CSP neutralises script even if something does get rendered.
     *
     * The safelist keeps the two things the product actually previews working: montage
     * artwork as PDF, and images in MontageUpload's <img> preview.
     *
     * S3 is unaffected — those URLs point at the bucket's own origin.
     */
    public function download(string $path): StreamedResponse
    {
        $inlineType = self::INLINE_TYPES[strtolower(pathinfo($path, PATHINFO_EXTENSION))] ?? null;

        return $this->disk()->response(
            $path,
            null,
            [
                'Content-Type' => $inlineType ?? 'application/octet-stream',
                'X-Content-Type-Options' => 'nosniff',
                'Content-Security-Policy' => "default-src 'none'; sandbox",
            ],
            $inlineType !== null ? 'inline' : 'attachment',
        );
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /** The query parameter that authorizes the request — named differently per signer. */
    private function signatureOf(string $url): string
    {
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);

        return (string) ($query['signature'] ?? $query['X-Amz-Signature'] ?? '');
    }
}
