<?php

namespace Tests\Feature;

use App\Models\SessionEvent;
use App\Models\UserSession;
use App\Services\AuthService;
use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-010 (EnsureSessionActive), BE-013 (/auth/me), BE-014 (logout), BE-016 (idle prune).
 */
class SessionLifecycleTest extends TestCase
{
    use MakesUsers, RefreshDatabase;

    // ── BE-016 · idle prune (72h) ────────────────────────────────────────────

    public function test_idle_sessions_are_deleted_on_login(): void
    {
        $user = $this->makeUser(['max_devices' => 5]);
        $stale = $this->seedSession($user, 'dev-stale', now()->subHours(73));
        $fresh = $this->seedSession($user, 'dev-fresh', now()->subHours(71));

        $this->login(['device_id' => 'dev-new'])->assertOk()->assertJson(['success' => true]);

        $this->assertDatabaseMissing('user_sessions', ['id' => $stale->id]);
        $this->assertDatabaseHas('user_sessions', ['id' => $fresh->id]);
    }

    public function test_device_cap_frees_up_when_the_only_other_session_is_idle(): void
    {
        // The point of BE-016: a user at max_devices whose other device went idle >72h ago
        // must be able to log in on a new device WITHOUT going through force-login.
        $user = $this->makeUser(['max_devices' => 1]);
        $this->seedSession($user, 'dev-old-laptop', now()->subHours(73));

        $res = $this->login(['device_id' => 'dev-new-phone'])->assertOk();

        $res->assertJson(['success' => true]);
        $res->assertJsonMissing(['device_limit_reached' => true]);
        $this->assertSame(1, UserSession::query()->where('user_id', $user->id)->count());
        $this->assertDatabaseHas('user_sessions', ['device_id' => 'dev-new-phone']);
    }

    public function test_a_session_idle_for_less_than_the_window_still_blocks(): void
    {
        $user = $this->makeUser(['max_devices' => 1]);
        $this->seedSession($user, 'dev-old-laptop', now()->subHours(71));

        $this->login(['device_id' => 'dev-new-phone'])
            ->assertOk()
            ->assertJson(['device_limit_reached' => true]);
    }

    public function test_idle_window_is_driven_by_config_not_a_literal(): void
    {
        config(['printera.idle_session_hours' => 1]);
        $user = $this->makeUser(['max_devices' => 5]);
        $stale = $this->seedSession($user, 'dev-stale', now()->subHours(2));

        $this->login(['device_id' => 'dev-new'])->assertOk();

        $this->assertDatabaseMissing('user_sessions', ['id' => $stale->id]);
    }

    // ── BE-010 · middleware ──────────────────────────────────────────────────

    public function test_every_authenticated_request_refreshes_last_active_at(): void
    {
        $this->makeUser();
        $jwt = $this->login()->json('session_token');

        $session = UserSession::query()->firstOrFail();
        $session->forceFill(['last_active_at' => now()->subMinutes(30)])->save();

        $this->getJson('/api/v1/auth/me', $this->bearer($jwt))->assertOk();

        $this->assertTrue(
            $session->fresh()->last_active_at->greaterThan(now()->subMinute()),
            'last_active_at should have been refreshed to ~now'
        );
    }

    public function test_deactivated_account_is_rejected_with_the_arabic_string(): void
    {
        $user = $this->makeUser();
        $jwt = $this->login()->json('session_token');

        $user->forceFill(['is_active' => false])->save();

        $this->getJson('/api/v1/auth/me', $this->bearer($jwt))
            ->assertStatus(401)
            ->assertJson(['error' => Messages::ACCOUNT_DISABLED, 'session_expired' => true]);
    }

    public function test_a_jti_belonging_to_another_user_is_rejected(): void
    {
        // F6: the session row and the user come from two independent claims. A token whose
        // jti points at someone else's session must fail closed.
        $victim = $this->makeUser(['username' => 'victim']);
        $attacker = $this->makeUser(['username' => 'attacker']);
        $victimSession = $this->seedSession($victim, 'dev-victim');

        $forged = app(AuthService::class)->issueJwt($attacker, $victimSession->session_token);

        $this->getJson('/api/v1/auth/me', $this->bearer($forged))
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);
    }

    public function test_a_garbage_token_is_401_not_500(): void
    {
        $this->getJson('/api/v1/auth/me', $this->bearer('not-a-jwt'))
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);
    }

    // ── BE-013 · /auth/me + throttled heartbeat ──────────────────────────────

    public function test_me_returns_valid_user_and_fresh_tab_permissions(): void
    {
        $user = $this->makeUser();
        $user->tabPermissions()->create(['tab_key' => 'itemcost', 'is_enabled' => true]);
        $jwt = $this->login()->json('session_token');

        $this->getJson('/api/v1/auth/me', $this->bearer($jwt))
            ->assertOk()
            ->assertJson([
                'valid' => true,
                'user' => ['id' => $user->id, 'username' => 'tester'],
                'tab_permissions' => [['tab_key' => 'itemcost', 'is_enabled' => true]],
            ]);
    }

    public function test_heartbeat_event_is_written_at_most_once_per_five_minutes(): void
    {
        $this->makeUser();
        $jwt = $this->login()->json('session_token');
        $session = UserSession::query()->firstOrFail();

        $heartbeats = fn () => SessionEvent::query()->where('event_type', 'heartbeat')->count();

        // Fresh session — polling immediately must NOT log a heartbeat.
        $this->getJson('/api/v1/auth/me', $this->bearer($jwt))->assertOk();
        $this->assertSame(0, $heartbeats());

        // Older than the 5-minute throttle → exactly one heartbeat.
        $session->forceFill(['last_active_at' => now()->subMinutes(6)])->save();
        $this->getJson('/api/v1/auth/me', $this->bearer($jwt))->assertOk();
        $this->assertSame(1, $heartbeats());

        // Immediately again → still one; the middleware just reset last_active_at.
        $this->getJson('/api/v1/auth/me', $this->bearer($jwt))->assertOk();
        $this->assertSame(1, $heartbeats());
    }

    public function test_there_is_no_separate_heartbeat_endpoint(): void
    {
        // F5 is a locked decision: /auth/me is the sole poll. If someone re-adds
        // /auth/heartbeat, the throttle above silently stops firing.
        $this->makeUser();
        $jwt = $this->login()->json('session_token');

        $this->postJson('/api/v1/auth/heartbeat', [], $this->bearer($jwt))->assertStatus(404);
    }

    // ── BE-014 · logout ──────────────────────────────────────────────────────

    public function test_logout_writes_the_event_and_revokes_the_token(): void
    {
        $user = $this->makeUser();
        $jwt = $this->login()->json('session_token');

        $this->postJson('/api/v1/auth/logout', [], $this->bearer($jwt))
            ->assertOk()
            ->assertExactJson(['success' => true]);

        $this->assertDatabaseHas('session_events', [
            'user_id' => $user->id,
            'event_type' => 'logout',
        ]);
        $this->assertSame(0, UserSession::query()->count());
    }

    public function test_logging_out_twice_does_not_error(): void
    {
        // Reference handleLogout is unauthenticated and returns {success:true} for an
        // already-deleted token. Here logout sits behind the session allow-list, so the
        // second call reports the session as gone (401 session_expired) instead. No crash,
        // and the end state is identical. See PR notes / BE-014.
        $this->makeUser();
        $jwt = $this->login()->json('session_token');
        $auth = $this->bearer($jwt);

        $this->postJson('/api/v1/auth/logout', [], $auth)->assertOk();
        $this->postJson('/api/v1/auth/logout', [], $auth)
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);

        $this->assertSame(0, UserSession::query()->count());
    }

    // ── F10 · expiry parity with Supabase ────────────────────────────────────

    public function test_expired_subscription_keeps_working_until_logout(): void
    {
        // LOCKED (F10): handleVerifySession checks only is_active. An expired account with
        // a live session must keep working — only POST /auth/login rejects expiry.
        $user = $this->makeUser();
        $jwt = $this->login()->json('session_token');

        $user->forceFill(['expires_at' => now()->subDay()])->save();

        $this->getJson('/api/v1/auth/me', $this->bearer($jwt))
            ->assertOk()
            ->assertJson(['valid' => true]);
    }

    public function test_expired_user_can_still_force_login(): void
    {
        // LOCKED (F10): handleForceLogin has no expiry branch.
        $user = $this->makeUser(['max_devices' => 1, 'expires_at' => now()->subDay()]);
        $this->seedSession($user, 'dev-other');

        $this->postJson('/api/v1/auth/force-login', [
            'username' => 'tester',
            'password' => 'secret123',
            'device_id' => 'dev-new',
        ])->assertOk()->assertJson(['success' => true]);
    }

    public function test_expired_user_is_still_blocked_at_plain_login(): void
    {
        $this->makeUser(['expires_at' => now()->subDay()]);

        $this->login()->assertOk()->assertExactJson(['error' => Messages::ACCOUNT_EXPIRED]);
    }
}
