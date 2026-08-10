import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import EditableSheetLayout from '@/components/EditableSheetLayout';
import { Edit3, Check } from 'lucide-react';
import type { A60_20_01_01Params } from '@/lib/a60_20_01_01/types';
import { buildA60_20_01_01Geometry } from '@/lib/a60_20_01_01/geometry';
import type { A60_20_01_01NestingParams } from '@/lib/a60_20_01_01/nesting';
import { computeA60_20_01_01Nesting } from '@/lib/a60_20_01_01/nesting';

const CUT_COLOR = '#e30613';
const CREASE_COLOR = '#009640';

function segPath(s: any): string | null {
  if (s.d) return s.d;
  if (s.points && s.points.length >= 2) {
    return 'M' + s.points.map((p: any) => `${p.x},${p.y}`).join(' L');
  }
  if (s.start && s.end) {
    if (s.start.x === s.end.x && s.start.y === s.end.y) return null;
    return `M${s.start.x},${s.start.y} L${s.end.x},${s.end.y}`;
  }
  return null;
}

interface Props {
  params: A60_20_01_01Params;
  nesting: A60_20_01_01NestingParams;
}

const A60_20_01_01SheetNestingPreview = ({ params, nesting }: Props) => {
  const geo = useMemo(() => buildA60_20_01_01Geometry(params), [params]);
  const result = useMemo(() => computeA60_20_01_01Nesting(params, nesting), [params, nesting]);

  const sheetW = Math.max(1, params.sheetWidth || 100);
  const sheetH = Math.max(1, params.sheetHeight || 70);
  const margin = Math.max(0, params.sheetMargin || 0);
  const gripper = Math.max(0, params.gripper || 0);

  const usableX = margin;
  const usableY = margin + gripper;

  const orientation = result.bestOrientation;
  const grid = orientation === 'rotated' ? result.rotated : result.normal;
  const tW = geo.bbox.w || 10;
  const tH = geo.bbox.h || 10;

  const cellW = orientation === 'rotated' ? tH : tW;
  const cellH = orientation === 'rotated' ? tW : tH;

  const creaseSegs = geo.segments.filter(s => s.kind === 'CREASE');
  const cutSegs = geo.segments.filter(s => s.kind !== 'CREASE');

  const creaseD = creaseSegs.map(segPath).filter(Boolean).join(' ');
  const cutD = cutSegs.map(segPath).filter(Boolean).join(' ');

  const items: { x: number; y: number }[] = [];
  for (let r = 0; r < (grid.rows || 0); r++) {
    for (let c = 0; c < (grid.columns || 0); c++) {
      items.push({
        x: usableX + c * grid.pitchX,
        y: usableY + r * grid.pitchY,
      });
    }
  }

  const [isManualEdit, setIsManualEdit] = useState(true);
  const [editedPieces, setEditedPieces] = useState<any[] | null>(null);

  const cmSheetW = sheetW / 10;
  const cmSheetH = sheetH / 10;
  const cmTW = tW / 10;
  const cmTH = tH / 10;

  const optimalPieces = useMemo(() => {
    return items.map((it, idx) => ({
      index: idx + 1,
      x: (it.x || 0) / 10,
      y: (it.y || 0) / 10,
      w: orientation === 'rotated' ? cmTH : cmTW,
      h: orientation === 'rotated' ? cmTW : cmTH,
      rotated: orientation === 'rotated',
    }));
  }, [items, orientation, cmTW, cmTH]);

  const padX = Math.max(sheetW * 0.03, 1.5);
  const padY = Math.max(sheetH * 0.03, 1.5);

  const effPercent = Number.isFinite(result.efficiencyPercentage) ? result.efficiencyPercentage : 0;

  const efficiencyBadge =
    effPercent >= 85
      ? { label: 'كفاءة ممتازة 🌟', cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' }
      : effPercent >= 70
        ? { label: 'كفاءة عالية ✨', cls: 'bg-blue-500/15 text-blue-700 border-blue-500/30' }
        : effPercent >= 55
          ? { label: 'كفاءة مقبولة 👍', cls: 'bg-amber-500/15 text-amber-700 border-amber-500/30' }
          : { label: 'كفاءة منخفضة ⚠️', cls: 'bg-rose-500/15 text-rose-700 border-rose-500/30' };

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
            <rect x={0} y={0} width={sheetW} height={sheetH} fill="#ffffff" stroke="#111827" strokeWidth={1} />
            {gripper > 0 && (
              <rect x={0} y={0} width={sheetW} height={margin + gripper} fill="#fee2e2" fillOpacity={0.55} stroke="none" />
            )}
            <rect
              x={margin}
              y={margin}
              width={Math.max(0, sheetW - 2 * margin)}
              height={Math.max(0, sheetH - 2 * margin)}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="6 4"
            />
            {items.map((it, idx) => (
              <g key={idx} transform={`translate(${it.x}, ${it.y}) ${orientation === 'rotated' ? `rotate(90 ${cellW / 2} ${cellH / 2})` : ''}`}>
                {geo.segments.map((seg) => {
                  const stroke = seg.strokeColor || (seg.kind === 'CREASE' ? CREASE_COLOR : CUT_COLOR);
                  const dash = seg.kind === 'CREASE' ? '2,2' : undefined;
                  const pD = segPath(seg);
                  return pD ? (
                    <path key={seg.id} d={pD} stroke={stroke} strokeWidth="0.5" fill="none" strokeDasharray={dash} />
                  ) : null;
                })}
              </g>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
};

export default A60_20_01_01SheetNestingPreview;
