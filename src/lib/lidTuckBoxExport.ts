/**
 * Lid Tuck Box v1 — Phase-1 inline SVG export.
 *
 * Only inline SVG download. No PDF, DXF, Illustrator-specific output, no
 * SheetLayout, no nesting. The exported SVG is byte-identical in geometry to
 * what LidTuckBoxPreview renders ("Preview = Export numeric geometry").
 */

import type { LidTuckBoxGeometry } from './lidTuckBoxEngine';

const fmt = (n: number) => (Math.round(n * 1000) / 1000).toString();

export function buildLidTuckBoxSvgString(g: LidTuckBoxGeometry): string {
  const w = fmt(g.flatWidth);
  const h = fmt(g.flatHeight);

  const creaseLines = g.creaseLines
    .map(
      c =>
        `    <line x1="${fmt(c.from[0])}" y1="${fmt(c.from[1])}" x2="${fmt(
          c.to[0],
        )}" y2="${fmt(c.to[1])}" data-id="${c.id}" />`,
    )
    .join('\n');

  const cutSubPaths = g.cutPaths
    .map(p => `    <path d="${p.d}" data-id="${p.id}" />`)
    .join('\n');

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">`,
    `  <title>lid-tuck-box-v1 L=${g.inputs.L} D=${g.inputs.D} H=${g.inputs.H}</title>`,
    `  <g id="CUT" fill="none" stroke="#e11d48" stroke-width="0.2">`,
    `    <path d="${g.outerContour.d}" data-id="${g.outerContour.id}" />`,
    cutSubPaths,
    `  </g>`,
    `  <g id="CREASE" fill="none" stroke="#2563eb" stroke-width="0.15" stroke-dasharray="1.5,1">`,
    creaseLines,
    `  </g>`,
    `</svg>`,
  ].join('\n');
}

export function downloadLidTuckBoxSvg(g: LidTuckBoxGeometry): void {
  const svg = buildLidTuckBoxSvgString(g);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lid-tuck-box-v1_L${g.inputs.L}_D${g.inputs.D}_H${g.inputs.H}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
