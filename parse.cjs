const fs = require('fs');
const PT_PER_MM = 2.83464566929;

const svgRaw = fs.readFileSync('src/assets/d003/TEMPLATE.svg', 'utf8');

function mm(pt) { return (parseFloat(pt) / PT_PER_MM).toFixed(3); }

let lines = svgRaw.split('\n');
lines.forEach(l => {
  if (l.includes('<line')) {
    let m = l.match(/x1="([^"]+)"\s+y1="([^"]+)"\s+x2="([^"]+)"\s+y2="([^"]+)"/);
    let s = l.match(/stroke="([^"]+)"/);
    if(m && s) {
      console.log(`line: (${mm(m[1])}, ${mm(m[2])}) -> (${mm(m[3])}, ${mm(m[4])}) stroke: ${s[1]}`);
    }
  } else if (l.includes('<polyline')) {
    let m = l.match(/points="([^"]+)"/);
    let s = l.match(/stroke="([^"]+)"/);
    if(m && s) {
      let pts = m[1].trim().split(/\s+/).map(mm);
      let pairs = [];
      for(let i=0; i<pts.length; i+=2) pairs.push(`(${pts[i]}, ${pts[i+1]})`);
      console.log(`polyline: ${pairs.join(' -> ')} stroke: ${s[1]}`);
    }
  } else if (l.includes('<path')) {
    let m = l.match(/d="([^"]+)"/);
    let s = l.match(/stroke="([^"]+)"/);
    if(m && s) console.log(`path: ${m[1]} stroke: ${s[1]}`);
  }
});
