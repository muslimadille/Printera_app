// D001 — Dieline Types and Reference Constants
// Reference values were measured directly from src/assets/D001/template.svg
// (units converted from pt to mm using PT_PER_MM = 2.83464566929).

export interface D001Params {
  /** Product width in mm (Face panel width) */
  width: number;
  /** Product height in mm (Face panel height) */
  height: number;
  /** Product depth in mm */
  depth: number;
  /** Glue flap width in mm (extends to the LEFT of Face1) */
  glueFlap: number;
  /** Lid tongue height in mm — controls ONLY the lid Béziers (Seg 12/14/41/43) */
  lidTongue: number;
  /** Lock (mm) — controls ONLY Seg 4/22/29/33 vertical (and CUT_48/50/52/54 length) */
  depthTongue: number;
  /**
   * Depth Tongue Total Height (mm) — controls the FULL height of all four
   * depth tongues by flexing ONLY the middle ramp region (Seg 6/7 area).
   * Lock (Seg 4) and end chamfers (Seg 5/9) remain unchanged.
   * Auto-computed default: depthTongue + 2 + depth/2.
   * undefined / 0 / non-finite ⇒ engine falls back to the auto value.
   */
  depthTongueTotalHeight?: number;
  /**
   * Depth Tongue Corner Radius (mm) — fillet ONLY at the sharp meeting point
   * between the ramp (Seg 6/21/27/35) and horizontal top/bottom of the tongue
   * (Seg 7/20/26/36) on all four depth tongues. 0 = no change (sharp corner).
   * Auto-clamped to the largest geometrically safe radius.
   */
  depthTongueCornerRadius?: number;
  /** Glue Flap Top Angle (°) — controls slant of Segment 1 only. Default 25. */
  glueFlapTopAngle?: number;
  /** Glue Flap Bottom Angle (°) — controls slant of Segment 46 only. Default 25. */
  glueFlapBottomAngle?: number;
  /** Sheet width in mm */
  sheetWidth: number;
  /** Sheet height in mm */
  sheetHeight: number;
  /** Sheet margin (subtracted from both width and height) */
  sheetMargin: number;
  /** Gripper (subtracted from height only) */
  gripper: number;
  /**
   * Reference Clone Mode.
   * When true, buildD001Geometry returns the exact TEMPLATE.svg geometry
   * (visual + segment-by-segment) regardless of any other inputs.
   * Used as the calibration baseline before enabling dynamic rules.
   */
  referenceMode?: boolean;
}

// Reference dimensions extracted from TEMPLATE.svg (mm).
// These are the ONLY values for which buildD001Geometry is guaranteed
// to reproduce the template byte-for-byte in reference mode.
// Note: Cover_Vertical is auto-derived (D - 0.25), NOT a user input.
export const D001_REFERENCE = {
  width: 50,
  height: 130,
  depth: 40,
  glueFlap: 12,
  lidTongue: 14.25,   // controls only lid Béziers
  depthTongue: 5,     // controls only depth tongue heights (seg4H at calibration)
  depthTongueTotalHeight: 27, // 5 (lock) + 2 (SEG5_LEG) + 20 (D/2) at reference
} as const;

/** Auto value for Depth_Tongue_Total_Height given current lock + depth. */
export const autoDepthTongueTotalHeight = (lock: number, depth: number) =>
  lock + 2 + depth / 2;

export const D001_DEFAULTS: D001Params = {
  width: D001_REFERENCE.width,
  height: D001_REFERENCE.height,
  depth: D001_REFERENCE.depth,
  glueFlap: D001_REFERENCE.glueFlap,
  lidTongue: D001_REFERENCE.lidTongue,
  depthTongue: D001_REFERENCE.depthTongue,
  depthTongueTotalHeight: D001_REFERENCE.depthTongueTotalHeight,
  depthTongueCornerRadius: 0,
  glueFlapTopAngle: 25,
  glueFlapBottomAngle: 25,
  sheetWidth: 1000,
  sheetHeight: 700,
  sheetMargin: 0,
  gripper: 0,
  referenceMode: false,
};

export const D001_RULES = {
  faceHeight: (h: number) => h + 0.5,
  depth1: (d: number) => d,
  depth2: (d: number) => d - 0.5,
  coverVertical: (d: number) => d - 0.25,
  lidCurveHeight: 14.25,
} as const;

export function usableSheet(p: D001Params) {
  return {
    width: p.sheetWidth - 2 * p.sheetMargin,
    height: p.sheetHeight - 2 * p.sheetMargin - p.gripper,
  };
}
