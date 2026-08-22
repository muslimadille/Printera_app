import { F10_41_00_00Dimensions } from './types';

// Scale factor: 1 pt = 1 / 2.83464566929 mm
const PT_TO_MM = 1 / 2.83464566929;

export function buildF10_41_00_00Reference(params: F10_41_00_00Dimensions) {
  const scale = params.width / 100; // Reference is 100mm width

  // Verbatim reference geometry converted to mm
  const svgWidth = 887.701 * PT_TO_MM * scale;
  const svgHeight = 620.536 * PT_TO_MM * scale;

  return {
    svgWidth,
    svgHeight,
    scale,
  };
}
