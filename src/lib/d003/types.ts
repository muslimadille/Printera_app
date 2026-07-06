export interface D003Params {
  /** Product width in mm (Base panel width) */
  width: number;
  /** Product height in mm (Base panel height) */
  height: number;
  /** Product depth in mm (Depth panel height) */
  depth: number;
  /** Lid tongue height in mm */
  lidTongueHeight: number;
  /** Sheet width in mm */
  sheetWidth: number;
  /** Sheet height in mm */
  sheetHeight: number;
  /** Sheet margin (subtracted from both width and height) */
  sheetMargin: number;
  /** Gripper (subtracted from height only) */
  gripper: number;
  /** Horizontal gap in mm */
  horizontalGap: number;
  /** Vertical gap in mm */
  verticalGap: number;
  /** Reference Clone Mode */
  referenceMode?: boolean;
}

export const D003_REFERENCE = {
  width: 350,
  height: 290,
  depth: 100,
  lidTongueHeight: 21,
  depthTongue: 15.5, // From SVG, though prompt asked for 1.55mm, we use that in geometry but reference is 15.5
} as const;

export const D003_DEFAULTS: D003Params = {
  width: D003_REFERENCE.width,
  height: D003_REFERENCE.height,
  depth: D003_REFERENCE.depth,
  lidTongueHeight: D003_REFERENCE.lidTongueHeight,
  sheetWidth: 1000,
  sheetHeight: 700,
  sheetMargin: 0,
  gripper: 0,
  horizontalGap: 0,
  verticalGap: 0,
  referenceMode: false,
};

export function usableSheet(p: D003Params) {
  return {
    width: p.sheetWidth - 2 * p.sheetMargin,
    height: p.sheetHeight - 2 * p.sheetMargin - p.gripper,
  };
}
