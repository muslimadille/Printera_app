<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserSessionResource;
use App\Models\UserSession;
use App\Services\AdminUserService;
use App\Services\SessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Admin: list/terminate any user's sessions. Ports handleGetSessions /
 * handleTerminateSession (manage-users/index.ts:516-530). [BE-044/045]
 */
class SessionAdminController extends Controller
{
    public function __construct(
        private readonly AdminUserService $users,
        private readonly SessionService $sessions,
    ) {}

    // GET /admin/users/{id}/sessions  [BE-044]
    public function index(Request $request, string $id): JsonResponse
    {
        $user = $this->users->findOrFail($id);

        return response()->json([
            'sessions' => UserSessionResource::collection($this->sessions->activeSessions($user))->resolve(),
        ]);
    }

    /**
     * DELETE /admin/sessions/{sessionId}  [BE-045]
     *
     * Deleting the row revokes the JWT: EnsureSessionActive can no longer find the `jti`
     * in the allow-list, so the terminated device is logged out on its very next request.
     *
     * Idempotent, like the reference — terminating an already-gone session is a success,
     * since the postcondition holds either way.
     */
    public function destroy(Request $request, string $sessionId): JsonResponse
    {
        $session = UserSession::query()->with('user')->find($sessionId);

        if ($session !== null) {
            // 04-ADMIN-CONTROL-PANEL-SPEC.md §5 sanctions this ("optionally log
            // auto_logout"); the reference does not write it. Without a record, an
            // admin-killed session is indistinguishable in analytics from a user who
            // simply closed their laptop. The session_token is carried so the event
            // closes out the real session summary instead of landing in a synthetic
            // `__nokey_` bucket — see AnalyticsService.
            $this->sessions->logEvent([
                'user_id' => $session->user_id,
                'username' => $session->user?->username ?? '',
                'session_token' => $session->session_token,
                'device_id' => $session->device_id,
                'device_info' => $session->device_info,
                'ip_address' => $session->ip_address,
                'event_type' => 'auto_logout',
            ]);

            $session->delete();
        }

        return response()->json(['success' => true]);
    }
}
