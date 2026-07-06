# Derived Segmented Contour Proposal — Lid Tuck Box v1

> **READ-ONLY PROPOSAL.** The source SVG file `200×200×50mm.svg` and its single
> `CUT_OUTER_CONTOUR` path are **NOT modified**. This document only proposes how
> that compound path *would* be decomposed if/when the user approves engine work.
>
> Nothing here is authoritative. Do not execute against this proposal without
> explicit approval.

## Why this proposal exists

`CUT_OUTER_CONTOUR` is a single closed compound path that traces:

- 4 top mini lock tabs (preserve-shape arcs)
- 2 left side ears (top + bottom)
- 2 right side ears (top + bottom)
- The lid rectangle's outer outline
- The lid bottom chamfers (20 mm left, 15 mm right)
- The handle bubble (large fixed arc)
- The body's outer outline

For parametric resize, the path needs to be conceptually broken into segment
groups, each tagged with a Behavior Type (Stretch X / Stretch Y / Translate /
Preserve Curve).

## Proposed segment groups (from the outer contour, walking the path)

Coordinates below are at the base size 200×200×50; m = mm.

| Segment group | Approx span (mm) | Behavior | Driver |
|---|---|---|---|
| `S1_TOP_LEFT_LOCK_TABS` | y ≈ 0 – 2.5; x ≈ 50 – 90 | Preserve shape; translate X with L | L |
| `S2_TOP_INNER_TUCK_TOP_EDGE` | top edge of inner tuck, y = 0 | Stretch X (= 0.20·L − 1) | L |
| `S3_TOP_RIGHT_LOCK_TABS` | mirror of S1 | Preserve shape; translate X | L |
| `S4_HEADER_BAND_RIGHT_EDGE` | x = body_right; y ∈ [Y1 ... Y2] | Stretch Y (= D + 1.5) | D |
| `S5_RIGHT_FRONT_EAR_TOP_BEVEL` | corner fillet | Preserve curve; translate | D |
| `S6_RIGHT_FRONT_EAR_OUTER_EDGE` | x = M+L+M; y ∈ [Y3 ... Y4] | Stretch Y (= D) | D |
| `S7_RIGHT_FRONT_EAR_BOTTOM_BEVEL` | corner fillet | Preserve curve; translate | D |
| `S8_RIGHT_BODY_OUTER_INSET` | x = M+L; y ∈ [Y4 ... Y6] | Stretch Y (= H) | **H** |
| `S9_RIGHT_BACK_EAR_TOP_BEVEL` | corner fillet | Preserve curve; translate | D, H |
| `S10_RIGHT_BACK_EAR_OUTER_EDGE` | y ∈ [Y6 ... Y7] | Stretch Y (= D) | D |
| `S11_RIGHT_BACK_EAR_BOTTOM_BEVEL` | corner fillet | Preserve curve; translate | D, H |
| `S12_LID_RIGHT_EDGE` | x = body_right; y ∈ [Y8 ... Y9] | Stretch Y (= K, constant) | none (constant) |
| `S13_LID_BOTTOM_RIGHT_CHAMFER` | fixed 15 mm chamfer | Preserve angle; translate | L, constant Y |
| `S14_LID_BOTTOM_RIGHT_STRAIGHT_TO_HANDLE` | y = Y10; from chamfer end → handle right horn | Stretch X | L |
| `S15_HANDLE_BUBBLE_ARC` | large fixed arc, centered at L/2 + M | **Preserve curve; translate X only** | L (position) |
| `S16_LID_BOTTOM_LEFT_STRAIGHT_TO_HANDLE` | mirror of S14 | Stretch X | L |
| `S17_LID_BOTTOM_LEFT_CHAMFER` | fixed 20 mm chamfer | Preserve angle; translate | L, constant Y |
| `S18_LID_LEFT_EDGE` | mirror of S12 | Stretch Y (= K) | constant |
| `S19_LEFT_BACK_EAR_BOTTOM_BEVEL` | corner fillet | Preserve curve | D, H |
| `S20_LEFT_BACK_EAR_OUTER_EDGE` | mirror of S10 | Stretch Y (= D) | D |
| `S21_LEFT_BACK_EAR_TOP_BEVEL` | corner fillet | Preserve curve | D, H |
| `S22_LEFT_BODY_OUTER_INSET` | mirror of S8 | Stretch Y (= H) | **H** |
| `S23_LEFT_FRONT_EAR_BOTTOM_BEVEL` | corner fillet | Preserve curve | D |
| `S24_LEFT_FRONT_EAR_OUTER_EDGE` | mirror of S6 | Stretch Y (= D) | D |
| `S25_LEFT_FRONT_EAR_TOP_BEVEL` | corner fillet | Preserve curve | D |
| `S26_HEADER_BAND_LEFT_EDGE` | mirror of S4 | Stretch Y (= D + 1.5) | D |
| `S27_TOP_INNER_TUCK_LEFT_SIDE_CUT` | small angled cut on inner-tuck side | Preserve angle; translate | L |
| `S28_TOP_INNER_TUCK_RIGHT_SIDE_CUT` | mirror | Preserve angle; translate | L |

## Behavior type counts in the proposal

| Behavior Type | Segments |
|---|---|
| Preserve Curve / Preserve Angle | 14 |
| Stretch Y (D-driven) | 6 |
| Stretch Y (H-driven) | 2 (`S8`, `S22` only — confirms H affects ONLY base body) |
| Stretch Y (constant K, lid) | 2 |
| Stretch Y (= D + 1.5) | 2 |
| Stretch X (L-driven) | 4 |
| Translate-only | embedded inside preserve-curve groups |

## Critical observation

Out of ~28 outer-contour segments, **only 2 are H-driven** (`S8`, `S22`). This
matches the user's confirmation: H affects the main body vertical zone only.
Everything else in the outer contour is driven by L, D, or constants.

## What this proposal is NOT

- It is **not** a re-authored SVG.
- It is **not** an engine specification.
- It does **not** modify `CUT_OUTER_CONTOUR` or any file in `src/assets/` or
  `docs/templates/_reference/`.
- It does **not** authorize implementation.

## What still needs to happen before this is actionable

1. User approves the segmentation taxonomy above.
2. A tagged SVG v2 is produced (by Illustrator export or pre-processor) with
   each segment group emitted as a separate polyline/path with a stable ID.
3. The exact arc parameters of S15 (handle bubble) and the chamfer geometries
   (S13, S17) are extracted numerically.
4. The value of `K` (lid_height) is locked from a second tagged SVG.

## Modifications Summary

| | |
|---|---|
| SVG modified | **No** |
| Engine modified | **No** |
| Runtime modified | **No** |
| UI modified | **No** |
| Export modified | **No** |
| Mapping modified | **No** |

This file is a proposal artifact only.
