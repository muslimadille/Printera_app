<?php

namespace Tests\Feature;

use App\Models\AppUser;
use App\Models\UserTabPermission;
use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-030 — POST /employees. Ports handleCreateEmployee (manage-users/index.ts:543-573).
 */
class EmployeeCreateTest extends TestCase
{
    use MakesUsers, RefreshDatabase;

    /** @return array<string,string> */
    private function authAs(string $username = 'owner', string $device = 'dev-1'): array
    {
        return $this->bearer(
            $this->login(['username' => $username, 'device_id' => $device])->json('session_token')
        );
    }

    private function makeOwner(int $maxEmployees = 3): AppUser
    {
        return $this->makeUser(['username' => 'owner', 'max_employees' => $maxEmployees]);
    }

    // ── happy path ───────────────────────────────────────────────────────────

    public function test_creates_an_employee_under_the_caller(): void
    {
        $owner = $this->makeOwner();

        $res = $this->postJson('/api/v1/employees', [
            'username' => 'موظف-1',
            'password' => 'emp-secret',
            'max_devices' => 3,
        ], $this->authAs())->assertOk();

        $res->assertJson(['employee' => [
            'username' => 'موظف-1',
            'is_active' => true,
            'is_admin' => false,
            'expires_at' => null,
            'max_devices' => 3,
            'max_employees' => 0,
            'parent_user_id' => $owner->id,
        ]]);

        // Exactly the reference's select() list — no more, no less. password_hash in
        // particular must never appear.
        $this->assertSame([
            'id', 'username', 'is_active', 'is_admin', 'expires_at',
            'created_at', 'max_devices', 'max_employees', 'parent_user_id',
        ], array_keys($res->json('employee')));
    }

    public function test_the_password_is_hashed_and_the_employee_can_log_in(): void
    {
        $this->makeOwner();

        $this->postJson('/api/v1/employees', [
            'username' => 'emp',
            'password' => 'emp-secret',
        ], $this->authAs())->assertOk();

        $employee = AppUser::query()->where('username', 'emp')->firstOrFail();
        $this->assertNotSame('emp-secret', $employee->password_hash);
        $this->assertTrue(Hash::check('emp-secret', $employee->password_hash));

        $this->login(['username' => 'emp', 'password' => 'emp-secret', 'device_id' => 'emp-dev'])
            ->assertOk()
            ->assertJson(['success' => true]);
    }

    public function test_max_devices_defaults_to_one(): void
    {
        $this->makeOwner();

        $this->postJson('/api/v1/employees', ['username' => 'a', 'password' => 'p'], $this->authAs())
            ->assertOk()
            ->assertJson(['employee' => ['max_devices' => 1]]);
    }

    public function test_a_zero_max_devices_falls_back_to_one(): void
    {
        // `params.max_devices || 1` — JS falsy-coalescing, so 0 takes the default.
        $this->makeOwner();

        $this->postJson('/api/v1/employees', ['username' => 'a', 'password' => 'p', 'max_devices' => 0], $this->authAs())
            ->assertOk()
            ->assertJson(['employee' => ['max_devices' => 1]]);
    }

    // ── the employee cap ─────────────────────────────────────────────────────

    public function test_the_cap_is_enforced_and_reports_the_owners_limit(): void
    {
        $this->makeOwner(2);
        $auth = $this->authAs();

        $this->postJson('/api/v1/employees', ['username' => 'e1', 'password' => 'p'], $auth)->assertOk();
        $this->postJson('/api/v1/employees', ['username' => 'e2', 'password' => 'p'], $auth)->assertOk();

        $this->postJson('/api/v1/employees', ['username' => 'e3', 'password' => 'p'], $auth)
            ->assertStatus(400)
            ->assertExactJson(['error' => 'وصلت للحد الأقصى من الموظفين (2)']);

        $this->assertSame(2, AppUser::query()->whereNotNull('parent_user_id')->count());
    }

    public function test_an_owner_with_a_zero_cap_can_create_nobody(): void
    {
        $this->makeUser(['username' => 'owner', 'max_employees' => 0]);

        $this->postJson('/api/v1/employees', ['username' => 'e1', 'password' => 'p'], $this->authAs())
            ->assertStatus(400)
            ->assertExactJson(['error' => Messages::maxEmployees(0)]);
    }

    public function test_an_employee_cannot_create_employees(): void
    {
        // There is no role middleware: an employee is created with max_employees = 0, so
        // the cap check is what blocks it — with the cap message, exactly as the
        // reference does. See EmployeeService's class docblock.
        $owner = $this->makeOwner();
        $this->makeUser([
            'username' => 'emp', 'parent_user_id' => $owner->id, 'max_employees' => 0,
        ]);

        $this->postJson('/api/v1/employees', ['username' => 'sub', 'password' => 'p'], $this->authAs('emp'))
            ->assertStatus(400)
            ->assertExactJson(['error' => Messages::maxEmployees(0)]);

        $this->assertSame(0, AppUser::query()->where('username', 'sub')->count());
    }

    // ── duplicate username ───────────────────────────────────────────────────

    public function test_a_duplicate_username_is_rejected(): void
    {
        $this->makeOwner();
        $auth = $this->authAs();

        $this->postJson('/api/v1/employees', ['username' => 'dup', 'password' => 'p'], $auth)->assertOk();

        $this->postJson('/api/v1/employees', ['username' => 'dup', 'password' => 'p'], $auth)
            ->assertStatus(400)
            ->assertExactJson(['error' => Messages::USERNAME_EXISTS]);

        $this->assertSame(1, AppUser::query()->where('username', 'dup')->count());
    }

    public function test_a_username_colliding_with_another_tenant_is_rejected(): void
    {
        // Usernames are globally unique, not per-tenant.
        $this->makeOwner();
        $this->makeUser(['username' => 'taken']);

        $this->postJson('/api/v1/employees', ['username' => 'taken', 'password' => 'p'], $this->authAs())
            ->assertStatus(400)
            ->assertExactJson(['error' => Messages::USERNAME_EXISTS]);
    }

    public function test_a_rejected_duplicate_leaves_no_partial_rows(): void
    {
        $owner = $this->makeOwner();
        $owner->tabPermissions()->create(['tab_key' => 'itemcost', 'is_enabled' => true]);
        $this->makeUser(['username' => 'taken']);

        $this->postJson('/api/v1/employees', ['username' => 'taken', 'password' => 'p'], $this->authAs())
            ->assertStatus(400);

        // Only the owner's own permission row exists — nothing was inherited by a user
        // that was never created.
        $this->assertSame(1, UserTabPermission::query()->count());
        $this->assertSame(0, AppUser::query()->whereNotNull('parent_user_id')->count());
    }

    // ── tab-permission inheritance ───────────────────────────────────────────

    public function test_the_new_employee_inherits_every_owner_permission_row(): void
    {
        $owner = $this->makeOwner();
        $owner->tabPermissions()->createMany([
            ['tab_key' => 'itemcost', 'is_enabled' => true],
            ['tab_key' => 'diecut5', 'is_enabled' => false],
            ['tab_key' => 'savedquotes', 'is_enabled' => true],
        ]);

        $id = $this->postJson('/api/v1/employees', ['username' => 'emp', 'password' => 'p'], $this->authAs())
            ->assertOk()->json('employee.id');

        $inherited = UserTabPermission::query()->where('user_id', $id)
            ->orderBy('tab_key')->pluck('is_enabled', 'tab_key')->all();

        $this->assertSame(
            ['diecut5' => false, 'itemcost' => true, 'savedquotes' => true],
            $inherited
        );
    }

    public function test_the_opaque_default_tab_row_is_inherited_verbatim(): void
    {
        // `default_tab:<key>` is a value smuggled through the tab_key column; the backend
        // must not parse, validate or rewrite it.
        $owner = $this->makeOwner();
        $owner->tabPermissions()->create(['tab_key' => 'default_tab:diecut5', 'is_enabled' => true]);

        $id = $this->postJson('/api/v1/employees', ['username' => 'emp', 'password' => 'p'], $this->authAs())
            ->assertOk()->json('employee.id');

        $this->assertSame(
            ['default_tab:diecut5'],
            UserTabPermission::query()->where('user_id', $id)->pluck('tab_key')->all()
        );
    }

    public function test_an_owner_with_no_permission_rows_creates_an_employee_with_none(): void
    {
        $this->makeOwner();

        $id = $this->postJson('/api/v1/employees', ['username' => 'emp', 'password' => 'p'], $this->authAs())
            ->assertOk()->json('employee.id');

        $this->assertSame(0, UserTabPermission::query()->where('user_id', $id)->count());
    }

    public function test_inheritance_copies_only_the_callers_rows(): void
    {
        $owner = $this->makeOwner();
        $owner->tabPermissions()->create(['tab_key' => 'itemcost', 'is_enabled' => true]);

        $stranger = $this->makeUser(['username' => 'stranger']);
        $stranger->tabPermissions()->create(['tab_key' => 'secret-tab', 'is_enabled' => true]);

        $id = $this->postJson('/api/v1/employees', ['username' => 'emp', 'password' => 'p'], $this->authAs())
            ->assertOk()->json('employee.id');

        $this->assertSame(
            ['itemcost'],
            UserTabPermission::query()->where('user_id', $id)->pluck('tab_key')->all()
        );
    }

    // ── validation & auth ────────────────────────────────────────────────────

    public function test_missing_credentials_return_the_incomplete_data_body(): void
    {
        $this->makeOwner();

        $this->postJson('/api/v1/employees', ['username' => 'emp'], $this->authAs())
            ->assertOk()
            ->assertJson(['error' => Messages::INCOMPLETE_DATA])
            ->assertJsonStructure(['error', 'errors' => ['password']]);

        $this->assertSame(0, AppUser::query()->whereNotNull('parent_user_id')->count());
    }

    public function test_creating_an_employee_requires_authentication(): void
    {
        $this->postJson('/api/v1/employees', ['username' => 'emp', 'password' => 'p'])
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);
    }
}
