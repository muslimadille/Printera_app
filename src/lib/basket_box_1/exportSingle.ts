import { Basket_Box_1Params } from './types';
import { generateBasket_Box_1Geometry } from './geometry';
import { generateBasket_Box_1DimensionsOverlay } from './dimensionsOverlay';
import jsPDF from 'jspdf';
import 'svg2pdf.js';

export function getBasket_Box_1SingleSvg(params: Basket_Box_1Params, includeDims: boolean = false): string {
  const geo = generateBasket_Box_1Geometry(params);
  const dimsMarkup = includeDims ? generateBasket_Box_1DimensionsOverlay(params) : '';

  const totalW = geo.bbox.width;
  const totalH = geo.bbox.height;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW.toFixed(2)} ${totalH.toFixed(2)}" width="${totalW.toFixed(2)}mm" height="${totalH.toFixed(2)}mm">
    <g id="GEOMETRY">
      ${geo.svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}
    </g>
    ${dimsMarkup}
  </svg>`;
}

export async function exportBasket_Box_1SinglePdf(params: Basket_Box_1Params): Promise<void> {
  const geo = generateBasket_Box_1Geometry(params);
  const svgStr = getBasket_Box_1SingleSvg(params, true);

  const pdf = new jsPDF({
    orientation: geo.bbox.width > geo.bbox.height ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [geo.bbox.width + 30, geo.bbox.height + 30],
  });

  const parser = new DOMParser();
  const svgElem = parser.parseFromString(svgStr, 'image/svg+xml').documentElement;

  await pdf.svg(svgElem, {
    x: 15,
    y: 15,
    width: geo.bbox.width,
    height: geo.bbox.height,
  });

  pdf.save(`Basket_Box_1_${params.width}x${params.depth}x${params.height}.pdf`);
}
