const fs = require('fs');

const linesCsv = fs.readFileSync('box1_blueprint_Dynamic_Lines.csv', 'utf8').split('\n').slice(1).filter(l => l.trim().length > 0);

let linesCode = '';
for (const line of linesCsv) {
  const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(s => s.replace(/(^"|"$)/g, ''));
  if (!parts) continue;
  const id = parts[0];
  const layer = parts[1];
  const p1 = parts[3];
  const p2 = parts[4];
  if (!p1 || !p2) continue;
  
  linesCode += `  segments.push({ kind: '${layer}', start: pts.${p1}, end: pts.${p2}, svgId: '${id}' });\n`;
}

// Add bezier paths
const pathsCode = `
  // Missing Bezier curves for the lid tuck
  segments.push({
    kind: 'CUT',
    start: pts.P012,
    end: pts.P019,
    d: \`M\${pts.P012.x},\${pts.P012.y} c18.78638,0 34.01562,15.22937 34.01562,34.01575\`,
    svgId: 'CUT_45_curve'
  });
  segments.push({
    kind: 'CUT',
    start: pts.P017,
    end: pts.P011,
    d: \`M\${pts.P017.x},\${pts.P017.y} c0,-18.78638 15.22937,-34.01575 34.01575,-34.01575\`,
    svgId: 'CUT_47_curve'
  });
  // The vertical line was P017 to P013 (which is down 22.6)
  // Actually the straight line parts are already covered by A1, A2 etc.
`;

const tsCode = `import type { T00012Params, T00012Geometry, T00012FaceCoords } from './types';

export type Pt = { x: number; y: number };
export type Segment = {
  start: Pt;
  end: Pt;
  kind: 'CUT' | 'CREASE' | 'OUTER' | 'GLUE_CUT';
  d?: string;
  svgId?: string;
};

export function buildT00012Geometry(params: T00012Params): T00012Geometry {
  const L = params.width;
  const W = params.height;
  const H = params.depth;

  const baseX = 0; // shift to origin
  const baseY = 0;

  const Right = baseX + L;
  const Left = baseX;

  // The 55 points derived from exact ECMA / Blueprint relationships
  const pts = {
    P001: { x: Right, y: baseY + W + H },
    P002: { x: Left,  y: baseY + W + H },
    P003: { x: Right, y: baseY + W },
    P004: { x: Left,  y: baseY + W },
    P005: { x: Right, y: baseY + 2 * W + H },
    P006: { x: Left,  y: baseY + 2 * W + H },
    P007: { x: Right, y: baseY + 2 * W + 2 * H },
    P008: { x: Left,  y: baseY + 2 * W + 2 * H },
    
    P009: { x: Right, y: baseY },
    P010: { x: Left,  y: baseY },
    
    P011: { x: Left + 12.5, y: baseY - 20 },
    P012: { x: Right - 12.5, y: baseY - 20 },
    P013: { x: Left + 9,    y: baseY + 1 },
    P014: { x: Right - 9,   y: baseY + 1 },
    P015: { x: Left + 9,    y: baseY },
    P016: { x: Left + 9,    y: baseY + 2 },
    P017: { x: Left + 0.5,  y: baseY },
    P018: { x: Right - 9,   y: baseY },
    P019: { x: Right - 9,   y: baseY + 2 },
    P020: { x: Right - 0.5, y: baseY },
    P021: { x: Right - 0.5, y: baseY - 8 },
    
    P022: { x: Right + 3,     y: baseY + W + 3 },
    P023: { x: Right + H,     y: baseY + W + 3 },
    P024: { x: Right + H,     y: baseY + W + H - 13 },
    P025: { x: Right + 3,     y: baseY + W + H - 3 },
    
    P026: { x: Left - 3,      y: baseY + W + 3 },
    P027: { x: Left - H,      y: baseY + W + 3 },
    P028: { x: Left - H,      y: baseY + W + H - 13 },
    P029: { x: Left - 3,      y: baseY + W + H - 3 },
    
    P030: { x: Right + 3,     y: baseY + 2 * W + H + 3 },
    P031: { x: Right + H,     y: baseY + 2 * W + H + 13 },
    P032: { x: Right + H,     y: baseY + 2 * W + 2 * H - 3 },
    P033: { x: Right + 3,     y: baseY + 2 * W + 2 * H - 3 },
    
    P034: { x: Left - 3,      y: baseY + 2 * W + H + 3 },
    P035: { x: Left - H,      y: baseY + 2 * W + H + 13 },
    P036: { x: Left - H,      y: baseY + 2 * W + 2 * H - 3 },
    P037: { x: Left - 3,      y: baseY + 2 * W + 2 * H - 3 },
    
    P038: { x: Right + 1,     y: baseY + W + H + 1 },
    P039: { x: Right + H,     y: baseY + W + H + 1 },
    P040: { x: Right + 1,     y: baseY + 2 * W + H - 1 },
    P041: { x: Right + H,     y: baseY + 2 * W + H - 1 },
    P042: { x: Right + H + 6, y: baseY + 2 * W + H - 1 },
    P043: { x: Right + H + 15.5, y: baseY + 2 * W + H - 4.62 },
    P044: { x: Right + H + 15.5, y: baseY + W + H + 4.62 },
    
    P045: { x: Left - 1,      y: baseY + W + H + 1 },
    P046: { x: Left - H,      y: baseY + W + H + 1 },
    P047: { x: Left - 1,      y: baseY + 2 * W + H - 1 },
    P048: { x: Left - H,      y: baseY + 2 * W + H - 1 },
    P049: { x: Left - H - 6,  y: baseY + 2 * W + H - 1 },
    P050: { x: Left - H - 15.5, y: baseY + 2 * W + H - 4.62 },
    P051: { x: Left - H - 15.5, y: baseY + W + H + 4.62 },
    
    P052: { x: Right + H + 15.5, y: baseY + W + H + 1 + H + 14.5 },
    P053: { x: Right + H + 15.5, y: baseY + 2 * W + H - 1 - (H + 14.5) },
    P054: { x: Left - H - 15.5, y: baseY + W + H + 1 + H + 14.5 },
    P055: { x: Left - H - 15.5, y: baseY + 2 * W + H - 1 - (H + 14.5) },
  };

  const segments: Segment[] = [];
${linesCode}
${pathsCode}

  // Adjust bounding box slightly
  let minX = 99999, maxX = -99999, minY = 99999, maxY = -99999;
  segments.forEach(s => {
    minX = Math.min(minX, s.start.x, s.end.x);
    maxX = Math.max(maxX, s.start.x, s.end.x);
    minY = Math.min(minY, s.start.y, s.end.y);
    maxY = Math.max(maxY, s.start.y, s.end.y);
  });
  
  // shift all points so minX = 0, minY = 0
  const shiftX = -minX;
  const shiftY = -minY;
  for (const key of Object.keys(pts)) {
    (pts as any)[key].x += shiftX;
    (pts as any)[key].y += shiftY;
  }

  // recalc bbox
  minX = 0; maxX += shiftX; minY = 0; maxY += shiftY;
  
  const faceCoords: T00012FaceCoords = {
    topFlaps: [],
    bottomFlaps: [],
    leftFlaps: [],
    rightFlaps: [],
    glue: { polygon: [] },
    body: [
      pts.P002,
      pts.P001,
      pts.P005,
      pts.P006
    ]
  };

  return {
    segments,
    bbox: { w: maxX, h: maxY },
    faceCoords
  };
}
`;

fs.writeFileSync('src/lib/t00012/geometry.ts', tsCode);
