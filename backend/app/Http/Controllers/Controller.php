<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\AppUser;
use App\Models\UserSession;
use Illuminate\Http\Request;

abstract class Controller
{
    /**
     * The caller, as resolved by the session.active middleware.
     *
     * Always derive identity from the JWT — never from a body/query `user_id`. The
     * reference edge function ran with the service-role key and re-read the session on
     * every action; here the middleware has already done that and stashed the result.
     */
    protected function currentUser(Request $request): AppUser
    {
        $user = $request->attributes->get('app_user');

        if (! $user instanceof AppUser) {
            // Only reachable if a route is registered outside the session.active group.
            throw ApiException::sessionExpired();
        }

        return $user;
    }

    /** The caller's session row (its `session_token` is the JWT `jti`). */
    protected function currentSession(Request $request): UserSession
    {
        $session = $request->attributes->get('user_session');

        if (! $session instanceof UserSession) {
            throw ApiException::sessionExpired();
        }

        return $session;
    }
}
