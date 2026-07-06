import { buildT0001Geometry } from '../src/lib/t0001/geometry.js';
import { T0001_DEFAULTS } from '../src/lib/t0001/types.js';
import * as fs from 'fs';

const geo = buildT0001Geometry(T0001_DEFAULTS);
fs.writeFileSync('scratch/t0001_output.svg', geo.svg);
console.log("SVG written to scratch/t0001_output.svg");
console.log("Full SVG:\n", geo.svg);
