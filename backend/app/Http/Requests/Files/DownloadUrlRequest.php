<?php

namespace App\Http\Requests\Files;

use App\Exceptions\ApiException;
use App\Support\Messages;
use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /files/download-url and POST /files/delete — the same one-field body. The
 * reference's check is `if (!file_path)` → 400 "مسار الملف مطلوب" (index.ts:857, 873),
 * reproduced by hand so the Arabic string survives rather than being replaced by the
 * generic INCOMPLETE_DATA body.
 */
class DownloadUrlRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string,mixed> */
    public function rules(): array
    {
        return [
            'file_path' => ['sometimes', 'nullable', 'string'],
        ];
    }

    public function filePath(): string
    {
        $path = $this->input('file_path');

        if (! is_string($path) || $path === '') {
            throw ApiException::badRequest(Messages::FILE_PATH_REQUIRED);
        }

        return $path;
    }
}
