/**
 * Carrying Handle Box — Export builder (Illustrator-Compatible / Flattened).
 *
 * IMPORTANT — Illustrator compatibility contract:
 *   • No <symbol> / no <use> / no cross-references via #id.
 *   • Every piece's geometry is inlined directly inside <g id="piece-N">.
 *   • Internal <clipPath> ids inside each piece are suffixed with the piece
 *     index so they remain unique after duplication.
 *   • Root <svg> declares width/height in millimetres and a 1:1 viewBox.
 *   • Piece-level transforms are restricted to translate(...) + optional
 *     rotate(90) — NO scale / matrix / skew at the piece level. Per-band
 *     template→footprint mapping happens INSIDE the dieline (allowed there;
 *     it is the Tagged Mapping, not a global rescale).
 *
 * Preview === Export (same buildCarryDielineSvg) — only the wrapper changes.
 */
import {
  buildCarryDielineSvg,
  carryXBoundaries,
  carryYBoundaries,
  deriveCarry,
  type CarryHandleInputs,
  type CarryResult,
} from './carryingHandleBoxEngine';

/** Hard guard: refuse to ship an export that secretly rescales pieces. */
function assertFlattenedExportContract(args: {
  inputs: CarryHandleInputs;
  result: CarryResult;
  fw: number;
  fh: number;
  pieceTransforms: string[];
  svg: string;
}) {
  const { inputs, result, fw, fh, pieceTransforms, svg } = args;

  // Footprint must come from carryXBoundaries / carryYBoundaries only.
  const d = deriveCarry(inputs);
  const xb = carryXBoundaries(d);
  const yb = carryYBoundaries(d);
  const eq = (a: number, b: number) => Math.abs(a - b) < 1e-3;
  if (!eq(fw, xb.x5) || !eq(fh, yb.y3)) {
    throw new Error(
      `Carry export guard: footprint ${fw}×${fh} ≠ boundaries ${xb.x5}×${yb.y3}.`,
    );
  }
  if (!eq(result.footprintW, xb.x5) || !eq(result.footprintH, yb.y3)) {
    throw new Error(
      `Carry export guard: result.footprint ${result.footprintW}×${result.footprintH} ≠ boundaries.`,
    );
  }

  // Illustrator-compatibility: no <symbol> and no <use> in the final file.
  if (/<symbol\b/i.test(svg)) {
    throw new Error('Carry export guard: <symbol> is forbidden in flattened export.');
  }
  if (/<use\b/i.test(svg)) {
    throw new Error('Carry export guard: <use> is forbidden in flattened export.');
  }

  // Piece-level transforms must be pure translate (+ optional rotate(90)).
  const ALLOWED = /^translate\(\s*-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s*\)(?:\s+rotate\(\s*90\s*\))?$/;
  const FORBIDDEN = /\b(scale|skew[XY]?|matrix)\s*\(/;
  for (let i = 0; i < pieceTransforms.length; i++) {
    const t = pieceTransforms[i];
    if (FORBIDDEN.test(t)) {
      throw new Error(`Carry export guard: piece #${i} has forbidden transform "${t}".`);
    }
    if (!ALLOWED.test(t)) {
      throw new Error(`Carry export guard: piece #${i} non-identity transform "${t}".`);
    }
  }
}

export type CarryExportMode = 'svg-only' | 'svg-with-info';

interface Args {
  mode: CarryExportMode;
  inputs: CarryHandleInputs;
  result: CarryResult;
}

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Extract the dieline's inner markup (everything inside <svg>...</svg>).
 * The dieline already contains its own <defs><clipPath>…</clipPath></defs>
 * with random `chb-XXX-cN` ids — those stay LOCAL to one piece and are made
 * unique per copy by suffixing with the piece index.
 */
function extractDielineInner(svgMarkup: string): string {
  return svgMarkup
    .replace(/[\s\S]*?<svg[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '');
}

/** Suffix every `chb-XXX` token in the inner with `-pN` so duplicated
 *  clipPath ids stay unique inside the flattened export. */
function reidUidsForPiece(inner: string, pieceIndex: number): string {
  return inner.replace(/chb-[a-z0-9]+/g, m => `${m}-p${pieceIndex}`);
}

export function buildCarryExportSvg({ mode, inputs, result }: Args): string {
  const sheetW = inputs.sheetWidth;
  const sheetH = inputs.sheetHeight;
  const flip = result.best.flipSheet;
  const renderW = flip ? sheetH : sheetW;
  const renderH = flip ? sheetW : sheetH;

  // Single source of truth: same builder Preview uses.
  const dieline = buildCarryDielineSvg(inputs, { filled: false });
  const baseInner = extractDielineInner(dieline);

  const fw = result.footprintW;
  const fh = result.footprintH;

  const pieceTransforms: string[] = [];
  const piecesXml = result.pieces.map(p => {
    const transform = p.rotated
      ? `translate(${(p.x + fh).toFixed(4)} ${p.y.toFixed(4)}) rotate(90)`
      : `translate(${p.x.toFixed(4)} ${p.y.toFixed(4)})`;
    pieceTransforms.push(transform);
    const inner = reidUidsForPiece(baseInner, p.index);
    // Inline the actual geometry — NO <use>, NO <symbol>.
    return `    <g id="piece-${p.index}" data-row="${p.row}" data-col="${p.col}" data-rotated="${p.rotated}" transform="${transform}">
${inner}
    </g>`;
  }).join('\n');

  const sheetLayer = `  <g id="Sheet" inkscape:groupmode="layer" inkscape:label="Sheet">
    <rect x="0" y="0" width="${renderW}" height="${renderH}" fill="none" stroke="#000000" stroke-width="0.25"/>
  </g>\n`;

  const dielines = `  <g id="Dielines" inkscape:groupmode="layer" inkscape:label="Dielines">
${piecesXml}
  </g>\n`;

  let info = '';
  if (mode === 'svg-with-info') {
    const b = result.best;
    const lines = [
      `Carrying Handle Box — L=${result.derived.L} D=${result.derived.D} H=${result.derived.H}`,
      `Glue Flap: ${result.derived.glueFlap.toFixed(2)} mm (auto ${result.derived.glueFlapAuto})`,
      `Footprint: ${fw.toFixed(2)} × ${fh.toFixed(2)} mm`,
      `Sheet: ${sheetW} × ${sheetH} mm (used ${renderW}×${renderH}) — Pieces: ${b.total} (${b.cols}×${b.rows}) ${b.rotated ? '90°' : '0°'}`,
      `Pitch: ${result.pitchX.toFixed(2)} × ${result.pitchY.toFixed(2)} — Gap: ${inputs.gap}`,
      `Utilization: ${(b.utilization * 100).toFixed(1)}%`,
      `Exported: ${new Date().toISOString()}`,
    ];
    const lh = Math.max(8, Math.min(renderW, renderH) * 0.018);
    const y0 = renderH + lh * 2;
    info = `  <g id="ProductionInfo" inkscape:groupmode="layer" inkscape:label="Production Info">
${lines.map((ln, i) =>
  `    <text x="0" y="${(y0 + i * lh * 1.4).toFixed(2)}" font-family="Helvetica, Arial, sans-serif" font-size="${lh.toFixed(2)}" fill="#444444">${xmlEscape(ln)}</text>`,
).join('\n')}
  </g>\n`;
  }

  const svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     width="${renderW}mm" height="${renderH}mm" viewBox="0 0 ${renderW} ${renderH}">
  <title>Carrying Handle Box Layout</title>
${sheetLayer}${dielines}${info}</svg>`;

  // Final guard — refuse to emit anything that breaks Illustrator.
  assertFlattenedExportContract({ inputs, result, fw, fh, pieceTransforms, svg });

  return svg;
}
