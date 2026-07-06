/**
 * Die Cut V2 — Production Export
 * ---------------------------------------------------------------
 * Visible Geometry = Export Geometry. Each piece is one <use> of the
 * parametrically-rebuilt dieline symbol whose viewBox equals the current
 * footprint, so non-uniform scale maps 1:1 to the piece world bbox.
 * No tiles, no overlays, no cached paths.
 */

import {
  type DieCutV2Inputs,
  type DieCutV2Result,
} from './dieCutEngineV2';

export type DieCutV2ExportMode = 'svg-only' | 'svg-with-info';

export interface DieCutV2ExportOptions {
  mode: DieCutV2ExportMode;
  inputs: DieCutV2Inputs;
  result: DieCutV2Result;
  pieceSvg: string;
  templateName?: string;
}

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function extractInner(svgMarkup: string): { inner: string; viewBox: string } {
  const vbMatch = svgMarkup.match(/viewBox\s*=\s*"([^"]+)"/i);
  let viewBox = vbMatch ? vbMatch[1] : '';
  if (!viewBox) {
    const wM = svgMarkup.match(/\bwidth\s*=\s*"([\d.]+)/i);
    const hM = svgMarkup.match(/\bheight\s*=\s*"([\d.]+)/i);
    const w = wM ? parseFloat(wM[1]) : 100;
    const h = hM ? parseFloat(hM[1]) : 100;
    viewBox = `0 0 ${w} ${h}`;
  }
  const inner = svgMarkup
    .replace(/[\s\S]*?<svg[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '');
  return { inner, viewBox };
}

export function buildDieCutV2Svg(opts: DieCutV2ExportOptions): string {
  const { mode, inputs, result, pieceSvg, templateName } = opts;
  const sheetW = inputs.sheetWidth;
  const sheetH = inputs.sheetHeight;
  const longHoriz = sheetW >= sheetH;
  const renderW = longHoriz ? result.longSide : result.shortSide;
  const renderH = longHoriz ? result.shortSide : result.longSide;

  const { inner: pieceInner, viewBox: pieceViewBox } = pieceSvg
    ? extractInner(pieceSvg)
    : { inner: '', viewBox: '0 0 100 100' };

  const defs = pieceSvg
    ? `  <defs>
    <symbol id="die-piece" overflow="visible" viewBox="${pieceViewBox}" preserveAspectRatio="none">
${pieceInner}
    </symbol>
  </defs>\n`
    : '';

  const piecesXml = result.pieces.map((p) => {
    const px = p.x;
    const py = p.y;
    const fw = p.footprintW;
    const fh = p.footprintH;
    // Rotated: world bbox = (fh × fw); translate by +fh on X then rotate(90).
    const transform = p.rotated
      ? `translate(${(px + fh).toFixed(4)} ${py.toFixed(4)}) rotate(90)`
      : `translate(${px.toFixed(4)} ${py.toFixed(4)})`;

    // Single <use> per piece. Dieline symbol's viewBox already equals the
    // current footprint (set by buildDielineSvgV2 in the engine), so a
    // direct 1:1 placement reproduces visible geometry exactly.
    const body = pieceSvg
      ? `      <use href="#die-piece" x="0" y="0" width="${fw.toFixed(4)}" height="${fh.toFixed(4)}" />`
      : `      <rect x="0" y="0" width="${fw.toFixed(4)}" height="${fh.toFixed(4)}" fill="none" stroke="#000" stroke-width="0.2" />`;

    return `    <g id="piece-${p.index}" data-row="${p.row}" data-col="${p.col}" data-rotated="${p.rotated}" transform="${transform}">
${body}
    </g>`;
  }).join('\n');

  const piecesLayer = `  <g inkscape:groupmode="layer" inkscape:label="Dielines" id="layer-pieces">
${piecesXml}
  </g>\n`;

  const sheetBoundary = `  <g inkscape:groupmode="layer" inkscape:label="Sheet" id="layer-sheet">
    <rect x="0" y="0" width="${renderW}" height="${renderH}" fill="none" stroke="#000" stroke-width="0.25" />
  </g>\n`;

  let infoLayer = '';
  let metadataBlock = '';
  if (mode === 'svg-with-info') {
    const b = result.best;
    const info = {
      templateName: templateName || 'Die Cut 2',
      exportedAt: new Date().toISOString(),
      sheet: { widthMm: sheetW, heightMm: sheetH },
      box: { lengthMm: inputs.boxLength, depthMm: inputs.boxDepth, heightMm: inputs.boxHeight },
      footprintMm: { width: result.footprintW, height: result.footprintH },
      pitchMm: { x: result.pitchX, y: result.pitchY, gap: inputs.gap },
      calibration: {
        sideTrim: inputs.sideTrim,
        verticalTrim: inputs.verticalTrim,
        verticalInterlock: inputs.verticalInterlock,
        horizontalInterlock: inputs.horizontalInterlock,
      },
      bestScenario: {
        orientation: b.orientation,
        cols: b.cols, rows: b.rows, totalPieces: b.total,
        layoutMm: { width: b.layoutW, height: b.layoutH },
        remainingMm: { width: b.remainingW, height: b.remainingH },
        utilization: +(b.utilization * 100).toFixed(2),
      },
    };

    const lines = [
      `قالب: ${info.templateName}`,
      `تاريخ التصدير: ${info.exportedAt}`,
      `مقاس الشيت: ${sheetW} × ${sheetH} مم`,
      `أبعاد العلبة: ${inputs.boxLength} × ${inputs.boxHeight} × ${inputs.boxDepth} مم`,
      `Footprint: ${result.footprintW.toFixed(2)} × ${result.footprintH.toFixed(2)} مم`,
      `Pitch X / Y: ${result.pitchX.toFixed(2)} / ${result.pitchY.toFixed(2)} مم — Gap: ${inputs.gap} مم`,
      `Vertical Interlock: ${info.calibration.verticalInterlock} مم`,
      `Horizontal Interlock: ${info.calibration.horizontalInterlock} مم`,
      `أفضل سيناريو: ${b.orientation} (${b.cols} × ${b.rows})`,
      `عدد القطع: ${b.total}`,
      `مقاس التوزيع: ${(b.layoutW / 10).toFixed(2)} × ${(b.layoutH / 10).toFixed(2)} سم`,
      `المتبقي: ${b.remainingW.toFixed(1)} × ${b.remainingH.toFixed(1)} مم`,
      `نسبة الاستغلال: ${info.bestScenario.utilization}٪`,
    ];
    const lineHeight = Math.max(8, Math.min(renderW, renderH) * 0.018);
    const textY = renderH + lineHeight * 2;
    const textNodes = lines.map((ln, i) =>
      `    <text x="0" y="${(textY + i * lineHeight * 1.4).toFixed(2)}" font-family="Helvetica, Arial, sans-serif" font-size="${lineHeight.toFixed(2)}" fill="#444">${xmlEscape(ln)}</text>`
    ).join('\n');

    infoLayer = `  <g inkscape:groupmode="layer" inkscape:label="Production Info" id="layer-info" style="display:none">
${textNodes}
  </g>\n`;

    metadataBlock = `  <metadata id="production-info">
    <production-info xmlns="https://printingos.app/diecut/2">
${Object.entries(info).map(([k, v]) =>
  `      <${k}>${xmlEscape(typeof v === 'object' ? JSON.stringify(v) : String(v))}</${k}>`
).join('\n')}
    </production-info>
  </metadata>\n`;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     width="${renderW}mm" height="${renderH}mm"
     viewBox="0 0 ${renderW} ${renderH}">
  <title>Die Cut 2 Layout — ${xmlEscape(templateName || 'Untitled')}</title>
  <desc>${result.best.total} pieces · sheet ${sheetW}×${sheetH} mm · ${result.best.orientation}</desc>
${metadataBlock}${defs}${sheetBoundary}${piecesLayer}${infoLayer}</svg>`;
}
