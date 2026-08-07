<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\NotImplemented;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Voice → form-fields parser. Ports the parse-voice-input edge function. [BE-051] */
class VoiceController extends Controller
{
    use NotImplemented;

    public function parse(Request $request): JsonResponse
    {
        return $this->todo('BE-051'); // POST /voice/parse { transcript, calcType, paperTypeNames? }
    }
}
