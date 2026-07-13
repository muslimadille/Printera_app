const fs = require('fs');

const formulas = fs.readFileSync('dynamic_formulas.tsv', 'utf-8').split('\n').filter(Boolean).slice(1);
const lines = fs.readFileSync('dynamic_lines.tsv', 'utf-8').split('\n').filter(Boolean).slice(1);

let code = `import type { T00012Params, T00012Geometry, T00012FaceCoords } from './types';

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
`;

for (const line of formulas) {
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const pid = parts[0];
    let xForm = parts[1];
    let yForm = parts[2];

    const replaceForm = (f, isY) => {
        let res = f.replace(/Inputs!\$B\$15/g, 'xL')
                   .replace(/Inputs!\$B\$16/g, 'xR')
                   .replace(/Inputs!\$B\$17/g, 'yCovT')
                   .replace(/Inputs!\$B\$18/g, 'yCovB')
                   .replace(/Inputs!\$B\$19/g, 'yTDB')
                   .replace(/Inputs!\$B\$20/g, 'yBaseB')
                   .replace(/Inputs!\$B\$21/g, 'yBot');
        
        // Handle specific D-related numbers
        res = res.replace(/\+65\.5/g, ' + (D + 15.5)')
                 .replace(/\-65\.5/g, ' - (D + 15.5)')
                 .replace(/\+56/g, ' + (D + 6)')
                 .replace(/\-56/g, ' - (D + 6)')
                 .replace(/\+50/g, ' + D')
                 .replace(/\-50/g, ' - D');

        // Handle the slant offset 13 -> (3 + slantDy)
        if (isY) {
            res = res.replace(/\-13/g, ' - (3 + slantDy)')
                     .replace(/\+13/g, ' + (3 + slantDy)');
        }

        return res;
    };

    code += `  P['${pid}'] = { x: ${replaceForm(xForm, false)}, y: ${replaceForm(yForm, true)} };\n`;
}

code += `\n  const segments: Segment[] = [];\n`;

for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 5) continue;
    const lid = parts[0];
    const layer = parts[1];
    const p1 = parts[3];
    const p2 = parts[4];
    
    // We'll replace the Lid Tuck arc directly later. For now, generate the line.
    if (lid === 'A1' || lid === 'A2' || lid === 'A8' || lid === 'A9') {
        // Skip these straight lines because we will replace them with ARCs!
        continue;
    }
    
    const kind = layer === 'CREASE' ? 'CREASE' : 'OUTER';
    code += `  segments.push({ start: P['${p1}'], end: P['${p2}'], kind: '${kind}', svgId: '${lid}' });\n`;
}

// Add the Arcs for Lid Tuck
code += `
  // Tuck rounded corners (replacing A1, A2, A8, A9)
  const tuckRadius = 8.5; // From A2/A8 lengths
  const leftArcPath = \`M \${P['P016'].x},\${P['P016'].y} A \${tuckRadius},\${tuckRadius} 0 0,1 \${P['P017'].x},\${P['P017'].y}\`;
  segments.push({ start: P['P016'], end: P['P017'], kind: 'OUTER', d: leftArcPath, svgId: 'A1_A2_ARC' });
  
  const rightArcPath = \`M \${P['P018'].x},\${P['P018'].y} A \${tuckRadius},\${tuckRadius} 0 0,1 \${P['P019'].x},\${P['P019'].y}\`;
  segments.push({ start: P['P018'], end: P['P019'], kind: 'OUTER', d: rightArcPath, svgId: 'A8_A9_ARC' });
`;

// Finish up
code += `
  const svgLines = segments.map((seg, idx) => {
    if (seg.d) {
      return \`<path id="\${seg.svgId || 'seg_' + idx}" d="\${seg.d}" fill="none" stroke="\${seg.kind === 'CREASE' ? '#00a651' : '#ed1c24'}" stroke-miterlimit="10" stroke-width="2"/>\`;
    }
    return \`<line id="\${seg.svgId || 'seg_' + idx}" x1="\${seg.start.x}" y1="\${seg.start.y}" x2="\${seg.end.x}" y2="\${seg.end.y}" fill="none" stroke="\${seg.kind === 'CREASE' ? '#00a651' : '#ed1c24'}" stroke-miterlimit="10" stroke-width="2"/>\`;
  }).join('\\n  ');

  const bbox = {
    x: Math.min(...segments.map(s => Math.min(s.start.x, s.end.x))),
    y: Math.min(...segments.map(s => Math.min(s.start.y, s.end.y))),
    w: Math.max(...segments.map(s => Math.max(s.start.x, s.end.x))) - Math.min(...segments.map(s => Math.min(s.start.x, s.end.x))),
    h: Math.max(...segments.map(s => Math.max(s.start.y, s.end.y))) - Math.min(...segments.map(s => Math.min(s.start.y, s.end.y)))
  };

  const svg = \`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="\${bbox.x - 5} \${bbox.y - 5} \${bbox.w + 10} \${bbox.h + 10}">
  \${svgLines}
</svg>\`.trim();

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
`;

fs.writeFileSync('src/lib/t00012/geometry.ts', code);
console.log("Geometry written successfully!");
