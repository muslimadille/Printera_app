<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use App\Models\UserSession;
use App\Support\Messages;
use Closure;
use Illuminate\Http\Request;
use PHPOpenSourceSaver\JWTAuth\Exceptions\JWTException;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Validates the JWT AND enforces the revocable session allow-list.
 *
 * The JWT `jti` equals a user_sessions.session_token. If the row is gone (logout,
 * admin terminate, force-login, change-password), the token is revoked → 401
 * session_expired. Also blocks disabled accounts and refreshes activity.
 *
 * Deliberately does NOT check `expires_at`: handleVerifySession in the current edge
 * function checks only is_active, so an expired subscription keeps working until the
 * user logs out. Only `login` rejects an expired account. Adding a check here would
 * change observable behavior in both directions — see PHASE-0-1-AUDIT.md F10 and
 * 03-API-SPECIFICATION.md §Auth.
 */
class EnsureSessionActive
{
    public function handle(Request $request, Closure $next): Response
    {
        try {
            $token = JWTAuth::parseToken();
            $payload = $token->getPayload();
            // Inside the try: authenticate() throws UserNotDefinedException (a
            // JWTException) when the subject no longer exists, which would otherwise
            // escape as a generic 500 instead of 401 session_expired.
            $user = $token->authenticate();
        } catch (JWTException) {
            throw ApiException::sessionExpired();
        }

        $jti = (string) $payload->get('jti');
        if ($jti === '' || ! $user) {
            throw ApiException::sessionExpired();
        }

        // Scoped by user_id as well as the token: the session row and the user are
        // resolved from two independent claims, and binding them here means a future
        // token-issuance bug fails closed instead of confusing two tenants' sessions.
        $session = UserSession::query()
            ->where('session_token', $jti)
            ->where('user_id', $user->getKey())
            ->first();

        if (! $session) {
            // Row removed → token revoked.
            throw ApiException::sessionExpired(Messages::SESSION_ENDED);
        }

        if (! $user->is_active) {
            throw ApiException::sessionExpired(Messages::ACCOUNT_DISABLED);
        }

        // Preserve the previous activity time so the controller can throttle the
        // heartbeat audit event (≤ once / 5 min), then refresh it.
        $prevActive = $session->last_active_at;
        $session->last_active_at = now();
        $session->save();

        // Make the user + session available to controllers.
        auth('api')->setUser($user);
        $request->attributes->set('app_user', $user);
        $request->attributes->set('user_session', $session);
        $request->attributes->set('prev_last_active_at', $prevActive);

        return $next($request);
    }
}
