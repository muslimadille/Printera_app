<?php

namespace Tests\Feature;

use App\Models\AppUser;
use App\Models\UserTabPermission;
use App\Services\TabPermissionService;
use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-041 — GET/POST /admin/users. Ports handleList / handleCreate
 * (manage-users/index.ts:378-428).
 */
class AdminUserListCreateTest extends TestCase
{
    use MakesUsers, RefreshDatabase;

    /** @return array<string,string> */
    private function adminAuth(): array
    {
        $this->makeUser(['username' => 'root', 'is_admin' => true]);

        return $this->bearer($this->login(['username' => 'root'])->json('session_token'));
    }

    // ── list ─────────────────────────────────────────────────────────────────

    public function test_lists_every_account_oldest_first(): void
    {
        $auth = $this->adminAuth();

        $this->makeUser(['username' => 'newer'])->forceFill(['created_at' => '2026-06-01 10:00:00'])->save();
        $this->makeUser(['username' => 'older'])->forceFill(['created_at' => '2026-01-01 10:00:00'])->save();
        AppUser::query()->where('username', 'root')->update(['created_at' => '2025-01-01 10:00:00']);

        $this->getJson('/api/v1/admin/users', $auth)
            ->assertOk()
            ->assertJsonCount(3, 'users')
            ->assertJsonPath('users.0.username', 'root')
            ->assertJsonPath('users.1.username', 'older')
            ->assertJsonPath('users.2.username', 'newer');
    }

    public function test_the_list_shape_adds_employees_can_view_quotes(): void
    {
        // The one reference select that includes the column (index.ts:380).
        $auth = $this->adminAuth();

        $row = $this->getJson('/api/v1/admin/users', $auth)->assertOk()->json('users.0');

        $this->assertSame([
            'id', 'username', 'is_active', 'is_admin', 'expires_at', 'created_at',
            'max_devices', 'max_employees', 'parent_user_id', 'employees_can_view_quotes',
        ], array_keys($row));
        $this->assertFalse($row['employees_can_view_quotes']);
        $this->assertArrayNotHasKey('password_hash', $row);
    }

    public function test_the_list_spans_tenants_and_includes_employees_and_admins(): void
    {
        // Unscoped by design: the admin panel is the platform operator's view.
        $auth = $this->adminAuth();
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 2]);
        $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);
        $this->makeUser(['username' => 'other-admin', 'is_admin' => true]);

        $usernames = $this->getJson('/api/v1/admin/users', $auth)->assertOk()->json('users.*.username');

        sort($usernames);
        $this->assertSame(['emp', 'other-admin', 'owner', 'root'], $usernames);
    }

    public function test_an_employee_row_carries_its_parent_id(): void
    {
        $auth = $this->adminAuth();
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 2]);
        $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);

        $rows = collect($this->getJson('/api/v1/admin/users', $auth)->json('users'))->keyBy('username');

        $this->assertSame($owner->id, $rows['emp']['parent_user_id']);
        $this->assertNull($rows['owner']['parent_user_id']);
    }

    // ── create ───────────────────────────────────────────────────────────────

    public function test_creates_an_account_with_the_reference_defaults(): void
    {
        $auth = $this->adminAuth();

        $res = $this->postJson('/api/v1/admin/users', [
            'username' => 'مطبعة النور',
            'password' => 'pw-123456',
        ], $auth)->assertOk();

        $res->assertJson(['user' => [
            'username' => 'مطبعة النور',
            'is_active' => true,
            'is_admin' => false,
            'expires_at' => null,
            'max_devices' => 2,
            'max_employees' => 0,
            'parent_user_id' => null,
        ]]);

        // create returns the PLAIN shape — employees_can_view_quotes is list-only.
        $this->assertSame([
            'id', 'username', 'is_active', 'is_admin', 'expires_at',
            'created_at', 'max_devices', 'max_employees', 'parent_user_id',
        ], array_keys($res->json('user')));
    }

    public function test_creates_an_account_with_explicit_values(): void
    {
        $auth = $this->adminAuth();

        $this->postJson('/api/v1/admin/users', [
            'username' => 'big-tenant',
            'password' => 'pw',
            'is_admin' => true,
            'expires_at' => '2027-03-31T00:00:00Z',
            'max_devices' => 5,
            'max_employees' => 12,
        ], $auth)
            ->assertOk()
            ->assertJson(['user' => [
                'is_admin' => true,
                'max_devices' => 5,
                'max_employees' => 12,
            ]]);

        $user = AppUser::query()->where('username', 'big-tenant')->firstOrFail();
        $this->assertTrue($user->is_admin);
        $this->assertSame('2027-03-31', $user->expires_at->toDateString());
    }

    public function test_falsy_values_take_the_reference_defaults(): void
    {
        // `max_devices || 2` and `expires_at || null` — JS falsy-coalescing, so a 0 and an
        // empty string do NOT survive. PHP's `??` would have kept both.
        $auth = $this->adminAuth();

        $this->postJson('/api/v1/admin/users', [
            'username' => 'falsy',
            'password' => 'pw',
            'max_devices' => 0,
            'max_employees' => 0,
            'expires_at' => '',
        ], $auth)
            ->assertOk()
            ->assertJson(['user' => [
                'max_devices' => 2,
                'max_employees' => 0,
                'expires_at' => null,
            ]]);
    }

    public function test_the_password_is_hashed_and_the_account_can_log_in(): void
    {
        $auth = $this->adminAuth();

        $this->postJson('/api/v1/admin/users', ['username' => 'newco', 'password' => 'pw-123456'], $auth)
            ->assertOk();

        $user = AppUser::query()->where('username', 'newco')->firstOrFail();
        $this->assertTrue(Hash::check('pw-123456', $user->password_hash));

        $this->login(['username' => 'newco', 'password' => 'pw-123456', 'device_id' => 'newco-dev'])
            ->assertOk()
            ->assertJson(['success' => true]);
    }

    // ── default tab permissions ──────────────────────────────────────────────

    public function test_creation_seeds_the_default_tab_permissions(): void
    {
        $auth = $this->adminAuth();

        $id = $this->postJson('/api/v1/admin/users', ['username' => 'seeded', 'password' => 'pw'], $auth)
            ->assertOk()->json('user.id');

        $rows = UserTabPermission::query()->where('user_id', $id)->pluck('is_enabled', 'tab_key');

        $enabled = $rows->filter()->keys()->sort()->values()->all();
        $disabled = $rows->reject()->keys()->sort()->values()->all();

        $expectedEnabled = TabPermissionService::DEFAULT_ENABLED;
        $expectedDisabled = TabPermissionService::DEFAULT_DISABLED;
        sort($expectedEnabled);
        sort($expectedDisabled);

        $this->assertSame($expectedEnabled, $enabled);
        $this->assertSame($expectedDisabled, $disabled);
    }

    public function test_the_seeded_sets_match_the_reference_literally(): void
    {
        // Pinned against index.ts:418-419 rather than against the constants, so editing
        // the constants cannot silently redefine "default".
        $this->assertSame(
            ['costcalc', 'savedquotes', 'settings', 'papertypes'],
            TabPermissionService::DEFAULT_ENABLED
        );
        $this->assertSame(
            ['calculator', 'employee', 'quote', 'finishing', 'magazine',
                'manual', 'boxpricing', 'guide', 'bulkimport'],
            TabPermissionService::DEFAULT_DISABLED
        );
    }

    public function test_seeding_touches_only_the_new_account(): void
    {
        $auth = $this->adminAuth();
        $bystander = $this->makeUser(['username' => 'bystander']);
        $bystander->tabPermissions()->create(['tab_key' => 'costcalc', 'is_enabled' => false]);

        $this->postJson('/api/v1/admin/users', ['username' => 'seeded', 'password' => 'pw'], $auth)->assertOk();

        $this->assertSame(1, UserTabPermission::query()->where('user_id', $bystander->id)->count());
        $this->assertFalse(
            UserTabPermission::query()->where('user_id', $bystander->id)->firstOrFail()->is_enabled
        );
    }

    // ── duplicates & validation ──────────────────────────────────────────────

    public function test_a_duplicate_username_is_rejected_and_seeds_nothing(): void
    {
        $auth = $this->adminAuth();
        $this->makeUser(['username' => 'taken']);
        $before = UserTabPermission::query()->count();

        $this->postJson('/api/v1/admin/users', ['username' => 'taken', 'password' => 'pw'], $auth)
            ->assertStatus(400)
            ->assertExactJson(['error' => Messages::USERNAME_EXISTS]);

        // Also the savepoint regression guard: on PostgreSQL the failed INSERT aborts the
        // transaction, so these queries only work because the write had one under it.
        $this->assertSame($before, UserTabPermission::query()->count());
        $this->assertSame(1, AppUser::query()->where('username', 'taken')->count());

        $this->postJson('/api/v1/admin/users', ['username' => 'free', 'password' => 'pw'], $auth)->assertOk();
    }

    public function test_missing_credentials_return_the_incomplete_data_body(): void
    {
        $auth = $this->adminAuth();

        $this->postJson('/api/v1/admin/users', ['username' => 'nopass'], $auth)
            ->assertOk()
            ->assertJson(['error' => Messages::INCOMPLETE_DATA])
            ->assertJsonStructure(['error', 'errors' => ['password']]);

        $this->assertNull(AppUser::query()->where('username', 'nopass')->first());
    }

    public function test_an_unparseable_expires_at_is_rejected(): void
    {
        $auth = $this->adminAuth();

        $this->postJson('/api/v1/admin/users', [
            'username' => 'bad-date', 'password' => 'pw', 'expires_at' => 'whenever',
        ], $auth)
            ->assertOk()
            ->assertJson(['error' => Messages::INCOMPLETE_DATA])
            ->assertJsonStructure(['error', 'errors' => ['expires_at']]);
    }

    public function test_an_admin_created_account_is_never_an_employee(): void
    {
        // parent_user_id is not settable here; employees are created by their owner
        // through POST /employees.
        $auth = $this->adminAuth();
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 2]);

        $this->postJson('/api/v1/admin/users', [
            'username' => 'top-level', 'password' => 'pw', 'parent_user_id' => $owner->id,
        ], $auth)->assertOk()->assertJson(['user' => ['parent_user_id' => null]]);
    }
}
