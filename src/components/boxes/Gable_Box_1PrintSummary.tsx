import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { Gable_Box_1Dimensions, Gable_Box_1NestingParams, Gable_Box_1Geometry, Gable_Box_1NestingResult } from '@/lib/gable_box_1';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  params: Gable_Box_1Dimensions;
  nesting: Gable_Box_1NestingParams;
  nestingResult: Gable_Box_1NestingResult;
  dimUnit: string;
  geo: Gable_Box_1Geometry;
}

export default function Gable_Box_1PrintSummary({
  open,
  onOpenChange,
  params,
  nesting,
  nestingResult,
  dimUnit,
  geo,
}: Props) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl text-right dir-rtl p-6 bg-white rounded-2xl shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-slate-900 border-b pb-3">
            ملخص مواصفات القالب — Gable_Box_1
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 my-2 text-sm text-slate-700">
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <p className="font-bold text-slate-900 mb-1">أبعاد العلبة:</p>
              <ul className="space-y-1 text-xs">
                <li>العرض (W): {params.width} {dimUnit}</li>
                <li>الارتفاع (H): {params.height} {dimUnit}</li>
                <li>العمق (D): {params.depth} {dimUnit}</li>
                <li>لسان اللصق (Gf): {params.glueFlap} {dimUnit}</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-slate-900 mb-1">بيانات الإفراد والتوزيع:</p>
              <ul className="space-y-1 text-xs">
                <li>إجمالي عرض الإفراد: {geo.width.toFixed(1)} مم</li>
                <li>إجمالي ارتفاع الإفراد: {geo.height.toFixed(1)} مم</li>
                <li>أبعاد الفرخ: {nesting.sheetWidth} × {nesting.sheetHeight} مم</li>
                <li>العدد الإجمالي بالفرخ: {nestingResult.bestTotal} علبة</li>
                <li>نسبة استغلال الفرخ: {nestingResult.utilization.toFixed(1)}%</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
          <Button onClick={handlePrint} className="gap-2 bg-slate-900 text-white hover:bg-slate-800">
            <Printer className="w-4 h-4" />
            طباعة المواصفات
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
