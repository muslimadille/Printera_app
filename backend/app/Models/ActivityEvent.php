<?php

namespace App\Models;

use App\Casts\JsonObject;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ActivityEvent extends Model
{
    use HasUuids;

    protected $table = 'activity_events';

    public $timestamps = false; // occurred_at only

    protected $fillable = [
        'user_id', 'username', 'session_token', 'tab_key', 'action', 'details', 'occurred_at',
    ];

    /**
     * Was `DEFAULT '{}'` on the column; MySQL forbids that on JSON (BE-060). Rows written
     * by ActivityService's bulk query-builder insert bypass this, but that path always
     * supplies an encoded `details` of its own.
     *
     * @var array<string,mixed>
     */
    protected $attributes = ['details' => '{}'];

    protected function casts(): array
    {
        return [
            'details' => JsonObject::class,
            'occurred_at' => 'datetime',
        ];
    }
}
