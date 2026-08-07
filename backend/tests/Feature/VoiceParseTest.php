<?php

namespace Tests\Feature;

use App\Support\Messages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\MakesUsers;
use Tests\TestCase;

/**
 * BE-051 — POST /voice/parse. Ports the standalone `parse-voice-input` edge function.
 *
 * The provider is always faked: these tests pin the request we send and how we treat the
 * answer, never the model's behavior.
 */
class VoiceParseTest extends TestCase
{
    use MakesUsers, RefreshDatabase;

    private const ENDPOINT = 'https://ai-gateway.lovable.dev/*';

    protected function setUp(): void
    {
        parent::setUp();

        config(['printera.voice.api_key' => 'test-provider-key']);
        Http::preventStrayRequests();
    }

    /** @return array<string,string> */
    private function authAs(string $username = 'tester'): array
    {
        return $this->bearer($this->login(['username' => $username])->json('session_token'));
    }

    /** Fake the provider returning `$content` as the assistant message. */
    private function fakeProvider(string $content, int $status = 200): void
    {
        Http::fake([self::ENDPOINT => Http::response([
            'choices' => [['message' => ['content' => $content]]],
        ], $status)]);
    }

    /** @return array<string,mixed> the JSON body we sent to the provider */
    private function sentPayload(): array
    {
        $sent = [];
        Http::assertSent(function (Request $request) use (&$sent) {
            $sent = $request->data();

            return true;
        });

        return $sent;
    }

    // ── happy path ───────────────────────────────────────────────────────────

    public function test_extracted_fields_are_returned_with_the_transcript(): void
    {
        $this->makeUser();
        $this->fakeProvider(json_encode(['quantity' => 5000, 'colorCount' => 4, 'dieCut' => true]));

        $this->postJson('/api/v1/voice/parse', [
            'transcript' => 'خمس آلاف قطعة أربع ألوان مع تكسير',
            'calcType' => 'employee',
        ], $this->authAs())
            ->assertOk()
            ->assertExactJson([
                'fields' => ['quantity' => 5000, 'colorCount' => 4, 'dieCut' => true],
                'transcript' => 'خمس آلاف قطعة أربع ألوان مع تكسير',
            ]);
    }

    public function test_the_provider_request_matches_the_reference(): void
    {
        $this->makeUser();
        $this->fakeProvider('{}');

        $this->postJson('/api/v1/voice/parse', [
            'transcript' => 'نص',
            'calcType' => 'box',
        ], $this->authAs())->assertOk();

        $payload = $this->sentPayload();

        $this->assertSame('google/gemini-2.5-flash', $payload['model']);
        $this->assertSame(['type' => 'json_object'], $payload['response_format']);
        $this->assertSame('system', $payload['messages'][0]['role']);
        $this->assertSame('user', $payload['messages'][1]['role']);

        Http::assertSent(fn (Request $request) => $request->hasHeader('Authorization', 'Bearer test-provider-key'));
    }

    public function test_the_system_prompt_is_the_reference_text(): void
    {
        // These strings ARE the behavior — they teach the model the Egyptian print-shop
        // vocabulary and name the fields the SPA writes back into the form.
        $this->makeUser();
        $this->fakeProvider('{}');

        $this->postJson('/api/v1/voice/parse', [
            'transcript' => 'نص',
            'calcType' => 'employee',
            'paperTypeNames' => ['كوشيه', 'دوبلكس'],
        ], $this->authAs())->assertOk();

        $system = $this->sentPayload()['messages'][0]['content'];

        $this->assertStringContainsString('أنت مساعد ذكي متخصص في استخراج بيانات الطباعة من النص العربي المحكي.', $system);
        $this->assertStringContainsString('الحقول المطلوبة لنوع الحاسبة "employee":', $system);
        $this->assertStringContainsString('- "أربع ألوان" = colorCount: 4', $system);
        $this->assertStringContainsString('- "بدون سلفان" = 0، "سلفان وجه" = 1، "سلفان وجهين" = 2', $system);
        $this->assertStringContainsString('- أرجع JSON فقط بدون أي نص إضافي', $system);
        // paperTypeNames are interpolated into the paper field, comma-separated.
        $this->assertStringContainsString('الخيارات المتاحة: [كوشيه, دوبلكس]', $system);
    }

    public function test_the_user_prompt_quotes_the_transcript(): void
    {
        $this->makeUser();
        $this->fakeProvider('{}');

        $this->postJson('/api/v1/voice/parse', ['transcript' => 'ألف كرت', 'calcType' => 'manual'], $this->authAs())
            ->assertOk();

        $user = $this->sentPayload()['messages'][1]['content'];

        $this->assertStringContainsString('استخرج بيانات الطباعة من هذا النص:', $user);
        $this->assertStringContainsString('"ألف كرت"', $user);
    }

    /**
     * @return array<string,array{0:string,1:string}>
     */
    public static function calcTypes(): array
    {
        return [
            'employee' => ['employee', '- moldPrice (number): قيمة القالب بالريال'],
            'box' => ['box', '- pieces[].cellophaneFaces (number): أوجه السلفان'],
            'magazine' => ['magazine', '- cover.cellophaneFaces (number): سلفان الغلاف'],
            'manual' => ['manual', '- pricePerTon (number): سعر الطن'],
        ];
    }

    #[DataProvider('calcTypes')]
    public function test_each_calculator_gets_its_own_field_catalogue(string $calcType, string $marker): void
    {
        $this->makeUser();
        $this->fakeProvider('{}');

        $this->postJson('/api/v1/voice/parse', ['transcript' => 'نص', 'calcType' => $calcType], $this->authAs())
            ->assertOk();

        $system = $this->sentPayload()['messages'][0]['content'];

        $this->assertStringContainsString($marker, $system);
        $this->assertStringContainsString("لنوع الحاسبة \"{$calcType}\":", $system);
    }

    public function test_an_unknown_calc_type_falls_back_to_the_employee_catalogue(): void
    {
        $this->makeUser();
        $this->fakeProvider('{}');

        $this->postJson('/api/v1/voice/parse', ['transcript' => 'نص', 'calcType' => 'nonsense'], $this->authAs())
            ->assertOk();

        $this->assertStringContainsString(
            '- moldPrice (number): قيمة القالب بالريال',
            $this->sentPayload()['messages'][0]['content']
        );
    }

    // ── the empty-transcript short circuit ───────────────────────────────────

    public function test_an_empty_transcript_short_circuits_without_calling_the_provider(): void
    {
        // First branch in the reference, and note the shape: `fields` alone, no echoed
        // transcript. It must stay first — nothing may reject the request before it.
        $this->makeUser();
        Http::fake();

        $this->postJson('/api/v1/voice/parse', ['transcript' => '', 'calcType' => 'employee'], $this->authAs())
            ->assertOk()
            ->assertExactJson(['fields' => []]);

        Http::assertNothingSent();
    }

    public function test_a_missing_transcript_also_short_circuits(): void
    {
        $this->makeUser();
        Http::fake();

        $this->postJson('/api/v1/voice/parse', [], $this->authAs())
            ->assertOk()
            ->assertExactJson(['fields' => []]);

        Http::assertNothingSent();
    }

    public function test_empty_fields_serialise_as_an_object_not_an_array(): void
    {
        // `Object.keys(data.fields)` in VoiceInput.tsx would throw on a JSON array.
        $this->makeUser();
        Http::fake();

        $body = $this->postJson('/api/v1/voice/parse', ['transcript' => ''], $this->authAs())
            ->assertOk()->content();

        $this->assertSame('{"fields":{}}', $body);
    }

    // ── provider answers we must survive ─────────────────────────────────────

    public function test_unparseable_model_output_yields_no_fields(): void
    {
        $this->makeUser();
        $this->fakeProvider('this is not json at all');

        $response = $this->postJson('/api/v1/voice/parse', ['transcript' => 'نص'], $this->authAs())->assertOk();

        $response->assertExactJson(['fields' => [], 'transcript' => 'نص']);
        // On the wire too: `{}`, never `[]`.
        $this->assertStringContainsString('"fields":{}', $response->content());
    }

    public function test_an_empty_model_object_yields_no_fields(): void
    {
        $this->makeUser();
        $this->fakeProvider('{}');

        $this->postJson('/api/v1/voice/parse', ['transcript' => 'نص'], $this->authAs())
            ->assertOk()
            ->assertExactJson(['fields' => [], 'transcript' => 'نص']);
    }

    public function test_a_response_without_a_choices_array_yields_no_fields(): void
    {
        $this->makeUser();
        Http::fake([self::ENDPOINT => Http::response(['unexpected' => true])]);

        $this->postJson('/api/v1/voice/parse', ['transcript' => 'نص'], $this->authAs())
            ->assertOk()
            ->assertExactJson(['fields' => [], 'transcript' => 'نص']);
    }

    public function test_nested_fields_are_passed_through_untouched(): void
    {
        // The magazine and box catalogues ask for nested shapes; nothing may reshape them.
        $this->makeUser();
        $fields = [
            'quantity' => 1000,
            'inner' => ['paperType' => 'كوشيه', 'grammage' => 130, 'colorCount' => 4],
            'cover' => ['cellophaneFaces' => 2],
        ];
        $this->fakeProvider(json_encode($fields, JSON_UNESCAPED_UNICODE));

        $this->postJson('/api/v1/voice/parse', ['transcript' => 'نص', 'calcType' => 'magazine'], $this->authAs())
            ->assertOk()
            ->assertExactJson(['fields' => $fields, 'transcript' => 'نص']);
    }

    // ── failures ─────────────────────────────────────────────────────────────

    public function test_a_provider_error_becomes_the_generic_arabic_500(): void
    {
        // The reference returns `AI API error [500]: <body>` straight to the client, which
        // can carry upstream account detail into an Arabic RTL toast.
        $this->makeUser();
        Http::fake([self::ENDPOINT => Http::response(['error' => 'quota exceeded for org acct_12345'], 429)]);

        $response = $this->postJson('/api/v1/voice/parse', ['transcript' => 'نص'], $this->authAs())
            ->assertStatus(500)
            ->assertExactJson(['error' => Messages::SERVER_ERROR]);

        $this->assertStringNotContainsString('acct_12345', $response->content());
    }

    public function test_a_missing_provider_key_never_leaks_into_the_response(): void
    {
        $this->makeUser();
        config(['printera.voice.api_key' => null]);
        Http::fake();

        $this->postJson('/api/v1/voice/parse', ['transcript' => 'نص'], $this->authAs())
            ->assertStatus(500)
            ->assertExactJson(['error' => Messages::SERVER_ERROR]);

        Http::assertNothingSent();
    }

    public function test_the_provider_key_is_never_returned_to_the_client(): void
    {
        $this->makeUser();
        $this->fakeProvider(json_encode(['quantity' => 10]));

        $body = $this->postJson('/api/v1/voice/parse', ['transcript' => 'نص'], $this->authAs())
            ->assertOk()->content();

        $this->assertStringNotContainsString('test-provider-key', $body);
    }

    // ── authorization ────────────────────────────────────────────────────────

    public function test_voice_parsing_requires_a_session(): void
    {
        // The reference edge function was entirely unauthenticated — anyone holding the
        // public anon key could spend the project's AI credits.
        Http::fake();

        $this->postJson('/api/v1/voice/parse', ['transcript' => 'نص'])
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);

        Http::assertNothingSent();
    }

    public function test_a_revoked_session_cannot_spend_credits(): void
    {
        $user = $this->makeUser();
        $auth = $this->authAs();
        $this->fakeProvider('{}');

        $this->postJson('/api/v1/voice/parse', ['transcript' => 'نص'], $auth)->assertOk();

        $user->sessions()->delete();

        $this->postJson('/api/v1/voice/parse', ['transcript' => 'نص'], $auth)
            ->assertStatus(401)
            ->assertJson(['session_expired' => true]);

        Http::assertSentCount(1);
    }

    public function test_an_employee_may_use_voice_input(): void
    {
        // No role gate: voice input is available on the calculator tabs any user can open.
        $owner = $this->makeUser(['username' => 'owner', 'max_employees' => 2]);
        $this->makeUser(['username' => 'emp', 'parent_user_id' => $owner->id]);
        $this->fakeProvider(json_encode(['quantity' => 100]));

        $this->postJson('/api/v1/voice/parse', ['transcript' => 'مية قطعة'], $this->authAs('emp'))
            ->assertOk()
            ->assertJson(['fields' => ['quantity' => 100]]);
    }
}
