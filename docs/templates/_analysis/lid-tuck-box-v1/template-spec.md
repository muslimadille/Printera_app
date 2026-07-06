# Template Specification — `lid-tuck-box-v1`

> **Status:** Documentation only. Promoted from `suggested-spec.md` after
> three-sample adjudication.
> **Source of truth:** `final-variable-adjudication-report.md` (verified against
> raw SVG geometry from Base 200×200×50, Sample A 180×190×40, Sample B 220×210×60).
> Where this spec disagrees with reference images, **this spec wins**.
>
> No SVG / Engine / Runtime / UI / Export / Mapping / Tab is modified by this document.

---

## 1. Template Name

`lid-tuck-box-v1`

## 2. Base Dimensions

| L (mm) | D (mm) | H (mm) | Flat width (mm) | Flat height (mm) |
|---:|---:|---:|---:|---:|
| 200 | 50 | 200 | 299.500 | 601.099 |

## 3. Inputs

| Input | Symbol | Default | Notes |
|---|---|---:|---|
| Length | `L` | 200 mm | Drives body span and slot/notch X positions. |
| Depth | `D` | 50 mm | Drives every side-edge X-layer and the depth / header / apex Y bands. |
| Height | `H` | 200 mm | Drives base body Y AND lid Y. |

## 4. Provisional Input Ranges (test-only)

```text
L ∈ [180, 220] mm
D ∈ [40,  60] mm
H ∈ [190, 210] mm
```

Production ranges TBD after engine validation.

## 5. Derived Dimensions (Confirmed on 3 samples)

```text
flat_width               = L + 2D − 0.5
flat_height              = 4D + 2H + 1.1
header_band_height       = D + 1.75
front_depth              = D
back_depth               = D
base_height              = H − 1
lid_height               = H − 2.4
apex_handle_zone         = D − 0.25
lid_front_tuck_strip     = D − 0.5
side_ear_width           = D − 0.25
body_margin_crease       = D − 0.25       // outer crease layer per side
body_margin_pin_layer    = D − 0.5        // inner pin layer per side
upper_strip_offset       = D + 0.25
top_lock_slot_width      = 0.20 · L
slot_anchors_x_rel       = {0.2, 0.4, 0.6, 0.8} · L − 0.25   // relative to body_left = D
notch_center_x           = D + L / 2
notch_half_left          = 7.75
notch_half_right          = 7.25
```

## 6. X Boundaries (absolute, mm)

Let `B = D` (body left edge).

| Symbol | Formula | Role |
|---|---|---|
| X0 | `0.25` | Left pin |
| X1 | `D − 0.5` | Inner pin layer |
| X2 | `D − 0.25` | Body crease (side margin) |
| X3 | `B = D` | Body left edge |
| X4 | `D + 0.25` | Upper-strip offset |
| X5 | `B + 0.2L − 0.25` | Slot 1 start |
| X6 | `B + 0.4L − 0.25` | Slot 2 start / Slot 1 end |
| X7 | `B + L/2 − 7.75` | Notch left |
| X8 | `B + L/2 + 7.25` | Notch right |
| X9 | `B + 0.6L − 0.25` | Slot 3 start |
| X10 | `B + 0.8L − 0.25` | Slot 4 end |
| X11 | `B + L` | Body right edge |
| X12 | `B + L − 0.25` | Body right crease (mirror of X2) |
| X13 | `B + L − 0.5` | Body right pin layer (mirror of X1) |
| X14 | `B + L − 0.75` | Lid right crease (mirror of X4 about body) |
| X15 | `L + 2D − 0.75` (= `flat_width − 0.25`) | Right outer pin |

## 7. Y Boundaries (absolute, top → bottom, mm)

| Symbol | Formula | Δ (zone) | Driver |
|---|---|---|---|
| Y0  | `0`                       | —              | — |
| Y1  | `Y0 + (D + 1.75)`         | header band    | D |
| Y2  | `Y1 + 1.5`                | micro-crease   | fixed |
| Y3  | `Y2 + D`                  | front depth    | D |
| Y4  | `Y3 + 0.5`                | micro-crease   | fixed |
| Y5  | `Y4 + (H − 1)`            | base body      | **H** |
| Y6  | `Y5 + 0.5`                | micro-crease   | fixed |
| Y7  | `Y6 + D`                  | back depth     | D |
| Y8  | `Y7 + 0.5`                | micro-crease   | fixed |
| Y9  | `Y8 + (H − 2.4)`          | **lid**        | **H** |
| Y10 | `Y9 + (D − 0.25)`         | apex / handle  | D |

Total: `flat_height = 4D + 2H + 1.1` (matches 601.1 / 541.1 / 661.1 on the three samples).

## 8. Axis Rules

- **X:** `L` drives body, slots (0.2/0.4/0.6/0.8 anchors), notch center. `D` drives every side-edge X-layer.
- **Y — base body:** `H` only (`H − 1`).
- **Y — lid:** `H` only (`H − 2.4`).
- **Y — depth strips, header band, side ears, apex zone, lid tuck strip:** `D` only.
- **Y — micro-creases:** fixed (`0.5` and `1.5`).

## 9. Zone Behavior

| Zone | Behavior | Drivers |
|---|---|---|
| Body base | Stretch X + Stretch Y | L, H |
| Front depth | Stretch X + Stretch Y | L, D |
| Back depth | Stretch X + Stretch Y | L, D |
| Header band | Stretch X + Stretch Y (`D + 1.75`) | L, D |
| Side ears (4) | Stretch X (`D − 0.25` layer) + Stretch Y (`D`) + Translate Y (`H`) | D, H |
| **Lid rectangle** | **Stretch X + Stretch Y (`H − 2.4`)** | **L, H** |
| Lid front-tuck strip | Stretch X + Stretch Y (`D − 0.5`) | L, D |
| Apex / handle bottom band | Stretch X + Stretch Y (`D − 0.25`) | L, D |
| Top-lock slots (×4) | Translate X (anchors) + Scale X (`0.20·L`) | L |
| Front-tuck notch curve | Translate X only, preserve curve; asymmetric half-widths 7.75 / 7.25 | L |
| Handle bubble | Translate X only, preserve curve | L |
| Top mini lock tabs | Translate with slots, preserve shape | L |
| Lid bottom chamfers | Translate with lid corners, preserve angle | L |

## 10. Fixed Constants

| Constant | Value (mm) | Purpose |
|---|---:|---|
| `pin_offset` | 0.25 | Outer pin layer |
| `micro_crease_standard` | 0.5 | Between depth strips and body / lid |
| `micro_crease_upper` | 1.5 | Below header band |
| `side_header` | 5 | Side-flap header |
| `chamfer_left` | 20 | Lid bottom-left chamfer |
| `chamfer_right` | 15 | Lid bottom-right chamfer |
| `handle_notch_radius` | 7.5 | Handle bubble radius |
| `handle_notch_gap` | 42.5 | Handle gap |
| `notch_half_left` | 7.75 | Front-tuck notch (asymmetric) |
| `notch_half_right` | 7.25 | Front-tuck notch (asymmetric) |

## 11. Rejected Assumptions

The following rules from earlier drafts are **REJECTED** and **MUST NOT** be used in any
engine, mapping, export, or runtime built from this spec:

| Rejected Rule | Reason |
|---|---|
| `upper_ear_vertical = 0.40 · L` | No matching Y or X span exists at L ∈ {180, 200, 220}. The 0.4·L term only appears as a **slot anchor offset**, not as an ear height. |
| "Lid Y is constant `K` / not linked to H" | All three samples show `lid_Y = H − 2.4`. Lid IS H-driven. |
| "Apex / handle zone is a fixed constant" | All three samples show `apex_Y = D − 0.25`. Apex IS D-driven. |
| `header_band_height = D + 1.5` | Raw SVG says `D + 1.75` on all three samples (the 0.25 mm earlier delta was label rounding). |
| `body_left_margin = D − 0.5` (single layer) | Body has **5** X-layers per side; the body crease is `D − 0.25`, and `D − 0.5` is the **pin** layer beneath it. |

## 12. Preserve-Curve / Critical Geometry Notes

The following elements MUST preserve their original curvature/shape when L/D/H change.
They may be translated (X by `L`, Y by `D` / `H` per their zone) but never re-sampled,
fillet-replaced, or simplified:

- Front-tuck notch curve (inside the lid bottom edge).
- Handle bubble arcs (inside `CUT_OUTER_CONTOUR`).
- Top 4 mini lock tabs.
- Lid bottom chamfers (20 mm left / 15 mm right — angle preserved).
- Four side-flap edge cuts.

Asymmetry note: The front-tuck notch is **not symmetric** about `B + L/2` — the left half is `7.75 mm` and the right half is `7.25 mm`. This 0.5 mm asymmetry is intentional and confirmed in all three samples; engines must replicate it exactly.

## 13. CUT_OUTER_CONTOUR Segmentation Status

| Item | Status |
|---|---|
| Source SVG | **Unchanged.** `CUT_OUTER_CONTOUR` remains a single path in the source SVG. |
| Decomposition document | `derived-segmented-contour-proposal.md` exists as a **read-only Low-confidence proposal**. |
| Authoritative for execution | **No.** |
| Required before engine work | **No.** Engine work must treat `CUT_OUTER_CONTOUR` as a single path or use a separately-approved decomposition. |
| Promotion to authoritative | Requires explicit user approval in a later stage. |

## 14. Test Sizes (verified)

| Tag | L | D | H | Flat width | Flat height | Source file |
|---|---:|---:|---:|---:|---:|---|
| Base | 200 | 50 | 200 | 299.500 | 601.099 | `200×200×50mm.svg` |
| Sample A | 180 | 40 | 190 | 259.500 | 541.099 | `180×190×40mm.svg` |
| Sample B | 220 | 60 | 210 | 339.500 | 661.099 | `220×210×60_mm.svg` |

All derived dimensions in §5 match these three samples to within 0.0 mm where exact and
≤0.5 mm where micro-crease rounding applies.

## 15. SheetLayout Notes

Not yet defined. SheetLayout sizing (scenarios S1…Sn per TestCase) will be derived
later once a calibration workbook for `lid-tuck-box-v1` is authored. This spec only
fixes the parametric model.

## 16. Open Risks / Warnings

1. **`CUT_OUTER_CONTOUR` is monolithic** — any engine that needs to re-author the outer
   path must first promote `derived-segmented-contour-proposal.md` (currently Low
   confidence).
2. **`flat_height` closure constant `1.1`** comes from one extra `0.5` micro-crease
   inside the apex band that is visible in path data but not in the line list.
   Engines must reproduce this micro-crease or `flat_height` will be short by 0.5 mm.
3. **Notch asymmetry (7.75 / 7.25)** must not be "tidied" to a symmetric `±7.5`.
4. **Side margin has 5 layers, not 1.** Engines must not collapse them.
5. **Lid is H-driven** (`H − 2.4`). Any engine still treating the lid as a constant
   slab will produce wrong flat heights on every non-default `H`.
6. **Provisional input ranges** (L 180–220, D 40–60, H 190–210). Behavior outside
   these ranges has not been verified by raw SVG; treat as Low confidence until a
   wider sample set is provided.

## 17. Modifications Summary

| | |
|---|---|
| SVG modified | **No** |
| Engine modified | **No** |
| Runtime modified | **No** |
| UI modified | **No** |
| Export modified | **No** |
| Mapping modified | **No** |
| New tab added | **No** |
| Template registered in app | **No** |
| Reference files retained | `suggested-spec.md`, `final-variable-adjudication-report.md`, `variable-extraction-report.md`, `svg-measurements.md`, `derived-segmented-contour-proposal.md` |
