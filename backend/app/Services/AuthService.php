<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Http\Resources\UserResource;
use App\Models\AppUser;
use App\Models\UserSession;
use App\Support\Messages;
use Illuminate\Support\Facades\Hash;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;

/**
 * Ports the auth actions of manage-users/index.ts: login, force_login,
 * change_password, password verification (bcrypt + legacy SHA-256 auto-migrate),
 * and JWT issuance (with the session token as the `jti`).
 */
class AuthService
{
    public function __construct(private readonly SessionService $sessions) {}

    // ── Password handling ────────────────────────────────────────────────────

    /** True if the stored hash is the legacy 64-char SHA-256 hex. */
    private function isLegacySha256(string $hash): bool
    {
        return strlen($hash) === 64 && preg_match('/^[a-f0-9]+$/', $hash) === 1;
    }

    public function verifyPassword(string $password, string $hash): bool
    {
        if ($this->isLegacySha256($hash)) {
            return hash_equals($hash, hash('sha256', $password));
        }

        return Hash::check($password, $hash);
    }

    /** Upgrade a legacy SHA-256 hash to bcrypt after a successful verification. */
    public function migrateHashIfNeeded(AppUser $user, string $password): void
    {
        if ($this->isLegacySha256($user->password_hash)) {
            $user->password_hash = Hash::make($password);
            $user->save();
        }
    }

    // ── JWT ──────────────────────────────────────────────────────────────────

    /** Issue a JWT whose `jti` is the user_sessions.session_token (allow-list key). */
    public function issueJwt(AppUser $user, string $sessionToken): string
    {
        return JWTAuth::claims(['jti' => $sessionToken])->fromUser($user);
    }

    // ── Payload builders ─────────────────────────────────────────────────────

    /**
     * The session-user shape. Delegates to UserResource so the contract has exactly one
     * definition (AGENTS.md §3 — API Resources for every response shape).
     *
     * @return array<string,mixed>
     */
    public function buildSessionUser(AppUser $u): array
    {
        return UserResource::make($u)->resolve();
    }

    /** @return array<int,array{tab_key:string,is_enabled:bool}> */
    public function tabPermissions(AppUser $user): array
    {
        return $user->tabPermissions()
            ->get(['tab_key', 'is_enabled'])
            ->map(fn ($p) => ['tab_key' => $p->tab_key, 'is_enabled' => (bool) $p->is_enabled])
            ->all();
    }

    /** @return array<string,mixed> map of setting_key => setting_value */
    public function settingsMap(AppUser $user): array
    {
        $map = [];
        foreach ($user->settings()->get(['setting_key', 'setting_value']) as $s) {
            $map[$s->setting_key] = $s->setting_value;
        }

        return $map;
    }

    /** @return array<string,mixed> the standard login/force-login success body */
    public function successPayload(AppUser $user, string $jwt): array
    {
        return [
            'success' => true,
            'user' => $this->buildSessionUser($user),
            'session_token' => $jwt,
            'tab_permissions' => $this->tabPermissions($user),
            'settings' => $this->settingsMap($user),
        ];
    }

    // ── Login ────────────────────────────────────────────────────────────────

    /**
     * @param  array{username:string,password:string,device_info?:?string,device_id?:?string}  $params
     * @return array<string,mixed>
     */
    public function login(array $params, ?string $ip): array
    {
        $user = AppUser::query()
            ->where('username', $params['username'] ?? '')
            ->where('is_active', true)
            ->first();

        if (! $user || ! $this->verifyPassword($params['password'] ?? '', $user->password_hash)) {
            throw ApiException::business(Messages::BAD_CREDENTIALS);
        }
        if ($user->expires_at !== null && $user->expires_at->isPast()) {
            throw ApiException::business(Messages::ACCOUNT_EXPIRED);
        }

        $this->migrateHashIfNeeded($user, $params['password']);
        $this->sessions->pruneIdle($user);

        $deviceId = $params['device_id'] ?? null;
        $deviceInfo = $params['device_info'] ?? null;

        // Device reuse: refresh the existing session for this device.
        if ($existing = $this->sessions->findByDevice($user, $deviceId)) {
            $token = $this->sessions->rotate($existing, $deviceInfo, $ip);
            $this->sessions->logLogin($user, $ip);
            $this->sessions->logEvent([
                'user_id' => $user->id, 'username' => $user->username, 'session_token' => $token,
                'device_id' => $deviceId, 'device_info' => $deviceInfo, 'ip_address' => $ip,
                'event_type' => 'login',
            ]);

            return $this->successPayload($user, $this->issueJwt($user, $token));
        }

        // Device limit.
        $active = $this->sessions->activeSessions($user);
        $maxDevices = $user->max_devices ?: 1;
        if ($active->count() >= $maxDevices) {
            throw ApiException::deviceLimit(
                $active->map(fn (UserSession $s) => [
                    'id' => $s->id,
                    'device_info' => $s->device_info,
                    'last_active_at' => optional($s->last_active_at)->toISOString(),
                ])->all(),
                $maxDevices
            );
        }

        $token = $this->sessions->create($user, $deviceId, $deviceInfo, $ip);
        $this->sessions->logLogin($user, $ip);
        $this->sessions->logEvent([
            'user_id' => $user->id, 'username' => $user->username, 'session_token' => $token,
            'device_id' => $deviceId, 'device_info' => $deviceInfo, 'ip_address' => $ip,
            'event_type' => 'login',
        ]);

        return $this->successPayload($user, $this->issueJwt($user, $token));
    }

    // ── Force login ──────────────────────────────────────────────────────────

    /**
     * @param  array<string,mixed>  $params
     * @return array<string,mixed>
     */
    public function forceLogin(array $params, ?string $ip): array
    {
        $user = AppUser::query()
            ->where('username', $params['username'] ?? '')
            ->where('is_active', true)
            ->first();

        if (! $user || ! $this->verifyPassword($params['password'] ?? '', $user->password_hash)) {
            throw ApiException::business(Messages::BAD_CREDENTIALS);
        }

        $this->sessions->pruneIdle($user);

        $deviceId = $params['device_id'] ?? null;
        $deviceInfo = $params['device_info'] ?? null;

        // Own-device reuse first (no deletion of others).
        if ($existing = $this->sessions->findByDevice($user, $deviceId)) {
            $token = $this->sessions->rotate($existing, $deviceInfo, $ip);
            $this->sessions->logLogin($user, $ip);
            $this->sessions->logEvent([
                'user_id' => $user->id, 'username' => $user->username, 'session_token' => $token,
                'device_id' => $deviceId, 'device_info' => $deviceInfo, 'ip_address' => $ip,
                'event_type' => 'login',
            ]);

            return $this->successPayload($user, $this->issueJwt($user, $token));
        }

        // Terminate the user-selected session (only one), else the oldest.
        $ids = array_slice((array) ($params['terminate_session_ids'] ?? []), 0, 1);
        if ($ids) {
            $target = UserSession::query()->where('id', $ids[0])->where('user_id', $user->id)->first();
        } else {
            $target = UserSession::query()->where('user_id', $user->id)
                ->orderBy('last_active_at')->first();
        }
        if ($target) {
            $this->sessions->logEvent([
                'user_id' => $user->id, 'username' => $user->username,
                'device_id' => $target->device_id, 'device_info' => $target->device_info,
                'ip_address' => $target->ip_address, 'event_type' => 'auto_logout',
            ]);
            $target->delete();
        }

        // Re-check the cap.
        $remaining = UserSession::query()->where('user_id', $user->id)->count();
        $maxDevices = $user->max_devices ?: 1;
        if ($remaining >= $maxDevices) {
            throw ApiException::forbidden(Messages::STILL_TOO_MANY_DEVICES);
        }

        $token = $this->sessions->create($user, $deviceId, $deviceInfo, $ip);
        $this->sessions->logLogin($user, $ip);
        $this->sessions->logEvent([
            'user_id' => $user->id, 'username' => $user->username, 'session_token' => $token,
            'device_id' => $deviceId, 'device_info' => $deviceInfo, 'ip_address' => $ip,
            'event_type' => 'login',
        ]);

        return $this->successPayload($user, $this->issueJwt($user, $token));
    }

    // ── Change password ──────────────────────────────────────────────────────

    /**
     * @param  array{username?:string,old_password?:string,new_password?:string}  $params
     * @return array<string,mixed>
     */
    public function changePassword(array $params): array
    {
        $username = $params['username'] ?? '';
        $old = $params['old_password'] ?? '';
        $new = $params['new_password'] ?? '';

        if ($username === '' || $old === '' || $new === '') {
            throw ApiException::business(Messages::INCOMPLETE_DATA);
        }
        if (strlen($new) < 6) {
            throw ApiException::business(Messages::PASSWORD_TOO_SHORT);
        }
        if ($new === $old) {
            throw ApiException::business(Messages::PASSWORD_MUST_DIFFER);
        }

        $user = AppUser::query()->where('username', $username)->where('is_active', true)->first();
        if (! $user) {
            throw ApiException::business(Messages::BAD_CREDENTIALS);
        }
        if (! $this->verifyPassword($old, $user->password_hash)) {
            throw ApiException::business(Messages::CURRENT_PASSWORD_WRONG);
        }
        if ($user->expires_at !== null && $user->expires_at->isPast()) {
            throw ApiException::business(Messages::ACCOUNT_EXPIRED);
        }

        $user->password_hash = Hash::make($new);
        $user->save();

        // Invalidate all sessions for security (all tokens for this user revoked).
        UserSession::query()->where('user_id', $user->id)->delete();

        return ['success' => true];
    }
}
