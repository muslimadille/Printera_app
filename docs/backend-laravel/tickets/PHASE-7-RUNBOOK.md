# Phase 7 — Data & storage migration runbook (OPS-070..073)

> **Status: tooling built and proven offline against fixtures. The PRODUCTION RUN HAS NOT
> HAPPENED** — it needs credentials and a maintenance window that only the product owner
> can provide (see §1). Nothing in this repository has ever connected to live Supabase.
> §5 is the exact sequence to execute once it can.

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

> The key is avoidable. Export the bucket first (dashboard, or `supabase storage cp -r`)
> and run `app:migrate-supabase-storage --from-disk=<folder>`; the export doubles as the
> storage backup this runbook demands anyway. See §5 step 4.

---

## 2. This is a cross-engine copy, and that is the hard part

**Source: Supabase PostgreSQL. Target: MySQL 8** (BE-060 made MySQL the production
engine). They disagree about more than syntax, and `pg_dump` speaks neither pairing — which
is why the copy streams through `app:migrate-from-supabase` rather than a dump file.

The first time the command met a real PostgreSQL source it copied **zero rows**:

```
SQLSTATE[22007]: Invalid datetime format: 1292
Incorrect datetime value: '2026-04-05 09:00:00+00' for column 'created_at'
```

Postgres renders `timestamptz` with an offset and microseconds; MySQL's parser refuses
both in strict mode. Every one of the seven tables failed. It had not been caught earlier
because the rehearsal ran Postgres → Postgres, and because the test fixture had been built
from *this app's own migrations* — making source and target identical by construction, so
the copy had no gap to cross.

What the command now does about it, and what an operator needs to know:

| Difference | Handling |
|---|---|
| `timestamptz` → `timestamp` / `datetime` | Re-rendered in UTC. The **offset is read first**, so the instant is preserved whatever `TimeZone` the source session uses. |
| Sub-second precision | **Floored, not rounded.** Every timestamp column here is precision 0 on all three engines, so the fraction has nowhere to live; rounding could push an event into the next second or day. |
| `text` → `varchar(n)` | Supabase bounds nothing; BE-060 had to bound what MySQL indexes. A pre-flight scan **refuses to start** if any value would not fit. See §3. |
| `jsonb` → `json` | Crosses as an unparsed string, so the blob is never reshaped. Key order may change — not a content change, and nothing reads them positionally. |
| `boolean` → `tinyint(1)` | Native, no handling needed. |
| `uuid` → `char(36)` | Native. Ids are preserved verbatim, so every foreign key still resolves. |
| MySQL session time zone | Pinned to `+00:00` in `config/database.php`. Left to the server default, the same row would mean different instants on different hosts. |

`app_users.expires_at` is `DATETIME`, not `TIMESTAMP`, precisely so a long subscription can
outlive MySQL's 2038 ceiling — a 2087 expiry is in the fixtures and crosses intact.

### What was actually proven, and how

Against **a PostgreSQL fixture carrying the real Supabase schema** — `text`, `jsonb`,
`timestamptz`, `uuid`, Supabase's column order, transcribed from `supabase/migrations/*.sql`
into `backend/tests/Fixtures/supabase-source.sql` — copied into **a real MySQL 8**:

- ids preserved, so `parent_user_id` still resolves for an employee whose id sorts *before*
  its owner's (the case a single-pass copy gets wrong);
- `user_sessions` present in the source, **0** copied;
- a legacy 64-hex SHA-256 hash and a bcrypt hash both arrived byte-identical, **both logged
  in through the live API**, and the SHA-256 row was upgraded by that login, not by the copy;
- opaque JSON survived including Arabic; a `storage:{key}` attachment reference survived
  and then opened end to end;
- an owner saw its own quotes *and* its employee's, tagged `employee_username` — the family
  matrix working off migrated data;
- re-running produced identical counts; a re-run after a partial copy filled only the gap.

Automated coverage: **78 tests** — `MigrateFromSupabaseTest` (31),
`MigrateSupabaseStorageTest` (13), `MigrateStorageFromDiskTest` (12),
`QuoteAttachmentMigrationTest` (12), `ReportMigrationTest` (10) — green on the MySQL,
PostgreSQL and SQLite lanes.

---

## 3. The pre-flight, and the one thing it is likely to stop

Before writing anything, the command compares the two schemas and scans the source for
values the target cannot hold. It **refuses to start** rather than failing half way.

**Expect `login_logs.ip_address` to fire.** It is `varchar(45)` here (IPv6 plus the
`::ffff:` prefix), but the edge function stored `x-forwarded-for` raw
(`manage-users/index.ts:146`), and behind a proxy that is a comma-separated chain:

```
+-----------------------+--------------+----------------------+------+--------------+
| column                | target width | longest source value | rows | example ids  |
+-----------------------+--------------+----------------------+------+--------------+
| login_logs.ip_address | 45           | 66                   | 812  | 4444…, 5555… |
+-----------------------+--------------+----------------------+------+--------------+
```

Two ways forward — **this is a decision, not a default**:

1. **Widen the column** in a migration and re-run. Nothing is lost. Right answer if the
   full chain matters for audit.
2. **`--truncate-overlong`.** Trims to fit and prints an audit list of every row touched.
   Acceptable for `ip_address` specifically, because the **leftmost** entry of an
   `x-forwarded-for` chain is the client — the part the admin panel displays — and a trim
   keeps it.

The other two pre-flight refusals:

- **a source column with nowhere to go** — the target would drop it silently, which is
  unrecoverable once Supabase is retired. Add the column here, or exclude the table.
- **a source that cannot be reached** — checked before any table is touched.

`--dry-run` runs the whole pre-flight, so the rehearsal surfaces all of this. Use
`--skip-width-check` only when resuming a run whose scan already passed (it is a full read
per bounded column).

---

## 4. OPS-072 — what the attachment fields actually hold

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

## 5. The production sequence

### Step 1 — Open the window, and secure the rollback target FIRST

```bash
git tag pre-laravel-cutover && git push origin pre-laravel-cutover
```

Record, next to that tag: the **currently deployed frontend build** (artifact id, or the
commit it was built from) and the Supabase project ref.

> **Rollback is a redeploy of that build — not an env swap.** The Phase 6 hand-off said
> rollback was "point `VITE_API_BASE_URL` back at Supabase". **That is wrong and would not
> work.** `apiClient` builds REST paths (`POST /auth/login`, `GET /quotes`); the Supabase
> backend is a *single* function taking a `{ action, … }` envelope. No base URL makes one
> speak the other. `@supabase/supabase-js` still being installed does not help either —
> nothing imports it. If that artifact does not exist, this step is where you create it,
> because after step 6 there is nothing to go back to.

Then, optionally, `php artisan down`.

### Step 2 — Back up. Non-negotiable.

Full Supabase **database dump** *and* **storage bucket export**. Verify the dump restores
somewhere before continuing. The bucket export is reusable in step 4 (`--from-disk`).

### Step 3 — Data (OPS-070)

```bash
cd backend
php artisan app:migrate-from-supabase --dry-run    # counts + the full pre-flight, writes nothing
```

Read the pre-flight output and settle §3 **before** the real run. Then:

```bash
php artisan app:migrate-from-supabase
#   --truncate-overlong      only after deciding §3; prints an audit list of every trim
#   --table=saved_quotes     limit to one table
#   --since-days=30          trim ONLY session_events/activity_events if volume is large
#   --chunk=500              lower it if MySQL rejects a batch on max_allowed_packet
```

Safe to re-run: rows are upserted by primary key, so a run that dies resumes where it
stopped. `user_sessions` is skipped by design.

### Step 4 — Storage (OPS-071)

```bash
php artisan app:migrate-supabase-storage --verify
# or, from the step-2 export, with no service-role key involved:
php artisan app:migrate-supabase-storage --from-disk=/path/to/bucket-export --verify
```

Keys are preserved — that is what keeps every saved attachment reference valid. Re-run to
retry failures; already-copied objects are skipped.

### Step 5 — Attachments (OPS-072)

```bash
php artisan app:inspect-quote-attachments          # census only, changes nothing
php artisan app:inspect-quote-attachments --rewrite --backup=storage/app/attachments-before.json
```

The second line is needed **only if** the census reports legacy full URLs. `--rewrite`
refuses to run without `--backup`.

### Step 6 — Parity, by machine then by hand (OPS-073)

```bash
php artisan app:report-migration --out=docs/backend-laravel/tickets/phase-7-report.txt
```

Exits non-zero on any gap: per-table counts (minus `user_sessions`), FK orphans, password
hash formats, attachment reachability.

Then by hand — the report prints this list too:

1. **3–5 users across roles** (admin / owner / employee) log in. Include one legacy
   SHA-256 account if any remain.
2. Each sees identical settings, and their own + related quotes.
3. Open **one attachment** end to end.

Only when all of that passes:

```bash
php artisan up
```

### Step 7 — Cut the frontend over

Flip production `VITE_API_BASE_URL` to the Laravel API, deploy, and run the **FE-064**
checklist. Archive the report next to this file.

**Keep Supabase PAUSED — not deleted — until the Phase 8 safety window elapses.** A paused
project is restorable; a deleted one is not. Phase 8 is gated on this window and on
OPS-073 being signed off.

---

## 6. Expected at cutover — not regressions

- **Every existing session dies.** `user_sessions` is deliberately not migrated: those are
  opaque Supabase tokens, not JWTs. Users re-login once; the SPA turns the 401 into a clean
  forced logout with *"انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى"*.
- **`app_users` will read one row higher than the source** if the target was seeded — the
  bootstrap admin never existed in Supabase. The report labels this `+N local` and passes.
- **jsonb may reorder object keys.** Not a content change; nothing reads them positionally.
- **Sub-second timestamps lose their fraction.** No column here stores one on any engine.
- **Legacy SHA-256 passwords stay SHA-256 until each user next logs in**, then upgrade to
  bcrypt. That is the designed path, not a migration failure.

---

## 7. Rollback

Nothing in Phase 7 is destructive to Supabase — every command only reads from it.

1. **Redeploy the pre-cutover frontend build** recorded in step 1. That build still
   contains the Supabase client and calls `manage-users`. A `git revert` of the FE-060..064
   commits achieves the same if no artifact was kept.
2. If step 5 ran, restore `quote_data` from the `--backup` JSON it required.
3. Un-pause Supabase.

Because rollback depends on that artifact rather than on the repo's current state, step 1
is first for a reason.

---

## 8. Commands

| Command | Ticket | Notes |
|---|---|---|
| `app:migrate-from-supabase` | OPS-070 | 7 tables, FK-safe order, upsert, cross-engine normalisation, schema + width pre-flight. `--dry-run` / `--table` / `--since-days` / `--chunk` / `--truncate-overlong` / `--skip-width-check` |
| `app:migrate-supabase-storage` | OPS-071 | keys preserved, resumable, source behind `ObjectSource`. `--from-disk` / `--verify` / `--prefix` / `--overwrite` / `--dry-run` |
| `app:inspect-quote-attachments` | OPS-072 | census by default; `--rewrite` **requires** `--backup` |
| `app:report-migration` | OPS-073 | counts, FK orphans, hash formats, attachment reachability; non-zero on any gap |
