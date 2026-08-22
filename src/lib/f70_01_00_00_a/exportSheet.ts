// F70_01_00_00_A — Export Sheet Layout SVG & PDF

import type { F70_01_00_00_AParams } from './types';
import { buildF70_01_00_00_AGeometry } from './geometry';
import type { F70_01_00_00_ANestingParams, F70_01_00_00_ANestingResult } from './nesting';
import { computeF70_01_00_00_ANesting } from './nesting';
import type { Segment } from '@/components/InteractiveSvgCanvas';

const CUT_COLOR = '#ED1C24';
const CREASE_COLOR = '#00A651';
const r = (n: number) => Math.round(n * 10000) / 10000;

export interface F70_01_00_00_ASheetExport {
  svg: string;
  filename: string;
  total: number;
}

function renderSegShifted(s: Segment, offsetX: number, offsetY: number, defaultColor: string): string {
  const stroke = s.strokeColor || defaultColor;
  const dash = s.kind === 'CREASE' ? 'stroke-dasharray="3,2"' : '';

  if (s.d) {
    return `      <g transform="translate(${r(offsetX)}, ${r(offsetY)})">\n        <path d="${s.d}" stroke="${stroke}" stroke-width="0.45" fill="none" data-id="${s.svgId}"/>\n      </g>`;
  }
  if (s.points && s.points.length >= 2) {
    const ptsStr = s.points.map(p => `${r(p.x + offsetX)},${r(p.y + offsetY)}`).join(' ');
    return `      <polyline points="${ptsStr}" stroke="${stroke}" stroke-width="0.45" fill="none" ${dash} data-id="${s.svgId}"/>`;
  }
  const x1 = r(s.start.x + offsetX);
  const y1 = r(s.start.y + offsetY);
  const x2 = r(s.end.x + offsetX);
  const y2 = r(s.end.y + offsetY);
  if (x1 === x2 && y1 === y2) return '';
  return `      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="0.45" fill="none" ${dash} data-id="${s.svgId}"/>`;
}

export function buildF70_01_00_00_ASheetLayoutSvg(
  params: F70_01_00_00_AParams,
  nesting: F70_01_00_00_ANestingParams,
  resultIn?: F70_01_00_00_ANestingResult
): F70_01_00_00_ASheetExport {
  const result = resultIn ?? computeF70_01_00_00_ANesting(params, nesting);
  const geo = buildF70_01_00_00_AGeometry(params);

  const sheetW = r(params.sheetWidth);
  const sheetH = r(params.sheetHeight);

  const creaseElements: string[] = [];
  const cutElements: string[] = [];

  const orientation = result.bestOrientation;
  const grid = orientation === 'rotated' ? result.rotated : result.normal;

  for (let rIdx = 0; rIdx < grid.rows; rIdx++) {
    for (let cIdx = 0; cIdx < grid.columns; cIdx++) {
      const offsetX = params.sheetMargin + cIdx * grid.pitchX;
      const offsetY = params.sheetMargin + params.gripper + rIdx * grid.pitchY;

      for (const seg of geo.segments) {
        if (seg.kind === 'CREASE') {
          const el = renderSegShifted(seg, offsetX, offsetY, CREASE_COLOR);
          if (el) creaseElements.push(el);
        } else {
          const el = renderSegShifted(seg, offsetX, offsetY, CUT_COLOR);
          if (el) cutElements.push(el);
        }
      }
    }
  }

  const out: string[] = [];
  out.push(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>`);
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" version="1.1" width="${sheetW}mm" height="${sheetH}mm" viewBox="0 0 ${sheetW} ${sheetH}">`);
  out.push(`  <g id="CREASE" inkscape:label="CREASE" fill="none" stroke="${CREASE_COLOR}" stroke-width="0.35" stroke-miterlimit="10">`);
  out.push(creaseElements.join('\n'));
  out.push(`  </g>`);
  out.push(`  <g id="CUT" inkscape:label="CUT" fill="none" stroke="${CUT_COLOR}" stroke-width="0.45" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10">`);
  out.push(cutElements.join('\n'));
  out.push(`  </g>`);
  out.push(`</svg>`);

  return {
    svg: out.join('\n'),
    filename: `F70_01_00_00_A_Sheet_${sheetW}x${sheetH}mm.svg`,
    total: result.total,
  };
}

export function downloadF70_01_00_00_ASheetLayout(
  params: F70_01_00_00_AParams,
  nesting: F70_01_00_00_ANestingParams,
  resultIn?: F70_01_00_00_ANestingResult,
) {
  const { svg, filename } = buildF70_01_00_00_ASheetLayoutSvg(params, nesting, resultIn);
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

export async function downloadF70_01_00_00_ASheetLayoutPdf(
  params: F70_01_00_00_AParams,
  nesting: F70_01_00_00_ANestingParams,
  resultIn?: F70_01_00_00_ANestingResult,
) {
  const { svg } = buildF70_01_00_00_ASheetLayoutSvg(params, nesting, resultIn);
  const filename = `F70_01_00_00_A_Sheet_${params.sheetWidth}x${params.sheetHeight}mm.pdf`;

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-100000px';
  host.style.top = '0';
  host.style.visibility = 'hidden';
  host.innerHTML = svg;
  const svgEl = host.querySelector('svg') as SVGSVGElement | null;
  if (!svgEl) throw new Error('F70_01_00_00_A PDF export: failed to parse SVG.');
  document.body.appendChild(host);

  const vb = (svgEl.getAttribute('viewBox') || '0 0 0 0').split(/\s+/).map(Number);
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
