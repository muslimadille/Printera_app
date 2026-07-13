import type { T0006Params, T0006Geometry } from "./types";

export interface NestingResult {
  cols: number;
  rows: number;
  total: number;
  widthUsed: number;
  heightUsed: number;
  efficiency: number;
  placements: Array<{
    x: number;
    y: number;
    rotation: 0 | 90;
  }>;
}

export function calculateT0006Nesting(p: T0006Params, geo: T0006Geometry): NestingResult {
  const margin = Math.max(0, p.sheetMargin);
  const gripper = Math.max(0, p.gripper);
  const usableW = Math.max(0, p.sheetWidth - 2 * margin);
  const usableH = Math.max(0, p.sheetHeight - 2 * margin - gripper);

  const itemW = geo.bbox.w;
  const itemH = geo.bbox.h;

  const solve = (w: number, h: number): NestingResult => {
    if (w <= 0 || h <= 0 || usableW <= 0 || usableH <= 0) {
      return { cols: 0, rows: 0, total: 0, widthUsed: 0, heightUsed: 0, efficiency: 0, placements: [] };
    }
    const cols = Math.floor(usableW / w);
    const rows = Math.floor(usableH / h);
    const total = cols * rows;
    const placements = [];
    if (total > 0) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          placements.push({
            x: margin + c * w,
            y: margin + gripper + r * h,
            rotation: (w === itemW ? 0 : 90) as 0 | 90
          });
        }
      }
    }
    const widthUsed = cols * w;
    const heightUsed = rows * h;
    const efficiency = total > 0 ? (total * w * h) / (usableW * usableH) : 0;
    return { cols, rows, total, widthUsed, heightUsed, efficiency, placements };
  };

  const r0 = solve(itemW, itemH);
  const r90 = solve(itemH, itemW);

  return r0.total >= r90.total ? r0 : r90;
}
