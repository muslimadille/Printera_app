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
            $table->string('username', 191);              // denormalised copy of app_users.username
            $table->timestampTz('logged_in_at')->useCurrent();
            $table->string('ip_address', 45)->nullable(); // fits IPv6 + ::ffff: prefix

            $table->foreign('user_id')->references('id')->on('app_users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('login_logs');
    }
};
