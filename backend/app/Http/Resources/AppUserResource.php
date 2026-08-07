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
    /**
     * Declared (not magic) so it resolves as a real property inside toArray() rather than
     * being forwarded to the wrapped model by JsonResource::__get().
     */
    private bool $withViewQuotesFlag = false;

    /**
     * Append `employees_can_view_quotes`. Only `GET /admin/users` does this — handleList
     * (index.ts:380) is the single reference select that includes the column, while
     * create/update return the plain shape. See 04-ADMIN-CONTROL-PANEL-SPEC.md §4.1.
     */
    public function withViewQuotesFlag(): static
    {
        $this->withViewQuotesFlag = true;

        return $this;
    }

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

            // Last, matching the reference's column order.
            $this->mergeWhen($this->withViewQuotesFlag, fn () => [
                'employees_can_view_quotes' => (bool) $this->employees_can_view_quotes,
            ]),
        ];
    }
}
