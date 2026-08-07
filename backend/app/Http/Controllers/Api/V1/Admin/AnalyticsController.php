<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Concerns\NotImplemented;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Admin: per-user usage analytics. Ports get_user_analytics. [BE-046] */
class AnalyticsController extends Controller
{
    use NotImplemented;

    public function index(Request $request): JsonResponse
    {
        return $this->todo('BE-046'); // GET /admin/analytics?user_id=
    }
}
