import { Bag_B_1Dimensions } from './types';

export type DimUnit = 'mm' | 'cm' | 'in';

export function buildBag_B_1DimensionsSvg(p: Bag_B_1Dimensions, unit: DimUnit = 'mm', scale = 1): string {
  const W = p.width;
  const H = p.height;
  const D = p.depth;
  const Gf = p.glueFlap;
  const topHem = p.topHem;
  const bottomFlap = p.bottomFlap;

  // X Coordinates
  const x1 = Gf;
  const x2 = x1 + D / 2;
  const x3 = x2 + W;
  const x4 = x3 + D / 2;
  const x5 = x4 + D / 2;
  const x6 = x5 + W;
  const x7 = x6 + D / 2;

  // Y Coordinates
  const y1 = topHem;
  const y2 = topHem + H;
  const y4 = topHem + H + D / 2 + bottomFlap;

  const TotalW = x7;
  const TotalH = y4;

  const C = '#2563eb'; // Blue for inner panel dimensions

  // Base CAD scaling parameters matching T0002
  const baseFS = 4.2;  // font size in mm
  const baseAH = 1.8;  // arrow head size in mm
  const baseSW = 0.4;  // stroke width in mm
  const baseRectStroke = 0.3;

  // Normalize scale factor relative to reference template size (238mm)
  const relScale = (Math.max(TotalW, TotalH) / 238);
  const s = relScale * (scale > 0 ? scale : 1);
  const SW = baseSW * s;
  const AH = baseAH * s;
  const FS = baseFS * s;

  const arrowL = (x: number, y: number) =>
    `<path d="M${x} ${y} l${AH} ${-AH / 2} l0 ${AH} z" fill="${C}"/>`;
  const arrowR = (x: number, y: number) =>
    `<path d="M${x} ${y} l${-AH} ${-AH / 2} l0 ${AH} z" fill="${C}"/>`;
  const arrowU = (x: number, y: number) =>
    `<path d="M${x} ${y} l${-AH / 2} ${AH} l${AH} 0 z" fill="${C}"/>`;
  const arrowD = (x: number, y: number) =>
    `<path d="M${x} ${y} l${-AH / 2} ${-AH} l${AH} 0 z" fill="${C}"/>`;

  const label = (x: number, y: number, text: string) => {
    const padX = 1.2 / s;
    const padY = 0.8 / s;
    const w = text.length * FS * 0.58 + padX * 2;
    const h = FS + padY * 2;
    return (
      `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" ` +
      `fill="#ffffff" fill-opacity="0.95" stroke="${C}" stroke-width="${baseRectStroke / s}" rx="${1.0 / s}"/>` +
      `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${FS}" font-weight="600" ` +
      `fill="${C}" text-anchor="middle" dominant-baseline="middle" direction="ltr" unicode-bidi="isolate">${text}</text>`
    );
  };

  const dimH = (x1: number, x2: number, y: number, text: string) =>
    `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${C}" stroke-width="${SW}"/>` +
    arrowL(x1, y) +
    arrowR(x2, y) +
    label((x1 + x2) / 2, y, text);

  const dimV = (x: number, y1: number, y2: number, text: string) =>
    `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${C}" stroke-width="${SW}"/>` +
    arrowU(x, y1) +
    arrowD(x, y2) +
    label(x, (y1 + y2) / 2, text);

  const conv = (n: number) => {
    if (unit === 'cm') return Math.round((n / 10) * 100) / 100;
    if (unit === 'in') return Math.round((n / 25.4) * 100) / 100;
    return Math.round(n * 100) / 100;
  };
  const suffix = unit === 'mm' ? 'mm' : unit === 'cm' ? 'cm' : 'in';
  const fmt = (n: number) => `${conv(n)} ${suffix}`;

  let out = '';
  // Inner panel dimensions
  out += dimH(x2, x3, y1 + H * 0.35, fmt(W));
  out += dimH(x3, x5, y1 + H * 0.55, fmt(D));
  out += dimV((x5 + x6) / 2, y1, y2, fmt(H));

  // Outer Total Overall Dimensions (المقاس الكلي للقالب)
  const C_TOTAL = '#64748b';       // Slate grey line & tick color
  const C_TOTAL_TEXT = '#1e293b';  // Dark charcoal slate text color
  const SW_TOT = 0.35 * s;
  const FS_TOT = 4.2 * s;
  const offset = 14 * s;

  const yTotal = TotalH + offset;
  const xTotal = TotalW + offset;

  // Extension lines
  const extW = 
    `<line x1="0" y1="${TotalH + 2 * s}" x2="0" y2="${yTotal + 4 * s}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<line x1="${TotalW}" y1="${TotalH + 2 * s}" x2="${TotalW}" y2="${yTotal + 4 * s}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>`;

  const extH = 
    `<line x1="${TotalW + 2 * s}" y1="0" x2="${xTotal + 4 * s}" y2="0" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<line x1="${TotalW + 2 * s}" y1="${TotalH}" x2="${xTotal + 4 * s}" y2="${TotalH}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>`;

  // Overall Horizontal dimension line at bottom with end ticks & text below
  const dimLineW = 
    `<line x1="0" y1="${yTotal}" x2="${TotalW}" y2="${yTotal}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<line x1="0" y1="${yTotal - 2 * s}" x2="0" y2="${yTotal + 2 * s}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<line x1="${TotalW}" y1="${yTotal - 2 * s}" x2="${TotalW}" y2="${yTotal + 2 * s}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<text x="${TotalW / 2}" y="${yTotal + FS_TOT * 0.95}" font-family="Arial, sans-serif" font-size="${FS_TOT}" font-weight="600" ` +
    `fill="${C_TOTAL_TEXT}" text-anchor="middle" dominant-baseline="hanging" direction="ltr" unicode-bidi="isolate">${fmt(TotalW)}</text>`;

  // Overall Vertical dimension line on the right rotated 90 deg parallel to line
  const textX = xTotal + 5 * s;
  const textY = TotalH / 2;
  const dimLineH = 
    `<line x1="${xTotal}" y1="0" x2="${xTotal}" y2="${TotalH}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<line x1="${xTotal - 2 * s}" y1="0" x2="${xTotal + 2 * s}" y2="0" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<line x1="${xTotal - 2 * s}" y1="${TotalH}" x2="${xTotal + 2 * s}" y2="${TotalH}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<text x="${textX}" y="${textY}" transform="rotate(90, ${textX}, ${textY})" font-family="Arial, sans-serif" font-size="${FS_TOT}" font-weight="600" ` +
    `fill="${C_TOTAL_TEXT}" text-anchor="middle" dominant-baseline="middle" direction="ltr" unicode-bidi="isolate">${fmt(TotalH)}</text>`;

  out += `<g class="overall-dimensions">${extW}${extH}${dimLineW}${dimLineH}</g>`;

  return `<g class="bag_b_1-dimensions" pointer-events="none">${out}</g>`;
}
