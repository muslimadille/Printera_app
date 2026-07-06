# Carrying Handle Box — Flattened Export Contract

Enforced at runtime by `assertFlattenedExportContract()` inside
`src/lib/carryingHandleBoxExport.ts`. Enforced at test time by
`carryingHandleBoxExport.test.ts` and `carryingHandleBoxRegression.test.ts`.

## Hard rules

1. **No `<symbol>` and no `<use>`** in the final exported SVG.
2. Per-piece geometry is **inlined** inside `<g id="piece-N">`.
3. Piece-level transforms are restricted to:
   - `translate(tx ty)`
   - optionally followed by `rotate(90)`
   - **NO** `scale`, `matrix`, `skewX`, `skewY` at the piece level.
4. Internal `<clipPath>` ids are suffixed with `-pN` per piece (uniqueness).
5. Root `<svg>` declares:
   - `width="<W>mm"` `height="<H>mm"`
   - `viewBox="0 0 W H"` with W = sheet width, H = sheet height
6. Footprint equals `(carryXBoundaries.x5, carryYBoundaries.y3)` exactly.
7. No `Debug`, `Reference`, or `Original` Inkscape layers in the export.

## Layer structure of the exported SVG

```
<svg width="Wmm" height="Hmm" viewBox="0 0 W H">
  <g id="Sheet"      inkscape:label="Sheet">      ...rect frame...
  <g id="Dielines"   inkscape:label="Dielines">
    <g id="piece-1" transform="translate(x y)[ rotate(90)]"> ...inlined geometry... </g>
    <g id="piece-2" ...> ...inlined geometry... </g>
  </g>
  <g id="ProductionInfo" inkscape:label="Production Info"> ...optional... </g>
</svg>
```

## Preview ≡ Export

The same `buildCarryDielineSvg(inputs, { filled: false })` builder feeds both
the on-screen preview and the per-piece body inside the export. The
regression test normalizes only the per-build clipPath uid suffix
(`chb-XXX(-pN)?`) before comparing — every other byte of geometry must match.
