<?php

namespace Tests\Feature;

use App\Models\ActivityEvent;
use App\Models\UserSession;
use App\Services\ActivityService;
use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\ComparesJson;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-025 — POST /activity/batch. Ports handleLogActivityBatch (index.ts:338-375).
 *
 * The contract that matters here is "never 401, never throw": the client fires this from
 * navigator.sendBeacon during page hide.
 */
class ActivityBatchTest extends TestCase
{
    use ComparesJson, MakesUsers, RefreshDatabase;

    private function tokenForNewSession(): string
    {
        $this->makeUser();

        return $this->login()->json('session_token');
    }

    /** @param  array<int,mixed>  $events */
    private function postBatch(?string $token, array $events): TestResponse
    {
        $body = ['events' => $events];

        if ($token !== null) {
            $body['session_token'] = $token;
        }

        return $this->postJson('/api/v1/activity/batch', $body);
    }

    private function event(string $action = 'tab_open', array $overrides = []): array
    {
        return array_merge([
            'action' => $action,
            'tab_key' => 'itemcost',
            'details' => ['n' => 1],
            'occurred_at' => now()->toISOString(),
        ], $overrides);
    }

    // ── happy path ───────────────────────────────────────────────────────────

    public function test_events_are_logged_and_tagged_with_the_caller(): void
    {
        $token = $this->tokenForNewSession();
        $session = UserSession::query()->firstOrFail();

        $this->postBatch($token, [$this->event('calculate'), $this->event('save_quote')])
            ->assertOk()
            ->assertExactJson(['success' => true, 'logged' => 2]);

        $row = ActivityEvent::query()->where('action', 'calculate')->firstOrFail();
        $this->assertSame($session->user_id, $row->user_id);
        $this->assertSame('tester', $row->username);
        // Tagged with the jti, which is what admin analytics groups sessions by.
        $this->assertSame($session->session_token, $row->session_token);
        $this->assertSame('itemcost', $row->tab_key);
        $this->assertSame(['n' => 1], $row->details);
    }

    public function test_details_json_round_trips_through_the_cast(): void
    {
        // Rows are bulk-inserted via the query builder, so `details` is encoded by hand —
        // this asserts the model's array cast still reads it back correctly.
        $token = $this->tokenForNewSession();
        $details = ['nested' => ['a' => [1, 2]], 'arabic' => 'ورق', 'zero' => 0, 'false' => false];

        $this->postBatch($token, [$this->event('calculate', ['details' => $details])])->assertOk();

        $this->assertSameJson($details, ActivityEvent::query()->firstOrFail()->details);
    }

    public function test_the_bearer_header_is_accepted_as_well_as_the_body(): void
    {
        $token = $this->tokenForNewSession();

        $this->postJson('/api/v1/activity/batch', ['events' => [$this->event()]], $this->bearer($token))
            ->assertOk()
            ->assertJson(['success' => true, 'logged' => 1]);
    }

    public function test_a_raw_sendbeacon_style_body_is_accepted(): void
    {
        // sendBeacon posts a Blob with Content-Type: application/json and no other
        // headers — no apikey, no Authorization.
        $token = $this->tokenForNewSession();

        $this->call(
            'POST',
            '/api/v1/activity/batch',
            [], [], [],
            ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'],
            json_encode(['session_token' => $token, 'events' => [$this->event()]])
        )->assertOk()->assertJson(['success' => true, 'logged' => 1]);

        $this->assertSame(1, ActivityEvent::query()->count());
    }

    // ── filtering & caps ─────────────────────────────────────────────────────

    public function test_disallowed_actions_are_dropped_silently(): void
    {
        $token = $this->tokenForNewSession();

        $this->postBatch($token, [
            $this->event('tab_open'),
            $this->event('drop_database'),
            $this->event('DELETE'),
            ['action' => 123],
            ['no_action' => true],
            'not-an-array',
            $this->event('export_pdf'),
        ])->assertOk()->assertJson(['success' => true, 'logged' => 2]);

        $this->assertSame(
            ['export_pdf', 'tab_open'],
            ActivityEvent::query()->orderBy('action')->pluck('action')->all()
        );
    }

    public function test_every_documented_action_is_accepted(): void
    {
        $token = $this->tokenForNewSession();

        $events = array_map(fn (string $a) => $this->event($a), ActivityService::ALLOWED_ACTIONS);

        $this->postBatch($token, $events)
            ->assertOk()
            ->assertJson(['logged' => count(ActivityService::ALLOWED_ACTIONS)]);
    }

    public function test_the_batch_is_capped_at_200_events(): void
    {
        $token = $this->tokenForNewSession();

        $events = array_fill(0, 250, $this->event('calculate'));

        $this->postBatch($token, $events)->assertOk()->assertJson(['success' => true, 'logged' => 200]);

        $this->assertSame(200, ActivityEvent::query()->count());
    }

    public function test_tab_key_is_truncated_to_64_characters(): void
    {
        $token = $this->tokenForNewSession();

        $this->postBatch($token, [$this->event('tab_open', ['tab_key' => str_repeat('x', 200)])])->assertOk();

        $this->assertSame(64, mb_strlen(ActivityEvent::query()->firstOrFail()->tab_key));
    }

    public function test_missing_optional_fields_fall_back_to_defaults(): void
    {
        $token = $this->tokenForNewSession();

        $this->postBatch($token, [['action' => 'voice_input']])->assertOk()->assertJson(['logged' => 1]);

        $row = ActivityEvent::query()->firstOrFail();
        $this->assertNull($row->tab_key);
        $this->assertSame([], $row->details);
        $this->assertNotNull($row->occurred_at);
    }

    public function test_an_unparseable_occurred_at_falls_back_to_now(): void
    {
        $token = $this->tokenForNewSession();

        $this->postBatch($token, [$this->event('calculate', ['occurred_at' => 'not-a-date'])])
            ->assertOk()
            ->assertJson(['logged' => 1]);

        $this->assertTrue(ActivityEvent::query()->firstOrFail()->occurred_at->greaterThan(now()->subMinute()));
    }

    public function test_a_client_supplied_timestamp_is_honoured(): void
    {
        $token = $this->tokenForNewSession();
        $when = now()->subHours(3);

        $this->postBatch($token, [$this->event('calculate', ['occurred_at' => $when->toISOString()])])->assertOk();

        $this->assertSame(
            $when->startOfSecond()->timestamp,
            ActivityEvent::query()->firstOrFail()->occurred_at->startOfSecond()->timestamp
        );
    }

    // ── soft auth: never 401, never throw ────────────────────────────────────

    public function test_a_missing_token_is_200_not_401(): void
    {
        $this->postBatch(null, [$this->event()])
            ->assertOk()
            ->assertExactJson(['error' => Messages::SESSION_INVALID, 'session_expired' => true]);
    }

    public function test_a_garbage_token_is_200_not_401(): void
    {
        $this->postBatch('this-is-not-a-jwt', [$this->event()])
            ->assertOk()
            ->assertExactJson(['error' => Messages::SESSION_ENDED, 'session_expired' => true]);

        $this->assertSame(0, ActivityEvent::query()->count());
    }

    public function test_a_revoked_session_is_200_not_401(): void
    {
        $token = $this->tokenForNewSession();
        UserSession::query()->delete();

        $this->postBatch($token, [$this->event()])
            ->assertOk()
            ->assertExactJson(['error' => Messages::SESSION_ENDED, 'session_expired' => true]);
    }

    public function test_a_deactivated_user_is_200_not_401(): void
    {
        $token = $this->tokenForNewSession();
        UserSession::query()->firstOrFail()->user->forceFill(['is_active' => false])->save();

        $this->postBatch($token, [$this->event()])
            ->assertOk()
            ->assertJson(['session_expired' => true]);

        $this->assertSame(0, ActivityEvent::query()->count());
    }

    public function test_an_empty_batch_succeeds_without_validating_the_session(): void
    {
        // Reference branch order: the events check precedes the session lookup, so a
        // stale token with nothing to send still gets a clean success.
        $this->postBatch('garbage-token', [])->assertOk()->assertExactJson(['success' => true, 'logged' => 0]);

        // `events` present but not an array at all.
        $this->postJson('/api/v1/activity/batch', [
            'session_token' => 'garbage-token',
            'events' => 'not-an-array',
        ])->assertOk()->assertExactJson(['success' => true, 'logged' => 0]);

        // `events` missing entirely.
        $this->postJson('/api/v1/activity/batch', ['session_token' => 'garbage-token'])
            ->assertOk()
            ->assertExactJson(['success' => true, 'logged' => 0]);
    }

    public function test_a_batch_of_only_disallowed_actions_reports_zero(): void
    {
        $token = $this->tokenForNewSession();

        $this->postBatch($token, [$this->event('rm_rf'), $this->event('nope')])
            ->assertOk()
            ->assertExactJson(['success' => true, 'logged' => 0]);
    }

    public function test_the_endpoint_does_not_refresh_last_active_at(): void
    {
        // A background beacon must not make an idle session look alive — the reference
        // reads user_sessions directly here rather than via getUserFromSession.
        $token = $this->tokenForNewSession();
        $session = UserSession::query()->firstOrFail();
        $session->forceFill(['last_active_at' => now()->subHours(5)])->save();
        $before = $session->fresh()->last_active_at;

        $this->postBatch($token, [$this->event()])->assertOk();

        $this->assertSame($before->timestamp, $session->fresh()->last_active_at->timestamp);
    }

    public function test_events_cannot_be_attributed_to_another_user(): void
    {
        $token = $this->tokenForNewSession();
        $victim = $this->makeUser(['username' => 'victim']);

        $this->postBatch($token, [$this->event('calculate', ['user_id' => $victim->id, 'username' => 'victim'])])
            ->assertOk();

        $row = ActivityEvent::query()->firstOrFail();
        $this->assertSame('tester', $row->username);
        $this->assertNotSame($victim->id, $row->user_id);
    }
}
