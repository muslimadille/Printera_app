export type Pt = { x: number; y: number };
export type SegmentGeometry = "line" | "polyline" | "bezier";

export interface Segment {
  id: number;
  svgId: string;
  kind: "OUTER" | "CUT" | "CREASE";
  geometry: SegmentGeometry;
  start: Pt;
  end: Pt;
  points?: Pt[];
  bezier?: { c1: Pt; c2: Pt };
  preserved?: boolean;
}

export interface D003Geometry {
  params: any;
  derived: any;
  segments: Segment[];
  bbox: { w: number; h: number };
  svg: string;
}

import { D003Params } from "./types";

const r = (n: number) => Math.round(n * 100000) / 100000;
const P = (x: number, y: number): Pt => ({ x: r(x), y: r(y) });

function outer(id: number, start: Pt, end: Pt): Segment {
  return { id, svgId: `LINE_${id}`, kind: "OUTER", geometry: "line", start, end };
}
function crease(id: number, s: Pt, e: Pt): Segment {
  return { id, svgId: `CREASE_${id}`, kind: "CREASE", geometry: "line", start: s, end: e };
}
function outerPolyline(id: number, pts: Pt[]): Segment {
  return { id, svgId: `LINE_${id}`, kind: "OUTER", geometry: "polyline", start: pts[0], end: pts[pts.length - 1], points: pts };
}
function cutPolyline(id: number, pts: Pt[]): Segment {
  return { id, svgId: `CUT_${id}`, kind: "CUT", geometry: "polyline", start: pts[0], end: pts[pts.length - 1], points: pts };
}
function outerBezier(id: number, start: Pt, c1: Pt, c2: Pt, end: Pt): Segment {
  return { id, svgId: `LINE_${id}`, kind: "OUTER", geometry: "bezier", start, end, bezier: { c1, c2 }, preserved: true };
}

export function buildD003Geometry(params: D003Params): D003Geometry {
  const { width, height, depth, lidTongueHeight } = params;
  
  const tongueW = 1.55; 
  
  const x0 = 0;
  const x1 = x0 + tongueW;
  const x2 = x1 + depth;
  const x3 = x2 + width;
  const x4 = x3 + depth;
  const x5 = x4 + tongueW;

  const y0 = 0;
  const y1 = y0 + lidTongueHeight;
  const y2 = y1 + height - 1;
  const y3 = y2 + depth;
  const y4 = y3 + height;
  const y5 = y4 + depth;

  const segments: Segment[] = [];
  let id = 1;

  const curveW = 12;
  const curveH = lidTongueHeight;
  const tongueLeftX = x2 + 0.5;
  const tongueRightX = x3 - 0.5;
  
  segments.push(outer(id++, P(tongueLeftX + curveW, y0), P(tongueRightX - curveW, y0)));
  
  segments.push(outerBezier(id++, 
    P(tongueRightX - curveW, y0),
    P(tongueRightX - curveW/2, y0),
    P(tongueRightX, y0 + curveH/2),
    P(tongueRightX, y1)
  ));
  
  segments.push(outerPolyline(id++, [P(tongueRightX, y1), P(x3, y1), P(x3, y2)]));
  segments.push(outerPolyline(id++, [P(x3, y2), P(x3+3, y2+3), P(x3+depth, y2+13), P(x3+depth, y3-3), P(x3+depth-3, y3), P(x3, y3)]));
  segments.push(outerPolyline(id++, [P(x3, y3), P(x3+1, y3+1), P(x4, y3+1)]));

  segments.push(outer(id++, P(x4, y3+1), P(x5, y3 + 4.617)));
  segments.push(outer(id++, P(x5, y3 + 4.617), P(x5, y4 - 4.617)));
  segments.push(outer(id++, P(x5, y4 - 4.617), P(x4, y4 - 1)));

  segments.push(outerPolyline(id++, [P(x4, y4 - 1), P(x3+1, y4 - 1), P(x3, y4)]));
  segments.push(outerPolyline(id++, [P(x3, y4), P(x3+depth-3, y4), P(x3+depth, y4+3), P(x3+depth, y5-13), P(x3+3, y5-3), P(x3, y5)]));
  segments.push(outer(id++, P(x3, y5), P(x2, y5)));
  segments.push(outerPolyline(id++, [P(x2, y5), P(x2-3, y5-3), P(x2-depth, y5-13), P(x2-depth, y4+3), P(x2-depth+3, y4), P(x2, y4)]));
  segments.push(outerPolyline(id++, [P(x2, y4), P(x2-1, y4-1), P(x1, y4-1)]));

  segments.push(outer(id++, P(x1, y4-1), P(x0, y4 - 4.617)));
  segments.push(outer(id++, P(x0, y4 - 4.617), P(x0, y3 + 4.617)));
  segments.push(outer(id++, P(x0, y3 + 4.617), P(x1, y3 + 1)));

  segments.push(outerPolyline(id++, [P(x1, y3+1), P(x2-1, y3+1), P(x2, y3)]));
  segments.push(outerPolyline(id++, [P(x2, y3), P(x2-depth+3, y3), P(x2-depth, y3-3), P(x2-depth, y2+13), P(x2-3, y2+3), P(x2, y2)]));
  segments.push(outerPolyline(id++, [P(x2, y2), P(x2, y1), P(tongueLeftX, y1)]));

  segments.push(outerBezier(id++, 
    P(tongueLeftX, y1),
    P(tongueLeftX, y0 + curveH/2),
    P(tongueLeftX + curveW/2, y0),
    P(tongueLeftX + curveW, y0)
  ));

  segments.push(crease(id++, P(x2, y2), P(x3, y2)));
  segments.push(crease(id++, P(x2, y3), P(x3, y3)));
  segments.push(crease(id++, P(x2, y4), P(x3, y4)));
  
  segments.push(crease(id++, P(x2, y3), P(x2, y4)));
  segments.push(crease(id++, P(x3, y3), P(x3, y4)));

  segments.push(crease(id++, P(x1, y3+1), P(x1, y4-1)));
  segments.push(crease(id++, P(x4, y3+1), P(x4, y4-1)));
  
  segments.push(crease(id++, P(x2+9, y1), P(x3-9, y1)));

  segments.push(crease(id++, P(x2-1, y3+1), P(x0, y3 + 1 + (x2 - 1 - x0))));
  segments.push(crease(id++, P(x2-1, y4-1), P(x0, y4 - 1 - (x2 - 1 - x0))));
  
  segments.push(crease(id++, P(x3+1, y3+1), P(x5, y3 + 1 + (x5 - (x3+1)))));
  segments.push(crease(id++, P(x3+1, y4-1), P(x5, y4 - 1 - (x5 - (x3+1)))));

  segments.push(cutPolyline(id++, [P(x2 + 9, y1 + 1), P(x2 + 9, y1 - 1), P(x2, y1 - 1)]));
  segments.push(cutPolyline(id++, [P(x3 - 9, y1 + 1), P(x3 - 9, y1 - 1), P(x3, y1 - 1)]));

  const all: Pt[] = [];
  for (const s of segments) {
    all.push(s.start, s.end);
    if (s.bezier) all.push(s.bezier.c1, s.bezier.c2);
    if (s.points) all.push(...s.points);
  }
  const minX = Math.min(...all.map(p => p.x));
  const minY = Math.min(...all.map(p => p.y));
  const maxX = Math.max(...all.map(p => p.x));
  const maxY = Math.max(...all.map(p => p.y));
  
  const bbox = { w: maxX - minX, h: maxY - minY };
  const shift = (p: Pt): Pt => ({ x: r(p.x - minX), y: r(p.y - minY) });
  
  const shifted: Segment[] = segments.map(s => ({
    ...s,
    start: shift(s.start),
    end:   shift(s.end),
    bezier: s.bezier ? { c1: shift(s.bezier.c1), c2: shift(s.bezier.c2) } : undefined,
    points: s.points ? s.points.map(shift) : undefined,
  }));

  return {
    params,
    derived: {},
    segments: shifted,
    bbox,
    svg: renderSvg(shifted, bbox)
  };
}

function renderSvg(segs: Segment[], bbox: { w: number; h: number }): string {
  const cutCol = "#ED1C24";
  const crsCol = "#00A651";
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${bbox.w}mm" height="${bbox.h}mm" viewBox="0 0 ${bbox.w} ${bbox.h}">`);
  
  out.push(`  <g id="CREASE" fill="none" stroke="${crsCol}" stroke-width="0.1" stroke-miterlimit="10">`);
  for (const s of segs.filter(s => s.kind === "CREASE")) {
    out.push(`    <line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}"/>`);
  }
  out.push(`  </g>`);
  
  out.push(`  <g id="OUTER" fill="none" stroke="${cutCol}" stroke-width="0.2" stroke-miterlimit="10">`);
  for (const s of segs.filter(s => s.kind === "OUTER")) {
    if (s.geometry === "bezier" && s.bezier) {
      out.push(`    <path d="M${s.start.x},${s.start.y} C${s.bezier.c1.x},${s.bezier.c1.y} ${s.bezier.c2.x},${s.bezier.c2.y} ${s.end.x},${s.end.y}"/>`);
    } else if (s.geometry === "polyline" && s.points) {
      const pts = s.points.map(p => `${p.x},${p.y}`).join(" ");
      out.push(`    <polyline points="${pts}"/>`);
    } else {
      out.push(`    <line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}"/>`);
    }
  }
  out.push(`  </g>`);
  
  out.push(`  <g id="CUT" fill="none" stroke="${cutCol}" stroke-width="0.35" stroke-linecap="round" stroke-linejoin="round">`);
  for (const s of segs.filter(s => s.kind === "CUT")) {
    if (s.geometry === "polyline" && s.points) {
      const pts = s.points.map(p => `${p.x},${p.y}`).join(" ");
      out.push(`    <polyline points="${pts}"/>`);
    } else {
      out.push(`    <line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}"/>`);
    }
  }
  out.push(`  </g>`);
  
  out.push(`</svg>`);
  return out.join("\n");
}
