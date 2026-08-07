<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Lenient: the length/differ/incomplete checks return Arabic business errors
 * (HTTP 200) and are enforced in AuthService::changePassword, matching the
 * current edge function exactly.
 */
class ChangePasswordRequest extends FormRequest
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
            'old_password' => ['nullable', 'string'],
            'new_password' => ['nullable', 'string'],
        ];
    }

    /** @return array<string,mixed> */
    public function payload(): array
    {
        return $this->only(['username', 'old_password', 'new_password']);
    }
}
