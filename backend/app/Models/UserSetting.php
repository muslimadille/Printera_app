<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserSetting extends Model
{
    use HasUuids;

    protected $table = 'user_settings';

    protected $fillable = ['user_id', 'setting_key', 'setting_value'];

    protected function casts(): array
    {
        return ['setting_value' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(AppUser::class, 'user_id');
    }
}
