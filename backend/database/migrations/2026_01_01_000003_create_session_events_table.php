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
            $table->string('username', 191);                        // denormalised copy
            $table->string('session_token', 191)->nullable();       // indexed → VARCHAR
            $table->string('device_id', 191)->nullable();
            $table->text('device_info')->nullable();                // free text
            $table->string('ip_address', 45)->nullable();
            $table->string('event_type', 32);                       // CHECK added below
            $table->timestampTz('occurred_at')->useCurrent();

            $table->index('user_id', 'idx_session_events_user_id');
            $table->index(['user_id', 'occurred_at'], 'idx_session_events_user_time');
            $table->index('session_token', 'idx_session_events_session_token');
        });

        // Enforced on PostgreSQL and on MySQL 8.0.16+, which is the first release where
        // CHECK is honoured rather than parsed and ignored. SQLite is skipped only
        // because Laravel cannot ALTER a table to add one; the application writes these
        // four values and nothing else (SessionService::logEvent).
        if (in_array(Schema::getConnection()->getDriverName(), ['pgsql', 'mysql'], true)) {
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
