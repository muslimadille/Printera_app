// B15_06_00_55 — CAD Dimensions Overlay
// Generates professional CAD dimension lines and badged labels strictly matching T0002 standard.

import type { B15_06_00_55Geometry } from './types';

export type DimUnit = 'mm' | 'cm' | 'in';

export function buildB15_06_00_55DimensionsSvg(
  geo: B15_06_00_55Geometry,
  unit: DimUnit = 'mm',
  scale = 1,
): string {
  const { derived } = geo;
  const { totalWidth, totalHeight, w, h, d, tuckFlap, topDustHeight } = derived;

  const sScale = scale > 0 ? scale : 1;

  // Geometry references
  const x0 = 0;
  const x1 = d;
  const x2 = d + w;
  const x3 = d + w + d;
  const x4 = d + w + d + w;
  const x5 = totalWidth;

  const yTop = topDustHeight;
  const yBot = topDustHeight + h;

  // Colors matching T0002 standard
  const C_BLUE = '#2563eb';
  const C_TOTAL = '#64748b';
  const C_TOTAL_TEXT = '#1e293b';

  // Dimension scaling
  const baseFS = 4.2; // Font size in mm
  const baseAH = 1.8; // Arrow head size in mm
  const baseSW = 0.4; // Stroke width in mm
  const baseRectStroke = 0.3;

  const SW = baseSW * sScale;
  const AH = baseAH * sScale;
  const FS = baseFS * sScale;

  const conv = (n: number) => {
    if (unit === 'cm') return Math.round((n / 10) * 100) / 100;
    if (unit === 'in') return Math.round((n / 25.4) * 100) / 100;
    return Math.round(n * 100) / 100;
  };
  const suffix = unit === 'mm' ? 'mm' : unit === 'cm' ? 'cm' : 'in';
  const fmt = (n: number) => `${conv(n)} ${suffix}`;

  // Arrow Heads
  const arrowL = (x: number, y: number) =>
    `<path d="M${x} ${y} l${AH} ${-AH / 2} l0 ${AH} z" fill="${C_BLUE}"/>`;
  const arrowR = (x: number, y: number) =>
    `<path d="M${x} ${y} l${-AH} ${-AH / 2} l0 ${AH} z" fill="${C_BLUE}"/>`;
  const arrowU = (x: number, y: number) =>
    `<path d="M${x} ${y} l${-AH / 2} ${AH} l${AH} 0 z" fill="${C_BLUE}"/>`;
  const arrowD = (x: number, y: number) =>
    `<path d="M${x} ${y} l${-AH / 2} ${-AH} l${AH} 0 z" fill="${C_BLUE}"/>`;

  // Badged Label
  const label = (x: number, y: number, text: string) => {
    const padX = 1.2 / sScale;
    const padY = 0.8 / sScale;
    const boxW = text.length * FS * 0.58 + padX * 2;
    const boxH = FS + padY * 2;
    return (
      `<rect x="${x - boxW / 2}" y="${y - boxH / 2}" width="${boxW}" height="${boxH}" ` +
      `fill="#ffffff" fill-opacity="0.95" stroke="${C_BLUE}" stroke-width="${baseRectStroke / sScale}" rx="${1.0 / sScale}"/>` +
      `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${FS}" font-weight="600" ` +
      `fill="${C_BLUE}" text-anchor="middle" dominant-baseline="middle" direction="ltr" unicode-bidi="isolate">${text}</text>`
    );
  };

  // Horizontal dimension line
  const dimH = (xStart: number, xEnd: number, y: number, text: string) =>
    `<line x1="${xStart}" y1="${y}" x2="${xEnd}" y2="${y}" stroke="${C_BLUE}" stroke-width="${SW}"/>` +
    arrowL(xStart, y) +
    arrowR(xEnd, y) +
    label((xStart + xEnd) / 2, y, text);

  // Vertical dimension line
  const dimV = (x: number, yStart: number, yEnd: number, text: string) =>
    `<line x1="${x}" y1="${yStart}" x2="${x}" y2="${yEnd}" stroke="${C_BLUE}" stroke-width="${SW}"/>` +
    arrowU(x, yStart) +
    arrowD(x, yEnd) +
    label(x, (yStart + yEnd) / 2, text);

  let out = '';

  // 1. Panel 2 Width (W)
  out += dimH(x1, x2, yTop + h * 0.28, fmt(w));

  // 2. Panel 1 Depth (D)
  out += dimH(x0, x1, yTop + h * 0.55, fmt(d));

  // 3. Body Height (H)
  out += dimV((x3 + x4) / 2, yTop, yBot, fmt(h));

  // Outer Total Overall Dimensions (المقاس الكلي للقالب)
  const SW_TOT = 0.35 * sScale;
  const FS_TOT = 4.2 * sScale;
  const offset = 14 * sScale;

  const yTotal = totalHeight + offset;
  const xTotal = totalWidth + offset;

  // Extension lines
  const extW =
    `<line x1="0" y1="${totalHeight}" x2="0" y2="${yTotal + 3 * sScale}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}" stroke-dasharray="1.5,1.5"/>` +
    `<line x1="${totalWidth}" y1="${totalHeight}" x2="${totalWidth}" y2="${yTotal + 3 * sScale}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}" stroke-dasharray="1.5,1.5"/>`;

  const extH =
    `<line x1="${totalWidth}" y1="0" x2="${xTotal + 3 * sScale}" y2="0" stroke="${C_TOTAL}" stroke-width="${SW_TOT}" stroke-dasharray="1.5,1.5"/>` +
    `<line x1="${totalWidth}" y1="${totalHeight}" x2="${xTotal + 3 * sScale}" y2="${totalHeight}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}" stroke-dasharray="1.5,1.5"/>`;

  const labelTotal = (x: number, y: number, text: string) => {
    const padX = 1.6 / sScale;
    const padY = 1.0 / sScale;
    const boxW = text.length * FS_TOT * 0.58 + padX * 2;
    const boxH = FS_TOT + padY * 2;
    return (
      `<rect x="${x - boxW / 2}" y="${y - boxH / 2}" width="${boxW}" height="${boxH}" ` +
      `fill="#ffffff" stroke="${C_TOTAL}" stroke-width="${0.3 / sScale}" rx="${1.2 / sScale}"/>` +
      `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${FS_TOT}" font-weight="700" ` +
      `fill="${C_TOTAL_TEXT}" text-anchor="middle" dominant-baseline="middle" direction="ltr" unicode-bidi="isolate">${text}</text>`
    );
  };

  const totalDimW =
    extW +
    `<line x1="0" y1="${yTotal}" x2="${totalWidth}" y2="${yTotal}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<line x1="0" y1="${yTotal - 3 * sScale}" x2="0" y2="${yTotal + 3 * sScale}" stroke="${C_TOTAL}" stroke-width="${SW_TOT * 1.5}"/>` +
    `<line x1="${totalWidth}" y1="${yTotal - 3 * sScale}" x2="${totalWidth}" y2="${yTotal + 3 * sScale}" stroke="${C_TOTAL}" stroke-width="${SW_TOT * 1.5}"/>` +
    labelTotal(totalWidth / 2, yTotal, fmt(totalWidth));

  const totalDimH =
    extH +
    `<line x1="${xTotal}" y1="0" x2="${xTotal}" y2="${totalHeight}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<line x1="${xTotal - 3 * sScale}" y1="0" x2="${xTotal + 3 * sScale}" y2="0" stroke="${C_TOTAL}" stroke-width="${SW_TOT * 1.5}"/>` +
    `<line x1="${xTotal - 3 * sScale}" y1="${totalHeight}" x2="${xTotal + 3 * sScale}" y2="${totalHeight}" stroke="${C_TOTAL}" stroke-width="${SW_TOT * 1.5}"/>` +
    labelTotal(xTotal, totalHeight / 2, fmt(totalHeight));

  out += totalDimW;
  out += totalDimH;

  return out;
}
