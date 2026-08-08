/**
 * Carrying Handle Box — PDF Export.
 *
 * Renders the EXACT same SVG produced by buildCarryExportSvg() to a vector PDF.
 * Routes through the shared pdfService (preview stream / download).
 */
import { jsPDF } from 'jspdf';
import { buildCarryExportSvg, type CarryExportMode } from './carryingHandleBoxExport';
import type { CarryHandleInputs, CarryResult } from './carryingHandleBoxEngine';
import { downloadPdf, generatePdfFromSvg } from '@/lib/pdf/pdfService';

interface Args {
  mode: CarryExportMode;
  inputs: CarryHandleInputs;
  result: CarryResult;
}

export async function buildCarryAsPdf(
  { mode, inputs, result }: Args,
): Promise<jsPDF> {
  const svgMarkup = buildCarryExportSvg({ mode, inputs, result });

  const flip = result.best.flipSheet;
  const pageW = flip ? inputs.sheetHeight : inputs.sheetWidth;
  const pageH = flip ? inputs.sheetWidth : inputs.sheetHeight;

  return generatePdfFromSvg(svgMarkup, { widthMm: pageW, heightMm: pageH });
}

export async function exportCarryAsPdf(
  args: Args,
  filename: string,
): Promise<jsPDF> {
  const pdf = await buildCarryAsPdf(args);
  downloadPdf(pdf, filename);
  return pdf;
}
