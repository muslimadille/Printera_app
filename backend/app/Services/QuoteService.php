<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Http\Resources\QuoteResource;
use App\Models\AppUser;
use App\Models\SavedQuote;
use App\Support\Messages;
use Illuminate\Support\Collection;

/**
 * Saved quotes. Ports handleSaveQuote / handleListQuotes / handleUpdateQuote /
 * handleDeleteQuote / handleTransferQuotes (manage-users/index.ts:694-816, 619-643).
 *
 * `quote_data` is OPAQUE — stored and returned byte-for-byte, never reshaped.
 */
class QuoteService
{
    /**
     * JS `a || b` semantics: the reference writes `title || ''` and
     * `source_type || 'calculator'`, so an empty string falls through to the default.
     * PHP's `??` would keep the empty string, which is a different observable result.
     */
    private function orDefault(mixed $value, string $default): string
    {
        return is_string($value) && $value !== '' ? $value : $default;
    }

    // ── BE-021 · create ──────────────────────────────────────────────────────

    /** @param  array<string,mixed>  $params */
    public function create(AppUser $user, array $params): SavedQuote
    {
        return $user->quotes()->create([
            'title' => $this->orDefault($params['title'] ?? null, ''),
            'customer_name' => $this->orDefault($params['customer_name'] ?? null, ''),
            'quote_number' => $this->orDefault($params['quote_number'] ?? null, ''),
            'source_type' => $this->orDefault($params['source_type'] ?? null, 'calculator'),
            'quote_data' => $params['quote_data'] ?? [],
        ]);
    }

    // ── BE-022 · list + family visibility ────────────────────────────────────

    /**
     * Attach the display tags used by `related_quotes`. These are transient attributes on
     * an unsaved model — QuoteResource reads them and they are never persisted.
     */
    private function tag(SavedQuote $quote, ?string $username, bool $isParentQuote = false): SavedQuote
    {
        $quote->employee_username = $username;

        if ($isParentQuote) {
            $quote->is_parent_quote = true;
        }

        return $quote;
    }

    /** @return Collection<int,SavedQuote> newest first */
    private function quotesOf(iterable $userIds): Collection
    {
        return SavedQuote::query()
            ->whereIn('user_id', $userIds)
            ->orderByDesc('created_at')
            ->get();
    }

    /**
     * The family visibility matrix, ported from handleListQuotes
     * (manage-users/index.ts:762-816). The ordering of `related_quotes` is part of the
     * contract: the owner's own quotes come first, then siblings.
     *
     *  caller is owner/admin (parent_user_id === null)
     *      related = every employee's quotes, tagged employee_username
     *
     *  caller is an employee
     *      related = parent's quotes  ONLY IF parent.employees_can_view_quotes,
     *                tagged employee_username = parent.username AND is_parent_quote
     *              + every sibling's quotes, tagged employee_username
     *                (siblings are ALWAYS mutually visible — no flag gates this)
     *
     * @return array{quotes:array<int,array<string,mixed>>,related_quotes:array<int,array<string,mixed>>}
     */
    public function listFor(AppUser $caller): array
    {
        $own = SavedQuote::query()
            ->where('user_id', $caller->id)
            ->orderByDesc('created_at')
            ->get();

        /** @var Collection<int,SavedQuote> $related */
        $related = new Collection;

        if ($caller->parent_user_id === null) {
            // Owner (or admin): every employee's quotes.
            $employees = AppUser::query()
                ->where('parent_user_id', $caller->id)
                ->get(['id', 'username'])
                ->keyBy('id');

            if ($employees->isNotEmpty()) {
                $related = $this->quotesOf($employees->keys())
                    ->map(fn (SavedQuote $q) => $this->tag($q, $employees[$q->user_id]?->username));
            }
        } else {
            $parent = AppUser::query()->find($caller->parent_user_id);

            // An orphaned employee (parent deleted) simply sees nothing related. The FK
            // cascades, so this is defensive only — but the reference guards it too.
            if ($parent !== null) {
                if ($parent->employees_can_view_quotes) {
                    $related = $related->concat(
                        $this->quotesOf([$parent->id])
                            ->map(fn (SavedQuote $q) => $this->tag($q, $parent->username, true))
                    );
                }

                $siblings = AppUser::query()
                    ->where('parent_user_id', $parent->id)
                    ->where('id', '!=', $caller->id)
                    ->get(['id', 'username'])
                    ->keyBy('id');

                if ($siblings->isNotEmpty()) {
                    $related = $related->concat(
                        $this->quotesOf($siblings->keys())
                            ->map(fn (SavedQuote $q) => $this->tag($q, $siblings[$q->user_id]?->username))
                    );
                }
            }
        }

        return [
            'quotes' => $own->map(fn (SavedQuote $q) => QuoteResource::make($q)->resolve())->all(),
            'related_quotes' => $related->map(fn (SavedQuote $q) => QuoteResource::make($q)->resolve())->values()->all(),
        ];
    }

    // ── BE-023 · update / delete (family gate) ───────────────────────────────

    /**
     * Resolve a quote the caller is allowed to mutate. Branch order is the reference's
     * (index.ts:730-733): existence first, then family membership — so probing for a
     * foreign quote id returns 404 "not found", never a 403 that would confirm it exists.
     */
    public function findInFamily(AppUser $caller, string $quoteId): SavedQuote
    {
        $quote = SavedQuote::query()->find($quoteId);

        if ($quote === null) {
            throw new ApiException(Messages::QUOTE_NOT_FOUND, 404);
        }

        if (! in_array($quote->user_id, $caller->familyIds(), true)) {
            throw ApiException::forbidden(Messages::NOT_AUTHORIZED);
        }

        return $quote;
    }

    /**
     * Only keys actually present in the request are applied — the reference tests
     * `params.x !== undefined`. `updated_at` is always touched, even when nothing else
     * changed, matching index.ts:740.
     *
     * @param  array<string,mixed>  $changes
     */
    public function update(SavedQuote $quote, array $changes): SavedQuote
    {
        $quote->fill($changes);
        $quote->updated_at = now();
        $quote->save();

        return $quote->refresh();
    }

    // ── BE-024 · transfer (owner-scoped) ─────────────────────────────────────

    /**
     * Each id must be the caller itself or an employee OF THE CALLER
     * (`parent_user_id = caller.id`) — index.ts:626-635. Note this is narrower than
     * familyIds(): an employee has no employees, so an employee can only ever transfer
     * from itself to itself.
     */
    private function assertTransferParticipant(AppUser $caller, ?string $userId): void
    {
        if ($userId === null || $userId === '') {
            throw ApiException::forbidden(Messages::NOT_AUTHORIZED);
        }

        if ($userId === $caller->id) {
            return;
        }

        $isOwnEmployee = AppUser::query()
            ->where('id', $userId)
            ->where('parent_user_id', $caller->id)
            ->exists();

        if (! $isOwnEmployee) {
            throw ApiException::forbidden(Messages::NOT_AUTHORIZED);
        }
    }

    /** @return int rows moved */
    public function transfer(AppUser $caller, ?string $fromUserId, ?string $toUserId): int
    {
        $this->assertTransferParticipant($caller, $fromUserId);
        $this->assertTransferParticipant($caller, $toUserId);

        return SavedQuote::query()
            ->where('user_id', $fromUserId)
            ->update(['user_id' => $toUserId, 'updated_at' => now()]);
    }
}
