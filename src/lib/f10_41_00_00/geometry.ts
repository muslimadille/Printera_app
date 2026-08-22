import { F10_41_00_00Dimensions } from './types';

export interface Point {
  x: number;
  y: number;
}

export interface Line {
  start: Point;
  end: Point;
}

export interface Segment {
  id: number;
  svgId: string;
  kind: 'CUT' | 'CREASE' | 'OUTER';
  geometry: 'line' | 'polyline' | 'polygon';
  start: Point;
  end: Point;
  points?: Point[];
  d?: string;
  color?: string;
}

export interface F10_41_00_00Geometry {
  segments: Segment[];
  bbox: { w: number; h: number };
  cutLines: Line[];
  creaseLines: Line[];
  lockCreaseLines: Line[];
  width: number;
  height: number;
}

export function generateF10_41_00_00Geometry(params: F10_41_00_00Dimensions): F10_41_00_00Geometry {
  const W = Math.max(20, params.width);
  const H = Math.max(20, params.height);
  const D = Math.max(15, params.depth);
  const Gf = Math.max(5, params.glueFlap);
  
  // Flap height (default 0.675 * D, matching 33.75mm at D=50mm)
  const flapH = params.flapHeight ? Math.max(10, params.flapHeight) : D * 0.675;

  // Window settings
  const hasWindow = params.hasWindow !== false;
  const winMx = Math.min(W * 0.35, Math.max(5, params.windowMarginX ?? 15));
  const winMy = Math.min(H * 0.35, Math.max(5, params.windowMarginY ?? 10));
  const winChamfer = Math.min(winMx, Math.min(winMy, Math.max(2, params.windowCornerChamfer ?? 5)));

  // X Coordinates of vertical panel boundaries
  const x0 = 0;
  const x_glue = Gf;
  const x1 = x_glue + W;
  const x2 = x1 + D;
  const x3 = x2 + W;
  const x4 = x3 + D;
  const totalWidth = x4;

  // Y Coordinates
  const y_top = flapH;
  const y_bot = flapH + H;
  const totalHeight = flapH + H + flapH;

  const segments: Segment[] = [];
  const cutLines: Line[] = [];
  const creaseLines: Line[] = [];
  const lockCreaseLines: Line[] = [];
  let segId = 1;

  const addLine = (start: Point, end: Point, kind: 'CUT' | 'CREASE' | 'OUTER', color?: string) => {
    segments.push({
      id: segId++,
      svgId: `seg_${segId}`,
      kind,
      geometry: 'line',
      start,
      end,
      color,
    });
    if (kind === 'CUT' || kind === 'OUTER') {
      cutLines.push({ start, end });
    } else if (color === '#c8b700') {
      lockCreaseLines.push({ start, end });
    } else {
      creaseLines.push({ start, end });
    }
  };

  const addPolyline = (points: Point[], kind: 'CUT' | 'CREASE' | 'OUTER', color?: string) => {
    for (let i = 0; i < points.length - 1; i++) {
      addLine(points[i], points[i + 1], kind, color);
    }
  };

  // 1. MAIN VERTICAL CREASES
  addLine({ x: x_glue, y: y_top + 1 }, { x: x_glue, y: y_bot - 1 }, 'CREASE'); // Left glue flap crease
  addLine({ x: x1, y: y_top }, { x: x1, y: y_bot }, 'CREASE');                 // Between Panel 1 & 2
  addLine({ x: x2, y: y_top }, { x: x2, y: y_bot }, 'CREASE');                 // Between Panel 2 & 3
  addLine({ x: x3, y: y_top }, { x: x3, y: y_bot }, 'CREASE');                 // Between Panel 3 & 4
  addLine({ x: x4, y: y_top }, { x: x4, y: y_bot }, 'CUT');                    // Right outer cut edge

  // 2. MAIN HORIZONTAL CREASES
  // Top horizontal crease across panels (with small cuts at slots)
  const slotGap = Math.min(1.5, D * 0.03);
  addLine({ x: x_glue, y: y_top }, { x: x1, y: y_top }, 'CREASE');
  addLine({ x: x1, y: y_top }, { x: x1 + slotGap, y: y_top }, 'CUT');
  addLine({ x: x1 + slotGap, y: y_top }, { x: x3, y: y_top }, 'CREASE');
  addLine({ x: x3, y: y_top }, { x: x3 + slotGap, y: y_top }, 'CUT');
  addLine({ x: x3 + slotGap, y: y_top }, { x: x4, y: y_top }, 'CREASE');

  // Bottom horizontal crease across panels
  addLine({ x: x_glue, y: y_bot }, { x: x1, y: y_bot }, 'CREASE');
  addLine({ x: x1, y: y_bot }, { x: x1 + slotGap, y: y_bot }, 'CUT');
  addLine({ x: x1 + slotGap, y: y_bot }, { x: x3, y: y_bot }, 'CREASE');
  addLine({ x: x3, y: y_bot }, { x: x3 + slotGap, y: y_bot }, 'CUT');
  addLine({ x: x3 + slotGap, y: y_bot }, { x: x4, y: y_bot }, 'CREASE');

  // 3. GLUE FLAP CUT CONTOUR (Leftmost tab)
  const gfChamfer = Math.min(Gf * 0.95, 12.5);
  addPolyline([
    { x: x_glue, y: y_top },
    { x: x_glue, y: y_top + 1 },
    { x: x0, y: y_top + 1 + gfChamfer },
    { x: x0, y: y_bot - 1 - gfChamfer },
    { x: x_glue, y: y_bot - 1 },
    { x: x_glue, y: y_bot },
  ], 'CUT');

  // Helper for generating snap-lock flaps (on Panel 1 and Panel 3)
  // Scaled proportions relative to reference: W=100, flapH=33.75
  const buildSnapLockFlap = (pStartX: number, isTop: boolean) => {
    const yBase = isTop ? y_top : y_bot;
    const dir = isTop ? -1 : 1;

    // Feature proportions
    const step1X = pStartX + Math.min(W * 0.425, W - 15);
    const stepDownDepth = Math.min(flapH * 0.25, 8.5);
    const shelfX = pStartX + Math.min(W * 0.75, W - 10);
    const earSlopeX = shelfX + Math.min(W * 0.087, 8.75);
    const earEndX = pStartX + Math.min(W * 0.98, W - 1.5);
    const earRightX = pStartX + Math.min(W * 0.98, W - 1.5);

    const tipY = yBase + dir * flapH;
    const shelfY = yBase + dir * (flapH - stepDownDepth);
    const innerNotchY = yBase + dir * Math.min(flapH * 0.15, 5.3);
    const innerNotchX = earRightX - Math.min(W * 0.033, 3.3);

    // 45° Yellow/Gold diagonal lock crease
    const yellowCreaseStart: Point = { x: shelfX, y: shelfY };
    const yellowCreaseEnd: Point = { x: innerNotchX, y: yBase + dir * Math.min(flapH * 0.15, 5.3) };
    addLine(yellowCreaseStart, yellowCreaseEnd, 'CREASE', '#c8b700');

    // Outer cut contour for the flap
    const contourPoints: Point[] = [
      { x: pStartX, y: yBase },
      { x: pStartX + Math.min(1.8, W * 0.02), y: tipY },
      { x: step1X, y: tipY },
      { x: step1X + Math.min(5.75, W * 0.06), y: shelfY },
      { x: shelfX, y: shelfY },
      { x: earSlopeX, y: tipY },
      { x: earEndX, y: tipY },
      { x: earRightX, y: yBase + dir * Math.min(flapH * 0.75, 25) },
      { x: innerNotchX, y: yBase + dir * Math.min(flapH * 0.15, 5.3) },
      { x: pStartX + W, y: yBase },
    ];
    addPolyline(contourPoints, 'CUT');
  };

  // Helper for generating dust flaps (on Panel 2 and Panel 4)
  const buildDustFlap = (pStartX: number, pW: number, isTop: boolean) => {
    const yBase = isTop ? y_top : y_bot;
    const dir = isTop ? -1 : 1;

    const slopeW = Math.min(pW * 0.25, flapH * 0.35);
    const tipY = yBase + dir * Math.min(flapH * 0.75, 25);

    const dustPoints: Point[] = [
      { x: pStartX, y: yBase },
      { x: pStartX + slopeW, y: tipY },
      { x: pStartX + pW - slopeW, y: tipY },
      { x: pStartX + pW, y: yBase },
    ];
    addPolyline(dustPoints, 'CUT');
  };

  // 4. TOP FLAPS
  buildSnapLockFlap(x_glue, true);           // Panel 1 Top Flap
  buildDustFlap(x1 + slotGap, D - slotGap, true); // Panel 2 Top Dust Flap
  buildSnapLockFlap(x2, true);               // Panel 3 Top Flap
  buildDustFlap(x3 + slotGap, D - slotGap, true); // Panel 4 Top Dust Flap

  // 5. BOTTOM FLAPS
  buildSnapLockFlap(x_glue, false);          // Panel 1 Bottom Flap
  buildDustFlap(x1 + slotGap, D - slotGap, false); // Panel 2 Bottom Dust Flap
  buildSnapLockFlap(x2, false);              // Panel 3 Bottom Flap
  buildDustFlap(x3 + slotGap, D - slotGap, false); // Panel 4 Bottom Dust Flap

  // 6. DIE-CUT WINDOW (Inside Front Panel 3: x2 to x3, y_top to y_bot)
  if (hasWindow) {
    const wx1 = x2 + winMx;
    const wx2 = x3 - winMx;
    const wy1 = y_top + winMy;
    const wy2 = y_bot - winMy;

    const winPoints: Point[] = [
      { x: wx1 + winChamfer, y: wy1 },
      { x: wx2 - winChamfer, y: wy1 },
      { x: wx2, y: wy1 + winChamfer },
      { x: wx2, y: wy2 - winChamfer },
      { x: wx2 - winChamfer, y: wy2 },
      { x: wx1 + winChamfer, y: wy2 },
      { x: wx1, y: wy2 - winChamfer },
      { x: wx1, y: wy1 + winChamfer },
      { x: wx1 + winChamfer, y: wy1 }, // Close loop
    ];
    addPolyline(winPoints, 'CUT');
  }

  return {
    segments,
    bbox: { w: totalWidth, h: totalHeight },
    cutLines,
    creaseLines,
    lockCreaseLines,
    width: totalWidth,
    height: totalHeight,
  };
}
