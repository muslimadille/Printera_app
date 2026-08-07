<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use App\Models\AppUser;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gate for /api/v1/admin/*. Requires an authenticated admin, replacing the old
 * per-request admin_username/admin_password pattern (`verifyAdmin`,
 * manage-users/index.ts:40-52). Non-admin → 403 "غير مصرح", the same string the
 * reference returned for a non-admin username.
 *
 * The caller is read ONLY from the request attribute that EnsureSessionActive sets, so
 * this can never authorize a request that did not pass the session allow-list. An earlier
 * version fell back to `auth('api')->user()`, which resolves a caller straight from the
 * JWT: unreachable while the route group is ordered session.active → role.admin, but it
 * meant a revoked-yet-unexpired admin token would have satisfied the admin gate if that
 * order ever changed. Failing closed here costs nothing.
 */
class EnsureAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->attributes->get('app_user');

        if (! $user instanceof AppUser || ! $user->is_admin) {
            throw ApiException::forbidden();
        }

        return $next($request);
    }
}
