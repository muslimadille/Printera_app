import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, FileText, Ruler, Box } from 'lucide-react';
import type { F70_01_00_00_AParams, F70_01_00_00_AGeometry } from '@/lib/f70_01_00_00_a/types';
import type { F70_01_00_00_ANestingParams, F70_01_00_00_ANestingResult } from '@/lib/f70_01_00_00_a/nesting';

const UNIT_FACTORS: Record<'mm' | 'cm' | 'in', number> = { mm: 1, cm: 10, in: 25.4 };
const toDisplay = (mm: number, unit: 'mm' | 'cm' | 'in') => parseFloat((mm / UNIT_FACTORS[unit]).toFixed(4));
const unitLabel = (unit: 'mm' | 'cm' | 'in') => (unit === 'mm' ? 'mm' : unit === 'cm' ? 'cm' : 'in');

interface F70_01_00_00_APrintSummaryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  params: F70_01_00_00_AParams;
  nesting: F70_01_00_00_ANestingParams;
  nestingResult: F70_01_00_00_ANestingResult;
  dimUnit: 'mm' | 'cm' | 'in';
  geo: F70_01_00_00_AGeometry;
}

const F70_01_00_00_APrintSummary = ({
  open,
  onOpenChange,
  params,
  nesting,
  nestingResult,
  dimUnit,
  geo,
}: F70_01_00_00_AParams extends any ? F70_01_00_00_APrintSummaryProps : never) => {
  const today = new Date().toLocaleDateString('ar-SA');
  const u = unitLabel(dimUnit);
  const d = (mm: number) => `${toDisplay(mm, dimUnit)} ${u}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible print:shadow-none print:border-none">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            ملخص قالب F70.01.00.00.A (علبة وسادة / Pillow Box)
          </DialogTitle>
        </DialogHeader>

        <div id="print-area" className="bg-background print:bg-white space-y-6" dir="rtl">
          {/* Header */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-l from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6">
            <div className="flex items-center justify-between relative z-10">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                  <FileText className="w-6 h-6" />
                  علبة وسادة ECMA F70.01.00.00.A
                </h1>
                <p className="text-sm text-muted-foreground">التاريخ: {today}</p>
                <p className="text-sm text-muted-foreground">وحدة القياس: {u}</p>
              </div>
              <div className="text-left">
                <div className="inline-block rounded-xl bg-primary/10 px-5 py-3 border border-primary/20 shadow-sm">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">الوضع</p>
                  <p className="text-xl font-bold text-primary tracking-wide">
                    {params.referenceMode ? 'Reference Clone' : 'Dynamic Parametric'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Core Dimensions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border bg-card space-y-1">
              <p className="text-xs text-muted-foreground">عرض الوجه (W)</p>
              <p className="text-xl font-bold text-foreground">{d(params.width)}</p>
            </div>
            <div className="p-4 rounded-xl border bg-card space-y-1">
              <p className="text-xs text-muted-foreground">طول الجسم (H)</p>
              <p className="text-xl font-bold text-foreground">{d(params.height)}</p>
            </div>
            <div className="p-4 rounded-xl border bg-card space-y-1">
              <p className="text-xs text-muted-foreground">العمق التقريبي (D)</p>
              <p className="text-xl font-bold text-foreground">{d(params.depth)}</p>
            </div>
            <div className="p-4 rounded-xl border bg-card space-y-1">
              <p className="text-xs text-muted-foreground">لسان اللصق (Gf)</p>
              <p className="text-xl font-bold text-foreground">{d(params.glueFlap)}</p>
            </div>
          </div>

          {/* Dieline Flat Footprint & Geometry */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Ruler className="w-4 h-4 text-primary" />
              أبعاد الدايكت الإجمالية (Flat Sheet Footprint)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div className="p-3 bg-muted/40 rounded-lg">
                <span className="text-xs text-muted-foreground block">إجمالي العرض المسطح:</span>
                <span className="font-semibold">{d(geo.bbox.w)}</span>
              </div>
              <div className="p-3 bg-muted/40 rounded-lg">
                <span className="text-xs text-muted-foreground block">إجمالي الطول المسطح:</span>
                <span className="font-semibold">{d(geo.bbox.h)}</span>
              </div>
              <div className="p-3 bg-muted/40 rounded-lg">
                <span className="text-xs text-muted-foreground block">ارتفاع قوس الإغلاق (Sagitta):</span>
                <span className="font-semibold">{d(geo.derived.arcSagitta)}</span>
              </div>
            </div>
          </div>

          {/* Sheet Nesting Statistics */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Box className="w-4 h-4 text-primary" />
              إحصائيات المونتاج على فرخ الطباعة
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="p-3 bg-muted/40 rounded-lg">
                <span className="text-xs text-muted-foreground block">مقاس الفرخ:</span>
                <span className="font-semibold">{d(params.sheetWidth)} × {d(params.sheetHeight)}</span>
              </div>
              <div className="p-3 bg-muted/40 rounded-lg">
                <span className="text-xs text-muted-foreground block">عدد العلب في الفرخ:</span>
                <span className="font-bold text-emerald-600 text-lg">{nestingResult.total} علبة</span>
              </div>
              <div className="p-3 bg-muted/40 rounded-lg">
                <span className="text-xs text-muted-foreground block">توزيع الشبكة (صفوف × أعمدة):</span>
                <span className="font-semibold">{nestingResult.rows} × {nestingResult.columns}</span>
              </div>
              <div className="p-3 bg-muted/40 rounded-lg">
                <span className="text-xs text-muted-foreground block">كفاءة استغلال الفرخ:</span>
                <span className="font-bold text-primary">{nestingResult.efficiencyPercentage.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 print:hidden pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              إغلاق
            </Button>
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="w-4 h-4" />
              طباعة التقرير
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default F70_01_00_00_APrintSummary;
