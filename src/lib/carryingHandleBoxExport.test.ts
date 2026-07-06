/**
 * Carrying Handle Box — Flattened Illustrator-Compatible Export validation.
 * Test case: L=320 D=160 H=170 — Footprint 990×442.
 */
import { describe, it, expect } from 'vitest';
import {
  buildCarryDielineSvg, computeCarry, DEFAULT_CARRY_INPUTS,
  type CarryHandleInputs,
} from './carryingHandleBoxEngine';
import { buildCarryExportSvg } from './carryingHandleBoxExport';

const inputs: CarryHandleInputs = {
  ...DEFAULT_CARRY_INPUTS,
  length: 320, depth: 160, height: 170,
};

describe('Carry — Flattened Illustrator-Compatible Export (320×160×170)', () => {
  const dieline = buildCarryDielineSvg(inputs, { filled: false });
  const result = computeCarry(inputs);
  const exported = buildCarryExportSvg({ mode: 'svg-only', inputs, result });

  it('root svg uses mm units and viewBox = 0 0 sheetW sheetH', () => {
    expect(exported).toMatch(/width="\d+mm"/);
    expect(exported).toMatch(/height="\d+mm"/);
    expect(exported).toMatch(/viewBox="0 0 \d+(?:\.\d+)? \d+(?:\.\d+)?"/);
  });

  it('flattened — NO <symbol>, NO <use>, NO cross-references', () => {
    expect(exported).not.toMatch(/<symbol\b/i);
    expect(exported).not.toMatch(/<use\b/i);
    expect(exported).not.toMatch(/href="#carry-piece"/);
  });

  it('per-piece geometry is inlined inside <g id="piece-N">', () => {
    expect((exported.match(/<g id="piece-\d+"/g) || []).length).toBe(result.pieces.length);
    // Each piece must contain real geometry primitives (path/line/rect/ellipse)
    for (const p of result.pieces) {
      const re = new RegExp(`<g id="piece-${p.index}"[\\s\\S]*?</g>\\s*(?=<g id="piece-|\\s*</g>\\s*<g id="ProductionInfo"|\\s*</g>\\s*</svg>)`);
      const m = exported.match(re);
      expect(m, `piece-${p.index} block missing`).toBeTruthy();
      expect(m![0]).toMatch(/<(path|line|rect|ellipse)\b/);
    }
  });

  it('piece-level transforms are identity-only (translate + optional rotate(90))', () => {
    const ALLOWED = /^translate\(\s*-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s*\)(?:\s+rotate\(\s*90\s*\))?$/;
    const pieceTransforms = [...exported.matchAll(/<g id="piece-\d+"[^>]*transform="([^"]+)"/g)].map(m => m[1]);
    expect(pieceTransforms.length).toBe(result.pieces.length);
    for (const t of pieceTransforms) expect(t).toMatch(ALLOWED);
  });

  it('clipPath ids are unique per piece (no duplicate id collisions)', () => {
    const ids = [...exported.matchAll(/<clipPath id="([^"]+)"/g)].map(m => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('no Debug / Reference / Original layers', () => {
    expect(exported).not.toMatch(/inkscape:label="(Debug|Reference|Original)/i);
  });

  it('footprint computed exclusively from carryX/Y boundaries (990×442)', () => {
    expect(result.footprintW).toBeCloseTo(990, 2);
    expect(result.footprintH).toBeCloseTo(442, 2);
  });

  it('inlined geometry per piece matches the preview dieline (structurally)', () => {
    // Strip per-build uid suffixes so we compare geometry only.
    const norm = (s: string) =>
      s.replace(/chb-[a-z0-9]+(?:-p\d+)?/g, 'chb-X').replace(/\s+/g, ' ').trim();
    const previewInner = norm(
      dieline.replace(/[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, ''),
    );
    for (const p of result.pieces) {
      const block = exported.match(new RegExp(`<g id="piece-${p.index}"[^>]*>([\\s\\S]*?)\\n    </g>`));
      expect(block, `piece-${p.index} body`).toBeTruthy();
      expect(norm(block![1])).toBe(previewInner);
    }
  });
});
