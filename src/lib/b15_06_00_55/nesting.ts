// B15_06_00_55 — 2D Nesting & Yield Calculation Engine

import type { B15_06_00_55Params } from './types';
import { usableSheet } from './types';

export type RotationMode = 'auto' | 'normal' | 'rotated';

export interface B15_06_00_55NestingParams {
  horizontalGap: number;
  verticalGap: number;
  allowRotation: boolean;
  rotationMode?: RotationMode;
  horizontalInterlock?: number;
  verticalInterlock?: number;
  smartAuto?: boolean;
}

export interface GridOrientation {
  columns: number;
  rows: number;
  total: number;
  pitchX: number;
  pitchY: number;
  rowBrickDx?: number;
  brickPhase?: 0 | 1;
  perRowCols?: number[];
}

export interface B15_06_00_55NestingResult {
  fitStatus: 'fits' | 'no-fit';
  total: number;
  bestTotal: number;
  bestOrientation: 'normal' | 'rotated';
  normal: GridOrientation;
  rotated: GridOrientation;
  templateBBox: {
    width: number;
    height: number;
  };
  usableSheet: {
    width: number;
    height: number;
  };
}

export function computeB15_06_00_55Nesting(
  p: B15_06_00_55Params,
  n: B15_06_00_55NestingParams,
  templateWidth?: number,
  templateHeight?: number,
): B15_06_00_55NestingResult {
  const W = p.width;
  const H = p.height;
  const D = p.depth;
  const Tf = p.tuckFlap || D;

  const tW = templateWidth ?? D + W + D + W + Tf;
  const tH = templateHeight ?? D + H + D;

  const usable = usableSheet(p);
  const gapX = Math.max(0, n.horizontalGap);
  const gapY = Math.max(0, n.verticalGap);

  const pitchX_norm = tW + gapX;
  const pitchY_norm = tH + gapY;
  const cols_norm = pitchX_norm > 0 ? Math.floor((usable.width + gapX) / pitchX_norm) : 0;
  const rows_norm = pitchY_norm > 0 ? Math.floor((usable.height + gapY) / pitchY_norm) : 0;
  const total_norm = Math.max(0, cols_norm) * Math.max(0, rows_norm);

  const pitchX_rot = tH + gapX;
  const pitchY_rot = tW + gapY;
  const cols_rot = pitchX_rot > 0 ? Math.floor((usable.width + gapX) / pitchX_rot) : 0;
  const rows_rot = pitchY_rot > 0 ? Math.floor((usable.height + gapY) / pitchY_rot) : 0;
  const total_rot = Math.max(0, cols_rot) * Math.max(0, rows_rot);

  let bestOrientation: 'normal' | 'rotated' = 'normal';
  if (n.rotationMode === 'rotated') {
    bestOrientation = 'rotated';
  } else if (n.rotationMode === 'normal') {
    bestOrientation = 'normal';
  } else {
    bestOrientation = total_rot > total_norm ? 'rotated' : 'normal';
  }

  const bestTotal = bestOrientation === 'rotated' ? total_rot : total_norm;
  const fitStatus: 'fits' | 'no-fit' = bestTotal > 0 ? 'fits' : 'no-fit';

  return {
    fitStatus,
    total: bestTotal,
    bestTotal,
    bestOrientation,
    normal: {
      columns: Math.max(0, cols_norm),
      rows: Math.max(0, rows_norm),
      total: total_norm,
      pitchX: pitchX_norm,
      pitchY: pitchY_norm,
    },
    rotated: {
      columns: Math.max(0, cols_rot),
      rows: Math.max(0, rows_rot),
      total: total_rot,
      pitchX: pitchX_rot,
      pitchY: pitchY_rot,
    },
    templateBBox: {
      width: tW,
      height: tH,
    },
    usableSheet: usable,
  };
}
