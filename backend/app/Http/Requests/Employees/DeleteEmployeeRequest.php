<?php

namespace App\Http\Requests\Employees;

use Illuminate\Foundation\Http\FormRequest;

/**
 * DELETE /employees/{id}?transfer_to=<id>.
 *
 * The spec puts `transfer_to` in the query string (03-API-SPECIFICATION.md §4) while the
 * current client sends it in a JSON body (`deleteEmployee(token, userId, transferTo)` in
 * src/lib/userApi.ts posts a single action envelope). Both are read: Laravel resolves
 * `input()` against the JSON payload when the request carries a JSON content type, which
 * would miss a query-string value entirely.
 */
class DeleteEmployeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'transfer_to' => ['sometimes', 'nullable', 'string'],
        ];
    }

    /**
     * Null when no transfer was asked for. The reference gates on truthiness
     * (`if (params.transfer_to)`), so an empty string means "no transfer", not "transfer
     * to nobody".
     */
    public function transferTo(): ?string
    {
        $value = $this->query('transfer_to') ?? $this->input('transfer_to');

        return is_string($value) && $value !== '' ? $value : null;
    }
}
