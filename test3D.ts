import * as THREE from 'three';
import { buildT00012Geometry } from './src/lib/t00012/geometry';

function test() {
  console.log('Building geometry...');
  const result = buildT00012Geometry({ w: 100, h: 100, d: 50 }, { bleed: 3, margin: 5, useMm: true });
  
  console.log('Testing polygons...');
  const faceCoords = result.faceCoords as any;
  for (const key of Object.keys(faceCoords)) {
    const coord = faceCoords[key];
    if (coord.polygon && coord.polygon.length > 2) {
      const shape = new THREE.Shape();
      shape.moveTo(coord.polygon[0][0] - coord.x, coord.h - (coord.polygon[0][1] - coord.y));
      for (let i = 1; i < coord.polygon.length; i++) {
        shape.lineTo(coord.polygon[i][0] - coord.x, coord.h - (coord.polygon[i][1] - coord.y));
      }
      shape.closePath();
      try {
        const geom = new THREE.ShapeGeometry(shape);
        console.log(`Success: ${key}`);
      } catch (err: any) {
        console.error(`ERROR in ${key}:`, err.message);
      }
    }
  }
}

test();
