<?php

namespace App\Http\Requests\Voice;

use App\Services\VoiceService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /voice/parse. Lenient on purpose: the reference validates nothing and its first
 * branch is `if (!transcript)`, which must stay first — so nothing here may reject a
 * request before that check runs.
 */
class ParseVoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'transcript' => ['sometimes', 'nullable', 'string'],
            'calcType' => ['sometimes', 'nullable', 'string'],
            'paperTypeNames' => ['sometimes', 'nullable', 'array'],
        ];
    }

    /** Empty means "nothing was said" — the short-circuit branch. */
    public function transcript(): string
    {
        $transcript = $this->input('transcript');

        return is_string($transcript) ? $transcript : '';
    }

    /**
     * An absent calcType falls back to the employee catalogue, which is where the
     * reference's `fieldDescriptions[calcType] || fieldDescriptions.employee` lands too.
     * It differs only in the prompt's own wording: the reference interpolates the literal
     * string "undefined" into the Arabic sentence naming the calculator. Not reproduced —
     * that is a defect in the prompt, not behavior. The SPA always sends a real value.
     */
    public function calcType(): string
    {
        $calcType = $this->input('calcType');

        return is_string($calcType) && $calcType !== '' ? $calcType : VoiceService::DEFAULT_CALC_TYPE;
    }

    /** @return array<int,string> */
    public function paperTypeNames(): array
    {
        $names = $this->input('paperTypeNames');

        if (! is_array($names)) {
            return [];
        }

        // `[…].join(', ')` renders every element, so keep the scalars and drop the rest
        // rather than letting an array element become the word "Array".
        return array_values(array_map(
            fn (mixed $name): string => (string) $name,
            array_filter($names, fn (mixed $name): bool => is_scalar($name)),
        ));
    }
}
