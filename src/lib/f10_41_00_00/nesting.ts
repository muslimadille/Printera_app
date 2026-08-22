import { F10_41_00_00Dimensions, F10_41_00_00NestingParams } from './types';
import { generateF10_41_00_00Geometry } from './geometry';

export type RotationMode = 'normal' | 'rotated' | 'auto';
export type Orientation = 'normal' | 'rotated';

export interface OrientationResult {
  columns: number;
  rows: number;
  total: number;
  pitchX: number;
  pitchY: number;
}

export interface F10_41_00_00NestingResult {
  templateBBox: { width: number; height: number };
  usableSheet: { width: number; height: number };
  normal: OrientationResult;
  rotated: OrientationResult;
  bestOrientation: Orientation;
  bestTotal: number;
  items: { x: number; y: number }[];
}

export function computeF10_41_00_00Nesting(
  dims: F10_41_00_00Dimensions,
  params: F10_41_00_00NestingParams
): F10_41_00_00NestingResult {
  const geo = generateF10_41_00_00Geometry(dims);
  const tW = geo.width;
  const tH = geo.height;

  const sheetW = Math.max(1, params.sheetWidth);
  const sheetH = Math.max(1, params.sheetHeight);
  const margin = Math.max(0, params.margin);
  const gripper = Math.max(0, params.gripper ?? 0);
  const gap = Math.max(0, params.spacing);

  const usableW = Math.max(0, sheetW - 2 * margin);
  const usableH = Math.max(0, sheetH - 2 * margin - gripper);

  // Normal calculation
  const colsNormal = tW > 0 ? Math.floor((usableW + gap) / (tW + gap)) : 0;
  const rowsNormal = tH > 0 ? Math.floor((usableH + gap) / (tH + gap)) : 0;
  const totalNormal = Math.max(0, colsNormal) * Math.max(0, rowsNormal);

  const normal: OrientationResult = {
    columns: Math.max(0, colsNormal),
    rows: Math.max(0, rowsNormal),
    total: totalNormal,
    pitchX: tW + gap,
    pitchY: tH + gap,
  };

  // Rotated calculation
  const colsRotated = tH > 0 ? Math.floor((usableW + gap) / (tH + gap)) : 0;
  const rowsRotated = tW > 0 ? Math.floor((usableW + gap) / (tW + gap)) : 0;
  const totalRotated = Math.max(0, colsRotated) * Math.max(0, rowsRotated);

  const rotated: OrientationResult = {
    columns: Math.max(0, colsRotated),
    rows: Math.max(0, rowsRotated),
    total: totalRotated,
    pitchX: tH + gap,
    pitchY: tW + gap,
  };

  const allowRot = params.allowRotation !== false;
  const bestOrientation: Orientation = (allowRot && totalRotated > totalNormal) ? 'rotated' : 'normal';
  const bestTotal = bestOrientation === 'rotated' ? totalRotated : totalNormal;
  const grid = bestOrientation === 'rotated' ? rotated : normal;

  const usableX = margin;
  const usableY = margin + gripper;

  const items: { x: number; y: number }[] = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.columns; c++) {
      items.push({
        x: usableX + c * grid.pitchX,
        y: usableY + r * grid.pitchY,
      });
    }
  }

  return {
    templateBBox: { width: tW, height: tH },
    usableSheet: { width: usableW, height: usableH },
    normal,
    rotated,
    bestOrientation,
    bestTotal,
    items,
  };
}

export function generateF10_41_00_00SheetSvg(
  dims: F10_41_00_00Dimensions,
  params: F10_41_00_00NestingParams
): string {
  const geo = generateF10_41_00_00Geometry(dims);
  const nesting = computeF10_41_00_00Nesting(dims, params);
  const { sheetWidth: sheetW, sheetHeight: sheetH, margin, gripper = 0 } = params;

  const orientation = nesting.bestOrientation;
  const tW = geo.width;
  const tH = geo.height;
  const cellW = orientation === 'rotated' ? tH : tW;
  const cellH = orientation === 'rotated' ? tW : tH;

  const creaseD = geo.creaseLines.map(l => `M${l.start.x},${l.start.y} L${l.end.x},${l.end.y}`).join(' ');
  const lockCreaseD = geo.lockCreaseLines.map(l => `M${l.start.x},${l.start.y} L${l.end.x},${l.end.y}`).join(' ');
  const cutD = geo.cutLines.map(l => `M${l.start.x},${l.start.y} L${l.end.x},${l.end.y}`).join(' ');

  const sw = Math.max(0.15, Math.min(sheetW, sheetH) / 1200);
  const sheetSw = Math.max(0.3, Math.min(sheetW, sheetH) / 800);
  const padX = Math.max(sheetW * 0.03, 1.5);
  const padY = Math.max(sheetH * 0.03, 1.5);

  const usableX = margin;
  const usableY = margin + gripper;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-padX} ${-padY} ${sheetW + padX * 2} ${sheetH + padY * 2}" width="${sheetW}mm" height="${sheetH}mm">
    <rect x="0" y="0" width="${sheetW}" height="${sheetH}" fill="#ffffff" stroke="#111827" stroke-width="${sheetSw}" />
    ${gripper > 0 ? `<rect x="0" y="0" width="${sheetW}" height="${margin + gripper}" fill="#fee2e2" fill-opacity="0.55" stroke="none" />` : ''}
    <rect x="${margin}" y="${margin}" width="${Math.max(0, sheetW - 2 * margin)}" height="${Math.max(0, sheetH - 2 * margin)}" fill="none" stroke="#94a3b8" stroke-width="${sheetSw}" stroke-dasharray="${sheetSw * 6} ${sheetSw * 4}" />
    <rect x="${usableX}" y="${usableY}" width="${nesting.usableSheet.width}" height="${nesting.usableSheet.height}" fill="none" stroke="#3b82f6" stroke-width="${sheetSw}" stroke-dasharray="${sheetSw * 3} ${sheetSw * 3}" />
  `;

  if (nesting.items.length === 0) {
    svg += `<text x="${sheetW / 2}" y="${sheetH / 2}" font-size="${Math.max(6, Math.min(sheetW, sheetH) / 40)}" fill="#dc2626" text-anchor="middle" dominant-baseline="middle">القالب لا يدخل داخل الشيت بالقيم الحالية</text>`;
  }

  nesting.items.forEach((it, i) => {
    const transform = orientation === 'rotated'
      ? `translate(${it.x + tH} ${it.y}) rotate(90)`
      : `translate(${it.x} ${it.y})`;
    const labelSize = Math.min(cellW, cellH) * 0.22;

    svg += `<g>`;
    svg += `  <g transform="${transform}">`;
    svg += `    <path d="${creaseD}" fill="none" stroke="#00A651" stroke-width="${sw}" stroke-dasharray="3,2" stroke-linecap="round" stroke-linejoin="round" />`;
    if (lockCreaseD) {
      svg += `    <path d="${lockCreaseD}" fill="none" stroke="#c8b700" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" />`;
    }
    svg += `    <path d="${cutD}" fill="none" stroke="#ED1C24" stroke-width="${sw * 1.4}" stroke-linecap="round" stroke-linejoin="round" />`;
    svg += `  </g>`;
    svg += `  <text x="${it.x + cellW / 2}" y="${it.y + cellH / 2}" text-anchor="middle" dominant-baseline="middle" font-size="${labelSize}" font-weight="700" fill="#2563eb" opacity="0.55" pointer-events="none">${i + 1}</text>`;
    svg += `</g>`;
  });

  svg += `</svg>`;
  return svg;
}
