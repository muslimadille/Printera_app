<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\ActivityService;
use App\Support\Messages;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

/**
 * Batched activity logging. Ports log_activity_batch (index.ts:338-375). [BE-025]
 *
 * DELIBERATELY NOT behind the session.active middleware — see 03-API-SPECIFICATION.md §7.
 * The client flushes this queue from navigator.sendBeacon on page hide, where a 401 or an
 * exception would simply lose the batch with no chance to retry. The token is therefore
 * resolved softly, in-controller, and every outcome is HTTP 200 — matching the reference,
 * which is also 200-always.
 */
class ActivityController extends Controller
{
    public function __construct(private readonly ActivityService $activity) {}

    /**
     * sendBeacon cannot set an Authorization header, so the token travels in the JSON
     * body (as it does today). The bearer header is accepted too, for the fetch path and
     * for any future mobile client.
     */
    private function tokenFrom(Request $request): ?string
    {
        $fromBody = $request->input('session_token');

        if (is_string($fromBody) && $fromBody !== '') {
            return $fromBody;
        }

        return $request->bearerToken();
    }

    // POST /activity/batch
    public function batch(Request $request): JsonResponse
    {
        try {
            // Branch order is the reference's (index.ts:340-343): a missing token is
            // reported before the payload is inspected, but an empty batch short-circuits
            // to success WITHOUT validating the session.
            if ($this->tokenFrom($request) === null) {
                return response()->json(['error' => Messages::SESSION_INVALID, 'session_expired' => true]);
            }

            $events = $request->input('events');

            if (! is_array($events) || $events === []) {
                return response()->json(['success' => true, 'logged' => 0]);
            }

            $session = $this->activity->resolveSession($this->tokenFrom($request));

            if ($session === null) {
                return response()->json(['error' => Messages::SESSION_ENDED, 'session_expired' => true]);
            }

            return response()->json([
                'success' => true,
                'logged' => $this->activity->log($session, $events),
            ]);
        } catch (Throwable $e) {
            // Never surface a 5xx to a beacon. Log it and tell the client the batch was
            // dropped, exactly as index.ts:370-373 does.
            report($e);

            return response()->json(['success' => false, 'error' => Messages::ACTIVITY_LOG_FAILED]);
        }
    }
}
