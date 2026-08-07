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
            $table->text('title')->default('');
            $table->text('customer_name')->default('');
            $table->text('quote_number')->default('');
            $table->text('source_type')->default('calculator');
            $table->jsonb('quote_data')->default('{}');
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
