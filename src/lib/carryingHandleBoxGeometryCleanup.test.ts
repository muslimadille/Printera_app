/**
 * Carrying Handle Box — Visual Fidelity Report
 * Test case: L=280 D=155 H=170 G=30  → Footprint 900 × 433.5
 *
 * Verifies the production output:
 *   • CUT layer = ORIGINAL Tagged-SVG path (remapped piecewise) — curves,
 *     arcs, tongues, handle pills, lock notches all preserved.
 *   • CREASE layer = exactly one tagged line per named boundary.
 *   • No <symbol>, no <use>, no <clipPath>, no matrix() — no construction
 *     grid leakage.
 *   • Preview == Export per piece.
 */
import { describe, it, expect } from 'vitest';
import {
  buildCarryDielineSvg, computeCarry,
  carryXBoundaries, carryYBoundaries, deriveCarry,
  DEFAULT_CARRY_INPUTS, type CarryHandleInputs,
} from './carryingHandleBoxEngine';
import { buildCarryExportSvg } from './carryingHandleBoxExport';

const inputs: CarryHandleInputs = {
  ...DEFAULT_CARRY_INPUTS,
  length: 280, depth: 155, height: 170,
};

describe('Carry — Visual Fidelity from Tagged SVG (280×155×170)', () => {
  const d = deriveCarry(inputs);
  const xb = carryXBoundaries(d);
  const yb = carryYBoundaries(d);
  const preview = buildCarryDielineSvg(inputs, { filled: false });
  const result = computeCarry(inputs);
  const exported = buildCarryExportSvg({ mode: 'svg-only', inputs, result });

  it('X boundaries: [0, 30, 310, 465, 745, 900]; footprint H = 433.5', () => {
    expect([xb.x0, xb.x1, xb.x2, xb.x3, xb.x4, xb.x5]).toEqual([0, 30, 310, 465, 745, 900]);
    expect(yb.y3).toBeCloseTo(433.5, 3);
  });

  it('Layer structure — exactly one CUT, CREASE, HOLES group', () => {
    expect((preview.match(/<g id="CUT"/g) || []).length).toBe(1);
    expect((preview.match(/<g id="CREASE"/g) || []).length).toBe(1);
    expect((preview.match(/<g id="HOLES"/g) || []).length).toBe(1);
  });

  it('CUT_OUTER_CONTOUR is the remapped ORIGINAL Tagged-SVG path (with curves)', () => {
    const m = preview.match(/data-tag="CUT_OUTER_CONTOUR" d="([^"]+)"/);
    expect(m, 'outer contour path missing').toBeTruthy();
    const dPath = m![1];
    // Real Adobe artwork → contains cubic curves AND arcs (handle pills,
    // glue tongues, lock notches). Parametric rectangles would have ONLY
    // L/M/Z commands and zero C/A — that regression must never come back.
    expect(dPath).toMatch(/\bC\b/);   // cubic Bézier curves preserved
    // Handle pills, glue tongues, lock notches are real cubic-Bezier curves
    // in the Adobe template — many C commands, not parametric rectangles.
    expect((dPath.match(/\bC\b/g) || []).length).toBeGreaterThan(20);
    // It must reach the rightmost cut edge at X5 = 900 somewhere.
    expect(dPath).toMatch(/\b900(?:\.\d+)?\b/);
  });

  it('All named CREASE tags appear exactly once', () => {
    for (const tag of [
      'CREASE_X_GLUE_TO_FRONT_1',
      'CREASE_X_FRONT_1_TO_DEPTH_1',
      'CREASE_X_DEPTH_1_TO_FRONT_2',
      'CREASE_X_FRONT_2_TO_DEPTH_2',
      'CREASE_Y_TOP_TO_BODY',
      'CREASE_Y_BODY_TO_BOTTOM',
      'CREASE_Y_COVER_UPPER_TO_LOWER_F1',
      'CREASE_Y_COVER_UPPER_TO_LOWER_F2',
    ]) {
      const hits = preview.match(new RegExp(`data-tag="${tag}"`, 'g')) || [];
      expect(hits.length, tag).toBe(1);
    }
    // Vertical boundary creases sit at exactly xb.x1..xb.x4.
    expect(preview).toMatch(/data-tag="CREASE_X_FRONT_1_TO_DEPTH_1"[^/]*x1="310"/);
    expect(preview).toMatch(/data-tag="CREASE_X_FRONT_2_TO_DEPTH_2"[^/]*x1="745"/);
  });

  it('No construction grid / helper geometry leakage', () => {
    expect(preview).not.toMatch(/<clipPath\b/);
    expect(preview).not.toMatch(/matrix\(/);
    expect(preview).not.toMatch(/<symbol\b/i);
    expect(preview).not.toMatch(/<use\b/i);
    expect(preview).not.toMatch(/inkscape:label="(Debug|Reference|Original|Grid|Helper)/i);
  });

  it('Preview === Export (per-piece inner geometry identical)', () => {
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
    const previewInner = norm(
      preview.replace(/[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, ''),
    );
    for (const p of result.pieces) {
      const block = exported.match(new RegExp(`<g id="piece-${p.index}"[^>]*>([\\s\\S]*?)\\n    </g>`));
      expect(block, `piece-${p.index}`).toBeTruthy();
      expect(norm(block![1])).toBe(previewInner);
    }
  });
});
