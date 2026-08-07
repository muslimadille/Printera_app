# Phase 7 — Data & storage migration runbook (OPS-070..073)

> **Status: tooling built, rehearsed end-to-end, and ready. The PRODUCTION RUN HAS NOT
> HAPPENED** — it needs credentials and a maintenance window that only the product owner
> can provide (see §1). Everything below is the exact sequence to execute once they are.

---

## 1. Blocked on the owner

The ticket lists these as prerequisites and they are genuinely unavailable to the executor:

| Needed | Used by | Where it goes |
|---|---|---|
| Supabase Postgres **direct** connection string | OPS-070 | `SUPABASE_DB_*` in `backend/.env` |
| Supabase **service-role key** + project URL | OPS-071 | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Maintenance window | OPS-073 | — |
| Full Supabase DB + storage **backup taken first** | all | — |

Use the **direct** connection, not the transaction pooler: the copy runs long
transactions. The service-role key bypasses bucket policies, which is what lets the copy
read every tenant's objects — treat it as a secret and rotate it after sign-off.

---

## 2. What was rehearsed, and how

Everything except the production run was verified against **two real PostgreSQL 16
databases** — a source seeded to look like production (admin + owner + two employees, a
legacy SHA-256 password, quotes carrying *both* attachment shapes, settings, tab
permissions, events, and live `user_sessions`) and a real target.

Observed in that rehearsal:

- Row counts matched per table; a second run produced identical counts (idempotent).
- `parent_user_id` resolved for both employees, whose ids sorted **before** their owner's —
  the case a single-pass copy gets wrong.
- `user_sessions`: 2 in the source, **0** copied.
- The legacy hash arrived byte-identical (`length = 64`, equal to `sha256('legacy-pw')`).
- **Both password formats logged in through the live API**, and the SHA-256 row was
  upgraded to bcrypt by that login rather than by the migration.
- Opaque JSON survived: `quote_data->>'arabic'` still `ورق`, `default_tab:diecut5` intact.
- The owner saw its own two quotes **and** its employee's quote tagged
  `employee_username = sb_emp_a` — the family matrix working off migrated data.
- A quote whose attachment was a **legacy Supabase URL** was rewritten to a key and then
  opened end-to-end: `/files/download-url` → signed URL → correct bytes.
- `app:report-migration` **failed** when the database had been migrated but the storage had
  not, and passed once the objects were in place.

Automated coverage: **52 tests** across `MigrateFromSupabaseTest`,
`MigrateSupabaseStorageTest`, `QuoteAttachmentMigrationTest`, `ReportMigrationTest`.

---

## 3. OPS-072 — what the attachment fields actually hold

**Investigated before writing any rewrite**, as the ticket demands. Findings from the
client code:

- `quote_data.attachmentUrl` (+ `attachmentName`) is the **only** attachment reference
  persisted server-side. `quoteInfo.montageUrl` looks like a second one but lives in the
  Zustand draft in `localStorage` and never reaches `quote_data`.
- Two shapes have been written over the app's life:
  - `storage:{key}` — current (`PriceQuote.tsx`). The key is exactly what OPS-071
    preserves, so these need **no rewrite**.
  - a full `https://…supabase.co/storage/v1/object/{public|sign}/montage-files/{key}` URL —
    from when the bucket was public (`supabase/migrations/20260405141129_*.sql` created it
    with `public = true`). `MontageUpload.tsx` still carries a *"Legacy public URL"* branch,
    which is the evidence these exist. They **break the moment Supabase is switched off.**

So the answer is *both*, and the rewrite is required — but only for the second shape.
Run the inspector first; it reports a census and changes nothing.

> ⚠ **Only production data can say how many of each shape exist.** The census above is
> derived from the code, not from the live table. Run
> `php artisan app:inspect-quote-attachments` before deciding, and treat any
> `unrecognised` count as a stop-and-look.

### A frontend bug this uncovered — fixed

`PriceQuote.handleDownloadFile` did `fetch(url)` **directly on the stored value**. Since
`uploadFile` writes `storage:{key}`, that fetch could never resolve — downloading an
attachment from a saved quote was already broken, independent of the migration, and would
have made the OPS-072 acceptance criterion ("3 pre-existing quotes with attachments open
correctly") unreachable. It now mints a signed URL for `storage:` values, exactly as
`MontageUpload` always did, and still fetches a plain URL directly so nothing regresses
before the rewrite runs.

---

## 4. The production sequence

```bash
# ── 0. BACKUP FIRST. Supabase DB dump + storage bucket copy. Non-negotiable. ──

cd backend

# ── 1. Rehearse against staging ───────────────────────────────────────────────
php artisan app:migrate-from-supabase --dry-run       # counts only, writes nothing

# ── 2. Maintenance window opens ───────────────────────────────────────────────
php artisan down                                       # optional but recommended

# ── 3. Data (OPS-070). Safe to re-run; resumes after any failure. ─────────────
php artisan app:migrate-from-supabase
#   --table=saved_quotes     limit to one table
#   --since-days=30          trim ONLY session_events/activity_events if volume is large
#   --chunk=500              tune batch size

# ── 4. Storage (OPS-071). Keys are preserved — that is what keeps quotes valid. ─
php artisan app:migrate-supabase-storage --verify
#   re-run to retry failures; already-copied objects are skipped

# ── 5. Attachments (OPS-072). Report first, then rewrite if legacy URLs exist. ─
php artisan app:inspect-quote-attachments
php artisan app:inspect-quote-attachments --rewrite --backup=storage/app/attachments-before.json

# ── 6. Parity (OPS-073). Exits non-zero if anything is short. ─────────────────
php artisan app:report-migration --out=docs/backend-laravel/tickets/phase-7-report.txt

php artisan up
```

Then, by hand — the report prints this list too:

1. Log in as **3–5 users across roles** (admin / owner / employee): identical settings, own
   + related quotes, and an attachment opens.
2. Flip the production frontend to `VITE_API_BASE_URL` and run the **FE-064** checklist.
3. Archive the report next to this file.

---

## 5. Expected at cutover — not regressions

- **Every existing session dies.** `user_sessions` is deliberately not migrated: those are
  opaque Supabase tokens, not JWTs. Users re-login once; the SPA turns the 401 into a clean
  forced logout with *"انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى"*.
- **`app_users` will read one row higher than the source** if the target was seeded — the
  bootstrap admin never existed in Supabase. The report labels this `+N local` and passes.
- **jsonb may reorder object keys.** Not a content change; nothing reads them positionally.
- **Legacy SHA-256 passwords stay SHA-256 until each user next logs in**, then upgrade to
  bcrypt. That is the designed path, not a migration failure.

---

## 6. Rollback

Nothing is destructive to Supabase — every command reads from it. To roll back:

1. Point the frontend's `VITE_API_BASE_URL` back at Supabase (`@supabase/supabase-js` and
   `src/integrations/supabase/` are still installed until Phase 8).
2. If OPS-072 ran, restore `quote_data` from the `--backup` JSON it required.
3. Keep Supabase **live, read-only if possible**, until the Phase 8 safety window elapses.

---

## 7. Commands added

| Command | Ticket | Notes |
|---|---|---|
| `app:migrate-from-supabase` | OPS-070 | 7 tables, FK-safe order, upsert, `--dry-run` / `--table` / `--since-days` / `--chunk` |
| `app:migrate-supabase-storage` | OPS-071 | keys preserved, resumable, `--verify` / `--prefix` / `--overwrite` |
| `app:inspect-quote-attachments` | OPS-072 | census by default; `--rewrite` **requires** `--backup` |
| `app:report-migration` | OPS-073 | counts, FK orphans, hash formats, attachment reachability; non-zero on any gap |
