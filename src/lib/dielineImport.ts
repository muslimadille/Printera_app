/**
 * Dieline Import Engine — SVG only
 * ─────────────────────────────────
 * Parses a designer-supplied die-line SVG and extracts
 *  • the bounding box (final piece size in cm)
 *  • cut lines (solid strokes)
 *  • crease/fold lines (dashed strokes)
 *  • a normalised SVG preview that can be rendered inside the sheet
 *
 * Why SVG only?
 *  PDF / AI files store cut & crease geometry inside compressed PostScript
 *  streams — extracting them reliably in the browser requires a full PDF
 *  rasterizer + PostScript interpreter and still loses spot-color metadata.
 *  SVG, exported from Illustrator (File → Export → SVG), preserves every
 *  vector path with its stroke attributes intact, so we can read the design
 *  with 100% accuracy and zero extra dependencies.
 *
 * All output coordinates are in **centimetres** with origin top-left to
 * match the rest of the sheet-layout system.
 */

export interface DielineLine {
  type: 'cut' | 'crease';
  /** Polyline points in cm, relative to dieline top-left */
  points: { x: number; y: number }[];
}

export interface ParsedDieline {
  /** Width in cm */
  width: number;
  /** Height in cm */
  height: number;
  /** Original source format */
  format: 'svg';
  /** Extracted lines (best-effort) */
  lines: DielineLine[];
  /** Self-contained SVG markup (viewBox in cm) for preview rendering */
  svgMarkup: string;
  /** Original filename */
  fileName: string;
  /** Concave-polygon representation of the cut outline (cm coords).
   *  Built lazily by buildDielineShape() — see dielineGeometry.ts. */
  shape?: import('./dielineGeometry').DielineShape;
}

const PT_TO_CM = 2.54 / 72;
const MM_TO_CM = 0.1;
const IN_TO_CM = 2.54;
const PX_TO_CM = 2.54 / 96;

const parseUnitToCm = (raw: string | null | undefined, fallbackPx = true): number => {
  if (!raw) return 0;
  const s = String(raw).trim();
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*(mm|cm|in|pt|px)?$/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const u = (m[2] || (fallbackPx ? 'px' : '')).toLowerCase();
  switch (u) {
    case 'cm': return n;
    case 'mm': return n * MM_TO_CM;
    case 'in': return n * IN_TO_CM;
    case 'pt': return n * PT_TO_CM;
    case 'px': return n * PX_TO_CM;
    default: return n * PX_TO_CM;
  }
};

/* ═══════════════════════════════════════════════════════════════════════
 * SVG parsing
 * ═══════════════════════════════════════════════════════════════════════ */
const isDashed = (el: Element): boolean => {
  const da = el.getAttribute('stroke-dasharray');
  if (da && da !== 'none' && da.trim() !== '0') return true;
  const style = el.getAttribute('style') || '';
  const m = style.match(/stroke-dasharray\s*:\s*([^;]+)/i);
  if (m && m[1].trim() && m[1].trim().toLowerCase() !== 'none' && m[1].trim() !== '0') return true;
  return false;
};

const parseSvg = async (file: File): Promise<ParsedDieline> => {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) throw new Error('ملف SVG غير صالح أو تالف');
  const svg = doc.documentElement;
  if (!svg || svg.tagName.toLowerCase() !== 'svg') throw new Error('لم يتم العثور على وسم <svg> داخل الملف');

  // Read viewBox first (needed to disambiguate units when width/height are unitless)
  const viewBox = svg.getAttribute('viewBox');
  let vbW = 0, vbH = 0;
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      vbW = parts[2];
      vbH = parts[3];
    }
  }

  // Read width/height — if they have an explicit unit (mm/cm/in/pt/px) trust them.
  // Otherwise, infer the unit from context: Illustrator exports unitless numbers
  // that match the viewBox in **points** (pt), NOT pixels.
  const wAttr = svg.getAttribute('width');
  const hAttr = svg.getAttribute('height');
  const hasUnit = (s: string | null) => !!s && /(mm|cm|in|pt|px)\s*$/i.test(s);

  let widthCm = 0, heightCm = 0;
  if (hasUnit(wAttr) && hasUnit(hAttr)) {
    widthCm = parseUnitToCm(wAttr);
    heightCm = parseUnitToCm(hAttr);
  } else if (vbW > 0 && vbH > 0) {
    // Illustrator default: viewBox numbers represent points
    widthCm = vbW * PT_TO_CM;
    heightCm = vbH * PT_TO_CM;
  } else if (wAttr && hAttr) {
    // Last-resort fallback: assume pixels
    widthCm = parseUnitToCm(wAttr);
    heightCm = parseUnitToCm(hAttr);
  }

  if (!widthCm || !heightCm) {
    throw new Error('تعذر تحديد مقاس القالب — تأكد أن SVG يحتوي على width / height أو viewBox');
  }

  // Sanity check: dielines for printed packaging are typically 1cm – 200cm.
  // If we ended up outside that range, retry with the alternate interpretation.
  if (widthCm > 500 || heightCm > 500) {
    // Probably misread points as pixels — recompute with pt assumption
    if (vbW > 0 && vbH > 0) {
      widthCm = vbW * PT_TO_CM;
      heightCm = vbH * PT_TO_CM;
    }
  } else if (widthCm < 0.5 && heightCm < 0.5 && vbW > 0) {
    // Probably treated mm as cm — fall back to viewBox in pt
    widthCm = vbW * PT_TO_CM;
    heightCm = vbH * PT_TO_CM;
  }

  // Extract lines for stats (best-effort; covers the most common dieline shapes)
  const lines: DielineLine[] = [];
  const scaleX = vbW > 0 ? widthCm / vbW : PT_TO_CM;
  const scaleY = vbH > 0 ? heightCm / vbH : PT_TO_CM;

  doc.querySelectorAll('line, polyline, polygon, rect, path, circle, ellipse').forEach((el) => {
    const type: DielineLine['type'] = isDashed(el) ? 'crease' : 'cut';
    const tag = el.tagName.toLowerCase();
    let pts: { x: number; y: number }[] = [];

    if (tag === 'line') {
      pts = [
        { x: parseFloat(el.getAttribute('x1') || '0') * scaleX, y: parseFloat(el.getAttribute('y1') || '0') * scaleY },
        { x: parseFloat(el.getAttribute('x2') || '0') * scaleX, y: parseFloat(el.getAttribute('y2') || '0') * scaleY },
      ];
    } else if (tag === 'polyline' || tag === 'polygon') {
      const raw = el.getAttribute('points') || '';
      pts = raw.trim().split(/\s+/).map((pair) => {
        const [x, y] = pair.split(',').map(Number);
        return { x: (x || 0) * scaleX, y: (y || 0) * scaleY };
      });
      if (tag === 'polygon' && pts.length > 0) pts.push(pts[0]);
    } else if (tag === 'rect') {
      const x = parseFloat(el.getAttribute('x') || '0') * scaleX;
      const y = parseFloat(el.getAttribute('y') || '0') * scaleY;
      const w = parseFloat(el.getAttribute('width') || '0') * scaleX;
      const h = parseFloat(el.getAttribute('height') || '0') * scaleY;
      pts = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y }];
    } else if (tag === 'path' || tag === 'circle' || tag === 'ellipse') {
      // Counted but full geometry preserved in svgMarkup
      pts = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    }

    if (pts.length >= 2) lines.push({ type, points: pts });
  });

  // Build a normalised preview SVG. Keep the original viewBox so embedded
  // coordinates render correctly when the markup is dropped into another <svg>.
  const innerHtml = svg.innerHTML;
  const vb = vbW && vbH ? `0 0 ${vbW} ${vbH}` : `0 0 ${widthCm} ${heightCm}`;
  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" preserveAspectRatio="xMidYMid meet">${innerHtml}</svg>`;

  // Build the shape (concave polygon) — used for shape-based collision & nesting.
  // Done synchronously here so consumers always receive a ready-to-use shape.
  let shape: import('./dielineGeometry').DielineShape | undefined;
  try {
    const { buildDielineShape } = await import('./dielineGeometry');
    shape = buildDielineShape(svgMarkup, widthCm, heightCm);
  } catch {
    /* if shape extraction fails we still return the dieline; consumers fall back to bbox */
  }

  return {
    width: widthCm,
    height: heightCm,
    format: 'svg',
    lines,
    svgMarkup,
    fileName: file.name,
    shape,
  };
};

/* ═══════════════════════════════════════════════════════════════════════
 * Public entry point — SVG only
 * ═══════════════════════════════════════════════════════════════════════ */
export const parseDielineFile = async (file: File): Promise<ParsedDieline> => {
  const name = file.name.toLowerCase();
  const ext = name.split('.').pop() || '';
  if (ext === 'svg' || file.type === 'image/svg+xml') return parseSvg(file);
  throw new Error(
    'الصيغة غير مدعومة — يرجى تصدير القالب من Illustrator بصيغة SVG (File → Export → SVG) للحصول على دقة 100%'
  );
};
