// A01.01.00.00 — Geometry Engine (Parametric SVG Generator)
// ---------------------------------------------------------
// Generates a full SVG dieline string from user-supplied dimensions.
// No reference SVG needed — the geometry is mathematically defined.
//
// SVG structure (viewBox-normalized):
//   CREASE: 4 vertical lines (green #009640)
//   CUT: top/right/bottom horizontals + glue-flap polyline (red #e30613)

import type { A01010000Params, A01010000Geometry } from './types';

// ---- helpers ---------------------------------------------------------------
const mm = (v: number) => `${v}`;
const line = (x1: number, y1: number, x2: number, y2: number, cls: string) =>
  `<line class="${cls}" x1="${mm(x1)}" y1="${mm(y1)}" x2="${mm(x2)}" y2="${mm(y2)}"/>`;

const polyline = (points: [number, number][], cls: string) =>
  `<polyline class="${cls}" points="${points.map(p => `${p[0]},${p[1]}`).join(' ')}"/>`;

// ---- main engine -----------------------------------------------------------
export function buildA01010000Geometry(params: A01010000Params): A01010000Geometry {
  const W = params.W;
  const D = params.D;
  const H = params.H;
  const GF = params.GF;
  const GH = params.GH ?? 8.44;

  // Compute X anchor positions
  const xGF  = GF;                    // glue flap right = first crease
  const xF1  = GF + W;                // Face1 right
  const xD1  = GF + W + D;            // Depth1 right
  const xF2  = GF + 2 * W + D;        // Face2 right
  const xD2  = GF + 2 * W + 2 * D;    // Depth2 right (= outer right edge)

  // Y anchors
  const yTop = 0;
  const yBot = H;

  // ---- Assemble SVG parts --------------------------------------------------

  // --- CUT (red #e30613) ---
  const cuts: string[] = [];

  // Top edge
  cuts.push(line(xGF, yTop, xD2, yTop, 'cls-2'));
  // Right edge
  cuts.push(line(xD2, yTop, xD2, yBot, 'cls-2'));
  // Bottom edge
  cuts.push(line(xD2, yBot, xGF, yBot, 'cls-2'));
  // Left glue-flap chamfer
  cuts.push(polyline([
    [xGF,  yTop],
    [0,    GH],
    [0,    H - GH],
    [xGF,  yBot],
  ], 'cls-2'));

  // --- CREASE (green #009640) ---
  const creases: string[] = [];

  // Glue flap crease
  creases.push(line(xGF,  yTop, xGF,  yBot, 'cls-1'));
  // Face1–Depth1 crease
  creases.push(line(xF1,  yTop, xF1,  yBot, 'cls-1'));
  // Depth1–Face2 crease
  creases.push(line(xD1,  yTop, xD1,  yBot, 'cls-1'));
  // Face2–Depth2 crease
  creases.push(line(xF2,  yTop, xF2,  yBot, 'cls-1'));

  const viewW = Math.max(xD2 + 2, xD2 + 2);
  const viewH = yBot + 2;

  const svgContent = [
    `<svg id="a01_01_00_00" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewW} ${viewH}">`,
    `<defs><style>.cls-1,.cls-2{fill:none;stroke-miterlimit:10;stroke-width:4px;}.cls-1{stroke:#009640;}.cls-2{stroke:#e30613;}</style></defs>`,
    ...cuts,
    ...creases,
    '</svg>',
  ].join('');

  return {
    svg: svgContent,
    bbox: { w: viewW, h: viewH },
    segments: cuts.length + creases.length, // 8 segments
  };
}
