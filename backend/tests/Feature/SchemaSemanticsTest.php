<?php

namespace Tests\Feature;

use App\Models\ActivityEvent;
use App\Models\AppUser;
use App\Models\SavedQuote;
use App\Models\UserSetting;
use App\Support\Messages;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\Concerns\ComparesJson;
use Tests\TestCase;

/**
 * BE-060 — schema BEHAVIOUR that must be identical on SQLite, PostgreSQL and MySQL.
 *
 * The per-engine files (PostgresSchemaTest, MysqlSchemaTest) assert how each database
 * spells things. This one asserts what the application is entitled to assume regardless,
 * and so it runs on every lane:
 *
 *     php artisan test --filter=SchemaSemanticsTest                     (sqlite)
 *     ./vendor/bin/phpunit -c phpunit.pgsql.xml --filter=SchemaSemantics
 *     ./vendor/bin/phpunit -c phpunit.mysql.xml --filter=SchemaSemantics
 *
 * It exists because BE-060 changed how two of these are IMPLEMENTED without changing what
 * they mean: the (user_id, device_id) uniqueness moved from a PostgreSQL partial index to
 * a plain one, and the JSON `{}` defaults moved from the column to the model. Both were
 * previously pinned by Postgres-only tests, which would have let MySQL regress silently.
 */
class SchemaSemanticsTest extends TestCase
{
    use ComparesJson, RefreshDatabase;

    private function makeUser(string $username = 'schema-tester'): AppUser
    {
        return AppUser::query()->create([
            'username' => $username,
            'password_hash' => Hash::make('secret123'),
            'is_active' => true,
            'is_admin' => false,
            'max_devices' => 5,
        ]);
    }

    /** @param  array<string,mixed>  $overrides */
    private function sessionRow(AppUser $user, array $overrides = []): array
    {
        return array_merge([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'session_token' => bin2hex(random_bytes(32)),
            'device_id' => null,
            'device_info' => 'ua',
            'ip_address' => '203.0.113.1',
            'last_active_at' => now(),
            'created_at' => now(),
        ], $overrides);
    }

    // ── 1 · (user_id, device_id) uniqueness ──────────────────────────────────

    public function test_many_sessions_may_share_a_null_device_id(): void
    {
        // The reason the index used to be partial. A plain unique gives the same result
        // because SQL treats NULLs as distinct — true on all three engines — so the
        // WHERE clause was never load-bearing.
        $user = $this->makeUser();

        DB::table('user_sessions')->insert($this->sessionRow($user, ['device_id' => null]));
        DB::table('user_sessions')->insert($this->sessionRow($user, ['device_id' => null]));
        DB::table('user_sessions')->insert($this->sessionRow($user, ['device_id' => null]));

        $this->assertSame(3, DB::table('user_sessions')->where('user_id', $user->id)->count());
    }

    public function test_the_same_device_id_cannot_be_registered_twice_for_one_user(): void
    {
        $user = $this->makeUser();
        DB::table('user_sessions')->insert($this->sessionRow($user, ['device_id' => 'dev-shared']));

        $this->expectException(QueryException::class);
        DB::table('user_sessions')->insert($this->sessionRow($user, ['device_id' => 'dev-shared']));
    }

    public function test_the_same_device_id_is_fine_across_different_users(): void
    {
        $a = $this->makeUser('schema-a');
        $b = $this->makeUser('schema-b');

        DB::table('user_sessions')->insert($this->sessionRow($a, ['device_id' => 'dev-shared']));
        DB::table('user_sessions')->insert($this->sessionRow($b, ['device_id' => 'dev-shared']));

        $this->assertSame(2, DB::table('user_sessions')->where('device_id', 'dev-shared')->count());
    }

    public function test_device_reuse_still_rotates_rather_than_duplicating(): void
    {
        // The behaviour the constraint protects, end to end through the login path.
        $this->makeUser('reuse-user');

        $first = $this->postJson('/api/v1/auth/login', [
            'username' => 'reuse-user', 'password' => 'secret123', 'device_id' => 'dev-1',
        ])->assertOk()->json('session_token');

        $second = $this->postJson('/api/v1/auth/login', [
            'username' => 'reuse-user', 'password' => 'secret123', 'device_id' => 'dev-1',
        ])->assertOk()->json('session_token');

        $this->assertNotSame($first, $second);
        $this->assertSame(1, DB::table('user_sessions')->where('device_id', 'dev-1')->count());
    }

    // ── 2 · JSON defaults, now supplied by the models ────────────────────────

    public function test_models_supply_the_json_default_when_the_column_is_omitted(): void
    {
        // This was a DB-level DEFAULT '{}' until BE-060; MySQL forbids that on JSON, so
        // the default moved to $attributes. Same observable result.
        $user = $this->makeUser();

        $quote = SavedQuote::query()->create(['user_id' => $user->id, 'title' => 'no json given']);
        $setting = UserSetting::query()->create(['user_id' => $user->id, 'setting_key' => 'paperTypes']);
        $event = ActivityEvent::query()->create([
            'user_id' => $user->id, 'username' => $user->username, 'action' => 'tab_open', 'occurred_at' => now(),
        ]);

        $this->assertSame([], $quote->fresh()->quote_data);
        $this->assertSame([], $setting->fresh()->setting_value);
        $this->assertSame([], $event->fresh()->details);
    }

    public function test_a_raw_insert_omitting_the_json_column_reads_back_as_an_empty_array(): void
    {
        // The query builder bypasses $attributes, so the column really is NULL here. The
        // JsonObject cast is what keeps that indistinguishable from '{}' to every reader.
        $user = $this->makeUser();

        $quoteId = (string) Str::uuid();
        DB::table('saved_quotes')->insert(['id' => $quoteId, 'user_id' => $user->id]);

        $settingId = (string) Str::uuid();
        DB::table('user_settings')->insert([
            'id' => $settingId, 'user_id' => $user->id, 'setting_key' => 'priceSettings',
        ]);

        $eventId = (string) Str::uuid();
        DB::table('activity_events')->insert([
            'id' => $eventId, 'user_id' => $user->id, 'username' => $user->username,
            'action' => 'tab_open', 'occurred_at' => now(),
        ]);

        $this->assertSame([], SavedQuote::query()->findOrFail($quoteId)->quote_data);
        $this->assertSame([], UserSetting::query()->findOrFail($settingId)->setting_value);
        $this->assertSame([], ActivityEvent::query()->findOrFail($eventId)->details);
    }

    public function test_an_omitted_json_column_survives_the_api(): void
    {
        // The shape the SPA receives must still be an object, not null.
        $this->makeUser('api-json-user');
        $token = $this->postJson('/api/v1/auth/login', [
            'username' => 'api-json-user', 'password' => 'secret123', 'device_id' => 'd1',
        ])->assertOk()->json('session_token');

        $this->postJson('/api/v1/quotes', ['title' => 'no quote_data'], ['Authorization' => "Bearer {$token}"])
            ->assertOk()
            ->assertJsonPath('quote.quote_data', []);
    }

    public function test_json_columns_round_trip_opaquely(): void
    {
        $user = $this->makeUser();
        $payload = [
            'nested' => ['deep' => [1, 2, ['x' => null]]],
            'arabic' => 'ورق كوشيه 300 جرام',
            'zero' => 0, 'false' => false, 'empty' => [], 'float' => 12.75,
        ];

        $quote = SavedQuote::query()->create(['user_id' => $user->id, 'quote_data' => $payload]);
        $setting = UserSetting::query()->create([
            'user_id' => $user->id, 'setting_key' => 'finishingItems', 'setting_value' => $payload,
        ]);

        $this->assertSameJson($payload, $quote->fresh()->quote_data);
        $this->assertSameJson($payload, $setting->fresh()->setting_value);
    }

    // ── 3 · event_type ───────────────────────────────────────────────────────

    public function test_all_four_documented_event_types_are_accepted(): void
    {
        $user = $this->makeUser();

        foreach (['login', 'logout', 'heartbeat', 'auto_logout'] as $type) {
            DB::table('session_events')->insert([
                'id' => (string) Str::uuid(), 'user_id' => $user->id, 'username' => $user->username,
                'event_type' => $type, 'occurred_at' => now(),
            ]);
        }

        $this->assertSame(4, DB::table('session_events')->count());
    }

    // ── 4 · identity columns are case-SENSITIVE everywhere ───────────────────

    public function test_usernames_are_case_sensitive(): void
    {
        // A locked product decision matching Supabase. MySQL's default collation would
        // have folded these into one account — SchemaCollation is what prevents it.
        $this->makeUser('CaseUser');
        $this->makeUser('caseuser');

        $this->assertSame(2, AppUser::query()->whereIn('username', ['CaseUser', 'caseuser'])->count());
    }

    public function test_a_wrong_case_username_does_not_log_in(): void
    {
        $this->makeUser('ExactCase');

        $this->postJson('/api/v1/auth/login', [
            'username' => 'exactcase', 'password' => 'secret123', 'device_id' => 'd1',
        ])->assertOk()->assertJson(['error' => Messages::BAD_CREDENTIALS]);
    }

    public function test_opaque_keys_differing_only_in_case_are_distinct_rows(): void
    {
        // tab_key and setting_key are documented as OPAQUE. Under MySQL's default
        // case-insensitive collation these composite uniques would collide and the second
        // write would fail — a different result per engine for the same request.
        $user = $this->makeUser();

        $user->tabPermissions()->create(['tab_key' => 'itemcost', 'is_enabled' => true]);
        $user->tabPermissions()->create(['tab_key' => 'ItemCost', 'is_enabled' => false]);

        $user->settings()->create(['setting_key' => 'paperTypes', 'setting_value' => ['a' => 1]]);
        $user->settings()->create(['setting_key' => 'papertypes', 'setting_value' => ['b' => 2]]);

        $this->assertSame(2, $user->tabPermissions()->count());
        $this->assertSame(2, $user->settings()->count());
    }

    public function test_username_is_unique(): void
    {
        $this->makeUser('dupe-user');

        $this->expectException(QueryException::class);
        $this->makeUser('dupe-user');
    }

    // ── 5 · cascades & far-future dates ──────────────────────────────────────

    public function test_deleting_an_owner_cascades_to_its_children(): void
    {
        $owner = $this->makeUser('cascade-owner');
        $employee = $this->makeUser('cascade-employee');
        $employee->forceFill(['parent_user_id' => $owner->id])->save();
        DB::table('user_sessions')->insert($this->sessionRow($owner, ['device_id' => 'dev-x']));

        $owner->delete();

        $this->assertSame(0, DB::table('app_users')->where('id', $employee->id)->count());
        $this->assertSame(0, DB::table('user_sessions')->where('user_id', $owner->id)->count());
    }

    public function test_a_subscription_can_expire_beyond_2038(): void
    {
        // Why expires_at is DATETIME rather than TIMESTAMP: MySQL's TIMESTAMP range ends
        // 2038-01-19, and a long subscription sold today lands past it.
        $user = $this->makeUser('long-subscription');
        $user->forceFill(['expires_at' => '2087-06-01 12:00:00'])->save();

        $this->assertSame('2087-06-01', $user->fresh()->expires_at->toDateString());
    }

    public function test_a_far_future_subscription_still_gates_login(): void
    {
        $user = $this->makeUser('future-user');
        $user->forceFill(['expires_at' => '2087-06-01 12:00:00'])->save();

        $this->postJson('/api/v1/auth/login', [
            'username' => 'future-user', 'password' => 'secret123', 'device_id' => 'd1',
        ])->assertOk()->assertJson(['success' => true]);

        $user->forceFill(['expires_at' => '2020-01-01 00:00:00'])->save();

        $this->postJson('/api/v1/auth/login', [
            'username' => 'future-user', 'password' => 'secret123', 'device_id' => 'd2',
        ])->assertOk()->assertJson(['error' => Messages::ACCOUNT_EXPIRED]);
    }
}
