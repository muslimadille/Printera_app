<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class LoginLog extends Model
{
    use HasUuids;

    protected $table = 'login_logs';

    public $timestamps = false; // logged_in_at only

    protected $fillable = ['user_id', 'username', 'logged_in_at', 'ip_address'];

    protected function casts(): array
    {
        return ['logged_in_at' => 'datetime'];
    }
}
