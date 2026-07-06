// Generic Box — Types & Config Format
// ======================================
// One engine to rule them all: every 4-panel box is described by a config.

/** A single panel in the box layout */
export interface PanelConfig {
  name: string;            // e.g. "Face1", "Depth1", "GlueFlap"
  param: 'W' | 'D' | 'GF'; // which parameter drives this panel's width
  factor?: number;         // multiplier on param (default 1)
  rightEdge: 'cut' | 'crease'; // what line type on the right edge
}

/** A flap (top or bottom) on a specific panel */
export interface FlapConfig {
  panelIndex: number;      // which panel (0-based) this flap attaches to
  type: 'tuck' | 'overlap' | 'seal' | 'auto-lock' | 'none';
  heightExpr: string;      // arithmetic expression: "H*0.5", "D", "W*0.3", "0"
  /** Optional notch slot for tuck flaps */
  notch?: { x: number; w: number; depth: number; };
  /** Optional chamfer on flap corners */
  chamfer?: { dx: number; dy: number; };
  /** Optional curve for flap contour (seal/lock) */
  curve?: { cx: number; cy: number; rx: number; ry: number; };
}

/** Glue flap shape */
export interface GlueFlapConfig {
  type: 'chamfer' | 'straight' | 'angled';
  /** Chamfer dimensions (for type='chamfer') */
  chamfer?: { dy: number; };
  /** Angle in degrees (for type='angled') */
  angle?: number;
}

/** Template geometry config */
export interface BoxTemplateConfig {
  id: string;              // e.g. "A01.01.00.00"
  catalog: string;         // e.g. "ECMA", "FEFCO"
  name: string;            // human name
  description?: string;

  // Panel layout in left-to-right order
  panels: PanelConfig[];

  // Overall dimensions (default/reference values in mm)
  defaults: {
    W: number;             // face width
    D: number;             // depth (panel 2 & 4)
    H: number;             // height
    GF: number;            // glue flap width
  };

  // Optional: which panels are the "faces" (for 3D preview mapping)
  faceIndices?: number[];

  // Flaps (top and bottom, indexed by panel)
  topFlaps?: FlapConfig[];
  bottomFlaps?: FlapConfig[];

  // Glue flap shape
  glueFlap?: GlueFlapConfig;

  // Output: SVG viewBox padding
  padding?: number;
}

/** User-supplied dimensions */
export interface BoxParams {
  W: number;
  D: number;
  H: number;
  GF: number;
}

/** Generated geometry output */
export interface BoxGeometry {
  svg: string;
  bbox: { w: number; h: number };
  segments: number;
  panelWidths: number[];
}
