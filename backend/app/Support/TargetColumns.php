<?php

namespace App\Support;

use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;

/**
 * What one target table will and will not accept — read from the live schema.
 *
 * OPS-070 copies from PostgreSQL into MySQL, and the two disagree about more than
 * syntax. Two of those disagreements silently destroy data or abort a maintenance
 * window, and both are answerable from the target's own column metadata:
 *
 *  - **Timestamps.** Postgres renders `timestamptz` with an offset
 *    (`2026-04-05 09:00:00+00`); MySQL's parser rejects that outright in strict mode.
 *    Knowing which columns are temporal is what lets the copy normalise them.
 *  - **Widths.** Supabase types every string column as unbounded `text`. The Laravel
 *    schema had to bound the indexed ones (BE-060), so a value that lived happily in
 *    Supabase can be too long here — `ip_address` is `varchar(45)` while the edge
 *    function wrote a raw `x-forwarded-for`, which is a comma-separated chain.
 *
 * Read from the schema rather than hardcoded so this cannot drift from the migrations,
 * and so it answers correctly on all three engines. SQLite reports no width at all,
 * which is right: it does not enforce them.
 */
final class TargetColumns
{
    /** Every spelling of "this column holds a point in time" across the three engines. */
    private const TEMPORAL = ['timestamp', 'timestamptz', 'datetime', 'datetimetz'];

    /** Types whose declared length is a CHARACTER limit worth checking. */
    private const BOUNDED = ['varchar', 'char', 'bpchar', 'character varying', 'nvarchar'];

    /**
     * @param  array<int,string>  $names
     * @param  array<int,string>  $temporal
     * @param  array<string,int>  $widths
     */
    private function __construct(
        public readonly array $names,
        public readonly array $temporal,
        public readonly array $widths,
    ) {}

    public static function for(string $table, ?Connection $connection = null): self
    {
        $connection ??= DB::connection();

        $names = [];
        $temporal = [];
        $widths = [];

        foreach ($connection->getSchemaBuilder()->getColumns($table) as $column) {
            $name = (string) $column['name'];
            $typeName = strtolower((string) ($column['type_name'] ?? ''));
            $type = strtolower((string) ($column['type'] ?? ''));

            $names[] = $name;

            if (in_array($typeName, self::TEMPORAL, true)) {
                $temporal[] = $name;
            }

            // `tinyint(1)` also carries a parenthesised number, so the type must be
            // known-bounded before the digits mean a character limit.
            if (in_array($typeName, self::BOUNDED, true) && preg_match('/\((\d+)\)/', $type, $m) === 1) {
                $widths[$name] = (int) $m[1];
            }
        }

        return new self($names, $temporal, $widths);
    }

    public function isTemporal(string $column): bool
    {
        return in_array($column, $this->temporal, true);
    }

    /** The character limit for a column, or null when it is unbounded (or unenforced). */
    public function widthOf(string $column): ?int
    {
        return $this->widths[$column] ?? null;
    }

    public function has(string $column): bool
    {
        return in_array($column, $this->names, true);
    }
}
