<?php

namespace Tests\Feature;

use App\Models\UserSetting;
use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-020 — GET/PUT /settings. Ports handleLoadSettings / handleSaveSettings
 * (manage-users/index.ts:480-513). Self-scoped: identity comes from the JWT.
 */
class SettingsTest extends TestCase
{
    use MakesUsers, RefreshDatabase;

    /** @return array<string,string> */
    private function authAs(string $username = 'tester', string $device = 'dev-1'): array
    {
        return $this->bearer($this->login(['username' => $username, 'device_id' => $device])->json('session_token'));
    }

    public function test_settings_round_trip(): void
    {
        $this->makeUser();
        $auth = $this->authAs();

        $this->putJson('/api/v1/settings', [
            'settings' => [
                ['key' => 'paperTypes', 'value' => [['name' => 'كوشيه', 'gsm' => 300]]],
                ['key' => 'profitMargins', 'value' => ['default' => 15]],
            ],
        ], $auth)->assertOk()->assertExactJson(['success' => true]);

        $this->getJson('/api/v1/settings', $auth)
            ->assertOk()
            ->assertExactJson([
                'settings' => [
                    'paperTypes' => [['name' => 'كوشيه', 'gsm' => 300]],
                    'profitMargins' => ['default' => 15],
                ],
            ]);
    }

    public function test_empty_settings_returns_an_empty_map_not_null(): void
    {
        $this->makeUser();

        $this->getJson('/api/v1/settings', $this->authAs())
            ->assertOk()
            ->assertExactJson(['settings' => []]);
    }

    public function test_upsert_overwrites_the_existing_key(): void
    {
        $user = $this->makeUser();
        $auth = $this->authAs();

        $this->putJson('/api/v1/settings', [
            'settings' => [['key' => 'priceSettings', 'value' => ['plate' => 100]]],
        ], $auth)->assertOk();

        $this->putJson('/api/v1/settings', [
            'settings' => [['key' => 'priceSettings', 'value' => ['plate' => 250]]],
        ], $auth)->assertOk();

        // One row, latest value — the (user_id, setting_key) unique constraint is the
        // upsert target, not an insert-only log.
        $this->assertSame(1, UserSetting::query()->where('user_id', $user->id)->count());
        $this->assertSame(
            ['plate' => 250],
            UserSetting::query()->where('user_id', $user->id)->firstOrFail()->setting_value
        );
    }

    public function test_opaque_json_is_stored_unreshaped(): void
    {
        // The frontend owns these shapes; deep nesting, mixed types, Arabic keys and empty
        // structures must all survive a round trip untouched.
        $payload = [
            'nested' => ['a' => [1, 2, ['deep' => true]], 'ب' => 'قيمة'],
            'emptyObject' => [],
            'zero' => 0,
            'false' => false,
            'nullish' => null,
            'float' => 1.5,
        ];

        $this->makeUser();
        $auth = $this->authAs();

        $this->putJson('/api/v1/settings', [
            'settings' => [['key' => 'finishingItems', 'value' => $payload]],
        ], $auth)->assertOk();

        $this->assertSame(
            $payload,
            $this->getJson('/api/v1/settings', $auth)->json('settings.finishingItems')
        );
    }

    public function test_writing_another_users_settings_is_forbidden(): void
    {
        $this->makeUser();
        $victim = $this->makeUser(['username' => 'victim']);
        $auth = $this->authAs();

        $this->putJson('/api/v1/settings', [
            'user_id' => $victim->id,
            'settings' => [['key' => 'priceSettings', 'value' => ['plate' => 1]]],
        ], $auth)->assertStatus(403)->assertJson(['error' => Messages::NOT_AUTHORIZED]);

        // Nothing was written anywhere — not to the victim, not to the caller.
        $this->assertSame(0, UserSetting::query()->count());
    }

    public function test_reading_another_users_settings_is_forbidden(): void
    {
        $this->makeUser();
        $victim = $this->makeUser(['username' => 'victim']);
        $victim->settings()->create(['setting_key' => 'priceSettings', 'setting_value' => ['secret' => true]]);

        $this->getJson('/api/v1/settings?user_id='.$victim->id, $this->authAs())
            ->assertStatus(403)
            ->assertJson(['error' => Messages::NOT_AUTHORIZED]);
    }

    public function test_a_matching_user_id_is_accepted(): void
    {
        // The current client echoes the caller's own id; that must keep working.
        $user = $this->makeUser();
        $auth = $this->authAs();

        $this->putJson('/api/v1/settings', [
            'user_id' => $user->id,
            'settings' => [['key' => 'paperTypes', 'value' => ['ok' => 1]]],
        ], $auth)->assertOk()->assertExactJson(['success' => true]);

        $this->getJson('/api/v1/settings?user_id='.$user->id, $auth)
            ->assertOk()
            ->assertJson(['settings' => ['paperTypes' => ['ok' => 1]]]);
    }

    public function test_settings_are_never_shared_between_tenants(): void
    {
        $mine = $this->makeUser();
        $theirs = $this->makeUser(['username' => 'other']);
        $theirs->settings()->create(['setting_key' => 'paperTypes', 'setting_value' => ['theirs' => true]]);
        $mine->settings()->create(['setting_key' => 'paperTypes', 'setting_value' => ['mine' => true]]);

        $this->getJson('/api/v1/settings', $this->authAs())
            ->assertOk()
            ->assertExactJson(['settings' => ['paperTypes' => ['mine' => true]]]);
    }

    public function test_settings_require_authentication(): void
    {
        $this->getJson('/api/v1/settings')->assertStatus(401)->assertJson(['session_expired' => true]);
        $this->putJson('/api/v1/settings', ['settings' => []])->assertStatus(401);
    }

    public function test_malformed_entries_are_skipped_without_failing_the_batch(): void
    {
        $user = $this->makeUser();

        $this->putJson('/api/v1/settings', [
            'settings' => [
                ['value' => 'no key at all'],
                ['key' => '', 'value' => 'empty key'],
                'not-an-array',
                ['key' => 'paperTypes', 'value' => ['good' => true]],
            ],
        ], $this->authAs())->assertOk()->assertExactJson(['success' => true]);

        $this->assertSame(1, UserSetting::query()->where('user_id', $user->id)->count());
        $this->assertSame('paperTypes', UserSetting::query()->firstOrFail()->setting_key);
    }
}
