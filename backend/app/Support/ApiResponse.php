<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;

/**
 * Small helpers for the two success/error response shapes used across the API.
 * Business errors are usually thrown via ApiException; these helpers are for
 * inline returns where throwing would be awkward.
 */
final class ApiResponse
{
    /**
     * @param  array<string,mixed>  $data
     */
    public static function ok(array $data = [], int $status = 200): JsonResponse
    {
        return response()->json($data, $status);
    }

    /**
     * Business error: HTTP 200 with { error, ...extra }.
     *
     * @param  array<string,mixed>  $extra
     */
    public static function business(string $message, array $extra = []): JsonResponse
    {
        return response()->json(array_merge(['error' => $message], $extra), 200);
    }
}
