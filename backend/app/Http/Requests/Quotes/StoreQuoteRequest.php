<?php

namespace App\Http\Requests\Quotes;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Lenient, matching the reference's absence of validation: every field falls back to a
 * default in QuoteService. `quote_data` is opaque and deliberately unconstrained.
 */
class StoreQuoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'title' => ['nullable', 'string'],
            'customer_name' => ['nullable', 'string'],
            'quote_number' => ['nullable', 'string'],
            'source_type' => ['nullable', 'string'],
            'quote_data' => ['nullable', 'array'],
        ];
    }

    /** @return array<string,mixed> */
    public function payload(): array
    {
        return $this->only(['title', 'customer_name', 'quote_number', 'source_type', 'quote_data']);
    }
}
