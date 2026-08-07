<?php

namespace Tests\Concerns;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Points the `supabase` connection at a fixture database shaped like the real source.
 *
 * The schema comes from tests/Fixtures/supabase-source.sql — transcribed from
 * supabase/migrations/*.sql, so `text`, `jsonb`, `timestamptz`, `uuid` and Supabase's
 * column order, NOT Laravel's. Building the fixture from this app's own migrations (as the
 * first version of these tests did) makes source and target identical by construction and
 * therefore proves nothing about a copy whose entire difficulty is that they are not.
 *
 * ## Which engine backs the fixture
 *
 * Production is Supabase PostgreSQL → MySQL 8. Set SUPABASE_TEST_DRIVER=pgsql and the
 * tests run that real pairing; phpunit.mysql.xml and phpunit.pgsql.xml both do. With
 * nothing configured it falls back to a throwaway SQLite file so `php artisan test` still
 * works with no infrastructure — the assertions all still run, but the Postgres-only
 * behaviours (a `timestamptz` rendered with an offset, `jsonb` normalising its own keys)
 * are then only simulated. requiresPostgresSource() marks the tests where that matters.
 *
 * A misconfigured pgsql source FAILS rather than falling back: a lane that quietly
 * downgrades to SQLite would report green without having tested the thing it exists for.
 *
 *     docker run -d --name printera-pg -e POSTGRES_USER=printera -e POSTGRES_PASSWORD=pw \
 *       -e POSTGRES_DB=printera -p 55432:5432 postgres:16-alpine
 *     docker exec printera-pg psql -U printera -d postgres -c "CREATE DATABASE supabase_source_test"
 */
trait SeedsSupabaseSource
{
    /** Created once per process; the fixture DDL drops and recreates, so this is safe. */
    private static bool $supabaseSchemaLoaded = false;

    private string $sqliteSourcePath = '';

    /**
     * Every table in the source, children first — the order a truncate has to follow.
     *
     * @var array<int,string>
     */
    private const SOURCE_TABLES = [
        'activity_events', 'session_events', 'login_logs', 'saved_quotes',
        'user_tab_permissions', 'user_settings', 'user_sessions', 'app_users',
    ];

    protected function bootSupabaseSource(): void
    {
        config(['database.connections.supabase' => $this->sourceConnectionConfig()]);
        DB::purge('supabase');

        // A shared Postgres fixture is built once and truncated between tests; the SQLite
        // fallback gets a fresh file per test and so has to be rebuilt each time.
        if ($this->sourceDriver() !== 'pgsql' || ! self::$supabaseSchemaLoaded) {
            $this->loadSupabaseSchema();
            self::$supabaseSchemaLoaded = true;
        }

        $this->truncateSupabaseSource();
    }

    protected function tearDownSupabaseSource(): void
    {
        DB::purge('supabase');

        if ($this->sqliteSourcePath !== '') {
            @unlink($this->sqliteSourcePath);
        }
    }

    protected function sourceDriver(): string
    {
        return (string) env('SUPABASE_TEST_DRIVER', 'sqlite');
    }

    /** Skip a test whose point is a behaviour only a real PostgreSQL source exhibits. */
    protected function requiresPostgresSource(): void
    {
        if ($this->sourceDriver() !== 'pgsql') {
            $this->markTestSkipped('Needs a real PostgreSQL source — set SUPABASE_TEST_DRIVER=pgsql.');
        }
    }

    /** @return array<string,mixed> */
    private function sourceConnectionConfig(): array
    {
        if ($this->sourceDriver() === 'pgsql') {
            return [
                'driver' => 'pgsql',
                'host' => env('SUPABASE_TEST_HOST', '127.0.0.1'),
                'port' => env('SUPABASE_TEST_PORT', '5432'),
                'database' => env('SUPABASE_TEST_DATABASE', 'supabase_source_test'),
                'username' => env('SUPABASE_TEST_USERNAME', 'postgres'),
                'password' => env('SUPABASE_TEST_PASSWORD', ''),
                'charset' => 'utf8',
                'prefix' => '',
                'search_path' => 'public',
                'sslmode' => 'prefer',
            ];
        }

        // Not :memory: — the command opens its own connection and would see an empty
        // database. One file per test: Windows keeps the handle open until the connection
        // is collected, so a shared path can survive its unlink() and leak rows forward.
        $path = storage_path('framework/testing/supabase-source-'.Str::random(8).'.sqlite');
        @mkdir(dirname($path), 0777, true);
        touch($path);
        $this->sqliteSourcePath = $path;

        return [
            'driver' => 'sqlite',
            'database' => $path,
            'prefix' => '',
            'foreign_key_constraints' => true,
        ];
    }

    private function loadSupabaseSchema(): void
    {
        $sql = (string) file_get_contents(base_path('tests/Fixtures/supabase-source.sql'));

        if ($this->sourceDriver() !== 'pgsql') {
            $sql = $this->toSqlite($sql);
        }

        // Comments go first so the split on `;` cannot be confused by one, and so no
        // comment-only fragment is left behind to be run as a statement. Safe here
        // because the fixture contains no string literal holding a `--`.
        $sql = (string) preg_replace('/^\s*--[^\n]*$/m', '', $sql);

        foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
            DB::connection('supabase')->statement($statement);
        }
    }

    /**
     * The Postgres fixture, approximated for SQLite.
     *
     * Only the spellings SQLite rejects are rewritten; the column NAMES, order and
     * nullability — the parts the copy actually reads — are untouched. The types it cannot
     * express (uuid, jsonb, timestamptz) all degrade to text, which is exactly why the
     * cross-engine assertions ask for a real Postgres source instead.
     */
    private function toSqlite(string $sql): string
    {
        return str_ireplace(
            [' uuid ', ' uuid,', 'jsonb', 'timestamptz', ' DEFAULT gen_random_uuid()', 'now()'],
            [' text ', ' text,', 'text', 'text', '', 'CURRENT_TIMESTAMP'],
            $sql,
        );
    }

    private function truncateSupabaseSource(): void
    {
        $connection = DB::connection('supabase');

        if ($connection->getDriverName() === 'pgsql') {
            $connection->statement('TRUNCATE '.implode(', ', self::SOURCE_TABLES).' RESTART IDENTITY CASCADE');

            return;
        }

        foreach (self::SOURCE_TABLES as $table) {
            $connection->table($table)->delete();
        }
    }

    // ── row builders ─────────────────────────────────────────────────────────

    /** @param array<string,mixed> $attrs */
    protected function sourceUser(array $attrs = []): string
    {
        $id = $attrs['id'] ?? (string) Str::uuid();

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
            'created_at' => $this->sourceTimestamp(),
            'updated_at' => $this->sourceTimestamp(),
        ], $attrs));

        return (string) $id;
    }

    /** @param array<string,mixed> $quoteData */
    protected function sourceQuote(string $userId, string $title, array $quoteData = [], array $attrs = []): string
    {
        $id = $attrs['id'] ?? (string) Str::uuid();

        DB::connection('supabase')->table('saved_quotes')->insert(array_merge([
            'id' => $id,
            'user_id' => $userId,
            'title' => $title,
            'customer_name' => 'عميل',
            'quote_number' => 'Q-1',
            'source_type' => 'calculator',
            'quote_data' => json_encode($quoteData, JSON_UNESCAPED_UNICODE),
            'created_at' => $this->sourceTimestamp(),
            'updated_at' => $this->sourceTimestamp(),
        ], $attrs));

        return (string) $id;
    }

    /** @param array<string,mixed> $attrs */
    protected function sourceRow(string $table, array $attrs): string
    {
        $attrs['id'] ??= (string) Str::uuid();
        DB::connection('supabase')->table($table)->insert($attrs);

        return (string) $attrs['id'];
    }

    /**
     * A timestamp in the shape the source really stores.
     *
     * Postgres would render its own `now()` with an offset; writing one explicitly means
     * the SQLite fallback presents the same shape to the command, so the normalisation is
     * exercised on every lane rather than only the configured-Postgres ones.
     */
    protected function sourceTimestamp(?string $when = null): string
    {
        return ($when ?? now()->format('Y-m-d H:i:s')).'+00';
    }
}
