# Variable Extraction Report — Lid Tuck Box v1 (FINAL, 3-sample adjudication)

> **Read-only.** No SVG / Engine / Runtime / UI / Export / Mapping was modified.
>
> Adjudicated against three tagged SVGs:
> Base (200×200×50), Sample A (180×190×40), Sample B (220×210×60).
>
> Full evidence: `final-variable-adjudication-report.md`, `svg-measurements.md`.

## 1. File Suitability

All three SVGs are valid, well-tagged, and use consistent units (1 mm = 2.83465 px).
Element naming and three-corner sampling are sufficient to lock the entire variable
model except for `CUT_OUTER_CONTOUR` decomposition (kept as a read-only proposal).

## 2. Items Confirmed (3/3 samples)

| Item | Final Formula |
|---|---|
| `flat_width` | `L + 2D − 0.5` |
| `flat_height` | `4D + 2H + 1.1` |
| `header_band_height` | `D + 1.75` |
| `front_depth` / `back_depth` | `D` |
| `base_height` | `H − 1` |
| **`lid_height`** | **`H − 2.4`** (H-driven) |
| `apex_handle_zone` | `D − 0.25` |
| Side-edge X-layers | `0.25`, `D − 0.5`, `D − 0.25`, `D`, `D + 0.25` |
| `top_lock_slot_width` | `0.20·L` |
| Slot anchors | `{0.2, 0.4, 0.6, 0.8}·L − 0.25` (relative to body_left = D) |
| Front-tuck notch | center `B + L/2`, half-widths `7.75 / 7.25` (asymmetric) |
| Fixed constants | `1.5`, `0.5`, `0.25`, `5`, `15`, `20`, `7.5`, `42.5` |

## 3. Items Rejected

| Item | Reason |
|---|---|
| `upper_ear_vertical = 0.40·L` | No matching Y or X span at any of L ∈ {180, 200, 220}. |
| "Lid Y is constant `K`, not H-linked" | All three samples show `lid_Y = H − 2.4`. |
| "Apex/handle zone is fixed" | All three samples show `apex = D − 0.25`. |

## 4. Items Still Medium

None — adjudication closed all prior Medium entries.

## 5. Items Still Low

| Item | Reason |
|---|---|
| `CUT_OUTER_CONTOUR` decomposition | Kept as a read-only proposal (`derived-segmented-contour-proposal.md`). Not authoritative; not required for execution. |
| Final production-grade input ranges | Provisional ranges accepted (L 180–220, D 40–60, H 190–210). Final ranges TBD after engine validation. |

## 6. Final Axis Rules

| Axis | Driver |
|---|---|
| **X** | `L` (body, slots, notch); `D` (every side-edge layer) |
| **Y — base body** | `H` (`H − 1`) |
| **Y — lid** | `H` (`H − 2.4`) |
| **Y — depth strips / header / side ears / apex / lid-tuck strip** | `D` |
| **Y — micro-creases** | fixed (`0.5`, `1.5`) |

## 7. Final Zone Behavior

See `final-variable-adjudication-report.md` §5 — table reproduced verbatim there.

Key correction vs. earlier draft:

| Zone | Old | New |
|---|---|---|
| Lid rectangle | Stretch X + constant Y | **Stretch X + Stretch Y (`H − 2.4`)** |
| Apex/handle zone | fixed const | **Stretch Y (`D − 0.25`)** |
| Header band | `D + 1.5` | **`D + 1.75`** |
| Body margin | `D − 0.5` (single layer) | **5 layers** (`0.25`, `D − 0.5`, `D − 0.25`, `D`, `D + 0.25`) |

## 8. Status

| | |
|---|---|
| Additional SVGs still required | **No** |
| Ready to promote `suggested-spec.md` → `template-spec.md` | **Yes** |
| Runtime modified | No |
| UI modified | No |
| SVG modified | No |
| Engine modified | No |
| Export modified | No |
| Mapping modified | No |
| New tab created | No |
| Template registered in system | No |
