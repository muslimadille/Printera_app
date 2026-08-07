<?php

namespace App\Http\Requests\Quotes;

use Illuminate\Foundation\Http\FormRequest;

/**
 * PATCH semantics: only keys actually present are applied, mirroring the reference's
 * `params.x !== undefined` checks (index.ts:736-739).
 *
 * `sometimes|string` rather than `nullable|string` is deliberate. The columns are NOT NULL,
 * so an explicit null would hit a database constraint and surface as a generic 500; this
 * turns it into the standard 200 business error instead. The current client never sends
 * null (JSON.stringify drops undefined), so no observable behavior changes.
 */
class UpdateQuoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string'],
            'customer_name' => ['sometimes', 'string'],
            'quote_number' => ['sometimes', 'string'],
            'quote_data' => ['sometimes', 'array'],
        ];
    }

    /**
     * Present keys only — `only()` would silently inject nulls for absent ones.
     *
     * @return array<string,mixed>
     */
    public function changes(): array
    {
        $changes = [];

        foreach (['title', 'customer_name', 'quote_number', 'quote_data'] as $field) {
            if ($this->has($field)) {
                $changes[$field] = $this->input($field);
            }
        }

        return $changes;
    }
}
