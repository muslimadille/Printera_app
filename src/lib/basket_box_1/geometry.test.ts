import { describe, it, expect } from 'vitest';
import { generateBasket_Box_1Geometry, computeBasket_Box_1Derived } from './geometry';
import { DEFAULT_BASKET_BOX_1_PARAMS } from './types';

describe('K018 / Basket_Box_1 Parametric Geometry Engine', () => {
  it('Reference Size 1: 200 × 150 × 50 mm (Standard Benchmark)', () => {
    const geo = generateBasket_Box_1Geometry({
      ...DEFAULT_BASKET_BOX_1_PARAMS,
      width: 200,
      depth: 150,
      height: 50,
    });

    expect(geo.derived.L).toBe(200);
    expect(geo.derived.W).toBe(150);
    expect(geo.derived.D).toBe(50);
    expect(geo.derived.handleNeckH).toBeCloseTo(74.67, 1);
    expect(geo.derived.handleGripH).toBe(40.0);
    expect(geo.derived.wingW).toBe(75.0);

    // Total width = L + 2*D + W = 200 + 100 + 150 = 450mm
    expect(geo.bbox.width).toBeCloseTo(450.0, 1);
    // Total height = 2*W + 2*D + 99.34 = 300 + 100 + 99.34 = 499.34mm
    expect(geo.bbox.height).toBeCloseTo(499.34, 1);

    expect(geo.svg).toContain('<svg');
    expect(geo.svg).toContain('#ED1C24');
    expect(geo.svg).toContain('#00A651');
  });

  it('Reference Size 2: 200 × 150 × 75 mm (Depth D increase by 25mm)', () => {
    const geo = generateBasket_Box_1Geometry({
      ...DEFAULT_BASKET_BOX_1_PARAMS,
      width: 200,
      depth: 150,
      height: 75,
    });

    expect(geo.derived.D).toBe(75);
    // Width increases by 2 * 25 = 50mm -> 500mm
    expect(geo.bbox.width).toBeCloseTo(500.0, 1);
    // Height increases by 2 * 25 = 50mm -> 549.34mm
    expect(geo.bbox.height).toBeCloseTo(549.34, 1);
  });

  it('Reference Size 3: 170 × 150 × 50 mm (Length L decrease by 30mm)', () => {
    const geo = generateBasket_Box_1Geometry({
      ...DEFAULT_BASKET_BOX_1_PARAMS,
      width: 170,
      depth: 150,
      height: 50,
    });

    expect(geo.derived.L).toBe(170);
    // Width decreases by 30mm -> 420mm
    expect(geo.bbox.width).toBeCloseTo(420.0, 1);
    // Height remains 499.34mm
    expect(geo.bbox.height).toBeCloseTo(499.34, 1);
  });

  it('Reference Size 4: 200 × 180 × 50 mm (Width W increase by 30mm)', () => {
    const geo = generateBasket_Box_1Geometry({
      ...DEFAULT_BASKET_BOX_1_PARAMS,
      width: 200,
      depth: 180,
      height: 50,
    });

    expect(geo.derived.W).toBe(180);
    expect(geo.derived.handleNeckH).toBeCloseTo(89.67, 1);
    expect(geo.derived.wingW).toBe(90.0);
    // Width = 200 + 100 + 180 = 480mm
    expect(geo.bbox.width).toBeCloseTo(480.0, 1);
    // Height = 2*180 + 100 + 99.34 = 559.34mm
    expect(geo.bbox.height).toBeCloseTo(559.34, 1);
  });

  it('New Arbitrary Size: 230 × 160 × 80 mm', () => {
    const geo = generateBasket_Box_1Geometry({
      ...DEFAULT_BASKET_BOX_1_PARAMS,
      width: 230,
      depth: 160,
      height: 80,
    });

    // Total width = 230 + 2*80 + 160 = 550mm
    expect(geo.bbox.width).toBeCloseTo(550.0, 1);
    // Total height = 2*160 + 2*80 + 99.34 = 320 + 160 + 99.34 = 579.34mm
    expect(geo.bbox.height).toBeCloseTo(579.34, 1);
  });

  it('New Arbitrary Size: 250 × 200 × 100 mm', () => {
    const geo = generateBasket_Box_1Geometry({
      ...DEFAULT_BASKET_BOX_1_PARAMS,
      width: 250,
      depth: 200,
      height: 100,
    });

    // Total width = 250 + 2*100 + 200 = 650mm
    expect(geo.bbox.width).toBeCloseTo(650.0, 1);
    // Total height = 2*200 + 2*100 + 99.34 = 400 + 200 + 99.34 = 699.34mm
    expect(geo.bbox.height).toBeCloseTo(699.34, 1);
  });
});
