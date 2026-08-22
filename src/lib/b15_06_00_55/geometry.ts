// B15_06_00_55 — Parametric 2D Geometry Engine (ECMA B15 Lock-Bottom Box)
// Complete 2D manufacturing pattern with 100% connected hook locking flaps, rollover lid, and lock slits.

import type { B15_06_00_55Params, B15_06_00_55Geometry, Segment } from './types';
import { buildB15_06_00_55Reference } from './reference';

export function buildB15_06_00_55Geometry(p: B15_06_00_55Params): B15_06_00_55Geometry {
  if (p.referenceMode) {
    return buildB15_06_00_55Reference();
  }

  const W = p.width;
  const H = p.height;
  const D = p.depth;
  const Tf = p.tuckFlap || D;

  // Geometry dimensions in mm
  const totalW = D + W + D + W + Tf;
  const dustH = D;
  const totalH = dustH + H + dustH;

  const x0 = 0;
  const x1 = D;
  const x2 = D + W;
  const x3 = D + W + D;
  const x4 = D + W + D + W;
  const x5 = totalW;

  const yTop = dustH;
  const yBot = dustH + H;

  const CUT_COLOR = '#e30613';
  const CREASE_COLOR = '#009640';

  const segments: Segment[] = [];
  let segId = 1;

  const addLine = (kind: 'CUT' | 'CREASE', x1: number, y1: number, x2: number, y2: number) => {
    segments.push({
      id: segId++,
      kind,
      geometry: 'line',
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      d: `M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    });
  };

  const addPolyline = (kind: 'CUT' | 'CREASE', points: { x: number; y: number }[]) => {
    segments.push({
      id: segId++,
      kind,
      geometry: 'polyline',
      points,
      start: points[0],
      end: points[points.length - 1],
      d: 'M ' + points.map(pt => `${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`).join(' L '),
    });
  };

  const addPath = (kind: 'CUT' | 'CREASE', d: string) => {
    segments.push({
      id: segId++,
      kind,
      geometry: 'path',
      d,
    });
  };

  // 1. VERTICAL CREASE LINES
  addLine('CREASE', x1, yTop, x1, yBot); // Crease between Panel 1 & 2
  addLine('CREASE', x2, yTop, x2, yBot); // Crease between Panel 2 & 3
  addLine('CREASE', x3, yTop, x3, yBot); // Crease between Panel 3 & 4
  addLine('CREASE', x4, yTop, x4, yBot); // Crease between Panel 4 & 5

  // 2. HORIZONTAL CREASE LINES (Main Top and Bottom Creases)
  addLine('CREASE', x0, yTop, x1, yTop);
  addLine('CREASE', x1, yTop, x2, yTop);
  addLine('CREASE', x2, yTop, x3, yTop);
  addLine('CREASE', x3, yTop, x4, yTop);
  addLine('CREASE', x4, yTop, x5, yTop);

  addLine('CREASE', x0, yBot, x1, yBot);
  addLine('CREASE', x1, yBot, x2, yBot);
  addLine('CREASE', x2, yBot, x3, yBot);
  addLine('CREASE', x3, yBot, x4, yBot);
  addLine('CREASE', x4, yBot, x5, yBot);

  // 3. LEFT OUTER CUT (Panel 1 Outer Edge)
  addLine('CUT', x0, yTop, x0, yBot);

  // 4. PARAMETRIC HOOK LOCK FLAPS (100% Continuous Connections, Zero Gap)
  // Helper to generate perfectly connected Hook flap
  const addConnectedHook = (
    xInner: number,
    xOuter: number,
    yCrease: number,
    dirX: 1 | -1, // +1 for P3/P5 (rightwards), -1 for P1 (leftwards)
    dirY: 1 | -1, // -1 for Top, +1 for Bottom
  ) => {
    // 1. Diagonal line from inner crease corner
    const p1 = { x: xInner, y: yCrease };
    const p2 = { x: xInner + dirX * 0.30 * D, y: yCrease + dirY * 0.313 * D };
    addLine('CUT', p1.x, p1.y, p2.x, p2.y);

    // 2. Circular hook arc starting exactly at p2
    const rArc = 0.3006 * D;
    const arcDx = dirX * 0.4253 * D;
    const arcDy = dirY * 0.4253 * D;
    const p3 = { x: p2.x + arcDx, y: p2.y + arcDy };
    const sweepFlag = (dirX === 1 && dirY === -1) || (dirX === -1 && dirY === 1) ? 1 : 0;
    addPath(
      'CUT',
      `M ${p2.x.toFixed(2)},${p2.y.toFixed(2)} A ${rArc.toFixed(2)} ${rArc.toFixed(2)} 0 0,${sweepFlag} ${p3.x.toFixed(2)},${p3.y.toFixed(2)}`
    );

    // 3. Polyline starting at xOuter and ending EXACTLY at p3 (100% vertex welded)
    const q1 = { x: xOuter, y: yCrease };
    const q2 = { x: xOuter, y: yCrease + dirY * 0.455 * D };
    const q3 = { x: xOuter - dirX * 0.40 * D, y: yCrease + dirY * 0.60 * D };
    addPolyline('CUT', [q1, q2, q3, p3]);
  };

  // Panel 1 Top & Bottom Hooks
  addConnectedHook(x1, x0, yTop, -1, -1);
  addConnectedHook(x1, x0, yBot, -1, 1);

  // Panel 3 Top & Bottom Hooks
  addConnectedHook(x2, x3, yTop, 1, -1);
  addConnectedHook(x2, x3, yBot, 1, 1);

  // Panel 5 Top & Bottom Hooks (using tuckFlap width Tf)
  addConnectedHook(x4, x5, yTop, 1, -1);
  addConnectedHook(x4, x5, yBot, 1, 1);

  // 5. PANEL 2 (Main Bottom Panel) - Dust Flaps and Slit Cuts
  // Top Dust Flap (Rectangular extension)
  addPolyline('CUT', [
    { x: x1, y: yTop },
    { x: x1, y: 0 },
    { x: x2, y: 0 },
    { x: x2, y: yTop },
  ]);

  // Top Diagonal Slit Cuts on Panel 2
  const slitOffset1 = W * 0.148;
  const slitOffset2 = W * 0.235;
  const slitOffset3 = W * 0.342;
  const slitY1 = yTop - D * 0.174;
  const slitY2 = yTop - D * 0.606;
  addPolyline('CUT', [
    { x: x1 + slitOffset1, y: slitY1 },
    { x: x1 + slitOffset2, y: slitY2 },
    { x: x1 + slitOffset3, y: slitY2 },
  ]);
  addPolyline('CUT', [
    { x: x2 - slitOffset1, y: slitY1 },
    { x: x2 - slitOffset2, y: slitY2 },
    { x: x2 - slitOffset3, y: slitY2 },
  ]);

  // Bottom Dust Flap (Rectangular extension)
  addPolyline('CUT', [
    { x: x1, y: yBot },
    { x: x1, y: totalH },
    { x: x2, y: totalH },
    { x: x2, y: yBot },
  ]);

  // Bottom Diagonal Slit Cuts on Panel 2
  const bSlitY1 = yBot + D * 0.174;
  const bSlitY2 = yBot + D * 0.606;
  addPolyline('CUT', [
    { x: x1 + slitOffset1, y: bSlitY1 },
    { x: x1 + slitOffset2, y: bSlitY2 },
    { x: x1 + slitOffset3, y: bSlitY2 },
  ]);
  addPolyline('CUT', [
    { x: x2 - slitOffset1, y: bSlitY1 },
    { x: x2 - slitOffset2, y: bSlitY2 },
    { x: x2 - slitOffset3, y: bSlitY2 },
  ]);

  // 6. PANEL 4 (Top Lid Panel) - Rounded Rollover Flaps & Slits
  // Top Rollover Flap (Smooth curved arc with diagonal lock slits)
  const lidR = Math.min(22.36, W * 0.08);
  const p4TopP1 = { x: x3, y: yTop };
  const p4TopP2 = { x: x3 + W * 0.092, y: yTop - D * 0.563 };
  const p4TopC1 = { x: x3 + W * 0.136, y: yTop - D * 0.832 };
  const p4TopC2 = { x: x3 + W * 0.246, y: 0 };
  const p4TopP3 = { x: x3 + W * 0.362, y: 0 };
  const p4TopP4 = { x: x4 - lidR * 1.15, y: 0 };
  const p4TopP5 = { x: x4 - 5.8, y: 18.3 };
  const p4TopP6 = { x: x4, y: yTop };

  addPath(
    'CUT',
    `M ${p4TopP1.x.toFixed(2)},${p4TopP1.y.toFixed(2)} ` +
      `L ${p4TopP2.x.toFixed(2)},${p4TopP2.y.toFixed(2)} ` +
      `C ${p4TopC1.x.toFixed(2)},${p4TopC1.y.toFixed(2)} ` +
      `${p4TopC2.x.toFixed(2)},${p4TopC2.y.toFixed(2)} ` +
      `${p4TopP3.x.toFixed(2)},${p4TopP3.y.toFixed(2)} ` +
      `H ${p4TopP4.x.toFixed(2)} ` +
      `A ${lidR.toFixed(2)},${lidR.toFixed(2)} 0 0,1 ${p4TopP5.x.toFixed(2)},${p4TopP5.y.toFixed(2)} ` +
      `L ${p4TopP6.x.toFixed(2)},${p4TopP6.y.toFixed(2)}`
  );

  // Top Slit Cut on Panel 4
  addPolyline('CUT', [
    { x: x4 - slitOffset1, y: slitY1 },
    { x: x4 - slitOffset2, y: slitY2 },
    { x: x4 - slitOffset3, y: slitY2 },
  ]);

  // Bottom Rollover Flap on Panel 4
  const p4BotP1 = { x: x3, y: yBot };
  const p4BotP2 = { x: x3 + W * 0.092, y: yBot + D * 0.563 };
  const p4BotC1 = { x: x3 + W * 0.136, y: yBot + D * 0.832 };
  const p4BotC2 = { x: x3 + W * 0.246, y: totalH };
  const p4BotP3 = { x: x3 + W * 0.362, y: totalH };
  const p4BotP4 = { x: x4 - lidR * 1.15, y: totalH };
  const p4BotP5 = { x: x4 - 5.8, y: totalH - 18.3 };
  const p4BotP6 = { x: x4, y: yBot };

  addPath(
    'CUT',
    `M ${p4BotP1.x.toFixed(2)},${p4BotP1.y.toFixed(2)} ` +
      `L ${p4BotP2.x.toFixed(2)},${p4BotP2.y.toFixed(2)} ` +
      `C ${p4BotC1.x.toFixed(2)},${p4BotC1.y.toFixed(2)} ` +
      `${p4BotC2.x.toFixed(2)},${p4BotC2.y.toFixed(2)} ` +
      `${p4BotP3.x.toFixed(2)},${p4BotP3.y.toFixed(2)} ` +
      `H ${p4BotP4.x.toFixed(2)} ` +
      `A ${lidR.toFixed(2)},${lidR.toFixed(2)} 0 0,0 ${p4BotP5.x.toFixed(2)},${p4BotP5.y.toFixed(2)} ` +
      `L ${p4BotP6.x.toFixed(2)},${p4BotP6.y.toFixed(2)}`
  );

  // Bottom Slit Cut on Panel 4
  addPolyline('CUT', [
    { x: x4 - slitOffset1, y: bSlitY1 },
    { x: x4 - slitOffset2, y: bSlitY2 },
    { x: x4 - slitOffset3, y: bSlitY2 },
  ]);

  // 7. PANEL 5 (Right Flap) - Outer Edge with Half-Circle Thumb Notch
  const rn = Math.min(20, H * 0.08);
  const notchY = (yTop + yBot) / 2;

  addLine('CUT', x5, yTop, x5, notchY - rn);
  addPath('CUT', `M ${x5.toFixed(2)},${(notchY - rn).toFixed(2)} A ${rn.toFixed(2)},${rn.toFixed(2)} 0 0,0 ${x5.toFixed(2)},${(notchY + rn).toFixed(2)}`);
  addLine('CUT', x5, notchY + rn, x5, yBot);

  // Render SVG string
  const svgPaths = segments
    .map(s => {
      const stroke = s.kind === 'CREASE' ? CREASE_COLOR : CUT_COLOR;
      const dash = s.kind === 'CREASE' ? 'stroke-dasharray="3,2"' : '';
      return `<path d="${s.d}" stroke="${stroke}" stroke-width="2" fill="none" ${dash} stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW.toFixed(2)} ${totalH.toFixed(2)}" width="100%" height="100%">
    ${svgPaths}
  </svg>`;

  return {
    svg,
    bbox: {
      w: totalW,
      h: totalH,
    },
    derived: {
      totalWidth: totalW,
      totalHeight: totalH,
      w: W,
      h: H,
      d: D,
      tuckFlap: Tf,
      topDustHeight: dustH,
      botDustHeight: dustH,
    },
    segments,
  };
}
