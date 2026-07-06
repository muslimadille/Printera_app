/**
 * Box > Die Cut — Final-Geometry Flattened Export
 * ---------------------------------------------------------------
 * Philosophy (matches Carrying Handle Box): Export === Preview Final
 * Geometry. NOTHING is sliced via <clipPath>, no <use>, no <symbol>,
 * no nested <svg>, no <foreignObject>, no per-piece <image>, no CSS,
 * no scripts.
 *
 * Pipeline:
 *   1. Parse the source dieline SVG once → list of plain polylines
 *      (cubics / quads / arcs are flattened, classes resolved to
 *      stroke + width).
 *   2. For every placed piece × every preview tile (V4Tile from the
 *      engine) we clip each polyline segment against the tile's
 *      SOURCE rect and map it linearly into the tile's TARGET rect.
 *      That bakes the stretch math into absolute coordinates.
 *   3. Each piece becomes <g id="piece-N" transform="translate(...) rotate(90)?">
 *      containing only <line>/<polyline> elements with FINAL coords
 *      in piece-local mm. Per-piece transforms are restricted to
 *      pure translate (+ optional rotate(90)).
 *
 * Output opens cleanly in Adobe Illustrator with zero conversion.
 */

import {
  buildPreviewTiles,
  type DieCutResult,
  type DieCutInputs,
  type V4Tile,
} from './dieCutEngine';

export type BoxDieCutExportMode = 'svg-only';

export interface BoxDieCutExportOptions {
  mode?: BoxDieCutExportMode;
  inputs: DieCutInputs;
  result: DieCutResult;
  pieceSvg: string;
  templateName?: string;
}

/* ───────────────────────── helpers ───────────────────────── */

type Pt = { x: number; y: number };
type Poly = { pts: Pt[]; closed: boolean; stroke: string; width: number };

function readAttr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? m[1] : undefined;
}

function parseClassStyles(svg: string): Record<string, { stroke: string; width: number }> {
  const map: Record<string, { stroke: string; width: number }> = {};
  for (const sm of svg.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    const body = sm[1];
    for (const m of body.matchAll(/\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g)) {
      const cls = m[1];
      const decl = m[2];
      const sM = decl.match(/(?:^|[^-])stroke\s*:\s*([^;]+)/i);
      const wM = decl.match(/stroke-width\s*:\s*([\d.]+)/i);
      map[cls] = {
        stroke: sM ? sM[1].trim() : '#000000',
        width: wM ? parseFloat(wM[1]) : 0.25,
      };
    }
  }
  return map;
}

/* ── Path flattener (M L H V C S Q T A Z, abs+rel) ── */
function flattenPath(d: string): { pts: Pt[]; closed: boolean }[] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) || [];
  let i = 0;
  const num = () => parseFloat(tokens[i++]);
  const subs: { pts: Pt[]; closed: boolean }[] = [];
  let cur: Pt = { x: 0, y: 0 };
  let start: Pt = { x: 0, y: 0 };
  let lastCtrl: Pt | null = null;
  let lastCmd = '';
  let pts: Pt[] = [];

  const flushOpen = () => { if (pts.length > 1) subs.push({ pts, closed: false }); pts = []; };

  const cubic = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, steps = 18) => {
    for (let s = 1; s <= steps; s++) {
      const t = s / steps, mt = 1 - t;
      pts.push({
        x: mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x,
        y: mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y,
      });
    }
  };
  const quad = (p0: Pt, p1: Pt, p2: Pt, steps = 14) => {
    for (let s = 1; s <= steps; s++) {
      const t = s / steps, mt = 1 - t;
      pts.push({
        x: mt*mt*p0.x + 2*mt*t*p1.x + t*t*p2.x,
        y: mt*mt*p0.y + 2*mt*t*p1.y + t*t*p2.y,
      });
    }
  };
  const arc = (p0: Pt, rxIn: number, ryIn: number, xRot: number,
               largeArc: number, sweep: number, p1: Pt, steps = 30) => {
    let rx = Math.abs(rxIn), ry = Math.abs(ryIn);
    if (rx === 0 || ry === 0) { pts.push(p1); return; }
    const rad = xRot * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const dx = (p0.x - p1.x) / 2, dy = (p0.y - p1.y) / 2;
    const x1p = cos*dx + sin*dy, y1p = -sin*dx + cos*dy;
    const lam = (x1p*x1p)/(rx*rx) + (y1p*y1p)/(ry*ry);
    if (lam > 1) { const s = Math.sqrt(lam); rx*=s; ry*=s; }
    const rxs = rx*rx, rys = ry*ry;
    let sq = (rxs*rys - rxs*y1p*y1p - rys*x1p*x1p) / (rxs*y1p*y1p + rys*x1p*x1p);
    sq = Math.max(0, sq);
    const sign = (largeArc !== sweep) ? 1 : -1;
    const coef = sign * Math.sqrt(sq);
    const cxp = coef * (rx*y1p)/ry;
    const cyp = coef * -(ry*x1p)/rx;
    const cx = cos*cxp - sin*cyp + (p0.x + p1.x)/2;
    const cy = sin*cxp + cos*cyp + (p0.y + p1.y)/2;
    const ang = (ux: number, uy: number, vx: number, vy: number) => {
      const d2 = Math.sqrt((ux*ux+uy*uy)*(vx*vx+vy*vy)) || 1;
      let c = (ux*vx+uy*vy)/d2; c = Math.min(1, Math.max(-1, c));
      const a = Math.acos(c);
      return (ux*vy - uy*vx < 0) ? -a : a;
    };
    const theta1 = ang(1, 0, (x1p - cxp)/rx, (y1p - cyp)/ry);
    let dTheta = ang((x1p - cxp)/rx, (y1p - cyp)/ry, (-x1p - cxp)/rx, (-y1p - cyp)/ry);
    if (!sweep && dTheta > 0) dTheta -= 2*Math.PI;
    if (sweep && dTheta < 0) dTheta += 2*Math.PI;
    for (let s = 1; s <= steps; s++) {
      const t = theta1 + dTheta * s / steps;
      const xt = cos*rx*Math.cos(t) - sin*ry*Math.sin(t) + cx;
      const yt = sin*rx*Math.cos(t) + cos*ry*Math.sin(t) + cy;
      pts.push({ x: xt, y: yt });
    }
  };

  while (i < tokens.length) {
    const t = tokens[i];
    let cmd: string;
    if (/[a-zA-Z]/.test(t)) { cmd = t; i++; }
    else cmd = lastCmd === 'M' ? 'L' : lastCmd === 'm' ? 'l' : lastCmd;
    lastCmd = cmd;
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const rx = (v: number) => rel ? cur.x + v : v;
    const ry = (v: number) => rel ? cur.y + v : v;
    if (C === 'M') {
      flushOpen();
      const x = rx(num()), y = ry(num());
      cur = { x, y }; start = { ...cur }; pts.push({ ...cur });
      lastCmd = rel ? 'l' : 'L';
    } else if (C === 'L') {
      const x = rx(num()), y = ry(num());
      cur = { x, y }; pts.push({ ...cur });
    } else if (C === 'H') {
      const x = rel ? cur.x + num() : num();
      cur = { x, y: cur.y }; pts.push({ ...cur });
    } else if (C === 'V') {
      const y = rel ? cur.y + num() : num();
      cur = { x: cur.x, y }; pts.push({ ...cur });
    } else if (C === 'C') {
      const p1 = { x: rx(num()), y: ry(num()) };
      const p2 = { x: rx(num()), y: ry(num()) };
      const p3 = { x: rx(num()), y: ry(num()) };
      cubic(cur, p1, p2, p3);
      lastCtrl = p2; cur = p3;
    } else if (C === 'S') {
      const p1 = lastCtrl ? { x: 2*cur.x - lastCtrl.x, y: 2*cur.y - lastCtrl.y } : { ...cur };
      const p2 = { x: rx(num()), y: ry(num()) };
      const p3 = { x: rx(num()), y: ry(num()) };
      cubic(cur, p1, p2, p3);
      lastCtrl = p2; cur = p3;
    } else if (C === 'Q') {
      const p1 = { x: rx(num()), y: ry(num()) };
      const p2 = { x: rx(num()), y: ry(num()) };
      quad(cur, p1, p2);
      lastCtrl = p1; cur = p2;
    } else if (C === 'T') {
      const p1 = lastCtrl ? { x: 2*cur.x - lastCtrl.x, y: 2*cur.y - lastCtrl.y } : { ...cur };
      const p2 = { x: rx(num()), y: ry(num()) };
      quad(cur, p1, p2);
      lastCtrl = p1; cur = p2;
    } else if (C === 'A') {
      const rxA = num(), ryA = num(), xRot = num();
      const large = num(), sweep = num();
      const p1 = { x: rx(num()), y: ry(num()) };
      arc(cur, rxA, ryA, xRot, large, sweep, p1);
      cur = p1; lastCtrl = null;
    } else if (C === 'Z') {
      if (pts.length > 1) {
        pts.push({ ...start });
        subs.push({ pts, closed: true });
      }
      pts = [];
      cur = { ...start };
      lastCtrl = null;
    }
    if (C !== 'C' && C !== 'S' && C !== 'Q' && C !== 'T') lastCtrl = null;
  }
  flushOpen();
  return subs;
}

function parseSourceGeometry(svg: string): Poly[] {
  if (!svg) return [];
  const styles = parseClassStyles(svg);
  const polys: Poly[] = [];
  const resolve = (cls?: string, stroke?: string, w?: string) => {
    let s = '#000000', wd = 0.25;
    if (cls) {
      for (const c of cls.split(/\s+/)) if (styles[c]) { s = styles[c].stroke; wd = styles[c].width; }
    }
    if (stroke && stroke !== 'none') s = stroke;
    if (w) wd = parseFloat(w);
    return { stroke: s, width: wd };
  };

  for (const m of svg.matchAll(/<line\b([^/>]*)\/?>/gi)) {
    const tag = m[0];
    const x1 = parseFloat(readAttr(tag, 'x1') ?? '0');
    const y1 = parseFloat(readAttr(tag, 'y1') ?? '0');
    const x2 = parseFloat(readAttr(tag, 'x2') ?? '0');
    const y2 = parseFloat(readAttr(tag, 'y2') ?? '0');
    const c = resolve(readAttr(tag, 'class'), readAttr(tag, 'stroke'), readAttr(tag, 'stroke-width'));
    polys.push({ pts: [{x:x1,y:y1},{x:x2,y:y2}], closed: false, stroke: c.stroke, width: c.width });
  }
  for (const m of svg.matchAll(/<(polyline|polygon)\b([^/>]*)\/?>/gi)) {
    const tag = m[0];
    const isPoly = m[1].toLowerCase() === 'polygon';
    const pStr = readAttr(tag, 'points') ?? '';
    const nums = pStr.match(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g)?.map(Number) ?? [];
    const pts: Pt[] = [];
    for (let k = 0; k + 1 < nums.length; k += 2) pts.push({ x: nums[k], y: nums[k+1] });
    if (pts.length < 2) continue;
    const c = resolve(readAttr(tag, 'class'), readAttr(tag, 'stroke'), readAttr(tag, 'stroke-width'));
    if (isPoly && (pts[0].x !== pts[pts.length-1].x || pts[0].y !== pts[pts.length-1].y)) {
      pts.push({ ...pts[0] });
    }
    polys.push({ pts, closed: isPoly, stroke: c.stroke, width: c.width });
  }
  for (const m of svg.matchAll(/<rect\b([^/>]*)\/?>/gi)) {
    const tag = m[0];
    const x = parseFloat(readAttr(tag, 'x') ?? '0');
    const y = parseFloat(readAttr(tag, 'y') ?? '0');
    const w = parseFloat(readAttr(tag, 'width') ?? '0');
    const h = parseFloat(readAttr(tag, 'height') ?? '0');
    if (w <= 0 || h <= 0) continue;
    const c = resolve(readAttr(tag, 'class'), readAttr(tag, 'stroke'), readAttr(tag, 'stroke-width'));
    polys.push({
      pts: [{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h},{x,y}],
      closed: true, stroke: c.stroke, width: c.width,
    });
  }
  for (const m of svg.matchAll(/<path\b([^>]*?)\/?>/gi)) {
    const tag = m[0];
    const d = readAttr(tag, 'd');
    if (!d) continue;
    const c = resolve(readAttr(tag, 'class'), readAttr(tag, 'stroke'), readAttr(tag, 'stroke-width'));
    for (const s of flattenPath(d)) {
      if (s.pts.length < 2) continue;
      polys.push({ pts: s.pts, closed: s.closed, stroke: c.stroke, width: c.width });
    }
  }
  return polys;
}

function readViewBox(svg: string): { x: number; y: number; w: number; h: number } {
  const rm = svg.match(/<svg\b[^>]*>/i);
  const tag = rm ? rm[0] : '';
  const vb = tag.match(/viewBox\s*=\s*"([^"]+)"/i);
  if (vb) {
    const p = vb[1].trim().split(/[\s,]+/).map(Number);
    if (p.length === 4 && p.every(Number.isFinite)) {
      return { x: p[0], y: p[1], w: p[2], h: p[3] };
    }
  }
  const w = parseFloat(readAttr(tag, 'width') ?? '100');
  const h = parseFloat(readAttr(tag, 'height') ?? '100');
  return { x: 0, y: 0, w, h };
}

/* ── Liang-Barsky segment clip against a rect ── */
function clipSegment(
  x1: number, y1: number, x2: number, y2: number,
  xmin: number, ymin: number, xmax: number, ymax: number,
): { x1: number; y1: number; x2: number; y2: number } | null {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const tests: [number, number][] = [
    [-dx, x1 - xmin], [dx, xmax - x1],
    [-dy, y1 - ymin], [dy, ymax - y1],
  ];
  for (const [p, q] of tests) {
    if (p === 0) { if (q < 0) return null; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
    else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return {
    x1: x1 + t0*dx, y1: y1 + t0*dy,
    x2: x1 + t1*dx, y2: y1 + t1*dy,
  };
}

function nearlyEqualPt(a: Pt, b: Pt): boolean {
  return Math.abs(a.x - b.x) < 1e-4 && Math.abs(a.y - b.y) < 1e-4;
}

/** Group strokes by (stroke,width) and merge contiguous segments. */
function emitPolylines(
  segs: Array<{ a: Pt; b: Pt; stroke: string; width: number }>,
): string {
  if (segs.length === 0) return '';
  // Bucket by style
  const buckets = new Map<string, typeof segs>();
  for (const s of segs) {
    const k = `${s.stroke}|${s.width.toFixed(4)}`;
    let bk = buckets.get(k);
    if (!bk) { bk = []; buckets.set(k, bk); }
    bk.push(s);
  }
  const out: string[] = [];
  for (const [k, list] of buckets) {
    const [stroke, wStr] = k.split('|');
    // Greedy chain: pick a segment, extend forward by matching endpoints.
    const used = new Array(list.length).fill(false);
    for (let i = 0; i < list.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      const chain: Pt[] = [list[i].a, list[i].b];
      let grew = true;
      while (grew) {
        grew = false;
        const tail = chain[chain.length - 1];
        for (let j = 0; j < list.length; j++) {
          if (used[j]) continue;
          if (nearlyEqualPt(list[j].a, tail)) {
            chain.push(list[j].b); used[j] = true; grew = true; break;
          }
          if (nearlyEqualPt(list[j].b, tail)) {
            chain.push(list[j].a); used[j] = true; grew = true; break;
          }
        }
      }
      // Format
      const ptsStr = chain.map(p => `${p.x.toFixed(4)},${p.y.toFixed(4)}`).join(' ');
      if (chain.length === 2) {
        out.push(`      <line x1="${chain[0].x.toFixed(4)}" y1="${chain[0].y.toFixed(4)}" x2="${chain[1].x.toFixed(4)}" y2="${chain[1].y.toFixed(4)}" fill="none" stroke="${stroke}" stroke-width="${wStr}"/>`);
      } else {
        out.push(`      <polyline points="${ptsStr}" fill="none" stroke="${stroke}" stroke-width="${wStr}"/>`);
      }
    }
  }
  return out.join('\n');
}

/* ── Per-piece flattening: clip every polyline against every tile, map to target ── */
function flattenPiece(
  polys: Poly[],
  tiles: V4Tile[],
  vb: { x: number; y: number; w: number; h: number },
  baseFW: number,
  baseFH: number,
): Array<{ a: Pt; b: Pt; stroke: string; width: number }> {
  const segs: Array<{ a: Pt; b: Pt; stroke: string; width: number }> = [];
  // Source coords inside the BASE footprint = viewBox coords scaled to baseFW×baseFH.
  // Convert viewBox-space → baseFootprint-space first, then clip+map per tile.
  const sxScale = baseFW / Math.max(1e-6, vb.w);
  const syScale = baseFH / Math.max(1e-6, vb.h);
  const toFP = (p: Pt): Pt => ({
    x: (p.x - vb.x) * sxScale,
    y: (p.y - vb.y) * syScale,
  });
  for (const poly of polys) {
    if (poly.pts.length < 2) continue;
    const fpPts = poly.pts.map(toFP);
    for (let i = 0; i < fpPts.length - 1; i++) {
      const a = fpPts[i], b = fpPts[i + 1];
      for (const t of tiles) {
        if (t.tw <= 0 || t.th <= 0 || t.sw <= 0 || t.sh <= 0) continue;
        const clipped = clipSegment(a.x, a.y, b.x, b.y, t.sx, t.sy, t.sx + t.sw, t.sy + t.sh);
        if (!clipped) continue;
        // Linear map source rect → target rect
        const kx = t.tw / t.sw, ky = t.th / t.sh;
        segs.push({
          a: { x: t.tx + (clipped.x1 - t.sx) * kx, y: t.ty + (clipped.y1 - t.sy) * ky },
          b: { x: t.tx + (clipped.x2 - t.sx) * kx, y: t.ty + (clipped.y2 - t.sy) * ky },
          stroke: poly.stroke, width: poly.width,
        });
      }
    }
  }
  return segs;
}

/* ── Hard guards ── */
function assertContract(svg: string, transforms: string[]) {
  if (/<symbol\b/i.test(svg)) throw new Error('Box Die Cut export: <symbol> is forbidden.');
  if (/<use\b/i.test(svg)) throw new Error('Box Die Cut export: <use> is forbidden.');
  if (/<clipPath\b/i.test(svg)) throw new Error('Box Die Cut export: <clipPath> is forbidden.');
  if (/<foreignObject\b/i.test(svg)) throw new Error('Box Die Cut export: <foreignObject> is forbidden.');
  if (/<script\b/i.test(svg)) throw new Error('Box Die Cut export: <script> is forbidden.');
  if (/<image\b/i.test(svg)) throw new Error('Box Die Cut export: <image> is forbidden.');
  if (/<style\b/i.test(svg)) throw new Error('Box Die Cut export: <style> is forbidden.');
  const ALLOWED = /^translate\(\s*-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s*\)(?:\s+rotate\(\s*90\s*\))?$/;
  for (let i = 0; i < transforms.length; i++) {
    if (!ALLOWED.test(transforms[i])) {
      throw new Error(`Box Die Cut export: piece #${i} non-conforming transform "${transforms[i]}".`);
    }
  }
}

/* ───────────────────────── main ───────────────────────── */

export function buildBoxDieCutSvg(opts: BoxDieCutExportOptions): string {
  const { inputs, result, pieceSvg } = opts;
  const sheetW = inputs.sheetWidth;
  const sheetH = inputs.sheetHeight;

  const longHoriz = sheetW >= sheetH;
  const renderW = longHoriz ? result.longSide : result.shortSide;
  const renderH = longHoriz ? result.shortSide : result.longSide;

  const zones = result.geometry.zones;
  const baseFW = zones.baseFootprintW;
  const baseFH = zones.baseFootprintH;
  const tiles = buildPreviewTiles(zones);

  const polys = parseSourceGeometry(pieceSvg);
  const vb = readViewBox(pieceSvg || '<svg viewBox="0 0 100 100"/>');

  // Validate pieces are unique
  const seen = new Set<string>();
  for (const p of result.pieces) {
    const key = `${p.x.toFixed(3)}_${p.y.toFixed(3)}_${p.rotated ? 1 : 0}`;
    if (seen.has(key)) throw new Error(`Box Die Cut export: duplicate piece at (${p.x}, ${p.y}).`);
    seen.add(key);
  }
  if (result.pieces.length !== result.best.total) {
    throw new Error(`Box Die Cut export: pieces=${result.pieces.length} ≠ total=${result.best.total}`);
  }

  const transforms: string[] = [];
  const piecesXml = result.pieces.map(p => {
    const transform = p.rotated
      ? `translate(${(p.x + p.footprintW).toFixed(4)} ${p.y.toFixed(4)}) rotate(90)`
      : `translate(${p.x.toFixed(4)} ${p.y.toFixed(4)})`;
    transforms.push(transform);

    let body: string;
    if (polys.length === 0 || baseFW <= 0 || baseFH <= 0) {
      // Fallback: outline only
      body = `      <rect x="0" y="0" width="${p.footprintW.toFixed(4)}" height="${p.footprintH.toFixed(4)}" fill="none" stroke="#000000" stroke-width="0.2"/>`;
    } else {
      const segs = flattenPiece(polys, tiles, vb, baseFW, baseFH);
      body = emitPolylines(segs);
      if (!body) {
        body = `      <rect x="0" y="0" width="${p.footprintW.toFixed(4)}" height="${p.footprintH.toFixed(4)}" fill="none" stroke="#000000" stroke-width="0.2"/>`;
      }
    }
    return `    <g id="piece-${p.index}" data-row="${p.row}" data-col="${p.col}" data-rotated="${p.rotated}" transform="${transform}">
${body}
    </g>`;
  }).join('\n');

  const sheetLayer = `  <g id="Sheet" inkscape:groupmode="layer" inkscape:label="Sheet">
    <rect x="0" y="0" width="${renderW}" height="${renderH}" fill="none" stroke="#000000" stroke-width="0.25"/>
  </g>\n`;
  const dielinesLayer = `  <g id="Dielines" inkscape:groupmode="layer" inkscape:label="Dielines">
${piecesXml}
  </g>\n`;

  const svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     width="${renderW}mm" height="${renderH}mm" viewBox="0 0 ${renderW} ${renderH}">
  <title>Box Die Cut Layout</title>
${sheetLayer}${dielinesLayer}</svg>`;

  assertContract(svg, transforms);

  const rendered = (svg.match(/<g id="piece-/g) || []).length;
  if (rendered !== result.pieces.length) {
    throw new Error(`Box Die Cut export: rendered=${rendered} ≠ expected=${result.pieces.length}`);
  }
  return svg;
}

export function downloadText(filename: string, mime: string, data: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
