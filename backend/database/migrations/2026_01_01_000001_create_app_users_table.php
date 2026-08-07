<?php

use App\Support\SchemaCollation;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Mirrors supabase/migrations app_users (plus later ALTERs: max_devices,
// parent_user_id, max_employees, employees_can_view_quotes). See 02-DATABASE-SCHEMA.md.
return new class extends Migration
{
    public function up(): void
    {
        // Case-SENSITIVE on MySQL, null elsewhere — see SchemaCollation for why.
        $collation = SchemaCollation::identity();

        Schema::create('app_users', function (Blueprint $table) use ($collation) {
            // The primary key is declared EXPLICITLY rather than fluently
            // (`$table->uuid('id')->primary()`), because Blueprint::addFluentIndexes()
            // appends fluent indexes to the END of the command list — after the
            // self-referencing foreign key below. On Postgres that emits
            //   ALTER TABLE app_users ADD CONSTRAINT ... FOREIGN KEY (parent_user_id)
            //     REFERENCES app_users (id)
            // before the primary key exists, and fails with
            //   SQLSTATE[42830] there is no unique constraint matching given keys.
            // SQLite inlines foreign keys into CREATE TABLE, so it never noticed.
            // Only this table is affected — every other FK targets an already-created
            // app_users. See PHASE-0-1-AUDIT.md §6 (found by BE-019).
            $table->uuid('id');
            $table->primary('id');

            // VARCHAR, not TEXT: MySQL cannot index a TEXT column without a prefix
            // length ("1170 BLOB/TEXT column used in key specification without a key
            // length"). 191 is the conventional utf8mb4 index-safe width. See BE-060.
            $username = $table->string('username', 191)->unique();
            if ($collation) {
                $username->collation($collation);   // case-SENSITIVE — see identityCollation()
            }

            $table->string('password_hash', 255);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_admin')->default(false);

            // dateTime, not timestampTz: on MySQL a TIMESTAMP column tops out at
            // 2038-01-19, and this one holds a *subscription end date* that can
            // legitimately be years out. A 20-year subscription sold today would fall
            // outside the range. DATETIME has no such ceiling. Stored UTC like
            // everything else. See BE-060 and 02-DATABASE-SCHEMA.md §7.
            $table->dateTime('expires_at')->nullable();

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
