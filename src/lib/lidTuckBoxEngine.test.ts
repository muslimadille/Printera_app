import { describe, it, expect } from 'vitest';
import { buildLidTuckBoxGeometry, computeAnchors } from './lidTuckBoxEngine';
import { MM_TO_PT } from './lidTuckBoxTemplate';

const approx = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

describe('lidTuckBoxEngine — flat svg dimensions', () => {
  it('Base 200/50/200 → 299.5 × 601.1', () => {
    const g = buildLidTuckBoxGeometry({ L: 200, D: 50, H: 200 });
    expect(approx(g.flatWidth, 299.5)).toBe(true);
    expect(approx(g.flatHeight, 601.1)).toBe(true);
  });
  it('Test A 180/40/190 → 259.5 × 541.1', () => {
    const g = buildLidTuckBoxGeometry({ L: 180, D: 40, H: 190 });
    expect(approx(g.flatWidth, 259.5)).toBe(true);
    expect(approx(g.flatHeight, 541.1)).toBe(true);
  });
  it('Test B 220/60/210 → 339.5 × 661.1', () => {
    const g = buildLidTuckBoxGeometry({ L: 220, D: 60, H: 210 });
    expect(approx(g.flatWidth, 339.5)).toBe(true);
    expect(approx(g.flatHeight, 661.1)).toBe(true);
  });
});

describe('lidTuckBoxEngine — anchor invariants', () => {
  it('source dims (200/50/200) remap is identity within 0.001mm', () => {
    const src = computeAnchors(200, 50, 200);
    const tgt = computeAnchors(200, 50, 200);
    for (const k of Object.keys(src.x)) expect(src.x[k]).toBe(tgt.x[k]);
    for (const k of Object.keys(src.y)) expect(src.y[k]).toBe(tgt.y[k]);
  });

  it('17 crease lines preserved across all sizes', () => {
    for (const dims of [
      { L: 180, D: 40, H: 190 },
      { L: 200, D: 50, H: 200 },
      { L: 220, D: 60, H: 210 },
    ]) {
      const g = buildLidTuckBoxGeometry(dims);
      expect(g.creaseLines).toHaveLength(17);
    }
  });

  it('cut subpaths include 2 slots + 4 side-flap edges + notch curve', () => {
    const g = buildLidTuckBoxGeometry({ L: 200, D: 50, H: 200 });
    expect(g.cutPaths.length).toBeGreaterThanOrEqual(7);
    expect(g.outerContour.d.length).toBeGreaterThan(100);
  });

  it('derived row heights follow validated formulas', () => {
    const g = buildLidTuckBoxGeometry({ L: 200, D: 50, H: 200 });
    expect(approx(g.derived.baseHeight, 199)).toBe(true);
    expect(approx(g.derived.lidHeight, 197.6)).toBe(true);
    expect(approx(g.derived.apexHeight, 49.75)).toBe(true);
    expect(approx(g.derived.frontDepth, 50)).toBe(true);
    expect(approx(g.derived.innerFlapHeight, 49.25)).toBe(true);
  });

  it('notch center = D + L/2 and slot anchors at 0.2·L spacing', () => {
    const g = buildLidTuckBoxGeometry({ L: 220, D: 60, H: 210 });
    expect(g.derived.notchCenterX).toBe(60 + 110);
    expect(g.derived.slotAnchorsX).toEqual([104, 148, 192, 236]);
  });

  it('Test A 180/40/190 left inner-column crease lands at x = D − 0.25 = 39.75mm', () => {
    const g = buildLidTuckBoxGeometry({ L: 180, D: 40, H: 190 });
    // CREASE_Y_BASE_TO_BACK_DEPTH is the inner-column-left vertical.
    const c = g.creaseLines.find(l => l.id === 'CREASE_Y_BASE_TO_BACK_DEPTH');
    expect(c).toBeDefined();
    expect(approx(c!.from[0], 39.75, 0.05)).toBe(true);
  });

  it('Test B 220/60/210 top header band crease X spans full inner column', () => {
    const g = buildLidTuckBoxGeometry({ L: 220, D: 60, H: 210 });
    const c = g.creaseLines.find(
      l => l.id === 'CREASE_Y_FRONT_INNER_FLAP_TO_FRONT_DEPTH',
    );
    expect(c).toBeDefined();
    // x extremes should be at D (= 60) and D + L (= 280) within 0.25mm.
    const [x1, x2] = [c!.from[0], c!.to[0]].sort((a, b) => a - b);
    expect(approx(x1, 60, 0.6)).toBe(true);
    expect(approx(x2, 280, 0.6)).toBe(true);
  });

  it('MM_TO_PT constant available', () => {
    expect(MM_TO_PT).toBeCloseTo(2.83465);
  });
});
