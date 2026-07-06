# D001 — Master Reproduction Prompt

Use this prompt (verbatim) to instruct any AI model to rebuild the D001 dieline template with the same quality achieved in this project. Attach the files in this kit to the model.

---

## 🎯 Goal
Build a **fully parametric dieline template "D001"** (Straight Tuck-End style box with glue flap, lid tongue, four depth tongues, lock, and inner cuts). The final template must be:
- **Byte-accurate** to the reference `template.svg` when in Reference Clone mode (≤ 0.01 mm on every segment).
- **Fully parametric** in dynamic mode, with clean, isolated parameter influence.
- **Illustrator-ready** on export (SVG + PDF), with strict two-layer protocol.
- Support **Smart Auto Nesting** on a press sheet.

## 📎 Attached files (this kit)
| File | Purpose |
|---|---|
| `template.svg` | Source of truth — tagged reference dieline (W=50, H=130, D=40 mm) |
| `template-color.svg` | Colored preview variant |
| `map.svg` | Segment map (annotated) |
| `ref_200x200x50.svg` | Second calibration sample (W=200, H=200, D=50 mm) |
| `blueprint.xlsx` | Full documentary blueprint (formulas, angles, boundaries) |
| `template-calibration.xlsx` | Validation Oracle — 23 sheets covering every rule and test case |
| `PROMPT.md` | This file |

## 🏛️ Mandatory 7-Phase Build Protocol
No phase may be skipped. Every phase has a hard **Gate** before the next begins.

### Phase 1 — Reference Clone Mode (FIRST)
Build a static clone that emits the exact geometry of `template.svg` in **mm** (converted from pt using `PT_PER_MM = 2.83464566929`).
- Must reproduce **67 segments**: 47 OUTER + 8 CUT (inner slots) + 12 CREASE.
- Visual + geometric diff ≤ 0.01 mm on every segment.
- Keep this mode in the final code as a permanent regression oracle behind a `referenceMode` flag.
- **Gate:** side-by-side render matches source exactly.

### Phase 2 — Segment Functional Map
Classify every segment. Commit as `segment-map.md`.
Categories: Outer cut · Inner cut · Crease · Lid tongue · Depth tongue · Lock · Glue flap · Fixed · Stretchable · Angle-preserving.

### Phase 3 — Parameter Influence Map
For each input, declare the exact segments it controls. No silent cross-coupling.
Inputs: `Width, Height, Depth, Glue_Flap, Lid_Tongue, Lock, Depth_Tongue_Total_Height, Depth_Tongue_Corner_Radius, Glue_Flap_Top_Angle, Glue_Flap_Bottom_Angle`.

Key isolation rules (from the calibration workbook):
- **Depth** affects lid Y-stack only; must NOT distort lid Béziers.
- **Lid_Tongue** controls ONLY Béziers Seg 12 / 14 / 41 / 43 (vertical span).
- **Lock** controls ONLY Seg 4 / 22 / 29 / 33 vertical + CUT_48/50/52/54 length.
- **Depth_Tongue_Total_Height** flexes ONLY the middle ramp region (Seg 6/7 area). Lock (Seg 4) and end chamfers (Seg 5/9) stay unchanged.
- **Depth_Tongue_Corner_Radius** = tangent fillet ONLY at the sharp ramp↔top corner of each depth tongue.
- **Glue_Flap_Top/Bottom_Angle** controls slant of Seg 1 / Seg 46 only (default 25°).
- **Live default rule:** `Width ≤ 25 mm → Lock = 3 mm`, else `Lock = 5 mm`. User edit switches field to manual (`touched=true`); an "Auto Reset" button reverts.

Enforce with sensitivity tests (change one input → assert only its declared segments moved).

### Phase 4 — Anchor + Delta ONLY
- Forbidden: global `scale`, `transform`, `matrix`, generic stretch on the whole template.
- Each movable segment = `anchor + delta`, delta from the parameter map.
- Fixed parts keep absolute coordinates.

### Phase 5 — Bezier Preservation
- Béziers use relative control points anchored to endpoints.
- Never approximate curves with straight lines during resize.

### Phase 6 — Live Defaults + Manual Override
- Rules run as live defaults driven by inputs.
- User edit sets `touched` flag → manual.
- Explicit "Auto Reset" control shows the target value and reverts.

### Phase 7 — Preview = Export & Layer Protocol
- Same geometry source for both preview and export (structural equality).
- Forbidden in export: `<use>`, `<clipPath>`, `<symbol>`, `<foreignObject>`, raster, global transforms.
- Units: **mm**. Coordinates: **absolute**.
- Layers (exactly two, in this order): `CREASE` (stroke `#00A651`) then `CUT` (stroke `#ED1C24`, contains outer AND inner cuts). `CUT` sits above `CREASE`.
- Stroke width: `0.45`.

## 📐 Reference Constants (from `template.svg`)
```
Reference_Width         = 50 mm
Reference_Height        = 130 mm
Reference_Depth         = 40 mm
Reference_Depth_2       = 39.5   (D − 0.5)
Reference_Glue_Flap     = 12 mm
Reference_Lid_Tongue    = 14.25 mm   (vertical span of Béziers 12/14/41/43)
Reference_Depth_Tongue  = 39.75      (D − 0.25 = Cover_Vertical)
Depth_Tongue_Total_Height (auto) = Lock + 2 + D/2   → 5 + 2 + 20 = 27 mm at reference
BBox                    = 191.50 × 237.99 mm
```

Rules:
```
faceHeight(H)    = H + 0.5
depth1(D)        = D
depth2(D)        = D − 0.5
coverVertical(D) = D − 0.25
lidCurveHeight   = 14.25   (fixed by Lid_Tongue)
Lock(W)          = W ≤ 25 ? 3 : 5    (live default)
```

## 🧪 Test Cases (mandatory, ≤ 0.01 mm tolerance)
1. `W=50, H=130, D=40` → matches `template.svg` byte-for-byte.
2. `W=200, H=200, D=50` → matches `ref_200x200x50.svg`.
3. Sensitivity matrix — for each parameter, mutate ±10 % and assert **only** its declared segments changed.

## 🧩 Smart Auto Nesting (Phase 3 add-on)
- Compute **pitch** using actual tongue overlap (tongues interlock between rows/columns), not raw bbox.
- Raster-mask collision engine; **zero CUT collisions** allowed.
- Handle swapped sheet dims (e.g. 1000×700 vs 700×1000) symmetrically with an "Allow Rotation" flag.
- Default sheet: **1000 × 700 mm**.

## 📤 Export
- Single template: SVG + PDF (mm units, `viewBox` = footprint).
- Sheet layout: SVG + PDF, preview ≡ export structurally.
- No `clipPath`, no `<use>`, no `<symbol>`, no `transform`.

## ✅ Definition of Done
1. Reference Clone passes both calibration sizes ≤ 0.01 mm.
2. `segment-map.md` and `parameter-influence.md` committed.
3. Sensitivity tests green for every parameter.
4. No global scale/transform in the geometry engine.
5. All Béziers stay smooth across the full parameter range.
6. Live defaults + manual override + auto-reset work for `Lock`, `Depth_Tongue_Total_Height`, tongue angles.
7. Preview SVG ≡ Export SVG (structural equality), two-layer protocol enforced.
8. Smart nesting produces zero-collision layouts on both 1000×700 and 700×1000.
9. Opens cleanly in Adobe Illustrator (no blank page, no missing paths, no residual symbols).

## 🚫 Common Failure Modes (avoided by this protocol)
- Skipping Reference Clone → visual drift.
- Global `scale()` → broken Béziers and misplaced tongues.
- Implicit input coupling (e.g., Depth affecting lid curves) → hidden regressions.
- Mixing CUT + CREASE in one path → Illustrator import fails.
- Using `<use>`/`<clipPath>` → export renders blank in some CAM tools.

---
**Authoritative source:** `docs/TEMPLATE_BUILD_PROTOCOL.md` in the original project.
Use the attached `template-calibration.xlsx` as the machine-readable validation oracle for all 23 rule sheets.
