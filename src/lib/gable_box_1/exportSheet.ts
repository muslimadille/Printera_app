import { Gable_Box_1Dimensions, Gable_Box_1NestingParams } from './types';
import { generateGable_Box_1Geometry } from './geometry';
import { computeGable_Box_1Nesting } from './nesting';
import jsPDF from 'jspdf';
import 'svg2pdf.js';

export function buildGable_Box_1SheetSvg(
  dims: Gable_Box_1Dimensions,
  nesting: Gable_Box_1NestingParams
): string {
  const geo = generateGable_Box_1Geometry(dims);
  const result = computeGable_Box_1Nesting(dims, nesting);

  const sheetW = nesting.sheetWidth;
  const sheetH = nesting.sheetHeight;
  const margin = nesting.margin;
  const spacing = nesting.spacing;

  const countX = result.bestOrientation === 'normal' ? result.normalCountX : result.rotatedCountX;
  const countY = result.bestOrientation === 'normal' ? result.normalCountY : result.rotatedCountY;
  const isRot = result.bestOrientation === 'rotated';

  const itemW = isRot ? geo.height : geo.width;
  const itemH = isRot ? geo.width : geo.height;

  let itemsSvg = '';
  const itemInner = geo.svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '');

  for (let r = 0; r < countY; r++) {
    for (let c = 0; c < countX; c++) {
      const posX = margin + c * (itemW + spacing);
      const posY = margin + r * (itemH + spacing);

      if (isRot) {
        itemsSvg += `<g transform="translate(${posX.toFixed(2)}, ${(posY + itemH).toFixed(2)}) rotate(-90)">\n${itemInner}\n</g>\n`;
      } else {
        itemsSvg += `<g transform="translate(${posX.toFixed(2)}, ${posY.toFixed(2)})">\n${itemInner}\n</g>\n`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sheetW} ${sheetH}" width="${sheetW}mm" height="${sheetH}mm">
    <!-- Sheet Boundary -->
    <rect x="0" y="0" width="${sheetW}" height="${sheetH}" fill="#ffffff" stroke="#94a3b8" stroke-width="0.5" />
    <!-- Margin Boundary -->
    <rect x="${margin}" y="${margin}" width="${sheetW - margin * 2}" height="${sheetH - margin * 2}" fill="none" stroke="#cbd5e1" stroke-width="0.3" stroke-dasharray="3,3" />
    <!-- Nested Items -->
    ${itemsSvg}
  </svg>`;
}

export function downloadGable_Box_1SheetSvg(
  dims: Gable_Box_1Dimensions,
  nesting: Gable_Box_1NestingParams
): void {
  const svgStr = buildGable_Box_1SheetSvg(dims, nesting);
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Gable_Box_1_Sheet_${nesting.sheetWidth}x${nesting.sheetHeight}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportGable_Box_1SheetPdf(
  dims: Gable_Box_1Dimensions,
  sheetW: number,
  sheetH: number,
  margin: number,
  spacing: number
): Promise<void> {
  const nesting: Gable_Box_1NestingParams = { sheetWidth: sheetW, sheetHeight: sheetH, margin, spacing };
  const svgStr = buildGable_Box_1SheetSvg(dims, nesting);

  const pdf = new jsPDF({
    orientation: sheetW > sheetH ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [sheetW, sheetH],
  });

  const parser = new DOMParser();
  const svgElem = parser.parseFromString(svgStr, 'image/svg+xml').documentElement;

  await pdf.svg(svgElem, {
    x: 0,
    y: 0,
    width: sheetW,
    height: sheetH,
  });

  pdf.save(`Gable_Box_1_Sheet_${sheetW}x${sheetH}.pdf`);
}
