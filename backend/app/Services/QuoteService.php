<?php

namespace App\Services;

use App\Models\AppUser;
use App\Models\SavedQuote;

/**
 * Saved quotes. Ports handleSaveQuote / handleListQuotes / handleUpdateQuote /
 * handleDeleteQuote / handleTransferQuotes (manage-users/index.ts:694-816, 619-643).
 *
 * `quote_data` is OPAQUE — stored and returned byte-for-byte, never reshaped.
 */
class QuoteService
{
    /**
     * JS `a || b` semantics: the reference writes `title || ''` and
     * `source_type || 'calculator'`, so an empty string falls through to the default.
     * PHP's `??` would keep the empty string, which is a different observable result.
     */
    private function orDefault(mixed $value, string $default): string
    {
        return is_string($value) && $value !== '' ? $value : $default;
    }

    // ── BE-021 · create ──────────────────────────────────────────────────────

    /** @param  array<string,mixed>  $params */
    public function create(AppUser $user, array $params): SavedQuote
    {
        return $user->quotes()->create([
            'title' => $this->orDefault($params['title'] ?? null, ''),
            'customer_name' => $this->orDefault($params['customer_name'] ?? null, ''),
            'quote_number' => $this->orDefault($params['quote_number'] ?? null, ''),
            'source_type' => $this->orDefault($params['source_type'] ?? null, 'calculator'),
            'quote_data' => $params['quote_data'] ?? [],
        ]);
    }
}
