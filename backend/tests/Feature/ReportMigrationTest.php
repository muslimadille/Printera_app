<?php

namespace Tests\Feature;

use App\Models\AppUser;
use App\Services\StorageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * OPS-073 — the parity report that gates sign-off.
 *
 * Its value is entirely in whether it FAILS when something is wrong, so most of these
 * tests break something on purpose and assert the report notices.
 */
class ReportMigrationTest extends TestCase
{
    use MakesUsers, RefreshDatabase;

    /** @var array<int,string> */
    private array $sourceFiles = [];

    protected function tearDown(): void
    {
        DB::purge('supabase');

        foreach ($this->sourceFiles as $path) {
            @unlink($path);
        }

        parent::tearDown();
    }

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake(StorageService::DISK);

        // Point `supabase` at an unreachable database by default: most of these tests are
        // about the local-side invariants, which are checked regardless.
        config(['database.connections.supabase' => [
            'driver' => 'sqlite', 'database' => '/nonexistent/nope.sqlite', 'prefix' => '',
        ]]);
        DB::purge('supabase');
    }

    private function quoteFor(AppUser $user, array $quoteData): void
    {
        $user->quotes()->create([
            'title' => 'عرض', 'customer_name' => '', 'quote_number' => '',
            'source_type' => 'calculator', 'quote_data' => $quoteData,
        ]);
    }

    public function test_a_clean_migration_passes(): void
    {
        $owner = $this->makeUser(['username' => 'owner']);
        $key = "{$owner->id}/1-a.pdf";
        Storage::disk(StorageService::DISK)->put($key, 'BYTES');
        $this->quoteFor($owner, ['attachmentUrl' => "storage:{$key}"]);

        // The source is unreachable here, which is itself a FAIL — skip that section by
        // checking the rest through a reachable empty source instead.
        $this->withReachableEmptySource();

        $this->artisan('app:report-migration')->assertSuccessful();
    }

    public function test_it_fails_when_a_quote_references_a_missing_object(): void
    {
        $owner = $this->makeUser(['username' => 'owner']);
        $this->quoteFor($owner, ['attachmentUrl' => "storage:{$owner->id}/1-gone.pdf"]);
        $this->withReachableEmptySource();

        $this->artisan('app:report-migration')
            ->expectsOutputToContain('missing from the montage disk')
            ->assertFailed();
    }

    public function test_it_fails_when_a_legacy_supabase_url_remains(): void
    {
        $owner = $this->makeUser(['username' => 'owner']);
        $this->quoteFor($owner, ['attachmentUrl' => 'https://proj.supabase.co/storage/v1/object/public/montage-files/u1/1-a.pdf']);
        $this->withReachableEmptySource();

        $this->artisan('app:report-migration')
            ->expectsOutputToContain('still point at Supabase')
            ->assertFailed();
    }

    public function test_it_fails_when_the_source_is_unreachable(): void
    {
        // An operator must not be able to "pass" sign-off without the comparison running.
        $this->makeUser(['username' => 'owner']);

        $this->artisan('app:report-migration')
            ->expectsOutputToContain('Cannot reach the `supabase` connection')
            ->assertFailed();
    }

    public function test_it_fails_on_an_unrecognised_password_hash(): void
    {
        $this->makeUser(['username' => 'broken', 'password_hash' => 'plaintext-oops']);
        $this->withReachableEmptySource();

        $this->artisan('app:report-migration')
            ->expectsOutputToContain('match neither format')
            ->assertFailed();
    }

    public function test_it_accepts_both_bcrypt_and_legacy_sha256(): void
    {
        $this->makeUser(['username' => 'modern', 'password_hash' => password_hash('x', PASSWORD_BCRYPT, ['cost' => 4])]);
        $this->makeUser(['username' => 'legacy', 'password_hash' => hash('sha256', 'x')]);
        $this->withReachableEmptySource();

        $this->artisan('app:report-migration')->assertSuccessful();
    }

    public function test_it_reports_row_counts_and_flags_a_short_table(): void
    {
        $this->withReachableEmptySource();

        // One user in the source, none here → the copy is short.
        DB::connection('supabase')->table('app_users')->insert([
            'id' => (string) Str::uuid(),
            'username' => 'missing', 'password_hash' => bcrypt('x'),
            'is_active' => true, 'is_admin' => false, 'max_devices' => 1, 'max_employees' => 0,
            'employees_can_view_quotes' => false, 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->artisan('app:report-migration')
            ->expectsOutputToContain('FAIL (missing 1)')
            ->assertFailed();
    }

    public function test_extra_local_rows_are_not_a_failure(): void
    {
        // The admin seeder creates a bootstrap account that never existed in Supabase.
        $this->makeUser(['username' => 'seeded-admin', 'is_admin' => true]);
        $this->withReachableEmptySource();

        $this->artisan('app:report-migration')
            ->expectsOutputToContain('+1 local')
            ->assertSuccessful();
    }

    public function test_it_states_that_user_sessions_are_empty_by_design(): void
    {
        $this->withReachableEmptySource();

        $this->artisan('app:report-migration')
            ->expectsOutputToContain('table is empty, as intended')
            ->assertSuccessful();
    }

    public function test_it_writes_the_report_to_a_file_for_archiving(): void
    {
        $out = storage_path('framework/testing/migration-report.txt');
        @unlink($out);
        $this->withReachableEmptySource();

        $this->artisan('app:report-migration', ['--out' => $out])->assertSuccessful();

        $report = (string) file_get_contents($out);
        $this->assertStringContainsString('migration report', $report);
        $this->assertStringContainsString('RESULT:', $report);
        @unlink($out);
    }

    // ── helper ───────────────────────────────────────────────────────────────

    /**
     * A reachable, schema-complete but empty stand-in for Supabase.
     *
     * One file per test: Windows keeps the handle open until the connection is garbage
     * collected, so a shared path can survive its unlink() and carry the previous test's
     * rows into this one.
     */
    private function withReachableEmptySource(): void
    {
        $path = storage_path('framework/testing/report-source-'.Str::random(8).'.sqlite');
        @mkdir(dirname($path), 0777, true);
        touch($path);
        $this->sourceFiles[] = $path;

        config(['database.connections.supabase' => [
            'driver' => 'sqlite', 'database' => $path, 'prefix' => '', 'foreign_key_constraints' => true,
        ]]);
        DB::purge('supabase');

        $this->artisan('migrate', ['--database' => 'supabase', '--force' => true])->run();
    }
}
