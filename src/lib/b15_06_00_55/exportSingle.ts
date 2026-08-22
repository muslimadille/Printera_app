// B15_06_00_55 — Export Single Template to SVG and PDF

import type { B15_06_00_55Geometry } from './types';
import jsPDF from 'jspdf';
import 'svg2pdf.js';

export function buildB15_06_00_55SingleTemplateSvg(geo: B15_06_00_55Geometry): string {
  return geo.svg;
}

export function downloadB15_06_00_55SingleTemplate(geo: B15_06_00_55Geometry, filename: string): void {
  const blob = new Blob([geo.svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadB15_06_00_55SingleTemplatePdf(svgString: string, filename: string): Promise<void> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgElement = doc.documentElement as unknown as SVGElement;

  const width = parseFloat(svgElement.getAttribute('viewBox')?.split(' ')[2] || '900');
  const height = parseFloat(svgElement.getAttribute('viewBox')?.split(' ')[3] || '650');

  const pdf = new jsPDF({
    orientation: width > height ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [width, height],
  });

  await pdf.svg(svgElement, {
    x: 0,
    y: 0,
    width,
    height,
  });

  pdf.save(filename);
}
