<?php

namespace App\Services;

use App\Models\AppUser;
use App\Models\LoginLog;
use App\Models\SessionEvent;
use App\Models\UserSession;
use Illuminate\Support\Collection;

/**
 * Owns user_sessions lifecycle: token generation, device reuse, device-limit
 * counting, idle prune, and the login/session_event audit writes. Ports the
 * session helpers of manage-users/index.ts.
 */
class SessionService
{
    /** Random 256-bit opaque token (hex). Used as the JWT `jti`. */
    public function generateToken(): string
    {
        return bin2hex(random_bytes(32));
    }

    public function idleHours(): int
    {
        return (int) config('printera.idle_session_hours');
    }

    /** Delete sessions inactive beyond the idle window (>72h by default). */
    public function pruneIdle(AppUser $user): void
    {
        UserSession::query()
            ->where('user_id', $user->id)
            ->where('last_active_at', '<', now()->subHours($this->idleHours()))
            ->delete();
    }

    public function findByDevice(AppUser $user, ?string $deviceId): ?UserSession
    {
        if (! $deviceId) {
            return null;
        }

        return UserSession::query()
            ->where('user_id', $user->id)
            ->where('device_id', $deviceId)
            ->first();
    }

    /** Rotate an existing device session's token (device reuse path). */
    public function rotate(UserSession $session, ?string $deviceInfo, ?string $ip): string
    {
        $token = $this->generateToken();
        $session->session_token = $token;
        $session->device_info = $deviceInfo;
        $session->ip_address = $ip;
        $session->last_active_at = now();
        $session->save();

        return $token;
    }

    /** @return Collection<int,UserSession> ordered by last_active_at desc. */
    public function activeSessions(AppUser $user): Collection
    {
        return UserSession::query()
            ->where('user_id', $user->id)
            ->orderByDesc('last_active_at')
            ->get();
    }

    public function create(AppUser $user, ?string $deviceId, ?string $deviceInfo, ?string $ip): string
    {
        $token = $this->generateToken();
        UserSession::query()->create([
            'user_id' => $user->id,
            'session_token' => $token,
            'device_id' => $deviceId,
            'device_info' => $deviceInfo,
            'ip_address' => $ip,
            'last_active_at' => now(),
            'created_at' => now(),
        ]);

        return $token;
    }

    public function logLogin(AppUser $user, ?string $ip): void
    {
        LoginLog::query()->create([
            'user_id' => $user->id,
            'username' => $user->username,
            'ip_address' => $ip,
            'logged_in_at' => now(),
        ]);
    }

    /**
     * @param  array{user_id:string,username:string,session_token?:?string,device_id?:?string,device_info?:?string,ip_address?:?string,event_type:string}  $params
     */
    public function logEvent(array $params): void
    {
        try {
            SessionEvent::query()->create([
                'user_id' => $params['user_id'],
                'username' => $params['username'],
                'session_token' => $params['session_token'] ?? null,
                'device_id' => $params['device_id'] ?? null,
                'device_info' => $params['device_info'] ?? null,
                'ip_address' => $params['ip_address'] ?? null,
                'event_type' => $params['event_type'],
                'occurred_at' => now(),
            ]);
        } catch (\Throwable $e) {
            report($e); // audit is best-effort; never block the request
        }
    }
}
