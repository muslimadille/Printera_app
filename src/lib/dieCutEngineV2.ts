// Die Cut 2 — PARAMETRIC REBUILD (from Colored_DieCut_390x220x83_Parametric_Model.xlsx)
// ─────────────────────────────────────────────────────────────────────────────
// Source of truth (ONLY):
//   • 390×220×83 mm.svg              — outline (red) reference geometry.
//   • 390×220×83 mm Color.svg        — colored zone reference.
//   • Colored_DieCut_390x220x83_Parametric_Model.xlsx — piece-by-piece XY map.
//
// FORBIDDEN — explicitly NOT used here (no inheritance from Die Cut 1):
//   • 45% / 10% rules, VI 1:1 with depth, envelope (L+2D)×(2H+3D),
//     side-flap auto-grow, packing logic from Die Cut 1.
//
// METHOD:
//   1. Each piece is a rectangle defined parametrically from L, H, D and
//      offsets taken directly from Excel 01_Inputs.
//   2. Layout is anchor-based — left lock at x=0, then ear → side depth →
//      base → side depth → ear → lock; tabs anchor to base column.
//   3. Footprint = MaxX − MinX × MaxY − MinY of the final piece set
//      (visible geometry = export geometry, no cached paths).

export interface DieCutV2Inputs {
  sheetWidth: number;
  sheetHeight: number;
  gap: number;
  boxLength: number;
  boxDepth: number;
  boxHeight: number;
  sideTrim: number;
  verticalTrim: number;
  verticalInterlock: number;
  horizontalInterlock: number;
  manualPitchX?: number | null;
  manualPitchY?: number | null;
}

export type V2StretchAxis = 'horizontal' | 'vertical';
export type V2StretchDepends = 'Length' | 'Depth' | 'Height' | 'Calibration';

export interface V2StretchZone {
  key: string;
  label: string;
  axis: V2StretchAxis;
  depends: V2StretchDepends;
  base: number;
  current: number;
  startBase: number;
  endBase: number;
  start: number;
  end: number;
}

export interface V2StretchZones {
  horizontal: V2StretchZone[];
  vertical: V2StretchZone[];
  baseFootprintW: number;
  baseFootprintH: number;
  footprintW: number;
  footprintH: number;
}

/** A single die-cut piece (rectangle in mm, in dieline-local coords). */
export interface DieCutV2PieceDef {
  id: string;
  arabic: string;
  color: string;        // fill color used for visual zones
  stroke: string;       // outline color (cut line)
  depends: string;      // 'L,H,D' etc — informational
  x: number; y: number;
  w: number; h: number;
  /** Outer corner radius (mm) — used only for simple rounded-rect pieces */
  radius?: number;
  /**
   * Optional curved outline taken verbatim from the original SVG (390×220×83 mm).
   * Coordinates are normalized 0..1 within the piece's bbox (0,0 = top-left).
   * When set, the piece renders as <path d="..."> preserving original Bézier curves.
   */
  pathShape?: Array<
    | ['M' | 'L', number, number]
    | ['C', number, number, number, number, number, number]
    | ['Z']
  >;
  /** If true, mirror pathShape horizontally (used for right-side counterparts) */
  pathMirror?: boolean;
}

export interface DieCutV2Scenario {
  key: 'normal' | 'rotated' | 'manual';
  label: string;
  orientation: '0°' | '90°' | 'Manual';
  footprintW: number;
  footprintH: number;
  pitchX: number;
  pitchY: number;
  cols: number;
  rows: number;
  total: number;
  utilization: number;
  remainingW: number;
  remainingH: number;
  layoutW: number;
  layoutH: number;
}

export interface DieCutV2Piece {
  index: number;
  row: number;
  col: number;
  x: number;
  y: number;
  footprintW: number;
  footprintH: number;
  rotated: boolean;
}

export interface DieCutV2TemplateBox {
  /** Drawing-space SVG viewBox dimensions (mm). Always equals footprint. */
  viewBoxWmm: number;
  viewBoxHmm: number;
  drawOriginXmm: number;
  drawOriginYmm: number;
  drawWmm: number;
  drawHmm: number;
}

export interface DieCutV2Geometry {
  zones: V2StretchZones;
  pieces: DieCutV2PieceDef[];
  templateBbox: DieCutV2TemplateBox;
  footprintW: number;
  footprintH: number;
  autoPitchX: number;
  autoPitchY: number;
  pitchX: number;
  pitchY: number;
}

export interface DieCutV2Result {
  scenarios: DieCutV2Scenario[];
  best: DieCutV2Scenario;
  pieces: DieCutV2Piece[];
  longSide: number;
  shortSide: number;
  footprintW: number;
  footprintH: number;
  autoPitchX: number;
  autoPitchY: number;
  pitchX: number;
  pitchY: number;
  geometry: DieCutV2Geometry;
}

const safeFloor = (n: number) => (Number.isFinite(n) ? Math.floor(n) : 0);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/* ───────────────────────────────────────────────────────────────────── */
/*  PARAMETRIC PIECE BUILDER                                              */
/*  All offsets from Excel sheet "01_Inputs" of                            */
/*  Colored_DieCut_390x220x83_Parametric_Model.xlsx                        */
/* ───────────────────────────────────────────────────────────────────── */

const COLORS = {
  base:        '#231F20', // black
  topDepth:    '#CC000F', // red
  lid:         '#006A32', // dark green
  lidFlap:     '#14458A', // dark blue — Lid Flap (top row, was missing)
  bottomDepth: '#F17E26', // orange
  sideDepth:   '#5A5B5D', // dark gray
  sideFlap:    '#C0C2C4', // light gray
  lock:        '#60318F', // purple
  lidSideFlap: '#0FDB75', // light green
  blueTab:     '#00AEEF', // light blue — sits on Lid Flap row (not Lid row)
  pinkTab:     '#EC008C', // pink
  yellowTab:   '#FED615', // yellow
};

export function buildPiecesV2(inputs: DieCutV2Inputs): {
  pieces: DieCutV2PieceDef[];
  footprintW: number;
  footprintH: number;
  baseX: number;
  baseY: number;
} {
  const L = Math.max(0, inputs.boxLength);
  const H = Math.max(0, inputs.boxHeight);
  const D = Math.max(0, inputs.boxDepth);

  // Dimensions (Excel 02_Derived_Formulas + Original SVG measurements)
  const lockW       = 2.25;
  const sideFlapW   = Math.max(0, D - 0.75);
  const sideDepthW  = D;
  const baseW       = L;
  const baseH       = H;
  const topDepthW   = Math.max(0, L - 1);
  const topDepthH   = D;
  const bottomDepthW = Math.max(0, L - 2);
  const bottomDepthH = Math.max(0, D - 0.5);
  const lidW        = Math.max(0, L - 3);
  const lidH        = Math.max(0, H + 0.5);
  // Dark blue Lid Flap — TOP row (preserves original SVG geometry: width=L-3, height=D-0.75)
  const lidFlapW    = Math.max(0, L - 3);
  const lidFlapH    = Math.max(0, D - 0.75);
  const pinkW       = clamp(H * 0.4, H * 0.27, H * 0.45);
  const pinkH       = Math.max(0, D - 1.25);
  const yellowW     = pinkW;
  const yellowH     = Math.max(0, D - 1);
  const lidSideFlapW = sideFlapW;
  const lidSideFlapH = lidH;
  // Lid Tongue Length — Pacdora piecewise rule with strict breakpoint at D=80mm.
  // Rule A (D < 80):  LidTongue ≈ D - 10
  // Rule B (D >= 80): LidTongue ≈ 0.6 * D - 2
  const lidTongueLength = (d: number): number => {
    return d < 80 ? d - 10 : 0.6 * d - 2;
  };
  const blueW       = lidTongueLength(D);
  const blueH       = Math.max(0, D - 1.75);
  const lockH       = H * (43 / 220);

  // X anchors (left → right)
  const xLockL      = 0;
  const xSideFlapL  = xLockL + lockW;
  const xSideDepthL = xSideFlapL + sideFlapW;
  const baseX       = xSideDepthL + sideDepthW;
  const baseEndX    = baseX + baseW;
  const xSideDepthR = baseEndX;
  const xSideFlapR  = xSideDepthR + sideDepthW;
  const xLockR      = xSideFlapR + sideFlapW;
  const footprintW  = xLockR + lockW; // = L + 4D + 3

  // Y anchors (top → bottom) — Lid Flap row inserted ABOVE Lid row
  const yLidFlap    = 0;
  const yLid        = yLidFlap + lidFlapH;
  const yTopDepth   = yLid + lidH;
  const baseY       = yTopDepth + topDepthH;
  const baseEndY    = baseY + baseH;
  const yBottomDepth = baseEndY;
  const footprintH  = yBottomDepth + bottomDepthH; // = (D-0.75) + (H+0.5) + D + H + (D-0.5) = 3D + 2H - 0.75

  // Insets (Excel: 0.5, 1.5, 1.0)
  const TOP_INSET    = 0.5;
  const LID_INSET    = 1.5;
  const BOTTOM_INSET = 1.0;

  // Anchor: Lid Flap (dark blue) sits directly above the Lid, sharing its horizontal extents
  const xLidFlapL = baseX + LID_INSET;
  const xLidFlapR = xLidFlapL + lidFlapW;

  // Blue tabs (light blue): centered VERTICALLY in the Lid Flap row,
  // anchored to the OUTER edges of the dark blue Lid Flap (original SVG: x ends at flap edge)
  const blueY   = yLidFlap + (lidFlapH - blueH) / 2;
  const pinkY   = yTopDepth + (topDepthH - pinkH) / 2;
  const yellowY = yBottomDepth + (bottomDepthH - yellowH) / 2;

  // Lock vertical positions: symmetric within base, gap = lockH between locks
  const lockTopSpace = Math.max(0, (baseH - 3 * lockH) / 2);
  const lockY1 = baseY + lockTopSpace;
  const lockY2 = lockY1 + 2 * lockH;

  // Outer-corner radii (mm) — only for purely rounded-rect pieces
  const lidFlapRadius = Math.min(lidFlapW, lidFlapH) * 0.15;       // top corners of dark blue flap
  const lockRadius = Math.min(lockW, lockH) * 0.35;                // rounded lock tip

  /* ── ORIGINAL-SVG CURVE TEMPLATES (normalized 0..1 within piece bbox) ──
   *   Extracted verbatim from 390×220×83 mm Color.svg paths and normalized
   *   to the path's own bounding box. At render time we scale these by
   *   (pieceW, pieceH) and translate by (pieceX, pieceY), preserving the
   *   original Bézier geometry — no math approximation, no regenerated arcs.
   *   For RIGHT-side counterparts we mirror horizontally (pathMirror = true). */

  // Light-blue ear (left) — from path bbox x∈[340.16,476.22], y∈[2.83,233.15]
  // Original: M476.22,233.15 H374.17 c…c…c…s… L back. Tab attaches on RIGHT edge.
  const BLUE_EAR_LEFT: DieCutV2PieceDef['pathShape'] = [
    ['M', 1.0000, 1.0000],
    ['L', 0.2500, 1.0000],
    ['C', 0.1837, 1.0000, 0.1201, 0.9845, 0.0732, 0.9568],
    ['C', 0.0263, 0.9291, 0.0000, 0.8915, 0.0000, 0.8523],
    ['C', 0.0000, 0.6262, 0.1054, 0.4093, 0.2929, 0.2495],
    ['C', 0.4804, 0.0897, 0.7347, 0.0001, 1.0000, 0.0001],
    ['L', 1.0000, 1.0000],
    ['Z'],
  ];

  // Light-green lid side-flap (left) — Geometry derived 1:1 from Original SVG.
  // Curve Angle LOCKED at 20°. Topology = straight right edge (attach), straight top
  // slant, TWO Bézier segments forming the top outer-left corner, straight vertical
  // outer-left flat, TWO Bézier segments forming the bottom outer-left corner,
  // straight bottom slant. No curves near the attach edge (matches Original).
  //
  //   y-drop (mm)  = horizontal_run (mm) * tan(20°)
  //   horizontal_run = (1 - cornerInsetX) * w   (cornerInsetX from Original SVG = 0.1195)
  //   gO/gT = 0.1768 / 0.1119 = 1.5800  (Original SVG outer-flat / slant ratio)
  const GREEN_ANGLE_DEG       = 20;
  const GREEN_TAN             = Math.tan(GREEN_ANGLE_DEG * Math.PI / 180);
  const GREEN_CORNER_INSET_NX = 0.1195;
  const GREEN_CORNER_RATIO    = 1.5800;            // gO / gT — locked to Original SVG
  const greenRunMm   = (1 - GREEN_CORNER_INSET_NX) * lidSideFlapW;
  const greenDropMm  = greenRunMm * GREEN_TAN;
  const greenOuterMm = greenDropMm * GREEN_CORNER_RATIO;
  const safeH = Math.max(lidSideFlapH, 0.001);
  let greenTopNY   = greenDropMm  / safeH;
  let greenOuterNY = greenOuterMm / safeH;
  if (greenOuterNY > 0.49) {
    const k = 0.49 / greenOuterNY;
    greenOuterNY *= k;
    greenTopNY   *= k;
  }
  const gT  = greenTopNY;
  const gO  = greenOuterNY;
  const gT2 = 1 - greenTopNY;
  const gO2 = 1 - greenOuterNY;
  // Bézier control fractions (along the corner span gO-gT) extracted directly from
  // the Original SVG's two relative cubic segments at the top-left outer corner:
  //   c(0,-8.85  2.76,-17.48  7.90,-24.69)   c(5.14,-7.21  12.40,-12.63  20.77,-15.51)
  // X values are normalized by w (lid-side-flap width); Y fractions are normalized
  // along (gO - gT). The bottom corner is the symmetric mirror across y = 0.5.
  const GREEN_FLAP_LEFT: DieCutV2PieceDef['pathShape'] = [
    ['M', 1.0000, 1.0000],
    ['L', 1.0000, 0.0000],
    ['L', GREEN_CORNER_INSET_NX, gT],
    ['C', 0.0904, gT + (gO - gT) * 0.0770, 0.0581, gT + (gO - gT) * 0.2111, 0.0352, gT + (gO - gT) * 0.3899],
    ['C', 0.0123, gT + (gO - gT) * 0.5670, 0.0000, gT + (gO - gT) * 0.7812, 0.0000, gO],
    ['L', 0.0000, gO2],
    ['C', 0.0000, gO2 + (gT2 - gO2) * 0.2188, 0.0123, gO2 + (gT2 - gO2) * 0.4330, 0.0352, gO2 + (gT2 - gO2) * 0.6101],
    ['C', 0.0581, gO2 + (gT2 - gO2) * 0.7889, 0.0904, gO2 + (gT2 - gO2) * 0.9230, GREEN_CORNER_INSET_NX, gT2],
    ['Z'],
  ];

  const pieces: DieCutV2PieceDef[] = [
    // ─── LID FLAP row (Y: 0 → D-0.75) ─────────────────────────────────
    { id: 'BLUE_TAB_L',     arabic: 'لسان لسان الغطاء يسار',  color: COLORS.blueTab,    stroke: '#FA0000', depends: 'D',
      x: xLidFlapL - blueW, y: blueY, w: blueW, h: blueH, pathShape: BLUE_EAR_LEFT },
    { id: 'LID_FLAP',       arabic: 'لسان الغطاء (دارك بلو)',  color: COLORS.lidFlap,    stroke: '#FA0000', depends: 'L,D',
      x: xLidFlapL, y: yLidFlap, w: lidFlapW, h: lidFlapH },
    { id: 'BLUE_TAB_R',     arabic: 'لسان لسان الغطاء يمين',  color: COLORS.blueTab,    stroke: '#FA0000', depends: 'D',
      x: xLidFlapR, y: blueY, w: blueW, h: blueH, pathShape: BLUE_EAR_LEFT, pathMirror: true },

    // ─── LID row (Y: D-0.75 → D-0.75 + H+0.5) ─────────────────────────
    { id: 'LID_SIDE_FLAP_L', arabic: 'لسان الغطاء يسار',       color: COLORS.lidSideFlap, stroke: '#FA0000', depends: 'D,H',
      x: baseX + LID_INSET - lidSideFlapW, y: yLid, w: lidSideFlapW, h: lidSideFlapH, pathShape: GREEN_FLAP_LEFT },
    { id: 'LID',            arabic: 'الغطاء',                  color: COLORS.lid,        stroke: '#FA0000', depends: 'L,H,D',
      x: baseX + LID_INSET, y: yLid, w: lidW, h: lidH },
    { id: 'LID_SIDE_FLAP_R', arabic: 'لسان الغطاء يمين',       color: COLORS.lidSideFlap, stroke: '#FA0000', depends: 'D,H',
      x: baseEndX - LID_INSET, y: yLid, w: lidSideFlapW, h: lidSideFlapH, pathShape: GREEN_FLAP_LEFT, pathMirror: true },

    // ─── TOP DEPTH row (PINK tabs are STRAIGHT — no curves, no radius) ─
    { id: 'PINK_TAB_L',     arabic: 'لسان العمق زهري يسار',    color: COLORS.pinkTab,    stroke: '#FA0000', depends: 'D,H',
      x: baseX + TOP_INSET - pinkW, y: pinkY, w: pinkW, h: pinkH },
    { id: 'TOP_DEPTH',      arabic: 'العمق العلوي',            color: COLORS.topDepth,   stroke: '#FA0000', depends: 'L,D',
      x: baseX + TOP_INSET, y: yTopDepth, w: topDepthW, h: topDepthH },
    { id: 'PINK_TAB_R',     arabic: 'لسان العمق زهري يمين',    color: COLORS.pinkTab,    stroke: '#FA0000', depends: 'D,H',
      x: baseEndX - TOP_INSET, y: pinkY, w: pinkW, h: pinkH },

    // ─── BASE row ─────────────────────────────────────────────────────
    { id: 'LOCK_L_1',       arabic: 'لسان إغلاق يسار 1',       color: COLORS.lock,       stroke: '#FA0000', depends: 'D,H',
      x: xLockL, y: lockY1, w: lockW, h: lockH, radius: lockRadius },
    { id: 'LOCK_L_2',       arabic: 'لسان إغلاق يسار 2',       color: COLORS.lock,       stroke: '#FA0000', depends: 'D,H',
      x: xLockL, y: lockY2, w: lockW, h: lockH, radius: lockRadius },
    { id: 'SIDE_FLAP_L',    arabic: 'لسان عمق جانب القاعدة يسار', color: COLORS.sideFlap, stroke: '#FA0000', depends: 'D,H',
      x: xSideFlapL, y: baseY, w: sideFlapW, h: baseH },
    { id: 'SIDE_DEPTH_L',   arabic: 'عمق جانب القاعدة يسار',   color: COLORS.sideDepth,  stroke: '#FA0000', depends: 'D,H',
      x: xSideDepthL, y: baseY, w: sideDepthW, h: baseH },
    { id: 'BASE',           arabic: 'القاعدة',                 color: COLORS.base,       stroke: '#FA0000', depends: 'L,H',
      x: baseX, y: baseY, w: baseW, h: baseH },
    { id: 'SIDE_DEPTH_R',   arabic: 'عمق جانب القاعدة يمين',   color: COLORS.sideDepth,  stroke: '#FA0000', depends: 'D,H',
      x: xSideDepthR, y: baseY, w: sideDepthW, h: baseH },
    { id: 'SIDE_FLAP_R',    arabic: 'لسان عمق جانب القاعدة يمين', color: COLORS.sideFlap, stroke: '#FA0000', depends: 'D,H',
      x: xSideFlapR, y: baseY, w: sideFlapW, h: baseH },
    { id: 'LOCK_R_1',       arabic: 'لسان إغلاق يمين 1',       color: COLORS.lock,       stroke: '#FA0000', depends: 'D,H',
      x: xLockR, y: lockY1, w: lockW, h: lockH, radius: lockRadius },
    { id: 'LOCK_R_2',       arabic: 'لسان إغلاق يمين 2',       color: COLORS.lock,       stroke: '#FA0000', depends: 'D,H',
      x: xLockR, y: lockY2, w: lockW, h: lockH, radius: lockRadius },

    // ─── BOTTOM DEPTH row (YELLOW tabs are STRAIGHT — no curves, no radius) ─
    { id: 'YELLOW_TAB_L',   arabic: 'لسان عمق أسفل القالب يسار', color: COLORS.yellowTab, stroke: '#FA0000', depends: 'D,H',
      x: baseX + BOTTOM_INSET - yellowW, y: yellowY, w: yellowW, h: yellowH },
    { id: 'BOTTOM_DEPTH',   arabic: 'عمق أسفل القالب',         color: COLORS.bottomDepth, stroke: '#FA0000', depends: 'L,D',
      x: baseX + BOTTOM_INSET, y: yBottomDepth, w: bottomDepthW, h: bottomDepthH },
    { id: 'YELLOW_TAB_R',   arabic: 'لسان عمق أسفل القالب يمين', color: COLORS.yellowTab, stroke: '#FA0000', depends: 'D,H',
      x: baseEndX - BOTTOM_INSET, y: yellowY, w: yellowW, h: yellowH },
  ];

  return { pieces, footprintW, footprintH, baseX, baseY };
}

/* ───────────────────────────────────────────────────────────────────── */
/*  PROCEDURAL DIELINE SVG (Visible Geometry = Export Geometry)           */
/* ───────────────────────────────────────────────────────────────────── */

export function buildDielineSvgV2(inputs: DieCutV2Inputs): string {
  const { pieces, footprintW, footprintH } = buildPiecesV2(inputs);

  // Build SVG element (rect or path) per piece. For pieces with a curved
  // pathShape, scale the normalized 0..1 template to the piece bbox and
  // mirror horizontally when pathMirror is true. Otherwise emit <rect>.
  const fmt = (n: number) => n.toFixed(4);
  const elem = (p: DieCutV2PieceDef, fillMode: 'fill' | 'stroke'): string => {
    const common = fillMode === 'fill'
      ? `fill="${p.color}" fill-opacity="0.85" data-id="${p.id}"`
      : `fill="none" stroke="${p.stroke}" stroke-width="0.3"`;

    if (p.pathShape && p.pathShape.length > 0) {
      // Map normalized (nx,ny) to absolute mm (X,Y) within piece bbox.
      // For mirrored right-side counterparts, flip nx → (1 - nx).
      const mirror = !!p.pathMirror;
      const X = (nx: number) => p.x + (mirror ? (1 - nx) : nx) * p.w;
      const Y = (ny: number) => p.y + ny * p.h;
      const parts: string[] = [];
      for (const seg of p.pathShape) {
        if (seg[0] === 'Z') { parts.push('Z'); continue; }
        if (seg[0] === 'M' || seg[0] === 'L') {
          parts.push(`${seg[0]} ${fmt(X(seg[1]))} ${fmt(Y(seg[2]))}`);
        } else { // 'C'
          parts.push(`C ${fmt(X(seg[1]))} ${fmt(Y(seg[2]))}, ${fmt(X(seg[3]))} ${fmt(Y(seg[4]))}, ${fmt(X(seg[5]))} ${fmt(Y(seg[6]))}`);
        }
      }
      return `    <path d="${parts.join(' ')}" ${common} />`;
    }

    const r = p.radius && p.radius > 0
      ? ` rx="${fmt(p.radius)}" ry="${fmt(p.radius)}"` : '';
    return `    <rect x="${fmt(p.x)}" y="${fmt(p.y)}" width="${fmt(p.w)}" height="${fmt(p.h)}"${r} ${common} />`;
  };

  const strokes = pieces.map(p => elem(p, 'stroke')).join('\n');
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(footprintW)} ${fmt(footprintH)}" preserveAspectRatio="none">
  <g id="strokes" fill="none">
${strokes}
  </g>
</svg>`;
}

/* ───────────────────────────────────────────────────────────────────── */
/*  STRETCH ZONES (for side panel display — pure information, no logic)   */
/* ───────────────────────────────────────────────────────────────────── */

const REF_L = 390, REF_H = 220, REF_D = 83;

const zonesFor = (L: number, H: number, D: number): {
  horizontal: V2StretchZone[];
  vertical: V2StretchZone[];
} => {
  // Horizontal strips (left→right anchor columns)
  const hSpec: Array<{ key: string; label: string; depends: V2StretchDepends; baseFn: (L: number, H: number, D: number) => number }> = [
    { key: 'LOCK_L',      label: 'لسان إغلاق يسار',     depends: 'Calibration', baseFn: () => 2.25 },
    { key: 'SIDE_FLAP_L', label: 'لسان عمق جانب يسار',  depends: 'Depth',       baseFn: (_l, _h, d) => Math.max(0, d - 0.75) },
    { key: 'SIDE_DEPTH_L', label: 'عمق جانب يسار',      depends: 'Depth',       baseFn: (_l, _h, d) => d },
    { key: 'BASE_W',      label: 'وجه القاعدة',          depends: 'Length',      baseFn: (l) => l },
    { key: 'SIDE_DEPTH_R', label: 'عمق جانب يمين',      depends: 'Depth',       baseFn: (_l, _h, d) => d },
    { key: 'SIDE_FLAP_R', label: 'لسان عمق جانب يمين',  depends: 'Depth',       baseFn: (_l, _h, d) => Math.max(0, d - 0.75) },
    { key: 'LOCK_R',      label: 'لسان إغلاق يمين',     depends: 'Calibration', baseFn: () => 2.25 },
  ];
  const vSpec: Array<{ key: string; label: string; depends: V2StretchDepends; baseFn: (L: number, H: number, D: number) => number }> = [
    { key: 'LID_FLAP_H',  label: 'لسان الغطاء (D-0.75)', depends: 'Depth',       baseFn: (_l, _h, d) => Math.max(0, d - 0.75) },
    { key: 'LID_H',       label: 'الغطاء (H+0.5)',       depends: 'Height',      baseFn: (_l, h) => Math.max(0, h + 0.5) },
    { key: 'TOP_DEPTH_H', label: 'العمق العلوي',         depends: 'Depth',       baseFn: (_l, _h, d) => d },
    { key: 'BASE_H',      label: 'ارتفاع القاعدة',       depends: 'Height',      baseFn: (_l, h) => h },
    { key: 'BOT_DEPTH_H', label: 'عمق أسفل القالب',      depends: 'Depth',       baseFn: (_l, _h, d) => Math.max(0, d - 0.5) },
  ];

  const build = (
    spec: typeof hSpec, axis: V2StretchAxis,
  ): V2StretchZone[] => {
    let cb = 0, cc = 0;
    const out: V2StretchZone[] = [];
    for (const s of spec) {
      const base = s.baseFn(REF_L, REF_H, REF_D);
      const current = s.baseFn(L, H, D);
      out.push({
        key: s.key, label: s.label, axis, depends: s.depends,
        base, current,
        startBase: cb, endBase: cb + base,
        start: cc, end: cc + current,
      });
      cb += base; cc += current;
    }
    return out;
  };

  return { horizontal: build(hSpec, 'horizontal'), vertical: build(vSpec, 'vertical') };
};

export function computeStretchZonesV2(
  current: DieCutV2Inputs,
  _base: DieCutV2Inputs,
): V2StretchZones {
  const z = zonesFor(current.boxLength, current.boxHeight, current.boxDepth);
  const baseRef = buildPiecesV2({ ...current, boxLength: REF_L, boxHeight: REF_H, boxDepth: REF_D });
  const cur = buildPiecesV2(current);

  // Optional calibration adds at trailing edge (does NOT alter pieces — only inflates pitch envelope)
  const sideTrim = Math.max(0, current.sideTrim ?? 0);
  const verticalTrim = Math.max(0, current.verticalTrim ?? 0);
  if (sideTrim > 0) {
    const last = z.horizontal[z.horizontal.length - 1];
    z.horizontal.push({
      key: 'WT', label: 'زيادة العرض (Calibration)', axis: 'horizontal', depends: 'Calibration',
      base: 0, current: sideTrim,
      startBase: last.endBase, endBase: last.endBase,
      start: last.end, end: last.end + sideTrim,
    });
  }
  if (verticalTrim > 0) {
    const last = z.vertical[z.vertical.length - 1];
    z.vertical.push({
      key: 'HT', label: 'زيادة الارتفاع (Calibration)', axis: 'vertical', depends: 'Calibration',
      base: 0, current: verticalTrim,
      startBase: last.endBase, endBase: last.endBase,
      start: last.end, end: last.end + verticalTrim,
    });
  }

  return {
    horizontal: z.horizontal,
    vertical: z.vertical,
    baseFootprintW: baseRef.footprintW,
    baseFootprintH: baseRef.footprintH,
    footprintW: cur.footprintW + sideTrim,
    footprintH: cur.footprintH + verticalTrim,
  };
}

/* ───────────────────────────────────────────────────────────────────── */
/*  SCENARIOS + FIT-TO-SHEET                                              */
/* ───────────────────────────────────────────────────────────────────── */

function buildScenario(
  key: DieCutV2Scenario['key'],
  label: string,
  orientation: DieCutV2Scenario['orientation'],
  fpW: number, fpH: number,
  pitchX: number, pitchY: number,
  longSide: number, shortSide: number,
): DieCutV2Scenario {
  const cols = longSide >= fpW && pitchX > 0 ? 1 + safeFloor((longSide - fpW) / pitchX) : 0;
  const rows = shortSide >= fpH && pitchY > 0 ? 1 + safeFloor((shortSide - fpH) / pitchY) : 0;
  const total = Math.max(0, cols) * Math.max(0, rows);
  const sheetArea = longSide * shortSide;
  const layoutW = cols > 0 ? fpW + (cols - 1) * pitchX : 0;
  const layoutH = rows > 0 ? fpH + (rows - 1) * pitchY : 0;
  const utilization = sheetArea > 0 ? Math.min(1, (total * fpW * fpH) / sheetArea) : 0;
  return {
    key, label, orientation,
    footprintW: fpW, footprintH: fpH,
    pitchX, pitchY,
    cols, rows, total,
    utilization,
    remainingW: longSide - layoutW,
    remainingH: shortSide - layoutH,
    layoutW, layoutH,
  };
}

export function computeDieCutV2(
  input: DieCutV2Inputs,
  baseInput: DieCutV2Inputs = input,
): DieCutV2Result {
  const { sheetWidth, sheetHeight, gap } = input;
  const verticalInterlock   = Math.max(0, input.verticalInterlock ?? 0);
  const horizontalInterlock = Math.max(0, input.horizontalInterlock ?? 0);

  const built = buildPiecesV2(input);
  const sideTrim = Math.max(0, input.sideTrim ?? 0);
  const verticalTrim = Math.max(0, input.verticalTrim ?? 0);
  const footprintW = built.footprintW + sideTrim;
  const footprintH = built.footprintH + verticalTrim;

  const zones = computeStretchZonesV2(input, baseInput);

  const templateBbox: DieCutV2TemplateBox = {
    viewBoxWmm: built.footprintW,
    viewBoxHmm: built.footprintH,
    drawOriginXmm: 0,
    drawOriginYmm: 0,
    drawWmm: built.footprintW,
    drawHmm: built.footprintH,
  };

  const autoPitchX = footprintW + gap - horizontalInterlock;
  const autoPitchY = footprintH + gap - verticalInterlock;
  const mPx = input.manualPitchX != null && input.manualPitchX > 0 ? input.manualPitchX : autoPitchX;
  const mPy = input.manualPitchY != null && input.manualPitchY > 0 ? input.manualPitchY : autoPitchY;

  const geometry: DieCutV2Geometry = {
    zones,
    pieces: built.pieces,
    templateBbox,
    footprintW, footprintH,
    autoPitchX, autoPitchY,
    pitchX: mPx, pitchY: mPy,
  };

  const longSide = Math.max(sheetWidth, sheetHeight);
  const shortSide = Math.min(sheetWidth, sheetHeight);

  const sc0  = buildScenario('normal',  'صفوف عادية — 0°',   '0°',
    footprintW, footprintH, mPx, mPy, longSide, shortSide);
  const sc90 = buildScenario('rotated', 'دوران 90°',          '90°',
    footprintH, footprintW, mPy, mPx, longSide, shortSide);
  const scM  = buildScenario('manual',  'سيناريو يدوي',       'Manual',
    footprintW, footprintH, mPx, mPy, longSide, shortSide);

  const scenarios = [sc0, sc90, scM];
  const best = scenarios.reduce((a, b) => (b.total > a.total ? b : a));

  const rotated = best.key === 'rotated';
  const localW = rotated ? footprintH : footprintW;
  const localH = rotated ? footprintW : footprintH;
  const offsetX = Math.max(0, (longSide  - best.layoutW) / 2);
  const offsetY = Math.max(0, (shortSide - best.layoutH) / 2);

  const pieces: DieCutV2Piece[] = [];
  for (let i = 0; i < best.total; i++) {
    const row = 1 + Math.floor(i / best.cols);
    const col = 1 + (i % best.cols);
    pieces.push({
      index: i + 1, row, col,
      x: offsetX + (col - 1) * best.pitchX,
      y: offsetY + (row - 1) * best.pitchY,
      footprintW: localW,
      footprintH: localH,
      rotated,
    });
  }

  return {
    scenarios, best, pieces,
    longSide, shortSide,
    footprintW, footprintH,
    autoPitchX, autoPitchY,
    pitchX: mPx, pitchY: mPy,
    geometry,
  };
}

/* ───────────────────────────────────────────────────────────────────── */
/*  Legacy bbox constant — now dynamic via result.geometry.templateBbox.  */
/*  Kept for back-compat only; values are placeholders.                   */
/* ───────────────────────────────────────────────────────────────────── */
export const V2_TEMPLATE_BBOX = {
  svgUnitsPerMm: 1,
  viewBoxWmm: 725,
  viewBoxHmm: 606,
  drawOriginXmm: 0,
  drawOriginYmm: 0,
  drawWmm: 725,
  drawHmm: 606,
} as const;

export const DEFAULT_V2_CALIBRATION = {
  sideTrim: 0,
  verticalTrim: 0,
  verticalInterlock: 0,
  horizontalInterlock: 0,
};

export const DEFAULT_V2_BASE_INPUTS: DieCutV2Inputs = {
  sheetWidth: 1000, sheetHeight: 700, gap: 3,
  boxLength: REF_L, boxDepth: REF_D, boxHeight: REF_H,
  ...DEFAULT_V2_CALIBRATION,
  manualPitchX: null, manualPitchY: null,
};
