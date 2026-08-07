<?php

namespace Tests\Feature;

use App\Models\AppUser;
use App\Models\UserSession;
use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-040 — the role.admin gate on /api/v1/admin/*. Replaces verifyAdmin
 * (manage-users/index.ts:40-52), which took admin_username + admin_password in every
 * request body.
 */
class AdminGuardTest extends TestCase
{
    use MakesUsers, RefreshDatabase;

    /**
     * Every admin route, so a future addition cannot quietly land outside the gate.
     *
     * @return array<int,array{0:string,1:string}>
     */
    public static function adminRoutes(): array
    {
        return [
            ['get', '/api/v1/admin/users'],
            ['post', '/api/v1/admin/users'],
            ['patch', '/api/v1/admin/users/00000000-0000-0000-0000-000000000000'],
            ['delete', '/api/v1/admin/users/00000000-0000-0000-0000-000000000000'],
            ['get', '/api/v1/admin/users/00000000-0000-0000-0000-000000000000/tab-permissions'],
            ['put', '/api/v1/admin/users/00000000-0000-0000-0000-000000000000/tab-permissions'],
            ['get', '/api/v1/admin/users/00000000-0000-0000-0000-000000000000/sessions'],
            ['delete', '/api/v1/admin/sessions/00000000-0000-0000-0000-000000000000'],
            ['get', '/api/v1/admin/login-logs'],
            ['get', '/api/v1/admin/analytics'],
        ];
    }

    /** @return array<string,string> */
    private function authAs(string $username, string $device = 'dev-1'): array
    {
        return $this->bearer(
            $this->login(['username' => $username, 'device_id' => $device])->json('session_token')
        );
    }

    private function makeAdmin(): AppUser
    {
        return $this->makeUser(['username' => 'root', 'is_admin' => true]);
    }

    /**
     * A route carrying the real admin stack, so the pass-through cases test the gate
     * itself rather than whichever Phase 4 endpoint happens to be implemented.
     */
    private function probeRoute(): string
    {
        Route::middleware(['session.active', 'role.admin'])
            ->get('/test-admin-probe', fn () => response()->json(['ok' => true]));

        return '/test-admin-probe';
    }

    #[DataProvider('adminRoutes')]
    public function test_an_account_owner_is_refused(string $method, string $url): void
    {
        $this->makeUser(['username' => 'owner']);

        $this->json($method, $url, [], $this->authAs('owner'))
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);
    }

    #[DataProvider('adminRoutes')]
    public function test_an_anonymous_caller_is_refused(string $method, string $url): void
    {
        // 401, not 403: session.active runs first, so an unauthenticated caller never
        // reaches the admin gate.
        $this->json($method, $url)
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);
    }

    public function test_an_employee_is_refused(): void
    {
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 2]);
        $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);

        $this->getJson('/api/v1/admin/users', $this->authAs('emp'))
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);
    }

    public function test_an_admin_is_allowed_through(): void
    {
        $this->makeAdmin();

        $this->getJson($this->probeRoute(), $this->authAs('root'))
            ->assertOk()
            ->assertExactJson(['ok' => true]);
    }

    // ── the credentials are gone ─────────────────────────────────────────────

    public function test_body_admin_credentials_do_not_grant_access(): void
    {
        // The old contract: any caller could send admin_username + admin_password and be
        // treated as an admin. Those keys must now be inert.
        $this->makeAdmin();
        $this->makeUser(['username' => 'owner']);

        $this->postJson('/api/v1/admin/users', [
            'admin_username' => 'root',
            'admin_password' => 'secret123',
            'username' => 'planted',
            'password' => 'p',
        ], $this->authAs('owner'))
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);

        $this->assertNull(AppUser::query()->where('username', 'planted')->first());
    }

    public function test_the_legacy_admin_messages_are_never_returned(): void
    {
        $this->makeUser(['username' => 'owner']);

        $body = $this->getJson('/api/v1/admin/users', $this->authAs('owner'))->assertStatus(403)->content();

        // Messages.php keeps these constants for historical reference only; the JWT gate
        // has no branch that can produce them.
        $this->assertStringNotContainsString(Messages::ADMIN_LOGIN_REQUIRED, $body);
        $this->assertStringNotContainsString(Messages::ADMIN_PASSWORD_WRONG, $body);
    }

    // ── the gate composes with the session allow-list ────────────────────────

    public function test_a_revoked_admin_token_is_refused_by_the_session_layer(): void
    {
        $this->makeAdmin();
        $auth = $this->authAs('root');
        $probe = $this->probeRoute();

        $this->getJson($probe, $auth)->assertOk();

        UserSession::query()->delete();

        $this->getJson($probe, $auth)
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);
    }

    public function test_a_deactivated_admin_is_refused(): void
    {
        $admin = $this->makeAdmin();
        $auth = $this->authAs('root');
        $probe = $this->probeRoute();

        $admin->forceFill(['is_active' => false])->save();

        $this->getJson($probe, $auth)
            ->assertStatus(401)
            ->assertJson(['error' => Messages::ACCOUNT_DISABLED, 'session_expired' => true]);
    }

    public function test_a_demoted_admin_loses_access_on_the_next_request(): void
    {
        // The gate reads is_admin from the row the session layer loaded, not from the JWT
        // `role` claim — so revoking the role takes effect immediately rather than at the
        // token's 30-day expiry.
        $admin = $this->makeAdmin();
        $auth = $this->authAs('root');
        $probe = $this->probeRoute();

        $this->getJson($probe, $auth)->assertOk();

        $admin->forceFill(['is_admin' => false])->save();

        $this->getJson($probe, $auth)
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);
    }

    public function test_the_gate_fails_closed_without_the_session_middleware(): void
    {
        // EnsureAdmin reads only the attribute EnsureSessionActive sets. Registered alone,
        // it must refuse even a structurally valid admin JWT rather than resolving the
        // caller from the token itself and skipping the revocation allow-list.
        $this->makeAdmin();
        $auth = $this->authAs('root');

        Route::middleware('role.admin')->get('/test-admin-only', fn () => response()->json(['ok' => true]));

        $this->getJson('/test-admin-only', $auth)
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);
    }
}
