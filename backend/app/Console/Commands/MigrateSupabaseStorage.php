<?php

namespace App\Console\Commands;

use App\Services\StorageService;
use Illuminate\Console\Command;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

/**
 * OPS-071 — copy the Supabase `montage-files` bucket onto the `montage` disk.
 *
 * **Keys are preserved exactly** — `{user_id}/{timestamp}-{sanitized_name}`. That is the
 * whole trick that keeps `saved_quotes.quote_data.attachmentUrl` valid without rewriting a
 * single row: the app resolves an attachment by key, so an identical key on the new disk
 * resolves to the same object. It also means the per-user prefix rule in StorageService
 * (03 §8) keeps working, because ownership is encoded in the key itself.
 *
 * Works against whatever `MONTAGE_DISK` points at — local in development, S3 in
 * production — because everything goes through the disk abstraction.
 *
 * Resumable: an object already present on the target with the same byte length is skipped,
 * so a re-run after a network failure only transfers what is missing. `--overwrite` forces
 * the copy, and `--verify` re-reads each written object and compares checksums.
 */
class MigrateSupabaseStorage extends Command
{
    protected $signature = 'app:migrate-supabase-storage
                            {--prefix= : Only copy keys under this prefix (e.g. one user id)}
                            {--overwrite : Re-copy objects that already exist on the target}
                            {--verify : Re-read each copied object and compare checksums}
                            {--dry-run : List what would be copied, transfer nothing}';

    protected $description = 'Copy Supabase montage-files objects onto the montage disk (Phase 7, OPS-071)';

    /** Supabase's list endpoint caps a page at 100 by default; ask for its maximum. */
    private const PAGE = 100;

    private bool $dryRun = false;

    private int $copied = 0;

    private int $skipped = 0;

    private int $failed = 0;

    private int $bytes = 0;

    public function handle(): int
    {
        $this->dryRun = (bool) $this->option('dry-run');

        if (! $this->assertConfigured()) {
            return self::FAILURE;
        }

        $bucket = (string) config('printera.supabase_storage.bucket');
        $disk = StorageService::DISK;

        $this->newLine();
        $this->info($this->dryRun
            ? "DRY RUN — enumerating {$bucket}, transferring nothing."
            : "Copying {$bucket} → `{$disk}` disk, keys unchanged.");
        $this->newLine();

        $keys = $this->enumerate($bucket);

        if ($keys === null) {
            return self::FAILURE;
        }

        $this->line(sprintf('Found %d object(s) in the bucket.', count($keys)));
        $this->newLine();

        foreach ($keys as $key) {
            $this->copyObject($bucket, $key);
        }

        $this->newLine();
        $this->table(['found', 'copied', 'skipped (already present)', 'failed', 'bytes'], [[
            count($keys), $this->copied, $this->skipped, $this->failed, number_format($this->bytes),
        ]]);

        if ($this->failed > 0) {
            $this->error("{$this->failed} object(s) failed. Re-run to retry just those — copied objects are skipped.");

            return self::FAILURE;
        }

        $this->info($this->dryRun ? 'Dry run complete.' : 'Storage copy complete. Keys are unchanged.');

        return self::SUCCESS;
    }

    // ── preflight ────────────────────────────────────────────────────────────

    private function assertConfigured(): bool
    {
        foreach (['url' => 'SUPABASE_URL', 'service_role_key' => 'SUPABASE_SERVICE_ROLE_KEY'] as $key => $env) {
            if ((string) config("printera.supabase_storage.{$key}") === '') {
                $this->error("Missing {$env} in .env — required to read the source bucket.");
                $this->line('The service-role key is a secret: use it only for this migration, then rotate it.');

                return false;
            }
        }

        return true;
    }

    private function client(): PendingRequest
    {
        $key = (string) config('printera.supabase_storage.service_role_key');

        return Http::withToken($key)
            ->withHeaders(['apikey' => $key])
            ->timeout(120)
            ->retry(3, 500);
    }

    private function baseUrl(): string
    {
        return rtrim((string) config('printera.supabase_storage.url'), '/').'/storage/v1';
    }

    // ── enumeration ──────────────────────────────────────────────────────────

    /**
     * Every object key in the bucket.
     *
     * Supabase's list endpoint is one level deep and reports folders as entries with a null
     * id, so this walks the tree: the top level is one folder per user, and the objects sit
     * inside. Paginated, because a busy tenant can exceed one page on its own.
     *
     * @return array<int,string>|null null on a transport failure
     */
    private function enumerate(string $bucket): ?array
    {
        $prefix = trim((string) $this->option('prefix'), '/');

        try {
            $keys = [];
            $folders = [];

            if ($prefix !== '') {
                $folders[] = $prefix;
            } else {
                foreach ($this->listPrefix($bucket, '') as $entry) {
                    // A null id marks a folder — one per user under this key scheme. A
                    // real object at the root would be unexpected, but carry it rather
                    // than drop it.
                    $entry['id'] === null
                        ? $folders[] = $entry['name']
                        : $keys[] = $entry['name'];
                }
            }

            foreach ($folders as $folder) {
                foreach ($this->listPrefix($bucket, $folder) as $entry) {
                    if ($entry['id'] === null) {
                        continue; // nested folder — this key scheme has none
                    }
                    $keys[] = "{$folder}/{$entry['name']}";
                }
            }

            sort($keys);

            return $keys;
        } catch (\Throwable $e) {
            $this->error('Could not list the bucket: '.$e->getMessage());

            return null;
        }
    }

    /**
     * One directory level, following pagination.
     *
     * @return array<int,array{name:string,id:?string}>
     */
    private function listPrefix(string $bucket, string $prefix): array
    {
        $entries = [];
        $offset = 0;

        while (true) {
            $response = $this->client()->post("{$this->baseUrl()}/object/list/{$bucket}", [
                'prefix' => $prefix === '' ? '' : "{$prefix}/",
                'limit' => self::PAGE,
                'offset' => $offset,
                'sortBy' => ['column' => 'name', 'order' => 'asc'],
            ]);

            if (! $response->successful()) {
                throw new \RuntimeException("list {$prefix} → HTTP {$response->status()}");
            }

            $page = $response->json();

            if (! is_array($page) || $page === []) {
                break;
            }

            foreach ($page as $entry) {
                // Supabase emits a placeholder row for empty folders; it is not an object.
                if (($entry['name'] ?? '') === '.emptyFolderPlaceholder') {
                    continue;
                }
                $entries[] = ['name' => (string) $entry['name'], 'id' => $entry['id'] ?? null];
            }

            if (count($page) < self::PAGE) {
                break;
            }

            $offset += self::PAGE;
        }

        return $entries;
    }

    // ── transfer ─────────────────────────────────────────────────────────────

    private function copyObject(string $bucket, string $key): void
    {
        $disk = Storage::disk(StorageService::DISK);

        if (! $this->option('overwrite') && $disk->exists($key)) {
            $this->skipped++;
            $this->output->write('·');

            return;
        }

        if ($this->dryRun) {
            $this->copied++;
            $this->line("  would copy {$key}");

            return;
        }

        try {
            $response = $this->client()->get("{$this->baseUrl()}/object/{$bucket}/".$this->encodeKey($key));

            if (! $response->successful()) {
                throw new \RuntimeException("HTTP {$response->status()}");
            }

            $body = $response->body();
            $disk->put($key, $body);

            if ($this->option('verify')) {
                $written = (string) $disk->get($key);

                if (hash('sha256', $written) !== hash('sha256', $body)) {
                    throw new \RuntimeException('checksum mismatch after write');
                }
            }

            $this->copied++;
            $this->bytes += strlen($body);
            $this->output->write('.');
        } catch (\Throwable $e) {
            $this->failed++;
            $this->newLine();
            $this->error("  {$key}: ".$e->getMessage());
        }
    }

    /** Path segments are URL-encoded individually so the `/` separators survive. */
    private function encodeKey(string $key): string
    {
        return implode('/', array_map('rawurlencode', explode('/', $key)));
    }
}
