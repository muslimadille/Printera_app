<?php

namespace App\Http\Resources;

use App\Models\SavedQuote;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A saved quote, matching the `SavedQuote` interface in src/lib/userApi.ts.
 *
 * `employee_username` and `is_parent_quote` are optional tags that only appear on
 * `related_quotes` (see QuoteService::listFor). QuoteService sets them as transient
 * attributes on the model; they are never persisted.
 *
 * `quote_data` is OPAQUE — the frontend owns its shape. Returned exactly as stored.
 *
 * @mixin SavedQuote
 */
class QuoteResource extends JsonResource
{
    /** @return array<string,mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'title' => $this->title,
            'customer_name' => $this->customer_name,
            'quote_number' => $this->quote_number,
            'source_type' => $this->source_type,
            'quote_data' => $this->quote_data,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),

            // Present only on related_quotes. Siblings get employee_username alone; the
            // owner's own quotes additionally carry is_parent_quote so the UI can label
            // them differently.
            $this->mergeWhen($this->employee_username !== null, fn () => [
                'employee_username' => $this->employee_username,
            ]),
            $this->mergeWhen($this->is_parent_quote === true, fn () => [
                'is_parent_quote' => true,
            ]),
        ];
    }
}
