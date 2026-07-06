/**
 * Carrying Handle Box — PDF Export.
 *
 * Renders the EXACT same SVG produced by buildCarryExportSvg() to a vector PDF.
 * The SVG is the single source of truth; this module only re-wraps that
 * geometry into a PDF document. No new geometry, no recompute, no mapping.
 *
 * Implementation: svg2pdf.js draws the live SVG DOM into a jsPDF document at
 * 1:1 mm scale, preserving strokes/dashes/fill-none for CUT/CREASE/HOLES.
 */
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import { buildCarryExportSvg, type CarryExportMode } from './carryingHandleBoxExport';
import type { CarryHandleInputs, CarryResult } from './carryingHandleBoxEngine';

interface Args {
  mode: CarryExportMode;
  inputs: CarryHandleInputs;
  result: CarryResult;
}

export async function exportCarryAsPdf(
  { mode, inputs, result }: Args,
  filename: string,
): Promise<void> {
  const svgMarkup = buildCarryExportSvg({ mode, inputs, result });

  const flip = result.best.flipSheet;
  const pageW = flip ? inputs.sheetHeight : inputs.sheetWidth;
  const pageH = flip ? inputs.sheetWidth : inputs.sheetHeight;

  // Parse SVG into a live DOM element (svg2pdf needs a real element).
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-100000px';
  host.style.top = '0';
  host.style.visibility = 'hidden';
  host.innerHTML = svgMarkup;
  const svgEl = host.querySelector('svg') as SVGSVGElement | null;
  if (!svgEl) throw new Error('Carry PDF export: failed to parse SVG.');
  document.body.appendChild(host);

  try {
    const pdf = new jsPDF({
      unit: 'mm',
      format: [pageW, pageH],
      orientation: pageW >= pageH ? 'landscape' : 'portrait',
      compress: true,
    });
    await svg2pdf(svgEl, pdf, { x: 0, y: 0, width: pageW, height: pageH });
    pdf.save(filename);
  } finally {
    document.body.removeChild(host);
  }
}
