# Template Onboarding Protocol (TOP v1.1)

> **v1.1 changelog** — Adds the **Calibration Oracle** (`template-calibration.xlsx`, 9 sheets, validation-only — never a runtime engine) and the **Best Sheet Layout Contract** documenting scenarios S1–S6 (S1–S4 supported today, S5–S6 reserved as Future Engine work).
>
> **Master Excel Template** — Every new template's `template-calibration.xlsx` MUST be derived from the canonical master at `docs/templates/_reference/TEMPLATE_CALIBRATION_MASTER.xlsx` (same sheet names, same column headers). The filled reference implementation lives at `docs/templates/_reference/carrying-handle-box/template-calibration.xlsx`. Excel is a **Validation Oracle only** — the app never reads it at runtime.

> Standard, repeatable workflow for adding **any new dieline template** to the
> system with the same level of stability as the certified
> **Carrying Handle Box** reference template.

---

## 0. Philosophy — Why this works

> "The engine does not guess, and never resizes via a global Scale. It reads a
> **pre-tagged map** drawn by the designer, and redraws the template on a
> **Boundaries grid** computed exclusively from the user-entered dimensions."

A new template will succeed on the **first try** if and only if it follows:

```
Tagged SVG  →  Mapping Audit  →  Boundaries Engine  →  Piecewise Remap  →  Preview = Export
```

Skipping any step ⇒ visual failure + false-positive Debug Report.

---

## 1. What you must prepare for every new template

### 1.1 Required files (all mandatory)

| # | File                         | Purpose                                        |
|---|------------------------------|------------------------------------------------|
| 1 | `template.svg`               | Tagged SVG — the geometric source of truth     |
| 2 | `template-color.svg`         | Colored variant for the UI preview card        |
| 3 | `template-reference.pdf` / image | Adobe screenshot of the original artwork  |
| 4 | `template-spec.md`           | Manual mapping contract (see §1.3)             |
| 5 | 3 Test sizes (numeric)       | For the mandatory Regression Test              |

> Without any of these 5, work on the new template does **not** start.

### 1.2 Tagged SVG specification

**Mandatory layer structure** (Inkscape layers / `<g inkscape:groupmode="layer">`):

```
<svg>
  ├── <g id="CUT"        inkscape:label="CUT">       ← cut lines only
  ├── <g id="CREASE"     inkscape:label="CREASE">    ← crease lines only
  ├── <g id="HOLES"      inkscape:label="HOLES">     ← apertures (handles, holes)
  ├── <g id="GUIDES"     inkscape:label="GUIDES">    ← optional, stripped on export
  └── <g id="REFERENCE"  inkscape:label="REFERENCE"> ← optional, stripped on export
</svg>
```

**Forbidden in source SVG:**
- ❌ Mixing Cut & Crease in a single layer
- ❌ Using stroke color to distinguish type (layer name is the only source of truth)
- ❌ Orphan elements outside a tagged layer
- ❌ `<symbol>` / `<use>` / `<clipPath>`
- ❌ `transform="matrix(...)"` / `scale(...)` on production paths
- ❌ Compound Path combining Cut + Crease

**Element naming convention** — every element under CUT/CREASE/HOLES must carry
`id` or `data-tag` of the form:

```
<TYPE>_<AXIS>_<ZONE_FROM>_TO_<ZONE_TO>
```

Examples from Carrying Handle Box (the reference):

| Element              | Tag                                   |
|----------------------|---------------------------------------|
| Outer cut            | `CUT_OUTER_CONTOUR`                   |
| Right outer edge     | `CUT_RIGHT_DEPTH_2_OUTER_EDGE`        |
| Crease vertical      | `CREASE_X_GLUE_TO_FRONT_1`            |
| Crease vertical      | `CREASE_X_FRONT_1_TO_DEPTH_1`         |
| Crease horizontal    | `CREASE_Y_TOP_TO_BODY`                |
| Crease horizontal    | `CREASE_Y_BODY_TO_BOTTOM`             |
| Handle aperture      | `HOLE_HANDLE_FRONT_1`                 |

**Technical SVG attributes:**
- Units = `mm` (not px)
- viewBox starts at `0 0`
- No `transform` on production paths
- No `<text>` inside production layers
- Outer contour = single closed path (terminating `Z`)

### 1.3 `template-spec.md` — the mapping contract

This is the most important file. It is the **contract** between designer and engine.

```markdown
# Template: <Name>

## Dimensions Inputs
| Input    | Symbol | Range (mm) | Default |
|----------|--------|------------|---------|
| Length   | L      | 100–500    | 300     |
| Depth    | D      | 80–300     | 150     |
| Height   | H      | 100–400    | 180     |
| GlueFlap | G      | fixed/auto | 30      |

## X Boundaries (left → right)
| Boundary | Formula  | Zone           |
|----------|----------|----------------|
| X0       | 0        | Origin         |
| X1       | G        | Glue flap      |
| X2       | X1 + L   | Front 1        |
| X3       | X2 + D   | Depth 1        |
| X4       | X3 + L   | Front 2        |
| X5       | X4 + D   | Depth 2 (end)  |

## Y Boundaries (top → bottom)
| Boundary | Formula            | Zone        |
|----------|-------------------|-------------|
| Y0       | 0                 | Top edge    |
| Y1       | coverTotal(D)     | Cover stack |
| Y2       | Y1 + H            | Body bottom |
| Y3       | Y2 + bottomFlap(D)| Final       |

## Axis Rules (Mapping Audit Contract)
- L → X only (Front 1, Front 2 zones)
- D → X (Depth zones) + Y (cover/bottom stacks)
- H → Y only (body zone)
- G → X start only

## Zone Behavior
| Zone     | Behavior   | Notes                          |
|----------|-----------|--------------------------------|
| Glue     | translates | width = G, content fixed       |
| Front 1  | stretches  | width scales with L            |
| Depth 1  | stretches  | width scales with D            |
| Curves   | preserved  | handle pills, lock notches     |

## Test Cases (3 sizes minimum)
1. Reference:  L=300 D=150 H=180 → Footprint 930 × 435
2. Approved:   L=320 D=160 H=170 → Footprint 990 × 442
3. Edge:       L=330 D=140 H=160 → Footprint 970 × 426
```

Without this file the engine cannot know which zones move, which stretch, and
which stay fixed. Guessing = failure.

---

## 2. New Template Certification Workflow (NTCW — 10 steps)

```
STEP 1  Upload Tagged SVG + Spec
        Designer delivers: template.svg + template-spec.md + 3 sizes.
        Engine checks: clean SVG + complete Spec.
        Gate: explicit Spec approval.

STEP 2  SVG Static Analysis
        Scan for: <symbol>, <use>, matrix, scale, orphan paths.
        Output: list of tagged vs untagged elements.
        Gate: 0 untagged elements.

STEP 3  Mapping Report (read-only)
        Compute X/Y boundaries from Spec only.
        Show table: Component | Expected | Current | Pass/Fail.
        Gate: user approves the mapping table.

STEP 4  Manual Mapping Review
        User reviews zone-by-zone: moves / stretches / fixed.
        Gate: explicit user approval.

STEP 5  Base Size Validation
        Render preview at the reference size only.
        Visually compare to template-reference.pdf.
        Gate: 100% visual match.

STEP 6  Resize Test (single size)
        Apply one alternate size.
        Debug Report: X bounds, Y bounds, footprint, warnings.
        Gate: full PASS + user approval.

STEP 7  Preview Validation (3 sizes)
        Regression across 3 sizes.
        Curves preserved? Holes in place? No duplicate geometry?
        Gate: 3/3 PASS.

STEP 8  Export Validation
        Preview === Export per piece (structural equality).
        No <symbol>, no <use>, no matrix, no clipPath leak.
        mm units, viewBox = footprint.
        Gate: Flattened Export Contract assertions pass.

STEP 9  Illustrator Open Test
        User opens SVG in Adobe Illustrator.
        No blank page, no missing geometry, no duplicates.
        Gate: visual confirmation by user.

STEP 10 Approve & Lock as Reference
        Write engine/export/regression/visual-fidelity vitest files.
        Register the template in the Reference Library.
        Gate: all tests green → Locked.
```

Every **Gate** is a hard stop — no skipping without explicit user approval.

---

## 3. Illustrator export pitfalls to avoid

1. ❌ Compound Paths combining Cut & Crease
2. ❌ Active Clipping Masks (Expand first)
3. ❌ Unflattened Effects (Drop Shadow, Warp…) — Expand Appearance
4. ❌ Hidden layers — delete
5. ❌ Symbol Library instances — Break Link
6. ❌ Pattern Fills — Expand
7. ❌ Guides outside a GUIDES layer
8. ❌ Unexpanded strokes on curve-critical paths
9. ❌ "SVG Tiny" output — use SVG 1.1
10. ❌ Save-As SVG Options → CSS = "Style Attributes" (not "Presentation Only")
11. ❌ "Responsive" checkbox ON (strips width/height)
12. ❌ Decimal Places < 3

---

## 4. What blocks a successful template

| Symptom                          | Root cause (designer side)          | Fix                              |
|----------------------------------|-------------------------------------|----------------------------------|
| Wrong mapping                    | Spec inaccurate / incomplete        | Complete `template-spec.md`      |
| Curves lost                      | `transform` on paths                | Object → Flatten Transform       |
| Preview ≠ Export                 | Untagged-layer elements             | Re-check Layer Panel             |
| Illustrator blank page           | Residual `<symbol>` / `<use>`       | Delete Symbols + Expand          |
| Duplicate lines                  | Crease in Compound with Cut         | Separate paths                   |
| Resize breaks shape              | Zone behavior table missing         | Fill Zone Behavior section       |
| Apertures disappear              | HOLE element placed under CUT layer | Restructure layers               |

---

## 5. Definition of Done (template certification)

A new template is **Certified** only when **all** of:

- [ ] Tagged SVG clean and matching spec
- [ ] `template-spec.md` approved by user
- [ ] Mapping Audit Report = PASS
- [ ] 3 Test Sizes PASS — numerically AND visually
- [ ] Preview === Export (per-piece geometry identical)
- [ ] Export opens in Illustrator without artifacts
- [ ] No `<symbol>` / `<use>` / `matrix()` in export
- [ ] Vitest suites green: engine + export + regression + visual fidelity
- [ ] Explicit user sign-off on visual preview
- [ ] Template registered in Reference Library

---

## 6. Quick pre-flight checklist (deliver to engine BEFORE work starts)

- [ ] `template.svg` (tagged: CUT/CREASE/HOLES, named elements `TYPE_AXIS_FROM_TO`)
- [ ] `template-color.svg`
- [ ] `template-reference.pdf` or screenshot
- [ ] `template-spec.md` (Inputs, Boundaries, Axis Rules, Zone Behavior, 3 Test Sizes)
- [ ] 3 numerical test sizes
- [ ] Confirmed base/reference dimensions
- [ ] Confirmed Illustrator export settings

---

## 7. Reference Template

The canonical reference implementation is archived under:

```
docs/templates/_reference/carrying-handle-box/
```

Every new template MUST mirror its structure:
- Tagged SVG layer scheme
- Element naming convention
- Axis Contract (X/Y boundaries derived purely from inputs)
- Flattened Export Contract (no symbol/use/matrix)
- Regression Test Pattern (3 sizes)
- Illustrator Open Test

Engine implementation reference:
- `src/lib/carryingHandleBoxEngine.ts`
- `src/lib/carryingHandleBoxExport.ts`
- `src/lib/carryingHandleBoxEngine.test.ts`
- `src/lib/carryingHandleBoxExport.test.ts`
- `src/lib/carryingHandleBoxRegression.test.ts`
- `src/lib/carryingHandleBoxGeometryCleanup.test.ts`

---

## 11. Calibration Oracle — `template-calibration.xlsx`

Every certified template MUST ship a `template-calibration.xlsx` next to its
`template-spec.md`. It is a **Validation Oracle** — consumed only by regression
tests and human review. It is **never imported by runtime code**.

### 11.1 Required sheets (exactly 9, in this order)

| # | Sheet              | Purpose                                                                 |
|---|--------------------|-------------------------------------------------------------------------|
| 1 | `Inputs`           | L, D, H, GlueFlap, SheetWidth, SheetHeight, Gap                         |
| 2 | `DerivedDimensions`| All engine-computed derived values (glueFlapAuto, covers, flaps, voids) |
| 3 | `Boundaries`       | X0..X5 + Y0..Y3 with formulas                                           |
| 4 | `Footprint`        | footprintW, footprintH (expected)                                       |
| 5 | `Pitch`            | pitchX = footprintW + gap, pitchY = footprintH + gap                    |
| 6 | `SheetLayout`      | Scenarios S1..S6 — Best Sheet Distribution (see §12)                    |
| 7 | `Orientation`      | Auto-pick summary across supported scenarios                            |
| 8 | `AxisIndependence` | Proves Height→X = 0 leak and Length→Y = 0 leak                          |
| 9 | `TestCases`        | Locked regression rows (3+ sizes) referencing all above sheets          |

> The 6th sheet MUST be named **`SheetLayout`** (not `Layout`). It documents
> "Best Sheet Distribution" — the core of the calibration oracle.

Every comparison sheet must carry a `Tolerance mm` column (default `0.01`).

### 11.2 Role contract

- **Validation Oracle only.** Used by `*Regression.test.ts` to assert engine
  outputs match the workbook. Never imported by UI or runtime code.
- **Source of truth for review**, not for math. The math lives in the engine;
  the workbook is the human-readable expectation.

### 11.3 Master Excel Template (mandatory starting point)

- The canonical empty master is at
  `docs/templates/_reference/TEMPLATE_CALIBRATION_MASTER.xlsx`.
- Every new template starts by **copying the master** into its own folder as
  `template-calibration.xlsx`, keeping all 9 sheet names and all column headers
  unchanged. Only values and per-template formulas change.
- The **Filled Reference Implementation** is
  `docs/templates/_reference/carrying-handle-box/template-calibration.xlsx` —
  the worked example to mirror when filling a new template's workbook.
- Do not rename, reorder, add or remove sheets in a derived workbook; the
  regression layer and review tooling rely on the master schema.

---

## 12. Best Sheet Layout Contract

> **"Best Sheet Layout" is NOT `cols × rows` for a single orientation.**
> It is the **maximum result across every layout scenario the engine supports**,
> subject to hard geometric constraints.

### 12.1 Scenarios

| #  | Scenario                  | Piece Rotation | Sheet Orientation | Mixed Rotation | Engine Status                |
|----|---------------------------|----------------|-------------------|----------------|------------------------------|
| S1 | Normal                    | 0°             | W × H             | No             | ✅ Supported                  |
| S2 | Rotated                   | 90°            | W × H             | No             | ✅ Supported                  |
| S3 | Sheet Flip — Normal       | 0°             | H × W             | No             | ✅ Supported                  |
| S4 | Sheet Flip — Rotated      | 90°            | H × W             | No             | ✅ Supported                  |
| S5 | Mixed Rotation            | 0° + 90°       | W × H             | **Yes**        | ⏳ **Future Engine** (not a failure condition today) |
| S6 | Mixed + Sheet Flip        | 0° + 90°       | H × W             | **Yes**        | ⏳ **Future Engine** (not a failure condition today) |

`MixedRotationSupported = No  →  Status: Needs Future Engine`

### 12.2 Selection rule (current certification)

```
Best = argmax over { S1, S2, S3, S4 } of:
        1. Total Pieces        (primary)
        2. Utilization %       (tiebreaker 1)
        3. Waste %             (tiebreaker 2, minimize)
```

### 12.3 Hard constraints (all must pass)

- ✅ No piece overlap
- ✅ Gap respected on all sides
- ✅ Piece fully inside sheet bounds
- ✅ Preview ≡ Export (structural equality)
- ✅ No duplicate pieces

### 12.4 `SheetLayout` sheet columns

```
TemplateName | TestCaseID | ScenarioName | PieceRotation | SheetOrientation
MixedRotationAllowed | EngineSupported | SheetWidth | SheetHeight
UsableSheetWidth | UsableSheetHeight | Gap | PitchX | PitchY
Columns | Rows | TotalPieces | LayoutWidth | LayoutHeight
RemainingWidth | RemainingHeight | UtilizationPercent | WastePercent
SelectedBestLayout | Reason | NoOverlapExpected | GapRespectedExpected
InsideSheetExpected | PreviewExportMatchExpected | Tolerance | Status | Notes
```

### 12.5 Future Engine roadmap (S5 / S6)

- Mixed-rotation nesting (interlock / staggered packing) is the long-term goal.
- Until the engine implements it, S5/S6 rows in `Layout` carry
  `Engine Supported = Future` and are **never failure conditions**.
- When implemented, the selection rule extends to `{S1..S6}` automatically and
  the `MixedRotationSupported` flag flips to `Yes`.
