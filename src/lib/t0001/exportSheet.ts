// T0001 — Export Sheet Layout SVG and PDF
// Emits the full sheet with all nested templates, matching the preview EXACTLY

import type { T0001Params } from './types';
import { usableSheet } from './types';
import { buildT0001Geometry } from './geometry';
import type { Segment } from './geometry';
import type { T0001NestingParams, T0001NestingResult } from './nesting';
import { computeT0001Nesting } from './nesting';

const CUT_COLOR = '#ED1C24';
const SLOT_COLOR = '#2028B0';
const CREASE_COLOR = '#00A651';
const r = (n: number) => Math.round(n * 100000) / 100000;

function renderSeg(s: Segment): string {
  if (s.geometry === "line") {
    if (s.start.x === s.end.x && s.start.y === s.end.y) return "";
    return `<line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}" data-id="${s.svgId}"/>`;
  }
  if (s.geometry === "polyline" && s.points) {
    const pts = s.points.map(p => `${p.x},${p.y}`).join(" ");
    return `<polyline points="${pts}" data-id="${s.svgId}"/>`;
  }
  if (s.geometry === "bezier" && s.bezier) {
    return `<path d="M${s.start.x},${s.start.y} C${s.bezier.c1.x},${s.bezier.c1.y} ${s.bezier.c2.x},${s.bezier.c2.y} ${s.end.x},${s.end.y}" data-id="${s.svgId}"/>`;
  }
  if (s.geometry === "arc" && s.arc) {
    return `<path d="M ${s.start.x},${s.start.y} A ${s.arc.rx} ${s.arc.ry} ${s.arc.xar} ${s.arc.laf} ${s.arc.sf} ${s.end.x},${s.end.y}" data-id="${s.svgId}"/>`;
  }
  return "";
}

export interface T0001SheetExport {
  svg: string;
  filename: string;
  total: number;
}

export function buildT0001SheetLayoutSvg(
  params: T0001Params,
  nesting: T0001NestingParams,
  resultIn?: T0001NestingResult,
): T0001SheetExport {
  const result = resultIn ?? computeT0001Nesting(params, nesting);
  const geo = buildT0001Geometry(params);
  const usable = usableSheet(params);

  const sheetW = r(Math.max(1, params.sheetWidth));
  const sheetH = r(Math.max(1, params.sheetHeight));
  const margin = Math.max(0, params.sheetMargin);
  const gripper = Math.max(0, params.gripper);

  const usableX = margin;
  const usableY = margin + gripper;

  const orientation = result.bestOrientation;
  const grid = orientation === 'rotated' ? result.rotated : result.normal;
  const tW = geo.bbox.w;
  const tH = geo.bbox.h;
  const cellW = orientation === 'rotated' ? tH : tW;
  const pitchX = grid.pitchX;
  const pitchY = grid.pitchY;

  const creaseSegs = geo.segments.filter(s => s.kind === 'CREASE');
  const outerSegs = geo.segments.filter(s => s.kind === 'OUTER');
  const innerSegs = geo.segments.filter(s => s.kind === 'CUT');

  const creaseInner = creaseSegs.map(renderSeg).filter(Boolean).join('\n      ');
  const outerInner = outerSegs.map(renderSeg).filter(Boolean).join('\n      ');
  const innerInner = innerSegs.map(renderSeg).filter(Boolean).join('\n      ');

  const placements: { x: number; y: number }[] = [];
  for (let row = 0; row < grid.rows; row++) {
    const startX = 0;
    const cols = grid.perRowCols[row] ?? 0;
    for (let c = 0; c < cols; c++) {
      placements.push({
        x: usableX + startX + c * pitchX,
        y: usableY + row * pitchY,
      });
    }
  }

  const creasePieces: string[] = [];
  const outerPieces: string[] = [];
  const innerPieces: string[] = [];
  
  for (const p of placements) {
    const transform = orientation === 'rotated'
      ? `translate(${r(p.x + tH)} ${r(p.y)}) rotate(90)`
      : `translate(${r(p.x)} ${r(p.y)})`;
      
    creasePieces.push(`    <g transform="${transform}">\n      ${creaseInner}\n    </g>`);
    outerPieces.push(`    <g transform="${transform}">\n      ${outerInner}\n    </g>`);
    innerPieces.push(`    <g transform="${transform}">\n      ${innerInner}\n    </g>`);
  }

  const out: string[] = [];
  out.push(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>`);
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" version="1.1" width="${sheetW}mm" height="${sheetH}mm" viewBox="0 0 ${sheetW} ${sheetH}">`,
  );

  // Crease layer
  out.push(`  <g id="CREASE" inkscape:label="CREASE" fill="none" stroke="${CREASE_COLOR}" stroke-width="0.45" stroke-miterlimit="10">`);
  if (creasePieces.length) out.push(creasePieces.join('\n'));
  out.push(`  </g>`);

  // Cut layer
  out.push(`  <g id="CUT" inkscape:label="CUT" fill="none" stroke-width="0.45" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10">`);
  
  // Outer cut contour sub-group
  out.push(`    <g id="OUTER_CUT_CONTOUR" inkscape:label="OUTER CUT CONTOUR" stroke="${CUT_COLOR}">`);
  if (outerPieces.length) out.push(outerPieces.join('\n'));
  out.push(`    </g>`);

  // Inner cuts sub-group
  out.push(`    <g id="INNER_CUTS" inkscape:label="INNER CUTS" stroke="${SLOT_COLOR}">`);
  if (innerPieces.length) out.push(innerPieces.join('\n'));
  out.push(`    </g>`);

  out.push(`  </g>`);
  out.push(`</svg>`);

  const filename = `T0001-sheet-layout-W${sheetW}-H${sheetH}-QTY${result.bestTotal}.svg`;
  return { svg: out.join('\n'), filename, total: result.bestTotal };
}

export function downloadT0001SheetLayout(
  params: T0001Params,
  nesting: T0001NestingParams,
  result?: T0001NestingResult,
): void {
  const { svg, filename } = buildT0001SheetLayoutSvg(params, nesting, result);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function buildT0001SheetLayoutPdf(
  params: T0001Params,
  nesting: T0001NestingParams,
  result?: T0001NestingResult,
) {
  const { svg, filename: svgFilename } = buildT0001SheetLayoutSvg(params, nesting, result);
  const filename = svgFilename.replace(/\.svg$/, '.pdf');
  const { generatePdfFromSvg } = await import('@/lib/pdf/pdfService');
  const pdf = await generatePdfFromSvg(svg);
  return { pdf, filename };
}

export async function downloadT0001SheetLayoutPdf(
  params: T0001Params,
  nesting: T0001NestingParams,
  result?: T0001NestingResult,
): Promise<void> {
  const { downloadPdf } = await import('@/lib/pdf/pdfService');
  const { pdf, filename } = await buildT0001SheetLayoutPdf(params, nesting, result);
  downloadPdf(pdf, filename);
}

export async function previewT0001SheetLayoutPdf(
  params: T0001Params,
  nesting: T0001NestingParams,
  result?: T0001NestingResult,
): Promise<void> {
  const { previewPdf } = await import('@/lib/pdf/pdfService');
  const { pdf, filename } = await buildT0001SheetLayoutPdf(params, nesting, result);
  await previewPdf(pdf, filename);
}
