/**
 * Smart Imposition Decision Engine
 * - Tries multiple scenarios per input (no rotate, 90° rotate, offset shift, mixed gap-fill).
 * - Compares results by piece count + utilization.
 * - Classifies output as: Recommended (best balance), Alternative, Max Output.
 * - Two-stage: Master Sheet → Press Sheet → Final Product.
 * - When a dieline shape is provided, also runs No-Fit Polygon (NFP) geometric nesting.
 */

import { packShapeIntoSheet } from './nfpNesting';


export type ScenarioCategory = 'recommended' | 'alternative' | 'max-output';

export interface LayoutPiece {
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
  index: number;
  /** Quarter-turn rotation count (0,1,2,3 → 0/90/180/270° CW) applied around
   *  the piece center when exporting. Optional; falls back to `rotated` (true → 1). */
  rotation?: 0 | 1 | 2 | 3;
  /** Horizontal mirror (scaleX(-1)) applied AFTER rotation. Used by Column-Mirroring
   *  seed in autoNestEngineV2 so alternating columns interlock flap-to-pocket. */
  mirrored?: boolean;
}

export interface LayoutScenario {
  id: string;
  label: string;
  strategy: string; // technique used (normal / rotated / offset / mixed / nested)
  pieces: LayoutPiece[];
  count: number;
  pieceW: number;
  pieceH: number;
  rotated: boolean;
  cols: number;
  rows: number;
  usagePercent: number;
  wasteArea: number;
  category?: ScenarioCategory;
  baseCount?: number; // count before nesting (for nested scenarios)
  nestedAdded?: number; // extra pieces added by smart nesting
}

export interface LayoutResult {
  scenarios: LayoutScenario[];
  bestIdx: number;
  recommendedIdx: number;
  alternativeIdx: number;
  maxOutputIdx: number;
  sheetW: number;
  sheetH: number;
}

export interface TwoStageResult {
  stage1: LayoutResult;
  stage2: LayoutResult;
  totalProducts: number;
  formula: string;
}

/* ─────────────────────────────────────────────
 * Scenario generators
 * ───────────────────────────────────────────── */

function buildGridScenario(
  sheetW: number,
  sheetH: number,
  pw: number,
  ph: number,
  gap: number,
  rotated: boolean,
  label: string,
  strategy: string,
): LayoutScenario | null {
  const cols = Math.floor((sheetW + gap) / (pw + gap));
  const rows = Math.floor((sheetH + gap) / (ph + gap));
  if (cols <= 0 || rows <= 0) return null;

  const count = cols * rows;
  const pieces: LayoutPiece[] = [];
  let idx = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      pieces.push({
        x: c * (pw + gap),
        y: r * (ph + gap),
        w: pw,
        h: ph,
        rotated,
        index: idx++,
      });
    }
  }

  const usedArea = count * pw * ph;
  const totalArea = sheetW * sheetH;

  return {
    id: `${strategy}-${pw}x${ph}-${cols}x${rows}`,
    label,
    strategy,
    pieces,
    count,
    pieceW: pw,
    pieceH: ph,
    rotated,
    cols,
    rows,
    usagePercent: (usedArea / totalArea) * 100,
    wasteArea: totalArea - usedArea,
  };
}

/**
 * Offset / Shift scenario:
 * Lay rows in normal orientation, then try to fit an extra column of rotated
 * pieces in the leftover horizontal space (or extra row in leftover vertical space).
 */
function buildOffsetScenarios(
  sheetW: number,
  sheetH: number,
  pw: number,
  ph: number,
  gap: number,
): LayoutScenario[] {
  const out: LayoutScenario[] = [];
  if (pw === ph) return out; // no benefit when square

  // Strategy A: main grid normal, extra column rotated on the right
  {
    const cols = Math.floor((sheetW + gap) / (pw + gap));
    const rows = Math.floor((sheetH + gap) / (ph + gap));
    if (cols > 0 && rows > 0) {
      const usedW = cols * (pw + gap) - gap;
      const remW = sheetW - usedW - gap;
      // try to fit rotated pieces (ph wide, pw tall) in the remaining strip
      const extraCols = Math.floor((remW + gap) / (ph + gap));
      const extraRows = Math.floor((sheetH + gap) / (pw + gap));
      if (extraCols > 0 && extraRows > 0) {
        const pieces: LayoutPiece[] = [];
        let idx = 1;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            pieces.push({ x: c * (pw + gap), y: r * (ph + gap), w: pw, h: ph, rotated: false, index: idx++ });
          }
        }
        const offsetX = usedW + gap;
        for (let r = 0; r < extraRows; r++) {
          for (let c = 0; c < extraCols; c++) {
            pieces.push({
              x: offsetX + c * (ph + gap),
              y: r * (pw + gap),
              w: ph,
              h: pw,
              rotated: true,
              index: idx++,
            });
          }
        }
        const count = pieces.length;
        const usedArea = count * pw * ph;
        const totalArea = sheetW * sheetH;
        out.push({
          id: `offset-right-${count}`,
          label: 'صفوف مزاحة (عمود جانبي)',
          strategy: 'offset-right',
          pieces,
          count,
          pieceW: pw,
          pieceH: ph,
          rotated: false,
          cols,
          rows,
          usagePercent: (usedArea / totalArea) * 100,
          wasteArea: totalArea - usedArea,
        });
      }
    }
  }

  // Strategy B: main grid normal, extra row rotated at the bottom
  {
    const cols = Math.floor((sheetW + gap) / (pw + gap));
    const rows = Math.floor((sheetH + gap) / (ph + gap));
    if (cols > 0 && rows > 0) {
      const usedH = rows * (ph + gap) - gap;
      const remH = sheetH - usedH - gap;
      const extraRows = Math.floor((remH + gap) / (pw + gap));
      const extraCols = Math.floor((sheetW + gap) / (ph + gap));
      if (extraRows > 0 && extraCols > 0) {
        const pieces: LayoutPiece[] = [];
        let idx = 1;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            pieces.push({ x: c * (pw + gap), y: r * (ph + gap), w: pw, h: ph, rotated: false, index: idx++ });
          }
        }
        const offsetY = usedH + gap;
        for (let r = 0; r < extraRows; r++) {
          for (let c = 0; c < extraCols; c++) {
            pieces.push({
              x: c * (ph + gap),
              y: offsetY + r * (pw + gap),
              w: ph,
              h: pw,
              rotated: true,
              index: idx++,
            });
          }
        }
        const count = pieces.length;
        const usedArea = count * pw * ph;
        const totalArea = sheetW * sheetH;
        out.push({
          id: `offset-bottom-${count}`,
          label: 'صفوف مزاحة (صف سفلي)',
          strategy: 'offset-bottom',
          pieces,
          count,
          pieceW: pw,
          pieceH: ph,
          rotated: false,
          cols,
          rows,
          usagePercent: (usedArea / totalArea) * 100,
          wasteArea: totalArea - usedArea,
        });
      }
    }
  }

  // Strategy C: main grid rotated, extra column normal on the right
  {
    const cols = Math.floor((sheetW + gap) / (ph + gap));
    const rows = Math.floor((sheetH + gap) / (pw + gap));
    if (cols > 0 && rows > 0) {
      const usedW = cols * (ph + gap) - gap;
      const remW = sheetW - usedW - gap;
      const extraCols = Math.floor((remW + gap) / (pw + gap));
      const extraRows = Math.floor((sheetH + gap) / (ph + gap));
      if (extraCols > 0 && extraRows > 0) {
        const pieces: LayoutPiece[] = [];
        let idx = 1;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            pieces.push({ x: c * (ph + gap), y: r * (pw + gap), w: ph, h: pw, rotated: true, index: idx++ });
          }
        }
        const offsetX = usedW + gap;
        for (let r = 0; r < extraRows; r++) {
          for (let c = 0; c < extraCols; c++) {
            pieces.push({
              x: offsetX + c * (pw + gap),
              y: r * (ph + gap),
              w: pw,
              h: ph,
              rotated: false,
              index: idx++,
            });
          }
        }
        const count = pieces.length;
        const usedArea = count * pw * ph;
        const totalArea = sheetW * sheetH;
        out.push({
          id: `mixed-rot-right-${count}`,
          label: 'مختلط (مُدار + جانبي عادي)',
          strategy: 'mixed-rotated-right',
          pieces,
          count,
          pieceW: ph,
          pieceH: pw,
          rotated: true,
          cols,
          rows,
          usagePercent: (usedArea / totalArea) * 100,
          wasteArea: totalArea - usedArea,
        });
      }
    }
  }

  return out;
}

/* ─────────────────────────────────────────────
 * Smart Nesting Engine
 * Heuristic: after a base layout, scan the empty space and try to
 * insert extra pieces (either orientation) into the leftover rectangles.
 * ───────────────────────────────────────────── */

interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
  gap: number,
): boolean {
  // Treat as overlap if rectangles intersect when expanded by gap on each side
  return !(
    ax + aw + gap <= bx ||
    bx + bw + gap <= ax ||
    ay + ah + gap <= by ||
    by + bh + gap <= ay
  );
}

function pieceFits(
  x: number, y: number, w: number, h: number,
  sheetW: number, sheetH: number,
  placed: LayoutPiece[],
  gap: number,
): boolean {
  if (x < 0 || y < 0 || x + w > sheetW + 1e-6 || y + h > sheetH + 1e-6) return false;
  for (const p of placed) {
    if (rectsOverlap(x, y, w, h, p.x, p.y, p.w, p.h, gap)) return false;
  }
  return true;
}

/**
 * Compute leftover free rectangles (axis-aligned strips) after the base layout.
 * Heuristic: examines the bounding box of placed pieces and the remaining strips.
 */
function computeFreeRects(
  pieces: LayoutPiece[],
  sheetW: number,
  sheetH: number,
  gap: number,
): FreeRect[] {
  if (pieces.length === 0) return [{ x: 0, y: 0, w: sheetW, h: sheetH }];

  const minX = Math.min(...pieces.map(p => p.x));
  const minY = Math.min(...pieces.map(p => p.y));
  const maxX = Math.max(...pieces.map(p => p.x + p.w));
  const maxY = Math.max(...pieces.map(p => p.y + p.h));

  const rects: FreeRect[] = [];

  // Right strip
  if (sheetW - maxX > 0) {
    rects.push({ x: maxX + gap, y: 0, w: Math.max(0, sheetW - maxX - gap), h: sheetH });
  }
  // Bottom strip
  if (sheetH - maxY > 0) {
    rects.push({ x: 0, y: maxY + gap, w: sheetW, h: Math.max(0, sheetH - maxY - gap) });
  }
  // Left strip (rare)
  if (minX > 0) {
    rects.push({ x: 0, y: 0, w: Math.max(0, minX - gap), h: sheetH });
  }
  // Top strip (rare)
  if (minY > 0) {
    rects.push({ x: 0, y: 0, w: sheetW, h: Math.max(0, minY - gap) });
  }

  return rects.filter(r => r.w > 0 && r.h > 0);
}

/**
 * Try to fit additional pieces (in either orientation) into the empty area
 * of the sheet using a simple shelf-packing heuristic per free rect.
 */
function smartNest(
  base: LayoutScenario,
  sheetW: number,
  sheetH: number,
  pw: number,
  ph: number,
  gap: number,
): LayoutScenario | null {
  const placed: LayoutPiece[] = base.pieces.map(p => ({ ...p }));
  const freeRects = computeFreeRects(placed, sheetW, sheetH, gap);
  if (freeRects.length === 0) return null;

  let nextIdx = placed.length + 1;
  let added = 0;

  // Two orientations to try
  const orientations: { w: number; h: number; rotated: boolean }[] =
    pw === ph
      ? [{ w: pw, h: ph, rotated: false }]
      : [
          { w: pw, h: ph, rotated: false },
          { w: ph, h: pw, rotated: true },
        ];

  for (const fr of freeRects) {
    // Shelf packing inside this free rect — try the orientation that yields more pieces first
    let best: { pieces: LayoutPiece[]; count: number } = { pieces: [], count: 0 };

    for (const o of orientations) {
      const tentative: LayoutPiece[] = [];
      let y = fr.y;
      while (y + o.h <= fr.y + fr.h + 1e-6) {
        let x = fr.x;
        while (x + o.w <= fr.x + fr.w + 1e-6) {
          if (pieceFits(x, y, o.w, o.h, sheetW, sheetH, [...placed, ...tentative], gap)) {
            tentative.push({ x, y, w: o.w, h: o.h, rotated: o.rotated, index: 0 });
          }
          x += o.w + gap;
        }
        y += o.h + gap;
      }
      if (tentative.length > best.count) best = { pieces: tentative, count: tentative.length };
    }

    for (const np of best.pieces) {
      placed.push({ ...np, index: nextIdx++ });
      added++;
    }
  }

  if (added === 0) return null;

  const totalArea = sheetW * sheetH;
  const usedArea = placed.length * pw * ph;

  return {
    id: `${base.id}-nested-${added}`,
    label: `${base.label} + استغلال فراغات (+${added})`,
    strategy: `${base.strategy}-nested`,
    pieces: placed,
    count: placed.length,
    pieceW: base.pieceW,
    pieceH: base.pieceH,
    rotated: base.rotated,
    cols: base.cols,
    rows: base.rows,
    usagePercent: (usedArea / totalArea) * 100,
    wasteArea: totalArea - usedArea,
    baseCount: base.count,
    nestedAdded: added,
  };
}

/* ─────────────────────────────────────────────
 * Main optimizer (Smart Imposition Engine)
 * ───────────────────────────────────────────── */

export function optimizeLayout(
  sheetW: number,
  sheetH: number,
  pieceW: number,
  pieceH: number,
  gap: number = 0,
  dielineShape?: import('./dielineGeometry').DielineShape | null,
): LayoutResult {
  const empty: LayoutResult = {
    scenarios: [],
    bestIdx: -1,
    recommendedIdx: -1,
    alternativeIdx: -1,
    maxOutputIdx: -1,
    sheetW,
    sheetH,
  };
  if (sheetW <= 0 || sheetH <= 0 || pieceW <= 0 || pieceH <= 0) return empty;

  const all: LayoutScenario[] = [];

  // 1) No rotation
  const s1 = buildGridScenario(sheetW, sheetH, pieceW, pieceH, gap, false, 'بدون تدوير (0°)', 'normal');
  if (s1) all.push(s1);

  // 2) 90° rotation
  if (pieceW !== pieceH) {
    const s2 = buildGridScenario(sheetW, sheetH, pieceH, pieceW, gap, true, 'تدوير 90°', 'rotated-90');
    if (s2) all.push(s2);
  }

  // 3) Offset / mixed gap-fill scenarios
  all.push(...buildOffsetScenarios(sheetW, sheetH, pieceW, pieceH, gap));

  if (all.length === 0) return empty;

  // Deduplicate: same count + same strategy family is fine, but kill exact duplicates by id
  const seenIds = new Set<string>();
  const unique = all.filter(s => {
    if (seenIds.has(s.id)) return false;
    seenIds.add(s.id);
    return true;
  });

  // 4) Smart Nesting — try to fill leftover gaps in each base scenario
  // Only nest the top base scenarios to keep it fast
  unique.sort((a, b) => b.count - a.count || b.usagePercent - a.usagePercent);
  const baseTop = unique.slice(0, Math.min(3, unique.length));
  const nested: LayoutScenario[] = [];
  for (const base of baseTop) {
    const n = smartNest(base, sheetW, sheetH, pieceW, pieceH, gap);
    if (n && n.count > base.count) nested.push(n);
  }
  unique.push(...nested);

  // 5) NFP geometric nesting — only when a real dieline shape is provided.
  // Uses the No-Fit Polygon to pack the actual concave outline. Often beats
  // grid scenarios for tapered/irregular shapes (boxes with flaps, dies, etc.).
  if (dielineShape) {
    try {
      const upperBound = Math.ceil((sheetW * sheetH) / Math.max(0.01, pieceW * pieceH)) + 4;
      const nfp = packShapeIntoSheet(dielineShape, sheetW, sheetH, {
        gap,
        allowRotation: true,
        maxPieces: Math.min(200, upperBound),
        fast: true,
      });
      if (nfp.count > 0) {
        const totalArea = sheetW * sheetH;
        const usedArea = nfp.count * pieceW * pieceH;
        unique.push({
          id: `nfp-${nfp.count}`,
          label: `تعشيق هندسي (NFP) — ${nfp.count} قطعة`,
          strategy: 'nfp-geometric',
          pieces: nfp.pieces,
          count: nfp.count,
          pieceW,
          pieceH,
          rotated: false,
          cols: 0,
          rows: 0,
          usagePercent: (usedArea / totalArea) * 100,
          wasteArea: totalArea - usedArea,
        });
      }
    } catch (err) {
      // NFP failed — gracefully degrade to grid scenarios
      console.warn('NFP nesting failed, using grid fallback:', err);
    }
  }

  // Re-sort after nesting
  unique.sort((a, b) => b.count - a.count || b.usagePercent - a.usagePercent);

  // Classification
  const maxOutputIdx = 0; // highest count
  const maxCount = unique[0].count;

  // Recommended = simplest strategy among those reaching max count (prefer "normal" or "rotated-90")
  // NFP-geometric is preferred when a real dieline shape is provided — it uses
  // the actual concave outline and typically packs irregular shapes more densely.
  const simpleOrder = ['nfp-geometric', 'normal', 'rotated-90', 'normal-nested', 'rotated-90-nested', 'offset-right', 'offset-bottom', 'mixed-rotated-right', 'offset-right-nested', 'offset-bottom-nested', 'mixed-rotated-right-nested'];
  let recommendedIdx = maxOutputIdx;
  let bestRank = simpleOrder.indexOf(unique[maxOutputIdx].strategy);
  if (bestRank === -1) bestRank = 999;
  for (let i = 0; i < unique.length; i++) {
    if (unique[i].count === maxCount) {
      const rank = simpleOrder.indexOf(unique[i].strategy);
      const r = rank === -1 ? 999 : rank;
      if (r < bestRank) {
        bestRank = r;
        recommendedIdx = i;
      }
    }
  }

  // Alternative = next distinct scenario that isn't the recommended (different strategy or count)
  let alternativeIdx = -1;
  for (let i = 0; i < unique.length; i++) {
    if (i === recommendedIdx) continue;
    if (unique[i].strategy !== unique[recommendedIdx].strategy || unique[i].count !== unique[recommendedIdx].count) {
      alternativeIdx = i;
      break;
    }
  }

  // Tag categories (max-output may equal recommended)
  unique.forEach((s, i) => {
    if (i === recommendedIdx) s.category = 'recommended';
    else if (i === maxOutputIdx && maxOutputIdx !== recommendedIdx) s.category = 'max-output';
    else if (i === alternativeIdx) s.category = 'alternative';
  });

  return {
    scenarios: unique,
    bestIdx: recommendedIdx,
    recommendedIdx,
    alternativeIdx,
    maxOutputIdx,
    sheetW,
    sheetH,
  };
}

/* ─────────────────────────────────────────────
 * Two-stage entry point
 * ───────────────────────────────────────────── */

export function optimizeTwoStage(
  masterW: number,
  masterH: number,
  pressW: number,
  pressH: number,
  productW: number,
  productH: number,
  gap: number = 0,
  dielineShape?: import('./dielineGeometry').DielineShape | null,
): TwoStageResult {
  const stage1 = optimizeLayout(masterW, masterH, pressW, pressH, 0);
  // Pass the dieline shape to stage 2 so the actual product geometry is used for nesting
  const stage2 = optimizeLayout(pressW, pressH, productW, productH, gap, dielineShape);

  const pressCount = stage1.recommendedIdx >= 0 ? stage1.scenarios[stage1.recommendedIdx].count : 0;
  const productCount = stage2.recommendedIdx >= 0 ? stage2.scenarios[stage2.recommendedIdx].count : 0;
  const totalProducts = pressCount * productCount;

  const formula = `${productCount} منتج × ${pressCount} شيت طباعة = ${totalProducts} منتج`;

  return { stage1, stage2, totalProducts, formula };
}

/* ─────────────────────────────────────────────
 * Press-size enumeration (Production Scenarios)
 * ─────────────────────────────────────────────
 * Tries MULTIPLE press-sheet sizes (each ≤ machine size) cut out of the base
 * sheet, then for each size computes:
 *   total = (products inside press sheet) × (press sheets per base sheet)
 *
 * Returns one entry per candidate press size, sorted by `total` desc.
 * The first entry is the best production option.
 * ───────────────────────────────────────────── */

export interface PressSizeScenario {
  id: string;
  /** Press sheet dimensions chosen for this scenario */
  pressW: number;
  pressH: number;
  /** Number of press sheets we get from one base sheet (Stage 1) */
  pressPerBase: number;
  /** Pieces fitted inside ONE press sheet (Stage 2) */
  productsPerPress: number;
  /** total = pressPerBase × productsPerPress */
  total: number;
  /** Stage 1 layout (press sheets inside base sheet) — for preview */
  stage1: LayoutResult;
  /** Stage 2 layout (products inside the chosen press sheet) — for preview */
  stage2: LayoutResult;
  /** True if this candidate equals the machine size exactly */
  isMachineSize: boolean;
  /** Human label, e.g. "33×70" */
  label: string;
}

export interface ProductionScenarios {
  /** Scenario A: print on machine sheet directly (no subdivision of base). */
  direct: PressSizeScenario;
  /** Scenario B candidates: subdivisions of the base sheet, sorted by total desc. */
  subdivisions: PressSizeScenario[];
  /** Best across direct + subdivisions (highest total). */
  best: PressSizeScenario;
}

/**
 * Enumerate candidate press-sheet sizes that:
 *   - fit inside the machine envelope (machineW × machineH, either orientation)
 *   - tile the base sheet evenly (integer divisions along W and/or H)
 * Then compute total products per base sheet for each.
 */
export function enumerateProductionScenarios(
  baseW: number,
  baseH: number,
  machineW: number,
  machineH: number,
  productW: number,
  productH: number,
  gap: number = 0,
  dielineShape?: import('./dielineGeometry').DielineShape | null,
): ProductionScenarios | null {
  if (baseW <= 0 || baseH <= 0 || machineW <= 0 || machineH <= 0) return null;
  if (productW <= 0 || productH <= 0) return null;

  // Helper: does a (w,h) press fit inside the machine envelope (any orientation)?
  const fitsMachine = (w: number, h: number) => {
    const fitNormal = w <= machineW + 1e-6 && h <= machineH + 1e-6;
    const fitRot = w <= machineH + 1e-6 && h <= machineW + 1e-6;
    return fitNormal || fitRot;
  };

  // Build candidate press sizes by dividing the base sheet evenly.
  // For each axis we try 1..N divisions where N keeps press dim ≥ product dim.
  const minDim = Math.min(productW, productH);
  const maxDivW = Math.max(1, Math.floor(baseW / Math.max(0.1, minDim)));
  const maxDivH = Math.max(1, Math.floor(baseH / Math.max(0.1, minDim)));

  type Cand = { w: number; h: number; nx: number; ny: number };
  const candMap = new Map<string, Cand>();
  for (let nx = 1; nx <= maxDivW; nx++) {
    for (let ny = 1; ny <= maxDivH; ny++) {
      const w = +(baseW / nx).toFixed(2);
      const h = +(baseH / ny).toFixed(2);
      if (w <= 0 || h <= 0) continue;
      if (!fitsMachine(w, h)) continue;
      const key = `${w}x${h}`;
      if (!candMap.has(key)) candMap.set(key, { w, h, nx, ny });
    }
  }

  if (candMap.size === 0) return null;

  // Build scenarios for each candidate.
  const allScenarios: PressSizeScenario[] = [];
  for (const c of candMap.values()) {
    const pressPerBase = c.nx * c.ny;
    // Stage 1 layout: press sheets in base — synthesize from grid (always integer-tiled here)
    const stage1 = optimizeLayout(baseW, baseH, c.w, c.h, 0);
    // Stage 2: products in press
    const stage2 = optimizeLayout(c.w, c.h, productW, productH, gap, dielineShape);
    const productsPerPress =
      stage2.recommendedIdx >= 0 ? stage2.scenarios[stage2.recommendedIdx].count : 0;
    if (productsPerPress <= 0) continue;
    const isMachineSize =
      (Math.abs(c.w - machineW) < 0.05 && Math.abs(c.h - machineH) < 0.05) ||
      (Math.abs(c.w - machineH) < 0.05 && Math.abs(c.h - machineW) < 0.05);
    allScenarios.push({
      id: `press-${c.w}x${c.h}-${c.nx}x${c.ny}`,
      pressW: c.w,
      pressH: c.h,
      pressPerBase,
      productsPerPress,
      total: pressPerBase * productsPerPress,
      stage1,
      stage2,
      isMachineSize,
      label: `${c.w}×${c.h}`,
    });
  }

  if (allScenarios.length === 0) return null;

  // Build the "direct" scenario: print on machine sheet directly (1 input).
  // CRITICAL: clamp direct press to what the actual purchased sheet allows —
  // you can't physically print on an area larger than the paper you bought.
  // Try both base orientations and pick the larger usable area.
  const dirA_W = Math.min(machineW, baseW);
  const dirA_H = Math.min(machineH, baseH);
  const dirB_W = Math.min(machineW, baseH);
  const dirB_H = Math.min(machineH, baseW);
  const useRot = dirB_W * dirB_H > dirA_W * dirA_H;
  const directW = +(useRot ? dirB_W : dirA_W).toFixed(2);
  const directH = +(useRot ? dirB_H : dirA_H).toFixed(2);
  const directStage2 = optimizeLayout(directW, directH, productW, productH, gap, dielineShape);
  const directProducts =
    directStage2.recommendedIdx >= 0
      ? directStage2.scenarios[directStage2.recommendedIdx].count
      : 0;
  const isMachineFull =
    Math.abs(directW - machineW) < 0.05 && Math.abs(directH - machineH) < 0.05;
  const direct: PressSizeScenario = {
    id: `direct-${directW}x${directH}`,
    pressW: directW,
    pressH: directH,
    pressPerBase: 1,
    productsPerPress: directProducts,
    total: directProducts,
    stage1: optimizeLayout(directW, directH, directW, directH, 0),
    stage2: directStage2,
    isMachineSize: isMachineFull,
    label: `${directW}×${directH}`,
  };

  // Sort subdivisions by total desc, then prefer larger press sheet area on ties.
  allScenarios.sort(
    (a, b) =>
      b.total - a.total ||
      b.pressW * b.pressH - a.pressW * a.pressH ||
      b.productsPerPress - a.productsPerPress,
  );

  // Best across direct + subdivisions
  const best = [direct, ...allScenarios].sort((a, b) => b.total - a.total)[0];

  return { direct, subdivisions: allScenarios, best };
}
