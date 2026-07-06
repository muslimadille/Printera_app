# Template Build Protocol (TBP v1.0)

**Status:** Official — mandatory for every new dynamic dieline template.
**Adopted:** 2026-06-25, after the D001 post-mortem.
**Scope:** Any new box / flat / dieline template added to the system.

> No template may be built dynamically from Excel or SVG alone.
> Every template MUST pass through the seven phases below, in order.
> Skipping a phase is the root cause of the D001 problems and is not allowed.

---

## Phase 1 — Reference Clone Mode (FIRST)

Before any parametric work, build an exact static clone of the source template at its native dimensions.

- Implement `referenceMode = true` that renders the original SVG geometry 1:1.
- Visual diff against the source must be ≤ 0.01mm on every segment.
- All segments (OUTER + CUT + CREASE) must be present and counted.
- This mode stays in the codebase permanently as a regression oracle.

**Gate:** Reference Clone must match the source before touching dynamics.

---

## Phase 2 — Segment Functional Map

Every segment in the template must be classified by function — not just by coordinates.

Required categories:

- Outer cut (contour)
- Inner / attached cut
- Crease
- Lid tongue
- Depth tongue
- Lock
- Glue flap
- Fixed part (must not move)
- Stretchable part (flexes with a parameter)
- Angle-preserving part (slant/ramp must keep its angle)

Deliverable: a table in `docs/templates/<id>/segment-map.md` listing every segment with its category.

---

## Phase 3 — Parameter Influence Map

For each input parameter, declare exactly which segments it controls — and nothing else.

Standard inputs:

- `Width`
- `Height`
- `Depth`
- `Glue_Flap`
- `Lid_Tongue`
- `Lock`
- `Depth_Tongue_Height`

Rules:

- A parameter may only affect segments listed in its influence row.
- No parameter may silently affect another parameter's segments.
- Cross-coupling must be explicit and justified in the map.

Deliverable: `docs/templates/<id>/parameter-influence.md`.

**Gate:** Sensitivity tests must prove each parameter affects only its declared segments.

---

## Phase 4 — Anchor + Delta Only

- Forbidden: global `scale`, `transform`, or generic stretch on the whole template.
- Required: each movable segment is expressed as `anchor + delta`, where `delta` is derived from the parameter map.
- Fixed parts keep their original absolute coordinates.

---

## Phase 5 — Bezier Preservation

- Any curve must keep its shape across all parameter values.
- Use relative control points anchored to the curve's endpoints.
- Never rebuild a curve from straight lines or approximate it during resize.

---

## Phase 6 — Live Defaults + Manual Override

For rules like `Width <= 25 → Lock = 3mm, else 5mm`:

- Rule runs as a **live default** that follows the driving input.
- User edits switch the field to manual mode (`touched` flag) and the default stops overriding.
- An explicit "Auto Reset" control returns the field to live-default behavior and shows the target value (e.g. "Reset to 3mm").

---

## Phase 7 — Preview = Export & Layer Protocol

- The export SVG MUST be generated from the same geometry source as the preview.
- Forbidden in export: `use`, `clipPath`, `symbol`, `foreignObject`, raster images, global transforms.
- Units: `mm`. Coordinates: absolute.
- Layer structure (exactly two layers):
  - `CREASE` — color `#00A651`, all crease lines.
  - `CUT` — color `#ED1C24`, all outer **and** inner cut lines.
- Layer order in the SVG must keep `CUT` visible above `CREASE`.

---

## Definition of Done

A new template is accepted only when all of the following are true:

1. Reference Clone passes (≤ 0.01mm).
2. Segment Functional Map is committed.
3. Parameter Influence Map is committed and enforced by tests.
4. No global scale/transform exists in the geometry engine.
5. All curves stay smooth across the full parameter range.
6. Live defaults + manual override + auto-reset work for every rule-driven field.
7. Preview SVG and Export SVG are byte-comparable in geometry, with the required two-layer structure.

---

## Why this protocol exists

The D001 build failed initially because we jumped to dynamic mode without a reference clone, coupled inputs implicitly, and used global scaling that broke curves and tongues. Applying Reference Clone → Functional Map → Influence Map → Anchor+Delta → Bezier Preservation → Live Defaults → Preview=Export fixed it 100%. This protocol is the formal record of that lesson and is mandatory going forward.
