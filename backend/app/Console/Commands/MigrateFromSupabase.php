<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * OPS-070 — copy the Supabase tables into this database.
 *
 * A command rather than pg_dump/psql because the run has to be **idempotent, resumable and
 * verifiable**: it reports per-table counts, can be re-run after a partial failure without
 * duplicating anything, and can be rehearsed with --dry-run against staging.
 *
 * Three rules the copy must not break (02-DATABASE-SCHEMA.md §6):
 *
 *  1. **Ids and column values are preserved verbatim.** Every foreign key is a UUID that
 *     already exists on both sides, so a straight copy keeps the graph intact. Nothing is
 *     regenerated, renumbered or reformatted.
 *  2. **`password_hash` is copied, never re-hashed.** The column holds bcrypt for most
 *     users and a legacy 64-hex SHA-256 for old ones; AuthService verifies both and
 *     upgrades the SHA-256 rows on next login. Touching them here would lock people out.
 *  3. **`user_sessions` is NOT migrated.** Those tokens are opaque Supabase strings, not
 *     JWTs, so they cannot validate against this API. The table stays empty and every user
 *     re-logs in once; the SPA turns the resulting 401 into a clean forced logout.
 *
 * `quote_data`, `setting_value` and `details` are opaque JSON and cross as-is. Postgres
 * `jsonb` may reorder object keys — that is not a content change and nothing reads them
 * positionally (PHASE-0-1-AUDIT.md §6).
 */
class MigrateFromSupabase extends Command
{
    protected $signature = 'app:migrate-from-supabase
                            {--table= : Copy only this table (repeatable, comma-separated)}
                            {--since-days= : For the two event tables, copy only rows newer than N days}
                            {--chunk=500 : Rows per read/write batch}
                            {--dry-run : Read and report, write nothing}';

    protected $description = 'Copy app data from the Supabase database into this one (Phase 7, OPS-070)';

    /**
     * FK-safe order. `app_users` must land first because everything references it, and it
     * is copied in two passes internally (see copyAppUsers) for its self-reference.
     *
     * `user_sessions` is absent by design — see the class docblock.
     *
     * @var array<int,string>
     */
    public const TABLES = [
        'app_users',
        'user_settings',
        'user_tab_permissions',
        'saved_quotes',
        'login_logs',
        'session_events',
        'activity_events',
    ];

    /** Tables that carry history and can be trimmed with --since-days. */
    private const EVENT_TABLES = ['session_events' => 'occurred_at', 'activity_events' => 'occurred_at'];

    private bool $dryRun = false;

    public function handle(): int
    {
        $this->dryRun = (bool) $this->option('dry-run');
        $chunk = max(1, (int) $this->option('chunk'));

        $tables = $this->selectedTables();
        if ($tables === null) {
            return self::FAILURE;
        }

        if (! $this->assertSourceReachable()) {
            return self::FAILURE;
        }

        $this->newLine();
        $this->info($this->dryRun
            ? 'DRY RUN — reading from Supabase, writing nothing.'
            : 'Copying from Supabase. Safe to re-run: rows are upserted by primary key.');
        $this->newLine();

        /** @var array<int,array<string,mixed>> $report */
        $report = [];

        foreach ($tables as $table) {
            $report[] = $this->copyTable($table, $chunk);
        }

        $this->newLine();
        $this->table(['table', 'source', 'copied', 'source total', 'target total', 'status'], array_map(
            fn (array $row): array => [
                $row['table'],
                $row['read'],
                $this->dryRun ? '—' : $row['written'],
                $row['source_total'],
                $this->dryRun ? '—' : $row['target_total'],
                $row['status'],
            ],
            $report,
        ));

        $failed = array_filter($report, fn (array $row): bool => $row['status'] !== 'ok');

        if ($failed !== []) {
            $this->error(sprintf('%d table(s) did not complete. Re-run to resume.', count($failed)));

            return self::FAILURE;
        }

        $this->newLine();
        $this->info($this->dryRun
            ? 'Dry run complete. Re-run without --dry-run to write.'
            : 'Copy complete. user_sessions was intentionally skipped — users re-login once.');

        // The reminder that most often gets forgotten between the two halves of Phase 7.
        if (! $this->dryRun) {
            $this->line('Next: app:migrate-supabase-storage (OPS-071), then app:report-migration (OPS-073).');
        }

        return self::SUCCESS;
    }

    // ── selection & preflight ────────────────────────────────────────────────

    /** @return array<int,string>|null null when the caller named an unknown table */
    private function selectedTables(): ?array
    {
        $requested = (string) $this->option('table');

        if ($requested === '') {
            return self::TABLES;
        }

        $names = array_values(array_filter(array_map('trim', explode(',', $requested))));
        $unknown = array_diff($names, self::TABLES);

        if ($unknown !== []) {
            $this->error('Unknown table(s): '.implode(', ', $unknown));

            if (array_intersect($unknown, ['user_sessions'])) {
                $this->line('user_sessions is deliberately not migratable — its tokens are not JWTs.');
            }

            $this->line('Available: '.implode(', ', self::TABLES));

            return null;
        }

        // Keep the FK-safe order regardless of the order given on the command line.
        return array_values(array_filter(self::TABLES, fn (string $t): bool => in_array($t, $names, true)));
    }

    private function assertSourceReachable(): bool
    {
        try {
            $this->source()->getPdo();
        } catch (\Throwable $e) {
            $this->error('Cannot reach the Supabase database on the `supabase` connection.');
            $this->line('Set SUPABASE_DB_HOST / _PORT / _DATABASE / _USERNAME / _PASSWORD (or SUPABASE_DB_URL) in .env.');
            $this->line('Use the DIRECT connection string, not the transaction pooler.');
            $this->line($e->getMessage());

            return false;
        }

        return true;
    }

    // ── the copy ─────────────────────────────────────────────────────────────

    /** @return array<string,mixed> */
    private function copyTable(string $table, int $chunk): array
    {
        $sourceTotal = (int) $this->sourceQuery($table)->count();
        $read = 0;
        $written = 0;
        $status = 'ok';

        $this->line("→ {$table} ({$sourceTotal} row(s) in scope)");

        try {
            $handler = $table === 'app_users'
                ? fn (): array => $this->copyAppUsers($chunk)
                : fn (): array => $this->copyRows($table, $chunk);

            [$read, $written] = $handler();
        } catch (QueryException $e) {
            $status = 'failed';
            $this->error("  {$table}: ".$e->getMessage());
        }

        return [
            'table' => $table,
            'read' => $read,
            'written' => $written,
            'source_total' => $sourceTotal,
            'target_total' => $this->dryRun ? 0 : (int) DB::table($table)->count(),
            'status' => $status,
        ];
    }

    /**
     * `app_users.parent_user_id` references `app_users.id`, so an employee inserted before
     * its owner would violate the FK. Two passes: parents (admins and account owners)
     * first, then employees. Ordering by created_at is not enough — an employee can
     * predate a re-created owner row.
     *
     * @return array{0:int,1:int}
     */
    private function copyAppUsers(int $chunk): array
    {
        $read = 0;
        $written = 0;

        foreach ([true, false] as $parentsFirst) {
            $query = $this->sourceQuery('app_users');
            $parentsFirst ? $query->whereNull('parent_user_id') : $query->whereNotNull('parent_user_id');

            [$r, $w] = $this->streamInto('app_users', $query, $chunk);
            $read += $r;
            $written += $w;
        }

        return [$read, $written];
    }

    /** @return array{0:int,1:int} */
    private function copyRows(string $table, int $chunk): array
    {
        return $this->streamInto($table, $this->sourceQuery($table), $chunk);
    }

    /**
     * Read in id-ordered chunks and upsert by primary key.
     *
     * `upsert` on the `id` key is what makes a re-run safe after a partial failure: rows
     * already copied are overwritten with identical values rather than duplicated or
     * rejected. Ordering by id keeps the cursor stable across chunks.
     *
     * @param  Builder  $query
     * @return array{0:int,1:int} [read, written]
     */
    private function streamInto(string $table, $query, int $chunk): array
    {
        $read = 0;
        $written = 0;
        $lastId = null;

        while (true) {
            $page = (clone $query)
                ->when($lastId !== null, fn ($q) => $q->where('id', '>', $lastId))
                ->orderBy('id')
                ->limit($chunk)
                ->get();

            if ($page->isEmpty()) {
                break;
            }

            $rows = $page->map(fn ($row): array => $this->normalise((array) $row))->all();
            $read += count($rows);
            $lastId = $page->last()->id;

            if (! $this->dryRun) {
                $columns = array_keys($rows[0]);
                DB::table($table)->upsert(
                    $rows,
                    ['id'],
                    array_values(array_diff($columns, ['id'])),
                );
                $written += count($rows);
            }

            $this->output->write('.');
        }

        if ($read > 0) {
            $this->output->write(PHP_EOL);
        }

        return [$read, $written];
    }

    /**
     * PDO hands back everything as strings/resources depending on the driver. Booleans and
     * JSON are the two that matter: `jsonb` arrives as a JSON string and must be written
     * back as one (the target column is jsonb too), while `bool` arrives as PHP bool from
     * pdo_pgsql and needs no help. Resources appear for `bytea`, which this schema has
     * none of — guarded anyway so a surprise column fails loudly rather than silently
     * writing "Resource id #5".
     *
     * @param  array<string,mixed>  $row
     * @return array<string,mixed>
     */
    private function normalise(array $row): array
    {
        foreach ($row as $column => $value) {
            if (is_resource($value)) {
                throw new \RuntimeException("Unexpected binary column `{$column}` — the copy does not handle bytea.");
            }
        }

        return $row;
    }

    // ── source access ────────────────────────────────────────────────────────

    private function source(): Connection
    {
        return DB::connection('supabase');
    }

    /**
     * The source rows for one table, with --since-days applied to the event tables only.
     *
     * @return Builder
     */
    private function sourceQuery(string $table)
    {
        $query = $this->source()->table($table);
        $sinceDays = $this->option('since-days');

        if ($sinceDays !== null && $sinceDays !== '' && isset(self::EVENT_TABLES[$table])) {
            $query->where(self::EVENT_TABLES[$table], '>=', now()->subDays((int) $sinceDays));
        }

        return $query;
    }
}
