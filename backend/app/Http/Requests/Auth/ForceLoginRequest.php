<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class ForceLoginRequest extends FormRequest
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
            'terminate_session_ids' => ['nullable', 'array'],
            'terminate_session_ids.*' => ['string'],
        ];
    }

    /** @return array<string,mixed> */
    public function payload(): array
    {
        return $this->only([
            'username', 'password', 'device_info', 'device_id', 'terminate_session_ids',
        ]);
    }
}
