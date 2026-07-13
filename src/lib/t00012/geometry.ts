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
  
  // shift values to pad the bounding box
  const shiftX = Math.max(100, D * 2);
  const shiftY = Math.max(100, D * 2 + 30);

  // Core base anchors
  const xL = shiftX;
  const xR = shiftX + W;
  
  const yCovT = shiftY;
  const yCovB = shiftY + H;
  const yTDB = shiftY + H + D;
  const yBaseB = shiftY + H + D + H;
  const yBot = shiftY + H + D + H + D;

  const slantDy = (D - 3) * (10 / 47);

  const P: Record<string, Pt> = {};
  P['P001'] = { x: xR, y: yTDB };
  P['P002'] = { x: xL, y: yTDB };
  P['P003'] = { x: xR, y: yCovB };
  P['P004'] = { x: xL, y: yCovB };
  P['P005'] = { x: xR, y: yBaseB };
  P['P006'] = { x: xL, y: yBaseB };
  P['P007'] = { x: xR, y: yBot };
  P['P008'] = { x: xL, y: yBot };
  P['P009'] = { x: xR, y: yCovT };
  P['P010'] = { x: xL, y: yCovT };
  P['P011'] = { x: xL+12.5, y: yCovT-20 };
  P['P012'] = { x: xR-12.5, y: yCovT-20 };
  P['P013'] = { x: xL+9, y: yCovT+1 };
  P['P014'] = { x: xR-9, y: yCovT+1 };
  P['P015'] = { x: xL+9, y: yCovT };
  P['P016'] = { x: xL+9, y: yCovT+2 };
  P['P017'] = { x: xL+0.5, y: yCovT };
  P['P018'] = { x: xR-9, y: yCovT };
  P['P019'] = { x: xR-9, y: yCovT+2 };
  P['P020'] = { x: xR-0.5, y: yCovT };
  P['P021'] = { x: xR-0.5, y: yCovT-8 };
  P['P022'] = { x: xR+3, y: yCovB+3 };
  P['P023'] = { x: xR + D, y: yCovB+3 };
  P['P024'] = { x: xR + D, y: yTDB - (3 + slantDy) };
  P['P025'] = { x: xR+3, y: yTDB-3 };
  P['P026'] = { x: xL-3, y: yCovB+3 };
  P['P027'] = { x: xL - D, y: yCovB+3 };
  P['P028'] = { x: xL - D, y: yTDB - (3 + slantDy) };
  P['P029'] = { x: xL-3, y: yTDB-3 };
  P['P030'] = { x: xR+3, y: yBaseB+3 };
  P['P031'] = { x: xR + D, y: yBaseB + (3 + slantDy) };
  P['P032'] = { x: xR + D, y: yBot-3 };
  P['P033'] = { x: xR+3, y: yBot-3 };
  P['P034'] = { x: xL-3, y: yBaseB+3 };
  P['P035'] = { x: xL - D, y: yBaseB + (3 + slantDy) };
  P['P036'] = { x: xL - D, y: yBot-3 };
  P['P037'] = { x: xL-3, y: yBot-3 };
  P['P038'] = { x: xR+1, y: yTDB+1 };
  P['P039'] = { x: xR + D, y: yTDB+1 };
  P['P040'] = { x: xR+1, y: yBaseB-1 };
  P['P041'] = { x: xR + D, y: yBaseB-1 };
  P['P042'] = { x: xR + (D + 6), y: yBaseB-1 };
  P['P043'] = { x: xR + (D + 15.5), y: yBaseB-4.62 };
  P['P044'] = { x: xR + (D + 15.5), y: yTDB+4.62 };
  P['P045'] = { x: xL-1, y: yTDB+1 };
  P['P046'] = { x: xL - D, y: yTDB+1 };
  P['P047'] = { x: xL-1, y: yBaseB-1 };
  P['P048'] = { x: xL - D, y: yBaseB-1 };
  P['P049'] = { x: xL - (D + 6), y: yBaseB-1 };
  P['P050'] = { x: xL - (D + 15.5), y: yBaseB-4.62 };
  P['P051'] = { x: xL - (D + 15.5), y: yTDB+4.62 };
  P['P052'] = { x: xR + (D + 15.5), y: yTDB + (D + 15.5) };
  P['P053'] = { x: xR + (D + 15.5), y: yBaseB - (D + 15.5) };
  P['P054'] = { x: xL - (D + 15.5), y: yTDB + (D + 15.5) };
  P['P055'] = { x: xL - (D + 15.5), y: yBaseB - (D + 15.5) };

  const segments: Segment[] = [];
  segments.push({ start: P['P017'], end: P['P010'], kind: 'OUTER', svgId: 'B1' });
  segments.push({ start: P['P010'], end: P['P004'], kind: 'OUTER', svgId: 'B2' });
  segments.push({ start: P['P020'], end: P['P009'], kind: 'OUTER', svgId: 'B3' });
  segments.push({ start: P['P009'], end: P['P003'], kind: 'OUTER', svgId: 'B4' });
  segments.push({ start: P['P021'], end: P['P020'], kind: 'OUTER', svgId: 'A7' });
  segments.push({ start: P['P016'], end: P['P015'], kind: 'OUTER', svgId: 'A1' });
  segments.push({ start: P['P015'], end: P['P017'], kind: 'OUTER', svgId: 'A2' });
  segments.push({ start: P['P016'], end: P['P011'], kind: 'OUTER', svgId: 'A3' }); // Left tuck slope
  segments.push({ start: P['P019'], end: P['P012'], kind: 'OUTER', svgId: 'A4' }); // Right tuck slope
  segments.push({ start: P['P019'], end: P['P018'], kind: 'OUTER', svgId: 'A9' });
  segments.push({ start: P['P018'], end: P['P020'], kind: 'OUTER', svgId: 'A8' });
  segments.push({ start: P['P011'], end: P['P012'], kind: 'OUTER', svgId: 'A5' });
  segments.push({ start: P['P004'], end: P['P026'], kind: 'OUTER', svgId: 'C5' });
  segments.push({ start: P['P026'], end: P['P027'], kind: 'OUTER', svgId: 'C4' });
  segments.push({ start: P['P027'], end: P['P028'], kind: 'OUTER', svgId: 'C3' });
  segments.push({ start: P['P029'], end: P['P028'], kind: 'OUTER', svgId: 'C2' });
  segments.push({ start: P['P002'], end: P['P029'], kind: 'OUTER', svgId: 'C1' });
  segments.push({ start: P['P003'], end: P['P022'], kind: 'OUTER', svgId: 'D5' });
  segments.push({ start: P['P022'], end: P['P023'], kind: 'OUTER', svgId: 'D4' });
  segments.push({ start: P['P023'], end: P['P024'], kind: 'OUTER', svgId: 'D3' });
  segments.push({ start: P['P025'], end: P['P024'], kind: 'OUTER', svgId: 'D2' });
  segments.push({ start: P['P001'], end: P['P025'], kind: 'OUTER', svgId: 'D1' });
  segments.push({ start: P['P001'], end: P['P038'], kind: 'OUTER', svgId: 'J4' });
  segments.push({ start: P['P038'], end: P['P039'], kind: 'OUTER', svgId: 'J3' });
  segments.push({ start: P['P040'], end: P['P041'], kind: 'OUTER', svgId: 'J2' });
  segments.push({ start: P['P005'], end: P['P040'], kind: 'OUTER', svgId: 'J1' });
  segments.push({ start: P['P044'], end: P['P039'], kind: 'OUTER', svgId: 'I4' });
  segments.push({ start: P['P043'], end: P['P044'], kind: 'OUTER', svgId: 'I3' });
  segments.push({ start: P['P042'], end: P['P043'], kind: 'OUTER', svgId: 'I2' });
  segments.push({ start: P['P041'], end: P['P042'], kind: 'OUTER', svgId: 'I1' });
  segments.push({ start: P['P002'], end: P['P045'], kind: 'OUTER', svgId: 'H4' });
  segments.push({ start: P['P045'], end: P['P046'], kind: 'OUTER', svgId: 'H3' });
  segments.push({ start: P['P047'], end: P['P048'], kind: 'OUTER', svgId: 'H2' });
  segments.push({ start: P['P006'], end: P['P047'], kind: 'OUTER', svgId: 'H1' });
  segments.push({ start: P['P051'], end: P['P046'], kind: 'OUTER', svgId: 'G4' });
  segments.push({ start: P['P050'], end: P['P051'], kind: 'OUTER', svgId: 'G3' });
  segments.push({ start: P['P049'], end: P['P050'], kind: 'OUTER', svgId: 'G2' });
  segments.push({ start: P['P048'], end: P['P049'], kind: 'OUTER', svgId: 'G1' });
  segments.push({ start: P['P005'], end: P['P030'], kind: 'OUTER', svgId: 'F1' });
  segments.push({ start: P['P030'], end: P['P031'], kind: 'OUTER', svgId: 'F2' });
  segments.push({ start: P['P032'], end: P['P031'], kind: 'OUTER', svgId: 'F3' });
  segments.push({ start: P['P033'], end: P['P032'], kind: 'OUTER', svgId: 'F4' });
  segments.push({ start: P['P007'], end: P['P033'], kind: 'OUTER', svgId: 'F5' });
  segments.push({ start: P['P008'], end: P['P037'], kind: 'OUTER', svgId: 'E1' });
  segments.push({ start: P['P037'], end: P['P036'], kind: 'OUTER', svgId: 'E2' });
  segments.push({ start: P['P036'], end: P['P035'], kind: 'OUTER', svgId: 'E3' });
  segments.push({ start: P['P034'], end: P['P035'], kind: 'OUTER', svgId: 'E4' });
  segments.push({ start: P['P006'], end: P['P034'], kind: 'OUTER', svgId: 'E5' });
  segments.push({ start: P['P007'], end: P['P008'], kind: 'OUTER', svgId: 'M1' });
  segments.push({ start: P['P001'], end: P['P002'], kind: 'CREASE', svgId: 'CREASE1' });
  segments.push({ start: P['P006'], end: P['P005'], kind: 'CREASE', svgId: 'CREASE2' });
  segments.push({ start: P['P004'], end: P['P003'], kind: 'CREASE', svgId: 'CREASE3' });
  segments.push({ start: P['P013'], end: P['P014'], kind: 'CREASE', svgId: 'CREASE4' });
  segments.push({ start: P['P038'], end: P['P052'], kind: 'CREASE', svgId: 'CREASE5' });
  segments.push({ start: P['P039'], end: P['P041'], kind: 'CREASE', svgId: 'CREASE6' });
  segments.push({ start: P['P040'], end: P['P053'], kind: 'CREASE', svgId: 'CREASE7' });
  segments.push({ start: P['P045'], end: P['P054'], kind: 'CREASE', svgId: 'CREASE8' });
  segments.push({ start: P['P046'], end: P['P048'], kind: 'CREASE', svgId: 'CREASE9' });
  segments.push({ start: P['P047'], end: P['P055'], kind: 'CREASE', svgId: 'CREASE10' });
  segments.push({ start: P['P001'], end: P['P003'], kind: 'CREASE', svgId: 'CREASE11' });
  segments.push({ start: P['P007'], end: P['P005'], kind: 'CREASE', svgId: 'CREASE12' });
  segments.push({ start: P['P005'], end: P['P001'], kind: 'CREASE', svgId: 'CREASE13' });
  segments.push({ start: P['P002'], end: P['P004'], kind: 'CREASE', svgId: 'CREASE14' });
  segments.push({ start: P['P008'], end: P['P006'], kind: 'CREASE', svgId: 'CREASE15' });
  segments.push({ start: P['P006'], end: P['P002'], kind: 'CREASE', svgId: 'CREASE16' });

  // Removed the manual arc replacement since the blueprint actually uses straight notches (A1, A2, A8, A9)

  const svgLines = segments.map((seg, idx) => {
    if (seg.d) {
      return `<path id="${seg.svgId || 'seg_' + idx}" d="${seg.d}" fill="none" stroke="${seg.kind === 'CREASE' ? '#00a651' : '#ed1c24'}" stroke-miterlimit="10" stroke-width="2"/>`;
    }
    return `<line id="${seg.svgId || 'seg_' + idx}" x1="${seg.start.x}" y1="${seg.start.y}" x2="${seg.end.x}" y2="${seg.end.y}" fill="none" stroke="${seg.kind === 'CREASE' ? '#00a651' : '#ed1c24'}" stroke-miterlimit="10" stroke-width="2"/>`;
  }).join('\n  ');

  const bbox = {
    x: Math.min(...segments.map(s => Math.min(s.start.x, s.end.x))),
    y: Math.min(...segments.map(s => Math.min(s.start.y, s.end.y))),
    w: Math.max(...segments.map(s => Math.max(s.start.x, s.end.x))) - Math.min(...segments.map(s => Math.min(s.start.x, s.end.x))),
    h: Math.max(...segments.map(s => Math.max(s.start.y, s.end.y))) - Math.min(...segments.map(s => Math.min(s.start.y, s.end.y)))
  };

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bbox.x - 5} ${bbox.y - 5} ${bbox.w + 10} ${bbox.h + 10}">
  ${svgLines}
</svg>`.trim();

  const faceCoords: T00012FaceCoords = {
    lidTuck: { x: xL, y: yCovT - 20, w: W, h: 20 },
    lid: { x: xL, y: yCovT, w: W, h: H },
    back: { x: xL, y: yCovB, w: W, h: D },
    bottom: { x: xL, y: yTDB, w: W, h: H },
    front: { x: xL, y: yBaseB, w: W, h: D },
    
    leftWallOuter: { x: xL - D, y: yTDB, w: D, h: H },
    leftWallInner: { x: xL - D - 15.5, y: yTDB, w: 15.5, h: H },
    rightWallOuter: { x: xR, y: yTDB, w: D, h: H },
    rightWallInner: { x: xR + D, y: yTDB, w: 15.5, h: H },
    
    backDustLeft: { x: xL - D, y: yCovB, w: D, h: D },
    backDustRight: { x: xR, y: yCovB, w: D, h: D },
    frontDustLeft: { x: xL - D, y: yBaseB, w: D, h: D },
    frontDustRight: { x: xR, y: yBaseB, w: D, h: D }
  };

  return {
    segments,
    svg,
    bbox,
    faceCoords
  };
}
