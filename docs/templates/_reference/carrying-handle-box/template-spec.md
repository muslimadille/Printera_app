# Carrying Handle Box — Template Spec (approved)

## Dimensions Inputs

| Input    | Symbol | Range (mm) | Default | Notes                                  |
|----------|--------|------------|---------|----------------------------------------|
| Length   | L      | 150–500    | 300     | Front-panel width                      |
| Depth    | D      | 80–250     | 150     | Side-panel width                       |
| Height   | H      | 100–400    | 180     | Body height                            |
| GlueFlap | G      | auto / 30  | 30      | Left assembly flap                     |

## X Boundaries (left → right)

| Boundary | Formula  | Zone           |
|----------|----------|----------------|
| X0       | 0        | Origin         |
| X1       | G        | Glue flap      |
| X2       | X1 + L   | Front 1        |
| X3       | X2 + D   | Depth 1        |
| X4       | X3 + L   | Front 2        |
| X5       | X4 + D   | Depth 2 (end)  |

## Y Boundaries (top → bottom)

| Boundary | Formula              | Zone        |
|----------|---------------------|-------------|
| Y0       | 0                   | Top edge    |
| Y1       | coverTotal(D)       | Cover stack |
| Y2       | Y1 + H              | Body        |
| Y3       | Y2 + bottomFlapMax(D)| Final      |

## Axis Rules (Mapping Audit Contract)

- **L** → X only (Front 1, Front 2)
- **D** → X (Depth 1, Depth 2) + Y (cover stack, bottom stack)
- **H** → Y only (body)
- **G** → X start only

Enforced by:
- `carryXBoundaries()` is independent of H
- `carryYBoundaries()` is independent of L

## Zone Behavior

| Zone        | Behavior   | Notes                                          |
|-------------|-----------|------------------------------------------------|
| Glue        | translates | width = G, content fixed                      |
| Front 1 / 2 | stretches  | width scales linearly with L                  |
| Depth 1 / 2 | stretches  | width scales linearly with D                  |
| Cover stack | stretches  | height = coverTotal(D)                        |
| Body        | stretches  | height = H                                    |
| Bottom stack| stretches  | height = bottomFlapMax(D)                     |
| Handle pills| preserved  | original cubic-Béziers, no resample           |
| Lock notches| preserved  | original cubic-Béziers, no resample           |
| Glue tongues| preserved  | original cubic-Béziers, no resample           |

## Tagged elements (required)

CUT layer:
- `CUT_OUTER_CONTOUR` — single closed path (original artwork)
- `CUT_RIGHT_DEPTH_2_OUTER_EDGE` — explicit right edge at X5

CREASE layer (each must appear exactly once):
- `CREASE_X_GLUE_TO_FRONT_1`         (at X1)
- `CREASE_X_FRONT_1_TO_DEPTH_1`      (at X2)
- `CREASE_X_DEPTH_1_TO_FRONT_2`      (at X3)
- `CREASE_X_FRONT_2_TO_DEPTH_2`      (at X4)
- `CREASE_Y_TOP_TO_BODY`             (at Y1)
- `CREASE_Y_BODY_TO_BOTTOM`          (at Y2)
- `CREASE_Y_COVER_UPPER_TO_LOWER_F1`
- `CREASE_Y_COVER_UPPER_TO_LOWER_F2`

HOLES layer:
- `HOLE_HANDLE_FRONT_1`
- `HOLE_HANDLE_FRONT_2`

## Test Cases

| # | Name        | L   | D   | H   | Footprint W | Footprint H |
|---|-------------|-----|-----|-----|-------------|-------------|
| 1 | Reference   | 300 | 150 | 180 | 930         | 435         |
| 2 | Approved    | 320 | 160 | 170 | 990         | 442         |
| 3 | Edge        | 330 | 140 | 160 | 970         | ~426        |

## Calibration Oracle

The numeric expectations of this spec are mirrored in
`template-calibration.xlsx` (9 sheets, TOP v1.1 §11). The workbook is a
**Validation Oracle** consumed by regression tests only — it is never
imported by runtime code.

Layout scenarios certified today: **S1, S2, S3, S4**.
Future Engine scenarios (not failure conditions today): **S5, S6** (mixed rotation).
