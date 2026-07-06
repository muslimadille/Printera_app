/**
 * MergeSmartLayoutPreview — multi-item smart distribution on ONE press sheet.
 *
 * Two algorithms selectable from the UI:
 *   • shelf  — proportional horizontal bands (fast, keeps qty share).
 *   • minwaste — exhaustive search picking row counts + orientations per piece
 *                that minimize the spread of (allocation / required) ratios,
 *                so a single press run finishes all jobs with the least surplus.
 *
 * NOTE: Presentation only. Cost engine still consumes per-piece cutsPerSheet
 * which we feed back via onAllocationsChange.
 */
import { useMemo, useState, useEffect, useRef } from 'react';

export type MergePackAlgorithm = 'shelf' | 'minwaste';

interface MergePiece {
  id: string;
  name?: string;
  printWidth: number;
  printHeight: number;
  quantity: number;
  color?: string;
}

interface MergeSmartLayoutPreviewProps {
  sheetW: number;
  sheetH: number;
  pieces: MergePiece[];
  /** Reports per-piece allocation (cells per sheet) back to parent so the
   *  cost engine can use it. Index matches `pieces` input order. */
  onAllocationsChange?: (allocations: number[]) => void;
}

interface PlacedCell {
  pieceIdx: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
}

interface PlanResult {
  cells: PlacedCell[];
  allocations: number[]; // count per piece on this sheet
  utilization: number;   // 0..1
}

/* Soft palette (theme-friendly HSL) used to color-code pieces in the preview */
const PALETTE = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(142 70% 45%)',
  'hsl(38 92% 50%)',
  'hsl(280 65% 55%)',
  'hsl(0 72% 55%)',
  'hsl(190 80% 45%)',
  'hsl(50 90% 50%)',
];

/** Shelf-pack a uniform rectangle (w×h) into a sheet (sw×sh).
 *  Returns max count fitting + grid (cols, rows) of best orientation. */
function fitUniform(sw: number, sh: number, w: number, h: number) {
  if (w <= 0 || h <= 0 || sw <= 0 || sh <= 0) return { count: 0, cols: 0, rows: 0, cellW: 0, cellH: 0, rotated: false };
  const a = Math.floor(sw / w) * Math.floor(sh / h);
  const b = Math.floor(sw / h) * Math.floor(sh / w);
  if (a >= b) {
    return { count: a, cols: Math.floor(sw / w), rows: Math.floor(sh / h), cellW: w, cellH: h, rotated: false };
  }
  return { count: b, cols: Math.floor(sw / h), rows: Math.floor(sh / w), cellW: h, cellH: w, rotated: true };
}

/**
 * Shelf-pack: proportional horizontal bands by quantity share.
 * Fast and deterministic. Good when qty ratios are very different.
 */
function planShelf(sheetW: number, sheetH: number, pieces: MergePiece[]): PlanResult {
  const cells: PlacedCell[] = [];
  const allocations = new Array(pieces.length).fill(0);
  if (sheetW <= 0 || sheetH <= 0 || pieces.length === 0) {
    return { cells, allocations, utilization: 0 };
  }

  // Single-piece fast path: classic uniform fit
  if (pieces.length === 1) {
    const p = pieces[0];
    const fit = fitUniform(sheetW, sheetH, p.printWidth, p.printHeight);
    for (let r = 0; r < fit.rows; r++) {
      for (let c = 0; c < fit.cols; c++) {
        cells.push({
          pieceIdx: 0,
          x: c * fit.cellW,
          y: r * fit.cellH,
          w: fit.cellW,
          h: fit.cellH,
          rotated: fit.rotated,
        });
      }
    }
    allocations[0] = fit.count;
    const used = fit.count * fit.cellW * fit.cellH;
    return { cells, allocations, utilization: used / (sheetW * sheetH) };
  }

  // Multi-piece: horizontal bands proportional to quantity share
  const totalQty = pieces.reduce((s, p) => s + Math.max(p.quantity, 1), 0);

  // Pre-compute best orientation per piece (assume full sheet width available)
  const oriented = pieces.map((p, idx) => {
    const w = p.printWidth, h = p.printHeight;
    if (w <= 0 || h <= 0) return null;
    // pick orientation that gives more cols across sheetW (taller bands fit fewer rows but more across)
    const colsA = Math.floor(sheetW / w);
    const colsB = Math.floor(sheetW / h);
    if (colsA >= colsB) {
      return { idx, cellW: w, cellH: h, rotated: false, qty: p.quantity, cols: colsA };
    }
    return { idx, cellW: h, cellH: w, rotated: true, qty: p.quantity, cols: colsB };
  }).filter((o): o is NonNullable<typeof o> => o !== null && o.cols > 0 && o.cellH <= sheetH);

  if (oriented.length === 0) {
    return { cells, allocations, utilization: 0 };
  }

  // Allocate vertical band height to each piece proportional to its qty share,
  // but always at least 1 row.
  let cursorY = 0;
  let remainingH = sheetH;

  // Sort by qty desc so big runs get prime real estate first
  const order = [...oriented].sort((a, b) => b.qty - a.qty);

  for (let i = 0; i < order.length; i++) {
    const o = order[i];
    if (remainingH < o.cellH) break;
    const isLast = i === order.length - 1;
    const share = Math.max(o.qty, 1) / totalQty;
    let bandH: number;
    if (isLast) {
      bandH = remainingH;
    } else {
      bandH = Math.max(o.cellH, share * sheetH);
      if (bandH > remainingH) bandH = remainingH;
    }
    const rows = Math.floor(bandH / o.cellH);
    if (rows <= 0) continue;
    const usedH = rows * o.cellH;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < o.cols; c++) {
        cells.push({
          pieceIdx: o.idx,
          x: c * o.cellW,
          y: cursorY + r * o.cellH,
          w: o.cellW,
          h: o.cellH,
          rotated: o.rotated,
        });
      }
    }
    allocations[o.idx] = (allocations[o.idx] || 0) + rows * o.cols;
    cursorY += usedH;
    remainingH -= usedH;
  }

  const usedArea = cells.reduce((s, c) => s + c.w * c.h, 0);
  return { cells, allocations, utilization: usedArea / (sheetW * sheetH) };
}

/**
 * Min-Waste planner: searches across all per-piece orientation choices and
 * row-count assignments along the sheet height. For each candidate it
 * computes max-spread of (allocation/required) across pieces and picks the
 * plan that minimizes that spread (tie-breaker: higher utilization, then
 * smaller max surplus). Cap on combinations keeps it interactive.
 */
function planMinWaste(sheetW: number, sheetH: number, pieces: MergePiece[]): PlanResult {
  if (pieces.length === 1) return planShelf(sheetW, sheetH, pieces);

  // Build orientation options per piece (try BOTH orientations)
  type Opt = { cellW: number; cellH: number; rotated: boolean; cols: number };
  const optsPerPiece = pieces.map(p => {
    const opts: Opt[] = [];
    if (p.printWidth > 0 && p.printHeight > 0) {
      const colsA = Math.floor(sheetW / p.printWidth);
      const colsB = Math.floor(sheetW / p.printHeight);
      if (colsA > 0 && p.printHeight <= sheetH) opts.push({ cellW: p.printWidth, cellH: p.printHeight, rotated: false, cols: colsA });
      if (colsB > 0 && p.printWidth <= sheetH) opts.push({ cellW: p.printHeight, cellH: p.printWidth, rotated: true, cols: colsB });
    }
    return opts;
  });

  if (optsPerPiece.some(o => o.length === 0)) {
    return planShelf(sheetW, sheetH, pieces);
  }

  // For tractability, try each orientation combination, then for each combo
  // greedily search row-counts that balance ratios. Combos = up to 2^N (N≤6 typical).
  const N = pieces.length;
  if (N > 6) return planShelf(sheetW, sheetH, pieces); // fallback for very large N

  let best: { score: number; util: number; cells: PlacedCell[]; allocations: number[] } | null = null;

  const totalCombos = optsPerPiece.reduce((m, o) => m * o.length, 1);
  for (let combo = 0; combo < totalCombos; combo++) {
    // Decode combo -> orientation index per piece
    const chosen: Opt[] = [];
    let c = combo;
    for (let i = 0; i < N; i++) {
      const opts = optsPerPiece[i];
      chosen.push(opts[c % opts.length]);
      c = Math.floor(c / opts.length);
    }

    // For this combo, run a balanced row-allocation:
    // start with 1 row each, then iteratively add a row to the piece with the
    // LOWEST current ratio (allocation/required) until no row fits in remaining height.
    const rows = new Array(N).fill(0);
    let remainingH = sheetH;
    // initial seed: 1 row each if it fits
    for (let i = 0; i < N; i++) {
      if (chosen[i].cellH <= remainingH) {
        rows[i] = 1;
        remainingH -= chosen[i].cellH;
      }
    }
    // greedy expansion
    while (true) {
      let pickIdx = -1;
      let pickRatio = Infinity;
      for (let i = 0; i < N; i++) {
        if (chosen[i].cellH > remainingH) continue;
        const alloc = rows[i] * chosen[i].cols;
        const ratio = alloc / Math.max(pieces[i].quantity, 1);
        if (ratio < pickRatio) { pickRatio = ratio; pickIdx = i; }
      }
      if (pickIdx < 0) break;
      rows[pickIdx]++;
      remainingH -= chosen[pickIdx].cellH;
    }

    // Build cells & allocations for this combo
    const allocations = rows.map((r, i) => r * chosen[i].cols);
    if (allocations.every(a => a === 0)) continue;

    // Compute scoring: spread of ratios (max - min), lower is better.
    const ratios = allocations.map((a, i) => a / Math.max(pieces[i].quantity, 1));
    const valid = ratios.filter((_, i) => allocations[i] > 0);
    const spread = Math.max(...valid) - Math.min(...valid);

    const cells: PlacedCell[] = [];
    let cursorY = 0;
    for (let i = 0; i < N; i++) {
      if (rows[i] === 0) continue;
      const o = chosen[i];
      for (let r = 0; r < rows[i]; r++) {
        for (let cc = 0; cc < o.cols; cc++) {
          cells.push({
            pieceIdx: i,
            x: cc * o.cellW,
            y: cursorY + r * o.cellH,
            w: o.cellW,
            h: o.cellH,
            rotated: o.rotated,
          });
        }
      }
      cursorY += rows[i] * o.cellH;
    }
    const util = cells.reduce((s, k) => s + k.w * k.h, 0) / (sheetW * sheetH);

    if (!best || spread < best.score - 1e-6 || (Math.abs(spread - best.score) < 1e-6 && util > best.util)) {
      best = { score: spread, util, cells, allocations };
    }
  }

  if (!best) return planShelf(sheetW, sheetH, pieces);
  return { cells: best.cells, allocations: best.allocations, utilization: best.util };
}

function planLayout(sheetW: number, sheetH: number, pieces: MergePiece[], algo: MergePackAlgorithm): PlanResult {
  return algo === 'minwaste'
    ? planMinWaste(sheetW, sheetH, pieces)
    : planShelf(sheetW, sheetH, pieces);
}

export function MergeSmartLayoutPreview({ sheetW, sheetH, pieces, onAllocationsChange }: MergeSmartLayoutPreviewProps) {
  const [algo, setAlgo] = useState<MergePackAlgorithm>('shelf');
  const plan = useMemo(() => planLayout(sheetW, sheetH, pieces, algo), [sheetW, sheetH, pieces, algo]);

  // Notify parent on allocation changes (avoid infinite loop: only when array changes)
  const lastSentRef = useRef<string>('');
  useEffect(() => {
    const key = plan.allocations.join(',');
    if (key !== lastSentRef.current) {
      lastSentRef.current = key;
      onAllocationsChange?.(plan.allocations);
    }
  }, [plan.allocations, onAllocationsChange]);

  if (sheetW <= 0 || sheetH <= 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
        أدخل مقاس شيت الطباعة والقطع لبدء التوزيع الذكي.
      </div>
    );
  }

  // Render scaled SVG-like preview using divs
  const VIEW_W = 520;
  const scale = VIEW_W / sheetW;
  const VIEW_H = sheetH * scale;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <span className="text-xs font-bold text-primary">التوزيع الذكي متعدد الأصناف</span>
          <div className="flex items-center gap-0.5 bg-background/60 border border-border rounded-lg p-0.5">
            <button
              onClick={() => setAlgo('shelf')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${algo === 'shelf' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="توزيع بأشرطة أفقية متناسبة مع الكميات (سريع)"
            >أشرطة</button>
            <button
              onClick={() => setAlgo('minwaste')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${algo === 'minwaste' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="بحث شامل عن أقل فائض ممكن لكل الأصناف"
            >أقل فائض</button>
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {sheetW}×{sheetH} سم • استغلال {(plan.utilization * 100).toFixed(1)}%
          </span>
        </div>

        <div
          className="relative bg-background border-2 border-foreground/40 mx-auto"
          style={{ width: VIEW_W, height: VIEW_H }}
        >
          {plan.cells.map((cell, i) => {
            const color = pieces[cell.pieceIdx]?.color || PALETTE[cell.pieceIdx % PALETTE.length];
            return (
              <div
                key={i}
                className="absolute border border-foreground/20 flex items-center justify-center text-[8px] font-bold text-foreground/70"
                style={{
                  left: cell.x * scale,
                  top: cell.y * scale,
                  width: cell.w * scale,
                  height: cell.h * scale,
                  backgroundColor: color,
                  opacity: 0.55,
                }}
                title={`${pieces[cell.pieceIdx]?.name || `صنف ${cell.pieceIdx + 1}`} ${cell.rotated ? '(مدوّر)' : ''}`}
              >
                {cell.w * scale > 28 && cell.h * scale > 14 && (cell.pieceIdx + 1)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Required vs Actual card per piece */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {pieces.map((p, idx) => {
          const perSheet = plan.allocations[idx] || 0;
          const required = Math.max(p.quantity, 0);
          const sheetsNeeded = perSheet > 0 ? Math.ceil(required / perSheet) : 0;
          const produced = perSheet * sheetsNeeded;
          const surplus = produced - required;
          const color = p.color || PALETTE[idx % PALETTE.length];
          return (
            <div key={p.id} className="rounded-lg border border-border bg-card p-2.5 text-xs space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                <span className="font-bold truncate">{p.name || `صنف ${idx + 1}`}</span>
                <span className="text-[10px] text-muted-foreground mr-auto">
                  {p.printWidth}×{p.printHeight}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                <div className="flex justify-between bg-muted/40 rounded px-2 py-1">
                  <span className="text-muted-foreground">المطلوب</span>
                  <span className="font-mono font-bold">{required.toLocaleString()}</span>
                </div>
                <div className="flex justify-between bg-primary/10 rounded px-2 py-1">
                  <span className="text-muted-foreground">/شيت</span>
                  <span className="font-mono font-bold text-primary">{perSheet}</span>
                </div>
                <div className="flex justify-between bg-accent/10 rounded px-2 py-1">
                  <span className="text-muted-foreground">عدد الشيتات</span>
                  <span className="font-mono font-bold">{sheetsNeeded}</span>
                </div>
                <div className={`flex justify-between rounded px-2 py-1 ${surplus > required * 0.1 ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10'}`}>
                  <span className="text-muted-foreground">فائض</span>
                  <span className="font-mono font-bold">{surplus >= 0 ? '+' : ''}{surplus}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed bg-muted/30 rounded p-2">
        💡 المحرك يوزّع الأصناف بأشرطة أفقية متناسبة مع الكمية المطلوبة لكل صنف، مع تجريب التدوير لكل صنف
        لاختيار الاتجاه الذي يستوعب أكبر عدد من القطع. عدّل المقاسات أو الكميات لإعادة التوزيع تلقائيًا.
      </p>
    </div>
  );
}

export default MergeSmartLayoutPreview;
