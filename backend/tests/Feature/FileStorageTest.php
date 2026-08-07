<?php

namespace Tests\Feature;

use App\Models\AppUser;
use App\Services\StorageService;
use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-050 — montage file storage. Ports handleGetUploadUrl / handleGetFileUrl /
 * handleDeleteFile (manage-users/index.ts:833-878), replacing the Supabase
 * `montage-files` bucket with the private `montage` disk.
 */
class FileStorageTest extends TestCase
{
    use MakesUsers, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake(StorageService::DISK);
    }

    /** Headroom for the couple of tests that open a second device. */
    private function makeTenant(array $attrs = []): AppUser
    {
        return $this->makeUser(array_merge(['username' => 'tenant', 'max_devices' => 3], $attrs));
    }

    /** @return array<string,string> */
    private function authAs(string $username = 'tenant', string $device = 'dev-1'): array
    {
        return $this->bearer(
            $this->login(['username' => $username, 'device_id' => $device])->json('session_token')
        );
    }

    /** Run the whole browser flow: ask for a URL, PUT the bytes, return the stored path. */
    private function upload(array $auth, string $fileName, string $contents = 'PDF-BYTES'): string
    {
        $issued = $this->postJson('/api/v1/files/upload-url', ['file_name' => $fileName], $auth)
            ->assertOk()->json();

        // No auth header — the browser sends none (MontageUpload.tsx).
        $this->call('PUT', $issued['upload_url'], [], [], [], [], $contents)->assertOk();

        return $issued['path'];
    }

    // ── object keys ──────────────────────────────────────────────────────────

    public function test_the_object_key_keeps_the_reference_convention(): void
    {
        $user = $this->makeTenant();

        $path = $this->postJson('/api/v1/files/upload-url', ['file_name' => 'montage.pdf'], $this->authAs())
            ->assertOk()
            ->assertJsonStructure(['path', 'upload_url', 'token'])
            ->json('path');

        // "{user_id}/{milliseconds}-{sanitized}"
        $this->assertMatchesRegularExpression('#^'.preg_quote($user->id, '#').'/\d{13}-montage\.pdf$#', $path);
    }

    public function test_the_filename_is_sanitised_to_the_reference_character_class(): void
    {
        $this->makeTenant();
        $auth = $this->authAs();

        $cases = [
            // 3 Arabic letters + space + 8 Arabic letters = 12 underscores. One per
            // CHARACTER, as JS produces — a byte-wise sanitiser would emit 22.
            'ملف المونتاج.pdf' => '____________.pdf',
            'my file (1).pdf' => 'my_file__1_.pdf',
            'a/b/c.pdf' => 'a_b_c.pdf',
            'ok-name_1.PDF' => 'ok-name_1.PDF',
        ];

        foreach ($cases as $input => $expected) {
            $path = $this->postJson('/api/v1/files/upload-url', ['file_name' => $input], $auth)
                ->assertOk()->json('path');

            // Drop the "{uuid}/" prefix first — the uuid contains its own hyphens.
            $keyed = substr($path, strpos($path, '/') + 1);

            $this->assertSame($expected, substr($keyed, strpos($keyed, '-') + 1), "sanitising {$input}");
        }
    }

    public function test_a_traversal_attempt_cannot_escape_the_user_prefix(): void
    {
        // The sanitiser keeps dots but strips separators, so the payload collapses into an
        // ordinary flat filename: the dots are inert without a `/` to walk.
        $user = $this->makeTenant();

        $path = $this->postJson('/api/v1/files/upload-url', [
            'file_name' => '../../../etc/passwd',
        ], $this->authAs())->assertOk()->json('path');

        $this->assertStringStartsWith("{$user->id}/", $path);
        // Exactly one separator — the user prefix — so the key cannot address a directory.
        $this->assertSame(1, substr_count($path, '/'));
        $this->assertStringEndsWith('-.._.._.._etc_passwd', $path);
    }

    public function test_a_missing_file_name_returns_the_reference_message(): void
    {
        $this->makeTenant();

        $this->postJson('/api/v1/files/upload-url', [], $this->authAs())
            ->assertStatus(400)
            ->assertExactJson(['error' => Messages::FILE_NAME_REQUIRED]);

        $this->postJson('/api/v1/files/upload-url', ['file_name' => ''], $this->authAs('tenant', 'dev-2'))
            ->assertStatus(400)
            ->assertExactJson(['error' => Messages::FILE_NAME_REQUIRED]);
    }

    // ── the round trip ───────────────────────────────────────────────────────

    public function test_a_file_uploads_and_reads_back_through_signed_urls(): void
    {
        $this->makeTenant();
        $auth = $this->authAs();

        $path = $this->upload($auth, 'montage.pdf', 'THE-ARTWORK');

        Storage::disk(StorageService::DISK)->assertExists($path);

        $signed = $this->postJson('/api/v1/files/download-url', ['file_path' => $path], $auth)
            ->assertOk()->json('signed_url');

        $response = $this->get($signed);
        $response->assertOk();
        $this->assertSame('THE-ARTWORK', $response->streamedContent());
    }

    public function test_the_upload_url_carries_its_own_authorization(): void
    {
        // The whole point of the signed route: no session, no bearer token, still works.
        $this->makeTenant();
        $auth = $this->authAs();

        $issued = $this->postJson('/api/v1/files/upload-url', ['file_name' => 'a.pdf'], $auth)
            ->assertOk()->json();

        $this->assertNotSame('', $issued['token']);
        $this->call('PUT', $issued['upload_url'], [], [], [], [], 'bytes')->assertOk();

        Storage::disk(StorageService::DISK)->assertExists($issued['path']);
    }

    public function test_an_unsigned_upload_is_refused(): void
    {
        $this->makeTenant();
        $this->authAs();

        $this->call('PUT', '/api/v1/files/upload?path=someone/1-a.pdf', [], [], [], [], 'bytes')
            ->assertStatus(403);

        $this->assertSame([], Storage::disk(StorageService::DISK)->allFiles());
    }

    public function test_a_tampered_path_invalidates_the_signature(): void
    {
        // The signature covers the query string, so swapping the key after the fact fails.
        $victim = $this->makeUser(['username' => 'victim']);
        $this->makeUser(['username' => 'attacker']);
        $auth = $this->authAs('attacker');

        $issued = $this->postJson('/api/v1/files/upload-url', ['file_name' => 'a.pdf'], $auth)
            ->assertOk()->json();

        $tampered = preg_replace(
            '/path=[^&]+/',
            'path='.urlencode("{$victim->id}/9999-evil.pdf"),
            $issued['upload_url']
        );

        $this->call('PUT', $tampered, [], [], [], [], 'evil')->assertStatus(403);

        $this->assertSame([], Storage::disk(StorageService::DISK)->allFiles());
    }

    public function test_an_expired_signature_is_refused(): void
    {
        $this->makeTenant();
        $auth = $this->authAs();

        $issued = $this->postJson('/api/v1/files/upload-url', ['file_name' => 'a.pdf'], $auth)
            ->assertOk()->json();

        $this->travel(31)->minutes();

        $this->call('PUT', $issued['upload_url'], [], [], [], [], 'bytes')->assertStatus(403);
    }

    public function test_a_download_url_expires_after_an_hour(): void
    {
        $this->makeTenant();
        $auth = $this->authAs();
        $path = $this->upload($auth, 'a.pdf');

        $signed = $this->postJson('/api/v1/files/download-url', ['file_path' => $path], $auth)
            ->assertOk()->json('signed_url');

        $this->travel(59)->minutes();
        $this->get($signed)->assertOk();

        $this->travel(2)->minutes();
        $this->get($signed)->assertStatus(403);
    }

    // ── serving files from our own origin ────────────────────────────────────

    public function test_an_uploaded_html_file_is_never_rendered_inline(): void
    {
        // The stored-XSS case that moving off Supabase introduced: a signed download URL
        // needs no credentials, so a tenant could mint one for a payload and send it to an
        // admin, whose browser would run it against the app's own origin and localStorage.
        $this->makeTenant();
        $auth = $this->authAs();

        $path = $this->upload($auth, 'payload.html', '<script>alert(document.cookie)</script>');

        $signed = $this->postJson('/api/v1/files/download-url', ['file_path' => $path], $auth)
            ->assertOk()->json('signed_url');

        $response = $this->get($signed);
        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/octet-stream');
        $this->assertStringStartsWith('attachment', $response->headers->get('Content-Disposition'));
    }

    public function test_svg_is_forced_to_download_because_it_can_carry_script(): void
    {
        $this->makeTenant();
        $auth = $this->authAs();

        $path = $this->upload($auth, 'logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');

        $signed = $this->postJson('/api/v1/files/download-url', ['file_path' => $path], $auth)
            ->assertOk()->json('signed_url');

        $response = $this->get($signed);
        $response->assertHeader('Content-Type', 'application/octet-stream');
        $this->assertStringStartsWith('attachment', $response->headers->get('Content-Disposition'));
    }

    public function test_the_formats_the_product_previews_still_render_inline(): void
    {
        // The safelist has to keep MontageUpload's <img> preview and PDF viewing working.
        $this->makeTenant();
        $auth = $this->authAs();

        foreach (['montage.pdf' => 'application/pdf', 'art.png' => 'image/png', 'photo.JPEG' => 'image/jpeg'] as $name => $type) {
            $path = $this->upload($auth, $name, 'BYTES');

            $signed = $this->postJson('/api/v1/files/download-url', ['file_path' => $path], $auth)
                ->assertOk()->json('signed_url');

            $response = $this->get($signed);
            $response->assertHeader('Content-Type', $type);
            $this->assertStringStartsWith('inline', $response->headers->get('Content-Disposition'), $name);
        }
    }

    public function test_every_download_carries_the_hardening_headers(): void
    {
        $this->makeTenant();
        $auth = $this->authAs();
        $path = $this->upload($auth, 'art.png', 'BYTES');

        $signed = $this->postJson('/api/v1/files/download-url', ['file_path' => $path], $auth)
            ->assertOk()->json('signed_url');

        $this->get($signed)
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    }

    public function test_a_disguised_extension_cannot_win_back_an_inline_render(): void
    {
        // Content-Type is pinned from the extension and nosniff blocks the browser from
        // second-guessing it, so HTML bytes under a .png name stay an image/png download.
        $this->makeTenant();
        $auth = $this->authAs();

        $path = $this->upload($auth, 'sneaky.png', '<html><script>alert(1)</script></html>');

        $signed = $this->postJson('/api/v1/files/download-url', ['file_path' => $path], $auth)
            ->assertOk()->json('signed_url');

        $this->get($signed)
            ->assertHeader('Content-Type', 'image/png')
            ->assertHeader('X-Content-Type-Options', 'nosniff');
    }

    public function test_downloading_a_missing_object_is_a_404(): void
    {
        $user = $this->makeTenant();
        $auth = $this->authAs();

        $signed = $this->postJson('/api/v1/files/download-url', [
            'file_path' => "{$user->id}/1700000000000-gone.pdf",
        ], $auth)->assertOk()->json('signed_url');

        $this->get($signed)->assertStatus(404);
    }

    // ── the caller-prefix rule ───────────────────────────────────────────────

    public function test_another_users_file_cannot_be_downloaded(): void
    {
        // The gap this closes: the reference scopes uploads by prefix but never re-checks
        // on download or delete, so a guessed path exposed another tenant's artwork.
        $this->makeUser(['username' => 'victim']);
        $this->makeUser(['username' => 'attacker']);

        $victimPath = $this->upload($this->authAs('victim'), 'secret.pdf', 'CONFIDENTIAL');

        $this->postJson('/api/v1/files/download-url', ['file_path' => $victimPath], $this->authAs('attacker'))
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);
    }

    public function test_another_users_file_cannot_be_deleted(): void
    {
        $this->makeUser(['username' => 'victim']);
        $this->makeUser(['username' => 'attacker']);

        $victimPath = $this->upload($this->authAs('victim'), 'secret.pdf');

        $this->postJson('/api/v1/files/delete', ['file_path' => $victimPath], $this->authAs('attacker'))
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);

        Storage::disk(StorageService::DISK)->assertExists($victimPath);
    }

    public function test_a_prefix_that_merely_starts_with_the_id_is_not_enough(): void
    {
        // "<id>evil/…" must not pass a naive startsWith check — the separator matters.
        $user = $this->makeTenant();

        $this->postJson('/api/v1/files/download-url', [
            'file_path' => "{$user->id}evil/1-a.pdf",
        ], $this->authAs())
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);
    }

    public function test_an_employee_cannot_reach_its_owners_files(): void
    {
        // Files are per-user, not per-family: the quote visibility rules do not extend here
        // and the reference never shared them either.
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 2]);
        $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);

        $ownerPath = $this->upload($this->authAs('owner'), 'owner.pdf');

        $this->postJson('/api/v1/files/download-url', ['file_path' => $ownerPath], $this->authAs('emp'))
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);
    }

    // ── delete ───────────────────────────────────────────────────────────────

    public function test_delete_removes_the_object(): void
    {
        $this->makeTenant();
        $auth = $this->authAs();
        $path = $this->upload($auth, 'a.pdf');

        $this->postJson('/api/v1/files/delete', ['file_path' => $path], $auth)
            ->assertOk()
            ->assertExactJson(['success' => true]);

        Storage::disk(StorageService::DISK)->assertMissing($path);
    }

    public function test_delete_is_idempotent(): void
    {
        $user = $this->makeTenant();
        $auth = $this->authAs();

        $this->postJson('/api/v1/files/delete', [
            'file_path' => "{$user->id}/1700000000000-never-existed.pdf",
        ], $auth)->assertOk()->assertExactJson(['success' => true]);
    }

    public function test_delete_leaves_the_users_other_files_alone(): void
    {
        $this->makeTenant();
        $auth = $this->authAs();

        $doomed = $this->upload($auth, 'doomed.pdf');
        $keeper = $this->upload($auth, 'keeper.pdf');

        $this->postJson('/api/v1/files/delete', ['file_path' => $doomed], $auth)->assertOk();

        Storage::disk(StorageService::DISK)->assertMissing($doomed);
        Storage::disk(StorageService::DISK)->assertExists($keeper);
    }

    public function test_a_missing_file_path_returns_the_reference_message(): void
    {
        $this->makeTenant();
        $auth = $this->authAs();

        $this->postJson('/api/v1/files/download-url', [], $auth)
            ->assertStatus(400)
            ->assertExactJson(['error' => Messages::FILE_PATH_REQUIRED]);

        $this->postJson('/api/v1/files/delete', ['file_path' => ''], $auth)
            ->assertStatus(400)
            ->assertExactJson(['error' => Messages::FILE_PATH_REQUIRED]);
    }

    // ── authentication ───────────────────────────────────────────────────────

    public function test_the_json_endpoints_require_authentication(): void
    {
        $this->postJson('/api/v1/files/upload-url', ['file_name' => 'a.pdf'])
            ->assertStatus(401)->assertJson(['session_expired' => true]);
        $this->postJson('/api/v1/files/download-url', ['file_path' => 'x/y.pdf'])
            ->assertStatus(401)->assertJson(['session_expired' => true]);
        $this->postJson('/api/v1/files/delete', ['file_path' => 'x/y.pdf'])
            ->assertStatus(401)->assertJson(['session_expired' => true]);
    }

    public function test_a_revoked_session_can_no_longer_mint_urls(): void
    {
        $this->makeTenant();
        $auth = $this->authAs();

        $this->postJson('/api/v1/files/upload-url', ['file_name' => 'a.pdf'], $auth)->assertOk();

        AppUser::query()->where('username', 'tenant')->firstOrFail()->sessions()->delete();

        $this->postJson('/api/v1/files/upload-url', ['file_name' => 'a.pdf'], $auth)
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);
    }
}
