<?php

namespace Tests\Feature;

use App\Models\AppUser;
use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-036 — POST /account/employees-view-quotes.
 * Ports handleToggleEmployeesViewQuotes (manage-users/index.ts:819-831).
 */
class EmployeesViewQuotesToggleTest extends TestCase
{
    use MakesUsers, RefreshDatabase;

    /** @return array<string,string> */
    private function authAs(string $username = 'owner', string $device = 'dev-1'): array
    {
        return $this->bearer(
            $this->login(['username' => $username, 'device_id' => $device])->json('session_token')
        );
    }

    private function quoteFor(AppUser $user, string $title): void
    {
        $user->quotes()->create([
            'title' => $title,
            'customer_name' => '',
            'quote_number' => '',
            'source_type' => 'calculator',
            'quote_data' => [],
        ]);
    }

    // ── the toggle ───────────────────────────────────────────────────────────

    public function test_an_owner_can_turn_the_flag_on_and_off(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $auth = $this->authAs();
        // refresh() because the column's `false` comes from the database default, which the
        // just-created in-memory model has not seen yet.
        $this->assertFalse($owner->refresh()->employees_can_view_quotes);

        $this->postJson('/api/v1/account/employees-view-quotes', ['enabled' => true], $auth)
            ->assertOk()
            ->assertExactJson(['success' => true, 'employees_can_view_quotes' => true]);

        $this->assertTrue($owner->refresh()->employees_can_view_quotes);

        $this->postJson('/api/v1/account/employees-view-quotes', ['enabled' => false], $auth)
            ->assertOk()
            ->assertExactJson(['success' => true, 'employees_can_view_quotes' => false]);

        $this->assertFalse($owner->refresh()->employees_can_view_quotes);
    }

    public function test_the_toggle_is_idempotent(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $auth = $this->authAs();

        $this->postJson('/api/v1/account/employees-view-quotes', ['enabled' => true], $auth)->assertOk();
        $this->postJson('/api/v1/account/employees-view-quotes', ['enabled' => true], $auth)
            ->assertOk()
            ->assertExactJson(['success' => true, 'employees_can_view_quotes' => true]);

        $this->assertTrue($owner->refresh()->employees_can_view_quotes);
    }

    public function test_only_the_callers_own_flag_is_touched(): void
    {
        $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $other = $this->makeUser(['username' => 'other', 'max_employees' => 5]);

        $this->postJson('/api/v1/account/employees-view-quotes', ['enabled' => true], $this->authAs())
            ->assertOk();

        $this->assertFalse($other->refresh()->employees_can_view_quotes);
    }

    // ── owner only ───────────────────────────────────────────────────────────

    public function test_an_employee_gets_the_main_user_only_message(): void
    {
        // A distinct string from the plain "غير مصرح" used by the ownership-gated
        // endpoints — the UI shows it verbatim.
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);

        $this->postJson('/api/v1/account/employees-view-quotes', ['enabled' => true], $this->authAs('emp'))
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::ONLY_MAIN_USER]);

        $this->assertFalse($owner->refresh()->employees_can_view_quotes);
    }

    public function test_an_employee_cannot_set_its_own_flag_either(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $employee = $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);

        $this->postJson('/api/v1/account/employees-view-quotes', ['enabled' => true], $this->authAs('emp'))
            ->assertStatus(403);

        $this->assertFalse($employee->refresh()->employees_can_view_quotes);
    }

    // ── the effect it has ────────────────────────────────────────────────────

    public function test_the_flag_governs_whether_employees_see_the_owners_quotes(): void
    {
        // The observable point of the whole endpoint, checked end to end against
        // GET /quotes rather than just the column.
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);
        $this->quoteFor($owner, 'owner quote');

        $ownerAuth = $this->authAs();
        $employeeAuth = $this->authAs('emp', 'emp-dev');

        $this->getJson('/api/v1/quotes', $employeeAuth)->assertOk()->assertJsonCount(0, 'related_quotes');

        $this->postJson('/api/v1/account/employees-view-quotes', ['enabled' => true], $ownerAuth)->assertOk();

        $this->getJson('/api/v1/quotes', $employeeAuth)
            ->assertOk()
            ->assertJsonCount(1, 'related_quotes')
            ->assertJsonPath('related_quotes.0.title', 'owner quote')
            ->assertJsonPath('related_quotes.0.is_parent_quote', true);

        $this->postJson('/api/v1/account/employees-view-quotes', ['enabled' => false], $ownerAuth)->assertOk();

        $this->getJson('/api/v1/quotes', $employeeAuth)->assertOk()->assertJsonCount(0, 'related_quotes');
    }

    public function test_the_flag_does_not_gate_sibling_visibility(): void
    {
        // Siblings are mutually visible regardless — turning the flag off must not hide
        // them. This is the distinction the flag is easiest to get wrong on.
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);
        $sibling = $this->makeUser(['username' => 'sibling', 'parent_user_id' => $owner->id]);
        $this->quoteFor($sibling, 'sibling quote');

        $this->postJson('/api/v1/account/employees-view-quotes', ['enabled' => false], $this->authAs())
            ->assertOk();

        $this->getJson('/api/v1/quotes', $this->authAs('emp', 'emp-dev'))
            ->assertOk()
            ->assertJsonCount(1, 'related_quotes')
            ->assertJsonPath('related_quotes.0.title', 'sibling quote')
            ->assertJsonPath('related_quotes.0.employee_username', 'sibling');
    }

    // ── validation & auth ────────────────────────────────────────────────────

    public function test_a_missing_enabled_returns_the_incomplete_data_body(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);

        $this->postJson('/api/v1/account/employees-view-quotes', [], $this->authAs())
            ->assertOk()
            ->assertJson(['error' => Messages::INCOMPLETE_DATA])
            ->assertJsonStructure(['error', 'errors' => ['enabled']]);

        $this->assertFalse($owner->refresh()->employees_can_view_quotes);
    }

    public function test_a_non_boolean_enabled_is_rejected(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);

        $this->postJson('/api/v1/account/employees-view-quotes', ['enabled' => 'yes please'], $this->authAs())
            ->assertOk()
            ->assertJson(['error' => Messages::INCOMPLETE_DATA]);

        $this->assertFalse($owner->refresh()->employees_can_view_quotes);
    }

    public function test_the_toggle_requires_authentication(): void
    {
        $this->postJson('/api/v1/account/employees-view-quotes', ['enabled' => true])
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);
    }
}
