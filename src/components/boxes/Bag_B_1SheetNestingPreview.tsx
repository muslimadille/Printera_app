import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import EditableSheetLayout from '@/components/EditableSheetLayout';
import { Edit3 } from 'lucide-react';
import { Bag_B_1Dimensions } from '@/lib/bag_b_1/types';
import { generateBag_B_1Geometry } from '@/lib/bag_b_1/geometry';
import { Bag_B_1NestingParams, computeBag_B_1Nesting } from '@/lib/bag_b_1/nesting';

const CUT_COLOR = '#ED1C24';
const CREASE_COLOR = '#00A651';

export default function Bag_B_1SheetNestingPreview({ 
  dimensions, 
  nesting 
}: { 
  dimensions: Bag_B_1Dimensions;
  nesting: Bag_B_1NestingParams;
}) {
  const geo = useMemo(() => generateBag_B_1Geometry(dimensions), [dimensions]);
  const result = useMemo(() => computeBag_B_1Nesting(dimensions, nesting), [dimensions, nesting]);

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
  const cutLinesD = geo.cutLines.map(l => `M${l.start.x},${l.start.y} L${l.end.x},${l.end.y}`).join(' ');
  const cutCirclesD = geo.cutCircles.map(c => `M${c.cx - c.r},${c.cy} a${c.r},${c.r} 0 1,0 ${c.r * 2},0 a${c.r},${c.r} 0 1,0 -${c.r * 2},0`).join(' ');
  const cutD = `${cutLinesD} ${cutCirclesD}`;

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
