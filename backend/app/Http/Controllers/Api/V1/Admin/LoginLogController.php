<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Concerns\NotImplemented;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Admin: recent login logs. Ports login_logs. [BE-046] */
class LoginLogController extends Controller
{
    use NotImplemented;

    public function index(Request $request): JsonResponse
    {
        return $this->todo('BE-046'); // GET /admin/login-logs (latest 100)
    }
}
