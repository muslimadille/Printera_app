import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { Basket_Box_1Params, Basket_Box_1Geometry, BasketNestingResult } from '@/lib/basket_box_1';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  params: Basket_Box_1Params;
  nestingResult: BasketNestingResult;
  dimUnit: string;
  geo: Basket_Box_1Geometry;
}

export default function Basket_Box_1PrintSummary({
  open,
  onOpenChange,
  params,
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
            ملخص مواصفات القالب — علبة سلة K018 (Basket Box 1)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 my-2 text-sm text-slate-700">
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <p className="font-bold text-slate-900 mb-1">أبعاد العلبة (المقاس الداخلي):</p>
              <ul className="space-y-1 text-xs">
                <li>الطول (L): {params.width} {dimUnit}</li>
                <li>العرض (W): {params.depth} {dimUnit}</li>
                <li>العمق (D): {params.height} {dimUnit}</li>
                <li>عنق المقبض: {geo.derived.handleNeckH.toFixed(1)} مم</li>
                <li>قبضة المقبض: {geo.derived.handleGripH.toFixed(1)} مم</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-slate-900 mb-1">بيانات الإفراد والتوزيع:</p>
              <ul className="space-y-1 text-xs">
                <li>إجمالي عرض الإفراد: {geo.bbox.width.toFixed(1)} مم</li>
                <li>إجمالي ارتفاع الإفراد: {geo.bbox.height.toFixed(1)} مم</li>
                <li>أبعاد الفرخ: {params.sheetWidth} × {params.sheetHeight} مم</li>
                <li>عدد العلب بالفرخ: <strong className="text-emerald-700 font-bold">{nestingResult.count} علبة</strong></li>
                <li>نسبة الاستغلال: <strong className="text-emerald-700 font-bold">{nestingResult.efficiency.toFixed(1)}%</strong></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
          <Button onClick={handlePrint} className="bg-slate-900 text-white hover:bg-slate-800 gap-1.5 font-bold">
            <Printer className="w-4 h-4" />
            طباعة المواصفات
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
