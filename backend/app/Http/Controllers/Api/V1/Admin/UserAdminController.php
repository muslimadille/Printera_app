<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Concerns\NotImplemented;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Resources\AppUserResource;
use App\Models\AppUser;
use App\Services\AdminUserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Admin: account CRUD. Ports list/create/update/delete. [BE-041/042] */
class UserAdminController extends Controller
{
    use NotImplemented;

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

    public function update(Request $request, string $id): JsonResponse
    {
        return $this->todo('BE-042'); // PATCH /admin/users/{id}
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        return $this->todo('BE-042'); // DELETE /admin/users/{id}
    }
}
