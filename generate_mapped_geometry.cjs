const fs = require('fs');

const svgRel = fs.readFileSync('svg_rel.txt', 'utf8').split('\n').filter(l => l.trim());

// We will generate a typescript file that parses these exact lines,
// and maps their coordinates using a piecewise linear function based on W, H, D.

const code = `import type { T00012Params, T00012Geometry, T00012FaceCoords } from './types';

export type Pt = { x: number; y: number };
export type Segment = {
  start: Pt;
  end: Pt;
  kind: 'CUT' | 'CREASE' | 'OUTER' | 'GLUE_CUT';
  d?: string;
  svgId?: string;
};

// The original dimensions from the SVG
const O_W = 708.7;
const O_H = 538.6;
const O_D = 141.7;
const O_T = 59.5;

export function buildT00012Geometry(params: T00012Params): T00012Geometry {
  const W = params.width;
  const H = params.height;
  const D = params.depth;
  const T = 15; // Set tuck to 15 or scale it. Let's use 15 as standard.
  const A = D * (44 / 141.7); // scale inner flap width proportionally

  // Map original X to new X
  const mapX = (x: number) => {
    if (x <= 0) {
      // Left side flaps
      // x ranges from -185.7 to 0
      // -141.7 is -D.
      if (x >= -141.7) {
        return (x / -141.7) * -D;
      } else {
        const excess = (x - (-141.7)) / (-185.7 - (-141.7)); // 0 to 1
        return -D - excess * A;
      }
    } else if (x <= O_W) {
      // Base width
      return (x / O_W) * W;
    } else {
      // Right side flaps
      const relX = x - O_W;
      if (relX <= 141.7) {
        return W + (relX / 141.7) * D;
      } else {
        const excess = (relX - 141.7) / (185.7 - 141.7); // 0 to 1
        return W + D + excess * A;
      }
    }
  };

  // Map original Y to new Y
  const mapY = (y: number) => {
    if (y > O_H) {
      // Front Wall
      return H + ((y - O_H) / 141.7) * D;
    } else if (y >= 0) {
      // Base
      return (y / O_H) * H;
    } else if (y >= -141.7) {
      // Back Wall
      return ((y - 0) / -141.7) * -D;
    } else if (y >= -677.5) {
      // Lid
      return -D + ((y - (-141.7)) / (-677.5 - (-141.7))) * -H;
    } else {
      // Lid Tuck
      return -D - H + ((y - (-677.5)) / (-737.0 - (-677.5))) * -T;
    }
  };

  // Original lines extracted from the exact SVG image
  const originalLines = [
${svgRel.filter(l => l.startsWith('CUT:') || l.startsWith('CREASE:')).map(l => {
  const parts = l.split(':');
  const kind = parts[0].trim();
  const coords = parts[1].split('->');
  const start = coords[0].replace(/[()]/g, '').trim().split(',').map(n => parseFloat(n));
  const end = coords[1].replace(/[()]/g, '').trim().split(',').map(n => parseFloat(n));
  return `    { kind: '${kind === 'CUT' ? 'OUTER' : 'CREASE'}' as const, start: { x: ${start[0]}, y: ${start[1]} }, end: { x: ${end[0]}, y: ${end[1]} } },`;
}).join('\n')}
  ];

  const shiftX = D + A + 5;
  const shiftY = D + H + T + 5;

  const segments: Segment[] = originalLines.map(line => ({
    kind: line.kind,
    start: { x: mapX(line.start.x) + shiftX, y: mapY(line.start.y) + shiftY },
    end: { x: mapX(line.end.x) + shiftX, y: mapY(line.end.y) + shiftY }
  }));

  // We also need the lid tuck arcs if the user wants it exact. 
  // Let's add them as paths.
  const svgPaths = \`
    <path d="M \${mapX(1.4) + shiftX} \${mapY(-680.3) + shiftY} C \${mapX(1.4) + shiftX} \${mapY(-699.1) + shiftY}, \${mapX(16.6) + shiftX} \${mapY(-737.0) + shiftY}, \${mapX(35.4) + shiftX} \${mapY(-737.0) + shiftY}" fill="none" stroke="#ed1c24" stroke-miterlimit="10" stroke-width="2"/>
    <path d="M \${mapX(O_W - 1.4) + shiftX} \${mapY(-680.3) + shiftY} C \${mapX(O_W - 1.4) + shiftX} \${mapY(-699.1) + shiftY}, \${mapX(O_W - 16.6) + shiftX} \${mapY(-737.0) + shiftY}, \${mapX(O_W - 35.4) + shiftX} \${mapY(-737.0) + shiftY}" fill="none" stroke="#ed1c24" stroke-miterlimit="10" stroke-width="2"/>
  \`;

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
  \\\${svgPaths}
</svg>\\\`.trim();

  const faceCoords: T00012FaceCoords = {
    lidTuck: { x: shiftX, y: shiftY - D - H - T, w: W, h: T },
    lid: { x: shiftX, y: shiftY - D - H, w: W, h: H },
    back: { x: shiftX, y: shiftY - D, w: W, h: D },
    bottom: { x: shiftX, y: shiftY, w: W, h: H },
    front: { x: shiftX, y: shiftY + H, w: W, h: D },
    
    leftWallOuter: { x: shiftX - D, y: shiftY, w: D, h: H },
    leftWallInner: { x: shiftX - D - A, y: shiftY, w: A, h: H },
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
console.log("Wrote exact mapped src/lib/t00012/geometry.ts");
