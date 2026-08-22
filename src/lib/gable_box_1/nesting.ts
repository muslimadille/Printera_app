import { Gable_Box_1Dimensions, Gable_Box_1NestingParams } from './types';
import { generateGable_Box_1Geometry } from './geometry';

export interface Gable_Box_1NestingResult {
  sheetW: number;
  sheetH: number;
  margin: number;
  spacing: number;
  normalCountX: number;
  normalCountY: number;
  normalTotal: number;
  rotatedCountX: number;
  rotatedCountY: number;
  rotatedTotal: number;
  bestOrientation: 'normal' | 'rotated';
  bestTotal: number;
  fitStatus: 'fits' | 'exceeds';
  itemWidth: number;
  itemHeight: number;
  utilization: number; // percentage (0-100)
}

export function computeGable_Box_1Nesting(
  dims: Gable_Box_1Dimensions,
  nesting: Gable_Box_1NestingParams
): Gable_Box_1NestingResult {
  const geo = generateGable_Box_1Geometry(dims);
  const itemW = geo.width;
  const itemH = geo.height;

  const sheetW = nesting.sheetWidth;
  const sheetH = nesting.sheetHeight;
  const margin = nesting.margin;
  const spacing = nesting.spacing;

  const usableW = Math.max(0, sheetW - margin * 2);
  const usableH = Math.max(0, sheetH - margin * 2);

  // Normal Orientation (0°)
  const normalCountX = Math.floor((usableW + spacing) / (itemW + spacing));
  const normalCountY = Math.floor((usableH + spacing) / (itemH + spacing));
  const normalTotal = Math.max(0, normalCountX * normalCountY);

  // Rotated Orientation (90°)
  const rotatedCountX = Math.floor((usableW + spacing) / (itemH + spacing));
  const rotatedCountY = Math.floor((usableH + spacing) / (itemW + spacing));
  const rotatedTotal = Math.max(0, rotatedCountX * rotatedCountY);

  const bestOrientation = normalTotal >= rotatedTotal ? 'normal' : 'rotated';
  const bestTotal = Math.max(normalTotal, rotatedTotal);
  const fitStatus = bestTotal > 0 ? 'fits' : 'exceeds';

  const usedArea = bestTotal * itemW * itemH;
  const totalSheetArea = sheetW * sheetH;
  const utilization = totalSheetArea > 0 ? (usedArea / totalSheetArea) * 100 : 0;

  return {
    sheetW,
    sheetH,
    margin,
    spacing,
    normalCountX,
    normalCountY,
    normalTotal,
    rotatedCountX,
    rotatedCountY,
    rotatedTotal,
    bestOrientation,
    bestTotal,
    fitStatus,
    itemWidth: itemW,
    itemHeight: itemH,
    utilization,
  };
}
