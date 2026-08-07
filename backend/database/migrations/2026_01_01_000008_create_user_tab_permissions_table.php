<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Per-user feature flags. tab_key is opaque (incl. the special "default_tab:<key>").
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_tab_permissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->text('tab_key');
            $table->boolean('is_enabled')->default(true);
            $table->timestampTz('created_at')->useCurrent();

            $table->foreign('user_id')->references('id')->on('app_users')->cascadeOnDelete();
            $table->unique(['user_id', 'tab_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_tab_permissions');
    }
};
