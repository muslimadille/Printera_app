<?php

namespace App\Models;

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

    protected function casts(): array
    {
        return [
            'details' => 'array',
            'occurred_at' => 'datetime',
        ];
    }
}
