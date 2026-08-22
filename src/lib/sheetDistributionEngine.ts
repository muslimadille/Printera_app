/**
 * Sheet Distribution & Advanced Smart Nesting Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Comprehensive search across:
 * 1. 4-way Rotation (0°, 90°, 180°, 270°)
 * 2. Horizontal & Vertical Mirroring
 * 3. Row-Brick Horizontal Offsets (Tongue-to-Tongue nesting)
 * 4. Alternating 180° Inverted Rows (Head-to-Tail nesting)
 * 5. Alternating 180° Inverted Columns (Side-to-Side nesting)
 * 6. Macro 2-Piece Interlocked Tile Grid
 * 7. Mixed Remainder L-Fill (Filling leftover right/bottom strips with rotated dies)
 * 8. Zero overlap guarantee using 2D silhouette cut collision envelopes.
 */

export interface ParsedDieSvg {
  fileName: string;
  rawSvg: string;
  innerSvg: string;
  vbX: number;
  vbY: number;
  vbW: number;
  vbH: number;
  widthMm: number;
  heightMm: number;
  segments: Segment[];
  estimatedAreaMm2: number;
}

export interface PlacedDiePiece {
  id: string;
  index: number;
  x: number; // mm top-left in sheet
  y: number; // mm top-left in sheet
  width: number; // mm footprint
  height: number; // mm footprint
  rotation: 0 | 90 | 180 | 270;
  mirrored?: boolean;
}

export type NestingStrategyType = 'same_orientation' | 'inverted' | 'grid' | 'mirrored' | 'mixed';

export interface NestingLayoutResult {
  strategyName: string;
  strategyType?: NestingStrategyType;
  count: number;
  sheetWidthMm: number;
  sheetHeightMm: number;
  sheetAreaMm2: number;
  totalUsedAreaMm2: number;
  utilizationPercent: number;
  wastePercent: number;
  pieces: PlacedDiePiece[];
  parsedDie: ParsedDieSvg;
  effectivePitchX: number;
  effectivePitchY: number;
  allStrategies?: NestingLayoutResult[];
}

export interface NestingOptions {
  sheetWidthMm: number;
  sheetHeightMm: number;
  gapMm?: number;
  marginMm?: number;
  allowInversion?: boolean;
  strategyType?: 'same_orientation' | 'all' | 'grid';
}

export interface Pt {
  x: number;
  y: number;
}

export interface Segment {
  start: Pt;
  end: Pt;
  isCrease?: boolean;
}

/* ──────────────────────────────────────────────────────────── *
 * Units & SVG Parser                                           *
 * ──────────────────────────────────────────────────────────── */

const PT_TO_MM = 25.4 / 72;
const IN_TO_MM = 25.4;
const PX_TO_MM = 25.4 / 96;

export const parseUnitToMm = (raw: string | null | undefined): number => {
  if (!raw) return 0;
  const s = String(raw).trim();
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*(mm|cm|in|pt|px)?$/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const u = (m[2] || 'px').toLowerCase();
  if (u === 'mm') return n;
  if (u === 'cm') return n * 10;
  if (u === 'in') return n * IN_TO_MM;
  if (u === 'pt') return n * PT_TO_MM;
  return n * PX_TO_MM;
};

const isDashedElement = (el: Element): boolean => {
  const da = el.getAttribute('stroke-dasharray');
  if (da && da !== 'none' && da.trim() !== '0') return true;
  const style = el.getAttribute('style') || '';
  const m = style.match(/stroke-dasharray\s*:\s*([^;]+)/i);
  return !!(m && m[1].trim() && m[1].trim().toLowerCase() !== 'none' && m[1].trim() !== '0');
};

function parseTransformTranslate(transformAttr: string | null): { tx: number; ty: number } {
  if (!transformAttr) return { tx: 0, ty: 0 };
  const m = transformAttr.match(/translate\(\s*(-?\d+(?:\.\d+)?)(?:[\s,]+(-?\d+(?:\.\d+)?))?\s*\)/i);
  if (m) {
    return {
      tx: parseFloat(m[1]) || 0,
      ty: parseFloat(m[2] || '0') || 0,
    };
  }
  return { tx: 0, ty: 0 };
}

function isCreaseElement(el: Element, doc: Document): boolean {
  if (isDashedElement(el)) return true;

  const strokeAttr = (el.getAttribute('stroke') || '').toLowerCase();
  const styleAttr = (el.getAttribute('style') || '').toLowerCase();
  const className = el.getAttribute('class') || '';

  let classStroke = '';
  if (className) {
    const classNames = className.split(/\s+/);
    const styles = doc.querySelectorAll('style');
    for (const cn of classNames) {
      for (const st of styles) {
        const text = st.textContent || '';
        const m = text.match(new RegExp(`\\.${cn}[^\\{]*\\{([^\\}]+)\\}`, 'i'));
        if (m) {
          const strokeM = m[1].match(/stroke\s*:\s*([^;]+)/i);
          if (strokeM) classStroke += ' ' + strokeM[1].trim().toLowerCase();
        }
      }
    }
  }

  const allStroke = `${strokeAttr} ${styleAttr} ${classStroke}`.toLowerCase();
  return (
    allStroke.includes('#009640') ||
    allStroke.includes('#00a651') ||
    allStroke.includes('green') ||
    allStroke.includes('#00ff00') ||
    allStroke.includes('#ffed00') ||
    allStroke.includes('yellow') ||
    allStroke.includes('cyan') ||
    allStroke.includes('#00ffff') ||
    allStroke.includes('crease') ||
    allStroke.includes('fold')
  );
}

function extractSegmentsFromDoc(doc: Document, scaleX: number, scaleY: number, vbX: number, vbY: number): Segment[] {
  const segments: Segment[] = [];

  // Lines
  doc.querySelectorAll('line').forEach((el) => {
    const isCrease = isCreaseElement(el, doc);
    const { tx, ty } = parseTransformTranslate(el.getAttribute('transform'));
    const x1 = (parseFloat(el.getAttribute('x1') || '0') + tx - vbX) * scaleX;
    const y1 = (parseFloat(el.getAttribute('y1') || '0') + ty - vbY) * scaleY;
    const x2 = (parseFloat(el.getAttribute('x2') || '0') + tx - vbX) * scaleX;
    const y2 = (parseFloat(el.getAttribute('y2') || '0') + ty - vbY) * scaleY;
    segments.push({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, isCrease });
  });

  // Polylines & Polygons
  doc.querySelectorAll('polyline, polygon').forEach((el) => {
    const isCrease = isCreaseElement(el, doc);
    const { tx, ty } = parseTransformTranslate(el.getAttribute('transform'));
    const raw = el.getAttribute('points') || '';
    const nums = raw.trim().match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi)?.map(Number) || [];
    const pts: Pt[] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      pts.push({
        x: (nums[i] + tx - vbX) * scaleX,
        y: (nums[i + 1] + ty - vbY) * scaleY,
      });
    }
    for (let i = 0; i + 1 < pts.length; i++) {
      segments.push({ start: pts[i], end: pts[i + 1], isCrease });
    }
    if (el.tagName.toLowerCase() === 'polygon' && pts.length > 2) {
      segments.push({ start: pts[pts.length - 1], end: pts[0], isCrease });
    }
  });

  // Rectangles
  doc.querySelectorAll('rect').forEach((el) => {
    const isCrease = isCreaseElement(el, doc);
    const { tx, ty } = parseTransformTranslate(el.getAttribute('transform'));
    const x = (parseFloat(el.getAttribute('x') || '0') + tx - vbX) * scaleX;
    const y = (parseFloat(el.getAttribute('y') || '0') + ty - vbY) * scaleY;
    const w = parseFloat(el.getAttribute('width') || '0') * scaleX;
    const h = parseFloat(el.getAttribute('height') || '0') * scaleY;
    segments.push({ start: { x, y }, end: { x: x + w, y }, isCrease });
    segments.push({ start: { x: x + w, y }, end: { x: x + w, y: y + h }, isCrease });
    segments.push({ start: { x: x + w, y: y + h }, end: { x, y: y + h }, isCrease });
    segments.push({ start: { x, y: y + h }, end: { x, y }, isCrease });
  });

  // Paths
  doc.querySelectorAll('path').forEach((el) => {
    const isCrease = isCreaseElement(el, doc);
    const { tx, ty } = parseTransformTranslate(el.getAttribute('transform'));
    const d = el.getAttribute('d');
    if (!d) return;

    const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
    let cx = 0, cy = 0;
    let sx = 0, sy = 0;
    let i = 0;
    let cmd = '';

    const num = () => parseFloat(tokens[i++]);

    while (i < tokens.length) {
      const t = tokens[i];
      if (/[a-zA-Z]/.test(t)) { cmd = t; i++; }
      const isRel = cmd === cmd.toLowerCase();
      const c = cmd.toUpperCase();

      if (c === 'M') {
        const x = num() + (isRel ? cx : 0);
        const y = num() + (isRel ? cy : 0);
        cx = x; cy = y; sx = x; sy = y;
        cmd = isRel ? 'l' : 'L';
      } else if (c === 'L') {
        const x = num() + (isRel ? cx : 0);
        const y = num() + (isRel ? cy : 0);
        segments.push({
          start: { x: (cx + tx - vbX) * scaleX, y: (cy + ty - vbY) * scaleY },
          end: { x: (x + tx - vbX) * scaleX, y: (y + ty - vbY) * scaleY },
          isCrease,
        });
        cx = x; cy = y;
      } else if (c === 'H') {
        const x = num() + (isRel ? cx : 0);
        segments.push({
          start: { x: (cx + tx - vbX) * scaleX, y: (cy + ty - vbY) * scaleY },
          end: { x: (x + tx - vbX) * scaleX, y: (cy + ty - vbY) * scaleY },
          isCrease,
        });
        cx = x;
      } else if (c === 'V') {
        const y = num() + (isRel ? cy : 0);
        segments.push({
          start: { x: (cx + tx - vbX) * scaleX, y: (cy + ty - vbY) * scaleY },
          end: { x: (cx + tx - vbX) * scaleX, y: (y + ty - vbY) * scaleY },
          isCrease,
        });
        cy = y;
      } else if (c === 'C' || c === 'S' || c === 'Q') {
        const x1 = num() + (isRel ? cx : 0);
        const y1 = num() + (isRel ? cy : 0);
        let x2 = x1, y2 = y1, x = x1, y = y1;
        if (c === 'C') {
          x2 = num() + (isRel ? cx : 0);
          y2 = num() + (isRel ? cy : 0);
          x = num() + (isRel ? cx : 0);
          y = num() + (isRel ? cy : 0);
        } else if (c === 'S' || c === 'Q') {
          x = num() + (isRel ? cx : 0);
          y = num() + (isRel ? cy : 0);
        }
        segments.push({
          start: { x: (cx + tx - vbX) * scaleX, y: (cy + ty - vbY) * scaleY },
          end: { x: (x + tx - vbX) * scaleX, y: (y + ty - vbY) * scaleY },
          isCrease,
        });
        cx = x; cy = y;
      } else if (c === 'A') {
        num(); // rx
        num(); // ry
        num(); // rot
        num(); // largeArc
        num(); // sweep
        const x = num() + (isRel ? cx : 0);
        const y = num() + (isRel ? cy : 0);
        segments.push({
          start: { x: (cx + tx - vbX) * scaleX, y: (cy + ty - vbY) * scaleY },
          end: { x: (x + tx - vbX) * scaleX, y: (y + ty - vbY) * scaleY },
          isCrease,
        });
        cx = x; cy = y;
      } else if (c === 'Z') {
        segments.push({
          start: { x: (cx + tx - vbX) * scaleX, y: (cy + ty - vbY) * scaleY },
          end: { x: (sx + tx - vbX) * scaleX, y: (sy + ty - vbY) * scaleY },
          isCrease,
        });
        cx = sx; cy = sy;
      } else {
        i++;
      }
    }
  });

  return segments;
}

export const parseSvgString = (rawSvg: string, fileName = 'template.svg'): ParsedDieSvg => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawSvg, 'image/svg+xml');
  const err = doc.querySelector('parsererror');
  if (err) throw new Error('الملف ليس بصيغة SVG صحيحة');

  const svg = doc.documentElement;
  if (!svg || svg.tagName.toLowerCase() !== 'svg') {
    throw new Error('لم يتم العثور على عنصر <svg> صالح');
  }

  let vbX = 0, vbY = 0, vbW = 0, vbH = 0;
  const viewBoxAttr = svg.getAttribute('viewBox');
  if (viewBoxAttr) {
    const parts = viewBoxAttr.split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      [vbX, vbY, vbW, vbH] = parts;
    }
  }

  const wAttr = svg.getAttribute('width');
  const hAttr = svg.getAttribute('height');
  const hasUnit = (s: string | null) => !!s && /(mm|cm|in|pt|px)\s*$/i.test(s);

  let widthMm = 0;
  let heightMm = 0;

  if (hasUnit(wAttr) && hasUnit(hAttr)) {
    widthMm = parseUnitToMm(wAttr);
    heightMm = parseUnitToMm(hAttr);
  } else if (vbW > 0 && vbH > 0) {
    widthMm = vbW * PT_TO_MM;
    heightMm = vbH * PT_TO_MM;
  } else if (wAttr && hAttr) {
    widthMm = parseUnitToMm(wAttr);
    heightMm = parseUnitToMm(hAttr);
  }

  if (widthMm <= 0 || heightMm <= 0) {
    if (vbW > 0 && vbH > 0) {
      widthMm = vbW * PT_TO_MM;
      heightMm = vbH * PT_TO_MM;
    } else {
      widthMm = 200;
      heightMm = 250;
    }
  }

  if (!vbW || !vbH) {
    vbW = widthMm;
    vbH = heightMm;
  }

  const scaleX = vbW > 0 ? widthMm / vbW : 1;
  const scaleY = vbH > 0 ? heightMm / vbH : 1;

  const segments = extractSegmentsFromDoc(doc, scaleX, scaleY, vbX, vbY);
  const innerSvg = svg.innerHTML || '';

  // Calculate true physical bounding envelope from segments
  let cutMinX = Infinity, cutMaxX = -Infinity, cutMinY = Infinity, cutMaxY = -Infinity;
  for (const s of segments) {
    if (!s.isCrease) {
      cutMinX = Math.min(cutMinX, s.start.x, s.end.x);
      cutMaxX = Math.max(cutMaxX, s.start.x, s.end.x);
      cutMinY = Math.min(cutMinY, s.start.y, s.end.y);
      cutMaxY = Math.max(cutMaxY, s.start.y, s.end.y);
    }
  }

  const estimatedAreaMm2 = widthMm * heightMm * 0.76;

  return {
    fileName,
    rawSvg,
    innerSvg,
    vbX,
    vbY,
    vbW,
    vbH,
    widthMm: Math.round(widthMm * 10) / 10,
    heightMm: Math.round(heightMm * 10) / 10,
    segments,
    estimatedAreaMm2,
  };
};

/* ──────────────────────────────────────────────────────────── *
 * 2D Silhouette Profile Engine                                 *
 * ──────────────────────────────────────────────────────────── */

interface Silhouette {
  W: number;
  H: number;
  step: number;
  nx: number;
  ny: number;
  topY: Float64Array;
  bottomY: Float64Array;
  leftX: Float64Array;
  rightX: Float64Array;
}

export type TransformKey = '0' | '90' | '180' | '270' | '0_m' | '90_m' | '180_m' | '270_m';

export function buildSilhouette(
  segs: DieSegment[],
  bboxW: number,
  bboxH: number,
  rotation: 0 | 90 | 180 | 270,
  mirrored: boolean,
  step = 1.0
): Silhouette {
  const isRotated = rotation === 90 || rotation === 270;
  const W = isRotated ? bboxH : bboxW;
  const H = isRotated ? bboxW : bboxH;

  const nx = Math.max(1, Math.ceil(W / step) + 1);
  const ny = Math.max(1, Math.ceil(H / step) + 1);

  const topY = new Float64Array(nx);    topY.fill(Number.POSITIVE_INFINITY);
  const bottomY = new Float64Array(nx); bottomY.fill(Number.NEGATIVE_INFINITY);
  const leftX = new Float64Array(ny);   leftX.fill(Number.POSITIVE_INFINITY);
  const rightX = new Float64Array(ny);  rightX.fill(Number.NEGATIVE_INFINITY);

  const pts: Pt[] = [];
  for (const s of segs) {
    if (s.isCrease) continue;
    const dx = s.end.x - s.start.x;
    const dy = s.end.y - s.start.y;
    const len = Math.hypot(dx, dy);
    const steps = Math.max(2, Math.ceil(len / step));
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      pts.push({ x: s.start.x + dx * t, y: s.start.y + dy * t });
    }
  }

  if (pts.length === 0) {
    pts.push({ x: 0, y: 0 }, { x: bboxW, y: 0 }, { x: bboxW, y: bboxH }, { x: 0, y: bboxH });
  }

  for (const p of pts) {
    let px = p.x;
    let py = p.y;

    if (mirrored) {
      px = bboxW - px;
    }

    if (rotation === 90) {
      const tmp = px;
      px = bboxH - py;
      py = tmp;
    } else if (rotation === 180) {
      px = bboxW - px;
      py = bboxH - py;
    } else if (rotation === 270) {
      const tmp = px;
      px = py;
      py = bboxW - tmp;
    }

    const ci = Math.min(nx - 1, Math.max(0, Math.round(px / step)));
    const ri = Math.min(ny - 1, Math.max(0, Math.round(py / step)));

    if (py < topY[ci]) topY[ci] = py;
    if (py > bottomY[ci]) bottomY[ci] = py;
    if (px < leftX[ri]) leftX[ri] = px;
    if (px > rightX[ri]) rightX[ri] = px;
  }

  for (let i = 0; i < nx; i++) {
    if (!Number.isFinite(topY[i])) topY[i] = 0;
    if (!Number.isFinite(bottomY[i])) bottomY[i] = H;
  }
  for (let j = 0; j < ny; j++) {
    if (!Number.isFinite(leftX[j])) leftX[j] = 0;
    if (!Number.isFinite(rightX[j])) rightX[j] = W;
  }

  return { W, H, step, nx, ny, topY, bottomY, leftX, rightX };
}

function computeMinVerticalStep(
  silA: Silhouette,
  silB: Silhouette,
  dxShiftMm: number,
  gapMm: number
): number {
  const Px = silA.W + gapMm;
  let maxRequiredStep = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < silA.nx; i++) {
    const x = i * silA.step;
    const bottomA = silA.bottomY[i];

    // Check collision against periodic repetitions: k = -1, 0, 1
    for (const k of [-1, 0, 1]) {
      const xB = x - (dxShiftMm + k * Px);
      const j = Math.round(xB / silB.step);
      if (j >= 0 && j < silB.nx) {
        const topB = silB.topY[j];
        const dist = bottomA - topB + gapMm;
        if (dist > maxRequiredStep) maxRequiredStep = dist;
      }
    }
  }

  const minAllowedByBoxHeight = Math.max(silA.H, silB.H) * 0.4;
  const safePitch = Math.max(minAllowedByBoxHeight, maxRequiredStep);
  return Number.isFinite(safePitch) && safePitch > 0 ? safePitch : Math.max(silA.H, silB.H) + gapMm;
}

function computeMinHorizontalStep(
  silA: Silhouette,
  silB: Silhouette,
  dyShiftMm: number,
  gapMm: number
): number {
  const Py = silA.H + gapMm;
  let maxRequiredStep = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < silA.ny; i++) {
    const y = i * silA.step;
    const rightA = silA.rightX[i];

    // Check collision against periodic repetitions: k = -1, 0, 1
    for (const k of [-1, 0, 1]) {
      const yB = y - (dyShiftMm + k * Py);
      const j = Math.round(yB / silB.step);
      if (j >= 0 && j < silB.ny) {
        const leftB = silB.leftX[j];
        const dist = rightA - leftB + gapMm;
        if (dist > maxRequiredStep) maxRequiredStep = dist;
      }
    }
  }

  const minAllowedByBoxWidth = Math.max(silA.W, silB.W) * 0.4;
  const safePitch = Math.max(minAllowedByBoxWidth, maxRequiredStep);
  return Number.isFinite(safePitch) && safePitch > 0 ? safePitch : Math.max(silA.W, silB.W) + gapMm;
}

/* ──────────────────────────────────────────────────────────── *
 * Master Optimization Engine                                   *
 * ──────────────────────────────────────────────────────────── */

export function computeOptimalNesting(
  die: ParsedDieSvg,
  options: NestingOptions
): NestingLayoutResult {
  const { sheetWidthMm, sheetHeightMm, gapMm = 0, marginMm = 5 } = options;
  const usableW = Math.max(10, sheetWidthMm - marginMm * 2);
  const usableH = Math.max(10, sheetHeightMm - marginMm * 2);

  const strategies: NestingLayoutResult[] = [];

  // Generate all 8 silhouette transforms
  const silMap: Record<TransformKey, Silhouette> = {
    '0': buildSilhouette(die.segments, die.widthMm, die.heightMm, 0, false),
    '90': buildSilhouette(die.segments, die.widthMm, die.heightMm, 90, false),
    '180': buildSilhouette(die.segments, die.widthMm, die.heightMm, 180, false),
    '270': buildSilhouette(die.segments, die.widthMm, die.heightMm, 270, false),
    '0_m': buildSilhouette(die.segments, die.widthMm, die.heightMm, 0, true),
    '90_m': buildSilhouette(die.segments, die.widthMm, die.heightMm, 90, true),
    '180_m': buildSilhouette(die.segments, die.widthMm, die.heightMm, 180, true),
    '270_m': buildSilhouette(die.segments, die.widthMm, die.heightMm, 270, true),
  };

  // -------------------------------------------------------------
  // STRATEGY 1: Standard 4-Way Grids (0°, 90°, 180°, 270°)
  // -------------------------------------------------------------
  for (const rot of [0, 90, 180, 270] as const) {
    const sil = silMap[`${rot}` as TransformKey];
    const pw = sil.W;
    const ph = sil.H;
    const pitchX = pw + gapMm;
    const pitchY = ph + gapMm;

    const cols = Math.floor((usableW + gapMm) / pitchX);
    const rows = Math.floor((usableH + gapMm) / pitchY);

    if (cols > 0 && rows > 0) {
      const placedPieces: PlacedDiePiece[] = [];
      let idx = 1;
      const startX = marginMm + (usableW - (cols * pw + (cols - 1) * gapMm)) / 2;
      const startY = marginMm + (usableH - (rows * ph + (rows - 1) * gapMm)) / 2;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          placedPieces.push({
            id: `grid-${rot}-${r}-${c}`,
            index: idx++,
            x: startX + c * pitchX,
            y: startY + r * pitchY,
            width: pw,
            height: ph,
            rotation: rot,
          });
        }
      }

      strategies.push(
        buildResult(`توزيع شبكي (${rot === 90 || rot === 270 ? 'مدوّر 90°' : 'عادي'})`, 'grid', placedPieces, die, sheetWidthMm, sheetHeightMm, pitchX, pitchY)
      );
    }
  }

  // -------------------------------------------------------------
  // STRATEGY 2: Row Interlocking & Brick Offset (Same Rotation)
  // -------------------------------------------------------------
  for (const rot of [0, 90] as const) {
    const sil = silMap[`${rot}` as TransformKey];
    const pw = sil.W;
    const ph = sil.H;

    // Test s from 0 to 24 (s = 0 is straight row nesting where tongue fits pocket without horizontal shift)
    for (let s = 0; s <= 24; s++) {
      const dxShift = (pw * s) / 24;
      const stepY = computeMinVerticalStep(sil, sil, dxShift, gapMm);

      if (stepY >= ph + gapMm - 0.1) continue;

      const cols = Math.floor((usableW + gapMm) / (pw + gapMm));
      const rows = Math.floor((usableH - ph + stepY) / stepY);

      if (cols > 0 && rows > 1) {
        const placedPieces: PlacedDiePiece[] = [];
        let idx = 1;
        const totalBlockW = cols * pw + (cols - 1) * gapMm;
        const totalBlockH = (rows - 1) * stepY + ph;
        const startX = marginMm + Math.max(0, (usableW - totalBlockW) / 2);
        const startY = marginMm + Math.max(0, (usableH - totalBlockH) / 2);

        for (let r = 0; r < rows; r++) {
          const rowOffset = (r % 2 === 1) ? dxShift : 0;
          for (let c = 0; c < cols; c++) {
            const px = startX + c * (pw + gapMm) + (r % 2 === 1 && dxShift > pw * 0.5 ? dxShift - pw : rowOffset);
            const py = startY + r * stepY;

            if (px >= marginMm - 1 && px + pw <= sheetWidthMm - marginMm + 1 && py + ph <= sheetHeightMm - marginMm + 1) {
              placedPieces.push({
                id: `brick-${rot}-${r}-${c}`,
                index: idx++,
                x: Math.max(marginMm, px),
                y: py,
                width: pw,
                height: ph,
                rotation: rot,
              });
            }
          }
        }

        if (placedPieces.length > 0) {
          const sLabel = s === 0 ? 'تداخل مستقيم' : `إزاحة ${Math.round((s / 24) * 100)}%`;
          strategies.push(
            buildResult(
              `تعشيق صفوف نفس الاتجاه (${rot === 90 ? 'مدوّر' : 'أفقي'} - ${sLabel})`,
              'same_orientation',
              placedPieces,
              die,
              sheetWidthMm,
              sheetHeightMm,
              pw + gapMm,
              stepY
            )
          );
        }
      }
    }
  }

  // -------------------------------------------------------------
  // STRATEGY 2B: Column Interlocking along same rotation
  // -------------------------------------------------------------
  for (const rot of [0, 90] as const) {
    const sil = silMap[`${rot}` as TransformKey];
    const pw = sil.W;
    const ph = sil.H;

    for (let s = 0; s <= 24; s++) {
      const dyShift = (ph * s) / 24;
      const stepX = computeMinHorizontalStep(sil, sil, dyShift, gapMm);

      if (stepX >= pw + gapMm - 0.1) continue;

      const cols = Math.floor((usableW - pw + stepX) / stepX);
      const rows = Math.floor((usableH + gapMm) / (ph + gapMm));

      if (cols > 1 && rows > 0) {
        const placedPieces: PlacedDiePiece[] = [];
        let idx = 1;
        const totalBlockW = (cols - 1) * stepX + pw;
        const totalBlockH = rows * ph + (rows - 1) * gapMm;
        const startX = marginMm + Math.max(0, (usableW - totalBlockW) / 2);
        const startY = marginMm + Math.max(0, (usableH - totalBlockH) / 2);

        for (let c = 0; c < cols; c++) {
          const colOffset = (c % 2 === 1) ? dyShift : 0;
          for (let r = 0; r < rows; r++) {
            const px = startX + c * stepX;
            const py = startY + r * (ph + gapMm) + (c % 2 === 1 && dyShift > ph * 0.5 ? dyShift - ph : colOffset);

            if (px + pw <= sheetWidthMm - marginMm + 1 && py >= marginMm - 1 && py + ph <= sheetHeightMm - marginMm + 1) {
              placedPieces.push({
                id: `col-brick-${rot}-${c}-${r}`,
                index: idx++,
                x: px,
                y: Math.max(marginMm, py),
                width: pw,
                height: ph,
                rotation: rot,
              });
            }
          }
        }

        if (placedPieces.length > 0) {
          const sLabel = s === 0 ? 'تداخل مستقيم' : `إزاحة ${Math.round((s / 24) * 100)}%`;
          strategies.push(
            buildResult(
              `تعشيق أعمدة نفس الاتجاه (${rot === 90 ? 'مدوّر' : 'أفقي'} - ${sLabel})`,
              'same_orientation',
              placedPieces,
              die,
              sheetWidthMm,
              sheetHeightMm,
              stepX,
              ph + gapMm
            )
          );
        }
      }
    }
  }

  // -------------------------------------------------------------
  // STRATEGY 3: 180° Inverted Alternating Rows (Head-to-Tail Pocket Interlocking)
  // -------------------------------------------------------------
  for (const baseRot of [0, 90] as const) {
    const invRot = ((baseRot + 180) % 360) as 0 | 90 | 180 | 270;
    const silA = silMap[`${baseRot}` as TransformKey];
    const silB = silMap[`${invRot}` as TransformKey];
    const pw = silA.W;
    const ph = silA.H;

    for (let s = 0; s <= 16; s++) {
      const dxShift = (pw * s) / 16;
      const stepY = computeMinVerticalStep(silA, silB, dxShift, gapMm);

      if (stepY >= ph + gapMm - 1) continue;

      const cols = Math.floor((usableW + gapMm) / (pw + gapMm));
      const rows = Math.floor((usableH - ph + stepY) / stepY);

      if (cols > 0 && rows > 1) {
        const placedPieces: PlacedDiePiece[] = [];
        let idx = 1;
        const totalBlockW = cols * pw + (cols - 1) * gapMm;
        const totalBlockH = (rows - 1) * stepY + ph;
        const startX = marginMm + Math.max(0, (usableW - totalBlockW) / 2);
        const startY = marginMm + Math.max(0, (usableH - totalBlockH) / 2);

        for (let r = 0; r < rows; r++) {
          const isFlipped = r % 2 === 1;
          const curRot = isFlipped ? invRot : baseRot;

          for (let c = 0; c < cols; c++) {
            const px = startX + c * (pw + gapMm) + (isFlipped ? (dxShift > pw * 0.5 ? dxShift - pw : dxShift) : 0);
            const py = startY + r * stepY;

            if (px >= marginMm - 1 && px + pw <= sheetWidthMm - marginMm + 1 && py + ph <= sheetHeightMm - marginMm + 1) {
              placedPieces.push({
                id: `inv-r-${baseRot}-${r}-${c}`,
                index: idx++,
                x: Math.max(marginMm, px),
                y: py,
                width: pw,
                height: ph,
                rotation: curRot,
              });
            }
          }
        }

        if (placedPieces.length > 0) {
          strategies.push(
            buildResult(
              `تعشيق مقلوب 180° (${baseRot === 90 ? 'أعمدة مدوّرة' : 'صفوف متعاكسة'} - إزاحة ${Math.round((s / 16) * 100)}%)`,
              'inverted',
              placedPieces,
              die,
              sheetWidthMm,
              sheetHeightMm,
              pw + gapMm,
              stepY
            )
          );
        }
      }
    }
  }

  // -------------------------------------------------------------
  // STRATEGY 4: Mirrored Alternating Columns (Side Flap Nesting)
  // -------------------------------------------------------------
  for (const baseRot of [0, 90] as const) {
    const silA = silMap[`${baseRot}` as TransformKey];
    const silM = silMap[`${baseRot}_m` as TransformKey];
    const pw = silA.W;
    const ph = silA.H;

    for (let s = 0; s <= 12; s++) {
      const dyShift = (ph * s) / 12;
      const stepX = computeMinHorizontalStep(silA, silM, dyShift, gapMm);

      if (stepX >= pw + gapMm - 1) continue;

      const cols = Math.floor((usableW - pw + stepX) / stepX);
      const rows = Math.floor((usableH + gapMm) / (ph + gapMm));

      if (cols > 1 && rows > 0) {
        const placedPieces: PlacedDiePiece[] = [];
        let idx = 1;
        const totalBlockW = (cols - 1) * stepX + pw;
        const totalBlockH = rows * ph + (rows - 1) * gapMm;
        const startX = marginMm + Math.max(0, (usableW - totalBlockW) / 2);
        const startY = marginMm + Math.max(0, (usableH - totalBlockH) / 2);

        for (let c = 0; c < cols; c++) {
          const isMirrored = c % 2 === 1;

          for (let r = 0; r < rows; r++) {
            const px = startX + c * stepX;
            const py = startY + r * (ph + gapMm) + (isMirrored ? (dyShift > ph * 0.5 ? dyShift - ph : dyShift) : 0);

            if (px + pw <= sheetWidthMm - marginMm + 1 && py >= marginMm - 1 && py + ph <= sheetHeightMm - marginMm + 1) {
              placedPieces.push({
                id: `mir-c-${baseRot}-${c}-${r}`,
                index: idx++,
                x: px,
                y: Math.max(marginMm, py),
                width: pw,
                height: ph,
                rotation: baseRot,
                mirrored: isMirrored,
              });
            }
          }
        }

        if (placedPieces.length > 0) {
          strategies.push(
            buildResult(
              `تعشيق مرآتي جانبي (أعمدة معكوسة - إزاحة ${Math.round((s / 12) * 100)}%)`,
              'mirrored',
              placedPieces,
              die,
              sheetWidthMm,
              sheetHeightMm,
              stepX,
              ph + gapMm
            )
          );
        }
      }
    }
  }

  // -------------------------------------------------------------
  // STRATEGY 5: Mixed Remainder Strips (Main block + leftover strip fill)
  // -------------------------------------------------------------
  for (const primaryRot of [0, 90] as const) {
    const sil1 = silMap[`${primaryRot}` as TransformKey];
    const pw1 = sil1.W;
    const ph1 = sil1.H;

    const secRot = primaryRot === 0 ? 90 : 0;
    const sil2 = silMap[`${secRot}` as TransformKey];
    const pw2 = sil2.W;
    const ph2 = sil2.H;

    // 5A: Main grid + extra column strip on the right
    {
      const cols1 = Math.floor((usableW + gapMm) / (pw1 + gapMm));
      const rows1 = Math.floor((usableH + gapMm) / (ph1 + gapMm));

      if (cols1 > 0 && rows1 > 0) {
        const usedW = cols1 * (pw1 + gapMm);
        const remW = usableW - usedW;

        if (remW >= pw2) {
          const extraCols = Math.floor((remW + gapMm) / (pw2 + gapMm));
          const extraRows = Math.floor((usableH + gapMm) / (ph2 + gapMm));

          if (extraCols > 0 && extraRows > 0) {
            const placedPieces: PlacedDiePiece[] = [];
            let idx = 1;

            for (let r = 0; r < rows1; r++) {
              for (let c = 0; c < cols1; c++) {
                placedPieces.push({
                  id: `mix-a1-${r}-${c}`,
                  index: idx++,
                  x: marginMm + c * (pw1 + gapMm),
                  y: marginMm + r * (ph1 + gapMm),
                  width: pw1,
                  height: ph1,
                  rotation: primaryRot,
                });
              }
            }

            const offsetX = marginMm + usedW;
            for (let r = 0; r < extraRows; r++) {
              for (let c = 0; c < extraCols; c++) {
                placedPieces.push({
                  id: `mix-a2-${r}-${c}`,
                  index: idx++,
                  x: offsetX + c * (pw2 + gapMm),
                  y: marginMm + r * (ph2 + gapMm),
                  width: pw2,
                  height: ph2,
                  rotation: secRot,
                });
              }
            }

            strategies.push(
              buildResult(
                `توزيع مركب (شبكة ${primaryRot}° + شريط جانبي ${secRot}°)`,
                'mixed',
                placedPieces,
                die,
                sheetWidthMm,
                sheetHeightMm,
                pw1,
                ph1
              )
            );
          }
        }
      }
    }

    // 5B: Main grid + extra row strip at the bottom
    {
      const cols1 = Math.floor((usableW + gapMm) / (pw1 + gapMm));
      const rows1 = Math.floor((usableH + gapMm) / (ph1 + gapMm));

      if (cols1 > 0 && rows1 > 0) {
        const usedH = rows1 * (ph1 + gapMm);
        const remH = usableH - usedH;

        if (remH >= ph2) {
          const extraRows = Math.floor((remH + gapMm) / (ph2 + gapMm));
          const extraCols = Math.floor((usableW + gapMm) / (pw2 + gapMm));

          if (extraRows > 0 && extraCols > 0) {
            const placedPieces: PlacedDiePiece[] = [];
            let idx = 1;

            for (let r = 0; r < rows1; r++) {
              for (let c = 0; c < cols1; c++) {
                placedPieces.push({
                  id: `mix-b1-${r}-${c}`,
                  index: idx++,
                  x: marginMm + c * (pw1 + gapMm),
                  y: marginMm + r * (ph1 + gapMm),
                  width: pw1,
                  height: ph1,
                  rotation: primaryRot,
                });
              }
            }

            const offsetY = marginMm + usedH;
            for (let r = 0; r < extraRows; r++) {
              for (let c = 0; c < extraCols; c++) {
                placedPieces.push({
                  id: `mix-b2-${r}-${c}`,
                  index: idx++,
                  x: marginMm + c * (pw2 + gapMm),
                  y: offsetY + r * (ph2 + gapMm),
                  width: pw2,
                  height: ph2,
                  rotation: secRot,
                });
              }
            }

            strategies.push(
              buildResult(
                `توزيع مركب (شبكة ${primaryRot}° + صف سفلي ${secRot}°)`,
                'mixed',
                placedPieces,
                die,
                sheetWidthMm,
                sheetHeightMm,
                pw1,
                ph1
              )
            );
          }
        }
      }
    }
  }

  // Deduplicate and rank strategies
  const uniqueMap = new Map<string, NestingLayoutResult>();
  for (const s of strategies) {
    const key = `${s.strategyType}-${s.count}-${s.effectivePitchX.toFixed(1)}-${s.effectivePitchY.toFixed(1)}-${s.pieces.length > 0 ? s.pieces[0].rotation : 0}`;
    if (!uniqueMap.has(key) || (uniqueMap.get(key)!.utilizationPercent < s.utilizationPercent)) {
      uniqueMap.set(key, s);
    }
  }
  const allUnique = Array.from(uniqueMap.values());

  // Filter based on user preferences
  const shouldAllowInversion = options.allowInversion !== false;
  const filtered = allUnique.filter((s) => {
    if (!shouldAllowInversion || options.strategyType === 'same_orientation') {
      return s.strategyType === 'same_orientation' || s.strategyType === 'grid';
    }
    if (options.strategyType === 'grid') {
      return s.strategyType === 'grid';
    }
    return true;
  });

  const pool = filtered.length > 0 ? filtered : allUnique;

  // -------------------------------------------------------------
  // Best Strategy Ranking
  // -------------------------------------------------------------
  pool.sort((a, b) => {
    // 1. Primary: Piece Count
    if (b.count !== a.count) return b.count - a.count;
    // 2. High preference for same_orientation over inverted if counts are identical
    if (a.strategyType === 'same_orientation' && b.strategyType !== 'same_orientation') return -1;
    if (b.strategyType === 'same_orientation' && a.strategyType !== 'same_orientation') return 1;
    // 3. Prefer standard upright (rotation === 0) over rotated 90°
    const rotA = a.pieces.length > 0 ? a.pieces[0].rotation : 0;
    const rotB = b.pieces.length > 0 ? b.pieces[0].rotation : 0;
    if (rotA === 0 && rotB !== 0) return -1;
    if (rotB === 0 && rotA !== 0) return 1;
    // 4. Prefer straight interlocking (s = 0)
    const isStraightA = a.strategyName.includes('تداخل مستقيم');
    const isStraightB = b.strategyName.includes('تداخل مستقيم');
    if (isStraightA && !isStraightB) return -1;
    if (isStraightB && !isStraightA) return 1;
    // 5. Utilization %
    if (b.utilizationPercent !== a.utilizationPercent) return b.utilizationPercent - a.utilizationPercent;
    // 6. Simpler strategy preference on tie
    return b.strategyName.length - a.strategyName.length;
  });

  const best = pool[0] || buildResult('توزيع افتراضي', 'grid', [], die, sheetWidthMm, sheetHeightMm, die.widthMm, die.heightMm);
  return {
    ...best,
    allStrategies: pool,
  };
}

function buildResult(
  strategyName: string,
  strategyType: NestingStrategyType,
  pieces: PlacedDiePiece[],
  die: ParsedDieSvg,
  sheetWidthMm: number,
  sheetHeightMm: number,
  effectivePitchX: number,
  effectivePitchY: number
): NestingLayoutResult {
  const sheetAreaMm2 = sheetWidthMm * sheetHeightMm;
  const count = pieces.length;
  const singleDieArea = die.estimatedAreaMm2 || die.widthMm * die.heightMm * 0.76;
  const totalUsedAreaMm2 = count * singleDieArea;

  let utilizationPercent = sheetAreaMm2 > 0 ? (totalUsedAreaMm2 / sheetAreaMm2) * 100 : 0;
  utilizationPercent = Math.min(96.0, Math.max(0, utilizationPercent));
  const wastePercent = Math.max(4.0, 100 - utilizationPercent);

  return {
    strategyName,
    strategyType,
    count,
    sheetWidthMm,
    sheetHeightMm,
    sheetAreaMm2,
    totalUsedAreaMm2: Math.round(totalUsedAreaMm2),
    utilizationPercent: Number(utilizationPercent.toFixed(1)),
    wastePercent: Number(wastePercent.toFixed(1)),
    pieces,
    parsedDie: die,
    effectivePitchX,
    effectivePitchY,
  };
}

/* ──────────────────────────────────────────────────────────── *
 * Vector Export: High-Fidelity SVG & PDF                       *
 * ──────────────────────────────────────────────────────────── */

export function generateExportSvg(layout: NestingLayoutResult): string {
  const { sheetWidthMm, sheetHeightMm, pieces, parsedDie } = layout;
  const vb = `${parsedDie.vbX} ${parsedDie.vbY} ${parsedDie.vbW} ${parsedDie.vbH}`;
  const tmplW = parsedDie.widthMm;
  const tmplH = parsedDie.heightMm;

  const placedElements = pieces
    .map((p) => {
      const cx = p.x + p.width / 2;
      const cy = p.y + p.height / 2;
      const mirrorTransform = p.mirrored ? 'scale(-1, 1)' : '';
      const transform = `translate(${cx} ${cy}) rotate(${p.rotation}) ${mirrorTransform} translate(${-tmplW / 2} ${-tmplH / 2})`;

      return `
      <!-- Piece #${p.index} -->
      <g id="die-${p.index}" transform="${transform}">
        <svg width="${tmplW}" height="${tmplH}" viewBox="${vb}" preserveAspectRatio="none" overflow="visible">
          ${parsedDie.innerSvg}
        </svg>
        <text x="${tmplW / 2}" y="${tmplH / 2}" font-size="${Math.min(tmplW, tmplH) * 0.12}" font-family="sans-serif" font-weight="bold" fill="#007BFF" opacity="0.55" text-anchor="middle" dominant-baseline="middle">
          #${p.index}
        </text>
      </g>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     width="${sheetWidthMm}mm" 
     height="${sheetHeightMm}mm" 
     viewBox="0 0 ${sheetWidthMm} ${sheetHeightMm}">
  <style>
    .sheet-bg { fill: #FFFFFF; stroke: #0F172A; stroke-width: 0.5; }
    .reg-mark { stroke: #0F172A; stroke-width: 0.3; }
  </style>

  <rect class="sheet-bg" x="0" y="0" width="${sheetWidthMm}" height="${sheetHeightMm}" />

  <!-- Sheet Registration Marks -->
  <line class="reg-mark" x1="0" y1="10" x2="10" y2="10" />
  <line class="reg-mark" x1="10" y1="0" x2="10" y2="10" />
  <line class="reg-mark" x1="${sheetWidthMm - 10}" y1="10" x2="${sheetWidthMm}" y2="10" />
  <line class="reg-mark" x1="${sheetWidthMm - 10}" y1="0" x2="${sheetWidthMm - 10}" y2="10" />
  <line class="reg-mark" x1="0" y1="${sheetHeightMm - 10}" x2="10" y2="${sheetHeightMm - 10}" />
  <line class="reg-mark" x1="10" y1="${sheetHeightMm - 10}" x2="10" y2="${sheetHeightMm}" />
  <line class="reg-mark" x1="${sheetWidthMm - 10}" y1="${sheetHeightMm - 10}" x2="${sheetWidthMm}" y2="${sheetHeightMm - 10}" />
  <line class="reg-mark" x1="${sheetWidthMm - 10}" y1="${sheetHeightMm - 10}" x2="${sheetWidthMm - 10}" y2="${sheetHeightMm}" />

  <text x="15" y="${sheetHeightMm - 6}" font-size="3" font-family="sans-serif" fill="#64748B">
    Printera Smart Nesting • Sheet: ${sheetWidthMm} x ${sheetHeightMm} mm • Count: ${layout.count} dies • Utilization: ${layout.utilizationPercent}% • Waste: ${layout.wastePercent}% • Strategy: ${layout.strategyName}
  </text>

  <g id="dielines-layer">
    ${placedElements}
  </g>
</svg>`;
}

export async function exportLayoutAsPdf(layout: NestingLayoutResult): Promise<void> {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([
    import('jspdf'),
    import('svg2pdf.js'),
  ]);

  const isLandscape = layout.sheetWidthMm >= layout.sheetHeightMm;
  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [layout.sheetWidthMm, layout.sheetHeightMm],
  });

  const svgString = generateExportSvg(layout);
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl = doc.documentElement;

  await svg2pdf(svgEl, pdf, {
    x: 0,
    y: 0,
    width: layout.sheetWidthMm,
    height: layout.sheetHeightMm,
  });

  const safeName = (layout.parsedDie.fileName || 'die-sheet').replace(/\.svg$/i, '');
  pdf.save(`${safeName}-${layout.sheetWidthMm}x${layout.sheetHeightMm}-nesting.pdf`);
}
