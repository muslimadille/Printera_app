import { Gable_Box_1Dimensions, GABLE_BOX_1_DEFAULTS } from './types';

export interface Gable_Box_1Segment {
  id: number;
  svgId: string;
  kind: 'OUTER' | 'CUT' | 'CREASE';
  geometry: 'line' | 'polyline' | 'bezier' | 'circle' | 'path';
  start: { x: number; y: number };
  end: { x: number; y: number };
  points?: { x: number; y: number }[];
  d?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface Gable_Box_1Geometry {
  width: number;
  height: number;
  segments: Gable_Box_1Segment[];
  svg: string;
}

export function generateGable_Box_1Geometry(dims: Gable_Box_1Dimensions): Gable_Box_1Geometry {
  const W = Math.max(30, dims.width || GABLE_BOX_1_DEFAULTS.width);
  const H = Math.max(30, dims.height || GABLE_BOX_1_DEFAULTS.height);
  const D = Math.max(20, dims.depth || GABLE_BOX_1_DEFAULTS.depth);
  const Gf = Math.max(10, dims.glueFlap || GABLE_BOX_1_DEFAULTS.glueFlap);

  // Scaled proportions from the standard K027A master dieline
  // In K027A, ALL top flaps are flush at y=0, and all bottom flaps are flush at y=totalHeight
  const baseScale = D / 120;
  const topTotalH = 142.5 * baseScale;
  const snapFlapH = 84.0 * baseScale;

  const totalHeight = topTotalH + H + snapFlapH;
  const totalWidth = Gf + W + D + W + D;

  // X Coordinates of vertical panel boundaries
  const x0 = 0;           // Far left of glue flap
  const x1 = Gf;          // Front panel left / Glue crease
  const x2 = x1 + W;      // Gable 1 left
  const x3 = x2 + D;      // Back panel left
  const x4 = x3 + W;      // Gable 2 left
  const x5 = x4 + D;      // Far right edge

  // Y Coordinates of horizontal datum lines (Flush alignment across all tabs)
  const yTopAll = 0;                                 // Topmost flush edge of ALL top flaps (Headers & Handle tabs)
  const yHeaderCrease1 = 31.0 * baseScale;           // Upper fold crease on Front & Back headers
  const yHeaderCrease2 = 61.0 * baseScale;           // Lower fold crease on Front & Back headers / Gable Step
  const yGableApex = 62.5 * baseScale;               // Junction where gable triangular slopes meet handle tabs
  const yTopBody = topTotalH;                        // Main horizontal crease line (top of body)
  const yBotBody = yTopBody + H;                     // Main horizontal crease line (bottom of body)
  const yBottom = totalHeight;                       // Bottommost flush edge of all bottom flaps

  const handleTabW = Math.min(D * 0.46, 54 * baseScale);
  const holeDia = dims.holeDiameter ?? 5;
  const holeMarginX = dims.holeMarginX ?? Math.min(W * 0.25, 95 * (W / 370));
  const holeY = yHeaderCrease1;                      // Punch holes are precisely on the upper fold crease!

  const segments: Gable_Box_1Segment[] = [];
  let segId = 1;

  const addLine = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    kind: 'OUTER' | 'CUT' | 'CREASE',
    color: string
  ) => {
    segments.push({
      id: segId++,
      svgId: `seg_${segId}`,
      kind,
      geometry: 'line',
      start: p1,
      end: p2,
      strokeColor: color,
      strokeWidth: 0.45,
    });
  };

  const addPath = (
    d: string,
    kind: 'OUTER' | 'CUT' | 'CREASE',
    color: string,
    startPt: { x: number; y: number } = { x: 0, y: 0 },
    endPt: { x: number; y: number } = { x: 0, y: 0 }
  ) => {
    segments.push({
      id: segId++,
      svgId: `path_${segId}`,
      kind,
      geometry: 'path',
      start: startPt,
      end: endPt,
      d,
      strokeColor: color,
      strokeWidth: 0.45,
    });
  };

  // Exact Colors from K027A SVG specification
  const COLOR_CUT = '#e21f26';      // Red cut
  const COLOR_CREASE = '#0a9748';   // Green crease

  // ───────────────────────────────────────────────
  // 1. VERTICAL INTERNAL CREASE LINES
  // ───────────────────────────────────────────────
  addLine({ x: x1, y: yTopBody }, { x: x1, y: yBotBody }, 'CREASE', COLOR_CREASE);
  addLine({ x: x2, y: yTopBody }, { x: x2, y: yBotBody }, 'CREASE', COLOR_CREASE);
  addLine({ x: x3, y: yTopBody }, { x: x3, y: yBotBody }, 'CREASE', COLOR_CREASE);
  addLine({ x: x4, y: yTopBody }, { x: x4, y: yBotBody }, 'CREASE', COLOR_CREASE);

  // Vertical crease lines extending up from yTopBody to yHeaderCrease2 on Front & Back panels
  addLine({ x: x1, y: yTopBody }, { x: x1, y: yHeaderCrease2 }, 'CREASE', COLOR_CREASE);
  addLine({ x: x2, y: yTopBody }, { x: x2, y: yHeaderCrease2 }, 'CREASE', COLOR_CREASE);
  addLine({ x: x3, y: yTopBody }, { x: x3, y: yHeaderCrease2 }, 'CREASE', COLOR_CREASE);
  addLine({ x: x4, y: yTopBody }, { x: x4, y: yHeaderCrease2 }, 'CREASE', COLOR_CREASE);

  // ───────────────────────────────────────────────
  // 2. HORIZONTAL CREASE LINES
  // ───────────────────────────────────────────────
  // Main top body crease line across all panels
  addLine({ x: x0, y: yTopBody }, { x: x5, y: yTopBody }, 'CREASE', COLOR_CREASE);

  // Main bottom body crease line across all panels
  addLine({ x: x1, y: yBotBody }, { x: x5, y: yBotBody }, 'CREASE', COLOR_CREASE);

  // Front & Back Header Fold-over Crease Lines
  addLine({ x: x1, y: yHeaderCrease1 }, { x: x2, y: yHeaderCrease1 }, 'CREASE', COLOR_CREASE);
  addLine({ x: x1, y: yHeaderCrease2 }, { x: x2, y: yHeaderCrease2 }, 'CREASE', COLOR_CREASE);

  addLine({ x: x3, y: yHeaderCrease1 }, { x: x4, y: yHeaderCrease1 }, 'CREASE', COLOR_CREASE);
  addLine({ x: x3, y: yHeaderCrease2 }, { x: x4, y: yHeaderCrease2 }, 'CREASE', COLOR_CREASE);

  // Glue flap diagonal crease line
  addLine({ x: x0, y: yHeaderCrease2 }, { x: x1, y: yTopBody }, 'CREASE', COLOR_CREASE);

  // ───────────────────────────────────────────────
  // 3. GABLE TRIANGULAR CREASE LINES (Panels 2 and 4)
  // ───────────────────────────────────────────────
  const tabOffset = (D - handleTabW) / 2;

  // Gable 1 (Panel 2)
  const xGable1Left = x2 + tabOffset;
  const xGable1Right = x2 + D - tabOffset;
  addLine({ x: x2, y: yTopBody }, { x: xGable1Left, y: yGableApex }, 'CREASE', COLOR_CREASE);
  addLine({ x: x3, y: yTopBody }, { x: xGable1Right, y: yGableApex }, 'CREASE', COLOR_CREASE);
  addLine({ x: xGable1Left, y: yGableApex }, { x: xGable1Right, y: yGableApex }, 'CREASE', COLOR_CREASE);

  // Gable 2 (Panel 4)
  const xGable2Left = x4 + tabOffset;
  const xGable2Right = x4 + D - tabOffset;
  addLine({ x: x4, y: yTopBody }, { x: xGable2Left, y: yGableApex }, 'CREASE', COLOR_CREASE);
  addLine({ x: x5, y: yTopBody }, { x: xGable2Right, y: yGableApex }, 'CREASE', COLOR_CREASE);
  addLine({ x: xGable2Left, y: yGableApex }, { x: xGable2Right, y: yGableApex }, 'CREASE', COLOR_CREASE);

  // ───────────────────────────────────────────────
  // 4. ROPE PUNCH HOLES (Circular die-cuts on Panels 1 & 3)
  // ───────────────────────────────────────────────
  const rHole = holeDia / 2;

  const holeCenters = [
    { x: x1 + holeMarginX, y: holeY },
    { x: x2 - holeMarginX, y: holeY },
    { x: x3 + holeMarginX, y: holeY },
    { x: x4 - holeMarginX, y: holeY },
  ];

  holeCenters.forEach(hc => {
    const dCircle = `M ${hc.x - rHole},${hc.y} A ${rHole},${rHole} 0 1,0 ${hc.x + rHole},${hc.y} A ${rHole},${rHole} 0 1,0 ${hc.x - rHole},${hc.y}`;
    addPath(dCircle, 'CUT', COLOR_CUT, { x: hc.x - rHole, y: hc.y }, { x: hc.x - rHole, y: hc.y });
  });

  // ───────────────────────────────────────────────
  // 5. VERTICAL HANDLE CUT SLOTS (On Gable tabs 1 & 2)
  // ───────────────────────────────────────────────
  const slotW = 2.5;
  const slotH = 77 * baseScale;
  const slotYTop = 24 * baseScale;
  const rSlot = slotW / 2;

  // Gable 1 Slot
  const xSlot1Center = x2 + D / 2;
  const dSlot1 = `M ${xSlot1Center - rSlot},${slotYTop + rSlot} A ${rSlot},${rSlot} 0 0,1 ${xSlot1Center + rSlot},${slotYTop + rSlot} L ${xSlot1Center + rSlot},${slotYTop + slotH - rSlot} A ${rSlot},${rSlot} 0 0,1 ${xSlot1Center - rSlot},${slotYTop + slotH - rSlot} Z`;
  addPath(dSlot1, 'CUT', COLOR_CUT, { x: xSlot1Center - rSlot, y: slotYTop + rSlot }, { x: xSlot1Center - rSlot, y: slotYTop + rSlot });

  // Gable 2 Slot
  const xSlot2Center = x4 + D / 2;
  const dSlot2 = `M ${xSlot2Center - rSlot},${slotYTop + rSlot} A ${rSlot},${rSlot} 0 0,1 ${xSlot2Center + rSlot},${slotYTop + rSlot} L ${xSlot2Center + rSlot},${slotYTop + slotH - rSlot} A ${rSlot},${rSlot} 0 0,1 ${xSlot2Center - rSlot},${slotYTop + slotH - rSlot} Z`;
  addPath(dSlot2, 'CUT', COLOR_CUT, { x: xSlot2Center - rSlot, y: slotYTop + rSlot }, { x: xSlot2Center - rSlot, y: slotYTop + rSlot });

  // ───────────────────────────────────────────────
  // 6. OUTER CUT BOUNDARY CONTOUR (Flush Top & Flush Bottom)
  // ───────────────────────────────────────────────
  const cornerR = 10;
  const tabCornerR = 5;
  let dOuter = '';

  // ── Top Left: Glue Flap Top Edge ──
  dOuter += `M ${x0},${yHeaderCrease2} `;
  dOuter += `L ${x1},${yHeaderCrease2} `;

  // ── Front Top Header (Panel 1) - Reaches yTopAll (0) ──
  dOuter += `L ${x1},${yTopAll + cornerR} `;
  dOuter += `A ${cornerR},${cornerR} 0 0,1 ${x1 + cornerR},${yTopAll} `;
  dOuter += `L ${x2 - cornerR},${yTopAll} `;
  dOuter += `A ${cornerR},${cornerR} 0 0,1 ${x2},${yTopAll + cornerR} `;
  dOuter += `L ${x2},${yHeaderCrease2} `;

  // ── Gable 1 Top Handle Profile (Panel 2) - Reaches yTopAll (0) ──
  dOuter += `L ${xGable1Left},${yHeaderCrease2} `;
  dOuter += `L ${xGable1Left},${yTopAll + tabCornerR} `;
  dOuter += `A ${tabCornerR},${tabCornerR} 0 0,1 ${xGable1Left + tabCornerR},${yTopAll} `;
  dOuter += `L ${xGable1Right - tabCornerR},${yTopAll} `;
  dOuter += `A ${tabCornerR},${tabCornerR} 0 0,1 ${xGable1Right},${yTopAll + tabCornerR} `;
  dOuter += `L ${xGable1Right},${yHeaderCrease2} `;
  dOuter += `L ${x3},${yHeaderCrease2} `;

  // ── Back Top Header (Panel 3) - Reaches yTopAll (0) ──
  dOuter += `L ${x3},${yTopAll + cornerR} `;
  dOuter += `A ${cornerR},${cornerR} 0 0,1 ${x3 + cornerR},${yTopAll} `;
  dOuter += `L ${x4 - cornerR},${yTopAll} `;
  dOuter += `A ${cornerR},${cornerR} 0 0,1 ${x4},${yTopAll + cornerR} `;
  dOuter += `L ${x4},${yHeaderCrease2} `;

  // ── Gable 2 Top Handle Profile (Panel 4) - Reaches yTopAll (0) ──
  dOuter += `L ${xGable2Left},${yHeaderCrease2} `;
  dOuter += `L ${xGable2Left},${yTopAll + tabCornerR} `;
  dOuter += `A ${tabCornerR},${tabCornerR} 0 0,1 ${xGable2Left + tabCornerR},${yTopAll} `;
  dOuter += `L ${xGable2Right - tabCornerR},${yTopAll} `;
  dOuter += `A ${tabCornerR},${tabCornerR} 0 0,1 ${xGable2Right},${yTopAll + tabCornerR} `;
  dOuter += `L ${xGable2Right},${yHeaderCrease2} `;
  dOuter += `L ${x5},${yHeaderCrease2} `;

  // ── Far Right Body Edge ──
  dOuter += `L ${x5},${yBotBody} `;

  // ── Bottom Flap 4 (under Gable 2 / Panel 4) - Reaches yBottom ──
  const rNotch = 5;
  const flap4MidX = x4 + (D * 0.5);
  dOuter += `L ${flap4MidX + 10},${yBotBody + snapFlapH * 0.72} `;
  dOuter += `L ${flap4MidX + 5},${yBottom - tabCornerR} `;
  dOuter += `A ${tabCornerR},${tabCornerR} 0 0,1 ${flap4MidX},${yBottom} `;
  dOuter += `L ${x4},${yBottom} `;
  dOuter += `L ${x4},${yBotBody} `;

  // ── Bottom Flap 3 (under Back Panel 3 - Snap Base with 2 notches) - Reaches yBottom ──
  const flap3NotchW = Math.min(W * 0.23, 84 * (W / 370));
  const flap3NotchH = 19 * baseScale;
  const flap3SpaceW = (W - (flap3NotchW * 2) - 40) / 3;

  dOuter += `L ${x4 - 20},${yBottom - flap3NotchH} `;
  dOuter += `L ${x4 - 20},${yBottom - tabCornerR} `;
  dOuter += `A ${tabCornerR},${tabCornerR} 0 0,1 ${x4 - 20 - tabCornerR},${yBottom} `;
  dOuter += `L ${x4 - 20 - flap3SpaceW},${yBottom} `;
  dOuter += `A ${rNotch},${rNotch} 0 0,1 ${x4 - 20 - flap3SpaceW - rNotch},${yBottom - rNotch} `;
  dOuter += `L ${x4 - 20 - flap3SpaceW - rNotch},${yBottom - flap3NotchH} `;
  dOuter += `L ${x4 - 20 - flap3SpaceW - flap3NotchW + rNotch},${yBottom - flap3NotchH} `;
  dOuter += `L ${x4 - 20 - flap3SpaceW - flap3NotchW + rNotch},${yBottom - rNotch} `;
  dOuter += `A ${rNotch},${rNotch} 0 0,1 ${x4 - 20 - flap3SpaceW - flap3NotchW},${yBottom} `;
  dOuter += `L ${x3 + 20 + flap3SpaceW + flap3NotchW},${yBottom} `;
  dOuter += `A ${rNotch},${rNotch} 0 0,1 ${x3 + 20 + flap3SpaceW + flap3NotchW - rNotch},${yBottom - rNotch} `;
  dOuter += `L ${x3 + 20 + flap3SpaceW + flap3NotchW - rNotch},${yBottom - flap3NotchH} `;
  dOuter += `L ${x3 + 20 + flap3SpaceW + rNotch},${yBottom - flap3NotchH} `;
  dOuter += `L ${x3 + 20 + flap3SpaceW + rNotch},${yBottom - rNotch} `;
  dOuter += `A ${rNotch},${rNotch} 0 0,1 ${x3 + 20 + flap3SpaceW},${yBottom} `;
  dOuter += `L ${x3 + 20},${yBottom} `;
  dOuter += `L ${x3 + 20},${yBottom - flap3NotchH} `;
  dOuter += `L ${x3},${yBotBody} `;

  // ── Bottom Flap 2 (under Gable 1 / Panel 2) - Reaches yBottom ──
  const flap2MidX = x2 + (D * 0.5);
  dOuter += `L ${x3},${yBottom} `;
  dOuter += `L ${flap2MidX},${yBottom} `;
  dOuter += `A ${tabCornerR},${tabCornerR} 0 0,1 ${flap2MidX - 5},${yBottom - tabCornerR} `;
  dOuter += `L ${flap2MidX - 10},${yBotBody + snapFlapH * 0.72} `;
  dOuter += `L ${x2},${yBotBody} `;

  // ── Bottom Flap 1 (under Front Panel 1 - Snap Base with 2 notches) - Reaches yBottom ──
  dOuter += `L ${x2},${yBottom} `;
  dOuter += `L ${x2 - 20},${yBottom} `;
  dOuter += `A ${rNotch},${rNotch} 0 0,1 ${x2 - 20 - rNotch},${yBottom - rNotch} `;
  dOuter += `L ${x2 - 20 - rNotch},${yBottom - flap3NotchH} `;
  dOuter += `L ${x2 - 20 - flap3NotchW + rNotch},${yBottom - flap3NotchH} `;
  dOuter += `L ${x2 - 20 - flap3NotchW + rNotch},${yBottom - rNotch} `;
  dOuter += `A ${rNotch},${rNotch} 0 0,1 ${x2 - 20 - flap3NotchW},${yBottom} `;
  dOuter += `L ${x1 + 20 + flap3NotchW + flap3SpaceW},${yBottom} `;
  dOuter += `A ${rNotch},${rNotch} 0 0,1 ${x1 + 20 + flap3NotchW + flap3SpaceW - rNotch},${yBottom - rNotch} `;
  dOuter += `L ${x1 + 20 + flap3NotchW + flap3SpaceW - rNotch},${yBottom - flap3NotchH} `;
  dOuter += `L ${x1 + 20 + flap3SpaceW + rNotch},${yBottom - flap3NotchH} `;
  dOuter += `L ${x1 + 20 + flap3SpaceW + rNotch},${yBottom - rNotch} `;
  dOuter += `A ${rNotch},${rNotch} 0 0,1 ${x1 + 20 + flap3SpaceW},${yBottom} `;
  dOuter += `L ${x1},${yBottom} `;
  dOuter += `L ${x1},${yBotBody} `;

  // ── Left Glue Flap Bottom Bevel & Vertical Edge ──
  dOuter += `L ${x0},${yBotBody - 10} `;
  dOuter += `L ${x0},${yHeaderCrease2} Z`;

  addPath(dOuter, 'OUTER', COLOR_CUT, { x: x0, y: yHeaderCrease2 }, { x: x0, y: yHeaderCrease2 });

  // Generate clean inline SVG markup
  let svgInner = '';
  segments.forEach(seg => {
    if (seg.geometry === 'line') {
      svgInner += `<line x1="${seg.start.x.toFixed(3)}" y1="${seg.start.y.toFixed(3)}" x2="${seg.end.x.toFixed(3)}" y2="${seg.end.y.toFixed(3)}" stroke="${seg.strokeColor}" stroke-width="${seg.strokeWidth || 0.45}" fill="none" />\n`;
    } else if (seg.geometry === 'path' && seg.d) {
      svgInner += `<path d="${seg.d}" stroke="${seg.strokeColor}" stroke-width="${seg.strokeWidth || 0.45}" fill="none" />\n`;
    }
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth.toFixed(2)} ${totalHeight.toFixed(2)}" width="${totalWidth.toFixed(2)}mm" height="${totalHeight.toFixed(2)}mm">\n${svgInner}</svg>`;

  return {
    width: totalWidth,
    height: totalHeight,
    segments,
    svg,
  };
}
