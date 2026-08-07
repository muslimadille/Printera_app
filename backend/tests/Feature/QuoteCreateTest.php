<?php

namespace Tests\Feature;

use App\Models\SavedQuote;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-021 — POST /quotes. Ports handleSaveQuote (manage-users/index.ts:694-711).
 */
class QuoteCreateTest extends TestCase
{
    use MakesUsers, RefreshDatabase;

    /** @return array<string,string> */
    private function authAs(string $username = 'tester', string $device = 'dev-1'): array
    {
        return $this->bearer($this->login(['username' => $username, 'device_id' => $device])->json('session_token'));
    }

    public function test_creates_a_quote_under_the_caller(): void
    {
        $user = $this->makeUser();

        $res = $this->postJson('/api/v1/quotes', [
            'title' => 'كتالوج',
            'customer_name' => 'مطبعة النور',
            'quote_number' => 'Q-1001',
            'source_type' => 'diecut5',
            'quote_data' => ['sheets' => 500, 'colors' => ['cmyk' => true]],
        ], $this->authAs())->assertOk();

        $res->assertJson(['quote' => [
            'user_id' => $user->id,
            'title' => 'كتالوج',
            'customer_name' => 'مطبعة النور',
            'quote_number' => 'Q-1001',
            'source_type' => 'diecut5',
            'quote_data' => ['sheets' => 500, 'colors' => ['cmyk' => true]],
        ]]);
        $res->assertJsonStructure(['quote' => ['id', 'user_id', 'title', 'customer_name',
            'quote_number', 'source_type', 'quote_data', 'created_at', 'updated_at']]);

        // Tags belong to related_quotes only — a freshly created quote carries neither.
        $res->assertJsonMissingPath('quote.employee_username');
        $res->assertJsonMissingPath('quote.is_parent_quote');

        $this->assertSame(1, SavedQuote::query()->where('user_id', $user->id)->count());
    }

    public function test_defaults_match_the_reference(): void
    {
        $this->makeUser();

        $this->postJson('/api/v1/quotes', [], $this->authAs())
            ->assertOk()
            ->assertJson(['quote' => [
                'title' => '',
                'customer_name' => '',
                'quote_number' => '',
                'source_type' => 'calculator',
                'quote_data' => [],
            ]]);
    }

    public function test_empty_source_type_falls_back_to_calculator(): void
    {
        // The reference writes `source_type || 'calculator'` — JS falsy-coalescing, so ''
        // takes the default. PHP's ?? would have kept the empty string.
        $this->makeUser();

        $this->postJson('/api/v1/quotes', [
            'source_type' => '',
            'title' => '',
        ], $this->authAs())
            ->assertOk()
            ->assertJson(['quote' => ['source_type' => 'calculator', 'title' => '']]);
    }

    public function test_quote_data_is_stored_opaquely(): void
    {
        $payload = [
            'nested' => ['deep' => [1, 2, ['x' => null]]],
            'zero' => 0,
            'false' => false,
            'empty' => [],
            'arabic' => 'ورق كوشيه 300 جرام',
            'float' => 12.75,
        ];

        $this->makeUser();

        $id = $this->postJson('/api/v1/quotes', ['quote_data' => $payload], $this->authAs())
            ->assertOk()->json('quote.id');

        $this->assertSame($payload, SavedQuote::query()->findOrFail($id)->quote_data);
    }

    public function test_a_quote_is_always_owned_by_the_caller_not_a_body_user_id(): void
    {
        $caller = $this->makeUser();
        $victim = $this->makeUser(['username' => 'victim']);

        $this->postJson('/api/v1/quotes', [
            'user_id' => $victim->id,   // must be ignored; ownership comes from the JWT
            'title' => 'planted',
        ], $this->authAs())->assertOk()->assertJson(['quote' => ['user_id' => $caller->id]]);

        $this->assertSame(0, SavedQuote::query()->where('user_id', $victim->id)->count());
    }

    public function test_creating_a_quote_requires_authentication(): void
    {
        $this->postJson('/api/v1/quotes', ['title' => 'x'])
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);
    }

    public function test_timestamps_are_iso_8601(): void
    {
        $this->makeUser();

        $created = $this->postJson('/api/v1/quotes', [], $this->authAs())->assertOk()->json('quote.created_at');

        $this->assertNotNull($created);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/', $created);
    }
}
