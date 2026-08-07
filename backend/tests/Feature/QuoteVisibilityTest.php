<?php

namespace Tests\Feature;

use App\Models\AppUser;
use App\Models\SavedQuote;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-022 — GET /quotes family visibility matrix. Ports handleListQuotes
 * (manage-users/index.ts:762-816).
 *
 * Fixture: one tenant (owner + employeeA + employeeB), each with one quote, plus a
 * completely unrelated tenant (outsider + their employee) that must never appear in
 * anybody else's response.
 */
class QuoteVisibilityTest extends TestCase
{
    use MakesUsers, RefreshDatabase;

    private AppUser $owner;

    private AppUser $employeeA;

    private AppUser $employeeB;

    private AppUser $outsider;

    private AppUser $outsiderEmployee;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = $this->makeUser(['username' => 'owner', 'max_devices' => 5]);
        $this->employeeA = $this->makeUser([
            'username' => 'empA', 'parent_user_id' => $this->owner->id, 'max_devices' => 5,
        ]);
        $this->employeeB = $this->makeUser([
            'username' => 'empB', 'parent_user_id' => $this->owner->id, 'max_devices' => 5,
        ]);

        $this->outsider = $this->makeUser(['username' => 'outsider', 'max_devices' => 5]);
        $this->outsiderEmployee = $this->makeUser([
            'username' => 'outsiderEmp', 'parent_user_id' => $this->outsider->id, 'max_devices' => 5,
        ]);

        foreach ([
            $this->owner, $this->employeeA, $this->employeeB,
            $this->outsider, $this->outsiderEmployee,
        ] as $user) {
            $this->quoteFor($user, "{$user->username}-quote");
        }
    }

    private function quoteFor(AppUser $user, string $title, ?string $createdAt = null): SavedQuote
    {
        $quote = $user->quotes()->create(['title' => $title, 'quote_data' => ['by' => $user->username]]);

        if ($createdAt !== null) {
            $quote->forceFill(['created_at' => $createdAt])->save();
        }

        return $quote->fresh();
    }

    /** @return array<string,string> */
    private function authAs(AppUser $user): array
    {
        return $this->bearer(
            $this->login(['username' => $user->username, 'device_id' => 'dev-'.$user->username])->json('session_token')
        );
    }

    /** @return array{quotes:array,related_quotes:array} */
    private function listAs(AppUser $user): array
    {
        return $this->getJson('/api/v1/quotes', $this->authAs($user))->assertOk()->json();
    }

    /** @return list<string> */
    private function titles(array $quotes): array
    {
        $titles = array_column($quotes, 'title');
        sort($titles);

        return $titles;
    }

    // ── owner ────────────────────────────────────────────────────────────────

    public function test_owner_sees_own_quotes_and_both_employees_quotes(): void
    {
        $body = $this->listAs($this->owner);

        $this->assertSame(['owner-quote'], $this->titles($body['quotes']));
        $this->assertSame(['empA-quote', 'empB-quote'], $this->titles($body['related_quotes']));
    }

    public function test_owner_related_quotes_are_tagged_with_the_owning_employee(): void
    {
        $related = collect($this->listAs($this->owner)['related_quotes'])->keyBy('title');

        $this->assertSame('empA', $related['empA-quote']['employee_username']);
        $this->assertSame('empB', $related['empB-quote']['employee_username']);
    }

    public function test_owner_related_quotes_never_carry_the_parent_flag(): void
    {
        // is_parent_quote only means "this is the OWNER's quote, seen by an employee".
        foreach ($this->listAs($this->owner)['related_quotes'] as $quote) {
            $this->assertArrayNotHasKey('is_parent_quote', $quote);
        }
    }

    public function test_owner_own_quotes_are_not_duplicated_into_related(): void
    {
        $body = $this->listAs($this->owner);

        $this->assertNotContains('owner-quote', array_column($body['related_quotes'], 'title'));
    }

    // ── employee ↔ employee (siblings are ALWAYS mutually visible) ───────────

    public function test_employee_a_sees_sibling_b(): void
    {
        $body = $this->listAs($this->employeeA);

        $this->assertSame(['empA-quote'], $this->titles($body['quotes']));
        $this->assertSame(['empB-quote'], $this->titles($body['related_quotes']));
        $this->assertSame('empB', $body['related_quotes'][0]['employee_username']);
    }

    public function test_employee_b_sees_sibling_a_symmetrically(): void
    {
        $body = $this->listAs($this->employeeB);

        $this->assertSame(['empB-quote'], $this->titles($body['quotes']));
        $this->assertSame(['empA-quote'], $this->titles($body['related_quotes']));
        $this->assertSame('empA', $body['related_quotes'][0]['employee_username']);
    }

    public function test_sibling_visibility_is_not_gated_by_employees_can_view_quotes(): void
    {
        // The flag governs the OWNER's quotes only. Siblings see each other regardless.
        $this->owner->forceFill(['employees_can_view_quotes' => false])->save();

        $this->assertSame(['empB-quote'], $this->titles($this->listAs($this->employeeA)['related_quotes']));
    }

    public function test_an_employee_never_sees_its_own_quote_in_related(): void
    {
        $this->owner->forceFill(['employees_can_view_quotes' => true])->save();

        $related = array_column($this->listAs($this->employeeA)['related_quotes'], 'title');

        $this->assertNotContains('empA-quote', $related);
    }

    // ── employee → owner, gated by employees_can_view_quotes ────────────────

    public function test_employee_does_not_see_owner_quotes_when_the_flag_is_off(): void
    {
        $this->owner->forceFill(['employees_can_view_quotes' => false])->save();

        $related = array_column($this->listAs($this->employeeA)['related_quotes'], 'title');

        $this->assertNotContains('owner-quote', $related);
        $this->assertSame(['empB-quote'], $this->titles($this->listAs($this->employeeA)['related_quotes']));
    }

    public function test_employee_sees_owner_quotes_when_the_flag_is_on(): void
    {
        $this->owner->forceFill(['employees_can_view_quotes' => true])->save();

        $body = $this->listAs($this->employeeA);

        $this->assertSame(['empB-quote', 'owner-quote'], $this->titles($body['related_quotes']));
    }

    public function test_is_parent_quote_is_set_only_on_the_owners_quotes(): void
    {
        $this->owner->forceFill(['employees_can_view_quotes' => true])->save();

        $related = collect($this->listAs($this->employeeA)['related_quotes'])->keyBy('title');

        // Owner's quote: flagged, and attributed to the owner's username.
        $this->assertTrue($related['owner-quote']['is_parent_quote']);
        $this->assertSame('owner', $related['owner-quote']['employee_username']);

        // Sibling's quote: tagged, but NOT flagged — the key is absent, not false.
        $this->assertArrayNotHasKey('is_parent_quote', $related['empB-quote']);
        $this->assertSame('empB', $related['empB-quote']['employee_username']);
    }

    public function test_owner_quotes_are_listed_before_siblings(): void
    {
        // Ordering is part of the ported contract: parent quotes are pushed first.
        $this->owner->forceFill(['employees_can_view_quotes' => true])->save();

        $titles = array_column($this->listAs($this->employeeA)['related_quotes'], 'title');

        $this->assertSame(['owner-quote', 'empB-quote'], $titles);
    }

    // ── cross-tenant isolation ───────────────────────────────────────────────

    public function test_no_tenant_ever_sees_another_tenants_quotes(): void
    {
        foreach ([$this->owner, $this->employeeA, $this->employeeB] as $user) {
            $body = $this->listAs($user);
            $all = array_merge(
                array_column($body['quotes'], 'title'),
                array_column($body['related_quotes'], 'title')
            );

            $this->assertNotContains('outsider-quote', $all, "{$user->username} leaked the outsider's quote");
            $this->assertNotContains('outsiderEmp-quote', $all, "{$user->username} leaked the outsider employee's quote");
        }
    }

    public function test_the_outsider_tenant_is_equally_isolated(): void
    {
        $body = $this->listAs($this->outsider);

        $this->assertSame(['outsider-quote'], $this->titles($body['quotes']));
        $this->assertSame(['outsiderEmp-quote'], $this->titles($body['related_quotes']));
    }

    // ── shape & ordering ─────────────────────────────────────────────────────

    public function test_quotes_are_returned_newest_first(): void
    {
        $this->quoteFor($this->owner, 'oldest', now()->subDays(3)->toDateTimeString());
        $this->quoteFor($this->owner, 'middle', now()->subDays(2)->toDateTimeString());
        $this->quoteFor($this->owner, 'newest', now()->subDay()->toDateTimeString());

        $titles = array_column($this->listAs($this->owner)['quotes'], 'title');

        // 'owner-quote' was created at ~now, so it leads; the rest descend by created_at.
        $this->assertSame(['owner-quote', 'newest', 'middle', 'oldest'], $titles);
    }

    public function test_a_lone_owner_with_no_employees_gets_an_empty_related_list(): void
    {
        $solo = $this->makeUser(['username' => 'solo', 'max_devices' => 5]);
        $this->quoteFor($solo, 'solo-quote');

        $body = $this->listAs($solo);

        $this->assertSame(['solo-quote'], $this->titles($body['quotes']));
        $this->assertSame([], $body['related_quotes']);
    }

    public function test_related_quotes_keep_opaque_quote_data(): void
    {
        $body = $this->listAs($this->owner);
        $related = collect($body['related_quotes'])->keyBy('title');

        $this->assertSame(['by' => 'empA'], $related['empA-quote']['quote_data']);
    }

    public function test_listing_requires_authentication(): void
    {
        $this->getJson('/api/v1/quotes')->assertStatus(401)->assertJson(['session_expired' => true]);
    }
}
