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
 * BE-024 — POST /quotes/transfer. Ports handleTransferQuotes (index.ts:619-643).
 *
 * The scope here is NARROWER than the family gate used by PATCH/DELETE: each id must be
 * the caller itself or an employee OF THE CALLER. Siblings are not transfer participants.
 */
class QuoteTransferTest extends TestCase
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

    private function seedQuotes(AppUser $user, int $count): void
    {
        for ($i = 0; $i < $count; $i++) {
            $user->quotes()->create(['title' => "{$user->username}-{$i}", 'quote_data' => ['i' => $i]]);
        }
    }

    private function countFor(AppUser $user): int
    {
        return SavedQuote::query()->where('user_id', $user->id)->count();
    }

    public function test_owner_transfers_an_employees_quotes_to_itself(): void
    {
        $this->seedQuotes($this->employeeA, 3);

        $this->postJson('/api/v1/quotes/transfer', [
            'from_user_id' => $this->employeeA->id,
            'to_user_id' => $this->owner->id,
        ], $this->authAs($this->owner))
            ->assertOk()
            ->assertExactJson(['success' => true, 'transferred' => 3]);

        $this->assertSame(0, $this->countFor($this->employeeA));
        $this->assertSame(3, $this->countFor($this->owner));
    }

    public function test_owner_transfers_between_two_of_its_employees(): void
    {
        $this->seedQuotes($this->employeeA, 2);
        $this->seedQuotes($this->employeeB, 1);

        $this->postJson('/api/v1/quotes/transfer', [
            'from_user_id' => $this->employeeA->id,
            'to_user_id' => $this->employeeB->id,
        ], $this->authAs($this->owner))
            ->assertOk()
            ->assertJson(['success' => true, 'transferred' => 2]);

        $this->assertSame(0, $this->countFor($this->employeeA));
        $this->assertSame(3, $this->countFor($this->employeeB));
    }

    public function test_transferring_nothing_reports_zero(): void
    {
        $this->postJson('/api/v1/quotes/transfer', [
            'from_user_id' => $this->employeeA->id,
            'to_user_id' => $this->owner->id,
        ], $this->authAs($this->owner))
            ->assertOk()
            ->assertExactJson(['success' => true, 'transferred' => 0]);
    }

    public function test_quote_payloads_survive_the_move(): void
    {
        $this->employeeA->quotes()->create(['title' => 'keep', 'quote_data' => ['deep' => ['x' => 1]]]);

        $this->postJson('/api/v1/quotes/transfer', [
            'from_user_id' => $this->employeeA->id,
            'to_user_id' => $this->owner->id,
        ], $this->authAs($this->owner))->assertOk();

        $moved = SavedQuote::query()->where('user_id', $this->owner->id)->firstOrFail();
        $this->assertSame('keep', $moved->title);
        $this->assertSame(['deep' => ['x' => 1]], $moved->quote_data);
    }

    // ── authorization ────────────────────────────────────────────────────────

    public function test_source_outside_the_callers_employees_is_forbidden(): void
    {
        $this->seedQuotes($this->outsider, 2);

        $this->postJson('/api/v1/quotes/transfer', [
            'from_user_id' => $this->outsider->id,
            'to_user_id' => $this->owner->id,
        ], $this->authAs($this->owner))
            ->assertStatus(403)
            ->assertJson(['error' => Messages::NOT_AUTHORIZED]);

        $this->assertSame(2, $this->countFor($this->outsider));
        $this->assertSame(0, $this->countFor($this->owner));
    }

    public function test_destination_outside_the_callers_employees_is_forbidden(): void
    {
        $this->seedQuotes($this->employeeA, 2);

        $this->postJson('/api/v1/quotes/transfer', [
            'from_user_id' => $this->employeeA->id,
            'to_user_id' => $this->outsider->id,
        ], $this->authAs($this->owner))
            ->assertStatus(403)
            ->assertJson(['error' => Messages::NOT_AUTHORIZED]);

        // Both checks run before any write — nothing moved.
        $this->assertSame(2, $this->countFor($this->employeeA));
        $this->assertSame(0, $this->countFor($this->outsider));
    }

    public function test_an_employee_cannot_transfer_a_siblings_quotes(): void
    {
        // Transfer scope is parent_user_id = caller.id. An employee has no employees, so
        // empA cannot touch empB even though PATCH/DELETE would allow it (family gate).
        $this->seedQuotes($this->employeeB, 2);

        $this->postJson('/api/v1/quotes/transfer', [
            'from_user_id' => $this->employeeB->id,
            'to_user_id' => $this->employeeA->id,
        ], $this->authAs($this->employeeA))
            ->assertStatus(403)
            ->assertJson(['error' => Messages::NOT_AUTHORIZED]);

        $this->assertSame(2, $this->countFor($this->employeeB));
    }

    public function test_an_employee_can_transfer_its_own_quotes_to_itself(): void
    {
        // Degenerate but allowed: both ids are the caller.
        $this->seedQuotes($this->employeeA, 1);

        $this->postJson('/api/v1/quotes/transfer', [
            'from_user_id' => $this->employeeA->id,
            'to_user_id' => $this->employeeA->id,
        ], $this->authAs($this->employeeA))
            ->assertOk()
            ->assertJson(['success' => true, 'transferred' => 1]);

        $this->assertSame(1, $this->countFor($this->employeeA));
    }

    public function test_an_employee_cannot_transfer_to_its_own_owner(): void
    {
        $this->seedQuotes($this->employeeA, 1);

        $this->postJson('/api/v1/quotes/transfer', [
            'from_user_id' => $this->employeeA->id,
            'to_user_id' => $this->owner->id,
        ], $this->authAs($this->employeeA))
            ->assertStatus(403)
            ->assertJson(['error' => Messages::NOT_AUTHORIZED]);

        $this->assertSame(1, $this->countFor($this->employeeA));
    }

    public function test_unknown_and_missing_ids_are_forbidden(): void
    {
        foreach ([
            ['from_user_id' => (string) Str::uuid(), 'to_user_id' => $this->owner->id],
            ['from_user_id' => $this->owner->id, 'to_user_id' => (string) Str::uuid()],
            ['to_user_id' => $this->owner->id],
            ['from_user_id' => $this->owner->id],
            [],
        ] as $payload) {
            $this->postJson('/api/v1/quotes/transfer', $payload, $this->authAs($this->owner))
                ->assertStatus(403)
                ->assertJson(['error' => Messages::NOT_AUTHORIZED]);
        }
    }

    public function test_transfer_requires_authentication(): void
    {
        $this->postJson('/api/v1/quotes/transfer', [
            'from_user_id' => $this->employeeA->id,
            'to_user_id' => $this->owner->id,
        ])->assertStatus(401)->assertJson(['session_expired' => true]);
    }
}
