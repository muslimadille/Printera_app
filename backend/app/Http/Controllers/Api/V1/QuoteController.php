<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\NotImplemented;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Saved quotes (family-scoped). Ports save/update/delete/list_quotes + transfer. [BE-021..024] */
class QuoteController extends Controller
{
    use NotImplemented;

    public function index(Request $request): JsonResponse
    {
        return $this->todo('BE-022'); // GET /quotes → { quotes, related_quotes } (visibility matrix)
    }

    public function store(Request $request): JsonResponse
    {
        return $this->todo('BE-021'); // POST /quotes
    }

    public function update(Request $request, string $id): JsonResponse
    {
        return $this->todo('BE-023'); // PATCH /quotes/{id}
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        return $this->todo('BE-023'); // DELETE /quotes/{id}
    }

    public function transfer(Request $request): JsonResponse
    {
        return $this->todo('BE-024'); // POST /quotes/transfer
    }
}
