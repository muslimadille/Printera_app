/**
 * Contact / overlap overlay helper for the "مونتاج قالب" preview.
 *
 * For every pair of placed pieces, computes:
 *   • overlap regions — where the real SVG cut polygons intersect (rejected).
 *   • touch regions   — where the polygons are tangent within `touchEps` cm
 *                       (i.e. they intersect after a tiny inflation but not
 *                       before). These are the safe contact points where a
 *                       flap kisses another piece without overlapping.
 *
 * Pure geometry — does NOT depend on the engine's accept/reject decisions, so
 * it can be used for visual diagnosis even when validation already passed.
 */

import ClipperLib from '@doodle3d/clipper-lib';
import type { LayoutPiece } from '@/lib/sheetLayoutOptimizer';
import {
  type DielineShape,
  type Polygon,
  translateRings,
  rotateRings90,
  polygonIntersection,
  polygonArea,
  bboxOf,
} from '@/lib/dielineGeometry';

const SCALE = 1000;

const toClip = (rings: Polygon[]) =>
  rings.map((r) => r.map((p) => ({ X: Math.round(p.x * SCALE), Y: Math.round(p.y * SCALE) })));
const fromClip = (paths: { X: number; Y: number }[][]): Polygon[] =>
  paths.map((path) => path.map((p) => ({ x: p.X / SCALE, y: p.Y / SCALE })));

function inflateRings(rings: Polygon[], delta: number): Polygon[] {
  if (delta <= 0) return rings;
  try {
    const co = new ClipperLib.ClipperOffset(2, 0.25 * SCALE);
    co.AddPaths(toClip(rings), ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
    const sol: { X: number; Y: number }[][] = [];
    co.Execute(sol, delta * SCALE);
    return sol.length ? fromClip(sol) : rings;
  } catch {
    return rings;
  }
}

function pieceRings(p: LayoutPiece, shape: DielineShape): Polygon[] {
  const turns = typeof p.rotation === 'number' ? ((p.rotation % 4) + 4) % 4 : p.rotated ? 1 : 0;
  let base = shape.rings;
  let w = shape.width, h = shape.height;
  for (let t = 0; t < turns; t++) { base = rotateRings90(base, w, h); [w, h] = [h, w]; }
  return translateRings(base, p.x, p.y);
}

function bboxOfRings(rings: Polygon[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rings) {
    const bb = bboxOf(r);
    if (bb.minX < minX) minX = bb.minX;
    if (bb.minY < minY) minY = bb.minY;
    if (bb.maxX > maxX) maxX = bb.maxX;
    if (bb.maxY > maxY) maxY = bb.maxY;
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

const bbOverlap = (a: ReturnType<typeof bboxOfRings>, b: ReturnType<typeof bboxOfRings>, pad = 0) =>
  !(a.maxX + pad <= b.minX || b.maxX + pad <= a.minX || a.maxY + pad <= b.minY || b.maxY + pad <= a.minY);

export interface ContactOverlay {
  /** Real polygon overlap regions (red). */
  overlap: Polygon[];
  /** Tangent / near-touch regions (green). */
  touch: Polygon[];
  overlapArea: number;
  touchPairs: number;
  overlapPairs: number;
}

/**
 * @param touchEps  Inflation distance in cm used to detect tangency.
 *                  Defaults to 0.05 cm (~0.5 mm) — matches the engine's
 *                  practical contact resolution.
 * @param overlapEps Min real-overlap area (cm²) to flag as overlap. Below this
 *                   it's still treated as a contact, mirroring the engine's
 *                   OVERLAP_AREA_EPS.
 */
export function computeContactOverlay(
  pieces: LayoutPiece[],
  shape: DielineShape | null,
  touchEps = 0.05,
  overlapEps = 1e-3,
): ContactOverlay {
  const out: ContactOverlay = { overlap: [], touch: [], overlapArea: 0, touchPairs: 0, overlapPairs: 0 };
  if (!shape || pieces.length < 2) return out;

  const cached = pieces.map((p) => {
    const rings = pieceRings(p, shape);
    return { rings, bb: bboxOfRings(rings), inflated: inflateRings(rings, touchEps) };
  });

  for (let i = 0; i < cached.length; i++) {
    for (let j = i + 1; j < cached.length; j++) {
      const a = cached[i], b = cached[j];
      if (!bbOverlap(a.bb, b.bb, touchEps * 2)) continue;

      const overlapPolys = polygonIntersection(a.rings, b.rings);
      const ovArea = overlapPolys.reduce((s, p) => s + Math.abs(polygonArea(p)), 0);

      if (ovArea > overlapEps) {
        out.overlap.push(...overlapPolys);
        out.overlapArea += ovArea;
        out.overlapPairs++;
      } else {
        // No real overlap — check tangency via inflated intersection.
        const touchPolys = polygonIntersection(a.inflated, b.inflated);
        if (touchPolys.length > 0) {
          out.touch.push(...touchPolys);
          out.touchPairs++;
        }
      }
    }
  }
  return out;
}
