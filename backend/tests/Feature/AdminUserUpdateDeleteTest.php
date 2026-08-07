<?php

namespace Tests\Feature;

use App\Models\AppUser;
use App\Models\SavedQuote;
use App\Models\UserSession;
use App\Models\UserSetting;
use App\Models\UserTabPermission;
use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-042 — PATCH/DELETE /admin/users/{id}. Ports handleUpdate / handleDelete
 * (manage-users/index.ts:431-458).
 */
class AdminUserUpdateDeleteTest extends TestCase
{
    use MakesUsers, RefreshDatabase;

    /** @return array<string,string> */
    private function adminAuth(): array
    {
        $this->makeUser(['username' => 'root', 'is_admin' => true]);

        return $this->bearer($this->login(['username' => 'root'])->json('session_token'));
    }

    private function quoteFor(AppUser $user, string $title): SavedQuote
    {
        return $user->quotes()->create([
            'title' => $title,
            'customer_name' => '',
            'quote_number' => '',
            'source_type' => 'calculator',
            'quote_data' => [],
        ]);
    }

    // ── update ───────────────────────────────────────────────────────────────

    public function test_updates_every_supported_field(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        $this->patchJson("/api/v1/admin/users/{$user->id}", [
            'username' => 'مطبعة مُحدَّثة',
            'is_active' => false,
            'is_admin' => true,
            'expires_at' => '2028-12-31T00:00:00Z',
            'max_devices' => 9,
            'max_employees' => 25,
        ], $auth)
            ->assertOk()
            ->assertJson(['user' => [
                'id' => $user->id,
                'username' => 'مطبعة مُحدَّثة',
                'is_active' => false,
                'is_admin' => true,
                'max_devices' => 9,
                'max_employees' => 25,
            ]]);

        $user->refresh();
        $this->assertTrue($user->is_admin);
        $this->assertFalse($user->is_active);
        $this->assertSame('2028-12-31', $user->expires_at->toDateString());
    }

    public function test_absent_keys_are_left_alone(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant', 'max_devices' => 3, 'max_employees' => 4]);

        $this->patchJson("/api/v1/admin/users/{$user->id}", ['max_devices' => 8], $auth)->assertOk();

        $user->refresh();
        $this->assertSame('tenant', $user->username);
        $this->assertSame(8, $user->max_devices);
        $this->assertSame(4, $user->max_employees);
        $this->assertTrue($user->is_active);
    }

    public function test_the_update_response_omits_employees_can_view_quotes(): void
    {
        // Only the list carries it (index.ts:380 vs 440).
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        $row = $this->patchJson("/api/v1/admin/users/{$user->id}", ['max_devices' => 3], $auth)
            ->assertOk()->json('user');

        $this->assertSame([
            'id', 'username', 'is_active', 'is_admin', 'expires_at',
            'created_at', 'max_devices', 'max_employees', 'parent_user_id',
        ], array_keys($row));
    }

    public function test_the_subscription_can_be_extended_and_cleared(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant', 'expires_at' => '2020-01-01 00:00:00']);

        // Expired: login is refused.
        $this->login(['username' => 'tenant', 'device_id' => 'd'])
            ->assertOk()
            ->assertJson(['error' => Messages::ACCOUNT_EXPIRED]);

        $this->patchJson("/api/v1/admin/users/{$user->id}", ['expires_at' => null], $auth)->assertOk();

        $this->assertNull($user->refresh()->expires_at);
        $this->login(['username' => 'tenant', 'device_id' => 'd'])->assertOk()->assertJson(['success' => true]);
    }

    public function test_an_empty_expires_at_clears_the_subscription(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant', 'expires_at' => '2030-01-01 00:00:00']);

        $this->patchJson("/api/v1/admin/users/{$user->id}", ['expires_at' => ''], $auth)->assertOk();

        $this->assertNull($user->refresh()->expires_at);
    }

    // ── password reset ───────────────────────────────────────────────────────

    public function test_an_admin_password_reset_replaces_the_credential(): void
    {
        // With no email in the product (a locked decision), this is the intended
        // password-recovery path — 04-ADMIN-CONTROL-PANEL-SPEC.md §5.
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        $this->patchJson("/api/v1/admin/users/{$user->id}", ['password' => 'reset-9999'], $auth)->assertOk();

        $user->refresh();
        $this->assertTrue(Hash::check('reset-9999', $user->password_hash));
        $this->assertFalse(Hash::check('secret123', $user->password_hash));

        $this->login(['username' => 'tenant', 'password' => 'reset-9999', 'device_id' => 'd'])
            ->assertOk()
            ->assertJson(['success' => true]);
    }

    public function test_an_empty_password_is_ignored_rather_than_hashed(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $before = $user->password_hash;

        $this->patchJson("/api/v1/admin/users/{$user->id}", ['password' => ''], $auth)->assertOk();

        $this->assertSame($before, $user->refresh()->password_hash);
    }

    public function test_the_password_hash_is_never_returned(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        $this->patchJson("/api/v1/admin/users/{$user->id}", ['password' => 'x'], $auth)
            ->assertOk()
            ->assertJsonMissingPath('user.password_hash')
            ->assertJsonMissingPath('user.password');
    }

    // ── scope & errors ───────────────────────────────────────────────────────

    public function test_an_admin_may_edit_any_account_including_another_tenants_employee(): void
    {
        $auth = $this->adminAuth();
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 2]);
        $employee = $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);

        $this->patchJson("/api/v1/admin/users/{$employee->id}", ['max_devices' => 4], $auth)->assertOk();

        $this->assertSame(4, $employee->refresh()->max_devices);
        $this->assertSame($owner->id, $employee->parent_user_id);
    }

    public function test_an_unknown_id_returns_the_target_not_found_message(): void
    {
        $auth = $this->adminAuth();

        $this->patchJson('/api/v1/admin/users/'.fake()->uuid(), ['max_devices' => 2], $auth)
            ->assertStatus(400)
            ->assertExactJson(['error' => Messages::TARGET_USER_NOT_FOUND]);
    }

    public function test_a_username_taken_by_someone_else_is_rejected(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $this->makeUser(['username' => 'taken']);

        $this->patchJson("/api/v1/admin/users/{$user->id}", ['username' => 'taken'], $auth)
            ->assertStatus(400)
            ->assertExactJson(['error' => Messages::USERNAME_EXISTS]);

        // Savepoint regression guard — see RejectsDuplicateUsernames.
        $this->assertSame('tenant', $user->refresh()->username);
        $this->patchJson("/api/v1/admin/users/{$user->id}", ['username' => 'free'], $auth)->assertOk();
    }

    public function test_a_non_boolean_is_admin_is_rejected(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        $this->patchJson("/api/v1/admin/users/{$user->id}", ['is_admin' => 'yes'], $auth)
            ->assertOk()
            ->assertJson(['error' => Messages::INCOMPLETE_DATA])
            ->assertJsonStructure(['error', 'errors' => ['is_admin']]);

        $this->assertFalse($user->refresh()->is_admin);
    }

    public function test_deactivating_an_account_blocks_its_live_session(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $tenantAuth = $this->bearer(
            $this->login(['username' => 'tenant', 'device_id' => 'd'])->json('session_token')
        );

        $this->getJson('/api/v1/settings', $tenantAuth)->assertOk();

        $this->patchJson("/api/v1/admin/users/{$user->id}", ['is_active' => false], $auth)->assertOk();

        $this->getJson('/api/v1/settings', $tenantAuth)
            ->assertStatus(401)
            ->assertJson(['error' => Messages::ACCOUNT_DISABLED, 'session_expired' => true]);
    }

    // ── delete ───────────────────────────────────────────────────────────────

    public function test_deletes_an_account_and_cascades_its_own_rows(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        $this->quoteFor($user, 'gone');
        $user->settings()->create(['setting_key' => 'paperTypes', 'setting_value' => ['x' => 1]]);
        $user->tabPermissions()->create(['tab_key' => 'costcalc', 'is_enabled' => true]);
        $this->seedSession($user, 'tenant-dev');

        $this->deleteJson("/api/v1/admin/users/{$user->id}", [], $auth)
            ->assertOk()
            ->assertExactJson(['success' => true]);

        $this->assertNull(AppUser::query()->find($user->id));
        $this->assertSame(0, SavedQuote::query()->where('user_id', $user->id)->count());
        $this->assertSame(0, UserSetting::query()->where('user_id', $user->id)->count());
        $this->assertSame(0, UserTabPermission::query()->where('user_id', $user->id)->count());
        $this->assertSame(0, UserSession::query()->where('user_id', $user->id)->count());
    }

    public function test_deleting_an_owner_cascades_through_its_employees(): void
    {
        // app_users.parent_user_id cascades, so the employees go too — and with them
        // everything THEY own. This is the irreversible operation the spec warns about.
        $auth = $this->adminAuth();
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 3]);
        $employee = $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);
        $employeeQuote = $this->quoteFor($employee, 'employee quote');
        $this->seedSession($employee, 'emp-dev');

        $bystander = $this->makeUser(['username' => 'bystander']);
        $this->quoteFor($bystander, 'survives');

        $this->deleteJson("/api/v1/admin/users/{$owner->id}", [], $auth)->assertOk();

        $this->assertNull(AppUser::query()->find($employee->id));
        $this->assertNull(SavedQuote::query()->find($employeeQuote->id));
        $this->assertSame(0, UserSession::query()->where('user_id', $employee->id)->count());

        $this->assertNotNull(AppUser::query()->find($bystander->id));
        $this->assertSame(1, SavedQuote::query()->where('user_id', $bystander->id)->count());
    }

    public function test_deleting_an_unknown_id_is_an_idempotent_success(): void
    {
        // Matches the reference: `delete().eq("id", …)` on a missing row is not an error.
        // The postcondition holds either way, unlike PATCH, which has nothing to return.
        $auth = $this->adminAuth();

        $this->deleteJson('/api/v1/admin/users/'.fake()->uuid(), [], $auth)
            ->assertOk()
            ->assertExactJson(['success' => true]);
    }

    public function test_deleting_an_account_revokes_its_token_immediately(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $tenantAuth = $this->bearer(
            $this->login(['username' => 'tenant', 'device_id' => 'd'])->json('session_token')
        );

        $this->getJson('/api/v1/settings', $tenantAuth)->assertOk();

        $this->deleteJson("/api/v1/admin/users/{$user->id}", [], $auth)->assertOk();

        $this->getJson('/api/v1/settings', $tenantAuth)
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);
    }

    public function test_an_admin_can_delete_its_own_account(): void
    {
        // The reference has no self-delete guard and neither does this port — flagged in
        // PHASE-0-1-AUDIT.md rather than silently changed. The cascade kills the caller's
        // own session, so the very next request with that token is a 401.
        $auth = $this->adminAuth();
        $admin = AppUser::query()->where('username', 'root')->firstOrFail();

        $this->deleteJson("/api/v1/admin/users/{$admin->id}", [], $auth)
            ->assertOk()
            ->assertExactJson(['success' => true]);

        $this->assertNull(AppUser::query()->find($admin->id));
        $this->getJson('/api/v1/admin/users', $auth)
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);
    }
}
