<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\NotImplemented;
use App\Http\Controllers\Controller;
use App\Http\Requests\Employees\StoreEmployeeRequest;
use App\Http\Resources\AppUserResource;
use App\Services\EmployeeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Account-owner employee management + tab permissions. [BE-030..036] */
class EmployeeController extends Controller
{
    use NotImplemented;

    public function __construct(private readonly EmployeeService $employees) {}

    // GET /employees  [BE-031]
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'employees' => AppUserResource::collection(
                $this->employees->listFor($this->currentUser($request))
            )->resolve(),
        ]);
    }

    // POST /employees  [BE-030]
    public function store(StoreEmployeeRequest $request): JsonResponse
    {
        $employee = $this->employees->create(
            $this->currentUser($request),
            $request->username(),
            $request->password(),
            $request->maxDevices(),
        );

        return response()->json(['employee' => AppUserResource::make($employee)->resolve()]);
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
