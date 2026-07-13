const fs = require('fs');

let code = fs.readFileSync('src/lib/t00012/geometry.ts', 'utf-8');

// Replace leftArcPath and rightArcPath
code = code.replace(
  /const leftArcPath =.*/,
  "const leftArcPath = `M ${P['P016'].x},${P['P016'].y} A 8.5,2 0 0,0 ${P['P017'].x},${P['P017'].y}`;"
);

code = code.replace(
  /const rightArcPath =.*/,
  "const rightArcPath = `M ${P['P018'].x},${P['P018'].y} A 8.5,2 0 0,0 ${P['P019'].x},${P['P019'].y}`;"
);

fs.writeFileSync('src/lib/t00012/geometry.ts', code);
