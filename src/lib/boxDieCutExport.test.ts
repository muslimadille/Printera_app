/**
 * Box > Die Cut — Export regression test.
 *
 * 9-piece case: 700×500 sheet with the default reference inputs
 * (65×25×100 box, default calibration) produces a 3×3 nest.
 *
 * Verifies:
 *  1. Exported piece count matches the engine's piece count (= 9).
 *  2. CUT (red #ED1C24) and CREASE (green #00A651) strokes are present
 *     in every piece block.
 *  3. The mm bounding box of every piece block exactly matches the
 *     Preview layout (p.x, p.y, footprintW, footprintH), with the
 *     correct rotation accounting.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { computeDieCut, DEFAULT_BASE_INPUTS } from './dieCutEngine';
import { buildBoxDieCutSvg } from './boxDieCutExport';

const pieceSvg = readFileSync(
  resolve(__dirname, '../assets/diecut-default.svg'),
  'utf8',
);

// Source template artwork is inset a fraction of a mm inside the viewBox,
// so the rendered stroke bbox lags the footprint slightly. A 2mm tolerance
// (≈1% of a 192mm piece) catches any real regression without false alarms.
const EPS = 2;

describe('Box Die Cut export — 9-piece regression (700×500)', () => {
  const inputs = { ...DEFAULT_BASE_INPUTS, sheetWidth: 700, sheetHeight: 500 };
  const result = computeDieCut(inputs);
  const svg = buildBoxDieCutSvg({ mode: 'svg-only', inputs, result, pieceSvg });

  it('engine produces exactly 9 pieces (3×3)', () => {
    expect(result.best.total).toBe(9);
    expect(result.best.cols).toBe(3);
    expect(result.best.rows).toBe(3);
    expect(result.pieces.length).toBe(9);
  });

  it('export contains exactly one <g id="piece-N"> per engine piece', () => {
    const ids = [...svg.matchAll(/<g id="piece-(\d+)"/g)].map(m => Number(m[1]));
    expect(ids.length).toBe(9);
    expect(new Set(ids).size).toBe(9);
    expect(ids.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('root svg uses mm units and a 1:1 viewBox = 0 0 longSide shortSide', () => {
    expect(svg).toMatch(/width="700mm"/);
    expect(svg).toMatch(/height="500mm"/);
    expect(svg).toMatch(/viewBox="0 0 700 500"/);
  });

  it('Illustrator-safe — NO forbidden elements anywhere in the export', () => {
    expect(svg).not.toMatch(/<symbol\b/i);
    expect(svg).not.toMatch(/<use\b/i);
    expect(svg).not.toMatch(/<clipPath\b/i);
    expect(svg).not.toMatch(/<foreignObject\b/i);
    expect(svg).not.toMatch(/<script\b/i);
    expect(svg).not.toMatch(/<image\b/i);
    expect(svg).not.toMatch(/<style\b/i);
  });

  it('every piece block contains BOTH CUT (#ED1C24) and CREASE (#00A651) strokes', () => {
    for (const p of result.pieces) {
      const re = new RegExp(
        `<g id="piece-${p.index}"[\\s\\S]*?</g>(?=\\s*(?:<g id="piece-|</g>))`,
      );
      const m = svg.match(re);
      expect(m, `piece-${p.index} block missing`).toBeTruthy();
      const body = m![0];
      expect(body.toUpperCase(), `piece-${p.index} CUT stroke`).toMatch(/#ED1C24/);
      expect(body.toUpperCase(), `piece-${p.index} CREASE stroke`).toMatch(/#00A651/);
    }
  });

  it('piece transforms are translate-only (+ optional rotate(90))', () => {
    const ALLOWED = /^translate\(\s*-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s*\)(?:\s+rotate\(\s*90\s*\))?$/;
    const transforms = [...svg.matchAll(/<g id="piece-\d+"[^>]*transform="([^"]+)"/g)]
      .map(m => m[1]);
    expect(transforms.length).toBe(9);
    for (const t of transforms) expect(t).toMatch(ALLOWED);
  });

  it('every piece mm bbox matches the Preview layout exactly', () => {
    for (const p of result.pieces) {
      const block = extractPieceBlock(svg, p.index);
      const transform = extractTransform(block);
      const localBBox = computeLocalBBox(block);
      const sheetBBox = applyTransform(localBBox, transform);

      // Expected sheet-space bbox = (p.x, p.y) with rotation-aware size.
      const expW = p.rotated ? p.footprintH : p.footprintW;
      const expH = p.rotated ? p.footprintW : p.footprintH;

      expect(sheetBBox.x, `piece-${p.index} x`).toBeCloseTo(p.x, 0);
      expect(sheetBBox.y, `piece-${p.index} y`).toBeCloseTo(p.y, 0);
      expect(sheetBBox.w, `piece-${p.index} width`).toBeGreaterThan(0);
      expect(sheetBBox.h, `piece-${p.index} height`).toBeGreaterThan(0);
      expect(Math.abs(sheetBBox.w - expW), `piece-${p.index} width Δ`).toBeLessThanOrEqual(EPS);
      expect(Math.abs(sheetBBox.h - expH), `piece-${p.index} height Δ`).toBeLessThanOrEqual(EPS);
    }
  });
});

/* ───────────── helpers ───────────── */

function extractPieceBlock(svg: string, index: number): string {
  const re = new RegExp(
    `<g id="piece-${index}"[\\s\\S]*?</g>(?=\\s*(?:<g id="piece-|</g>))`,
  );
  const m = svg.match(re);
  if (!m) throw new Error(`piece-${index} block not found`);
  return m[0];
}

function extractTransform(block: string): string {
  const m = block.match(/<g id="piece-\d+"[^>]*transform="([^"]+)"/);
  if (!m) throw new Error('transform not found');
  return m[1];
}

interface BBox { x: number; y: number; w: number; h: number; }

function computeLocalBBox(block: string): BBox {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const m of block.matchAll(/<line\b[^/>]*\/>/g)) {
    const t = m[0];
    const g = (n: string) => {
      const mm = t.match(new RegExp(`\\b${n}="(-?\\d*\\.?\\d+)"`));
      return mm ? parseFloat(mm[1]) : NaN;
    };
    const x1 = g('x1'), y1 = g('y1'), x2 = g('x2'), y2 = g('y2');
    if ([x1, y1, x2, y2].every(Number.isFinite)) {
      xs.push(x1, x2); ys.push(y1, y2);
    }
  }
  for (const m of block.matchAll(/<polyline\b[^/>]*points="([^"]+)"[^/>]*\/>/g)) {
    const nums = m[1].match(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g)?.map(Number) ?? [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      xs.push(nums[i]); ys.push(nums[i + 1]);
    }
  }
  for (const m of block.matchAll(/<rect\b[^/>]*\/>/g)) {
    const t = m[0];
    const g = (n: string) => {
      const mm = t.match(new RegExp(`\\b${n}="(-?\\d*\\.?\\d+)"`));
      return mm ? parseFloat(mm[1]) : NaN;
    };
    const x = g('x'), y = g('y'), w = g('width'), h = g('height');
    if ([x, y, w, h].every(Number.isFinite)) {
      xs.push(x, x + w); ys.push(y, y + h);
    }
  }
  if (xs.length === 0 || ys.length === 0) {
    throw new Error('no geometry found in piece block');
  }
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function applyTransform(b: BBox, transform: string): BBox {
  const tM = transform.match(/translate\(\s*(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s*\)/);
  if (!tM) throw new Error('bad transform');
  const tx = parseFloat(tM[1]);
  const ty = parseFloat(tM[2]);
  const rotated = /rotate\(\s*90\s*\)/.test(transform);
  // Corners
  const corners = [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x, y: b.y + b.h },
  ].map(p => {
    let { x, y } = p;
    if (rotated) { const nx = -y; const ny = x; x = nx; y = ny; }
    return { x: x + tx, y: y + ty };
  });
  const xs = corners.map(c => c.x);
  const ys = corners.map(c => c.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
