import { Bag_B_1Dimensions } from './types';
import { Segment } from '@/components/InteractiveSvgCanvas';

export interface Point {
  x: number;
  y: number;
}

export interface Line {
  start: Point;
  end: Point;
}

export interface Circle {
  cx: number;
  cy: number;
  r: number;
}

export interface BagGeometry {
  segments: Segment[];
  bbox: { w: number; h: number };
  cutLines: Line[];
  creaseLines: Line[];
  cutCircles: Circle[];
  width: number;
  height: number;
  svg?: string;
}

export function generateBag_B_1Geometry(dims: Bag_B_1Dimensions): BagGeometry {
  const { width: W, height: H, depth: D, topHem, bottomFlap, glueFlap } = dims;

  const cutLines: Line[] = [];
  const creaseLines: Line[] = [];
  const cutCircles: Circle[] = [];
  const segments: Segment[] = [];
  let segId = 1;

  // X Coordinates
  const x0 = 0;
  const x1 = glueFlap;
  const x2 = x1 + D / 2;
  const x3 = x2 + W;
  const x4 = x3 + D / 2;
  const x5 = x4 + D / 2;
  const x6 = x5 + W;
  const x7 = x6 + D / 2;

  const totalWidth = x7;

  // Y Coordinates
  const y0 = 0; // Top edge
  const y1 = topHem; // Top hem fold
  const y2 = topHem + H; // Bottom of main body
  const y3 = topHem + H + D / 2; // Bottom gusset fold
  const totalBottom = D / 2 + bottomFlap; // Gusset half + closure base (قاعدة الإغلاق)
  const y4 = topHem + H + totalBottom; // Bottom edge

  const totalHeight = y4;

  const addLine = (start: Point, end: Point, kind: "CUT" | "CREASE" | "OUTER") => {
    segments.push({
      id: segId++,
      svgId: `seg_${segId}`,
      kind,
      geometry: 'line',
      start: { ...start },
      end: { ...end }
    });
    if (kind === 'CREASE') creaseLines.push({ start, end });
    else cutLines.push({ start, end });
  };

  const addCircle = (cx: number, cy: number, r: number) => {
    // We add an arc or just full SVG path for circle
    segments.push({
      id: segId++,
      svgId: `seg_${segId}`,
      kind: 'CUT',
      geometry: 'path',
      start: { x: cx - r, y: cy },
      end: { x: cx - r, y: cy }, // Loop back
      d: `M${cx - r},${cy} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 -${r * 2},0`
    });
    cutCircles.push({ cx, cy, r });
  };

  // Outer boundary (Cut lines)
  addLine({ x: x0, y: y0 }, { x: totalWidth, y: y0 }, "OUTER"); // Top
  addLine({ x: totalWidth, y: y0 }, { x: totalWidth, y: totalHeight }, "OUTER"); // Right
  addLine({ x: totalWidth, y: totalHeight }, { x: x0, y: totalHeight }, "OUTER"); // Bottom
  addLine({ x: x0, y: totalHeight }, { x: x0, y: y0 }, "OUTER"); // Left

  // Vertical Creases
  const vCreases = [x1, x2, x3, x4, x5, x6];
  vCreases.forEach(x => {
    addLine({ x, y: y0 }, { x, y: totalHeight }, "CREASE");
  });

  // Horizontal Creases
  addLine({ x: x0, y: y1 }, { x: totalWidth, y: y1 }, "CREASE"); // Top hem fold
  addLine({ x: x0, y: y2 }, { x: totalWidth, y: y2 }, "CREASE"); // Bottom of main body
  addLine({ x: x0, y: y3 }, { x: totalWidth, y: y3 }, "CREASE"); // Bottom gusset fold

  // Diagonal Creases at bottom
  // 1. Glue flap small diagonal
  addLine({ x: x1, y: y2 }, { x: x0, y: y2 + glueFlap }, "CREASE");

  // 2. Main bottom diagonals forming the block bottom
  addLine({ x: x1, y: y2 }, { x: x1 + totalBottom, y: totalHeight }, "CREASE");
  addLine({ x: x4, y: y2 }, { x: x4 - totalBottom, y: totalHeight }, "CREASE");
  addLine({ x: x4, y: y2 }, { x: x4 + totalBottom, y: totalHeight }, "CREASE");
  addLine({ x: x7, y: y2 }, { x: x7 - totalBottom, y: totalHeight }, "CREASE");

  // Handle Holes (Cut circles)
  const holeRadiusLarge = (topHem / 76.7) * 6.715;
  const holeRadiusSmall = (topHem / 76.7) * 4.8;
  const holeYTop = topHem / 2;
  const holeYBot = topHem + topHem / 2;

  // Front Panel Holes
  const fCenterX = x2 + W / 2;
  const holeOffsetX = W / 4;
  addCircle(fCenterX - holeOffsetX, holeYTop, holeRadiusLarge);
  addCircle(fCenterX + holeOffsetX, holeYTop, holeRadiusLarge);
  addCircle(fCenterX - holeOffsetX, holeYBot, holeRadiusSmall);
  addCircle(fCenterX + holeOffsetX, holeYBot, holeRadiusSmall);

  // Back Panel Holes
  const bCenterX = x5 + W / 2;
  addCircle(bCenterX - holeOffsetX, holeYTop, holeRadiusLarge);
  addCircle(bCenterX + holeOffsetX, holeYTop, holeRadiusLarge);
  addCircle(bCenterX - holeOffsetX, holeYBot, holeRadiusSmall);
  addCircle(bCenterX + holeOffsetX, holeYBot, holeRadiusSmall);

  return {
    segments,
    bbox: { w: totalWidth, h: totalHeight },
    cutLines,
    creaseLines,
    cutCircles,
    width: totalWidth,
    height: totalHeight,
  };
}
