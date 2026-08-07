<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\ForceLoginRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\AppUser;
use App\Models\UserSession;
use App\Services\AuthService;
use App\Services\SessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Auth & session lifecycle. Ports: login, force_login, verify_session (→ me),
 * heartbeat, logout, change_password. See tickets BE-011..016 and 03-API-SPECIFICATION.md.
 */
class AuthController extends Controller
{
    public function __construct(
        private readonly AuthService $auth,
        private readonly SessionService $sessions,
    ) {}

    /** Client IP, matching the edge function order (x-forwarded-for → cf-connecting-ip). */
    private function clientIp(Request $request): ?string
    {
        $fwd = $request->header('x-forwarded-for');
        if ($fwd) {
            return trim(explode(',', $fwd)[0]);
        }

        return $request->header('cf-connecting-ip') ?: $request->ip();
    }

    // POST /auth/login  [BE-011]
    public function login(LoginRequest $request): JsonResponse
    {
        return response()->json(
            $this->auth->login($request->payload(), $this->clientIp($request))
        );
    }

    // POST /auth/force-login  [BE-012]
    public function forceLogin(ForceLoginRequest $request): JsonResponse
    {
        return response()->json(
            $this->auth->forceLogin($request->payload(), $this->clientIp($request))
        );
    }

    // GET /auth/me  (verify_session)  [BE-013]
    public function me(Request $request): JsonResponse
    {
        /** @var AppUser $user */
        $user = $request->attributes->get('app_user');
        /** @var UserSession $session */
        $session = $request->attributes->get('user_session');
        $prev = $request->attributes->get('prev_last_active_at');

        // Throttled heartbeat audit: at most once per 5 minutes per session.
        $prevMs = $prev ? $prev->getTimestamp() : 0;
        if (now()->getTimestamp() - $prevMs > 300) {
            $this->sessions->logEvent([
                'user_id' => $user->id,
                'username' => $user->username,
                'session_token' => $session->session_token,
                'device_id' => $session->device_id,
                'device_info' => $session->device_info,
                'ip_address' => $session->ip_address,
                'event_type' => 'heartbeat',
            ]);
        }

        return response()->json([
            'valid' => true,
            'user' => $this->auth->buildSessionUser($user),
            'tab_permissions' => $this->auth->tabPermissions($user),
        ]);
    }

    // POST /auth/logout  [BE-014]
    public function logout(Request $request): JsonResponse
    {
        /** @var AppUser $user */
        $user = $request->attributes->get('app_user');
        /** @var UserSession $session */
        $session = $request->attributes->get('user_session');

        $this->sessions->logEvent([
            'user_id' => $user->id,
            'username' => $user->username,
            'session_token' => $session->session_token,
            'device_id' => $session->device_id,
            'device_info' => $session->device_info,
            'ip_address' => $session->ip_address,
            'event_type' => 'logout',
        ]);

        $session->delete();

        return response()->json(['success' => true]);
    }

    // POST /auth/change-password  [BE-015]
    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        return response()->json($this->auth->changePassword($request->payload()));
    }
}
