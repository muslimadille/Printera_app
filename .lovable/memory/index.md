# Project Memory

## Core
React, Tailwind, Zustand, Supabase, Deno Edge Functions. RTL layout, Cairo font.
Use custom AlertDialogs ONLY, NEVER native `confirm()`. Red borders for required fields.
Edge Functions MUST return `200 OK` for business errors, with JSON state detailing the error.
Security: bcrypt via Sync in Deno, Signed URLs for `montage-files` (Private bucket), strict RLS.
Pricing precision: exactly 4 decimal places for unit prices.
Terminology: `per_piece`, `per_1000`, `tiered_1000`, `flat`, `Waste Amount`, `Saved Costs`.
**Template Build Protocol (TBP) is MANDATORY for every new dieline template — no exceptions.**
**Every new template MUST use the D001 UI shell — see `docs/TEMPLATE_UI_LAYOUT_STANDARD.md`. Do NOT modify D001 itself.**

## Memories
- [Template Build Protocol](mem://features/template-build-protocol) — Mandatory 7-phase protocol for new dieline templates (Reference Clone → Functional Map → Influence Map → Anchor+Delta → Bezier → Live Defaults → Preview=Export)
- [Template UI Layout Standard](mem://features/template-ui-layout-standard) — D001 UI is the mandatory shell for every new template; only geometry/exports/nesting/field-set may differ
