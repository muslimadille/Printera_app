<?php

namespace Tests\Feature;

use App\Models\ActivityEvent;
use App\Models\AppUser;
use App\Models\SessionEvent;
use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Concerns\ComparesJson;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-046 — GET /admin/analytics. Ports handleGetUserAnalytics
 * (manage-users/index.ts:1009-1215) and the heuristics in
 * 04-ADMIN-CONTROL-PANEL-SPEC.md §4.5.
 *
 * Time is frozen for every test: the online window, the tab-gap rule and the 30-day tier
 * cutoff are all measured against "now", so a moving clock would make them flaky.
 */
class AdminAnalyticsTest extends TestCase
{
    use ComparesJson, MakesUsers, RefreshDatabase;

    private Carbon $now;

    protected function setUp(): void
    {
        parent::setUp();

        $this->now = Carbon::parse('2026-08-07 12:00:00', 'UTC');
        $this->travelTo($this->now);
    }

    /** @return array<string,string> */
    private function adminAuth(): array
    {
        $this->makeUser(['username' => 'root', 'is_admin' => true]);

        return $this->bearer($this->login(['username' => 'root'])->json('session_token'));
    }

    private function sessionEvent(AppUser $user, string $type, ?string $token, Carbon $at, array $extra = []): void
    {
        SessionEvent::query()->create(array_merge([
            'user_id' => $user->id,
            'username' => $user->username,
            'session_token' => $token,
            'device_id' => 'dev-1',
            'device_info' => 'Chrome/Windows',
            'ip_address' => '203.0.113.5',
            'event_type' => $type,
            'occurred_at' => $at,
        ], $extra));
    }

    private function activity(AppUser $user, string $action, ?string $tab, ?string $token, Carbon $at, array $details = []): void
    {
        ActivityEvent::query()->create([
            'user_id' => $user->id,
            'username' => $user->username,
            'session_token' => $token,
            'tab_key' => $tab,
            'action' => $action,
            'details' => $details,
            'occurred_at' => $at,
        ]);
    }

    /** @return array<string,mixed> the single analytics row for $username */
    private function analyticsFor(array $auth, string $username, array $query = []): array
    {
        $rows = $this->getJson('/api/v1/admin/analytics?'.http_build_query($query), $auth)
            ->assertOk()->json('analytics');

        foreach ($rows as $row) {
            if ($row['username'] === $username) {
                return $row;
            }
        }

        $this->fail("No analytics row for {$username}.");
    }

    // ── shape & scope ────────────────────────────────────────────────────────

    public function test_the_payload_shape_matches_the_spec(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $this->sessionEvent($user, 'login', 'tok-a', $this->now->copy()->subHours(2));
        $this->activity($user, 'calculate', 'itemcost', 'tok-a', $this->now->copy()->subHours(2));

        $row = $this->analyticsFor($auth, 'tenant');

        $this->assertSame([
            'user_id', 'username', 'is_admin', 'parent_user_id',
            'is_online', 'active_session_count', 'last_login_at', 'last_logout_at',
            'total_sessions', 'total_duration_ms', 'total_activities', 'total_calcs',
            'total_saves', 'avg_session_ms', 'avg_acts_per_session',
            'most_used_tab', 'performance_tier', 'tab_stats', 'sessions',
        ], array_keys($row));

        $this->assertSame([
            'session_token', 'started_at', 'ended_at', 'last_event_type', 'duration_ms',
            'device_info', 'ip_address', 'event_count', 'activity_count', 'calc_count',
            'save_count', 'is_active', 'alerts', 'tab_stats', 'events', 'activities',
        ], array_keys($row['sessions'][0]));
    }

    public function test_every_user_is_reported_and_user_id_narrows_it(): void
    {
        $auth = $this->adminAuth();
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 2]);
        $employee = $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);

        $all = $this->getJson('/api/v1/admin/analytics', $auth)->assertOk()->json('analytics.*.username');
        sort($all);
        $this->assertSame(['emp', 'owner', 'root'], $all);

        $one = $this->getJson("/api/v1/admin/analytics?user_id={$employee->id}", $auth)->assertOk()->json('analytics');
        $this->assertCount(1, $one);
        $this->assertSame('emp', $one[0]['username']);
        $this->assertSame($owner->id, $one[0]['parent_user_id']);
    }

    public function test_an_unknown_user_id_returns_an_empty_list(): void
    {
        // A collection endpoint, so an empty list rather than the 400 the {id} routes use.
        $auth = $this->adminAuth();

        $this->getJson('/api/v1/admin/analytics?user_id='.fake()->uuid(), $auth)
            ->assertOk()
            ->assertExactJson(['analytics' => []]);
    }

    public function test_a_user_with_no_events_reports_zeroes(): void
    {
        $auth = $this->adminAuth();
        $this->makeUser(['username' => 'quiet']);

        $row = $this->analyticsFor($auth, 'quiet');

        $this->assertSame(0, $row['total_sessions']);
        $this->assertSame(0, $row['total_duration_ms']);
        $this->assertSame(0, $row['total_activities']);
        $this->assertSame(0, $row['avg_session_ms']);
        $this->assertSame(0, $row['avg_acts_per_session']);
        $this->assertNull($row['most_used_tab']);
        $this->assertNull($row['last_login_at']);
        $this->assertSame('low', $row['performance_tier']);
        $this->assertSame([], $row['sessions']);
        $this->assertFalse($row['is_online']);
    }

    // ── session grouping ─────────────────────────────────────────────────────

    public function test_events_and_activities_group_by_session_token(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        $this->sessionEvent($user, 'login', 'tok-a', $this->now->copy()->subHours(5));
        $this->activity($user, 'calculate', 'itemcost', 'tok-a', $this->now->copy()->subHours(5)->addMinutes(2));
        $this->sessionEvent($user, 'logout', 'tok-a', $this->now->copy()->subHours(5)->addMinutes(10));

        $this->sessionEvent($user, 'login', 'tok-b', $this->now->copy()->subHours(2));
        $this->sessionEvent($user, 'logout', 'tok-b', $this->now->copy()->subHours(2)->addMinutes(30));

        $row = $this->analyticsFor($auth, 'tenant');

        $this->assertSame(2, $row['total_sessions']);
        // Newest first.
        $this->assertSame('tok-b', $row['sessions'][0]['session_token']);
        $this->assertSame('tok-a', $row['sessions'][1]['session_token']);

        $this->assertSame(30 * 60 * 1000, $row['sessions'][0]['duration_ms']);
        $this->assertSame(10 * 60 * 1000, $row['sessions'][1]['duration_ms']);
        $this->assertSame(2, $row['sessions'][1]['event_count']);
        $this->assertSame(1, $row['sessions'][1]['activity_count']);
    }

    public function test_legacy_null_token_session_events_bucket_by_minute(): void
    {
        // index.ts:1071-1074. Two events in the same minute are one synthetic session;
        // an event in another minute is a separate one.
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        $this->sessionEvent($user, 'login', null, $this->now->copy()->subHours(3));
        $this->sessionEvent($user, 'heartbeat', null, $this->now->copy()->subHours(3)->addSeconds(20));
        $this->sessionEvent($user, 'logout', null, $this->now->copy()->subHours(3)->addMinutes(5));

        $row = $this->analyticsFor($auth, 'tenant');

        $this->assertSame(2, $row['total_sessions']);
        foreach ($row['sessions'] as $session) {
            $this->assertNull($session['session_token']);
        }
        $this->assertSame([1, 2], collect($row['sessions'])->pluck('event_count')->sort()->values()->all());
    }

    public function test_legacy_null_token_activities_share_one_bucket(): void
    {
        // Deliberately NOT minute-bucketed, unlike session events — index.ts:1076-1079.
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        $this->activity($user, 'calculate', 'itemcost', null, $this->now->copy()->subHours(4));
        $this->activity($user, 'calculate', 'itemcost', null, $this->now->copy()->subHours(3));
        $this->activity($user, 'calculate', 'itemcost', null, $this->now->copy()->subHours(2));

        $row = $this->analyticsFor($auth, 'tenant');

        $this->assertSame(1, $row['total_sessions']);
        $this->assertSame(3, $row['sessions'][0]['activity_count']);
        $this->assertSame(0, $row['sessions'][0]['event_count']);
        $this->assertSame('activity', $row['sessions'][0]['last_event_type']);
    }

    // ── online / active ──────────────────────────────────────────────────────

    public function test_is_online_follows_the_two_minute_window(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant', 'max_devices' => 3]);

        $this->seedSession($user, 'stale', $this->now->copy()->subMinutes(3));
        $this->assertFalse($this->analyticsFor($auth, 'tenant')['is_online']);

        $this->seedSession($user, 'fresh', $this->now->copy()->subSeconds(30));
        $row = $this->analyticsFor($auth, 'tenant');
        $this->assertTrue($row['is_online']);
        $this->assertSame(2, $row['active_session_count']);
    }

    public function test_a_session_is_active_only_while_logged_in_and_recent(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $this->seedSession($user, 'live', $this->now);

        $this->sessionEvent($user, 'login', 'tok-live', $this->now->copy()->subMinutes(30));
        $this->sessionEvent($user, 'heartbeat', 'tok-live', $this->now->copy()->subSeconds(20));

        $session = $this->analyticsFor($auth, 'tenant')['sessions'][0];
        $this->assertTrue($session['is_active']);
        $this->assertNull($session['ended_at']);
        $this->assertSame('heartbeat', $session['last_event_type']);
    }

    public function test_a_logged_out_session_is_closed_even_if_recent(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $this->seedSession($user, 'live', $this->now);

        $this->sessionEvent($user, 'login', 'tok-x', $this->now->copy()->subMinutes(10));
        $this->sessionEvent($user, 'logout', 'tok-x', $this->now->copy()->subSeconds(5));

        $session = $this->analyticsFor($auth, 'tenant')['sessions'][0];
        $this->assertFalse($session['is_active']);
        $this->assertNotNull($session['ended_at']);
        $this->assertSame('logout', $session['last_event_type']);
    }

    public function test_a_stale_heartbeat_closes_the_session(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $this->seedSession($user, 'live', $this->now);

        $this->sessionEvent($user, 'login', 'tok-x', $this->now->copy()->subHours(1));
        $this->sessionEvent($user, 'heartbeat', 'tok-x', $this->now->copy()->subMinutes(10));

        $this->assertFalse($this->analyticsFor($auth, 'tenant')['sessions'][0]['is_active']);
    }

    public function test_is_active_is_always_a_boolean_for_tokenless_sessions(): void
    {
        // The reference computes `s.token && …`, which yields null when the token is null
        // — a JS truthiness artifact that contradicts its own `is_active: boolean`
        // interface. This port returns a real false.
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $this->seedSession($user, 'live', $this->now);
        $this->sessionEvent($user, 'login', null, $this->now->copy()->subSeconds(10));

        $this->assertFalse($this->analyticsFor($auth, 'tenant')['sessions'][0]['is_active']);
    }

    // ── tab statistics ───────────────────────────────────────────────────────

    public function test_tab_duration_sums_gaps_under_five_minutes_only(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $base = $this->now->copy()->subHours(2);

        // +2min (counts), then +9min (idle, ignored), then +1min (counts).
        $this->activity($user, 'tab_open', 'itemcost', 'tok', $base);
        $this->activity($user, 'calculate', 'itemcost', 'tok', $base->copy()->addMinutes(2));
        $this->activity($user, 'calculate', 'itemcost', 'tok', $base->copy()->addMinutes(11));
        $this->activity($user, 'calculate', 'itemcost', 'tok', $base->copy()->addMinutes(12));

        $stats = $this->analyticsFor($auth, 'tenant')['tab_stats'];

        $this->assertCount(1, $stats);
        $this->assertSame('itemcost', $stats[0]['tab_key']);
        $this->assertSame(4, $stats[0]['count']);
        $this->assertSame(3 * 60 * 1000, $stats[0]['duration_ms']);
    }

    public function test_tab_stats_are_busiest_first_and_null_tabs_become_unknown(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $base = $this->now->copy()->subHours(2);

        foreach (range(1, 3) as $i) {
            $this->activity($user, 'calculate', 'diecut5', 'tok', $base->copy()->addMinutes($i));
        }
        $this->activity($user, 'calculate', 'itemcost', 'tok', $base->copy()->addMinutes(10));
        $this->activity($user, 'voice_input', null, 'tok', $base->copy()->addMinutes(11));
        $this->activity($user, 'voice_input', null, 'tok', $base->copy()->addMinutes(12));

        $stats = $this->analyticsFor($auth, 'tenant')['tab_stats'];

        $this->assertSame(['diecut5', '_unknown', 'itemcost'], array_column($stats, 'tab_key'));
        $this->assertSame([3, 2, 1], array_column($stats, 'count'));
        $this->assertSame('diecut5', $this->analyticsFor($auth, 'tenant')['most_used_tab']);
    }

    public function test_per_session_tab_stats_cover_only_that_session(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        $this->sessionEvent($user, 'login', 'tok-a', $this->now->copy()->subHours(5));
        $this->activity($user, 'calculate', 'itemcost', 'tok-a', $this->now->copy()->subHours(5));

        $this->sessionEvent($user, 'login', 'tok-b', $this->now->copy()->subHours(2));
        $this->activity($user, 'calculate', 'diecut5', 'tok-b', $this->now->copy()->subHours(2));
        $this->activity($user, 'calculate', 'diecut5', 'tok-b', $this->now->copy()->subHours(2)->addMinutes(1));

        $row = $this->analyticsFor($auth, 'tenant');

        $this->assertSame(['diecut5'], array_column($row['sessions'][0]['tab_stats'], 'tab_key'));
        $this->assertSame(['itemcost'], array_column($row['sessions'][1]['tab_stats'], 'tab_key'));
        // The user-level roll-up spans both.
        $this->assertSame(['diecut5', 'itemcost'], array_column($row['tab_stats'], 'tab_key'));
    }

    // ── alerts ───────────────────────────────────────────────────────────────

    public function test_a_session_over_four_hours_raises_long_session(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        $this->sessionEvent($user, 'login', 'tok', $this->now->copy()->subHours(9));
        $this->sessionEvent($user, 'logout', 'tok', $this->now->copy()->subHours(4)->subMinute());

        $this->assertSame(['long_session'], $this->analyticsFor($auth, 'tenant')['sessions'][0]['alerts']);
    }

    public function test_exactly_four_hours_does_not_raise_long_session(): void
    {
        // The rule is strictly greater than 4h.
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        $this->sessionEvent($user, 'login', 'tok', $this->now->copy()->subHours(6));
        $this->sessionEvent($user, 'logout', 'tok', $this->now->copy()->subHours(2));

        $this->assertSame([], $this->analyticsFor($auth, 'tenant')['sessions'][0]['alerts']);
    }

    public function test_many_calculations_without_a_save_raises_an_alert(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $base = $this->now->copy()->subHours(2);

        $this->sessionEvent($user, 'login', 'tok', $base);
        foreach (range(1, 11) as $i) {
            $this->activity($user, 'calculate', 'itemcost', 'tok', $base->copy()->addSeconds($i));
        }

        $session = $this->analyticsFor($auth, 'tenant')['sessions'][0];
        $this->assertSame(11, $session['calc_count']);
        $this->assertSame(0, $session['save_count']);
        $this->assertContains('many_calc_no_save', $session['alerts']);
    }

    public function test_a_single_save_clears_the_calc_alert(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $base = $this->now->copy()->subHours(2);

        $this->sessionEvent($user, 'login', 'tok', $base);
        foreach (range(1, 11) as $i) {
            $this->activity($user, 'calculate', 'itemcost', 'tok', $base->copy()->addSeconds($i));
        }
        // update_quote counts as a save just like save_quote — index.ts:1128.
        $this->activity($user, 'update_quote', 'savedquotes', 'tok', $base->copy()->addSeconds(20));

        $session = $this->analyticsFor($auth, 'tenant')['sessions'][0];
        $this->assertSame(1, $session['save_count']);
        $this->assertNotContains('many_calc_no_save', $session['alerts']);
    }

    public function test_more_than_thirty_tab_opens_raises_frequent_tab_switching(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $base = $this->now->copy()->subHours(2);

        $this->sessionEvent($user, 'login', 'tok', $base);
        foreach (range(1, 31) as $i) {
            $this->activity($user, 'tab_open', 'itemcost', 'tok', $base->copy()->addSeconds($i));
        }

        $this->assertContains(
            'frequent_tab_switching',
            $this->analyticsFor($auth, 'tenant')['sessions'][0]['alerts']
        );
    }

    public function test_alerts_appear_in_the_reference_order(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $base = $this->now->copy()->subHours(9);

        $this->sessionEvent($user, 'login', 'tok', $base);
        foreach (range(1, 31) as $i) {
            $this->activity($user, 'tab_open', 'itemcost', 'tok', $base->copy()->addSeconds($i));
        }
        foreach (range(1, 11) as $i) {
            $this->activity($user, 'calculate', 'itemcost', 'tok', $base->copy()->addMinutes($i));
        }
        $this->sessionEvent($user, 'logout', 'tok', $this->now->copy()->subMinutes(30));

        $this->assertSame(
            ['long_session', 'many_calc_no_save', 'frequent_tab_switching'],
            $this->analyticsFor($auth, 'tenant')['sessions'][0]['alerts']
        );
    }

    // ── totals, tiers, last login/logout ─────────────────────────────────────

    public function test_totals_and_averages_roll_up_across_sessions(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        $a = $this->now->copy()->subHours(6);
        $this->sessionEvent($user, 'login', 'tok-a', $a);
        $this->activity($user, 'calculate', 'itemcost', 'tok-a', $a->copy()->addMinutes(1));
        $this->activity($user, 'save_quote', 'itemcost', 'tok-a', $a->copy()->addMinutes(2));
        $this->sessionEvent($user, 'logout', 'tok-a', $a->copy()->addMinutes(10));

        $b = $this->now->copy()->subHours(3);
        $this->sessionEvent($user, 'login', 'tok-b', $b);
        $this->activity($user, 'calculate', 'diecut5', 'tok-b', $b->copy()->addMinutes(1));
        $this->sessionEvent($user, 'logout', 'tok-b', $b->copy()->addMinutes(20));

        $row = $this->analyticsFor($auth, 'tenant');

        $this->assertSame(2, $row['total_sessions']);
        $this->assertSame(30 * 60 * 1000, $row['total_duration_ms']);
        $this->assertSame(3, $row['total_activities']);
        $this->assertSame(2, $row['total_calcs']);
        $this->assertSame(1, $row['total_saves']);
        $this->assertSame(15 * 60 * 1000, (int) $row['avg_session_ms']);
        $this->assertSame(1.5, $row['avg_acts_per_session']);
    }

    public function test_last_login_and_last_logout_pick_the_most_recent(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        $this->sessionEvent($user, 'login', 'tok-a', $this->now->copy()->subDays(2));
        $this->sessionEvent($user, 'logout', 'tok-a', $this->now->copy()->subDays(2)->addHour());
        $this->sessionEvent($user, 'login', 'tok-b', $this->now->copy()->subHours(4));
        $this->sessionEvent($user, 'auto_logout', 'tok-b', $this->now->copy()->subHours(3));

        $row = $this->analyticsFor($auth, 'tenant');

        $this->assertSame(
            $this->now->copy()->subHours(4)->startOfSecond()->timestamp,
            Carbon::parse($row['last_login_at'])->startOfSecond()->timestamp
        );
        // auto_logout counts as a logout — index.ts:1173.
        $this->assertSame(
            $this->now->copy()->subHours(3)->startOfSecond()->timestamp,
            Carbon::parse($row['last_logout_at'])->startOfSecond()->timestamp
        );
    }

    public function test_the_performance_tier_counts_the_last_thirty_days(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        // 60 recent → average; the 40-day-old ones must not count toward the tier.
        $base = $this->now->copy()->subDays(2);
        foreach (range(1, 60) as $i) {
            $this->activity($user, 'calculate', 'itemcost', 'tok', $base->copy()->addSeconds($i));
        }
        $old = $this->now->copy()->subDays(40);
        foreach (range(1, 300) as $i) {
            $this->activity($user, 'calculate', 'itemcost', 'tok-old', $old->copy()->addSeconds($i));
        }

        $row = $this->analyticsFor($auth, 'tenant');
        $this->assertSame('average', $row['performance_tier']);
        // …but they do count toward the lifetime totals.
        $this->assertSame(360, $row['total_activities']);
    }

    public function test_two_hundred_recent_activities_reach_the_active_tier(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $base = $this->now->copy()->subDays(1);

        foreach (range(1, 200) as $i) {
            $this->activity($user, 'calculate', 'itemcost', 'tok', $base->copy()->addSeconds($i));
        }

        $this->assertSame('active', $this->analyticsFor($auth, 'tenant')['performance_tier']);
    }

    public function test_a_quiet_user_is_low_tier(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $base = $this->now->copy()->subDays(1);

        foreach (range(1, 49) as $i) {
            $this->activity($user, 'calculate', 'itemcost', 'tok', $base->copy()->addSeconds($i));
        }

        $this->assertSame('low', $this->analyticsFor($auth, 'tenant')['performance_tier']);
    }

    // ── event & activity detail ──────────────────────────────────────────────

    public function test_the_session_carries_its_events_and_activities_in_order(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $base = $this->now->copy()->subHours(2);

        $this->sessionEvent($user, 'login', 'tok', $base);
        $this->sessionEvent($user, 'heartbeat', 'tok', $base->copy()->addMinutes(5));
        $this->activity($user, 'tab_open', 'itemcost', 'tok', $base->copy()->addMinutes(1), ['from' => 'home']);
        $this->activity($user, 'calculate', 'itemcost', 'tok', $base->copy()->addMinutes(2));

        $session = $this->analyticsFor($auth, 'tenant')['sessions'][0];

        $this->assertSame(['login', 'heartbeat'], array_column($session['events'], 'event_type'));
        $this->assertSame(['tab_open', 'calculate'], array_column($session['activities'], 'action'));
        $this->assertSame('Chrome/Windows', $session['device_info']);
        $this->assertSame('203.0.113.5', $session['ip_address']);
        $this->assertSame(['from' => 'home'], $session['activities'][0]['details']);
        $this->assertSame([], $session['activities'][1]['details']);
    }

    public function test_activity_details_are_returned_opaquely(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);
        $details = ['nested' => ['a' => [1, 2]], 'arabic' => 'ورق', 'zero' => 0, 'false' => false];

        $this->activity($user, 'calculate', 'itemcost', 'tok', $this->now->copy()->subHour(), $details);

        $row = $this->analyticsFor($auth, 'tenant');
        $this->assertSameJson($details, $row['sessions'][0]['activities'][0]['details']);
    }

    // ── caps & authorization ─────────────────────────────────────────────────

    public function test_limit_users_caps_the_sessions_per_user(): void
    {
        $auth = $this->adminAuth();
        $user = $this->makeUser(['username' => 'tenant']);

        // 60 distinct sessions, one event each.
        foreach (range(1, 60) as $i) {
            $this->sessionEvent($user, 'login', "tok-{$i}", $this->now->copy()->subMinutes($i + 10));
        }

        $this->assertCount(60, $this->analyticsFor($auth, 'tenant')['sessions']);
        $this->assertCount(50, $this->analyticsFor($auth, 'tenant', ['limit_users' => 1])['sessions']);

        // The cap trims the list, it does not change the count.
        $this->assertSame(60, $this->analyticsFor($auth, 'tenant', ['limit_users' => 1])['total_sessions']);
    }

    public function test_analytics_never_mix_users(): void
    {
        $auth = $this->adminAuth();
        $a = $this->makeUser(['username' => 'alpha']);
        $b = $this->makeUser(['username' => 'beta']);

        $this->sessionEvent($a, 'login', 'tok-a', $this->now->copy()->subHours(2));
        $this->activity($a, 'calculate', 'itemcost', 'tok-a', $this->now->copy()->subHours(2));
        $this->sessionEvent($b, 'login', 'tok-b', $this->now->copy()->subHours(2));

        $this->assertSame(1, $this->analyticsFor($auth, 'alpha')['total_activities']);
        $this->assertSame(0, $this->analyticsFor($auth, 'beta')['total_activities']);
        $this->assertSame('tok-a', $this->analyticsFor($auth, 'alpha')['sessions'][0]['session_token']);
        $this->assertSame('tok-b', $this->analyticsFor($auth, 'beta')['sessions'][0]['session_token']);
    }

    public function test_a_non_admin_is_refused(): void
    {
        $this->makeUser(['username' => 'owner']);
        $auth = $this->bearer($this->login(['username' => 'owner'])->json('session_token'));

        $this->getJson('/api/v1/admin/analytics', $auth)
            ->assertStatus(403)
            ->assertExactJson(['error' => Messages::NOT_AUTHORIZED]);
    }
}
