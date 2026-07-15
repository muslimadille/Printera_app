// T00012 — Export Sheet Layout SVG
// Emits the full sheet with all nested templates, matching the preview EXACTLY
// (same orientation / pitch / rowBrickDx / brickPhase / edge-clamp as
// `T00012SheetNestingPreview`). Two layers only:
//   - CREASE (#00A651): all CREASE lines for every placed template
//   - CUT    (#ED1C24): all OUTER + CUT lines (no separate OUTER layer)
// No <use>, <symbol>, <clipPath>, <foreignObject>, raster, or transform=scale.

import type { T00012Params } from './types';
import { usableSheet } from './types';
import { buildT00012Geometry, type Segment } from './geometry';
import type { T00012NestingParams, T00012NestingResult } from './nesting';
import { computeT00012Nesting } from './nesting';

const CUT_COLOR = '#ED1C24';
const CREASE_COLOR = '#00A651';
const r = (n: number) => Math.round(n * 100000) / 100000;

function renderSeg(s: any): string {
  if (s.d) {
    return `<path d="${s.d}" data-id="${s.svgId || ''}"/>`;
  }
  if (s.start.x === s.end.x && s.start.y === s.end.y) return '';
  return `<line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}" data-id="${s.svgId || ''}"/>`;
}

export interface T00012SheetExport {
  svg: string;
  filename: string;
  total: number;
}

export function buildT00012SheetLayoutSvg(
  params: T00012Params,
  nesting: T00012NestingParams,
  resultIn?: T00012NestingResult,
): T00012SheetExport {
  const result = resultIn ?? computeT00012Nesting(params, nesting);
  const geo = buildT00012Geometry(params);
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

  out.push(`  <g id="CREASE" inkscape:label="CREASE" fill="none" stroke="${CREASE_COLOR}" stroke-miterlimit="10">`);
  if (creasePieces.length) out.push(creasePieces.join('\n'));
  out.push(`  </g>`);

  out.push(`  <g id="CUT" inkscape:label="CUT" fill="none" stroke="${CUT_COLOR}" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10">`);
  if (cutPieces.length) out.push(cutPieces.join('\n'));
  out.push(`  </g>`);

  out.push(`</svg>`);

  const filename = `T00012-sheet-layout-W${sheetW}-H${sheetH}-QTY${result.bestTotal}.svg`;
  return { svg: out.join('\n'), filename, total: result.bestTotal };
}

export function downloadT00012SheetLayout(
  params: T00012Params,
  nesting: T00012NestingParams,
  result?: T00012NestingResult,
): void {
  const { svg, filename } = buildT00012SheetLayoutSvg(params, nesting, result);
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

export async function downloadT00012SheetLayoutPdf(
  params: T00012Params,
  nesting: T00012NestingParams,
  result?: T00012NestingResult,
): Promise<void> {
  const { svg, filename: svgFilename } = buildT00012SheetLayoutSvg(params, nesting, result);
  const filename = svgFilename.replace(/\.svg$/, '.pdf');

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-100000px';
  host.style.top = '0';
  host.style.visibility = 'hidden';
  host.innerHTML = svg;
  const svgEl = host.querySelector('svg') as SVGSVGElement | null;
  if (!svgEl) throw new Error('T00012 Sheet PDF export: failed to parse SVG.');
  document.body.appendChild(host);

  const vb = (svgEl.getAttribute("viewBox") || "0 0 0 0").split(/\s+/).map(Number);
  const pageW = vb[2] || 1;
  const pageH = vb[3] || 1;

  try {
    const [{ jsPDF }, { svg2pdf }] = await Promise.all([
      import('jspdf'),
      import('svg2pdf.js'),
    ]);
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
