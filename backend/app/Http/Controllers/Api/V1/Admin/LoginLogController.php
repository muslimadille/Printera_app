<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\LoginLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Admin: recent login logs. Ports handleLoginLogs (index.ts:387-393). [BE-046] */
class LoginLogController extends Controller
{
    /** The reference's hard `.limit(100)`; newest first. */
    private const LIMIT = 100;

    // GET /admin/login-logs
    public function index(Request $request): JsonResponse
    {
        $logs = LoginLog::query()
            ->orderByDesc('logged_in_at')
            ->limit(self::LIMIT)
            ->get();

        return response()->json([
            'logs' => $logs->map(fn (LoginLog $log): array => [
                'id' => $log->id,
                'user_id' => $log->user_id,
                'username' => $log->username,
                'logged_in_at' => $log->logged_in_at?->toISOString(),
                'ip_address' => $log->ip_address,
            ])->all(),
        ]);
    }
}
