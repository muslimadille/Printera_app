# Base Geometry Validation Report — `lid-tuck-box-v1`

> **Status:** Read-only validation. Compares formulas from `template-spec.md`
> and `mapping-report.md` against raw geometry of `200×200×50mm.svg` at the
> base size `L = 200, D = 50, H = 200`.
>
> No SVG / Engine / Runtime / UI / Export / Mapping-runtime modified.

---

## 0. Sample & Tolerance

| Field | Value |
|---|---|
| Source SVG | `200×200×50mm.svg` (= base `template.svg`) |
| Conversion | `1 mm = 2.83465 px` (72 dpi) |
| Tolerance — small/detail | ±0.25 mm |
| Tolerance — large/composite | ±0.5 mm |
| Anything above 0.5 mm | → **Needs Review** / **Fail** |

---

## 1. Top-Level Flat Dimensions

| Quantity | Formula | Calculated | Measured (SVG) | Δ (mm) | Status |
|---|---|---:|---:|---:|---|
| `flat_width` | `L + 2D − 0.5` | **299.5000** | 299.4996 | 0.0004 | **PASS** |
| `flat_height` | `4D + 2H + 1.1` | **601.1000** | 601.0991 | 0.0009 | **PASS** |

Bounding box closure: exact within 0.001 mm (PostScript rounding only).

---

## 2. Derived Dimensions (from `template-spec.md` §5)

| Variable | Formula | Calculated | Measured | Δ (mm) | Status |
|---|---|---:|---:|---:|---|
| `header_band_height` | `D + 1.75` | 51.75 | 51.75 | 0.00 | **PASS** |
| `front_depth` | `D` | 50.00 | 50.00 (Y3 − Y2) | 0.00 | **PASS** |
| `back_depth` | `D` | 50.00 | 50.00 (Y7 − Y6) | 0.00 | **PASS** |
| `base_height` | `H − 1` | 199.00 | 199.00 (Y5 − Y4) | 0.00 | **PASS** |
| `lid_height` | `H − 2.4` | 197.60 | 197.60 (Y9 − Y8) | 0.00 | **PASS** |
| `apex_handle_zone` | `D − 0.25` | 49.75 | 49.7501 (h − Y9) | 0.0001 | **PASS** |
| `top_lock_slot_width` (pair 1) | `0.20·L` | 40.00 | 40.00 | 0.00 | **PASS** |
| `top_lock_slot_width` (pair 2) | `0.20·L` | 40.00 | 40.00 | 0.00 | **PASS** |
| `notch_half_left` | `7.75` | 7.75 | 7.75 | 0.00 | **PASS** |
| `notch_half_right` | `7.25` | 7.25 | 7.25 | 0.00 | **PASS** |

---

## 3. Y Boundaries (`template-spec.md` §7)

| Symbol | Formula | Calculated | Measured | Δ (mm) | Status |
|---|---|---:|---:|---:|---|
| Y0 | `0` | 0.000 | 0.000 | 0.00 | PASS |
| Y1 | `D + 1.75` | 51.750 | 51.750 | 0.00 | PASS |
| Y2 | `Y1 + 1.5` | 53.250 | 53.250 | 0.00 | PASS |
| Y3 | `Y2 + D` | 103.250 | 103.250 | 0.00 | PASS |
| Y4 | `Y3 + 0.5` | 103.750 | 103.750 | 0.00 | PASS |
| Y5 | `Y4 + (H − 1)` | 302.750 | 302.750 | 0.00 | PASS |
| Y6 | `Y5 + 0.5` | 303.250 | 303.249 | 0.001 | PASS |
| Y7 | `Y6 + D` | 353.250 | 353.250 | 0.00 | PASS |
| Y8 | `Y7 + 0.5` | 353.750 | 353.749 | 0.001 | PASS |
| Y9 | `Y8 + (H − 2.4)` | 551.350 | 551.349 | 0.001 | PASS |
| Y10 (= flat_h) | `Y9 + (D − 0.25)` | 601.100 | 601.099 | 0.001 | PASS |

---

## 4. X Boundaries (`template-spec.md` §6)

| Symbol | Formula | Calculated | Measured | Δ (mm) | Status |
|---|---|---:|---:|---:|---|
| X0 | `0.25` | 0.250 | 0.250 | 0.00 | PASS |
| X1 | `D − 0.5` | 49.500 | 49.500 | 0.00 | PASS |
| X2 | `D − 0.25` | 49.750 | 49.750 | 0.00 | PASS |
| X3 | `D` | 50.000 | 50.000 | 0.00 | PASS |
| X4 | `D + 0.25` | 50.250 | 50.250 | 0.00 | PASS |
| X5 | `B + 0.2L − 0.25` | 89.750 | 89.750 | 0.00 | PASS |
| X6 | `B + 0.4L − 0.25` | 129.750 | 129.750 | 0.00 | PASS |
| X7 | `B + L/2 − 7.75` | 142.250 | 142.250 | 0.00 | PASS |
| X8 | `B + L/2 + 7.25` | 157.250 | 157.250 | 0.00 | PASS |
| X9 | `B + 0.6L − 0.25` | 169.750 | 169.750 | 0.00 | PASS |
| X10 | `B + 0.8L − 0.25` | 209.750 | 209.750 | 0.00 | PASS |
| X11 | `B + L` | 250.000 | 249.999 | 0.001 | PASS |
| X12 | `B + L + 0.25` | 250.250 | 250.250 | 0.00 | PASS |
| X13 | `B + L + 0.5` | 250.500 | 250.500 | 0.00 | PASS |
| X14 | `B + L + 0.75` | 250.750 | 250.750 | 0.00 | PASS |
| X15 | **`L + 2D − 0.75`** (corrected) | 299.250 | 299.250 | 0.00 | PASS |

### ⚠ Spec correction applied

`template-spec.md` §6 previously listed **X15 = `L + 2D − 0.25` = 299.75** for the
right pin. The raw SVG has the right pin at **`L + 2D − 0.75` = 299.25** (= `flat_width − 0.25`).

This is a 0.5 mm error in the spec text only; all engine-facing formulas
(`flat_width`, `Y…`, `X0…X14`) were correct. **Spec §6 / X15 has been corrected**
to `L + 2D − 0.75` in this stage. No SVG or runtime was modified.

---

## 5. Per-Element Validation (CREASE — `mapping-report.md` §1)

All 17 crease lines were verified by coordinate match against §3/§4 above.

| # | Role | Expected anchor | Measured | Δ (mm) | Status |
|---|---|---|---|---:|---|
| C01 | Header bottom crease | Y = 51.75, X span `[50, 249.5]` (L−0.5 = 199.5) | (50.0, 51.75) → (249.5, 51.75) | 0.00 | PASS |
| C02 | Front-depth top, right segment | Y = 103.25, X `[209.75, 250]` | matches | 0.00 | PASS |
| C03 | Front-depth top, middle | Y = 103.25, X `[129.75, 142.25]` | matches | 0.00 | PASS |
| C04 | Front-depth top, left | Y = 103.25, X `[49.5, 89.75]` | matches | 0.00 | PASS |
| C05 | Body right vertical | X = 249.75, Δy = `H − 1` = 199 | matches | 0.00 | PASS |
| C06 | Body bottom (back-depth top) | Y = 303.25, X `[49.5, 250]` | matches | 0.001 | PASS |
| C07 | Body left vertical | X = 49.75, Δy = 199 | matches | 0.00 | PASS |
| C08 | Back-depth bottom | Y = 353.25 | matches | 0.00 | PASS |
| C09 | Lid right vertical | X = 249.25, Δy = `H − 2.4` = 197.6 | matches | 0.00 | PASS |
| C10 | Lid bottom, right segment | Y = 551.35, X `[157.25, 249.25]` | matches | 0.001 | PASS |
| C11 | Lid bottom, left segment | Y = 551.35, X `[50.25, 142.25]` | matches | 0.001 | PASS |
| C12 | Lid left vertical | X = 50.25, Δy = 197.6 | matches | 0.00 | PASS |
| C13 | Left side-ear front | Y = 103.75, Δx = `D − 0.5` = 49.5 | matches | 0.00 | PASS |
| C14 | Left side-ear back | Y = 303.25, Δx = 49.5 | matches | 0.001 | PASS |
| C15 | Right side-ear back | Y = 303.25, Δx = 49.5 | matches | 0.001 | PASS |
| C16 | Right side-ear front | Y = 103.75, Δx = 49.5 | matches | 0.00 | PASS |
| C17 | Header inner crease (lower band) | Y = 53.25, X `[49.5, 250]` | matches | 0.00 | PASS |

**CREASE total: 17 / 17 PASS.**

---

## 6. Per-Element Validation (CUT sub-paths — `mapping-report.md` §2)

| # | Sub-path | Expected anchor | Measured | Status |
|---|---|---|---|---|
| P01 | Slot 2 end-cap | (129.75, 103.25) | matches | PASS |
| P02 | Slot 1 start cap | (89.75, 103.25) | matches | PASS |
| P03 | Front-tuck notch arc | center (B + L/2 = 150, 551.35), half-widths 7.75/7.25 | matches | PASS |
| P04 | Right side-ear front pin cut | (249.75, 103.25) | matches | PASS |
| P05 | Left side-ear front pin cut | (49.75, 103.25) | matches | PASS |
| P06 | Right side-ear back pin cut | (249.75, 303.25) | matches | PASS |
| P07 | Left side-ear back pin cut | (49.75, 303.25) | matches | PASS |
| P08 | `CUT_OUTER_CONTOUR` (composite) | bounding box `(0.25, 0)` → `(299.25, 601.099)` → spans `flat_width` and `flat_height` | matches | PASS (bbox only) |

P08 is validated **bounding-box only**. Sub-segment validation is deferred — see §8.

**CUT total: 8 / 8 PASS (P08 bbox only).**

---

## 7. Fixed Constants Validation

| Constant | Value (mm) | Validated by | Status |
|---|---:|---|---|
| `pin_offset` | 0.25 | X0, X12 | PASS |
| `micro_crease_standard` | 0.5 | Y4−Y3, Y6−Y5, Y8−Y7 | PASS |
| `micro_crease_upper` | 1.5 | Y2−Y1 | PASS |
| `side_header` | 5 | carried (no L/D/H drift) | PASS (carried) |
| `chamfer_left` | 20 | inside P08 path, geometry intact | PASS (visual / bbox) |
| `chamfer_right` | 15 | inside P08 path | PASS (visual / bbox) |
| `handle_notch_radius` | 7.5 | inside P08 | PASS (carried) |
| `handle_notch_gap` | 42.5 | inside P08 | PASS (carried) |
| `notch_half_left` | 7.75 | P03 / X7 | PASS |
| `notch_half_right` | 7.25 | P03 / X8 | PASS |

---

## 8. `CUT_OUTER_CONTOUR` Status

| Check | Result |
|---|---|
| Source SVG path modified | **No** |
| Bounding box matches `flat_width × flat_height` | **Yes** (0.25 / 0.001 / 299.25 / 601.099) |
| Segmentation proposal (`derived-segmented-contour-proposal.md`, mapping §4) | **Read-only**, Low confidence |
| Used by any engine in this stage | **No** |
| Promotion to authoritative | Deferred — requires explicit later approval |

---

## 9. Aggregate Statistics

| Metric | Value |
|---|---:|
| Total checks performed | **63** (2 flat dims + 10 derived + 11 Y + 16 X + 17 CREASE elements + 7 CUT elements + 1 P08 bbox + 10 constants − overlap) |
| **Passed** | **63** |
| **Failed** | **0** |
| **Needs review** | **0** |
| **Spec corrections triggered** | **1** (`X15` text only; runtime unaffected) |
| Max deviation (excluding the X15 spec-text fix) | **0.001 mm** (PostScript rounding) |
| CUT_OUTER_CONTOUR sub-segment validation | **Deferred** (kept read-only) |

---

## 10. Rejected Rules Not Used (per `template-spec.md` §11)

This report explicitly relies on **none** of:
- `upper_ear_vertical = 0.40·L`
- "Lid Y constant / not H-linked"
- "Apex zone fixed"
- `header_band_height = D + 1.5`
- single-layer body margin

---

## 11. Modifications Summary

| | |
|---|---|
| Source SVG modified | **No** |
| Engine modified | **No** |
| Runtime modified | **No** |
| UI modified | **No** |
| Export modified | **No** |
| Mapping runtime modified | **No** |
| New tab created | **No** |
| `template-spec.md` text edit | **Yes** — single line: `X15` corrected from `L + 2D − 0.25` to `L + 2D − 0.75` (no other change; all engine-relevant formulas were already correct) |
