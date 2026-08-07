<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Http\JsonResponse;

/**
 * Scaffold placeholder. Phase 2–5 endpoints are wired in routes/api.php but their
 * handlers are implemented in later tickets. Each stub points at its ticket so the
 * executor knows exactly what to build. Remove the trait usage as each is implemented.
 */
trait NotImplemented
{
    protected function todo(string $ticket): JsonResponse
    {
        return response()->json([
            'error' => 'not_implemented',
            'ticket' => $ticket,
            'message' => "Endpoint pending implementation — see docs/backend-laravel ticket {$ticket}.",
        ], 501);
    }
}
