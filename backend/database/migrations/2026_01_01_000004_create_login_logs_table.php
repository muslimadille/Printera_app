<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('login_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->text('username');
            $table->timestampTz('logged_in_at')->useCurrent();
            $table->text('ip_address')->nullable();

            $table->foreign('user_id')->references('id')->on('app_users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('login_logs');
    }
};
