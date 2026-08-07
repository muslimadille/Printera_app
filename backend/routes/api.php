<?php

use App\Http\Controllers\Api\V1\ActivityController;
use App\Http\Controllers\Api\V1\Admin\AnalyticsController;
use App\Http\Controllers\Api\V1\Admin\LoginLogController;
use App\Http\Controllers\Api\V1\Admin\UserAdminController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\EmployeeController;
use App\Http\Controllers\Api\V1\FileController;
use App\Http\Controllers\Api\V1\QuoteController;
use App\Http\Controllers\Api\V1\SessionAdminController;
use App\Http\Controllers\Api\V1\SettingController;
use App\Http\Controllers\Api\V1\TabPermissionController;
use App\Http\Controllers\Api\V1\VoiceController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API v1
|--------------------------------------------------------------------------
| Mounted under /api (apiPrefix) → effective base path is /api/v1.
| See docs/backend-laravel/03-API-SPECIFICATION.md for the full contract.
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {

    // ---- Public ----
    Route::get('/health', fn () => response()->json(['ok' => true]));

    // ---- Auth (public entry points) ----  [Phase 1: BE-011..015]
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/auth/force-login', [AuthController::class, 'forceLogin']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);

    // ---- File transfer (local disk only)  [Phase 5: BE-050] ----
    // Public by necessity, authorized by the URL signature alone. The browser PUTs the
    // file to `upload_url` and opens `signed_url` with no headers of any kind (see
    // MontageUpload.tsx), exactly as it did against Supabase's presigned bucket URLs — so
    // the credential has to travel in the URL. `signed` covers the `path` query parameter,
    // which is what stops a caller swapping in another tenant's key.
    // On an S3 montage disk these are never called: StorageService hands out genuine
    // presigned URLs and the browser talks to the bucket directly.
    Route::put('/files/upload', [FileController::class, 'upload'])
        ->middleware('signed')->name('files.upload');
    Route::get('/files/download', [FileController::class, 'download'])
        ->middleware('signed')->name('files.download');

    // ---- Activity logging  [Phase 2: BE-025] ----
    // DELIBERATELY OUTSIDE the session.active group. The client flushes this queue via
    // navigator.sendBeacon on page hide, where a 401 loses the batch with no retry and no
    // way to surface the failure. The controller resolves the token softly instead and
    // always answers 200 — an invalid session returns { session_expired: true } in the
    // body. This mirrors the reference, which is 200-always for this action.
    // See 03-API-SPECIFICATION.md §7.
    Route::post('/activity/batch', [ActivityController::class, 'batch']);

    // ---- Authenticated (JWT + revocable session allow-list) ----
    // session.active performs BOTH JWT validation and the jti allow-list check so
    // that every auth failure returns the { session_expired: true } shape the SPA
    // expects (instead of Laravel's default "Unauthenticated." body).
    Route::middleware('session.active')->group(function () {

        // Auth/session lifecycle  [BE-013, BE-014]
        // /auth/me is the SOLE heartbeat path — it is the port of verify_session and the
        // only place session_events(heartbeat) is written. A separate /auth/heartbeat
        // endpoint was removed: because session.active refreshes last_active_at on every
        // request, polling it kept the timestamp permanently fresh and the 5-minute
        // throttle in me() could never fire, silently killing the heartbeat audit trail
        // that admin analytics derives session duration from. See PHASE-0-1-AUDIT.md F5.
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);

        // Cloud settings (self only)  [Phase 2: BE-020]
        Route::get('/settings', [SettingController::class, 'index']);
        Route::put('/settings', [SettingController::class, 'update']);

        // Saved quotes (family-scoped)  [Phase 2: BE-021..024]
        Route::get('/quotes', [QuoteController::class, 'index']);
        Route::post('/quotes', [QuoteController::class, 'store']);
        Route::patch('/quotes/{id}', [QuoteController::class, 'update']);
        Route::delete('/quotes/{id}', [QuoteController::class, 'destroy']);
        Route::post('/quotes/transfer', [QuoteController::class, 'transfer']);

        // Employees (account owner)  [Phase 3: BE-030..036]
        Route::get('/employees', [EmployeeController::class, 'index']);
        Route::post('/employees', [EmployeeController::class, 'store']);
        Route::patch('/employees/{id}', [EmployeeController::class, 'update']);
        Route::delete('/employees/{id}', [EmployeeController::class, 'destroy']);
        Route::get('/employees/{id}/quotes-count', [EmployeeController::class, 'quotesCount']);
        Route::get('/employees/{id}/tab-permissions', [EmployeeController::class, 'getTabPermissions']);
        Route::put('/employees/{id}/tab-permissions', [EmployeeController::class, 'updateTabPermissions']);
        Route::post('/account/employees-view-quotes', [EmployeeController::class, 'toggleViewQuotes']);

        // Files (storage)  [Phase 5: BE-050]
        Route::post('/files/upload-url', [FileController::class, 'uploadUrl']);
        Route::post('/files/download-url', [FileController::class, 'downloadUrl']);
        Route::post('/files/delete', [FileController::class, 'destroy']);

        // Voice parse  [Phase 5: BE-051]
        Route::post('/voice/parse', [VoiceController::class, 'parse']);

        // ---- Admin only ----  [Phase 4: BE-040..046]
        Route::middleware('role.admin')->prefix('admin')->group(function () {
            Route::get('/users', [UserAdminController::class, 'index']);
            Route::post('/users', [UserAdminController::class, 'store']);
            Route::patch('/users/{id}', [UserAdminController::class, 'update']);
            Route::delete('/users/{id}', [UserAdminController::class, 'destroy']);

            Route::get('/users/{id}/tab-permissions', [TabPermissionController::class, 'show']);
            Route::put('/users/{id}/tab-permissions', [TabPermissionController::class, 'update']);

            Route::get('/users/{id}/sessions', [SessionAdminController::class, 'index']);
            Route::delete('/sessions/{sessionId}', [SessionAdminController::class, 'destroy']);

            Route::get('/login-logs', [LoginLogController::class, 'index']);
            Route::get('/analytics', [AnalyticsController::class, 'index']);
        });
    });
});
