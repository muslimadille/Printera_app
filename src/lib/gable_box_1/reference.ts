import { Gable_Box_1Dimensions } from './types';
import { generateGable_Box_1Geometry } from './geometry';

export function buildGable_Box_1Reference(dims: Gable_Box_1Dimensions): string {
  const geo = generateGable_Box_1Geometry(dims);
  return geo.svg;
}
