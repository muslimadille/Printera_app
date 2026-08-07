<?php

namespace Tests\Feature;

use App\Models\ActivityEvent;
use App\Models\AppUser;
use App\Models\SessionEvent;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * BE-026 — app:prune-events. Replaces the Supabase AFTER-INSERT retention triggers
 * (supabase/migrations/20260502083814_*.sql), which deleted rows older than 30 days.
 */
class PruneEventsTest extends TestCase
{
    use RefreshDatabase;

    private AppUser $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = AppUser::query()->create([
            'username' => 'tester',
            'password_hash' => Hash::make('secret123'),
            'is_active' => true,
        ]);
    }

    private function activityAt(string $label, \DateTimeInterface $when): ActivityEvent
    {
        return ActivityEvent::query()->create([
            'user_id' => $this->user->id,
            'username' => $this->user->username,
            'action' => 'tab_open',
            'tab_key' => $label,
            'details' => [],
            'occurred_at' => $when,
        ]);
    }

    private function sessionEventAt(string $type, \DateTimeInterface $when): SessionEvent
    {
        return SessionEvent::query()->create([
            'user_id' => $this->user->id,
            'username' => $this->user->username,
            'event_type' => $type,
            'occurred_at' => $when,
        ]);
    }

    public function test_rows_older_than_thirty_days_are_pruned_and_newer_rows_survive(): void
    {
        $this->activityAt('ancient', now()->subDays(90));
        $this->activityAt('just-over', now()->subDays(31));
        $this->activityAt('just-under', now()->subDays(29));
        $this->activityAt('today', now());

        $this->sessionEventAt('login', now()->subDays(45));
        $this->sessionEventAt('heartbeat', now()->subDays(2));

        $this->artisan('app:prune-events')->assertSuccessful();

        $this->assertSame(
            ['just-under', 'today'],
            ActivityEvent::query()->orderBy('occurred_at')->pluck('tab_key')->all()
        );
        $this->assertSame(['heartbeat'], SessionEvent::query()->pluck('event_type')->all());
    }

    public function test_the_boundary_is_exclusive(): void
    {
        // Exactly 30 days old is NOT older than the cutoff, matching
        // `occurred_at < now() - interval '30 days'`.
        $this->activityAt('exactly-30d-plus-a-second', now()->subDays(30)->addSecond());

        $this->artisan('app:prune-events')->assertSuccessful();

        $this->assertSame(1, ActivityEvent::query()->count());
    }

    public function test_nothing_to_prune_is_not_an_error(): void
    {
        $this->activityAt('fresh', now());

        $this->artisan('app:prune-events')->assertSuccessful();

        $this->assertSame(1, ActivityEvent::query()->count());
    }

    public function test_the_window_is_configurable(): void
    {
        $this->activityAt('eight-days-old', now()->subDays(8));

        $this->artisan('app:prune-events', ['--days' => 7])->assertSuccessful();

        $this->assertSame(0, ActivityEvent::query()->count());
    }

    public function test_the_window_comes_from_config_not_a_literal(): void
    {
        config(['printera.event_retention_days' => 5]);
        $this->activityAt('six-days-old', now()->subDays(6));
        $this->activityAt('four-days-old', now()->subDays(4));

        $this->artisan('app:prune-events')->assertSuccessful();

        $this->assertSame(['four-days-old'], ActivityEvent::query()->pluck('tab_key')->all());
    }

    public function test_dry_run_reports_without_deleting(): void
    {
        $this->activityAt('old', now()->subDays(60));
        $this->sessionEventAt('login', now()->subDays(60));

        $this->artisan('app:prune-events', ['--dry-run' => true])->assertSuccessful();

        $this->assertSame(1, ActivityEvent::query()->count());
        $this->assertSame(1, SessionEvent::query()->count());
    }

    public function test_a_nonsensical_window_is_rejected(): void
    {
        $this->activityAt('old', now()->subDays(60));

        $this->artisan('app:prune-events', ['--days' => 0])->assertFailed();

        $this->assertSame(1, ActivityEvent::query()->count());
    }

    public function test_pruning_survives_a_backlog_larger_than_one_chunk(): void
    {
        // The command deletes in chunks of 1000; this proves the loop terminates and
        // clears everything rather than stopping after the first pass.
        $rows = [];

        for ($i = 0; $i < 1200; $i++) {
            $rows[] = [
                'id' => (string) Str::uuid(),
                'user_id' => $this->user->id,
                'username' => $this->user->username,
                'action' => 'calculate',
                'details' => json_encode([]),
                'occurred_at' => now()->subDays(40),
            ];
        }

        ActivityEvent::query()->insert($rows);
        $this->activityAt('keeper', now());

        $this->artisan('app:prune-events')->assertSuccessful();

        $this->assertSame(['keeper'], ActivityEvent::query()->pluck('tab_key')->all());
    }

    public function test_the_command_is_scheduled_daily(): void
    {
        // F12 disabled this schedule because the command did not exist yet; BE-026
        // re-enables it. Registering a schedule for a missing command breaks
        // schedule:list and schedule:run outright.
        $events = collect(app(Schedule::class)->events())
            ->filter(fn ($event) => str_contains($event->command ?? '', 'app:prune-events'));

        $this->assertCount(1, $events, 'app:prune-events should be scheduled exactly once');
        $this->assertSame('0 0 * * *', $events->first()->expression);
    }

    public function test_schedule_list_runs_without_erroring(): void
    {
        $this->artisan('schedule:list')->assertSuccessful();
    }
}
