<?php

use App\Support\SchemaCollation;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// user_sessions = active device sessions AND the JWT allow-list. The token stored
// in `session_token` is the JWT `jti`; deleting a row revokes that token.
return new class extends Migration
{
    public function up(): void
    {
        $collation = SchemaCollation::identity();

        Schema::create('user_sessions', function (Blueprint $table) use ($collation) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');

            // VARCHAR because both are indexed — MySQL cannot index TEXT without a
            // prefix length. session_token holds a 64-char hex jti; device_id a uuid.
            // Both are opaque identifiers, so they get the case-sensitive collation:
            // this token is the JWT allow-list key that EnsureSessionActive matches on.
            $sessionToken = $table->string('session_token', 191)->unique();
            $deviceId = $table->string('device_id', 191)->nullable();

            if ($collation) {
                $sessionToken->collation($collation);
                $deviceId->collation($collation);
            }

            $table->text('device_info')->nullable();          // free text, never indexed
            $table->string('ip_address', 45)->nullable();      // fits IPv6 + ::ffff: prefix
            $table->timestampTz('last_active_at')->useCurrent();
            $table->timestampTz('created_at')->useCurrent();

            $table->foreign('user_id')->references('id')->on('app_users')->cascadeOnDelete();
            $table->index('last_active_at', 'user_sessions_last_active_idx');

            // One session per (user, device) — a PLAIN unique, portable to every engine.
            //
            // This was a PostgreSQL/SQLite partial index (`WHERE device_id IS NOT NULL`)
            // that MySQL cannot express, leaving MySQL with no constraint at all. It is
            // unnecessary: the SQL standard treats NULLs as distinct in a unique index,
            // so a plain unique already permits many NULL-device rows per user while
            // still rejecting a duplicate non-null (user_id, device_id). MySQL,
            // PostgreSQL and SQLite all agree on that, so one index covers all three
            // with the exact semantics BE-019 asserted. See BE-060.
            //
            // Key length: char(36) + varchar(191) under utf8mb4 = 908 bytes, well inside
            // InnoDB's 3072-byte limit on MySQL 8 (DYNAMIC row format).
            $table->unique(['user_id', 'device_id'], 'user_sessions_user_device_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_sessions');
    }
};
