# Carrying Handle Box — Illustrator Open Test

## Procedure

1. Export the current layout via the calculator's SVG export.
2. Open the resulting `.svg` directly in **Adobe Illustrator** (no online PDF
   conversion).
3. Inspect:
   - The artboard is **not blank** — all pieces are visible immediately.
   - Each piece appears once (no duplicates, no overlapping ghosts).
   - Curves render exactly as in the on-screen preview.
   - Layers panel shows: `Sheet`, `Dielines`, optionally `Production Info`.
   - No `<symbol>` library entries are present.
   - No clipping masks are active on production geometry.
4. Confirm units = millimetres and artboard matches sheet size.

## Approved results

| Size         | Opens in Illustrator | Geometry intact | No duplicates | Notes                    |
|--------------|----------------------|-----------------|---------------|--------------------------|
| 300×150×180  | ✅                   | ✅              | ✅            | reference                |
| 320×160×170  | ✅                   | ✅              | ✅            | approved baseline        |
| 330×140×160  | ✅                   | ✅              | ✅            | edge case                |

## Common failures (do not ship if observed)

- Blank artboard → residual `<symbol>` / `<use>` references.
- Tiny artwork in a corner → `viewBox` mismatch or `Responsive` checkbox left ON.
- Curves replaced by line segments → engine fell back to parametric grid.
- Phantom rectangles → `<clipPath>` rendered as visible geometry.
