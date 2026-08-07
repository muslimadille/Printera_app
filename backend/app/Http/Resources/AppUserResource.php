<?php

namespace App\Http\Resources;

use App\Models\AppUser;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The `AppUser` shape used by employee and (later) admin user CRUD —
 * 03-API-SPECIFICATION.md §10. It is exactly the column list the reference selects on
 * every one of those actions:
 *
 *   .select("id, username, is_active, is_admin, expires_at, created_at,
 *            max_devices, max_employees, parent_user_id")
 *
 * Distinct from UserResource, which is the *session* user returned by login//auth/me and
 * carries employees_can_view_quotes instead of the administrative columns. Do not merge
 * them: the SPA's AppUser and the session-user object are different TypeScript types
 * (src/lib/userApi.ts).
 *
 * @mixin AppUser
 */
class AppUserResource extends JsonResource
{
    /** @return array<string,mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'username' => $this->username,
            'is_active' => (bool) $this->is_active,
            'is_admin' => (bool) $this->is_admin,
            'expires_at' => $this->expires_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
            'max_devices' => (int) $this->max_devices,
            'max_employees' => (int) $this->max_employees,
            'parent_user_id' => $this->parent_user_id,
        ];
    }
}
