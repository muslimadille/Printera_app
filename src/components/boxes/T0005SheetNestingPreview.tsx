import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import EditableSheetLayout from '@/components/EditableSheetLayout';
import { Edit3, Check } from 'lucide-react';
import type { T0005Params } from '@/lib/t0005/types';
import { usableSheet } from '@/lib/t0005/types';
import { buildT0005Geometry } from '@/lib/t0005/geometry';
import type { Segment } from '@/lib/t0005/geometry';
import type { T0005NestingParams, T0005NestingResult } from '@/lib/t0005/nesting';

const CUT_COLOR = '#e30613';
const CREASE_COLOR = '#009640';

function segPath(s: Segment): string | null {
  if (s.geometry === 'polyline' && s.points && s.points.length >= 2) {
    return 'M' + s.points.map(p => `${p.x},${p.y}`).join(' L');
  }
  if (s.geometry === 'arc' && s.arc) {
    return `M ${s.start.x},${s.start.y} A ${s.arc.rx} ${s.arc.ry} ${s.arc.xar} ${s.arc.laf} ${s.arc.sf} ${s.end.x},${s.end.y}`;
  }
  if (s.geometry === 'bezier' && s.points) {
    const start = s.points[0];
    const p1 = s.points[1];
    const end = s.points[3] || s.points[2];
    const r = (n: number) => Math.round(n * 100000) / 100000;
    return `M${start.x},${start.y} L${p1.x},${p1.y} C${r(195.206)},${r(207.039)} ${r(197.393)},${r(210.246)} ${r(199.58)},${r(211.706)} L${r(224.832)},${r(211.706)} C${r(227.019)},${r(210.245)} ${r(229.206)},${r(207.039)} ${r(229.206)},${r(202.206)} L${end.x},${end.y}`;
  }
  if (s.start.x === s.end.x && s.start.y === s.end.y) return null;
  return `M${s.start.x},${s.start.y} L${s.end.x},${s.end.y}`;
}

interface Props {
  params: T0005Params;
  nesting: T0005NestingParams;
  result: T0005NestingResult;
}

const T0005SheetNestingPreview = ({ params, nesting, result }: Props) => {
  const geo = useMemo(() => buildT0005Geometry(params), [params]);
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

  const [isManualEdit, setIsManualEdit] = useState(false);
  const [, setEditedPieces] = useState<any[] | null>(null);

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
      {/* Floating Edit Button Overlay */}
      <div className="absolute top-3 left-3 z-20">
        <Button
          size="sm"
          variant={isManualEdit ? 'default' : 'outline'}
          className="h-8 text-xs gap-1.5 bg-white/90 hover:bg-white backdrop-blur-md text-slate-800 border border-slate-200/80 shadow-md font-bold rounded-xl px-3 flex items-center transition-all hover:shadow-lg"
          onClick={() => setIsManualEdit(!isManualEdit)}
        >
          {isManualEdit ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Edit3 className="w-3.5 h-3.5 text-slate-700" />}
          {isManualEdit ? 'إنهاء التعديل' : 'تفعيل التعديل اليدوي'}
        </Button>
      </div>

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

export default T0005SheetNestingPreview;

