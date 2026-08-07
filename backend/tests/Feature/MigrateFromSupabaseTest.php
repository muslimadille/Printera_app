<?php

namespace Tests\Feature;

use App\Console\Commands\MigrateFromSupabase;
use App\Models\ActivityEvent;
use App\Models\AppUser;
use App\Models\SavedQuote;
use App\Models\UserSession;
use App\Models\UserSetting;
use App\Models\UserTabPermission;
use App\Support\Messages;
use App\Support\TargetColumns;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Concerns\ComparesJson;
use Tests\Concerns\MakesUsers;
use Tests\Concerns\SeedsSupabaseSource;
use Tests\TestCase;

/**
 * OPS-070 — the Supabase → Laravel copy, run for real across two databases.
 *
 * The source is a fixture carrying the SUPABASE schema (text, jsonb, timestamptz, uuid),
 * not this app's — see SeedsSupabaseSource. That distinction is the whole ticket: with
 * both sides built from the same migrations the copy is a no-op, and the first time it met
 * a real PostgreSQL source it copied **zero rows** into MySQL because Postgres renders
 * `timestamptz` with an offset that MySQL's parser refuses.
 *
 * Point it at the production pairing with SUPABASE_TEST_DRIVER=pgsql (phpunit.mysql.xml
 * and phpunit.pgsql.xml both do); otherwise a SQLite stand-in keeps `php artisan test`
 * runnable with no infrastructure.
 */
class MigrateFromSupabaseTest extends TestCase
{
    use ComparesJson, MakesUsers, RefreshDatabase, SeedsSupabaseSource;

    protected function setUp(): void
    {
        parent::setUp();

        $this->bootSupabaseSource();
    }

    protected function tearDown(): void
    {
        $this->tearDownSupabaseSource();

        parent::tearDown();
    }

    // ── the copy ─────────────────────────────────────────────────────────────

    public function test_it_copies_every_table_preserving_ids(): void
    {
        $ownerId = $this->sourceUser(['username' => 'owner', 'max_employees' => 3]);
        $employeeId = $this->sourceUser(['username' => 'emp', 'parent_user_id' => $ownerId]);
        $quoteId = $this->sourceQuote($ownerId, 'كتالوج', ['sheets' => 500]);

        $this->sourceRow('user_settings', [
            'user_id' => $ownerId, 'setting_key' => 'paperTypes',
            'setting_value' => json_encode(['a' => 1]),
            'created_at' => $this->sourceTimestamp(), 'updated_at' => $this->sourceTimestamp(),
        ]);
        $this->sourceRow('user_tab_permissions', [
            'user_id' => $ownerId, 'tab_key' => 'default_tab:diecut5',
            'is_enabled' => true, 'created_at' => $this->sourceTimestamp(),
        ]);
        $this->sourceRow('login_logs', [
            'user_id' => $ownerId, 'username' => 'owner',
            'ip_address' => '203.0.113.7', 'logged_in_at' => $this->sourceTimestamp(),
        ]);
        $this->sourceRow('session_events', [
            'user_id' => $ownerId, 'username' => 'owner', 'session_token' => 'legacy-opaque-token',
            'event_type' => 'login', 'occurred_at' => $this->sourceTimestamp(),
        ]);
        $this->sourceRow('activity_events', [
            'user_id' => $ownerId, 'username' => 'owner', 'tab_key' => 'itemcost',
            'action' => 'calculate', 'details' => json_encode(['n' => 1]),
            'occurred_at' => $this->sourceTimestamp(),
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
        $this->sourceRow('user_sessions', [
            'user_id' => $ownerId, 'session_token' => 'opaque-supabase-token-not-a-jwt',
            'device_id' => 'dev-1', 'device_info' => 'Chrome', 'ip_address' => '203.0.113.1',
            'last_active_at' => $this->sourceTimestamp(), 'created_at' => $this->sourceTimestamp(),
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

    // ── crossing the engine boundary ─────────────────────────────────────────

    public function test_timestamps_keep_their_instant_across_engines(): void
    {
        // The failure that made the first cross-engine run copy nothing:
        //   1292 Incorrect datetime value: '2026-04-05 09:00:00+00' for column 'created_at'
        // Postgres renders timestamptz with an offset; MySQL will not parse one.
        $ownerId = $this->sourceUser([
            'username' => 'owner',
            'created_at' => $this->sourceTimestamp('2026-04-05 09:00:00'),
            'updated_at' => $this->sourceTimestamp('2026-04-05 09:00:00'),
        ]);

        $this->artisan('app:migrate-from-supabase')->assertSuccessful();

        $this->assertSame(
            '2026-04-05 09:00:00',
            AppUser::query()->findOrFail($ownerId)->created_at->utc()->format('Y-m-d H:i:s'),
        );
    }

    public function test_a_non_utc_offset_is_converted_rather_than_dropped(): void
    {
        // Whatever TimeZone the source session happens to use, the offset carries the
        // real instant. Reading it and converting is what makes the copy independent of
        // that setting — dropping it would move the row by hours.
        $ownerId = $this->sourceUser([
            'username' => 'cairo',
            'created_at' => '2026-04-05 11:00:00+02',
            'updated_at' => '2026-04-05 11:00:00+02',
        ]);

        $this->artisan('app:migrate-from-supabase')->assertSuccessful();

        $this->assertSame(
            '2026-04-05 09:00:00',
            AppUser::query()->findOrFail($ownerId)->created_at->utc()->format('Y-m-d H:i:s'),
        );
    }

    public function test_sub_second_precision_is_floored_never_rounded(): void
    {
        // Every timestamp column in this schema is precision 0 on all three engines, so
        // the fraction has nowhere to live. Truncating keeps ordering monotonic; MySQL's
        // own rounding would push this row into the next day.
        $ownerId = $this->sourceUser([
            'username' => 'fractional',
            'created_at' => '2026-04-05 23:59:59.704374+00',
            'updated_at' => '2026-04-05 23:59:59.704374+00',
        ]);

        $this->artisan('app:migrate-from-supabase')->assertSuccessful();

        $this->assertSame(
            '2026-04-05 23:59:59',
            AppUser::query()->findOrFail($ownerId)->created_at->utc()->format('Y-m-d H:i:s'),
        );
    }

    public function test_a_far_future_expiry_survives_the_2038_boundary(): void
    {
        // Why expires_at is DATETIME and not TIMESTAMP (BE-060). A long subscription sold
        // today lands past MySQL's TIMESTAMP ceiling of 2038-01-19.
        $ownerId = $this->sourceUser([
            'username' => 'long-subscription',
            'expires_at' => $this->sourceTimestamp('2087-06-01 12:00:00'),
        ]);

        $this->artisan('app:migrate-from-supabase')->assertSuccessful();

        $this->assertSame(
            '2087-06-01',
            AppUser::query()->findOrFail($ownerId)->expires_at->toDateString(),
        );
    }

    public function test_booleans_and_integers_cross_intact(): void
    {
        // pdo_pgsql returns real PHP bools; MySQL stores tinyint(1). Nothing in between
        // should reinterpret them.
        $ownerId = $this->sourceUser([
            'username' => 'flags', 'is_active' => false, 'is_admin' => true,
            'employees_can_view_quotes' => true, 'max_devices' => 7, 'max_employees' => 9,
        ]);

        $this->artisan('app:migrate-from-supabase')->assertSuccessful();

        $owner = AppUser::query()->findOrFail($ownerId);
        $this->assertFalse($owner->is_active);
        $this->assertTrue($owner->is_admin);
        $this->assertTrue($owner->employees_can_view_quotes);
        $this->assertSame(7, $owner->max_devices);
        $this->assertSame(9, $owner->max_employees);
    }

    public function test_a_source_column_with_nowhere_to_go_stops_the_run(): void
    {
        // Silently dropping a column during a one-way migration is unrecoverable once
        // Supabase is retired, so the preflight refuses rather than copying what fits.
        $this->sourceUser(['username' => 'owner']);
        DB::connection('supabase')->statement('ALTER TABLE app_users ADD COLUMN legacy_email text');

        try {
            $this->artisan('app:migrate-from-supabase')
                ->expectsOutputToContain('legacy_email')
                ->assertFailed();

            $this->assertSame(0, AppUser::query()->count());
        } finally {
            DB::connection('supabase')->statement('ALTER TABLE app_users DROP COLUMN legacy_email');
        }
    }

    // ── values too long for the target columns ───────────────────────────────

    /**
     * The width preflight can only fire where the target declares widths.
     *
     * SQLite does not: it reports every string column as a bare `varchar` and enforces no
     * limit, so there is nothing to check and nothing to refuse. That is the correct
     * behaviour there, not a gap — but it means these three tests need MySQL or Postgres
     * to have anything to assert.
     */
    private function requiresBoundedTarget(): void
    {
        if (TargetColumns::for('login_logs')->widthOf('ip_address') === null) {
            $this->markTestSkipped('This engine declares no column widths, so none can be exceeded.');
        }
    }

    public function test_an_over_long_value_stops_the_run_before_anything_is_written(): void
    {
        $this->requiresBoundedTarget();

        // Supabase types every string as unbounded `text`; BE-060 had to bound the ones
        // MySQL indexes. ip_address is the one to expect in production: varchar(45) here,
        // and the edge function stored a raw x-forwarded-for proxy chain.
        $ownerId = $this->sourceUser(['username' => 'owner']);
        $this->sourceRow('login_logs', [
            'user_id' => $ownerId, 'username' => 'owner',
            'ip_address' => '203.0.113.7, 172.71.126.44, 10.0.0.5, 2001:db8:85a3::8a2e:370:7334',
            'logged_in_at' => $this->sourceTimestamp(),
        ]);

        $this->artisan('app:migrate-from-supabase')
            ->expectsOutputToContain('login_logs.ip_address')
            ->assertFailed();

        // Nothing at all — not even the tables that would have fitted.
        $this->assertSame(0, AppUser::query()->count());
        $this->assertSame(0, DB::table('login_logs')->count());
    }

    public function test_truncate_overlong_trims_to_fit_and_lists_what_it_touched(): void
    {
        $this->requiresBoundedTarget();

        $ownerId = $this->sourceUser(['username' => 'owner']);
        $logId = $this->sourceRow('login_logs', [
            'user_id' => $ownerId, 'username' => 'owner',
            'ip_address' => '203.0.113.7, 172.71.126.44, 10.0.0.5, 2001:db8:85a3::8a2e:370:7334',
            'logged_in_at' => $this->sourceTimestamp(),
        ]);

        $this->artisan('app:migrate-from-supabase', ['--truncate-overlong' => true])
            ->expectsOutputToContain($logId)
            ->assertSuccessful();

        // The leftmost entry of an x-forwarded-for chain is the client, so the part the
        // admin panel actually shows is the part that is kept.
        $stored = (string) DB::table('login_logs')->where('id', $logId)->value('ip_address');
        $this->assertSame(45, mb_strlen($stored));
        $this->assertStringStartsWith('203.0.113.7,', $stored);
    }

    public function test_an_over_long_value_is_measured_in_characters_not_bytes(): void
    {
        // 200 Arabic characters is 400 bytes. A byte-wise check would reject a title that
        // fits varchar(255) perfectly well.
        $ownerId = $this->sourceUser(['username' => 'owner']);
        $quoteId = $this->sourceQuote($ownerId, str_repeat('ط', 200));

        $this->artisan('app:migrate-from-supabase')->assertSuccessful();

        $this->assertSame(200, mb_strlen(SavedQuote::query()->findOrFail($quoteId)->title));
    }

    public function test_skip_width_check_bypasses_the_scan(): void
    {
        // The resume case: the question has already been answered, and the scan is a full
        // table read per bounded column.
        $this->sourceUser(['username' => 'owner']);

        $this->artisan('app:migrate-from-supabase', ['--skip-width-check' => true])->assertSuccessful();

        $this->assertSame(1, AppUser::query()->count());
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

    public function test_jsonb_arrives_as_json_not_as_a_quoted_string(): void
    {
        // jsonb comes out of pdo_pgsql as a JSON *string*. Handing that to a MySQL `json`
        // column unencoded is what keeps it a document; encoding it again would store the
        // literal text and every reader would get a string back.
        $this->requiresPostgresSource();

        $ownerId = $this->sourceUser(['username' => 'owner']);
        $quoteId = $this->sourceQuote($ownerId, 'json shape', ['sheets' => 500, 'ar' => 'ورق']);
        $this->sourceRow('activity_events', [
            'user_id' => $ownerId, 'username' => 'owner', 'action' => 'calculate',
            'details' => json_encode(['n' => 1]), 'occurred_at' => $this->sourceTimestamp(),
        ]);

        $this->artisan('app:migrate-from-supabase')->assertSuccessful();

        $quoteData = SavedQuote::query()->findOrFail($quoteId)->quote_data;
        $this->assertIsArray($quoteData);
        $this->assertSame(500, $quoteData['sheets']);
        $this->assertSame('ورق', $quoteData['ar']);
        $this->assertSame(['n' => 1], ActivityEvent::query()->firstOrFail()->details);
    }

    public function test_the_opaque_default_tab_permission_survives(): void
    {
        $ownerId = $this->sourceUser(['username' => 'owner']);
        $this->sourceRow('user_tab_permissions', [
            'user_id' => $ownerId, 'tab_key' => 'default_tab:boxpricing',
            'is_enabled' => true, 'created_at' => $this->sourceTimestamp(),
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
        $this->sourceRow('user_settings', [
            'user_id' => $ownerId, 'setting_key' => 'paperTypes',
            'setting_value' => json_encode(['v' => 1]),
            'created_at' => $this->sourceTimestamp(), 'updated_at' => $this->sourceTimestamp(),
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

    public function test_a_dry_run_still_reports_values_that_would_not_fit(): void
    {
        // The rehearsal has to surface the problem, not discover it during the window.
        $this->requiresBoundedTarget();

        $ownerId = $this->sourceUser(['username' => 'owner']);
        $this->sourceRow('login_logs', [
            'user_id' => $ownerId, 'username' => 'owner',
            'ip_address' => str_repeat('9', 60),
            'logged_in_at' => $this->sourceTimestamp(),
        ]);

        $this->artisan('app:migrate-from-supabase', ['--dry-run' => true])
            ->expectsOutputToContain('login_logs.ip_address')
            ->assertFailed();
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
            $this->sourceRow('activity_events', [
                'user_id' => $ownerId, 'username' => 'owner', 'tab_key' => 'itemcost',
                'action' => 'calculate', 'details' => json_encode([]),
                'occurred_at' => $this->sourceTimestamp(now()->subDays($daysAgo)->format('Y-m-d H:i:s')),
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
        config(['database.connections.supabase' => [
            'driver' => 'sqlite', 'database' => '/nonexistent/path/nope.sqlite', 'prefix' => '',
        ]]);
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
        $this->sourceRow('user_settings', [
            'user_id' => $ownerId, 'setting_key' => 'paperTypes',
            'setting_value' => json_encode(['name' => 'كوشيه'], JSON_UNESCAPED_UNICODE),
            'created_at' => $this->sourceTimestamp(), 'updated_at' => $this->sourceTimestamp(),
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

    public function test_a_migrated_quote_keeps_a_usable_attachment_reference(): void
    {
        // The link between OPS-070 and OPS-071: the key inside quote_data has to survive
        // the copy unchanged, because the storage migration preserves keys rather than
        // rewriting references.
        $ownerId = $this->sourceUser(['username' => 'owner']);
        $key = $ownerId.'/1712345678901-montage.pdf';
        $quoteId = $this->sourceQuote($ownerId, 'مع مرفق', [
            'attachmentUrl' => "storage:{$key}", 'attachmentName' => 'montage.pdf',
        ]);

        $this->artisan('app:migrate-from-supabase')->assertSuccessful();

        $this->assertSame(
            "storage:{$key}",
            SavedQuote::query()->findOrFail($quoteId)->quote_data['attachmentUrl'],
        );
    }

    public function test_history_survives_a_user_that_no_longer_exists(): void
    {
        // Neither event table has a foreign key on user_id — on either side. A deleted
        // user's history is still history, and an FK here would drop it.
        $this->sourceUser(['username' => 'owner']);
        $ghost = (string) Str::uuid();

        $this->sourceRow('session_events', [
            'user_id' => $ghost, 'username' => 'deleted-user', 'event_type' => 'logout',
            'occurred_at' => $this->sourceTimestamp(),
        ]);
        $this->sourceRow('activity_events', [
            'user_id' => $ghost, 'username' => 'deleted-user', 'action' => 'tab_open',
            'details' => json_encode([]), 'occurred_at' => $this->sourceTimestamp(),
        ]);

        $this->artisan('app:migrate-from-supabase')->assertSuccessful();

        $this->assertSame(1, DB::table('session_events')->where('user_id', $ghost)->count());
        $this->assertSame(1, DB::table('activity_events')->where('user_id', $ghost)->count());
    }
}
