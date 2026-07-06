// Generic Box — Parametric SVG Engine v2
// ==========================================
// Handles the standard 4-panel box:
//   [GlueFlap] [Face=W] [Depth=D] [Face=W] [Depth=D]
// With GF on the left (chamfered or straight).

import type { BoxTemplateConfig, BoxParams, BoxGeometry } from './types';

// ---- SVG helpers ----------------------------------------------------------
const fmt = (v: number) => v.toFixed(4);
const line = (x1: number, y1: number, x2: number, y2: number, cls: string) =>
  `<line class="${cls}" x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}"/>`;
const polyline = (pts: [number, number][], cls: string) =>
  `<polyline class="${cls}" points="${pts.map(p => `${fmt(p[0])},${fmt(p[1])}`).join(' ')}"/>`;

// ---- Main Engine ----------------------------------------------------------
export function buildGenericBoxGeometry(
  cfg: BoxTemplateConfig,
  params: BoxParams,
): BoxGeometry {
  const { W, D, H, GF } = params;
  const pad = cfg.padding ?? 2;

  // X positions
  const xGF  = GF;              // glue flap right (first crease)
  const xF1  = GF + W;          // Face1 right
  const xD1  = GF + W + D;      // Depth1 right
  const xF2  = GF + 2 * W + D;  // Face2 right
  const xD2  = GF + 2 * W + 2 * D; // Depth2 right (= outer right edge)

  const yTop = pad;
  const yBot = pad + H;

  const viewW = xD2 + pad;
  const viewH = H + pad * 2;

  const cuts: string[] = [];
  const creases: string[] = [];

  // --- Outer cut contour ---
  // Top edge
  cuts.push(line(0, yTop, xD2, yTop, 'cls-2'));
  // Right edge
  cuts.push(line(xD2, yTop, xD2, yBot, 'cls-2'));
  // Bottom edge
  cuts.push(line(xD2, yBot, 0, yBot, 'cls-2'));

  // Left edge (glue flap)
  const gf = cfg.glueFlap;
  if (gf && gf.type === 'chamfer') {
    const dy = gf.chamfer?.dy ?? 8.44;
    cuts.push(polyline([
      [xGF, yTop],
      [0,   yTop + dy],
      [0,   yBot - dy],
      [xGF, yBot],
    ], 'cls-2'));
  } else {
    // Straight left edge
    cuts.push(line(0, yTop, 0, yBot, 'cls-2'));
  }

  // --- Creases (vertical panel boundaries) ---
  creases.push(line(xGF, yTop, xGF, yBot, 'cls-1'));  // GF → Face1
  creases.push(line(xF1, yTop, xF1, yBot, 'cls-1'));  // Face1 → Depth1
  creases.push(line(xD1, yTop, xD1, yBot, 'cls-1'));  // Depth1 → Face2
  creases.push(line(xF2, yTop, xF2, yBot, 'cls-1'));  // Face2 → Depth2

  const svg = [
    `<svg id="${cfg.id}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(viewW)} ${fmt(viewH)}">`,
    `<defs><style>.cls-1,.cls-2{fill:none;stroke-miterlimit:10;stroke-width:4px;}.cls-1{stroke:#009640;}.cls-2{stroke:#e30613;}</style></defs>`,
    ...creases,
    ...cuts,
    '</svg>',
  ].join('');

  return {
    svg,
    bbox: { w: viewW, h: viewH },
    segments: cuts.length + creases.length,
    panelWidths: [W, D, W, D],
  };
}
