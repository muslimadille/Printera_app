import { Basket_Box_1Params } from './types';
import { generateBasket_Box_1Geometry } from './geometry';

export interface BasketNestingItem {
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
}

export interface BasketNestingResult {
  items: BasketNestingItem[];
  sheetWidth: number;
  sheetHeight: number;
  count: number;
  efficiency: number;
  wastePercent: number;
  totalSheetArea: number;
  usedArea: number;
}

export function computeBasket_Box_1Nesting(params: Basket_Box_1Params): BasketNestingResult {
  const geo = generateBasket_Box_1Geometry(params);
  const itemW = geo.bbox.width;
  const itemH = geo.bbox.height;
  const spacing = params.spacing || 3;
  const margin = params.sheetMargin || 10;
  const gripper = params.gripper || 15;

  const usableW = params.sheetWidth - margin * 2;
  const usableH = params.sheetHeight - margin * 2 - gripper;

  // 0 degree orientation
  const cols0 = Math.floor((usableW + spacing) / (itemW + spacing));
  const rows0 = Math.floor((usableH + spacing) / (itemH + spacing));
  const count0 = Math.max(0, cols0) * Math.max(0, rows0);

  // 90 degree orientation
  const cols90 = Math.floor((usableW + spacing) / (itemH + spacing));
  const rows90 = Math.floor((usableH + spacing) / (itemW + spacing));
  const count90 = Math.max(0, cols90) * Math.max(0, rows90);

  const rotate = count90 > count0;
  const count = rotate ? count90 : count0;
  const cols = rotate ? cols90 : cols0;
  const rows = rotate ? rows90 : rows0;
  const finalItemW = rotate ? itemH : itemW;
  const finalItemH = rotate ? itemW : itemH;

  const items: BasketNestingItem[] = [];
  const startX = margin + (usableW - (cols * (finalItemW + spacing) - spacing)) / 2;
  const startY = margin + gripper + (usableH - (rows * (finalItemH + spacing) - spacing)) / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      items.push({
        x: startX + c * (finalItemW + spacing),
        y: startY + r * (finalItemH + spacing),
        rotation: rotate ? 90 : 0,
        width: itemW,
        height: itemH,
      });
    }
  }

  const totalSheetArea = params.sheetWidth * params.sheetHeight;
  const usedArea = count * (itemW * itemH);
  const efficiency = totalSheetArea > 0 ? (usedArea / totalSheetArea) * 100 : 0;

  return {
    items,
    sheetWidth: params.sheetWidth,
    sheetHeight: params.sheetHeight,
    count,
    efficiency,
    wastePercent: 100 - efficiency,
    totalSheetArea,
    usedArea,
  };
}
