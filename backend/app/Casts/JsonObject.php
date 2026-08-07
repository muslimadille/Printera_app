<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

/**
 * An opaque JSON object column that always reads back as an array, never null.
 *
 * The three JSON columns — `quote_data`, `setting_value`, `details` — used to carry a
 * DB-level `DEFAULT '{}'`. MySQL rejects that outright ("BLOB, TEXT, GEOMETRY or JSON
 * column can't have a default value"), so the default moved to the models and the columns
 * became nullable (BE-060).
 *
 * That leaves one gap the plain `array` cast does not cover: a row inserted by the query
 * builder — which bypasses `$attributes` — stores NULL, and `array` would hand that back
 * as `null`. Every consumer expects an array: QuoteResource returns `quote_data` straight
 * to the SPA, SettingService builds a map from `setting_value`, and AnalyticsService reads
 * `details ?? []`. Coercing here keeps a NULL row indistinguishable from an empty one,
 * which is what the previous `DEFAULT '{}'` guaranteed.
 *
 * The contents stay OPAQUE: decoded and re-encoded, never reshaped.
 *
 * @implements CastsAttributes<array<mixed>, array<mixed>|null>
 */
class JsonObject implements CastsAttributes
{
    /**
     * @param  array<string,mixed>  $attributes
     * @return array<mixed>
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        if (is_array($value)) {
            return $value;
        }

        $decoded = json_decode((string) $value, true);

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * @param  array<string,mixed>  $attributes
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null) {
            return null;
        }

        // Already-encoded JSON passes through untouched — the bulk activity insert hands
        // over a string it encoded itself.
        if (is_string($value)) {
            return $value;
        }

        return json_encode($value, JSON_UNESCAPED_UNICODE);
    }
}
