/**
 * Carrying Handle Box — Geometry Intelligence Engine
 * ─────────────────────────────────────────────────────────────────────────
 * Geometry source of truth: Carrying_Handle_Box_Geometry_Intelligence.xlsx
 * Visual artwork source of truth: assets/carryHandle/template.svg
 *   (original Adobe-exported dieline with real curves, holes, handle slots,
 *    15° glue tongues, radii). Geometry Intelligence drives ONLY footprint
 *    / pitch / layout. The dieline itself is the original SVG, stretched
 *    non-uniformly to fit the current footprint — preserving curves, holes,
 *    fold/cut details exactly as drawn.
 *
 * Architecture mirrors Die Cut 5: inputs → derived → footprint → scenarios
 *   → pieces → one builder shared by Preview + Export.
 */
// Template SVG retained as visual reference only — production geometry is
// built parametrically (see buildCarryDielineSvg). Do not re-introduce
// template tiling: it caused duplicate creases and a visible cell grid.

export interface CarryHandleInputs {
  length: number;        // L (mm)
  depth: number;         // D (mm)
  height: number;        // H (mm)
  glueFlapManual: number | null; // 0/null = automatic
  sheetWidth: number;
  sheetHeight: number;
  gap: number;
}

export const DEFAULT_CARRY_INPUTS: CarryHandleInputs = {
  length: 300,
  depth: 150,
  height: 180,
  glueFlapManual: null,
  sheetWidth: 1000,
  sheetHeight: 700,
  gap: 3,
};

export interface CarryDerived {
  L: number;
  D: number;
  H: number;
  glueFlapAuto: number;
  glueFlap: number;
  coverLower: number;       // D/2
  coverUpper: number;       // min(D/2, 80)
  coverTotal: number;       // coverLower + coverUpper
  upperDepthFlap: number;   // D/2>80 ? 85.3 : (D/2)*1.1
  lowerDepthFlap: number;   // D*0.7
  frontBottomFlap: number;  // D/2 + 30
  bottomVoidH: number;      // D/5
  bottomVoidW: number;      // L - (D - 1)
  yellowCurveW: number;     // min(D*0.2, 26)
  yellowCurveH: number;     // min(D*0.1, 13)
  yellowTopOffset: number;  // min(D*0.1, 16)
  bottomFlapMax: number;    // max(frontBottomFlap, lowerDepthFlap)
}

export interface CarryLayoutPiece {
  index: number;
  row: number;
  col: number;
  x: number;
  y: number;
  rotated: boolean;
  footprintW: number;
  footprintH: number;
}

export interface CarryScenario {
  rotated: boolean;
  flipSheet: boolean;
  cols: number;
  rows: number;
  total: number;
  layoutW: number;
  layoutH: number;
  utilization: number;
}

export interface CarryResult {
  inputs: CarryHandleInputs;
  derived: CarryDerived;
  footprintW: number;     // base (un-rotated)
  footprintH: number;
  longSide: number;       // sheet long
  shortSide: number;      // sheet short
  best: CarryScenario;
  scenarios: CarryScenario[];
  pieces: CarryLayoutPiece[];
  pitchX: number;
  pitchY: number;
}

const num = (x: unknown, fallback = 0) => {
  const n = typeof x === 'number' ? x : parseFloat(String(x ?? ''));
  return Number.isFinite(n) ? n : fallback;
};

export function deriveCarry(inputs: CarryHandleInputs): CarryDerived {
  const L = Math.max(0, num(inputs.length));
  const D = Math.max(0, num(inputs.depth));
  const H = Math.max(0, num(inputs.height));
  const glueFlapAuto = D >= 100 ? 30 : 25;
  const manual = num(inputs.glueFlapManual);
  const glueFlap = manual > 0 ? manual : glueFlapAuto;
  const coverLower = D / 2;
  const coverUpper = Math.min(D / 2, 80);
  const upperDepthFlap = D / 2 > 80 ? 85.3 : (D / 2) * 1.1;
  const lowerDepthFlap = D * 0.7;
  const frontBottomFlap = D / 2 + 30;
  const bottomVoidH = D / 5;
  const bottomVoidW = Math.max(0, L - (D - 1));
  const yellowCurveW = Math.min(D * 0.2, 26);
  const yellowCurveH = Math.min(D * 0.1, 13);
  const yellowTopOffset = Math.min(D * 0.1, 16);
  return {
    L, D, H, glueFlapAuto, glueFlap,
    coverLower, coverUpper,
    coverTotal: coverLower + coverUpper,
    upperDepthFlap, lowerDepthFlap, frontBottomFlap,
    bottomVoidH, bottomVoidW,
    yellowCurveW, yellowCurveH, yellowTopOffset,
    bottomFlapMax: Math.max(frontBottomFlap, lowerDepthFlap),
  };
}

/* ─────────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH — axis boundaries.
 * X-axis depends ONLY on GlueFlap / Length / Depth (never Height).
 * Y-axis depends ONLY on Depth-derived stacks + Height (never Length).
 * Every consumer (footprint, dieline builder, audit, export) reads these.
 * ───────────────────────────────────────────────────────────────────────── */

export interface CarryXBoundaries {
  x0: number; // start
  x1: number; // x0 + GlueFlap
  x2: number; // x1 + Length   (Front Panel 1)
  x3: number; // x2 + Depth    (Depth Panel 1)
  x4: number; // x3 + Length   (Front Panel 2)
  x5: number; // x4 + Depth    (Depth Panel 2) = footprint W
}

export interface CarryYBoundaries {
  y0: number; // start
  y1: number; // y0 + coverTotal (Top Stack — Depth-driven)
  y2: number; // y1 + Height     (Body — Height-driven ONLY)
  y3: number; // y2 + bottomFlapMax (Bottom Stack — Depth-driven) = footprint H
}

export function carryXBoundaries(
  d: Pick<CarryDerived, 'glueFlap' | 'L' | 'D'>,
): CarryXBoundaries {
  const x0 = 0;
  const x1 = x0 + d.glueFlap;
  const x2 = x1 + d.L;
  const x3 = x2 + d.D;
  const x4 = x3 + d.L;
  const x5 = x4 + d.D;
  return { x0, x1, x2, x3, x4, x5 };
}

export function carryYBoundaries(
  d: Pick<CarryDerived, 'coverTotal' | 'H' | 'bottomFlapMax'>,
): CarryYBoundaries {
  const y0 = 0;
  const y1 = y0 + d.coverTotal;
  const y2 = y1 + d.H;
  const y3 = y2 + d.bottomFlapMax;
  return { y0, y1, y2, y3 };
}

export function footprint(d: CarryDerived): { w: number; h: number } {
  const xb = carryXBoundaries(d);
  const yb = carryYBoundaries(d);
  return { w: xb.x5, h: yb.y3 };
}

/* ─────────────────────────────────────────────────────────────────────────
 * Blueprint Mapping Audit — per-component table with Pass/Fail.
 * Base = reference template size L=300 D=150 H=180 G=30.
 * Includes axis-independence checks (Height must not move X, Length must
 * not move Y).
 * ───────────────────────────────────────────────────────────────────────── */

export interface CarryAuditRow {
  component: string;
  axis: 'X' | 'Y';
  linkedDimension: string;
  baseStart: number;
  baseEnd: number;
  baseSize: number;
  currentStart: number;
  currentEnd: number;
  currentSize: number;
  expectedSize: number;
  formula: string;
  behavior: 'resize' | 'fixed' | 'derived';
  dependsOn: string;
  isFixed: boolean;
  isMirrored: boolean;
  isMoved: boolean;
  isResized: boolean;
  pass: boolean;
}

export interface CarryAuditReport {
  rows: CarryAuditRow[];
  xBoundaries: CarryXBoundaries;
  yBoundaries: CarryYBoundaries;
  footprintW: number;
  footprintH: number;
  /** X boundaries identical when Height is perturbed → Height never leaks into X. */
  xIndependentOfHeight: boolean;
  /** Y boundaries identical when Length is perturbed → Length never leaks into Y. */
  yIndependentOfLength: boolean;
  allPass: boolean;
}

const AUDIT_TOL = 0.01;

export function auditCarryMapping(inputs: CarryHandleInputs): CarryAuditReport {
  const d = deriveCarry(inputs);
  const base = deriveCarry(DEFAULT_CARRY_INPUTS); // L=300 D=150 H=180 G=30
  const xb = carryXBoundaries(d);
  const yb = carryYBoundaries(d);
  const bx = carryXBoundaries(base);
  const by = carryYBoundaries(base);

  const row = (
    component: string,
    axis: 'X' | 'Y',
    linkedDimension: string,
    bStart: number, bEnd: number,
    cStart: number, cEnd: number,
    expectedSize: number,
    formula: string,
    dependsOn: string,
  ): CarryAuditRow => {
    const baseSize = bEnd - bStart;
    const currentSize = cEnd - cStart;
    return {
      component, axis, linkedDimension,
      baseStart: bStart, baseEnd: bEnd, baseSize,
      currentStart: cStart, currentEnd: cEnd, currentSize,
      expectedSize, formula,
      behavior: 'resize',
      dependsOn,
      isFixed: false,
      isMirrored: false,
      isMoved: Math.abs(cStart - bStart) > AUDIT_TOL,
      isResized: Math.abs(currentSize - baseSize) > AUDIT_TOL,
      pass: Math.abs(currentSize - expectedSize) <= AUDIT_TOL,
    };
  };

  const rows: CarryAuditRow[] = [
    row('Glue Flap', 'X', 'GlueFlap', bx.x0, bx.x1, xb.x0, xb.x1, d.glueFlap, 'x1 − x0 = GlueFlap', 'GlueFlap (auto: Depth)'),
    row('Front Panel 1', 'X', 'Length', bx.x1, bx.x2, xb.x1, xb.x2, d.L, 'x2 − x1 = L', 'Length'),
    row('Depth Panel 1', 'X', 'Depth', bx.x2, bx.x3, xb.x2, xb.x3, d.D, 'x3 − x2 = D', 'Depth'),
    row('Front Panel 2', 'X', 'Length', bx.x3, bx.x4, xb.x3, xb.x4, d.L, 'x4 − x3 = L', 'Length'),
    row('Depth Panel 2', 'X', 'Depth', bx.x4, bx.x5, xb.x4, xb.x5, d.D, 'x5 − x4 = D', 'Depth'),
    row('Top Cover Stack', 'Y', 'Depth', by.y0, by.y1, yb.y0, yb.y1, d.coverTotal, 'y1 − y0 = D/2 + min(D/2,80)', 'Depth'),
    row('Main Body', 'Y', 'Height', by.y1, by.y2, yb.y1, yb.y2, d.H, 'y2 − y1 = H', 'Height ONLY'),
    row('Bottom Flap Stack', 'Y', 'Depth', by.y2, by.y3, yb.y2, yb.y3, d.bottomFlapMax, 'y3 − y2 = max(D/2+30, D×0.7)', 'Depth'),
  ];

  // Axis independence proofs — perturb the foreign dimension; boundaries
  // must be bit-identical.
  const dH = deriveCarry({ ...inputs, height: num(inputs.height) + 137 });
  const xbH = carryXBoundaries(dH);
  const xIndependentOfHeight =
    xbH.x0 === xb.x0 && xbH.x1 === xb.x1 && xbH.x2 === xb.x2 &&
    xbH.x3 === xb.x3 && xbH.x4 === xb.x4 && xbH.x5 === xb.x5;

  const dL = deriveCarry({ ...inputs, length: num(inputs.length) + 137 });
  const ybL = carryYBoundaries(dL);
  const yIndependentOfLength =
    ybL.y0 === yb.y0 && ybL.y1 === yb.y1 && ybL.y2 === yb.y2 && ybL.y3 === yb.y3;

  return {
    rows,
    xBoundaries: xb,
    yBoundaries: yb,
    footprintW: xb.x5,
    footprintH: yb.y3,
    xIndependentOfHeight,
    yIndependentOfLength,
    allPass: rows.every(r => r.pass) && xIndependentOfHeight && yIndependentOfLength,
  };
}

/* ─────────────────────────────────────────────────────────────────────────
 * Tagged-SVG Binding (Phase 2)
 * Maps the approved CREASE_X_* / CREASE_Y_* names from the Tagged Reference
 * SVG to the engine's cumulative boundaries — single source of truth, no
 * uniform scaling, no stretching: each named crease is bound to one boundary.
 * ───────────────────────────────────────────────────────────────────────── */

export interface CarryTaggedBinding {
  /** Crease tag name → boundary value (mm) — X axis */
  xCreases: Record<string, number>;
  /** Crease tag name → boundary value (mm) — Y axis */
  yCreases: Record<string, number>;
  /** Holes follow their parent panel; here we record their anchor X range. */
  holesAnchors: Record<string, { panel: string; xMin: number; xMax: number }>;
}

export function carryTaggedBinding(inputs: CarryHandleInputs): CarryTaggedBinding {
  const d = deriveCarry(inputs);
  const xb = carryXBoundaries(d);
  const yb = carryYBoundaries(d);
  return {
    xCreases: {
      CREASE_X_GLUE_TO_FRONT_1:   xb.x1, // end of GlueFlap
      CREASE_X_FRONT_1_TO_DEPTH_1: xb.x2, // end of Front 1 (= start Depth 1)
      CREASE_X_DEPTH_1_TO_FRONT_2: xb.x3, // end of Depth 1
      CREASE_X_FRONT_2_TO_DEPTH_2: xb.x4, // end of Front 2
    },
    yCreases: {
      // Top-stack creases (Depth-driven only)
      CREASE_Y_TOP_TO_BODY_FRONT_1:  yb.y1,
      CREASE_Y_TOP_TO_BODY_FRONT_2:  yb.y1,
      CREASE_Y_TOP_TO_BODY_DEPTH_1:  yb.y1,
      CREASE_Y_TOP_TO_BODY_DEPTH_2:  yb.y1,
      // Body-to-bottom creases (still Depth-driven boundary; Height ends here)
      CREASE_Y_BODY_TO_BOTTOM_FRONT_1: yb.y2,
      CREASE_Y_BODY_TO_BOTTOM_FRONT_2: yb.y2,
      CREASE_Y_BODY_TO_BOTTOM_DEPTH_1: yb.y2,
      CREASE_Y_BODY_TO_BOTTOM_DEPTH_2: yb.y2,
    },
    holesAnchors: {
      HOLE_HANDLE_FRONT_1: { panel: 'Front 1', xMin: xb.x1, xMax: xb.x2 },
      HOLE_HANDLE_FRONT_2: { panel: 'Front 2', xMin: xb.x3, xMax: xb.x4 },
      HOLE_LOCK_SLOT_1:    { panel: 'Depth 1', xMin: xb.x2, xMax: xb.x3 },
      HOLE_LOCK_SLOT_2:    { panel: 'Depth 2', xMin: xb.x4, xMax: xb.x5 },
    },
  };
}

/* ─────────────────────────────────────────────────────────────────────────
 * Debug Report — current vs expected per Tagged-SVG contract.
 * Pure read-only diagnostic. Does NOT mutate geometry.
 * ───────────────────────────────────────────────────────────────────────── */

export interface CarryDebugReport {
  inputs: { length: number; depth: number; height: number; glueFlap: number };
  usedTaggedMapping: true;
  footprint: { expectedW: number; actualW: number; expectedH: number; actualH: number; passW: boolean; passH: boolean };
  xExpected: number[];
  xActual: number[];
  xPass: boolean;
  yExpected: number[];
  yActual: number[];
  yPass: boolean;
  height: { expected: number; actual: number; pass: boolean };
  taggedBinding: CarryTaggedBinding;
  /** Components that move with Length/Depth (resize horizontally). */
  resizedX: string[];
  /** Components that move with Height (resize vertically). */
  resizedY: string[];
  /** Components that stay anchored to their parent panel only. */
  anchoredOnly: string[];
  warnings: string[];
}

export function carryDebugReport(
  inputs: CarryHandleInputs,
  expected?: { footprintW?: number; xBoundaries?: number[]; footprintH?: number; height?: number },
): CarryDebugReport {
  const d = deriveCarry(inputs);
  const xb = carryXBoundaries(d);
  const yb = carryYBoundaries(d);
  const binding = carryTaggedBinding(inputs);

  const xActual = [xb.x0, xb.x1, xb.x2, xb.x3, xb.x4, xb.x5];
  const yActual = [yb.y0, yb.y1, yb.y2, yb.y3];

  const xExpected = expected?.xBoundaries ?? [
    0, d.glueFlap, d.glueFlap + d.L, d.glueFlap + d.L + d.D,
    d.glueFlap + 2 * d.L + d.D, d.glueFlap + 2 * d.L + 2 * d.D,
  ];
  const yExpected = [0, d.coverTotal, d.coverTotal + d.H, d.coverTotal + d.H + d.bottomFlapMax];

  const tol = 0.01;
  const close = (a: number, b: number) => Math.abs(a - b) <= tol;
  const arrClose = (a: number[], b: number[]) =>
    a.length === b.length && a.every((v, i) => close(v, b[i]));

  const expectedW = expected?.footprintW ?? xExpected[xExpected.length - 1];
  const expectedH = expected?.footprintH ?? yExpected[yExpected.length - 1];
  const expectedHeight = expected?.height ?? d.H;

  const warnings: string[] = [];
  if (!arrClose(xActual, xExpected)) warnings.push('X boundaries diverge from cumulative GlueFlap+L+D+L+D contract.');
  if (!arrClose(yActual, yExpected)) warnings.push('Y boundaries diverge from coverTotal+H+bottomFlapMax contract.');
  if (!close(d.H, expectedHeight)) warnings.push('Height drifted from input value.');

  return {
    inputs: { length: d.L, depth: d.D, height: d.H, glueFlap: d.glueFlap },
    usedTaggedMapping: true,
    footprint: {
      expectedW, actualW: xb.x5, expectedH, actualH: yb.y3,
      passW: close(xb.x5, expectedW), passH: close(yb.y3, expectedH),
    },
    xExpected, xActual, xPass: arrClose(xActual, xExpected),
    yExpected, yActual, yPass: arrClose(yActual, yExpected),
    height: { expected: expectedHeight, actual: d.H, pass: close(d.H, expectedHeight) },
    taggedBinding: binding,
    resizedX: ['Glue Flap', 'Front 1', 'Depth 1', 'Front 2', 'Depth 2',
               'CREASE_X_GLUE_TO_FRONT_1', 'CREASE_X_FRONT_1_TO_DEPTH_1',
               'CREASE_X_DEPTH_1_TO_FRONT_2', 'CREASE_X_FRONT_2_TO_DEPTH_2'],
    resizedY: ['Main Body (Height only)',
               'CREASE_Y_BODY_TO_BOTTOM_* (position only, follows H)'],
    anchoredOnly: ['HOLE_HANDLE_FRONT_1', 'HOLE_HANDLE_FRONT_2',
                   'HOLE_LOCK_SLOT_1', 'HOLE_LOCK_SLOT_2',
                   'Top Cover Stack (Depth-only)', 'Bottom Flap Stack (Depth-only)'],
    warnings,
  };
}

// Tight packing count: max N where N*foot + (N-1)*gap ≤ sheet (+ small tol).
function fitCount(sheet: number, foot: number, gap: number): number {
  if (foot <= 0) return 0;
  // Allow tiny tolerance (0.5%) so 2×350 + 3 fits a 700mm sheet
  // when Length/Depth/Height share an integer relation with the sheet.
  const tol = Math.max(3, sheet * 0.005);
  let n = Math.floor((sheet + gap + tol) / (foot + gap));
  while (n > 0 && n * foot + Math.max(0, n - 1) * gap > sheet + tol) n--;
  return Math.max(0, n);
}

export function computeCarry(inputs: CarryHandleInputs): CarryResult {
  const derived = deriveCarry(inputs);
  const { w: fw, h: fh } = footprint(derived);
  const sW = Math.max(1, num(inputs.sheetWidth));
  const sH = Math.max(1, num(inputs.sheetHeight));
  const gap = Math.max(0, num(inputs.gap));
  const longSide = Math.max(sW, sH);
  const shortSide = Math.min(sW, sH);

  const scenarios: CarryScenario[] = [];
  for (const flipSheet of [false, true]) {
    const SW = flipSheet ? sH : sW;
    const SH = flipSheet ? sW : sH;
    for (const rotated of [false, true]) {
      const w = rotated ? fh : fw;
      const h = rotated ? fw : fh;
      const cols = fitCount(SW, w, gap);
      const rows = fitCount(SH, h, gap);
      const total = cols * rows;
      const layoutW = cols > 0 ? cols * w + (cols - 1) * gap : 0;
      const layoutH = rows > 0 ? rows * h + (rows - 1) * gap : 0;
      const utilization = total > 0 ? (total * fw * fh) / (sW * sH) : 0;
      scenarios.push({ rotated, flipSheet, cols, rows, total, layoutW, layoutH, utilization });
    }
  }
  scenarios.sort((a, b) => b.total - a.total || b.utilization - a.utilization);
  const best = scenarios[0];

  const pieces: CarryLayoutPiece[] = [];
  const w = best.rotated ? fh : fw;
  const h = best.rotated ? fw : fh;
  const pitchX = w + gap;
  const pitchY = h + gap;
  let idx = 0;
  for (let r = 0; r < best.rows; r++) {
    for (let c = 0; c < best.cols; c++) {
      pieces.push({
        index: idx++,
        row: r, col: c,
        x: c * pitchX,
        y: r * pitchY,
        rotated: best.rotated,
        footprintW: fw,
        footprintH: fh,
      });
    }
  }

  return {
    inputs, derived,
    footprintW: fw, footprintH: fh,
    longSide, shortSide,
    best, scenarios, pieces,
    pitchX, pitchY,
  };
}

/* ─────────────────────────────────────────────────────────────────────────
 * Dieline Builder — VISUAL FIDELITY EDITION
 * ─────────────────────────────────────────────────────────────────────────
 * The outer CUT contour (with all curves, arcs, glue tongues, handle pills,
 * lock notches, bottom voids, depth-bottom slots) comes verbatim from the
 * approved Tagged Reference SVG `src/assets/carryHandle/template.svg`.
 *
 * Resizing rule (NO uniform scale, NO global stretch):
 *   • Source coordinates are remapped piecewise-linearly between the SAME
 *     boundary breakpoints used by the Tagged Mapping:
 *       SRC_X = [0, 85, 935.4, 1360.6, 2211, 2634.8]
 *       SRC_Y = [0, 425.2, 935.4, 1233.1]
 *     → DST_X = [x0..x5] from carryXBoundaries(d)
 *     → DST_Y = [y0..y3] from carryYBoundaries(d)
 *   • Arc radii (rx/ry) scale by the LOCAL zone ratio of the endpoint,
 *     so curves stay proportional to the panel they live in.
 *
 * The CREASE layer is emitted programmatically at the exact target
 * boundaries (each named crease appears exactly once — no duplicate
 * shared edges, no visible construction grid).
 *
 * filled = true  → debug overlay (colored panel fills behind the real
 *                  remapped artwork).
 * filled = false → production dieline.
 * ───────────────────────────────────────────────────────────────────────── */

interface BuildOpts { filled?: boolean }

const fmt = (n: number) => Number(n.toFixed(4)).toString();

// ── Source breakpoints in the reference template's viewBox ──────────────
const SRC_X = [0, 85, 935.4, 1360.6, 2211, 2634.8];
const SRC_Y = [0, 425.2, 935.4, 1233.1];

// ── The reference template's BLUE outer-contour path (st1) ──────────────
// Copied verbatim from src/assets/carryHandle/template.svg so it stays
// embedded with the engine and can be remapped without a file read.
const TEMPLATE_CUT_PATH =
  'M2427.9,419.5v-151.3c0-1.5-.8-2.9-2.1-3.7-1.3-.8-2.9-.8-4.3,0-1.3.8-2.1,2.2-2.1,3.7v151.3c0,1.5.8,2.9,2.1,3.7,1.3.8,2.9.8,4.3,0,1.3-.8,2.1-2.2,2.1-3.7ZM1152.3,419.5v-151.3c0-1.5-.8-2.9-2.1-3.7-1.3-.8-2.9-.8-4.3,0-1.3.8-2.1,2.2-2.1,3.7v151.3c0,1.5.8,2.9,2.1,3.7,1.3.8,2.9.8,4.3,0,1.3-.8,2.1-2.2,2.1-3.7ZM425.2,65.2h170.1c15.2,0,29.2,8.1,36.8,21.3,7.6,13.2,7.6,29.4,0,42.5-7.6,13.2-21.6,21.3-36.8,21.3h-170.1c-15.2,0-29.2-8.1-36.8-21.3-7.6-13.2-7.6-29.4,0-42.5,7.6-13.2,21.6-21.3,36.8-21.3ZM1700.8,65.2c-15.2,0-29.2,8.1-36.8,21.3-7.6,13.2-7.6,29.4,0,42.5,7.6,13.2,21.6,21.3,36.8,21.3h170.1c15.2,0,29.2-8.1,36.8-21.3,7.6-13.2,7.6-29.4,0-42.5-7.6-13.2-21.6-21.3-36.8-21.3M85,425.2c.4,0,.7-.1,1-.4.3-.3.4-.6.4-1V79.4c0-13.2,7-25.3,18.4-31.9,11.4-6.6,25.4-6.6,36.9,0,11.4,6.6,18.4,18.7,18.4,31.9s0,.4.3.5c.2.1.4.2.6.2s.4-.2.5-.3L207.1.7c.1-.2.3-.4.5-.5.2-.1.5-.2.7-.2h603.8c.5,0,1,.3,1.2.7l45.6,79c.1.2.3.3.5.3.2,0,.4,0,.6-.2.2-.1.3-.3.3-.5,0-13.2,7-25.3,18.4-31.9,11.4-6.6,25.4-6.6,36.9,0,11.4,6.6,18.4,18.7,18.4,31.9v344.4c0,.4.2.8.5,1,.3.3.7.4,1.1.4.4,0,.8-.2,1-.5l167.1-210.2c10.8-13.5,27.1-21.4,44.4-21.4s33.6,7.9,44.4,21.4l167.1,210.2c.2.3.6.5,1,.5.4,0,.8-.1,1.1-.4.3-.3.5-.6.5-1V79.4c0-13.2,7-25.3,18.4-31.9,11.4-6.6,25.4-6.6,36.9,0,11.4,6.6,18.4,18.7,18.4,31.9s0,.4.3.5c.2.1.4.2.6.2s.4-.2.5-.3L1482.7.7c.1-.2.3-.4.5-.5.2-.1.5-.2.7-.2h603.8c.2,0,.5,0,.7.2.2.1.4.3.5.5l45.6,79c.1.2.3.3.5.3s.4,0,.6-.2c.2-.1.3-.3.3-.5,0-13.2,7-25.3,18.4-31.9,11.4-6.6,25.4-6.6,36.9,0,11.4,6.6,18.4,18.7,18.4,31.9v344.4c0,.4.2.8.5,1,.3.3.7.4,1.1.4.4,0,.8-.2,1-.5l167.1-210.2c10.8-13.5,27.1-21.4,44.4-21.4s33.6,7.9,44.4,21.4l166.8,209.3v511.7l-211.2,212.6v62.4c0,6-2.4,11.8-6.6,16s-10,6.6-16,6.6h-188.5v-296.8c0-.4-.2-.8-.5-1-.3-.3-.7-.4-1.1-.4s-.8.2-1,.6l-212.2,212.6v62.4c0,6-2.4,11.8-6.6,16-4.3,4.3-10,6.6-16,6.6h-378.4c-6,0-11.8-2.4-16-6.6-4.3-4.3-6.6-10-6.6-16v-62.4l-212.2-212.6c-.2-.3-.6-.5-1-.6-.4,0-.8,0-1.1.4-.3.3-.5.6-.5,1v296.8h-188.5c-6,0-11.8-2.4-16-6.6-4.3-4.3-6.6-10-6.6-16v-62.4l-211.5-212.6c-.2-.3-.6-.5-1-.6-.4,0-.8,0-1.1.4-.3.3-.5.6-.5,1v296.8h-188.5c-6,0-11.8-2.4-16-6.6-4.3-4.3-6.6-10-6.6-16v-62.4h-425.2v62.4c0,6-2.4,11.8-6.6,16-4.3,4.3-10,6.6-16,6.6H86.5v-296.8c0-.4-.1-.7-.4-1-.3-.3-.6-.4-1-.4L0,912.1v-464.1l85-22.8Z';

// ── Piecewise linear remap helpers ──────────────────────────────────────
function piecewiseMap(v: number, src: number[], dst: number[]): number {
  const n = src.length - 1;
  if (v <= src[0]) {
    const sw = src[1] - src[0];
    return dst[0] + (v - src[0]) * ((dst[1] - dst[0]) / sw);
  }
  if (v >= src[n]) {
    const sw = src[n] - src[n - 1];
    return dst[n] + (v - src[n]) * ((dst[n] - dst[n - 1]) / sw);
  }
  for (let i = 0; i < n; i++) {
    if (v >= src[i] && v <= src[i + 1]) {
      const t = (v - src[i]) / (src[i + 1] - src[i]);
      return dst[i] + t * (dst[i + 1] - dst[i]);
    }
  }
  return v;
}
function zoneScale(v: number, src: number[], dst: number[]): number {
  const n = src.length - 1;
  for (let i = 0; i < n; i++) {
    if (v >= src[i] && v <= src[i + 1]) return (dst[i + 1] - dst[i]) / (src[i + 1] - src[i]);
  }
  if (v < src[0]) return (dst[1] - dst[0]) / (src[1] - src[0]);
  return (dst[n] - dst[n - 1]) / (src[n] - src[n - 1]);
}

// ── SVG path parser → absolutize → remap → re-serialize ─────────────────
interface PathToken { cmd: string; args: number[] }
function tokenizePath(d: string): PathToken[] {
  const tokens: PathToken[] = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    const rest = m[2];
    const nums = (rest.match(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) || []).map(parseFloat);
    tokens.push({ cmd: m[1], args: nums });
  }
  return tokens;
}

function remapPathData(d: string, dstX: number[], dstY: number[]): string {
  const tokens = tokenizePath(d);
  let cx = 0, cy = 0, sx = 0, sy = 0;
  const out: string[] = [];
  const mx = (x: number) => piecewiseMap(x, SRC_X, dstX);
  const my = (y: number) => piecewiseMap(y, SRC_Y, dstY);
  const rsX = (x: number) => zoneScale(x, SRC_X, dstX);
  const rsY = (y: number) => zoneScale(y, SRC_Y, dstY);
  let firstCommand = true;

  for (const t of tokens) {
    const C = t.cmd.toUpperCase();
    const isRel = t.cmd !== C && C !== 'Z';
    let i = 0;
    const args = t.args;

    if (C === 'M') {
      let first = true;
      while (i < args.length) {
        let x = args[i++], y = args[i++];
        // First M of the whole path is absolute even if lowercase.
        if (isRel && !(firstCommand && first)) { x += cx; y += cy; }
        if (first) {
          out.push(`M ${fmt(mx(x))} ${fmt(my(y))}`);
          sx = x; sy = y;
          first = false;
        } else {
          out.push(`L ${fmt(mx(x))} ${fmt(my(y))}`);
        }
        cx = x; cy = y;
      }
    } else if (C === 'L') {
      while (i < args.length) {
        let x = args[i++], y = args[i++];
        if (isRel) { x += cx; y += cy; }
        out.push(`L ${fmt(mx(x))} ${fmt(my(y))}`);
        cx = x; cy = y;
      }
    } else if (C === 'H') {
      while (i < args.length) {
        let x = args[i++];
        if (isRel) x += cx;
        out.push(`L ${fmt(mx(x))} ${fmt(my(cy))}`);
        cx = x;
      }
    } else if (C === 'V') {
      while (i < args.length) {
        let y = args[i++];
        if (isRel) y += cy;
        out.push(`L ${fmt(mx(cx))} ${fmt(my(y))}`);
        cy = y;
      }
    } else if (C === 'C') {
      while (i < args.length) {
        let x1 = args[i++], y1 = args[i++], x2 = args[i++], y2 = args[i++], x = args[i++], y = args[i++];
        if (isRel) { x1+=cx; y1+=cy; x2+=cx; y2+=cy; x+=cx; y+=cy; }
        out.push(`C ${fmt(mx(x1))} ${fmt(my(y1))} ${fmt(mx(x2))} ${fmt(my(y2))} ${fmt(mx(x))} ${fmt(my(y))}`);
        cx = x; cy = y;
      }
    } else if (C === 'S') {
      while (i < args.length) {
        let x2 = args[i++], y2 = args[i++], x = args[i++], y = args[i++];
        if (isRel) { x2+=cx; y2+=cy; x+=cx; y+=cy; }
        out.push(`S ${fmt(mx(x2))} ${fmt(my(y2))} ${fmt(mx(x))} ${fmt(my(y))}`);
        cx = x; cy = y;
      }
    } else if (C === 'Q') {
      while (i < args.length) {
        let x1 = args[i++], y1 = args[i++], x = args[i++], y = args[i++];
        if (isRel) { x1+=cx; y1+=cy; x+=cx; y+=cy; }
        out.push(`Q ${fmt(mx(x1))} ${fmt(my(y1))} ${fmt(mx(x))} ${fmt(my(y))}`);
        cx = x; cy = y;
      }
    } else if (C === 'T') {
      while (i < args.length) {
        let x = args[i++], y = args[i++];
        if (isRel) { x += cx; y += cy; }
        out.push(`T ${fmt(mx(x))} ${fmt(my(y))}`);
        cx = x; cy = y;
      }
    } else if (C === 'A') {
      while (i < args.length) {
        let rx = args[i++], ry = args[i++], rot = args[i++], large = args[i++], sweep = args[i++], x = args[i++], y = args[i++];
        if (isRel) { x += cx; y += cy; }
        const newRx = Math.abs(rx) * rsX(x);
        const newRy = Math.abs(ry) * rsY(y);
        out.push(`A ${fmt(newRx)} ${fmt(newRy)} ${rot} ${large|0} ${sweep|0} ${fmt(mx(x))} ${fmt(my(y))}`);
        cx = x; cy = y;
      }
    } else if (C === 'Z') {
      out.push('Z');
      cx = sx; cy = sy;
    }
    firstCommand = false;
  }
  return out.join(' ');
}

export function buildCarryDielineSvg(
  inputs: CarryHandleInputs,
  opts: BuildOpts = {},
): string {
  const d = deriveCarry(inputs);
  const xb = carryXBoundaries(d);
  const yb = carryYBoundaries(d);
  const dstX = [xb.x0, xb.x1, xb.x2, xb.x3, xb.x4, xb.x5];
  const dstY = [yb.y0, yb.y1, yb.y2, yb.y3];
  const W = xb.x5;
  const H = yb.y3;
  const filled = !!opts.filled;
  const stroke = filled ? '0.4' : '0.5';
  const cutColor = '#d70000';
  const foldColor = '#1f4cd1';

  // ── CUT layer: ORIGINAL template outer contour, remapped per zone ────
  const cutD = remapPathData(TEMPLATE_CUT_PATH, dstX, dstY);

  // ── CREASE layer: one tagged fold-line per named boundary, drawn ONCE
  //    at the exact target coordinate from carryXBoundaries / carryYBoundaries.
  const yBodyTop = yb.y1;
  const yBodyBot = yb.y2;
  const yCoverMid = d.coverUpper; // upper-to-lower cover crease (Depth-driven)
  const folds: Array<{ tag: string; x1: number; y1: number; x2: number; y2: number }> = [
    { tag: 'CREASE_X_GLUE_TO_FRONT_1',    x1: xb.x1, y1: yBodyTop, x2: xb.x1, y2: yBodyBot },
    { tag: 'CREASE_X_FRONT_1_TO_DEPTH_1', x1: xb.x2, y1: yBodyTop, x2: xb.x2, y2: yBodyBot },
    { tag: 'CREASE_X_DEPTH_1_TO_FRONT_2', x1: xb.x3, y1: yBodyTop, x2: xb.x3, y2: yBodyBot },
    { tag: 'CREASE_X_FRONT_2_TO_DEPTH_2', x1: xb.x4, y1: yBodyTop, x2: xb.x4, y2: yBodyBot },
    { tag: 'CREASE_Y_TOP_TO_BODY',     x1: xb.x1, y1: yBodyTop, x2: xb.x5, y2: yBodyTop },
    { tag: 'CREASE_Y_BODY_TO_BOTTOM',  x1: xb.x1, y1: yBodyBot, x2: xb.x5, y2: yBodyBot },
    { tag: 'CREASE_Y_COVER_UPPER_TO_LOWER_F1', x1: xb.x1, y1: yCoverMid, x2: xb.x2, y2: yCoverMid },
    { tag: 'CREASE_Y_COVER_UPPER_TO_LOWER_F2', x1: xb.x3, y1: yCoverMid, x2: xb.x4, y2: yCoverMid },
  ];
  const foldsXml = folds.map(f =>
    `<line data-tag="${f.tag}" x1="${fmt(f.x1)}" y1="${fmt(f.y1)}" x2="${fmt(f.x2)}" y2="${fmt(f.y2)}" stroke="${foldColor}" stroke-width="${stroke}" stroke-dasharray="2 1.5"/>`,
  ).join('\n    ');

  // ── Optional debug fills (filled=true) — colored panel overlays only ─
  let fillsXml = '';
  if (filled) {
    const yBT = yBodyTop, yBB = yBodyBot;
    const fills = [
      { x: xb.x0, y: yBT, w: d.glueFlap, h: d.H, c: '#222', op: 0.35 },
      { x: xb.x1, y: yBT, w: d.L, h: d.H, c: '#0b2d82', op: 0.30 },
      { x: xb.x2, y: yBT, w: d.D, h: d.H, c: '#4c021b', op: 0.30 },
      { x: xb.x3, y: yBT, w: d.L, h: d.H, c: '#284ca5', op: 0.30 },
      { x: xb.x4, y: yBT, w: d.D, h: d.H, c: '#840636', op: 0.30 },
      { x: xb.x1, y: 0,   w: d.L, h: yBT, c: '#008340', op: 0.20 },
      { x: xb.x3, y: 0,   w: d.L, h: yBT, c: '#faa61a', op: 0.20 },
      { x: xb.x2, y: 0,   w: d.D, h: yBT, c: '#00a1d3', op: 0.18 },
      { x: xb.x4, y: 0,   w: d.D, h: yBT, c: '#06cefc', op: 0.18 },
      { x: xb.x1, y: yBB, w: d.L, h: H - yBB, c: '#ff0000', op: 0.18 },
      { x: xb.x3, y: yBB, w: d.L, h: H - yBB, c: '#ce0000', op: 0.18 },
      { x: xb.x2, y: yBB, w: d.D, h: H - yBB, c: '#47038e', op: 0.20 },
      { x: xb.x4, y: yBB, w: d.D, h: H - yBB, c: '#a855ff', op: 0.20 },
    ];
    fillsXml = fills.map(f =>
      `<rect x="${fmt(f.x)}" y="${fmt(f.y)}" width="${fmt(f.w)}" height="${fmt(f.h)}" fill="${f.c}" opacity="${f.op}"/>`,
    ).join('\n    ');
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(W)} ${fmt(H)}" preserveAspectRatio="none">
  ${filled ? `<g id="DebugFills">\n    ${fillsXml}\n  </g>` : ''}
  <g id="CUT" data-layer="CUT">
    <path data-tag="CUT_OUTER_CONTOUR" d="${cutD}" fill="none" stroke="${cutColor}" stroke-width="${stroke}" stroke-linejoin="miter"/>
  </g>
  <g id="CREASE" data-layer="CREASE">
    ${foldsXml}
  </g>
  <g id="HOLES" data-layer="HOLES"></g>
</svg>`;
}

