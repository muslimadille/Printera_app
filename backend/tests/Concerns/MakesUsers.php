<?php

namespace Tests\Concerns;

use App\Models\AppUser;
use App\Models\UserSession;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;

trait MakesUsers
{
    /** @param  array<string,mixed>  $attrs */
    protected function makeUser(array $attrs = []): AppUser
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

    /** @param  array<string,mixed>  $payload */
    protected function login(array $payload = []): TestResponse
    {
        return $this->postJson('/api/v1/auth/login', array_merge([
            'username' => 'tester',
            'password' => 'secret123',
            'device_id' => 'dev-1',
        ], $payload));
    }

    /** Bearer header for an issued JWT. @return array<string,string> */
    protected function bearer(string $jwt): array
    {
        return ['Authorization' => "Bearer {$jwt}"];
    }

    /** Insert a session row directly, bypassing the device cap. */
    protected function seedSession(AppUser $user, string $deviceId, ?\DateTimeInterface $lastActive = null): UserSession
    {
        return UserSession::query()->create([
            'user_id' => $user->id,
            'session_token' => bin2hex(random_bytes(32)),
            'device_id' => $deviceId,
            'device_info' => "info-{$deviceId}",
            'ip_address' => '203.0.113.1',
            'last_active_at' => $lastActive ?? now(),
            'created_at' => $lastActive ?? now(),
        ]);
    }
}
