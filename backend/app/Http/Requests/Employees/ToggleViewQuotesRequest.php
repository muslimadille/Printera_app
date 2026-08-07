<?php

namespace App\Http\Requests\Employees;

use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /account/employees-view-quotes.
 *
 * `enabled` is required. The reference passes it straight into the update, where
 * supabase-js strips an undefined and the call degenerates into a no-op that reports the
 * unchanged value — a silent success for a request that asked for nothing. The SPA always
 * sends a boolean (`toggleEmployeesViewQuotes(token, enabled)`), so requiring it costs
 * nothing and turns that case into the standard 200 INCOMPLETE_DATA body.
 */
class ToggleViewQuotesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'enabled' => ['required', 'boolean'],
        ];
    }

    public function enabled(): bool
    {
        return $this->boolean('enabled');
    }
}
