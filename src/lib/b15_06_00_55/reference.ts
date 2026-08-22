// B15_06_00_55 — Verbatim Reference SVG Generator
// Recreates the exact SVG dieline from B15_06_00_55.svg without any missing cuts, arcs, or lock slits.

import type { B15_06_00_55Geometry, Segment } from './types';

export const REFERENCE_SEGMENTS: Segment[] = [
  { id: 1, kind: 'CREASE', geometry: 'line', start: { x: 394.6, y: 116.8 }, end: { x: 394.6, y: 532.08 }, d: 'M 394.6 116.8 L 394.6 532.08' },
  { id: 2, kind: 'CREASE', geometry: 'line', start: { x: 395.96, y: 533.5 }, end: { x: 506.57, y: 533.5 }, d: 'M 395.96 533.5 L 506.57 533.5' },
  { id: 3, kind: 'CUT', geometry: 'line', start: { x: 394.6, y: 532.08 }, end: { x: 428.19, y: 567.09 }, d: 'M 394.6 532.08 L 428.19 567.09' },
  { id: 4, kind: 'CUT', geometry: 'path', d: 'M 428.19,567.09 a 33.67,33.67 0 0,0 47.62,47.62' },
  { id: 5, kind: 'CUT', geometry: 'polyline', points: [{ x: 506.57, y: 533.5 }, { x: 506.57, y: 584.38 }, { x: 461.78, y: 600.68 }, { x: 475.81, y: 614.71 }], start: { x: 506.57, y: 533.5 }, end: { x: 475.81, y: 614.71 }, d: 'M 506.57 533.5 L 506.57 584.38 L 461.78 600.68 L 475.81 614.71' },
  { id: 6, kind: 'CREASE', geometry: 'line', start: { x: 395.96, y: 115.39 }, end: { x: 506.57, y: 115.39 }, d: 'M 395.96 115.39 L 506.57 115.39' },
  { id: 7, kind: 'CUT', geometry: 'line', start: { x: 394.6, y: 116.8 }, end: { x: 428.19, y: 81.8 }, d: 'M 394.6 116.8 L 428.19 81.8' },
  { id: 8, kind: 'CUT', geometry: 'path', d: 'M 428.19,81.80 a 33.67,33.67 0 0,1 47.62,-47.62' },
  { id: 9, kind: 'CUT', geometry: 'polyline', points: [{ x: 506.57, y: 115.39 }, { x: 506.57, y: 64.51 }, { x: 461.78, y: 48.2 }, { x: 475.81, y: 34.17 }], start: { x: 506.57, y: 115.39 }, end: { x: 475.81, y: 34.17 }, d: 'M 506.57 115.39 L 506.57 64.51 L 461.78 48.2 L 475.81 34.17' },
  { id: 10, kind: 'CREASE', geometry: 'line', start: { x: 506.57, y: 115.39 }, end: { x: 506.57, y: 533.5 }, d: 'M 506.57 115.39 L 506.57 533.5' },
  { id: 11, kind: 'CREASE', geometry: 'line', start: { x: 113.97, y: 116.8 }, end: { x: 113.97, y: 532.08 }, d: 'M 113.97 116.8 L 113.97 532.08' },
  { id: 12, kind: 'CREASE', geometry: 'line', start: { x: 112.61, y: 533.5 }, end: { x: 2.0, y: 533.5 }, d: 'M 112.61 533.5 L 2 533.5' },
  { id: 13, kind: 'CUT', geometry: 'line', start: { x: 113.97, y: 532.08 }, end: { x: 80.38, y: 567.09 }, d: 'M 113.97 532.08 L 80.38 567.09' },
  { id: 14, kind: 'CUT', geometry: 'path', d: 'M 80.38,567.09 a 33.67,33.67 0 0,1 -47.62,47.62' },
  { id: 15, kind: 'CUT', geometry: 'polyline', points: [{ x: 2, y: 533.5 }, { x: 2, y: 584.38 }, { x: 46.79, y: 600.68 }, { x: 32.76, y: 614.71 }], start: { x: 2, y: 533.5 }, end: { x: 32.76, y: 614.71 }, d: 'M 2 533.5 L 2 584.38 L 46.79 600.68 L 32.76 614.71' },
  { id: 16, kind: 'CREASE', geometry: 'line', start: { x: 112.61, y: 115.39 }, end: { x: 2.0, y: 115.39 }, d: 'M 112.61 115.39 L 2 115.39' },
  { id: 17, kind: 'CUT', geometry: 'line', start: { x: 113.97, y: 116.8 }, end: { x: 80.38, y: 81.8 }, d: 'M 113.97 116.8 L 80.38 81.8' },
  { id: 18, kind: 'CUT', geometry: 'path', d: 'M 80.38,81.80 A 33.67,33.67 0 0,0 32.76,34.18' },
  { id: 19, kind: 'CUT', geometry: 'polyline', points: [{ x: 2, y: 115.39 }, { x: 2, y: 64.51 }, { x: 46.79, y: 48.2 }, { x: 32.76, y: 34.17 }], start: { x: 2, y: 115.39 }, end: { x: 32.76, y: 34.17 }, d: 'M 2 115.39 L 2 64.51 L 46.79 48.2 L 32.76 34.17' },
  { id: 20, kind: 'CUT', geometry: 'line', start: { x: 2.0, y: 115.39 }, end: { x: 2.0, y: 533.5 }, d: 'M 2 115.39 L 2 533.5' },
  { id: 21, kind: 'CREASE', geometry: 'line', start: { x: 393.89, y: 116.8 }, end: { x: 114.68, y: 116.8 }, d: 'M 393.89 116.8 L 114.68 116.8' },
  { id: 22, kind: 'CUT', geometry: 'line', start: { x: 394.6, y: 116.8 }, end: { x: 393.89, y: 116.8 }, d: 'M 394.6 116.8 L 393.89 116.8' },
  { id: 23, kind: 'CUT', geometry: 'line', start: { x: 113.97, y: 116.8 }, end: { x: 114.68, y: 116.8 }, d: 'M 113.97 116.8 L 114.68 116.8' },
  { id: 24, kind: 'CUT', geometry: 'polyline', points: [{ x: 114.68, y: 116.8 }, { x: 114.68, y: 4.83 }, { x: 393.89, y: 4.83 }, { x: 393.89, y: 116.8 }], start: { x: 114.68, y: 116.8 }, end: { x: 393.89, y: 116.8 }, d: 'M 114.68 116.8 L 114.68 4.83 L 393.89 4.83 L 393.89 116.8' },
  { id: 25, kind: 'CUT', geometry: 'polyline', points: [{ x: 156.06, y: 97.39 }, { x: 180.44, y: 48.91 }, { x: 210.21, y: 48.91 }], start: { x: 156.06, y: 97.39 }, end: { x: 210.21, y: 48.91 }, d: 'M 156.06 97.39 L 180.44 48.91 L 210.21 48.91' },
  { id: 26, kind: 'CUT', geometry: 'polyline', points: [{ x: 352.5, y: 97.39 }, { x: 328.13, y: 48.91 }, { x: 298.36, y: 48.91 }], start: { x: 352.5, y: 97.39 }, end: { x: 298.36, y: 48.91 }, d: 'M 352.5 97.39 L 328.13 48.91 L 298.36 48.91' },
  { id: 27, kind: 'CREASE', geometry: 'line', start: { x: 393.89, y: 532.08 }, end: { x: 114.68, y: 532.08 }, d: 'M 393.89 532.08 L 114.68 532.08' },
  { id: 28, kind: 'CUT', geometry: 'line', start: { x: 394.6, y: 532.08 }, end: { x: 393.89, y: 532.08 }, d: 'M 394.6 532.08 L 393.89 532.08' },
  { id: 29, kind: 'CUT', geometry: 'line', start: { x: 113.97, y: 532.08 }, end: { x: 114.68, y: 532.08 }, d: 'M 113.97 532.08 L 114.68 532.08' },
  { id: 30, kind: 'CUT', geometry: 'polyline', points: [{ x: 114.68, y: 532.08 }, { x: 114.68, y: 644.05 }, { x: 393.89, y: 644.05 }, { x: 393.89, y: 532.08 }], start: { x: 114.68, y: 532.08 }, end: { x: 393.89, y: 532.08 }, d: 'M 114.68 532.08 L 114.68 644.05 L 393.89 644.05 L 393.89 532.08' },
  { id: 31, kind: 'CUT', geometry: 'polyline', points: [{ x: 156.06, y: 551.5 }, { x: 180.44, y: 599.97 }, { x: 210.21, y: 599.97 }], start: { x: 156.06, y: 551.5 }, end: { x: 210.21, y: 599.97 }, d: 'M 156.06 551.5 L 180.44 599.97 L 210.21 599.97' },
  { id: 32, kind: 'CUT', geometry: 'polyline', points: [{ x: 352.5, y: 551.5 }, { x: 328.13, y: 599.97 }, { x: 298.36, y: 599.97 }], start: { x: 352.5, y: 551.5 }, end: { x: 298.36, y: 599.97 }, d: 'M 352.5 551.5 L 328.13 599.97 L 298.36 599.97' },
  { id: 33, kind: 'CREASE', geometry: 'line', start: { x: 788.61, y: 113.97 }, end: { x: 788.61, y: 534.91 }, d: 'M 788.61 113.97 L 788.61 534.91' },
  { id: 34, kind: 'CREASE', geometry: 'line', start: { x: 507.15, y: 113.97 }, end: { x: 788.61, y: 113.97 }, d: 'M 507.15 113.97 L 788.61 113.97' },
  { id: 35, kind: 'CUT', geometry: 'path', d: 'M 506.57,115.39 532.50,52.78 C 545.01,22.59 575.82,2.00 608.50,2.00 H 750.28 A 22.36,22.36 0.0 0,1 772.10,20.31 l 16.52 93.66' },
  { id: 36, kind: 'CREASE', geometry: 'line', start: { x: 507.15, y: 534.91 }, end: { x: 788.61, y: 534.91 }, d: 'M 507.15 534.91 L 788.61 534.91' },
  { id: 37, kind: 'CUT', geometry: 'path', d: 'M 506.57,533.50 532.50,596.11 c 12.51,30.19 43.32,50.78 76.00,50.78 H 750.28 a 22.36,22.36 0.0 0,0 21.82,-18.31 l 16.52 -93.66' },
  { id: 38, kind: 'CUT', geometry: 'polyline', points: [{ x: 746.52, y: 554.33 }, { x: 722.14, y: 602.8 }, { x: 692.38, y: 602.8 }], start: { x: 746.52, y: 554.33 }, end: { x: 692.38, y: 602.8 }, d: 'M 746.52 554.33 L 722.14 602.8 L 692.38 602.8' },
  { id: 39, kind: 'CUT', geometry: 'polyline', points: [{ x: 746.52, y: 94.55 }, { x: 722.14, y: 46.08 }, { x: 692.38, y: 46.08 }], start: { x: 746.52, y: 94.55 }, end: { x: 692.38, y: 46.08 }, d: 'M 746.52 94.55 L 722.14 46.08 L 692.38 46.08' },
  { id: 40, kind: 'CREASE', geometry: 'line', start: { x: 789.97, y: 536.33 }, end: { x: 900.58, y: 536.33 }, d: 'M 789.97 536.33 L 900.58 536.33' },
  { id: 41, kind: 'CUT', geometry: 'line', start: { x: 788.61, y: 534.91 }, end: { x: 822.2, y: 569.92 }, d: 'M 788.61 534.91 L 822.2 569.92' },
  { id: 42, kind: 'CUT', geometry: 'path', d: 'M 822.21,569.93 a 33.67,33.67 0 0,0 47.62,47.62' },
  { id: 43, kind: 'CUT', geometry: 'polyline', points: [{ x: 900.58, y: 536.33 }, { x: 900.58, y: 587.21 }, { x: 855.79, y: 603.51 }, { x: 869.83, y: 617.54 }], start: { x: 900.58, y: 536.33 }, end: { x: 869.83, y: 617.54 }, d: 'M 900.58 536.33 L 900.58 587.21 L 855.79 603.51 L 869.83 617.54' },
  { id: 44, kind: 'CREASE', geometry: 'line', start: { x: 789.97, y: 112.55 }, end: { x: 900.58, y: 112.55 }, d: 'M 789.97 112.55 L 900.58 112.55' },
  { id: 45, kind: 'CUT', geometry: 'line', start: { x: 788.61, y: 113.97 }, end: { x: 822.2, y: 78.96 }, d: 'M 788.61 113.97 L 822.2 78.96' },
  { id: 46, kind: 'CUT', geometry: 'path', d: 'M 822.21,78.96 a 33.67,33.67 0 0,1 47.62,-47.62' },
  { id: 47, kind: 'CUT', geometry: 'polyline', points: [{ x: 900.58, y: 112.55 }, { x: 900.58, y: 61.67 }, { x: 855.79, y: 45.37 }, { x: 869.83, y: 31.34 }], start: { x: 900.58, y: 112.55 }, end: { x: 869.83, y: 31.34 }, d: 'M 900.58 112.55 L 900.58 61.67 L 855.79 45.37 L 869.83 31.34' },
  { id: 48, kind: 'CUT', geometry: 'line', start: { x: 900.58, y: 112.55 }, end: { x: 900.58, y: 304.6 }, d: 'M 900.58 112.55 L 900.58 304.6' },
  { id: 49, kind: 'CUT', geometry: 'line', start: { x: 900.58, y: 536.33 }, end: { x: 900.58, y: 344.28 }, d: 'M 900.58 536.33 L 900.58 344.28' },
  { id: 50, kind: 'CUT', geometry: 'path', d: 'M 900.59,304.60 a 19.85,19.85 0 0,0 0,39.69' },
];

export function buildB15_06_00_55Reference(): B15_06_00_55Geometry {
  const CUT_COLOR = '#e30613';
  const CREASE_COLOR = '#009640';

  const paths = REFERENCE_SEGMENTS.map(s => {
    const stroke = s.kind === 'CREASE' ? CREASE_COLOR : CUT_COLOR;
    const dash = s.kind === 'CREASE' ? 'stroke-dasharray="3,2"' : '';
    return `<path d="${s.d}" stroke="${stroke}" stroke-width="2.5" fill="none" ${dash} stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 902.58 648.88" width="100%" height="100%">
    ${paths}
  </svg>`;

  return {
    svg,
    bbox: {
      w: 902.58,
      h: 648.88,
    },
    derived: {
      totalWidth: 902.58,
      totalHeight: 648.88,
      w: 280,
      h: 418,
      d: 112,
      tuckFlap: 110.6,
      topDustHeight: 112,
      botDustHeight: 112,
    },
    segments: REFERENCE_SEGMENTS,
  };
}
