// A60_20_01_01 — ECMA Auto Lock Bottom Box (Crash Lock Bottom)
// Dieline Types and Reference Constants

import type { Segment } from '@/components/InteractiveSvgCanvas';

export interface A60_20_01_01Params {
  /** Product width in mm (Front/Back panel width W = 100mm) */
  width: number;
  /** Product height in mm (Main body height H = 150mm) */
  height: number;
  /** Product depth in mm (Side panel depth D = 50mm) */
  depth: number;
  /** Glue flap width in mm (extends to the LEFT of Side panel 1) */
  glueFlap: number;
  /** Lid tongue height in mm (Top tuck flap tongue) */
  tuck: number;
  /** Sheet width in mm */
  sheetWidth: number;
  /** Sheet height in mm */
  sheetHeight: number;
  /** Sheet margin (subtracted from both width and height) */
  sheetMargin: number;
  /** Gripper (subtracted from height only) */
  gripper: number;
  /** Reference Mode */
  referenceMode?: boolean;
}

export const A60_20_01_01_REFERENCE = {
  width: 100,
  height: 150,
  depth: 50,
  glueFlap: 11.5,
  tuck: 15,
} as const;

export const A60_20_01_01_DEFAULTS: A60_20_01_01Params = {
  width: A60_20_01_01_REFERENCE.width,
  height: A60_20_01_01_REFERENCE.height,
  depth: A60_20_01_01_REFERENCE.depth,
  glueFlap: A60_20_01_01_REFERENCE.glueFlap,
  tuck: A60_20_01_01_REFERENCE.tuck,
  sheetWidth: 1000,
  sheetHeight: 700,
  sheetMargin: 0,
  gripper: 0,
  referenceMode: false,
};

export interface A60_20_01_01Geometry {
  params: A60_20_01_01Params;
  derived: {
    totalWidth: number;
    totalHeight: number;
    w: number;
    h: number;
    d: number;
    glueFlap: number;
    tuck: number;
    topLidHeight: number;
    bottomFlapHeight: number;
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
