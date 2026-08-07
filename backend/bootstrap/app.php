<?php

use App\Exceptions\ApiException;
use App\Http\Middleware\EnsureAdmin;
use App\Http\Middleware\EnsureSessionActive;
use App\Support\Messages;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        apiPrefix: 'api',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Named middleware used by the /api/v1 route groups.
        $middleware->alias([
            'session.active' => EnsureSessionActive::class,
            'role.admin' => EnsureAdmin::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Business errors are control flow, not faults — logging every wrong password
        // would bury real errors.
        $exceptions->dontReport(ApiException::class);

        // Business/auth errors carry their own HTTP semantics (see ApiException).
        $exceptions->render(function (ApiException $e, Request $request) {
            return response()->json($e->payload(), $e->getStatusCode());
        });

        // Validation failures use the 200-error shape, NOT Laravel's 422 — see
        // 03-API-SPECIFICATION.md §1. The SPA renders `error` directly to an Arabic RTL
        // UI, so the user-facing string stays Arabic; the per-field English messages are
        // exposed under `errors` for debugging only (the client ignores unknown keys).
        $exceptions->render(function (ValidationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'error' => Messages::INCOMPLETE_DATA,
                    'errors' => $e->errors(),
                ], 200);
            }

            return null;
        });

        // A failed guard becomes the session-expired shape the SPA force-logs-out on,
        // instead of Laravel's default "Unauthenticated." body.
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'error' => Messages::SESSION_INVALID,
                    'session_expired' => true,
                ], 401);
            }

            return null;
        });

        // Any other uncaught throwable on an /api route becomes the standard Arabic
        // server-error body, matching the current edge function. Exceptions that carry
        // their own HTTP status (404, 405, 429, …) keep Laravel's handling.
        $exceptions->render(function (Throwable $e, Request $request) {
            if ($request->is('api/*') && ! $e instanceof HttpExceptionInterface) {
                return response()->json(['error' => Messages::SERVER_ERROR], 500);
            }

            return null; // fall through to default handling
        });
    })
    ->create();
