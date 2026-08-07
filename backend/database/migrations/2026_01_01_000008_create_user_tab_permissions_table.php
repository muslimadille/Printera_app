<?php

use App\Support\SchemaCollation;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Per-user feature flags. tab_key is opaque (incl. the special "default_tab:<key>").
return new class extends Migration
{
    public function up(): void
    {
        $collation = SchemaCollation::identity();

        Schema::create('user_tab_permissions', function (Blueprint $table) use ($collation) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');

            // Part of the composite unique below → must be VARCHAR on MySQL. 191 is
            // ample: the longest real key is "default_tab:carryinghandlebox". The
            // case-sensitive collation keeps this OPAQUE key from being folded — see
            // SchemaCollation.
            $tabKey = $table->string('tab_key', 191);
            if ($collation) {
                $tabKey->collation($collation);
            }

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
