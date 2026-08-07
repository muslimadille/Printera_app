<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Lenient by design, like the Auth requests: the reference performs no schema validation
 * and the values are opaque JSON. Semantics live in SettingService.
 */
class UpdateSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'user_id' => ['nullable', 'string'],
            'settings' => ['nullable', 'array'],
        ];
    }

    /** @return array<int,mixed> */
    public function settings(): array
    {
        $settings = $this->input('settings', []);

        return is_array($settings) ? $settings : [];
    }

    public function requestedUserId(): ?string
    {
        $id = $this->input('user_id');

        return is_string($id) && $id !== '' ? $id : null;
    }
}
