<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Lenient by design: the current backend does no schema validation and returns
 * Arabic *business* errors (HTTP 200) for bad input. Strict 422 validation would
 * break that contract, so the service layer enforces semantics instead.
 */
class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'username' => ['nullable', 'string'],
            'password' => ['nullable', 'string'],
            'device_info' => ['nullable', 'string'],
            'device_id' => ['nullable', 'string'],
        ];
    }

    /** @return array<string,mixed> */
    public function payload(): array
    {
        return $this->only(['username', 'password', 'device_info', 'device_id']);
    }
}
