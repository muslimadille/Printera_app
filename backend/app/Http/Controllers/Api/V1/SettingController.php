<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\UpdateSettingsRequest;
use App\Services\SettingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Cloud settings (self only). Ports load_settings / save_settings. [BE-020] */
class SettingController extends Controller
{
    public function __construct(private readonly SettingService $settings) {}

    // GET /settings → { settings: { key: value, … } }
    public function index(Request $request): JsonResponse
    {
        $user = $this->currentUser($request);

        $requested = $request->query('user_id');
        $this->settings->assertSelf(is_string($requested) && $requested !== '' ? $requested : null, $user);

        return response()->json(['settings' => $this->settings->all($user)]);
    }

    // PUT /settings { settings: [{ key, value }] }
    public function update(UpdateSettingsRequest $request): JsonResponse
    {
        $user = $this->currentUser($request);

        $this->settings->assertSelf($request->requestedUserId(), $user);
        $this->settings->upsertMany($user, $request->settings());

        return response()->json(['success' => true]);
    }
}
