<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Files\DownloadUrlRequest;
use App\Http\Requests\Files\UploadUrlRequest;
use App\Services\StorageService;
use App\Support\Messages;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Storage (montage disk) signed URLs. Ports get_upload_url/get_file_url/delete_file. [BE-050] */
class FileController extends Controller
{
    public function __construct(private readonly StorageService $storage) {}

    // POST /files/upload-url { file_name }
    public function uploadUrl(UploadUrlRequest $request): JsonResponse
    {
        return response()->json(
            $this->storage->uploadUrl($this->currentUser($request), $request->fileName())
        );
    }

    // POST /files/download-url { file_path }
    public function downloadUrl(DownloadUrlRequest $request): JsonResponse
    {
        return response()->json([
            'signed_url' => $this->storage->downloadUrl($this->currentUser($request), $request->filePath()),
        ]);
    }

    // POST /files/delete { file_path }
    public function destroy(DownloadUrlRequest $request): JsonResponse
    {
        $this->storage->delete($this->currentUser($request), $request->filePath());

        return response()->json(['success' => true]);
    }

    /**
     * PUT /files/upload?path=…&expires=…&signature=…   (local disk only)
     *
     * The browser PUTs the raw file here with no credentials — `signed` middleware is the
     * whole authorization, and because the signature covers `path`, the key cannot be
     * swapped for someone else's. On S3 this route is never reached: the client PUTs the
     * presigned URL directly.
     */
    public function upload(Request $request): JsonResponse
    {
        $path = $this->signedPath($request);

        $this->storage->put($path, $request->getContent());

        return response()->json(['path' => $path]);
    }

    /**
     * GET /files/download?path=…&expires=…&signature=…   (local disk only)
     *
     * Streamed rather than read into memory: montage artwork runs to megabytes.
     */
    public function download(Request $request): StreamedResponse
    {
        $path = $this->signedPath($request);

        if (! $this->storage->exists($path)) {
            abort(404);
        }

        return $this->storage->download($path);
    }

    /**
     * The signature already proves the path was issued by us, so this only guards against
     * a signed URL with the parameter removed entirely.
     */
    private function signedPath(Request $request): string
    {
        $path = $request->query('path');

        if (! is_string($path) || $path === '') {
            throw ApiException::badRequest(Messages::FILE_PATH_REQUIRED);
        }

        return $path;
    }
}
