# Carrying Handle Box — Preview Validation

## Procedure

1. Open the calculator tab.
2. Enter each of the 3 locked test sizes (see `test-cases.md`).
3. For each size, verify on-screen:
   - The outer cut contour preserves original curves (handle pills, glue
     tongues, lock notches are NOT replaced by straight lines).
   - All named creases appear **exactly once** at their target X / Y.
   - Holes (handle apertures) remain inside Front 1 / Front 2 zones.
   - The right-most cut edge is rendered at `X5` (no missing edge).
4. Open the Debug dialog and confirm every row is **PASS** with zero warnings.

## Approved results (locked)

| Size            | Curves preserved | Creases unique | Right edge | Holes |
|-----------------|------------------|----------------|------------|-------|
| 300×150×180     | ✅               | ✅             | ✅         | ✅    |
| 320×160×170     | ✅               | ✅             | ✅         | ✅    |
| 330×140×160     | ✅               | ✅             | ✅         | ✅    |
| 280×155×170     | ✅               | ✅             | ✅         | ✅    |

## What to reject

- Any preview where the box looks like a parametric grid of rectangles
  (curves stripped).
- Any preview with visible construction lines or clip rectangles.
- Any preview where a crease line is doubled at a shared zone boundary.
- Any preview that does not visually match `template-color.svg`'s shape.
