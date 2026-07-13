// T0005 Phase 3 — Smart Auto Nesting (silhouette + row-brick) with manual override.

import type { T0005Params } from './types';
import { usableSheet } from './types';
import { buildT0005Geometry, type Segment, type Pt } from './geometry';

export type RotationMode = 'normal' | 'rotated' | 'auto';
export type Orientation = 'normal' | 'rotated';
export type FitStatus = 'fits' | 'too_large';

export interface T0005NestingParams {
  horizontalGap: number;
  verticalGap: number;
  allowRotation: boolean;
  rotationMode: RotationMode;
  /** Manual horizontal interlock (mm). 0 = let smart-auto derive it. */
  horizontalInterlock: number;
  /** Manual vertical interlock (mm). 0 = let smart-auto derive it. */
  verticalInterlock: number;
  /** Enable silhouette-based smart auto pitch + row-brick. Defaults true. */
  smartAuto?: boolean;
}

export interface OrientationResult {
  columns: number;
  rows: number;
  total: number;
  pitchX: number;
  pitchY: number;
  rowBrickDx: number;
  brickPhase: 0 | 1;
  perRowCols: number[];
  smartAuto: boolean;
}

export interface T0005NestingResult {
  templateBBox: { width: number; height: number };
  usableSheet: { width: number; height: number };
  normal: OrientationResult;
  rotated: OrientationResult;
  bestOrientation: Orientation;
  bestTotal: number;
  fitStatus: FitStatus;
  rotationAllowed: boolean;
  effectiveRotationMode: RotationMode;
  pitchX: number;
  pitchY: number;
  rowBrickDx: number;
  perRowCols: number[];
  smartAuto: boolean;
  horizontalInterlock: number;
  verticalInterlock: number;
}

function safeNumber(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

const SAMPLE_STEP_MM = 0.5;

function pushSeg(s: Segment, dst: Pt[]): void {
  const push = (x: number, y: number) => dst.push({ x, y });
  if (s.geometry === 'polyline' && s.points && s.points.length >= 2) {
    for (let k = 0; k + 1 < s.points.length; k++) {
      const a = s.points[k], b = s.points[k + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const M = Math.max(2, Math.ceil(len / SAMPLE_STEP_MM));
      for (let i = 0; i <= M; i++) {
        const t = i / M;
        push(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      }
    }
    return;
  }
  const dx = s.end.x - s.start.x, dy = s.end.y - s.start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return;
  const M = Math.max(2, Math.ceil(len / SAMPLE_STEP_MM));
  for (let i = 0; i <= M; i++) {
    const t = i / M;
    push(s.start.x + dx * t, s.start.y + dy * t);
  }
}

interface Silhouette {
  W: number;
  H: number;
  step: number;
  nx: number;
  ny: number;
  leftX: Float64Array;
  rightX: Float64Array;
  topY: Float64Array;
  bottomY: Float64Array;
}

function buildSilhouette(segs: Segment[], bboxW: number, bboxH: number, rotated: boolean): Silhouette {
  const step = SAMPLE_STEP_MM;
  const W = rotated ? bboxH : bboxW;
  const H = rotated ? bboxW : bboxH;
  const nx = Math.max(1, Math.ceil(W / step) + 1);
  const ny = Math.max(1, Math.ceil(H / step) + 1);
  const leftX = new Float64Array(ny);   leftX.fill(Number.POSITIVE_INFINITY);
  const rightX = new Float64Array(ny);  rightX.fill(Number.NEGATIVE_INFINITY);
  const topY = new Float64Array(nx);    topY.fill(Number.POSITIVE_INFINITY);
  const bottomY = new Float64Array(nx); bottomY.fill(Number.NEGATIVE_INFINITY);

  const pts: Pt[] = [];
  for (const s of segs) {
    if (s.kind === 'CREASE') continue;
    pushSeg(s, pts);
  }
  for (const p of pts) {
    const px = rotated ? bboxH - p.y : p.x;
    const py = rotated ? p.x        : p.y;
    const ri = Math.min(ny - 1, Math.max(0, Math.round(py / step)));
    const ci = Math.min(nx - 1, Math.max(0, Math.round(px / step)));
    if (px < leftX[ri]) leftX[ri] = px;
    if (px > rightX[ri]) rightX[ri] = px;
    if (py < topY[ci]) topY[ci] = py;
    if (py > bottomY[ci]) bottomY[ci] = py;
  }
  return { W, H, step, nx, ny, leftX, rightX, topY, bottomY };
}

function minPitchY(sil: Silhouette, dx: number, gap: number): number {
  const shift = Math.round(dx / sil.step);
  let need = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < sil.nx; i++) {
    const b = sil.bottomY[i];
    if (!Number.isFinite(b)) continue;
    const j = i - shift;
    if (j < 0 || j >= sil.nx) continue;
    const t = sil.topY[j];
    if (!Number.isFinite(t)) continue;
    const v = b - t + gap;
    if (v > need) need = v;
  }
  if (!Number.isFinite(need)) return sil.H + gap;
  return Math.max(0.1, need);
}

function minPitchX(sil: Silhouette, gap: number): number {
  let need = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < sil.ny; i++) {
    const r = sil.rightX[i];
    const l = sil.leftX[i];
    if (!Number.isFinite(r) || !Number.isFinite(l)) continue;
    const v = r - l + gap;
    if (v > need) need = v;
  }
  if (!Number.isFinite(need)) return sil.W + gap;
  return Math.max(0.1, need);
}

interface AutoPitch {
  pitchX: number;
  pitchY: number;
  rowBrickDx: number;
}

interface Mask {
  step: number;
  nx: number;
  ny: number;
  field: Uint8Array;
  filled: number[];
}

function buildMask(segs: Segment[], bboxW: number, bboxH: number, rotated: boolean, gap: number): Mask {
  const step = SAMPLE_STEP_MM;
  const W = rotated ? bboxH : bboxW;
  const H = rotated ? bboxW : bboxH;
  const nx = Math.max(2, Math.ceil(W / step) + 2);
  const ny = Math.max(2, Math.ceil(H / step) + 2);
  const raw = new Uint8Array(nx * ny);

  const pts: Pt[] = [];
  for (const s of segs) {
    if (s.kind === 'CREASE') continue;
    pushSeg(s, pts);
  }
  for (const p of pts) {
    const px = rotated ? bboxH - p.y : p.x;
    const py = rotated ? p.x        : p.y;
    const ci = Math.round(px / step);
    const ri = Math.round(py / step);
    if (ci >= 0 && ci < nx && ri >= 0 && ri < ny) raw[ri * nx + ci] = 1;
  }

  const r = Math.max(0, Math.ceil((gap * 0.5) / step));
  let field = raw;
  if (r > 0) {
    const h = new Uint8Array(nx * ny);
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        let v = 0;
        const x0 = Math.max(0, x - r);
        const x1 = Math.min(nx - 1, x + r);
        for (let k = x0; k <= x1; k++) {
          if (field[y * nx + k]) { v = 1; break; }
        }
        h[y * nx + x] = v;
      }
    }
    const v2 = new Uint8Array(nx * ny);
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        let v = 0;
        const y0 = Math.max(0, y - r);
        const y1 = Math.min(ny - 1, y + r);
        for (let k = y0; k <= y1; k++) {
          if (h[k * nx + x]) { v = 1; break; }
        }
        v2[y * nx + x] = v;
      }
    }
    field = v2;
  }

  const filled: number[] = [];
  for (let i = 0; i < raw.length; i++) if (raw[i]) filled.push(i);
  return { step, nx, ny, field, filled };
}

function collides(mask: Mask, dxMm: number, dyMm: number): boolean {
  const dx = Math.round(dxMm / mask.step);
  const dy = Math.round(dyMm / mask.step);
  const { nx, ny, field, filled } = mask;
  for (let i = 0; i < filled.length; i++) {
    const idx = filled[i];
    const x = idx % nx;
    const y = (idx - x) / nx;
    const xi = x + dx;
    const yi = y + dy;
    if (xi < 0 || xi >= nx || yi < 0 || yi >= ny) continue;
    if (field[yi * nx + xi]) return true;
  }
  return false;
}

function refineSafe(
  mask: Mask, pitchX: number, pitchY: number, rowBrickDx: number,
): { pitchX: number; pitchY: number; rowBrickDx: number } {
  const inc = Math.max(mask.step, 0.5);
  const maxIter = 400;
  let px = Math.max(mask.step, pitchX);
  let py = Math.max(mask.step, pitchY);
  let dx = rowBrickDx;

  for (let i = 0; i < maxIter; i++) {
    const cH  = collides(mask, px, 0);
    const cV  = collides(mask, 0, py);
    const cB  = dx !== 0 ? collides(mask, dx, py) : false;
    const cBL = dx !== 0 ? collides(mask, dx - px, py) : false;
    const cBR = dx !== 0 ? collides(mask, dx + px, py) : false;
    if (!cH && !cV && !cB && !cBL && !cBR) break;
    if (cH) px += inc;
    if (cV || cB || cBL || cBR) py += inc;
  }
  if (dx !== 0) {
    const pyNoBrick = (() => {
      let p = py;
      for (let i = 0; i < 200; i++) {
        if (!collides(mask, 0, p)) return p;
        p += inc;
      }
      return p;
    })();
    if (pyNoBrick + 1e-6 < py) {
      return { pitchX: px, pitchY: pyNoBrick, rowBrickDx: 0 };
    }
  }
  return { pitchX: px, pitchY: py, rowBrickDx: dx };
}

function computeAutoPitchForOrientation(
  segs: Segment[], bboxW: number, bboxH: number, rotated: boolean,
  gapX: number, gapY: number,
): AutoPitch {
  const sil = buildSilhouette(segs, bboxW, bboxH, rotated);
  const basePitchX = minPitchX(sil, 0);

  let basePitchY = minPitchY(sil, 0, 0);
  let bestDx = 0;
  const STEP = Math.max(sil.step * 2, 1);
  for (let dx = STEP; dx <= basePitchX + 1e-6; dx += STEP) {
    const pyP = minPitchY(sil, +dx, 0);
    if (pyP < basePitchY - 1e-6) { basePitchY = pyP; bestDx = +dx; }
    const pyN = minPitchY(sil, -dx, 0);
    if (pyN < basePitchY - 1e-6) { basePitchY = pyN; bestDx = -dx; }
  }

  const mask = buildMask(segs, bboxW, bboxH, rotated, 0);
  const safe = refineSafe(mask, basePitchX, basePitchY, bestDx);

  return {
    pitchX: safe.pitchX + gapX,
    pitchY: safe.pitchY + gapY,
    rowBrickDx: safe.rowBrickDx,
  };
}

function fitCountBrickPhase(
  sheetW: number, sheetH: number,
  itemW: number, itemH: number,
  pitchX: number, pitchY: number, rowBrickDx: number, phase: 0 | 1,
): { columns: number; rows: number; total: number; perRowCols: number[]; rowBrickDx: number; brickPhase: 0 | 1 } {
  if (itemW <= 0 || itemH <= 0 || sheetW <= 0 || sheetH <= 0
      || itemW > sheetW || itemH > sheetH || pitchX <= 0 || pitchY <= 0) {
    return { columns: 0, rows: 0, total: 0, perRowCols: [], rowBrickDx, brickPhase: phase };
  }
  const rows = Math.max(1, Math.floor((sheetH - itemH) / pitchY) + 1);
  const perRowCols: number[] = [];
  let total = 0;
  let maxCols = 0;
  for (let r = 0; r < rows; r++) {
    const shifted = (r % 2) === phase;
    const offset = shifted ? rowBrickDx : 0;
    const startX = Math.max(0, Math.min(sheetW - itemW, offset));
    const cols = Math.max(0, Math.floor((sheetW - itemW - startX) / pitchX) + 1);
    perRowCols.push(cols);
    total += cols;
    if (cols > maxCols) maxCols = cols;
  }
  return { columns: maxCols, rows, total, perRowCols, rowBrickDx, brickPhase: phase };
}

function fitCountBrick(
  sheetW: number, sheetH: number,
  itemW: number, itemH: number,
  pitchX: number, pitchY: number, rowBrickDx: number,
): { columns: number; rows: number; total: number; perRowCols: number[]; rowBrickDx: number; brickPhase: 0 | 1 } {
  const candidates = [
    fitCountBrickPhase(sheetW, sheetH, itemW, itemH, pitchX, pitchY, 0, 1),
    fitCountBrickPhase(sheetW, sheetH, itemW, itemH, pitchX, pitchY, rowBrickDx, 1),
    fitCountBrickPhase(sheetW, sheetH, itemW, itemH, pitchX, pitchY, rowBrickDx, 0),
    fitCountBrickPhase(sheetW, sheetH, itemW, itemH, pitchX, pitchY, -rowBrickDx, 1),
    fitCountBrickPhase(sheetW, sheetH, itemW, itemH, pitchX, pitchY, -rowBrickDx, 0),
  ];
  let best = candidates[0];
  for (const c of candidates) if (c.total > best.total) best = c;
  return best;
}

export function computeT0005Nesting(
  params: T0005Params,
  nesting: T0005NestingParams,
): T0005NestingResult {
  const geo = buildT0005Geometry(params);
  const tW = safeNumber(geo.bbox.w);
  const tH = safeNumber(geo.bbox.h);
  const rawUsable = usableSheet(params);
  const usable = {
    width:  safeNumber(rawUsable.width),
    height: safeNumber(rawUsable.height),
  };

  const gapX = Math.max(0, safeNumber(nesting?.horizontalGap, 0));
  const gapY = Math.max(0, safeNumber(nesting?.verticalGap, 0));
  const hIraw = Math.max(0, safeNumber(nesting?.horizontalInterlock, 0));
  const vIraw = Math.max(0, safeNumber(nesting?.verticalInterlock, 0));
  const smartAuto = (nesting.smartAuto !== false) && hIraw === 0 && vIraw === 0;

  let normalGrid: OrientationResult;
  let rotatedGrid: OrientationResult;

  if (smartAuto && tW > 0 && tH > 0) {
    const aN = computeAutoPitchForOrientation(geo.segments, tW, tH, false, gapX, gapY);
    const aR = computeAutoPitchForOrientation(geo.segments, tW, tH, true,  gapX, gapY);

    const fN = fitCountBrick(usable.width, usable.height, tW, tH, aN.pitchX, aN.pitchY, aN.rowBrickDx);
    const fR = fitCountBrick(usable.width, usable.height, tH, tW, aR.pitchX, aR.pitchY, aR.rowBrickDx);

    normalGrid = {
      ...fN, pitchX: aN.pitchX, pitchY: aN.pitchY,
      rowBrickDx: fN.rowBrickDx, brickPhase: fN.brickPhase, smartAuto: true,
    };
    rotatedGrid = {
      ...fR, pitchX: aR.pitchX, pitchY: aR.pitchY,
      rowBrickDx: fR.rowBrickDx, brickPhase: fR.brickPhase, smartAuto: true,
    };
  } else {
    const hI = tW > 0.1 ? Math.min(hIraw, tW - 0.1) : 0;
    const vI = tH > 0.1 ? Math.min(vIraw, tH - 0.1) : 0;
    const safePitch = (raw: number, bbox: number, gap: number) => {
      const p = safeNumber(raw, NaN);
      return p > 0 ? p : safeNumber(bbox, 0) + safeNumber(gap, 0);
    };
    const pitchXn = safePitch(tW - hI + gapX, tW, gapX);
    const pitchYn = safePitch(tH - vI + gapY, tH, gapY);
    const pitchXr = safePitch(tH - vI + gapX, tH, gapX);
    const pitchYr = safePitch(tW - hI + gapY, tW, gapY);

    const fN = fitCountBrick(usable.width, usable.height, tW, tH, pitchXn, pitchYn, 0);
    const fR = fitCountBrick(usable.width, usable.height, tH, tW, pitchXr, pitchYr, 0);

    normalGrid = { ...fN, pitchX: pitchXn, pitchY: pitchYn, rowBrickDx: 0, brickPhase: 1, smartAuto: false };
    rotatedGrid = { ...fR, pitchX: pitchXr, pitchY: pitchYr, rowBrickDx: 0, brickPhase: 1, smartAuto: false };
  }

  const rotationAllowed = nesting.allowRotation;
  const mode: RotationMode = rotationAllowed ? nesting.rotationMode : 'normal';
  let bestOrientation: Orientation = 'normal';
  if (mode === 'rotated') bestOrientation = 'rotated';
  else if (mode === 'auto') bestOrientation = rotatedGrid.total > normalGrid.total ? 'rotated' : 'normal';

  const best = bestOrientation === 'rotated' ? rotatedGrid : normalGrid;
  const bestTotal = best.total;
  const fitStatus: FitStatus = bestTotal > 0 ? 'fits' : 'too_large';

  const usedTW = bestOrientation === 'rotated' ? tH : tW;
  const usedTH = bestOrientation === 'rotated' ? tW : tH;
  const effHI = Math.max(0, usedTW + gapX - best.pitchX);
  const effVI = Math.max(0, usedTH + gapY - best.pitchY);

  return {
    templateBBox: { width: tW, height: tH },
    usableSheet: usable,
    normal: normalGrid,
    rotated: rotatedGrid,
    bestOrientation,
    bestTotal,
    fitStatus,
    rotationAllowed,
    effectiveRotationMode: mode,
    pitchX: best.pitchX,
    pitchY: best.pitchY,
    rowBrickDx: best.rowBrickDx,
    perRowCols: best.perRowCols,
    smartAuto: best.smartAuto,
    horizontalInterlock: effHI,
    verticalInterlock: effVI,
  };
}
