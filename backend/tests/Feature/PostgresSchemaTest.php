<?php

namespace Tests\Feature;

use App\Models\AppUser;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * BE-002 / BE-019 — schema behaviors that SQLite cannot prove.
 *
 * The rest of the suite runs on in-memory SQLite, where the partial unique index, the
 * jsonb column type and its `{}` default, and the event_type CHECK are all either absent
 * or silently degraded. Postgres is the deployment target, so these are asserted against
 * a real instance.
 *
 * Skipped automatically unless the active connection is pgsql. To run:
 *
 *   docker run -d --name printera-pg -e POSTGRES_PASSWORD=pw -e POSTGRES_USER=printera \
 *     -e POSTGRES_DB=printera -p 55432:5432 postgres:16
 *   ./vendor/bin/phpunit -c phpunit.pgsql.xml
 *
 * Each violation is triggered as the LAST statement of its test: in Postgres a failed
 * statement aborts the surrounding transaction, so nothing may follow it.
 */
class PostgresSchemaTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::connection()->getDriverName() !== 'pgsql') {
            $this->markTestSkipped('Postgres-only schema assertions; active driver is '.DB::connection()->getDriverName());
        }
    }

    private function makeUser(string $username = 'pg-tester'): AppUser
    {
        return AppUser::query()->create([
            'username' => $username,
            'password_hash' => Hash::make('secret123'),
            'is_active' => true,
            'is_admin' => false,
            'max_devices' => 5,
        ]);
    }

    /** @param  array<string,mixed>  $overrides */
    private function sessionRow(AppUser $user, array $overrides = []): array
    {
        return array_merge([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'session_token' => bin2hex(random_bytes(32)),
            'device_id' => null,
            'device_info' => 'ua',
            'ip_address' => '203.0.113.1',
            'last_active_at' => now(),
            'created_at' => now(),
        ], $overrides);
    }

    // ── 1 · unique index on (user_id, device_id) ─────────────────────────────

    public function test_the_user_device_unique_exists_and_is_no_longer_partial(): void
    {
        $def = DB::selectOne(
            "select indexdef from pg_indexes where schemaname = 'public' and indexname = ?",
            ['user_sessions_user_device_unique']
        );

        $this->assertNotNull($def, 'user_sessions_user_device_unique is missing on Postgres');
        $this->assertStringContainsString('UNIQUE INDEX', $def->indexdef);
        $this->assertStringContainsString('user_id', $def->indexdef);
        $this->assertStringContainsString('device_id', $def->indexdef);

        // BE-060 dropped the `WHERE (device_id IS NOT NULL)` clause. It was never
        // load-bearing — SQL treats NULLs as distinct in a unique index, so a plain one
        // already allows many NULL-device rows per user — and MySQL cannot express a
        // partial index at all, which left the production engine with NO constraint.
        // The behaviour is unchanged and asserted on all three engines in
        // SchemaSemanticsTest; this pins that the clause is really gone here.
        $this->assertStringNotContainsString('WHERE', $def->indexdef);
    }

    // ── 2 · jsonb columns and their {} defaults ──────────────────────────────

    public function test_json_columns_are_really_jsonb(): void
    {
        foreach ([
            ['saved_quotes', 'quote_data'],
            ['activity_events', 'details'],
            ['user_settings', 'setting_value'],
        ] as [$table, $column]) {
            $type = DB::selectOne(
                'select data_type from information_schema.columns where table_name = ? and column_name = ?',
                [$table, $column]
            );

            $this->assertNotNull($type, "{$table}.{$column} not found");
            $this->assertSame('jsonb', $type->data_type, "{$table}.{$column} should be jsonb");
        }
    }

    public function test_the_json_columns_carry_no_database_default(): void
    {
        // BE-060 removed `DEFAULT '{}'` because MySQL forbids a literal default on a JSON
        // column, and moved it to the models. Postgres would happily keep the old default,
        // so this asserts the two engines actually agree — otherwise a raw insert would
        // store '{}' here and NULL in production, and only one of them would be tested.
        foreach ([
            ['saved_quotes', 'quote_data'],
            ['activity_events', 'details'],
            ['user_settings', 'setting_value'],
        ] as [$table, $column]) {
            $meta = DB::selectOne(
                'select column_default, is_nullable from information_schema.columns
                 where table_name = ? and column_name = ?',
                [$table, $column]
            );

            $this->assertNotNull($meta, "{$table}.{$column} not found");
            $this->assertNull($meta->column_default, "{$table}.{$column} must have no DB default");
            $this->assertSame('YES', $meta->is_nullable, "{$table}.{$column} must be nullable");
        }
    }

    public function test_jsonb_round_trips_through_the_models(): void
    {
        $user = $this->makeUser();

        $quote = $user->quotes()->create([
            'title' => 'عرض سعر',
            'quote_data' => ['sheets' => 12, 'nested' => ['ok' => true], 'unicode' => 'ورق كوشيه'],
        ]);

        // assertEquals, not assertSame: jsonb stores a parsed binary representation and
        // does NOT preserve object key order (it sorts by key length, then bytewise), so
        // the array comes back reordered. Harmless here — quote_data is opaque and the
        // frontend reads it by key — but it means no consumer may rely on key order, and
        // a byte-for-byte comparison of the raw column against the input will not match.
        // SQLite stores the JSON text verbatim and so hides this entirely.
        $this->assertEquals(
            ['sheets' => 12, 'nested' => ['ok' => true], 'unicode' => 'ورق كوشيه'],
            $quote->fresh()->quote_data
        );
    }

    public function test_jsonb_reorders_object_keys(): void
    {
        // Pinned deliberately: if a future migration switches these columns to `json`
        // (which DOES preserve order and duplicate keys), this test starts failing and
        // tells the reader the storage contract changed.
        $user = $this->makeUser();
        $quote = $user->quotes()->create(['quote_data' => ['bbb' => 1, 'a' => 2]]);

        $raw = DB::table('saved_quotes')->where('id', $quote->id)->value('quote_data');

        $this->assertSame('{"a": 2, "bbb": 1}', $raw);
    }

    // ── 3 · session_events.event_type CHECK ──────────────────────────────────

    public function test_event_type_check_constraint_exists(): void
    {
        $def = DB::selectOne(
            'select pg_get_constraintdef(oid) as def from pg_constraint where conname = ?',
            ['session_events_event_type_check']
        );

        $this->assertNotNull($def, 'session_events_event_type_check is missing');
        foreach (['login', 'logout', 'heartbeat', 'auto_logout'] as $allowed) {
            $this->assertStringContainsString($allowed, $def->def);
        }
    }

    public function test_all_four_documented_event_types_are_accepted(): void
    {
        $user = $this->makeUser();

        foreach (['login', 'logout', 'heartbeat', 'auto_logout'] as $type) {
            DB::table('session_events')->insert([
                'id' => (string) Str::uuid(),
                'user_id' => $user->id,
                'username' => $user->username,
                'event_type' => $type,
                'occurred_at' => now(),
            ]);
        }

        $this->assertSame(4, DB::table('session_events')->count());
    }

    public function test_an_unknown_event_type_is_rejected(): void
    {
        $user = $this->makeUser();

        $this->expectException(QueryException::class);
        DB::table('session_events')->insert([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'username' => $user->username,
            'event_type' => 'definitely_not_valid',
            'occurred_at' => now(),
        ]);
    }

    // ── 4 · the rest of 02-DATABASE-SCHEMA.md ────────────────────────────────

    public function test_every_documented_table_and_framework_table_exists(): void
    {
        $tables = DB::table('information_schema.tables')
            ->where('table_schema', 'public')
            ->pluck('table_name')
            ->all();

        foreach ([
            'app_users', 'user_sessions', 'session_events', 'login_logs',
            'activity_events', 'saved_quotes', 'user_settings', 'user_tab_permissions',
            'cache', 'jobs', 'job_batches', 'failed_jobs', 'sessions',
        ] as $expected) {
            $this->assertContains($expected, $tables);
        }
    }

    public function test_upsert_targets_from_the_spec_are_unique(): void
    {
        foreach ([
            ['user_settings', ['user_id', 'setting_key']],
            ['user_tab_permissions', ['user_id', 'tab_key']],
        ] as [$table, $columns]) {
            $indexes = DB::table('pg_indexes')
                ->where('schemaname', 'public')
                ->where('tablename', $table)
                ->pluck('indexdef')
                ->filter(fn ($def) => str_contains($def, 'UNIQUE'))
                ->implode("\n");

            foreach ($columns as $column) {
                $this->assertStringContainsString($column, $indexes, "{$table} is missing its unique index");
            }
        }
    }

    public function test_deleting_an_owner_cascades_to_its_children(): void
    {
        $owner = $this->makeUser('pg-owner');
        $employee = $this->makeUser('pg-employee');
        $employee->forceFill(['parent_user_id' => $owner->id])->save();
        DB::table('user_sessions')->insert($this->sessionRow($owner, ['device_id' => 'dev-x']));

        $owner->delete();

        $this->assertSame(0, DB::table('app_users')->where('id', $employee->id)->count());
        $this->assertSame(0, DB::table('user_sessions')->where('user_id', $owner->id)->count());
    }

    public function test_username_is_unique(): void
    {
        $this->makeUser('pg-dupe');

        $this->expectException(QueryException::class);
        $this->makeUser('pg-dupe');
    }
}
