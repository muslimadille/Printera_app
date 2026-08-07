# Phase 8 — Supabase decommission (OPS-080..083)

> ## ⛔ NOT STARTED — the gate is closed
>
> The ticket's own gate reads:
>
> > *do NOT start until OPS-073 parity is signed off AND the agreed rollback safety window
> > has been set.*
>
> **Neither condition is met.** The Phase 7 production migration never ran — it is blocked
> on Supabase credentials and a maintenance window (`PHASE-7-RUNBOOK.md` §1). There is no
> parity report, therefore nothing to sign off, and no safety window has been agreed.
>
> Executing OPS-080/082/083 now would delete the reference implementation and the rollback
> target for a migration **that has not happened**. This document is the prepared sequence,
> not a record of work done.

---

## 1. Pre-flight audit — DONE (read-only, safe before the gate)

These were run now because they are non-destructive and because a bad result would matter
immediately, regardless of phase.

| Check | Result |
|---|---|
| Service-role key anywhere in git history | **Clean.** Only the env-var *name* and comments appear (`manage-users/index.ts:1225`, two migration comments). No key value. |
| Every JWT-shaped string in full history (50 commits, all refs), decoded | **One**, `role=anon` — the publishable key, public by design. It dies with the project. |
| `backend/.env` tracked? | **No.** `JWT_SECRET`, `ADMIN_PASSWORD` and DB credentials were never committed. |
| Anything in `src/` importing Supabase | **Nothing.** `src/integrations/supabase/` is orphaned — zero importers since FE-063. |
| Live Supabase references in `src/` | **None.** The remaining string matches are comments and test names describing the migration (e.g. *"never sends the retired Supabase apikey header"*). Those are documentation, not usage. |
| CI/CD config in the repo | **None exists** (no `.github/`, `.gitlab-ci.yml`, `vercel.json`, …). Any pipeline lives in the hosting provider — OPS-082's pipeline step must be done there, not here. |

### Two findings worth acting on

1. **`.env` is tracked in git** (it has been since the initial commit; `.gitignore` has no
   `.env` rule). The only secret in it is the anon key, which is public by design, so this
   is not a breach — but the file should be untracked and replaced with a `.env.example`
   before anything genuinely secret is ever added to it. Not done here: untracking it
   changes how every developer and the deploy pipeline sources config, which is a decision,
   not a cleanup.
2. **`backend/storage/framework/testing/` was not gitignored** and the Phase 7 tests write
   sample quote data there. Fixed in this commit — a careless `git add .` would have
   committed test fixtures containing attachment paths.

---

## 2. OPS-080 — strip Supabase from the frontend

The work is small because Phase 6 already removed every import; what remains is dead weight.

```bash
git rm -r src/integrations/supabase          # client.ts + types.ts, zero importers
bun remove @supabase/supabase-js             # updates package.json + bun.lock

# Acceptance
grep -rniE "supabase|functions/v1|manage-users|montage-files|apikey|VITE_SUPABASE" src/
bun run lint && bun run test && bun run build
```

**On the "expect ZERO hits" acceptance:** after the delete, the only survivors are comments
and test names that *explain* the migration — e.g. `apiClient.ts`'s header comment, and the
test asserting the `apikey` header is gone. Deleting those would remove the explanation of
why the code looks the way it does, and the test that guards it. Keep them; the criterion's
intent is zero *imports and usages*, and that is already true today.

`Database` / `types.ts` needs no replacement — nothing imports it (verified above).

---

## 3. OPS-081 — env & secrets

```bash
# .env and EVERY hosting/CI environment
-  VITE_SUPABASE_URL
-  VITE_SUPABASE_PROJECT_ID
-  VITE_SUPABASE_PUBLISHABLE_KEY
+  VITE_API_BASE_URL=https://<laravel-host>/api/v1      # confirm present in each
```

- History scan: **already done and clean** (§1). No scrubbing needed; nothing to rotate on
  the repo side. The anon key is revoked implicitly when the project is deleted.
- `LOVABLE_API_KEY`: revoke **only if** the voice provider actually changed. `/voice/parse`
  now reads `VOICE_AI_API_KEY`; if that still points at the Lovable gateway, the same key is
  in use under a new name and revoking it breaks voice input. Check the value before
  revoking.
- Also remove the Phase 7 migration credentials once decommission is complete:
  `SUPABASE_DB_*`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` from `backend/.env`, and the
  block from `backend/.env.example`, `config/database.php` (`supabase` connection) and
  `config/printera.php` (`supabase_storage`). Rotate the service-role key regardless — it
  was on an operator's machine.

---

## 4. OPS-082 — archive & pipeline

```bash
git mv supabase legacy/supabase
```

Then add `legacy/supabase/README.md`:

> Retired Supabase backend (edge functions + migrations), kept for reference only.
> The live backend is `backend/` (Laravel + JWT). Nothing here is built or deployed.

Keep rather than delete: `manage-users/index.ts` is the behavioural source of truth that
every backend docblock cites by line number (`index.ts:543`, `:1009`, …), and
`PHASE-7-RUNBOOK.md` and `PHASE-0-1-AUDIT.md` reference it throughout. Deleting it orphans
every one of those citations.

Confirm the build ignores it — Vite only compiles from `src/`, and `tsconfig` should not
include `legacy/`. Re-run `bun run build` after the move.

**Pipeline, DNS, webhooks:** nothing to change *in this repo* (no CI config exists). Do
these in the hosting provider: remove any `supabase functions deploy` / `supabase db push`
step, and repoint anything aimed at `*.supabase.co` at the Laravel host.

---

## 5. OPS-083 — retire the project

Owner-only; there is no repo action.

1. Final Supabase **DB + storage backup**; store it with the OPS-073 report.
2. **Pause** project `fcnvyeqpvvascybcvzhi`.
3. After the safety window with zero rollbacks → **delete**.
4. Add the dated line below to `00-OVERVIEW-AND-MIGRATION-PLAN.md` §6, closing the migration.

```markdown
> **Supabase decommissioned on <YYYY-MM-DD>.** Project `fcnvyeqpvvascybcvzhi` deleted after
> a <N>-day safety window with zero rollbacks. Final backup archived at <location>.
```

---

## 6. Order of operations

Do **not** run OPS-080/082 before the safety window ends. They remove the reference
implementation and the code needed to understand a rollback. The safe order:

1. OPS-073 signed off → tag `pre-laravel-cutover` → safety window **starts**
2. OPS-083 steps 1–2 (backup, **pause**) — a paused project is restorable
3. …safety window elapses with zero rollbacks…
4. OPS-080, OPS-081, OPS-082 (repo cleanup — now safe to lose the old client)
5. OPS-083 step 3 (**delete**) + step 4 (dated note)
