<?php

namespace Tests\Feature;

use App\Models\AppUser;
use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Phase 1 acceptance tests (BE-011..016). Runs on the in-memory SQLite connection
 * configured in phpunit.xml. Requires `composer install` (pulls jwt-auth) and a
 * JWT_SECRET (phpunit.xml sets a test secret).
 */
class AuthTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(array $attrs = []): AppUser
    {
        return AppUser::query()->create(array_merge([
            'username' => 'tester',
            'password_hash' => Hash::make('secret123'),
            'is_active' => true,
            'is_admin' => false,
            'max_devices' => 1,
            'max_employees' => 0,
        ], $attrs));
    }

    public function test_health_is_public(): void
    {
        $this->getJson('/api/v1/health')->assertOk()->assertJson(['ok' => true]);
    }

    public function test_login_success_returns_jwt_and_creates_session(): void
    {
        $user = $this->makeUser();

        $res = $this->postJson('/api/v1/auth/login', [
            'username' => 'tester',
            'password' => 'secret123',
            'device_id' => 'dev-1',
        ])->assertOk()->assertJsonStructure([
            'success', 'user' => ['id', 'username', 'is_admin', 'parent_user_id'],
            'session_token', 'tab_permissions', 'settings',
        ]);

        $this->assertDatabaseCount('user_sessions', 1);
        $this->assertDatabaseHas('login_logs', ['user_id' => $user->id]);
        $this->assertDatabaseHas('session_events', ['user_id' => $user->id, 'event_type' => 'login']);
        $this->assertNotEmpty($res->json('session_token'));
    }

    public function test_bad_credentials_is_business_error_200(): void
    {
        $this->makeUser();

        $this->postJson('/api/v1/auth/login', ['username' => 'tester', 'password' => 'wrong'])
            ->assertOk()
            ->assertJson(['error' => Messages::BAD_CREDENTIALS]);
    }

    public function test_device_limit_then_force_login(): void
    {
        $user = $this->makeUser(['max_devices' => 1]);

        $this->postJson('/api/v1/auth/login', [
            'username' => 'tester', 'password' => 'secret123', 'device_id' => 'dev-1',
        ])->assertOk();

        // Second device hits the cap → device_limit payload (HTTP 200).
        $limited = $this->postJson('/api/v1/auth/login', [
            'username' => 'tester', 'password' => 'secret123', 'device_id' => 'dev-2',
        ])->assertOk()->assertJson(['device_limit_reached' => true]);

        $sessionId = $limited->json('active_sessions.0.id');

        // Force-login terminates the selected session and creates a new one.
        $this->postJson('/api/v1/auth/force-login', [
            'username' => 'tester', 'password' => 'secret123', 'device_id' => 'dev-2',
            'terminate_session_ids' => [$sessionId],
        ])->assertOk()->assertJson(['success' => true]);

        $this->assertDatabaseCount('user_sessions', 1);
        $this->assertDatabaseHas('session_events', ['user_id' => $user->id, 'event_type' => 'auto_logout']);
    }

    public function test_me_and_logout_revokes_token(): void
    {
        $this->makeUser();
        $token = $this->postJson('/api/v1/auth/login', [
            'username' => 'tester', 'password' => 'secret123', 'device_id' => 'dev-1',
        ])->json('session_token');

        $auth = ['Authorization' => "Bearer {$token}"];

        $this->getJson('/api/v1/auth/me', $auth)->assertOk()->assertJson(['valid' => true]);

        $this->postJson('/api/v1/auth/logout', [], $auth)->assertOk()->assertJson(['success' => true]);

        // Token now revoked (session row deleted) → 401 session_expired.
        $this->getJson('/api/v1/auth/me', $auth)
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);
    }

    public function test_change_password_invalidates_sessions(): void
    {
        $user = $this->makeUser();
        $this->postJson('/api/v1/auth/login', [
            'username' => 'tester', 'password' => 'secret123', 'device_id' => 'dev-1',
        ])->assertOk();

        $this->postJson('/api/v1/auth/change-password', [
            'username' => 'tester', 'old_password' => 'secret123', 'new_password' => 'brandnew1',
        ])->assertOk()->assertJson(['success' => true]);

        $this->assertDatabaseCount('user_sessions', 0);
        $this->assertTrue(Hash::check('brandnew1', $user->fresh()->password_hash));
    }

    public function test_legacy_sha256_hash_auto_migrates_to_bcrypt(): void
    {
        $user = $this->makeUser(['password_hash' => hash('sha256', 'legacypass')]);

        $this->postJson('/api/v1/auth/login', [
            'username' => 'tester', 'password' => 'legacypass', 'device_id' => 'dev-1',
        ])->assertOk();

        $fresh = $user->fresh();
        $this->assertNotEquals(hash('sha256', 'legacypass'), $fresh->password_hash);
        $this->assertTrue(Hash::check('legacypass', $fresh->password_hash));
    }
}
