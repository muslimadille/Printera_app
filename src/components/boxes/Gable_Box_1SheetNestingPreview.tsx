// Gable_Box_1 — Sheet Nesting Preview
// Visualizes the sheet, margins, and the arrayed templates with Gold Standard compliance

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import EditableSheetLayout from '@/components/EditableSheetLayout';
import { Edit3 } from 'lucide-react';
import {
  Gable_Box_1Dimensions,
  Gable_Box_1NestingParams,
  generateGable_Box_1Geometry,
  computeGable_Box_1Nesting,
} from '@/lib/gable_box_1';

const CUT_COLOR = '#e21f26';
const CREASE_COLOR = '#0a9748';

interface Props {
  dimensions: Gable_Box_1Dimensions;
  nesting: Gable_Box_1NestingParams;
}

export default function Gable_Box_1SheetNestingPreview({ dimensions, nesting }: Props) {
  const [isManualEdit, setIsManualEdit] = useState(false);
  const geo = useMemo(() => generateGable_Box_1Geometry(dimensions), [dimensions]);
  const result = useMemo(() => computeGable_Box_1Nesting(dimensions, nesting), [dimensions, nesting]);

  const sheetW = Math.max(1, nesting.sheetWidth);
  const sheetH = Math.max(1, nesting.sheetHeight);
  const margin = Math.max(0, nesting.margin);
  const spacing = Math.max(0, nesting.spacing);

  const usableX = margin;
  const usableY = margin;
  const usableW = Math.max(0, sheetW - margin * 2);
  const usableH = Math.max(0, sheetH - margin * 2);

  const orientation = result.bestOrientation;
  const isRot = orientation === 'rotated';
  const tW = geo.width;
  const tH = geo.height;

  const cellW = isRot ? tH : tW;
  const cellH = isRot ? tW : tH;

  const countX = isRot ? result.rotatedCountX : result.normalCountX;
  const countY = isRot ? result.rotatedCountY : result.normalCountY;

  // Separate Crease and Cut paths for highest rendering fidelity
  const creaseSegs = geo.segments.filter(s => s.kind === 'CREASE');
  const cutSegs = geo.segments.filter(s => s.kind === 'OUTER' || s.kind === 'CUT');

  const segToD = (s: typeof geo.segments[0]): string => {
    if (s.geometry === 'path' && s.d) return s.d;
    if (s.geometry === 'line') return `M ${s.start.x} ${s.start.y} L ${s.end.x} ${s.end.y}`;
    return '';
  };

  const creaseD = creaseSegs.map(segToD).filter(Boolean).join(' ');
  const cutD = cutSegs.map(segToD).filter(Boolean).join(' ');

  const items: { x: number; y: number }[] = [];
  for (let r = 0; r < countY; r++) {
    for (let c = 0; c < countX; c++) {
      items.push({
        x: usableX + c * (cellW + spacing),
        y: usableY + r * (cellH + spacing),
      });
    }
  }

  const sw = Math.max(0.2, Math.min(sheetW, sheetH) / 1400);
  const sheetSw = Math.max(0.4, Math.min(sheetW, sheetH) / 900);

  const padX = Math.max(sheetW * 0.03, 2);
  const padY = Math.max(sheetH * 0.03, 2);

  // Measurements in cm for EditableSheetLayout
  const cmSheetW = sheetW / 10;
  const cmSheetH = sheetH / 10;
  const cmTW = tW / 10;
  const cmTH = tH / 10;

  const optimalPieces = useMemo(() => {
    return items.map((it, idx) => ({
      index: idx + 1,
      x: it.x / 10,
      y: it.y / 10,
      w: isRot ? cmTH : cmTW,
      h: isRot ? cmTW : cmTH,
      rotated: isRot,
    }));
  }, [items, isRot, cmTW, cmTH]);

  return (
    <div className="w-full h-full relative overflow-hidden flex items-center justify-center p-2 bg-slate-50/50 rounded-xl">
      {/* Floating Header Info & Manual Edit Button Overlay */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
        {!isManualEdit && (
          <Button
            size="sm"
            variant="default"
            className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-md font-bold rounded-xl px-3 flex items-center transition-all hover:shadow-lg"
            onClick={() => setIsManualEdit(true)}
          >
            <Edit3 className="w-3.5 h-3.5" />
            تفعيل نظام التعديل اليدوي
          </Button>
        )}
        <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-xs font-bold text-slate-700">
          العدد: {result.bestTotal} قطعة ({result.utilization.toFixed(1)}%)
        </div>
      </div>

      {isManualEdit ? (
        <div className="w-full h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <EditableSheetLayout
            sheetW={cmSheetW}
            sheetH={cmSheetH}
            productW={cmTW}
            productH={cmTH}
            gap={spacing / 10}
            optimalPieces={optimalPieces}
            dielinePaths={{ cutD, creaseD, bbox: { x: 0, y: 0, w: tW, h: tH } }}
            onCountChange={() => {}}
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
            {/* Sheet Outer Border */}
            <rect
              x={0}
              y={0}
              width={sheetW}
              height={sheetH}
              fill="#ffffff"
              stroke="#111827"
              strokeWidth={sheetSw}
            />

            {/* Sheet Margin Line */}
            <rect
              x={margin}
              y={margin}
              width={Math.max(0, sheetW - 2 * margin)}
              height={Math.max(0, sheetH - 2 * margin)}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={sheetSw}
              strokeDasharray={`${sheetSw * 6} ${sheetSw * 4}`}
            />

            {/* Usable Area Line */}
            <rect
              x={usableX}
              y={usableY}
              width={usableW}
              height={usableH}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={sheetSw}
              strokeDasharray={`${sheetSw * 3} ${sheetSw * 3}`}
            />

            {items.length === 0 && (
              <g>
                <text
                  x={sheetW / 2}
                  y={sheetH / 2 - 10}
                  fontSize={Math.max(12, Math.min(sheetW, sheetH) / 30)}
                  fontWeight="bold"
                  fill="#dc2626"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontFamily="sans-serif"
                >
                  القالب لا يتسع داخل أبعاد الشيت الحالية
                </text>
                <text
                  x={sheetW / 2}
                  y={sheetH / 2 + 15}
                  fontSize={Math.max(9, Math.min(sheetW, sheetH) / 45)}
                  fill="#64748b"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontFamily="sans-serif"
                >
                  أبعاد القالب: {tW.toFixed(0)} × {tH.toFixed(0)} مم — يرجى زيادة أبعاد الشيت في الشريط الجانبي
                </text>
              </g>
            )}

            {/* Render Nested Box Instances */}
            {items.map((it, i) => {
              const transform = isRot
                ? `translate(${it.x + tH} ${it.y}) rotate(90)`
                : `translate(${it.x} ${it.y})`;
              const labelSize = Math.min(cellW, cellH) * 0.18;
              return (
                <g key={i}>
                  <g transform={transform}>
                    <path
                      d={creaseD}
                      fill="none"
                      stroke={CREASE_COLOR}
                      strokeWidth={sw}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d={cutD}
                      fill="none"
                      stroke={CUT_COLOR}
                      strokeWidth={sw * 1.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                  <text
                    x={it.x + cellW / 2}
                    y={it.y + cellH / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={labelSize}
                    fontWeight={700}
                    fill="#3b82f6"
                    opacity={0.65}
                    style={{ pointerEvents: 'none' }}
                  >
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
