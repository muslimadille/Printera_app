/**
 * Carrying Handle Box — Regression Test (Phase 4).
 * Locks Preview + Export stability across THREE sizes without changing logic.
 *
 * Cases:
 *   1) 300×150×180 (reference)  → 930×435
 *   2) 320×160×170 (approved)   → 990×442
 *   3) 330×140×160 (no-hardcode) → 970×~426
 */
import { describe, it, expect } from 'vitest';
import {
  buildCarryDielineSvg, computeCarry, deriveCarry,
  carryXBoundaries, carryYBoundaries,
  DEFAULT_CARRY_INPUTS, type CarryHandleInputs,
} from './carryingHandleBoxEngine';
import { buildCarryExportSvg } from './carryingHandleBoxExport';

interface Case {
  name: string;
  L: number; D: number; H: number;
  expW: number;
  expX: [number, number, number, number, number, number];
}
const CASES: Case[] = [
  { name: 'Test 1 — reference',     L: 300, D: 150, H: 180, expW: 930, expX: [0,30,330,480,780,930] },
  { name: 'Test 2 — approved',      L: 320, D: 160, H: 170, expW: 990, expX: [0,30,350,510,830,990] },
  { name: 'Test 3 — no-hardcode',   L: 330, D: 140, H: 160, expW: 970, expX: [0,30,360,500,830,970] },
];

const mk = (L: number, D: number, H: number): CarryHandleInputs => ({
  ...DEFAULT_CARRY_INPUTS, length: L, depth: D, height: H,
});

describe('Carry — Regression across 3 sizes (Preview + Export stable)', () => {
  for (const c of CASES) {
    it(`${c.name}: ${c.L}×${c.D}×${c.H}`, () => {
      const inputs = mk(c.L, c.D, c.H);
      const d = deriveCarry(inputs);
      const xb = carryXBoundaries(d);
      const yb = carryYBoundaries(d);
      const result = computeCarry(inputs);
      const preview = buildCarryDielineSvg(inputs, { filled: false });
      const exported = buildCarryExportSvg({ mode: 'svg-only', inputs, result });

      // Derived expected Y from spec: Y1=coverTotal, Y2=Y1+H, Y3=Y2+bottomFlapMax
      const expY = [0, d.coverTotal, d.coverTotal + c.H, d.coverTotal + c.H + d.bottomFlapMax];

      // ── X / Y / footprint ───────────────────────────────────────────────
      const xActual = [xb.x0, xb.x1, xb.x2, xb.x3, xb.x4, xb.x5];
      const yActual = [yb.y0, yb.y1, yb.y2, yb.y3];
      expect(xActual).toEqual(c.expX);
      expect(yActual).toEqual(expY);
      expect(result.footprintW).toBeCloseTo(c.expW, 3);
      expect(result.footprintH).toBeCloseTo(expY[3], 3);

      // ── Preview ─────────────────────────────────────────────────────────
      const vb = preview.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)!;
      expect(parseFloat(vb[1])).toBeCloseTo(c.expW, 3);
      expect(parseFloat(vb[2])).toBeCloseTo(expY[3], 3);

      // ── Export integrity — Illustrator-compatible flattened SVG ────────
      expect(exported).not.toMatch(/<symbol\b/i);
      expect(exported).not.toMatch(/<use\b/i);
      expect(exported).not.toMatch(/inkscape:label="(Debug|Reference|Original)/i);
      expect((exported.match(/<g id="piece-\d+"/g) || []).length).toBe(result.pieces.length);

      // piece-level identity transforms only
      const ALLOWED = /^translate\(\s*-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s*\)(?:\s+rotate\(\s*90\s*\))?$/;
      const pieceTransforms = [...exported.matchAll(/<g id="piece-\d+"[^>]*transform="([^"]+)"/g)].map(m => m[1]);
      for (const t of pieceTransforms) expect(t).toMatch(ALLOWED);

      // root uses mm units
      expect(exported).toMatch(/width="\d+mm"/);
      expect(exported).toMatch(/height="\d+mm"/);

      // clipPath ids unique (no duplicate-id collisions after flattening)
      const clipIds = [...exported.matchAll(/<clipPath id="([^"]+)"/g)].map(m => m[1]);
      expect(new Set(clipIds).size).toBe(clipIds.length);

      // Preview == Export inner per piece (structurally)
      const norm = (s: string) => s.replace(/chb-[a-z0-9]+(?:-p\d+)?/g, 'chb-X').replace(/\s+/g, ' ').trim();
      const previewInner = norm(preview.replace(/[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, ''));
      for (const p of result.pieces) {
        const block = exported.match(new RegExp(`<g id="piece-${p.index}"[^>]*>([\\s\\S]*?)\\n    </g>`));
        expect(block, `piece-${p.index} body`).toBeTruthy();
        expect(norm(block![1])).toBe(previewInner);
      }
    });
  }
});
