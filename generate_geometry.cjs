const fs = require('fs');

const excelDump = fs.readFileSync('excel_dump.txt', 'utf8');
const lines = excelDump.split('\n');

let currentSheet = '';
const dynamicPoints = [];
const dynamicLines = [];

for (const line of lines) {
  if (line.startsWith('--- Sheet: ')) {
    currentSheet = line.replace('--- Sheet: ', '').replace(' ---', '').trim();
    continue;
  }
  
  const cols = line.split('\t');
  if (cols.length < 2) continue;

  if (currentSheet === 'Dynamic_Points') {
    if (cols[0] === 'Point_ID' || cols[0].trim() === '') continue;
    dynamicPoints.push({
      id: cols[0],
      desc: cols[1],
      refX: parseFloat(cols[3]),
      refY: parseFloat(cols[5])
    });
  }
  
  if (currentSheet === 'Dynamic_Lines') {
    if (cols[0] === 'Line_ID' || cols[0].trim() === '') continue;
    dynamicLines.push({
      id: cols[0],
      layer: cols[1],
      p1: cols[3],
      p2: cols[4]
    });
  }
}

let code = `import type { T0007Params, T0007Geometry, Pt, Segment } from "./types";

export function buildT0007Geometry(p: T0007Params): T0007Geometry {
  const L = p.length;
  const W = p.width;
  const H = p.height;

  // Computed Deltas
  const deltaL = L - 250;
  const deltaW = W - 190;
  const deltaH = H - 50;

  // Dynamic Base Anchors
  const X_Left_Main = 65.85;
  const X_Right_Main = 315.85 + deltaL;
  
  const Y_Cover_Top = 20.35;
  const Y_Cover_Bottom = 210.35 + deltaW;
  const Y_Top_Depth_Bottom = 260.35 + deltaW + deltaH;
  const Y_Base_Bottom = 450.35 + (2 * deltaW) + deltaH;
  const Y_Bottom = 500.35 + (2 * deltaW) + (2 * deltaH);

  const CAreaWidth = H - 3;
  const area12Offset = CAreaWidth * Math.tan((12 * Math.PI) / 180);

  const pts: Record<string, Pt> = {
    P001: { x: X_Right_Main, y: Y_Top_Depth_Bottom },
    P002: { x: X_Left_Main, y: Y_Top_Depth_Bottom },
    P003: { x: X_Right_Main, y: Y_Cover_Bottom },
    P004: { x: X_Left_Main, y: Y_Cover_Bottom },
    P005: { x: X_Right_Main, y: Y_Base_Bottom },
    P006: { x: X_Left_Main, y: Y_Base_Bottom },
    P007: { x: X_Right_Main, y: Y_Bottom },
    P008: { x: X_Left_Main, y: Y_Bottom },
    P009: { x: X_Right_Main, y: Y_Cover_Top },
    P010: { x: X_Left_Main, y: Y_Cover_Top },
    P011: { x: X_Left_Main + 12.5, y: Y_Cover_Top - 20 },
    P012: { x: X_Right_Main - 12.5, y: Y_Cover_Top - 20 },
    P013: { x: X_Left_Main + 9, y: Y_Cover_Top + 1 },
    P014: { x: X_Right_Main - 9, y: Y_Cover_Top + 1 },
    P015: { x: X_Left_Main + 9, y: Y_Cover_Top },
    P016: { x: X_Left_Main + 9, y: Y_Cover_Top + 2 },
    P017: { x: X_Left_Main + 0.5, y: Y_Cover_Top },
    P018: { x: X_Right_Main - 9, y: Y_Cover_Top },
    P019: { x: X_Right_Main - 9, y: Y_Cover_Top + 2 },
    P020: { x: X_Right_Main - 0.5, y: Y_Cover_Top },
    P021: { x: X_Right_Main - 0.5, y: Y_Cover_Top - 8 },
    P022: { x: X_Right_Main + 3, y: Y_Cover_Bottom + 3 },
    P023: { x: X_Right_Main + 3 + CAreaWidth, y: Y_Cover_Bottom + 3 },
    P024: { x: X_Right_Main + 3 + CAreaWidth, y: Y_Top_Depth_Bottom - 13 },
    P025: { x: X_Right_Main + 3, y: Y_Top_Depth_Bottom - 3 },
    P026: { x: X_Left_Main - 3, y: Y_Cover_Bottom + 3 },
    P027: { x: X_Left_Main - 3 - CAreaWidth, y: Y_Cover_Bottom + 3 },
    P028: { x: X_Left_Main - 3 - CAreaWidth, y: Y_Top_Depth_Bottom - 13 },
    P029: { x: X_Left_Main - 3, y: Y_Top_Depth_Bottom - 3 },
    P030: { x: X_Right_Main + 3, y: Y_Base_Bottom + 3 },
    P031: { x: X_Right_Main + 3 + CAreaWidth, y: Y_Base_Bottom + 3 + area12Offset },
    P032: { x: X_Right_Main + 3 + CAreaWidth, y: Y_Bottom - 3 },
    P033: { x: X_Right_Main + 3, y: Y_Bottom - 3 },
    P034: { x: X_Left_Main - 3, y: Y_Base_Bottom + 3 },
    P035: { x: X_Left_Main - 3 - CAreaWidth, y: Y_Base_Bottom + 3 + area12Offset },
    P036: { x: X_Left_Main - 3 - CAreaWidth, y: Y_Bottom - 3 },
    P037: { x: X_Left_Main - 3, y: Y_Bottom - 3 },
    P038: { x: X_Right_Main + 1, y: Y_Top_Depth_Bottom + 1 },
    P039: { x: X_Right_Main + 50, y: Y_Top_Depth_Bottom + 1 },
    P040: { x: X_Right_Main + 1, y: Y_Base_Bottom - 1 },
    P041: { x: X_Right_Main + 50, y: Y_Base_Bottom - 1 },
    P042: { x: X_Right_Main + 56, y: Y_Base_Bottom - 1 },
    P043: { x: X_Right_Main + 65.5, y: Y_Base_Bottom - 4.62 },
    P044: { x: X_Right_Main + 65.5, y: Y_Top_Depth_Bottom + 4.62 },
    P045: { x: X_Left_Main - 1, y: Y_Top_Depth_Bottom + 1 },
    P046: { x: X_Left_Main - 50, y: Y_Top_Depth_Bottom + 1 },
    P047: { x: X_Left_Main - 1, y: Y_Base_Bottom - 1 },
    P048: { x: X_Left_Main - 50, y: Y_Base_Bottom - 1 },
    P049: { x: X_Left_Main - 56, y: Y_Base_Bottom - 1 },
    P050: { x: X_Left_Main - 65.5, y: Y_Base_Bottom - 4.62 },
    P051: { x: X_Left_Main - 65.5, y: Y_Top_Depth_Bottom + 4.62 },
    P052: { x: X_Right_Main + 65.5, y: Y_Top_Depth_Bottom + 65.5 },
    P053: { x: X_Right_Main + 65.5, y: Y_Base_Bottom - 65.5 },
    P054: { x: X_Left_Main - 65.5, y: Y_Top_Depth_Bottom + 65.5 },
    P055: { x: X_Left_Main - 65.5, y: Y_Base_Bottom - 65.5 },
  };

  const segments: Segment[] = [
`;

for (const line of dynamicLines) {
  code += `    { id: "${line.id}", kind: "${line.layer}", start: pts.${line.p1}, end: pts.${line.p2} },\n`;
}

code += `  ];

  // Calculate bounding box and SVG
  const allPts = segments.flatMap(s => [s.start, s.end]);
  const minX = Math.min(...allPts.map(p => p.x));
  const minY = Math.min(...allPts.map(p => p.y));
  const maxX = Math.max(...allPts.map(p => p.x));
  const maxY = Math.max(...allPts.map(p => p.y));
  const w = maxX - minX;
  const h = maxY - minY;

  const r = (n: number) => Math.round(n * 1000) / 1000;
  
  // Shift segments to origin
  const shiftedSegments = segments.map(s => ({
    ...s,
    start: { x: r(s.start.x - minX), y: r(s.start.y - minY) },
    end: { x: r(s.end.x - minX), y: r(s.end.y - minY) }
  }));

  const svgW = r(w);
  const svgH = r(h);

  const out = [];
  out.push(\`<svg xmlns="http://www.w3.org/2000/svg" width="\${svgW}mm" height="\${svgH}mm" viewBox="0 0 \${svgW} \${svgH}">\`);
  
  // CREASE
  out.push(\`  <g id="CREASE" fill="none" stroke="#00A651" stroke-width="1" stroke-miterlimit="10">\`);
  for (const s of shiftedSegments.filter(s => s.kind === 'CREASE')) {
    out.push(\`    <line x1="\${s.start.x}" y1="\${s.start.y}" x2="\${s.end.x}" y2="\${s.end.y}" data-id="\${s.id}"/>\`);
  }
  out.push(\`  </g>\`);
  
  // CUT
  out.push(\`  <g id="CUT" fill="none" stroke="#ED1C24" stroke-width="1" stroke-miterlimit="10">\`);
  for (const s of shiftedSegments.filter(s => s.kind === 'CUT' || s.kind === 'OUTER')) {
    out.push(\`    <line x1="\${s.start.x}" y1="\${s.start.y}" x2="\${s.end.x}" y2="\${s.end.y}" data-id="\${s.id}"/>\`);
  }
  out.push(\`  </g>\`);

  out.push(\`</svg>\`);

  return {
    params: p,
    segments: shiftedSegments,
    bbox: { w, h },
    svg: out.join('\\n'),
  };
}
`;

fs.writeFileSync('src/lib/t0007/geometry.ts', code);
