import type { T0006Geometry } from "./types";

export function buildT0006DimensionsOverlay(geo: T0006Geometry): string {
  const W = geo.derived.W;
  const H = geo.derived.H;
  const D = geo.derived.D;
  const Gf = geo.derived.Gf;
  const Lt = geo.derived.Lt;

  // X Anchors
  const Xf1 = Gf;
  const Xd1 = Gf + W;
  const Xf2 = Gf + W + D;
  const Xd2 = Gf + 2 * W + D;

  // Y Anchors
  const Yft = Lt + 12.707;
  const Yfb = Yft + H;

  // Dimension offsets
  const dy = Yft + H / 2;

  const arrow = (x1: number, y1: number, x2: number, y2: number) => {
    return `<line x1="${x1.toFixed(3)}" y1="${y1.toFixed(3)}" x2="${x2.toFixed(3)}" y2="${y2.toFixed(3)}" stroke="#3b82f6" stroke-width="0.35" />`;
  };

  const text = (x: number, y: number, val: string) => {
    return `<text x="${x.toFixed(3)}" y="${y.toFixed(3)}" fill="#3b82f6" font-size="4.2" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" font-weight="bold">${val}</text>`;
  };

  const dimX = (x1: number, x2: number, y: number, label: string) => {
    const xm = (x1 + x2) / 2;
    return `
      ${arrow(x1 + 1, y, xm - 8, y)}
      ${arrow(xm + 8, y, x2 - 1, y)}
      ${text(xm, y, label)}
    `;
  };

  const dimY = (x: number, y1: number, y2: number, label: string) => {
    const ym = (y1 + y2) / 2;
    return `
      ${arrow(x, y1 + 1, x, ym - 4)}
      ${arrow(x, ym + 4, x, y2 - 1)}
      ${text(x, ym, label)}
    `;
  };

  const TotalW = Gf + 2 * W + 2 * D - 0.5;
  const TotalH = geo.bbox.h;

  const C_TOTAL = '#64748b';       // Slate grey line & tick color
  const C_TOTAL_TEXT = '#1e293b';  // Dark charcoal slate text color
  const SW_TOT = 0.35;
  const FS_TOT = 4.2;
  const offset = 14;

  const yTotal = TotalH + offset;
  const xTotal = TotalW + offset;

  // Extension lines
  const extW = 
    `<line x1="0" y1="${TotalH + 2}" x2="0" y2="${yTotal + 4}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<line x1="${TotalW.toFixed(2)}" y1="${TotalH + 2}" x2="${TotalW.toFixed(2)}" y2="${yTotal + 4}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>`;

  const extH = 
    `<line x1="${TotalW + 2}" y1="0" x2="${xTotal + 4}" y2="0" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<line x1="${TotalW + 2}" y1="${TotalH.toFixed(2)}" x2="${xTotal + 4}" y2="${TotalH.toFixed(2)}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>`;

  const dimLineW = 
    `<line x1="0" y1="${yTotal}" x2="${TotalW.toFixed(2)}" y2="${yTotal}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<line x1="0" y1="${yTotal - 2}" x2="0" y2="${yTotal + 2}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<line x1="${TotalW.toFixed(2)}" y1="${yTotal - 2}" x2="${TotalW.toFixed(2)}" y2="${yTotal + 2}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<text x="${(TotalW / 2).toFixed(2)}" y="${(yTotal + FS_TOT * 0.95).toFixed(2)}" font-family="Arial, sans-serif" font-size="${FS_TOT}" font-weight="600" ` +
    `fill="${C_TOTAL_TEXT}" text-anchor="middle" dominant-baseline="hanging" direction="ltr" unicode-bidi="isolate">${TotalW.toFixed(1)} mm</text>`;

  const textX = xTotal + 5;
  const textY = TotalH / 2;
  const dimLineH = 
    `<line x1="${xTotal}" y1="0" x2="${xTotal}" y2="${TotalH.toFixed(2)}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<line x1="${xTotal - 2}" y1="0" x2="${xTotal + 2}" y2="0" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<line x1="${xTotal - 2}" y1="${TotalH.toFixed(2)}" x2="${xTotal + 2}" y2="${TotalH.toFixed(2)}" stroke="${C_TOTAL}" stroke-width="${SW_TOT}"/>` +
    `<text x="${textX.toFixed(2)}" y="${textY.toFixed(2)}" transform="rotate(90, ${textX.toFixed(2)}, ${textY.toFixed(2)})" font-family="Arial, sans-serif" font-size="${FS_TOT}" font-weight="600" ` +
    `fill="${C_TOTAL_TEXT}" text-anchor="middle" dominant-baseline="middle" direction="ltr" unicode-bidi="isolate">${TotalH.toFixed(1)} mm</text>`;

  return `
    <!-- Product dimensions W, H, D in mm -->
    ${dimX(Xf1, Xd1, dy, `${W.toFixed(0)} mm`)}
    ${dimX(Xd1, Xf2, dy, `${D.toFixed(0)} mm`)}
    ${dimY(Xd2 - W / 2, Yft, Yfb, `${H.toFixed(0)} mm`)}
    <!-- Outer Total Dimensions -->
    ${extW}${extH}${dimLineW}${dimLineH}
  `;
}
