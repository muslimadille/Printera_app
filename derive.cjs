const fs = require('fs');

const pointsCsv = fs.readFileSync('box1_blueprint_Dynamic_Points.csv', 'utf8');
const lines = pointsCsv.split('\n').slice(1).filter(l => l.trim().length > 0);

const L = 250, W = 190, H = 50;
const baseX = 65.85, baseY = 20.35;

function deriveFormula(val, isX) {
  const v = parseFloat(val);
  if (isNaN(v)) return val;
  
  // Try combinations of base, L, W, H
  if (isX) {
    let diff = v - baseX;
    if (Math.abs(diff) < 0.1) return 'baseX';
    if (Math.abs(diff - L) < 0.1) return 'baseX + L';
    if (Math.abs(diff - L/2) < 0.1) return 'baseX + L/2';
    // Let's also check distance from right
    let diffRight = v - (baseX + L);
    if (Math.abs(diffRight - H) < 0.1) return 'baseX + L + H';
    if (Math.abs(diffRight - H + 3) < 0.1) return 'baseX + L + H - 3';
    // And so on, let's just write a greedy solver
    
    // Terms
    const terms = [
      { name: 'baseX', val: baseX },
      { name: 'L', val: L },
      { name: 'H', val: H }
    ];
    
    // brute force linear combinations with coefficients -2, -1, 0, 1, 2 and constant -50 to 50
    for (let c1 = -2; c1 <= 2; c1++) {
      for (let c2 = -2; c2 <= 2; c2++) {
        for (let c3 = -2; c3 <= 2; c3++) {
          for (let const_val = -50; const_val <= 50; const_val+=0.5) {
            let sum = c1*baseX + c2*L + c3*H + const_val;
            if (Math.abs(sum - v) < 0.01) {
               let eq = [];
               if (c1 === 1) eq.push('baseX'); else if (c1 !== 0) eq.push(`${c1}*baseX`);
               if (c2 === 1) eq.push('L'); else if (c2 !== 0) eq.push(`${c2}*L`);
               if (c3 === 1) eq.push('H'); else if (c3 !== 0) eq.push(`${c3}*H`);
               if (const_val > 0) eq.push(`+ ${const_val}`);
               else if (const_val < 0) eq.push(`- ${Math.abs(const_val)}`);
               return eq.join(' + ').replace(/\+ -/g, '- ');
            }
          }
        }
      }
    }
    return v.toString();
  } else {
    // is Y
    let diff = v - baseY;
    if (Math.abs(diff) < 0.1) return 'baseY';
    if (Math.abs(diff - W) < 0.1) return 'baseY + W';
    if (Math.abs(diff - (W + H)) < 0.1) return 'baseY + W + H';
    
    const terms = [
      { name: 'baseY', val: baseY },
      { name: 'W', val: W },
      { name: 'H', val: H }
    ];
    
    for (let c1 = -2; c1 <= 2; c1++) {
      for (let c2 = -2; c2 <= 2; c2++) {
        for (let c3 = -2; c3 <= 2; c3++) {
          for (let const_val = -50; const_val <= 50; const_val+=0.5) {
            let sum = c1*baseY + c2*W + c3*H + const_val;
            if (Math.abs(sum - v) < 0.01) {
               let eq = [];
               if (c1 === 1) eq.push('baseY'); else if (c1 !== 0) eq.push(`${c1}*baseY`);
               if (c2 === 1) eq.push('W'); else if (c2 !== 0) eq.push(`${c2}*W`);
               if (c3 === 1) eq.push('H'); else if (c3 !== 0) eq.push(`${c3}*H`);
               if (const_val > 0) eq.push(`+ ${const_val}`);
               else if (const_val < 0) eq.push(`- ${Math.abs(const_val)}`);
               return eq.join(' + ').replace(/\+ -/g, '- ');
            }
          }
        }
      }
    }
    return v.toString();
  }
}

const points = {};
for (const line of lines) {
  // Regex to split csv properly since it has quotes
  const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g).map(s => s.replace(/(^"|"$)/g, ''));
  const pid = parts[0];
  const refX = parseFloat(parts[3]);
  const refY = parseFloat(parts[5]);
  
  points[pid] = {
    x: deriveFormula(refX, true),
    y: deriveFormula(refY, false)
  };
}

// Generate TS code
let ts = `export function computePoints(L: number, W: number, H: number) {\n`;
ts += `  const baseX = 65.85;\n`;
ts += `  const baseY = 20.35;\n`;
ts += `  return {\n`;
for (const [pid, pt] of Object.entries(points)) {
  ts += `    ${pid}: { x: ${pt.x}, y: ${pt.y} },\n`;
}
ts += `  };\n}\n`;

fs.writeFileSync('derived_points.ts', ts);
console.log('Derived formulas written to derived_points.ts');
