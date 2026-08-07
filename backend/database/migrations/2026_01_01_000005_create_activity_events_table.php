<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// In-app actions (tab_open, calculate, save_quote, export_*, ...). details = json.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('username', 191);
            $table->string('session_token', 191)->nullable();  // indexed → VARCHAR
            $table->string('tab_key', 191)->nullable();        // indexed → VARCHAR
            $table->string('action', 64);                      // 12 known values, longest 18 chars

            // No DB-level default: MySQL rejects a literal DEFAULT on a JSON column
            // ("BLOB, TEXT, GEOMETRY or JSON column can't have a default value"). The
            // default lives on the model instead — ActivityEvent::$attributes — and the
            // column is nullable so a raw query-builder insert that omits it stores NULL
            // rather than failing. The JsonObject cast reads NULL back as []. See BE-060.
            $table->jsonb('details')->nullable();

            $table->timestampTz('occurred_at')->useCurrent();

            $table->index(['user_id', 'occurred_at'], 'idx_activity_events_user_time');
            $table->index('tab_key', 'idx_activity_events_tab');
            $table->index('session_token', 'idx_activity_events_session');
            $table->index('occurred_at', 'idx_activity_events_time');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_events');
    }
};
