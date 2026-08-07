<?php

namespace Tests\Feature;

use App\Models\AppUser;
use App\Models\SavedQuote;
use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-023 — PATCH/DELETE /quotes/{id}. Ports handleUpdateQuote / handleDeleteQuote
 * (manage-users/index.ts:725-759) and the getFamilyUserIds gate (713-722).
 */
class QuoteMutationTest extends TestCase
{
    use MakesUsers, RefreshDatabase;

    private AppUser $owner;

    private AppUser $employeeA;

    private AppUser $employeeB;

    private AppUser $outsider;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = $this->makeUser(['username' => 'owner', 'max_devices' => 5]);
        $this->employeeA = $this->makeUser(['username' => 'empA', 'parent_user_id' => $this->owner->id, 'max_devices' => 5]);
        $this->employeeB = $this->makeUser(['username' => 'empB', 'parent_user_id' => $this->owner->id, 'max_devices' => 5]);
        $this->outsider = $this->makeUser(['username' => 'outsider', 'max_devices' => 5]);
    }

    /** @return array<string,string> */
    private function authAs(AppUser $user): array
    {
        return $this->bearer(
            $this->login(['username' => $user->username, 'device_id' => 'dev-'.$user->username])->json('session_token')
        );
    }

    private function quoteFor(AppUser $user): SavedQuote
    {
        return $user->quotes()->create([
            'title' => "{$user->username}-quote",
            'customer_name' => 'عميل',
            'quote_number' => 'Q-1',
            'quote_data' => ['v' => 1],
        ]);
    }

    // ── update ───────────────────────────────────────────────────────────────

    public function test_owner_can_update_own_quote(): void
    {
        $quote = $this->quoteFor($this->owner);

        $this->patchJson("/api/v1/quotes/{$quote->id}", [
            'title' => 'محدّث',
            'quote_data' => ['v' => 2],
        ], $this->authAs($this->owner))
            ->assertOk()
            ->assertJson(['quote' => ['id' => $quote->id, 'title' => 'محدّث', 'quote_data' => ['v' => 2]]]);
    }

    public function test_only_supplied_fields_change(): void
    {
        $quote = $this->quoteFor($this->owner);

        $this->patchJson("/api/v1/quotes/{$quote->id}", ['title' => 'only title'], $this->authAs($this->owner))
            ->assertOk();

        $fresh = $quote->fresh();
        $this->assertSame('only title', $fresh->title);
        $this->assertSame('عميل', $fresh->customer_name);
        $this->assertSame('Q-1', $fresh->quote_number);
        $this->assertSame(['v' => 1], $fresh->quote_data);
    }

    public function test_updated_at_is_touched_even_with_an_empty_patch(): void
    {
        // The reference always writes updated_at (index.ts:740); Eloquent would skip the
        // write entirely when nothing is dirty.
        $quote = $this->quoteFor($this->owner);
        $quote->forceFill(['updated_at' => now()->subDays(5)])->save();
        $before = $quote->fresh()->updated_at;

        $this->patchJson("/api/v1/quotes/{$quote->id}", [], $this->authAs($this->owner))->assertOk();

        $this->assertTrue($quote->fresh()->updated_at->greaterThan($before));
    }

    public function test_owner_can_update_an_employees_quote(): void
    {
        $quote = $this->quoteFor($this->employeeA);

        $this->patchJson("/api/v1/quotes/{$quote->id}", ['title' => 'by owner'], $this->authAs($this->owner))
            ->assertOk();

        $this->assertSame('by owner', $quote->fresh()->title);
        // Ownership does not move on update.
        $this->assertSame($this->employeeA->id, $quote->fresh()->user_id);
    }

    public function test_employee_can_update_a_siblings_quote(): void
    {
        // familyIds() = owner + all of the owner's employees, so siblings are mutable by
        // each other — the same rule the reference applies.
        $quote = $this->quoteFor($this->employeeB);

        $this->patchJson("/api/v1/quotes/{$quote->id}", ['title' => 'by sibling'], $this->authAs($this->employeeA))
            ->assertOk();

        $this->assertSame('by sibling', $quote->fresh()->title);
    }

    public function test_employee_can_update_the_owners_quote(): void
    {
        // Note: mutation is NOT gated by employees_can_view_quotes — that flag only
        // affects listing. Faithful to the reference.
        $quote = $this->quoteFor($this->owner);

        $this->patchJson("/api/v1/quotes/{$quote->id}", ['title' => 'by employee'], $this->authAs($this->employeeA))
            ->assertOk();

        $this->assertSame('by employee', $quote->fresh()->title);
    }

    public function test_updating_a_foreign_tenants_quote_is_forbidden(): void
    {
        $quote = $this->quoteFor($this->outsider);

        $this->patchJson("/api/v1/quotes/{$quote->id}", ['title' => 'stolen'], $this->authAs($this->owner))
            ->assertStatus(403)
            ->assertJson(['error' => Messages::NOT_AUTHORIZED]);

        $this->assertSame('outsider-quote', $quote->fresh()->title);
    }

    public function test_updating_a_missing_quote_is_404(): void
    {
        $this->patchJson('/api/v1/quotes/'.Str::uuid(), ['title' => 'x'], $this->authAs($this->owner))
            ->assertStatus(404)
            ->assertJson(['error' => Messages::QUOTE_NOT_FOUND]);
    }

    public function test_existence_is_checked_before_ownership(): void
    {
        // Probing a random id must not be able to distinguish "exists but not yours"
        // from "does not exist" in the other direction: a missing id is 404 even for a
        // caller who owns nothing.
        $this->patchJson('/api/v1/quotes/'.Str::uuid(), [], $this->authAs($this->outsider))
            ->assertStatus(404)
            ->assertJson(['error' => Messages::QUOTE_NOT_FOUND]);
    }

    public function test_a_null_title_is_a_business_error_not_a_500(): void
    {
        // The column is NOT NULL; without the `sometimes|string` rule this reached the
        // database and surfaced as a generic Arabic 500.
        $quote = $this->quoteFor($this->owner);

        $this->patchJson("/api/v1/quotes/{$quote->id}", ['title' => null], $this->authAs($this->owner))
            ->assertOk()
            ->assertJson(['error' => Messages::INCOMPLETE_DATA]);

        $this->assertSame('owner-quote', $quote->fresh()->title);
    }

    // ── delete ───────────────────────────────────────────────────────────────

    public function test_owner_can_delete_an_employees_quote(): void
    {
        $quote = $this->quoteFor($this->employeeA);

        $this->deleteJson("/api/v1/quotes/{$quote->id}", [], $this->authAs($this->owner))
            ->assertOk()
            ->assertExactJson(['success' => true]);

        $this->assertNull(SavedQuote::query()->find($quote->id));
    }

    public function test_employee_can_delete_a_siblings_quote(): void
    {
        $quote = $this->quoteFor($this->employeeB);

        $this->deleteJson("/api/v1/quotes/{$quote->id}", [], $this->authAs($this->employeeA))->assertOk();

        $this->assertNull(SavedQuote::query()->find($quote->id));
    }

    public function test_deleting_a_foreign_tenants_quote_is_forbidden(): void
    {
        $quote = $this->quoteFor($this->outsider);

        $this->deleteJson("/api/v1/quotes/{$quote->id}", [], $this->authAs($this->owner))
            ->assertStatus(403)
            ->assertJson(['error' => Messages::NOT_AUTHORIZED]);

        $this->assertNotNull(SavedQuote::query()->find($quote->id));
    }

    public function test_deleting_a_missing_quote_is_404(): void
    {
        $this->deleteJson('/api/v1/quotes/'.Str::uuid(), [], $this->authAs($this->owner))
            ->assertStatus(404)
            ->assertJson(['error' => Messages::QUOTE_NOT_FOUND]);
    }

    public function test_mutations_require_authentication(): void
    {
        $quote = $this->quoteFor($this->owner);

        $this->patchJson("/api/v1/quotes/{$quote->id}", ['title' => 'x'])->assertStatus(401);
        $this->deleteJson("/api/v1/quotes/{$quote->id}")->assertStatus(401);
        $this->assertNotNull(SavedQuote::query()->find($quote->id));
    }
}
