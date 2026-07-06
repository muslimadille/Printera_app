// T0002 — Self-Locking Tray with Hinged Lid (Mailer Style Box)
// ---------------------------------------------------------------

export interface T0002Params {
  /** Width of the main panels (mm) */
  W: number;
  /** Height of the tray base panel (mm) */
  H: number;
  /** Depth of the tray (mm) */
  D: number;
  /** Height of the lid panel (mm) */
  LH: number;
  /** Height of the closing lid flap (mm) */
  LFH: number;
  /** Corner radius of the closing lid flap (mm) */
  LFR: number;
  /** Dust flap width (mm) */
  DFW: number;
  /** Dust flap inset (mm) */
  DFI: number;
  /** Dust flap clearance slope (mm) */
  DFS: number;
  /** Lock tab width (mm) */
  LTW: number;
  /** Lock tab top slope height (mm) */
  LTS1: number;
  /** Lock tab bottom slope height (mm) */
  LTS2: number;
  /** Lock tab notch offset (mm) */
  LTN: number;
  /** Folding clearance 1 (mm) */
  C1: number;
  /** Folding clearance 2 (mm) */
  C2: number;

  // Sheet parameters for nesting
  sheetWidth: number;
  sheetHeight: number;
  sheetMargin: number;
  gripper: number;
  referenceMode?: boolean;
}

export const T0002_DEFAULTS: T0002Params = {
  W: 350.0,
  H: 290.0,
  D: 100.0,
  LH: 289.0,
  LFH: 21.0,
  LFR: 12.0,
  DFW: 80.0,
  DFI: 3.0,
  DFS: 10.0,
  LTW: 15.5,
  LTS1: 3.6,
  LTS2: 3.6,
  LTN: 6.0,
  C1: 1.0,
  C2: 1.0,

  sheetWidth: 1000,
  sheetHeight: 700,
  sheetMargin: 10,
  gripper: 10,
  referenceMode: false,
};

export const T0002_REFERENCE: T0002Params = {
  ...T0002_DEFAULTS,
};

export const T0002_RULES = {
  minW: 50,
  maxW: 1500,
  minH: 50,
  maxH: 1500,
  minD: 10,
  maxD: 500,
  minLH: 50,
  maxLH: 1500,
} as const;

export interface T0002Geometry {
  params: T0002Params;
  segments: any[]; // Returning Segment[] to support InteractiveSvgCanvas
  bbox: { w: number; h: number };
  svg: string;
}

export function usableSheet(p: T0002Params) {
  return {
    width: p.sheetWidth - 2 * p.sheetMargin,
    height: p.sheetHeight - 2 * p.sheetMargin - p.gripper,
  };
}
