/**
 * Auto-Nest Web Worker
 * ────────────────────
 * Runs `runAutoNest` off the main thread and streams progress.
 *
 * Messages received: { type: 'run', shape, sheetW, sheetH, gap }
 * Messages posted:
 *   { type: 'progress', payload: AutoNestProgress }
 *   { type: 'done', payload: AutoNestResult }
 *   { type: 'error', message: string }
 */

import { runAutoNest } from '@/lib/autoNestEngine';
import type { DielineShape } from '@/lib/dielineGeometry';

interface RunMsg {
  type: 'run';
  shape: DielineShape;
  sheetW: number;
  sheetH: number;
  gap: number;
}

self.onmessage = (e: MessageEvent<RunMsg>) => {
  const msg = e.data;
  if (msg?.type !== 'run') return;
  try {
    const result = runAutoNest(msg.shape, msg.sheetW, msg.sheetH, {
      baseGap: msg.gap,
      maxScenarios: 8,
      timeBudgetMs: 3000,
      onProgress: (p) => {
        (self as unknown as Worker).postMessage({ type: 'progress', payload: p });
      },
    });
    (self as unknown as Worker).postMessage({ type: 'done', payload: result });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

export {};
