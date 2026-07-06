// T0001 — Reverse Tuck-End Box (A10.10.03.03)
// ---------------------------------------------------------------
// 4 panels (Face-Depth-Face-Depth) + Glue Flap
// Top & Bottom: alternating tuck flaps and dust flaps
// Top: Tuck(P1), Dust(P2), Tuck(P3), Dust+Notch(P4)
// Bottom: Tuck(P1), Dust+Notch(P2), Tuck(P3), Dust(P4)

export interface T0001Params {
  /** Face panel width (mm) — panels 1 & 3 */
  W: number;
  /** Depth panel width (mm) — panels 2 & 4 */
  D: number;
  /** Box height (mm) */
  H: number;
  /** Glue flap width (mm) */
  GF: number;
  /** Glue flap chamfer height (mm) */
  GH?: number;
  /** Tuck flap height (mm) — top/bottom large flaps */
  TH?: number;
  /** Tuck flap chamfer (mm) — 45° diagonal on tuck flap corners */
  TC?: number;
  /** Dust flap height (mm) — small side flaps */
  DH?: number;
  /** Dust flap corner radius (mm) */
  DR?: number;
  /** Small transition corner radius (mm) */
  SR?: number;
  /** Panel 4 clearance reduction (mm) */
  CL?: number;
  /** Notch height (mm) — step cut in dust flaps */
  NH?: number;
  /** Notch tab width (mm) */
  NW?: number;
  /** Notch tab corner radius (mm) */
  NR?: number;

  // Sheet parameters for nesting
  sheetWidth: number;
  sheetHeight: number;
  sheetMargin: number;
  gripper: number;
  referenceMode?: boolean;
}

export const T0001_DEFAULTS: T0001Params = {
  W: 283.47,
  D: 141.73,
  H: 425.2,
  GF: 34.6,
  GH: 8.44,
  TH: 138.9,
  TC: 21.26,
  DH: 62.64,
  DR: 8.5,
  SR: 3.4,
  CL: 1.41,
  NH: 26.22,
  NW: 14.88,
  NR: 8.51,

  sheetWidth: 1000,
  sheetHeight: 700,
  sheetMargin: 10,
  gripper: 10,
  referenceMode: false,
};

export const T0001_REFERENCE: T0001Params = {
  ...T0001_DEFAULTS,
};

export const T0001_RULES = {
  minW: 20,
  maxW: 1200,
  minD: 10,
  maxD: 800,
  minH: 20,
  maxH: 2000,
  minGF: 5,
  maxGF: 100,
} as const;

export interface T0001Geometry {
  params: T0001Params;
  segments: any[]; // Returning Segment[] to support InteractiveSvgCanvas
  bbox: { w: number; h: number };
  svg: string;
}

export function usableSheet(p: T0001Params) {
  return {
    width: p.sheetWidth - 2 * p.sheetMargin,
    height: p.sheetHeight - 2 * p.sheetMargin - p.gripper,
  };
}
