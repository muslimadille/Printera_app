// D003 Phase 3 — Nesting Engine (Grid and rotation calculations)
// ----------------------------------------------------------------------------

import type { D003Params } from './types';
import { usableSheet } from './types';
import { buildD003Geometry } from './geometry';

export type RotationMode = 'normal' | 'rotated' | 'auto';
export type Orientation = 'normal' | 'rotated';
export type FitStatus = 'fits' | 'too_large';

export interface D003NestingParams {
  horizontalGap: number;
  verticalGap: number;
  allowRotation: boolean;
  rotationMode: RotationMode;
  horizontalInterlock: number;
  verticalInterlock: number;
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
}

export interface D003NestingResult {
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
  horizontalInterlock: number;
  verticalInterlock: number;
}

export function computeD003Nesting(p: D003Params, nesting: D003NestingParams): D003NestingResult {
  const geo = buildD003Geometry(p);
  const bboxW = geo.bbox.w;
  const bboxH = geo.bbox.h;

  const sheet = usableSheet(p);

  const hGap = Math.max(0, nesting.horizontalGap);
  const vGap = Math.max(0, nesting.verticalGap);
  const hInt = nesting.horizontalInterlock;
  const vInt = nesting.verticalInterlock;

  // 1. Evaluate Normal Orientation (0°)
  // Flat dimensions: Width = bboxW, Height = bboxH
  const normalResult = evaluateOrientation(bboxW, bboxH, sheet.width, sheet.height, hGap, vGap, hInt, vInt);

  // 2. Evaluate Rotated Orientation (90°)
  // Flat dimensions: Width = bboxH, Height = bboxW
  const rotatedResult = evaluateOrientation(bboxH, bboxW, sheet.width, sheet.height, hGap, vGap, hInt, vInt);

  // 3. Determine best layout
  const rotationAllowed = nesting.allowRotation;
  const rotationMode = nesting.rotationMode;

  let bestOrientation: Orientation = 'normal';
  let bestTotal = 0;

  if (!rotationAllowed || rotationMode === 'normal') {
    bestOrientation = 'normal';
    bestTotal = normalResult.total;
  } else if (rotationMode === 'rotated') {
    bestOrientation = 'rotated';
    bestTotal = rotatedResult.total;
  } else {
    // auto
    if (rotatedResult.total > normalResult.total) {
      bestOrientation = 'rotated';
      bestTotal = rotatedResult.total;
    } else {
      bestOrientation = 'normal';
      bestTotal = normalResult.total;
    }
  }

  const bestResult = bestOrientation === 'normal' ? normalResult : rotatedResult;

  const fitStatus: FitStatus = bestTotal > 0 ? 'fits' : 'too_large';

  return {
    templateBBox: { width: bboxW, height: bboxH },
    usableSheet: sheet,
    normal: normalResult,
    rotated: rotatedResult,
    bestOrientation,
    bestTotal,
    fitStatus,
    rotationAllowed,
    effectiveRotationMode: rotationMode,
    pitchX: bestResult.pitchX,
    pitchY: bestResult.pitchY,
    rowBrickDx: bestResult.rowBrickDx,
    perRowCols: bestResult.perRowCols,
    horizontalInterlock: hInt,
    verticalInterlock: vInt,
  };
}

function evaluateOrientation(
  cellW: number,
  cellH: number,
  sheetW: number,
  sheetH: number,
  hGap: number,
  vGap: number,
  hInt: number,
  vInt: number
): OrientationResult {
  // Pitches (taking interlocks and gaps into account)
  const pitchX = cellW - hInt + hGap;
  const pitchY = cellH - vInt + vGap;

  // Simple grid sizing
  let columns = 0;
  let rows = 0;

  if (sheetW >= cellW) {
    columns = 1 + Math.floor((sheetW - cellW) / pitchX);
  }
  if (sheetH >= cellH) {
    rows = 1 + Math.floor((sheetH - cellH) / pitchY);
  }

  // Row brick offsets are not needed for a clean rectangular dieline
  const rowBrickDx = 0;
  const brickPhase: 0 | 1 = 1;
  const total = columns * rows;

  const perRowCols = Array(rows).fill(columns);

  return {
    columns,
    rows,
    total,
    pitchX,
    pitchY,
    rowBrickDx,
    brickPhase,
    perRowCols,
  };
}
