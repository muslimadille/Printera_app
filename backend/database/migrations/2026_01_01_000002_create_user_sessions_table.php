<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// user_sessions = active device sessions AND the JWT allow-list. The token stored
// in `session_token` is the JWT `jti`; deleting a row revokes that token.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->text('session_token')->unique();
            $table->text('device_id')->nullable();
            $table->text('device_info')->nullable();
            $table->text('ip_address')->nullable();
            $table->timestampTz('last_active_at')->useCurrent();
            $table->timestampTz('created_at')->useCurrent();

            $table->foreign('user_id')->references('id')->on('app_users')->cascadeOnDelete();
            $table->index('last_active_at', 'user_sessions_last_active_idx');
        });

        // Partial unique: one session per (user, device). NULL device_id is exempt.
        // Supported on PostgreSQL and SQLite; MySQL has no partial index (see note).
        $driver = Schema::getConnection()->getDriverName();
        if (in_array($driver, ['pgsql', 'sqlite'], true)) {
            DB::statement(
                'CREATE UNIQUE INDEX user_sessions_user_device_unique '.
                'ON user_sessions (user_id, device_id) WHERE device_id IS NOT NULL'
            );
        }
        // NOTE (MySQL): emulate with a generated column or app-level guard if deployed on MySQL.
    }

    public function down(): void
    {
        Schema::dropIfExists('user_sessions');
    }
};
