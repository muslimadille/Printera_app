<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Concerns\NotImplemented;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Admin: account CRUD. Ports list/create/update/delete. [BE-041/042] */
class UserAdminController extends Controller
{
    use NotImplemented;

    public function index(Request $request): JsonResponse
    {
        return $this->todo('BE-041'); // GET /admin/users
    }

    public function store(Request $request): JsonResponse
    {
        return $this->todo('BE-041'); // POST /admin/users (+ default tab perms)
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
