<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\NotImplemented;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Admin: any user's tab permissions. Ports get/update_tab_permissions. [BE-043] */
class TabPermissionController extends Controller
{
    use NotImplemented;

    public function show(Request $request, string $id): JsonResponse
    {
        return $this->todo('BE-043'); // GET /admin/users/{id}/tab-permissions
    }

    public function update(Request $request, string $id): JsonResponse
    {
        return $this->todo('BE-043'); // PUT /admin/users/{id}/tab-permissions
    }
}
