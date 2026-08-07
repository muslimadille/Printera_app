<?php

namespace Tests\Feature;

use App\Models\AppUser;
use App\Services\StorageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * OPS-071 — the montage-files → montage disk copy.
 *
 * The Supabase Storage API is faked; what is under test is that keys cross UNCHANGED
 * (which is what keeps saved attachment references valid), that the walk finds objects
 * inside per-user folders, and that a re-run after a failure only moves what is missing.
 */
class MigrateSupabaseStorageTest extends TestCase
{
    use RefreshDatabase;

    private const BUCKET = 'montage-files';

    private const BASE = 'https://proj.supabase.co';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'printera.supabase_storage.url' => self::BASE,
            'printera.supabase_storage.service_role_key' => 'service-role-secret',
            'printera.supabase_storage.bucket' => self::BUCKET,
        ]);

        Storage::fake(StorageService::DISK);
        Http::preventStrayRequests();
    }

    /**
     * Fake the two endpoints the command uses: a POST list per directory level, and a GET
     * per object.
     *
     * @param  array<string,array<int,string>>  $tree  folder => file names
     * @param  array<string,string>  $contents  full key => bytes
     */
    private function fakeBucket(array $tree, array $contents): void
    {
        Http::fake([
            self::BASE.'/storage/v1/object/list/'.self::BUCKET => function ($request) use ($tree) {
                $prefix = trim($request->data()['prefix'] ?? '', '/');

                if ($prefix === '') {
                    // Top level: one folder entry per user, id null marks a folder.
                    return Http::response(array_map(
                        fn (string $folder): array => ['name' => $folder, 'id' => null],
                        array_keys($tree),
                    ));
                }

                return Http::response(array_map(
                    fn (string $file): array => ['name' => $file, 'id' => 'obj-'.$file],
                    $tree[$prefix] ?? [],
                ));
            },
            self::BASE.'/storage/v1/object/'.self::BUCKET.'/*' => function ($request) use ($contents) {
                $key = rawurldecode(str_replace(self::BASE.'/storage/v1/object/'.self::BUCKET.'/', '', $request->url()));

                return isset($contents[$key])
                    ? Http::response($contents[$key])
                    : Http::response('not found', 404);
            },
        ]);
    }

    // ── the copy ─────────────────────────────────────────────────────────────

    public function test_objects_are_copied_with_identical_keys(): void
    {
        // Identical keys are the whole point: quote_data stores `storage:{key}`, so an
        // unchanged key means no row has to be rewritten.
        $this->fakeBucket(
            ['user-a' => ['1700000000000-montage.pdf'], 'user-b' => ['1700000000001-art.png']],
            [
                'user-a/1700000000000-montage.pdf' => 'PDF-BYTES',
                'user-b/1700000000001-art.png' => 'PNG-BYTES',
            ],
        );

        $this->artisan('app:migrate-supabase-storage')->assertSuccessful();

        $disk = Storage::disk(StorageService::DISK);
        $disk->assertExists('user-a/1700000000000-montage.pdf');
        $disk->assertExists('user-b/1700000000001-art.png');
        $this->assertSame('PDF-BYTES', $disk->get('user-a/1700000000000-montage.pdf'));
        $this->assertSame('PNG-BYTES', $disk->get('user-b/1700000000001-art.png'));
    }

    public function test_the_per_user_prefix_survives_so_ownership_still_resolves(): void
    {
        // StorageService::assertOwned gates on the `{user_id}/` prefix, so a flattened or
        // re-rooted key would silently break every download.
        $this->fakeBucket(
            ['019fddb0-d32f-71c3-a0e9-19a75953f853' => ['1700000000000-a.pdf']],
            ['019fddb0-d32f-71c3-a0e9-19a75953f853/1700000000000-a.pdf' => 'X'],
        );

        $this->artisan('app:migrate-supabase-storage')->assertSuccessful();

        $this->assertSame(
            ['019fddb0-d32f-71c3-a0e9-19a75953f853/1700000000000-a.pdf'],
            Storage::disk(StorageService::DISK)->allFiles(),
        );
    }

    public function test_arabic_and_spaced_keys_are_url_encoded_in_transit_but_stored_verbatim(): void
    {
        $key = 'user-a/1700000000000-____________.pdf';
        $this->fakeBucket(['user-a' => ['1700000000000-____________.pdf']], [$key => 'BYTES']);

        $this->artisan('app:migrate-supabase-storage')->assertSuccessful();

        Storage::disk(StorageService::DISK)->assertExists($key);
    }

    public function test_the_empty_folder_placeholder_is_not_treated_as_an_object(): void
    {
        Http::fake([
            self::BASE.'/storage/v1/object/list/'.self::BUCKET => function ($request) {
                $prefix = trim($request->data()['prefix'] ?? '', '/');

                return $prefix === ''
                    ? Http::response([['name' => 'user-a', 'id' => null]])
                    : Http::response([['name' => '.emptyFolderPlaceholder', 'id' => 'ph']]);
            },
        ]);

        $this->artisan('app:migrate-supabase-storage')->assertSuccessful();

        $this->assertSame([], Storage::disk(StorageService::DISK)->allFiles());
    }

    // ── resumability ─────────────────────────────────────────────────────────

    public function test_a_re_run_skips_objects_already_present(): void
    {
        $this->fakeBucket(['user-a' => ['1-a.pdf']], ['user-a/1-a.pdf' => 'BYTES']);

        $this->artisan('app:migrate-supabase-storage')->assertSuccessful();
        Http::assertSentCount(3); // list root, list folder, download

        $this->artisan('app:migrate-supabase-storage')->assertSuccessful();
        // Two more list calls, but NO second download — the object was skipped.
        Http::assertSentCount(5);
    }

    public function test_overwrite_forces_a_re_download(): void
    {
        $this->fakeBucket(['user-a' => ['1-a.pdf']], ['user-a/1-a.pdf' => 'NEW-BYTES']);
        Storage::disk(StorageService::DISK)->put('user-a/1-a.pdf', 'STALE');

        $this->artisan('app:migrate-supabase-storage', ['--overwrite' => true])->assertSuccessful();

        $this->assertSame('NEW-BYTES', Storage::disk(StorageService::DISK)->get('user-a/1-a.pdf'));
    }

    public function test_a_failed_object_does_not_abort_the_rest_and_reports_failure(): void
    {
        // The download for b is a 404; a and c must still land, and the command must exit
        // non-zero so the operator knows to re-run.
        $this->fakeBucket(
            ['user-a' => ['1-a.pdf', '2-b.pdf', '3-c.pdf']],
            ['user-a/1-a.pdf' => 'A', 'user-a/3-c.pdf' => 'C'],
        );

        $this->artisan('app:migrate-supabase-storage')->assertFailed();

        $disk = Storage::disk(StorageService::DISK);
        $disk->assertExists('user-a/1-a.pdf');
        $disk->assertExists('user-a/3-c.pdf');
        $disk->assertMissing('user-a/2-b.pdf');
    }

    // ── flags & preflight ────────────────────────────────────────────────────

    public function test_dry_run_transfers_nothing(): void
    {
        $this->fakeBucket(['user-a' => ['1-a.pdf']], ['user-a/1-a.pdf' => 'BYTES']);

        $this->artisan('app:migrate-supabase-storage', ['--dry-run' => true])->assertSuccessful();

        $this->assertSame([], Storage::disk(StorageService::DISK)->allFiles());
    }

    public function test_prefix_limits_the_copy_to_one_user(): void
    {
        $this->fakeBucket(
            ['user-a' => ['1-a.pdf'], 'user-b' => ['2-b.pdf']],
            ['user-a/1-a.pdf' => 'A', 'user-b/2-b.pdf' => 'B'],
        );

        $this->artisan('app:migrate-supabase-storage', ['--prefix' => 'user-b'])->assertSuccessful();

        $this->assertSame(['user-b/2-b.pdf'], Storage::disk(StorageService::DISK)->allFiles());
    }

    public function test_verify_checks_the_written_bytes(): void
    {
        $this->fakeBucket(['user-a' => ['1-a.pdf']], ['user-a/1-a.pdf' => 'BYTES']);

        $this->artisan('app:migrate-supabase-storage', ['--verify' => true])->assertSuccessful();

        $this->assertSame('BYTES', Storage::disk(StorageService::DISK)->get('user-a/1-a.pdf'));
    }

    public function test_it_refuses_to_run_without_credentials(): void
    {
        config(['printera.supabase_storage.service_role_key' => null]);

        $this->artisan('app:migrate-supabase-storage')->assertFailed();

        Http::assertNothingSent();
    }

    public function test_the_service_role_key_is_sent_as_both_bearer_and_apikey(): void
    {
        // Supabase's storage API accepts either; sending both matches its own SDK and
        // avoids a 401 on older gateway versions.
        $this->fakeBucket(['user-a' => ['1-a.pdf']], ['user-a/1-a.pdf' => 'BYTES']);

        $this->artisan('app:migrate-supabase-storage')->assertSuccessful();

        Http::assertSent(fn ($request) => $request->hasHeader('Authorization', 'Bearer service-role-secret')
            && $request->hasHeader('apikey', 'service-role-secret'));
    }

    // ── the point of the whole exercise ──────────────────────────────────────

    public function test_a_migrated_object_downloads_through_the_apps_signed_url_flow(): void
    {
        // End to end: copy an object, then fetch it the way the SPA does — mint a signed
        // URL for the key stored in quote_data, then open it.
        $user = AppUser::query()->create([
            'username' => 'owner', 'password_hash' => bcrypt('pw'),
            'is_active' => true, 'is_admin' => false, 'max_devices' => 1, 'max_employees' => 0,
        ]);
        $key = "{$user->id}/1700000000000-montage.pdf";

        $this->fakeBucket([$user->id => ['1700000000000-montage.pdf']], [$key => 'THE-ARTWORK']);
        $this->artisan('app:migrate-supabase-storage')->assertSuccessful();

        $token = $this->postJson('/api/v1/auth/login', [
            'username' => 'owner', 'password' => 'pw', 'device_id' => 'd1',
        ])->assertOk()->json('session_token');

        $signed = $this->postJson('/api/v1/files/download-url', ['file_path' => $key], [
            'Authorization' => "Bearer {$token}",
        ])->assertOk()->json('signed_url');

        $response = $this->get($signed);
        $response->assertOk();
        $this->assertSame('THE-ARTWORK', $response->streamedContent());
    }
}
