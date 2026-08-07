<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\NotImplemented;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Cloud settings (self only). Ports load_settings / save_settings. [BE-020] */
class SettingController extends Controller
{
    use NotImplemented;

    public function index(Request $request): JsonResponse
    {
        return $this->todo('BE-020'); // GET /settings → { settings: {key:value} }
    }

    public function update(Request $request): JsonResponse
    {
        return $this->todo('BE-020'); // PUT /settings { settings:[{key,value}] }
    }
}
