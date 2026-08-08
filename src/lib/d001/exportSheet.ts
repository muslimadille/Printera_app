// D001 — Export Sheet Layout SVG
// Emits the full sheet with all nested templates, matching the preview EXACTLY
// (same orientation / pitch / rowBrickDx / brickPhase / edge-clamp as
// `D001SheetNestingPreview`). Two layers only:
//   - CREASE (#00A651): all CREASE lines for every placed template
//   - CUT    (#ED1C24): all OUTER + CUT lines (no separate OUTER layer)
// No <use>, <symbol>, <clipPath>, <foreignObject>, raster, or transform=scale.

import type { D001Params } from './types';
import { usableSheet } from './types';
import { buildD001Geometry, type Segment } from './geometry';
import type { D001NestingParams, D001NestingResult } from './nesting';
import { computeD001Nesting } from './nesting';

const CUT_COLOR = '#ED1C24';
const CREASE_COLOR = '#00A651';
const r = (n: number) => Math.round(n * 100000) / 100000;

function renderSeg(s: Segment): string {
  if (s.geometry === 'fillet' && s.via && s.bezier) {
    return `<path d="M${s.start.x},${s.start.y} L${s.via.x},${s.via.y} C${s.bezier.c1.x},${s.bezier.c1.y} ${s.bezier.c2.x},${s.bezier.c2.y} ${s.end.x},${s.end.y}" data-id="${s.svgId}"/>`;
  }
  if (s.geometry === 'bezier' && s.bezier) {
    return `<path d="M${s.start.x},${s.start.y} C${s.bezier.c1.x},${s.bezier.c1.y} ${s.bezier.c2.x},${s.bezier.c2.y} ${s.end.x},${s.end.y}" data-id="${s.svgId}"/>`;
  }
  if (s.geometry === 'polyline' && s.points && s.points.length >= 2) {
    const pts = s.points.map(p => `${p.x},${p.y}`).join(' ');
    return `<polyline points="${pts}" data-id="${s.svgId}"/>`;
  }
  if (s.start.x === s.end.x && s.start.y === s.end.y) return '';
  return `<line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}" data-id="${s.svgId}"/>`;
}

export interface D001SheetExport {
  svg: string;
  filename: string;
  total: number;
}

export function buildD001SheetLayoutSvg(
  params: D001Params,
  nesting: D001NestingParams,
  resultIn?: D001NestingResult,
): D001SheetExport {
  const result = resultIn ?? computeD001Nesting(params, nesting);
  const geo = buildD001Geometry(params);
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
  const brickDx = grid.rowBrickDx ?? 0;
  const brickPhase: 0 | 1 = (grid as { brickPhase?: 0 | 1 }).brickPhase ?? 1;
  const perRowCols = grid.perRowCols && grid.perRowCols.length === grid.rows
    ? grid.perRowCols
    : new Array(grid.rows).fill(grid.columns);

  const creaseSegs = geo.segments.filter(s => s.kind === 'CREASE');
  const cutSegs = geo.segments
    .filter(s => s.kind === 'OUTER' || s.kind === 'CUT')
    .slice()
    .sort((a, b) => a.id - b.id);

  const creaseInner = creaseSegs.map(renderSeg).filter(Boolean).join('\n      ');
  const cutInner = cutSegs.map(renderSeg).filter(Boolean).join('\n      ');

  const placements: { x: number; y: number }[] = [];
  for (let row = 0; row < grid.rows; row++) {
    const shifted = (row % 2) === brickPhase;
    const rawOffset = shifted ? brickDx : 0;
    const startX = Math.max(0, Math.min(usable.width - cellW, rawOffset));
    const cols = perRowCols[row] ?? 0;
    for (let c = 0; c < cols; c++) {
      placements.push({
        x: usableX + startX + c * pitchX,
        y: usableY + row * pitchY,
      });
    }
  }

  const creasePieces: string[] = [];
  const cutPieces: string[] = [];
  for (const p of placements) {
    const transform = orientation === 'rotated'
      ? `translate(${r(p.x + tH)} ${r(p.y)}) rotate(90)`
      : `translate(${r(p.x)} ${r(p.y)})`;
    creasePieces.push(`    <g transform="${transform}">\n      ${creaseInner}\n    </g>`);
    cutPieces.push(`    <g transform="${transform}">\n      ${cutInner}\n    </g>`);
  }

  const out: string[] = [];
  out.push(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>`);
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" version="1.1" width="${sheetW}mm" height="${sheetH}mm" viewBox="0 0 ${sheetW} ${sheetH}">`,
  );

  out.push(`  <g id="CREASE" inkscape:label="CREASE" fill="none" stroke="${CREASE_COLOR}" stroke-width="0.45" stroke-miterlimit="10">`);
  if (creasePieces.length) out.push(creasePieces.join('\n'));
  out.push(`  </g>`);

  out.push(`  <g id="CUT" inkscape:label="CUT" fill="none" stroke="${CUT_COLOR}" stroke-width="0.45" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10">`);
  if (cutPieces.length) out.push(cutPieces.join('\n'));
  out.push(`  </g>`);

  out.push(`</svg>`);

  const filename = `D001-sheet-layout-W${sheetW}-H${sheetH}-QTY${result.bestTotal}.svg`;
  return { svg: out.join('\n'), filename, total: result.bestTotal };
}

export function downloadD001SheetLayout(
  params: D001Params,
  nesting: D001NestingParams,
  result?: D001NestingResult,
): void {
  const { svg, filename } = buildD001SheetLayoutSvg(params, nesting, result);
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

export async function buildD001SheetLayoutPdf(
  params: D001Params,
  nesting: D001NestingParams,
  result?: D001NestingResult,
) {
  const { svg, filename: svgFilename } = buildD001SheetLayoutSvg(params, nesting, result);
  const filename = svgFilename.replace(/\.svg$/, '.pdf');
  const { generatePdfFromSvg } = await import('@/lib/pdf/pdfService');
  const pdf = await generatePdfFromSvg(svg);
  return { pdf, filename };
}

export async function downloadD001SheetLayoutPdf(
  params: D001Params,
  nesting: D001NestingParams,
  result?: D001NestingResult,
): Promise<void> {
  const { downloadPdf } = await import('@/lib/pdf/pdfService');
  const { pdf, filename } = await buildD001SheetLayoutPdf(params, nesting, result);
  downloadPdf(pdf, filename);
}

export async function previewD001SheetLayoutPdf(
  params: D001Params,
  nesting: D001NestingParams,
  result?: D001NestingResult,
): Promise<void> {
  const { previewPdf } = await import('@/lib/pdf/pdfService');
  const { pdf, filename } = await buildD001SheetLayoutPdf(params, nesting, result);
  await previewPdf(pdf, filename);
}
