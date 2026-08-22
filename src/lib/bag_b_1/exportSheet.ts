import { Bag_B_1Dimensions } from './types';
import { Bag_B_1NestingParams, generateBag_B_1SheetSvg, computeBag_B_1Nesting } from './nesting';

export function getBag_B_1SheetSvg(
  dims: Bag_B_1Dimensions,
  sheetWidth: number,
  sheetHeight: number,
  sheetMargin: number,
  itemSpacing: number,
  gripper: number = 0
): string {
  return generateBag_B_1SheetSvg(dims, {
    sheetWidth,
    sheetHeight,
    margin: sheetMargin,
    spacing: itemSpacing,
    gripper,
  });
}

export function downloadBag_B_1SheetSvg(
  dims: Bag_B_1Dimensions,
  nesting: Bag_B_1NestingParams,
  filename: string = 'Bag_B_1_Sheet.svg'
) {
  const svgStr = generateBag_B_1SheetSvg(dims, nesting);
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportBag_B_1SheetPdf(
  dims: Bag_B_1Dimensions,
  sheetWidth: number,
  sheetHeight: number,
  sheetMargin: number,
  itemSpacing: number,
  filename: string = 'Bag_B_1_Sheet.pdf'
) {
  const { default: jsPDF } = await import('jspdf');
  await import('svg2pdf.js');

  const svgString = generateBag_B_1SheetSvg(dims, {
    sheetWidth,
    sheetHeight,
    margin: sheetMargin,
    spacing: itemSpacing,
  });

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgElement = doc.documentElement as unknown as SVGElement;

  const pdf = new jsPDF({
    orientation: sheetWidth > sheetHeight ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [sheetWidth, sheetHeight],
  });

  await pdf.svg(svgElement, {
    x: 0,
    y: 0,
    width: sheetWidth,
    height: sheetHeight,
  });

  pdf.save(filename);
}
