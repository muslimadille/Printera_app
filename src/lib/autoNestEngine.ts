/**
 * Auto Smart Nesting Engine
 * ─────────────────────────
 * Runs multiple NFP-based packings of the same dieline shape with different
 * "primary orientations" (0° / 90° / 180° / 270°), gap variations, and
 * geometry resolutions, then returns the best result by usage %.
 *
 * Each individual pack already explores 0°/90° internal rotation per piece
 * (handled inside `packShapeIntoSheet`), so by feeding pre-rotated copies of
 * the shape we effectively cover all 4 cardinal orientations × internal flip.
 *
 * Designed to be cheap to call from a Web Worker — no DOM, no React.
 */

import { packShapeIntoSheet, type NfpPackResult } from './nfpNesting';
import {
  bboxOf,
  rotateRings90,
  type DielineShape,
  type Polygon,
} from './dielineGeometry';
import type { LayoutPiece } from './sheetLayoutOptimizer';

export interface AutoNestScenario {
  id: string;
  label: string;
  pieces: LayoutPiece[];
  count: number;
  usagePercent: number;
  wasteArea: number;
  gap: number;
  rotation: 0 | 90 | 180 | 270;
}

export interface AutoNestProgress {
  scenarioIndex: number;
  totalScenarios: number;
  currentBestCount: number;
  currentBestUsage: number;
}

export interface AutoNestResult {
  best: AutoNestScenario | null;
  scenarios: AutoNestScenario[];
  durationMs: number;
}

/* ───────────── Geometry helpers ───────────── */

/** Build a `DielineShape` derived from rotating an existing shape by 90/180/270. */
function rotateShape(shape: DielineShape, deg: 90 | 180 | 270): DielineShape {
  let rings = shape.rings;
  let simplified = shape.ringsSimplified;
  let w = shape.width;
  let h = shape.height;
  const turns = deg / 90;
  for (let i = 0; i < turns; i++) {
    rings = rings.map((r) => rotate90(r, w, h));
    simplified = simplified.map((r) => rotate90(r, w, h));
    [w, h] = [h, w];
  }
  // Normalize to non-negative coords using outer ring bbox
  const bb = bboxOf(rings[0]);
  const dx = -bb.minX;
  const dy = -bb.minY;
  rings = rings.map((r) => r.map((p) => ({ x: p.x + dx, y: p.y + dy })));
  simplified = simplified.map((r) => r.map((p) => ({ x: p.x + dx, y: p.y + dy })));
  const nb = bboxOf(rings[0]);
  return {
    rings,
    ringsSimplified: simplified,
    bbox: nb,
    width: nb.maxX - nb.minX,
    height: nb.maxY - nb.minY,
  };
}

function rotate90(poly: Polygon, w: number, _h: number): Polygon {
  // Rotates each point 90° CW within a w×h box: (x,y) → (h - y, x).
  // We use the same convention as `rotateRings90` in dielineGeometry.
  return rotateRings90([poly], w, _h)[0];
}

/* ───────────── Public API ───────────── */

export interface AutoNestOptions {
  baseGap?: number;
  /** Maximum total scenarios to run (default 8). */
  maxScenarios?: number;
  /** Optional progress callback (called between scenarios). */
  onProgress?: (p: AutoNestProgress) => void;
  /** Soft time budget in ms; we stop launching new scenarios after this. */
  timeBudgetMs?: number;
}

export function runAutoNest(
  shape: DielineShape,
  sheetW: number,
  sheetH: number,
  opts: AutoNestOptions = {},
): AutoNestResult {
  const startedAt = Date.now();
  const baseGap = opts.baseGap ?? 0;
  const timeBudget = opts.timeBudgetMs ?? 3000;

  // Build the 4 primary orientations of the shape.
  const orientations: { deg: 0 | 90 | 180 | 270; shape: DielineShape }[] = [
    { deg: 0, shape },
    { deg: 90, shape: rotateShape(shape, 90) },
    { deg: 180, shape: rotateShape(shape, 180) },
    { deg: 270, shape: rotateShape(shape, 270) },
  ];

  // Gap variations: tight, baseline, slightly relaxed.
  const gaps = Array.from(
    new Set([baseGap, Math.max(0, baseGap - 0.05), baseGap + 0.05].map((g) => +g.toFixed(2))),
  );

  // Build scenario plan (orientation × gap, fast pass first).
  type Plan = { orientId: number; gap: number };
  const plans: Plan[] = [];
  for (let i = 0; i < orientations.length; i++) {
    for (const g of gaps) plans.push({ orientId: i, gap: g });
  }
  // Cap by maxScenarios
  const maxScenarios = opts.maxScenarios ?? 8;
  const trimmed = plans.slice(0, maxScenarios);

  const scenarios: AutoNestScenario[] = [];
  let best: AutoNestScenario | null = null;
  const sheetArea = sheetW * sheetH;

  for (let i = 0; i < trimmed.length; i++) {
    const elapsed = Date.now() - startedAt;
    if (elapsed > timeBudget && best) break;

    const plan = trimmed[i];
    const orient = orientations[plan.orientId];
    let result: NfpPackResult;
    try {
      result = packShapeIntoSheet(orient.shape, sheetW, sheetH, {
        gap: plan.gap,
        allowRotation: true,
        fast: true,
        maxPieces: 300,
      });
    } catch {
      continue;
    }

    // Phase 2 (gap filling) DISABLED:
    // كان يضيف قطعًا داخل الفراغات لكنه أحيانًا يغيّر مقاس القالب الأصلي.
    // نحتفظ فقط بنتيجة التعشيق الأساسي للحفاظ على دقة أبعاد العلبة.
    const mergedPieces = result.pieces;
    const mergedCount = result.count;
    const mergedUsage = result.usagePercent;

    const usedArea = mergedPieces.reduce((s, p) => s + p.w * p.h, 0);
    const sc: AutoNestScenario = {
      id: `auto-${i}-${orient.deg}-g${plan.gap}`,
      label: `تدوير ${orient.deg}° • فاصل ${plan.gap.toFixed(2)}سم`,
      pieces: mergedPieces,
      count: mergedCount,
      usagePercent: mergedUsage,
      wasteArea: Math.max(0, sheetArea - usedArea),
      gap: plan.gap,
      rotation: orient.deg,
    };
    scenarios.push(sc);

    // "Best" = highest count, tie-break by highest usage%, then by smallest gap.
    if (
      !best ||
      sc.count > best.count ||
      (sc.count === best.count && sc.usagePercent > best.usagePercent) ||
      (sc.count === best.count && sc.usagePercent === best.usagePercent && sc.gap < best.gap)
    ) {
      best = sc;
    }

    opts.onProgress?.({
      scenarioIndex: i + 1,
      totalScenarios: trimmed.length,
      currentBestCount: best?.count ?? 0,
      currentBestUsage: best?.usagePercent ?? 0,
    });
  }

  return { best, scenarios, durationMs: Date.now() - startedAt };
}
