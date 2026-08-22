import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, FileText, Ruler, Box } from 'lucide-react';
import type { F10_41_00_00Dimensions } from '@/lib/f10_41_00_00/types';
import type { F10_41_00_00NestingParams, F10_41_00_00NestingResult } from '@/lib/f10_41_00_00/nesting';
import type { F10_41_00_00Geometry } from '@/lib/f10_41_00_00/geometry';

const UNIT_FACTORS: Record<'mm' | 'cm' | 'in', number> = { mm: 1, cm: 10, in: 25.4 };
const toDisplay = (mm: number, unit: 'mm' | 'cm' | 'in') => parseFloat((mm / UNIT_FACTORS[unit]).toFixed(2));
const unitLabel = (unit: 'mm' | 'cm' | 'in') => (unit === 'mm' ? 'مم' : unit === 'cm' ? 'سم' : 'بوصة');

interface F10_41_00_00PrintSummaryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  params: F10_41_00_00Dimensions;
  nesting: F10_41_00_00NestingParams;
  nestingResult: F10_41_00_00NestingResult;
  dimUnit: 'mm' | 'cm' | 'in';
  geo: F10_41_00_00Geometry;
}

export default function F10_41_00_00PrintSummary({
  open,
  onOpenChange,
  params,
  nesting,
  nestingResult,
  dimUnit,
  geo,
}: F10_41_00_00PrintSummaryProps) {
  const today = new Date().toLocaleDateString('ar-SA');
  const u = unitLabel(dimUnit);
  const d = (mm: number) => `${toDisplay(mm, dimUnit)} ${u}`;

  const handlePrint = () => {
    window.print();
  };

  const totalBlankArea = (geo.width * geo.height) / 1000000; // m2

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible print:shadow-none print:border-none">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2 text-slate-900 font-bold">
            <Printer className="w-5 h-5 text-blue-600" />
            ملخص مواصفات قالب F10.41.00.00 (علبة قفل أوتوماتيكي مع نافذة)
          </DialogTitle>
        </DialogHeader>

        <div id="print-area" className="bg-background print:bg-white space-y-6" dir="rtl">
          {/* Header */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-l from-blue-600/10 via-blue-600/5 to-transparent border border-blue-600/20 p-6">
            <div className="flex items-center justify-between relative z-10">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-blue-600" />
                  علبة قفل أوتوماتيكي مع نافذة F10.41.00.00
                </h1>
                <p className="text-sm text-slate-500">التاريخ: {today}</p>
                <p className="text-sm text-slate-500">وحدة القياس: {u}</p>
              </div>
              <div className="text-left font-mono">
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-bold">ECMA F10.41</span>
              </div>
            </div>
          </div>

          {/* Grid Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Box Dimensions */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b pb-2">
                <Box className="w-4 h-4 text-blue-600" />
                الأبعاد الصافية للعلبة
              </h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-50 p-2 rounded-lg">
                  <div className="text-xs text-slate-500">العرض (W)</div>
                  <div className="font-bold text-slate-900">{d(params.width)}</div>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                  <div className="text-xs text-slate-500">الارتفاع (H)</div>
                  <div className="font-bold text-slate-900">{d(params.height)}</div>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                  <div className="text-xs text-slate-500">العمق (D)</div>
                  <div className="font-bold text-slate-900">{d(params.depth)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center pt-2">
                <div className="bg-slate-50 p-2 rounded-lg">
                  <div className="text-xs text-slate-500">لسان اللصق</div>
                  <div className="font-bold text-slate-900">{d(params.glueFlap)}</div>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                  <div className="text-xs text-slate-500">ارتفاع ألسنة الإغلاق</div>
                  <div className="font-bold text-slate-900">{d(params.flapHeight ?? params.depth * 0.675)}</div>
                </div>
              </div>
            </div>

            {/* Blank & Sheet Info */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b pb-2">
                <Ruler className="w-4 h-4 text-emerald-600" />
                المقاس الإجمالي والفرخ
              </h3>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-slate-50 p-2 rounded-lg">
                  <div className="text-xs text-slate-500">العرض الكلي للمفرود</div>
                  <div className="font-bold text-slate-900">{d(geo.width)}</div>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                  <div className="text-xs text-slate-500">الارتفاع الكلي للمفرود</div>
                  <div className="font-bold text-slate-900">{d(geo.height)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center pt-2">
                <div className="bg-slate-50 p-2 rounded-lg">
                  <div className="text-xs text-slate-500">عدد القطع على الفرخ</div>
                  <div className="font-bold text-emerald-600">{nestingResult.bestTotal} قطعة</div>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                  <div className="text-xs text-slate-500">مساحة المفرود</div>
                  <div className="font-bold text-slate-900">{totalBlankArea.toFixed(3)} م²</div>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t print:hidden">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              إغلاق
            </Button>
            <Button onClick={handlePrint} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold">
              <Printer className="w-4 h-4" />
              طباعة التقرير
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
