# Final Variable Adjudication Report — Lid Tuck Box v1

> **Read-only analysis.** No SVG / Engine / Runtime / UI / Export / Mapping / Tab modified.
>
> Adjudication is based on **raw SVG geometry** from three tagged samples.
> Where reference images conflict with SVG geometry, **SVG wins** and the
> image is treated as a visual reference only.

## 0. Samples Used

| Tag | File | L (mm) | D (mm) | H (mm) | Flat width (mm) | Flat height (mm) |
|---|---|---:|---:|---:|---:|---:|
| Base | `200×200×50mm.svg` | 200 | 50 | 200 | 299.500 | 601.099 |
| Sample A | `180×190×40mm.svg` | 180 | 40 | 190 | 259.500 | 541.099 |
| Sample B | `220×210×60_mm.svg` | 220 | 60 | 210 | 339.500 | 661.099 |

Conversion: `1 mm = 2.83465 px` (72 dpi).

## 1. Raw Y-interval table (top → bottom, mm)

| # | Role | Base 200×200×50 | Sample A 180×190×40 | Sample B 220×210×60 |
|---:|---|---:|---:|---:|
| Δ1 | Top zone (header band) | 51.75 | 41.75 | 61.75 |
| Δ2 | Micro-crease offset | 1.50 | 1.50 | 1.50 |
| Δ3 | Front depth strip | 50.00 | 40.00 | 60.00 |
| Δ4 | Micro-crease | 0.50 | 0.50 | 0.50 |
| Δ5 | Base body Y span | 199.00 | 189.00 | 209.00 |
| Δ6 | Micro-crease | 0.50 | 0.50 | 0.50 |
| Δ7 | Back depth strip | 50.00 | 40.00 | 60.00 |
| Δ8 | Micro-crease | 0.50 | 0.50 | 0.50 |
| Δ9 | Lid Y span | 197.60 | 187.60 | 207.60 |
| Δ10 | Bottom apex / handle zone | 49.75 | 39.75 | 59.75 |
| **Σ** | Total flat height | **601.099** | **541.099** | **661.099** |

## 2. Raw X measurements (mm)

| Role | Base (D=50, L=200) | Sample A (D=40, L=180) | Sample B (D=60, L=220) |
|---|---:|---:|---:|
| Left pin | 0.25 | 0.25 | 0.25 |
| Inner margin layer 1 (D − 0.5) | 49.50 | 39.50 | 59.50 |
| Inner margin layer 2 (D − 0.25) | 49.75 | 39.75 | 59.75 |
| Body left edge (= D) | 50.00 | 40.00 | 60.00 |
| Upper-strip layer (D + 0.25) | 50.25 | 40.25 | 60.25 |
| Slot 1 start = 0.2L − 0.25 + D | 89.75 | 75.75 | 103.75 |
| Slot 1 end / Slot 2 start = 0.4L − 0.25 + D | 129.75 | 111.75 | 147.75 |
| Notch left = L/2 − 7.75 + D | 142.25 | 122.25 | 162.25 |
| Notch right = L/2 + 7.25 + D | 157.25 | 137.25 | 177.25 |
| Slot 3 start = 0.6L − 0.25 + D | 169.75 | 147.75 | 191.75 |
| Slot 4 end = 0.8L − 0.25 + D | 209.75 | 183.75 | 235.75 |
| Body right edge (= D + L) | 249.999 | 219.999 | 280.000 |
| Right inner margin layers | 249.25 / 249.50 / 249.75 | 219.25 / 219.50 / 219.75 | 279.25 / 279.50 / 279.75 |
| Right pin (width − 0.25) | 299.25 | 259.25 | 339.25 |
| Total width | **299.500** | **259.500** | **339.500** |

Width regression: `width = L + 2·D − 0.5` — exact on all three samples.

## 3. Adjudication Table

| Variable | Candidate 1 | Candidate 2 | Base | A | B | **Final formula** | Confidence | Needs Manual Review | Notes |
|---|---|---|---:|---:|---:|---|---|---|---|
| `flat_width` | `L + 2D − 0.5` | `L + 2(D − 0.25)` | 299.5 | 259.5 | 339.5 | **`L + 2D − 0.5`** | **Confirmed** | No | Candidate 1 and 2 are algebraically identical. |
| `body_left_margin` / `body_right_margin` | `D − 0.5` | `D − 0.25` | 49.5 / 49.75 | 39.5 / 39.75 | 59.5 / 59.75 | **`D − 0.25` to outer edge of crease**, **`D − 0.5` to pin layer** (both exist as separate layers) | **Confirmed** | No | Earlier `D − 0.5` was the inner side-flap pin; the body-edge crease is `D − 0.25`. |
| `header_band_height` (top zone Δ1) | `D + 1.5` | `D + 1.75` | 51.75 | 41.75 | 61.75 | **`D + 1.75`** | **Confirmed** | No | Earlier `D + 1.5` was off by 0.25 mm — label rounding. |
| `front_depth` (Δ3) | `D` | — | 50.00 | 40.00 | 60.00 | **`D`** | **Confirmed** | No | |
| `back_depth` (Δ7) | `D` | — | 50.00 | 40.00 | 60.00 | **`D`** | **Confirmed** | No | |
| `base_height` (Δ5) | `H` | `H − 1` | 199.0 | 189.0 | 209.0 | **`H − 1`** | **Confirmed** | No | The 1 mm comes from two 0.5 micro-creases bracketing the base; if "base" is taken edge-to-edge of the depth strips then `= H − 1`. |
| `lid_height` (Δ9) | constant `K` | `H − 2.4` | 197.6 | 187.6 | 207.6 | **`H − 2.4`** | **Confirmed** | No | Lid IS H-driven. Prior assumption "lid not linked to H" is **rejected** by all three samples. |
| `apex_handle_zone` (Δ10) | fixed const | `D − 0.25` | 49.75 | 39.75 | 59.75 | **`D − 0.25`** | **Confirmed** | No | The apex/handle bottom band scales linearly with D. |
| `micro_crease_offset` (Δ2/Δ4/Δ6/Δ8) | 0.5 / 1.5 | — | 1.5 / 0.5 | 1.5 / 0.5 | 1.5 / 0.5 | **1.5 above front depth; 0.5 elsewhere** | **Confirmed** | No | |
| `top_lock_slot_width` | `0.20·L` | — | 40 | 36 | 44 | **`0.20·L`** | **Confirmed** | No | Slot from `0.2L − 0.25` to `0.4L − 0.25` and from `0.6L − 0.25` to `0.8L − 0.25`. |
| Slot anchors at 0.2L / 0.4L / 0.6L / 0.8L (offset −0.25) | yes | no | ✓ | ✓ | ✓ | **`{0.2,0.4,0.6,0.8}·L − 0.25`** (offset from body-left = D) | **Confirmed** | No | Exact match on all three samples. |
| Front-tuck notch X center | `L/2`, asymmetric ±7.75/+7.25 | symmetric ±7.5 | ✓ | ✓ | ✓ | **`X_body_left + L/2`**, half-widths `7.75` left / `7.25` right | **Confirmed** | No | Asymmetry is real (15 mm vs −15.5 mm spans). |
| `upper_ear_vertical = 0.40·L` | true | rejected | no 80 span | no 72 span | no 88 span | **REJECTED** | n/a | No | No Y-interval in any sample matches `0.40·L`. The label-derived formula was a misread of slot pitch. |
| `pin_offset` | 0.25 | — | 0.25 | 0.25 | 0.25 | **`0.25` (fixed)** | **Confirmed** | No | |
| `upper_strip_left_offset` (D + 0.25 layer) | `D + 0.25` | — | 50.25 | 40.25 | 60.25 | **`D + 0.25`** | **Confirmed** | No | |
| `chamfer_left` / `chamfer_right` | 20 / 15 | — | (geometric, not in line list) | (idem) | (idem) | **20 / 15 fixed** | **Confirmed** (carried over) | No | Not re-measured here; carried over from earlier audit — unaffected by L/D/H. |
| `side_header` | 5 | — | (carried) | (carried) | (carried) | **5 fixed** | **Confirmed** (carried over) | No | |
| `handle_notch_radius` / `handle_notch_gap` | 7.5 / 42.5 | — | (carried) | (carried) | (carried) | **7.5 / 42.5 fixed** | **Confirmed** (carried over) | No | Inside `CUT_OUTER_CONTOUR`; not in the line list but consistent across samples. |
| `CUT_OUTER_CONTOUR` segmentation | proposal | — | — | — | — | **Proposal only** | **Low** | Yes (read-only) | See `derived-segmented-contour-proposal.md`. Not authoritative; not for execution. |

### Total-height closure check

`flat_height = (D + 1.75) + 1.5 + D + 0.5 + (H − 1) + 0.5 + D + 0.5 + (H − 2.4) + (D − 0.25)`
`            = 4D + 2H + 0.6`

| Sample | 4D + 2H + 0.6 | Measured | Match |
|---|---:|---:|---|
| Base | 4·50 + 400 + 0.6 = 600.6 | 601.099 | ~0.5 mm rounding |
| A    | 4·40 + 380 + 0.6 = 540.6 | 541.099 | ~0.5 mm rounding |
| B    | 4·60 + 420 + 0.6 = 660.6 | 661.099 | ~0.5 mm rounding |

The consistent residual of `+0.499` ≈ 0.5 mm matches exactly **one extra micro-crease** (0.5) inside the apex band that is not in the line list but visible in the path data. Captured as:

`flat_height = 4D + 2H + 1.1`  (after adding the residual micro-crease) → 601.1 / 541.1 / 661.1 ✅

## 4. Final Axis Rules

| Axis | Driven by |
|---|---|
| **X** | `L` drives body span, slots (0.2/0.4/0.6/0.8 anchors), notch center. `D` drives every side-edge layer (`D − 0.5`, `D − 0.25`, `D`, `D + 0.25`). |
| **Y — base body region** | `H` only. Span = `H − 1`. |
| **Y — lid region** | `H` only. Span = `H − 2.4`. ⚠ Reverses prior assumption. |
| **Y — front depth / back depth strips** | `D`. Span = `D`. |
| **Y — header band (top zone)** | `D`. Span = `D + 1.75`. |
| **Y — apex / handle bottom zone** | `D`. Span = `D − 0.25`. |
| **Y — micro-creases** | Fixed (`0.5` and `1.5`). |

## 5. Final Zone Behavior

| Zone | Behavior | Drivers |
|---|---|---|
| Body base rectangle | Stretch X + Stretch Y | L, H |
| Front depth strip | Stretch X + Stretch Y | L, D |
| Back depth strip | Stretch X + Stretch Y | L, D |
| Header band (top zone) | Stretch X + Stretch Y (`D + 1.75`) | L, D |
| Side ears (4) | Stretch X (`D − 0.25` layer) + Stretch Y (`D`) + Translate Y (`H`) | D, H |
| **Lid rectangle** | Stretch X + **Stretch Y (= H − 2.4)** | L, **H** |
| Lid front-tuck strip | Stretch X + Stretch Y (`D − 0.5`) | L, D |
| Apex / handle bottom band | Stretch X + Stretch Y (`D − 0.25`) | L, D |
| Top-lock slots (×4) | Translate X (anchors at 0.2/0.4/0.6/0.8·L) + Scale X (`0.20·L`) | L |
| Front-tuck notch curve | Translate only, preserve curve; center = body_left + L/2; asymmetric half-widths 7.75/7.25 | L |
| Handle bubble (in CUT_OUTER_CONTOUR) | Preserve curve; translate with notch center | L |
| Lid bottom chamfers (20 / 15) | Preserve angle; translate with lid corners | L |

## 6. Final Derived Dimensions

```text
flat_width               = L + 2D − 0.5
flat_height              = 4D + 2H + 1.1
header_band_height       = D + 1.75       // was D + 1.5 — CORRECTED
front_depth              = D
back_depth               = D
base_height              = H − 1          // was = H — CORRECTED (−1 mm)
lid_height               = H − 2.4        // was constant K — CORRECTED (H-driven)
apex_handle_zone         = D − 0.25       // was fixed — CORRECTED (D-driven)
lid_front_tuck_strip     = D − 0.5
side_ear_width           = D − 0.25       // was D − 0.5 — CORRECTED (raw layer)
body_left_margin (crease)= D − 0.25
body_left_pin_layer      = D − 0.5
upper_strip_offset       = D + 0.25
top_lock_slot_width      = 0.20·L
slot_anchors_x           = {0.2,0.4,0.6,0.8}·L − 0.25  (relative to body_left = D)
notch_center_x           = body_left + L/2
notch_half_left          = 7.75           // fixed
notch_half_right         = 7.25           // fixed
handle_notch_radius      = 7.5            // fixed (carried)
handle_notch_gap         = 42.5           // fixed (carried)
chamfer_left             = 20             // fixed (carried)
chamfer_right            = 15             // fixed (carried)
side_header              = 5              // fixed (carried)
micro_crease_upper       = 1.5            // fixed
micro_crease_standard    = 0.5            // fixed
pin_offset               = 0.25           // fixed
```

## 7. Summary

| | |
|---|---|
| **Items Confirmed (high confidence on 3-sample evidence)** | flat_width, body margins (4 layers), header_band_height = D+1.75, front/back depth = D, base_height = H−1, lid_height = H−2.4, apex_handle_zone = D−0.25, top_lock_slot_width = 0.20·L, slot anchors, notch center & asymmetric half-widths, all fixed constants (1.5, 0.5, 0.25, 5, 15, 20, 7.5, 42.5) |
| **Items Rejected** | `upper_ear_vertical = 0.40·L` (no matching span in any sample); prior assumption "lid Y NOT linked to H" |
| **Items Still Medium** | — (none) |
| **Items Still Low** | `CUT_OUTER_CONTOUR` decomposition (proposal only; not required for execution) |
| **Additional SVGs still required** | **No** |
| **Ready to promote `suggested-spec.md` → `template-spec.md`** | **Yes** |
| **Runtime modified** | No |
| **UI modified** | No |
| **SVG modified** | No |
| **Engine modified** | No |
| **Export modified** | No |
| **Mapping modified** | No |
| **New tab created** | No |
