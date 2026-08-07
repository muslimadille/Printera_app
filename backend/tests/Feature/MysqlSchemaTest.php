<?php

namespace Tests\Feature;

use App\Models\AppUser;
use App\Support\SchemaCollation;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * BE-060 — MySQL-specific schema assertions. MySQL is the PRODUCTION engine.
 *
 * SchemaSemanticsTest covers behaviour that must hold everywhere; this file pins the
 * MySQL spellings that behaviour depends on, and that neither SQLite nor PostgreSQL can
 * catch — every one of them corresponds to a way `php artisan migrate` used to fail or
 * silently diverge here.
 *
 * Skipped automatically unless the active connection is mysql. To run:
 *
 *   docker run -d --name printera-mysql -e MYSQL_ROOT_PASSWORD=rootpw \
 *     -e MYSQL_DATABASE=cct_printera -p 33066:3306 mysql:8.0
 *   docker exec printera-mysql mysql -uroot -prootpw -e "CREATE DATABASE cct_printera_test"
 *   ./vendor/bin/phpunit -c phpunit.mysql.xml
 *
 * Requires MySQL 8.0.16+ for CHECK enforcement.
 */
class MysqlSchemaTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::connection()->getDriverName() !== 'mysql') {
            $this->markTestSkipped('MySQL-only schema assertions; active driver is '.DB::connection()->getDriverName());
        }
    }

    /** @return object{COLUMN_TYPE:string,COLLATION_NAME:?string,IS_NULLABLE:string,COLUMN_DEFAULT:?string,EXTRA:string} */
    private function column(string $table, string $column): object
    {
        $row = DB::selectOne(
            'select COLUMN_TYPE, COLLATION_NAME, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
             from information_schema.COLUMNS
             where TABLE_SCHEMA = database() and TABLE_NAME = ? and COLUMN_NAME = ?',
            [$table, $column]
        );

        $this->assertNotNull($row, "{$table}.{$column} not found");

        return $row;
    }

    private function makeUser(string $username = 'my-tester'): AppUser
    {
        return AppUser::query()->create([
            'username' => $username,
            'password_hash' => Hash::make('secret123'),
            'is_active' => true,
            'is_admin' => false,
            'max_devices' => 5,
        ]);
    }

    // ── 1 · indexed strings are VARCHAR, not TEXT ────────────────────────────

    /**
     * Every column that takes part in a UNIQUE or an INDEX. A TEXT here is what produced
     * "1170 BLOB/TEXT column used in key specification without a key length" and stopped
     * the migration dead.
     *
     * @return array<string,array{0:string,1:string,2:string}>
     */
    public static function indexedColumns(): array
    {
        return [
            'app_users.username' => ['app_users', 'username', 'varchar(191)'],
            'user_sessions.session_token' => ['user_sessions', 'session_token', 'varchar(191)'],
            'user_sessions.device_id' => ['user_sessions', 'device_id', 'varchar(191)'],
            'user_settings.setting_key' => ['user_settings', 'setting_key', 'varchar(191)'],
            'user_tab_permissions.tab_key' => ['user_tab_permissions', 'tab_key', 'varchar(191)'],
            'activity_events.tab_key' => ['activity_events', 'tab_key', 'varchar(191)'],
            'activity_events.session_token' => ['activity_events', 'session_token', 'varchar(191)'],
            'activity_events.action' => ['activity_events', 'action', 'varchar(64)'],
            'session_events.session_token' => ['session_events', 'session_token', 'varchar(191)'],
            'session_events.event_type' => ['session_events', 'event_type', 'varchar(32)'],
            'session_events.device_id' => ['session_events', 'device_id', 'varchar(191)'],
            'login_logs.username' => ['login_logs', 'username', 'varchar(191)'],
            'session_events.username' => ['session_events', 'username', 'varchar(191)'],
            'activity_events.username' => ['activity_events', 'username', 'varchar(191)'],
        ];
    }

    #[DataProvider('indexedColumns')]
    public function test_indexed_and_denormalised_strings_are_varchar(string $table, string $column, string $type): void
    {
        $this->assertSame($type, $this->column($table, $column)->COLUMN_TYPE);
    }

    public function test_free_text_columns_may_stay_text(): void
    {
        // device_info is never indexed and can be a long user-agent string.
        $this->assertSame('text', $this->column('user_sessions', 'device_info')->COLUMN_TYPE);
        $this->assertSame('text', $this->column('session_events', 'device_info')->COLUMN_TYPE);
    }

    public function test_a_composite_unique_key_fits_innodb(): void
    {
        // char(36) + varchar(191) under utf8mb4 = 908 bytes, inside the 3072-byte limit.
        // If a future widening blows past it, MySQL raises error 1071 at migrate time —
        // this asserts the arithmetic rather than waiting for that.
        foreach ([['user_settings', 'setting_key'], ['user_tab_permissions', 'tab_key']] as [$table, $column]) {
            $bytes = 36 * 4 + ((int) filter_var($this->column($table, $column)->COLUMN_TYPE, FILTER_SANITIZE_NUMBER_INT)) * 4;
            $this->assertLessThan(3072, $bytes, "{$table} composite unique is too wide for InnoDB");
        }
    }

    // ── 2 · JSON columns carry no DB-level default ───────────────────────────

    public function test_json_columns_are_json_typed_and_default_less(): void
    {
        // MySQL rejects a literal DEFAULT on JSON outright; the default moved to the
        // models (SavedQuote::$attributes etc.) in BE-060.
        foreach ([
            ['saved_quotes', 'quote_data'],
            ['activity_events', 'details'],
            ['user_settings', 'setting_value'],
        ] as [$table, $column]) {
            $meta = $this->column($table, $column);

            $this->assertSame('json', $meta->COLUMN_TYPE, "{$table}.{$column} should be json");
            $this->assertNull($meta->COLUMN_DEFAULT, "{$table}.{$column} must have no DB default on MySQL");
            $this->assertSame('YES', $meta->IS_NULLABLE, "{$table}.{$column} must be nullable so raw inserts work");
        }
    }

    // ── 3 · the portable unique replaced the partial index ───────────────────

    public function test_the_user_device_unique_exists_and_is_plain(): void
    {
        $index = DB::select(
            'select NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME from information_schema.STATISTICS
             where TABLE_SCHEMA = database() and TABLE_NAME = ? and INDEX_NAME = ?
             order by SEQ_IN_INDEX',
            ['user_sessions', 'user_sessions_user_device_unique']
        );

        $this->assertCount(2, $index, 'user_sessions_user_device_unique is missing on MySQL');
        $this->assertSame(0, (int) $index[0]->NON_UNIQUE);
        $this->assertSame(['user_id', 'device_id'], array_column($index, 'COLUMN_NAME'));
    }

    // ── 4 · event_type CHECK is enforced, not just parsed ────────────────────

    public function test_the_event_type_check_constraint_exists(): void
    {
        $check = DB::selectOne(
            'select CHECK_CLAUSE from information_schema.CHECK_CONSTRAINTS
             where CONSTRAINT_SCHEMA = database() and CONSTRAINT_NAME = ?',
            ['session_events_event_type_check']
        );

        $this->assertNotNull($check, 'session_events_event_type_check is missing on MySQL');
        foreach (['login', 'logout', 'heartbeat', 'auto_logout'] as $allowed) {
            $this->assertStringContainsString($allowed, $check->CHECK_CLAUSE);
        }
    }

    public function test_an_unknown_event_type_is_rejected(): void
    {
        // MySQL < 8.0.16 parses CHECK and ignores it, so this proves enforcement, not
        // merely presence.
        $user = $this->makeUser();

        $this->expectException(QueryException::class);
        DB::table('session_events')->insert([
            'id' => (string) Str::uuid(), 'user_id' => $user->id, 'username' => $user->username,
            'event_type' => 'definitely_not_valid', 'occurred_at' => now(),
        ]);
    }

    // ── 5 · charset & collation ──────────────────────────────────────────────

    public function test_every_table_is_utf8mb4(): void
    {
        // Arabic titles, customer names and tab labels all live here.
        $nonUtf8 = DB::select(
            "select TABLE_NAME, TABLE_COLLATION from information_schema.TABLES
             where TABLE_SCHEMA = database() and TABLE_COLLATION not like 'utf8mb4%'"
        );

        $this->assertSame([], $nonUtf8, 'every table must be utf8mb4');
    }

    public function test_arabic_survives_a_round_trip(): void
    {
        $user = $this->makeUser();
        $quote = $user->quotes()->create([
            'title' => 'عرض تكلفة - كتالوج',
            'customer_name' => 'مطبعة النور',
            'quote_data' => ['paper' => 'ورق كوشيه 300 جرام'],
        ]);

        $fresh = $quote->fresh();
        $this->assertSame('عرض تكلفة - كتالوج', $fresh->title);
        $this->assertSame('مطبعة النور', $fresh->customer_name);
        $this->assertSame('ورق كوشيه 300 جرام', $fresh->quote_data['paper']);
    }

    /**
     * @return array<string,array{0:string,1:string}>
     */
    public static function identityColumns(): array
    {
        return [
            'app_users.username' => ['app_users', 'username'],
            'user_sessions.session_token' => ['user_sessions', 'session_token'],
            'user_sessions.device_id' => ['user_sessions', 'device_id'],
            'user_settings.setting_key' => ['user_settings', 'setting_key'],
            'user_tab_permissions.tab_key' => ['user_tab_permissions', 'tab_key'],
        ];
    }

    #[DataProvider('identityColumns')]
    public function test_identity_columns_are_case_sensitive(string $table, string $column): void
    {
        // The default utf8mb4_unicode_ci would fold 'Admin'/'admin' into one account and
        // collapse two distinct opaque keys in the composite uniques. See SchemaCollation.
        $this->assertSame(
            SchemaCollation::MYSQL_CASE_SENSITIVE,
            $this->column($table, $column)->COLLATION_NAME,
        );
    }

    public function test_free_text_stays_case_insensitive_for_search(): void
    {
        // Deliberately NOT case-sensitive: a human searching quotes expects 'نور' to match
        // regardless of case, and titles are not identity.
        $this->assertSame('utf8mb4_unicode_ci', $this->column('saved_quotes', 'title')->COLLATION_NAME);
        $this->assertSame('utf8mb4_unicode_ci', $this->column('saved_quotes', 'customer_name')->COLLATION_NAME);
    }

    // ── 6 · timestamps ───────────────────────────────────────────────────────

    public function test_expires_at_is_datetime_not_timestamp(): void
    {
        // TIMESTAMP tops out at 2038-01-19; this column holds subscription end dates.
        $this->assertSame('datetime', $this->column('app_users', 'expires_at')->COLUMN_TYPE);
    }

    /**
     * @return array<string,array{0:string,1:string}>
     */
    public static function timestampColumns(): array
    {
        return [
            'app_users.created_at' => ['app_users', 'created_at'],
            'app_users.updated_at' => ['app_users', 'updated_at'],
            'user_sessions.last_active_at' => ['user_sessions', 'last_active_at'],
            'user_sessions.created_at' => ['user_sessions', 'created_at'],
            'saved_quotes.updated_at' => ['saved_quotes', 'updated_at'],
            'activity_events.occurred_at' => ['activity_events', 'occurred_at'],
            'session_events.occurred_at' => ['session_events', 'occurred_at'],
            'login_logs.logged_in_at' => ['login_logs', 'logged_in_at'],
        ];
    }

    #[DataProvider('timestampColumns')]
    public function test_no_column_silently_updates_itself(string $table, string $column): void
    {
        // MySQL's legacy TIMESTAMP behaviour can attach ON UPDATE CURRENT_TIMESTAMP to the
        // first timestamp column in a table. That would quietly rewrite audit rows —
        // session_events and activity_events are append-only history that analytics reads.
        $this->assertStringNotContainsStringIgnoringCase(
            'on update',
            $this->column($table, $column)->EXTRA,
            "{$table}.{$column} must not auto-update",
        );
    }

    public function test_an_audit_row_keeps_its_timestamp_when_the_row_is_touched(): void
    {
        $user = $this->makeUser();
        $id = (string) Str::uuid();
        $occurred = now()->subDays(3)->startOfSecond();

        DB::table('activity_events')->insert([
            'id' => $id, 'user_id' => $user->id, 'username' => $user->username,
            'action' => 'calculate', 'occurred_at' => $occurred,
        ]);

        DB::table('activity_events')->where('id', $id)->update(['tab_key' => 'itemcost']);

        $this->assertSame(
            $occurred->toDateTimeString(),
            DB::table('activity_events')->where('id', $id)->value('occurred_at'),
        );
    }
}
