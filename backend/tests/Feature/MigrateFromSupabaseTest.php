<?php

namespace Tests\Feature;

use App\Console\Commands\MigrateFromSupabase;
use App\Models\AppUser;
use App\Models\SavedQuote;
use App\Models\UserSession;
use App\Models\UserSetting;
use App\Models\UserTabPermission;
use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\Concerns\ComparesJson;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * OPS-070 — the Supabase → Laravel copy.
 *
 * The `supabase` connection is pointed at a second database carrying the same schema, and
 * the command is run for real across the two. That exercises the parts a mocked test would
 * miss: the two-pass ordering that keeps the app_users self-FK valid, upsert-based
 * resumability, and JSON columns surviving the crossing.
 */
class MigrateFromSupabaseTest extends TestCase
{
    use ComparesJson, MakesUsers, RefreshDatabase;

    private string $sourcePath = '';

    protected function setUp(): void
    {
        parent::setUp();

        // A separate file-backed SQLite database standing in for Supabase. Not :memory:,
        // because the command opens its own connection and would otherwise see an empty
        // database. One file per test: Windows keeps the handle open until the connection
        // is collected, so a shared path can survive its unlink() and leak rows forward.
        $path = storage_path('framework/testing/supabase-source-'.Str::random(8).'.sqlite');
        @mkdir(dirname($path), 0777, true);
        touch($path);
        $this->sourcePath = $path;

        config([
            'database.connections.supabase' => [
                'driver' => 'sqlite',
                'database' => $path,
                'prefix' => '',
                'foreign_key_constraints' => true,
            ],
        ]);
        DB::purge('supabase');

        $this->artisan('migrate', ['--database' => 'supabase', '--force' => true])->run();
    }

    protected function tearDown(): void
    {
        DB::purge('supabase');
        @unlink($this->sourcePath);

        parent::tearDown();
    }

    // ── source fixtures ──────────────────────────────────────────────────────

    /** @param array<string,mixed> $attrs */
    private function sourceUser(array $attrs = []): string
    {
        $id = (string) Str::uuid();

        DB::connection('supabase')->table('app_users')->insert(array_merge([
            'id' => $id,
            'username' => 'user-'.Str::random(6),
            'password_hash' => '$2y$04$abcdefghijklmnopqrstuv',
            'is_active' => true,
            'is_admin' => false,
            'expires_at' => null,
            'max_devices' => 2,
            'max_employees' => 0,
            'parent_user_id' => null,
            'employees_can_view_quotes' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ], $attrs));

        return $id;
    }

    private function sourceQuote(string $userId, string $title, array $quoteData = []): string
    {
        $id = (string) Str::uuid();

        DB::connection('supabase')->table('saved_quotes')->insert([
            'id' => $id,
            'user_id' => $userId,
            'title' => $title,
            'customer_name' => 'عميل',
            'quote_number' => 'Q-1',
            'source_type' => 'calculator',
            'quote_data' => json_encode($quoteData, JSON_UNESCAPED_UNICODE),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $id;
    }

    // ── the copy ─────────────────────────────────────────────────────────────

    public function test_it_copies_every_table_preserving_ids(): void
    {
        $ownerId = $this->sourceUser(['username' => 'owner', 'max_employees' => 3]);
        $employeeId = $this->sourceUser(['username' => 'emp', 'parent_user_id' => $ownerId]);
        $quoteId = $this->sourceQuote($ownerId, 'كتالوج', ['sheets' => 500]);

        DB::connection('supabase')->table('user_settings')->insert([
            'id' => (string) Str::uuid(), 'user_id' => $ownerId,
            'setting_key' => 'paperTypes', 'setting_value' => json_encode(['a' => 1]),
            'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::connection('supabase')->table('user_tab_permissions')->insert([
            'id' => (string) Str::uuid(), 'user_id' => $ownerId,
            'tab_key' => 'default_tab:diecut5', 'is_enabled' => true, 'created_at' => now(),
        ]);
        DB::connection('supabase')->table('login_logs')->insert([
            'id' => (string) Str::uuid(), 'user_id' => $ownerId, 'username' => 'owner',
            'ip_address' => '203.0.113.7', 'logged_in_at' => now(),
        ]);
        DB::connection('supabase')->table('session_events')->insert([
            'id' => (string) Str::uuid(), 'user_id' => $ownerId, 'username' => 'owner',
            'session_token' => 'legacy-opaque-token', 'event_type' => 'login', 'occurred_at' => now(),
        ]);
        DB::connection('supabase')->table('activity_events')->insert([
            'id' => (string) Str::uuid(), 'user_id' => $ownerId, 'username' => 'owner',
            'tab_key' => 'itemcost', 'action' => 'calculate',
            'details' => json_encode(['n' => 1]), 'occurred_at' => now(),
        ]);

        $this->artisan('app:migrate-from-supabase')->assertSuccessful();

        // Ids survive, so every foreign key still resolves.
        $this->assertNotNull(AppUser::query()->find($ownerId));
        $this->assertSame($ownerId, AppUser::query()->findOrFail($employeeId)->parent_user_id);
        $this->assertSame($ownerId, SavedQuote::query()->findOrFail($quoteId)->user_id);

        foreach (MigrateFromSupabase::TABLES as $table) {
            $this->assertSame(
                DB::connection('supabase')->table($table)->count(),
                DB::table($table)->count(),
                "row count mismatch for {$table}",
            );
        }
    }

    public function test_an_employee_inserted_before_its_owner_still_lands(): void
    {
        // The self-FK trap: id order is random, so a single ordered pass can present an
        // employee before its owner. The command copies parents first for exactly this.
        $ownerId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
        $employeeId = '00000000-0000-4000-8000-000000000000';

        $this->sourceUser(['id' => $ownerId, 'username' => 'owner', 'max_employees' => 2]);
        $this->sourceUser(['id' => $employeeId, 'username' => 'emp', 'parent_user_id' => $ownerId]);

        $this->artisan('app:migrate-from-supabase')->assertSuccessful();

        $this->assertSame($ownerId, AppUser::query()->findOrFail($employeeId)->parent_user_id);
    }

    public function test_user_sessions_are_never_copied(): void
    {
        $ownerId = $this->sourceUser(['username' => 'owner']);
        DB::connection('supabase')->table('user_sessions')->insert([
            'id' => (string) Str::uuid(), 'user_id' => $ownerId,
            'session_token' => 'opaque-supabase-token-not-a-jwt',
            'device_id' => 'dev-1', 'device_info' => 'Chrome', 'ip_address' => '203.0.113.1',
            'last_active_at' => now(), 'created_at' => now(),
        ]);

        $this->artisan('app:migrate-from-supabase')->assertSuccessful();

        // Those tokens cannot validate against this API; users re-login once instead.
        $this->assertSame(0, UserSession::query()->count());
        $this->assertNotContains('user_sessions', MigrateFromSupabase::TABLES);
    }

    public function test_naming_user_sessions_explicitly_is_refused(): void
    {
        $this->artisan('app:migrate-from-supabase', ['--table' => 'user_sessions'])->assertFailed();
    }

    // ── the password rule ────────────────────────────────────────────────────

    public function test_password_hashes_cross_verbatim_and_both_formats_still_authenticate(): void
    {
        // The single most dangerous thing this command could get wrong. bcrypt for current
        // users, a 64-hex SHA-256 for legacy ones; AuthService verifies both and upgrades
        // the legacy row on next login.
        $bcrypt = password_hash('bcrypt-pw', PASSWORD_BCRYPT, ['cost' => 4]);
        $sha256 = hash('sha256', 'legacy-pw');

        $this->sourceUser(['username' => 'modern', 'password_hash' => $bcrypt]);
        $this->sourceUser(['username' => 'legacy', 'password_hash' => $sha256]);

        $this->artisan('app:migrate-from-supabase')->assertSuccessful();

        $this->assertSame($bcrypt, AppUser::query()->where('username', 'modern')->firstOrFail()->password_hash);
        $this->assertSame($sha256, AppUser::query()->where('username', 'legacy')->firstOrFail()->password_hash);

        // Both log in through the real endpoint after the migration.
        $this->postJson('/api/v1/auth/login', ['username' => 'modern', 'password' => 'bcrypt-pw', 'device_id' => 'd1'])
            ->assertOk()->assertJson(['success' => true]);

        $this->postJson('/api/v1/auth/login', ['username' => 'legacy', 'password' => 'legacy-pw', 'device_id' => 'd2'])
            ->assertOk()->assertJson(['success' => true]);

        // …and the legacy hash was upgraded to bcrypt by that login, not by the migration.
        $upgraded = AppUser::query()->where('username', 'legacy')->firstOrFail()->password_hash;
        $this->assertNotSame($sha256, $upgraded);
        $this->assertTrue(password_verify('legacy-pw', $upgraded));
    }

    public function test_a_wrong_password_is_still_rejected_after_migration(): void
    {
        $this->sourceUser(['username' => 'modern', 'password_hash' => password_hash('right', PASSWORD_BCRYPT, ['cost' => 4])]);

        $this->artisan('app:migrate-from-supabase')->assertSuccessful();

        $this->postJson('/api/v1/auth/login', ['username' => 'modern', 'password' => 'wrong', 'device_id' => 'd1'])
            ->assertOk()
            ->assertJson(['error' => Messages::BAD_CREDENTIALS]);
    }

    // ── opaque JSON ──────────────────────────────────────────────────────────

    public function test_json_columns_cross_unreshaped(): void
    {
        $ownerId = $this->sourceUser(['username' => 'owner']);
        $quoteData = [
            'nested' => ['deep' => [1, 2, ['x' => null]]],
            'arabic' => 'ورق كوشيه 300 جرام',
            'zero' => 0, 'false' => false, 'empty' => [], 'float' => 12.75,
        ];
        $quoteId = $this->sourceQuote($ownerId, 'opaque', $quoteData);

        $this->artisan('app:migrate-from-supabase')->assertSuccessful();

        $this->assertSameJson($quoteData, SavedQuote::query()->findOrFail($quoteId)->quote_data);
    }

    public function test_the_opaque_default_tab_permission_survives(): void
    {
        $ownerId = $this->sourceUser(['username' => 'owner']);
        DB::connection('supabase')->table('user_tab_permissions')->insert([
            'id' => (string) Str::uuid(), 'user_id' => $ownerId,
            'tab_key' => 'default_tab:boxpricing', 'is_enabled' => true, 'created_at' => now(),
        ]);

        $this->artisan('app:migrate-from-supabase')->assertSuccessful();

        $this->assertSame(
            'default_tab:boxpricing',
            UserTabPermission::query()->where('user_id', $ownerId)->firstOrFail()->tab_key,
        );
    }

    // ── resumability & flags ─────────────────────────────────────────────────

    public function test_re_running_is_idempotent(): void
    {
        $ownerId = $this->sourceUser(['username' => 'owner']);
        $this->sourceQuote($ownerId, 'كتالوج');
        DB::connection('supabase')->table('user_settings')->insert([
            'id' => (string) Str::uuid(), 'user_id' => $ownerId,
            'setting_key' => 'paperTypes', 'setting_value' => json_encode(['v' => 1]),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->artisan('app:migrate-from-supabase')->assertSuccessful();
        $this->artisan('app:migrate-from-supabase')->assertSuccessful();
        $this->artisan('app:migrate-from-supabase')->assertSuccessful();

        $this->assertSame(1, AppUser::query()->count());
        $this->assertSame(1, SavedQuote::query()->count());
        $this->assertSame(1, UserSetting::query()->count());
    }

    public function test_a_re_run_picks_up_rows_added_since(): void
    {
        // The resume path after a partial failure: already-copied rows are overwritten in
        // place, new ones are appended.
        $ownerId = $this->sourceUser(['username' => 'owner']);
        $this->artisan('app:migrate-from-supabase')->assertSuccessful();
        $this->assertSame(1, AppUser::query()->count());

        $this->sourceUser(['username' => 'later']);
        $this->artisan('app:migrate-from-supabase')->assertSuccessful();

        $this->assertSame(2, AppUser::query()->count());
        $this->assertNotNull(AppUser::query()->find($ownerId));
    }

    public function test_an_edited_source_row_is_overwritten_not_duplicated(): void
    {
        $ownerId = $this->sourceUser(['username' => 'owner', 'max_devices' => 2]);
        $this->artisan('app:migrate-from-supabase')->assertSuccessful();

        DB::connection('supabase')->table('app_users')->where('id', $ownerId)->update(['max_devices' => 9]);
        $this->artisan('app:migrate-from-supabase')->assertSuccessful();

        $this->assertSame(1, AppUser::query()->count());
        $this->assertSame(9, AppUser::query()->findOrFail($ownerId)->max_devices);
    }

    public function test_dry_run_writes_nothing(): void
    {
        $ownerId = $this->sourceUser(['username' => 'owner']);
        $this->sourceQuote($ownerId, 'كتالوج');

        $this->artisan('app:migrate-from-supabase', ['--dry-run' => true])->assertSuccessful();

        $this->assertSame(0, AppUser::query()->count());
        $this->assertSame(0, SavedQuote::query()->count());
    }

    public function test_table_filter_copies_only_what_was_asked_for(): void
    {
        $ownerId = $this->sourceUser(['username' => 'owner']);
        $this->sourceQuote($ownerId, 'كتالوج');

        $this->artisan('app:migrate-from-supabase', ['--table' => 'app_users'])->assertSuccessful();

        $this->assertSame(1, AppUser::query()->count());
        $this->assertSame(0, SavedQuote::query()->count());
    }

    public function test_since_days_trims_the_event_tables_only(): void
    {
        $ownerId = $this->sourceUser(['username' => 'owner']);

        foreach ([1, 45] as $daysAgo) {
            DB::connection('supabase')->table('activity_events')->insert([
                'id' => (string) Str::uuid(), 'user_id' => $ownerId, 'username' => 'owner',
                'tab_key' => 'itemcost', 'action' => 'calculate', 'details' => json_encode([]),
                'occurred_at' => now()->subDays($daysAgo),
            ]);
        }
        $this->sourceQuote($ownerId, 'old quote');

        $this->artisan('app:migrate-from-supabase', ['--since-days' => 30])->assertSuccessful();

        $this->assertSame(1, DB::table('activity_events')->count());
        // Quotes are not history — the window must not touch them.
        $this->assertSame(1, SavedQuote::query()->count());
        $this->assertSame(1, AppUser::query()->count());
    }

    public function test_chunking_does_not_lose_or_duplicate_rows(): void
    {
        $ownerId = $this->sourceUser(['username' => 'owner']);
        for ($i = 0; $i < 25; $i++) {
            $this->sourceQuote($ownerId, "quote-{$i}");
        }

        $this->artisan('app:migrate-from-supabase', ['--chunk' => 4])->assertSuccessful();

        $this->assertSame(25, SavedQuote::query()->count());
        $this->assertSame(25, SavedQuote::query()->distinct()->count('id'));
    }

    public function test_it_fails_cleanly_when_the_source_is_unreachable(): void
    {
        config(['database.connections.supabase.database' => '/nonexistent/path/nope.sqlite']);
        DB::purge('supabase');

        $this->artisan('app:migrate-from-supabase')->assertFailed();
    }

    // ── after the migration the app actually works ───────────────────────────

    public function test_a_migrated_owner_sees_its_settings_and_family_quotes(): void
    {
        $ownerId = $this->sourceUser([
            'username' => 'owner',
            'password_hash' => password_hash('pw-123456', PASSWORD_BCRYPT, ['cost' => 4]),
            'max_employees' => 2,
        ]);
        $employeeId = $this->sourceUser(['username' => 'emp', 'parent_user_id' => $ownerId]);

        $this->sourceQuote($ownerId, 'عرض المالك');
        $this->sourceQuote($employeeId, 'عرض الموظف');
        DB::connection('supabase')->table('user_settings')->insert([
            'id' => (string) Str::uuid(), 'user_id' => $ownerId,
            'setting_key' => 'paperTypes', 'setting_value' => json_encode(['name' => 'كوشيه']),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->artisan('app:migrate-from-supabase')->assertSuccessful();

        $login = $this->postJson('/api/v1/auth/login', [
            'username' => 'owner', 'password' => 'pw-123456', 'device_id' => 'd1',
        ])->assertOk();

        // Settings come back on the login payload, exactly as for a natively-created user.
        $login->assertJsonPath('settings.paperTypes.name', 'كوشيه');

        $auth = $this->bearer($login->json('session_token'));
        $quotes = $this->getJson('/api/v1/quotes', $auth)->assertOk();

        $quotes->assertJsonCount(1, 'quotes');
        $quotes->assertJsonPath('quotes.0.title', 'عرض المالك');
        // The family visibility matrix works off the migrated parent_user_id.
        $quotes->assertJsonCount(1, 'related_quotes');
        $quotes->assertJsonPath('related_quotes.0.employee_username', 'emp');
    }
}
