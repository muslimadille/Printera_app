<?php

namespace Tests\Feature;

use App\Models\UserSession;
use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-015 — POST /auth/change-password.
 *
 * Every branch of handleChangePassword (manage-users/index.ts:99-125) returns HTTP 200
 * with an Arabic business error. The strings are part of the contract: the SPA renders
 * `error` straight into the UI, so each is asserted against App\Support\Messages rather
 * than a substring.
 */
class ChangePasswordTest extends TestCase
{
    use MakesUsers, RefreshDatabase;

    /** @param  array<string,mixed>  $payload */
    private function change(array $payload): TestResponse
    {
        return $this->postJson('/api/v1/auth/change-password', $payload);
    }

    public function test_missing_fields_returns_incomplete_data(): void
    {
        $this->makeUser();

        foreach ([
            ['old_password' => 'secret123', 'new_password' => 'brandnew1'],          // no username
            ['username' => 'tester', 'new_password' => 'brandnew1'],                  // no old
            ['username' => 'tester', 'old_password' => 'secret123'],                  // no new
        ] as $payload) {
            $this->change($payload)
                ->assertOk()
                ->assertExactJson(['error' => Messages::INCOMPLETE_DATA]);
        }
    }

    public function test_new_password_shorter_than_six_is_rejected(): void
    {
        $this->makeUser();

        $this->change([
            'username' => 'tester', 'old_password' => 'secret123', 'new_password' => 'abc12',
        ])->assertOk()->assertExactJson(['error' => Messages::PASSWORD_TOO_SHORT]);
    }

    public function test_new_password_must_differ_from_old(): void
    {
        $this->makeUser();

        $this->change([
            'username' => 'tester', 'old_password' => 'secret123', 'new_password' => 'secret123',
        ])->assertOk()->assertExactJson(['error' => Messages::PASSWORD_MUST_DIFFER]);
    }

    public function test_unknown_or_inactive_user_returns_bad_credentials(): void
    {
        $this->makeUser(['username' => 'inactive', 'is_active' => false]);

        // Unknown username.
        $this->change([
            'username' => 'ghost', 'old_password' => 'secret123', 'new_password' => 'brandnew1',
        ])->assertOk()->assertExactJson(['error' => Messages::BAD_CREDENTIALS]);

        // Existing but deactivated — same message, so nothing is revealed.
        $this->change([
            'username' => 'inactive', 'old_password' => 'secret123', 'new_password' => 'brandnew1',
        ])->assertOk()->assertExactJson(['error' => Messages::BAD_CREDENTIALS]);
    }

    public function test_wrong_current_password_is_reported_distinctly(): void
    {
        $this->makeUser();

        $this->change([
            'username' => 'tester', 'old_password' => 'nope-wrong', 'new_password' => 'brandnew1',
        ])->assertOk()->assertExactJson(['error' => Messages::CURRENT_PASSWORD_WRONG]);
    }

    public function test_expired_account_cannot_change_password(): void
    {
        $this->makeUser(['expires_at' => now()->subDay()]);

        $this->change([
            'username' => 'tester', 'old_password' => 'secret123', 'new_password' => 'brandnew1',
        ])->assertOk()->assertExactJson(['error' => Messages::ACCOUNT_EXPIRED]);
    }

    public function test_success_rehashes_and_revokes_every_session(): void
    {
        $user = $this->makeUser(['max_devices' => 5]);
        $this->seedSession($user, 'dev-a');
        $this->seedSession($user, 'dev-b');
        $this->assertDatabaseCount('user_sessions', 2);

        $this->change([
            'username' => 'tester', 'old_password' => 'secret123', 'new_password' => 'brandnew1',
        ])->assertOk()->assertExactJson(['success' => true]);

        $fresh = $user->fresh();
        $this->assertTrue(Hash::check('brandnew1', $fresh->password_hash));
        $this->assertFalse(Hash::check('secret123', $fresh->password_hash));
        $this->assertSame(0, UserSession::query()->where('user_id', $user->id)->count());
    }

    public function test_expiry_is_checked_after_the_current_password(): void
    {
        // Branch order matters: an expired account with a WRONG old password must still
        // report the password problem first, matching index.ts:114-118.
        $this->makeUser(['expires_at' => now()->subDay()]);

        $this->change([
            'username' => 'tester', 'old_password' => 'wrong', 'new_password' => 'brandnew1',
        ])->assertOk()->assertExactJson(['error' => Messages::CURRENT_PASSWORD_WRONG]);
    }
}
