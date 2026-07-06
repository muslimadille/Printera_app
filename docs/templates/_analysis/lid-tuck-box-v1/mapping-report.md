# Mapping Report — `lid-tuck-box-v1`

> **Status:** Documentation only. Maps every SVG element to a rule from
> `template-spec.md`.
> **Source of rules:** `docs/templates/_analysis/lid-tuck-box-v1/template-spec.md`.
> **Geometric evidence:** raw SVG from `200×200×50mm.svg`, `180×190×40mm.svg`,
> `220×210×60_mm.svg` (1 mm = 2.83465 px).
>
> No SVG / Engine / Runtime / UI / Export / Mapping-runtime modified.

---

## 0. SVG Element Inventory

The current source SVG (`template.svg` and its three tagged sizes) contains:

| Layer | Elements | Note |
|---|---:|---|
| `CREASE` | 17 `<line>` elements | Anonymous (no `id`); identified here by coordinate role. |
| `CUT` | 1 compound `<path>` | Holds outer contour, slot end-caps, side-ear edges, notch arc, handle bubble. Monolithic. |

Coordinate anchors used below (with `B = D`):
- X: `0.25`, `D − 0.5`, `D − 0.25`, `D`, `D + 0.25`, `B + 0.2L − 0.25`, `B + 0.4L − 0.25`, `B + L/2 − 7.75`, `B + L/2 + 7.25`, `B + 0.6L − 0.25`, `B + 0.8L − 0.25`, `B + L`, `B + L + 0.25`, `B + L + 0.5`, `L + 2D − 0.25`.
- Y: `0`, `D + 1.75`, `D + 3.25`, `2D + 3.25`, `2D + 3.75`, `2D + H + 2.75`, `2D + H + 3.25`, `3D + H + 3.25`, `3D + H + 3.75`, `3D + 2H + 1.35`, `4D + 2H + 1.1`.

---

## 1. CREASE Layer — Per-Line Mapping

Codes: **F**=Fixed, **TO**=Translate Only, **SX**=Stretch X, **SY**=Stretch Y, **PC**=Preserve Curve, **CR**=Crease, **CT**=Cut, **SL**=Slot/Lock, **MR**=Manual Review.

| # | Endpoints (Sample A) | Role | Zone | Axis Behavior | Affected by L | Affected by D | Affected by H | Formula / Boundary | Resize Behavior | PC | TO | SX | SY | Confidence | Notes |
|---|---|---|---|---|:--:|:--:|:--:|---|---|:--:|:--:|:--:|:--:|---|---|
| C01 | `(B, Y1) → (B+L−0.5, Y1)` | Header bottom crease | Header band | SX | ✓ | ✓ (Y from D) | — | Y = `D + 1.75`, X span = `L − 0.5` | **SX**; CR | No | No | Yes | No | High | Spans body inside the side margins. |
| C02 | `(B+L, Y3) → (B+0.8L−0.25, Y3)` | Front-depth top crease, right segment | Front depth top | SX (positional) | ✓ | ✓ | — | Y = `2D + 3.25`, X = `[0.8L−0.25, L] + B` | **SX**; CR | No | No | Yes | No | High | Right of slot pair 2. |
| C03 | `(B+L/2+7.25, Y3) → (B+0.4L−0.25, Y3)` | Front-depth top crease, middle segment | Front depth top | SX (positional) | ✓ | ✓ | — | Y = `2D + 3.25`, X = `[0.4L−0.25, L/2+7.25] + B` | **SX**; CR | No | No | Yes | No | High | Between slot pair 1 and notch right. |
| C04 | `(B+0.2L−0.25, Y3) → (D−0.5, Y3)` | Front-depth top crease, left segment | Front depth top | SX (positional) | ✓ | ✓ | — | Y = `2D + 3.25`, X = `[D−0.5, B + 0.2L − 0.25]` | **SX**; CR | No | No | Yes | No | High | Left of slot pair 1, extends to pin layer. |
| C05 | `(B+L−0.25, Y4) → (B+L−0.25, Y4+H−1)` | Body right vertical crease | Base body | SY | — | ✓ (X via B) | ✓ | X = `B + L − 0.25`, Δy = `H − 1` | **SY**; CR | No | No | No | Yes | High | Inside body right edge. |
| C06 | `(B+L, Y6) → (D−0.5, Y6)` | Body bottom crease (= back-depth top) | Body / back-depth transition | SX | ✓ | ✓ | — | Y = `2D + H + 2.75` | **SX**; CR | No | No | Yes | No | High | Full body width including margin overshoot. |
| C07 | `(D−0.25, Y4) → (D−0.25, Y4+H−1)` | Body left vertical crease | Base body | SY | — | ✓ | ✓ | X = `D − 0.25`, Δy = `H − 1` | **SY**; CR | No | No | No | Yes | High | Inside body left edge. |
| C08 | `(B+L, Y7) → (D−0.5, Y7)` | Back-depth bottom crease | Back depth | SX | ✓ | ✓ | — | Y = `3D + H + 3.25` | **SX**; CR | No | No | Yes | No | High | Mirror of C06. |
| C09 | `(B+L−0.75, Y8) → (B+L−0.75, Y8+H−2.4)` | Lid right vertical crease | Lid | SY (**H-driven**) | — | ✓ (X via B) | ✓ | X = `D + L − 0.75`, Δy = `H − 2.4` | **SY**; CR | No | No | No | Yes | High | **Lid IS H-driven** — supersedes prior "lid constant" assumption. |
| C10 | `(B+L−0.75, Y9) → (B+L/2+7.25, Y9)` | Lid bottom crease, right segment | Lid bottom | SX (positional) | ✓ | ✓ | ✓ (Y from H) | Y = `3D + 2H + 1.35`, X = `[L/2+7.25, L−0.75] + B` | **SX**; CR | No | No | Yes | No | High | Right of front-tuck notch. |
| C11 | `(B+L/2−7.75, Y9) → (D+0.25, Y9)` | Lid bottom crease, left segment | Lid bottom | SX (positional) | ✓ | ✓ | ✓ | Y = `3D + 2H + 1.35`, X = `[0.25, L/2−7.75] + D` | **SX**; CR | No | No | Yes | No | High | Left of notch. |
| C12 | `(D+0.25, Y9) → (D+0.25, Y8)` | Lid left vertical crease | Lid | SY (**H-driven**) | — | ✓ | ✓ | X = `D + 0.25`, Δy = `H − 2.4` | **SY**; CR | No | No | No | Yes | High | Mirror of C09. |
| C13 | `(0.25, Y4) → (D−0.25, Y4)` | Left side-ear front crease | Left side ear | SX (= `D − 0.5`) | — | ✓ | — | Y = `2D + 3.75`, Δx = `D − 0.5` | **SX**; CR | No | No | Yes | No | High | Width follows D. |
| C14 | `(D−0.25, Y6) → (0.25, Y6)` | Left side-ear back crease | Left side ear | SX (= `D − 0.5`) | — | ✓ | — | Y = `2D + H + 2.75`, Δx = `D − 0.5` | **SX**; CR | No | No | Yes | No | High | Translate-Y with `H` (via Y6). |
| C15 | `(L+2D−0.25, Y6) → (B+L−0.25, Y6)` | Right side-ear back crease | Right side ear | SX | — | ✓ | — | Y = `2D + H + 2.75`, Δx = `D − 0.5` | **SX**; CR | No | No | Yes | No | High | Mirror of C14. |
| C16 | `(B+L−0.25, Y4) → (L+2D−0.25, Y4)` | Right side-ear front crease | Right side ear | SX | — | ✓ | — | Y = `2D + 3.75`, Δx = `D − 0.5` | **SX**; CR | No | No | Yes | No | High | Mirror of C13. |
| C17 | `(B+L, Y2) → (D−0.5, Y2)` | Header inner crease (lower band) | Header band | SX | ✓ | ✓ | — | Y = `D + 3.25` | **SX**; CR | No | No | Yes | No | High | Pairs with C01 to define the `D + 1.75` header band. |

**Counts (CREASE):** 17 elements mapped, all **High confidence**, 0 Medium, 0 Low, 0 Manual Review.

---

## 2. CUT Layer — Compound Path Sub-Elements

The single `<path>` in `<g id="CUT">` contains several `M…` sub-paths. Each is treated
as a logical element below.

| # | Sub-path role | Anchor (Sample A, mm) | Affected by L | Affected by D | Affected by H | Formula / Boundary | Resize Behavior | PC | TO | SX | SY | Confidence | Notes |
|---|---|---|:--:|:--:|:--:|---|---|:--:|:--:|:--:|:--:|---|---|
| P01 | Slot 2 end-cap cut at front-depth top | `(B+0.4L−0.25, Y3)` micro Δ | ✓ | ✓ | — | top-lock slot, right edge of pair 1 | **SL**; pos by L | No | Yes | No | No | High | Fixed 1.4 mm tick connecting to crease C03. |
| P02 | Slot 1 start cap at front-depth top | `(B+0.2L−0.25, Y3)` micro Δ | ✓ | ✓ | — | top-lock slot, left edge of pair 1 | **SL** | No | Yes | No | No | High | Mirror of P01. |
| P03 | Front-tuck notch arc | `(B+L/2−7.75, Y9)` → `(B+L/2+7.25, Y9)` arc | ✓ | ✓ | ✓ (Y via H) | center = `B + L/2`, half-widths `7.75 / 7.25`, depth from quadratic `c0,7.59… 21.26,0` | **PC**; TO in X | **Yes** | Yes | No | No | High | **Asymmetric** — must not be tidied to `±7.5`. |
| P04 | Right side-ear front pin cut | `(B+L−0.25, Y3)` short vertical | — | ✓ | — | side-ear connector | **TO**; CT | No | Yes | No | No | High | 1.4 / 1.4 micro segment plus 113.4 mm pin band? — actually short 1.4 mm tick, see Notes. |
| P05 | Left side-ear front pin cut | `(D−0.25, Y3)` short vertical | — | ✓ | — | mirror of P04 | **TO**; CT | No | Yes | No | No | High | |
| P06 | Right side-ear back pin cut | `(B+L−0.25, Y6)` short vertical | — | ✓ | — | mirror | **TO**; CT | No | Yes | No | No | High | |
| P07 | Left side-ear back pin cut | `(D−0.25, Y6)` short vertical | — | ✓ | — | mirror | **TO**; CT | No | Yes | No | No | High | |
| P08 | **`CUT_OUTER_CONTOUR`** — full perimeter | starts `(D, Y1)` (Sample A `(40, 41.75)`) | ✓ | ✓ | ✓ | composite — see §4 | **MR (composite)** | mixed | mixed | mixed | mixed | **Low** | See §4 for sub-segment proposal (read-only, not authoritative). |

**Counts (CUT, treating sub-paths as elements):** 8 entries — 7 High + 1 Low (P08 monolithic).

---

## 3. Aggregate Statistics

| Metric | Value |
|---|---:|
| Total mapped elements | **25** (17 crease + 8 cut sub-paths) |
| High confidence | **24** |
| Medium confidence | **0** |
| Low confidence | **1** (P08 `CUT_OUTER_CONTOUR` — read-only proposal) |
| Needs manual review | **0** (P08's segmentation is documented as a proposal, not flagged as a model gap) |
| Stretch-X only | 12 |
| Stretch-Y only | 4 |
| Translate-only | 6 |
| Preserve-curve | 1 (front-tuck notch arc P03) |
| Fixed | 0 (no element is fully fixed — every element either translates or scales with at least one parameter) |
| Rejected rules referenced | 0 (all rejected rules omitted from this report by design) |

---

## 4. `CUT_OUTER_CONTOUR` — Read-Only Segmentation Notes

> ⚠ **Not authoritative.** This section is an analytical proposal only and **must not**
> be promoted into an engine without explicit user approval in a later stage.
> The source SVG still treats `CUT_OUTER_CONTOUR` as a single compound path.

Walking the perimeter from the top-left header corner clockwise on Sample A:

| Seg | From → To (mm, Sample A) | Geometric character | Driven by L | Driven by D | Driven by H | Behavior | Confidence |
|---|---|---|:--:|:--:|:--:|---|---|
| O01 | top-left corner `(D, 0)` → `(D, Y1)` along left header | vertical | — | ✓ | — | SY (`D + 1.75`) | Medium |
| O02 | header top edge: pin/lock tabs zigzag across `Y = 0` | 4 mini lock tabs + flats | ✓ | — | — | **PC** for each tab; TO between tabs anchored at slot anchors | Medium |
| O03 | top-right corner descent down to `(B+L, Y1)` | vertical | — | ✓ | — | SY (`D + 1.75`) | Medium |
| O04 | right header band horizontal step out to `(L+2D−0.25, Y2)` | step | — | ✓ | — | SX (`D − 0.5`) | Medium |
| O05 | right side-ear front edge down `Y2 → Y4` | vertical | — | ✓ | — | SY (`D`) | Medium |
| O06 | right side-ear bottom across to `(B+L, Y4)` | horizontal | — | ✓ | — | SX (`D − 0.5`) | Medium |
| O07 | right side-flap pin band `Y4 → Y6` along `X = L + 2D − 0.25` | vertical | — | — | ✓ | **SY (`H + 1`)** | Medium |
| O08 | right side-ear top across `Y6 → (B+L, Y6)` | horizontal | — | ✓ | — | SX | Medium |
| O09 | right side-ear back vertical `Y6 → Y7` | vertical | — | ✓ | — | SY (`D`) | Medium |
| O10 | right header step in at `Y8` to `(B+L, Y8)` | step | — | ✓ | — | SX | Medium |
| O11 | right lid edge `Y8 → Y9` along `X = B + L − 0.75` | vertical | — | — | ✓ | **SY (`H − 2.4`)** | Medium |
| O12 | right chamfer `(B+L−0.75, Y9) → (B+L−15, Y9+15)` | chamfer 15 mm | — | — | — | **PC** (preserve angle); TO with L | High (constant) |
| O13 | lid bottom arc into apex, right half | curve | ✓ | ✓ | — | **PC**; TO in X | Medium |
| O14 | handle bubble (right lobe + flat + left lobe) | bubble arcs + ~42.5 mm gap | ✓ | — | — | **PC**; TO with `B + L/2` | Medium |
| O15 | lid bottom arc into apex, left half | curve | ✓ | ✓ | — | **PC**; TO | Medium |
| O16 | left chamfer `(D+20, Y9+20) → (D+0.75, Y9)` | chamfer 20 mm | — | — | — | **PC**; TO | High (constant) |
| O17 | left lid edge `Y9 → Y8` along `X = D + 0.75` | vertical | — | — | ✓ | **SY (`H − 2.4`)** | Medium |
| O18 | left header step out at `Y8` to `(0.25, Y8)` | step | — | ✓ | — | SX | Medium |
| O19 | left side-ear back vertical `Y7 → Y6` | vertical | — | ✓ | — | SY (`D`) | Medium |
| O20 | left side-ear top across to `(0.25, Y6)` | horizontal | — | ✓ | — | SX | Medium |
| O21 | left side-flap pin band `Y6 → Y4` along `X = 0.25` | vertical | — | — | ✓ | **SY (`H + 1`)** | Medium |
| O22 | left side-ear bottom across to `(D−0.25, Y4)` | horizontal | — | ✓ | — | SX | Medium |
| O23 | left side-ear front vertical `Y4 → Y2` | vertical | — | ✓ | — | SY (`D`) | Medium |
| O24 | left header step in at `Y2` to `(D, Y2)` | step | — | ✓ | — | SX | Medium |
| O25 | left header band vertical `Y2 → 0` | vertical | — | ✓ | — | SY | Medium |
| O26 | top edge close to `(D, 0)` | horizontal close | — | — | — | TO | Medium |

**Segmentation summary:**

- L-driven sub-segments: O02, O13, O14, O15.
- D-driven sub-segments: O01, O03, O04, O05, O06, O08, O09, O10, O18, O19, O20, O22, O23, O24, O25.
- H-driven sub-segments: O07, O11, O17, O21.
- Fixed-shape (`PC`) sub-segments: O02 mini lock tabs, O12 / O16 chamfers, O13–O15 handle/apex arcs, O14 handle bubble.
- Needs manual review: confirmation that the perimeter winding direction in the SVG matches this CW walk; confirmation that O02 contains exactly 4 mini lock tabs at the 4 slot anchors.

This section is read-only. Promotion to authoritative requires a separate stage.

---

## 5. Rejected Rules — Explicitly Not Used

This mapping report **does not** rely on any of the following (per `template-spec.md` §11):

- `upper_ear_vertical = 0.40 · L` — **rejected**.
- "Lid Y constant / not H-linked" — **rejected**; lid uses `H − 2.4`.
- "Apex zone fixed" — **rejected**; apex uses `D − 0.25`.
- `header_band_height = D + 1.5` — **rejected**; uses `D + 1.75`.
- "Single-layer body margin" — **rejected**; 5 X-layers (`0.25`, `D − 0.5`, `D − 0.25`, `D`, `D + 0.25`) are mapped individually.

---

## 6. Modifications Summary

| | |
|---|---|
| Source SVG modified | **No** |
| Engine modified | **No** |
| Runtime modified | **No** |
| UI modified | **No** |
| Export modified | **No** |
| Mapping runtime modified | **No** |
| New tab created | **No** |
| Template registered in app | **No** |
| `CUT_OUTER_CONTOUR` decomposed in source | **No** (proposal in §4 is read-only) |
