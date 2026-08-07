<?php

namespace App\Http\Requests\Employees;

use Illuminate\Foundation\Http\FormRequest;

/**
 * PUT /employees/{id}/tab-permissions.
 *
 * `present` rather than `required`: Laravel treats an empty array as absent for
 * `required`, and `{ "permissions": [] }` is a legitimate no-op the SPA can send.
 *
 * The entries themselves are not validated here. `tab_key` is opaque — it carries both
 * tab ids from src/lib/tabRegistry.ts and the special `default_tab:<key>` marker — so
 * shape checking belongs in EmployeeService, which skips unusable entries the way
 * SettingService does rather than failing the whole batch.
 */
class UpdateTabPermissionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'permissions' => ['present', 'array'],
        ];
    }

    /** @return array<int,mixed> */
    public function permissions(): array
    {
        $permissions = $this->input('permissions', []);

        return is_array($permissions) ? $permissions : [];
    }
}
