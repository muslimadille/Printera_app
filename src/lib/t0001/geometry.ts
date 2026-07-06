// T0001 — Geometry Engine (Parametric SVG Generator)
// ---------------------------------------------------------
// Reverse Tuck-End Box (A10.10.03.03)

import type { T0001Params, T0001Geometry } from './types';

export interface Pt { x: number; y: number; }
export interface Segment {
  id: number;
  svgId: string;
  kind: "OUTER" | "CUT" | "CREASE";
  geometry: "line" | "polyline" | "bezier" | "arc" | string;
  start: Pt;
  end: Pt;
  points?: Pt[];
  bezier?: { c1: Pt; c2: Pt };
  arc?: { rx: number; ry: number; xar: number; laf: number; sf: number };
}

export function buildT0001Geometry(params: T0001Params): T0001Geometry {
  const W  = params.W;
  const D  = params.D;
  const H  = params.H;
  const GF = params.GF;
  const GH = params.GH ?? 8.44;
  const TH = params.TH ?? 138.9;
  const TC = params.TC ?? 21.26;
  const DH = params.DH ?? 62.64;
  const DR = params.DR ?? 8.5;
  const SR = params.SR ?? 3.4;
  const CL = params.CL ?? 1.41;
  const NH = params.NH ?? 26.22;
  const NW = params.NW ?? 14.88;
  const NR = params.NR ?? 8.51;

  const D4 = D - CL;
  const pad = 2;

  // ---- X positions ----
  const xGF = pad + GF;
  const xP1 = xGF + W;
  const xP2 = xP1 + D;
  const xP3 = xP2 + W;
  const xP4 = xP3 + D4;

  // ---- Y positions ----
  const yFlapTop  = pad;
  const yCreaseT  = pad + TH;
  const yCreaseB  = yCreaseT + H;
  const yFlapBot  = yCreaseB + TH;

  const dustTopY  = yCreaseT - DH;
  const dustBotY  = yCreaseB + DH;

  const segs: Segment[] = [];
  let idCounter = 1;

  const addCrease = (x1: number, y1: number, x2: number, y2: number) => {
    segs.push({
      id: idCounter++,
      svgId: `CREASE_${idCounter}`,
      kind: "CREASE",
      geometry: "line",
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 }
    });
  };

  const addOuterLine = (x1: number, y1: number, x2: number, y2: number) => {
    segs.push({
      id: idCounter++,
      svgId: `LINE_${idCounter}`,
      kind: "OUTER",
      geometry: "line",
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 }
    });
  };

  const addOuterPolyline = (pts: Pt[]) => {
    segs.push({
      id: idCounter++,
      svgId: `LINE_${idCounter}`,
      kind: "OUTER",
      geometry: "polyline",
      start: pts[0],
      end: pts[pts.length - 1],
      points: pts
    });
  };

  const addOuterBezier = (s: Pt, c1: Pt, c2: Pt, e: Pt) => {
    segs.push({
      id: idCounter++,
      svgId: `LINE_${idCounter}`,
      kind: "OUTER",
      geometry: "bezier",
      start: s,
      end: e,
      bezier: { c1, c2 }
    });
  };

  const addOuterArc = (s: Pt, e: Pt, rx: number, ry: number, sf: number) => {
    segs.push({
      id: idCounter++,
      svgId: `LINE_${idCounter}`,
      kind: "OUTER",
      geometry: "arc",
      start: s,
      end: e,
      arc: { rx, ry, xar: 0, laf: 0, sf }
    });
  };

  // ========== CREASE LINES (green #009640) ==========
  addCrease(xGF, yCreaseT, xGF, yCreaseB);
  addCrease(xP1, yCreaseT + 1.7, xP1, yCreaseB - 1.7);
  addCrease(xP2, yCreaseT + 1.7, xP2, yCreaseB - 1.7);
  addCrease(xP3, yCreaseT + 1.7, xP3, yCreaseB - 1.7);

  const yHT1 = yCreaseT - 1.42;
  const yHT2 = yCreaseT;
  addCrease(xGF + 1.42, yHT1, xP1 - 3.83, yHT1);
  addCrease(xP1 + 2.95, yHT2, xP2 - 2.96, yHT2);
  addCrease(xP2 + 3.83, yHT1, xP3 - 3.83, yHT1);
  addCrease(xP3 + 2.96, yHT2, xP4, yHT2);

  const yHB1 = yCreaseB + 1.42;
  const yHB2 = yCreaseB;
  addCrease(xGF + 1.42, yHB1, xP1 - 3.83, yHB1);
  addCrease(xP1 + 2.95, yHB2, xP2 - 2.96, yHB2);
  addCrease(xP2 + 3.83, yHB1, xP3 - 3.83, yHB1);
  addCrease(xP3 + 2.96, yHB2, xP4, yHB2);

  // ========== OUTER CUT CONTOUR (red #e30613) ==========

  // 1. Glue Flap (on the left)
  addOuterPolyline([
    { x: xGF, y: yCreaseT },
    { x: pad, y: yCreaseT + GH },
    { x: pad, y: yCreaseB - GH },
    { x: xGF, y: yCreaseB }
  ]);

  // 2. Bottom Flap 1 (tuck)
  addOuterLine(xGF, yCreaseB, xGF + TC, yCreaseB + TC);
  addOuterLine(xGF + TC, yCreaseB + TC, xGF + TC, yFlapBot);
  addOuterLine(xGF + TC, yFlapBot, xP1 - TC, yFlapBot);
  addOuterLine(xP1 - TC, yFlapBot, xP1 - TC, yCreaseB + TC);
  addOuterLine(xP1 - TC, yCreaseB + TC, xP1, yCreaseB);
  addOuterBezier(
    { x: xP1, y: yCreaseB },
    { x: xP1 + 0.47, y: yCreaseB + 0.47 },
    { x: xP1 + 1.47, y: yCreaseB + 1.7 },
    { x: xP1 + 2.41, y: yCreaseB + 1.7 }
  );

  // 3. Bottom Flap 2 (dust flap with notch on left)
  addOuterArc({ x: xP2 - 2.54, y: yCreaseB + 1.7 }, { x: xP2 - 2.54 - SR, y: yCreaseB + 1.7 + SR }, SR, SR, 1);
  addOuterLine(xP2 - 2.54 - SR, yCreaseB + 1.7 + SR, xP2 - 2.54 - SR, dustBotY - DR);
  addOuterArc({ x: xP2 - 2.54 - SR, y: dustBotY - DR }, { x: xP2 - 2.54 - SR - DR, y: dustBotY }, DR, DR, 0);
  addOuterLine(xP2 - 2.54 - SR - DR, dustBotY, xP1 + NR + NW + 2.95, dustBotY);
  addOuterLine(xP1 + NR + NW + 2.95, dustBotY, xP1 + NR + NW + 2.95, dustBotY - NH);
  addOuterArc({ x: xP1 + NR + NW + 2.95, y: dustBotY - NH }, { x: xP1 + NW + 2.95, y: dustBotY - NH - NR }, NR, NR, 1);
  addOuterLine(xP1 + NW + 2.95, dustBotY - NH - NR, xP1 + 2.95, dustBotY - NH - NR);
  addOuterLine(xP1 + 2.95, dustBotY - NH - NR, xP1 + 2.95, yCreaseB);

  // 4. Bottom Flap 3 (tuck)
  addOuterBezier(
    { x: xP2, y: yCreaseB },
    { x: xP2 + 0.94, y: yCreaseB + 1.23 },
    { x: xP2 + 1.93, y: yCreaseB + 1.7 },
    { x: xP2 + 2.4, y: yCreaseB + 1.7 }
  );
  addOuterLine(xP2 + 2.4, yCreaseB + 1.7, xP2 + 2.4 + 8.51, yCreaseB + 1.7 + 8.51);
  addOuterLine(xP2 + 2.4 + 8.51, yCreaseB + 1.7 + 8.51, xP2 + TC, yFlapBot);
  addOuterLine(xP2 + TC, yFlapBot, xP3 - TC, yFlapBot);
  addOuterLine(xP3 - TC, yFlapBot, xP3 - TC + 5.66, yCreaseB + 10.21);
  addOuterBezier(
    { x: xP3 - TC + 5.66, y: yCreaseB + 10.21 },
    { x: xP3 - TC + 5.66 + 8.98, y: yCreaseB + 10.21 - 8.98 },
    { x: xP3 - TC + 5.66 + 9.97, y: yCreaseB + 10.21 - 10.21 },
    { x: xP3, y: yCreaseB }
  );

  // 5. Bottom Flap 4 (dust flap, no notch)
  addOuterArc({ x: xP3 + 2.54, y: yCreaseB }, { x: xP3 + 2.54 + SR, y: yCreaseB + SR }, SR, SR, 1);
  addOuterLine(xP3 + 2.54 + SR, yCreaseB + SR, xP3 + 2.54 + SR, dustBotY - DR);
  addOuterArc({ x: xP3 + 2.54 + SR, y: dustBotY - DR }, { x: xP3 + 2.54 + SR + DR, y: dustBotY }, DR, DR, 0);
  addOuterLine(xP3 + 2.54 + SR + DR, dustBotY, xP4 - DR, dustBotY);
  addOuterArc({ x: xP4 - DR, y: dustBotY }, { x: xP4, y: dustBotY - DR }, DR, DR, 0);
  addOuterLine(xP4, dustBotY - DR, xP4, yCreaseB);

  // 6. Right edge
  addOuterLine(xP4, yCreaseB, xP4, yCreaseT);

  // 7. Top Flap 4 (dust flap with notch)
  addOuterLine(xP4, yCreaseT, xP4 - NW, yCreaseT);
  addOuterLine(xP4 - NW, yCreaseT, xP4 - NW, dustTopY + NR);
  addOuterArc({ x: xP4 - NW, y: dustTopY + NR }, { x: xP4 - NW - NR, y: dustTopY }, NR, NR, 1);
  addOuterLine(xP4 - NW - NR, dustTopY, xP3 + 2.54 + SR + DR, dustTopY);
  addOuterArc({ x: xP3 + 2.54 + SR + DR, y: dustTopY }, { x: xP3 + 2.54 + SR, y: dustTopY + DR }, DR, DR, 0);
  addOuterLine(xP3 + 2.54 + SR, dustTopY + DR, xP3 + 2.54 + SR, yCreaseT - 1.7 - SR);
  addOuterArc({ x: xP3 + 2.54 + SR, y: yCreaseT - 1.7 - SR }, { x: xP3 + 2.54, y: yCreaseT - 1.7 }, SR, SR, 1);

  // 8. Top Flap 3 (tuck)
  addOuterBezier(
    { x: xP3, y: yCreaseT },
    { x: xP3 - 1.93, y: yCreaseT - 1.23 },
    { x: xP3 - 9.97, y: yCreaseT - 10.2 },
    { x: xP3 - 10.91, y: yCreaseT - 10.2 }
  );
  addOuterLine(xP3 - 10.91, yCreaseT - 10.2, xP3 - 10.91 - 5.66, yCreaseT - 10.2 - 130.4);
  addOuterLine(xP3 - 10.91 - 5.66, yCreaseT - 10.2 - 130.4, xP2 + TC, yFlapTop);
  addOuterLine(xP2 + TC, yFlapTop, xP2 + TC - 8.51, yFlapTop + 8.5);
  addOuterBezier(
    { x: xP2 + TC - 8.51, y: yFlapTop + 8.5 },
    { x: xP2 + TC - 8.51 - 2.4, y: yFlapTop + 8.5 + 1.7 },
    { x: xP2 + TC - 8.51 - 2.4 - 0.94, y: yFlapTop + 8.5 + 1.7 },
    { x: xP2, y: yCreaseT }
  );

  // 9. Top Flap 2 (dust flap, no notch)
  addOuterArc({ x: xP2 - 2.95, y: yCreaseT }, { x: xP2 - 2.95 - SR, y: yCreaseT - SR }, SR, SR, 1);
  addOuterLine(xP2 - 2.95 - SR, yCreaseT - SR, xP2 - 2.95 - SR, dustTopY + DR);
  addOuterArc({ x: xP2 - 2.95 - SR, y: dustTopY + DR }, { x: xP2 - 2.95 - SR - DR, y: dustTopY }, DR, DR, 0);
  addOuterLine(xP2 - 2.95 - SR - DR, dustTopY, xP1 + 2.54 + SR + DR, dustTopY);
  addOuterArc({ x: xP1 + 2.54 + SR + DR, y: dustTopY }, { x: xP1 + 2.54 + SR, y: dustTopY + DR }, DR, DR, 0);
  addOuterLine(xP1 + 2.54 + SR, dustTopY + DR, xP1 + 2.54 + SR, yCreaseT - 1.7 - SR);
  addOuterArc({ x: xP1 + 2.54 + SR, y: yCreaseT - 1.7 - SR }, { x: xP1 + 2.54, y: yCreaseT - 1.7 }, SR, SR, 1);

  // 10. Top Flap 1 (tuck)
  addOuterBezier(
    { x: xP1 + 2.41, y: yCreaseT - 1.7 },
    { x: xP1 + 1.47, y: yCreaseT - 1.7 },
    { x: xP1 + 0.47, y: yCreaseT - 0.47 },
    { x: xP1, y: yCreaseT }
  );
  addOuterLine(xP1, yCreaseT, xP1 - TC, yCreaseT - TC);
  addOuterLine(xP1 - TC, yCreaseT - TC, xP1 - TC, yFlapTop);
  addOuterLine(xP1 - TC, yFlapTop, xGF + TC, yFlapTop);
  addOuterLine(xGF + TC, yFlapTop, xGF + TC, yCreaseT - TC);
  addOuterLine(xGF + TC, yCreaseT - TC, xGF, yCreaseT);

  const viewW = xP4 + pad;
  const viewH = yFlapBot + pad;

  const svgContent = renderDynamicSvg(segs, { w: viewW, h: viewH });

  return {
    params,
    segments: segs,
    bbox: { w: viewW, h: viewH },
    svg: svgContent
  };
}

function renderDynamicSvg(segs: Segment[], bbox: { w: number; h: number }): string {
  const r = (v: number) => Math.round(v * 100000) / 100000;
  const cutCol = "#ED1C24";
  const crsCol = "#00A651";
  const w = r(bbox.w), h = r(bbox.h);
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">`);

  out.push(`  <g id="CREASE" fill="none" stroke="${crsCol}" stroke-width="0.45" stroke-miterlimit="10">`);
  for (const s of segs.filter(s => s.kind === "CREASE")) {
    out.push(`    <line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}" data-id="${s.svgId}"/>`);
  }
  out.push(`  </g>`);

  out.push(`  <g id="OUTER" fill="none" stroke="${cutCol}" stroke-width="0.45" stroke-miterlimit="10">`);
  for (const s of segs.filter(s => s.kind === "OUTER")) {
    if (s.geometry === "bezier" && s.bezier) {
      out.push(`    <path d="M${s.start.x},${s.start.y} C${s.bezier.c1.x},${s.bezier.c1.y} ${s.bezier.c2.x},${s.bezier.c2.y} ${s.end.x},${s.end.y}" data-id="${s.svgId}"/>`);
    } else if (s.geometry === "arc" && s.arc) {
      out.push(`    <path d="M ${s.start.x},${s.start.y} A ${s.arc.rx} ${s.arc.ry} ${s.arc.xar} ${s.arc.laf} ${s.arc.sf} ${s.end.x},${s.end.y}" data-id="${s.svgId}"/>`);
    } else if (s.geometry === "polyline" && s.points) {
      const pts = s.points.map(p => `${p.x},${p.y}`).join(" ");
      out.push(`    <polyline points="${pts}" data-id="${s.svgId}"/>`);
    } else {
      out.push(`    <line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}" data-id="${s.svgId}"/>`);
    }
  }
  out.push(`  </g>`);

  out.push(`</svg>`);
  return out.join("\n");
}
