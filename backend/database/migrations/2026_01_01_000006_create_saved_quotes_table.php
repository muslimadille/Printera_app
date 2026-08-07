<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('saved_quotes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');

            // VARCHAR rather than TEXT: none of these are indexed today, but they are
            // short, user-visible fields and VARCHAR keeps them sortable and indexable
            // without a schema change. Arabic content is fine — utf8mb4, 255 CHARACTERS.
            $table->string('title', 255)->default('');
            $table->string('customer_name', 255)->default('');
            $table->string('quote_number', 255)->default('');
            $table->string('source_type', 255)->default('calculator');

            // No DB-level default — see the note in the activity_events migration.
            // SavedQuote::$attributes supplies {} and the JsonObject cast reads NULL as [].
            $table->jsonb('quote_data')->nullable();

            $table->timestampsTz();

            $table->foreign('user_id')->references('id')->on('app_users')->cascadeOnDelete();
            $table->index('user_id', 'idx_saved_quotes_user_id');
            $table->index('created_at', 'idx_saved_quotes_created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('saved_quotes');
    }
};
