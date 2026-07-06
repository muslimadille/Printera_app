// D001 — Visual-only dimensions overlay.
// Renders CAD-style blue dimension lines on top of the template preview.
// NOT included in SVG / PDF exports or Sheet Nesting. Pure UI.

import type { D001Params } from './types';

export type DimUnit = 'mm' | 'cm' | 'in';

export function buildD001DimensionsSvg(p: D001Params, unit: DimUnit = 'mm', scale = 1): string {
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
  // Sizes are expressed in template-mm units, but divided by `scale` so that
  // after the parent <g scale(scale)> they render at a constant visual size
  // (in CSS px), independent of how much the template itself is zoomed.
  // We clamp the on-screen px values so dimensions stay readable at any zoom.
  const s = scale > 0 ? scale : 1;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const FS_PX = clamp(14, 12, 16);   // font size in CSS px
  const SW_PX = clamp(1.2, 1, 1.6);  // dimension line stroke in CSS px
  const AH_PX = clamp(6.5, 5, 8);    // arrow head size in CSS px
  const SW = SW_PX / s;
  const AH = AH_PX / s;
  const FS = FS_PX / s;

  const arrowL = (x: number, y: number) =>
    `<path d="M${x} ${y} l${AH} ${-AH / 2} l0 ${AH} z" fill="${C}"/>`;
  const arrowR = (x: number, y: number) =>
    `<path d="M${x} ${y} l${-AH} ${-AH / 2} l0 ${AH} z" fill="${C}"/>`;
  const arrowU = (x: number, y: number) =>
    `<path d="M${x} ${y} l${-AH / 2} ${AH} l${AH} 0 z" fill="${C}"/>`;
  const arrowD = (x: number, y: number) =>
    `<path d="M${x} ${y} l${-AH / 2} ${-AH} l${AH} 0 z" fill="${C}"/>`;

  const label = (x: number, y: number, text: string) => {
    const padX = 4 / s;
    const padY = 2.5 / s;
    const w = text.length * FS * 0.58 + padX * 2;
    const h = FS + padY * 2;
    return (
      `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" ` +
      `fill="#ffffff" fill-opacity="0.95" stroke="${C}" stroke-width="${0.6 / s}" rx="${1.5 / s}"/>` +
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

  return `<g class="d001-dimensions" pointer-events="none">${out}</g>`;
}
