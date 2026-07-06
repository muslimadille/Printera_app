/**
 * Dieline Geometry — Polygon extraction & Shape-based collision
 * ─────────────────────────────────────────────────────────────
 * Converts the SVG paths of an imported dieline into one or more closed
 * polygons in centimetres, then provides:
 *   • a *full* polygon for accurate collision / export
 *   • a *simplified* polygon (Douglas-Peucker) for smooth real-time dragging
 *   • shape-vs-shape collision (concave polygon SAT-style edge intersection
 *     + point-in-polygon containment)
 *   • boolean polygon intersection via Clipper (used for precise overlap shading)
 *   • bounding box helpers that respect the actual outline (not the SVG viewBox)
 *
 * All polygons are arrays of {x, y} points in cm, relative to the dieline's
 * own top-left corner. The first polygon is treated as the *outer outline*;
 * subsequent polygons are interior cut-outs (holes / windows / die-cut handles).
 */

import ClipperLib from '@doodle3d/clipper-lib';

export interface Pt { x: number; y: number; }
export type Polygon = Pt[]; // closed; last point need NOT equal first

export interface DielineShape {
  /** Outer outline + any interior holes (each a closed polygon, cm coords) */
  rings: Polygon[];
  /** Cached axis-aligned bounding box of the outer ring */
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  /** Original outline width / height (cm) — derived from bbox */
  width: number;
  height: number;
  /** Lower-resolution copy of `rings` for real-time drag collision */
  ringsSimplified: Polygon[];
}

/* ════════════════════════════════════════════════════════════════════════
 * 1. SVG → flat polylines
 *    Walks every `path`, `polyline`, `polygon`, `rect`, `line`, `ellipse`,
 *    `circle` element and flattens curves into line segments.
 * ════════════════════════════════════════════════════════════════════════ */

const FLATTEN_STEPS = 24; // segments per Bezier curve

function flattenPath(d: string): Polygon[] {
  // Minimal SVG path parser supporting M, L, H, V, Z, C, S, Q, T, A (A is approx).
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  const rings: Polygon[] = [];
  let current: Polygon = [];
  let cx = 0, cy = 0; // current point
  let sx = 0, sy = 0; // subpath start
  let prevCtrl: Pt | null = null;
  let cmd = '';
  let i = 0;

  const num = () => parseFloat(tokens[i++]);
  const rel = (c: string) => c === c.toLowerCase();

  const closeSubpath = () => {
    if (current.length > 1) rings.push(current);
    current = [];
    prevCtrl = null;
  };

  const cubic = (p0: Pt, c1: Pt, c2: Pt, p1: Pt) => {
    for (let s = 1; s <= FLATTEN_STEPS; s++) {
      const t = s / FLATTEN_STEPS;
      const u = 1 - t;
      const x = u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x;
      const y = u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y;
      current.push({ x, y });
    }
  };
  const quad = (p0: Pt, c: Pt, p1: Pt) => {
    for (let s = 1; s <= FLATTEN_STEPS; s++) {
      const t = s / FLATTEN_STEPS;
      const u = 1 - t;
      const x = u * u * p0.x + 2 * u * t * c.x + t * t * p1.x;
      const y = u * u * p0.y + 2 * u * t * c.y + t * t * p1.y;
      current.push({ x, y });
    }
  };

  while (i < tokens.length) {
    const t = tokens[i];
    if (/[a-zA-Z]/.test(t)) { cmd = t; i++; }
    const isRel = rel(cmd);
    const c = cmd.toUpperCase();

    if (c === 'M') {
      const x = num() + (isRel ? cx : 0);
      const y = num() + (isRel ? cy : 0);
      if (current.length > 0) closeSubpath();
      current.push({ x, y });
      cx = x; cy = y; sx = x; sy = y;
      prevCtrl = null;
      cmd = isRel ? 'l' : 'L';
    } else if (c === 'L') {
      const x = num() + (isRel ? cx : 0);
      const y = num() + (isRel ? cy : 0);
      current.push({ x, y });
      cx = x; cy = y; prevCtrl = null;
    } else if (c === 'H') {
      const x = num() + (isRel ? cx : 0);
      current.push({ x, y: cy });
      cx = x; prevCtrl = null;
    } else if (c === 'V') {
      const y = num() + (isRel ? cy : 0);
      current.push({ x: cx, y });
      cy = y; prevCtrl = null;
    } else if (c === 'C') {
      const c1 = { x: num() + (isRel ? cx : 0), y: num() + (isRel ? cy : 0) };
      const c2 = { x: num() + (isRel ? cx : 0), y: num() + (isRel ? cy : 0) };
      const p1 = { x: num() + (isRel ? cx : 0), y: num() + (isRel ? cy : 0) };
      cubic({ x: cx, y: cy }, c1, c2, p1);
      cx = p1.x; cy = p1.y; prevCtrl = c2;
    } else if (c === 'S') {
      const c1 = prevCtrl ? { x: 2 * cx - prevCtrl.x, y: 2 * cy - prevCtrl.y } : { x: cx, y: cy };
      const c2 = { x: num() + (isRel ? cx : 0), y: num() + (isRel ? cy : 0) };
      const p1 = { x: num() + (isRel ? cx : 0), y: num() + (isRel ? cy : 0) };
      cubic({ x: cx, y: cy }, c1, c2, p1);
      cx = p1.x; cy = p1.y; prevCtrl = c2;
    } else if (c === 'Q') {
      const cp = { x: num() + (isRel ? cx : 0), y: num() + (isRel ? cy : 0) };
      const p1 = { x: num() + (isRel ? cx : 0), y: num() + (isRel ? cy : 0) };
      quad({ x: cx, y: cy }, cp, p1);
      cx = p1.x; cy = p1.y; prevCtrl = cp;
    } else if (c === 'T') {
      const cp = prevCtrl ? { x: 2 * cx - prevCtrl.x, y: 2 * cy - prevCtrl.y } : { x: cx, y: cy };
      const p1 = { x: num() + (isRel ? cx : 0), y: num() + (isRel ? cy : 0) };
      quad({ x: cx, y: cy }, cp, p1);
      cx = p1.x; cy = p1.y; prevCtrl = cp;
    } else if (c === 'A') {
      // Approximate: skip arc params, treat as a straight line to endpoint.
      num(); num(); num(); num(); num();
      const x = num() + (isRel ? cx : 0);
      const y = num() + (isRel ? cy : 0);
      current.push({ x, y });
      cx = x; cy = y; prevCtrl = null;
    } else if (c === 'Z') {
      if (current.length > 0) {
        // Close back to subpath start
        if (current[0].x !== cx || current[0].y !== cy) {
          current.push({ x: sx, y: sy });
        }
        closeSubpath();
      }
      cx = sx; cy = sy; prevCtrl = null;
    } else {
      // Unknown command — skip token to avoid infinite loop
      i++;
    }
  }
  if (current.length > 0) closeSubpath();
  return rings;
}

/* ════════════════════════════════════════════════════════════════════════
 * 2. Build a DielineShape from a parsed SVG markup (already in cm-aligned viewBox)
 *    The svgMarkup we get from dielineImport.ts has its viewBox set so that
 *    a unit step ≈ 1 unit of the original SVG. We need to scale to cm.
 * ════════════════════════════════════════════════════════════════════════ */

const PT_TO_CM = 2.54 / 72;

export function buildDielineShape(svgMarkup: string, widthCm: number, heightCm: number): DielineShape {
  // Wrap the markup in a DOM document for easy querying
  const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
  const root = doc.documentElement;
  const vbAttr = root.getAttribute('viewBox') || `0 0 ${widthCm} ${heightCm}`;
  const [vbX, vbY, vbW, vbH] = vbAttr.split(/[\s,]+/).map(Number);
  // Scale: if the viewBox already corresponds to cm (vbW ≈ widthCm) the scale is 1,
  // but SVGs from Illustrator usually carry a viewBox in *points*. We map vb→cm via widthCm/vbW.
  const sx = widthCm / (vbW || 1);
  const sy = heightCm / (vbH || 1);

  const rawRings: Polygon[] = [];

  // Solid path-like elements that contribute to the cut outline
  doc.querySelectorAll('path').forEach((el) => {
    if (isDashed(el)) return; // crease lines don't define the outer cut
    const d = el.getAttribute('d');
    if (d) flattenPath(d).forEach((r) => rawRings.push(r));
  });
  doc.querySelectorAll('polygon, polyline').forEach((el) => {
    if (isDashed(el)) return;
    const raw = el.getAttribute('points') || '';
    const pts = raw.trim().split(/\s+/).map((pair) => {
      const [x, y] = pair.split(',').map(Number);
      return { x: x || 0, y: y || 0 };
    });
    if (pts.length >= 2) rawRings.push(pts);
  });
  doc.querySelectorAll('rect').forEach((el) => {
    if (isDashed(el)) return;
    const x = parseFloat(el.getAttribute('x') || '0');
    const y = parseFloat(el.getAttribute('y') || '0');
    const w = parseFloat(el.getAttribute('width') || '0');
    const h = parseFloat(el.getAttribute('height') || '0');
    rawRings.push([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]);
  });

  // Translate by viewBox origin and scale to cm
  const rings: Polygon[] = rawRings.map((r) => r.map((p) => ({
    x: (p.x - vbX) * sx,
    y: (p.y - vbY) * sy,
  })));

  // Fallback: if nothing was parsed, use the bounding rectangle as the shape
  if (rings.length === 0) {
    rings.push([{ x: 0, y: 0 }, { x: widthCm, y: 0 }, { x: widthCm, y: heightCm }, { x: 0, y: heightCm }]);
  }

  // Sort by polygon area descending so the outer ring comes first
  rings.sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));

  const bb = bboxOf(rings[0]);

  return {
    rings,
    bbox: bb,
    width: bb.maxX - bb.minX || widthCm,
    height: bb.maxY - bb.minY || heightCm,
    ringsSimplified: rings.map((r) => simplifyPolygon(r, Math.max(0.05, Math.min(widthCm, heightCm) * 0.005))),
  };
}

function isDashed(el: Element): boolean {
  const da = el.getAttribute('stroke-dasharray');
  if (da && da !== 'none' && da.trim() !== '0') return true;
  const style = el.getAttribute('style') || '';
  const m = style.match(/stroke-dasharray\s*:\s*([^;]+)/i);
  return !!(m && m[1].trim() && m[1].trim().toLowerCase() !== 'none' && m[1].trim() !== '0');
}

/* ════════════════════════════════════════════════════════════════════════
 * 3. Polygon utilities — area, bbox, simplification, transforms
 * ════════════════════════════════════════════════════════════════════════ */

export function polygonArea(poly: Polygon): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  }
  return a / 2;
}

export function bboxOf(poly: Polygon) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

/** Douglas-Peucker simplification — preserves silhouette while shedding noise. */
export function simplifyPolygon(poly: Polygon, tolerance: number): Polygon {
  if (poly.length < 4) return poly;
  const sqTol = tolerance * tolerance;
  const keep = new Array(poly.length).fill(false);
  keep[0] = keep[poly.length - 1] = true;
  const stack: [number, number][] = [[0, poly.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let maxD = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = sqSegDist(poly[i], poly[a], poly[b]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > sqTol && idx !== -1) {
      keep[idx] = true;
      stack.push([a, idx], [idx, b]);
    }
  }
  return poly.filter((_, i) => keep[i]);
}

function sqSegDist(p: Pt, a: Pt, b: Pt): number {
  let x = a.x, y = a.y;
  let dx = b.x - x, dy = b.y - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = b.x; y = b.y; }
    else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = p.x - x; dy = p.y - y;
  return dx * dx + dy * dy;
}

/** Translate every point of every ring (used to position a piece on the sheet). */
export function translateRings(rings: Polygon[], dx: number, dy: number): Polygon[] {
  return rings.map((r) => r.map((p) => ({ x: p.x + dx, y: p.y + dy })));
}

/** Rotate every point 90° clockwise around (w/2, h/2) — used when a piece is flagged rotated. */
export function rotateRings90(rings: Polygon[], w: number, h: number): Polygon[] {
  return rings.map((r) => r.map((p) => ({ x: h - p.y, y: p.x })));
}

/* ════════════════════════════════════════════════════════════════════════
 * 4. Shape-vs-shape collision
 *    Returns true if any ring of A overlaps any ring of B. Uses two cheap tests:
 *      a) bounding-box reject
 *      b) edge-edge intersection
 *      c) point-in-polygon (one vertex of each inside the other)
 * ════════════════════════════════════════════════════════════════════════ */

export function shapesOverlap(aRings: Polygon[], bRings: Polygon[], gap = 0): boolean {
  if (aRings.length === 0 || bRings.length === 0) return false;
  const aBB = bboxOf(aRings[0]);
  const bBB = bboxOf(bRings[0]);
  if (aBB.maxX + gap <= bBB.minX || bBB.maxX + gap <= aBB.minX) return false;
  if (aBB.maxY + gap <= bBB.minY || bBB.maxY + gap <= aBB.minY) return false;

  const aOuter = aRings[0];
  const bOuter = bRings[0];

  // Edge-edge intersection
  for (let i = 0, ai = aOuter.length - 1; i < aOuter.length; ai = i++) {
    for (let j = 0, bj = bOuter.length - 1; j < bOuter.length; bj = j++) {
      if (segmentsIntersect(aOuter[ai], aOuter[i], bOuter[bj], bOuter[j])) return true;
    }
  }

  // Containment: one ring fully inside the other (no edge crosses)
  if (pointInPolygon(aOuter[0], bOuter)) return true;
  if (pointInPolygon(bOuter[0], aOuter)) return true;

  return false;
}

function segmentsIntersect(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const det = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (det === 0) return false;
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / det;
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / det;
  return t > 0 && t < 1 && u > 0 && u < 1;
}

export function pointInPolygon(p: Pt, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > p.y) !== (yj > p.y))
      && (p.x < ((xj - xi) * (p.y - yi)) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/** True if the entire shape (all outer ring vertices) is inside the [0..sheetW] × [0..sheetH] sheet. */
export function shapeInsideSheet(rings: Polygon[], sheetW: number, sheetH: number, tol = 0.01): boolean {
  if (rings.length === 0) return true;
  const outer = rings[0];
  for (const p of outer) {
    if (p.x < -tol || p.y < -tol || p.x > sheetW + tol || p.y > sheetH + tol) return false;
  }
  return true;
}

/* ════════════════════════════════════════════════════════════════════════
 * 5. Boolean polygon intersection (via Clipper)
 *    Returns the actual overlap region(s) between two shapes, as one or
 *    more closed polygons in cm. Used for *precise* visual overlap shading
 *    so what the user sees matches the real collision geometry.
 * ════════════════════════════════════════════════════════════════════════ */

const INTERSECT_SCALE = 1000; // sub-mm precision (cm × 1000 → integer)

export function polygonIntersection(aRings: Polygon[], bRings: Polygon[]): Polygon[] {
  if (aRings.length === 0 || bRings.length === 0) return [];
  // Quick bbox reject — saves ~10× on the common "no overlap" path
  const aBB = bboxOf(aRings[0]);
  const bBB = bboxOf(bRings[0]);
  if (aBB.maxX <= bBB.minX || bBB.maxX <= aBB.minX) return [];
  if (aBB.maxY <= bBB.minY || bBB.maxY <= aBB.minY) return [];

  const toInt = (rings: Polygon[]) =>
    rings.map((r) => r.map((p) => ({
      X: Math.round(p.x * INTERSECT_SCALE),
      Y: Math.round(p.y * INTERSECT_SCALE),
    })));

  try {
    const clipper = new ClipperLib.Clipper();
    clipper.AddPaths(toInt(aRings), ClipperLib.PolyType.ptSubject, true);
    clipper.AddPaths(toInt(bRings), ClipperLib.PolyType.ptClip, true);
    const solution: { X: number; Y: number }[][] = [];
    const ok = clipper.Execute(
      ClipperLib.ClipType.ctIntersection,
      solution,
      ClipperLib.PolyFillType.pftNonZero,
      ClipperLib.PolyFillType.pftNonZero,
    );
    if (!ok || solution.length === 0) return [];
    return solution.map((path) =>
      path.map((p) => ({ x: p.X / INTERSECT_SCALE, y: p.Y / INTERSECT_SCALE })),
    );
  } catch {
    return [];
  }
}

/** Convert a polygon to an SVG path `d` attribute (closed). */
export function polygonToSvgPath(poly: Polygon): string {
  if (poly.length === 0) return '';
  let d = `M ${poly[0].x} ${poly[0].y}`;
  for (let i = 1; i < poly.length; i++) d += ` L ${poly[i].x} ${poly[i].y}`;
  return d + ' Z';
}

/** Convert all rings (outer + holes) into a single SVG `d` attribute. */
export function ringsToSvgPath(rings: Polygon[]): string {
  return rings.map((r) => polygonToSvgPath(r)).filter(Boolean).join(' ');
}
