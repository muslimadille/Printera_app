<?php

namespace App\Http\Resources;

use App\Models\UserSession;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A device session row, as the admin panel lists it —
 * 04-ADMIN-CONTROL-PANEL-SPEC.md §4.2. The reference selects `*` (index.ts:518-520),
 * which is exactly these eight columns.
 *
 * `session_token` is included deliberately: it is the JWT `jti`, not a bearer credential —
 * nothing can be signed with it — and the SPA shows it to correlate a row with the
 * analytics session summaries. The row `id` is what DELETE /admin/sessions/{id} takes.
 *
 * @mixin UserSession
 */
class UserSessionResource extends JsonResource
{
    /** @return array<string,mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'session_token' => $this->session_token,
            'device_id' => $this->device_id,
            'device_info' => $this->device_info,
            'ip_address' => $this->ip_address,
            'last_active_at' => $this->last_active_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
