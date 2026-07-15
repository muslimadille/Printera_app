import type { T00012Params, T00012Geometry, T00012FaceCoords } from './types';

export type Pt = { x: number; y: number };
export type Segment = {
  start: Pt;
  end: Pt;
  kind: 'CUT' | 'CREASE' | 'OUTER' | 'GLUE_CUT';
  d?: string;
  svgId?: string;
};

export function buildT00012Geometry(params: T00012Params): T00012Geometry {
  const W = params.width;
  const H = params.height;
  const D = params.depth;
  
  const dustL = params.dustFlapLength ?? D;
  const topTuckL = params.topFlapTuckLength ?? 20;
  const sideFlapL = params.sideFlapsLength ?? 15.5;

  const shiftX = Math.max(100, D * 2 + 20);
  const shiftY = Math.max(100, 30);

  const xL = D + sideFlapL + 10;
  const xR = xL + W;
  
  const yCovT = topTuckL + 10; // topTuckL for tuck flap + 10px shift
  const yCovB = yCovT + H;
  const yTDB = yCovB + D;
  const yBaseB = yTDB + H;
  const yBot = yBaseB + D;

  const P: Record<string, Pt> = {};

  // Top Lid & Tuck Flap
  P['L_Notch_Bot'] = { x: xL + 9, y: yCovT + 2 };
  P['L_Notch_Top'] = { x: xL + 9, y: yCovT };
  P['L_Notch_Inner'] = { x: xL + 0.5, y: yCovT };
  P['L_Lid_TopL'] = { x: xL, y: yCovT };
  const tuckScale = topTuckL / 20;
  P['L_Tuck_CurveStart'] = { x: xL + 0.5, y: yCovT - 8 * tuckScale };
  P['L_Tuck_CurveC1'] = { x: xL + 0.5, y: yCovT - 14.627 * tuckScale };
  P['L_Tuck_CurveC2'] = { x: xL + 12.5 - 6.627, y: yCovT - topTuckL };
  P['L_Tuck_Top'] = { x: xL + 12.5, y: yCovT - topTuckL };

  P['R_Tuck_Top'] = { x: xR - 12.5, y: yCovT - topTuckL };
  P['R_Tuck_CurveC1'] = { x: xR - 12.5 + 6.627, y: yCovT - topTuckL };
  P['R_Tuck_CurveC2'] = { x: xR - 0.5, y: yCovT - 14.627 * tuckScale };
  P['R_Tuck_CurveStart'] = { x: xR - 0.5, y: yCovT - 8 * tuckScale };
  P['R_Notch_Inner'] = { x: xR - 0.5, y: yCovT };
  P['R_Lid_TopR'] = { x: xR, y: yCovT };
  P['R_Notch_Top'] = { x: xR - 9, y: yCovT };
  P['R_Notch_Bot'] = { x: xR - 9, y: yCovT + 2 };

  // Main vertical edges
  P['L_CovB'] = { x: xL, y: yCovB };
  P['R_CovB'] = { x: xR, y: yCovB };
  P['L_TDB'] = { x: xL, y: yTDB };
  P['R_TDB'] = { x: xR, y: yTDB };
  P['L_BaseB'] = { x: xL, y: yBaseB };
  P['R_BaseB'] = { x: xR, y: yBaseB };
  P['L_Bot'] = { x: xL, y: yBot };
  P['R_Bot'] = { x: xR, y: yBot };

  const slantDy = (D - 3) * Math.tan(12 * Math.PI / 180);

  // Right Back Dust Flap
  P['R_BDust_T1'] = { x: xR + 3, y: yCovB + 3 };
  P['R_BDust_T2'] = { x: xR + dustL, y: yCovB + 3 };
  P['R_BDust_B2'] = { x: xR + dustL, y: yTDB - (3 + slantDy) };
  P['R_BDust_B1'] = { x: xR + 3, y: yTDB - 3 };

  // Right Side Wall & Glue Flap
  P['R_SW_T1'] = { x: xR + 1, y: yTDB + 1 };
  P['R_SW_T2'] = { x: xR + D, y: yTDB + 1 };
  P['R_Glue_T'] = { x: xR + D + sideFlapL, y: yTDB + 4.62 };
  P['R_Glue_B'] = { x: xR + D + sideFlapL, y: yBaseB - 4.62 };
  P['R_SW_B2'] = { x: xR + D + 6, y: yBaseB - 1 };
  P['R_SW_B1'] = { x: xR + D, y: yBaseB - 1 };
  P['R_SW_B0'] = { x: xR + 1, y: yBaseB - 1 };
  P['R_Diag_T'] = { x: xR + D + sideFlapL, y: yTDB + D + sideFlapL };
  P['R_Diag_B'] = { x: xR + D + sideFlapL, y: yBaseB - (D + sideFlapL) };

  // Right Front Dust Flap
  P['R_FDust_T1'] = { x: xR + 3, y: yBaseB + 3 };
  P['R_FDust_T2'] = { x: xR + dustL, y: yBaseB + (3 + slantDy) };
  P['R_FDust_B2'] = { x: xR + dustL, y: yBot - 3 };
  P['R_FDust_B1'] = { x: xR + 3, y: yBot - 3 };

  // Left Back Dust Flap
  P['L_BDust_T1'] = { x: xL - 3, y: yCovB + 3 };
  P['L_BDust_T2'] = { x: xL - dustL, y: yCovB + 3 };
  P['L_BDust_B2'] = { x: xL - dustL, y: yTDB - (3 + slantDy) };
  P['L_BDust_B1'] = { x: xL - 3, y: yTDB - 3 };

  // Left Side Wall & Glue Flap
  P['L_SW_T1'] = { x: xL - 1, y: yTDB + 1 };
  P['L_SW_T2'] = { x: xL - D, y: yTDB + 1 };
  P['L_Glue_T'] = { x: xL - D - sideFlapL, y: yTDB + 4.62 };
  P['L_Glue_B'] = { x: xL - D - sideFlapL, y: yBaseB - 4.62 };
  P['L_SW_B2'] = { x: xL - D - 6, y: yBaseB - 1 };
  P['L_SW_B1'] = { x: xL - D, y: yBaseB - 1 };
  P['L_SW_B0'] = { x: xL - 1, y: yBaseB - 1 };
  P['L_Diag_T'] = { x: xL - D - sideFlapL, y: yTDB + D + sideFlapL };
  P['L_Diag_B'] = { x: xL - D - sideFlapL, y: yBaseB - (D + sideFlapL) };

  // Left Front Dust Flap
  P['L_FDust_T1'] = { x: xL - 3, y: yBaseB + 3 };
  P['L_FDust_T2'] = { x: xL - dustL, y: yBaseB + (3 + slantDy) };
  P['L_FDust_B2'] = { x: xL - dustL, y: yBot - 3 };
  P['L_FDust_B1'] = { x: xL - 3, y: yBot - 3 };

  const segments: Segment[] = [];

  // --- OUTER PERIMETER ---
  // Top Area
  segments.push({ start: P['L_Lid_TopL'], end: P['L_Notch_Inner'], kind: 'OUTER' });
  segments.push({ start: P['L_Notch_Inner'], end: P['L_Notch_Top'], kind: 'OUTER' });
  segments.push({ start: P['L_Notch_Top'], end: P['L_Notch_Bot'], kind: 'OUTER' });
  
  segments.push({ start: P['L_Notch_Inner'], end: P['L_Tuck_CurveStart'], kind: 'OUTER' });
  segments.push({
    start: P['L_Tuck_CurveStart'],
    end: P['L_Tuck_Top'],
    kind: 'OUTER',
    d: `M ${P['L_Tuck_CurveStart'].x},${P['L_Tuck_CurveStart'].y} C ${P['L_Tuck_CurveC1'].x},${P['L_Tuck_CurveC1'].y} ${P['L_Tuck_CurveC2'].x},${P['L_Tuck_CurveC2'].y} ${P['L_Tuck_Top'].x},${P['L_Tuck_Top'].y}`
  });
  segments.push({ start: P['L_Tuck_Top'], end: P['R_Tuck_Top'], kind: 'OUTER' });
  segments.push({
    start: P['R_Tuck_Top'],
    end: P['R_Tuck_CurveStart'],
    kind: 'OUTER',
    d: `M ${P['R_Tuck_Top'].x},${P['R_Tuck_Top'].y} C ${P['R_Tuck_CurveC1'].x},${P['R_Tuck_CurveC1'].y} ${P['R_Tuck_CurveC2'].x},${P['R_Tuck_CurveC2'].y} ${P['R_Tuck_CurveStart'].x},${P['R_Tuck_CurveStart'].y}`
  });
  segments.push({ start: P['R_Tuck_CurveStart'], end: P['R_Notch_Inner'], kind: 'OUTER' });
  
  segments.push({ start: P['R_Notch_Bot'], end: P['R_Notch_Top'], kind: 'OUTER' });
  segments.push({ start: P['R_Notch_Top'], end: P['R_Notch_Inner'], kind: 'OUTER' });
  segments.push({ start: P['R_Notch_Inner'], end: P['R_Lid_TopR'], kind: 'OUTER' });

  // Right Side
  segments.push({ start: P['R_Lid_TopR'], end: P['R_CovB'], kind: 'OUTER' });
  segments.push({ start: P['R_CovB'], end: P['R_BDust_T1'], kind: 'OUTER' });
  segments.push({ start: P['R_BDust_T1'], end: P['R_BDust_T2'], kind: 'OUTER' });
  segments.push({ start: P['R_BDust_T2'], end: P['R_BDust_B2'], kind: 'OUTER' });
  segments.push({ start: P['R_BDust_B2'], end: P['R_BDust_B1'], kind: 'OUTER' });
  segments.push({ start: P['R_BDust_B1'], end: P['R_TDB'], kind: 'OUTER' });
  
  segments.push({ start: P['R_TDB'], end: P['R_SW_T1'], kind: 'OUTER' });
  segments.push({ start: P['R_SW_T1'], end: P['R_SW_T2'], kind: 'OUTER' });
  segments.push({ start: P['R_SW_T2'], end: P['R_Glue_T'], kind: 'OUTER' });
  segments.push({ start: P['R_Glue_T'], end: P['R_Glue_B'], kind: 'OUTER' });
  segments.push({ start: P['R_Glue_B'], end: P['R_SW_B2'], kind: 'OUTER' });
  segments.push({ start: P['R_SW_B2'], end: P['R_SW_B1'], kind: 'OUTER' });
  segments.push({ start: P['R_SW_B1'], end: P['R_SW_B0'], kind: 'OUTER' });
  segments.push({ start: P['R_SW_B0'], end: P['R_BaseB'], kind: 'OUTER' });

  segments.push({ start: P['R_BaseB'], end: P['R_FDust_T1'], kind: 'OUTER' });
  segments.push({ start: P['R_FDust_T1'], end: P['R_FDust_T2'], kind: 'OUTER' });
  segments.push({ start: P['R_FDust_T2'], end: P['R_FDust_B2'], kind: 'OUTER' });
  segments.push({ start: P['R_FDust_B2'], end: P['R_FDust_B1'], kind: 'OUTER' });
  segments.push({ start: P['R_FDust_B1'], end: P['R_Bot'], kind: 'OUTER' });

  // Bottom Edge
  segments.push({ start: P['R_Bot'], end: P['L_Bot'], kind: 'OUTER' });

  // Left Side (Bottom to Top)
  segments.push({ start: P['L_Bot'], end: P['L_FDust_B1'], kind: 'OUTER' });
  segments.push({ start: P['L_FDust_B1'], end: P['L_FDust_B2'], kind: 'OUTER' });
  segments.push({ start: P['L_FDust_B2'], end: P['L_FDust_T2'], kind: 'OUTER' });
  segments.push({ start: P['L_FDust_T2'], end: P['L_FDust_T1'], kind: 'OUTER' });
  segments.push({ start: P['L_FDust_T1'], end: P['L_BaseB'], kind: 'OUTER' });

  segments.push({ start: P['L_BaseB'], end: P['L_SW_B0'], kind: 'OUTER' });
  segments.push({ start: P['L_SW_B0'], end: P['L_SW_B1'], kind: 'OUTER' });
  segments.push({ start: P['L_SW_B1'], end: P['L_SW_B2'], kind: 'OUTER' });
  segments.push({ start: P['L_SW_B2'], end: P['L_Glue_B'], kind: 'OUTER' });
  segments.push({ start: P['L_Glue_B'], end: P['L_Glue_T'], kind: 'OUTER' });
  segments.push({ start: P['L_Glue_T'], end: P['L_SW_T2'], kind: 'OUTER' });
  segments.push({ start: P['L_SW_T2'], end: P['L_SW_T1'], kind: 'OUTER' });
  segments.push({ start: P['L_SW_T1'], end: P['L_TDB'], kind: 'OUTER' });

  segments.push({ start: P['L_TDB'], end: P['L_BDust_B1'], kind: 'OUTER' });
  segments.push({ start: P['L_BDust_B1'], end: P['L_BDust_B2'], kind: 'OUTER' });
  segments.push({ start: P['L_BDust_B2'], end: P['L_BDust_T2'], kind: 'OUTER' });
  segments.push({ start: P['L_BDust_T2'], end: P['L_BDust_T1'], kind: 'OUTER' });
  segments.push({ start: P['L_BDust_T1'], end: P['L_CovB'], kind: 'OUTER' });
  segments.push({ start: P['L_CovB'], end: P['L_Lid_TopL'], kind: 'OUTER' });

  // --- CREASES ---
  segments.push({ start: P['L_CovB'], end: P['R_CovB'], kind: 'CREASE' });
  segments.push({ start: P['L_TDB'], end: P['R_TDB'], kind: 'CREASE' });
  segments.push({ start: P['L_BaseB'], end: P['R_BaseB'], kind: 'CREASE' });
  
  // Tuck Flap fold crease
  segments.push({ start: { x: P['L_Notch_Bot'].x, y: yCovT + 1 }, end: { x: P['R_Notch_Bot'].x, y: yCovT + 1 }, kind: 'CREASE' });

  // Main Vertical Creases (Dust flaps & Side walls)
  segments.push({ start: P['L_CovB'], end: P['L_TDB'], kind: 'CREASE' }); // Left Back Dust Flap
  segments.push({ start: P['R_CovB'], end: P['R_TDB'], kind: 'CREASE' }); // Right Back Dust Flap
  segments.push({ start: P['L_TDB'], end: P['L_BaseB'], kind: 'CREASE' }); // Left Side Wall
  segments.push({ start: P['R_TDB'], end: P['R_BaseB'], kind: 'CREASE' }); // Right Side Wall
  segments.push({ start: P['L_BaseB'], end: P['L_Bot'], kind: 'CREASE' }); // Left Front Dust Flap
  segments.push({ start: P['R_BaseB'], end: P['R_Bot'], kind: 'CREASE' }); // Right Front Dust Flap

  // Side Wall vertical creases
  segments.push({ start: P['R_SW_T2'], end: P['R_SW_B1'], kind: 'CREASE' });
  segments.push({ start: P['L_SW_T2'], end: P['L_SW_B1'], kind: 'CREASE' });

  // Diagonal creases for flat fold
  segments.push({ start: P['R_SW_T1'], end: P['R_Diag_T'], kind: 'CREASE' });
  segments.push({ start: P['R_SW_B0'], end: P['R_Diag_B'], kind: 'CREASE' });
  segments.push({ start: P['L_SW_T1'], end: P['L_Diag_T'], kind: 'CREASE' });
  segments.push({ start: P['L_SW_B0'], end: P['L_Diag_B'], kind: 'CREASE' });

  // Main vertical box creases
  segments.push({ start: P['L_CovB'], end: P['L_TDB'], kind: 'CREASE' });
  segments.push({ start: P['R_CovB'], end: P['R_TDB'], kind: 'CREASE' });
  segments.push({ start: P['L_TDB'], end: P['L_BaseB'], kind: 'CREASE' });
  segments.push({ start: P['R_TDB'], end: P['R_BaseB'], kind: 'CREASE' });
  segments.push({ start: P['L_BaseB'], end: P['L_Bot'], kind: 'CREASE' });
  segments.push({ start: P['R_BaseB'], end: P['R_Bot'], kind: 'CREASE' });

  const svgLines = segments.map((seg, idx) => {
    if (seg.d) {
      return `<path id="${seg.svgId || 'seg_' + idx}" d="${seg.d}" fill="none" stroke="${seg.kind === 'CREASE' ? '#00a651' : '#ed1c24'}" stroke-miterlimit="10" stroke-width="2"/>`;
    }
    return `<line id="${seg.svgId || 'seg_' + idx}" x1="${seg.start.x}" y1="${seg.start.y}" x2="${seg.end.x}" y2="${seg.end.y}" fill="none" stroke="${seg.kind === 'CREASE' ? '#00a651' : '#ed1c24'}" stroke-miterlimit="10" stroke-width="2"/>`;
  }).join('\n  ');

  const bbox = {
    x: Math.min(...segments.flatMap(s => s.d ? [] : [s.start.x, s.end.x])),
    y: Math.min(...segments.flatMap(s => s.d ? [] : [s.start.y, s.end.y])) - 20, // Pad for bezier
    w: W + D * 2 + sideFlapL * 2 + 20, // Pad 20 to prevent cutting edges
    h: H * 2 + D * 2 + topTuckL + 20 // Pad 20 to prevent cutting edges
  };

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bbox.x - 5} ${bbox.y - 5} ${bbox.w + 10} ${bbox.h + 10}">
  ${svgLines}
</svg>`.trim();

  const lidTuckPolygon: [number, number][] = [
    [P['R_Notch_Bot'].x, P['R_Notch_Bot'].y],
    [P['R_Notch_Top'].x, P['R_Notch_Top'].y],
    [P['R_Notch_Inner'].x, P['R_Notch_Inner'].y],
  ];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const p0 = P['R_Tuck_CurveStart'];
    const p1 = P['R_Tuck_CurveC2'];
    const p2 = P['R_Tuck_CurveC1'];
    const p3 = P['R_Tuck_Top'];
    const x = Math.pow(1-t, 3)*p0.x + 3*Math.pow(1-t, 2)*t*p1.x + 3*(1-t)*Math.pow(t, 2)*p2.x + Math.pow(t, 3)*p3.x;
    const y = Math.pow(1-t, 3)*p0.y + 3*Math.pow(1-t, 2)*t*p1.y + 3*(1-t)*Math.pow(t, 2)*p2.y + Math.pow(t, 3)*p3.y;
    lidTuckPolygon.push([x, y]);
  }
  lidTuckPolygon.push([P['L_Tuck_Top'].x, P['L_Tuck_Top'].y]);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const p0 = P['L_Tuck_Top'];
    const p1 = P['L_Tuck_CurveC2'];
    const p2 = P['L_Tuck_CurveC1'];
    const p3 = P['L_Tuck_CurveStart'];
    const x = Math.pow(1-t, 3)*p0.x + 3*Math.pow(1-t, 2)*t*p1.x + 3*(1-t)*Math.pow(t, 2)*p2.x + Math.pow(t, 3)*p3.x;
    const y = Math.pow(1-t, 3)*p0.y + 3*Math.pow(1-t, 2)*t*p1.y + 3*(1-t)*Math.pow(t, 2)*p2.y + Math.pow(t, 3)*p3.y;
    lidTuckPolygon.push([x, y]);
  }
  lidTuckPolygon.push([P['L_Notch_Inner'].x, P['L_Notch_Inner'].y]);
  lidTuckPolygon.push([P['L_Notch_Top'].x, P['L_Notch_Top'].y]);
  lidTuckPolygon.push([P['L_Notch_Bot'].x, P['L_Notch_Bot'].y]);

  const faceCoords: T00012FaceCoords = {
    lidTuck: { 
      x: xL, y: yCovT - topTuckL, w: W, h: topTuckL,
      polygon: lidTuckPolygon
    },
    lid: { 
      x: xL, y: yCovT, w: W, h: H,
      polygon: [
        [P['L_Lid_TopL'].x, P['L_Lid_TopL'].y],
        [P['L_CovB'].x, P['L_CovB'].y],
        [P['R_CovB'].x, P['R_CovB'].y],
        [P['R_Lid_TopR'].x, P['R_Lid_TopR'].y],
      ]
    },
    back: { 
      x: xL, y: yCovB, w: W, h: D,
      polygon: [
        [P['L_CovB'].x, P['L_CovB'].y],
        [P['L_TDB'].x, P['L_TDB'].y],
        [P['R_TDB'].x, P['R_TDB'].y],
        [P['R_CovB'].x, P['R_CovB'].y],
      ]
    },
    bottom: { 
      x: xL, y: yTDB, w: W, h: H,
      polygon: [
        [P['L_TDB'].x, P['L_TDB'].y],
        [P['L_BaseB'].x, P['L_BaseB'].y],
        [P['R_BaseB'].x, P['R_BaseB'].y],
        [P['R_TDB'].x, P['R_TDB'].y],
      ]
    },
    front: { 
      x: xL, y: yBaseB, w: W, h: D,
      polygon: [
        [P['L_BaseB'].x, P['L_BaseB'].y],
        [P['L_Bot'].x, P['L_Bot'].y],
        [P['R_Bot'].x, P['R_Bot'].y],
        [P['R_BaseB'].x, P['R_BaseB'].y],
      ]
    },
    
    leftWallOuter: { 
      x: xL - D, y: yTDB, w: D, h: H,
      polygon: [
        [P['L_TDB'].x, P['L_TDB'].y],
        [P['L_SW_T1'].x, P['L_SW_T1'].y],
        [P['L_SW_T2'].x, P['L_SW_T2'].y],
        [P['L_SW_B1'].x, P['L_SW_B1'].y],
        [P['L_SW_B0'].x, P['L_SW_B0'].y],
        [P['L_BaseB'].x, P['L_BaseB'].y],
      ]
    },
    leftWallInner: { 
      x: xL - D - sideFlapL, y: yTDB, w: sideFlapL, h: H,
      polygon: [
        [P['L_SW_T2'].x, P['L_SW_T2'].y],
        [P['L_Glue_T'].x, P['L_Glue_T'].y],
        [P['L_Glue_B'].x, P['L_Glue_B'].y],
        [P['L_SW_B2'].x, P['L_SW_B2'].y],
        [P['L_SW_B1'].x, P['L_SW_B1'].y],
      ]
    },
    rightWallOuter: { 
      x: xR, y: yTDB, w: D, h: H,
      polygon: [
        [P['R_TDB'].x, P['R_TDB'].y],
        [P['R_BaseB'].x, P['R_BaseB'].y],
        [P['R_SW_B0'].x, P['R_SW_B0'].y],
        [P['R_SW_B1'].x, P['R_SW_B1'].y],
        [P['R_SW_T2'].x, P['R_SW_T2'].y],
        [P['R_SW_T1'].x, P['R_SW_T1'].y],
      ]
    },
    rightWallInner: { 
      x: xR + D, y: yTDB, w: sideFlapL, h: H,
      polygon: [
        [P['R_SW_T2'].x, P['R_SW_T2'].y],
        [P['R_SW_B1'].x, P['R_SW_B1'].y],
        [P['R_SW_B2'].x, P['R_SW_B2'].y],
        [P['R_Glue_B'].x, P['R_Glue_B'].y],
        [P['R_Glue_T'].x, P['R_Glue_T'].y],
      ]
    },
    
    backDustLeft: { 
      x: xL - dustL, y: yCovB, w: dustL, h: D,
      polygon: [
        [P['L_CovB'].x, P['L_CovB'].y],
        [P['L_BDust_T1'].x, P['L_BDust_T1'].y],
        [P['L_BDust_T2'].x, P['L_BDust_T2'].y],
        [P['L_BDust_B2'].x, P['L_BDust_B2'].y],
        [P['L_BDust_B1'].x, P['L_BDust_B1'].y],
        [P['L_TDB'].x, P['L_TDB'].y],
      ]
    },
    backDustRight: { 
      x: xR, y: yCovB, w: dustL, h: D,
      polygon: [
        [P['R_CovB'].x, P['R_CovB'].y],
        [P['R_TDB'].x, P['R_TDB'].y],
        [P['R_BDust_B1'].x, P['R_BDust_B1'].y],
        [P['R_BDust_B2'].x, P['R_BDust_B2'].y],
        [P['R_BDust_T2'].x, P['R_BDust_T2'].y],
        [P['R_BDust_T1'].x, P['R_BDust_T1'].y],
      ]
    },
    frontDustLeft: { 
      x: xL - dustL, y: yBaseB, w: dustL, h: D,
      polygon: [
        [P['L_BaseB'].x, P['L_BaseB'].y],
        [P['L_FDust_T1'].x, P['L_FDust_T1'].y],
        [P['L_FDust_T2'].x, P['L_FDust_T2'].y],
        [P['L_FDust_B2'].x, P['L_FDust_B2'].y],
        [P['L_FDust_B1'].x, P['L_FDust_B1'].y],
        [P['L_Bot'].x, P['L_Bot'].y],
      ]
    },
    frontDustRight: { 
      x: xR, y: yBaseB, w: dustL, h: D,
      polygon: [
        [P['R_BaseB'].x, P['R_BaseB'].y],
        [P['R_Bot'].x, P['R_Bot'].y],
        [P['R_FDust_B1'].x, P['R_FDust_B1'].y],
        [P['R_FDust_B2'].x, P['R_FDust_B2'].y],
        [P['R_FDust_T2'].x, P['R_FDust_T2'].y],
        [P['R_FDust_T1'].x, P['R_FDust_T1'].y],
      ]
    }
  };

  return {
    segments,
    svg,
    bbox,
    faceCoords,
    derived: {
      width: bbox.w,
      height: bbox.h
    }
  };
}
