---
name: Template Build Protocol
description: Mandatory 7-phase protocol for every new dynamic dieline template (post-D001)
type: preference
---

Official protocol — adopted after D001 post-mortem. Every new template MUST follow these phases in order. No exceptions.

**Phases:**
1. **Reference Clone Mode first** — exact 1:1 static clone of source SVG (≤0.01mm), kept permanently as regression oracle.
2. **Segment Functional Map** — classify every segment: outer cut / inner cut / crease / lid tongue / depth tongue / lock / glue flap / fixed / stretchable / angle-preserving. Commit to `docs/templates/<id>/segment-map.md`.
3. **Parameter Influence Map** — each input (Width, Height, Depth, Glue_Flap, Lid_Tongue, Lock, Depth_Tongue_Height) declares the exact segments it controls. No silent cross-coupling. Commit to `docs/templates/<id>/parameter-influence.md`. Enforce with sensitivity tests.
4. **Anchor + Delta only** — forbidden: global scale/transform/stretch. Each movable segment = anchor + delta.
5. **Bezier Preservation** — curves keep shape via relative control points anchored to endpoints. Never approximate.
6. **Live Defaults + Manual Override** — rules (e.g. `Width<=25 → Lock=3mm`) run as live defaults; user edit sets `touched` flag → manual mode; explicit "Auto Reset" button shows target value and reverts.
7. **Preview = Export + Layer Protocol** — same geometry source for both. Export forbids: `use`, `clipPath`, `symbol`, `foreignObject`, raster, global transforms. Units mm, absolute coords. Two layers only: `CREASE` (#00A651) and `CUT` (#ED1C24, contains outer AND inner cuts). CUT above CREASE.

**Why:** D001 initially failed from skipping reference clone, implicit input coupling, and global scaling breaking curves/tongues. Full protocol in `docs/TEMPLATE_BUILD_PROTOCOL.md`.
