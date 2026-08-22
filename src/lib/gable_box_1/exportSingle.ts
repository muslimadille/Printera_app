import { Gable_Box_1Dimensions } from './types';
import { generateGable_Box_1Geometry } from './geometry';
import { buildGable_Box_1DimensionsSvg } from './dimensionsOverlay';
import jsPDF from 'jspdf';
import 'svg2pdf.js';

export function getGable_Box_1SingleSvg(dims: Gable_Box_1Dimensions, includeDims: boolean = false): string {
  const geo = generateGable_Box_1Geometry(dims);
  const dimsMarkup = includeDims ? buildGable_Box_1DimensionsSvg(dims) : '';

  const totalW = geo.width + (includeDims ? 25 : 0);
  const totalH = geo.height + (includeDims ? 25 : 0);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW.toFixed(2)} ${totalH.toFixed(2)}" width="${totalW.toFixed(2)}mm" height="${totalH.toFixed(2)}mm">
    <g id="GEOMETRY">
      ${geo.svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}
    </g>
    ${dimsMarkup}
  </svg>`;
}

export async function exportGable_Box_1SinglePdf(dims: Gable_Box_1Dimensions): Promise<void> {
  const geo = generateGable_Box_1Geometry(dims);
  const svgStr = getGable_Box_1SingleSvg(dims, true);

  const pdf = new jsPDF({
    orientation: geo.width > geo.height ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [geo.width + 30, geo.height + 30],
  });

  const parser = new DOMParser();
  const svgElem = parser.parseFromString(svgStr, 'image/svg+xml').documentElement;

  await pdf.svg(svgElem, {
    x: 15,
    y: 15,
    width: geo.width,
    height: geo.height,
  });

  pdf.save(`Gable_Box_1_${dims.width}x${dims.height}x${dims.depth}.pdf`);
}
