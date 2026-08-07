<?php

namespace App\Http\Requests\Employees;

use Illuminate\Foundation\Http\FormRequest;

/**
 * PATCH /employees/{id}. Mirrors index.ts:594-598 exactly, including its asymmetry:
 * username / is_active / max_devices are applied on `!== undefined` (presence), but
 * password is applied on truthiness — so an empty-string password is ignored rather than
 * hashed into an unusable credential.
 */
class UpdateEmployeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'username' => ['sometimes', 'string'],
            'is_active' => ['sometimes', 'boolean'],
            'max_devices' => ['sometimes', 'integer'],
            'password' => ['sometimes', 'nullable', 'string'],
        ];
    }

    /**
     * Present keys only. `password` stays raw here — EmployeeService hashes it, so the
     * plaintext never travels further than one call.
     *
     * @return array<string,mixed>
     */
    public function changes(): array
    {
        $changes = [];

        if ($this->has('username')) {
            $changes['username'] = (string) $this->input('username');
        }

        if ($this->has('is_active')) {
            $changes['is_active'] = $this->boolean('is_active');
        }

        if ($this->has('max_devices')) {
            $changes['max_devices'] = (int) $this->input('max_devices');
        }

        // Truthiness, not presence — see the class docblock.
        $password = $this->input('password');
        if (is_string($password) && $password !== '') {
            $changes['password'] = $password;
        }

        return $changes;
    }
}
