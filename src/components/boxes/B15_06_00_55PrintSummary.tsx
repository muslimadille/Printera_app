// B15_06_00_55 — Print Summary Dialog Modal
// Strictly standardized to T0002PrintSummary.tsx

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { B15_06_00_55Params, B15_06_00_55Geometry } from '@/lib/b15_06_00_55/types';
import type { B15_06_00_55NestingParams, B15_06_00_55NestingResult } from '@/lib/b15_06_00_55/nesting';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  params: B15_06_00_55Params;
  nesting: B15_06_00_55NestingParams;
  nestingResult: B15_06_00_55NestingResult;
  dimUnit: 'mm' | 'cm' | 'in';
  geo: B15_06_00_55Geometry;
}

export default function B15_06_00_55PrintSummary({
  open,
  onOpenChange,
  params,
  nestingResult,
  dimUnit,
  geo,
}: Props) {
  const { derived } = geo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md text-right" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-800">
            ملخص الإنتاج والطباعة — B15.06.00.55
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-xs text-slate-600 mt-2">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 space-y-1.5">
            <div className="font-semibold text-slate-800 text-sm mb-1">أبعاد العلبة</div>
            <div className="flex justify-between">
              <span>العرض (W):</span>
              <span className="font-bold text-slate-800">{params.width} {dimUnit}</span>
            </div>
            <div className="flex justify-between">
              <span>الارتفاع (H):</span>
              <span className="font-bold text-slate-800">{params.height} {dimUnit}</span>
            </div>
            <div className="flex justify-between">
              <span>العمق (D):</span>
              <span className="font-bold text-slate-800">{params.depth} {dimUnit}</span>
            </div>
            <div className="flex justify-between">
              <span>المقاس الإجمالي للقالب:</span>
              <span className="font-bold text-slate-800">
                {derived.totalWidth.toFixed(1)} × {derived.totalHeight.toFixed(1)} {dimUnit}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 space-y-1.5">
            <div className="font-semibold text-slate-800 text-sm mb-1">إعدادات الشيت والتوزيع</div>
            <div className="flex justify-between">
              <span>مقاس الشيت:</span>
              <span className="font-bold text-slate-800">{params.sheetWidth} × {params.sheetHeight} {dimUnit}</span>
            </div>
            <div className="flex justify-between">
              <span>عدد العلب في الشيت:</span>
              <span className="font-bold text-blue-600 text-sm">{nestingResult.total} علبة</span>
            </div>
            <div className="flex justify-between">
              <span>اتجاه التوزيع:</span>
              <span className="font-bold text-slate-800">
                {nestingResult.bestOrientation === 'rotated' ? 'عمودي (90°)' : 'أفقي (0°)'}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
