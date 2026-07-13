import type { T00012Params } from './types';

export type DimUnit = 'mm' | 'cm' | 'in';

export function buildT00012DimensionsSvg(p: T00012Params, unit: DimUnit = 'mm', scale = 1): string {
  const W = p.width;
  const H = p.height;
  const D = p.depth;
  
  // These must match geometry.ts
  const T = 20; 
  const innerWallWidth = 15.5;
  
  const shiftX = Math.max(100, D * 2);
  const shiftY = Math.max(100, D * 2 + 30);

  const xL = shiftX;
  const xR = shiftX + W;
  
  const yCovT = shiftY;
  const yCovB = shiftY + H;
  const yTDB = shiftY + H + D;
  const yBaseB = shiftY + H + D + H;
  const yBot = shiftY + H + D + H + D;

  const color = '#2563eb';
  
  // Reduced font sizes for cleaner, non-overlapping CAD feel
  const baseFS = 9; 
  const baseAH = 4; 
  const baseSW = 0.8;

  const s = scale > 0 ? scale : 1;
  const SW = baseSW / s;
  const AH = baseAH / s;
  const FS = baseFS / s;

  const arrowL = (x: number, y: number) =>
    `<path d="M${x} ${y} l${AH} ${-AH / 2} l0 ${AH} z" fill="${color}"/>`;
  const arrowR = (x: number, y: number) =>
    `<path d="M${x} ${y} l${-AH} ${-AH / 2} l0 ${AH} z" fill="${color}"/>`;
  const arrowU = (x: number, y: number) =>
    `<path d="M${x} ${y} l${-AH / 2} ${AH} l${AH} 0 z" fill="${color}"/>`;
  const arrowD = (x: number, y: number) =>
    `<path d="M${x} ${y} l${-AH / 2} ${-AH} l${AH} 0 z" fill="${color}"/>`;

  const textNode = (x: number, y: number, label: string) => {
    return `<text x="${x}" y="${y + FS/3}" font-family="sans-serif" font-size="${FS}" fill="${color}" font-weight="bold" text-anchor="middle" style="paint-order: stroke; stroke: white; stroke-width: ${FS*0.3};">${label}</text>`;
  };

  const dimX = (yOffset: number, xStart: number, xEnd: number, label: string) => {
    const yLine = yOffset;
    return `
      <line x1="${xStart}" y1="${yLine}" x2="${xEnd}" y2="${yLine}" stroke="${color}" stroke-width="${SW}"/>
      ${arrowL(xStart, yLine)}
      ${arrowR(xEnd, yLine)}
      ${textNode((xStart + xEnd) / 2, yLine, label)}
    `;
  };

  const dimY = (xOffset: number, yStart: number, yEnd: number, label: string) => {
    const xLine = xOffset;
    return `
      <line x1="${xLine}" y1="${yStart}" x2="${xLine}" y2="${yEnd}" stroke="${color}" stroke-width="${SW}"/>
      ${arrowU(xLine, yStart)}
      ${arrowD(xLine, yEnd)}
      ${textNode(xLine, (yStart + yEnd) / 2, label)}
    `;
  };

  const extLineX = (x: number, yStart: number, yEnd: number) => 
    `<line x1="${x}" y1="${yStart}" x2="${x}" y2="${yEnd}" stroke="${color}" stroke-width="${SW * 0.5}" stroke-dasharray="${4/s},${4/s}"/>`;
    
  const extLineY = (y: number, xStart: number, xEnd: number) => 
    `<line x1="${xStart}" y1="${y}" x2="${xEnd}" y2="${y}" stroke="${color}" stroke-width="${SW * 0.5}" stroke-dasharray="${4/s},${4/s}"/>`;

  // Overall bounds
  const boxTop = yCovT - T;
  const boxBottom = yBot;
  const boxLeft = xL - D - innerWallWidth;
  const boxRight = xR + D + innerWallWidth;
  
  const outD = 20 / s;
  const extD = 25 / s;

  return `
    <g class="dimensions-overlay">
      <!-- EXTENSION LINES (TOP & BOTTOM) -->
      ${extLineX(xL, boxTop, boxTop - extD)}
      ${extLineX(xR, boxTop, boxTop - extD)}
      
      ${extLineX(boxLeft, boxBottom, boxBottom + extD * 2)}
      ${extLineX(xL, boxBottom, boxBottom + extD)}
      ${extLineX(xR, boxBottom, boxBottom + extD)}
      ${extLineX(boxRight, boxBottom, boxBottom + extD * 2)}

      <!-- EXTENSION LINES (LEFT & RIGHT) -->
      ${extLineY(boxTop, boxLeft, boxLeft - extD)}
      ${extLineY(boxBottom, boxLeft, boxLeft - extD)}

      ${extLineY(boxTop, boxRight, boxRight + extD)}
      ${extLineY(yCovT, boxRight, boxRight + extD)}
      ${extLineY(yCovB, boxRight, boxRight + extD)}
      ${extLineY(yTDB, boxRight, boxRight + extD)}
      ${extLineY(yBaseB, boxRight, boxRight + extD)}
      ${extLineY(boxBottom, boxRight, boxRight + extD)}

      <!-- TOP DIMENSIONS (Lid Width) -->
      ${dimX(boxTop - outD, xL, xR, W + ' ' + unit + ' (عرض الغطاء)')}

      <!-- RIGHT DIMENSIONS (Heights/Depths Stacked) -->
      ${dimY(boxRight + outD, boxTop, yCovT, T + ' ' + unit + ' (الغطاء)')}
      ${dimY(boxRight + outD, yCovT, yCovB, H + ' ' + unit + ' (الارتفاع)')}
      ${dimY(boxRight + outD, yCovB, yTDB, D + ' ' + unit + ' (العمق)')}
      ${dimY(boxRight + outD, yTDB, yBaseB, H + ' ' + unit + ' (الارتفاع)')}
      ${dimY(boxRight + outD, yBaseB, boxBottom, D + ' ' + unit + ' (العمق)')}

      <!-- BOTTOM DIMENSIONS (Widths) -->
      ${dimX(boxBottom + outD, boxLeft, xL, (D + innerWallWidth).toFixed(1) + ' ' + unit)}
      ${dimX(boxBottom + outD, xL, xR, W + ' ' + unit + ' (العرض)')}
      ${dimX(boxBottom + outD, xR, boxRight, (D + innerWallWidth).toFixed(1) + ' ' + unit)}

      <!-- OVERALL WIDTH (Bottom) -->
      ${dimX(boxBottom + outD * 2.5, boxLeft, boxRight, (W + 2*(D + innerWallWidth)).toFixed(1) + ' ' + unit + ' (العرض الكلي)')}
      
      <!-- OVERALL HEIGHT (Left) -->
      ${dimY(boxLeft - outD, boxTop, boxBottom, (2*H + 2*D + T).toFixed(1) + ' ' + unit + ' (الطول الكلي)')}
    </g>
  `;
}
