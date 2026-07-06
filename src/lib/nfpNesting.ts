/**
 * No-Fit Polygon (NFP) Geometric Nester
 * ──────────────────────────────────────
 * Implements an SVGNest-inspired packing algorithm for irregular dieline shapes.
 *
 * Core ideas (see http://svgnest.com & E.K. Burke 2006):
 *   • For two polygons A (already placed) and B (the part to place), the
 *     **No-Fit Polygon** is the locus of all positions of B's reference point
 *     such that B touches A but doesn't overlap. We compute it via the
 *     Minkowski difference  A ⊖ B = A ⊕ (-B), supplied by clipper-lib.
 *   • The **Inner-Fit Polygon** describes positions where B sits *inside*
 *     a container (the sheet). For a rectangular sheet the IFP is also a
 *     rectangle: [0..sheetW − boxW] × [0..sheetH − boxH] — adjusted by the
 *     outline's local bbox so the *shape* (not a corner) is the placement
 *     reference.
 *   • Pieces are placed one by one using a **Bottom-Left** heuristic: among
 *     all candidate points (vertices of (IFP minus union(NFPs))), pick the one
 *     with the smallest (y, x) — i.e. the lowest, then leftmost spot.
 *
 * The output is a list of placements compatible with `LayoutPiece`, so the
 * scenario can be displayed and edited like any other layout.
 */

import ClipperLib from '@doodle3d/clipper-lib';
import {
  bboxOf,
  polygonArea,
  rotateRings90,
  translateRings,
  type Polygon,
  type DielineShape,
} from './dielineGeometry';
import type { LayoutPiece } from './sheetLayoutOptimizer';

const CLIPPER_SCALE = 1000; // sub-mm precision (cm × 1000 → integer micrometres)

/* ════════════════════════════════════════════════════════════════════════
 * Clipper helpers — convert between cm Polygon[] and clipper IntPoint paths
 * ════════════════════════════════════════════════════════════════════════ */

type IntPoint = { X: number; Y: number };
type ClipperPath = IntPoint[];

const toClipper = (rings: Polygon[]): ClipperPath[] =>
  rings.map((r) =>
    r.map((p) => ({
      X: Math.round(p.x * CLIPPER_SCALE),
      Y: Math.round(p.y * CLIPPER_SCALE),
    })),
  );

const fromClipper = (paths: ClipperPath[]): Polygon[] =>
  paths.map((path) =>
    path.map((p) => ({ x: p.X / CLIPPER_SCALE, y: p.Y / CLIPPER_SCALE })),
  );

/** Shift a polygon by -p[0] so its first vertex sits at the origin. */
const offsetToOrigin = (rings: Polygon[]): Polygon[] => {
  if (rings.length === 0 || rings[0].length === 0) return rings;
  const ref = rings[0][0];
  return translateRings(rings, -ref.x, -ref.y);
};

/** Inflate a closed polygon by `gap` (cm) — used to enforce a kerf/spacing. */
const inflateRings = (rings: Polygon[], gap: number): Polygon[] => {
  if (gap <= 0) return rings;
  const co = new ClipperLib.ClipperOffset(2, 0.25 * CLIPPER_SCALE);
  const subj = toClipper(rings);
  co.AddPaths(subj, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  const solution: ClipperPath[] = [];
  co.Execute(solution, gap * CLIPPER_SCALE);
  return solution.length ? fromClipper(solution) : rings;
};

/* ════════════════════════════════════════════════════════════════════════
 * NFP — Minkowski difference of A and (−B)
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * Compute the No-Fit Polygon of an orbiting part `B` around an obstacle `A`.
 * Both inputs are world-space cm polygons; the result is the set of points
 * (in cm) where B's reference vertex (its first point) may sit such that
 * B touches A.
 */
export function noFitPolygon(aRings: Polygon[], bRings: Polygon[]): Polygon[] {
  if (aRings.length === 0 || bRings.length === 0) return [];
  // We negate B so that A ⊕ (−B) ≡ Minkowski difference.
  const negB: Polygon[] = bRings.map((r) => r.map((p) => ({ x: -p.x, y: -p.y })));
  const aPaths = toClipper(aRings).slice(0, 1); // outer ring only
  const bPaths = toClipper(negB).slice(0, 1);
  // clipper-lib exposes Minkowski Sum; we pass the negated B to get the difference.
  const sol = ClipperLib.Clipper.MinkowskiSum(aPaths[0], bPaths[0], true);
  if (!sol || sol.length === 0) return [];
  // MinkowskiSum may return multiple paths — keep only the largest by area.
  const polys = fromClipper(sol);
  polys.sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));
  return [polys[0]];
}

/* ════════════════════════════════════════════════════════════════════════
 * Inner-Fit Polygon for a rectangular sheet
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * For a rectangular sheet, the IFP is the set of reference points where the
 * piece's outline lies entirely inside the sheet. With reference = first
 * vertex, that's the rectangle [−bbox.minX .. sheetW − bbox.maxX] ×
 * [−bbox.minY .. sheetH − bbox.maxY].
 */
function innerFitRect(piece: Polygon[], sheetW: number, sheetH: number): Polygon | null {
  if (piece.length === 0) return null;
  const bb = bboxOf(piece[0]);
  const minX = -bb.minX;
  const minY = -bb.minY;
  const maxX = sheetW - bb.maxX;
  const maxY = sheetH - bb.maxY;
  if (maxX < minX || maxY < minY) return null;
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

/* ════════════════════════════════════════════════════════════════════════
 * Difference: IFP minus union(NFPs) — gives the legal placement region
 * ════════════════════════════════════════════════════════════════════════ */

function subtractNFPs(ifp: Polygon, nfps: Polygon[][]): Polygon[] {
  if (nfps.length === 0) return [ifp];
  const cpr = new ClipperLib.Clipper();
  cpr.AddPaths(toClipper([ifp]), ClipperLib.PolyType.ptSubject, true);
  for (const nfp of nfps) {
    if (nfp.length === 0) continue;
    cpr.AddPaths(toClipper(nfp), ClipperLib.PolyType.ptClip, true);
  }
  const solution: ClipperPath[] = [];
  cpr.Execute(
    ClipperLib.ClipType.ctDifference,
    solution,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero,
  );
  return fromClipper(solution);
}

/* ════════════════════════════════════════════════════════════════════════
 * Bottom-Left placement
 * ════════════════════════════════════════════════════════════════════════ */

/** Pick the (y,x)-minimum vertex among all rings — lowest, then leftmost. */
function bottomLeftPoint(regions: Polygon[]): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  for (const r of regions) {
    for (const p of r) {
      if (!best || p.y < best.y - 1e-6 || (Math.abs(p.y - best.y) <= 1e-6 && p.x < best.x)) {
        best = { x: p.x, y: p.y };
      }
    }
  }
  return best;
}

/* ════════════════════════════════════════════════════════════════════════
 * Public — Pack as many copies of `shape` as possible into a sheet
 * ════════════════════════════════════════════════════════════════════════ */

export interface NfpPlacement {
  x: number;
  y: number;
  rotation: 0 | 90;
  rings: Polygon[]; // world-space rings (for collision in subsequent iterations)
}

export interface NfpPackResult {
  placements: NfpPlacement[];
  pieces: LayoutPiece[]; // axis-aligned bbox version, for the existing renderer
  count: number;
  usagePercent: number;
}

export function packShapeIntoSheet(
  shape: DielineShape,
  sheetW: number,
  sheetH: number,
  options: {
    gap?: number;
    allowRotation?: boolean;
    maxPieces?: number;
    /** Use simplified rings for Minkowski to keep NFP fast; final placements use full geometry. */
    fast?: boolean;
  } = {},
): NfpPackResult {
  const gap = options.gap ?? 0;
  const allowRotation = options.allowRotation ?? true;
  const maxPieces = options.maxPieces ?? 200;
  const fast = options.fast ?? true;

  const baseRings = fast ? shape.ringsSimplified : shape.rings;
  const inflated = gap > 0 ? inflateRings(baseRings, gap / 2) : baseRings;

  // Pre-compute the two orientations (origin-anchored, ready to translate).
  const orient0 = offsetToOrigin(inflated);
  const orient90 = allowRotation
    ? offsetToOrigin(rotateRings90(inflated, shape.width, shape.height))
    : null;

  const orientations: { rings: Polygon[]; rotation: 0 | 90 }[] = [{ rings: orient0, rotation: 0 }];
  if (orient90) orientations.push({ rings: orient90, rotation: 90 });

  const placed: NfpPlacement[] = [];

  for (let i = 0; i < maxPieces; i++) {
    let bestForIter: { p: NfpPlacement; score: number } | null = null;

    for (const o of orientations) {
      const ifp = innerFitRect(o.rings, sheetW, sheetH);
      if (!ifp) continue;

      // NFP of the new orientation around every placed part.
      const nfps: Polygon[][] = [];
      for (const placedPart of placed) {
        const nfp = noFitPolygon(placedPart.rings, o.rings);
        if (nfp.length > 0) nfps.push(nfp);
      }

      const region = subtractNFPs(ifp, nfps);
      if (region.length === 0) continue;

      const pt = bottomLeftPoint(region);
      if (!pt) continue;

      const score = pt.y * 1000 + pt.x; // bottom-left preference
      if (!bestForIter || score < bestForIter.score) {
        const worldRings = translateRings(o.rings, pt.x, pt.y);
        bestForIter = {
          p: { x: pt.x, y: pt.y, rotation: o.rotation, rings: worldRings },
          score,
        };
      }
    }

    if (!bestForIter) break; // no more space
    placed.push(bestForIter.p);
  }

  // Convert to LayoutPiece bboxes (so the rest of the UI keeps working).
  const pieces: LayoutPiece[] = placed.map((pl, idx) => {
    const bb = bboxOf(pl.rings[0]);
    return {
      x: bb.minX,
      y: bb.minY,
      w: bb.maxX - bb.minX,
      h: bb.maxY - bb.minY,
      rotated: pl.rotation === 90,
      index: idx + 1,
    };
  });

  const totalArea = sheetW * sheetH;
  const pieceArea = Math.abs(polygonArea(shape.rings[0]));
  const usagePercent = totalArea > 0 ? (placed.length * pieceArea) / totalArea * 100 : 0;

  return { placements: placed, pieces, count: placed.length, usagePercent };
}

/* ════════════════════════════════════════════════════════════════════════
 * Compaction — re-pack an existing layout (used by "Auto Compact" button)
 * ════════════════════════════════════════════════════════════════════════ */

export function compactExistingLayout(
  shape: DielineShape,
  sheetW: number,
  sheetH: number,
  gap: number,
): NfpPackResult {
  return packShapeIntoSheet(shape, sheetW, sheetH, { gap, allowRotation: true, fast: true });
}

/* ════════════════════════════════════════════════════════════════════════
 * Gap Filling — Phase 2
 *
 * After an initial pack, scan the sheet's empty regions and try to insert
 * additional copies of the dieline using ALL FOUR rotations (0/90/180/270°).
 * This recovers slots that the bottom-left heuristic alone cannot fill,
 * approximating what an experienced operator does manually.
 * ════════════════════════════════════════════════════════════════════════ */

export interface GapFillExtra {
  placement: NfpPlacement;
  piece: LayoutPiece;
  rotation: 0 | 90 | 180 | 270;
}

export function fillGapsWithRotations(
  shape: DielineShape,
  sheetW: number,
  sheetH: number,
  existing: NfpPlacement[],
  options: { gap?: number; fast?: boolean; maxExtra?: number } = {},
): GapFillExtra[] {
  const gap = options.gap ?? 0;
  const fast = options.fast ?? true;
  const maxExtra = options.maxExtra ?? 200;

  const baseRings = fast ? shape.ringsSimplified : shape.rings;
  const inflated = gap > 0 ? inflateRings(baseRings, gap / 2) : baseRings;

  // Pre-compute four cardinal rotations, each anchored to origin.
  const r0 = offsetToOrigin(inflated);
  const r90 = offsetToOrigin(rotateRings90(inflated, shape.width, shape.height));
  const r180 = offsetToOrigin(rotateRings90(r90, shape.height, shape.width));
  const r270 = offsetToOrigin(rotateRings90(r180, shape.width, shape.height));

  const orientations: { rings: Polygon[]; rotation: 0 | 90 | 180 | 270 }[] = [
    { rings: r0, rotation: 0 },
    { rings: r90, rotation: 90 },
    { rings: r180, rotation: 180 },
    { rings: r270, rotation: 270 },
  ];

  const placed: NfpPlacement[] = existing.slice();
  const extras: GapFillExtra[] = [];
  let baseIndex = existing.length;

  for (let i = 0; i < maxExtra; i++) {
    let bestForIter: { p: NfpPlacement; rotation: 0 | 90 | 180 | 270; score: number } | null = null;

    for (const o of orientations) {
      const ifp = innerFitRect(o.rings, sheetW, sheetH);
      if (!ifp) continue;

      const nfps: Polygon[][] = [];
      for (const placedPart of placed) {
        const nfp = noFitPolygon(placedPart.rings, o.rings);
        if (nfp.length > 0) nfps.push(nfp);
      }

      const region = subtractNFPs(ifp, nfps);
      if (region.length === 0) continue;

      const pt = bottomLeftPoint(region);
      if (!pt) continue;

      const score = pt.y * 1000 + pt.x;
      if (!bestForIter || score < bestForIter.score) {
        const worldRings = translateRings(o.rings, pt.x, pt.y);
        bestForIter = {
          p: { x: pt.x, y: pt.y, rotation: o.rotation === 90 ? 90 : 0, rings: worldRings },
          rotation: o.rotation,
          score,
        };
      }
    }

    if (!bestForIter) break;
    placed.push(bestForIter.p);
    const bb = bboxOf(bestForIter.p.rings[0]);
    const piece: LayoutPiece = {
      x: bb.minX,
      y: bb.minY,
      w: bb.maxX - bb.minX,
      h: bb.maxY - bb.minY,
      rotated: bestForIter.rotation === 90 || bestForIter.rotation === 270,
      index: ++baseIndex,
      rotation: (bestForIter.rotation / 90) as 0 | 1 | 2 | 3,
    };
    extras.push({ placement: bestForIter.p, piece, rotation: bestForIter.rotation });
  }

  return extras;
}
