<?php

namespace Tests\Feature;

use App\Models\AppUser;
use App\Models\UserTabPermission;
use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-043 — GET/PUT /admin/users/{id}/tab-permissions. Ports handleGetTabPermissions /
 * handleUpdateTabPermissions (manage-users/index.ts:460-477).
 *
 * Same reads and writes as BE-035; what this file pins is the difference — no ownership
 * scope, so an admin reaches any account.
 */
class AdminTabPermissionsTest extends TestCase
{
    use MakesUsers, RefreshDatabase;

    /** @return array<string,string> */
    private function adminAuth(): array
    {
        $this->makeUser(['username' => 'root', 'is_admin' => true]);

        return $this->bearer($this->login(['username' => 'root'])->json('session_token'));
    }

    private function url(AppUser $user): string
    {
        return "/api/v1/admin/users/{$user->id}/tab-permissions";
    }

    // ── read ─────────────────────────────────────────────────────────────────

    public function test_returns_a_users_permissions(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $user->tabPermissions()->createMany([
            ['tab_key' => 'costcalc', 'is_enabled' => true],
            ['tab_key' => 'boxpricing', 'is_enabled' => false],
        ]);

        $this->getJson($this->url($user), $auth)
            ->assertOk()
            ->assertExactJson(['permissions' => [
                ['tab_key' => 'boxpricing', 'is_enabled' => false],
                ['tab_key' => 'costcalc', 'is_enabled' => true],
            ]]);
    }

    public function test_a_user_with_no_permissions_returns_an_empty_array(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        $this->getJson($this->url($user), $auth)->assertOk()->assertExactJson(['permissions' => []]);
    }

    public function test_an_admin_reaches_across_tenants(): void
    {
        // The account-owner endpoint would answer 403 here; the admin one must not.
        $auth = $this->adminAuth();
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 2]);
        $employee = $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);
        $employee->tabPermissions()->create(['tab_key' => 'diecut5', 'is_enabled' => true]);

        $this->getJson($this->url($employee), $auth)
            ->assertOk()
            ->assertExactJson(['permissions' => [['tab_key' => 'diecut5', 'is_enabled' => true]]]);
    }

    // ── write ────────────────────────────────────────────────────────────────

    public function test_permissions_are_created_then_overwritten_in_place(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        $this->putJson($this->url($user), ['permissions' => [
            ['tab_key' => 'costcalc', 'is_enabled' => true],
            ['tab_key' => 'magazine', 'is_enabled' => true],
        ]], $auth)->assertOk()->assertExactJson(['success' => true]);

        $this->putJson($this->url($user), ['permissions' => [
            ['tab_key' => 'magazine', 'is_enabled' => false],
        ]], $auth)->assertOk();

        $this->assertSame(2, UserTabPermission::query()->where('user_id', $user->id)->count());
        $this->getJson($this->url($user), $auth)->assertExactJson(['permissions' => [
            ['tab_key' => 'costcalc', 'is_enabled' => true],
            ['tab_key' => 'magazine', 'is_enabled' => false],
        ]]);
    }

    public function test_the_default_tab_row_round_trips_unchanged(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        $this->putJson($this->url($user), ['permissions' => [
            ['tab_key' => 'default_tab:boxpricing', 'is_enabled' => true],
        ]], $auth)->assertOk();

        $this->getJson($this->url($user), $auth)->assertOk()->assertExactJson(['permissions' => [
            ['tab_key' => 'default_tab:boxpricing', 'is_enabled' => true],
        ]]);
    }

    public function test_an_admin_can_retune_the_seeded_defaults(): void
    {
        // The realistic flow: create an account, then switch a secondary tab on.
        $auth = $this->adminAuth();

        $id = $this->postJson('/api/v1/admin/users', ['username' => 'newco', 'password' => 'pw'], $auth)
            ->assertOk()->json('user.id');
        $user = AppUser::query()->findOrFail($id);

        $this->assertFalse(
            UserTabPermission::query()->where('user_id', $id)->where('tab_key', 'magazine')->firstOrFail()->is_enabled
        );

        $this->putJson($this->url($user), ['permissions' => [
            ['tab_key' => 'magazine', 'is_enabled' => true],
        ]], $auth)->assertOk();

        $this->assertTrue(
            UserTabPermission::query()->where('user_id', $id)->where('tab_key', 'magazine')->firstOrFail()->is_enabled
        );
        // Still 13 rows — the PUT edits, it does not replace the set.
        $this->assertSame(13, UserTabPermission::query()->where('user_id', $id)->count());
    }

    public function test_a_put_never_removes_rows_it_did_not_mention(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $user->tabPermissions()->create(['tab_key' => 'keep-me', 'is_enabled' => true]);

        $this->putJson($this->url($user), [
            'permissions' => [['tab_key' => 'new-one', 'is_enabled' => true]],
        ], $auth)->assertOk();

        $this->assertSame(
            ['keep-me', 'new-one'],
            UserTabPermission::query()->where('user_id', $user->id)->orderBy('tab_key')->pluck('tab_key')->all()
        );
    }

    public function test_a_missing_is_enabled_defaults_to_true(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        $this->putJson($this->url($user), ['permissions' => [['tab_key' => 'costcalc']]], $auth)->assertOk();

        $this->assertTrue(
            UserTabPermission::query()->where('user_id', $user->id)->firstOrFail()->is_enabled
        );
    }

    public function test_malformed_entries_are_skipped_without_failing_the_batch(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        $this->putJson($this->url($user), ['permissions' => [
            ['is_enabled' => true],
            ['tab_key' => '', 'is_enabled' => true],
            'not-an-array',
            ['tab_key' => 'costcalc', 'is_enabled' => true],
        ]], $auth)->assertOk()->assertExactJson(['success' => true]);

        $this->assertSame(
            ['costcalc'],
            UserTabPermission::query()->where('user_id', $user->id)->pluck('tab_key')->all()
        );
    }

    public function test_an_empty_permissions_array_is_an_accepted_no_op(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $user->tabPermissions()->create(['tab_key' => 'costcalc', 'is_enabled' => true]);

        $this->putJson($this->url($user), ['permissions' => []], $auth)
            ->assertOk()
            ->assertExactJson(['success' => true]);

        $this->assertSame(1, UserTabPermission::query()->where('user_id', $user->id)->count());
    }

    // ── errors ───────────────────────────────────────────────────────────────

    public function test_an_unknown_user_is_reported_rather_than_silently_accepted(): void
    {
        // The reference returns { permissions: [] } for a read and { success: true } for a
        // write that inserted nothing. Both lie to the admin panel.
        $auth = $this->adminAuth();
        $id = fake()->uuid();

        $this->getJson("/api/v1/admin/users/{$id}/tab-permissions", $auth)
            ->assertStatus(400)
            ->assertExactJson(['error' => Messages::TARGET_USER_NOT_FOUND]);

        $this->putJson("/api/v1/admin/users/{$id}/tab-permissions", [
            'permissions' => [['tab_key' => 'costcalc', 'is_enabled' => true]],
        ], $auth)
            ->assertStatus(400)
            ->assertExactJson(['error' => Messages::TARGET_USER_NOT_FOUND]);

        $this->assertSame(0, UserTabPermission::query()->count());
    }

    public function test_a_missing_permissions_key_returns_the_incomplete_data_body(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        $this->putJson($this->url($user), [], $auth)
            ->assertOk()
            ->assertJson(['error' => Messages::INCOMPLETE_DATA])
            ->assertJsonStructure(['error', 'errors' => ['permissions']]);
    }

    public function test_a_non_admin_cannot_use_the_admin_route(): void
    {
        $this->makeUser(['username' => 'owner', 'max_employees' => 2]);
        $victim = $this->makeUser(['username' => 'victim']);
        $auth = $this->bearer($this->login(['username' => 'owner'])->json('session_token'));

        $this->putJson($this->url($victim), [
            'permissions' => [['tab_key' => 'costcalc', 'is_enabled' => true]],
        ], $auth)
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);

        $this->assertSame(0, UserTabPermission::query()->where('user_id', $victim->id)->count());
    }
}
