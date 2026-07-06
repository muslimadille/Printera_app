import { describe, expect, it } from 'vitest';
import { computeDieCut, DEFAULT_BASE_INPUTS } from './dieCutEngine';

describe('dieCutEngine dynamic production geometry', () => {
  it('keeps the calibrated reference layout unchanged', () => {
    const result = computeDieCut(DEFAULT_BASE_INPUTS, DEFAULT_BASE_INPUTS);

    expect(result.footprintW).toBeCloseTo(192.27, 5);
    expect(result.footprintH).toBeCloseTo(179.49, 5);
    expect(result.pitchX).toBeCloseTo(195.27, 5);
    expect(result.pitchY).toBeCloseTo(142.85, 5);
    expect(result.best.cols).toBe(5);
    expect(result.best.rows).toBe(4);
    expect(result.best.total).toBe(20);
    expect(result.best.layoutW).toBeCloseTo(973.35, 5);
    expect(result.best.layoutH).toBeCloseTo(608.04, 5);
  });

  it('stretches only Height zones when only box height changes', () => {
    const reference = computeDieCut(DEFAULT_BASE_INPUTS, DEFAULT_BASE_INPUTS);
    const changed = computeDieCut(
      { ...DEFAULT_BASE_INPUTS, boxHeight: 110 },
      DEFAULT_BASE_INPUTS,
    );

    expect(changed.footprintW).toBeCloseTo(reference.footprintW, 5);
    expect(changed.footprintH).toBeCloseTo(reference.footprintH + 10, 5);
    expect(changed.pitchX).toBeCloseTo(reference.pitchX, 5);
    expect(changed.pitchY).toBeCloseTo(reference.pitchY + 10, 5);
    expect(changed.geometry.zones.horizontal.every(zone => zone.current === zone.base)).toBe(true);
    expect(changed.geometry.zones.vertical.find(zone => zone.key === 'H')?.current).toBe(110);
    expect(changed.geometry.zones.vertical
      .filter(zone => zone.key !== 'H')
      .every(zone => zone.current === zone.base)).toBe(true);
  });
});