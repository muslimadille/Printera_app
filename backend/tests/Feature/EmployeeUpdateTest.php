<?php

namespace Tests\Feature;

use App\Models\AppUser;
use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-032 — PATCH /employees/{id}. Ports handleUpdateEmployee (manage-users/index.ts:587-605).
 */
class EmployeeUpdateTest extends TestCase
{
    use MakesUsers, RefreshDatabase;

    /** @return array<string,string> */
    private function authAs(string $username = 'owner', string $device = 'dev-1'): array
    {
        return $this->bearer(
            $this->login(['username' => $username, 'device_id' => $device])->json('session_token')
        );
    }

    private function makeOwnerWithEmployee(): array
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $employee = $this->makeUser([
            'username' => 'emp',
            'parent_user_id' => $owner->id,
            'max_devices' => 1,
        ]);

        return [$owner, $employee];
    }

    // ── field updates ────────────────────────────────────────────────────────

    public function test_updates_every_supported_field(): void
    {
        [$owner, $employee] = $this->makeOwnerWithEmployee();

        $this->patchJson("/api/v1/employees/{$employee->id}", [
            'username' => 'مُحدَّث',
            'is_active' => false,
            'max_devices' => 7,
        ], $this->authAs())
            ->assertOk()
            ->assertJson(['employee' => [
                'id' => $employee->id,
                'username' => 'مُحدَّث',
                'is_active' => false,
                'max_devices' => 7,
                'parent_user_id' => $owner->id,
            ]]);

        $employee->refresh();
        $this->assertSame('مُحدَّث', $employee->username);
        $this->assertFalse($employee->is_active);
        $this->assertSame(7, $employee->max_devices);
    }

    public function test_absent_keys_are_left_alone(): void
    {
        [, $employee] = $this->makeOwnerWithEmployee();

        $this->patchJson("/api/v1/employees/{$employee->id}", ['max_devices' => 3], $this->authAs())
            ->assertOk();

        $employee->refresh();
        $this->assertSame('emp', $employee->username);
        $this->assertTrue($employee->is_active);
        $this->assertSame(3, $employee->max_devices);
    }

    public function test_an_empty_patch_is_a_no_op_that_still_returns_the_employee(): void
    {
        [, $employee] = $this->makeOwnerWithEmployee();

        $this->patchJson("/api/v1/employees/{$employee->id}", [], $this->authAs())
            ->assertOk()
            ->assertJson(['employee' => ['id' => $employee->id, 'username' => 'emp']]);
    }

    public function test_the_response_carries_the_full_app_user_shape(): void
    {
        [, $employee] = $this->makeOwnerWithEmployee();

        $row = $this->patchJson("/api/v1/employees/{$employee->id}", ['is_active' => false], $this->authAs())
            ->assertOk()->json('employee');

        $this->assertSame([
            'id', 'username', 'is_active', 'is_admin', 'expires_at',
            'created_at', 'max_devices', 'max_employees', 'parent_user_id',
        ], array_keys($row));
    }

    // ── password ─────────────────────────────────────────────────────────────

    public function test_a_new_password_is_rehashed_and_replaces_the_old_one(): void
    {
        [, $employee] = $this->makeOwnerWithEmployee();
        $before = $employee->password_hash;

        $this->patchJson("/api/v1/employees/{$employee->id}", ['password' => 'brand-new'], $this->authAs())
            ->assertOk();

        $employee->refresh();
        $this->assertNotSame($before, $employee->password_hash);
        $this->assertTrue(Hash::check('brand-new', $employee->password_hash));
        $this->assertFalse(Hash::check('secret123', $employee->password_hash));

        $this->login(['username' => 'emp', 'password' => 'brand-new', 'device_id' => 'emp-dev'])
            ->assertOk()
            ->assertJson(['success' => true]);
    }

    public function test_an_empty_password_is_ignored_rather_than_hashed(): void
    {
        // index.ts:597 tests `if (params.password)` — truthiness, unlike the other three
        // fields. An empty string must not overwrite the credential with a hash of ''.
        [, $employee] = $this->makeOwnerWithEmployee();
        $before = $employee->password_hash;

        $this->patchJson("/api/v1/employees/{$employee->id}", ['password' => ''], $this->authAs())
            ->assertOk();

        $this->assertSame($before, $employee->refresh()->password_hash);
        $this->assertTrue(Hash::check('secret123', $employee->password_hash));
    }

    public function test_a_null_password_is_ignored(): void
    {
        [, $employee] = $this->makeOwnerWithEmployee();
        $before = $employee->password_hash;

        $this->patchJson("/api/v1/employees/{$employee->id}", ['password' => null], $this->authAs())
            ->assertOk();

        $this->assertSame($before, $employee->refresh()->password_hash);
    }

    public function test_the_password_hash_is_never_returned(): void
    {
        [, $employee] = $this->makeOwnerWithEmployee();

        $this->patchJson("/api/v1/employees/{$employee->id}", ['password' => 'x'], $this->authAs())
            ->assertOk()
            ->assertJsonMissingPath('employee.password_hash')
            ->assertJsonMissingPath('employee.password');
    }

    // ── ownership gate ───────────────────────────────────────────────────────

    public function test_another_owners_employee_cannot_be_updated(): void
    {
        $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $stranger = $this->makeUser(['username' => 'stranger', 'max_employees' => 5]);
        $victim = $this->makeUser(['username' => 'victim', 'parent_user_id' => $stranger->id]);

        $this->patchJson("/api/v1/employees/{$victim->id}", ['is_active' => false], $this->authAs())
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);

        $this->assertTrue($victim->refresh()->is_active);
    }

    public function test_an_owner_cannot_update_itself_through_this_endpoint(): void
    {
        // The gate requires parent_user_id = caller.id, which the caller never satisfies
        // for its own row — an owner has no parent.
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);

        $this->patchJson("/api/v1/employees/{$owner->id}", ['max_devices' => 99], $this->authAs())
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);

        $this->assertSame(1, $owner->refresh()->max_devices);
    }

    public function test_an_unknown_id_is_indistinguishable_from_a_foreign_one(): void
    {
        // Both answer 403 — the reference collapses them, and that is also what stops an
        // owner from probing which ids exist in other tenants.
        $this->makeUser(['username' => 'owner', 'max_employees' => 5]);

        $this->patchJson('/api/v1/employees/'.fake()->uuid(), ['is_active' => false], $this->authAs())
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);
    }

    public function test_an_employee_cannot_update_a_sibling(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);
        $sibling = $this->makeUser(['username' => 'sibling', 'parent_user_id' => $owner->id]);

        $this->patchJson("/api/v1/employees/{$sibling->id}", ['is_active' => false], $this->authAs('emp'))
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);

        $this->assertTrue($sibling->refresh()->is_active);
    }

    // ── privilege escalation ─────────────────────────────────────────────────

    public function test_unsupported_fields_are_ignored(): void
    {
        // is_admin, max_employees, expires_at and parent_user_id are not in the reference's
        // update whitelist. An owner must not be able to promote its own employee.
        [$owner, $employee] = $this->makeOwnerWithEmployee();
        $other = $this->makeUser(['username' => 'other-owner', 'max_employees' => 5]);

        $this->patchJson("/api/v1/employees/{$employee->id}", [
            'is_admin' => true,
            'max_employees' => 50,
            'expires_at' => '2099-01-01T00:00:00Z',
            'parent_user_id' => $other->id,
        ], $this->authAs())->assertOk();

        $employee->refresh();
        $this->assertFalse($employee->is_admin);
        $this->assertSame(0, $employee->max_employees);
        $this->assertNull($employee->expires_at);
        $this->assertSame($owner->id, $employee->parent_user_id);
    }

    // ── validation & conflicts ───────────────────────────────────────────────

    public function test_a_username_taken_by_someone_else_is_rejected(): void
    {
        [, $employee] = $this->makeOwnerWithEmployee();
        $this->makeUser(['username' => 'taken']);
        $auth = $this->authAs();

        $this->patchJson("/api/v1/employees/{$employee->id}", ['username' => 'taken'], $auth)
            ->assertStatus(400)
            ->assertExactJson(['error' => Messages::USERNAME_EXISTS]);

        // Everything after the 400 is the regression guard for the savepoint in
        // EmployeeService::rejectingDuplicateUsername. On PostgreSQL the failed INSERT
        // aborts the surrounding transaction, so without it these queries die with
        // SQLSTATE[25P02] instead of reporting the rejected rename.
        $this->assertSame('emp', $employee->refresh()->username);

        $this->patchJson("/api/v1/employees/{$employee->id}", ['username' => 'free'], $auth)
            ->assertOk()
            ->assertJson(['employee' => ['username' => 'free']]);
    }

    public function test_a_non_integer_max_devices_returns_the_incomplete_data_body(): void
    {
        [, $employee] = $this->makeOwnerWithEmployee();

        $this->patchJson("/api/v1/employees/{$employee->id}", ['max_devices' => 'many'], $this->authAs())
            ->assertOk()
            ->assertJson(['error' => Messages::INCOMPLETE_DATA])
            ->assertJsonStructure(['error', 'errors' => ['max_devices']]);

        $this->assertSame(1, $employee->refresh()->max_devices);
    }

    public function test_updating_an_employee_requires_authentication(): void
    {
        $this->patchJson('/api/v1/employees/'.fake()->uuid(), ['is_active' => false])
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);
    }

    public function test_deactivating_an_employee_blocks_its_next_request(): void
    {
        // The observable point of is_active: EnsureSessionActive rejects a live token as
        // soon as the flag flips.
        [, $employee] = $this->makeOwnerWithEmployee();
        $employeeAuth = $this->authAs('emp', 'emp-dev');

        $this->getJson('/api/v1/settings', $employeeAuth)->assertOk();

        $this->patchJson("/api/v1/employees/{$employee->id}", ['is_active' => false], $this->authAs())
            ->assertOk();

        $this->getJson('/api/v1/settings', $employeeAuth)
            ->assertStatus(401)
            ->assertJson(['error' => Messages::ACCOUNT_DISABLED, 'session_expired' => true]);
    }

    public function test_an_updated_employee_row_belongs_to_the_right_model(): void
    {
        [, $employee] = $this->makeOwnerWithEmployee();
        $this->makeUser(['username' => 'bystander', 'max_devices' => 2]);

        $this->patchJson("/api/v1/employees/{$employee->id}", ['max_devices' => 9], $this->authAs())
            ->assertOk();

        $this->assertSame(2, AppUser::query()->where('username', 'bystander')->firstOrFail()->max_devices);
    }
}
