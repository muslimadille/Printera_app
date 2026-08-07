<?php

namespace App\Http\Requests\Files;

use App\Exceptions\ApiException;
use App\Support\Messages;
use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /files/upload-url. The reference's own check is `if (!file_name)` → 400
 * "اسم الملف مطلوب" (index.ts:838), so that branch is reproduced by hand rather than
 * delegated to `required`, which would answer with the generic INCOMPLETE_DATA body and
 * lose a message the SPA already renders.
 */
class UploadUrlRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'file_name' => ['sometimes', 'nullable', 'string'],
        ];
    }

    public function fileName(): string
    {
        $name = $this->input('file_name');

        if (! is_string($name) || $name === '') {
            throw ApiException::badRequest(Messages::FILE_NAME_REQUIRED);
        }

        return $name;
    }
}
