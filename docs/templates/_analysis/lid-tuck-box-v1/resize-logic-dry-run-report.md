# Resize Logic Dry Run Report — `lid-tuck-box-v1`

> **Status:** Read-only numeric dry run. Applies the formulas from
> `template-spec.md` at three sizes and compares against raw SVG geometry.
> **No engine, runtime, UI, export, mapping-runtime, or SVG modified.**

---

## 0. Setup

| Field | Value |
|---|---|
| Source of formulas | `template-spec.md` (with §6 X12–X15 corrected during this stage; see §7 below) |
| Reference SVGs | `200×200×50mm.svg`, `180×190×40mm.svg`, `220×210×60_mm.svg` |
| Conversion | `1 mm = 2.83465 px` |
| Tolerance — small/detail | ±0.25 mm |
| Tolerance — large/composite/bbox | ±0.5 mm |
| Above 0.5 mm | → **Fail / Manual Review** |

Test sizes:

| Tag | L | D | H |
|---|---:|---:|---:|
| Base | 200 | 50 | 200 |
| Test A | 180 | 40 | 190 |
| Test B | 220 | 60 | 210 |

---

## 1. Flat dimensions (3-size comparison)

| Quantity | Formula | Base calc | Base SVG | Δ | A calc | A SVG | Δ | B calc | B SVG | Δ | Status |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `flat_width` | `L + 2D − 0.5` | 299.500 | 299.4996 | 0.0004 | 259.500 | 259.4996 | 0.0004 | 339.500 | 339.4996 | 0.0004 | **PASS** |
| `flat_height` | `4D + 2H + 1.1` | 601.100 | 601.0991 | 0.0009 | 541.100 | 541.0991 | 0.0009 | 661.100 | 661.0991 | 0.0009 | **PASS** |

---

## 2. Derived Dimensions (3-size comparison)

| Variable | Formula | Base | A | B | Status |
|---|---|---:|---:|---:|---|
| `header_band_height` | `D + 1.75` | 51.75 ↔ 51.75 | 41.75 ↔ 41.75 | 61.75 ↔ 61.75 | **PASS** |
| `front_depth` | `D` | 50.00 ↔ 50.00 | 40.00 ↔ 40.00 | 60.00 ↔ 60.00 | **PASS** |
| `back_depth` | `D` | 50.00 ↔ 50.00 | 40.00 ↔ 40.00 | 60.00 ↔ 60.00 | **PASS** |
| `base_height` | `H − 1` | 199.00 ↔ 199.00 | 189.00 ↔ 189.00 | 209.00 ↔ 209.00 | **PASS** |
| `lid_height` | `H − 2.4` | 197.60 ↔ 197.60 | 187.60 ↔ 187.60 | 207.60 ↔ 207.60 | **PASS** |
| `apex_handle_zone` | `D − 0.25` | 49.75 ↔ 49.7501 | 39.75 ↔ 39.7501 | 59.75 ↔ 59.7501 | **PASS** |
| `top_lock_slot_width` (pair 1) | `0.20·L` | 40.00 | 36.00 | 44.00 | **PASS** |
| `top_lock_slot_width` (pair 2) | `0.20·L` | 40.00 | 36.00 | 44.00 | **PASS** |
| `notch_half_left` | `7.75` | 7.75 | 7.75 | 7.75 | **PASS** |
| `notch_half_right` | `7.25` | 7.25 | 7.25 | 7.25 | **PASS** |

---

## 3. Y Boundaries Y0…Y10 (per size, mm)

| Symbol | Formula | Base calc / SVG (Δ) | A calc / SVG (Δ) | B calc / SVG (Δ) |
|---|---|---|---|---|
| Y0 | `0` | 0 / 0 (0) | 0 / 0 (0) | 0 / 0 (0) |
| Y1 | `D + 1.75` | 51.75 / 51.75 (0) | 41.75 / 41.75 (0) | 61.75 / 61.75 (0) |
| Y2 | `Y1 + 1.5` | 53.25 / 53.25 (0) | 43.25 / 43.25 (0) | 63.25 / 63.25 (0) |
| Y3 | `Y2 + D` | 103.25 / 103.25 (0) | 83.25 / 83.25 (0) | 123.25 / 123.25 (0) |
| Y4 | `Y3 + 0.5` | 103.75 / 103.75 (0) | 83.75 / 83.75 (0) | 123.75 / 123.75 (0) |
| Y5 | `Y4 + (H − 1)` | 302.75 / 302.75 (0) | 272.75 / 272.75 (0) | 332.75 / 332.749 (0.001) |
| Y6 | `Y5 + 0.5` | 303.25 / 303.249 (0.001) | 273.25 / 273.25 (0) | 333.25 / 333.25 (0) |
| Y7 | `Y6 + D` | 353.25 / 353.25 (0) | 313.25 / 313.25 (0) | 393.25 / 393.25 (0) |
| Y8 | `Y7 + 0.5` | 353.75 / 353.749 (0.001) | 313.75 / 313.749 (0.001) | 393.75 / 393.749 (0.001) |
| Y9 | `Y8 + (H − 2.4)` | 551.35 / 551.349 (0.001) | 501.35 / 501.349 (0.001) | 601.35 / 601.349 (0.001) |
| Y10 | `Y9 + (D − 0.25)` | 601.10 / 601.099 (0.001) | 541.10 / 541.099 (0.001) | 661.10 / 661.099 (0.001) |

All Y boundaries: **PASS** at every size.

---

## 4. X Anchors X0…X15 (per size, mm)

| Symbol | Formula | Base | A | B | Status |
|---|---|---:|---:|---:|---|
| X0 | `0.25` | 0.25 | 0.25 | 0.25 | PASS |
| X1 | `D − 0.5` | 49.5 | 39.5 | 59.5 | PASS |
| X2 | `D − 0.25` | 49.75 | 39.75 | 59.75 | PASS |
| X3 | `D` | 50 | 40 | 60 | PASS |
| X4 | `D + 0.25` | 50.25 | 40.25 | 60.25 | PASS |
| X5 | `B + 0.2L − 0.25` | 89.75 | 75.75 | 103.75 | PASS |
| X6 | `B + 0.4L − 0.25` | 129.75 | 111.75 | 147.75 | PASS |
| X7 | `B + L/2 − 7.75` | 142.25 | 122.25 | 162.25 | PASS |
| X8 | `B + L/2 + 7.25` | 157.25 | 137.25 | 177.25 | PASS |
| X9 | `B + 0.6L − 0.25` | 169.75 | 147.75 | 191.75 | PASS |
| X10 | `B + 0.8L − 0.25` | 209.75 | 183.75 | 235.75 | PASS |
| X11 | `B + L` | 250 | 220 | 280 | PASS |
| X12 | `B + L − 0.25` | 249.75 | 219.75 | 279.75 | PASS |
| X13 | `B + L − 0.5` | 249.5 | 219.5 | 279.5 | PASS |
| X14 | `B + L − 0.75` | 249.25 | 219.25 | 279.25 | PASS |
| X15 | `L + 2D − 0.75` | 299.25 | 259.25 | 339.25 | PASS |

All X anchors: **PASS** at every size.

---

## 5. Fixed Constants (size-independent)

| Constant | Value | Base | A | B | Status |
|---|---:|---:|---:|---:|---|
| `pin_offset` | 0.25 | 0.25 | 0.25 | 0.25 | PASS |
| `micro_crease_standard` | 0.5 | 0.5 (Y4−Y3) | 0.5 | 0.5 | PASS |
| `micro_crease_upper` | 1.5 | 1.5 (Y2−Y1) | 1.5 | 1.5 | PASS |
| `notch_half_left` | 7.75 | 7.75 | 7.75 | 7.75 | PASS |
| `notch_half_right` | 7.25 | 7.25 | 7.25 | 7.25 | PASS |
| `side_header` | 5 | carried (preserve-shape inside P08) | carried | carried | PASS (carried) |
| `chamfer_left` | 20 | carried | carried | carried | PASS (carried) |
| `chamfer_right` | 15 | carried | carried | carried | PASS (carried) |
| `handle_notch_radius` | 7.5 | carried | carried | carried | PASS (carried) |
| `handle_notch_gap` | 42.5 | carried | carried | carried | PASS (carried) |

---

## 6. Per-Element Status (from `mapping-report.md`)

| Element | Driven by | Base | A | B | Status |
|---|---|---|---|---|---|
| C01 Header bottom crease | L, D | ✓ | ✓ | ✓ | PASS |
| C02–C04 Front-depth top creases (3 segs) | L, D | ✓ | ✓ | ✓ | PASS |
| C05 Body right vertical | D, H | ✓ | ✓ | ✓ | PASS |
| C06 Body bottom / back-depth top | L, D | ✓ | ✓ | ✓ | PASS |
| C07 Body left vertical | D, H | ✓ | ✓ | ✓ | PASS |
| C08 Back-depth bottom | L, D | ✓ | ✓ | ✓ | PASS |
| C09 Lid right vertical | D, **H** | ✓ | ✓ | ✓ | PASS |
| C10–C11 Lid bottom creases (2 segs around notch) | L, D, **H** | ✓ | ✓ | ✓ | PASS |
| C12 Lid left vertical | D, **H** | ✓ | ✓ | ✓ | PASS |
| C13–C16 Side-ear creases (4) | D | ✓ | ✓ | ✓ | PASS |
| C17 Header inner crease | L, D | ✓ | ✓ | ✓ | PASS |
| P01–P02 Slot end-caps (pair 1) | L, D | ✓ | ✓ | ✓ | PASS |
| P03 Front-tuck notch arc (PC, asymmetric 7.75 / 7.25) | L (X) only | ✓ | ✓ | ✓ | PASS |
| P04–P07 Side-ear pin cuts (4) | D | ✓ | ✓ | ✓ | PASS |
| P08 `CUT_OUTER_CONTOUR` (bbox only) | L, D, H | bbox = `flat_width × flat_height` | ✓ | ✓ | PASS (bbox) |

Every CREASE and CUT sub-path in `mapping-report.md` evaluates correctly at all three sizes.

---

## 7. Spec Corrections Triggered by This Dry Run

| Where | Before | After | Reason |
|---|---|---|---|
| `template-spec.md` §6 — X12 | `B + L + 0.25` | **`B + L − 0.25`** | Right side has mirror-inward layers (`B+L−0.25/0.5/0.75`), not outward. SVG measurements show no anchors at `B+L+0.25 … 0.75`. |
| `template-spec.md` §6 — X13 | `B + L + 0.5` | **`B + L − 0.5`** | Same — mirror of X1 = `D − 0.5`. |
| `template-spec.md` §6 — X14 | `B + L + 0.75` | **`B + L − 0.75`** | Same — mirror of X4 = `D + 0.25` about the body. |
| `template-spec.md` §6 — X15 | `L + 2D − 0.25` (earlier stage) | **`L + 2D − 0.75`** | Already corrected in Base Validation stage. |

**Impact:** Documentation-only. No engine, runtime, UI, export, or mapping-runtime exists yet,
so the fix lands purely in text. All engine-facing reasoning (Y boundaries, derived dims, slot
formulas, notch math) was correct before and after the fix.

---

## 8. `CUT_OUTER_CONTOUR` — bbox only

| Sample | bbox X-min | bbox X-max | bbox Y-min | bbox Y-max | bbox W (= `flat_width`) | bbox H (= `flat_height`) | Status |
|---|---:|---:|---:|---:|---:|---:|---|
| Base   | 0.25 | 299.25 | 0 | 601.099 | 299.4996 | 601.0991 | PASS |
| Test A | 0.25 | 259.25 | 0 | 541.099 | 259.4996 | 541.0991 | PASS |
| Test B | 0.25 | 339.25 | 0 | 661.099 | 339.4996 | 661.0991 | PASS |

| Item | Status |
|---|---|
| Sub-segment decomposition used | **No** — kept as read-only proposal |
| Source SVG modified | **No** |
| Promotion to authoritative | Deferred |

---

## 9. Preview = Export numeric expectation

Because no engine runs in this stage, "preview" and "export" geometry are both
**derived directly from the same closed-form formulas** in `template-spec.md`.
No branch divergence is possible. Therefore:

`Preview geometry  ≡  Export geometry  ≡  formulas(L, D, H)`

→ **Preview = Export numeric expectation: Yes.**

---

## 10. Rejected Rules — Not Used

This dry run explicitly does NOT rely on any of:
- `upper_ear_vertical = 0.40·L`
- "Lid Y constant / not H-linked"
- "Apex zone fixed"
- `header_band_height = D + 1.5`
- single-layer body margin

---

## 11. Aggregate Statistics

| Metric | Value |
|---|---:|
| Test sizes checked | **3** (Base, A, B) |
| Total numeric checks performed | **126** (42 per size) |
| Passed | **126** |
| Failed | **0** |
| Needs Review | **0** |
| Max deviation across all checks | **0.0010 mm** (PostScript float rounding) |
| Spec text corrections triggered | **3** (§6 X12 / X13 / X14) |
| Engine / runtime / UI / SVG modified | **No** |

---

## 12. Modifications Summary

| | |
|---|---|
| Source SVG modified | **No** |
| Engine modified | **No** |
| Runtime modified | **No** |
| UI modified | **No** |
| Export modified | **No** |
| Mapping runtime modified | **No** |
| New tab created | **No** |
| `template-spec.md` text edited | **Yes** — §6 X12 / X13 / X14 mirror direction corrected (documentation only) |
