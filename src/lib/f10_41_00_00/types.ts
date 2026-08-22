export interface F10_41_00_00Dimensions {
  width: number;
  height: number;
  depth: number;
  glueFlap: number;
  flapHeight?: number;
  windowMarginX?: number;
  windowMarginY?: number;
  windowCornerChamfer?: number;
  hasWindow?: boolean;
}

export const F10_41_00_00_REFERENCE: F10_41_00_00Dimensions = {
  width: 100,
  height: 150,
  depth: 50,
  glueFlap: 13.2,
  flapHeight: 33.75,
  windowMarginX: 15,
  windowMarginY: 10,
  windowCornerChamfer: 5,
  hasWindow: true,
};

export const F10_41_00_00_DEFAULTS: F10_41_00_00Dimensions = {
  width: 100,
  height: 150,
  depth: 50,
  glueFlap: 13.2,
  flapHeight: 33.75,
  windowMarginX: 15,
  windowMarginY: 10,
  windowCornerChamfer: 5,
  hasWindow: true,
};

export interface F10_41_00_00NestingParams {
  sheetWidth: number;
  sheetHeight: number;
  margin: number;
  spacing: number;
  gripper?: number;
  allowRotation?: boolean;
}

export const F10_41_00_00_DEFAULT_NESTING: F10_41_00_00NestingParams = {
  sheetWidth: 700,
  sheetHeight: 1000,
  margin: 15,
  spacing: 5,
  gripper: 12,
  allowRotation: true,
};
