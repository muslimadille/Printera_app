// F70_01_00_00_A — Auto Nesting Engine
// Computes sheet layout, columns, rows, yield, and efficiency for Pillow Box templates.

import type { F70_01_00_00_AParams } from './types';
import { buildF70_01_00_00_AGeometry } from './geometry';

export type RotationMode = 'normal' | 'rotated' | 'auto';
export type Orientation = 'normal' | 'rotated';
export type FitStatus = 'fits' | 'too_large';

export interface F70_01_00_00_ANestingParams {
  horizontalGap: number;
  verticalGap: number;
  allowRotation: boolean;
  rotationMode: RotationMode;
  horizontalInterlock: number;
  verticalInterlock: number;
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

export interface F70_01_00_00_ANestingResult {
  templateBBox: { width: number; height: number };
  usableSheet: { width: number; height: number };
  bestOrientation: Orientation;
  fitStatus: FitStatus;
  columns: number;
  rows: number;
  total: number;
  pitchX: number;
  pitchY: number;
  rowBrickDx: number;
  brickPhase: 0 | 1;
  perRowCols: number[];
  efficiencyPercentage: number;
  wastePercentage: number;
  normal: OrientationResult;
  rotated: OrientationResult;
}

export function computeF70_01_00_00_ANesting(
  params: F70_01_00_00_AParams,
  nesting: F70_01_00_00_ANestingParams
): F70_01_00_00_ANestingResult {
  const geo = buildF70_01_00_00_AGeometry(params);
  const bboxW = geo.bbox.w;
  const bboxH = geo.bbox.h;

  const usableW = Math.max(0, params.sheetWidth - 2 * params.sheetMargin);
  const usableH = Math.max(0, params.sheetHeight - 2 * params.sheetMargin - params.gripper);

  // Normal orientation (0°)
  const pitchXNormal = bboxW + nesting.horizontalGap - nesting.horizontalInterlock;
  const pitchYNormal = bboxH + nesting.verticalGap - nesting.verticalInterlock;
  const colsNormal = pitchXNormal > 0 && usableW >= bboxW ? Math.floor((usableW - bboxW) / pitchXNormal) + 1 : 0;
  const rowsNormal = pitchYNormal > 0 && usableH >= bboxH ? Math.floor((usableH - bboxH) / pitchYNormal) + 1 : 0;
  const totalNormal = Math.max(0, colsNormal) * Math.max(0, rowsNormal);

  const resNormal: OrientationResult = {
    columns: Math.max(0, colsNormal),
    rows: Math.max(0, rowsNormal),
    total: totalNormal,
    pitchX: pitchXNormal,
    pitchY: pitchYNormal,
    rowBrickDx: 0,
    brickPhase: 0,
    perRowCols: Array(Math.max(0, rowsNormal)).fill(Math.max(0, colsNormal)),
    smartAuto: false,
  };

  // Rotated orientation (90°)
  const pitchXRotated = bboxH + nesting.horizontalGap - nesting.horizontalInterlock;
  const pitchYRotated = bboxW + nesting.verticalGap - nesting.verticalInterlock;
  const colsRotated = pitchXRotated > 0 && usableW >= bboxH ? Math.floor((usableW - bboxH) / pitchXRotated) + 1 : 0;
  const rowsRotated = pitchYRotated > 0 && usableH >= bboxW ? Math.floor((usableH - bboxW) / pitchYRotated) + 1 : 0;
  const totalRotated = Math.max(0, colsRotated) * Math.max(0, rowsRotated);

  const resRotated: OrientationResult = {
    columns: Math.max(0, colsRotated),
    rows: Math.max(0, rowsRotated),
    total: totalRotated,
    pitchX: pitchXRotated,
    pitchY: pitchYRotated,
    rowBrickDx: 0,
    brickPhase: 0,
    perRowCols: Array(Math.max(0, rowsRotated)).fill(Math.max(0, colsRotated)),
    smartAuto: false,
  };

  let bestOrientation: Orientation = 'normal';
  if (nesting.rotationMode === 'rotated') {
    bestOrientation = 'rotated';
  } else if (nesting.rotationMode === 'auto' || nesting.allowRotation) {
    if (resRotated.total > resNormal.total) {
      bestOrientation = 'rotated';
    }
  }

  const chosen = bestOrientation === 'rotated' ? resRotated : resNormal;
  const templateArea = bboxW * bboxH * chosen.total;
  const sheetArea = params.sheetWidth * params.sheetHeight;
  const efficiency = sheetArea > 0 ? (templateArea / sheetArea) * 100 : 0;

  return {
    templateBBox: { width: bboxW, height: bboxH },
    usableSheet: { width: usableW, height: usableH },
    bestOrientation,
    fitStatus: chosen.total > 0 ? 'fits' : 'too_large',
    columns: chosen.columns,
    rows: chosen.rows,
    total: chosen.total,
    pitchX: chosen.pitchX,
    pitchY: chosen.pitchY,
    rowBrickDx: chosen.rowBrickDx,
    brickPhase: chosen.brickPhase,
    perRowCols: chosen.perRowCols,
    efficiencyPercentage: Math.min(100, Math.max(0, efficiency)),
    wastePercentage: Math.min(100, Math.max(0, 100 - efficiency)),
    normal: resNormal,
    rotated: resRotated,
  };
}
