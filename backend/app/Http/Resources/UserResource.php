<?php

namespace App\Http\Resources;

use App\Models\AppUser;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The session-user shape returned to the SPA. MUST include parent_user_id (null
 * for admins/owners) so the client can distinguish roles after a refresh.
 *
 * @mixin AppUser
 */
class UserResource extends JsonResource
{
    /** @return array<string,mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'username' => $this->username,
            'is_admin' => (bool) $this->is_admin,
            'max_employees' => $this->max_employees ?? 0,
            'employees_can_view_quotes' => (bool) $this->employees_can_view_quotes,
            'parent_user_id' => $this->parent_user_id,
        ];
    }
}
