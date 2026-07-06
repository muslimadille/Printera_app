/**
 * Die Cut — Production Export
 * ---------------------------------------------------------------
 * Generates a real-size (mm) SVG suitable for Illustrator and
 * production. Each placed piece embeds the original dieline SVG
 * geometry (cut + crease lines) so paths remain editable.
 *
 * Modes:
 *  - 'svg-only'      : only sheet + pieces (clean production file).
 *  - 'svg-with-info' : adds a dedicated hidden "Production Info"
 *                       layer + RDF/metadata block — does NOT touch
 *                       cut/crease geometry.
 */

import { buildPreviewTiles, type DieCutResult, type DieCutInputs } from './dieCutEngine';

export type DieCutExportMode = 'svg-only';

export interface DieCutExportOptions {
  mode?: DieCutExportMode;
  inputs: DieCutInputs;
  result: DieCutResult;
  pieceSvg: string;     // raw SVG markup for one piece (visual geometry)
  templateName?: string;
  /**
   * When true, use <clipPath> instead of nested <svg overflow="hidden">
   * for tile clipping. Browsers honor nested-svg viewport clipping, but
   * Adobe Illustrator and many production tools ignore it — causing each
   * placed piece to render its entire source artwork and producing
   * overlapping duplicates. clipPath is universally honored.
   */
  useClipPath?: boolean;
}

/* ── helpers ── */
const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Sanitize raw SVG markup so the export only contains clean geometry.
 * Strips: XML prolog, DOCTYPE, comments, Adobe Illustrator metadata,
 * <switch>/<foreignObject> wrappers, Adobe/Inkscape namespaced elements
 * (i:, x:, graph:, sodipodi:, inkscape:) and their attributes, hidden
 * layers, and any non-geometry helper tags.
 */
function sanitizeSvgGeometry(svgMarkup: string): { inner: string; viewBox: string } {
  let s = svgMarkup;
  // Strip prolog / DOCTYPE / comments
  s = s.replace(/<\?xml[\s\S]*?\?>/gi, '');
  s = s.replace(/<!DOCTYPE[\s\S]*?\]>/gi, '');
  s = s.replace(/<!DOCTYPE[\s\S]*?>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');

  // Capture viewBox (or width/height) from root <svg>
  const rootMatch = s.match(/<svg\b[^>]*>/i);
  const rootTag = rootMatch ? rootMatch[0] : '';
  const vbMatch = rootTag.match(/viewBox\s*=\s*"([^"]+)"/i);
  let viewBox = vbMatch ? vbMatch[1] : '';
  if (!viewBox) {
    const wM = rootTag.match(/\bwidth\s*=\s*"([\d.]+)/i);
    const hM = rootTag.match(/\bheight\s*=\s*"([\d.]+)/i);
    const w = wM ? parseFloat(wM[1]) : 100;
    const h = hM ? parseFloat(hM[1]) : 100;
    viewBox = `0 0 ${w} ${h}`;
  }

  // Drop outer <svg>…</svg> shell
  s = s.replace(/[\s\S]*?<svg\b[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');

  // Drop Adobe-only blocks entirely
  s = s.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
  s = s.replace(/<i:pgf[\s\S]*?<\/i:pgf>/gi, '');
  s = s.replace(/<i:[a-zA-Z0-9_-]+[\s\S]*?<\/i:[a-zA-Z0-9_-]+>/gi, '');
  s = s.replace(/<i:[a-zA-Z0-9_-]+\b[^/>]*\/>/gi, '');
  // Unwrap <switch> ... keep inner children
  s = s.replace(/<\/?switch\b[^>]*>/gi, '');
  // Drop hidden elements
  s = s.replace(/<g\b[^>]*display\s*=\s*"none"[^>]*>[\s\S]*?<\/g>/gi, '');
  s = s.replace(/<g\b[^>]*visibility\s*=\s*"hidden"[^>]*>[\s\S]*?<\/g>/gi, '');
  // Strip Illustrator namespaced attributes from any tag
  s = s.replace(/\s+(?:i|x|graph|sodipodi|inkscape):[\w-]+\s*=\s*"[^"]*"/gi, '');
  // Strip xmlns:i / xmlns:x / xmlns:graph declarations if any leaked
  s = s.replace(/\s+xmlns:(?:i|x|graph|sodipodi|inkscape)\s*=\s*"[^"]*"/gi, '');

  return { inner: s.trim(), viewBox };
}

function extractInner(svgMarkup: string): { inner: string; viewBox: string } {
  return sanitizeSvgGeometry(svgMarkup);
}

export function buildProductionInfo(
  inputs: DieCutInputs,
  result: DieCutResult,
  templateName?: string,
) {
  const b = result.best;
  return {
    templateName: templateName || '—',
    exportedAt: new Date().toISOString(),
    sheet: {
      widthMm: inputs.sheetWidth,
      heightMm: inputs.sheetHeight,
      longSideMm: result.longSide,
      shortSideMm: result.shortSide,
    },
    box: {
      lengthMm: inputs.boxLength,
      depthMm: inputs.boxDepth,
      heightMm: inputs.boxHeight,
    },
    footprintMm: { width: result.footprintW, height: result.footprintH },
    pitchMm: { x: result.pitchX, y: result.pitchY, gap: inputs.gap },
    calibration: {
      sideTrim: inputs.sideTrim,
      verticalTrim: inputs.verticalTrim,
      verticalInterlock: +(result.geometry.footprintH + inputs.gap - result.geometry.autoPitchY).toFixed(4),
      horizontalInterlock: inputs.horizontalInterlock ?? 0,
      manualPitchX: inputs.manualPitchX ?? 0,
      manualPitchY: inputs.manualPitchY ?? 0,
    },
    bestScenario: {
      key: b.key,
      orientation: b.orientation,
      cols: b.cols,
      rows: b.rows,
      totalPieces: b.total,
      layoutMm: { width: b.layoutW, height: b.layoutH },
      remainingMm: { width: b.remainingW, height: b.remainingH },
      utilization: +(b.utilization * 100).toFixed(2),
    },
  };
}

export function buildDieCutSvg(opts: DieCutExportOptions): string {
  const { mode, inputs, result, pieceSvg, templateName, useClipPath } = opts;
  const sheetW = inputs.sheetWidth;
  const sheetH = inputs.sheetHeight;

  // Render with long side horizontal (matches engine auto-orientation)
  const longHoriz = sheetW >= sheetH;
  const renderW = longHoriz ? result.longSide : result.shortSide;
  const renderH = longHoriz ? result.shortSide : result.longSide;

  const { inner: pieceInner, viewBox: pieceViewBox } = pieceSvg
    ? extractInner(pieceSvg)
    : { inner: '', viewBox: '0 0 100 100' };

  const zones = result.geometry.zones;
  const baseFW = zones.baseFootprintW;
  const baseFH = zones.baseFootprintH;

  // Collect clipPath definitions when using clipPath mode.
  const clipPathDefs: string[] = [];
  let clipIdCounter = 0;

  // Pieces layer — coordinates are driven by production geometry. Each SVG is
  // rebuilt from Stretch Zones, so Height-only edits only stretch Height zones.
  const piecesXml = result.pieces.map((p) => {
    const px = p.x;
    const py = p.y;
    const fw = p.footprintW;
    const fh = p.footprintH;
    const transform = p.rotated
      ? `translate(${(px + fw).toFixed(4)} ${py.toFixed(4)}) rotate(90)`
      : `translate(${px.toFixed(4)} ${py.toFixed(4)})`;

    const tileToSvg = (cx: number, cy: number, cw: number, ch: number,
                      srcAbsX: number, srcAbsY: number, sw: number, sh: number): string => {
      if (cw <= 0 || ch <= 0) return '';
      const scaleX = cw / (sw || 0.0001);
      const scaleY = ch / (sh || 0.0001);
      const imgX = cx - srcAbsX * scaleX;
      const imgY = cy - srcAbsY * scaleY;
      const imgW = baseFW * scaleX;
      const imgH = baseFH * scaleY;
      if (useClipPath) {
        // Universal clipping — honored by Illustrator and all production tools.
        const cid = `clip-${p.index}-${clipIdCounter++}`;
        clipPathDefs.push(
          `    <clipPath id="${cid}" clipPathUnits="userSpaceOnUse"><rect x="${cx.toFixed(4)}" y="${cy.toFixed(4)}" width="${cw.toFixed(4)}" height="${ch.toFixed(4)}" /></clipPath>`,
        );
        return `      <g clip-path="url(#${cid})"><use href="#die-piece" x="${imgX.toFixed(4)}" y="${imgY.toFixed(4)}" width="${imgW.toFixed(4)}" height="${imgH.toFixed(4)}" /></g>`;
      }
      return `      <svg x="${cx.toFixed(4)}" y="${cy.toFixed(4)}" width="${cw.toFixed(4)}" height="${ch.toFixed(4)}" viewBox="${cx.toFixed(4)} ${cy.toFixed(4)} ${cw.toFixed(4)} ${ch.toFixed(4)}" overflow="hidden"><use href="#die-piece" x="${imgX.toFixed(4)}" y="${imgY.toFixed(4)}" width="${imgW.toFixed(4)}" height="${imgH.toFixed(4)}" /></svg>`;
    };

    let body: string;
    if (!pieceSvg || baseFW <= 0 || baseFH <= 0) {
      body = `      <rect x="0" y="0" width="${fw.toFixed(4)}" height="${fh.toFixed(4)}" fill="none" stroke="#000" stroke-width="0.2" />`;
    } else {
      // STRICT: Export flattens ONLY the final Preview geometry.
      // No runtime SVG reconstruction, no independent re-analysis.
      // Preview and Export share buildPreviewTiles() as the single source.
      body = buildPreviewTiles(zones)
        .map(t => tileToSvg(t.tx, t.ty, t.tw, t.th, t.sx, t.sy, t.sw, t.sh))
        .filter(Boolean).join('\n');
    }

    return `    <g id="piece-${p.index}" data-row="${p.row}" data-col="${p.col}" data-rotated="${p.rotated}" transform="${transform}">
${body}
    </g>`;
  }).join('\n');

  // Symbol definition (one copy of dieline geometry, reused per piece).
  // Built after pieces so clipPath defs are aggregated alongside the symbol.
  const defs = (pieceSvg || clipPathDefs.length > 0)
    ? `  <defs>
${pieceSvg ? `    <symbol id="die-piece" overflow="visible" viewBox="${pieceViewBox}" preserveAspectRatio="none">
${pieceInner}
    </symbol>
` : ''}${clipPathDefs.join('\n')}
  </defs>\n`
    : '';

  const piecesLayer = `  <g id="layer-pieces">
${piecesXml}
  </g>\n`;


  // ───────────────────────────────────────────────────────────────────
  // STRICT EXPORT — Clean SVG only.
  // No sheet boundary, no info layer, no metadata, no labels, no
  // bounding boxes, no helper lines, no debug geometry. Only the final
  // distributed dieline pieces (cut + crease) at true 1:1 mm scale.
  // The `mode` and `templateName` parameters are intentionally ignored.
  // ───────────────────────────────────────────────────────────────────

  // Validation 1: piece count must equal the final packing geometry.
  if (result.pieces.length !== result.best.total) {
    throw new Error(
      `Export validation failed: pieces=${result.pieces.length} ≠ best.total=${result.best.total}`,
    );
  }
  // Validation 2: no two pieces may share identical placement coords.
  const seen = new Set<string>();
  for (const p of result.pieces) {
    const key = `${p.x.toFixed(3)}_${p.y.toFixed(3)}_${p.rotated ? 1 : 0}`;
    if (seen.has(key)) {
      throw new Error(`Export validation failed: duplicate piece at (${p.x}, ${p.y})`);
    }
    seen.add(key);
  }

  const svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${renderW}mm" height="${renderH}mm"
     viewBox="0 0 ${renderW} ${renderH}">
${defs}${piecesLayer}</svg>`;

  // Validation 3: rendered piece groups must match expected count.
  const rendered = (svg.match(/<g id="piece-/g) || []).length;
  if (rendered !== result.pieces.length) {
    throw new Error(
      `Export validation failed: rendered=${rendered} ≠ expected=${result.pieces.length}`,
    );
  }

  return svg;
}

export function downloadText(filename: string, mime: string, data: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
