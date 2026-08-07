<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Mirrors supabase/migrations app_users (plus later ALTERs: max_devices,
// parent_user_id, max_employees, employees_can_view_quotes). See 02-DATABASE-SCHEMA.md.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app_users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->text('username')->unique();
            $table->text('password_hash');
            $table->boolean('is_active')->default(true);
            $table->boolean('is_admin')->default(false);
            $table->timestampTz('expires_at')->nullable();
            $table->integer('max_devices')->default(2);
            $table->integer('max_employees')->default(0);
            $table->uuid('parent_user_id')->nullable();
            $table->boolean('employees_can_view_quotes')->default(false);
            $table->timestampsTz();

            $table->foreign('parent_user_id')
                ->references('id')->on('app_users')
                ->cascadeOnDelete();

            $table->index('parent_user_id', 'idx_app_users_parent');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('app_users');
    }
};
