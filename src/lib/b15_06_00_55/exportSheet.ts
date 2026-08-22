// B15_06_00_55 — Export Sheet Layout to SVG and PDF

import type { B15_06_00_55Params } from './types';
import type { B15_06_00_55NestingParams, B15_06_00_55NestingResult } from './nesting';
import { buildB15_06_00_55Geometry } from './geometry';
import jsPDF from 'jspdf';
import 'svg2pdf.js';

export function buildB15_06_00_55SheetLayoutSvg(
  params: B15_06_00_55Params,
  nesting: B15_06_00_55NestingParams,
  result: B15_06_00_55NestingResult,
): string {
  const geo = buildB15_06_00_55Geometry(params);
  const sheetW = params.sheetWidth;
  const sheetH = params.sheetHeight;
  const margin = params.sheetMargin;
  const gripper = params.gripper;

  const usableX = margin;
  const usableY = margin + gripper;

  const orientation = result.bestOrientation;
  const grid = orientation === 'rotated' ? result.rotated : result.normal;
  const tW = geo.bbox.w;
  const tH = geo.bbox.h;

  const CUT_COLOR = '#ED1C24';
  const CREASE_COLOR = '#00A651';

  let itemsSvg = '';
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.columns; c++) {
      const x = usableX + c * grid.pitchX;
      const y = usableY + r * grid.pitchY;
      const transform =
        orientation === 'rotated' ? `translate(${x + tH} ${y}) rotate(90)` : `translate(${x} ${y})`;

      const paths = geo.segments
        .map(s => {
          const stroke = s.kind === 'CREASE' ? CREASE_COLOR : CUT_COLOR;
          const dash = s.kind === 'CREASE' ? 'stroke-dasharray="3,2"' : '';
          return `<path d="${s.d}" stroke="${stroke}" stroke-width="0.35" fill="none" ${dash}/>`;
        })
        .join('');

      itemsSvg += `<g transform="${transform}">${paths}</g>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sheetW} ${sheetH}" width="${sheetW}mm" height="${sheetH}mm">
    <rect x="0" y="0" width="${sheetW}" height="${sheetH}" fill="#ffffff" stroke="#111827" stroke-width="0.5"/>
    <rect x="${margin}" y="${margin + gripper}" width="${sheetW - 2 * margin}" height="${sheetH - 2 * margin - gripper}" fill="none" stroke="#3b82f6" stroke-width="0.3" stroke-dasharray="2,2"/>
    ${itemsSvg}
  </svg>`;
}

export function downloadB15_06_00_55SheetLayout(
  params: B15_06_00_55Params,
  nesting: B15_06_00_55NestingParams,
  result: B15_06_00_55NestingResult,
): void {
  const svg = buildB15_06_00_55SheetLayoutSvg(params, nesting, result);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `B15_06_00_55_Sheet_${params.sheetWidth}x${params.sheetHeight}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadB15_06_00_55SheetLayoutPdf(
  params: B15_06_00_55Params,
  nesting: B15_06_00_55NestingParams,
  result: B15_06_00_55NestingResult,
): Promise<void> {
  const svg = buildB15_06_00_55SheetLayoutSvg(params, nesting, result);
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, 'image/svg+xml');
  const svgElement = doc.documentElement as unknown as SVGElement;

  const pdf = new jsPDF({
    orientation: params.sheetWidth > params.sheetHeight ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [params.sheetWidth, params.sheetHeight],
  });

  await pdf.svg(svgElement, {
    x: 0,
    y: 0,
    width: params.sheetWidth,
    height: params.sheetHeight,
  });

  pdf.save(`B15_06_00_55_Sheet_${params.sheetWidth}x${params.sheetHeight}.pdf`);
}
