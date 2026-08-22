import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import EditableSheetLayout from '@/components/EditableSheetLayout';
import { Edit3 } from 'lucide-react';
import type { F10_41_00_00Dimensions, F10_41_00_00NestingParams } from '@/lib/f10_41_00_00/types';
import { generateF10_41_00_00Geometry } from '@/lib/f10_41_00_00/geometry';
import { computeF10_41_00_00Nesting } from '@/lib/f10_41_00_00/nesting';

const CUT_COLOR = '#ED1C24';
const CREASE_COLOR = '#00A651';
const LOCK_CREASE_COLOR = '#c8b700';

export default function F10_41_00_00SheetNestingPreview({
  dimensions,
  nesting,
}: {
  dimensions: F10_41_00_00Dimensions;
  nesting: F10_41_00_00NestingParams;
}) {
  const geo = useMemo(() => generateF10_41_00_00Geometry(dimensions), [dimensions]);
  const result = useMemo(() => computeF10_41_00_00Nesting(dimensions, nesting), [dimensions, nesting]);

  const sheetW = Math.max(1, nesting.sheetWidth);
  const sheetH = Math.max(1, nesting.sheetHeight);
  const margin = Math.max(0, nesting.margin);
  const gripper = Math.max(0, nesting.gripper ?? 0);

  const usableX = margin;
  const usableY = margin + gripper;

  const orientation = result.bestOrientation;
  const tW = geo.width;
  const tH = geo.height;

  const cellW = orientation === 'rotated' ? tH : tW;
  const cellH = orientation === 'rotated' ? tW : tH;

  const creaseD = geo.creaseLines.map(l => `M${l.start.x},${l.start.y} L${l.end.x},${l.end.y}`).join(' ');
  const lockCreaseD = geo.lockCreaseLines.map(l => `M${l.start.x},${l.start.y} L${l.end.x},${l.end.y}`).join(' ');
  const cutD = geo.cutLines.map(l => `M${l.start.x},${l.start.y} L${l.end.x},${l.end.y}`).join(' ');

  const sw = Math.max(0.15, Math.min(sheetW, sheetH) / 1200);
  const sheetSw = Math.max(0.3, Math.min(sheetW, sheetH) / 800);

  const padX = Math.max(sheetW * 0.03, 1.5);
  const padY = Math.max(sheetH * 0.03, 1.5);

  const [isManualEdit, setIsManualEdit] = useState(false);
  const [editedPieces, setEditedPieces] = useState<any[] | null>(null);

  const cmSheetW = sheetW / 10;
  const cmSheetH = sheetH / 10;
  const cmTW = tW / 10;
  const cmTH = tH / 10;

  const optimalPieces = useMemo(() => {
    return result.items.map((it, idx) => ({
      index: idx + 1,
      x: it.x / 10,
      y: it.y / 10,
      w: orientation === 'rotated' ? cmTH : cmTW,
      h: orientation === 'rotated' ? cmTW : cmTH,
      rotated: orientation === 'rotated',
    }));
  }, [result.items, orientation, cmTW, cmTH]);

  return (
    <div className="w-full h-full relative overflow-hidden flex items-center justify-center p-2 bg-slate-50/50 rounded-xl">
      {/* Floating Edit Button Overlay */}
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
            gap={nesting.spacing / 10}
            optimalPieces={optimalPieces}
            dielinePaths={{ cutD, creaseD: `${creaseD} ${lockCreaseD}`, bbox: geo.bbox }}
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
              width={result.usableSheet.width} height={result.usableSheet.height}
              fill="none" stroke="#3b82f6" strokeWidth={sheetSw}
              strokeDasharray={`${sheetSw * 3} ${sheetSw * 3}`} />

            {result.items.length === 0 && (
              <text x={sheetW / 2} y={sheetH / 2}
                fontSize={Math.max(6, Math.min(sheetW, sheetH) / 40)}
                fill="#dc2626" textAnchor="middle" dominantBaseline="middle">
                القالب لا يدخل داخل الشيت بالقيم الحالية
              </text>
            )}
            {result.items.map((it, i) => {
              const transform = orientation === 'rotated'
                ? `translate(${it.x + tH} ${it.y}) rotate(90)`
                : `translate(${it.x} ${it.y})`;
              const labelSize = Math.min(cellW, cellH) * 0.22;
              return (
                <g key={i}>
                  <g transform={transform}>
                    <path d={creaseD} fill="none"
                      stroke={CREASE_COLOR} strokeWidth={sw}
                      strokeDasharray="3,2"
                      strokeLinecap="round" strokeLinejoin="round" />
                    {lockCreaseD && (
                      <path d={lockCreaseD} fill="none"
                        stroke={LOCK_CREASE_COLOR} strokeWidth={sw}
                        strokeLinecap="round" strokeLinejoin="round" />
                    )}
                    <path d={cutD} fill="none"
                      stroke={CUT_COLOR} strokeWidth={sw * 1.4}
                      strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                  <text x={it.x + cellW / 2} y={it.y + cellH / 2}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={labelSize} fontWeight={700}
                    fill="#2563eb" opacity="0.55"
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
}
