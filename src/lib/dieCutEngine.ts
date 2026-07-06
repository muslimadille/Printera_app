// Die-Cut nesting engine — port of the calibrated workbook with the new
// "Dynamic Stretch + Calibration + Nesting" reference. All math mirrors the
// `Die Cut Engine` / `Stretch Zones` / `Scenarios` sheets so that the
// existing reference layout (65×25×100 on 1000×700 with the default
// calibration) keeps producing exactly the same numbers as before.
//
// SVG is purely visual and never participates in geometry.

export interface DieCutInputs {
  // Sheet & spacing
  sheetWidth: number;   // mm
  sheetHeight: number;  // mm
  gap: number;          // mm
  // Box finished dimensions
  boxLength: number;    // mm — front panel
  boxDepth: number;     // mm — side panel
  boxHeight: number;    // mm
  // Calibration factors (per template)
  sideTrim: number;            // Width Expansion — extra width outside panel sum
  verticalTrim: number;        // Height Expansion — extra height (tabs)
  verticalInterlock: number;   // Vertical interlock between rows before gap
  horizontalInterlock: number; // NEW — Horizontal interlock between columns (default 0)
  // Optional manual pitch overrides — 0/null/undefined = auto.
  manualPitchX?: number | null;
  manualPitchY?: number | null;
  // Optional tab-size overrides (Medicine Box #1). Null/undefined = use
  // current automatic logic; a numeric value overrides ONLY that flap.
  // Die Cut never sets these, so its behavior is unchanged.
  glueTabSize?: number | null;   // مقاس لسان اللصق — overrides sideTrim (WT zone)
  coverFlapSize?: number | null; // مقاس لسان الغطاء — per-flap; verticalTrim = 2× this
  sideFlapSize?: number | null;  // مقاس لسان العمق — side flap height (V4 sfH)
}

export type StretchAxis = 'horizontal' | 'vertical';
export type StretchDepends = 'Length' | 'Depth' | 'Height' | 'Calibration';

export interface StretchZone {
  key: string;            // unique inside its axis (e.g. 'L1', 'D1', 'H', 'WT')
  label: string;          // Arabic label for UI
  axis: StretchAxis;
  depends: StretchDepends;
  base: number;           // mm at the template's reference dimensions
  current: number;        // mm at the current input dimensions
  startBase: number;      // mm — start position inside the BASE footprint
  endBase: number;        // mm — end position inside the BASE footprint
  start: number;          // mm — start position inside the CURRENT footprint
  end: number;            // mm — end position inside the CURRENT footprint
}

export interface StretchZones {
  horizontal: StretchZone[];
  vertical: StretchZone[];
  // Convenience: full base / current footprint along each axis.
  baseFootprintW: number;
  baseFootprintH: number;
  footprintW: number;
  footprintH: number;
  // Optional tab-size overrides — propagated so buildV4Tiles can render
  // the exact same flap sizes that Preview/Export consume. Undefined =
  // use the existing auto formulas (no behavior change for Die Cut).
  tabOverrides?: {
    glue?: number | null;
    cover?: number | null;
    sideFlap?: number | null;
  };
}

export interface DieCutScenario {
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
  utilization: number; // 0..1
  remainingW: number;
  remainingH: number;
  layoutW: number;
  layoutH: number;
}

export interface DieCutPiece {
  index: number;
  row: number;
  col: number;
  x: number;
  y: number;
  footprintW: number;
  footprintH: number;
  rotated: boolean;
}

export interface DieCutGeometry {
  zones: StretchZones;
  footprintW: number;
  footprintH: number;
  autoPitchX: number;
  autoPitchY: number;
  pitchX: number;
  pitchY: number;
}

export interface DieCutResult {
  scenarios: DieCutScenario[];
  best: DieCutScenario;
  pieces: DieCutPiece[];
  longSide: number;
  shortSide: number;
  // Derived footprint/pitch BEFORE manual override
  footprintW: number;
  footprintH: number;
  autoPitchX: number;
  autoPitchY: number;
  // Final pitch (manual override applied)
  pitchX: number;
  pitchY: number;
  // Production geometry that drove the calculation. Preview/export must follow this.
  geometry: DieCutGeometry;
}

const safeFloor = (n: number) => (Number.isFinite(n) ? Math.floor(n) : 0);
const sumZoneSizes = (zones: StretchZone[]) =>
  zones.reduce((sum, zone) => sum + Math.max(0, zone.current), 0);

function buildScenario(
  key: DieCutScenario['key'],
  label: string,
  orientation: DieCutScenario['orientation'],
  fpW: number, fpH: number,
  pitchX: number, pitchY: number,
  longSide: number, shortSide: number,
): DieCutScenario {
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

export function computeDieCut(input: DieCutInputs, baseInput: DieCutInputs = input): DieCutResult {
  const { sheetWidth, sheetHeight, gap } = input;
  const horizontalInterlock = input.horizontalInterlock ?? 0;

  // Dynamic Vertical Interlock: tracks Depth 1:1 from the reference base.
  // VI_new = VI_ref + (Depth_new - Depth_ref) — no manual recalibration needed.
  const depthDelta = input.boxDepth - baseInput.boxDepth;
  const verticalInterlock = baseInput.verticalInterlock + depthDelta;

  // ── Production geometry source ──
  // Stretch Zones are the source of truth. If Height changes, only the `H`
  // vertical zone changes; Length/Depth zones keep their own current values.
  // Footprint, pitch, scenarios, pieces, preview and export all consume this
  // same geometry instead of independently re-summing the reference template.
  const zones = computeStretchZones(input, baseInput);
  const footprintW = sumZoneSizes(zones.horizontal);
  const footprintH = sumZoneSizes(zones.vertical);

  const autoPitchX = footprintW + gap - horizontalInterlock;
  const autoPitchY = footprintH + gap - verticalInterlock;

  const mPx = input.manualPitchX != null && input.manualPitchX > 0
    ? input.manualPitchX : autoPitchX;
  const mPy = input.manualPitchY != null && input.manualPitchY > 0
    ? input.manualPitchY : autoPitchY;
  const geometry: DieCutGeometry = {
    zones,
    footprintW,
    footprintH,
    autoPitchX,
    autoPitchY,
    pitchX: mPx,
    pitchY: mPy,
  };

  const longSide = Math.max(sheetWidth, sheetHeight);
  const shortSide = Math.min(sheetWidth, sheetHeight);

  // Scenarios — same shape as Excel: 0°, 90°, Manual.
  // The Excel "swapped" variants are mathematically equivalent because we
  // always nest on the long axis, so keeping 3 scenarios preserves the
  // current UI without changing results.
  const sc0 = buildScenario('normal', 'صفوف متعشقة — 0°', '0°',
    footprintW, footprintH, mPx, mPy, longSide, shortSide);

  const sc90 = buildScenario('rotated', 'دوران 90°', '90°',
    footprintH, footprintW, mPy, mPx, longSide, shortSide);

  const scM = buildScenario('manual', 'سيناريو يدوي', 'Manual',
    footprintW, footprintH, mPx, mPy, longSide, shortSide);

  const scenarios = [sc0, sc90, scM];
  const best = scenarios.reduce((a, b) => (b.total > a.total ? b : a));

  const pieces: DieCutPiece[] = [];
  for (let i = 0; i < best.total; i++) {
    const row = 1 + Math.floor(i / best.cols);
    const col = 1 + (i % best.cols);
    pieces.push({
      index: i + 1,
      row, col,
      x: (col - 1) * best.pitchX,
      y: (row - 1) * best.pitchY,
      footprintW: best.footprintW,
      footprintH: best.footprintH,
      rotated: best.key === 'rotated',
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

/* ──────────────────────────────────────────────────────────── */
/*  Stretch Zones — zone-based stretching map                  */
/* ──────────────────────────────────────────────────────────── */
//
// Each template ships with a BASE profile (boxLength/Depth/Height +
// calibration). When the user edits any of those, only the zones that
// `depends` on the changed key stretch — everything else stays put.
//
// Horizontal zones: [Length, Depth, Length, Depth, WidthExpansion]
// Vertical   zones: [Depth (top), Height (body), Depth (bottom), HeightExpansion]
//
// IMPORTANT: When `current` equals `base`, all start/end positions are
// identical to the legacy uniform-scale path → preview is pixel-identical
// at reference values.

export function computeStretchZones(
  current: DieCutInputs,
  base: DieCutInputs,
): StretchZones {
  // Optional Medicine Box #1 overrides — applied ONLY when set on inputs;
  // otherwise the WT/HT zones keep their legacy sideTrim/verticalTrim values.
  const glueCur = (current.glueTabSize != null && current.glueTabSize > 0) ? current.glueTabSize : current.sideTrim;
  const glueBase = (base.glueTabSize != null && base.glueTabSize > 0) ? base.glueTabSize : base.sideTrim;
  const coverFlapCur = (current.coverFlapSize != null && current.coverFlapSize > 0)
    ? current.coverFlapSize
    : current.verticalTrim / 2;
  const coverFlapBase = (base.coverFlapSize != null && base.coverFlapSize > 0)
    ? base.coverFlapSize
    : base.verticalTrim / 2;
  const sideFlapCur = (current.sideFlapSize != null && current.sideFlapSize > 0)
    ? current.sideFlapSize
    : 0;
  const sideFlapBase = (base.sideFlapSize != null && base.sideFlapSize > 0)
    ? base.sideFlapSize
    : 0;
  const sideExtraCur = Math.max(0, sideFlapCur - (current.boxDepth + coverFlapCur)) * 2;
  const sideExtraBase = Math.max(0, sideFlapBase - (base.boxDepth + coverFlapBase)) * 2;
  const coverCur = coverFlapCur * 2 + sideExtraCur;
  const coverBase = coverFlapBase * 2 + sideExtraBase;

  const horizontalDefs: Array<Omit<StretchZone, 'startBase' | 'endBase' | 'start' | 'end'>> = [
    { key: 'L1', label: 'الواجهة الأولى', axis: 'horizontal', depends: 'Length',
      base: base.boxLength, current: current.boxLength },
    { key: 'D1', label: 'الجانب الأول', axis: 'horizontal', depends: 'Depth',
      base: base.boxDepth, current: current.boxDepth },
    { key: 'L2', label: 'الواجهة الثانية', axis: 'horizontal', depends: 'Length',
      base: base.boxLength, current: current.boxLength },
    { key: 'D2', label: 'الجانب الثاني', axis: 'horizontal', depends: 'Depth',
      base: base.boxDepth, current: current.boxDepth },
    { key: 'WT', label: 'زيادة العرض / لسان اللصق', axis: 'horizontal', depends: 'Calibration',
      base: glueBase, current: glueCur },
  ];

  const verticalDefs: Array<Omit<StretchZone, 'startBase' | 'endBase' | 'start' | 'end'>> = [
    { key: 'DT', label: 'غطاء علوي', axis: 'vertical', depends: 'Depth',
      base: base.boxDepth, current: current.boxDepth },
    { key: 'H',  label: 'جسم العلبة', axis: 'vertical', depends: 'Height',
      base: base.boxHeight, current: current.boxHeight },
    { key: 'DB', label: 'غطاء سفلي', axis: 'vertical', depends: 'Depth',
      base: base.boxDepth, current: current.boxDepth },
    { key: 'HT', label: 'زيادة الارتفاع / ألسنة', axis: 'vertical', depends: 'Calibration',
      base: coverBase, current: coverCur },
  ];

  const cumulate = (defs: typeof horizontalDefs): StretchZone[] => {
    let baseCursor = 0;
    let curCursor = 0;
    return defs.map(d => {
      const startBase = baseCursor;
      const endBase = baseCursor + d.base;
      const start = curCursor;
      const end = curCursor + d.current;
      baseCursor = endBase;
      curCursor = end;
      return { ...d, startBase, endBase, start, end };
    });
  };

  const horizontal = cumulate(horizontalDefs);
  const vertical = cumulate(verticalDefs);

  const anyOverride =
    current.glueTabSize != null ||
    current.coverFlapSize != null ||
    current.sideFlapSize != null;

  return {
    horizontal,
    vertical,
    baseFootprintW: horizontal.reduce((sum, z) => sum + Math.max(0, z.base), 0),
    baseFootprintH: vertical.reduce((sum, z) => sum + Math.max(0, z.base), 0),
    footprintW: sumZoneSizes(horizontal),
    footprintH: sumZoneSizes(vertical),
    tabOverrides: anyOverride ? {
      glue: current.glueTabSize ?? null,
      cover: current.coverFlapSize ?? null,
      sideFlap: current.sideFlapSize ?? null,
    } : undefined,
  };
}

/* ──────────────────────────────────────────────────────────── */
/*  Visual stretch — Move Groups + Copy Slice + Stretch Slice  */
/* ──────────────────────────────────────────────────────────── */
//
// Pure RENDERING helper. The production engine above never calls this; it is
// consumed by the Preview and Production Export so they share one source of
// truth for how a template visually resizes.
//
// Given base/current sizes along ONE axis of ONE zone:
//   • Both halves of the BASE art keep their original size and are pushed
//     outward by halfDelta — no scaling, no distortion of the artwork.
//   • The gap is filled by two 0.5 mm slices taken next to the split line,
//     each stretched to cover halfDelta only.
//   • If current == base → returns one identity strip → reference template
//     is rendered pixel-identical to the calibrated version.

export interface StretchStrip {
  tStart: number; tEnd: number; // target rect inside the zone (mm)
  sStart: number; sEnd: number; // source rect inside the BASE zone art (mm)
}

const SLICE_MM = 0.5;

export function computeStretchStrips(base: number, current: number): StretchStrip[] {
  if (base <= 0 || current <= 0) {
    return [{ tStart: 0, tEnd: Math.max(0, current), sStart: 0, sEnd: Math.max(0, base) }];
  }
  if (Math.abs(current - base) < 1e-6) {
    return [{ tStart: 0, tEnd: current, sStart: 0, sEnd: base }];
  }
  if (current < base) {
    // Compression isn't part of the spec — fall back to a single scaled strip.
    return [{ tStart: 0, tEnd: current, sStart: 0, sEnd: base }];
  }
  const delta = current - base;
  const half = delta / 2;
  const mid = base / 2;
  const slice = Math.min(SLICE_MM, mid);
  return [
    { tStart: 0,           tEnd: mid,         sStart: 0,           sEnd: mid },
    { tStart: mid,         tEnd: mid + half,  sStart: mid - slice, sEnd: mid },
    { tStart: mid + half,  tEnd: mid + delta, sStart: mid,         sEnd: mid + slice },
    { tStart: mid + delta, tEnd: current,     sStart: mid,         sEnd: base },
  ];
}

/**
 * Symmetric "Depth Numeric Map V2" stretch — used for Depth-driven zones.
 *
 * The BASE art stays intact and is re-centered inside the new size. Only
 * two 0.5 mm slices (one at each edge of the base art) are stretched, each
 * filling HalfDelta on its own side. Matches the Depth Numeric Map sheet:
 * every listed Depth zone moves both boundaries outward by HalfDelta.
 *
 *   [0, half]            ← stretched left slice  [0, slice]
 *   [half, half + base]  ← base art, untouched (centered)
 *   [half + base, current] ← stretched right slice [base-slice, base]
 */
export function computeStretchStripsSymmetric(base: number, current: number): StretchStrip[] {
  // Depth zones are FINAL MEASURED zones — the whole zone becomes a single
  // continuous panel at its new size (e.g. Depth=65 → zone is 65 mm wide,
  // not 25 mm + a visible patch). A single strip maps the entire base art
  // to the entire current size, producing one seamless rectangle.
  const b = Math.max(0, base);
  const c = Math.max(0, current);
  return [{ tStart: 0, tEnd: c, sStart: 0, sEnd: b }];
}

/**
 * V4 Geometry Intelligence — final-rendered tile builder.
 * Returns the exact tile rectangles (target + source) drawn in the Preview
 * when Depth deviates from the calibrated base, so Export can flatten the
 * same final geometry instead of re-running runtime SVG reconstruction.
 */
export interface V4Tile {
  k: string;
  tx: number; ty: number; tw: number; th: number; // target rect (mm, in piece local coords)
  sx: number; sy: number; sw: number; sh: number; // source rect inside the BASE SVG
}

export function buildV4Tiles(zones: StretchZones): V4Tile[] {
  const hZones = zones.horizontal;
  const vZones = zones.vertical;
  const L = hZones.find(z => z.key === 'L1')?.current ?? 65;
  const D = hZones.find(z => z.key === 'D1')?.current ?? 25;
  const H = vZones.find(z => z.key === 'H')?.current ?? 100;
  const BD = hZones.find(z => z.key === 'D1')?.base ?? 25;
  const dD = D - BD;

  const COVER_FLAP_BASE = 14.79;
  const GLUE_W_BASE = 13.16;
  const SF_BASE_H = 20.35;
  // Partial Side Flap Height Expansion Rule:
  // Side flap height grows by only 10% of the depth delta,
  // capped at 45% of the final Length.
  const sfHAuto = Math.min(SF_BASE_H + dD * 0.10, L * 0.45);
  // Optional Medicine Box #1 overrides — when set, replace the constants
  // used to lay out the V4 visual tiles. Undefined ⇒ legacy behavior.
  const ov = zones.tabOverrides;
  const COVER_FLAP = (ov?.cover != null && ov.cover > 0) ? ov.cover : COVER_FLAP_BASE;
  const GLUE_W = (ov?.glue != null && ov.glue > 0) ? ov.glue : GLUE_W_BASE;
  const sfH = (ov?.sideFlap != null && ov.sideFlap > 0) ? ov.sideFlap : sfHAuto;
  const sideFlapTopOverflow = Math.max(0, sfH - (D + COVER_FLAP + 0.31));
  const yShift = sideFlapTopOverflow;
  const coverY0 = COVER_FLAP + 0.31;
  const bodyY0 = coverY0 + D;
  const bodyY1 = bodyY0 + H;
  const botCovY1 = bodyY1 + D;

  const fx0 = GLUE_W;
  const fx1 = fx0 + L;
  const sx0 = fx1;
  const sx1 = sx0 + D;
  const fx2 = sx1;
  const fx3 = fx2 + L;
  const sx2 = fx3;

  return [
    { k: 'C01', tx: 0,   ty: yShift + bodyY0, tw: GLUE_W, th: H,           sx: 0,      sy: 40.1,  sw: 13.16, sh: 100.5 },
    { k: 'C02', tx: fx0, ty: yShift + bodyY0, tw: L,      th: H,           sx: 13.16,  sy: 40.1,  sw: 64.98, sh: 100.5 },
    { k: 'C03', tx: sx0, ty: yShift + bodyY0, tw: D,      th: H,           sx: 78.13,  sy: 40.1,  sw: 25,    sh: 99.99 },
    { k: 'C04', tx: fx2, ty: yShift + bodyY0, tw: L,      th: H,           sx: 103.15, sy: 39.6,  sw: 64.98, sh: 100.5 },
    { k: 'C05', tx: sx2, ty: yShift + bodyY0, tw: D,      th: H,           sx: 168.13, sy: 40.1,  sw: 24.5,  sh: 99.99 },
    { k: 'C06', tx: fx2, ty: yShift + coverY0, tw: L,     th: D,           sx: 103.13, sy: 15.1,  sw: 65,    sh: 24.5 },
    { k: 'C07', tx: fx0, ty: yShift + bodyY1, tw: L,      th: D,           sx: 13.15,  sy: 140.6, sw: 65,    sh: 24.5 },
    { k: 'C08', tx: fx2, ty: yShift + coverY0 - COVER_FLAP, tw: L, th: COVER_FLAP, sx: 103.13, sy: 0.31,  sw: 65,    sh: COVER_FLAP },
    { k: 'C09', tx: fx0, ty: yShift + botCovY1, tw: L,    th: COVER_FLAP,  sx: 13.15,  sy: 165.1, sw: 65,    sh: COVER_FLAP },
    { k: 'C10', tx: sx0, ty: yShift + bodyY0 - sfH, tw: D, th: sfH,        sx: 78.64,  sy: 19.75, sw: 24.49, sh: SF_BASE_H },
    { k: 'C11', tx: sx2, ty: yShift + bodyY0 - sfH, tw: D, th: sfH,        sx: 168.13, sy: 19.75, sw: 24.5,  sh: SF_BASE_H },
    { k: 'C12', tx: sx0, ty: yShift + bodyY1, tw: D,      th: sfH,         sx: 78.12,  sy: 140.1, sw: 24.49, sh: SF_BASE_H },
    { k: 'C13', tx: sx2, ty: yShift + bodyY1, tw: D,      th: sfH,         sx: 168.62, sy: 140.1, sw: 24.01, sh: SF_BASE_H },
  ];
}

export function isDepthReconstruction(zones: StretchZones): boolean {
  return [...zones.horizontal, ...zones.vertical]
    .some(z => z.depends === 'Depth' && Math.abs(z.current - z.base) > 1e-6);
}

/**
 * Single source of truth for the FINAL rendered geometry shown in Preview.
 *
 * STRICT RULE: Export must flatten ONLY these tiles. No runtime SVG parsing,
 * no independent geometry reconstruction. Preview and Export both consume
 * this exact list, so they can never diverge — even if internal logic
 * (V4 components, depth rule, side-flap rule, future rules) changes.
 */
export function buildPreviewTiles(zones: StretchZones): V4Tile[] {
  if (isDepthReconstruction(zones) || zones.tabOverrides) {
    return buildV4Tiles(zones);
  }
  // Length/Height-only edits → zone-grid flattened into the same V4Tile shape.
  const tiles: V4Tile[] = [];
  zones.horizontal.forEach((hz, i) => {
    if (hz.current <= 0) return;
    const hStrips = computeStretchStrips(hz.base, hz.current);
    zones.vertical.forEach((vz, j) => {
      if (vz.current <= 0) return;
      const vStrips = computeStretchStrips(vz.base, vz.current);
      hStrips.forEach((hs, hi) => vStrips.forEach((vs, vi) => {
        const tw = hs.tEnd - hs.tStart;
        const th = vs.tEnd - vs.tStart;
        if (tw <= 0 || th <= 0) return;
        tiles.push({
          k: `zg-${i}-${j}-${hi}-${vi}`,
          tx: hz.start + hs.tStart,
          ty: vz.start + vs.tStart,
          tw, th,
          sx: hz.startBase + hs.sStart,
          sy: vz.startBase + vs.sStart,
          sw: (hs.sEnd - hs.sStart) || 0.0001,
          sh: (vs.sEnd - vs.sStart) || 0.0001,
        });
      }));
    });
  });
  return tiles;
}




// ── Default template calibration (matches uploaded Die Cut SVG) ──
export const DEFAULT_CALIBRATION = {
  sideTrim: 12.27,
  verticalTrim: 29.49,
  verticalInterlock: 39.64,
  horizontalInterlock: 0,
};

// Default reference inputs — used as the "base profile" for the built-in
// template's stretch zones.
export const DEFAULT_BASE_INPUTS: DieCutInputs = {
  sheetWidth: 1000, sheetHeight: 700, gap: 3,
  boxLength: 65, boxDepth: 25, boxHeight: 100,
  ...DEFAULT_CALIBRATION,
  manualPitchX: null, manualPitchY: null,
};
