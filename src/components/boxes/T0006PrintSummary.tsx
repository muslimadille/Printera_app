import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, FileText, Ruler } from 'lucide-react';
import type { T0006Params } from '@/lib/t0006/types';
import type { NestingResult } from '@/lib/t0006/nesting';

const UNIT_FACTORS: Record<'mm' | 'cm' | 'in', number> = { mm: 1, cm: 10, in: 25.4 };
const toDisplay = (mm: number, unit: 'mm' | 'cm' | 'in') => parseFloat((mm / UNIT_FACTORS[unit]).toFixed(4));
const unitLabel = (unit: 'mm' | 'cm' | 'in') => (unit === 'mm' ? 'mm' : unit === 'cm' ? 'cm' : 'in');

interface T0006PrintSummaryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  params: T0006Params;
  nestingResult: NestingResult;
  dimUnit: 'mm' | 'cm' | 'in';
  derived: {
    W: number;
    H: number;
    D: number;
    Gf: number;
    Lt: number;
    Df: number;
    d2: number;
  };
}

const T0006PrintSummary = ({
  open, onOpenChange, params, nestingResult, dimUnit, derived,
}: T0006PrintSummaryProps) => {
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
            ملخص T0006 — معاينة الطباعة
          </DialogTitle>
        </DialogHeader>

        <div id="print-area" className="bg-background print:bg-white space-y-6" dir="rtl">
          {/* Header */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-l from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6">
            <div className="absolute top-0 left-0 w-32 h-32 bg-primary/5 rounded-full -translate-x-10 -translate-y-10" />
            <div className="flex items-center justify-between relative z-10">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                  <FileText className="w-6 h-6" />
                  ملخص قالب T0006 (Snap-Lock مزدوج)
                </h1>
                <p className="text-sm text-muted-foreground">التاريخ: {today}</p>
                <p className="text-sm text-muted-foreground">وحدة القياس: {u}</p>
              </div>
              <div className="text-left">
                <div className="inline-block rounded-xl bg-primary/10 px-5 py-3 border border-primary/20 shadow-sm">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">الوضع</p>
                  <p className="text-xl font-bold text-primary tracking-wide">
                    {params.referenceMode ? 'Reference Clone' : 'Dynamic'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Product Dimensions */}
          <SectionBlock icon={<Ruler className="w-4 h-4" />} title="أبعاد المنتج">
            <table className="w-full text-sm border-collapse">
              <tbody>
                <PrintRow label="العرض (W)" value={d(params.width)} />
                <PrintRow label="الارتفاع (H)" value={d(params.height)} />
                <PrintRow label="العمق (D)" value={d(params.depth)} />
              </tbody>
            </table>
          </SectionBlock>

          {/* Tongues & Flaps */}
          <SectionBlock icon={<Ruler className="w-4 h-4" />} title="الألسنة واللصق">
            <table className="w-full text-sm border-collapse">
              <tbody>
                <PrintRow label="لسان اللصق (Glue Flap)" value={d(params.glueFlap)} />
                <PrintRow label="لسان القفل المزدوج (Lid Tongue)" value={d(params.lidTongue)} />
                <PrintRow label="ألسنة الغبار المزدوجة (Dust Flap)" value={d(params.dustFlap)} />
              </tbody>
            </table>
          </SectionBlock>

          {/* Derived dimensions */}
          <SectionBlock icon={<Ruler className="w-4 h-4" />} title="الأبعاد المشتقة">
            <table className="w-full text-sm border-collapse">
              <tbody>
                <PrintRow label="العمق المقابل (d2 = D − 0.5)" value={d(derived.d2)} />
              </tbody>
            </table>
          </SectionBlock>

          {/* Sheet info */}
          <SectionBlock icon={<Ruler className="w-4 h-4" />} title="بيانات الشيت">
            <table className="w-full text-sm border-collapse">
              <tbody>
                <PrintRow label="عرض الشيت" value={d(params.sheetWidth)} />
                <PrintRow label="ارتفاع الشيت" value={d(params.sheetHeight)} />
                <PrintRow label="الهامش" value={d(params.sheetMargin)} />
                <PrintRow label="القابض" value={d(params.gripper)} />
                <PrintRow label="الصافي (عرض × ارتفاع)" value={`${d(params.sheetWidth - 2 * params.sheetMargin)} × ${d(params.sheetHeight - 2 * params.sheetMargin - params.gripper)}`} />
              </tbody>
            </table>
          </SectionBlock>

          {/* Nesting results */}
          <SectionBlock icon={<Ruler className="w-4 h-4" />} title="نتائج التوزيع (Nesting)">
            <table className="w-full text-sm border-collapse">
              <tbody>
                <PrintRow label="الأعمدة × الصفوف" value={`${nestingResult.cols} × ${nestingResult.rows}`} />
                <PrintRow label="إجمالي الوحدات التكرارية" value={nestingResult.total.toString()} />
                <PrintRow label="العرض الفعلي المستغل" value={d(nestingResult.widthUsed)} />
                <PrintRow label="الارتفاع الفعلي المستغل" value={d(nestingResult.heightUsed)} />
                <PrintRow label="كفاءة التوزيع" value={`${(nestingResult.efficiency * 100).toFixed(1)}%`} />
              </tbody>
            </table>
          </SectionBlock>

          {/* Footer */}
          <div className="border-t border-border/50 pt-4 text-center text-xs text-muted-foreground space-y-1">
            <p>تم إعداد هذا الملخص بتاريخ {today}</p>
          </div>
        </div>

        <div className="print:hidden flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            طباعة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const SectionBlock = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <div>
    <h2 className="text-base font-bold text-primary mb-3 flex items-center gap-2">
      <span className="w-1 h-5 bg-primary rounded-full inline-block" />
      {icon}
      {title}
    </h2>
    {children}
  </div>
);

const PrintRow = ({ label, value }: { label: string; value: string }) => (
  <tr className="even:bg-muted/20">
    <td className="border border-border/50 p-2.5 text-muted-foreground w-1/3">{label}</td>
    <td className="border border-border/50 p-2.5 font-medium">{value}</td>
  </tr>
);

export default T0006PrintSummary;
