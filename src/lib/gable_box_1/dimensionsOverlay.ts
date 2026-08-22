import { Gable_Box_1Dimensions, GABLE_BOX_1_DEFAULTS } from './types';

export function buildGable_Box_1DimensionsSvg(
  dims: Gable_Box_1Dimensions,
  dimScale: number = 1
): string {
  const W = Math.max(30, dims.width || GABLE_BOX_1_DEFAULTS.width);
  const H = Math.max(30, dims.height || GABLE_BOX_1_DEFAULTS.height);
  const D = Math.max(20, dims.depth || GABLE_BOX_1_DEFAULTS.depth);
  const Gf = Math.max(10, dims.glueFlap || GABLE_BOX_1_DEFAULTS.glueFlap);

  const baseScale = D / 120;
  const topTotalH = 142.5 * baseScale;
  const snapFlapH = 84.0 * baseScale;

  const totalHeight = topTotalH + H + snapFlapH;
  const totalWidth = Gf + W + D + W + D;

  const x0 = 0;
  const x1 = Gf;
  const x2 = x1 + W;
  const x3 = x2 + D;
  const x4 = x3 + W;
  const x5 = x4 + D;

  const yTopBody = topTotalH;
  const yBotBody = yTopBody + H;
  const yMidBody = yTopBody + H * 0.5;

  // Prominent, high-contrast CAD dimension sizing scaled for large box templates
  const strokeColor = '#0052cc';
  const strokeWidth = (1.4 * dimScale).toFixed(2);
  const fontSize = (14.0 * dimScale).toFixed(2);
  const arrowW = (4.0 * dimScale).toFixed(2);
  const arrowL = (9.0 * dimScale).toFixed(2);

  let out = '';

  // Dimension Helper: Horizontal
  const addHDim = (xStart: number, xEnd: number, y: number, label: string) => {
    const midX = (xStart + xEnd) / 2;
    const aw = parseFloat(arrowW);
    const al = parseFloat(arrowL);
    const boxW = Math.max(36, label.length * 9.0 * dimScale + 12);
    const boxH = 18.0 * dimScale;

    out += `
      <g class="cad-dim-h">
        <line x1="${xStart.toFixed(2)}" y1="${y.toFixed(2)}" x2="${xEnd.toFixed(2)}" y2="${y.toFixed(2)}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
        <polygon points="${xStart.toFixed(2)},${y.toFixed(2)} ${(xStart + al).toFixed(2)},${(y - aw).toFixed(2)} ${(xStart + al).toFixed(2)},${(y + aw).toFixed(2)}" fill="${strokeColor}" />
        <polygon points="${xEnd.toFixed(2)},${y.toFixed(2)} ${(xEnd - al).toFixed(2)},${(y - aw).toFixed(2)} ${(xEnd - al).toFixed(2)},${(y + aw).toFixed(2)}" fill="${strokeColor}" />
        <rect x="${(midX - boxW / 2).toFixed(2)}" y="${(y - boxH / 2).toFixed(2)}" width="${boxW.toFixed(2)}" height="${boxH.toFixed(2)}" fill="#ffffff" stroke="${strokeColor}" stroke-width="${(0.8 * dimScale).toFixed(2)}" rx="${(3.5 * dimScale).toFixed(2)}" />
        <text x="${midX.toFixed(2)}" y="${(y + 4.8 * dimScale).toFixed(2)}" fill="${strokeColor}" font-size="${fontSize}" font-weight="bold" text-anchor="middle" font-family="sans-serif">${label}</text>
      </g>
    `;
  };

  // Dimension Helper: Vertical
  const addVDim = (x: number, yStart: number, yEnd: number, label: string) => {
    const midY = (yStart + yEnd) / 2;
    const aw = parseFloat(arrowW);
    const al = parseFloat(arrowL);
    const boxW = Math.max(36, label.length * 9.0 * dimScale + 12);
    const boxH = 18.0 * dimScale;

    out += `
      <g class="cad-dim-v">
        <line x1="${x.toFixed(2)}" y1="${yStart.toFixed(2)}" x2="${x.toFixed(2)}" y2="${yEnd.toFixed(2)}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
        <polygon points="${x.toFixed(2)},${yStart.toFixed(2)} ${(x - aw).toFixed(2)},${(yStart + al).toFixed(2)} ${(x + aw).toFixed(2)},${(yStart + al).toFixed(2)}" fill="${strokeColor}" />
        <polygon points="${x.toFixed(2)},${yEnd.toFixed(2)} ${(x - aw).toFixed(2)},${(yEnd - al).toFixed(2)} ${(x + aw).toFixed(2)},${(yEnd - al).toFixed(2)}" fill="${strokeColor}" />
        <rect x="${(x - boxW / 2).toFixed(2)}" y="${(midY - boxH / 2).toFixed(2)}" width="${boxW.toFixed(2)}" height="${boxH.toFixed(2)}" fill="#ffffff" stroke="${strokeColor}" stroke-width="${(0.8 * dimScale).toFixed(2)}" rx="${(3.5 * dimScale).toFixed(2)}" />
        <text x="${x.toFixed(2)}" y="${(midY + 4.8 * dimScale).toFixed(2)}" fill="${strokeColor}" font-size="${fontSize}" font-weight="bold" text-anchor="middle" font-family="sans-serif">${label}</text>
      </g>
    `;
  };

  // 1. Glue Flap Width (Gf)
  addHDim(x0, x1, yMidBody, `${Gf.toFixed(1)}`);

  // 2. Front Panel Width (W)
  addHDim(x1, x2, yMidBody - 40, `${W.toFixed(1)}`);

  // 3. Gable Panel Depth (D)
  addHDim(x2, x3, yMidBody, `${D.toFixed(1)}`);

  // 4. Body Height (H)
  addVDim(x1 + W / 2, yTopBody, yBotBody, `${H.toFixed(1)}`);

  // 5. Total Width & Height Slate Markers
  const slateColor = '#334155';
  const totalFontSize = (15.0 * dimScale).toFixed(2);
  const yTotalW = totalHeight + 35 * dimScale;
  const xTotalH = totalWidth + 35 * dimScale;

  out += `
    <!-- Overall Width Extension & Line -->
    <g class="cad-total-w">
      <line x1="0" y1="${totalHeight}" x2="0" y2="${yTotalW + 10}" stroke="${slateColor}" stroke-width="${(0.8 * dimScale).toFixed(2)}" stroke-dasharray="6,6" />
      <line x1="${totalWidth.toFixed(2)}" y1="${totalHeight}" x2="${totalWidth.toFixed(2)}" y2="${yTotalW + 10}" stroke="${slateColor}" stroke-width="${(0.8 * dimScale).toFixed(2)}" stroke-dasharray="6,6" />
      <line x1="0" y1="${yTotalW.toFixed(2)}" x2="${totalWidth.toFixed(2)}" y2="${yTotalW.toFixed(2)}" stroke="${slateColor}" stroke-width="${(1.2 * dimScale).toFixed(2)}" />
      <line x1="0" y1="${(yTotalW - 8 * dimScale).toFixed(2)}" x2="0" y2="${(yTotalW + 8 * dimScale).toFixed(2)}" stroke="${slateColor}" stroke-width="${(1.2 * dimScale).toFixed(2)}" />
      <line x1="${totalWidth.toFixed(2)}" y1="${(yTotalW - 8 * dimScale).toFixed(2)}" x2="${totalWidth.toFixed(2)}" y2="${(yTotalW + 8 * dimScale).toFixed(2)}" stroke="${slateColor}" stroke-width="${(1.2 * dimScale).toFixed(2)}" />
      <text x="${(totalWidth / 2).toFixed(2)}" y="${(yTotalW - 8 * dimScale).toFixed(2)}" fill="${slateColor}" font-size="${totalFontSize}" font-weight="bold" text-anchor="middle" font-family="sans-serif">Total W: ${totalWidth.toFixed(1)} mm</text>
    </g>

    <!-- Overall Height Extension & Line -->
    <g class="cad-total-h">
      <line x1="${totalWidth.toFixed(2)}" y1="0" x2="${xTotalH + 10}" y2="0" stroke="${slateColor}" stroke-width="${(0.8 * dimScale).toFixed(2)}" stroke-dasharray="6,6" />
      <line x1="${totalWidth.toFixed(2)}" y1="${totalHeight.toFixed(2)}" x2="${xTotalH + 10}" y2="${totalHeight.toFixed(2)}" stroke="${slateColor}" stroke-width="${(0.8 * dimScale).toFixed(2)}" stroke-dasharray="6,6" />
      <line x1="${xTotalH.toFixed(2)}" y1="0" x2="${xTotalH.toFixed(2)}" y2="${totalHeight.toFixed(2)}" stroke="${slateColor}" stroke-width="${(1.2 * dimScale).toFixed(2)}" />
      <line x1="${(xTotalH - 8 * dimScale).toFixed(2)}" y1="0" x2="${(xTotalH + 8 * dimScale).toFixed(2)}" y2="0" stroke="${slateColor}" stroke-width="${(1.2 * dimScale).toFixed(2)}" />
      <line x1="${(xTotalH - 8 * dimScale).toFixed(2)}" y1="${totalHeight.toFixed(2)}" x2="${(xTotalH + 8 * dimScale).toFixed(2)}" y2="${totalHeight.toFixed(2)}" stroke="${slateColor}" stroke-width="${(1.2 * dimScale).toFixed(2)}" />
      <text x="${(xTotalH + 12 * dimScale).toFixed(2)}" y="${(totalHeight / 2).toFixed(2)}" fill="${slateColor}" font-size="${totalFontSize}" font-weight="bold" text-anchor="start" transform="rotate(90, ${(xTotalH + 12 * dimScale).toFixed(2)}, ${(totalHeight / 2).toFixed(2)})" font-family="sans-serif">Total H: ${totalHeight.toFixed(1)} mm</text>
    </g>
  `;

  return `<g id="CAD_DIMENSIONS">\n${out}\n</g>`;
}
