// A01.01.00.00 — Straight Tuck-End Box (No Top/Bottom Flaps)
// ---------------------------------------------------------------
// The simplest box: 4 panels (Face-Depth-Face-Depth) + Glue Flap.
// Top and bottom are fully open (no flaps, no lid, no locking).

export interface A01010000Params {
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
}

export const A01010000_DEFAULTS: A01010000Params = {
  W: 283.47,
  D: 141.73,
  H: 425.2,
  GF: 32.6,
  GH: 8.44,
};

export const A01010000_REFERENCE: A01010000Params = {
  ...A01010000_DEFAULTS,
};

export const A01010000_RULES = {
  minW: 10,
  maxW: 1200,
  minD: 5,
  maxD: 800,
  minH: 5,
  maxH: 2000,
  minGF: 5,
  maxGF: 200,
} as const;

export interface A01010000Geometry {
  svg: string;
  bbox: { w: number; h: number };
  segments: number;
}
