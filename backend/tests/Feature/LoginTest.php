<?php

namespace Tests\Feature;

use App\Models\LoginLog;
use App\Models\SessionEvent;
use App\Models\UserSession;
use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-001 (JWT claims), BE-011 (login), BE-012 (force-login).
 */
class LoginTest extends TestCase
{
    use MakesUsers, RefreshDatabase;

    // ── BE-001 · JWT claim wiring ────────────────────────────────────────────

    public function test_issued_jwt_carries_sub_role_and_the_session_token_as_jti(): void
    {
        $user = $this->makeUser();

        $jwt = $this->login()->assertOk()->json('session_token');
        $payload = JWTAuth::setToken($jwt)->getPayload();
        $session = UserSession::query()->firstOrFail();

        $this->assertSame($user->id, $payload->get('sub'));
        $this->assertSame('account_owner', $payload->get('role'));
        $this->assertSame($user->role(), $payload->get('role'));

        // The allow-list hinge: revoking the row must revoke exactly this token.
        $this->assertSame($session->session_token, $payload->get('jti'));
    }

    public function test_role_claim_reflects_each_tier(): void
    {
        $admin = $this->makeUser(['username' => 'boss', 'is_admin' => true]);
        $owner = $this->makeUser(['username' => 'owner']);
        $employee = $this->makeUser(['username' => 'worker', 'parent_user_id' => $owner->id]);

        foreach ([[$admin, 'admin'], [$owner, 'account_owner'], [$employee, 'employee']] as [$u, $role]) {
            $jwt = $this->login(['username' => $u->username, 'device_id' => "dev-{$role}"])
                ->assertOk()->json('session_token');

            $this->assertSame($role, JWTAuth::setToken($jwt)->getPayload()->get('role'));
        }
    }

    // ── BE-011 · device reuse ────────────────────────────────────────────────

    public function test_same_device_relogin_rotates_the_token_without_adding_a_session(): void
    {
        $user = $this->makeUser(['max_devices' => 1]);

        $first = $this->login(['device_id' => 'dev-1'])->assertOk()->json('session_token');
        $tokenBefore = UserSession::query()->firstOrFail()->session_token;

        $second = $this->login(['device_id' => 'dev-1', 'device_info' => 'Firefox/2'])
            ->assertOk()->assertJson(['success' => true])->json('session_token');

        // Still one row, and it is the SAME row — reused, not recreated.
        $this->assertSame(1, UserSession::query()->where('user_id', $user->id)->count());
        $session = UserSession::query()->firstOrFail();
        $this->assertNotSame($tokenBefore, $session->session_token, 'token should rotate');
        $this->assertSame('Firefox/2', $session->device_info);

        // The old JWT is now revoked; the new one works.
        $this->assertNotSame($first, $second);
        $this->getJson('/api/v1/auth/me', $this->bearer($first))->assertStatus(401);
        $this->getJson('/api/v1/auth/me', $this->bearer($second))->assertOk();
    }

    public function test_device_reuse_still_writes_the_audit_rows(): void
    {
        $user = $this->makeUser(['max_devices' => 1]);
        $this->login(['device_id' => 'dev-1'])->assertOk();
        $this->login(['device_id' => 'dev-1'])->assertOk();

        $this->assertSame(2, LoginLog::query()->where('user_id', $user->id)->count());
        $this->assertDatabaseHas('session_events', ['user_id' => $user->id, 'event_type' => 'login']);
    }

    // ── BE-011 · device-limit payload ────────────────────────────────────────

    public function test_device_limit_payload_matches_the_spec_shape(): void
    {
        $user = $this->makeUser(['max_devices' => 2]);
        $this->seedSession($user, 'dev-a');
        $this->seedSession($user, 'dev-b');

        $res = $this->login(['device_id' => 'dev-c'])->assertOk();

        // The SPA renders the Arabic string and lists active_sessions for the user to pick.
        $res->assertJson([
            'success' => false,
            'error' => Messages::DEVICE_LIMIT_REACHED,
            'device_limit_reached' => true,
            'max_devices' => 2,
        ]);
        $res->assertJsonCount(2, 'active_sessions');
        $res->assertJsonStructure(['active_sessions' => [['id', 'device_info', 'last_active_at']]]);

        // No session was created by the rejected attempt.
        $this->assertSame(2, UserSession::query()->where('user_id', $user->id)->count());
    }

    public function test_null_max_devices_is_treated_as_one(): void
    {
        // Reference: `user.max_devices || 1` — 0 and NULL both mean one device.
        $user = $this->makeUser(['max_devices' => 0]);
        $this->seedSession($user, 'dev-a');

        $this->login(['device_id' => 'dev-b'])
            ->assertOk()
            ->assertJson(['device_limit_reached' => true, 'max_devices' => 1]);
    }

    // ── BE-011 · rejected credentials ────────────────────────────────────────

    public function test_deactivated_account_cannot_log_in(): void
    {
        $this->makeUser(['is_active' => false]);

        // Same message as a bad password — the reference never reveals which is wrong.
        $this->login()->assertOk()->assertExactJson(['error' => Messages::BAD_CREDENTIALS]);
        $this->assertSame(0, UserSession::query()->count());
    }

    // ── BE-011 · client IP resolution ────────────────────────────────────────

    public function test_ip_is_taken_from_x_forwarded_for_first_hop(): void
    {
        $user = $this->makeUser();

        $this->postJson(
            '/api/v1/auth/login',
            ['username' => 'tester', 'password' => 'secret123', 'device_id' => 'dev-1'],
            ['X-Forwarded-For' => '203.0.113.9, 70.41.3.18, 150.172.238.178']
        )->assertOk();

        $this->assertDatabaseHas('login_logs', [
            'user_id' => $user->id,
            'ip_address' => '203.0.113.9',
        ]);
        $this->assertDatabaseHas('session_events', [
            'user_id' => $user->id,
            'event_type' => 'login',
            'ip_address' => '203.0.113.9',
        ]);
    }

    public function test_cf_connecting_ip_is_used_when_there_is_no_forwarded_for(): void
    {
        $user = $this->makeUser();

        $this->postJson(
            '/api/v1/auth/login',
            ['username' => 'tester', 'password' => 'secret123', 'device_id' => 'dev-1'],
            ['CF-Connecting-IP' => '198.51.100.7']
        )->assertOk();

        $this->assertDatabaseHas('login_logs', ['user_id' => $user->id, 'ip_address' => '198.51.100.7']);
    }

    // ── BE-012 · force-login ─────────────────────────────────────────────────

    public function test_force_login_reuses_its_own_device_without_terminating_others(): void
    {
        $user = $this->makeUser(['max_devices' => 1]);
        $own = $this->seedSession($user, 'dev-mine');
        $other = $this->seedSession($user, 'dev-theirs');

        $this->postJson('/api/v1/auth/force-login', [
            'username' => 'tester', 'password' => 'secret123', 'device_id' => 'dev-mine',
        ])->assertOk()->assertJson(['success' => true]);

        // Own row rotated in place; the other session survives untouched.
        $this->assertDatabaseHas('user_sessions', ['id' => $own->id, 'device_id' => 'dev-mine']);
        $this->assertDatabaseHas('user_sessions', ['id' => $other->id]);
        $this->assertNotSame($own->session_token, $own->fresh()->session_token);
        $this->assertSame(0, SessionEvent::query()->where('event_type', 'auto_logout')->count());
    }

    public function test_force_login_still_over_the_cap_returns_403(): void
    {
        // Two live sessions, cap of one: terminating the oldest still leaves one.
        $user = $this->makeUser(['max_devices' => 1]);
        $this->seedSession($user, 'dev-a', now()->subHour());
        $this->seedSession($user, 'dev-b', now()->subMinutes(10));

        $this->postJson('/api/v1/auth/force-login', [
            'username' => 'tester', 'password' => 'secret123', 'device_id' => 'dev-new',
        ])->assertStatus(403)->assertJson(['error' => Messages::STILL_TOO_MANY_DEVICES]);
    }

    public function test_force_login_without_ids_terminates_the_oldest_session(): void
    {
        $user = $this->makeUser(['max_devices' => 2]);
        $oldest = $this->seedSession($user, 'dev-old', now()->subHours(5));
        $newer = $this->seedSession($user, 'dev-new', now()->subMinutes(5));

        $this->postJson('/api/v1/auth/force-login', [
            'username' => 'tester', 'password' => 'secret123', 'device_id' => 'dev-third',
        ])->assertOk()->assertJson(['success' => true]);

        $this->assertDatabaseMissing('user_sessions', ['id' => $oldest->id]);
        $this->assertDatabaseHas('user_sessions', ['id' => $newer->id]);
        $this->assertDatabaseHas('session_events', [
            'user_id' => $user->id,
            'event_type' => 'auto_logout',
            'device_id' => 'dev-old',
        ]);
    }

    public function test_force_login_rejects_bad_credentials(): void
    {
        $this->makeUser();

        $this->postJson('/api/v1/auth/force-login', [
            'username' => 'tester', 'password' => 'wrong', 'device_id' => 'dev-1',
        ])->assertOk()->assertExactJson(['error' => Messages::BAD_CREDENTIALS]);
    }
}
