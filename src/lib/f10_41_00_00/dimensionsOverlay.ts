import { F10_41_00_00Dimensions } from './types';

export function buildF10_41_00_00DimensionsSvg(
  dims: F10_41_00_00Dimensions,
  scale: number = 1
): string {
  const W = Math.max(20, dims.width);
  const H = Math.max(20, dims.height);
  const D = Math.max(15, dims.depth);
  const Gf = Math.max(5, dims.glueFlap);
  const flapH = dims.flapHeight ? Math.max(10, dims.flapHeight) : D * 0.675;

  const x_glue = Gf;
  const x1 = x_glue + W;
  const x2 = x1 + D;
  const x3 = x2 + W;
  const x4 = x3 + D;

  const y_top = flapH;
  const y_bot = flapH + H;
  const TotalW = x4;
  const TotalH = flapH + H + flapH;

  const C = '#2563eb'; // Blue for inner panel dimensions

  // Base CAD scaling parameters matching T0002
  const baseFS = 4.2;  // font size in mm
  const baseAH = 1.8;  // arrow head size in mm
  const baseSW = 0.4;  // stroke width in mm
  const baseRectStroke = 0.3;

  // Relative scaling based on reference template height (238mm)
  const relScale = Math.max(TotalW, TotalH) / 238;
  const s = relScale * (scale > 0 ? scale : 1);
  const SW = baseSW * s;
  const AH = baseAH * s;
  const FS = baseFS * s;

  const arrowL = (x: number, y: number) =>
    `<path d="M${x} ${y} l${AH} ${-AH / 2} l0 ${AH} z" fill="${C}"/>`;
  const arrowR = (x: number, y: number) =>
    `<path d="M${x} ${y} l${-AH} ${-AH / 2} l0 ${AH} z" fill="${C}"/>`;
  const arrowU = (x: number, y: number) =>
    `<path d="M${x} ${y} l${-AH / 2} ${AH} l${AH} 0 z" fill="${C}"/>`;
  const arrowD = (x: number, y: number) =>
    `<path d="M${x} ${y} l${-AH / 2} ${-AH} l${AH} 0 z" fill="${C}"/>`;

  const label = (x: number, y: number, text: string) => {
    const padX = 1.2 * s;
    const padY = 0.8 * s;
    const w = text.length * FS * 0.58 + padX * 2;
    const h = FS + padY * 2;
    return (
      `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" ` +
      `fill="#ffffff" fill-opacity="0.95" stroke="${C}" stroke-width="${baseRectStroke * s}" rx="${1.0 * s}"/>` +
      `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${FS}" font-weight="600" ` +
      `fill="${C}" text-anchor="middle" dominant-baseline="middle" direction="ltr" unicode-bidi="isolate">${text}</text>`
    );
  };

  const dimH = (x1: number, x2: number, y: number, text: string) =>
    `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${C}" stroke-width="${SW}"/>` +
    arrowL(x1, y) +
    arrowR(x2, y) +
    label((x1 + x2) / 2, y, text);

  const dimV = (x: number, y1: number, y2: number, text: string) =>
    `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${C}" stroke-width="${SW}"/>` +
    arrowU(x, y1) +
    arrowD(x, y2) +
    label(x, (y1 + y2) / 2, text);

  let out = `<g id="cad-dimensions" pointer-events="none">\n`;

  // 1. Glue Flap Width Dimension
  const yInner = y_top + H * 0.5;
  out += dimH(0, x_glue, yInner, `${Gf.toFixed(1)}`);

  // 2. Width (Panel 1)
  out += dimH(x_glue, x1, y_top + H * 0.25, `${W.toFixed(1)}`);

  // 3. Depth (Panel 2)
  out += dimH(x1, x2, y_top + H * 0.5, `${D.toFixed(1)}`);

  // 4. Height (Panel 1)
  out += dimV((x_glue + x1) / 2, y_top, y_bot, `${H.toFixed(1)}`);

  // 5. Outer Overall Width (Bottom Dimension with extension lines)
  const extY1 = y_bot + flapH;
  const extY2 = extY1 + 14 * s;
  const tick = 3 * s;
  const colOuter = '#64748b';

  out += `<line x1="0" y1="${extY1}" x2="0" y2="${extY2 + tick}" stroke="${colOuter}" stroke-width="${0.3 * s}" stroke-dasharray="${2 * s},${2 * s}"/>`;
  out += `<line x1="${TotalW}" y1="${extY1}" x2="${TotalW}" y2="${extY2 + tick}" stroke="${colOuter}" stroke-width="${0.3 * s}" stroke-dasharray="${2 * s},${2 * s}"/>`;
  out += `<line x1="0" y1="${extY2}" x2="${TotalW}" y2="${extY2}" stroke="${colOuter}" stroke-width="${0.4 * s}"/>`;
  out += `<line x1="0" y1="${extY2 - tick}" x2="0" y2="${extY2 + tick}" stroke="${colOuter}" stroke-width="${0.5 * s}"/>`;
  out += `<line x1="${TotalW}" y1="${extY2 - tick}" x2="${TotalW}" y2="${extY2 + tick}" stroke="${colOuter}" stroke-width="${0.5 * s}"/>`;
  out += `<rect x="${TotalW / 2 - 25 * s}" y="${extY2 - 5 * s}" width="${50 * s}" height="${10 * s}" fill="#ffffff" fill-opacity="0.95" rx="${1 * s}"/>`;
  out += `<text x="${TotalW / 2}" y="${extY2}" font-family="Arial, sans-serif" font-size="${4.5 * s}" font-weight="700" fill="#1e293b" text-anchor="middle" dominant-baseline="middle">Total W: ${TotalW.toFixed(1)} mm</text>`;

  // 6. Outer Overall Height (Right Dimension with extension lines)
  const extX1 = TotalW;
  const extX2 = extX1 + 14 * s;
  out += `<line x1="${extX1}" y1="0" x2="${extX2 + tick}" y2="0" stroke="${colOuter}" stroke-width="${0.3 * s}" stroke-dasharray="${2 * s},${2 * s}"/>`;
  out += `<line x1="${extX1}" y1="${TotalH}" x2="${extX2 + tick}" y2="${TotalH}" stroke="${colOuter}" stroke-width="${0.3 * s}" stroke-dasharray="${2 * s},${2 * s}"/>`;
  out += `<line x1="${extX2}" y1="0" x2="${extX2}" y2="${TotalH}" stroke="${colOuter}" stroke-width="${0.4 * s}"/>`;
  out += `<line x1="${extX2 - tick}" y1="0" x2="${extX2 + tick}" y2="0" stroke="${colOuter}" stroke-width="${0.5 * s}"/>`;
  out += `<line x1="${extX2 - tick}" y1="${TotalH}" x2="${extX2 + tick}" y2="${TotalH}" stroke="${colOuter}" stroke-width="${0.5 * s}"/>`;
  out += `<g transform="translate(${extX2}, ${TotalH / 2}) rotate(90)">`;
  out += `<rect x="${-25 * s}" y="${-5 * s}" width="${50 * s}" height="${10 * s}" fill="#ffffff" fill-opacity="0.95" rx="${1 * s}"/>`;
  out += `<text x="0" y="0" font-family="Arial, sans-serif" font-size="${4.5 * s}" font-weight="700" fill="#1e293b" text-anchor="middle" dominant-baseline="middle">Total H: ${TotalH.toFixed(1)} mm</text>`;
  out += `</g>`;

  out += `</g>`;
  return out;
}
