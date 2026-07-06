import json

def generate():
    code = """import type { T0012Params } from "./types";
import { T0012_REFERENCE } from "./types";

export interface Pt { x: number; y: number }
export interface Segment {
  id: number;
  svgId: string;
  kind: "OUTER" | "CUT" | "CREASE";
  geometry: "line" | "bezier" | "arc" | "polyline";
  start: Pt;
  end: Pt;
  points?: Pt[];
  bezier?: { c1: Pt; c2: Pt };
  arc?: { rx: number; ry: number; xar: number; laf: number; sf: number };
}

export interface T0012Derived {
  W: number;
  H: number;
  D: number;
  Gf: number;
}

export interface T0012Geometry {
  params: T0012Params;
  derived: T0012Derived;
  segments: Segment[];
  bbox: { w: number; h: number };
  svg: string;
}

export function buildT0012Geometry(p: T0012Params): T0012Geometry {
  const W = p.referenceMode ? T0012_REFERENCE.width : p.width;
  const H = p.referenceMode ? T0012_REFERENCE.height : p.height;
  const D = p.referenceMode ? T0012_REFERENCE.depth : p.depth;
  const Gf = p.referenceMode ? T0012_REFERENCE.glueFlap : p.glueFlap;

  const ox = 2;
  const oy = 2;

  // X Coordinates (Base)
  const X0 = ox;
  const X1 = ox + Gf;
  const X2 = X1 + W;
  const X3 = X2 + D;
  const X4 = X3 + W;
  const X5 = X4 + D;

  const topFlapH = D * 0.97;
  const botFlapH = D * 0.97;
  const dustFlapH = D / 2;

  // Y Coordinates
  const Y0 = oy;
  const Y_dust_top = oy + topFlapH - dustFlapH;
  const Y1 = oy + topFlapH;
  const Y2 = Y1 + H;
  const Y_dust_bot = Y2 + dustFlapH;
  const Y_bot_flap = Y2 + botFlapH;

  const segs: Segment[] = [];
  let idCounter = 1;

  const addCut = (x1: number, y1: number, x2: number, y2: number) => {
    segs.push({ id: idCounter++, svgId: `OUTER_${idCounter}`, kind: "OUTER", geometry: "line", start: {x: x1, y: y1}, end: {x: x2, y: y2} });
  };
  const addCrease = (x1: number, y1: number, x2: number, y2: number) => {
    segs.push({ id: idCounter++, svgId: `CREASE_${idCounter}`, kind: "CREASE", geometry: "line", start: {x: x1, y: y1}, end: {x: x2, y: y2} });
  };
  const P = (x: number, y: number): Pt => ({ x, y });
  const addArc = (s: Pt, e: Pt, rx: number, ry: number, xar: number, laf: number, sf: number, kind: "OUTER" | "CUT" | "CREASE") => {
    segs.push({ id: idCounter++, svgId: `${kind}_${idCounter}`, kind, geometry: "arc", start: s, end: e, arc: { rx, ry, xar, laf, sf } });
  };

  const gfSlant = Math.min(6, Gf / 2);
  addCut(X1, Y1, X0, Y1 + gfSlant);
  addCut(X0, Y1 + gfSlant, X0, Y2 - gfSlant);
  addCut(X0, Y2 - gfSlant, X1, Y2);

  const wSlant = 0.075 * W;
  addCut(X1, Y1, X1 + wSlant, Y1 - wSlant);
  addCut(X1 + wSlant, Y1 - wSlant, X1 + wSlant, Y0);
  addCut(X1 + wSlant, Y0, X2 - wSlant, Y0);
  addCut(X2 - wSlant, Y0, X2 - wSlant, Y1 - wSlant);
  addCut(X2 - wSlant, Y1 - wSlant, X2, Y1);
  
  addCut(X3, Y1, X3 + wSlant, Y1 - wSlant);
  addCut(X3 + wSlant, Y1 - wSlant, X3 + wSlant, Y0);
  addCut(X3 + wSlant, Y0, X4 - wSlant, Y0);
  addCut(X4 - wSlant, Y0, X4 - wSlant, Y1 - wSlant);
  addCut(X4 - wSlant, Y1 - wSlant, X4, Y1);
  
  addCut(X1, Y2, X1 + wSlant, Y2 + wSlant);
  addCut(X1 + wSlant, Y2 + wSlant, X1 + wSlant, Y_bot_flap);
  addCut(X1 + wSlant, Y_bot_flap, X2 - wSlant, Y_bot_flap);
  addCut(X2 - wSlant, Y_bot_flap, X2 - wSlant, Y2 + wSlant);
  addCut(X2 - wSlant, Y2 + wSlant, X2, Y2);
  
  addCut(X3, Y2, X3 + wSlant, Y2 + wSlant);
  addCut(X3 + wSlant, Y2 + wSlant, X3 + wSlant, Y_bot_flap);
  addCut(X3 + wSlant, Y_bot_flap, X4 - wSlant, Y_bot_flap);
  addCut(X4 - wSlant, Y_bot_flap, X4 - wSlant, Y2 + wSlant);
  addCut(X4 - wSlant, Y2 + wSlant, X4, Y2);

  const rSmall = 0.024 * D; 
  const rBig = 0.06 * D;    
  const notchW = 0.166 * D; 
  const notchH = 0.185 * D; 
  
  // Panel 2 Top Flap
  addArc(P(X2, Y1), P(X2 + rSmall, Y1 - rSmall), rSmall, rSmall, 0, 0, 0, "OUTER");
  addCut(X2 + rSmall, Y1 - rSmall, X2 + rSmall, Y_dust_top + rBig);
  addArc(P(X2 + rSmall, Y_dust_top + rBig), P(X2 + rSmall + rBig, Y_dust_top), rBig, rBig, 0, 0, 1, "OUTER");
  addCut(X2 + rSmall + rBig, Y_dust_top, X3 - rSmall - rBig, Y_dust_top);
  addArc(P(X3 - rSmall - rBig, Y_dust_top), P(X3 - rSmall, Y_dust_top + rBig), rBig, rBig, 0, 0, 1, "OUTER");
  addCut(X3 - rSmall, Y_dust_top + rBig, X3 - rSmall, Y1 - rSmall);
  addArc(P(X3 - rSmall, Y1 - rSmall), P(X3, Y1), rSmall, rSmall, 0, 0, 0, "OUTER");

  // Panel 4 Top Flap
  addArc(P(X4, Y1), P(X4 + rSmall, Y1 - rSmall), rSmall, rSmall, 0, 0, 0, "OUTER");
  addCut(X4 + rSmall, Y1 - rSmall, X4 + rSmall, Y_dust_top + rBig);
  addArc(P(X4 + rSmall, Y_dust_top + rBig), P(X4 + rSmall + rBig, Y_dust_top), rBig, rBig, 0, 0, 1, "OUTER");
  const p4NotchStartX = X5 - notchW;
  addCut(X4 + rSmall + rBig, Y_dust_top, p4NotchStartX, Y_dust_top);
  addCut(p4NotchStartX, Y_dust_top, p4NotchStartX, Y_dust_top + notchH);
  addArc(P(p4NotchStartX, Y_dust_top + notchH), P(p4NotchStartX + rBig, Y_dust_top + notchH + rBig), rBig, rBig, 0, 0, 0, "OUTER");
  addCut(p4NotchStartX + rBig, Y_dust_top + notchH + rBig, X5, Y_dust_top + notchH + rBig);
  // Straight line down on X5
  addCut(X5, Y_dust_top + notchH + rBig, X5, Y1);

  // Panel 4 Bottom Flap
  addArc(P(X4, Y2), P(X4 + rSmall, Y2 + rSmall), rSmall, rSmall, 0, 0, 1, "OUTER");
  addCut(X4 + rSmall, Y2 + rSmall, X4 + rSmall, Y_dust_bot - rBig);
  addArc(P(X4 + rSmall, Y_dust_bot - rBig), P(X4 + rSmall + rBig, Y_dust_bot), rBig, rBig, 0, 0, 0, "OUTER");
  addCut(X4 + rSmall + rBig, Y_dust_bot, X5 - rBig, Y_dust_bot);
  addArc(P(X5 - rBig, Y_dust_bot), P(X5, Y_dust_bot - rBig), rBig, rBig, 0, 0, 0, "OUTER");
  // Straight line up on X5
  addCut(X5, Y_dust_bot - rBig, X5, Y2);

  // Panel 2 Bottom Flap
  addArc(P(X3, Y2), P(X3 - rSmall, Y2 + rSmall), rSmall, rSmall, 0, 0, 0, "OUTER");
  addCut(X3 - rSmall, Y2 + rSmall, X3 - rSmall, Y_dust_bot - rBig);
  addArc(P(X3 - rSmall, Y_dust_bot - rBig), P(X3 - rSmall - rBig, Y_dust_bot), rBig, rBig, 0, 0, 1, "OUTER");
  const p2NotchStartX = X2 + rSmall + notchW;
  addCut(X3 - rSmall - rBig, Y_dust_bot, p2NotchStartX, Y_dust_bot);
  addCut(p2NotchStartX, Y_dust_bot, p2NotchStartX, Y_dust_bot - notchH);
  addArc(P(p2NotchStartX, Y_dust_bot - notchH), P(p2NotchStartX - rBig, Y_dust_bot - notchH - rBig), rBig, rBig, 0, 0, 0, "OUTER");
  addCut(p2NotchStartX - rBig, Y_dust_bot - notchH - rBig, X2 + rSmall, Y_dust_bot - notchH - rBig);
  addCut(X2 + rSmall, Y_dust_bot - notchH - rBig, X2 + rSmall, Y2 + rSmall);
  addArc(P(X2 + rSmall, Y2 + rSmall), P(X2, Y2), rSmall, rSmall, 0, 0, 0, "OUTER");

  // VERTICAL CREASES
  addCrease(X1, Y1, X1, Y2);
  addCrease(X2, Y1, X2, Y2);
  addCrease(X3, Y1, X3, Y2);
  addCrease(X4, Y1, X4, Y2);

  // HORIZONTAL CREASES
  addCrease(X1, Y1, X5, Y1);
  addCrease(X1, Y2, X5, Y2);

  const bboxW = X5 + ox + 10;
  const bboxH = Y_bot_flap + oy + 10;

  const svgLines: string[] = [];
  const strokeWidth = (bboxW > 500) ? 2 : (bboxW > 200 ? 1 : 0.5);
  
  svgLines.push(`<svg id="T0012" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bboxW} ${bboxH}" width="100%" height="100%">`);
  svgLines.push(`  <defs><style>
    .crease-line { fill: none; stroke: #00a651; stroke-width: ${strokeWidth}; stroke-miterlimit: 10; }
    .outer-line { fill: none; stroke: #ed1c24; stroke-width: ${strokeWidth}; stroke-miterlimit: 10; }
    .inner-cut-line { fill: none; stroke: #ed1c24; stroke-width: ${strokeWidth}; stroke-miterlimit: 10; }
  </style></defs>`);

  const rounded = (n: number) => parseFloat(n.toFixed(4));
  const render = (s: Segment, cls: string) => {
    if (s.geometry === "line") return `  <line class="${cls}" x1="${rounded(s.start.x)}" y1="${rounded(s.start.y)}" x2="${rounded(s.end.x)}" y2="${rounded(s.end.y)}" id="${s.svgId}" />`;
    if (s.geometry === "arc" && s.arc) return `  <path class="${cls}" d="M ${rounded(s.start.x)},${rounded(s.start.y)} A ${rounded(s.arc.rx)} ${rounded(s.arc.ry)} ${s.arc.xar} ${s.arc.laf} ${s.arc.sf} ${rounded(s.end.x)},${rounded(s.end.y)}" id="${s.svgId}" />`;
    if (s.geometry === "bezier" && s.bezier) return `  <path class="${cls}" d="M ${rounded(s.start.x)},${rounded(s.start.y)} C ${rounded(s.bezier.c1.x)},${rounded(s.bezier.c1.y)} ${rounded(s.bezier.c2.x)},${rounded(s.bezier.c2.y)} ${rounded(s.end.x)},${rounded(s.end.y)}" id="${s.svgId}" />`;
    return "";
  };

  segs.filter(s => s.kind === "CREASE").forEach(s => svgLines.push(render(s, "crease-line")));
  segs.filter(s => s.kind === "OUTER").forEach(s => svgLines.push(render(s, "outer-line")));
  segs.filter(s => s.kind === "CUT").forEach(s => svgLines.push(render(s, "inner-cut-line")));

  svgLines.push(`  <line x1="${X1}" y1="${Y2 + 20}" x2="${X2}" y2="${Y2 + 20}" stroke="blue" stroke-width="${strokeWidth}" marker-start="url(#arrow)" marker-end="url(#arrow)" />`);
  svgLines.push(`  <text x="${X1 + W/2}" y="${Y2 + 15}" fill="blue" font-size="12" text-anchor="middle">W (${W.toFixed(1)})</text>`);

  svgLines.push(`  <line x1="${X2}" y1="${Y2 + 20}" x2="${X3}" y2="${Y2 + 20}" stroke="blue" stroke-width="${strokeWidth}" marker-start="url(#arrow)" marker-end="url(#arrow)" />`);
  svgLines.push(`  <text x="${X2 + D/2}" y="${Y2 + 15}" fill="blue" font-size="12" text-anchor="middle">D (${D.toFixed(1)})</text>`);

  svgLines.push(`  <line x1="${X5 + 20}" y1="${Y1}" x2="${X5 + 20}" y2="${Y2}" stroke="blue" stroke-width="${strokeWidth}" marker-start="url(#arrow)" marker-end="url(#arrow)" />`);
  svgLines.push(`  <text x="${X5 + 25}" y="${Y1 + H/2}" fill="blue" font-size="12" dominant-baseline="middle" transform="rotate(90 ${X5 + 25},${Y1 + H/2})">H (${H.toFixed(1)})</text>`);

  svgLines.push('</svg>');

  return {
    params: p,
    derived: { W, H, D, Gf },
    segments: segs,
    bbox: { w: bboxW, h: bboxH },
    svg: svgLines.join('\n')
  };
}
"""
    with open('/Users/mslmadl/Documents/Print logic/src/lib/t0012/geometry.ts', 'w') as f:
        f.write(code)

if __name__ == "__main__":
    generate()
