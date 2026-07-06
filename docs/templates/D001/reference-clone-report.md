# D001 — Reference Clone Report (Phase 2 revised)

## What was built
- `src/lib/d001/reference.ts` — Reference Clone engine. Emits 47 OUTER + 8 CUT + 12 CREASE = **67 segments**, each one a verbatim copy of a TEMPLATE.svg line/curve, expressed in **mm**.
- `src/lib/d001/types.ts` — Added `referenceMode`, `glueFlap`, `lidTongue`, `depthTongue`, plus the `D001_REFERENCE` constant block extracted from TEMPLATE.svg.
- `src/lib/d001/geometry.ts` — `buildD001Geometry` now dispatches to `buildD001Reference` when `referenceMode === true`. Dynamic mode is unchanged and explicitly marked WIP.
- `src/components/boxes/D001Calculator.tsx` — Added Reference Clone toggle (default ON), six dimension inputs (W, H, D, Glue, Lid, Depth tongue); inputs disabled while reference mode is active.
- `src/lib/d001/geometry.test.ts` — 8 tests, all passing.

## Reference dimensions extracted from `TEMPLATE.svg`
| Variable                   | Value (mm) |
|----------------------------|------------|
| `Reference_Width`          | 50         |
| `Reference_Height`         | 130        |
| `Reference_Depth`          | 40         |
| `Reference_Depth_2`        | 39.5 (= D − 0.5) |
| `Reference_Glue_Flap`      | 12         |
| `Reference_Lid_Tongue`     | 14.25      |
| `Reference_Depth_Tongue`   | 39.75 (= D − 0.25 = Cover_Vertical) |
| BBox of dieline            | 191.50 × 237.99 mm |

## Acceptance checklist
- ✅ Reference Clone visually + geometrically matches `TEMPLATE.svg`.
- ✅ Segment counts: 47 outer + 8 cut + 12 crease = 67.
- ✅ Glue flap is a closed sub-loop: **Seg 1 (top chamfer) + Seg 47 (vertical) + Seg 46 (bottom chamfer)**, endpoints connect exactly.
- ✅ Four preserved Béziers at **Seg 12 / 14 / 41 / 43**, each with vertical span = 14.25 mm. Control points are absolute mm coords derived from the path's c-deltas (not proportional approximations).
- ✅ Attached cuts **48–55** in correct positions (top-lid slots over Face2, bottom-lid slots over Face1).
- ✅ Crease lines **56–67** copied verbatim (vertical panel creases, lid attach creases 36 mm long, etc.).
- ✅ Preview SVG is **dynamically generated** by `buildD001Reference()` — it is NOT a static include of `TEMPLATE.svg`.
- ✅ No `<use>`, no `<clipPath>`, no `transform="scale(...)"`.

## Known notes / discrepancies vs. Excel blueprint
1. **Excel "Inputs" sheet states W=200, H=200, D=50, Glue=15.** The actual `TEMPLATE.svg` is drawn at **W=50, H=130, D=40, Glue=12**. The Reference Clone is calibrated against the SVG (the file we were told is the system's source of truth).
2. **Excel claims 30° / 25° tongue angles.** TEMPLATE.svg's depth tongues are actually steeper (≈75°-equivalent geometry from the raw deltas). We follow the SVG.
3. **Seg 15** is a 0-length anchor at the right-curl base. The TEMPLATE.svg path has 7 distinct drawn segments in the top-lid region but Excel allocates 8 IDs (Seg 10–17). The spacer keeps all 47 IDs populated; it is skipped at render time. We can collapse this once Excel ordering is confirmed.

## Compare image
- `/tmp/browser/d001/compare.png` — Reference Clone (left) vs. TEMPLATE.svg (right) rendered side by side.

## Phase status
- ❌ Phase 3 (Nesting) — **not started**, blocked on user sign-off of Reference Clone.
- ❌ Phase 4 (Export) — **not started**.
- ⏸ Dynamic rules (W, H, D, Glue_Flap, Lid_Tongue, Depth_Tongue) — to be enabled gradually **after** Reference Clone is signed off; dynamic mode currently still uses the older (incorrect) engine and is hidden behind the toggle.

Awaiting approval to proceed.
