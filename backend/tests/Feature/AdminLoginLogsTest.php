<?php

namespace Tests\Feature;

use App\Models\LoginLog;
use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-046 — GET /admin/login-logs. Ports handleLoginLogs (manage-users/index.ts:387-393).
 */
class AdminLoginLogsTest extends TestCase
{
    use MakesUsers, RefreshDatabase;

    /** @return array<string,string> */
    private function adminAuth(): array
    {
        $this->makeUser(['username' => 'root', 'is_admin' => true]);

        return $this->bearer($this->login(['username' => 'root'])->json('session_token'));
    }

    public function test_a_login_writes_a_log_row_that_the_endpoint_returns(): void
    {
        // End to end rather than from a fixture: the row is written by the login path.
        $auth = $this->adminAuth();
        $this->makeUser(['username' => 'tenant']);

        // Both logins would otherwise share a logged_in_at to the second, leaving their
        // relative order genuinely undefined rather than merely unasserted.
        $this->travel(1)->second();
        $this->login(['username' => 'tenant', 'device_id' => 'd'])->assertOk();

        $logs = $this->getJson('/api/v1/admin/login-logs', $auth)->assertOk()->json('logs');

        $this->assertCount(2, $logs);                       // root's own login + tenant's
        $this->assertSame('tenant', $logs[0]['username']);  // newest first
        $this->assertSame('root', $logs[1]['username']);
    }

    public function test_the_log_shape_matches_the_spec(): void
    {
        $auth = $this->adminAuth();

        $row = $this->getJson('/api/v1/admin/login-logs', $auth)->assertOk()->json('logs.0');

        $this->assertSame(['id', 'user_id', 'username', 'logged_in_at', 'ip_address'], array_keys($row));
        $this->assertSame('root', $row['username']);
        $this->assertNotNull($row['logged_in_at']);
    }

    public function test_logs_are_newest_first(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        foreach (['2026-01-01 08:00:00', '2026-06-01 08:00:00', '2026-03-01 08:00:00'] as $i => $at) {
            LoginLog::query()->create([
                'user_id' => $user->id,
                'username' => "seeded-{$i}",
                'ip_address' => '203.0.113.9',
                'logged_in_at' => $at,
            ]);
        }

        $usernames = $this->getJson('/api/v1/admin/login-logs', $auth)->assertOk()->json('logs.*.username');

        // root's live login is "now", so it leads; then June, March, January.
        $this->assertSame(['root', 'seeded-1', 'seeded-2', 'seeded-0'], $usernames);
    }

    public function test_the_response_is_capped_at_one_hundred_rows(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        // 120 older rows; only the newest 100 of the 121 total may come back.
        for ($i = 0; $i < 120; $i++) {
            LoginLog::query()->create([
                'user_id' => $user->id,
                'username' => 'tenant',
                'ip_address' => '203.0.113.9',
                'logged_in_at' => now()->subMinutes($i + 1),
            ]);
        }

        $logs = $this->getJson('/api/v1/admin/login-logs', $auth)->assertOk()->json('logs');

        $this->assertCount(100, $logs);
        $this->assertSame(121, LoginLog::query()->count());
        // The cap keeps the newest, not an arbitrary hundred.
        $this->assertSame('root', $logs[0]['username']);
    }

    public function test_logs_span_every_tenant(): void
    {
        $auth = $this->adminAuth();
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 2]);
        $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);

        $this->login(['username' => 'owner', 'device_id' => 'd1'])->assertOk();
        $this->login(['username' => 'emp', 'device_id' => 'd2'])->assertOk();

        $usernames = $this->getJson('/api/v1/admin/login-logs', $auth)->assertOk()->json('logs.*.username');

        sort($usernames);
        $this->assertSame(['emp', 'owner', 'root'], $usernames);
    }

    public function test_an_empty_table_returns_an_empty_array(): void
    {
        $auth = $this->adminAuth();
        LoginLog::query()->delete();

        $this->getJson('/api/v1/admin/login-logs', $auth)->assertOk()->assertExactJson(['logs' => []]);
    }

    public function test_a_non_admin_is_refused(): void
    {
        $this->makeUser(['username' => 'owner']);
        $auth = $this->bearer($this->login(['username' => 'owner'])->json('session_token'));

        $this->getJson('/api/v1/admin/login-logs', $auth)
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);
    }
}
