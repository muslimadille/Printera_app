// A60_20_01_01 — Visual Dimensions Overlay Engine
// Synchronized 100% with geometry.ts parametric coordinates

import type { A60_20_01_01Params } from './types';

export type DimUnit = 'mm' | 'cm' | 'in';

export function buildA60_20_01_01DimensionsSvg(p: A60_20_01_01Params, unit: DimUnit = 'mm', scale = 1): string {
  const { width: W, height: H, depth: D, glueFlap: Gf, tuck: Tuck } = p;

  const X0 = 0;
  const X1 = Gf;
  const X2 = X1 + W;
  const X3 = X2 + D;
  const X4 = X3 + W;
  const X5 = X4 + Math.max(10, D - 0.5);

  const lidCoverH = Math.max(10, D - 0.25);
  const Y0 = 0;
  const YTuckCrease = Y0 + Tuck;
  const Y1 = YTuckCrease + lidCoverH;
  const Y2 = Y1 + H;

  const C = '#2563eb';
  const baseFS = 4.2;
  const baseSW = 0.4;

  const s = scale > 0 ? scale : 1;
  const FS = baseFS * s;
  const SW = baseSW * s;

  const format = (v: number) => {
    if (unit === 'cm') return (v / 10).toFixed(1) + ' cm';
    if (unit === 'in') return (v / 25.4).toFixed(2) + ' in';
    return v.toFixed(0) + ' mm';
  };

  const label = (x: number, y: number, text: string) => {
    const padX = 1.0 / s;
    const padY = 0.6 / s;
    const w = text.length * FS * 0.55 + padX * 2;
    const h = FS + padY * 2;
    return (
      `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" ` +
      `fill="#ffffff" fill-opacity="0.95" stroke="${C}" stroke-width="${0.4 / s}" rx="${0.8 / s}"/>` +
      `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${FS}" font-weight="600" ` +
      `fill="${C}" text-anchor="middle" dominant-baseline="middle">${text}</text>`
    );
  };

  const dimH = (xStart: number, xEnd: number, y: number, val: number) => {
    const midX = (xStart + xEnd) / 2;
    return (
      `<line x1="${xStart}" y1="${y}" x2="${xEnd}" y2="${y}" stroke="${C}" stroke-width="${SW}"/>` +
      label(midX, y, format(val))
    );
  };

  const dimV = (x: number, yStart: number, yEnd: number, val: number) => {
    const midY = (yStart + yEnd) / 2;
    return (
      `<line x1="${x}" y1="${yStart}" x2="${x}" y2="${yEnd}" stroke="${C}" stroke-width="${SW}"/>` +
      label(x, midY, format(val))
    );
  };

  const yMid = Y1 + H / 2;

  // Inner Panel Dimensions
  const d1 = dimH(X1, X2, yMid, W);
  const d2 = dimH(X2, X3, yMid, D);
  const d3 = dimV(X3 + W / 2, Y1, Y2, H);

  // Outer Total Dimensions (المقاس الكلي للقالب)
  const crashH = D * 0.75;
  const Y3 = Y2 + crashH;
  const TotalW = X5;
  const TotalH = Y3;

  const C_TOTAL = '#64748b';       // Slate grey line & tick color
  const C_TOTAL_TEXT = '#1e293b';  // Dark charcoal slate text color
  const SW_TOT = 0.35 * s;
  const FS_TOT = 4.2 * s;
  const offset = 14 * s;

  const yTotal = TotalH + offset;
  const xTotal = TotalW + offset;

  // Extension guide lines for Total Dimensions
  const extW = 
    `<line x1="${X0}" y1="${TotalH + 2 * s}" x2="${X0}" y2="${yTotal + 4 * s}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<line x1="${TotalW}" y1="${TotalH + 2 * s}" x2="${TotalW}" y2="${yTotal + 4 * s}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>`;

  const extH = 
    `<line x1="${TotalW + 2 * s}" y1="${Y0}" x2="${xTotal + 4 * s}" y2="${Y0}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<line x1="${TotalW + 2 * s}" y1="${TotalH}" x2="${xTotal + 4 * s}" y2="${TotalH}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>`;

  const dimLineW = 
    `<line x1="${X0}" y1="${yTotal}" x2="${TotalW}" y2="${yTotal}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<line x1="${X0}" y1="${yTotal - 2 * s}" x2="${X0}" y2="${yTotal + 2 * s}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<line x1="${TotalW}" y1="${yTotal - 2 * s}" x2="${TotalW}" y2="${yTotal + 2 * s}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<text x="${(X0 + TotalW) / 2}" y="${yTotal + FS_TOT * 0.95}" font-family="Arial, sans-serif" font-size="${FS_TOT}" font-weight="600" ` +
    `fill="${C_TOTAL_TEXT}" text-anchor="middle" dominant-baseline="hanging" direction="ltr" unicode-bidi="isolate">${format(TotalW)}</text>`;

  const textX = xTotal + 5 * s;
  const textY = (Y0 + TotalH) / 2;
  const dimLineH = 
    `<line x1="${xTotal}" y1="${Y0}" x2="${xTotal}" y2="${TotalH}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<line x1="${xTotal - 2 * s}" y1="${Y0}" x2="${xTotal + 2 * s}" y2="${Y0}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<line x1="${xTotal - 2 * s}" y1="${TotalH}" x2="${xTotal + 2 * s}" y2="${TotalH}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<text x="${textX}" y="${textY}" transform="rotate(90, ${textX}, ${textY})" font-family="Arial, sans-serif" font-size="${FS_TOT}" font-weight="600" ` +
    `fill="${C_TOTAL_TEXT}" text-anchor="middle" dominant-baseline="middle" direction="ltr" unicode-bidi="isolate">${format(TotalH)}</text>`;

  return `<g class="dimensions-overlay">${d1}${d2}${d3}${extW}${extH}${dimLineW}${dimLineH}</g>`;
}
