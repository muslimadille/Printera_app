# Carrying Handle Box — Locked Test Cases

The following 3 sizes form the **regression baseline**. Any code change that
breaks any one of them invalidates the template's certification.

| # | Name      | L   | D   | H   | X Boundaries                | Y Boundaries          | Footprint W × H |
|---|-----------|-----|-----|-----|-----------------------------|-----------------------|------------------|
| 1 | Reference | 300 | 150 | 180 | 0, 30, 330, 480, 780, 930   | 0, 150, 330, 435      | 930 × 435        |
| 2 | Approved  | 320 | 160 | 170 | 0, 30, 350, 510, 830, 990   | 0, 160, 330, 442      | 990 × 442        |
| 3 | Edge      | 330 | 140 | 160 | 0, 30, 360, 500, 830, 970   | 0, 140, 300, 400      | 970 × 400        |

> TC#3 footprint H corrected from the earlier `~426` approximation to the exact
> engine value `400` (= coverTotal 140 + H 160 + bottomFlapMax 100). Engine
> formula unchanged.

Plus a 4th visual-fidelity case used by
`carryingHandleBoxGeometryCleanup.test.ts`:

| 4 | Cleanup   | 280 | 155 | 170 | 0, 30, 310, 465, 745, 900   | 900 × 433.5      |

## What each suite verifies

| Vitest suite                                  | Scope                                                |
|-----------------------------------------------|------------------------------------------------------|
| `carryingHandleBoxEngine.test.ts`             | Axis contract, boundaries, layout count              |
| `carryingHandleBoxExport.test.ts`             | Flattened Illustrator-compatible export (1 size)     |
| `carryingHandleBoxRegression.test.ts`         | Preview + Export stable across 3 sizes               |
| `carryingHandleBoxGeometryCleanup.test.ts`    | Original curves preserved, no helper geometry leak   |

## Approval signal

- ✅ All 4 suites green
- ✅ Visual preview matches `template-color.svg` shape
- ✅ Exported SVG opens in Adobe Illustrator without artifacts
- ✅ Engine outputs match `template-calibration.xlsx` (Calibration Oracle, TOP v1.1)

## Best Sheet Layout — scenarios tested

Per **TOP v1.1 §12 Best Sheet Layout Contract**:

| Scenario | Piece Rotation | Sheet Orientation | Mixed | Engine Status |
|----------|----------------|-------------------|-------|---------------|
| S1 Normal               | 0°       | W × H | No  | ✅ Supported |
| S2 Rotated              | 90°      | W × H | No  | ✅ Supported |
| S3 Sheet Flip — Normal  | 0°       | H × W | No  | ✅ Supported |
| S4 Sheet Flip — Rotated | 90°      | H × W | No  | ✅ Supported |
| S5 Mixed Rotation       | 0° + 90° | W × H | Yes | ⏳ Future Engine — NOT a failure today |
| S6 Mixed + Sheet Flip   | 0° + 90° | H × W | Yes | ⏳ Future Engine — NOT a failure today |

Best = argmax over {S1..S4} of (Total Pieces → Utilization % → -Waste %),
subject to: no overlap, gap respected, inside sheet, Preview ≡ Export, no duplicates.

### ExpectedBestPieces (locked, engine-derived)

Sheet = 1000 × 700 mm, Gap = 5 mm, GlueFlap = 30 mm.

| TC  | L × D × H       | Footprint W × H | Best Scenario | ExpectedBestPieces |
|-----|-----------------|------------------|---------------|--------------------|
| TC1 | 300 × 150 × 180 | 930 × 435        | S1 Normal     | 1                  |
| TC2 | 320 × 160 × 170 | 990 × 442        | S1 Normal     | 1                  |
| TC3 | 280 × 155 × 170 | 900 × 433.5      | S1 Normal     | 1                  |
| TC4 | 330 × 140 × 160 | 970 × 400        | S1 Normal     | 1                  |

`SheetLayout` in `template-calibration.xlsx` enumerates all 6 scenarios
(S1–S4 evaluated, S5–S6 marked Future) for every TC.
