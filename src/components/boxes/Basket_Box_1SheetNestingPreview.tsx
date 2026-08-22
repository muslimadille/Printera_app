import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import EditableSheetLayout from '@/components/EditableSheetLayout';
import { Edit3 } from 'lucide-react';
import {
  Basket_Box_1Params,
  generateBasket_Box_1Geometry,
  computeBasket_Box_1Nesting,
  Basket_Box_1Segment,
} from '@/lib/basket_box_1';

const CUT_COLOR = '#ED1C24';
const CREASE_COLOR = '#00A651';

function segPath(s: Basket_Box_1Segment): string | null {
  if (s.d) return s.d;
  if (!s.start || !s.end) return null;
  if (s.start.x === s.end.x && s.start.y === s.end.y) return null;
  return `M${s.start.x},${s.start.y} L${s.end.x},${s.end.y}`;
}

interface Props {
  params: Basket_Box_1Params;
}

export default function Basket_Box_1SheetNestingPreview({ params }: Props) {
  const geo = useMemo(() => generateBasket_Box_1Geometry(params), [params]);
  const result = useMemo(() => computeBasket_Box_1Nesting(params), [params]);

  const sheetW = Math.max(1, params.sheetWidth);
  const sheetH = Math.max(1, params.sheetHeight);
  const margin = Math.max(0, params.sheetMargin);
  const gripper = Math.max(0, params.gripper);

  const usableX = margin;
  const usableY = margin + gripper;
  const usableW = Math.max(0, sheetW - margin * 2);
  const usableH = Math.max(0, sheetH - margin * 2 - gripper);

  const tW = geo.bbox.width;
  const tH = geo.bbox.height;

  const isRot = result.items.length > 0 && result.items[0].rotation === 90;
  const cellW = isRot ? tH : tW;
  const cellH = isRot ? tW : tH;

  const creaseSegs = geo.segments.filter(s => s.kind === 'CREASE');
  const cutSegs = geo.segments.filter(s => s.kind === 'OUTER' || s.kind === 'CUT');

  const creaseD = creaseSegs.map(segPath).filter(Boolean).join(' ');
  const cutD = cutSegs.map(segPath).filter(Boolean).join(' ');

  const sw = Math.max(0.15, Math.min(sheetW, sheetH) / 1200);
  const sheetSw = Math.max(0.3, Math.min(sheetW, sheetH) / 800);

  const padX = Math.max(sheetW * 0.03, 1.5);
  const padY = Math.max(sheetH * 0.03, 1.5);

  const totalArea = sheetW * sheetH;
  const pieceArea = tW * tH;
  const totalUsedArea = result.items.length * pieceArea;
  const usagePercent = totalArea > 0 ? Math.min(100, (totalUsedArea / totalArea) * 100) : 0;
  const wastePercent = 100 - usagePercent;

  const efficiencyBadge =
    usagePercent >= 85
      ? { label: 'كفاءة ممتازة 🌟', cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' }
      : usagePercent >= 70
        ? { label: 'كفاءة عالية ✨', cls: 'bg-blue-500/15 text-blue-700 border-blue-500/30' }
        : usagePercent >= 55
          ? { label: 'كفاءة مقبولة 👍', cls: 'bg-amber-500/15 text-amber-700 border-amber-500/30' }
          : { label: 'كفاءة منخفضة ⚠️', cls: 'bg-rose-500/15 text-rose-700 border-rose-500/30' };

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
      w: isRot ? cmTH : cmTW,
      h: isRot ? cmTW : cmTH,
      rotated: isRot,
    }));
  }, [result.items, isRot, cmTW, cmTH]);

  return (
    <div className="w-full h-full relative overflow-hidden flex items-center justify-center p-2 bg-slate-50/50 rounded-xl">
      {/* Floating Edit Button Overlay */}
      {!isManualEdit && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
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

      {/* Top Right Stats Indicator */}
      {!isManualEdit && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2 bg-white/95 backdrop-blur-sm border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm font-mono text-xs text-slate-700">
          <span>العدد: <strong className="text-slate-900 font-bold">{result.count}</strong> قطعة</span>
          <span className="text-slate-300">•</span>
          <span>الاستغلال: <strong className="text-emerald-700 font-bold">{usagePercent.toFixed(1)}%</strong></span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${efficiencyBadge.cls}`}>
            {efficiencyBadge.label}
          </span>
        </div>
      )}

      {isManualEdit ? (
        <div className="w-full h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <EditableSheetLayout
            sheetW={cmSheetW}
            sheetH={cmSheetH}
            productW={cmTW}
            productH={cmTH}
            gap={(params.spacing || 3) / 10}
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
            {/* Sheet Border */}
            <rect
              x={0}
              y={0}
              width={sheetW}
              height={sheetH}
              fill="#ffffff"
              stroke="#111827"
              strokeWidth={sheetSw}
            />

            {/* Gripper Margin Area */}
            {gripper > 0 && (
              <rect
                x={0}
                y={0}
                width={sheetW}
                height={margin + gripper}
                fill="#fee2e2"
                fillOpacity={0.55}
                stroke="none"
              />
            )}

            {/* Sheet Margin Boundary */}
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

            {/* Usable Area Boundary */}
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

            {result.items.length === 0 && (
              <text
                x={sheetW / 2}
                y={sheetH / 2}
                fontSize={Math.max(6, Math.min(sheetW, sheetH) / 40)}
                fill="#dc2626"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                القالب لا يدخل داخل الشيت بالقيم الحالية
              </text>
            )}

            {/* Render Items */}
            {result.items.map((it, i) => {
              const transform = isRot
                ? `translate(${it.x + tH} ${it.y}) rotate(90)`
                : `translate(${it.x} ${it.y})`;
              const labelSize = Math.min(cellW, cellH) * 0.22;
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
                    fill="hsl(var(--primary))"
                    opacity={0.55}
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
