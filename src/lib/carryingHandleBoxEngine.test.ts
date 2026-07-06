/**
 * Carrying Handle Box — Mapping Audit stability tests.
 * Locks the axis contract:
 *   Length → X only · Depth → X + flap stacks · Height → Y body only ·
 *   GlueFlap → X start only.
 */
import { describe, it, expect } from 'vitest';
import {
  auditCarryMapping, computeCarry, deriveCarry,
  carryXBoundaries, carryYBoundaries,
  DEFAULT_CARRY_INPUTS,
  type CarryHandleInputs,
} from './carryingHandleBoxEngine';

const mk = (length: number, depth: number, height: number): CarryHandleInputs => ({
  ...DEFAULT_CARRY_INPUTS, length, depth, height,
});

const CASES: Array<[string, number, number, number]> = [
  ['Test A (reference)', 300, 150, 180],
  ['Test B', 330, 140, 160],
  ['Test C', 320, 160, 170],
];

describe('Carrying Handle Box — Blueprint Mapping Audit', () => {
  for (const [name, L, D, H] of CASES) {
    it(`${name}: ${L}×${D}×${H} — all components pass`, () => {
      const inputs = mk(L, D, H);
      const audit = auditCarryMapping(inputs);
      const result = computeCarry(inputs);
      const d = result.derived;

      // Debug values (printed on failure via expect messages)
      // X boundaries: cumulative G / L / D / L / D
      const xb = audit.xBoundaries;
      expect(xb.x1 - xb.x0).toBeCloseTo(d.glueFlap, 3);
      expect(xb.x2 - xb.x1).toBeCloseTo(L, 3);
      expect(xb.x3 - xb.x2).toBeCloseTo(D, 3);
      expect(xb.x4 - xb.x3).toBeCloseTo(L, 3);
      expect(xb.x5 - xb.x4).toBeCloseTo(D, 3);

      // Y boundaries: cover stack (Depth) / body (Height) / bottom stack (Depth)
      const yb = audit.yBoundaries;
      expect(yb.y1 - yb.y0).toBeCloseTo(d.coverTotal, 3);
      expect(yb.y2 - yb.y1).toBeCloseTo(H, 3);
      expect(yb.y3 - yb.y2).toBeCloseTo(d.bottomFlapMax, 3);

      // Footprint comes from the same boundaries — no duplicated math
      expect(result.footprintW).toBeCloseTo(xb.x5, 6);
      expect(result.footprintH).toBeCloseTo(yb.y3, 6);

      // Pitch
      expect(result.pitchX).toBeGreaterThan(0);
      expect(result.pitchY).toBeGreaterThan(0);

      // Every audit row must pass
      for (const row of audit.rows) {
        expect(row.pass, `${row.component}: expected ${row.expectedSize}, got ${row.currentSize} (${row.formula})`).toBe(true);
      }
      expect(audit.xIndependentOfHeight).toBe(true);
      expect(audit.yIndependentOfLength).toBe(true);
      expect(audit.allPass).toBe(true);
    });
  }

  it('Height never leaks into X boundaries', () => {
    for (const [, L, D] of CASES) {
      const a = carryXBoundaries(deriveCarry(mk(L, D, 100)));
      const b = carryXBoundaries(deriveCarry(mk(L, D, 400)));
      expect(a).toEqual(b);
    }
  });

  it('Length never leaks into Y boundaries', () => {
    for (const [, , D, H] of CASES) {
      const a = carryYBoundaries(deriveCarry(mk(200, D, H)));
      const b = carryYBoundaries(deriveCarry(mk(500, D, H)));
      expect(a).toEqual(b);
    }
  });

  it('reference layout counts stay intact (300×150×180 → 1pc, 250×120×140 → 2pc)', () => {
    expect(computeCarry(mk(300, 150, 180)).best.total).toBe(1);
    expect(computeCarry(mk(250, 120, 140)).best.total).toBe(2);
  });
});
