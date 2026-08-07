<?php

use App\Models\AppUser;

return [

    /*
    |--------------------------------------------------------------------------
    | Authentication Defaults
    |--------------------------------------------------------------------------
    |
    | The API is stateless and JWT-based. The default guard is the JWT `api`
    | guard; there is no web/session guard for this backend.
    |
    */

    'defaults' => [
        'guard' => 'api',
        'passwords' => 'app_users',
    ],

    /*
    |--------------------------------------------------------------------------
    | Authentication Guards
    |--------------------------------------------------------------------------
    |
    | `api` uses the jwt driver (php-open-source-saver/jwt-auth). Revocation is
    | enforced separately by the EnsureSessionActive middleware, which checks the
    | token's `jti` against the user_sessions allow-list.
    |
    */

    'guards' => [
        'api' => [
            'driver' => 'jwt',
            'provider' => 'app_users',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | User Providers
    |--------------------------------------------------------------------------
    |
    | Identities live in `app_users` (custom auth — NOT Laravel's default users
    | table). Passwords are stored in `password_hash` (bcrypt, legacy SHA-256
    | auto-migrated on login).
    |
    */

    'providers' => [
        'app_users' => [
            'driver' => 'eloquent',
            'model' => AppUser::class,
        ],
    ],

    // No email-based password resets by product decision (username-only identity).
    // Admin/owner resets a password via the admin/employee endpoints instead.
    'passwords' => [],

    'password_timeout' => 10800,
];
