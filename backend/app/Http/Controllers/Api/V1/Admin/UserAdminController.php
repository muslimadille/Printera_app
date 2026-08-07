<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Http\Resources\AppUserResource;
use App\Models\AppUser;
use App\Services\AdminUserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Admin: account CRUD. Ports list/create/update/delete. [BE-041/042] */
class UserAdminController extends Controller
{
    public function __construct(private readonly AdminUserService $users) {}

    // GET /admin/users  [BE-041]
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'users' => $this->users->all()
                ->map(fn (AppUser $user) => AppUserResource::make($user)->withViewQuotesFlag()->resolve())
                ->all(),
        ]);
    }

    // POST /admin/users  [BE-041]
    public function store(StoreUserRequest $request): JsonResponse
    {
        $user = $this->users->create($request->payload());

        return response()->json(['user' => AppUserResource::make($user)->resolve()]);
    }

    // PATCH /admin/users/{id}  [BE-042]
    public function update(UpdateUserRequest $request, string $id): JsonResponse
    {
        $user = $this->users->update($this->users->findOrFail($id), $request->changes());

        return response()->json(['user' => AppUserResource::make($user)->resolve()]);
    }

    // DELETE /admin/users/{id}  [BE-042]
    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->users->delete($id);

        return response()->json(['success' => true]);
    }
}
