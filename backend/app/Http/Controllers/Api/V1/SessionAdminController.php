<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\NotImplemented;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Admin: list/terminate any user's sessions. Ports get_sessions/terminate_session. [BE-044/045] */
class SessionAdminController extends Controller
{
    use NotImplemented;

    public function index(Request $request, string $id): JsonResponse
    {
        return $this->todo('BE-044'); // GET /admin/users/{id}/sessions
    }

    public function destroy(Request $request, string $sessionId): JsonResponse
    {
        return $this->todo('BE-045'); // DELETE /admin/sessions/{sessionId}
    }
}
