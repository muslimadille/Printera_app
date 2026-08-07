<?php

namespace Tests\Feature;

use App\Models\AppUser;
use App\Models\SessionEvent;
use App\Models\UserSession;
use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-044 / BE-045 — GET /admin/users/{id}/sessions and DELETE /admin/sessions/{id}.
 * Ports handleGetSessions / handleTerminateSession (manage-users/index.ts:516-530).
 */
class AdminSessionsTest extends TestCase
{
    use MakesUsers, RefreshDatabase;

    /** @return array<string,string> */
    private function adminAuth(): array
    {
        $this->makeUser(['username' => 'root', 'is_admin' => true]);

        return $this->bearer($this->login(['username' => 'root'])->json('session_token'));
    }

    // ── list ─────────────────────────────────────────────────────────────────

    public function test_lists_a_users_sessions_most_recently_active_first(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant', 'max_devices' => 5]);

        $this->seedSession($user, 'stale', now()->subHours(6));
        $this->seedSession($user, 'freshest', now());
        $this->seedSession($user, 'middle', now()->subHour());

        $this->getJson("/api/v1/admin/users/{$user->id}/sessions", $auth)
            ->assertOk()
            ->assertJsonCount(3, 'sessions')
            ->assertJsonPath('sessions.0.device_id', 'freshest')
            ->assertJsonPath('sessions.1.device_id', 'middle')
            ->assertJsonPath('sessions.2.device_id', 'stale');
    }

    public function test_the_session_shape_matches_the_spec(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $session = $this->seedSession($user, 'dev-x');

        $row = $this->getJson("/api/v1/admin/users/{$user->id}/sessions", $auth)->assertOk()->json('sessions.0');

        $this->assertSame([
            'id', 'user_id', 'session_token', 'device_id', 'device_info',
            'ip_address', 'last_active_at', 'created_at',
        ], array_keys($row));

        $this->assertSame($session->id, $row['id']);
        $this->assertSame($user->id, $row['user_id']);
        $this->assertSame('dev-x', $row['device_id']);
        $this->assertSame('info-dev-x', $row['device_info']);
        $this->assertSame('203.0.113.1', $row['ip_address']);
    }

    public function test_only_the_named_users_sessions_are_listed(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $other = $this->makeUser(['username' => 'other']);

        $this->seedSession($user, 'mine');
        $this->seedSession($other, 'theirs');

        $this->getJson("/api/v1/admin/users/{$user->id}/sessions", $auth)
            ->assertOk()
            ->assertJsonCount(1, 'sessions')
            ->assertJsonPath('sessions.0.device_id', 'mine');
    }

    public function test_a_user_with_no_sessions_returns_an_empty_array(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        $this->getJson("/api/v1/admin/users/{$user->id}/sessions", $auth)
            ->assertOk()
            ->assertExactJson(['sessions' => []]);
    }

    public function test_an_unknown_user_is_reported(): void
    {
        $auth = $this->adminAuth();

        $this->getJson('/api/v1/admin/users/'.fake()->uuid().'/sessions', $auth)
            ->assertStatus(400)
            ->assertExactJson(['error' => Messages::TARGET_USER_NOT_FOUND]);
    }

    // ── terminate ────────────────────────────────────────────────────────────

    public function test_terminating_a_session_revokes_its_token_immediately(): void
    {
        // The point of the endpoint: the row IS the JWT allow-list entry.
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $tenantAuth = $this->bearer(
            $this->login(['username' => 'tenant', 'device_id' => 'd'])->json('session_token')
        );

        $this->getJson('/api/v1/settings', $tenantAuth)->assertOk();

        $session = UserSession::query()->where('user_id', $user->id)->firstOrFail();

        $this->deleteJson("/api/v1/admin/sessions/{$session->id}", [], $auth)
            ->assertOk()
            ->assertExactJson(['success' => true]);

        $this->getJson('/api/v1/settings', $tenantAuth)
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);
    }

    public function test_terminating_leaves_the_users_other_sessions_alone(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant', 'max_devices' => 5]);
        $doomed = $this->seedSession($user, 'doomed');
        $this->seedSession($user, 'survivor');

        $this->deleteJson("/api/v1/admin/sessions/{$doomed->id}", [], $auth)->assertOk();

        $remaining = UserSession::query()->where('user_id', $user->id)->pluck('device_id')->all();
        $this->assertSame(['survivor'], $remaining);
    }

    public function test_terminating_the_same_session_twice_is_idempotent(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $session = $this->seedSession($user, 'd');

        $this->deleteJson("/api/v1/admin/sessions/{$session->id}", [], $auth)->assertOk();
        $this->deleteJson("/api/v1/admin/sessions/{$session->id}", [], $auth)
            ->assertOk()
            ->assertExactJson(['success' => true]);
    }

    public function test_terminating_an_unknown_session_is_a_success(): void
    {
        $auth = $this->adminAuth();

        $this->deleteJson('/api/v1/admin/sessions/'.fake()->uuid(), [], $auth)
            ->assertOk()
            ->assertExactJson(['success' => true]);

        $this->assertSame(0, SessionEvent::query()->where('event_type', 'auto_logout')->count());
    }

    public function test_an_admin_can_terminate_its_own_session(): void
    {
        $auth = $this->adminAuth();
        $admin = AppUser::query()->where('username', 'root')->firstOrFail();
        $session = UserSession::query()->where('user_id', $admin->id)->firstOrFail();

        $this->deleteJson("/api/v1/admin/sessions/{$session->id}", [], $auth)->assertOk();

        $this->getJson('/api/v1/admin/users', $auth)
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);
    }

    // ── the audit trail ──────────────────────────────────────────────────────

    public function test_terminating_writes_an_auto_logout_event(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $session = $this->seedSession($user, 'dev-x');

        $this->deleteJson("/api/v1/admin/sessions/{$session->id}", [], $auth)->assertOk();

        $event = SessionEvent::query()->where('event_type', 'auto_logout')->firstOrFail();
        $this->assertSame($user->id, $event->user_id);
        $this->assertSame('tenant', $event->username);
        $this->assertSame('dev-x', $event->device_id);
        $this->assertSame('203.0.113.1', $event->ip_address);
    }

    public function test_the_auto_logout_event_carries_the_session_token(): void
    {
        // Carrying it lets analytics close out the real session summary. Without it the
        // event lands in a synthetic bucket — which is what force-login's own auto_logout
        // does today (AuthService), noted rather than changed here.
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $session = $this->seedSession($user, 'dev-x');
        $token = $session->session_token;

        $this->deleteJson("/api/v1/admin/sessions/{$session->id}", [], $auth)->assertOk();

        $this->assertSame(
            $token,
            SessionEvent::query()->where('event_type', 'auto_logout')->firstOrFail()->session_token
        );
    }

    public function test_the_event_is_attributed_to_the_session_owner_not_the_admin(): void
    {
        $auth = $this->adminAuth();
        $admin = AppUser::query()->where('username', 'root')->firstOrFail();
        $user = $this->makeUser(['username' => 'tenant']);
        $session = $this->seedSession($user, 'dev-x');

        $this->deleteJson("/api/v1/admin/sessions/{$session->id}", [], $auth)->assertOk();

        $event = SessionEvent::query()->where('event_type', 'auto_logout')->firstOrFail();
        $this->assertSame($user->id, $event->user_id);
        $this->assertNotSame($admin->id, $event->user_id);
    }

    // ── authorization ────────────────────────────────────────────────────────

    public function test_a_non_admin_cannot_list_or_terminate(): void
    {
        $this->makeUser(['username' => 'owner', 'max_employees' => 2]);
        $victim = $this->makeUser(['username' => 'victim']);
        $session = $this->seedSession($victim, 'victim-dev');
        $auth = $this->bearer($this->login(['username' => 'owner'])->json('session_token'));

        $this->getJson("/api/v1/admin/users/{$victim->id}/sessions", $auth)
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);

        $this->deleteJson("/api/v1/admin/sessions/{$session->id}", [], $auth)
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);

        $this->assertNotNull(UserSession::query()->find($session->id));
        $this->assertSame(0, SessionEvent::query()->where('event_type', 'auto_logout')->count());
    }
}
