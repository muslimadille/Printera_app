import { F10_41_00_00Dimensions, F10_41_00_00NestingParams } from './types';
import { generateF10_41_00_00SheetSvg } from './nesting';

export function getF10_41_00_00SheetSvg(
  dims: F10_41_00_00Dimensions,
  sheetWidth: number,
  sheetHeight: number,
  sheetMargin: number,
  itemSpacing: number,
  gripper: number = 0
): string {
  return generateF10_41_00_00SheetSvg(dims, {
    sheetWidth,
    sheetHeight,
    margin: sheetMargin,
    spacing: itemSpacing,
    gripper,
  });
}

export function downloadF10_41_00_00SheetSvg(
  dims: F10_41_00_00Dimensions,
  nesting: F10_41_00_00NestingParams,
  filename: string = 'F10_41_00_00_Sheet.svg'
) {
  const svgStr = generateF10_41_00_00SheetSvg(dims, nesting);
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

export async function exportF10_41_00_00SheetPdf(
  dims: F10_41_00_00Dimensions,
  sheetWidth: number,
  sheetHeight: number,
  sheetMargin: number,
  itemSpacing: number,
  filename: string = 'F10_41_00_00_Sheet.pdf'
) {
  const { default: jsPDF } = await import('jspdf');
  await import('svg2pdf.js');

  const svgString = generateF10_41_00_00SheetSvg(dims, {
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
