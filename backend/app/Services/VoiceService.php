<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;
use stdClass;

/**
 * Arabic speech → calculator fields. Ports the standalone `parse-voice-input` edge
 * function (supabase/functions/parse-voice-input/index.ts).
 *
 * The provider key is read from config (never env() at runtime — PHASE-0-1-AUDIT.md F2)
 * and never leaves the server, which is the whole reason this is a backend endpoint rather
 * than a direct browser call.
 */
class VoiceService
{
    /** The reference's fallback catalogue when `calcType` is unknown (index.ts:100). */
    public const DEFAULT_CALC_TYPE = 'employee';

    /**
     * The reference sets no timeout, so a hung provider would pin a worker until PHP's own
     * limit. Voice parsing is interactive — the user is watching a spinner — so a bounded
     * wait is both safer and truer to what the feature promises.
     */
    private const TIMEOUT_SECONDS = 30;

    public function __construct(private readonly VoicePromptBuilder $prompts) {}

    /**
     * @param  array<int,string>  $paperTypeNames
     * @return array<string,mixed>|stdClass the extracted fields; an empty object, not [],
     *                                      so the JSON stays `{}` as the SPA expects
     */
    public function parse(string $transcript, string $calcType, array $paperTypeNames): array|stdClass
    {
        $apiKey = (string) config('printera.voice.api_key');

        if ($apiKey === '') {
            // Mirrors the reference's "LOVABLE_API_KEY not configured" throw. Surfaces as
            // the generic Arabic 500; the operator sees the real reason in the log.
            throw new RuntimeException('Voice AI api key is not configured (printera.voice.api_key).');
        }

        $response = Http::withToken($apiKey)
            ->timeout(self::TIMEOUT_SECONDS)
            ->post((string) config('printera.voice.base_url'), [
                'model' => (string) config('printera.voice.model'),
                'messages' => [
                    ['role' => 'system', 'content' => $this->prompts->systemPrompt($calcType, $paperTypeNames)],
                    ['role' => 'user', 'content' => $this->prompts->userPrompt($transcript)],
                ],
                'response_format' => ['type' => 'json_object'],
            ]);

        if (! $response->successful()) {
            // Deliberately does NOT echo the provider's body. The reference returns
            // `AI API error [status]: <body>` straight to the client, which can carry
            // upstream account details into an Arabic RTL toast.
            throw new RuntimeException("Voice AI provider returned HTTP {$response->status()}.");
        }

        return $this->decodeFields((string) ($response->json('choices.0.message.content') ?? '{}'));
    }

    /**
     * The model is asked for a JSON object, but a malformed answer must not break the
     * request — the reference swallows the parse error and returns no fields, letting the
     * SPA show "لم يتم التعرف على بيانات واضحة" (VoiceInput.tsx).
     *
     * @return array<string,mixed>|stdClass
     */
    private function decodeFields(string $content): array|stdClass
    {
        $fields = json_decode($content, true);

        return is_array($fields) && $fields !== [] ? $fields : $this->emptyFields();
    }

    /** `[]` would encode as a JSON array; the contract is an object. */
    public function emptyFields(): stdClass
    {
        return new stdClass;
    }
}
