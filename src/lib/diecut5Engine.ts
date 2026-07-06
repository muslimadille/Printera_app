/**
 * Die Cut 5 — PARAMETRIC REBUILD (Die Cut 2 architecture)
 * ───────────────────────────────────────────────────────────────────────────
 * Source of truth ONLY:
 *   • 300×150×180 mm.svg              — Original SVG (red outlines, blue interlock)
 *   • 300×150×180 mm_Color.svg        — Colored zone reference
 *   • Die_Cut_5_Manual_Blueprint_FINAL.xlsx — anchors, zones, formulas
 *
 * FORBIDDEN — explicitly NOT used here:
 *   • Grid slicing / cell stretch of the Original SVG (the old failed engine)
 *   • Any inheritance from Die Cut / 2 / 3 / 4 geometry
 *   • Inferred rules — every dimension comes from the blueprint
 *
 * METHOD (Die Cut 2 architecture, new geometry):
 *   1. Anchor-first layout: AX0..AX5 along X, AY0..AY4 along Y, derived from
 *      L / D / H + a fixed glue-flap width measured from the Original SVG.
 *   2. Each piece is a parametric rectangle (procedural) defined by anchors
 *      and offsets — Parent / Child relationships make children move with
 *      their parents (handle slot follows the handle band, etc.).
 *   3. Sacred curves (handle slot, purple tongue, bottom interlock corners)
 *      are stored as normalized 0..1 path templates inside the piece's own
 *      bbox. At render time they scale with the piece — never approximated,
 *      never cell-stretched.
 *   4. Calibration is ENVELOPE-ONLY (additive trims on footprint, never on
 *      piece interiors).
 *   5. ONE builder (buildDieline5Svg) drives BOTH preview and export →
 *      Visible Geometry === Export Geometry.
 */

export interface DieCut5Inputs {
  sheetWidth: number;
  sheetHeight: number;
  gap: number;
  boxLength: number;   // L (mm)
  boxDepth: number;    // D (mm)
  boxHeight: number;   // H (mm)
  sideTrim: number;        // mm added to footprint width (envelope only)
  verticalTrim: number;    // mm added to footprint height (envelope only)
  manualPitchX: number | null;
  manualPitchY: number | null;
}

export const DEFAULT_D5_INPUTS: DieCut5Inputs = {
  sheetWidth: 1000,
  sheetHeight: 700,
  gap: 0,
  boxLength: 300,
  boxDepth: 150,
  boxHeight: 180,
  sideTrim: 0,
  verticalTrim: 0,
  manualPitchX: null,
  manualPitchY: null,
};

// ── Reference dims from blueprint sheet 01_INPUTS (300×150×180 mm) ────────
export const D5_NATIVE = {
  refL: 300,
  refD: 150,
  refH: 180,
  // Original SVG: 0 0 2677.3 1233.1 pt @ 2.8347 pt/mm.
  // Glue flap x-anchor in pt = 127.6 → 45.00 mm (kept SVG-derived, never inferred).
  glueWidthMm: 127.6 / 2.8347,
};

// ── Derived — SVG-validated scaling laws ──────────────────────────────────
// Verified against correct Pacdora SVG 270×140×165 (viewBox 2450.55×1142.42 pt):
//   Width  = glue + L + D + L + (D−0.5) = 45 + 270 + 140 + 270 + 139.5 = 864.5 mm ✓
//   Height = handleH + topLidH + H + bottomFlapH = 70 + 70 + 165 + 98 = 403 mm ✓
//   ⇒ Total height = 1.7·D + H  (also validated at 300×150×180 → 435 mm)
//
//   • Top closure tab (handleH)  = D × 0.5    (70@D=140, 75@D=150)
//   • Top main band  (topLidH)   = D × 0.5
//   • Body                       = H
//   • Bottom flap                = D × 0.70   (98@D=140, 105@D=150)
//   • Glue side flap (LEFT)      = 45 mm  (SVG-derived constant)
//   • Face1 / Face2              = L
//   • Depth1 = D ; Depth2 = D − 0.5
// Sacred (never scale): handle slot, triangle peak 25, tongue width 3.
export interface D5Derived {
  L: number; D: number; H: number;
  dCal: number;            // D − 0.5  (Depth2 panel)
  handleW: number;         // L − 1
  handleH: number;         // Top closure tab = D × 0.5
  topLidH: number;         // Main top band   = D × 0.5
  bottomFlapH: number;     // D × 0.70
  centerGap: number;       // D / 5
  cornerAngleDeg: number;  // 8°
  topDepthTongueW: number; // CONSTANT 3 mm
  topDepthTongueH: number; // CONSTANT 25 mm
  lowerSidePortion: number;// (D/2) − 0.5
  glueWidth: number;       // CONSTANT 45 mm
  handleSlotW: number;     // CONSTANT 90 mm
  handleSlotH: number;     // CONSTANT 30 mm
  handleMarginTop: number; // D × 0.25
}

export const computeD5Derived = (i: DieCut5Inputs): D5Derived => {
  const L = Math.max(0, i.boxLength);
  const D = Math.max(0, i.boxDepth);
  const H = Math.max(0, i.boxHeight);
  return {
    L, D, H,
    dCal:             Math.max(0, D - 0.5),
    handleW:          Math.max(0, L - 1),
    handleH:          D * 0.5,                       // ← SVG: D/2 (corrected)
    topLidH:          D * 0.5,                       // ← SVG: D/2
    bottomFlapH:      D * 0.70,                      // ← SVG: D×0.70
    centerGap:        D / 5,
    cornerAngleDeg:   8,
    topDepthTongueW:  3,
    topDepthTongueH:  25,
    lowerSidePortion: Math.max(0, D / 2 - 0.5),
    glueWidth:        45,                            // ← constant 45 mm
    handleSlotW:      90,
    handleSlotH:      30,
    handleMarginTop:  D * 0.25,
  };
};

// ── Anchors (sheet 06_ANCHOR_BLUEPRINT) — mm ──────────────────────────────
export interface D5Anchors {
  ax: number[]; // 6 entries (AX0..AX5)
  ay: number[]; // 5 entries (AY0..AY4)
  footprintW: number;
  footprintH: number;
  baseFootprintW: number;
  baseFootprintH: number;
}

export const computeD5Anchors = (i: DieCut5Inputs, d: D5Derived): D5Anchors => {
  const ax = [
    0,
    d.glueWidth,
    d.glueWidth + d.L,
    d.glueWidth + d.L + d.D,
    d.glueWidth + d.L + d.D + d.L,
    d.glueWidth + d.L + d.D + d.L + d.dCal,
  ];
  const ay = [
    0,
    d.handleH,
    d.handleH + d.topLidH,
    d.handleH + d.topLidH + d.H,
    d.handleH + d.topLidH + d.H + d.bottomFlapH,
  ];
  const baseW = ax[5];
  const baseH = ay[4];
  return {
    ax, ay,
    baseFootprintW: baseW,
    baseFootprintH: baseH,
    footprintW: baseW + Math.max(0, i.sideTrim),
    footprintH: baseH + Math.max(0, i.verticalTrim),
  };
};

// ── Piece definitions ─────────────────────────────────────────────────────
export interface D5PathSeg { type: 'M' | 'L' | 'C' | 'Z'; v?: number[] }
export interface D5PieceDef {
  id: string;
  arabic: string;
  color: string;       // fill (for colored zones display)
  stroke: string;      // outline (cut line)
  parent?: string;     // parent anchor key (for documentation; positions are absolute mm)
  depends: string;     // 'L', 'D', 'H' or combinations
  x: number; y: number; w: number; h: number;
  /** Normalized 0..1 path inside this piece bbox. When set, renders as <path>. */
  pathShape?: D5PathSeg[];
  pathMirror?: boolean;
}

const COLORS = {
  glue:        '#8C8C8C',
  face1:       '#9ED7F5',
  face2:       '#7FC2EB',
  depth1:      '#A9DCA1',
  depth2:      '#2E8B3D',
  handleBand:  '#27408B', // dark blue handle band
  lidBand:     '#F299C8', // pink
  bottomFlap:  '#F4A460', // bottom interlock
  tongue:      '#7B2FB0', // purple tongue
  handleSlot:  '#FFFFFF',
};

const STROKE = '#FA0000';

// Sacred curves (normalized 0..1 inside their piece's bbox) ────────────────
//
// HANDLE_SLOT — Stadium / rounded oval, extracted from Original SVG path
// (M467.7,65.2 h170.1 c15.2,0 29.2,8.1 36.8,21.3 c7.6,13.2 7.6,29.4 0,42.5
//  c-7.6,13.2 -21.6,21.3 -36.8,21.3 h-170.1 ...). Bbox W=240.65pt, H=84.95pt.
// Normalized so left edge=0, top=0, right=1, bottom=1.
const HANDLE_SLOT: D5PathSeg[] = [
  // Start at top-left of the straight top, then go right to top-right
  { type: 'M', v: [0.15, 0.00] },
  { type: 'L', v: [0.85, 0.00] },
  // Right cap (semicircle approximated with 2 cubics)
  { type: 'C', v: [0.9275, 0.00, 0.9988, 0.0954, 1.0376, 0.2510] },
  { type: 'C', v: [1.0764, 0.4063, 1.0764, 0.5937, 1.0376, 0.7490] },
  { type: 'C', v: [0.9988, 0.9046, 0.9275, 1.0000, 0.85, 1.0000] },
  { type: 'L', v: [0.15, 1.0000] },
  // Left cap
  { type: 'C', v: [0.0725, 1.0000, 0.0012, 0.9046, -0.0376, 0.7490] },
  { type: 'C', v: [-0.0764, 0.5937, -0.0764, 0.4063, -0.0376, 0.2510] },
  { type: 'C', v: [0.0012, 0.0954, 0.0725, 0.00, 0.15, 0.00] },
  { type: 'Z' },
];

// PURPLE_TONGUE — vertical stadium tongue at the top of each depth column.
// Original SVG: M1186.4,419.5 v-151.3 c0,-1.5 ...  Bbox W=8.6pt, H=156pt
// (a thin vertical scoring slot). At print scale, it is barely visible; we
// keep it normalized so it scales with the tongue rect.
const PURPLE_TONGUE: D5PathSeg[] = [
  { type: 'M', v: [0.50, 0.00] },
  { type: 'C', v: [0.65, 0.00, 0.85, 0.10, 0.85, 0.25] },
  { type: 'L', v: [0.85, 0.75] },
  { type: 'C', v: [0.85, 0.90, 0.65, 1.00, 0.50, 1.00] },
  { type: 'C', v: [0.35, 1.00, 0.15, 0.90, 0.15, 0.75] },
  { type: 'L', v: [0.15, 0.25] },
  { type: 'C', v: [0.15, 0.10, 0.35, 0.00, 0.50, 0.00] },
  { type: 'Z' },
];

// BOTTOM_FACE_FLAP — outline for a Face-column bottom flap with chamfered
// top corners (8° per F10) and a centered convex curve at the bottom edge
// that meets its neighbor depth flap (interlock). Normalized inside bbox.
// Slopes: chamfer X-inset = tan(8°)*flapHeight / flapWidth.
const buildBottomFaceShape = (w: number, h: number, gap: number): D5PathSeg[] => {
  // Chamfer cut in mm: horizontal inset on each top corner = tan(8°)*h.
  const TAN8 = Math.tan(8 * Math.PI / 180);
  const insetMm = Math.min(w * 0.4, TAN8 * h);
  const nx = w > 0 ? insetMm / w : 0;
  const gapNX = w > 0 ? gap / (2 * w) : 0; // half of center gap (mm) over width
  const cx1 = Math.max(0.05, 0.5 - 0.18);
  const cx2 = Math.min(0.95, 0.5 + 0.18);
  return [
    { type: 'M', v: [nx, 0.0] },
    { type: 'L', v: [1 - nx, 0.0] },
    { type: 'L', v: [1.0, 1.0 - gapNX * 2] },
    // small concave curve into the side gap
    { type: 'C', v: [1.0, 1.0, 0.95, 1.0, 0.5 + gapNX, 1.0] },
    { type: 'C', v: [cx2, 1.0, cx1, 1.0, 0.5 - gapNX, 1.0] },
    { type: 'C', v: [0.05, 1.0, 0.0, 1.0, 0.0, 1.0 - gapNX * 2] },
    { type: 'Z' },
  ];
};

// BOTTOM_DEPTH_FLAP — outline for a Depth-column bottom flap with thumb-cut
// notch at the center (matches Original SVG's "C-shape" interlock indent).
const buildBottomDepthShape = (w: number, h: number): D5PathSeg[] => {
  const TAN8 = Math.tan(8 * Math.PI / 180);
  const insetMm = Math.min(w * 0.4, TAN8 * h);
  const nx = w > 0 ? insetMm / w : 0;
  // Center thumb notch: 0.35..0.65 wide, depth 0.18.
  return [
    { type: 'M', v: [nx, 0.0] },
    { type: 'L', v: [1 - nx, 0.0] },
    { type: 'L', v: [1.0, 1.0] },
    { type: 'L', v: [0.65, 1.0] },
    { type: 'C', v: [0.65, 0.82, 0.35, 0.82, 0.35, 1.0] },
    { type: 'L', v: [0.0, 1.0] },
    { type: 'Z' },
  ];
};

// PURPLE_TONGUE_OUTLINE — Top tongue on depth columns. The tongue sits ON
// TOP of the depth column (Y: AY0..AY1+AY2). Width = D - 1.5, height =
// (D × 0.5) × 1.086. We render as a vertical stadium that points DOWNWARD
// into the depth zone (matches Original SVG: the curve points down).
const buildPurpleTongueShape = (): D5PathSeg[] => [
  { type: 'M', v: [0.5, 0.00] },
  { type: 'L', v: [0.95, 0.00] },
  { type: 'C', v: [0.95, 0.55, 0.75, 1.00, 0.50, 1.00] },
  { type: 'C', v: [0.25, 1.00, 0.05, 0.55, 0.05, 0.00] },
  { type: 'L', v: [0.50, 0.00] },
  { type: 'Z' },
];

export function buildD5Pieces(i: DieCut5Inputs): {
  pieces: D5PieceDef[];
  footprintW: number;
  footprintH: number;
  baseFootprintW: number;
  baseFootprintH: number;
} {
  const d = computeD5Derived(i);
  const a = computeD5Anchors(i, d);
  const [AX0, AX1, AX2, AX3, AX4, AX5] = a.ax;
  const [AY0, AY1, AY2, AY3, AY4] = a.ay;

  const faceW = d.L;
  const face2W = d.L;
  const depth1W = d.D;
  const depth2W = d.dCal;
  const bodyH = d.H;
  const bandH = d.handleH;     // = D × 0.5
  const lidH = d.topLidH;      // = D × 0.5
  const botH = d.bottomFlapH;  // = D × 0.7

  const pieces: D5PieceDef[] = [];

  // ─── BODY ROW (Y: AY2 → AY3) ─────────────────────────────────────────
  pieces.push({
    id: 'GLUE_FLAP', arabic: 'لسان اللصق', parent: 'AX0/AY2',
    color: COLORS.glue, stroke: STROKE, depends: 'H,SVG',
    x: AX0, y: AY2, w: d.glueWidth, h: bodyH,
  });
  pieces.push({
    id: 'FACE_1', arabic: 'الواجهة الأولى', parent: 'AX1/AY2',
    color: COLORS.face1, stroke: STROKE, depends: 'L,H',
    x: AX1, y: AY2, w: faceW, h: bodyH,
  });
  pieces.push({
    id: 'DEPTH_1', arabic: 'العمق الأول', parent: 'AX2/AY2',
    color: COLORS.depth1, stroke: STROKE, depends: 'D,H',
    x: AX2, y: AY2, w: depth1W, h: bodyH,
  });
  pieces.push({
    id: 'FACE_2', arabic: 'الواجهة الثانية', parent: 'AX3/AY2',
    color: COLORS.face2, stroke: STROKE, depends: 'L,H',
    x: AX3, y: AY2, w: face2W, h: bodyH,
  });
  pieces.push({
    id: 'DEPTH_2', arabic: 'العمق الثاني', parent: 'AX4/AY2',
    color: COLORS.depth2, stroke: STROKE, depends: 'D-0.5,H',
    x: AX4, y: AY2, w: depth2W, h: bodyH,
  });

  // ─── HANDLE BAND ROW (Y: AY0 → AY1) — Face1 + Face2 only ─────────────
  // Child: handle slot (sacred path) centered horizontally and vertically.
  const slotW = d.handleSlotW;
  const slotH = d.handleSlotH;
  for (const [faceX, faceLabel] of [[AX1, 'F1'], [AX3, 'F2']] as const) {
    pieces.push({
      id: `HANDLE_BAND_${faceLabel}`, arabic: `خانة حامل اليد — ${faceLabel}`,
      parent: `${faceLabel}/AY0`,
      color: COLORS.handleBand, stroke: STROKE, depends: 'L,D',
      x: faceX + 0.5, y: AY0, w: faceW - 1, h: bandH,    // = handleW × handleH
    });
    pieces.push({
      id: `HANDLE_SLOT_${faceLabel}`, arabic: `فتحة حامل اليد — ${faceLabel}`,
      parent: `HANDLE_BAND_${faceLabel}`,
      color: COLORS.handleSlot, stroke: STROKE, depends: 'L,D (SACRED)',
      x: faceX + (faceW - slotW) / 2,
      y: AY0 + (bandH - slotH) / 2,
      w: slotW, h: slotH,
      pathShape: HANDLE_SLOT,
    });
  }

  // ─── LID BAND ROW (Y: AY1 → AY2) — Face1 + Face2 only ────────────────
  for (const [faceX, faceLabel] of [[AX1, 'F1'], [AX3, 'F2']] as const) {
    pieces.push({
      id: `LID_BAND_${faceLabel}`, arabic: `خانة الغطاء — ${faceLabel}`,
      parent: `${faceLabel}/AY1`,
      color: COLORS.lidBand, stroke: STROKE, depends: 'L,D',
      x: faceX + 0.5, y: AY1, w: faceW - 1, h: lidH,
    });
  }

  // ─── DEPTH TOP (Y: AY0 → AY2) — purple tongue cap on each depth col ──
  for (const [depthX, depthW, depthLabel] of [
    [AX2, depth1W, 'D1'], [AX4, depth2W, 'D2'],
  ] as const) {
    const tongueW = d.topDepthTongueW;
    const tongueH = d.topDepthTongueH;
    pieces.push({
      id: `DEPTH_TONGUE_${depthLabel}`, arabic: `اللسان العلوي للعمق — ${depthLabel}`,
      parent: `${depthLabel}/AY0`,
      color: COLORS.tongue, stroke: STROKE, depends: 'D (SACRED)',
      x: depthX + (depthW - tongueW) / 2,
      y: AY2 - tongueH,
      w: tongueW, h: tongueH,
      pathShape: buildPurpleTongueShape(),
    });
  }

  // ─── BOTTOM FLAPS ROW (Y: AY3 → AY4) ─────────────────────────────────
  // Face columns get the chamfered + center-gap shape;
  // depth columns get the thumb-cut shape. All shapes derive from D, L, H
  // and the F09/F10 rules (centerGap = D/5, corner = 8°).
  const faceShape = buildBottomFaceShape(faceW, botH, d.centerGap);
  const face2Shape = buildBottomFaceShape(face2W, botH, d.centerGap);
  const depth1Shape = buildBottomDepthShape(depth1W, botH);
  const depth2Shape = buildBottomDepthShape(depth2W, botH);

  pieces.push({
    id: 'BOTTOM_FACE_1', arabic: 'لسان أسفل الواجهة الأولى',
    parent: 'FACE_1/AY3',
    color: COLORS.bottomFlap, stroke: STROKE, depends: 'L,D (SACRED corners)',
    x: AX1, y: AY3, w: faceW, h: botH,
    pathShape: faceShape,
  });
  pieces.push({
    id: 'BOTTOM_DEPTH_1', arabic: 'لسان أسفل العمق الأول',
    parent: 'DEPTH_1/AY3',
    color: COLORS.bottomFlap, stroke: STROKE, depends: 'D (SACRED notch)',
    x: AX2, y: AY3, w: depth1W, h: botH,
    pathShape: depth1Shape,
  });
  pieces.push({
    id: 'BOTTOM_FACE_2', arabic: 'لسان أسفل الواجهة الثانية',
    parent: 'FACE_2/AY3',
    color: COLORS.bottomFlap, stroke: STROKE, depends: 'L,D (SACRED corners)',
    x: AX3, y: AY3, w: face2W, h: botH,
    pathShape: face2Shape,
  });
  pieces.push({
    id: 'BOTTOM_DEPTH_2', arabic: 'لسان أسفل العمق الثاني',
    parent: 'DEPTH_2/AY3',
    color: COLORS.bottomFlap, stroke: STROKE, depends: 'D-0.5 (SACRED notch)',
    x: AX4, y: AY3, w: depth2W, h: botH,
    pathShape: depth2Shape,
  });

  return {
    pieces,
    footprintW: a.footprintW,
    footprintH: a.footprintH,
    baseFootprintW: a.baseFootprintW,
    baseFootprintH: a.baseFootprintH,
  };
}

// ── ONE BUILDER — Preview = Export ────────────────────────────────────────
const fmt = (n: number) => n.toFixed(4);

function pathToD(p: D5PieceDef): string {
  if (!p.pathShape) return '';
  const mirror = !!p.pathMirror;
  const X = (nx: number) => p.x + (mirror ? (1 - nx) : nx) * p.w;
  const Y = (ny: number) => p.y + ny * p.h;
  const parts: string[] = [];
  for (const s of p.pathShape) {
    if (s.type === 'Z') { parts.push('Z'); continue; }
    if (!s.v) continue;
    if (s.type === 'M' || s.type === 'L') {
      parts.push(`${s.type} ${fmt(X(s.v[0]))} ${fmt(Y(s.v[1]))}`);
    } else { // C
      parts.push(`C ${fmt(X(s.v[0]))} ${fmt(Y(s.v[1]))}, ${fmt(X(s.v[2]))} ${fmt(Y(s.v[3]))}, ${fmt(X(s.v[4]))} ${fmt(Y(s.v[5]))}`);
    }
  }
  return parts.join(' ');
}

export interface BuildDielineOpts {
  /** When true, draw colored zone fills under the original SVG outlines. */
  filled?: boolean;
}

// ── ONE BUILDER — parametric anchors + Original-SVG path templates ────────
// Internal sizing/placement = corrected parametric anchors (untouched).
// Visual shape       = literal Original-SVG path templates (`d` strings
// extracted verbatim from `template.svg`), each transformed from its source
// bbox in SVG pt to its engine-zone bbox in mm. No simplified procedural
// rectangles / arcs / generic curves. Visible Geometry === Export Geometry.
import {
  HANDLE_SLOT_F1, HANDLE_SLOT_F2,
  TONGUE_D1, TONGUE_D2,
  OUTER_CONTOUR,
  transformSvgPath,
} from './diecut5SvgPaths';

export function buildDieline5Svg(inputs: DieCut5Inputs, opts: BuildDielineOpts = {}): string {
  const d = computeD5Derived(inputs);
  const a = computeD5Anchors(inputs, d);
  const [AX0, AX1, AX2, AX3, AX4, AX5] = a.ax;
  const [AY0, AY1, AY2, AY3, AY4] = a.ay;
  const { pieces, footprintW, footprintH } = buildD5Pieces(inputs);

  // 1) Score-grid rectangles from corrected anchors (internal divisions only,
  //    no stroke on bottom-flap pieces — their outline comes from the
  //    Original SVG outer contour overlay).
  const scoreIds = new Set([
    'GLUE_FLAP', 'FACE_1', 'DEPTH_1', 'FACE_2', 'DEPTH_2',
    'HANDLE_BAND_F1', 'HANDLE_BAND_F2',
    'LID_BAND_F1', 'LID_BAND_F2',
  ]);
  const grid = pieces
    .filter(p => scoreIds.has(p.id))
    .map(p => {
      const fill = opts.filled ? p.color : 'none';
      const fillOp = opts.filled ? '0.45' : '1';
      return `    <rect x="${fmt(p.x)}" y="${fmt(p.y)}" width="${fmt(p.w)}" height="${fmt(p.h)}" fill="${fill}" fill-opacity="${fillOp}" stroke="${p.stroke}" stroke-width="0.25" vector-effect="non-scaling-stroke" data-id="${p.id}" />`;
    }).join('\n');

  // 2) Sacred Original-SVG path templates, each scaled into its corrected
  //    engine zone bbox. Target bboxes match the engine pieces exactly so
  //    every slot/tongue lands inside its parent band/column.
  const handleBandF1 = pieces.find(p => p.id === 'HANDLE_BAND_F1')!;
  const handleBandF2 = pieces.find(p => p.id === 'HANDLE_BAND_F2')!;
  const tongueD1 = pieces.find(p => p.id === 'DEPTH_TONGUE_D1')!;
  const tongueD2 = pieces.find(p => p.id === 'DEPTH_TONGUE_D2')!;

  // Depth-tongue source bbox spans the depth column's above-body strip
  // (AY0..AY2 in SVG ref). Map onto the engine tongue piece occupying
  // the same relative position inside the engine depth column.
  const d1Col = { x: AX2, y: AY0, w: d.D,    h: AY2 - AY0 };
  const d2Col = { x: AX4, y: AY0, w: d.dCal, h: AY2 - AY0 };

  // For the depth tongues we use the FULL depth-column above-body strip as
  // both source and target — the tongue path lands at the correct relative
  // position within the strip (no need to compute tongue bbox separately).
  const overlays = [
    { id: 'HANDLE_SLOT_F1', t: HANDLE_SLOT_F1, dst: { x: handleBandF1.x, y: handleBandF1.y, w: handleBandF1.w, h: handleBandF1.h } },
    { id: 'HANDLE_SLOT_F2', t: HANDLE_SLOT_F2, dst: { x: handleBandF2.x, y: handleBandF2.y, w: handleBandF2.w, h: handleBandF2.h } },
    { id: 'TONGUE_D1',      t: TONGUE_D1,      dst: d1Col },
    { id: 'TONGUE_D2',      t: TONGUE_D2,      dst: d2Col },
  ].map(o =>
    `    <path d="${transformSvgPath(o.t.d, o.t.srcBbox, o.dst)}" fill="none" stroke="#FA0000" stroke-width="0.25" vector-effect="non-scaling-stroke" data-id="${o.id}" />`
  ).join('\n');

  // 3) Outer dieline contour — the perimeter (glue tab, top tongue tabs,
  //    bottom interlock flaps). Authored against the full source viewBox;
  //    target = full footprint. Provides the Original SVG visual shape for
  //    every external edge without procedural approximation.
  const outer = `    <path d="${transformSvgPath(
    OUTER_CONTOUR.d,
    OUTER_CONTOUR.srcBbox,
    { x: 0, y: 0, w: footprintW, h: footprintH },
  )}" fill="none" stroke="#FA0000" stroke-width="0.25" vector-effect="non-scaling-stroke" data-id="OUTER_CONTOUR" />`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(footprintW)} ${fmt(footprintH)}" preserveAspectRatio="xMidYMid meet">
  <g id="diecut5">
${grid}
${overlays}
${outer}
  </g>
</svg>`;
}

// ── Packing & scenarios (independent — Die Cut 5 only) ────────────────────
export type D5Orientation = '0°' | '90°';
export interface D5Scenario {
  key: 'normal' | 'rotated' | 'manual';
  label: string;
  orientation: D5Orientation | 'Manual';
  cols: number; rows: number; total: number;
  footprintW: number; footprintH: number;
  pitchX: number; pitchY: number;
  layoutW: number; layoutH: number;
  remainingW: number; remainingH: number;
  utilization: number;
}
export interface D5Piece {
  index: number; row: number; col: number;
  x: number; y: number;
  footprintW: number; footprintH: number;
  rotated: boolean;
}
export interface DieCut5Result {
  derived: D5Derived;
  anchors: D5Anchors;
  pieceDefs: D5PieceDef[];
  footprintW: number; footprintH: number;
  baseFootprintW: number; baseFootprintH: number;
  pitchX: number; pitchY: number;
  autoPitchX: number; autoPitchY: number;
  best: D5Scenario;
  scenarios: D5Scenario[];
  pieces: D5Piece[];
  longSide: number; shortSide: number;
}

const safeFloor = (n: number) => (Number.isFinite(n) ? Math.floor(n) : 0);

function buildScenario(
  key: D5Scenario['key'], label: string, orientation: D5Scenario['orientation'],
  fpW: number, fpH: number, pitchX: number, pitchY: number,
  longSide: number, shortSide: number,
): D5Scenario {
  const cols = longSide >= fpW && pitchX > 0 ? 1 + safeFloor((longSide - fpW) / pitchX) : 0;
  const rows = shortSide >= fpH && pitchY > 0 ? 1 + safeFloor((shortSide - fpH) / pitchY) : 0;
  const total = Math.max(0, cols) * Math.max(0, rows);
  const layoutW = cols > 0 ? fpW + (cols - 1) * pitchX : 0;
  const layoutH = rows > 0 ? fpH + (rows - 1) * pitchY : 0;
  const sheetArea = longSide * shortSide;
  return {
    key, label, orientation,
    footprintW: fpW, footprintH: fpH,
    pitchX, pitchY, cols, rows, total,
    layoutW, layoutH,
    remainingW: longSide - layoutW,
    remainingH: shortSide - layoutH,
    utilization: sheetArea > 0 ? Math.min(1, (total * fpW * fpH) / sheetArea) : 0,
  };
}

export const computeDieCut5 = (inputs: DieCut5Inputs): DieCut5Result => {
  const derived = computeD5Derived(inputs);
  const anchors = computeD5Anchors(inputs, derived);
  const { pieces: pieceDefs, footprintW, footprintH, baseFootprintW, baseFootprintH } =
    buildD5Pieces(inputs);

  const longSide = Math.max(inputs.sheetWidth, inputs.sheetHeight);
  const shortSide = Math.min(inputs.sheetWidth, inputs.sheetHeight);

  const autoPitchX = footprintW + inputs.gap;
  const autoPitchY = footprintH + inputs.gap;
  const pitchX = inputs.manualPitchX && inputs.manualPitchX > 0 ? inputs.manualPitchX : autoPitchX;
  const pitchY = inputs.manualPitchY && inputs.manualPitchY > 0 ? inputs.manualPitchY : autoPitchY;

  const sc0  = buildScenario('normal',  'صفوف عادية — 0°',  '0°',
    footprintW, footprintH, pitchX, pitchY, longSide, shortSide);
  const sc90 = buildScenario('rotated', 'دوران 90°',         '90°',
    footprintH, footprintW, pitchY, pitchX, longSide, shortSide);
  const scM  = buildScenario('manual',  'سيناريو يدوي',      'Manual',
    footprintW, footprintH, pitchX, pitchY, longSide, shortSide);
  const scenarios = [sc0, sc90, scM];
  const best = scenarios.reduce((a, b) => (b.total > a.total ? b : a));

  const rotated = best.key === 'rotated';
  const localW = rotated ? footprintH : footprintW;
  const localH = rotated ? footprintW : footprintH;
  const offX = Math.max(0, (longSide - best.layoutW) / 2);
  const offY = Math.max(0, (shortSide - best.layoutH) / 2);

  const pieces: D5Piece[] = [];
  for (let i = 0; i < best.total; i++) {
    const row = 1 + Math.floor(i / best.cols);
    const col = 1 + (i % best.cols);
    pieces.push({
      index: i + 1, row, col,
      x: offX + (col - 1) * best.pitchX,
      y: offY + (row - 1) * best.pitchY,
      footprintW: localW, footprintH: localH,
      rotated,
    });
  }

  return {
    derived, anchors, pieceDefs,
    footprintW, footprintH, baseFootprintW, baseFootprintH,
    pitchX, pitchY, autoPitchX, autoPitchY,
    scenarios, best, pieces, longSide, shortSide,
  };
};
