# Template Engine Build Plan — `lid-tuck-box-v1`

> **Status:** Documentation only. No code, runtime, UI, export, mapping, SVG, or
> tab is created or modified by this document. This is a build plan that must be
> approved before any implementation begins.
>
> **Source documents (authoritative):**
> - `docs/templates/_analysis/lid-tuck-box-v1/template-spec.md`
> - `docs/templates/_analysis/lid-tuck-box-v1/mapping-report.md`
> - `docs/templates/_analysis/lid-tuck-box-v1/base-geometry-validation-report.md`
> - `docs/templates/_analysis/lid-tuck-box-v1/resize-logic-dry-run-report.md`

---

## 1. Template Name

`lid-tuck-box-v1`

## 2. Target Tab Name

Working label: **Lid Tuck Box** (internal id: `lid-tuck-box-v1`).
Location: a new standalone tab inside the **قوالب** (Templates) group, sibling to
existing template tabs (e.g. Carrying Handle Box). The tab will be created in a
later stage — **not in this plan**.

## 3. Input Fields

Three numeric inputs, mm, integer or 1-decimal:

| Field | Symbol | Unit | Required |
|---|---|---|---|
| Length | `L` | mm | Yes |
| Depth  | `D` | mm | Yes |
| Height | `H` | mm | Yes |

## 4. Default Values

| Field | Default |
|---|---:|
| Length | 200 mm |
| Depth  | 50 mm |
| Height | 200 mm |

Provisional ranges (from `template-spec.md` §4): `L ∈ [180, 220]`,
`D ∈ [40, 60]`, `H ∈ [190, 210]`. Values outside these ranges remain allowed but
flagged as "outside verified range" in UI hint text only.

## 5. Derived Formulas (from `template-spec.md` §5–§7)

Confirmed by 126/126 checks, max deviation 0.001 mm.

```text
flat_width            = L + 2D − 0.5
flat_height           = 4D + 2H + 1.1
header_band_height    = D + 1.75
front_depth           = D
back_depth            = D
base_height           = H − 1
lid_height            = H − 2.4
apex_handle_zone      = D − 0.25
lid_front_tuck_strip  = D − 0.5
side_ear_width        = D − 0.25
body_margin_crease    = D − 0.25
body_margin_pin_layer = D − 0.5
upper_strip_offset    = D + 0.25
top_lock_slot_width   = 0.20 · L
slot_anchors_x_rel    = {0.2, 0.4, 0.6, 0.8} · L − 0.25  (relative to body_left=D)
notch_center_x        = D + L / 2
notch_half_left       = 7.75   (fixed, asymmetric)
notch_half_right      = 7.25   (fixed, asymmetric)
```

X boundaries: X0–X15 per `template-spec.md` §6.
Y boundaries: Y0–Y10 per `template-spec.md` §7.
Fixed constants (pin_offset, chamfers 20/15, handle 7.5/42.5, micro-creases
0.5/1.5, side_header 5) per `template-spec.md` §10.

## 6. Resize Engine Approach

Pure functional, parametric — no SVG re-parse at runtime.

1. Engine module (new file): `src/lib/lidTuckBoxEngine.ts`.
2. Single entry point: `buildLidTuckBoxGeometry({ L, D, H }) → Geometry`
   returning:
   - `flatWidth`, `flatHeight`
   - `xBoundaries` (X0…X15)
   - `yBoundaries` (Y0…Y10)
   - `creaseLines[]` (17 entries, each `{from:[x,y], to:[x,y], role}`)
   - `cutPaths[]` (slot end-caps, side-ear pin cuts, notch arc, handle bubble,
     chamfers — each tagged with role + PC/SX/SY/TO behavior)
   - `outerContour` (single compound path, **read-only** monolithic, generated
     from the segmentation rules in §6/§7 of `template-spec.md` and §4 of
     `mapping-report.md` — kept as one path until a separate approval stage).
3. All math is pure (no DOM, no async). Inputs validated; out-of-range values
   compute anyway and surface a warning to the caller.
4. No SheetLayout, no Nesting, no Distribution.

## 7. Element Mapping Strategy

- 17 CREASE lines — generated directly from formulas C01–C17 in
  `mapping-report.md` §1.
- 8 CUT sub-paths — generated from P01–P08 in `mapping-report.md` §2.
- `CUT_OUTER_CONTOUR` (P08) — emitted as a single compound path; segmentation
  proposal from `mapping-report.md` §4 is **not** used as authoritative.
- Preserve-curve elements (front-tuck notch arc, handle bubble, chamfers, top
  mini-lock tabs) — translated only; geometry copied verbatim from the base
  size and shifted by `B + L/2` etc. (no re-sampling).
- Asymmetric notch `7.75 / 7.25` reproduced exactly.

## 8. Preview Generation Strategy

- New component (planned, not built): `LidTuckBoxPreview.tsx`.
- Renders an inline `<svg>` from the engine output:
  - One `<g id="CREASE">` containing 17 `<line>` elements styled as crease.
  - One `<g id="CUT">` containing the compound outer-contour path and the
    smaller CUT sub-paths.
- viewBox = `0 0 flat_width flat_height` (mm), with `mm` units in the root
  `<svg width/height>` for 1:1 print fidelity.
- No zoom/pan added in this iteration; container scales responsively.
- No color-layer (`template-color.svg`) integration in this iteration. Color
  layer is deferred to a later "color preview" stage.

## 9. Export Strategy

Phase 1 (covered by initial tab build):

- **Inline SVG download** of the live preview — single button, returns the
  exact same SVG markup the preview renders.

Phase 2 (deferred, not in this plan):

- PDF export.
- Illustrator-compatible SVG (separate `CUT` / `CREASE` named layers with
  Illustrator-friendly attribute set, matching the
  `_reference/carrying-handle-box/export-contract.md` style).
- DXF export.

No Excel export. No SheetLayout export. No nesting export.

## 10. Test Cases

Numeric (engine unit tests, planned file `src/lib/lidTuckBoxEngine.test.ts`):

| Case | L | D | H | Expected `flat_width` | Expected `flat_height` |
|---|---:|---:|---:|---:|---:|
| Base     | 200 | 50 | 200 | 299.500 | 601.099 |
| Sample A | 180 | 40 | 190 | 259.500 | 541.099 |
| Sample B | 220 | 60 | 210 | 339.500 | 661.099 |

For each case, assert:

- All 17 crease endpoints match `mapping-report.md` formulas to ≤ 0.01 mm.
- All Y boundaries Y0…Y10 match `template-spec.md` §7 to ≤ 0.01 mm.
- All X boundaries X0…X15 match `template-spec.md` §6 to ≤ 0.01 mm.
- Notch center = `D + L/2`; halves = `7.75 / 7.25` exactly.
- Slot anchors at `{0.2, 0.4, 0.6, 0.8}·L − 0.25` relative to body_left.

UI smoke (planned, manual at first):

- Default inputs render preview with `flat_width=299.5`, `flat_height=601.099`.
- Changing each input updates preview live.
- SVG download produces a file that opens in a browser and equals the preview.

## 11. Validation Gates

Build cannot proceed past each gate until it passes.

1. **Gate A — Engine unit tests:** all 3 sizes pass (≤ 0.01 mm).
2. **Gate B — Preview parity:** rendered SVG bounding box equals
   `(flat_width, flat_height)` for all 3 sizes.
3. **Gate C — Reference parity:** for L=200, D=50, H=200, the generated CREASE
   line set is element-wise equal (≤ 0.01 mm) to the 17 lines in
   `200×200×50mm.svg`.
4. **Gate D — Asymmetric notch:** rendered notch center sits at `B + L/2`, left
   half = 7.75, right half = 7.25 (verified per size).
5. **Gate E — No regressions:** existing tabs (Carrying Handle Box, Smart
   Engine, Hybrid Engine, etc.) still build and pass their existing tests
   unchanged.

## 12. What WILL Be Modified (in the later implementation stage, not now)

| File / area | Change |
|---|---|
| `src/lib/lidTuckBoxEngine.ts` (new) | Pure engine module. |
| `src/lib/lidTuckBoxEngine.test.ts` (new) | Engine unit tests. |
| `src/components/LidTuckBoxCalculator.tsx` (new) | Tab content: inputs + preview + download. |
| `src/components/LidTuckBoxPreview.tsx` (new) | SVG preview component. |
| `src/lib/lidTuckBoxExport.ts` (new) | Inline SVG download helper (Phase 1). |
| `src/components/AppTabs.tsx` | Register new tab inside the قوالب group. |
| `src/lib/tabRegistry.ts` | Add tab id `lid-tuck-box-v1`. |

## 13. What WILL NOT Be Modified

- Source SVG files (`template.svg`, `template-color.svg`, the 3 sample SVGs).
- Any other template engine: Carrying Handle Box, Die-Cut v1–v5, Smart Engine,
  Hybrid Engine, Auto-Nest, Magazine, Manual Pricing, etc.
- Runtime / store (`src/store/printingStore.ts`) — no new global state.
- Existing UI tabs, routes, or layout.
- Existing export pipelines (`carryingHandleBoxExport`, `dieCutExport`, etc.).
- Mapping runtime / Illustrator open contracts of other templates.
- SheetLayout, Nesting, Distribution, Auto-Nest, Bulk Quote pipelines.
- Excel import/export of any kind.
- Supabase schema, RLS, edge functions.
- `index.css`, design tokens, fonts, theme.

## 14. Risks

1. **`CUT_OUTER_CONTOUR` monolithic** — Phase-1 outer contour will be generated
   by stitching the analytical segments (`mapping-report.md` §4) into a single
   path string. Risk: the stitched path may have a slightly different winding
   or join style than the original. **Mitigation:** unit test that compares
   total perimeter length and bounding box to the source SVG at base size.
2. **Preserve-curve elements** (notch arc, handle bubble) — copied verbatim,
   not re-sampled. Risk: if L scales far outside [180, 220], the fixed
   asymmetric notch (7.75 / 7.25) becomes visually proportionally smaller.
   **Mitigation:** UI hint when `L` exits the verified range; do not auto-scale.
3. **`flat_height` closure constant `1.1`** — comes from an extra `0.5`
   micro-crease inside the apex band. Risk: forgetting it shortens height by
   0.5 mm. **Mitigation:** explicit unit test on the three sizes.
4. **Tab registration** — adding to `AppTabs.tsx` / `tabRegistry.ts` touches
   shared files. Risk: regression in other tabs. **Mitigation:** Gate E
   requires the full existing test suite to pass before merge.
5. **No SheetLayout** — users may expect cost/quote integration. This is
   intentionally deferred and must be communicated in the tab UI.

## 15. Rollback Plan

Because every new file (`lidTuckBox*`) is namespaced and the only shared edits
are two registration lines in `AppTabs.tsx` and `tabRegistry.ts`, rollback is:

1. Remove the tab id from `tabRegistry.ts`.
2. Remove the tab entry from `AppTabs.tsx`.
3. Delete the new files:
   - `src/components/LidTuckBoxCalculator.tsx`
   - `src/components/LidTuckBoxPreview.tsx`
   - `src/lib/lidTuckBoxEngine.ts`
   - `src/lib/lidTuckBoxEngine.test.ts`
   - `src/lib/lidTuckBoxExport.ts`
4. No database, storage, edge-function, or runtime-store rollback required.
5. No other template or pipeline is touched, so rollback cannot affect them.

Estimated rollback time: a single revert of one commit.

---

## 16. Modifications Summary (this document only)

| | |
|---|---|
| `template-engine-build-plan.md` created | **Yes** |
| Build scope | Engine + Preview + Inline SVG download + new tab (later) |
| Target tab | **Lid Tuck Box** (id `lid-tuck-box-v1`), inside قوالب group |
| Inputs | Length, Depth, Height |
| Default values | L=200, D=50, H=200 (mm) |
| Source documents used | `template-spec.md`, `mapping-report.md`, `base-geometry-validation-report.md`, `resize-logic-dry-run-report.md` |
| Runtime changes planned | **No** (no global store changes) |
| UI changes planned | **Yes** (new tab + new components, in the later build stage) |
| Export changes planned | **Yes — Phase 1 only:** inline SVG download. PDF / Illustrator-SVG / DXF deferred. |
| Other tabs affected | **No** |
| SheetLayout included | **No** |
| Nesting included | **No** |
| Distribution included | **No** |
| Excel included | **No** |
| SVG source modified | **No** |
| Mapping runtime modified | **No** |
| Ready for Build New Tab | **Yes** (pending user approval of this plan) |
