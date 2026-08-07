<?php

namespace App\Http\Requests\Employees;

use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /employees. The reference validates nothing — a missing username hits the NOT NULL
 * constraint and surfaces as a raw driver message, a missing password reaches bcrypt and
 * becomes a 500. Requiring both turns those into the standard 200 INCOMPLETE_DATA body.
 * See PHASE-0-1-AUDIT.md §7 (Phase 3) for the branch-order note this implies.
 */
class StoreEmployeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
            'max_devices' => ['sometimes', 'nullable', 'integer'],
        ];
    }

    public function username(): string
    {
        return (string) $this->input('username');
    }

    public function password(): string
    {
        return (string) $this->input('password');
    }

    /**
     * The reference writes `max_devices: params.max_devices || 1` — JS falsy-coalescing, so
     * 0 (and null, and an absent key) all become 1. PHP's `??` would have kept the 0.
     */
    public function maxDevices(): int
    {
        $value = $this->input('max_devices');

        return is_numeric($value) && (int) $value !== 0 ? (int) $value : 1;
    }
}
