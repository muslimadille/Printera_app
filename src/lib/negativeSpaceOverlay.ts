/**
 * Negative-Space overlay helper for "مونتاج قالب".
 *
 * Computes:
 *   • pockets   — sheet area MINUS the union of placed-piece polygons
 *                 (real SVG cut rings, with optional gap inflation), then
 *                 split into individual contiguous polygons.
 *   • anchors   — per-pocket insertion attempt points used by the engine's
 *                 `negativeSpaceExploit` pass: centroid + 4 bbox corners +
 *                 center.
 *
 * Pure geometry — does NOT depend on engine internals, so it can show the
 * same pockets the engine reasons about even if no extra piece was inserted.
 */

import ClipperLib from '@doodle3d/clipper-lib';
import type { LayoutPiece } from '@/lib/sheetLayoutOptimizer';
import {
  type DielineShape,
  type Polygon,
  translateRings,
  rotateRings90,
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

/** Group exterior + holes returned by Clipper into independent polygons. */
function splitConnected(paths: Polygon[]): Polygon[][] {
  // Without full topology info, treat each path as its own pocket. For the
  // overlay this is visually faithful (the renderer fills with evenodd) and
  // anchors are still useful per ring.
  return paths.map((p) => [p]);
}

export interface PocketInfo {
  /** Real polygon rings of this pocket (sheet \ pieces region). */
  rings: Polygon[];
  /** Pocket area in cm². */
  area: number;
  /** Bounding box of the pocket. */
  bbox: ReturnType<typeof bboxOfRings>;
  /** Pixel-area-weighted centroid (approximated by bbox center). */
  centroid: { x: number; y: number };
  /** Anchors the engine tries when inserting into this pocket. */
  anchors: Array<{ x: number; y: number; kind: 'centroid' | 'tl' | 'tr' | 'bl' | 'br' }>;
}

export interface NegativeSpaceOverlay {
  pockets: PocketInfo[];
  /** Total free area in cm² (sum of pocket areas above the min threshold). */
  freeArea: number;
  /** Free area as % of sheet. */
  freePercent: number;
}

/**
 * @param minPocketArea Skip pockets smaller than this (cm²) so that thin
 *                      seams between pieces don't pollute the overlay.
 *                      Default = 1 cm².
 * @param inflate       Inflate piece rings by this amount before subtracting,
 *                      typically gap/2, so the pocket reflects the area
 *                      actually usable for a new piece.
 */
export function computeNegativeSpaceOverlay(
  pieces: LayoutPiece[],
  shape: DielineShape | null,
  sheetW: number,
  sheetH: number,
  minPocketArea = 1,
  inflate = 0,
): NegativeSpaceOverlay {
  const empty: NegativeSpaceOverlay = { pockets: [], freeArea: 0, freePercent: 0 };
  if (!shape || sheetW <= 0 || sheetH <= 0) return empty;

  const sheetRing: Polygon = [
    { x: 0, y: 0 },
    { x: sheetW, y: 0 },
    { x: sheetW, y: sheetH },
    { x: 0, y: sheetH },
  ];

  // Treat each piece as a BLOCK whose boundary follows the dieline's OUTER
  // silhouette (not its bounding rectangle). For each piece we union its
  // rings into a PolyTree and keep only the outer contours (depth 0),
  // dropping interior holes — that gives the closed outline of the block
  // without filling internal flap whitespace. Then we union all blocks
  // together and subtract from the sheet.
  const allBlockOutlines: Polygon[] = [];
  for (const p of pieces) {
    const rings = pieceRings(p, shape);
    if (!rings.length) continue;
    // Union this piece's rings into a PolyTree to get the outer silhouette.
    const cl = new ClipperLib.Clipper();
    cl.AddPaths(toClip(rings), ClipperLib.PolyType.ptSubject, true);
    const tree = new ClipperLib.PolyTree();
    cl.Execute(
      ClipperLib.ClipType.ctUnion,
      tree,
      ClipperLib.PolyFillType.pftNonZero,
      ClipperLib.PolyFillType.pftNonZero,
    );
    // Walk top-level nodes (outer contours only — holes are children).
    const outers: Polygon[] = [];
    let node = tree.GetFirst();
    while (node) {
      if (!node.IsHole()) {
        const contour = node.Contour();
        if (contour && contour.length >= 3) {
          outers.push(contour.map((pt: { X: number; Y: number }) => ({ x: pt.X / SCALE, y: pt.Y / SCALE })));
        }
      }
      node = node.GetNext();
    }
    let outlines = outers.length ? outers : rings;
    if (inflate > 0) outlines = inflateRings(outlines, inflate);
    allBlockOutlines.push(...outlines);
  }

  const clipper = new ClipperLib.Clipper();
  clipper.AddPaths(toClip(allBlockOutlines), ClipperLib.PolyType.ptSubject, true);
  const piecesUnion: { X: number; Y: number }[][] = [];
  clipper.Execute(
    ClipperLib.ClipType.ctUnion,
    piecesUnion,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero,
  );

  // Difference: sheet \ pieces.
  const diffClipper = new ClipperLib.Clipper();
  diffClipper.AddPaths(toClip([sheetRing]), ClipperLib.PolyType.ptSubject, true);
  if (piecesUnion.length) diffClipper.AddPaths(piecesUnion, ClipperLib.PolyType.ptClip, true);
  const diff: { X: number; Y: number }[][] = [];
  diffClipper.Execute(
    ClipperLib.ClipType.ctDifference,
    diff,
    ClipperLib.PolyFillType.pftEvenOdd,
    ClipperLib.PolyFillType.pftEvenOdd,
  );
  const freeRings = fromClip(diff);
  if (freeRings.length === 0) return empty;

  const groups = splitConnected(freeRings);
  const pockets: PocketInfo[] = [];
  let total = 0;
  for (const rings of groups) {
    const area = rings.reduce((s, r) => s + Math.abs(polygonArea(r)), 0);
    if (area < minPocketArea) continue;
    const bb = bboxOfRings(rings);
    const cx = (bb.minX + bb.maxX) / 2;
    const cy = (bb.minY + bb.maxY) / 2;
    pockets.push({
      rings,
      area,
      bbox: bb,
      centroid: { x: cx, y: cy },
      anchors: [
        { x: cx, y: cy, kind: 'centroid' },
        { x: bb.minX, y: bb.minY, kind: 'tl' },
        { x: bb.maxX, y: bb.minY, kind: 'tr' },
        { x: bb.minX, y: bb.maxY, kind: 'bl' },
        { x: bb.maxX, y: bb.maxY, kind: 'br' },
      ],
    });
    total += area;
  }
  pockets.sort((a, b) => b.area - a.area);
  const sheetArea = sheetW * sheetH;
  return {
    pockets,
    freeArea: total,
    freePercent: sheetArea > 0 ? (total / sheetArea) * 100 : 0,
  };
}
