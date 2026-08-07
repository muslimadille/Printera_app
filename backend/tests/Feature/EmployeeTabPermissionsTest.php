<?php

namespace Tests\Feature;

use App\Models\UserTabPermission;
use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-035 — GET/PUT /employees/{id}/tab-permissions. Ports
 * handleGetEmployeeTabPermissions / handleUpdateEmployeeTabPermissions
 * (manage-users/index.ts:667-691).
 */
class EmployeeTabPermissionsTest extends TestCase
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
        $employee = $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);

        return [$owner, $employee];
    }

    // ── read ─────────────────────────────────────────────────────────────────

    public function test_returns_the_employees_permissions(): void
    {
        [, $employee] = $this->makeOwnerWithEmployee();
        $employee->tabPermissions()->createMany([
            ['tab_key' => 'itemcost', 'is_enabled' => true],
            ['tab_key' => 'diecut5', 'is_enabled' => false],
        ]);

        $this->getJson("/api/v1/employees/{$employee->id}/tab-permissions", $this->authAs())
            ->assertOk()
            ->assertExactJson(['permissions' => [
                ['tab_key' => 'diecut5', 'is_enabled' => false],
                ['tab_key' => 'itemcost', 'is_enabled' => true],
            ]]);
    }

    public function test_an_employee_with_no_permissions_returns_an_empty_array(): void
    {
        [, $employee] = $this->makeOwnerWithEmployee();

        $this->getJson("/api/v1/employees/{$employee->id}/tab-permissions", $this->authAs())
            ->assertOk()
            ->assertExactJson(['permissions' => []]);
    }

    public function test_only_the_named_employees_rows_are_returned(): void
    {
        [$owner, $employee] = $this->makeOwnerWithEmployee();
        $sibling = $this->makeUser(['username' => 'sibling', 'parent_user_id' => $owner->id]);

        $employee->tabPermissions()->create(['tab_key' => 'mine', 'is_enabled' => true]);
        $sibling->tabPermissions()->create(['tab_key' => 'siblings', 'is_enabled' => true]);
        $owner->tabPermissions()->create(['tab_key' => 'owners', 'is_enabled' => true]);

        $this->getJson("/api/v1/employees/{$employee->id}/tab-permissions", $this->authAs())
            ->assertOk()
            ->assertExactJson(['permissions' => [['tab_key' => 'mine', 'is_enabled' => true]]]);
    }

    // ── write ────────────────────────────────────────────────────────────────

    public function test_permissions_are_created_then_overwritten_in_place(): void
    {
        [, $employee] = $this->makeOwnerWithEmployee();
        $auth = $this->authAs();
        $url = "/api/v1/employees/{$employee->id}/tab-permissions";

        $this->putJson($url, ['permissions' => [
            ['tab_key' => 'itemcost', 'is_enabled' => true],
            ['tab_key' => 'diecut5', 'is_enabled' => true],
        ]], $auth)->assertOk()->assertExactJson(['success' => true]);

        $this->putJson($url, ['permissions' => [
            ['tab_key' => 'diecut5', 'is_enabled' => false],
        ]], $auth)->assertOk();

        // The upsert targets (user_id, tab_key): diecut5 flipped, itemcost untouched, and
        // no duplicate row was inserted.
        $this->assertSame(2, UserTabPermission::query()->where('user_id', $employee->id)->count());
        $this->getJson($url, $auth)->assertExactJson(['permissions' => [
            ['tab_key' => 'diecut5', 'is_enabled' => false],
            ['tab_key' => 'itemcost', 'is_enabled' => true],
        ]]);
    }

    public function test_a_put_never_removes_rows_it_did_not_mention(): void
    {
        [, $employee] = $this->makeOwnerWithEmployee();
        $employee->tabPermissions()->create(['tab_key' => 'keep-me', 'is_enabled' => true]);
        $auth = $this->authAs();

        $this->putJson("/api/v1/employees/{$employee->id}/tab-permissions", [
            'permissions' => [['tab_key' => 'new-one', 'is_enabled' => true]],
        ], $auth)->assertOk();

        $this->assertSame(
            ['keep-me', 'new-one'],
            UserTabPermission::query()->where('user_id', $employee->id)->orderBy('tab_key')->pluck('tab_key')->all()
        );
    }

    public function test_the_default_tab_row_round_trips_unchanged(): void
    {
        // tab_key is opaque. "default_tab:<key>" is a value the SPA smuggles through this
        // column; it must not be parsed, split or rewritten.
        [, $employee] = $this->makeOwnerWithEmployee();
        $auth = $this->authAs();
        $url = "/api/v1/employees/{$employee->id}/tab-permissions";

        $this->putJson($url, ['permissions' => [
            ['tab_key' => 'default_tab:diecut5', 'is_enabled' => true],
        ]], $auth)->assertOk();

        $this->getJson($url, $auth)->assertOk()->assertExactJson(['permissions' => [
            ['tab_key' => 'default_tab:diecut5', 'is_enabled' => true],
        ]]);

        // And it is updatable like any other key, not treated as a special case.
        $this->putJson($url, ['permissions' => [
            ['tab_key' => 'default_tab:diecut5', 'is_enabled' => false],
        ]], $auth)->assertOk();

        $this->assertSame(1, UserTabPermission::query()->where('user_id', $employee->id)->count());
        $this->getJson($url, $auth)->assertExactJson(['permissions' => [
            ['tab_key' => 'default_tab:diecut5', 'is_enabled' => false],
        ]]);
    }

    public function test_unusual_but_valid_tab_keys_survive(): void
    {
        [, $employee] = $this->makeOwnerWithEmployee();
        $auth = $this->authAs();
        $keys = ['default_tab:box-3d', 'حاسبة', 'a.b:c/d', str_repeat('x', 200)];

        $this->putJson("/api/v1/employees/{$employee->id}/tab-permissions", [
            'permissions' => array_map(fn (string $k) => ['tab_key' => $k, 'is_enabled' => true], $keys),
        ], $auth)->assertOk();

        $stored = UserTabPermission::query()->where('user_id', $employee->id)->pluck('tab_key')->all();
        sort($keys);
        sort($stored);
        $this->assertSame($keys, $stored);
    }

    public function test_a_missing_is_enabled_defaults_to_true(): void
    {
        // supabase-js strips the undefined, leaving the column's DEFAULT true.
        [, $employee] = $this->makeOwnerWithEmployee();

        $this->putJson("/api/v1/employees/{$employee->id}/tab-permissions", [
            'permissions' => [['tab_key' => 'itemcost']],
        ], $this->authAs())->assertOk();

        $this->assertTrue(
            UserTabPermission::query()->where('user_id', $employee->id)->firstOrFail()->is_enabled
        );
    }

    public function test_created_at_is_populated_on_insert(): void
    {
        // The model has $timestamps = false, so this comes from the column default.
        [, $employee] = $this->makeOwnerWithEmployee();

        $this->putJson("/api/v1/employees/{$employee->id}/tab-permissions", [
            'permissions' => [['tab_key' => 'itemcost', 'is_enabled' => true]],
        ], $this->authAs())->assertOk();

        $this->assertNotNull(
            UserTabPermission::query()->where('user_id', $employee->id)->firstOrFail()->created_at
        );
    }

    public function test_an_empty_permissions_array_is_an_accepted_no_op(): void
    {
        [, $employee] = $this->makeOwnerWithEmployee();
        $employee->tabPermissions()->create(['tab_key' => 'itemcost', 'is_enabled' => true]);

        $this->putJson("/api/v1/employees/{$employee->id}/tab-permissions", ['permissions' => []], $this->authAs())
            ->assertOk()
            ->assertExactJson(['success' => true]);

        $this->assertSame(1, UserTabPermission::query()->where('user_id', $employee->id)->count());
    }

    public function test_malformed_entries_are_skipped_without_failing_the_batch(): void
    {
        [, $employee] = $this->makeOwnerWithEmployee();

        $this->putJson("/api/v1/employees/{$employee->id}/tab-permissions", [
            'permissions' => [
                ['is_enabled' => true],
                ['tab_key' => '', 'is_enabled' => true],
                ['tab_key' => 123, 'is_enabled' => true],
                'not-an-array',
                ['tab_key' => 'itemcost', 'is_enabled' => true],
            ],
        ], $this->authAs())->assertOk()->assertExactJson(['success' => true]);

        $this->assertSame(
            ['itemcost'],
            UserTabPermission::query()->where('user_id', $employee->id)->pluck('tab_key')->all()
        );
    }

    public function test_a_missing_permissions_key_returns_the_incomplete_data_body(): void
    {
        [, $employee] = $this->makeOwnerWithEmployee();

        $this->putJson("/api/v1/employees/{$employee->id}/tab-permissions", [], $this->authAs())
            ->assertOk()
            ->assertJson(['error' => Messages::INCOMPLETE_DATA])
            ->assertJsonStructure(['error', 'errors' => ['permissions']]);
    }

    // ── ownership gate ───────────────────────────────────────────────────────

    public function test_another_owners_employee_permissions_cannot_be_read(): void
    {
        $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $stranger = $this->makeUser(['username' => 'stranger', 'max_employees' => 5]);
        $theirs = $this->makeUser(['username' => 'theirs', 'parent_user_id' => $stranger->id]);
        $theirs->tabPermissions()->create(['tab_key' => 'secret', 'is_enabled' => true]);

        $this->getJson("/api/v1/employees/{$theirs->id}/tab-permissions", $this->authAs())
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);
    }

    public function test_another_owners_employee_permissions_cannot_be_written(): void
    {
        $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $stranger = $this->makeUser(['username' => 'stranger', 'max_employees' => 5]);
        $theirs = $this->makeUser(['username' => 'theirs', 'parent_user_id' => $stranger->id]);

        $this->putJson("/api/v1/employees/{$theirs->id}/tab-permissions", [
            'permissions' => [['tab_key' => 'itemcost', 'is_enabled' => true]],
        ], $this->authAs())
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);

        $this->assertSame(0, UserTabPermission::query()->where('user_id', $theirs->id)->count());
    }

    public function test_an_employee_cannot_grant_itself_permissions(): void
    {
        // The gate needs parent_user_id = caller.id, which no employee satisfies for its
        // own row. This is the escalation path the ownership rule exists to close.
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);
        $employee = $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);

        $this->putJson("/api/v1/employees/{$employee->id}/tab-permissions", [
            'permissions' => [['tab_key' => 'admin-only', 'is_enabled' => true]],
        ], $this->authAs('emp'))
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);

        $this->assertSame(0, UserTabPermission::query()->count());
    }

    public function test_an_owner_cannot_edit_its_own_permissions_here(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 5]);

        $this->putJson("/api/v1/employees/{$owner->id}/tab-permissions", [
            'permissions' => [['tab_key' => 'itemcost', 'is_enabled' => true]],
        ], $this->authAs())
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);
    }

    public function test_tab_permission_endpoints_require_authentication(): void
    {
        $id = fake()->uuid();

        $this->getJson("/api/v1/employees/{$id}/tab-permissions")
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);

        $this->putJson("/api/v1/employees/{$id}/tab-permissions", ['permissions' => []])
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);
    }

    public function test_permissions_survive_the_owner_editing_a_sibling(): void
    {
        [$owner, $employee] = $this->makeOwnerWithEmployee();
        $sibling = $this->makeUser(['username' => 'sibling', 'parent_user_id' => $owner->id]);
        $employee->tabPermissions()->create(['tab_key' => 'itemcost', 'is_enabled' => true]);

        $this->putJson("/api/v1/employees/{$sibling->id}/tab-permissions", [
            'permissions' => [['tab_key' => 'itemcost', 'is_enabled' => false]],
        ], $this->authAs())->assertOk();

        $this->assertTrue(
            UserTabPermission::query()->where('user_id', $employee->id)->firstOrFail()->is_enabled
        );
        $this->assertFalse(
            UserTabPermission::query()->where('user_id', $sibling->id)->firstOrFail()->is_enabled
        );
    }
}
