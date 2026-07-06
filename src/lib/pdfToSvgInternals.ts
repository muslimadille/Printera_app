/**
 * Pure helpers used by pdfToSvg.ts (matrix math, draw-ops → path-d, viewBox
 * cropping). Lives in a separate module so unit tests can import it without
 * pulling in pdf.js (whose DOMMatrix dependency does not work in jsdom).
 */

export type Mat = [number, number, number, number, number, number];

export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

export const mulMat = (a: Mat, b: Mat): Mat => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];

export const matToSvg = (m: Mat) =>
  `matrix(${m[0]} ${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]})`;

// DrawOPS codes used inside pdf.js constructPath data arrays
export const D_MOVE = 0;
export const D_LINE = 1;
export const D_CURVE = 2;
export const D_QUAD = 3;
export const D_CLOSE = 4;

export interface BBox { minX: number; minY: number; maxX: number; maxY: number; }

export const newBBox = (): BBox => ({
  minX: Infinity,
  minY: Infinity,
  maxX: -Infinity,
  maxY: -Infinity,
});

const expandBBox = (b: BBox, x: number, y: number) => {
  if (x < b.minX) b.minX = x;
  if (y < b.minY) b.minY = y;
  if (x > b.maxX) b.maxX = x;
  if (y > b.maxY) b.maxY = y;
};

export const drawOpsToPathD = (
  data: number[] | null | undefined,
  m?: Mat,
  bbox?: BBox,
): string => {
  if (!data || !data.length) return '';
  const fmt = (n: number) => {
    const v = Math.abs(n) < 1e-6 ? 0 : n;
    return Number(v.toFixed(4)).toString();
  };
  const tx = (x: number, y: number) => {
    const X = m ? m[0] * x + m[2] * y + m[4] : x;
    const Y = m ? m[1] * x + m[3] * y + m[5] : y;
    if (bbox) expandBBox(bbox, X, Y);
    return `${fmt(X)} ${fmt(Y)}`;
  };
  const parts: string[] = [];
  let i = 0;
  while (i < data.length) {
    const op = data[i++];
    switch (op) {
      case D_MOVE: {
        const x = data[i++], y = data[i++];
        parts.push(`M${tx(x, y)}`);
        break;
      }
      case D_LINE: {
        const x = data[i++], y = data[i++];
        parts.push(`L${tx(x, y)}`);
        break;
      }
      case D_CURVE: {
        const x1 = data[i++], y1 = data[i++];
        const x2 = data[i++], y2 = data[i++];
        const x = data[i++], y = data[i++];
        parts.push(`C${tx(x1, y1)} ${tx(x2, y2)} ${tx(x, y)}`);
        break;
      }
      case D_QUAD: {
        const x1 = data[i++], y1 = data[i++];
        const x = data[i++], y = data[i++];
        parts.push(`Q${tx(x1, y1)} ${tx(x, y)}`);
        break;
      }
      case D_CLOSE:
        parts.push('Z');
        break;
      default:
        return parts.join(' ');
    }
  }
  return parts.join(' ');
};

/**
 * Wrap rendered <path> fragments in an <svg> whose viewBox is tightly cropped
 * to the artwork bounding box (with a 1pt safety margin). Falls back to the
 * full page rect when the bbox is empty. Cropping is essential so rotation
 * in the editor pivots around the dieline itself, not the host page.
 */
export const cropContentToSvg = (
  pageWidth: number,
  pageHeight: number,
  bbox: BBox,
  pathFragments: string[],
): {
  svg: string;
  widthPt: number;
  heightPt: number;
  viewBox: [number, number, number, number];
} => {
  const hasContent =
    Number.isFinite(bbox.minX) && bbox.maxX > bbox.minX &&
    Number.isFinite(bbox.minY) && bbox.maxY > bbox.minY;
  let vbX = 0, vbY = 0, vbW = pageWidth, vbH = pageHeight;
  if (hasContent) {
    const margin = 1; // pt
    vbX = bbox.minX - margin;
    vbY = bbox.minY - margin;
    vbW = (bbox.maxX - bbox.minX) + 2 * margin;
    vbH = (bbox.maxY - bbox.minY) + 2 * margin;
  }
  const fmt = (n: number) => Number(n.toFixed(4)).toString();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(vbX)} ${fmt(vbY)} ${fmt(vbW)} ${fmt(vbH)}" ` +
    `width="${fmt(vbW)}pt" height="${fmt(vbH)}pt" stroke-linecap="butt" stroke-linejoin="miter">` +
    pathFragments.join('') +
    `</svg>`;
  return { svg, widthPt: vbW, heightPt: vbH, viewBox: [vbX, vbY, vbW, vbH] };
};
