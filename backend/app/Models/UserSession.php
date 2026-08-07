<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A live device session AND the JWT allow-list entry. `session_token` holds the
 * JWT `jti`; deleting the row revokes that token.
 *
 * @property string $id
 * @property string $user_id
 * @property string $session_token
 * @property string|null $device_id
 * @property string|null $device_info
 * @property string|null $ip_address
 * @property Carbon $last_active_at
 * @property Carbon $created_at
 */
class UserSession extends Model
{
    use HasUuids;

    protected $table = 'user_sessions';

    public $timestamps = false; // only created_at + last_active_at (no updated_at)

    protected $fillable = [
        'user_id', 'session_token', 'device_id', 'device_info', 'ip_address',
        'last_active_at', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'last_active_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(AppUser::class, 'user_id');
    }
}
