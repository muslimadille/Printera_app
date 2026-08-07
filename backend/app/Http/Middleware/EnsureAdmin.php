<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gate for /api/v1/admin/*. Requires an authenticated admin (JWT), replacing the
 * old per-request admin_username/admin_password pattern. Runs after session.active.
 */
class EnsureAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->attributes->get('app_user') ?? auth('api')->user();

        if (! $user || ! $user->is_admin) {
            throw ApiException::forbidden();
        }

        return $next($request);
    }
}
