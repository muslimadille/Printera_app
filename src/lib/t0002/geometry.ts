// T0002 — Geometry Engine (Parametric SVG Generator)
// ---------------------------------------------------------

import type { T0002Params, T0002Geometry } from './types';

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

export function buildT0002Geometry(params: T0002Params): T0002Geometry {
  const W = params.W;
  const H = params.H;
  const D = params.D;
  const LH = params.LH;
  const LFH = params.LFH;
  const LFR = params.LFR;
  const DFW = params.DFW;
  const DFI = params.DFI;
  const DFS = params.DFS;
  const LTW = params.LTW;
  const LTS1 = params.LTS1;
  const LTS2 = params.LTS2;
  const LTN = params.LTN;
  const C1 = params.C1;
  const C2 = params.C2;

  const pad = 2;

  // ---- X positions ----
  const xEdgeL = pad;
  const xLockCreaseL = pad + LTW;
  const xMainCreaseL = pad + LTW + D;
  const xMainCreaseR = pad + LTW + D + W;
  const xLockCreaseR = pad + LTW + D + W + D;
  const xEdgeR = pad + LTW + D + W + D + LTW;

  // ---- Y positions ----
  const yTopFlapCut = pad;
  const yLidFlapCrease = pad + LFH;
  const yLidCrease = pad + LFH + LH;
  const yMiddleCreaseT = pad + LFH + LH + D;
  const yMiddleCreaseB = pad + LFH + LH + D + H;
  const yBottomCut = pad + LFH + LH + D + H + D;

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

  // ========== CREASE LINES (green #00a651) ==========
  // Horizontal Creases
  addCrease(xMainCreaseL + 9, yLidFlapCrease, xMainCreaseR - 9, yLidFlapCrease);
  addCrease(xMainCreaseL, yLidCrease, xMainCreaseR, yLidCrease);
  addCrease(xMainCreaseL, yMiddleCreaseT, xMainCreaseR, yMiddleCreaseT);
  addCrease(xMainCreaseL, yMiddleCreaseB, xMainCreaseR, yMiddleCreaseB);

  // Vertical Creases
  addCrease(xMainCreaseL, yLidCrease, xMainCreaseL, yBottomCut);
  addCrease(xMainCreaseR, yLidCrease, xMainCreaseR, yBottomCut);

  // Side Wall Creases
  addCrease(xLockCreaseL, yMiddleCreaseT + C2, xLockCreaseL, yMiddleCreaseB - C2);
  addCrease(xLockCreaseR, yMiddleCreaseT + C2, xLockCreaseR, yMiddleCreaseB - C2);

  // Diagonal Creases
  const sideW = xEdgeR - xMainCreaseR - C1; // width of side wall folding part
  addCrease(xMainCreaseR + C1, yMiddleCreaseT + C2, xEdgeR, yMiddleCreaseT + C2 + sideW);
  addCrease(xMainCreaseR + C1, yMiddleCreaseB - C2, xEdgeR, yMiddleCreaseB - C2 - sideW);
  addCrease(xMainCreaseL - C1, yMiddleCreaseT + C2, xEdgeL, yMiddleCreaseT + C2 + sideW);
  addCrease(xMainCreaseL - C1, yMiddleCreaseB - C2, xEdgeL, yMiddleCreaseB - C2 - sideW);


  // ========== OUTER CUT CONTOUR (red #ed1c24) ==========
  // We'll add them panel by panel to form a continuous closed path around the dieline

  // 1. Lid Flap Notch Left
  addOuterPolyline([
    { x: xMainCreaseL + 9, y: yLidFlapCrease + 1 },
    { x: xMainCreaseL + 9, y: yLidFlapCrease - 1 },
    { x: xMainCreaseL, y: yLidFlapCrease - 1 }
  ]);

  // 2. Lid Flap left edge vertical
  const topFlapVertHeight = LFH - LFR + 1;
  addOuterLine(xMainCreaseL, yLidFlapCrease - 1, xMainCreaseL, yLidFlapCrease - 1 - topFlapVertHeight);

  // 3. Lid Flap left corner rounded arc
  addOuterArc(
    { x: xMainCreaseL, y: yLidFlapCrease - 1 - topFlapVertHeight },
    { x: xMainCreaseL + LFR, y: yTopFlapCut },
    LFR, LFR, 1
  );

  // 4. Lid Flap top edge horizontal
  addOuterLine(xMainCreaseL + LFR, yTopFlapCut, xMainCreaseR - LFR, yTopFlapCut);

  // 5. Lid Flap right corner rounded arc
  addOuterArc(
    { x: xMainCreaseR - LFR, y: yTopFlapCut },
    { x: xMainCreaseR, y: yLidFlapCrease - 1 - topFlapVertHeight },
    LFR, LFR, 1
  );

  // 6. Lid Flap right edge vertical
  addOuterLine(xMainCreaseR, yLidFlapCrease - 1 - topFlapVertHeight, xMainCreaseR, yLidFlapCrease - 1);

  // 7. Lid Flap Notch Right
  addOuterPolyline([
    { x: xMainCreaseR, y: yLidFlapCrease - 1 },
    { x: xMainCreaseR - 9, y: yLidFlapCrease - 1 },
    { x: xMainCreaseR - 9, y: yLidFlapCrease + 1 }
  ]);

  // 8. Lid panel right edge vertical
  addOuterLine(xMainCreaseR, yLidFlapCrease - 1, xMainCreaseR, yLidCrease);

  // 9. Dust flap top-right corner notch/slope
  addOuterLine(xMainCreaseR, yLidCrease, xMainCreaseR + DFI, yLidCrease + DFI);

  // 10. Top-Right Dust Flap
  addOuterLine(xMainCreaseR + DFI, yLidCrease + DFI, xMainCreaseR + DFW, yLidCrease + DFI);
  addOuterLine(xMainCreaseR + DFW, yLidCrease + DFI, xMainCreaseR + DFW, yMiddleCreaseT - DFI - DFS);
  addOuterLine(xMainCreaseR + DFW, yMiddleCreaseT - DFI - DFS, xMainCreaseR + DFI, yMiddleCreaseT - DFI);
  addOuterLine(xMainCreaseR + DFI, yMiddleCreaseT - DFI, xMainCreaseR, yMiddleCreaseT);

  // 11. Right Side folding panel (on Middle panel - Base)
  addOuterLine(xMainCreaseR, yMiddleCreaseT, xMainCreaseR + C1, yMiddleCreaseT + C2);
  addOuterLine(xMainCreaseR + C1, yMiddleCreaseT + C2, xLockCreaseR, yMiddleCreaseT + C2);
  addOuterLine(xLockCreaseR, yMiddleCreaseT + C2, xEdgeR, yMiddleCreaseT + C2 + LTS1);
  addOuterLine(xEdgeR, yMiddleCreaseT + C2 + LTS1, xEdgeR, yMiddleCreaseB - C2 - LTS2);
  addOuterLine(xEdgeR, yMiddleCreaseB - C2 - LTS2, xLockCreaseR + LTN, yMiddleCreaseB - C2);
  addOuterLine(xLockCreaseR + LTN, yMiddleCreaseB - C2, xMainCreaseR + C1, yMiddleCreaseB - C2);
  addOuterLine(xMainCreaseR + C1, yMiddleCreaseB - C2, xMainCreaseR, yMiddleCreaseB);

  // 12. Bottom-Right Dust Flap
  addOuterLine(xMainCreaseR, yMiddleCreaseB, xMainCreaseR + DFI, yMiddleCreaseB + DFI);
  addOuterLine(xMainCreaseR + DFI, yMiddleCreaseB + DFI, xMainCreaseR + DFW, yMiddleCreaseB + DFI + DFS);
  addOuterLine(xMainCreaseR + DFW, yMiddleCreaseB + DFI + DFS, xMainCreaseR + DFW, yBottomCut - DFI);
  addOuterLine(xMainCreaseR + DFW, yBottomCut - DFI, xMainCreaseR + DFI, yBottomCut - DFI);
  addOuterLine(xMainCreaseR + DFI, yBottomCut - DFI, xMainCreaseR, yBottomCut);

  // 13. Bottom edge of bottom panel
  addOuterLine(xMainCreaseR, yBottomCut, xMainCreaseL, yBottomCut);

  // 14. Bottom-Left Dust Flap
  addOuterLine(xMainCreaseL, yBottomCut, xMainCreaseL - DFI, yBottomCut - DFI);
  addOuterLine(xMainCreaseL - DFI, yBottomCut - DFI, xMainCreaseL - DFW, yBottomCut - DFI);
  addOuterLine(xMainCreaseL - DFW, yBottomCut - DFI, xMainCreaseL - DFW, yMiddleCreaseB + DFI + DFS);
  addOuterLine(xMainCreaseL - DFW, yMiddleCreaseB + DFI + DFS, xMainCreaseL - DFI, yMiddleCreaseB + DFI);
  addOuterLine(xMainCreaseL - DFI, yMiddleCreaseB + DFI, xMainCreaseL, yMiddleCreaseB);

  // 15. Left Side folding panel
  addOuterLine(xMainCreaseL, yMiddleCreaseB, xMainCreaseL - C1, yMiddleCreaseB - C2);
  addOuterLine(xMainCreaseL - C1, yMiddleCreaseB - C2, xLockCreaseL - LTN, yMiddleCreaseB - C2);
  addOuterLine(xLockCreaseL - LTN, yMiddleCreaseB - C2, xEdgeL, yMiddleCreaseB - C2 - LTS2);
  addOuterLine(xEdgeL, yMiddleCreaseB - C2 - LTS2, xEdgeL, yMiddleCreaseT + C2 + LTS1);
  addOuterLine(xEdgeL, yMiddleCreaseT + C2 + LTS1, xLockCreaseL, yMiddleCreaseT + C2);
  addOuterLine(xLockCreaseL, yMiddleCreaseT + C2, xMainCreaseL - C1, yMiddleCreaseT + C2);
  addOuterLine(xMainCreaseL - C1, yMiddleCreaseT + C2, xMainCreaseL, yMiddleCreaseT);

  // 16. Top-Left Dust Flap
  addOuterLine(xMainCreaseL, yMiddleCreaseT, xMainCreaseL - DFI, yMiddleCreaseT - DFI);
  addOuterLine(xMainCreaseL - DFI, yMiddleCreaseT - DFI, xMainCreaseL - DFW, yMiddleCreaseT - DFI - DFS);
  addOuterLine(xMainCreaseL - DFW, yMiddleCreaseT - DFI - DFS, xMainCreaseL - DFW, yLidCrease + DFI);
  addOuterLine(xMainCreaseL - DFW, yLidCrease + DFI, xMainCreaseL - DFI, yLidCrease + DFI);
  addOuterLine(xMainCreaseL - DFI, yLidCrease + DFI, xMainCreaseL, yLidCrease);

  // 17. Lid panel left edge vertical
  addOuterLine(xMainCreaseL, yLidCrease, xMainCreaseL, yLidFlapCrease - 1);


  // ========== BOUNDING BOX AND SVG RENDERING ==========
  const bboxW = xEdgeR + pad;
  const bboxH = yBottomCut + pad;

  const svgElements = segs.map(s => {
    const color = s.kind === "CREASE" ? "#00a651" : "#ed1c24";
    if (s.geometry === "line") {
      return `<line x1="${s.start.x.toFixed(4)}" y1="${s.start.y.toFixed(4)}" x2="${s.end.x.toFixed(4)}" y2="${s.end.y.toFixed(4)}" stroke="${color}" stroke-width="4" fill="none" />`;
    }
    if (s.geometry === "polyline" && s.points) {
      const pts = s.points.map(pt => `${pt.x.toFixed(4)},${pt.y.toFixed(4)}`).join(" ");
      return `<polyline points="${pts}" stroke="${color}" stroke-width="4" fill="none" />`;
    }
    if (s.geometry === "arc" && s.arc) {
      return `<path d="M ${s.start.x.toFixed(4)},${s.start.y.toFixed(4)} A ${s.arc.rx.toFixed(4)} ${s.arc.ry.toFixed(4)} ${s.arc.xar} ${s.arc.laf} ${s.arc.sf} ${s.end.x.toFixed(4)},${s.end.y.toFixed(4)}" stroke="${color}" stroke-width="4" fill="none" />`;
    }
    return '';
  }).join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bboxW} ${bboxH}" width="${bboxW}mm" height="${bboxH}mm">\n${svgElements}\n</svg>`;

  return {
    params,
    segments: segs,
    bbox: { w: bboxW, h: bboxH },
    svg
  };
}
