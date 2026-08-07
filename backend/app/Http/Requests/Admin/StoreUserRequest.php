<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /admin/users. Defaults reproduce handleCreate's JS falsy-coalescing
 * (index.ts:400-406): `is_admin || false`, `expires_at || null`, `max_devices || 2`,
 * `max_employees || 0` — so a 0 for max_devices becomes 2, where PHP's `??` would keep it.
 */
class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * `expires_at: ''` means "no expiry" under `||`, but an empty string fails the `date`
     * rule. Normalise before validation so both intents survive.
     */
    protected function prepareForValidation(): void
    {
        if ($this->input('expires_at') === '') {
            $this->merge(['expires_at' => null]);
        }
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
            'is_admin' => ['sometimes', 'boolean'],
            'expires_at' => ['sometimes', 'nullable', 'date'],
            'max_devices' => ['sometimes', 'nullable', 'integer'],
            'max_employees' => ['sometimes', 'nullable', 'integer'],
        ];
    }

    /** @return array{username:string,password:string,is_admin:bool,expires_at:?string,max_devices:int,max_employees:int} */
    public function payload(): array
    {
        return [
            'username' => (string) $this->input('username'),
            'password' => (string) $this->input('password'),
            'is_admin' => $this->boolean('is_admin'),
            'expires_at' => $this->input('expires_at') ?: null,
            'max_devices' => $this->intOrDefault('max_devices', 2),
            'max_employees' => $this->intOrDefault('max_employees', 0),
        ];
    }

    /** JS `value || $default`: absent, null and 0 all fall through to the default. */
    private function intOrDefault(string $key, int $default): int
    {
        $value = $this->input($key);

        return is_numeric($value) && (int) $value !== 0 ? (int) $value : $default;
    }
}
