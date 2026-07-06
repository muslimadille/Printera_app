# Raw SVG Measurements — Lid Tuck Box v1 (3-sample adjudicated)

Read-only. No SVG / engine / runtime / UI modified.

Conversion: `1 mm = 2.83465 px` (72 dpi).

## Samples

| Tag | L | D | H | Flat width (mm) | Flat height (mm) |
|---|---:|---:|---:|---:|---:|
| Base | 200 | 50 | 200 | 299.500 | 601.099 |
| Sample A | 180 | 40 | 190 | 259.500 | 541.099 |
| Sample B | 220 | 60 | 210 | 339.500 | 661.099 |

## Y-intervals (top → bottom)

| Δ | Role | Base | A | B | Formula |
|---:|---|---:|---:|---:|---|
| 1 | Header band (top zone) | 51.75 | 41.75 | 61.75 | `D + 1.75` |
| 2 | Micro-crease upper | 1.50 | 1.50 | 1.50 | `1.5` fixed |
| 3 | Front depth | 50.00 | 40.00 | 60.00 | `D` |
| 4 | Micro-crease | 0.50 | 0.50 | 0.50 | `0.5` fixed |
| 5 | Base body | 199.00 | 189.00 | 209.00 | `H − 1` |
| 6 | Micro-crease | 0.50 | 0.50 | 0.50 | `0.5` fixed |
| 7 | Back depth | 50.00 | 40.00 | 60.00 | `D` |
| 8 | Micro-crease | 0.50 | 0.50 | 0.50 | `0.5` fixed |
| 9 | Lid Y span | 197.60 | 187.60 | 207.60 | `H − 2.4` |
| 10 | Apex / handle zone | 49.75 | 39.75 | 59.75 | `D − 0.25` |

Closure: `flat_height ≈ 4D + 2H + 1.1` (matches 601.1 / 541.1 / 661.1).

## X-intervals

Width regression: `flat_width = L + 2D − 0.5` (exact on all three samples).

Four observed side-edge X-layers per side:
- `0.25` (pin)
- `D − 0.5`
- `D − 0.25`  ← body crease / outer edge of side ear
- `D` (body inner edge)
- `D + 0.25` (upper strip)

Slot/tuck anchors inside the body (X relative to body left = D):
`0.2·L − 0.25`, `0.4·L − 0.25`, `L/2 − 7.75`, `L/2 + 7.25`, `0.6·L − 0.25`, `0.8·L − 0.25`.
Validated to ±0.0 mm at L ∈ {180, 200, 220}.

## Cross-sample regression summary

| Quantity | Formula | Confidence |
|---|---|---|
| Side margin (crease) M | `D − 0.25` | **High (3/3)** |
| Header band top zone | `D + 1.75` | **High (3/3)** |
| Front/back depth | `D` | **High (3/3)** |
| Base body Y | `H − 1` | **High (3/3)** |
| Lid Y span | `H − 2.4` | **High (3/3)** ⚠ Lid IS H-driven |
| Apex / handle zone Y | `D − 0.25` | **High (3/3)** |
| Slot width | `0.20·L` | **High (3/3)** |
| `0.40·L upper ear` | — | **Rejected (0/3)** |

## Notes / Resolved Conflicts

- Prior `D − 0.5` for body margin was the **pin** layer; the **crease** layer is `D − 0.25`.
  Both exist physically — they were collapsed in the earlier audit.
- Prior `D + 1.5` header band was off by 0.25 (label rounding). Raw says `D + 1.75`.
- Prior "lid not H-driven" is **rejected**. Lid scales `H − 2.4` across all three samples.
- Prior `0.40·L upper ear` is **rejected** — no matching Y or X span exists in any sample.
- Apex/handle zone is **not fixed** — it scales as `D − 0.25`.
