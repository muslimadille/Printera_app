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
    return `<text x="${x.toFixed(3)}" y="${y.toFixed(3)}" fill="#3b82f6" font-size="3.5" font-family="monospace" text-anchor="middle" dominant-baseline="middle" font-weight="bold">${val}</text>`;
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

  return `
    <!-- Product dimensions W, H, D in mm -->
    ${dimX(Xf1, Xd1, dy, `${W.toFixed(0)} mm`)}
    ${dimX(Xd1, Xf2, dy, `${D.toFixed(0)} mm`)}
    ${dimY(Xd2 - W / 2, Yft, Yfb, `${H.toFixed(0)} mm`)}
  `;
}
