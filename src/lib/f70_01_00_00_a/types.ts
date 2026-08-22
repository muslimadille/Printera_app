// F70_01_00_00_A — ECMA Pillow Box (علبة وسادة)
// Dieline Types and Reference Constants
// Reference values measured from F70_01_00_00_A.svg (1 mm = 2.83464566929 pt).

import type { Segment } from '@/components/InteractiveSvgCanvas';

export interface F70_01_00_00_AParams {
  /** Product width in mm (Width of each curved face panel W = 135mm) */
  width: number;
  /** Product height in mm (Body tube height H = 200mm) */
  height: number;
  /** Product depth in mm (Determines arc curvature/sagitta D = 50mm) */
  depth: number;
  /** Glue flap width in mm (extends to the LEFT of Face panel 1) */
  glueFlap: number;
  /** Thumb notch radius in mm (on Face 2 top and bottom cut flaps) */
  thumbNotchRadius: number;
  /** Sheet width in mm */
  sheetWidth: number;
  /** Sheet height in mm */
  sheetHeight: number;
  /** Sheet margin (subtracted from both width and height) */
  sheetMargin: number;
  /** Gripper (subtracted from height only) */
  gripper: number;
  /** Reference Clone Mode */
  referenceMode?: boolean;
}

export const F70_01_00_00_A_REFERENCE = {
  width: 135.0,
  height: 200.0,
  depth: 50.0,
  glueFlap: 15.5,
  thumbNotchRadius: 13.5,
} as const;

export const F70_01_00_00_A_DEFAULTS: F70_01_00_00_AParams = {
  width: F70_01_00_00_A_REFERENCE.width,
  height: F70_01_00_00_A_REFERENCE.height,
  depth: F70_01_00_00_A_REFERENCE.depth,
  glueFlap: F70_01_00_00_A_REFERENCE.glueFlap,
  thumbNotchRadius: F70_01_00_00_A_REFERENCE.thumbNotchRadius,
  sheetWidth: 1000,
  sheetHeight: 700,
  sheetMargin: 0,
  gripper: 0,
  referenceMode: false,
};

export function usableSheet(p: F70_01_00_00_AParams) {
  const margin = Math.max(0, p.sheetMargin);
  const gripper = Math.max(0, p.gripper);
  const w = Math.max(0, p.sheetWidth - 2 * margin);
  const h = Math.max(0, p.sheetHeight - 2 * margin - gripper);
  return { width: w, height: h };
}

export interface F70_01_00_00_AGeometry {
  params: F70_01_00_00_AParams;
  derived: {
    totalWidth: number;
    totalHeight: number;
    w: number;
    h: number;
    d: number;
    glueFlap: number;
    arcSagitta: number;
    arcRadius: number;
    thumbNotchRadius: number;
  };
  svg: string;
  bbox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    w: number;
    h: number;
  };
  segments: Segment[];
}
