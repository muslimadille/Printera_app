<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\NotImplemented;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Storage (montage disk) signed URLs. Ports get_upload_url/get_file_url/delete_file. [BE-050] */
class FileController extends Controller
{
    use NotImplemented;

    public function uploadUrl(Request $request): JsonResponse
    {
        return $this->todo('BE-050'); // POST /files/upload-url { file_name }
    }

    public function downloadUrl(Request $request): JsonResponse
    {
        return $this->todo('BE-050'); // POST /files/download-url { file_path }
    }

    public function destroy(Request $request): JsonResponse
    {
        return $this->todo('BE-050'); // POST /files/delete { file_path }
    }
}
