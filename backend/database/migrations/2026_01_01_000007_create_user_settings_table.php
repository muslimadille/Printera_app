<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Cloud settings per user: paperTypes, priceSettings, finishingItems, profitMargins.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->text('setting_key');
            $table->jsonb('setting_value')->default('{}');
            $table->timestampsTz();

            $table->foreign('user_id')->references('id')->on('app_users')->cascadeOnDelete();
            $table->unique(['user_id', 'setting_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_settings');
    }
};
