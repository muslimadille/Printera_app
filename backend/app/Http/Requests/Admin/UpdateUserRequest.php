<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * PATCH /admin/users/{id}. Mirrors handleUpdate (index.ts:432-439) including its
 * asymmetry: the six scalar fields are applied on presence (`!== undefined`), but
 * password on truthiness — so an empty-string password is ignored rather than hashed into
 * an unusable credential.
 *
 * Unlike PATCH /employees/{id}, this whitelist DOES include is_admin, expires_at and
 * max_employees: granting them is the platform operator's job, which is exactly why the
 * route sits behind role.admin.
 */
class UpdateUserRequest extends FormRequest
{
    /** Applied on presence, in the reference's order. */
    private const PRESENCE_FIELDS = [
        'username' => 'string',
        'is_active' => 'bool',
        'is_admin' => 'bool',
        'expires_at' => 'raw',
        'max_devices' => 'int',
        'max_employees' => 'int',
    ];

    public function authorize(): bool
    {
        return true;
    }

    /** An explicit `expires_at: ''` clears the subscription, as it does on create. */
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
            'username' => ['sometimes', 'string'],
            'is_active' => ['sometimes', 'boolean'],
            'is_admin' => ['sometimes', 'boolean'],
            'expires_at' => ['sometimes', 'nullable', 'date'],
            'max_devices' => ['sometimes', 'integer'],
            'max_employees' => ['sometimes', 'integer'],
            'password' => ['sometimes', 'nullable', 'string'],
        ];
    }

    /**
     * Present keys only. `password` stays raw — AdminUserService hashes it.
     *
     * @return array<string,mixed>
     */
    public function changes(): array
    {
        $changes = [];

        foreach (self::PRESENCE_FIELDS as $field => $type) {
            if (! $this->has($field)) {
                continue;
            }

            $changes[$field] = match ($type) {
                'bool' => $this->boolean($field),
                'int' => (int) $this->input($field),
                'string' => (string) $this->input($field),
                default => $this->input($field),
            };
        }

        // Truthiness, not presence — see the class docblock.
        $password = $this->input('password');
        if (is_string($password) && $password !== '') {
            $changes['password'] = $password;
        }

        return $changes;
    }
}
