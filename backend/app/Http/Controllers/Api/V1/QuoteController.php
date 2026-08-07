<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\NotImplemented;
use App\Http\Controllers\Controller;
use App\Http\Requests\Quotes\StoreQuoteRequest;
use App\Http\Resources\QuoteResource;
use App\Services\QuoteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Saved quotes (family-scoped). Ports save/update/delete/list_quotes + transfer. [BE-021..024] */
class QuoteController extends Controller
{
    use NotImplemented;

    public function __construct(private readonly QuoteService $quotes) {}

    public function index(Request $request): JsonResponse
    {
        return $this->todo('BE-022'); // GET /quotes → { quotes, related_quotes } (visibility matrix)
    }

    // POST /quotes  [BE-021]
    public function store(StoreQuoteRequest $request): JsonResponse
    {
        $quote = $this->quotes->create($this->currentUser($request), $request->payload());

        // 200, not 201 — the reference returns 200 and the SPA reads `data.quote`.
        return response()->json(['quote' => QuoteResource::make($quote)->resolve()]);
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
