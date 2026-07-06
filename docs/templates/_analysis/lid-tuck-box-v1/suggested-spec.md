# Suggested Spec — Lid Tuck Box v1 (FINAL, adjudicated on 3 samples)

> **Read-only.** No code / SVG / engine / runtime / UI changed.
>
> All formulas in this document are **confirmed on three tagged SVGs**
> (200×200×50, 180×190×40, 220×210×60). See
> `final-variable-adjudication-report.md` and `svg-measurements.md`.
>
> ✅ Ready to be promoted to `template-spec.md`.

## 1. Dimension Inputs

| Input | Symbol | Default | Provisional Range | Notes |
|---|---|---|---|---|
| Length | L | 200 mm | 180 – 220 mm | Drives body width and all slot/notch X positions. |
| Depth | D | 50 mm | 40 – 60 mm | Drives all side-edge X-layers and depth/header/apex Y bands. |
| Height | H | 200 mm | 190 – 210 mm | Drives base body Y AND lid Y. |

Final production ranges TBD after engine validation.

## 2. Final Derived Dimensions

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
body_margin_crease       = D − 0.25      // outer edge of body crease per side
body_margin_pin_layer    = D − 0.5       // inner pin layer per side
upper_strip_offset       = D + 0.25
top_lock_slot_width      = 0.20·L
slot_anchors_x_rel       = {0.2, 0.4, 0.6, 0.8}·L − 0.25   // relative to body_left = D
notch_center_x           = D + L/2
notch_half_left          = 7.75
notch_half_right         = 7.25
handle_notch_radius      = 7.5
handle_notch_gap         = 42.5
chamfer_left             = 20
chamfer_right            = 15
side_header              = 5
micro_crease_upper       = 1.5
micro_crease_standard    = 0.5
pin_offset               = 0.25
```

## 3. X Boundaries (mm, absolute)

Let `B = D` (body left edge).

| Symbol | Formula |
|---|---|
| X0 | `0.25` |
| X1 | `D − 0.5` |
| X2 | `D − 0.25` |
| X3 | `B = D` (body left) |
| X4 | `D + 0.25` |
| X5 | `B + 0.2L − 0.25` |
| X6 | `B + 0.4L − 0.25` |
| X7 | `B + L/2 − 7.75` |
| X8 | `B + L/2 + 7.25` |
| X9 | `B + 0.6L − 0.25` |
| X10 | `B + 0.8L − 0.25` |
| X11 | `B + L` (body right) |
| X12 | `B + L + 0.25` |
| X13 | `B + L + 0.5` |
| X14 | `B + L + 0.75` |
| X15 | `L + 2D − 0.25` (right pin) |

## 4. Y Boundaries (mm, absolute, top → bottom)

| Symbol | Formula | Δ from previous |
|---|---|---|
| Y0 | `0` | — |
| Y1 | `D + 1.75` | `D + 1.75` (header band) |
| Y2 | `Y1 + 1.5` | `1.5` micro |
| Y3 | `Y2 + D` | `D` (front depth) |
| Y4 | `Y3 + 0.5` | `0.5` micro |
| Y5 | `Y4 + (H − 1)` | `H − 1` (base body) |
| Y6 | `Y5 + 0.5` | `0.5` micro |
| Y7 | `Y6 + D` | `D` (back depth) |
| Y8 | `Y7 + 0.5` | `0.5` micro |
| Y9 | `Y8 + (H − 2.4)` | `H − 2.4` (lid) |
| Y10 | `Y9 + (D − 0.25)` | `D − 0.25` (apex / handle zone) |

## 5. Axis Rules

- **X axis:** `L` drives body span, slots (0.2/0.4/0.6/0.8 anchors) and notch center. `D` drives every side-edge layer.
- **Y axis — base body:** `H` (span `H − 1`).
- **Y axis — lid:** `H` (span `H − 2.4`).  ⚠ Lid IS H-driven.
- **Y axis — depth strips, header band, side ears, apex zone, lid tuck strip:** `D`.
- **Y axis — micro-creases:** fixed (`0.5` / `1.5`).

## 6. Zone Behavior

| Zone | Behavior | Drivers |
|---|---|---|
| Body base | Stretch X + Stretch Y | L, H |
| Front depth | Stretch X + Stretch Y | L, D |
| Back depth | Stretch X + Stretch Y | L, D |
| Header band | Stretch X + Stretch Y | L, D |
| Side ears | Stretch X + Stretch Y + Translate Y | D, H |
| **Lid rectangle** | **Stretch X + Stretch Y (`H − 2.4`)** | **L, H** |
| Lid front-tuck strip | Stretch X + Stretch Y | L, D |
| Apex / handle zone | Stretch X + Stretch Y (`D − 0.25`) | L, D |
| Top-lock slots | Translate X + Scale X (`0.20·L`) | L |
| Front-tuck notch curve | Translate X only, preserve curve | L |
| Handle bubble | Translate X only, preserve curve | L |
| Top mini lock tabs | Translate with slots, preserve shape | L |
| Lid bottom chamfers | Translate with lid corners, preserve angle | L |

## 7. Fixed / Preserve-Curve Elements

- Top 4 mini lock tabs.
- Front-tuck notch curve.
- Handle bubble (inside `CUT_OUTER_CONTOUR`).
- Lid bottom chamfers (20 / 15).
- Four side-flap edge cuts.

## 8. Needs Manual Review

- Authoritative segmentation of `CUT_OUTER_CONTOUR` (proposal only — see
  `derived-segmented-contour-proposal.md`). Not required for execution.

## 9. Provisional Input Ranges

```text
L ∈ [180, 220] mm
D ∈ [40, 60] mm
H ∈ [190, 210] mm
```

## 10. Modifications Summary

| | |
|---|---|
| SVG modified | **No** |
| Engine modified | **No** |
| Runtime modified | **No** |
| UI modified | **No** |
| Export modified | **No** |
| Mapping modified | **No** |
| New tab added | **No** |
| Additional SVGs still required | **No** |
| Ready to promote to `template-spec.md` | **Yes** |
