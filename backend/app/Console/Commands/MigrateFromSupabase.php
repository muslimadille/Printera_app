<?php

namespace App\Console\Commands;

use App\Support\TargetColumns;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * OPS-070 — copy the Supabase tables into this database.
 *
 * A command rather than pg_dump/psql because this is a **cross-engine** copy: the source
 * is Supabase PostgreSQL and the target is MySQL 8 (BE-060). No dump file speaks both, so
 * the rows are streamed through PHP — which also buys what the run actually needs: it is
 * idempotent, resumable and verifiable, reports per-table counts, and can be rehearsed
 * with --dry-run.
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
 *
 * Rule 1 has exactly one carve-out, forced by the engines rather than chosen:
 * **timestamps are re-rendered in UTC**. Postgres prints `timestamptz` with an offset and
 * microseconds (`2026-04-05 09:00:00.704374+00`); MySQL rejects that string outright
 * ("1292 Incorrect datetime value"), which is what made the first cross-engine rehearsal
 * copy zero rows. The instant is preserved exactly; only its spelling changes. See
 * normaliseTimestamp().
 */
class MigrateFromSupabase extends Command
{
    protected $signature = 'app:migrate-from-supabase
                            {--table= : Copy only this table (repeatable, comma-separated)}
                            {--since-days= : For the two event tables, copy only rows newer than N days}
                            {--chunk=500 : Rows per read/write batch}
                            {--dry-run : Read and report, write nothing}
                            {--skip-width-check : Skip the pre-flight scan for over-long values}
                            {--truncate-overlong : Copy over-long values trimmed to fit instead of refusing}';

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

    /** @var array<string,TargetColumns> the target schema, read once per table */
    private array $schema = [];

    /** @var array<int,array{table:string,column:string,id:string,from:int,to:int}> */
    private array $truncated = [];

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

        if (! $this->preflight($tables)) {
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

        $this->reportTruncations();

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

    /**
     * Refuse to start a run that is going to lose data half way through.
     *
     * Two failure modes, both invisible until the write that hits them, and both far more
     * expensive to discover during the maintenance window than five minutes beforehand:
     *
     *  - a source column with **nowhere to go** — the target would silently drop it;
     *  - a source value **too long for the target column**. Supabase types every string as
     *    unbounded `text`; BE-060 had to bound the indexed ones so MySQL could index them.
     *    `ip_address` is the one to expect: it is `varchar(45)` here, and the edge function
     *    stored a raw `x-forwarded-for`, which is a comma-separated proxy chain.
     *
     * @param  array<int,string>  $tables
     */
    private function preflight(array $tables): bool
    {
        $fatal = false;

        foreach ($tables as $table) {
            $target = $this->schema[$table] = TargetColumns::for($table);
            $sourceColumns = $this->source()->getSchemaBuilder()->getColumnListing($table);

            $orphaned = array_values(array_diff($sourceColumns, $target->names));
            $absent = array_values(array_diff($target->names, $sourceColumns));

            if ($orphaned !== []) {
                $fatal = true;
                $this->error("{$table}: the source has column(s) this schema does not: ".implode(', ', $orphaned));
                $this->line('  A straight copy would drop them silently. Add them here, or exclude the table.');
            }

            if ($absent !== []) {
                // Not fatal: the target's own default fills these. Worth saying out loud.
                $this->warn("{$table}: not present in the source, will take this schema's default: ".implode(', ', $absent));
            }
        }

        if ($fatal) {
            return false;
        }

        return $this->option('skip-width-check') ? true : $this->checkWidths($tables);
    }

    /**
     * Scan the source for values that cannot fit the target columns.
     *
     * A full scan per bounded column — a sequential read on the event tables, but this
     * runs once, and the alternative is finding out mid-write with half the rows across.
     * `--skip-width-check` exists for the resume case, where it has already been answered.
     *
     * @param  array<int,string>  $tables
     */
    private function checkWidths(array $tables): bool
    {
        /** @var array<int,array<int,string>> $offenders */
        $offenders = [];

        foreach ($tables as $table) {
            foreach ($this->schema[$table]->widths as $column => $width) {
                $length = $this->charLength($column);

                $stats = (clone $this->sourceQuery($table))
                    ->whereRaw("{$length} > ?", [$width])
                    ->selectRaw("count(*) as n, max({$length}) as longest")
                    ->first();

                $count = (int) ($stats->n ?? 0);

                if ($count === 0) {
                    continue;
                }

                $samples = (clone $this->sourceQuery($table))
                    ->whereRaw("{$length} > ?", [$width])
                    ->orderBy('id')
                    ->limit(3)
                    ->pluck('id')
                    ->all();

                $offenders[] = [
                    "{$table}.{$column}",
                    (string) $width,
                    (string) ($stats->longest ?? '?'),
                    (string) $count,
                    implode("\n", $samples),
                ];
            }
        }

        if ($offenders === []) {
            return true;
        }

        $this->newLine();
        $this->error('Source values too long for this schema:');
        $this->table(['column', 'target width', 'longest source value', 'rows', 'example ids'], $offenders);

        if ($this->option('truncate-overlong')) {
            $this->warn('--truncate-overlong: these will be trimmed to fit. Every trimmed row is listed at the end.');

            return true;
        }

        $this->newLine();
        $this->line('Nothing was copied. Choose one:');
        $this->line('  • widen the column(s) in a migration and re-run — no data is lost;');
        $this->line('  • re-run with --truncate-overlong to trim them, which prints an audit list.');
        $this->line('    Expected for `ip_address`: Supabase stored a raw x-forwarded-for chain, whose');
        $this->line('    LEFTMOST entry is the client IP, so a trim keeps the part the admin panel shows.');

        return false;
    }

    /**
     * A character-count expression for the source engine.
     *
     * MySQL's `length()` counts bytes, so it needs `char_length()` — a two-byte Arabic
     * character must not read as two. The cast is not cosmetic either: `id` is `uuid` on
     * the source but `char(36)` here, and Postgres has no `length(uuid)`.
     */
    private function charLength(string $column): string
    {
        $wrapped = $this->source()->getQueryGrammar()->wrap($column);

        return $this->source()->getDriverName() === 'mysql'
            ? "char_length(cast({$wrapped} as char))"
            : "length(cast({$wrapped} as text))";
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

            $rows = $page->map(fn ($row): array => $this->normalise($table, (array) $row))->all();
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
     * Make one source row acceptable to the target engine, changing as little as possible.
     *
     * PDO hands back everything as strings/bools depending on the driver. Booleans arrive
     * as PHP bool from pdo_pgsql and need no help; `jsonb` arrives as a JSON string and is
     * written back as one, unparsed, so the blob is never reshaped. Resources appear for
     * `bytea`, which this schema has none of — guarded anyway so a surprise column fails
     * loudly rather than silently writing "Resource id #5".
     *
     * @param  array<string,mixed>  $row
     * @return array<string,mixed>
     */
    private function normalise(string $table, array $row): array
    {
        $target = $this->schema[$table];

        foreach ($row as $column => $value) {
            if (is_resource($value)) {
                throw new \RuntimeException("Unexpected binary column `{$column}` — the copy does not handle bytea.");
            }

            if ($value === null) {
                continue;
            }

            if ($target->isTemporal($column)) {
                $row[$column] = $this->normaliseTimestamp($table, $column, $value);

                continue;
            }

            $width = $target->widthOf($column);

            if ($width !== null && is_string($value) && mb_strlen($value) > $width) {
                // The preflight already refused unless --truncate-overlong was given.
                $this->truncated[] = [
                    'table' => $table, 'column' => $column, 'id' => (string) ($row['id'] ?? '?'),
                    'from' => mb_strlen($value), 'to' => $width,
                ];
                $row[$column] = mb_substr($value, 0, $width);
            }
        }

        return $row;
    }

    /**
     * Re-render one instant in UTC, in a spelling the target engine accepts.
     *
     * Postgres prints `timestamptz` as `2026-04-05 09:00:00.704374+00`. MySQL's parser
     * rejects the offset in strict mode, so the string is rebuilt — but the *instant* is
     * read from the offset first, which also makes the copy independent of whatever
     * `TimeZone` the source session happens to be set to.
     *
     * Postgres targets keep an explicit offset so nothing is left to the session; MySQL
     * and SQLite take a naive UTC string (the mysql connection pins `time_zone` to +00:00
     * in config/database.php, so "naive" is unambiguous there too).
     *
     * Sub-second precision is dropped by TRUNCATION, not rounding: every timestamp column
     * in this schema is precision 0 on all three engines, so the fraction has nowhere to
     * live, and flooring cannot push an event into the following second the way MySQL's
     * own rounding can.
     */
    private function normaliseTimestamp(string $table, string $column, mixed $value): string
    {
        $format = DB::connection()->getDriverName() === 'pgsql' ? 'Y-m-d H:i:sP' : 'Y-m-d H:i:s';

        if ($value instanceof \DateTimeInterface) {
            return CarbonImmutable::instance($value)->utc()->format($format);
        }

        try {
            return CarbonImmutable::parse((string) $value)->utc()->format($format);
        } catch (\Throwable) {
            throw new \RuntimeException(
                "`{$table}.{$column}` is a timestamp here but the source holds ".var_export($value, true)
            );
        }
    }

    private function reportTruncations(): void
    {
        if ($this->truncated === []) {
            return;
        }

        $this->newLine();
        $this->warn(sprintf('%d value(s) were trimmed to fit. Audit list:', count($this->truncated)));
        $this->table(['table', 'column', 'row id', 'chars', 'kept'], array_map(
            fn (array $t): array => [$t['table'], $t['column'], $t['id'], (string) $t['from'], (string) $t['to']],
            $this->truncated,
        ));
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
