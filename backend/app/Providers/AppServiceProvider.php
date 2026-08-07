<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Throttle sensitive auth endpoints (new hardening — not in the old function).
        // Applied in routes via ->middleware('throttle:auth') if desired.
        RateLimiter::for('auth', function (Request $request) {
            $key = (string) ($request->input('username') ?? $request->ip());

            return [
                Limit::perMinute(10)->by($key),
                Limit::perMinute(30)->by($request->ip()),
            ];
        });
    }
}
