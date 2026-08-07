<?php

namespace Tests\Feature;

use App\Models\AppUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-031 — GET /employees. Ports handleListEmployees (manage-users/index.ts:575-585).
 */
class EmployeeListTest extends TestCase
{
    use MakesUsers, RefreshDatabase;

    /** @return array<string,string> */
    private function authAs(string $username = 'owner', string $device = 'dev-1'): array
    {
        return $this->bearer(
            $this->login(['username' => $username, 'device_id' => $device])->json('session_token')
        );
    }

    private function makeEmployee(AppUser $owner, string $username, string $createdAt): AppUser
    {
        $employee = $this->makeUser(['username' => $username, 'parent_user_id' => $owner->id]);
        $employee->forceFill(['created_at' => $createdAt])->save();

        return $employee;
    }

    public function test_lists_the_callers_employees_oldest_first(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);

        // Inserted out of order so a passing assertion cannot be an accident of insert order.
        $this->makeEmployee($owner, 'middle', '2026-03-01 10:00:00');
        $this->makeEmployee($owner, 'newest', '2026-06-01 10:00:00');
        $this->makeEmployee($owner, 'oldest', '2026-01-01 10:00:00');

        $this->getJson('/api/v1/employees', $this->authAs())
            ->assertOk()
            ->assertJsonCount(3, 'employees')
            ->assertJsonPath('employees.0.username', 'oldest')
            ->assertJsonPath('employees.1.username', 'middle')
            ->assertJsonPath('employees.2.username', 'newest');
    }

    public function test_the_employee_shape_matches_the_reference_select_list(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $employee = $this->makeUser([
            'username' => 'emp',
            'parent_user_id' => $owner->id,
            'max_devices' => 4,
            'is_active' => false,
            'expires_at' => '2027-01-31 00:00:00',
        ]);

        $row = $this->getJson('/api/v1/employees', $this->authAs())->assertOk()->json('employees.0');

        $this->assertSame([
            'id', 'username', 'is_active', 'is_admin', 'expires_at',
            'created_at', 'max_devices', 'max_employees', 'parent_user_id',
        ], array_keys($row));

        $this->assertSame($employee->id, $row['id']);
        $this->assertFalse($row['is_active']);
        $this->assertFalse($row['is_admin']);
        $this->assertSame(4, $row['max_devices']);
        $this->assertSame(0, $row['max_employees']);
        $this->assertSame($owner->id, $row['parent_user_id']);
        $this->assertNotNull($row['expires_at']);
        $this->assertArrayNotHasKey('password_hash', $row);
    }

    public function test_an_owner_with_no_employees_gets_an_empty_array(): void
    {
        $this->makeUser(['username' => 'owner', 'max_employees' => 5]);

        $this->getJson('/api/v1/employees', $this->authAs())
            ->assertOk()
            ->assertExactJson(['employees' => []]);
    }

    public function test_another_tenants_employees_are_never_listed(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $this->makeUser(['username' => 'mine', 'parent_user_id' => $owner->id]);

        $stranger = $this->makeUser(['username' => 'stranger', 'max_employees' => 5]);
        $this->makeUser(['username' => 'theirs', 'parent_user_id' => $stranger->id]);

        $this->getJson('/api/v1/employees', $this->authAs())
            ->assertOk()
            ->assertJsonCount(1, 'employees')
            ->assertJsonPath('employees.0.username', 'mine');
    }

    public function test_an_employee_sees_an_empty_list(): void
    {
        // No role guard is needed: an employee has no children, so the ownership-scoped
        // query is naturally empty — the reference behaves identically.
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);
        $this->makeUser(['username' => 'sibling', 'parent_user_id' => $owner->id]);

        $this->getJson('/api/v1/employees', $this->authAs('emp'))
            ->assertOk()
            ->assertExactJson(['employees' => []]);
    }

    public function test_listing_employees_requires_authentication(): void
    {
        $this->getJson('/api/v1/employees')
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);
    }
}
