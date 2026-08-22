// B15_06_00_55 — Type definitions and defaults (ECMA B15 Lock-Bottom Box with Rollover Lid)

export interface B15_06_00_55Params {
  width: number;       // W - Width of the main panels (mm)
  height: number;      // H - Body height (mm)
  depth: number;       // D - Depth of side panels (mm)
  tuckFlap: number;    // Tuck / Side lock flap width (mm)
  
  // Sheet & Nesting parameters
  sheetWidth: number;
  sheetHeight: number;
  gripper: number;
  sheetMargin: number;
  referenceMode?: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export type SegmentKind = 'CUT' | 'CREASE' | 'OUTER' | 'LOCK_CUT';

export interface Segment {
  id: number;
  kind: SegmentKind;
  geometry: 'line' | 'arc' | 'polyline' | 'fillet' | 'bezier' | 'path';
  start?: Point;
  end?: Point;
  via?: Point;
  points?: Point[];
  arc?: {
    rx: number;
    ry: number;
    xar: number;
    laf: number;
    sf: number;
  };
  bezier?: {
    c1: Point;
    c2: Point;
  };
  d?: string;
}

export interface B15_06_00_55Geometry {
  svg: string;
  bbox: {
    w: number;
    h: number;
  };
  derived: {
    totalWidth: number;
    totalHeight: number;
    w: number;
    h: number;
    d: number;
    tuckFlap: number;
    topDustHeight: number;
    botDustHeight: number;
  };
  segments: Segment[];
}

export const B15_06_00_55_DEFAULTS: B15_06_00_55Params = {
  width: 140,
  height: 200,
  depth: 55,
  tuckFlap: 55,
  sheetWidth: 1000,
  sheetHeight: 700,
  gripper: 15,
  sheetMargin: 10,
  referenceMode: false,
};

export const B15_06_00_55_REFERENCE = {
  viewBoxW: 902.58,
  viewBoxH: 648.88,
  p1_w: 111.97,
  p2_w: 279.21,
  p3_w: 111.97,
  p4_w: 281.46,
  p5_w: 110.61,
  body_h: 418.0,
  top_dust_h: 111.97,
  bot_dust_h: 111.97,
};

export const usableSheet = (p: B15_06_00_55Params) => ({
  width: Math.max(0, p.sheetWidth - 2 * p.sheetMargin),
  height: Math.max(0, p.sheetHeight - 2 * p.sheetMargin - p.gripper),
});
