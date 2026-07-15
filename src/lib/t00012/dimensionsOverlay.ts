import type { T00012Params } from './types';

export type DimUnit = 'mm' | 'cm' | 'in';

export function buildT00012DimensionsSvg(p: T00012Params, unit: DimUnit = 'mm', scale = 1): string {
  const W = p.width;
  const H = p.height;
  const D = p.depth;

  const dustL = p.dustFlapLength ?? D;
  const topTuckL = p.topFlapTuckLength ?? 20;
  const sideFlapL = p.sideFlapsLength ?? 15.5;

  const xL = D + sideFlapL + 10;
  const xR = xL + W;
  const yCovT = topTuckL + 10;
  const yCovB = yCovT + H;
  const yTDB = yCovB + D;
  const yBaseB = yTDB + H;
  const yBot = yBaseB + D;

  const C = '#2563eb';
  
  const baseFS = 3.5;  // font size in mm
  const baseAH = 1.6;  // arrow head size in mm
  const baseSW = 0.35; // stroke width in mm
  const baseRectStroke = 0.2;

  const s = scale > 0 ? scale : 1;
  const SW = baseSW / s;
  const AH = baseAH / s;
  const FS = baseFS / s;

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
  
  // W: on Base panel (midpoint of yTDB and yBaseB is yTDB + H/2)
  out += dimH(xL, xR, yTDB + H * 0.5, fmt(W));
  
  // H: on Lid panel (from yCovT to yCovB)
  out += dimV(xL + W * 0.2, yCovT, yCovB, fmt(H));
  
  // D: on Back wall (from yCovB to yTDB)
  out += dimV(xL + W * 0.5, yCovB, yTDB, fmt(D));

  return `<g class="t00012-dimensions" pointer-events="none">${out}</g>`;
}
