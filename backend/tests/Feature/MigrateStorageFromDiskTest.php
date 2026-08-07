<?php

namespace Tests\Feature;

use App\Models\AppUser;
use App\Services\Storage\DiskObjectSource;
use App\Services\Storage\ObjectSource;
use App\Services\StorageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * OPS-071a — the storage copy driven from a real filesystem rather than a faked API.
 *
 * MigrateSupabaseStorageTest covers the Supabase walk by asserting against canned HTTP
 * responses, which means the test and the code share one author's model of that API. This
 * file removes that circularity: a source disk holding real bytes under real keys, copied
 * to a target disk, with the result compared byte for byte. What it proves — keys cross
 * unchanged, contents cross unchanged, a re-run moves nothing — holds for either source,
 * because both arrive through the same ObjectSource seam.
 *
 * It also covers the `--from-disk` route the interface made possible: export the bucket,
 * then migrate from the export with no service-role key in play.
 */
class MigrateStorageFromDiskTest extends TestCase
{
    use RefreshDatabase;

    private const SOURCE_DISK = 'supabase-export';

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake(self::SOURCE_DISK);
        Storage::fake(StorageService::DISK);

        // Nothing here may reach the network: if the copy is talking to Supabase, the
        // source seam is not being used.
        Http::preventStrayRequests();
    }

    /** @param array<string,string> $objects key => bytes */
    private function seedSource(array $objects): void
    {
        foreach ($objects as $key => $bytes) {
            Storage::disk(self::SOURCE_DISK)->put($key, $bytes);
        }

        $this->app->instance(
            ObjectSource::class,
            new DiskObjectSource(Storage::disk(self::SOURCE_DISK), 'fake export'),
        );
    }

    // ── keys and bytes ───────────────────────────────────────────────────────

    public function test_every_object_is_copied_under_an_identical_key(): void
    {
        $objects = [
            'user-a/1700000000000-montage.pdf' => 'PDF-BYTES',
            'user-a/1700000000001-artwork.png' => 'PNG-BYTES',
            'user-b/1700000000002-die.svg' => 'SVG-BYTES',
        ];
        $this->seedSource($objects);

        $this->artisan('app:migrate-supabase-storage')->assertSuccessful();

        $target = Storage::disk(StorageService::DISK);
        $this->assertSame(array_keys($objects), $target->allFiles());

        foreach ($objects as $key => $bytes) {
            $this->assertSame($bytes, $target->get($key), "contents differ for {$key}");
        }
    }

    public function test_an_arabic_key_crosses_unchanged(): void
    {
        // StorageService sanitises upload names, but the bucket predates that rule and
        // Arabic keys are already in it. The copy must not re-encode, transliterate or
        // otherwise "fix" a key: the value stored in quote_data has to keep resolving.
        $key = 'user-a/1700000000000-تصميم-علبة.pdf';
        $this->seedSource([$key => 'ARABIC-KEYED-BYTES']);

        $this->artisan('app:migrate-supabase-storage')->assertSuccessful();

        Storage::disk(StorageService::DISK)->assertExists($key);
        $this->assertSame([$key], Storage::disk(StorageService::DISK)->allFiles());
        $this->assertSame('ARABIC-KEYED-BYTES', Storage::disk(StorageService::DISK)->get($key));
    }

    public function test_binary_content_is_not_corrupted(): void
    {
        // Real montage files are PDFs and PNGs. Anything that treats the body as text —
        // an encoding conversion, a trailing newline — shows up here and nowhere else.
        $binary = random_bytes(4096)."\x00\xff\xfe".random_bytes(64);
        $this->seedSource(['user-a/1700000000000-real.pdf' => $binary]);

        $this->artisan('app:migrate-supabase-storage', ['--verify' => true])->assertSuccessful();

        $written = (string) Storage::disk(StorageService::DISK)->get('user-a/1700000000000-real.pdf');
        $this->assertSame(strlen($binary), strlen($written));
        $this->assertSame(hash('sha256', $binary), hash('sha256', $written));
    }

    public function test_the_empty_folder_placeholder_is_not_copied(): void
    {
        // Supabase writes one into every empty folder, and it travels with an export.
        $this->seedSource([
            'user-a/.emptyFolderPlaceholder' => '',
            'user-a/1700000000000-real.pdf' => 'BYTES',
        ]);

        $this->artisan('app:migrate-supabase-storage')->assertSuccessful();

        $this->assertSame(['user-a/1700000000000-real.pdf'], Storage::disk(StorageService::DISK)->allFiles());
    }

    // ── resumability ─────────────────────────────────────────────────────────

    public function test_a_second_run_transfers_nothing_and_changes_nothing(): void
    {
        $this->seedSource([
            'user-a/1-a.pdf' => 'A',
            'user-a/2-b.pdf' => 'B',
        ]);

        $this->artisan('app:migrate-supabase-storage')->assertSuccessful();
        $this->artisan('app:migrate-supabase-storage')
            ->expectsOutputToContain('Found 2 object(s).')
            ->assertSuccessful();

        $target = Storage::disk(StorageService::DISK);
        $this->assertSame(['user-a/1-a.pdf', 'user-a/2-b.pdf'], $target->allFiles());
        $this->assertSame('A', $target->get('user-a/1-a.pdf'));
        $this->assertSame('B', $target->get('user-a/2-b.pdf'));
    }

    public function test_a_run_interrupted_half_way_completes_on_the_next_attempt(): void
    {
        // The resume path: one object already across, the rest missing.
        $this->seedSource([
            'user-a/1-a.pdf' => 'A',
            'user-a/2-b.pdf' => 'B',
            'user-a/3-c.pdf' => 'C',
        ]);
        Storage::disk(StorageService::DISK)->put('user-a/1-a.pdf', 'A');

        $this->artisan('app:migrate-supabase-storage')->assertSuccessful();

        $this->assertSame(
            ['user-a/1-a.pdf', 'user-a/2-b.pdf', 'user-a/3-c.pdf'],
            Storage::disk(StorageService::DISK)->allFiles(),
        );
    }

    public function test_overwrite_replaces_a_stale_object(): void
    {
        $this->seedSource(['user-a/1-a.pdf' => 'FRESH']);
        Storage::disk(StorageService::DISK)->put('user-a/1-a.pdf', 'STALE');

        $this->artisan('app:migrate-supabase-storage')->assertSuccessful();
        $this->assertSame('STALE', Storage::disk(StorageService::DISK)->get('user-a/1-a.pdf'));

        $this->artisan('app:migrate-supabase-storage', ['--overwrite' => true])->assertSuccessful();
        $this->assertSame('FRESH', Storage::disk(StorageService::DISK)->get('user-a/1-a.pdf'));
    }

    // ── flags ────────────────────────────────────────────────────────────────

    public function test_dry_run_transfers_nothing(): void
    {
        $this->seedSource(['user-a/1-a.pdf' => 'A']);

        $this->artisan('app:migrate-supabase-storage', ['--dry-run' => true])->assertSuccessful();

        $this->assertSame([], Storage::disk(StorageService::DISK)->allFiles());
    }

    public function test_prefix_limits_the_copy_to_one_user(): void
    {
        $this->seedSource(['user-a/1-a.pdf' => 'A', 'user-b/2-b.pdf' => 'B']);

        $this->artisan('app:migrate-supabase-storage', ['--prefix' => 'user-b'])->assertSuccessful();

        $this->assertSame(['user-b/2-b.pdf'], Storage::disk(StorageService::DISK)->allFiles());
    }

    public function test_from_disk_rejects_a_folder_that_does_not_exist(): void
    {
        $this->artisan('app:migrate-supabase-storage', ['--from-disk' => storage_path('no-such-export')])
            ->assertFailed();
    }

    public function test_from_disk_reads_a_real_folder_without_any_supabase_credentials(): void
    {
        // The point of --from-disk: export the bucket, then migrate from the export. No
        // service-role key is configured here at all.
        config([
            'printera.supabase_storage.url' => null,
            'printera.supabase_storage.service_role_key' => null,
        ]);

        $root = storage_path('framework/testing/export-'.uniqid());
        @mkdir($root.'/user-a', 0777, true);
        file_put_contents($root.'/user-a/1700000000000-montage.pdf', 'EXPORTED-BYTES');

        try {
            $this->artisan('app:migrate-supabase-storage', ['--from-disk' => $root])->assertSuccessful();

            $this->assertSame(
                'EXPORTED-BYTES',
                Storage::disk(StorageService::DISK)->get('user-a/1700000000000-montage.pdf'),
            );
        } finally {
            @unlink($root.'/user-a/1700000000000-montage.pdf');
            @rmdir($root.'/user-a');
            @rmdir($root);
        }
    }

    // ── the point of the whole exercise ──────────────────────────────────────

    public function test_a_copied_object_opens_through_the_apps_own_download_flow(): void
    {
        // Same end-to-end check as the API-sourced test, reached the other way: whichever
        // source moved the bytes, the app has to resolve them from the stored key.
        $user = AppUser::query()->create([
            'username' => 'owner', 'password_hash' => bcrypt('pw'),
            'is_active' => true, 'is_admin' => false, 'max_devices' => 1, 'max_employees' => 0,
        ]);
        $key = "{$user->id}/1700000000000-montage.pdf";
        $this->seedSource([$key => 'THE-ARTWORK']);

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
