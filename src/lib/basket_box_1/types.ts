export interface Basket_Box_1Params {
  width: number;        // L (mm) - Length of central base
  depth: number;        // W (mm) - Width of central base
  height: number;       // D (mm) - Depth of side walls
  handleNeckH?: number; // Optional override for neck height (defaults to W/2 - 0.33)
  handleGripH?: number; // Optional override for handle grip height (defaults to 40)
  sheetWidth: number;   // Printing sheet width (mm)
  sheetHeight: number;  // Printing sheet height (mm)
  gripper: number;      // Gripper margin (mm)
  sheetMargin: number;  // Border margin (mm)
  spacing: number;      // Spacing between nested items (mm)
  referenceMode?: boolean;
}

export const DEFAULT_BASKET_BOX_1_PARAMS: Basket_Box_1Params = {
  width: 170,
  depth: 150,
  height: 50,
  sheetWidth: 1000,
  sheetHeight: 700,
  gripper: 15,
  sheetMargin: 10,
  spacing: 3,
};

export interface Basket_Box_1Derived {
  L: number;
  W: number;
  D: number;
  handleNeckH: number;
  handleGripH: number;
  cornerGeometryH: number;
  wingW: number;
  totalW: number;
  totalH: number;
  xMain: number;
  yMain: number;
}

export interface Basket_Box_1Segment {
  kind: 'CUT' | 'CREASE' | 'OUTER';
  geometry: 'line' | 'path';
  start: { x: number; y: number };
  end: { x: number; y: number };
  d?: string;
  strokeColor?: string;
  dash?: string;
  name?: string;
}

export interface Basket_Box_1Geometry {
  derived: Basket_Box_1Derived;
  bbox: { width: number; height: number };
  segments: Basket_Box_1Segment[];
  svg: string;
}
