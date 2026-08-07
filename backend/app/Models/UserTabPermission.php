<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserTabPermission extends Model
{
    use HasUuids;

    protected $table = 'user_tab_permissions';

    public $timestamps = false; // created_at only

    protected $fillable = ['user_id', 'tab_key', 'is_enabled', 'created_at'];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(AppUser::class, 'user_id');
    }
}
