// A01.70.00.00 — Geometry Engine (Parametric SVG Generator)
// ---------------------------------------------------------
// Generates a full SVG dieline string from user-supplied dimensions.
// Mathematically defined based on ECMA A01.70.00.00 specifications.

import type { A01700000Params, A01700000Geometry } from './types';

// ---- helpers ---------------------------------------------------------------
const mm = (v: number) => `${parseFloat(v.toFixed(4))}`;
const line = (x1: number, y1: number, x2: number, y2: number, cls: string) =>
  `<line class="${cls}" x1="${mm(x1)}" y1="${mm(y1)}" x2="${mm(x2)}" y2="${mm(y2)}"/>`;

const polyline = (points: [number, number][], cls: string) =>
  `<polyline class="${cls}" points="${points.map(p => `${mm(p[0])},${mm(p[1])}`).join(' ')}"/>`;

// ---- main engine -----------------------------------------------------------
export function buildA01700000Geometry(params: A01700000Params): A01700000Geometry {
  const W = params.W;
  const D = params.D;
  const H = params.H;
  const GF = params.GF;
  const GH = params.GH ?? 8.44;
  const FH = params.FH ?? 110.7;
  const SF = params.SF ?? 22.67;
  const GD = params.GD ?? 50.92;

  const clearance = 2.21;
  const deltaD = 1.41;

  // X offset and positions
  const xStart = 2;
  const xGF = xStart + GF;
  const xF1 = xGF + W;
  const xD1 = xF1 + D;
  const xF2 = xD1 + W;
  const xD2 = xF2 + (D - deltaD);

  const xMid1 = xF1 + D / 2;
  const xMid2 = xF2 + D / 2;

  // Y positions
  const yTopCut = 2;
  const yTopCrease = yTopCut + SF;
  const yMain = yTopCrease + FH;
  const yBot = yMain + H;

  // ---- Assemble SVG parts --------------------------------------------------

  // --- CUT (red #e30613 / cls-1) ---
  const cuts: string[] = [];
  
  // Glue flap bottom cut (polyline)
  cuts.push(polyline([
    [xStart, yMain],
    [xStart, yBot - GH],
    [xGF, yBot]
  ], 'cls-1'));

  // Left edge top cut
  cuts.push(line(xStart, yMain, xStart, yTopCut, 'cls-1'));
  // Top edge cut
  cuts.push(line(xStart, yTopCut, xD2, yTopCut, 'cls-1'));
  // Right edge top cut
  cuts.push(line(xD2, yMain, xD2, yTopCut, 'cls-1'));
  // Right edge bottom cut
  cuts.push(line(xD2, yMain, xD2, yBot, 'cls-1'));
  // Bottom edge cut
  cuts.push(line(xGF, yBot, xD2, yBot, 'cls-1'));

  // --- YELLOW CREASE/REVERSE (yellow #fc0 / cls-2) ---
  const yellowCreases: string[] = [];

  // Diagonal fold on glue flap
  yellowCreases.push(line(xGF, yMain, xStart, yMain - GD, 'cls-2'));
  // Triangle 1 on Depth 1 flap
  yellowCreases.push(polyline([
    [xF1, yMain],
    [xMid1, yTopCrease],
    [xD1, yMain]
  ], 'cls-2'));
  // Triangle 2 on Depth 2 flap
  yellowCreases.push(polyline([
    [xF2, yMain],
    [xMid2, yTopCrease],
    [xD2, yMain - clearance]
  ], 'cls-2'));
  // Vertical line 1 in Depth 1 flap
  yellowCreases.push(line(xMid1, yTopCrease, xMid1, yTopCut, 'cls-2'));
  // Vertical line 2 in Depth 2 flap
  yellowCreases.push(line(xMid2, yTopCrease, xMid2, yTopCut, 'cls-2'));

  // --- CREASE (green #009640 / cls-3) ---
  const creases: string[] = [];

  // Vertical flap creases (top)
  creases.push(line(xGF, yMain, xGF, yTopCut, 'cls-3'));
  creases.push(line(xF1, yMain, xF1, yTopCut, 'cls-3'));
  creases.push(line(xD1, yMain, xD1, yTopCut, 'cls-3'));
  creases.push(line(xF2, yMain, xF2, yTopCut, 'cls-3'));

  // Horizontal top crease of sealing flap
  creases.push(line(xStart, yTopCrease, xD2, yTopCrease, 'cls-3'));

  // Vertical panel creases (bottom)
  creases.push(line(xGF, yMain, xGF, yBot, 'cls-3'));
  creases.push(line(xF1, yMain, xF1, yBot, 'cls-3'));
  creases.push(line(xD1, yMain, xD1, yBot, 'cls-3'));
  creases.push(line(xF2, yMain, xF2, yBot, 'cls-3'));

  // Horizontal main crease
  creases.push(line(xStart, yMain, xD2, yMain, 'cls-3'));

  const viewW = xD2 + 2;
  const viewH = yBot + 2;

  const svgContent = [
    `<svg id="a01_70_00_00" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${mm(viewW)} ${mm(viewH)}">`,
    `<defs><style>.cls-1,.cls-2,.cls-3{fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-width:4px;}.cls-1{stroke:#e30613;}.cls-2{stroke:#fc0;}.cls-3{stroke:#009640;}</style></defs>`,
    ...cuts,
    ...yellowCreases,
    ...creases,
    '</svg>',
  ].join('');

  return {
    svg: svgContent,
    bbox: { w: viewW, h: viewH },
    segments: cuts.length + yellowCreases.length + creases.length,
  };
}
