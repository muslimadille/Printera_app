<?php

namespace Tests\Feature;

use App\Models\AppUser;
use App\Models\SavedQuote;
use App\Models\UserSession;
use App\Models\UserSetting;
use App\Models\UserTabPermission;
use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-033 — DELETE /employees/{id}?transfer_to=<id>.
 * Ports handleDeleteEmployee (manage-users/index.ts:646-665).
 */
class EmployeeDeleteTest extends TestCase
{
    use MakesUsers, RefreshDatabase;

    /** @return array<string,string> */
    private function authAs(string $username = 'owner', string $device = 'dev-1'): array
    {
        return $this->bearer(
            $this->login(['username' => $username, 'device_id' => $device])->json('session_token')
        );
    }

    private function quoteFor(AppUser $user, string $title): SavedQuote
    {
        return $user->quotes()->create([
            'title' => $title,
            'customer_name' => '',
            'quote_number' => '',
            'source_type' => 'calculator',
            'quote_data' => ['t' => $title],
        ]);
    }

    // ── plain delete ─────────────────────────────────────────────────────────

    public function test_deletes_the_employee(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $employee = $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);

        $this->deleteJson("/api/v1/employees/{$employee->id}", [], $this->authAs())
            ->assertOk()
            ->assertExactJson(['success' => true]);

        $this->assertNull(AppUser::query()->find($employee->id));
        $this->assertNotNull(AppUser::query()->find($owner->id));
    }

    public function test_delete_without_transfer_cascades_every_child_row(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $employee = $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);

        $this->quoteFor($employee, 'goes away');
        $employee->settings()->create(['setting_key' => 'paperTypes', 'setting_value' => ['x' => 1]]);
        $employee->tabPermissions()->create(['tab_key' => 'itemcost', 'is_enabled' => true]);
        $this->seedSession($employee, 'emp-dev');

        // The owner keeps its own rows of every kind.
        $this->quoteFor($owner, 'stays');
        $owner->settings()->create(['setting_key' => 'paperTypes', 'setting_value' => ['y' => 2]]);
        $owner->tabPermissions()->create(['tab_key' => 'itemcost', 'is_enabled' => true]);

        $this->deleteJson("/api/v1/employees/{$employee->id}", [], $this->authAs())->assertOk();

        $this->assertSame(0, SavedQuote::query()->where('user_id', $employee->id)->count());
        $this->assertSame(0, UserSetting::query()->where('user_id', $employee->id)->count());
        $this->assertSame(0, UserTabPermission::query()->where('user_id', $employee->id)->count());
        $this->assertSame(0, UserSession::query()->where('user_id', $employee->id)->count());

        $this->assertSame(1, SavedQuote::query()->where('user_id', $owner->id)->count());
        $this->assertSame(1, UserSetting::query()->where('user_id', $owner->id)->count());
        $this->assertSame(1, UserTabPermission::query()->where('user_id', $owner->id)->count());
    }

    // ── delete with transfer ─────────────────────────────────────────────────

    public function test_quotes_transfer_to_the_owner_before_the_delete(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $employee = $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);
        $a = $this->quoteFor($employee, 'first');
        $b = $this->quoteFor($employee, 'second');

        $this->deleteJson("/api/v1/employees/{$employee->id}?transfer_to={$owner->id}", [], $this->authAs())
            ->assertOk()
            ->assertExactJson(['success' => true]);

        $this->assertNull(AppUser::query()->find($employee->id));
        $this->assertSame($owner->id, SavedQuote::query()->findOrFail($a->id)->user_id);
        $this->assertSame($owner->id, SavedQuote::query()->findOrFail($b->id)->user_id);
    }

    public function test_quotes_transfer_to_a_sibling_employee(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $leaving = $this->makeUser(['username' => 'leaving', 'parent_user_id' => $owner->id]);
        $staying = $this->makeUser(['username' => 'staying', 'parent_user_id' => $owner->id]);
        $quote = $this->quoteFor($leaving, 'handover');

        $this->deleteJson("/api/v1/employees/{$leaving->id}?transfer_to={$staying->id}", [], $this->authAs())
            ->assertOk();

        $this->assertSame($staying->id, SavedQuote::query()->findOrFail($quote->id)->user_id);
        $this->assertNotNull(AppUser::query()->find($staying->id));
    }

    public function test_the_transfer_moves_only_the_deleted_employees_quotes(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $leaving = $this->makeUser(['username' => 'leaving', 'parent_user_id' => $owner->id]);
        $other = $this->makeUser(['username' => 'other', 'parent_user_id' => $owner->id]);

        $moved = $this->quoteFor($leaving, 'moved');
        $untouched = $this->quoteFor($other, 'untouched');

        $this->deleteJson("/api/v1/employees/{$leaving->id}?transfer_to={$owner->id}", [], $this->authAs())
            ->assertOk();

        $this->assertSame($owner->id, SavedQuote::query()->findOrFail($moved->id)->user_id);
        $this->assertSame($other->id, SavedQuote::query()->findOrFail($untouched->id)->user_id);
    }

    public function test_the_body_form_of_transfer_to_is_accepted(): void
    {
        // src/lib/userApi.ts sends a single JSON envelope, so transfer_to arrives in the
        // body rather than the query string. Both must work — see DeleteEmployeeRequest.
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $employee = $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);
        $quote = $this->quoteFor($employee, 'via body');

        $this->deleteJson("/api/v1/employees/{$employee->id}", ['transfer_to' => $owner->id], $this->authAs())
            ->assertOk();

        $this->assertSame($owner->id, SavedQuote::query()->findOrFail($quote->id)->user_id);
    }

    public function test_an_empty_transfer_to_means_no_transfer(): void
    {
        // `if (params.transfer_to)` — truthiness, so '' is "no transfer", and the quotes
        // cascade away with the employee.
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $employee = $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);
        $this->quoteFor($employee, 'gone');

        $this->deleteJson("/api/v1/employees/{$employee->id}", ['transfer_to' => ''], $this->authAs())
            ->assertOk();

        $this->assertSame(0, SavedQuote::query()->count());
    }

    // ── transfer target validation ───────────────────────────────────────────

    public function test_an_unknown_transfer_target_is_rejected_and_nothing_is_deleted(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $employee = $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);
        $this->quoteFor($employee, 'kept');

        $this->deleteJson("/api/v1/employees/{$employee->id}?transfer_to=".fake()->uuid(), [], $this->authAs())
            ->assertStatus(400)
            ->assertExactJson(['error' => Messages::TARGET_USER_NOT_FOUND]);

        $this->assertNotNull(AppUser::query()->find($employee->id));
        $this->assertSame(1, SavedQuote::query()->where('user_id', $employee->id)->count());
    }

    public function test_a_transfer_target_outside_the_tenant_is_rejected(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $employee = $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);
        $stranger = $this->makeUser(['username' => 'stranger', 'max_employees' => 5]);
        $this->quoteFor($employee, 'kept');

        $this->deleteJson("/api/v1/employees/{$employee->id}?transfer_to={$stranger->id}", [], $this->authAs())
            ->assertStatus(400)
            ->assertExactJson(['error' => Messages::TARGET_USER_NOT_FOUND]);

        $this->assertNotNull(AppUser::query()->find($employee->id));
        $this->assertSame(0, SavedQuote::query()->where('user_id', $stranger->id)->count());
    }

    public function test_a_transfer_target_belonging_to_another_owner_is_rejected(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $employee = $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);
        $stranger = $this->makeUser(['username' => 'stranger', 'max_employees' => 5]);
        $theirEmployee = $this->makeUser(['username' => 'theirs', 'parent_user_id' => $stranger->id]);

        $this->deleteJson("/api/v1/employees/{$employee->id}?transfer_to={$theirEmployee->id}", [], $this->authAs())
            ->assertStatus(400)
            ->assertExactJson(['error' => Messages::TARGET_USER_NOT_FOUND]);

        $this->assertNotNull(AppUser::query()->find($employee->id));
    }

    public function test_transferring_to_the_employee_being_deleted_still_drops_the_quotes(): void
    {
        // A reference quirk, ported deliberately: the target passes the "is an employee of
        // the caller" check because it IS one, the quotes are moved to themselves, and the
        // cascade then deletes them. The SPA never offers this combination.
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $employee = $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);
        $this->quoteFor($employee, 'self-transfer');

        $this->deleteJson("/api/v1/employees/{$employee->id}?transfer_to={$employee->id}", [], $this->authAs())
            ->assertOk()
            ->assertExactJson(['success' => true]);

        $this->assertNull(AppUser::query()->find($employee->id));
        $this->assertSame(0, SavedQuote::query()->count());
    }

    // ── ownership gate ───────────────────────────────────────────────────────

    public function test_another_owners_employee_cannot_be_deleted(): void
    {
        $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $stranger = $this->makeUser(['username' => 'stranger', 'max_employees' => 5]);
        $victim = $this->makeUser(['username' => 'victim', 'parent_user_id' => $stranger->id]);

        $this->deleteJson("/api/v1/employees/{$victim->id}", [], $this->authAs())
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);

        $this->assertNotNull(AppUser::query()->find($victim->id));
    }

    public function test_the_ownership_gate_is_checked_before_the_transfer_target(): void
    {
        // A foreign employee plus a bad transfer target must answer 403, not 400 — the
        // reference gates ownership first (index.ts:650) and that ordering is what stops
        // the 400 from confirming which ids exist elsewhere.
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $stranger = $this->makeUser(['username' => 'stranger', 'max_employees' => 5]);
        $victim = $this->makeUser(['username' => 'victim', 'parent_user_id' => $stranger->id]);

        $this->deleteJson("/api/v1/employees/{$victim->id}?transfer_to=".fake()->uuid(), [], $this->authAs())
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);

        $this->assertNotNull(AppUser::query()->find($owner->id));
    }

    public function test_an_owner_cannot_delete_itself_through_this_endpoint(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);

        $this->deleteJson("/api/v1/employees/{$owner->id}", [], $this->authAs())
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);

        $this->assertNotNull(AppUser::query()->find($owner->id));
    }

    public function test_an_employee_cannot_delete_a_sibling(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);
        $sibling = $this->makeUser(['username' => 'sibling', 'parent_user_id' => $owner->id]);

        $this->deleteJson("/api/v1/employees/{$sibling->id}", [], $this->authAs('emp'))
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);

        $this->assertNotNull(AppUser::query()->find($sibling->id));
    }

    public function test_deleting_an_employee_requires_authentication(): void
    {
        $this->deleteJson('/api/v1/employees/'.fake()->uuid())
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);
    }

    public function test_a_deleted_employees_token_stops_working(): void
    {
        // The user_sessions cascade is what revokes it: EnsureSessionActive can no longer
        // find the jti in the allow-list.
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $employee = $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);
        $employeeAuth = $this->authAs('emp', 'emp-dev');

        $this->getJson('/api/v1/settings', $employeeAuth)->assertOk();

        $this->deleteJson("/api/v1/employees/{$employee->id}", [], $this->authAs())->assertOk();

        $this->getJson('/api/v1/settings', $employeeAuth)
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);
    }
}
