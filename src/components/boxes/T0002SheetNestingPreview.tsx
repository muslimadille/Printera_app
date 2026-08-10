// T0002 — Sheet Nesting Preview
// Visualizes the sheet, margins, gripper, and the arrayed templates

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import EditableSheetLayout from '@/components/EditableSheetLayout';
import { Edit3, Check } from 'lucide-react';
import type { T0002Params } from '@/lib/t0002/types';
import { usableSheet } from '@/lib/t0002/types';
import { buildT0002Geometry } from '@/lib/t0002/geometry';
import type { Segment } from '@/lib/t0002/geometry';
import type { T0002NestingParams, T0002NestingResult } from '@/lib/t0002/nesting';

const CUT_COLOR = '#ED1C24';
const CREASE_COLOR = '#00A651';

function segPath(s: Segment): string | null {
  if (s.geometry === 'fillet' && s.via && s.bezier) {
    return `M${s.start.x},${s.start.y} L${s.via.x},${s.via.y} C${s.bezier.c1.x},${s.bezier.c1.y} ${s.bezier.c2.x},${s.bezier.c2.y} ${s.end.x},${s.end.y}`;
  }
  if (s.geometry === 'bezier' && s.bezier) {
    return `M${s.start.x},${s.start.y} C${s.bezier.c1.x},${s.bezier.c1.y} ${s.bezier.c2.x},${s.bezier.c2.y} ${s.end.x},${s.end.y}`;
  }
  if (s.geometry === 'polyline' && s.points && s.points.length >= 2) {
    return 'M' + s.points.map(p => `${p.x},${p.y}`).join(' L');
  }
  if (s.geometry === 'arc' && s.arc) {
    return `M ${s.start.x},${s.start.y} A ${s.arc.rx} ${s.arc.ry} ${s.arc.xar} ${s.arc.laf} ${s.arc.sf} ${s.end.x},${s.end.y}`;
  }
  if (s.start.x === s.end.x && s.start.y === s.end.y) return null;
  return `M${s.start.x},${s.start.y} L${s.end.x},${s.end.y}`;
}

interface Props {
  params: T0002Params;
  nesting: T0002NestingParams;
  result: T0002NestingResult;
}

const T0002SheetNestingPreview = ({ params, nesting, result }: Props) => {
  const geo = useMemo(() => buildT0002Geometry(params), [params]);
  const usable = useMemo(() => usableSheet(params), [params]);

  const sheetW = Math.max(1, params.sheetWidth);
  const sheetH = Math.max(1, params.sheetHeight);
  const margin = Math.max(0, params.sheetMargin);
  const gripper = Math.max(0, params.gripper);

  const usableX = margin;
  const usableY = margin + gripper;

  const orientation = result.bestOrientation;
  const grid = orientation === 'rotated' ? result.rotated : result.normal;
  const tW = geo.bbox.w;
  const tH = geo.bbox.h;

  const cellW = orientation === 'rotated' ? tH : tW;
  const cellH = orientation === 'rotated' ? tW : tH;
  const pitchX = grid.pitchX;
  const pitchY = grid.pitchY;
  const brickDx = grid.rowBrickDx ?? 0;
  const brickPhase: 0 | 1 = (grid as { brickPhase?: 0 | 1 }).brickPhase ?? 1;
  const perRowCols = grid.perRowCols && grid.perRowCols.length === grid.rows
    ? grid.perRowCols
    : new Array(grid.rows).fill(grid.columns);

  const creaseSegs = geo.segments.filter(s => s.kind === 'CREASE');
  const cutSegs = geo.segments
    .filter(s => s.kind === 'OUTER' || s.kind === 'CUT')
    .slice()
    .sort((a, b) => a.id - b.id);

  const creaseD = creaseSegs.map(segPath).filter(Boolean).join(' ');
  const cutD = cutSegs.map(segPath).filter(Boolean).join(' ');

  const items: { x: number; y: number }[] = [];
  for (let r = 0; r < grid.rows; r++) {
    const shifted = (r % 2) === brickPhase;
    const rawOffset = shifted ? brickDx : 0;
    const startX = Math.max(0, Math.min(usable.width - cellW, rawOffset));
    const cols = perRowCols[r] ?? 0;
    for (let c = 0; c < cols; c++) {
      items.push({
        x: usableX + startX + c * pitchX,
        y: usableY + r * pitchY,
      });
    }
  }

  const sw = Math.max(0.15, Math.min(sheetW, sheetH) / 1200);
  const sheetSw = Math.max(0.3, Math.min(sheetW, sheetH) / 800);

  const padX = Math.max(sheetW * 0.03, 1.5);
  const padY = Math.max(sheetH * 0.03, 1.5);

  const totalArea = sheetW * sheetH;
  const pieceArea = tW * tH;
  const totalUsedArea = items.length * pieceArea;
  const usagePercent = totalArea > 0 ? Math.min(100, (totalUsedArea / totalArea) * 100) : 0;
  const wasteArea = Math.max(0, totalArea - totalUsedArea);
  const wastePercent = 100 - usagePercent;

  const efficiencyBadge =
    usagePercent >= 85
      ? { label: 'كفاءة ممتازة 🌟', cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' }
      : usagePercent >= 70
        ? { label: 'كفاءة عالية ✨', cls: 'bg-blue-500/15 text-blue-700 border-blue-500/30' }
        : usagePercent >= 55
          ? { label: 'كفاءة مقبولة 👍', cls: 'bg-amber-500/15 text-amber-700 border-amber-500/30' }
          : { label: 'كفاءة منخفضة ⚠️', cls: 'bg-rose-500/15 text-rose-700 border-rose-500/30' };

  const [isManualEdit, setIsManualEdit] = useState(true);
  const [editedPieces, setEditedPieces] = useState<any[] | null>(null);

  const cmSheetW = sheetW / 10;
  const cmSheetH = sheetH / 10;
  const cmTW = tW / 10;
  const cmTH = tH / 10;

  const optimalPieces = useMemo(() => {
    return items.map((it, idx) => ({
      index: idx + 1,
      x: it.x / 10,
      y: it.y / 10,
      w: orientation === 'rotated' ? cmTH : cmTW,
      h: orientation === 'rotated' ? cmTW : cmTH,
      rotated: orientation === 'rotated',
    }));
  }, [items, orientation, cmTW, cmTH]);

  return (
    <div className="w-full h-full relative overflow-hidden flex items-center justify-center p-2 bg-slate-50/50 rounded-xl">
      {/* Floating Edit Button Overlay (only shown when not editing) */}
      {!isManualEdit && (
        <div className="absolute top-3 left-3 z-20">
          <Button
            size="sm"
            variant="default"
            className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-md font-bold rounded-xl px-3 flex items-center transition-all hover:shadow-lg"
            onClick={() => setIsManualEdit(true)}
          >
            <Edit3 className="w-3.5 h-3.5" />
            تفعيل نظام التعديل اليدوي
          </Button>
        </div>
      )}

      {isManualEdit ? (
        <div className="w-full h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <EditableSheetLayout
            sheetW={cmSheetW}
            sheetH={cmSheetH}
            productW={cmTW}
            productH={cmTH}
            gap={nesting.horizontalGap / 10}
            optimalPieces={optimalPieces}
            dielinePaths={{ cutD, creaseD, bbox: geo.bbox }}
            onCountChange={(count, pcs) => setEditedPieces(pcs)}
            initialEnabled={true}
            onExitEdit={() => setIsManualEdit(false)}
          />
        </div>
      ) : (
        <div className="w-full h-full border rounded-xl p-2 bg-white shadow-sm flex justify-center items-center overflow-hidden">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`${-padX} ${-padY} ${sheetW + padX * 2} ${sheetH + padY * 2}`}
            className="w-full h-full max-w-full max-h-full object-contain"
            style={{ background: '#ffffff', borderRadius: '8px' }}
          >
            <rect x={0} y={0} width={sheetW} height={sheetH}
              fill="#ffffff" stroke="#111827" strokeWidth={sheetSw} />
            {gripper > 0 && (
              <rect x={0} y={0} width={sheetW} height={margin + gripper}
                fill="#fee2e2" fillOpacity={0.55} stroke="none" />
            )}
            <rect x={margin} y={margin}
              width={Math.max(0, sheetW - 2 * margin)}
              height={Math.max(0, sheetH - 2 * margin)}
              fill="none" stroke="#94a3b8" strokeWidth={sheetSw}
              strokeDasharray={`${sheetSw * 6} ${sheetSw * 4}`} />
            <rect x={usableX} y={usableY}
              width={usable.width} height={usable.height}
              fill="none" stroke="#3b82f6" strokeWidth={sheetSw}
              strokeDasharray={`${sheetSw * 3} ${sheetSw * 3}`} />

            {items.length === 0 && (
              <text x={sheetW / 2} y={sheetH / 2}
                fontSize={Math.max(6, Math.min(sheetW, sheetH) / 40)}
                fill="#dc2626" textAnchor="middle" dominantBaseline="middle">
                القالب لا يدخل داخل الشيت بالقيم الحالية
              </text>
            )}
            {items.map((it, i) => {
              const transform = orientation === 'rotated'
                ? `translate(${it.x + tH} ${it.y}) rotate(90)`
                : `translate(${it.x} ${it.y})`;
              const labelSize = Math.min(cellW, cellH) * 0.22;
              return (
                <g key={i}>
                  <g transform={transform}>
                    <path d={creaseD} fill="none"
                      stroke={CREASE_COLOR} strokeWidth={sw}
                      strokeLinecap="round" strokeLinejoin="round" />
                    <path d={cutD} fill="none"
                      stroke={CUT_COLOR} strokeWidth={sw * 1.4}
                      strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                  <text x={it.x + cellW / 2} y={it.y + cellH / 2}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={labelSize} fontWeight={700}
                    fill="hsl(var(--primary))" opacity={0.55}
                    style={{ pointerEvents: 'none' }}>
                    {i + 1}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
};

export default T0002SheetNestingPreview;
