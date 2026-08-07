<?php

namespace Tests\Concerns;

trait ComparesJson
{
    /**
     * Recursively sort by key so two payloads can be compared without depending on key
     * ORDER — which is not part of the contract.
     *
     * Postgres `jsonb` stores a parsed binary form and re-sorts object keys (by key length,
     * then bytewise); SQLite stores the JSON text verbatim and preserves insertion order.
     * See PHASE-0-1-AUDIT.md §6. Sorting first keeps assertSame's strict type checking —
     * assertEquals would ignore order too, but would also let 0 pass as false, which is
     * exactly the kind of drift the "opaque JSON" guarantee exists to catch.
     *
     * @param  array<mixed>  $value
     * @return array<mixed>
     */
    protected function sortedByKey(array $value): array
    {
        ksort($value);

        foreach ($value as $key => $item) {
            if (is_array($item)) {
                $value[$key] = $this->sortedByKey($item);
            }
        }

        return $value;
    }

    /**
     * Assert two JSON payloads are identical in keys, values and value TYPES, ignoring
     * object key order.
     *
     * @param  array<mixed>  $expected
     */
    protected function assertSameJson(array $expected, mixed $actual, string $message = ''): void
    {
        $this->assertIsArray($actual, $message);
        $this->assertSame($this->sortedByKey($expected), $this->sortedByKey($actual), $message);
    }
}
