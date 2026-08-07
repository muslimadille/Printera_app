<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// In-app actions (tab_open, calculate, save_quote, export_*, ...). details = jsonb.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->text('username');
            $table->text('session_token')->nullable();
            $table->text('tab_key')->nullable();
            $table->text('action');
            $table->jsonb('details')->default('{}');
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
