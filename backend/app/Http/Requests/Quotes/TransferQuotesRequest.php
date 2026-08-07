<?php

namespace App\Http\Requests\Quotes;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Lenient like the rest: a missing or foreign id is an authorization decision made in
 * QuoteService (403 "غير مصرح"), not a validation error, matching handleTransferQuotes.
 */
class TransferQuotesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'from_user_id' => ['nullable', 'string'],
            'to_user_id' => ['nullable', 'string'],
        ];
    }

    public function fromUserId(): ?string
    {
        $id = $this->input('from_user_id');

        return is_string($id) && $id !== '' ? $id : null;
    }

    public function toUserId(): ?string
    {
        $id = $this->input('to_user_id');

        return is_string($id) && $id !== '' ? $id : null;
    }
}
