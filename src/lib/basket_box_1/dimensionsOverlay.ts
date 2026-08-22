import type { Basket_Box_1Params } from './types';
import { generateBasket_Box_1Geometry } from './geometry';

export type DimUnit = 'mm' | 'cm' | 'in';

export const generateBasket_Box_1DimensionsOverlay = buildBasket_Box_1DimensionsSvg;

export function buildBasket_Box_1DimensionsSvg(
  p: Basket_Box_1Params,
  unit: DimUnit = 'mm',
  scale = 1
): string {
  const geo = generateBasket_Box_1Geometry(p);
  const { L, W, D, handleNeckH, handleGripH, wingW, totalW, totalH, xMain, yMain } = geo.derived;

  const C = '#2563eb'; // CAD Royal Blue
  const baseFS = 3.8;  // font size in mm
  const baseAH = 1.6;  // arrow head size in mm
  const baseSW = 0.35; // stroke width in mm
  const baseRectStroke = 0.25;

  const s = scale > 0 ? scale : 1;
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

  const xMainL = xMain;
  const xMainR = xMain + L;
  const xCenter = xMain + L / 2;

  const yTopWallCrease = yMain;
  const yBotWallCrease = yMain + W;
  const yTopNeckCrease = yMain - D;
  const yTopGripCrease = yTopNeckCrease - handleNeckH;
  const yTopEarBase = yTopGripCrease - handleGripH;

  // 1. Length L (الطول) on Central Base
  out += dimH(xMainL, xMainR, yMain + W * 0.5, fmt(L));

  // 2. Width W (العرض) on Central Base
  out += dimV(xCenter - L * 0.25, yTopWallCrease, yBotWallCrease, fmt(W));

  // 3. Depth D (العمق) on Left Wall
  out += dimH(xMainL - D, xMainL, yMain + W * 0.25, fmt(D));

  // 4. Depth D (العمق) on Top Wall
  out += dimV(xCenter + L * 0.25, yTopNeckCrease, yTopWallCrease, fmt(D));

  // 5. Handle Neck Height (رقبة المقبض)
  out += dimV(xCenter + L * 0.35, yTopGripCrease, yTopNeckCrease, fmt(handleNeckH));

  // 6. Handle Grip Height (قبضة اليد)
  out += dimV(xCenter + L * 0.35, yTopEarBase, yTopGripCrease, fmt(handleGripH));

  // 7. Handle Slot Width (عرض فتحة المقبض 85mm)
  const handleCutoutW = Math.min(L - 20, 85.0);
  const yTopHandleCenter = yTopGripCrease - 15;
  out += dimH(xCenter - handleCutoutW / 2, xCenter + handleCutoutW / 2, yTopHandleCenter, fmt(handleCutoutW));

  // 8. Side Lock Slit (فتحة القفل الجانبي 49mm)
  const slotW = Math.min(wingW - 1, 49.0);
  out += dimH(xMainL - D - slotW, xMainL - D, yMain + W * 0.5, fmt(slotW));

  // 8. Outer Overall Total Dimensions (المقاس الكلي للإفراد)
  const C_TOTAL = '#64748b';       // Slate grey
  const C_TOTAL_TEXT = '#1e293b';  // Dark slate
  const SW_TOT = 0.35 * s;

  const arrowLTot = (x: number, y: number) =>
    `<path d="M${x} ${y} l${AH} ${-AH / 2} l0 ${AH} z" fill="${C_TOTAL}"/>`;
  const arrowRTot = (x: number, y: number) =>
    `<path d="M${x} ${y} l${-AH} ${-AH / 2} l0 ${AH} z" fill="${C_TOTAL}"/>`;
  const arrowUTot = (x: number, y: number) =>
    `<path d="M${x} ${y} l${-AH / 2} ${AH} l${AH} 0 z" fill="${C_TOTAL}"/>`;
  const arrowDTot = (x: number, y: number) =>
    `<path d="M${x} ${y} l${-AH / 2} ${-AH} l${AH} 0 z" fill="${C_TOTAL}"/>`;

  const labelTot = (x: number, y: number, text: string) => {
    const padX = 1.6 / s;
    const padY = 1.0 / s;
    const w = text.length * FS * 0.62 + padX * 2;
    const h = FS + padY * 2;
    return (
      `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" ` +
      `fill="#f8fafc" fill-opacity="0.95" stroke="${C_TOTAL}" stroke-width="${0.3 / s}" rx="${1.5 / s}"/>` +
      `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${FS}" font-weight="700" ` +
      `fill="${C_TOTAL_TEXT}" text-anchor="middle" dominant-baseline="middle" direction="ltr" unicode-bidi="isolate">${text}</text>`
    );
  };

  // Top total width bar
  const totalBarY = Math.max(0, -6);
  out += `<line x1="0" y1="${totalBarY}" x2="${totalW}" y2="${totalBarY}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}" stroke-dasharray="2,2"/>`;
  out += arrowLTot(0, totalBarY);
  out += arrowRTot(totalW, totalBarY);
  out += labelTot(totalW / 2, totalBarY, `Total W: ${fmt(totalW)}`);

  // Left total height bar
  const totalBarX = Math.max(0, -6);
  out += `<line x1="${totalBarX}" y1="0" x2="${totalBarX}" y2="${totalH}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}" stroke-dasharray="2,2"/>`;
  out += arrowUTot(totalBarX, 0);
  out += arrowDTot(totalBarX, totalH);
  out += labelTot(totalBarX, totalH / 2, `Total H: ${fmt(totalH)}`);

  return out;
}
