// T0002 — Visual-only dimensions overlay.
// Renders CAD-style blue dimension lines on top of the template preview.
// NOT included in SVG / PDF exports or Sheet Nesting. Pure UI.

import type { T0002Params } from './types';

export type DimUnit = 'mm' | 'cm' | 'in';

export function buildT0002DimensionsSvg(p: T0002Params, unit: DimUnit = 'mm', scale = 1): string {
  const W = p.width;
  const H = p.height;
  const D = p.depth;
  const Gf = p.glueFlap;
  const Lid = p.lidTongue;
  const Cov = D - 0.25;

  const Xf1 = Gf;
  const Xd1 = Gf + W;
  const Xf2 = Gf + W + D;
  const Xd2 = Gf + 2 * W + D;

  const Yft = Lid + Cov;
  const Yfb = Yft + H;

  const C = '#2563eb';
  
  // Since we render in mm user space, we define the dimension layout directly in mm
  // for natural proportion (e.g. font size 3.5mm, stroke 0.35mm, arrowhead 1.8mm).
  // This ensures text scales proportionally with the drawing and doesn't look huge.
  const baseFS = 3.5;  // font size in mm
  const baseAH = 1.6;  // arrow head size in mm
  const baseSW = 0.35; // stroke width in mm
  const baseRectStroke = 0.2;

  // We allow adjusting it by a scale factor if passed (defaults to 1).
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
  out += dimH(Xf1, Xd1, Yft + H * 0.28, fmt(W));
  out += dimH(Xd1, Xf2, Yft + H * 0.55, fmt(D));
  out += dimV((Xf2 + Xd2) / 2, Yft, Yfb, fmt(H));

  return `<g class="t0002-dimensions" pointer-events="none">${out}</g>`;
}
