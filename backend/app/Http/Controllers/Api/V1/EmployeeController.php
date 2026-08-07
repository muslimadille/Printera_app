<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\NotImplemented;
use App\Http\Controllers\Controller;
use App\Http\Requests\Employees\DeleteEmployeeRequest;
use App\Http\Requests\Employees\StoreEmployeeRequest;
use App\Http\Requests\Employees\UpdateEmployeeRequest;
use App\Http\Requests\Employees\UpdateTabPermissionsRequest;
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

    // PATCH /employees/{id}  [BE-032]
    public function update(UpdateEmployeeRequest $request, string $id): JsonResponse
    {
        $employee = $this->employees->findOwnEmployee($this->currentUser($request), $id);
        $employee = $this->employees->update($employee, $request->changes());

        return response()->json(['employee' => AppUserResource::make($employee)->resolve()]);
    }

    // DELETE /employees/{id}?transfer_to=<id>  [BE-033]
    public function destroy(DeleteEmployeeRequest $request, string $id): JsonResponse
    {
        $owner = $this->currentUser($request);

        $this->employees->delete(
            $owner,
            $this->employees->findOwnEmployee($owner, $id),
            $request->transferTo(),
        );

        return response()->json(['success' => true]);
    }

    // GET /employees/{id}/quotes-count  [BE-034]
    public function quotesCount(Request $request, string $id): JsonResponse
    {
        $employee = $this->employees->findOwnEmployee($this->currentUser($request), $id);

        return response()->json(['count' => $this->employees->quoteCount($employee)]);
    }

    // GET /employees/{id}/tab-permissions  [BE-035]
    public function getTabPermissions(Request $request, string $id): JsonResponse
    {
        $employee = $this->employees->findOwnEmployee($this->currentUser($request), $id);

        return response()->json(['permissions' => $this->employees->tabPermissions($employee)]);
    }

    // PUT /employees/{id}/tab-permissions  [BE-035]
    public function updateTabPermissions(UpdateTabPermissionsRequest $request, string $id): JsonResponse
    {
        $employee = $this->employees->findOwnEmployee($this->currentUser($request), $id);

        $this->employees->upsertTabPermissions($employee, $request->permissions());

        return response()->json(['success' => true]);
    }

    public function toggleViewQuotes(Request $request): JsonResponse
    {
        return $this->todo('BE-036'); // POST /account/employees-view-quotes
    }
}
