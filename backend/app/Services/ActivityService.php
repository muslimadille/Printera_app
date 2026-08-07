<?php

namespace App\Services;

use App\Models\ActivityEvent;
use App\Models\UserSession;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use PHPOpenSourceSaver\JWTAuth\Exceptions\JWTException;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;

/**
 * Batched in-app activity logging. Ports handleLogActivityBatch
 * (manage-users/index.ts:331-375).
 *
 * Everything here is best-effort by design: this endpoint is fired from
 * navigator.sendBeacon during page-hide, so it must never 401, never throw, and never
 * block. Failures are reported as a 200 body, exactly like the reference.
 */
class ActivityService
{
    /** Mirrors ALLOWED_ACTIONS (index.ts:332-336) and 02-DATABASE-SCHEMA.md §2.5. */
    public const ALLOWED_ACTIONS = [
        'tab_open', 'calculate', 'save_quote', 'update_quote', 'delete_quote',
        'export_pdf', 'export_excel', 'import_excel', 'settings_change',
        'voice_input', 'upload_attachment', 'input_change',
    ];

    public const MAX_EVENTS = 200;

    public const MAX_TAB_KEY_LENGTH = 64;

    /**
     * Resolve a session from a JWT without ever throwing.
     *
     * Unlike EnsureSessionActive this does NOT touch `last_active_at` — the reference
     * reads user_sessions directly here rather than going through getUserFromSession, so
     * a background beacon must not keep a session looking alive.
     */
    public function resolveSession(?string $token): ?UserSession
    {
        if (! is_string($token) || $token === '') {
            return null;
        }

        try {
            $payload = JWTAuth::setToken($token)->getPayload();
        } catch (JWTException) {
            return null;
        }

        $jti = (string) $payload->get('jti');
        $sub = $payload->get('sub');

        if ($jti === '' || ! is_string($sub) || $sub === '') {
            return null;
        }

        $session = UserSession::query()
            ->with('user')
            ->where('session_token', $jti)
            ->where('user_id', $sub)
            ->first();

        if ($session === null || $session->user === null || ! $session->user->is_active) {
            return null;
        }

        return $session;
    }

    /**
     * Normalise one client event into an insertable row, or null to drop it.
     *
     * @param  array<string,mixed>  $event
     * @return array<string,mixed>|null
     */
    private function toRow(mixed $event, UserSession $session): ?array
    {
        if (! is_array($event)) {
            return null;
        }

        $action = $event['action'] ?? null;

        if (! is_string($action) || ! in_array($action, self::ALLOWED_ACTIONS, true)) {
            return null;
        }

        $tabKey = isset($event['tab_key']) && is_string($event['tab_key'])
            ? mb_substr($event['tab_key'], 0, self::MAX_TAB_KEY_LENGTH)
            : null;

        $details = isset($event['details']) && is_array($event['details']) ? $event['details'] : [];

        return [
            'id' => (string) Str::uuid(),
            'user_id' => $session->user_id,
            'username' => $session->user->username,
            'session_token' => $session->session_token,
            'tab_key' => $tabKey,
            'action' => $action,
            // Written as a JSON string: this is a query-builder bulk insert, so the
            // model's `array` cast does not run.
            'details' => json_encode($details),
            'occurred_at' => $this->parseOccurredAt($event['occurred_at'] ?? null),
        ];
    }

    /** A malformed client clock must not lose the event — fall back to now(). */
    private function parseOccurredAt(mixed $value): Carbon
    {
        if (is_string($value) && $value !== '') {
            try {
                return Carbon::parse($value);
            } catch (\Throwable) {
                return now();
            }
        }

        return now();
    }

    /**
     * Cap at 200, drop anything outside the allow-list, insert the rest in one statement.
     *
     * @param  array<int,mixed>  $events
     * @return int rows written
     */
    public function log(UserSession $session, array $events): int
    {
        $rows = [];

        foreach (array_slice($events, 0, self::MAX_EVENTS) as $event) {
            $row = $this->toRow($event, $session);

            if ($row !== null) {
                $rows[] = $row;
            }
        }

        if ($rows === []) {
            return 0;
        }

        ActivityEvent::query()->insert($rows);

        return count($rows);
    }
}
