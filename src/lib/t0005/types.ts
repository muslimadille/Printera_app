// T0005 — Dieline Types and Reference Constants
// Reference values were measured directly from A10_01_03_00_32.svg
// (units converted from pt to mm using PT_PER_MM = 2.83464566929).

export interface T0005Params {
  /** Product width in mm */
  width: number;
  /** Product height in mm */
  height: number;
  /** Product depth in mm */
  depth: number;
  /** Glue flap width in mm */
  glueFlap: number;
  /** Bottom tuck lock flap height in mm */
  lidTongue: number;
  /** Dust flap height in mm */
  dustFlap: number;
  /** Sheet width in mm */
  sheetWidth: number;
  /** Sheet height in mm */
  sheetHeight: number;
  /** Sheet margin */
  sheetMargin: number;
  /** Gripper margin */
  gripper: number;
  /** Reference Clone Mode */
  referenceMode?: boolean;
}

export const T0005_REFERENCE = {
  width: 100,
  height: 150,
  depth: 50,
  glueFlap: 12.21, // ~34.6pt base width
  lidTongue: 49.0, // bottom tuck flap height is ~138.9pt ≈ 49mm
  dustFlap: 32.0,  // bottom dust flap height is ~90.71pt ≈ 32mm
} as const;

export const T0005_DEFAULTS: T0005Params = {
  width: T0005_REFERENCE.width,
  height: T0005_REFERENCE.height,
  depth: T0005_REFERENCE.depth,
  glueFlap: T0005_REFERENCE.glueFlap,
  lidTongue: T0005_REFERENCE.lidTongue,
  dustFlap: T0005_REFERENCE.dustFlap,
  sheetWidth: 1000,
  sheetHeight: 700,
  sheetMargin: 15,
  gripper: 15,
  referenceMode: false,
};

export const T0005_RULES = {
  faceHeight: (h: number) => h,
  d2: (d: number) => d - 0.5,
} as const;

export interface Pt { x: number; y: number }

export interface Segment {
  id: number;
  svgId: string;
  kind: "OUTER" | "CUT" | "CREASE";
  geometry: "line" | "bezier" | "polyline" | "arc" | string;
  start: Pt;
  end: Pt;
  bezier?: { c1: Pt; c2: Pt };
  points?: Pt[];
  arc?: { rx: number; ry: number; xar: number; laf: number; sf: number };
  d?: string;
}

export interface T0005Geometry {
  params: T0005Params;
  derived: {
    W: number;
    H: number;
    D: number;
    Gf: number;
    Lt: number;
    Df: number;
    d2: number;
    width: number;
    height: number;
  };
  segments: Segment[];
  svg: string;
  bbox: { w: number; h: number };
}

export function usableSheet(p: T0005Params) {
  const margin = Math.max(0, p.sheetMargin);
  const gripper = Math.max(0, p.gripper);
  return {
    width: Math.max(0, p.sheetWidth - 2 * margin),
    height: Math.max(0, p.sheetHeight - 2 * margin - gripper),
  };
}
