<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\NotImplemented;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Batched activity logging (accepts sendBeacon). Ports log_activity_batch. [BE-025] */
class ActivityController extends Controller
{
    use NotImplemented;

    public function batch(Request $request): JsonResponse
    {
        return $this->todo('BE-025'); // POST /activity/batch { events:[...] }
    }
}
