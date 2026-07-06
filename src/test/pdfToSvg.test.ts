/**
 * PDF → SVG converter tests
 * ──────────────────────────
 * These tests focus on the geometric guarantees that matter for the dieline
 * editor:
 *   • the SVG viewBox is tightly cropped around the artwork (so rotation in
 *     the editor pivots in place);
 *   • the reported widthPt / heightPt always describe the artwork itself, not
 *     the host page;
 *   • page rotation embedded in viewport.transform is honoured (90°/180°/270°
 *     swap dimensions correctly and keep the artwork centred).
 *
 * We exercise the pure helpers exposed via __test__ instead of spinning up
 * pdf.js (the worker is impractical inside jsdom). The helpers are the same
 * ones convertPdfToSvg() drives in production, so the invariants we check
 * here transfer directly.
 */

import { describe, it, expect } from 'vitest';
import {
  drawOpsToPathD,
  cropContentToSvg,
  newBBox,
  mulMat,
  D_MOVE,
  D_LINE,
  D_CLOSE,
} from '@/lib/pdfToSvgInternals';


type Mat6 = [number, number, number, number, number, number];

/** Mirror pdf.js viewport.transform construction for rotation 0/90/180/270. */
const viewportTransform = (
  pageWidth: number,
  pageHeight: number,
  rotation: 0 | 90 | 180 | 270,
): { transform: Mat6; width: number; height: number } => {
  // pdf.js convention: viewport.transform maps PDF user space → CSS space,
  // already including Y-flip and rotation. The viewport's width/height are
  // swapped for 90/270.
  switch (rotation) {
    case 0:
      return { transform: [1, 0, 0, -1, 0, pageHeight], width: pageWidth, height: pageHeight };
    case 90:
      return { transform: [0, 1, 1, 0, 0, 0], width: pageHeight, height: pageWidth };
    case 180:
      return { transform: [-1, 0, 0, 1, pageWidth, 0], width: pageWidth, height: pageHeight };
    case 270:
      return { transform: [0, -1, -1, 0, pageHeight, pageWidth], width: pageHeight, height: pageWidth };
  }
};

/** Build a closed-rectangle draw-ops array in PDF user space. */
const rectOps = (x: number, y: number, w: number, h: number): number[] => [
  D_MOVE, x, y,
  D_LINE, x + w, y,
  D_LINE, x + w, y + h,
  D_LINE, x, y + h,
  D_CLOSE,
];

const center = (vb: [number, number, number, number]) => ({
  cx: vb[0] + vb[2] / 2,
  cy: vb[1] + vb[3] / 2,
});

const bboxOfPathPoints = (
  ops: number[],
  rootMat: Mat6,
): { minX: number; minY: number; maxX: number; maxY: number } => {
  const bbox = newBBox();
  drawOpsToPathD(ops, rootMat, bbox);
  return bbox;
};

describe('cropContentToSvg', () => {
  it('crops viewBox tightly around the artwork with 1pt margin', () => {
    const bbox = { minX: 100, minY: 200, maxX: 150, maxY: 230 };
    const { viewBox, widthPt, heightPt } = cropContentToSvg(595, 842, bbox, []);
    expect(viewBox).toEqual([99, 199, 52, 32]);
    expect(widthPt).toBe(52);
    expect(heightPt).toBe(32);
  });

  it('falls back to the full page when no content was emitted', () => {
    const empty = newBBox();
    const { viewBox, widthPt, heightPt } = cropContentToSvg(595, 842, empty, []);
    expect(viewBox).toEqual([0, 0, 595, 842]);
    expect(widthPt).toBe(595);
    expect(heightPt).toBe(842);
  });

  it('produces a well-formed <svg> string with cropped width/height attrs', () => {
    const bbox = { minX: 10, minY: 20, maxX: 30, maxY: 50 };
    const { svg } = cropContentToSvg(595, 842, bbox, ['<path d="M0 0"/>']);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('viewBox="9 19 22 32"');
    expect(svg).toContain('width="22pt"');
    expect(svg).toContain('height="32pt"');
    expect(svg).toContain('<path d="M0 0"/>');
    expect(svg.endsWith('</svg>')).toBe(true);
  });
});

describe('drawOpsToPathD bbox tracking', () => {
  it('expands the bbox to cover every emitted vertex', () => {
    const bbox = newBBox();
    drawOpsToPathD(rectOps(50, 60, 40, 30), undefined, bbox);
    expect(bbox).toEqual({ minX: 50, minY: 60, maxX: 90, maxY: 90 });
  });

  it('applies the matrix to bbox coordinates as well as path output', () => {
    // Translate (+100, +200) + Y-flip
    const m: Mat6 = [1, 0, 0, -1, 100, 500];
    const bbox = newBBox();
    const d = drawOpsToPathD(rectOps(0, 0, 50, 30), m, bbox);
    // Y-flip: y=0 → 500, y=30 → 470 (so minY=470, maxY=500)
    expect(bbox).toEqual({ minX: 100, minY: 470, maxX: 150, maxY: 500 });
    expect(d).toContain('M100 500');
    expect(d).toContain('L150 500');
    expect(d).toContain('L150 470');
    expect(d).toContain('Z');
  });
});

describe('PDF page rotation invariants (via viewport.transform)', () => {
  // Same A4-ish page (595 × 842 pt) with a 100 × 60 rectangle near the top-left
  // corner of the user-space coordinate system: (50, 50) — bottom-left in PDF
  // convention. We expect the converter to:
  //   1. swap dimensions on 90°/270° rotations,
  //   2. keep the artwork's center coincident with the viewBox center after
  //      cropping (this is the "rotates in place" guarantee).
  const pageW = 595;
  const pageH = 842;
  const rect = rectOps(50, 50, 100, 60);

  const rotations: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];

  it.each(rotations)('rotation %i°: viewBox dimensions match the rotated artwork', (rot) => {
    const vp = viewportTransform(pageW, pageH, rot);
    const bbox = bboxOfPathPoints(rect, vp.transform);
    const { widthPt, heightPt } = cropContentToSvg(vp.width, vp.height, bbox, []);

    // 100 × 60 in user space, +2pt margin on each axis after cropping.
    const expectMajor = 102;
    const expectMinor = 62;

    if (rot === 0 || rot === 180) {
      expect(widthPt).toBeCloseTo(expectMajor, 4);
      expect(heightPt).toBeCloseTo(expectMinor, 4);
    } else {
      // 90°/270° swap width and height.
      expect(widthPt).toBeCloseTo(expectMinor, 4);
      expect(heightPt).toBeCloseTo(expectMajor, 4);
    }
  });

  it.each(rotations)('rotation %i°: artwork center coincides with viewBox center (rotate-in-place)', (rot) => {
    const vp = viewportTransform(pageW, pageH, rot);
    const bbox = bboxOfPathPoints(rect, vp.transform);
    const { viewBox } = cropContentToSvg(vp.width, vp.height, bbox, []);

    const artCx = (bbox.minX + bbox.maxX) / 2;
    const artCy = (bbox.minY + bbox.maxY) / 2;
    const { cx, cy } = center(viewBox);

    expect(cx).toBeCloseTo(artCx, 4);
    expect(cy).toBeCloseTo(artCy, 4);
  });

  it.each(rotations)('rotation %i°: widthPt/heightPt are independent of host page size', (rot) => {
    // Same artwork, two different host pages. Cropping must yield identical
    // output dimensions — proving the page no longer leaks into the result.
    const small = viewportTransform(400, 600, rot);
    const large = viewportTransform(1200, 1500, rot);

    const a = cropContentToSvg(small.width, small.height, bboxOfPathPoints(rect, small.transform), []);
    const b = cropContentToSvg(large.width, large.height, bboxOfPathPoints(rect, large.transform), []);

    expect(a.widthPt).toBeCloseTo(b.widthPt, 4);
    expect(a.heightPt).toBeCloseTo(b.heightPt, 4);
  });
});

describe('CTM composition', () => {
  it('composes nested transforms exactly like pdf.js (rootMat × ctm)', () => {
    // Page rotated 90°, plus a content transform that scales 2× and shifts.
    const root = viewportTransform(595, 842, 90).transform;
    const inner: Mat6 = [2, 0, 0, 2, 10, 20];
    const combined = mulMat(root, inner);

    const bbox = newBBox();
    drawOpsToPathD(rectOps(0, 0, 5, 5), combined, bbox);

    // Width/height of bbox should be 10 (5 × scale 2) on each axis regardless
    // of rotation, since 90° rotation preserves rectangle dimensions.
    expect(bbox.maxX - bbox.minX).toBeCloseTo(10, 4);
    expect(bbox.maxY - bbox.minY).toBeCloseTo(10, 4);
  });
});
