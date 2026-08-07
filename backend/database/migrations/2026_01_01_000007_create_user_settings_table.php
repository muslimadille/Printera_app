<?php

use App\Support\SchemaCollation;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Cloud settings per user: paperTypes, priceSettings, finishingItems, profitMargins.
return new class extends Migration
{
    public function up(): void
    {
        $collation = SchemaCollation::identity();

        Schema::create('user_settings', function (Blueprint $table) use ($collation) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');

            // Part of the composite unique below → must be VARCHAR on MySQL, and
            // case-sensitive so 'paperTypes' and 'papertypes' stay two keys as they do on
            // PostgreSQL. See SchemaCollation.
            $settingKey = $table->string('setting_key', 191);
            if ($collation) {
                $settingKey->collation($collation);
            }

            // No DB-level default — see the note in the activity_events migration.
            $table->jsonb('setting_value')->nullable();

            $table->timestampsTz();

            $table->foreign('user_id')->references('id')->on('app_users')->cascadeOnDelete();

            // char(36) + varchar(191) utf8mb4 = 908 bytes, inside InnoDB's 3072 limit.
            $table->unique(['user_id', 'setting_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_settings');
    }
};
