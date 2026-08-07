<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\NotImplemented;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Account-owner employee management + tab permissions. [BE-030..036] */
class EmployeeController extends Controller
{
    use NotImplemented;

    public function index(Request $request): JsonResponse
    {
        return $this->todo('BE-031'); // GET /employees
    }

    public function store(Request $request): JsonResponse
    {
        return $this->todo('BE-030'); // POST /employees (cap + inherit tab perms)
    }

    public function update(Request $request, string $id): JsonResponse
    {
        return $this->todo('BE-032'); // PATCH /employees/{id}
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        return $this->todo('BE-033'); // DELETE /employees/{id}?transfer_to=
    }

    public function quotesCount(Request $request, string $id): JsonResponse
    {
        return $this->todo('BE-034'); // GET /employees/{id}/quotes-count
    }

    public function getTabPermissions(Request $request, string $id): JsonResponse
    {
        return $this->todo('BE-035'); // GET /employees/{id}/tab-permissions
    }

    public function updateTabPermissions(Request $request, string $id): JsonResponse
    {
        return $this->todo('BE-035'); // PUT /employees/{id}/tab-permissions
    }

    public function toggleViewQuotes(Request $request): JsonResponse
    {
        return $this->todo('BE-036'); // POST /account/employees-view-quotes
    }
}
