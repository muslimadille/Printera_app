<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Audit of login/logout/heartbeat/auto_logout. No hard FK in the current schema.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('session_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->text('username');
            $table->text('session_token')->nullable();
            $table->text('device_id')->nullable();
            $table->text('device_info')->nullable();
            $table->text('ip_address')->nullable();
            $table->text('event_type'); // login | logout | heartbeat | auto_logout (CHECK below)
            $table->timestampTz('occurred_at')->useCurrent();

            $table->index('user_id', 'idx_session_events_user_id');
            $table->index(['user_id', 'occurred_at'], 'idx_session_events_user_time');
            $table->index('session_token', 'idx_session_events_session_token');
        });

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement(
                'ALTER TABLE session_events ADD CONSTRAINT session_events_event_type_check '.
                "CHECK (event_type IN ('login','logout','heartbeat','auto_logout'))"
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('session_events');
    }
};
