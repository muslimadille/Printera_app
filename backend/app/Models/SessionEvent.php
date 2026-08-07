<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $event_type login|logout|heartbeat|auto_logout
 */
class SessionEvent extends Model
{
    use HasUuids;

    protected $table = 'session_events';

    public $timestamps = false; // occurred_at only

    protected $fillable = [
        'user_id', 'username', 'session_token', 'device_id', 'device_info',
        'ip_address', 'event_type', 'occurred_at',
    ];

    protected function casts(): array
    {
        return ['occurred_at' => 'datetime'];
    }
}
