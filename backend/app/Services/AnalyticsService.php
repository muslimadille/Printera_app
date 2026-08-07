<?php

namespace App\Services;

use App\Models\ActivityEvent;
use App\Models\AppUser;
use App\Models\SessionEvent;
use App\Models\UserSession;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Per-user usage analytics for the admin panel. Ports handleGetUserAnalytics
 * (manage-users/index.ts:1009-1215) — the largest single handler in the reference.
 *
 * Everything is computed in milliseconds, as the reference does, so the heuristics in
 * 04-ADMIN-CONTROL-PANEL-SPEC.md §4.5 port across without unit conversion:
 *  - online          = an active session touched within 2 minutes
 *  - tab duration    = summed gaps between consecutive activities in the same tab,
 *                      counting only gaps under 5 minutes (idle time does not accrue)
 *  - session grouping= session_events + activity_events keyed by session_token, with a
 *                      synthetic key for legacy rows that have none
 *  - alerts          = long_session (>4h), many_calc_no_save (>10 calcs, 0 saves),
 *                      frequent_tab_switching (>30 tab_open)
 *  - tier            = activities in the last 30 days: >=200 active, >=50 average, else low
 *
 * The 20k read caps are the reference's and are kept. Note what they mean: the rows are
 * ordered oldest-first, so past 20k events the window shows the OLDEST slice, not the most
 * recent. Fine at current scale; revisit with an aggregation table if data grows
 * (04 §4.5).
 */
class AnalyticsService
{
    private const ONLINE_WINDOW_MS = 2 * 60 * 1000;

    private const TAB_GAP_MS = 5 * 60 * 1000;

    private const LONG_SESSION_MS = 4 * 60 * 60 * 1000;

    private const EVENT_LIMIT = 20000;

    /** Sessions returned per user: fewer when the caller is listing every user. */
    private const SESSION_CAP = 200;

    private const SESSION_CAP_WHEN_LISTING = 50;

    private const TIER_ACTIVE_MIN = 200;

    private const TIER_AVERAGE_MIN = 50;

    private const RECENT_DAYS = 30;

    /**
     * @param  ?string  $userId  restrict to one user; null = every user
     * @param  bool  $limitUsers  the reference's `limit_users` flag — caps sessions per user
     * @return array<int,array<string,mixed>>
     */
    public function forUsers(?string $userId = null, bool $limitUsers = false): array
    {
        $users = AppUser::query()
            ->when($userId !== null, fn ($query) => $query->where('id', $userId))
            ->get(['id', 'username', 'is_admin', 'parent_user_id']);

        if ($users->isEmpty()) {
            return [];
        }

        $userIds = $users->pluck('id')->all();

        // Carbon's clock, not PHP's, so travel() in tests moves "now" here too.
        $nowMs = (int) now()->getPreciseTimestamp(3);

        $activeSessions = UserSession::query()
            ->whereIn('user_id', $userIds)
            ->get(['id', 'user_id', 'device_info', 'ip_address', 'created_at', 'last_active_at'])
            ->groupBy('user_id');

        $events = SessionEvent::query()
            ->whereIn('user_id', $userIds)
            ->orderBy('occurred_at')
            ->limit(self::EVENT_LIMIT)
            ->get(['user_id', 'session_token', 'device_info', 'ip_address', 'event_type', 'occurred_at'])
            ->groupBy('user_id');

        $activities = ActivityEvent::query()
            ->whereIn('user_id', $userIds)
            ->orderBy('occurred_at')
            ->limit(self::EVENT_LIMIT)
            ->get(['user_id', 'session_token', 'tab_key', 'action', 'details', 'occurred_at'])
            ->groupBy('user_id');

        $cap = $limitUsers ? self::SESSION_CAP_WHEN_LISTING : self::SESSION_CAP;

        return $users->map(fn (AppUser $user): array => $this->forUser(
            $user,
            $this->sortByOccurredAt($events->get($user->id, new Collection)->all()),
            $this->sortByOccurredAt($activities->get($user->id, new Collection)->all()),
            $activeSessions->get($user->id, new Collection),
            $nowMs,
            $cap,
        ))->all();
    }

    // ── per user ─────────────────────────────────────────────────────────────

    /**
     * @param  array<int,SessionEvent>  $events
     * @param  array<int,ActivityEvent>  $activities
     * @param  Collection<int,UserSession>  $activeSessions
     * @return array<string,mixed>
     */
    private function forUser(
        AppUser $user,
        array $events,
        array $activities,
        Collection $activeSessions,
        int $nowMs,
        int $cap,
    ): array {
        $summaries = $this->sessionSummaries($events, $activities, $activeSessions->count(), $nowMs);

        $totalSessions = count($summaries);
        $totalDurationMs = (int) array_sum(array_column($summaries, 'duration_ms'));
        $totalActivities = (int) array_sum(array_column($summaries, 'activity_count'));

        $lastLogin = $this->lastEventOfType($events, ['login']);
        $lastLogout = $this->lastEventOfType($events, ['logout', 'auto_logout']);

        $overallTabStats = $this->tabStats($activities);

        $recentCutoffMs = $nowMs - self::RECENT_DAYS * 24 * 60 * 60 * 1000;
        $recentActs = count(array_filter(
            $activities,
            fn (ActivityEvent $a): bool => $this->ms($a->occurred_at) >= $recentCutoffMs,
        ));

        return [
            'user_id' => $user->id,
            'username' => $user->username,
            'is_admin' => (bool) $user->is_admin,
            'parent_user_id' => $user->parent_user_id,

            'is_online' => $activeSessions->contains(
                fn (UserSession $s): bool => $s->last_active_at !== null
                    && ($nowMs - $this->ms($s->last_active_at)) < self::ONLINE_WINDOW_MS,
            ),
            'active_session_count' => $activeSessions->count(),
            'last_login_at' => $lastLogin?->occurred_at?->toISOString(),
            'last_logout_at' => $lastLogout?->occurred_at?->toISOString(),

            'total_sessions' => $totalSessions,
            'total_duration_ms' => $totalDurationMs,
            'total_activities' => $totalActivities,
            'total_calcs' => (int) array_sum(array_column($summaries, 'calc_count')),
            'total_saves' => (int) array_sum(array_column($summaries, 'save_count')),
            'avg_session_ms' => $totalSessions > 0 ? $totalDurationMs / $totalSessions : 0,
            'avg_acts_per_session' => $totalSessions > 0 ? $totalActivities / $totalSessions : 0,

            'most_used_tab' => $overallTabStats[0]['tab_key'] ?? null,
            'performance_tier' => match (true) {
                $recentActs >= self::TIER_ACTIVE_MIN => 'active',
                $recentActs >= self::TIER_AVERAGE_MIN => 'average',
                default => 'low',
            },
            'tab_stats' => $overallTabStats,
            'sessions' => array_slice($summaries, 0, $cap),
        ];
    }

    // ── session grouping & summaries ─────────────────────────────────────────

    /**
     * Group both event streams by `session_token`, then summarise each group.
     *
     * Legacy rows predate the token, so the reference synthesises a key: session_events
     * bucket by the MINUTE they occurred in, while activity_events all share one
     * `__nokey_act` bucket. That asymmetry is the reference's (index.ts:1069-1080) and is
     * reproduced rather than tidied — changing it would silently redraw session boundaries
     * in historical data.
     *
     * @param  array<int,SessionEvent>  $events  ascending by occurred_at
     * @param  array<int,ActivityEvent>  $activities  ascending by occurred_at
     * @return array<int,array<string,mixed>> newest session first
     */
    private function sessionSummaries(array $events, array $activities, int $activeSessionCount, int $nowMs): array
    {
        /** @var array<string,array{token:?string,events:array<int,SessionEvent>,activities:array<int,ActivityEvent>}> $groups */
        $groups = [];

        foreach ($events as $event) {
            $token = $this->tokenOf($event);
            $key = $token ?? '__nokey_'.(int) floor($this->ms($event->occurred_at) / 60000);
            $groups[$key] ??= ['token' => $token, 'events' => [], 'activities' => []];
            $groups[$key]['events'][] = $event;
        }

        foreach ($activities as $activity) {
            $token = $this->tokenOf($activity);
            $key = $token ?? '__nokey_act';
            $groups[$key] ??= ['token' => $token, 'events' => [], 'activities' => []];
            $groups[$key]['activities'][] = $activity;
        }

        $summaries = [];

        foreach ($groups as $group) {
            $summary = $this->summarise($group, $activeSessionCount, $nowMs);

            if ($summary !== null) {
                $summaries[] = $summary;
            }
        }

        // Newest first. usort is stable in PHP 8, matching JS's stable sort, so sessions
        // that started in the same millisecond keep their grouping order.
        usort($summaries, fn (array $a, array $b): int => $b['_started_ms'] <=> $a['_started_ms']);

        return array_map(function (array $summary): array {
            unset($summary['_started_ms']);

            return $summary;
        }, $summaries);
    }

    /**
     * @param  array{token:?string,events:array<int,SessionEvent>,activities:array<int,ActivityEvent>}  $group
     * @return ?array<string,mixed> null when the group holds nothing to summarise
     */
    private function summarise(array $group, int $activeSessionCount, int $nowMs): ?array
    {
        $events = $this->sortByOccurredAt($group['events']);
        $activities = $this->sortByOccurredAt($group['activities']);

        if ($events === [] && $activities === []) {
            return null;
        }

        $times = array_map(
            fn (Model $e): int => $this->ms($e->occurred_at),
            array_merge($events, $activities),
        );
        $firstTs = min($times);
        $lastTs = max($times);

        $last = $events === [] ? null : $events[count($events) - 1];
        $lastEventType = $this->orNull($last?->event_type) ?? 'activity';

        // A session counts as still running only if it has a real token, the user has at
        // least one live session row, its last SESSION event was a login or heartbeat (a
        // logout ends it), and it was touched inside the online window.
        $isStillActive = $group['token'] !== null
            && $activeSessionCount > 0
            && ($lastEventType === 'login' || $lastEventType === 'heartbeat' || $last === null)
            && ($nowMs - $lastTs) < self::ONLINE_WINDOW_MS;

        $durationMs = max(0, $lastTs - $firstTs);
        $calcCount = $this->countActions($activities, ['calculate']);
        $saveCount = $this->countActions($activities, ['save_quote', 'update_quote']);
        $tabSwitches = $this->countActions($activities, ['tab_open']);

        $alerts = [];
        if ($durationMs > self::LONG_SESSION_MS) {
            $alerts[] = 'long_session';
        }
        if ($calcCount > 10 && $saveCount === 0) {
            $alerts[] = 'many_calc_no_save';
        }
        if ($tabSwitches > 30) {
            $alerts[] = 'frequent_tab_switching';
        }

        return [
            '_started_ms' => $firstTs,

            'session_token' => $group['token'],
            'started_at' => $this->iso($firstTs),
            'ended_at' => $isStillActive ? null : $this->iso($lastTs),
            'last_event_type' => $lastEventType,
            'duration_ms' => $durationMs,
            // First event's device/IP, falling back to the last event's — index.ts:1142.
            'device_info' => $this->orNull($events[0]->device_info ?? null) ?? $this->orNull($last?->device_info),
            'ip_address' => $this->orNull($events[0]->ip_address ?? null) ?? $this->orNull($last?->ip_address),
            'event_count' => count($events),
            'activity_count' => count($activities),
            'calc_count' => $calcCount,
            'save_count' => $saveCount,
            'is_active' => $isStillActive,
            'alerts' => $alerts,
            'tab_stats' => $this->tabStats($activities),

            'events' => array_map(fn (SessionEvent $e): array => [
                'event_type' => $e->event_type,
                'occurred_at' => $e->occurred_at?->toISOString(),
                'device_info' => $this->orNull($e->device_info),
                'ip_address' => $this->orNull($e->ip_address),
            ], $events),

            'activities' => array_map(fn (ActivityEvent $a): array => [
                'tab_key' => $this->orNull($a->tab_key),
                'action' => $a->action,
                'details' => $a->details ?? [],
                'occurred_at' => $a->occurred_at?->toISOString(),
            ], $activities),
        ];
    }

    // ── tab statistics ───────────────────────────────────────────────────────

    /**
     * Per-tab visit count and accrued time. Gaps of 5 minutes or more are treated as the
     * user having walked away and do not accrue — index.ts:1084-1100.
     *
     * @param  array<int,ActivityEvent>  $activities  ascending by occurred_at
     * @return array<int,array{tab_key:string,count:int,duration_ms:int}> busiest first
     */
    private function tabStats(array $activities): array
    {
        /** @var array<string,array{count:int,duration:int,last:int}> $tabs */
        $tabs = [];

        foreach ($activities as $activity) {
            $tab = $this->orNull($activity->tab_key) ?? '_unknown';
            $at = $this->ms($activity->occurred_at);

            $tabs[$tab] ??= ['count' => 0, 'duration' => 0, 'last' => 0];
            $tabs[$tab]['count']++;

            if ($tabs[$tab]['last'] > 0) {
                $gap = $at - $tabs[$tab]['last'];

                if ($gap > 0 && $gap < self::TAB_GAP_MS) {
                    $tabs[$tab]['duration'] += $gap;
                }
            }

            $tabs[$tab]['last'] = $at;
        }

        $stats = [];

        foreach ($tabs as $tab => $totals) {
            $stats[] = ['tab_key' => (string) $tab, 'count' => $totals['count'], 'duration_ms' => $totals['duration']];
        }

        // Stable, so equal counts keep first-seen order — same as the reference's sort.
        usort($stats, fn (array $a, array $b): int => $b['count'] <=> $a['count']);

        return $stats;
    }

    // ── small helpers ────────────────────────────────────────────────────────

    /** Milliseconds since the epoch, the unit every heuristic above is expressed in. */
    private function ms(?Carbon $at): int
    {
        return $at === null ? 0 : (int) $at->getPreciseTimestamp(3);
    }

    private function iso(int $ms): string
    {
        return Carbon::createFromTimestampMs($ms, 'UTC')->toISOString();
    }

    /** JS truthiness for strings: '' is as good as absent. */
    private function orNull(?string $value): ?string
    {
        return $value !== null && $value !== '' ? $value : null;
    }

    private function tokenOf(SessionEvent|ActivityEvent $row): ?string
    {
        return $this->orNull($row->session_token);
    }

    /**
     * @param  array<int,SessionEvent|ActivityEvent>  $rows
     * @param  array<int,string>  $actions
     */
    private function countActions(array $rows, array $actions): int
    {
        return count(array_filter($rows, fn ($row): bool => in_array($row->action, $actions, true)));
    }

    /**
     * @param  array<int,SessionEvent>  $events  ascending
     * @param  array<int,string>  $types
     */
    private function lastEventOfType(array $events, array $types): ?SessionEvent
    {
        foreach (array_reverse($events) as $event) {
            if (in_array($event->event_type, $types, true)) {
                return $event;
            }
        }

        return null;
    }

    /**
     * @template T of Model
     *
     * @param  array<int,T>  $rows
     * @return array<int,T>
     */
    private function sortByOccurredAt(array $rows): array
    {
        usort($rows, fn (Model $a, Model $b): int => $this->ms($a->occurred_at) <=> $this->ms($b->occurred_at));

        return $rows;
    }
}
