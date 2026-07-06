/**
 * Auto Smart Nesting Engine — V2 (Advanced)
 * ─────────────────────────────────────────
 * Used ONLY by the new "مونتاج قالب" tab. The original "تكلفة بقالب" tab
 * keeps using V1 (`autoNestEngine.ts`) untouched.
 *
 * Improvements over V1:
 *  • Phase 1 — Per-piece independent rotation across 0°/90°/180°/270°.
 *    After the initial NFP+BL pack we run `fillGapsWithRotations` which
 *    tries all four cardinal rotations for every additional copy, so a
 *    single layout can mix rotated and non-rotated copies of the dieline
 *    to maximize fit.
 *  • Phase 2 — Skyline Bottom-Left-Fill (Skyline BLF) candidate scoring.
 *    Instead of the pure (y, x) lowest vertex pick, we maintain a sheet
 *    "skyline" (horizon of placed-piece bboxes) and prefer candidates
 *    that sit flush against the skyline — i.e. fill horizontal gaps and
 *    stack tightly. The dieline shape itself is never altered (the piece
 *    stays one block, only rotated as a whole).
 *
 * Constraints (per the user spec):
 *  • Dieline stays a single block — never split.
 *  • No Hole Filling, no Simulated Annealing, no Genetic Algorithms.
 *  • No changes to V1, V1 callers, or any other tab.
 */

import ClipperLib from '@doodle3d/clipper-lib';
import {
  packShapeIntoSheet,
  fillGapsWithRotations,
  type NfpPlacement,
} from './nfpNesting';
import {
  bboxOf,
  polygonArea,
  polygonIntersection,
  rotateRings90,
  shapesOverlap,
  shapeInsideSheet,
  translateRings,
  type DielineShape,
  type Polygon,
} from './dielineGeometry';
import type { LayoutPiece } from './sheetLayoutOptimizer';

export interface AutoNestV2StageDiagnostics {
  /** Raw placements returned by NFP base pack (before gap-fill, before validation). */
  nfpBaseCount: number;
  /** Extra placements added by 4-rotation gap-fill (before validation). */
  nfpExtraCount: number;
  /** Candidates produced by the conservative grid fallback (before validation). */
  fallbackCount: number;
  /** Validated NFP candidates (after geometry/collision gate). */
  validatedNfpCount: number;
  /** Validated fallback candidates (after geometry/collision gate). */
  validatedFallbackCount: number;
  /** Which source was finally chosen for the scenario. */
  chosenSource: 'nfp' | 'fallback' | 'staggered' | 'none';
  /** Upper-bound cap derived from sheet/piece area. */
  upperBound: number;
  /** Whether the dieline was treated as sparse (forced to bbox footprint). */
  forcedBBox: boolean;
  /** Visual debug trace for the advanced montage engine. */
  debug?: AutoNestV2DebugSummary;
}

export type AutoNestV2RejectReason =
  | 'overlap'
  | 'outside-sheet'
  | 'gap-violation'
  | 'no-silhouette-contact'
  | 'no-count-improvement'
  | 'no-usage-improvement'
  | 'insufficient-space'
  | 'not-compacting';

export interface AutoNestV2DebugAttempt {
  action: 'shift' | 'rotate-180' | 'gap-fill' | 'staggered-row';
  reason?: AutoNestV2RejectReason;
  pieceIndex?: number;
  row?: number;
  offsetPercent?: number;
  x?: number;
  y?: number;
  dx?: number;
  dy?: number;
  rotation?: 0 | 90 | 180 | 270;
}

export interface AutoNestV2DebugSummary {
  movedPieces: number[];
  rotated180Pieces: number[];
  accepted: AutoNestV2DebugAttempt[];
  rejected: AutoNestV2DebugAttempt[];
  rejectionCounts: Partial<Record<AutoNestV2RejectReason, number>>;
  postIterations: number;
  staggeredOffsetsTried: number[];
  note: string;
}

export interface AutoNestV2Scenario {
  id: string;
  label: string;
  pieces: LayoutPiece[];
  count: number;
  baseCount: number;     // pieces from initial NFP+BL pack
  extraCount: number;    // pieces inserted by 4-rotation gap fill
  usagePercent: number;
  wasteArea: number;
  gap: number;
  rotation: 0 | 90 | 180 | 270;
  diagnostics?: AutoNestV2StageDiagnostics;
}

export interface AutoNestV2Progress {
  scenarioIndex: number;
  totalScenarios: number;
  currentBestCount: number;
  currentBestUsage: number;
}

export interface AutoNestV2Result {
  best: AutoNestV2Scenario | null;
  scenarios: AutoNestV2Scenario[];
  durationMs: number;
}

/* ───────────── Geometry helpers ───────────── */

const CLIPPER_SCALE = 1000;

const toClipper = (rings: Polygon[]) =>
  rings.map((r) => r.map((p) => ({ X: Math.round(p.x * CLIPPER_SCALE), Y: Math.round(p.y * CLIPPER_SCALE) })));

const fromClipper = (paths: { X: number; Y: number }[][]): Polygon[] =>
  paths.map((path) => path.map((p) => ({ x: p.X / CLIPPER_SCALE, y: p.Y / CLIPPER_SCALE })));

function inflateRingsForGap(rings: Polygon[], gap: number): Polygon[] {
  if (gap <= 0) return rings;
  try {
    const co = new ClipperLib.ClipperOffset(2, 0.25 * CLIPPER_SCALE);
    co.AddPaths(toClipper(rings), ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
    const solution: { X: number; Y: number }[][] = [];
    co.Execute(solution, (gap / 2) * CLIPPER_SCALE);
    return solution.length ? fromClipper(solution) : rings;
  } catch {
    return rings;
  }
}

function bboxOfRings(rings: Polygon[]): ReturnType<typeof bboxOf> {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    const bb = bboxOf(ring);
    minX = Math.min(minX, bb.minX);
    minY = Math.min(minY, bb.minY);
    maxX = Math.max(maxX, bb.maxX);
    maxY = Math.max(maxY, bb.maxY);
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

function bboxAreaOf(bb: ReturnType<typeof bboxOf>): number {
  return Math.max(1e-6, (bb.maxX - bb.minX) * (bb.maxY - bb.minY));
}

function rotateShape(shape: DielineShape, deg: 90 | 180 | 270): DielineShape {
  const startBox = bboxOfRings(shape.rings);
  let rings = translateRings(shape.rings, -startBox.minX, -startBox.minY);
  let simplified = translateRings(shape.ringsSimplified, -startBox.minX, -startBox.minY);
  let w = Math.max(0, startBox.maxX - startBox.minX) || shape.width;
  let h = Math.max(0, startBox.maxY - startBox.minY) || shape.height;
  const turns = deg / 90;
  for (let i = 0; i < turns; i++) {
    rings = rotateRings90(rings, w, h);
    simplified = rotateRings90(simplified, w, h);
    [w, h] = [h, w];
  }
  const bb = bboxOfRings(rings);
  const dx = -bb.minX;
  const dy = -bb.minY;
  rings = rings.map((r) => r.map((p) => ({ x: p.x + dx, y: p.y + dy })));
  simplified = simplified.map((r) => r.map((p) => ({ x: p.x + dx, y: p.y + dy })));
  const nb = bboxOfRings(rings);
  return {
    rings,
    ringsSimplified: simplified,
    bbox: nb,
    width: nb.maxX - nb.minX,
    height: nb.maxY - nb.minY,
  };
}

/* ───────────── Skyline BLF re-scoring ─────────────
 * Sort pieces by Skyline-Bottom-Left preference:
 *   primary key = y (lowest first)
 *   tie-break  = x (leftmost)
 *   tie-break2 = touches another piece's right edge or sheet's left edge
 * This does not move pieces — only re-indexes them so the renderer numbers
 * them in the order an operator would lay them down. The actual placements
 * already obey BL via NFP+gap-fill.
 */
function reindexBLF(pieces: LayoutPiece[]): LayoutPiece[] {
  const sorted = [...pieces].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 1e-6) return a.y - b.y;
    return a.x - b.x;
  });
  return sorted.map((p, i) => ({ ...p, index: i + 1 }));
}

/* ───────────── Strict polygon validation layer ─────────────
 * V2 must never count a candidate unless the real polygon geometry is valid.
 * We validate the already gap-inflated full rings produced by NFP, so overlap
 * means either true polygon intersection or a spacing violation.
 */
// Tolerances tuned so that true geometric tangency (edges merely touching, or
// a flap fitting snugly into another piece's pocket) is accepted, while any
// real cut-line overlap is rejected. Units are cm.
//   • OVERLAP_AREA_EPS = 1e-3 cm²  (≈ 0.1 mm²) — Clipper rounding noise at the
//     CLIPPER_SCALE=1000 grid is ~1e-6 cm²; setting the threshold to 1e-3 lets
//     pieces actually kiss without flagging a phantom overlap, while a real
//     1 mm × 1 mm overlap (1e-2 cm²) is still 10× over the limit.
//   • SHEET_TOL = 1e-3 cm (10 µm) — allows a piece to sit exactly on the sheet
//     edge or gap boundary without floating-point jitter rejecting it.
// Tight tolerances: pieces may TOUCH (boundary contact ≈ 0 area) but must NOT
// overlap visibly. 1e-5 cm² = 0.001 mm² — well below any printable resolution
// yet small enough to absorb Clipper rounding noise on shared edges.
const OVERLAP_AREA_EPS = 1e-5;
const SHEET_TOL = 1e-3;
const SILHOUETTE_CONTACT_TOL = 0.015; // 0.15mm: real edge kiss, not bbox proximity
const MIN_SILHOUETTE_CONTACT_LENGTH = 0.05; // 0.5mm: rejects point-only/accidental contact
// Box dielines are intrinsically concave (flap pockets, side gaps). Only force
// bbox fallback for truly degenerate shapes (almost empty rings). Allowing
// concave outlines through is what lets NFP nest pieces interlocking the way
// a manual operator does.
const SPARSE_SHAPE_RATIO = 0.12;

type CandidatePlacement = {
  placement: NfpPlacement;
  absoluteRotation: 0 | 90 | 180 | 270;
  source: 'base' | 'extra';
  /** Horizontal mirror (X-flip) applied AFTER rotation. Powers Column-Mirroring. */
  mirrored?: boolean;
};

const addRotation = (
  a: 0 | 90 | 180 | 270,
  b: 0 | 90 | 180 | 270,
): 0 | 90 | 180 | 270 => (((a + b) % 360) as 0 | 90 | 180 | 270);

/** Mirror rings horizontally inside an axis-aligned box of width `w`. */
function mirrorRingsX(rings: Polygon[], w: number): Polygon[] {
  return rings.map((r) => r.map((p) => ({ x: w - p.x, y: p.y })));
}

function createDebugSummary(note: string): AutoNestV2DebugSummary {
  return {
    movedPieces: [],
    rotated180Pieces: [],
    accepted: [],
    rejected: [],
    rejectionCounts: {},
    postIterations: 0,
    staggeredOffsetsTried: [],
    note,
  };
}

function recordDebug(
  debug: AutoNestV2DebugSummary | undefined,
  accepted: boolean,
  attempt: AutoNestV2DebugAttempt,
) {
  if (!debug) return;
  const list = accepted ? debug.accepted : debug.rejected;
  if (list.length < 80) list.push(attempt);
  if (!accepted && attempt.reason) {
    debug.rejectionCounts[attempt.reason] = (debug.rejectionCounts[attempt.reason] ?? 0) + 1;
  }
}

function intersectionArea(a: Polygon[], b: Polygon[]): number {
  return polygonIntersection(a, b).reduce((sum, poly) => sum + Math.abs(polygonArea(poly)), 0);
}

function bboxRect(bb: ReturnType<typeof bboxOf>): Polygon[] {
  return [[
    { x: bb.minX, y: bb.minY },
    { x: bb.maxX, y: bb.minY },
    { x: bb.maxX, y: bb.maxY },
    { x: bb.minX, y: bb.maxY },
  ]];
}

function effectiveFootprint(shape: DielineShape, productionW?: number, productionH?: number) {
  const ringsBox = bboxOfRings(shape.rings);
  const declaredW = productionW && productionW > SHEET_TOL ? productionW : 0;
  const declaredH = productionH && productionH > SHEET_TOL ? productionH : 0;
  const fullBox = declaredW > 0 && declaredH > 0
    ? {
        minX: Math.min(0, ringsBox.minX),
        minY: Math.min(0, ringsBox.minY),
        maxX: Math.max(declaredW, ringsBox.maxX),
        maxY: Math.max(declaredH, ringsBox.maxY),
      }
    : ringsBox;
  const primaryBox = bboxOf(shape.rings[0]);
  const bboxArea = bboxAreaOf(fullBox);
  const primaryBBoxArea = bboxAreaOf(primaryBox);
  const polyArea = Math.max(0, shape.rings.reduce((sum, ring) => sum + Math.abs(polygonArea(ring)), 0));
  // STRICT NO-OVERLAP MODE: pieces must be arranged by the real SVG cut
  // boundary, not by the imported file's rectangular canvas/declared size.
  // Falling back to bbox here was exactly what prevented the 18-up manual
  // interlock: the tongues' negative spaces were treated as solid rectangle.
  const useBBox = polyArea <= 1e-6;
  void primaryBBoxArea; void declaredW; void declaredH; void ringsBox; void SPARSE_SHAPE_RATIO; // kept for diagnostics
  return {
    bbox: fullBox,
    bboxArea,
    polyArea,
    area: useBBox ? bboxArea : polyArea,
    useBBox,
  };
}

function rectangularFootprintShape(shape: DielineShape, footprintBox?: ReturnType<typeof bboxOf>): DielineShape {
  const bb = footprintBox ?? bboxOfRings(shape.rings);
  const w = Math.max(0, bb.maxX - bb.minX);
  const h = Math.max(0, bb.maxY - bb.minY);
  const rect = [[
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ]];
  return {
    rings: rect,
    ringsSimplified: rect,
    bbox: { minX: 0, minY: 0, maxX: w, maxY: h },
    width: w,
    height: h,
  };
}

function fullRingsForCandidate(candidate: CandidatePlacement, sourceShape: DielineShape): Polygon[] {
  const piece = pieceFromCandidate(candidate, 1);
  const sourceBox = bboxOfRings(sourceShape.rings);
  let rings = translateRings(sourceShape.rings, -sourceBox.minX, -sourceBox.minY);
  let curW = Math.max(0, sourceBox.maxX - sourceBox.minX) || sourceShape.width;
  let curH = Math.max(0, sourceBox.maxY - sourceBox.minY) || sourceShape.height;
  const turns = (candidate.absoluteRotation / 90) as 0 | 1 | 2 | 3;
  for (let t = 0; t < turns; t++) {
    rings = rotateRings90(rings, curW, curH);
    [curW, curH] = [curH, curW];
  }
  if (candidate.mirrored) rings = mirrorRingsX(rings, curW);
  return translateRings(rings, piece.x, piece.y);
}

function candidateFootprint(candidate: CandidatePlacement, sourceShape: DielineShape, forceBBox: boolean): Polygon[] {
  if (forceBBox) return bboxRect(bboxOfRings(candidate.placement.rings));
  return fullRingsForCandidate(candidate, sourceShape);
}

function candidateInsideSheet(rings: Polygon[], sheetW: number, sheetH: number): boolean {
  const bb = bboxOfRings(rings);
  if (bb.minX < -SHEET_TOL || bb.minY < -SHEET_TOL) return false;
  if (bb.maxX > sheetW + SHEET_TOL || bb.maxY > sheetH + SHEET_TOL) return false;
  return shapeInsideSheet(rings, sheetW, sheetH, SHEET_TOL);
}

function bboxesOverlap(a: ReturnType<typeof bboxOf>, b: ReturnType<typeof bboxOf>): boolean {
  return !(a.maxX <= b.minX + SHEET_TOL || b.maxX <= a.minX + SHEET_TOL ||
           a.maxY <= b.minY + SHEET_TOL || b.maxY <= a.minY + SHEET_TOL);
}

function bboxesNear(a: ReturnType<typeof bboxOf>, b: ReturnType<typeof bboxOf>, tol: number): boolean {
  return !(a.maxX + tol < b.minX || b.maxX + tol < a.minX ||
           a.maxY + tol < b.minY || b.maxY + tol < a.minY);
}

function pointSegmentDistanceSq(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lenSq = vx * vx + vy * vy;
  if (lenSq <= 1e-12) return (p.x - a.x) ** 2 + (p.y - a.y) ** 2;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / lenSq));
  const x = a.x + t * vx;
  const y = a.y + t * vy;
  return (p.x - x) ** 2 + (p.y - y) ** 2;
}

function silhouetteContactLength(aRings: Polygon[], bRings: Polygon[], gap: number): number {
  const aOuter = aRings[0] ?? [];
  const bOuter = bRings[0] ?? [];
  if (aOuter.length < 2 || bOuter.length < 2) return 0;
  const tol = Math.max(SILHOUETTE_CONTACT_TOL, Math.max(0, gap) + SILHOUETTE_CONTACT_TOL);
  if (!bboxesNear(bboxOf(aOuter), bboxOf(bOuter), tol)) return 0;
  let total = 0;

  for (let i = 0, ai = aOuter.length - 1; i < aOuter.length; ai = i++) {
    const a0 = aOuter[ai], a1 = aOuter[i];
    const avx = a1.x - a0.x, avy = a1.y - a0.y;
    const aLen = Math.hypot(avx, avy);
    if (aLen <= SHEET_TOL) continue;
    const ux = avx / aLen, uy = avy / aLen;
    for (let j = 0, bj = bOuter.length - 1; j < bOuter.length; bj = j++) {
      const b0 = bOuter[bj], b1 = bOuter[j];
      const bvx = b1.x - b0.x, bvy = b1.y - b0.y;
      const bLen = Math.hypot(bvx, bvy);
      if (bLen <= SHEET_TOL) continue;
      const parallel = Math.abs((avx * bvx + avy * bvy) / (aLen * bLen));
      if (parallel < 0.9) continue;
      const nearEnough =
        pointSegmentDistanceSq(b0, a0, a1) <= tol * tol ||
        pointSegmentDistanceSq(b1, a0, a1) <= tol * tol ||
        pointSegmentDistanceSq(a0, b0, b1) <= tol * tol ||
        pointSegmentDistanceSq(a1, b0, b1) <= tol * tol;
      if (!nearEnough) continue;

      const aMin = 0;
      const aMax = aLen;
      const bProj0 = (b0.x - a0.x) * ux + (b0.y - a0.y) * uy;
      const bProj1 = (b1.x - a0.x) * ux + (b1.y - a0.y) * uy;
      const overlap = Math.max(0, Math.min(aMax, Math.max(bProj0, bProj1)) - Math.max(aMin, Math.min(bProj0, bProj1)));
      if (overlap > SILHOUETTE_CONTACT_TOL) total += Math.min(overlap, aLen, bLen);
    }
  }
  return total;
}

function hasSilhouetteContact(candidateRings: Polygon[], accepted: { rings: Polygon[] }[], gap: number): boolean {
  if (accepted.length === 0) return true;
  return accepted.some((placed) => silhouetteContactLength(candidateRings, placed.rings, gap) >= MIN_SILHOUETTE_CONTACT_LENGTH);
}

function diagnoseCandidateRejection(
  candidate: CandidatePlacement,
  accepted: { bb: ReturnType<typeof bboxOf>; rings: Polygon[]; gapRings: Polygon[] }[],
  sheetW: number,
  sheetH: number,
  sourceShape: DielineShape,
  forceBBox: boolean,
  gap: number,
  requireSilhouetteContact = true,
): AutoNestV2RejectReason | null {
  const candidateRings = candidateFootprint(candidate, sourceShape, forceBBox);
  if (!candidateInsideSheet(candidateRings, sheetW, sheetH)) return 'outside-sheet';
  const candidateGapRings = inflateRingsForGap(candidateRings, gap);
  if (!candidateInsideSheet(candidateGapRings, sheetW, sheetH)) return 'gap-violation';
  const cb = bboxOfRings(candidateRings);
  const cgb = bboxOfRings(candidateGapRings);
  for (const placed of accepted) {
    if (!bboxesOverlap(cb, placed.bb) && !bboxesOverlap(cgb, bboxOfRings(placed.gapRings))) continue;
    if (
      shapesOverlap(candidateRings, placed.rings) ||
      intersectionArea(candidateRings, placed.rings) > OVERLAP_AREA_EPS
    ) return 'overlap';
    if (
      gap > 0 &&
      (shapesOverlap(candidateGapRings, placed.gapRings) ||
        intersectionArea(candidateGapRings, placed.gapRings) > OVERLAP_AREA_EPS)
    ) return 'gap-violation';
  }
  if (!forceBBox && requireSilhouetteContact && !hasSilhouetteContact(candidateRings, accepted, gap)) {
    return 'no-silhouette-contact';
  }
  return null;
}

function validateCandidateSequence(
  candidates: CandidatePlacement[],
  sheetW: number,
  sheetH: number,
  sourceShape: DielineShape,
  forceBBox: boolean,
  gap = 0,
  debug?: AutoNestV2DebugSummary,
  requireSilhouetteContact = true,
): CandidatePlacement[] {
  const accepted: { c: CandidatePlacement; bb: ReturnType<typeof bboxOf>; rings: Polygon[]; gapRings: Polygon[] }[] = [];
  for (const candidate of candidates) {
    const candidateRings = candidateFootprint(candidate, sourceShape, forceBBox);
    if (!candidateInsideSheet(candidateRings, sheetW, sheetH)) {
      recordDebug(debug, false, { action: candidate.source === 'extra' ? 'gap-fill' : 'staggered-row', reason: 'outside-sheet', x: candidate.placement.x, y: candidate.placement.y, rotation: candidate.absoluteRotation });
      continue;
    }
    const candidateGapRings = inflateRingsForGap(candidateRings, gap);
    if (!candidateInsideSheet(candidateGapRings, sheetW, sheetH)) {
      recordDebug(debug, false, { action: candidate.source === 'extra' ? 'gap-fill' : 'staggered-row', reason: 'gap-violation', x: candidate.placement.x, y: candidate.placement.y, rotation: candidate.absoluteRotation });
      continue;
    }
    const cb = bboxOfRings(candidateRings);
    const cgb = bboxOfRings(candidateGapRings);
    let collides = false;
    let reason: AutoNestV2RejectReason = 'overlap';
    for (const placed of accepted) {
      if (!bboxesOverlap(cb, placed.bb) && !bboxesOverlap(cgb, bboxOfRings(placed.gapRings))) continue;
      if (
        shapesOverlap(candidateRings, placed.rings) ||
        intersectionArea(candidateRings, placed.rings) > OVERLAP_AREA_EPS
      ) {
        collides = true;
        reason = 'overlap';
        break;
      }
      if (
        gap > 0 &&
        (shapesOverlap(candidateGapRings, placed.gapRings) ||
          intersectionArea(candidateGapRings, placed.gapRings) > OVERLAP_AREA_EPS)
      ) {
        collides = true;
        reason = 'gap-violation';
        break;
      }
    }
    if (!collides && !forceBBox && requireSilhouetteContact && !hasSilhouetteContact(candidateRings, accepted, gap)) {
      collides = true;
      reason = 'no-silhouette-contact';
    }
    if (!collides) accepted.push({ c: candidate, bb: cb, rings: candidateRings, gapRings: candidateGapRings });
    else recordDebug(debug, false, { action: candidate.source === 'extra' ? 'gap-fill' : 'staggered-row', reason, x: candidate.placement.x, y: candidate.placement.y, rotation: candidate.absoluteRotation });
  }
  return accepted.map((a) => a.c);
}

function buildGridFallbackCandidates(
  sourceShape: DielineShape,
  sheetW: number,
  sheetH: number,
  gap: number,
  maxPieces: number,
): CandidatePlacement[] {
  const safeGap = Math.max(0, gap);
  const rotations: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270];
  let best: CandidatePlacement[] = [];

  for (const deg of rotations) {
    const rotatedShape = deg === 0 ? sourceShape : rotateShape(sourceShape, deg);
    const w = Math.max(0, rotatedShape.width);
    const h = Math.max(0, rotatedShape.height);
    if (w <= SHEET_TOL || h <= SHEET_TOL || w > sheetW + SHEET_TOL || h > sheetH + SHEET_TOL) continue;

    const stepX = w + safeGap;
    const stepY = h + safeGap;
    const cols = Math.max(0, Math.floor((sheetW + safeGap + SHEET_TOL) / stepX));
    const rows = Math.max(0, Math.floor((sheetH + safeGap + SHEET_TOL) / stepY));
    const candidates: CandidatePlacement[] = [];

    for (let row = 0; row < rows && candidates.length < maxPieces; row++) {
      for (let col = 0; col < cols && candidates.length < maxPieces; col++) {
        const x = col * stepX;
        const y = row * stepY;
        const rings = translateRings(rotatedShape.rings, x, y);
        candidates.push({
          placement: { x, y, rotation: deg === 90 || deg === 270 ? 90 : 0, rings },
          absoluteRotation: deg,
          source: 'base',
        });
      }
    }

    if (candidates.length > best.length) best = candidates;
  }

  return best;
}

function estimateFlapOffsetPercent(shape: DielineShape): number | null {
  const bb = bboxOfRings(shape.rings);
  const w = Math.max(1e-6, bb.maxX - bb.minX);
  const h = Math.max(1e-6, bb.maxY - bb.minY);
  const polyArea = Math.max(0, shape.rings.reduce((sum, ring) => sum + Math.abs(polygonArea(ring)), 0));
  const equivalentW = polyArea > 0 ? Math.min(w, polyArea / h) : 0;
  const sidePocket = Math.max(0, (w - equivalentW) / 2);
  if (sidePocket <= SHEET_TOL) return null;
  return Math.max(8, Math.min(35, (sidePocket / 2 / w) * 100));
}

function buildStaggeredRowCandidates(
  sourceShape: DielineShape,
  baseRotation: 0 | 90 | 180 | 270,
  sheetW: number,
  sheetH: number,
  gap: number,
  offsetPercent: number,
  maxPieces: number,
  alternateFlip: boolean,
  verticalFactor: number,
): CandidatePlacement[] {
  const rotatedBase = baseRotation === 0 ? sourceShape : rotateShape(sourceShape, baseRotation);
  const bb = bboxOfRings(rotatedBase.rings);
  const w = Math.max(0, bb.maxX - bb.minX) || sourceShape.width;
  const h = Math.max(0, bb.maxY - bb.minY) || sourceShape.height;
  const safeGap = Math.max(0, gap);
  if (w <= SHEET_TOL || h <= SHEET_TOL || w > sheetW + SHEET_TOL || h > sheetH + SHEET_TOL) return [];

  const rowStep = Math.max(h * 0.55, (h + safeGap) * verticalFactor);
  const colStep = Math.max(w * 0.45, w + safeGap);
  const rowOffset = Math.max(0, (offsetPercent / 100) * w);
  const candidates: CandidatePlacement[] = [];
  const maxRows = Math.ceil((sheetH + safeGap) / Math.max(rowStep, 0.01)) + 2;
  const maxCols = Math.ceil((sheetW + safeGap + rowOffset) / Math.max(colStep, 0.01)) + 2;

  for (let row = 0; row < maxRows && candidates.length < maxPieces; row++) {
    const y = row * rowStep;
    const shifted = row % 2 === 1;
    const startX = shifted ? -rowOffset : 0;
    const absRot = addRotation(baseRotation, alternateFlip && shifted ? 180 : 0);
    for (let col = 0; col < maxCols && candidates.length < maxPieces; col++) {
      const x = startX + col * colStep;
      candidates.push(buildCandidateAt(sourceShape, absRot, x, y, 'base'));
    }
  }
  return candidates;
}

function buildBestStaggeredScenario(
  sourceShape: DielineShape,
  baseRotation: 0 | 90 | 180 | 270,
  sheetW: number,
  sheetH: number,
  gap: number,
  forceBBox: boolean,
  upperBound: number,
  debug: AutoNestV2DebugSummary,
): CandidatePlacement[] {
  const baseOffsets = [10, 15, 20, 25, 30];
  const inferred = estimateFlapOffsetPercent(sourceShape);
  const offsets = Array.from(new Set([...baseOffsets, ...(inferred ? [Number(inferred.toFixed(1))] : [])]));
  debug.staggeredOffsetsTried = offsets;
  let best: CandidatePlacement[] = [];
  const usageOf = (cs: CandidatePlacement[]) => cs.reduce((s, c) => s + bboxAreaOf(bboxOfRings(c.placement.rings)), 0);

  for (const offsetPercent of offsets) {
    for (const alternateFlip of [false, true]) {
      for (const verticalFactor of [1, 0.95, 0.9, 0.85, 0.8]) {
        const raw = buildStaggeredRowCandidates(
          sourceShape,
          baseRotation,
          sheetW,
          sheetH,
          gap,
          offsetPercent,
          upperBound,
          alternateFlip,
          verticalFactor,
        );
        if (raw.length === 0) {
          recordDebug(debug, false, { action: 'staggered-row', reason: 'insufficient-space', offsetPercent });
          continue;
        }
        const valid = validateCandidateSequence(raw, sheetW, sheetH, sourceShape, forceBBox, gap, debug);
        if (valid.length === 0) {
          recordDebug(debug, false, { action: 'staggered-row', reason: 'insufficient-space', offsetPercent });
          continue;
        }
        if (valid.length > best.length || (valid.length === best.length && usageOf(valid) > usageOf(best) + 1e-6)) {
          best = valid;
          recordDebug(debug, true, { action: 'staggered-row', offsetPercent, rotation: alternateFlip ? 180 : 0 });
        } else if (valid.length < best.length) {
          recordDebug(debug, false, { action: 'staggered-row', reason: 'no-count-improvement', offsetPercent });
        } else {
          recordDebug(debug, false, { action: 'staggered-row', reason: 'no-usage-improvement', offsetPercent });
        }
      }
    }
  }
  return best;
}

/* ───────────── Post-Optimization (per-piece shifts + 180° flip) ─────────────
 * After the main NFP+gap-fill pass, we run several iterations that:
 *   1. For every placed copy, try small grid shifts toward bottom-left and a
 *      whole-piece 180° rotation, accepting the move only if it stays valid
 *      (no overlap, inside sheet, gap respected) AND compacts the layout
 *      (decreases x+y of that piece).
 *   2. After compacting, try inserting extra copies into the freed gaps via
 *      `fillGapsWithRotations` (4 cardinal rotations).
 * The dieline stays a single block — only whole copies are shifted/rotated.
 * Final pick = highest count, then lowest waste (highest usage).
 */

function buildCandidateAt(
  sourceShape: DielineShape,
  absRot: 0 | 90 | 180 | 270,
  x: number,
  y: number,
  source: 'base' | 'extra',
  mirrored = false,
): CandidatePlacement {
  const rotated = absRot === 0 ? sourceShape : rotateShape(sourceShape, absRot);
  const baseRings = mirrored ? mirrorRingsX(rotated.rings, rotated.width) : rotated.rings;
  const rings = translateRings(baseRings, x, y);
  return {
    placement: { x, y, rotation: absRot % 180 === 90 ? 90 : 0, rings },
    absoluteRotation: absRot,
    source,
    mirrored: mirrored || undefined,
  };
}

function tryCompactPiece(
  current: CandidatePlacement[],
  idx: number,
  sourceShape: DielineShape,
  sheetW: number,
  sheetH: number,
  forceBBox: boolean,
  gap: number,
  debug?: AutoNestV2DebugSummary,
): CandidatePlacement[] | null {
  const cur = current[idx];
  const step = Math.max(0.05, (gap || 0.2));
  const offsets: Array<[number, number]> = [];
  for (const sx of [-2, -1, 0, 1, 2]) {
    for (const sy of [-2, -1, 0, 1, 2]) {
      if (sx === 0 && sy === 0) continue;
      offsets.push([sx * step, sy * step]);
    }
  }
  // Bias toward bottom-left compaction.
  offsets.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));

  const flipped = ((cur.absoluteRotation + 180) % 360) as 0 | 90 | 180 | 270;
  const rots: (0 | 90 | 180 | 270)[] = [cur.absoluteRotation, flipped];
  const oldScore = cur.placement.x + cur.placement.y;
  const otherPlaced = current
    .filter((_, j) => j !== idx)
    .map((c) => {
      const rings = candidateFootprint(c, sourceShape, forceBBox);
      return { bb: bboxOfRings(rings), rings, gapRings: inflateRingsForGap(rings, gap) };
    });

  for (const rot of rots) {
    for (const [dx, dy] of offsets) {
      const action = rot === cur.absoluteRotation ? 'shift' : 'rotate-180';
      const x = cur.placement.x + dx;
      const y = cur.placement.y + dy;
      if (x < -SHEET_TOL || y < -SHEET_TOL) {
        recordDebug(debug, false, { action, pieceIndex: idx + 1, reason: 'outside-sheet', dx, dy, rotation: rot });
        continue;
      }
      if ((x + y) >= oldScore - 1e-3 && rot === cur.absoluteRotation) {
        recordDebug(debug, false, { action, pieceIndex: idx + 1, reason: 'not-compacting', dx, dy, rotation: rot });
        continue;
      }
      const candidate = buildCandidateAt(sourceShape, rot, x, y, cur.source, cur.mirrored);
      const reason = diagnoseCandidateRejection(candidate, otherPlaced, sheetW, sheetH, sourceShape, forceBBox, gap);
      if (reason) {
        recordDebug(debug, false, { action, pieceIndex: idx + 1, reason, dx, dy, x, y, rotation: rot });
        continue;
      }
      const next = current.slice();
      next[idx] = candidate;
      const valid = validateCandidateSequence(next, sheetW, sheetH, sourceShape, forceBBox, gap);
      if (valid.length === next.length) {
        recordDebug(debug, true, { action, pieceIndex: idx + 1, dx, dy, x, y, rotation: rot });
        if (!debug?.movedPieces.includes(idx + 1)) debug?.movedPieces.push(idx + 1);
        if (action === 'rotate-180' && !debug?.rotated180Pieces.includes(idx + 1)) debug?.rotated180Pieces.push(idx + 1);
        return valid;
      }
      recordDebug(debug, false, { action, pieceIndex: idx + 1, reason: 'overlap', dx, dy, x, y, rotation: rot });
    }
  }
  return null;
}

function refillGapsExtras(
  orientShape: DielineShape,
  orientDeg: 0 | 90 | 180 | 270,
  current: CandidatePlacement[],
  sourceShape: DielineShape,
  sheetW: number,
  sheetH: number,
  gap: number,
  forceBBox: boolean,
  remaining: number,
  debug?: AutoNestV2DebugSummary,
): CandidatePlacement[] {
  if (remaining <= 0) {
    recordDebug(debug, false, { action: 'gap-fill', reason: 'insufficient-space' });
    return current;
  }
  try {
    const extras = fillGapsWithRotations(
      orientShape,
      sheetW,
      sheetH,
      current.map((c) => c.placement),
      { gap, fast: true, maxExtra: remaining },
    );
    if (extras.length === 0) {
      recordDebug(debug, false, { action: 'gap-fill', reason: 'insufficient-space' });
      return current;
    }
    const merged: CandidatePlacement[] = [
      ...current,
      ...extras.map((e) => ({
        placement: e.placement,
        absoluteRotation: addRotation(orientDeg, e.rotation),
        source: 'extra' as const,
      })),
    ];
    const valid = validateCandidateSequence(merged, sheetW, sheetH, sourceShape, forceBBox, gap, debug);
    if (valid.length > current.length) {
      recordDebug(debug, true, { action: 'gap-fill' });
      return valid;
    }
    recordDebug(debug, false, { action: 'gap-fill', reason: 'no-count-improvement' });
    return current;
  } catch {
    recordDebug(debug, false, { action: 'gap-fill', reason: 'insufficient-space' });
    return current;
  }
}

function postOptimize(
  initial: CandidatePlacement[],
  orientShape: DielineShape,
  orientDeg: 0 | 90 | 180 | 270,
  sourceShape: DielineShape,
  sheetW: number,
  sheetH: number,
  gap: number,
  forceBBox: boolean,
  upperBound: number,
  iterations: number,
  deadline: number,
  debug?: AutoNestV2DebugSummary,
): CandidatePlacement[] {
  const sheetArea = Math.max(1e-6, sheetW * sheetH);
  const usageOf = (cs: CandidatePlacement[]) => {
    const used = cs.reduce((s, c) => {
      const bb = bboxOfRings(c.placement.rings);
      return s + (bb.maxX - bb.minX) * (bb.maxY - bb.minY);
    }, 0);
    return used / sheetArea;
  };
  const better = (a: CandidatePlacement[], b: CandidatePlacement[]) =>
    a.length > b.length || (a.length === b.length && usageOf(a) > usageOf(b) + 1e-6);

  let cur = initial.slice();
  let best = cur;

  for (let it = 0; it < iterations; it++) {
    if (Date.now() > deadline) break;
    if (debug) debug.postIterations = it + 1;
    let changed = false;

    // 1) Compact each piece (shift + 180° flip toward bottom-left).
    // Process pieces from top-right down so we open room on the bottom-left.
    const order = cur
      .map((_, i) => i)
      .sort((a, b) => (cur[b].placement.x + cur[b].placement.y) - (cur[a].placement.x + cur[a].placement.y));
    for (const i of order) {
      if (Date.now() > deadline) break;
      const moved = tryCompactPiece(cur, i, sourceShape, sheetW, sheetH, forceBBox, gap, debug);
      if (moved) {
        cur = moved;
        changed = true;
      }
    }

    // 2) Try to insert extras into freed gaps.
    const beforeFill = cur.length;
    cur = refillGapsExtras(
      orientShape,
      orientDeg,
      cur,
      sourceShape,
      sheetW,
      sheetH,
      gap,
      forceBBox,
      Math.max(0, upperBound - cur.length),
      debug,
    );
    if (cur.length > beforeFill) changed = true;

    if (better(cur, best)) best = cur;
    if (!changed) break;
  }

  return best;
}

/* ───────────── Local Search / Iterative Improvement ─────────────
 * Mimics how an operator nudges a manual layout to gain extra copies:
 *   A) Row/column shifts — slide whole rows or columns by small offsets to
 *      open a continuous pocket on one side, then re-fill.
 *   B) Pocket grid scan — scan the sheet on a fine grid and try inserting
 *      a copy at every (x, y) with all 4 rotations, accepting the first
 *      valid spot. Catches pockets the NFP bottom-left heuristic skips.
 *   C) Perturbation — remove the K most "top-right" pieces and try re-fill
 *      using grid-scan; accept only if final count beats the start.
 * Every accepted move re-runs the strict polygon validator.
 */

function groupRows(current: CandidatePlacement[], rowTol: number): number[][] {
  const indexed = current.map((c, i) => ({ i, y: bboxOfRings(c.placement.rings).minY }));
  indexed.sort((a, b) => a.y - b.y);
  const groups: number[][] = [];
  let cur: { y: number; idx: number[] } | null = null;
  for (const item of indexed) {
    if (!cur || Math.abs(item.y - cur.y) > rowTol) {
      cur = { y: item.y, idx: [item.i] };
      groups.push(cur.idx);
    } else {
      cur.idx.push(item.i);
    }
  }
  return groups;
}

function groupCols(current: CandidatePlacement[], colTol: number): number[][] {
  const indexed = current.map((c, i) => ({ i, x: bboxOfRings(c.placement.rings).minX }));
  indexed.sort((a, b) => a.x - b.x);
  const groups: number[][] = [];
  let cur: { x: number; idx: number[] } | null = null;
  for (const item of indexed) {
    if (!cur || Math.abs(item.x - cur.x) > colTol) {
      cur = { x: item.x, idx: [item.i] };
      groups.push(cur.idx);
    } else {
      cur.idx.push(item.i);
    }
  }
  return groups;
}

function tryShiftGroup(
  current: CandidatePlacement[],
  indices: number[],
  dx: number,
  dy: number,
  sourceShape: DielineShape,
  sheetW: number,
  sheetH: number,
  forceBBox: boolean,
  gap: number,
): CandidatePlacement[] | null {
  const next = current.slice();
  for (const i of indices) {
    const c = current[i];
    const nx = c.placement.x + dx;
    const ny = c.placement.y + dy;
    if (nx < -SHEET_TOL || ny < -SHEET_TOL) return null;
    next[i] = buildCandidateAt(sourceShape, c.absoluteRotation, nx, ny, c.source, c.mirrored);
  }
  const valid = validateCandidateSequence(next, sheetW, sheetH, sourceShape, forceBBox, gap);
  return valid.length === next.length ? valid : null;
}

/**
 * Slide-to-Contact (Snap)
 * ───────────────────────
 * Pushes a candidate piece toward (-x), (-y), and (-x,-y) until its real
 * SVG cut boundary just touches a neighbor's real boundary (or the sheet
 * edge / gap envelope). Uses binary search on the strict polygon validator
 * so the result respects:
 *   • no real polygon overlap (OVERLAP_AREA_EPS)
 *   • gap distance (when gap > 0)
 *   • sheet bounds
 * Net effect: zero residual whitespace between visible drawing edges, while
 * the engine still refuses anything that would cross a cut line.
 */
function slideToContact(
  cand: CandidatePlacement,
  accepted: { bb: ReturnType<typeof bboxOf>; rings: Polygon[]; gapRings: Polygon[] }[],
  sheetW: number,
  sheetH: number,
  sourceShape: DielineShape,
  forceBBox: boolean,
  gap: number,
): CandidatePlacement {
  const dirs: Array<[number, number]> = [[-1, 0], [0, -1], [-1, -1], [1, 0], [0, 1]];
  let best = cand;
  const isValid = (c: CandidatePlacement): boolean => {
    const rings = candidateFootprint(c, sourceShape, forceBBox);
    if (!candidateInsideSheet(rings, sheetW, sheetH)) return false;
    return diagnoseCandidateRejection(c, accepted, sheetW, sheetH, sourceShape, forceBBox, gap, false) === null;
  };
  for (const [dx, dy] of dirs) {
    // Exponential probe to find a failing distance.
    let validDist = 0;
    let failDist = 0;
    let step = 0.1;
    const maxReach = Math.max(sheetW, sheetH);
    while (step <= maxReach) {
      const test = buildCandidateAt(
        sourceShape,
        best.absoluteRotation,
        best.placement.x + dx * step,
        best.placement.y + dy * step,
        best.source,
        best.mirrored,
      );
      if (isValid(test)) {
        validDist = step;
        step *= 2;
      } else {
        failDist = step;
        break;
      }
    }
    if (failDist === 0) continue; // never failed → we hit sheet limit
    // Binary search the contact point.
    for (let it = 0; it < 22; it++) {
      const mid = (validDist + failDist) / 2;
      if (failDist - validDist < 1e-3) break;
      const test = buildCandidateAt(
        sourceShape,
        best.absoluteRotation,
        best.placement.x + dx * mid,
        best.placement.y + dy * mid,
        best.source,
        best.mirrored,
      );
      if (isValid(test)) validDist = mid;
      else failDist = mid;
    }
    if (validDist > 1e-4) {
      best = buildCandidateAt(
        sourceShape,
        best.absoluteRotation,
        best.placement.x + dx * validDist,
        best.placement.y + dy * validDist,
        best.source,
        best.mirrored,
      );
    }
  }
  return best;
}

function pocketGridInsert(
  current: CandidatePlacement[],
  sourceShape: DielineShape,
  sheetW: number,
  sheetH: number,
  forceBBox: boolean,
  gap: number,
  upperBound: number,
  deadline: number,
  debug?: AutoNestV2DebugSummary,
): CandidatePlacement[] {
  if (current.length >= upperBound) return current;
  const refBB = bboxOfRings(sourceShape.rings);
  const refW = Math.max(1e-3, refBB.maxX - refBB.minX);
  const refH = Math.max(1e-3, refBB.maxY - refBB.minY);
  // Finer step → catches narrow channels between rigid columns that
  // the previous 18% step would skip over.
  const stepX = Math.max(0.15, Math.min(refW, refH) * 0.10);
  const stepY = stepX;
  const rotations: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270];

  let result = current.slice();
  let added = 0;
  const maxAdd = upperBound - current.length;

  // Build accepted footprint cache once and update incrementally.
  const accepted = result.map((c) => {
    const rings = candidateFootprint(c, sourceShape, forceBBox);
    return { bb: bboxOfRings(rings), rings, gapRings: inflateRingsForGap(rings, gap) };
  });

  for (let y = 0; y <= sheetH && added < maxAdd; y += stepY) {
    if (Date.now() > deadline) break;
    for (let x = 0; x <= sheetW && added < maxAdd; x += stepX) {
      let placed = false;
      for (const rot of rotations) {
        const cand = buildCandidateAt(sourceShape, rot, x, y, 'extra');
        const reason = diagnoseCandidateRejection(cand, accepted, sheetW, sheetH, sourceShape, forceBBox, gap, false);
        if (reason) continue;
        // Snap toward existing pieces / sheet edges so the visible drawing
        // boundary touches a neighbor's drawing boundary exactly.
        const snapped = slideToContact(cand, accepted, sheetW, sheetH, sourceShape, forceBBox, gap);
        // Final strict check via full sequence (in case of subtle ordering issues).
        const next = [...result, snapped];
        const valid = validateCandidateSequence(next, sheetW, sheetH, sourceShape, forceBBox, gap);
        if (valid.length === next.length) {
          result = valid;
          const rings = candidateFootprint(snapped, sourceShape, forceBBox);
          accepted.push({ bb: bboxOfRings(rings), rings, gapRings: inflateRingsForGap(rings, gap) });
          added++;
          recordDebug(debug, true, { action: 'gap-fill', x: snapped.placement.x, y: snapped.placement.y, rotation: rot });
          placed = true;
          break;
        }
      }
      if (placed) continue;
    }
  }
  return result;
}

/**
 * Contact-Based Local Packing — يحاول وضع نسخ جديدة عند نقاط تماس حقيقية
 * مع القطع الموضوعة سابقًا (يمين/يسار/فوق/تحت)، مع انزلاق تدريجي نحو القطعة
 * لاستغلال فراغات الأغطية والألسنة (concavities) في SVG الحقيقي.
 * يجرب التدوير 0° و180° فقط (نسخة كاملة، بدون تغيير شكل القالب).
 */
function contactBasedInsert(
  current: CandidatePlacement[],
  sourceShape: DielineShape,
  sheetW: number,
  sheetH: number,
  forceBBox: boolean,
  gap: number,
  upperBound: number,
  deadline: number,
  debug?: AutoNestV2DebugSummary,
): CandidatePlacement[] {
  if (current.length >= upperBound) return current;
  const refBB = bboxOfRings(sourceShape.rings);
  const refW = Math.max(1e-3, refBB.maxX - refBB.minX);
  const refH = Math.max(1e-3, refBB.maxY - refBB.minY);

  // Slide-in distances: start farther then push closer to exploit pockets.
  const slideOffsets = [
    Math.max(0, gap),
    Math.max(0, gap) + 0.05,
    Math.max(0, gap) - 0.02,
    -0.05,
    -0.1,
    -0.18,
    -0.28,
    -0.4,
    -0.55,
  ];
  // Perpendicular slides along the contact edge, as a fraction of dieline size.
  const perpFracs = [0, 0.08, -0.08, 0.16, -0.16, 0.25, -0.25, 0.33, -0.33, 0.45, -0.45];
  const rotations: (0 | 90 | 180 | 270)[] = [0, 180, 90, 270];

  let result = current.slice();
  const accepted = result.map((c) => {
    const rings = candidateFootprint(c, sourceShape, forceBBox);
    return { bb: bboxOfRings(rings), rings, gapRings: inflateRingsForGap(rings, gap) };
  });
  let added = 0;
  const maxAdd = upperBound - current.length;

  // Anchor list: existing piece bboxes + sheet edges (so first piece can anchor to sheet too).
  const anchors = result.map((_, i) => i);

  // Side enumeration: 0=right, 1=left, 2=top, 3=bottom.
  const sides: Array<0 | 1 | 2 | 3> = [0, 2, 1, 3];

  for (const ai of anchors) {
    if (added >= maxAdd || Date.now() > deadline) break;
    const aBB = accepted[ai].bb;
    for (const side of sides) {
      if (added >= maxAdd || Date.now() > deadline) break;
      for (const rot of rotations) {
        if (added >= maxAdd || Date.now() > deadline) break;
        // Compute candidate bbox size for this rotation.
        const rotated = rot === 0 ? sourceShape : rotateShape(sourceShape, rot);
        const cw = Math.max(1e-3, rotated.width);
        const ch = Math.max(1e-3, rotated.height);
        for (const perpFrac of perpFracs) {
          if (added >= maxAdd || Date.now() > deadline) break;
          let placedHere = false;
          for (const off of slideOffsets) {
            let x = 0, y = 0;
            if (side === 0) {
              // right of anchor
              x = aBB.maxX + off;
              y = aBB.minY + perpFrac * refH;
            } else if (side === 1) {
              // left of anchor
              x = aBB.minX - cw - off;
              y = aBB.minY + perpFrac * refH;
            } else if (side === 2) {
              // above anchor
              x = aBB.minX + perpFrac * refW;
              y = aBB.maxY + off;
            } else {
              // below anchor
              x = aBB.minX + perpFrac * refW;
              y = aBB.minY - ch - off;
            }
            if (x < -SHEET_TOL || y < -SHEET_TOL) continue;
            if (x + cw > sheetW + SHEET_TOL || y + ch > sheetH + SHEET_TOL) continue;
            const cand = buildCandidateAt(sourceShape, rot, x, y, 'extra');
            const reason = diagnoseCandidateRejection(cand, accepted, sheetW, sheetH, sourceShape, forceBBox, gap, false);
            if (reason) continue;
            // Snap to contact: push toward neighbors so visible drawing edges
            // touch exactly with no residual whitespace.
            const snapped = slideToContact(cand, accepted, sheetW, sheetH, sourceShape, forceBBox, gap);
            const next = [...result, snapped];
            const valid = validateCandidateSequence(next, sheetW, sheetH, sourceShape, forceBBox, gap);
            if (valid.length === next.length) {
              result = valid;
              const rings = candidateFootprint(snapped, sourceShape, forceBBox);
              accepted.push({ bb: bboxOfRings(rings), rings, gapRings: inflateRingsForGap(rings, gap) });
              added++;
              recordDebug(debug, true, { action: 'gap-fill', x: snapped.placement.x, y: snapped.placement.y, rotation: rot });
              placedHere = true;
              break;
            }
          }
          if (placedHere) {
            // After placing one, try another at the same anchor/side/rot/perp combo
            // (cascade fill) — but break this perp loop to move on, the new piece
            // will be re-scanned in the next outer call.
            break;
          }
        }
      }
    }
  }
  return result;
}

/**
 * Negative-Space Exploitation
 * ───────────────────────────
 * Builds a coarse occupancy raster of the sheet from real polygon footprints,
 * groups contiguous free cells into "pockets" via flood-fill, then for each
 * pocket centroid tries to drop a copy with all 4 rotations + snap-to-contact.
 *
 * Unlike `pocketGridInsert` which marches in raster order from (0,0) — and
 * therefore tends to keep aligning copies into the same vertical columns —
 * this pass attacks the largest unused regions first, which lets it break
 * column alignment and slide pieces into mid-sheet pockets that the column
 * heuristic skips.
 */
function negativeSpaceExploit(
  current: CandidatePlacement[],
  sourceShape: DielineShape,
  sheetW: number,
  sheetH: number,
  forceBBox: boolean,
  gap: number,
  upperBound: number,
  deadline: number,
  debug?: AutoNestV2DebugSummary,
): CandidatePlacement[] {
  if (current.length >= upperBound) return current;
  const refBB = bboxOfRings(sourceShape.rings);
  const refW = Math.max(1e-3, refBB.maxX - refBB.minX);
  const refH = Math.max(1e-3, refBB.maxY - refBB.minY);

  // Raster cell ≈ 8% of the smaller piece dimension → fine enough to detect
  // narrow channels between columns, coarse enough to stay fast.
  const cell = Math.max(0.2, Math.min(refW, refH) * 0.08);
  const cols = Math.max(2, Math.ceil(sheetW / cell));
  const rows = Math.max(2, Math.ceil(sheetH / cell));

  let result = current.slice();
  const accepted = result.map((c) => {
    const rings = candidateFootprint(c, sourceShape, forceBBox);
    return { bb: bboxOfRings(rings), rings, gapRings: inflateRingsForGap(rings, gap) };
  });

  // 1) Build occupancy grid using bbox of real footprints (cheap & sufficient
  //    to find pockets — refinement happens through the strict polygon check
  //    when we actually try to insert).
  const buildOccupancy = () => {
    const occ = new Uint8Array(cols * rows);
    for (const a of accepted) {
      const c0 = Math.max(0, Math.floor(a.bb.minX / cell));
      const c1 = Math.min(cols - 1, Math.floor(a.bb.maxX / cell));
      const r0 = Math.max(0, Math.floor(a.bb.minY / cell));
      const r1 = Math.min(rows - 1, Math.floor(a.bb.maxY / cell));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) occ[r * cols + c] = 1;
      }
    }
    return occ;
  };

  // 2) Flood-fill → list of pockets (free cell groups), sorted largest first.
  const findPockets = (occ: Uint8Array) => {
    const visited = new Uint8Array(cols * rows);
    const pockets: { cells: number; cx: number; cy: number; minC: number; minR: number; maxC: number; maxR: number }[] = [];
    const stack: number[] = [];
    for (let i = 0; i < occ.length; i++) {
      if (occ[i] || visited[i]) continue;
      stack.length = 0;
      stack.push(i);
      let cells = 0, sumX = 0, sumY = 0;
      let minC = cols, minR = rows, maxC = -1, maxR = -1;
      while (stack.length) {
        const idx = stack.pop()!;
        if (visited[idx] || occ[idx]) continue;
        visited[idx] = 1;
        const r = Math.floor(idx / cols);
        const c = idx - r * cols;
        cells++; sumX += c; sumY += r;
        if (c < minC) minC = c; if (r < minR) minR = r;
        if (c > maxC) maxC = c; if (r > maxR) maxR = r;
        if (c > 0) stack.push(idx - 1);
        if (c < cols - 1) stack.push(idx + 1);
        if (r > 0) stack.push(idx - cols);
        if (r < rows - 1) stack.push(idx + cols);
      }
      if (cells >= 2) {
        pockets.push({ cells, cx: (sumX / cells) * cell, cy: (sumY / cells) * cell, minC, minR, maxC, maxR });
      }
    }
    pockets.sort((a, b) => b.cells - a.cells);
    return pockets;
  };

  const rotations: (0 | 90 | 180 | 270)[] = [0, 180, 90, 270];
  let added = 0;
  const maxAdd = upperBound - current.length;

  // Several passes: each placement reshapes pockets, so re-derive them.
  for (let pass = 0; pass < 5; pass++) {
    if (added >= maxAdd || Date.now() > deadline) break;
    const occ = buildOccupancy();
    const pockets = findPockets(occ);
    if (pockets.length === 0) break;
    let progressedThisPass = false;

    for (const pk of pockets) {
      if (added >= maxAdd || Date.now() > deadline) break;
      // Try several anchor points within the pocket so concave pockets get
      // attacked from multiple angles.
      const anchors: Array<[number, number]> = [
        [pk.cx, pk.cy],
        [pk.minC * cell, pk.minR * cell],
        [pk.maxC * cell - refW * 0.5, pk.minR * cell],
        [pk.minC * cell, pk.maxR * cell - refH * 0.5],
        [pk.cx - refW * 0.5, pk.cy - refH * 0.5],
      ];
      let placedInPocket = false;
      for (const [ax, ay] of anchors) {
        if (placedInPocket) break;
        for (const rot of rotations) {
          const rotShape = rot === 0 ? sourceShape : rotateShape(sourceShape, rot);
          // Center the candidate roughly on the anchor.
          const x = Math.max(0, ax - rotShape.width / 2);
          const y = Math.max(0, ay - rotShape.height / 2);
          if (x + rotShape.width > sheetW + SHEET_TOL) continue;
          if (y + rotShape.height > sheetH + SHEET_TOL) continue;
          const cand = buildCandidateAt(sourceShape, rot, x, y, 'extra');
          const reason = diagnoseCandidateRejection(cand, accepted, sheetW, sheetH, sourceShape, forceBBox, gap, false);
          if (reason) continue;
          const snapped = slideToContact(cand, accepted, sheetW, sheetH, sourceShape, forceBBox, gap);
          const next = [...result, snapped];
          const valid = validateCandidateSequence(next, sheetW, sheetH, sourceShape, forceBBox, gap);
          if (valid.length === next.length) {
            result = valid;
            const rings = candidateFootprint(snapped, sourceShape, forceBBox);
            accepted.push({ bb: bboxOfRings(rings), rings, gapRings: inflateRingsForGap(rings, gap) });
            added++;
            recordDebug(debug, true, { action: 'gap-fill', x: snapped.placement.x, y: snapped.placement.y, rotation: rot });
            placedInPocket = true;
            progressedThisPass = true;
            break;
          }
        }
      }
    }
    if (!progressedThisPass) break;
  }
  return result;
}

/**
 * Column-Flip Seed
 * ────────────────
 * Builds a starting layout where every OTHER column is rotated 180°, so flap
 * pockets of one column interlock with flap protrusions of the next.
 * Mimics how an operator manually breaks rigid column alignment for box
 * dielines that have asymmetric top/bottom flaps.
 */
function buildColumnFlipSeed(
  sourceShape: DielineShape,
  sheetW: number,
  sheetH: number,
  gap: number,
  forceBBox: boolean,
  upperBound: number,
  debug?: AutoNestV2DebugSummary,
): CandidatePlacement[] {
  const safeGap = Math.max(0, gap);
  const variants: Array<{ baseRot: 0 | 90 | 180 | 270; flipRot: 0 | 90 | 180 | 270 }> = [
    { baseRot: 0, flipRot: 180 },
    { baseRot: 90, flipRot: 270 },
  ];
  let best: CandidatePlacement[] = [];

  for (const v of variants) {
    const baseShape = v.baseRot === 0 ? sourceShape : rotateShape(sourceShape, v.baseRot);
    const flipShape = rotateShape(sourceShape, v.flipRot as 90 | 180 | 270);
    const bw = baseShape.width, bh = baseShape.height;
    const fw = flipShape.width, fh = flipShape.height;
    if (bw <= 0 || bh <= 0 || fw <= 0 || fh <= 0) continue;
    // Try several column-overlap factors — negative means columns interlock
    // (their flaps sit inside neighbor pockets).
    for (const overlapFrac of [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3]) {
      const colStep = Math.max(0.5, ((bw + fw) / 2) - overlapFrac * Math.min(bw, fw) + safeGap);
      const candidates: CandidatePlacement[] = [];
      for (let col = 0; ; col++) {
        const isFlip = col % 2 === 1;
        const w = isFlip ? fw : bw, h = isFlip ? fh : bh;
        const x = col * colStep;
        if (x + w > sheetW + SHEET_TOL) break;
        const rowStep = h + safeGap;
        for (let row = 0; ; row++) {
          const y = row * rowStep;
          if (y + h > sheetH + SHEET_TOL) break;
          const rot = isFlip ? v.flipRot : v.baseRot;
          candidates.push(buildCandidateAt(sourceShape, rot, x, y, 'base'));
          if (candidates.length >= upperBound) break;
        }
        if (candidates.length >= upperBound) break;
      }
      const valid = validateCandidateSequence(candidates, sheetW, sheetH, sourceShape, forceBBox, gap, debug);
      if (valid.length > best.length) best = valid;
    }
  }
  return best;
}

/**
 * Column-Mirror Seed
 * ──────────────────
 * Like `buildColumnFlipSeed` but uses true horizontal mirroring (scaleX(-1))
 * instead of 180° rotation for alternating columns. Mirroring keeps the
 * top/bottom flap orientation but swaps left/right flaps so a flap protruding
 * to the right of column N can sit inside the (now mirrored) left-side
 * pocket of column N+1 — exactly the manual operator's "head-to-head"
 * interlocking pattern. Tries 0° and 90° base rotations and a range of
 * column-overlap fractions; keeps the densest valid layout.
 */
function buildColumnMirrorSeed(
  sourceShape: DielineShape,
  sheetW: number,
  sheetH: number,
  gap: number,
  forceBBox: boolean,
  upperBound: number,
  debug?: AutoNestV2DebugSummary,
): CandidatePlacement[] {
  const safeGap = Math.max(0, gap);
  const baseRots: (0 | 90)[] = [0, 90];
  let best: CandidatePlacement[] = [];

  for (const baseRot of baseRots) {
    const baseShape = baseRot === 0 ? sourceShape : rotateShape(sourceShape, baseRot);
    const w = baseShape.width;
    const h = baseShape.height;
    if (w <= SHEET_TOL || h <= SHEET_TOL || w > sheetW + SHEET_TOL || h > sheetH + SHEET_TOL) continue;

    // Mirroring keeps width identical, but the gain is a real physical
    // side-shift measured in cm: adjacent outer tongues may enter the
    // neighbor's SVG pockets as long as the true cut boundaries don't overlap.
    // Adaptive colStep — see below.

    // Adaptive colStep — derive the actual minimum centre-to-centre column
    // distance so the real SVG silhouettes of two adjacent (base ↔ mirrored)
    // pieces just touch (with safeGap clearance). No fixed steps, no
    // overlapCm list: binary-search the maximum overlap that keeps both
    // pair orderings (base→mirror, mirror→base) valid against the true
    // cut boundary.
    const maxOverlap = Math.max(0, Math.min(w - 0.05, w * 0.6));
    const probeSheetW = w * 3 + safeGap * 4 + 1;
    const probeSheetH = h + safeGap * 2 + 1;
    const pairFits = (overlap: number): boolean => {
      const colStepLocal = Math.max(0.05, w + safeGap - overlap);
      const pair1 = [
        buildCandidateAt(sourceShape, baseRot, 0, 0, 'base', false),
        buildCandidateAt(sourceShape, baseRot, colStepLocal, 0, 'base', true),
      ];
      const pair2 = [
        buildCandidateAt(sourceShape, baseRot, 0, 0, 'base', true),
        buildCandidateAt(sourceShape, baseRot, colStepLocal, 0, 'base', false),
      ];
      const v1 = validateCandidateSequence(pair1, probeSheetW, probeSheetH, sourceShape, forceBBox, safeGap);
      if (v1.length < 2) return false;
      const v2 = validateCandidateSequence(pair2, probeSheetW, probeSheetH, sourceShape, forceBBox, safeGap);
      return v2.length >= 2;
    };
    if (!pairFits(0)) continue;
    let lo = 0;
    let hi = maxOverlap;
    for (let iter = 0; iter < 26 && hi - lo > 0.01; iter++) {
      const mid = (lo + hi) / 2;
      if (pairFits(mid)) lo = mid; else hi = mid;
    }
    const adaptiveOverlap = lo;
    const colStep = Math.max(0.05, w + safeGap - adaptiveOverlap);
    const rowStep = h + safeGap;

    if (debug) debug.staggeredOffsetsTried.push(+adaptiveOverlap.toFixed(3));

    const candidates: CandidatePlacement[] = [];
    for (let col = 0; ; col++) {
      const x = col * colStep;
      if (x + w > sheetW + SHEET_TOL) break;
      const isMirrored = col % 2 === 1;
      for (let row = 0; ; row++) {
        const y = row * rowStep;
        if (y + h > sheetH + SHEET_TOL) break;
        candidates.push(buildCandidateAt(sourceShape, baseRot, x, y, 'base', isMirrored));
        if (candidates.length >= upperBound) break;
      }
      if (candidates.length >= upperBound) break;
    }
    const valid = validateCandidateSequence(candidates, sheetW, sheetH, sourceShape, forceBBox, gap, debug);
    if (valid.length > best.length) best = valid;

  }
  return best;
}
function localSearchOptimize(
  initial: CandidatePlacement[],
  sourceShape: DielineShape,
  sheetW: number,
  sheetH: number,
  gap: number,
  forceBBox: boolean,
  upperBound: number,
  iterations: number,
  deadline: number,
  debug?: AutoNestV2DebugSummary,
): CandidatePlacement[] {
  if (initial.length === 0) return initial;
  const sheetArea = Math.max(1e-6, sheetW * sheetH);
  const usageOf = (cs: CandidatePlacement[]) =>
    cs.reduce((s, c) => s + bboxAreaOf(bboxOfRings(c.placement.rings)), 0) / sheetArea;
  const better = (a: CandidatePlacement[], b: CandidatePlacement[]) =>
    a.length > b.length || (a.length === b.length && usageOf(a) > usageOf(b) + 1e-6);

  let best = initial.slice();
  let cur = initial.slice();
  const refBB = bboxOfRings(sourceShape.rings);
  const refW = Math.max(1e-3, refBB.maxX - refBB.minX);
  const refH = Math.max(1e-3, refBB.maxY - refBB.minY);
  const rowTol = refH * 0.45;
  const colTol = refW * 0.45;
  const shiftSteps = [
    Math.max(0.1, gap || 0.1),
    Math.max(0.25, refW * 0.05),
    Math.max(0.25, refH * 0.05),
    Math.max(0.5, refW * 0.1),
  ];

  for (let it = 0; it < iterations; it++) {
    if (Date.now() > deadline) break;
    let progressed = false;

    // A) Row shifts — shift each row toward bottom-left, then refill.
    const rows = groupRows(cur, rowTol);
    for (const row of rows) {
      if (Date.now() > deadline) break;
      for (const step of shiftSteps) {
        for (const [dx, dy] of [[0, -step], [-step, 0], [-step, -step]] as [number, number][]) {
          const moved = tryShiftGroup(cur, row, dx, dy, sourceShape, sheetW, sheetH, forceBBox, gap);
          if (moved) {
            cur = moved;
            progressed = true;
            row.forEach((i) => {
              if (debug && !debug.movedPieces.includes(i + 1)) debug.movedPieces.push(i + 1);
            });
            break;
          }
        }
      }
    }

    // B) Column shifts.
    const cols = groupCols(cur, colTol);
    for (const col of cols) {
      if (Date.now() > deadline) break;
      for (const step of shiftSteps) {
        for (const [dx, dy] of [[-step, 0], [0, -step]] as [number, number][]) {
          const moved = tryShiftGroup(cur, col, dx, dy, sourceShape, sheetW, sheetH, forceBBox, gap);
          if (moved) {
            cur = moved;
            progressed = true;
            break;
          }
        }
      }
    }

    // C) Pocket grid insert — scan whole sheet and try to drop extra copies.
    const beforeFill = cur.length;
    cur = pocketGridInsert(cur, sourceShape, sheetW, sheetH, forceBBox, gap, upperBound, deadline, debug);
    if (cur.length > beforeFill) progressed = true;

    // C2) Contact-Based Insert — places copies adjacent to existing pieces
    // and slides them into flap/tab pockets via strict polygon validation.
    // Cascade up to 3 passes since each new piece creates new contact anchors.
    for (let pass = 0; pass < 3; pass++) {
      if (Date.now() > deadline || cur.length >= upperBound) break;
      const beforeContact = cur.length;
      cur = contactBasedInsert(cur, sourceShape, sheetW, sheetH, forceBBox, gap, upperBound, deadline, debug);
      if (cur.length > beforeContact) progressed = true;
      else break;
    }

    // C3) Negative-Space Exploitation — flood-fills free regions and attacks
    // the largest pockets first, breaking the rigid column raster order.
    for (let pass = 0; pass < 3; pass++) {
      if (Date.now() > deadline || cur.length >= upperBound) break;
      const beforeNS = cur.length;
      cur = negativeSpaceExploit(cur, sourceShape, sheetW, sheetH, forceBBox, gap, upperBound, deadline, debug);
      if (cur.length > beforeNS) progressed = true;
      else break;
    }

    if (better(cur, best)) best = cur;

    // D) Perturbation — if no progress this iteration, remove K top-right
    // pieces and try grid insert again. Accept only if final beats best.
    if (!progressed && it < iterations - 1 && Date.now() < deadline) {
      for (const k of [1, 2, 3]) {
        if (Date.now() > deadline) break;
        const sortedIdx = best
          .map((c, i) => ({ i, score: c.placement.x + c.placement.y }))
          .sort((a, b) => b.score - a.score)
          .slice(0, k)
          .map((s) => s.i);
        const removed = best.filter((_, i) => !sortedIdx.includes(i));
        const refilled = pocketGridInsert(removed, sourceShape, sheetW, sheetH, forceBBox, gap, upperBound, deadline, debug);
        if (better(refilled, best)) {
          best = refilled;
          cur = refilled;
          progressed = true;
          break;
        }
      }
    }

    if (!progressed) break;
  }

  return best;
}

function pieceFromCandidate(candidate: CandidatePlacement, index: number): LayoutPiece {
  const bb = bboxOfRings(candidate.placement.rings);
  const turns = (candidate.absoluteRotation / 90) as 0 | 1 | 2 | 3;
  return {
    x: bb.minX,
    y: bb.minY,
    w: bb.maxX - bb.minX,
    h: bb.maxY - bb.minY,
    rotated: turns === 1 || turns === 3,
    rotation: turns,
    index,
    mirrored: candidate.mirrored || undefined,
  };
}

/* ───────────── Public API ───────────── */

export interface AutoNestV2Options {
  baseGap?: number;
  maxScenarios?: number;
  onProgress?: (p: AutoNestV2Progress) => void;
  timeBudgetMs?: number;
  /** Production footprint from the imported dieline preview, used when parsed cut paths are fragmented. */
  footprintW?: number;
  footprintH?: number;
  /** Cap on extra copies added by the 4-rotation gap-fill pass. */
  maxGapFillExtras?: number;
}

export function runAutoNestV2(
  shape: DielineShape,
  sheetW: number,
  sheetH: number,
  opts: AutoNestV2Options = {},
): AutoNestV2Result {
  const startedAt = Date.now();
  const baseGap = opts.baseGap ?? 0;
  const timeBudget = opts.timeBudgetMs ?? 8000;
  const maxExtras = opts.maxGapFillExtras ?? 40;

  const footprint = effectiveFootprint(shape, opts.footprintW, opts.footprintH);
  const nestingShape = footprint.useBBox ? rectangularFootprintShape(shape, footprint.bbox) : shape;

  // Estimate upper-bound piece count from the production-safe footprint area.
  const pieceArea = Math.max(1e-6, footprint.area);
  const sheetArea = sheetW * sheetH;
  const areaBound = Math.ceil((sheetArea / pieceArea) * 1.08) + 4;
  const bboxBound = Math.ceil((sheetArea / footprint.bboxArea) * (footprint.useBBox ? 1.05 : 1.6)) + 4;
  const upperBound = Math.max(1, Math.min(160, areaBound, bboxBound));

  const orientations: { deg: 0 | 90 | 180 | 270; shape: DielineShape }[] = [
    { deg: 0, shape: nestingShape },
    { deg: 90, shape: rotateShape(nestingShape, 90) },
    { deg: 180, shape: rotateShape(nestingShape, 180) },
    { deg: 270, shape: rotateShape(nestingShape, 270) },
  ];

  // Try a tight gap and a slightly relaxed one — sometimes a tiny extra
  // breathing room unlocks a better interlock pattern.
  const gapSet = Array.from(new Set([baseGap, +(baseGap + 0.05).toFixed(3)]));

  // Each plan = (primary orientation × gap × seed mode).
  // seed='none'   → standard NFP+BL+gap-fill
  // seed='flip'   → place a 180°-rotated piece first, then fill — encourages
  //                 flap-to-flap interlock similar to a manual layout
  // seed='staggered' → rebuild from scratch using alternating offset rows.
  type Plan = { orientId: number; gap: number; seed: 'none' | 'flip' | 'staggered' | 'column-flip' | 'column-mirror' };
  const plans: Plan[] = [];
  for (let i = 0; i < orientations.length; i++) {
    for (const g of gapSet) {
      plans.push({ orientId: i, gap: g, seed: 'none' });
      if (i < 2) plans.push({ orientId: i, gap: g, seed: 'flip' });
      plans.push({ orientId: i, gap: g, seed: 'staggered' });
      if (i < 2) plans.push({ orientId: i, gap: g, seed: 'column-flip' });
      if (i < 2) plans.push({ orientId: i, gap: g, seed: 'column-mirror' });
    }
  }
  const maxScenarios = opts.maxScenarios ?? plans.length;
  const trimmed = plans.slice(0, maxScenarios);

  const scenarios: AutoNestV2Scenario[] = [];
  let best: AutoNestV2Scenario | null = null;

  for (let i = 0; i < trimmed.length; i++) {
    const elapsed = Date.now() - startedAt;
    if (elapsed > timeBudget && best) break;

    const plan = trimmed[i];
    const orient = orientations[plan.orientId];
    const debug = createDebugSummary(
      plan.seed === 'staggered'
        ? 'سبب الفشل السابق: Post-Optimization كان يحرّك قطعًا داخل شبكة موجودة فقط؛ هذا السيناريو يعيد البناء من البداية بصفوف مزاحة.'
        : 'تتبّع Post-Optimization: إزاحات صغيرة وتدوير 180° مع تسجيل أسباب الرفض.',
    );

    let basePlacements: NfpPlacement[] = [];
    if (plan.seed === 'none') {
      try {
        const result = packShapeIntoSheet(orient.shape, sheetW, sheetH, {
          gap: plan.gap,
          allowRotation: true,
          fast: true,
          maxPieces: upperBound,
        });
        basePlacements = result.placements;
      } catch {
        continue;
      }
    }
    // For seed='flip' we skip the standard pack entirely and let
    // fillGapsWithRotations build the layout from scratch using all 4
    // cardinal rotations greedily — this often produces interlocked,
    // flap-to-flap layouts that the 0°/90°-only standard pack misses.

    // Phase 1 — try to fit MORE copies into remaining gaps using all 4
    // cardinal rotations independently per piece. Skip if no time left.
    let extraCandidates: CandidatePlacement[] = [];
    const remainingTime = timeBudget - (Date.now() - startedAt);
    const remainingBudget = upperBound - basePlacements.length;
    if (remainingTime > 500 && remainingBudget > 0) {
      try {
        const extraResults = fillGapsWithRotations(
          orient.shape,
          sheetW,
          sheetH,
          basePlacements,
          {
            gap: plan.gap,
            fast: true,
            maxExtra: plan.seed === 'flip'
              ? Math.min(upperBound, remainingBudget)
              : Math.min(maxExtras, remainingBudget),
          },
        );
        extraCandidates = extraResults.map((e) => ({
          placement: e.placement,
          absoluteRotation: addRotation(orient.deg, e.rotation),
          source: plan.seed === 'flip' ? 'base' : 'extra',
        }));
      } catch {
        extraCandidates = [];
      }
    }

    const baseCandidates: CandidatePlacement[] = basePlacements.map((placement) => ({
      placement,
      absoluteRotation: addRotation(orient.deg, placement.rotation),
      source: 'base',
    }));

    // Strict geometry gate: every counted copy must pass true polygon
    // collision + sheet-bounds validation after its actual rotation. If NFP
    // returns unusable geometry, fall back to a conservative grid based on the
    // real template bbox instead of returning 0 pieces.
    const isAlt = plan.seed === 'staggered' || plan.seed === 'column-flip' || plan.seed === 'column-mirror';
    const nfpCombined = [...baseCandidates, ...extraCandidates];
    const validNfpCandidates = isAlt ? [] : validateCandidateSequence(
      nfpCombined,
      sheetW,
      sheetH,
      shape,
      footprint.useBBox,
      plan.gap,
    );
    const rawFallbackCandidates = isAlt
      ? []
      : buildGridFallbackCandidates(nestingShape, sheetW, sheetH, plan.gap, upperBound);
    const validFallbackCandidates = isAlt ? [] : validateCandidateSequence(
      rawFallbackCandidates,
      sheetW,
      sheetH,
      shape,
      true,
      plan.gap,
    );
    // Column-mirror MUST use the real SVG silhouette (never bbox) — the
    // whole point is that adjacent mirrored tongues interlock through the
    // negative space. If we let useBBox=true here we'd just be sliding
    // rectangles and never gain any column.
    const mirrorForceBBox = false;
    const validStaggeredCandidates = plan.seed === 'staggered'
      ? buildBestStaggeredScenario(nestingShape, orient.deg, sheetW, sheetH, plan.gap, footprint.useBBox, upperBound, debug)
      : plan.seed === 'column-flip'
        ? buildColumnFlipSeed(shape, sheetW, sheetH, plan.gap, footprint.useBBox, upperBound, debug)
        : plan.seed === 'column-mirror'
          ? buildColumnMirrorSeed(shape, sheetW, sheetH, plan.gap, mirrorForceBBox, upperBound, debug)
          : [];
    let validCandidates = isAlt ? validStaggeredCandidates : validNfpCandidates;
    let chosenSource: 'nfp' | 'fallback' | 'staggered' | 'none' =
      isAlt
        ? (validCandidates.length > 0 ? 'staggered' : 'none')
        : (validCandidates.length > 0 ? 'nfp' : 'none');
    if (!isAlt && validFallbackCandidates.length > validCandidates.length) {
      validCandidates = validFallbackCandidates;
      chosenSource = 'fallback';
    }

    // ── Post-Optimization: multi-iteration shifts + 180° flips + re-fill ──
    if (validCandidates.length > 0) {
      const remainingTimeForOpt = timeBudget - (Date.now() - startedAt);
      if (remainingTimeForOpt > 400) {
        const deadline = Date.now() + Math.min(2500, Math.max(600, remainingTimeForOpt - 200));
        const optForceBBox = plan.seed === 'column-mirror' ? false : footprint.useBBox;
        const optimized = postOptimize(
          validCandidates,
          orient.shape,
          orient.deg,
          shape,
          sheetW,
          sheetH,
          plan.gap,
          optForceBBox,
          upperBound,
          4,
          deadline,
          debug,
        );
        if (
          optimized.length > validCandidates.length ||
          (optimized.length === validCandidates.length &&
            optimized.reduce((s, c) => {
              const bb = bboxOfRings(c.placement.rings);
              return s + (bb.maxX - bb.minX) * (bb.maxY - bb.minY);
            }, 0) >
              validCandidates.reduce((s, c) => {
                const bb = bboxOfRings(c.placement.rings);
                return s + (bb.maxX - bb.minX) * (bb.maxY - bb.minY);
              }, 0) + 1e-4)
        ) {
          validCandidates = optimized;
          if (chosenSource === 'none') chosenSource = 'nfp';
        }
      }

      // ── Local Search: row/column shifts + pocket grid scan + perturbation ──
      const remainingForLocal = timeBudget - (Date.now() - startedAt);
      if (remainingForLocal > 500 && validCandidates.length > 0) {
        const lsDeadline = Date.now() + Math.min(3500, Math.max(800, remainingForLocal - 200));
        const lsForceBBox = plan.seed === 'column-mirror' ? false : footprint.useBBox;
        const improved = localSearchOptimize(
          validCandidates,
          shape,
          sheetW,
          sheetH,
          plan.gap,
          lsForceBBox,
          upperBound,
          6,
          lsDeadline,
          debug,
        );
        if (
          improved.length > validCandidates.length ||
          (improved.length === validCandidates.length &&
            improved.reduce((s, c) => s + bboxAreaOf(bboxOfRings(c.placement.rings)), 0) >
              validCandidates.reduce((s, c) => s + bboxAreaOf(bboxOfRings(c.placement.rings)), 0) + 1e-4)
        ) {
          validCandidates = improved;
          if (chosenSource === 'none') chosenSource = 'nfp';
        }
      }
    }

    const diagnostics: AutoNestV2StageDiagnostics = {
      nfpBaseCount: basePlacements.length,
      nfpExtraCount: extraCandidates.length,
      fallbackCount: rawFallbackCandidates.length,
      validatedNfpCount: chosenSource === 'fallback' ? validNfpCandidates.length : validCandidates.length,
      validatedFallbackCount: validFallbackCandidates.length,
      chosenSource,
      upperBound,
      forcedBBox: footprint.useBBox,
      debug,
    };
    if (validCandidates.length === 0) {
      // Still record an empty scenario so the diagnostics panel can show why.
      scenarios.push({
        id: `autov2-${i}-${orient.deg}-g${plan.gap}-empty`,
        label: `تدوير ${orient.deg}°${plan.seed === 'flip' ? ' • تعشيق متبادل' : plan.seed === 'staggered' ? ' • سيناريو التعشيق المزاح' : plan.seed === 'column-flip' ? ' • أعمدة متناوبة الانعكاس' : plan.seed === 'column-mirror' ? ' • أعمدة معكوسة أفقياً' : ''} • فاصل ${plan.gap.toFixed(2)}سم • لا نتائج`,
        pieces: [],
        count: 0,
        baseCount: 0,
        extraCount: 0,
        usagePercent: 0,
        wasteArea: sheetArea,
        gap: plan.gap,
        rotation: orient.deg,
        diagnostics,
      });
      continue;
    }

    const combined = reindexBLF(validCandidates.map((c, idx) => pieceFromCandidate(c, idx + 1)));
    const usedArea = validCandidates.length * pieceArea;
    const usagePercent = sheetArea > 0 ? (usedArea / sheetArea) * 100 : 0;
    const validBaseCount = validCandidates.filter((c) => c.source === 'base').length;
    const validExtraCount = validCandidates.filter((c) => c.source === 'extra').length;

    const sc: AutoNestV2Scenario = {
      id: `autov2-${i}-${orient.deg}-g${plan.gap}`,
      label: (() => {
        const seedTag = plan.seed === 'flip' ? ' • تعشيق متبادل' : plan.seed === 'staggered' ? ' • سيناريو التعشيق المزاح' : plan.seed === 'column-flip' ? ' • أعمدة متناوبة الانعكاس' : plan.seed === 'column-mirror' ? ' • أعمدة معكوسة أفقياً' : '';
        const extraTag = validExtraCount > 0 ? ` • +${validExtraCount} داخل الفراغات` : '';
        return `تدوير ${orient.deg}°${seedTag} • فاصل ${plan.gap.toFixed(2)}سم${extraTag}`;
      })(),
      pieces: combined,
      count: combined.length,
      baseCount: validBaseCount,
      extraCount: validExtraCount,
      usagePercent,
      wasteArea: Math.max(0, sheetArea - usedArea),
      gap: plan.gap,
      rotation: orient.deg,
      diagnostics,
    };
    scenarios.push(sc);

    if (
      !best ||
      sc.count > best.count ||
      (sc.count === best.count && sc.usagePercent > best.usagePercent) ||
      (sc.count === best.count &&
        sc.usagePercent === best.usagePercent &&
        sc.gap < best.gap)
    ) {
      best = sc;
    }

    opts.onProgress?.({
      scenarioIndex: i + 1,
      totalScenarios: trimmed.length,
      currentBestCount: best?.count ?? 0,
      currentBestUsage: best?.usagePercent ?? 0,
    });
  }

  return { best, scenarios, durationMs: Date.now() - startedAt };
}
