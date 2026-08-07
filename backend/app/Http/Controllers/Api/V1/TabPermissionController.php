<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Employees\UpdateTabPermissionsRequest;
use App\Services\AdminUserService;
use App\Services\TabPermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Admin: any user's tab permissions. Ports handleGetTabPermissions /
 * handleUpdateTabPermissions (manage-users/index.ts:460-477). [BE-043]
 *
 * Byte-identical reads and writes to the account-owner endpoints (BE-035) — same service,
 * same opaque `tab_key`, same additive upsert. The only difference is the gate: role.admin
 * with no ownership scope, so an admin may edit any account including another tenant's
 * employee.
 */
class TabPermissionController extends Controller
{
    public function __construct(
        private readonly AdminUserService $users,
        private readonly TabPermissionService $tabs,
    ) {}

    // GET /admin/users/{id}/tab-permissions
    public function show(Request $request, string $id): JsonResponse
    {
        $user = $this->users->findOrFail($id);

        return response()->json(['permissions' => $this->tabs->listFor($user)]);
    }

    // PUT /admin/users/{id}/tab-permissions
    public function update(UpdateTabPermissionsRequest $request, string $id): JsonResponse
    {
        $this->tabs->upsertMany($this->users->findOrFail($id), $request->permissions());

        return response()->json(['success' => true]);
    }
}
