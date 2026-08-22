import { Basket_Box_1Params } from './types';
import { generateBasket_Box_1Geometry } from './geometry';
import { computeBasket_Box_1Nesting } from './nesting';
import jsPDF from 'jspdf';
import 'svg2pdf.js';

export function getBasket_Box_1SheetSvg(params: Basket_Box_1Params): string {
  const geo = generateBasket_Box_1Geometry(params);
  const nesting = computeBasket_Box_1Nesting(params);

  const itemInner = geo.svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '');

  const itemsMarkup = nesting.items.map((item, idx) => {
    if (item.rotation === 90) {
      return `
        <g id="item_${idx}" transform="translate(${item.x + item.height}, ${item.y}) rotate(90)">
          ${itemInner}
        </g>
      `;
    }
    return `
      <g id="item_${idx}" transform="translate(${item.x}, ${item.y})">
        ${itemInner}
      </g>
    `;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${params.sheetWidth} ${params.sheetHeight}" width="${params.sheetWidth}mm" height="${params.sheetHeight}mm">
    <!-- Sheet Boundary -->
    <rect x="0" y="0" width="${params.sheetWidth}" height="${params.sheetHeight}" fill="#fcfcfd" stroke="#cbd5e1" stroke-width="1" />
    <!-- Margins -->
    <rect x="${params.sheetMargin}" y="${params.sheetMargin + params.gripper}" width="${params.sheetWidth - params.sheetMargin * 2}" height="${params.sheetHeight - params.sheetMargin * 2 - params.gripper}" fill="none" stroke="#94a3b8" stroke-dasharray="3,3" stroke-width="0.5" />
    <!-- Nested Die Cuts -->
    ${itemsMarkup}
  </svg>`;
}

export async function exportBasket_Box_1SheetPdf(params: Basket_Box_1Params): Promise<void> {
  const svgStr = getBasket_Box_1SheetSvg(params);

  const pdf = new jsPDF({
    orientation: params.sheetWidth > params.sheetHeight ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [params.sheetWidth, params.sheetHeight],
  });

  const parser = new DOMParser();
  const svgElem = parser.parseFromString(svgStr, 'image/svg+xml').documentElement;

  await pdf.svg(svgElem, {
    x: 0,
    y: 0,
    width: params.sheetWidth,
    height: params.sheetHeight,
  });

  pdf.save(`Basket_Box_1_Sheet_${params.sheetWidth}x${params.sheetHeight}.pdf`);
}
