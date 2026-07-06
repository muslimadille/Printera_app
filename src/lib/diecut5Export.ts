/**
 * Die Cut 5 — Export Builder
 * ─────────────────────────────────────────────────────────────────────────
 * Uses buildDieline5Svg (same builder as the preview) → guarantees
 * Visible Geometry === Export Geometry. No grid slicing, no <image> hacks.
 * Each piece on the sheet is one <use> of the dieline symbol whose
 * viewBox equals the current footprint.
 */

import {
  buildDieline5Svg,
  type DieCut5Inputs,
  type DieCut5Result,
} from './diecut5Engine';

export type DieCut5ExportMode = 'svg-only' | 'svg-with-info';

export interface BuildArgs {
  mode: DieCut5ExportMode;
  inputs: DieCut5Inputs;
  result: DieCut5Result;
}

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function extractInner(svgMarkup: string): { inner: string; viewBox: string } {
  const vbM = svgMarkup.match(/viewBox\s*=\s*"([^"]+)"/i);
  const viewBox = vbM ? vbM[1] : '0 0 100 100';
  const inner = svgMarkup
    .replace(/[\s\S]*?<svg[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '');
  return { inner, viewBox };
}

export function buildDieCut5ExportSvg({ mode, inputs, result }: BuildArgs): string {
  const sheetW = inputs.sheetWidth;
  const sheetH = inputs.sheetHeight;
  const longHoriz = sheetW >= sheetH;
  const renderW = longHoriz ? result.longSide : result.shortSide;
  const renderH = longHoriz ? result.shortSide : result.longSide;

  const dieline = buildDieline5Svg(inputs, { filled: false });
  const { inner, viewBox } = extractInner(dieline);

  const defs = `  <defs>
    <symbol id="diecut5-piece" overflow="visible" viewBox="${viewBox}" preserveAspectRatio="none">
${inner}
    </symbol>
  </defs>\n`;

  const fw = result.footprintW;
  const fh = result.footprintH;
  const piecesXml = result.pieces.map(p => {
    const transform = p.rotated
      ? `translate(${(p.x + fh).toFixed(4)} ${p.y.toFixed(4)}) rotate(90)`
      : `translate(${p.x.toFixed(4)} ${p.y.toFixed(4)})`;
    return `    <g id="piece-${p.index}" data-row="${p.row}" data-col="${p.col}" data-rotated="${p.rotated}" transform="${transform}">
      <use href="#diecut5-piece" x="0" y="0" width="${fw.toFixed(4)}" height="${fh.toFixed(4)}" />
    </g>`;
  }).join('\n');

  const sheetLayer = `  <g inkscape:groupmode="layer" inkscape:label="Sheet">
    <rect x="0" y="0" width="${renderW}" height="${renderH}" fill="none" stroke="#000" stroke-width="0.25"/>
  </g>\n`;

  const dielines = `  <g inkscape:groupmode="layer" inkscape:label="Dielines">
${piecesXml}
  </g>\n`;

  let info = '';
  if (mode === 'svg-with-info') {
    const b = result.best;
    const lines = [
      `Die Cut 5 — L=${result.derived.L} D=${result.derived.D} H=${result.derived.H}`,
      `Footprint: ${fw.toFixed(2)} × ${fh.toFixed(2)} mm`,
      `Sheet: ${sheetW} × ${sheetH} mm — Pieces: ${b.total} (${b.cols}×${b.rows}) ${b.orientation}`,
      `Pitch: ${result.pitchX.toFixed(2)} × ${result.pitchY.toFixed(2)} — Gap: ${inputs.gap}`,
      `Utilization: ${(b.utilization * 100).toFixed(1)}%`,
      `Exported: ${new Date().toISOString()}`,
    ];
    const lh = Math.max(8, Math.min(renderW, renderH) * 0.018);
    const y0 = renderH + lh * 2;
    info = `  <g inkscape:groupmode="layer" inkscape:label="Production Info">
${lines.map((ln, i) =>
  `    <text x="0" y="${(y0 + i * lh * 1.4).toFixed(2)}" font-family="Helvetica, Arial, sans-serif" font-size="${lh.toFixed(2)}" fill="#444">${xmlEscape(ln)}</text>`,
).join('\n')}
  </g>\n`;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     width="${renderW}mm" height="${renderH}mm" viewBox="0 0 ${renderW} ${renderH}">
  <title>Die Cut 5 Layout</title>
${defs}${sheetLayer}${dielines}${info}</svg>`;
}
