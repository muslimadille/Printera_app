// A01.70.00.00 — Sealing Closing Box (No Bottom Flaps)
// -------------------------------------------------------------
// A rectangular box: 4 panels (Face-Depth-Face-Depth) + Glue Flap.
// Top: Sealing closing. Bottom: Without flaps.

export interface A01700000Params {
  /** Face panel width (mm) — panels 1 & 3 */
  W: number;
  /** Depth panel width (mm) — panels 2 & 4 */
  D: number;
  /** Box height (mm) */
  H: number;
  /** Glue flap width (mm) */
  GF: number;
  /** Glue flap chamfer height (mm) — reference ~8.44 */
  GH?: number;
  /** Triangular flap height (mm) — reference ~110.7 */
  FH?: number;
  /** Sealing flap height (mm) — reference ~22.67 */
  SF?: number;
  /** Glue flap top chamfer height (mm) — reference ~50.92 */
  GD?: number;
}

export const A01700000_DEFAULTS: A01700000Params = {
  W: 283.47,
  D: 141.73,
  H: 425.2,
  GF: 32.6,
  GH: 8.44,
  FH: 110.7,
  SF: 22.67,
  GD: 50.92,
};

export const A01700000_REFERENCE: A01700000Params = {
  ...A01700000_DEFAULTS,
};

export const A01700000_RULES = {
  minW: 10,
  maxW: 1200,
  minD: 5,
  maxD: 800,
  minH: 5,
  maxH: 2000,
  minGF: 5,
  maxGF: 200,
} as const;

export interface A01700000Geometry {
  svg: string;
  bbox: { w: number; h: number };
  segments: number;
}
