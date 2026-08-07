<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\AnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Admin: per-user usage analytics. Ports get_user_analytics. [BE-046] */
class AnalyticsController extends Controller
{
    public function __construct(private readonly AnalyticsService $analytics) {}

    /**
     * GET /admin/analytics?user_id=&limit_users=
     *
     * `user_id` narrows to one account. An id that matches nothing returns an empty list
     * rather than an error — this is a collection endpoint, and it is what the reference
     * does (index.ts:1017).
     *
     * `limit_users` is the reference's flag for "I am listing every user, keep the payload
     * small": it caps sessions per user at 50 instead of 200. Nothing in the current SPA
     * sends it.
     */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->query('user_id');

        return response()->json([
            'analytics' => $this->analytics->forUsers(
                is_string($userId) && $userId !== '' ? $userId : null,
                $request->boolean('limit_users'),
            ),
        ]);
    }
}
