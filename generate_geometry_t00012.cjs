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
  const T = 15; // Lid tuck length
  const C = 1; // Clearance
  
  // Origin shift to ensure no negative coordinates
  const shiftX = 2 * D + C;
  const shiftY = T + H + D + C;

  const Left = shiftX;
  const Right = shiftX + W;
  const Top = shiftY;
  const Bottom = shiftY + H;

  // Base Panel
  const ptBaseTL = { x: Left, y: Top };
  const ptBaseTR = { x: Right, y: Top };
  const ptBaseBL = { x: Left, y: Bottom };
  const ptBaseBR = { x: Right, y: Bottom };

  // Back Wall
  const ptBackTL = { x: Left, y: Top - D };
  const ptBackTR = { x: Right, y: Top - D };

  // Lid
  const ptLidTL = { x: Left, y: Top - D - H };
  const ptLidTR = { x: Right, y: Top - D - H };

  // Lid Tuck
  const ptLidTuckTL = { x: Left + C*3, y: Top - D - H - T };
  const ptLidTuckTR = { x: Right - C*3, y: Top - D - H - T };
  
  // Front Wall
  const ptFrontBL = { x: Left, y: Bottom + D };
  const ptFrontBR = { x: Right, y: Bottom + D };

  // Front Roll-over
  const ptFrontRollBL = { x: Left + C, y: Bottom + 2*D };
  const ptFrontRollBR = { x: Right - C, y: Bottom + 2*D };
  
  // Left Wall Outer
  const ptLeftOutTL = { x: Left - D, y: Top };
  const ptLeftOutBL = { x: Left - D, y: Bottom };
  
  // Left Wall Inner
  const ptLeftInTL = { x: Left - 2*D + C, y: Top + C };
  const ptLeftInBL = { x: Left - 2*D + C, y: Bottom - C };
  
  // Right Wall Outer
  const ptRightOutTR = { x: Right + D, y: Top };
  const ptRightOutBR = { x: Right + D, y: Bottom };
  
  // Right Wall Inner
  const ptRightInTR = { x: Right + 2*D - C, y: Top + C };
  const ptRightInBR = { x: Right + 2*D - C, y: Bottom - C };

  // Dust Flaps (Back attached to Left/Right Outers)
  const ptBackDustLTL = { x: Left - D + C, y: Top - D + C };
  const ptBackDustLTR = { x: Left - C, y: Top - D + C };
  
  const ptBackDustRTL = { x: Right + C, y: Top - D + C };
  const ptBackDustRTR = { x: Right + D - C, y: Top - D + C };
  
  // Dust Flaps (Front attached to Left/Right Outers)
  const ptFrontDustLBL = { x: Left - D + C, y: Bottom + D - C };
  const ptFrontDustLBR = { x: Left - C, y: Bottom + D - C };
  
  const ptFrontDustRBL = { x: Right + C, y: Bottom + D - C };
  const ptFrontDustRBR = { x: Right + D - C, y: Bottom + D - C };

  // Lid Dust Flaps (Cherry locks) attached to Lid
  const ptLidDustLTL = { x: Left - D + C, y: Top - D - H + C };
  const ptLidDustLBL = { x: Left - D + C, y: Top - D - C };
  
  const ptLidDustRTR = { x: Right + D - C, y: Top - D - H + C };
  const ptLidDustRBR = { x: Right + D - C, y: Top - D - C };

  const segments: Segment[] = [
    // --- CREASES ---
    // Base Horizontal
    { start: ptBaseTL, end: ptBaseTR, kind: 'CREASE' },
    { start: ptBaseBL, end: ptBaseBR, kind: 'CREASE' },
    // Base Vertical
    { start: ptBaseTL, end: ptBaseBL, kind: 'CREASE' },
    { start: ptBaseTR, end: ptBaseBR, kind: 'CREASE' },
    
    // Back Wall -> Lid
    { start: ptBackTL, end: ptBackTR, kind: 'CREASE' },
    // Lid -> Lid Tuck
    { start: ptLidTL, end: ptLidTR, kind: 'CREASE' },
    
    // Front Wall -> Front Roll-over
    { start: ptFrontBL, end: ptFrontBR, kind: 'CREASE' },
    
    // Side Walls (Outer -> Inner)
    { start: ptLeftOutTL, end: ptLeftOutBL, kind: 'CREASE' },
    { start: ptRightOutTR, end: ptRightOutBR, kind: 'CREASE' },
    
    // Dust flaps creases
    // Back Dust Flaps attached to Left/Right Outers
    { start: ptLeftOutTL, end: { x: ptBaseTL.x, y: ptBaseTL.y }, kind: 'CREASE' },
    { start: ptRightOutTR, end: { x: ptBaseTR.x, y: ptBaseTR.y }, kind: 'CREASE' },
    
    // Front Dust Flaps attached to Left/Right Outers
    { start: ptLeftOutBL, end: { x: ptBaseBL.x, y: ptBaseBL.y }, kind: 'CREASE' },
    { start: ptRightOutBR, end: { x: ptBaseBR.x, y: ptBaseBR.y }, kind: 'CREASE' },

    // Lid Dust Flaps attached to Lid
    { start: ptLidTL, end: ptBackTL, kind: 'CREASE' },
    { start: ptLidTR, end: ptBackTR, kind: 'CREASE' },

    // --- CUTS (OUTER BOUNDARY) ---
    // Lid Tuck
    { start: ptLidTL, end: ptLidTuckTL, kind: 'OUTER' },
    { start: ptLidTuckTL, end: ptLidTuckTR, kind: 'OUTER' },
    { start: ptLidTuckTR, end: ptLidTR, kind: 'OUTER' },

    // Lid Dust Flaps (Left)
    { start: ptLidTL, end: ptLidDustLTL, kind: 'OUTER' },
    { start: ptLidDustLTL, end: ptLidDustLBL, kind: 'OUTER' },
    { start: ptLidDustLBL, end: ptBackTL, kind: 'OUTER' },
    
    // Lid Dust Flaps (Right)
    { start: ptLidTR, end: ptLidDustRTR, kind: 'OUTER' },
    { start: ptLidDustRTR, end: ptLidDustRBR, kind: 'OUTER' },
    { start: ptLidDustRBR, end: ptBackTR, kind: 'OUTER' },
    
    // Back Dust Flaps (Left)
    { start: ptBackTL, end: ptBackDustLTR, kind: 'OUTER' },
    { start: ptBackDustLTR, end: ptBackDustLTL, kind: 'OUTER' },
    { start: ptBackDustLTL, end: ptLeftOutTL, kind: 'OUTER' },
    
    // Back Dust Flaps (Right)
    { start: ptBackTR, end: ptBackDustRTL, kind: 'OUTER' },
    { start: ptBackDustRTL, end: ptBackDustRTR, kind: 'OUTER' },
    { start: ptBackDustRTR, end: ptRightOutTR, kind: 'OUTER' },
    
    // Left Wall Inner
    { start: ptLeftOutTL, end: ptLeftInTL, kind: 'OUTER' },
    { start: ptLeftInTL, end: ptLeftInBL, kind: 'OUTER' },
    { start: ptLeftInBL, end: ptLeftOutBL, kind: 'OUTER' },
    
    // Right Wall Inner
    { start: ptRightOutTR, end: ptRightInTR, kind: 'OUTER' },
    { start: ptRightInTR, end: ptRightInBR, kind: 'OUTER' },
    { start: ptRightInBR, end: ptRightOutBR, kind: 'OUTER' },
    
    // Front Dust Flaps (Left)
    { start: ptLeftOutBL, end: ptFrontDustLBL, kind: 'OUTER' },
    { start: ptFrontDustLBL, end: ptFrontDustLBR, kind: 'OUTER' },
    { start: ptFrontDustLBR, end: ptBaseBL, kind: 'OUTER' },
    
    // Front Dust Flaps (Right)
    { start: ptRightOutBR, end: ptFrontDustRBR, kind: 'OUTER' },
    { start: ptFrontDustRBR, end: ptFrontDustRBL, kind: 'OUTER' },
    { start: ptFrontDustRBL, end: ptBaseBR, kind: 'OUTER' },
    
    // Front Wall sides
    { start: ptBaseBL, end: ptFrontBL, kind: 'OUTER' },
    { start: ptBaseBR, end: ptFrontBR, kind: 'OUTER' },
    
    // Front Roll-over
    { start: ptFrontBL, end: ptFrontRollBL, kind: 'OUTER' },
    { start: ptFrontRollBL, end: ptFrontRollBR, kind: 'OUTER' },
    { start: ptFrontRollBR, end: ptFrontBR, kind: 'OUTER' }
  ];

  // Map elements into an SVG path
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
    lidTuck: { x: Left, y: Top - D - H - T, w: W, h: T },
    lid: { x: Left, y: Top - D - H, w: W, h: H },
    back: { x: Left, y: Top - D, w: W, h: D },
    bottom: { x: Left, y: Top, w: W, h: H },
    front: { x: Left, y: Bottom, w: W, h: D },
    
    leftWallOuter: { x: Left - D, y: Top, w: D, h: H },
    leftWallInner: { x: Left - 2*D, y: Top, w: D, h: H },
    rightWallOuter: { x: Right, y: Top, w: D, h: H },
    rightWallInner: { x: Right + D, y: Top, w: D, h: H },
    
    backDustLeft: { x: Left - D, y: Top - D, w: D, h: D },
    backDustRight: { x: Right, y: Top - D, w: D, h: D },
    frontDustLeft: { x: Left - D, y: Bottom, w: D, h: D },
    frontDustRight: { x: Right, y: Bottom, w: D, h: D }
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
