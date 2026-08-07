<?php

namespace App\Support;

use Illuminate\Support\Facades\Schema;

/**
 * Collation for opaque-identity columns — usernames, session tokens, and the key halves of
 * the composite uniques (`setting_key`, `tab_key`).
 *
 * MySQL's default for this schema is utf8mb4_unicode_ci, which is case-INsensitive. That is
 * right for free text — Arabic titles and customer names, where a human searching expects
 * case and accent folding — but wrong for identity, in two ways:
 *
 *  - `username`: 'Admin' and 'admin' would become the same account, and someone could log
 *    in as 'ADMIN'. Case-SENSITIVE usernames are a locked product decision matching
 *    Supabase, where PostgreSQL gave that behaviour for free.
 *  - `setting_key` / `tab_key`: these are documented as OPAQUE, so the backend must not
 *    fold them. Under ci, ('user','itemcost') and ('user','ItemCost') collide in the
 *    unique index on MySQL while remaining two distinct rows on PostgreSQL and SQLite —
 *    the same request producing different results per engine.
 *
 * Returns null on PostgreSQL and SQLite: both already compare these case-sensitively, and
 * handing them a MySQL collation name would fail. See BE-060 and 02-DATABASE-SCHEMA.md §7.
 *
 * To make usernames case-insensitive later, return 'utf8mb4_0900_ai_ci' here — but note
 * that would also fold the opaque keys, so split the two uses first.
 */
final class SchemaCollation
{
    public const MYSQL_CASE_SENSITIVE = 'utf8mb4_0900_as_cs';

    public static function identity(): ?string
    {
        return Schema::getConnection()->getDriverName() === 'mysql'
            ? self::MYSQL_CASE_SENSITIVE
            : null;
    }
}
