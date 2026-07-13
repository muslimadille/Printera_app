const fs = require('fs');

const code = `import type { T00012Params, T00012Geometry, T00012FaceCoords } from './types';

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
  
  // Internal parameters derived from SVG proportions
  const c = 8.5; // chamfer
  const y2 = D / 4; // angle for dust flaps
  const C = 2.8; // clearance
  const A = D / 3.2; // glue flap width (inner side flap)
  const X_inner = D + A;
  const H_lid = H - C; // Lid height slightly less than H
  const y_lid = -D - H_lid;
  const T = 60; // Tuck length
  const tuckInset = 25.5;

  const shiftX = X_inner + 5;
  const shiftY = D + H_lid + T + 5;

  const segments: Segment[] = [];

  const addCut = (x1: number, y1: number, x2: number, y2: number) => {
    segments.push({ start: { x: x1 + shiftX, y: y1 + shiftY }, end: { x: x2 + shiftX, y: y2 + shiftY }, kind: 'OUTER' });
  };
  const addCrease = (x1: number, y1: number, x2: number, y2: number) => {
    segments.push({ start: { x: x1 + shiftX, y: y1 + shiftY }, end: { x: x2 + shiftX, y: y2 + shiftY }, kind: 'CREASE' });
  };

  // BASE CREASES
  addCrease(0, 0, W, 0); // Top
  addCrease(0, H, W, H); // Bottom
  addCrease(0, 0, 0, H); // Left
  addCrease(W, 0, W, H); // Right

  // FRONT WALL & FLAPS
  addCut(0, H, -c, H + c);
  addCut(-c, H + c, -D, H + y2);
  addCut(-D, H + y2, -D, H + D - c);
  addCut(-D, H + D - c, -c, H + D - c);
  addCut(-c, H + D - c, 0, H + D);
  
  addCut(W, H, W + c, H + c);
  addCut(W + c, H + c, W + D, H + y2);
  addCut(W + D, H + y2, W + D, H + D - c);
  addCut(W + D, H + D - c, W + c, H + D - c);
  addCut(W + c, H + D - c, W, H + D);
  
  addCut(0, H + D, W, H + D); // Front wall bottom edge
  
  // BACK WALL & FLAPS
  addCut(0, 0, -c, -c);
  addCut(-c, -c, -D, -y2);
  addCut(-D, -y2, -D, -D + c);
  addCut(-D, -D + c, -c, -D + c);
  addCut(-c, -D + c, 0, -D);
  
  addCut(W, 0, W + c, -c);
  addCut(W + c, -c, W + D, -y2);
  addCut(W + D, -y2, W + D, -D + c);
  addCut(W + D, -D + c, W + c, -D + c);
  addCut(W + c, -D + c, W, -D);

  addCrease(0, -D, W, -D); // Back wall to Lid
  
  // LID
  addCut(0, -D, 0, y_lid);
  addCut(W, -D, W, y_lid);
  
  // LID TUCK
  addCrease(tuckInset, y_lid, W - tuckInset, y_lid);
  addCut(0, y_lid, tuckInset, y_lid);
  addCut(W, y_lid, W - tuckInset, y_lid);
  
  addCut(tuckInset, y_lid, tuckInset, y_lid - 10);
  addCut(tuckInset, y_lid - 10, tuckInset + 10, y_lid - T);
  addCut(tuckInset + 10, y_lid - T, W - tuckInset - 10, y_lid - T);
  addCut(W - tuckInset - 10, y_lid - T, W - tuckInset, y_lid - 10);
  addCut(W - tuckInset, y_lid - 10, W - tuckInset, y_lid);
  
  // LEFT BASE FLAP
  addCrease(-C, C, -X_inner, X_inner); // Top diagonal
  addCrease(-D, C, -D, H - C); // Vertical crease
  addCrease(-C, H - C, -X_inner, H - X_inner); // Bottom diagonal
  
  addCut(0, 0, -C, C);
  addCut(-C, C, -D, C);
  addCut(-D, C, -X_inner, C + 10);
  addCut(-X_inner, C + 10, -X_inner, H - C - 10);
  addCut(-X_inner, H - C - 10, -D - 17, H - C);
  addCut(-D - 17, H - C, -D, H - C);
  addCut(-D, H - C, -C, H - C);
  addCut(-C, H - C, 0, H);
  
  // RIGHT BASE FLAP
  addCrease(W + C, C, W + X_inner, X_inner); // Top diagonal
  addCrease(W + D, C, W + D, H - C); // Vertical crease
  addCrease(W + C, H - C, W + X_inner, H - X_inner); // Bottom diagonal
  
  addCut(W, 0, W + C, C);
  addCut(W + C, C, W + D, C);
  addCut(W + D, C, W + X_inner, C + 10);
  addCut(W + X_inner, C + 10, W + X_inner, H - C - 10);
  addCut(W + X_inner, H - C - 10, W + D + 17, H - C);
  addCut(W + D + 17, H - C, W + D, H - C);
  addCut(W + D, H - C, W + C, H - C);
  addCut(W + C, H - C, W, H);
  
  const svgLines = segments.map((seg, idx) => 
    \\\`<line id="seg_\\\${idx}" x1="\\\${seg.start.x}" y1="\\\${seg.start.y}" x2="\\\${seg.end.x}" y2="\\\${seg.end.y}" fill="none" stroke="\\\${seg.kind === 'CREASE' ? '#00a651' : '#ed1c24'}" stroke-miterlimit="10" stroke-width="2"/>\\\`
  ).join('\\n  ');

  const bbox = {
    x: Math.min(...segments.map(s => Math.min(s.start.x, s.end.x))),
    y: Math.min(...segments.map(s => Math.min(s.start.y, s.end.y))),
    w: Math.max(...segments.map(s => Math.max(s.start.x, s.end.x))) - Math.min(...segments.map(s => Math.min(s.start.x, s.end.x))),
    h: Math.max(...segments.map(s => Math.max(s.start.y, s.end.y))) - Math.min(...segments.map(s => Math.min(s.start.y, s.end.y)))
  };

  const svg = \\\`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="\\\${bbox.x - 5} \\\${bbox.y - 5} \\\${bbox.w + 10} \\\${bbox.h + 10}">
  \\\${svgLines}
</svg>\\\`.trim();

  const faceCoords: T00012FaceCoords = {
    lidTuck: { x: shiftX, y: shiftY + y_lid - T, w: W, h: T },
    lid: { x: shiftX, y: shiftY + y_lid, w: W, h: H_lid },
    back: { x: shiftX, y: shiftY - D, w: W, h: D },
    bottom: { x: shiftX, y: shiftY, w: W, h: H },
    front: { x: shiftX, y: shiftY + H, w: W, h: D },
    
    // Using base flaps for left/right mapping in 3D
    leftWallOuter: { x: shiftX - D, y: shiftY, w: D, h: H },
    leftWallInner: { x: shiftX - X_inner, y: shiftY, w: A, h: H },
    rightWallOuter: { x: shiftX + W, y: shiftY, w: D, h: H },
    rightWallInner: { x: shiftX + W + D, y: shiftY, w: A, h: H },
    
    backDustLeft: { x: shiftX - D, y: shiftY - D, w: D, h: D },
    backDustRight: { x: shiftX + W, y: shiftY - D, w: D, h: D },
    frontDustLeft: { x: shiftX - D, y: shiftY + H, w: D, h: D },
    frontDustRight: { x: shiftX + W, y: shiftY + H, w: D, h: D }
  };

  return {
    segments,
    svg,
    bbox,
    faceCoords
  };
}
`;

fs.writeFileSync('src/lib/t00012/geometry.ts', code);
console.log("Wrote src/lib/t00012/geometry.ts");
