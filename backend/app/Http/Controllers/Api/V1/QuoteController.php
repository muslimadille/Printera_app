<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\NotImplemented;
use App\Http\Controllers\Controller;
use App\Http\Requests\Quotes\StoreQuoteRequest;
use App\Http\Requests\Quotes\UpdateQuoteRequest;
use App\Http\Resources\QuoteResource;
use App\Services\QuoteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Saved quotes (family-scoped). Ports save/update/delete/list_quotes + transfer. [BE-021..024] */
class QuoteController extends Controller
{
    use NotImplemented;

    public function __construct(private readonly QuoteService $quotes) {}

    // GET /quotes → { quotes, related_quotes }  [BE-022]
    public function index(Request $request): JsonResponse
    {
        return response()->json($this->quotes->listFor($this->currentUser($request)));
    }

    // POST /quotes  [BE-021]
    public function store(StoreQuoteRequest $request): JsonResponse
    {
        $quote = $this->quotes->create($this->currentUser($request), $request->payload());

        // 200, not 201 — the reference returns 200 and the SPA reads `data.quote`.
        return response()->json(['quote' => QuoteResource::make($quote)->resolve()]);
    }

    // PATCH /quotes/{id}  [BE-023]
    public function update(UpdateQuoteRequest $request, string $id): JsonResponse
    {
        $quote = $this->quotes->findInFamily($this->currentUser($request), $id);
        $quote = $this->quotes->update($quote, $request->changes());

        return response()->json(['quote' => QuoteResource::make($quote)->resolve()]);
    }

    // DELETE /quotes/{id}  [BE-023]
    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->quotes->findInFamily($this->currentUser($request), $id)->delete();

        return response()->json(['success' => true]);
    }

    public function transfer(Request $request): JsonResponse
    {
        return $this->todo('BE-024'); // POST /quotes/transfer
    }
}
