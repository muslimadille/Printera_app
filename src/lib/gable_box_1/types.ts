export interface Gable_Box_1Dimensions {
  width: number;           // W (e.g. 370)
  height: number;          // H (e.g. 200)
  depth: number;           // D (e.g. 120)
  glueFlap: number;        // Gf (e.g. 30)
  topHeaderHeight?: number;// Header fold height
  gableHeight?: number;    // Triangular gable slope height
  handleTabHeight?: number;// Handle tab protrusion height
  holeDiameter?: number;   // Rope hole diameter (e.g. 5)
  holeMarginX?: number;    // Distance of rope holes from side edges (e.g. 95)
}

export interface Gable_Box_1NestingParams {
  sheetWidth: number;      // e.g. 1400
  sheetHeight: number;     // e.g. 1000
  margin: number;          // e.g. 10
  spacing: number;         // e.g. 5
}

export const GABLE_BOX_1_DEFAULTS: Gable_Box_1Dimensions = {
  width: 370,
  height: 200,
  depth: 120,
  glueFlap: 30,
  topHeaderHeight: 80,
  gableHeight: 80,
  handleTabHeight: 50,
  holeDiameter: 5,
  holeMarginX: 95,
};

export const GABLE_BOX_1_DEFAULT_NESTING: Gable_Box_1NestingParams = {
  sheetWidth: 1400,
  sheetHeight: 1000,
  margin: 10,
  spacing: 5,
};
