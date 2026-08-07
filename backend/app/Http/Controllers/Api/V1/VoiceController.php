<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Voice\ParseVoiceRequest;
use App\Services\VoiceService;
use Illuminate\Http\JsonResponse;

/**
 * Arabic voice → calculator fields. Ports parse-voice-input. [BE-051]
 *
 * Note this route sits behind `session.active`, where the reference was a **separate,
 * entirely unauthenticated** edge function invoked with the public anon key — anyone who
 * read it out of the JS bundle could spend the project's AI credits. Requiring a session
 * is a deliberate hardening; the SPA already holds a token wherever it offers voice input.
 */
class VoiceController extends Controller
{
    public function __construct(private readonly VoiceService $voice) {}

    // POST /voice/parse
    public function parse(ParseVoiceRequest $request): JsonResponse
    {
        $transcript = $request->transcript();

        // First branch in the reference (index.ts:16-20), and note the shape: an empty
        // transcript returns `fields` ALONE, with no `transcript` key echoed back.
        if ($transcript === '') {
            return response()->json(['fields' => $this->voice->emptyFields()]);
        }

        $fields = $this->voice->parse($transcript, $request->calcType(), $request->paperTypeNames());

        return response()->json(['fields' => $fields, 'transcript' => $transcript]);
    }
}
