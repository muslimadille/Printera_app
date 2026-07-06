/**
 * Auto-Nest Web Worker — V2 (Advanced)
 * Used by the new "مونتاج قالب" tab. Runs `runAutoNestV2` (4-rotation per
 * piece + Skyline BLF) off the main thread.
 */

import { runAutoNestV2 } from '@/lib/autoNestEngineV2';
import type { DielineShape } from '@/lib/dielineGeometry';

interface RunMsg {
  type: 'run';
  shape: DielineShape;
  sheetW: number;
  sheetH: number;
  gap: number;
  footprintW?: number;
  footprintH?: number;
}

self.onmessage = (e: MessageEvent<RunMsg>) => {
  const msg = e.data;
  if (msg?.type !== 'run') return;
  try {
    const result = runAutoNestV2(msg.shape, msg.sheetW, msg.sheetH, {
      baseGap: msg.gap,
      footprintW: msg.footprintW,
      footprintH: msg.footprintH,
      maxScenarios: 24,
      timeBudgetMs: 22000,
      maxGapFillExtras: 120,
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
