import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, FileText, Ruler } from 'lucide-react';
import type { D003Params } from '@/lib/d003/types';
import type { D003NestingParams, D003NestingResult } from '@/lib/d003/nesting';

const UNIT_FACTORS: Record<'mm' | 'cm' | 'in', number> = { mm: 1, cm: 10, in: 25.4 };
const toDisplay = (mm: number, unit: 'mm' | 'cm' | 'in') => parseFloat((mm / UNIT_FACTORS[unit]).toFixed(4));
const unitLabel = (unit: 'mm' | 'cm' | 'in') => (unit === 'mm' ? 'mm' : unit === 'cm' ? 'cm' : 'in');

interface D003PrintSummaryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  params: D003Params;
  nesting: D003NestingParams;
  nestingResult: D003NestingResult;
  dimUnit: 'mm' | 'cm' | 'in';
  distributionFootprint: { w: number; h: number };
  derived: {
    W_depth2: number;
    W_face1: number;
    W_depth1: number;
    W_face2: number;
    H: number;
    D: number;
    Gf: number;
    slotW: number;
    slotH: number;
    slotOffsetY: number;
    slotExtension: number;
  };
}

const D003PrintSummary = ({
  open, onOpenChange, params, nesting, nestingResult, dimUnit, distributionFootprint, derived,
}: D003PrintSummaryProps) => {
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
            ملخص D003 — معاينة الطباعة
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
                  ملخص قالب D003 (Die-cut 4-Zone)
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

          {/* Slots & Flaps */}
          <SectionBlock icon={<Ruler className="w-4 h-4" />} title="لسان اللصق والفتحة">
            <table className="w-full text-sm border-collapse">
              <tbody>
                <PrintRow label="لسان اللصق (Glue Flap)" value={d(params.glueFlap)} />
                <PrintRow label="زاوية لسان اللصق" value={`15°`} />
                <PrintRow label="ارتفاع الفتحة المستطيلة (Slot Height)" value={d(params.slotHeight)} />
                <PrintRow label="المسافة من خط الثني العلوي (Slot Offset Y)" value={d(params.slotOffsetY)} />
                <PrintRow label="بروز الفتحة في Depth1 (Slot Extension)" value={d(params.slotExtension)} />
                <PrintRow label="العرض الإجمالي للفتحة" value={d(derived.slotW)} />
              </tbody>
            </table>
          </SectionBlock>

          {/* Panels Info */}
          <SectionBlock icon={<Ruler className="w-4 h-4" />} title="عرض الألواح المشتقة">
            <table className="w-full text-sm border-collapse">
              <tbody>
                <PrintRow label="لوح اللصق (GlueFlap)" value={d(derived.Gf)} />
                <PrintRow label="اللوح الأول (Depth2)" value={d(derived.W_depth2)} />
                <PrintRow label="اللوح الثاني (Face1)" value={d(derived.W_face1)} />
                <PrintRow label="اللوح الثالث (Depth1)" value={d(derived.W_depth1)} />
                <PrintRow label="اللوح الرابع (Face2)" value={d(derived.W_face2)} />
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
                <PrintRow label="مقاس القالب (BBox)" value={`${d(nestingResult.templateBBox.width)} × ${d(nestingResult.templateBBox.height)}`} />
                <PrintRow label="Normal" value={`${nestingResult.normal.columns} × ${nestingResult.normal.rows} = ${nestingResult.normal.total}`} />
                <PrintRow label="Rotated 90°" value={`${nestingResult.rotated.columns} × ${nestingResult.rotated.rows} = ${nestingResult.rotated.total}`} />
                <PrintRow
                  label="أفضل اتجاه"
                  value={`${nestingResult.bestOrientation === 'normal' ? 'Normal' : 'Rotated 90°'} · إجمالي: ${nestingResult.bestTotal}`}
                />
                <PrintRow label="Pitch (X × Y)" value={`${d(nestingResult.pitchX)} × ${d(nestingResult.pitchY)}`} />
                <PrintRow label="التداخل (H × V)" value={`${d(nestingResult.horizontalInterlock)} × ${d(nestingResult.verticalInterlock)}`} />
                <PrintRow label="مسموح بالدوران" value={nesting.allowRotation ? 'نعم' : 'لا'} />
                <PrintRow label="وضع الدوران" value={nesting.rotationMode} />
              </tbody>
            </table>
          </SectionBlock>

          {/* Distribution footprint */}
          {nestingResult.fitStatus === 'fits' && nestingResult.bestTotal > 0 && (
            <SectionBlock icon={<Ruler className="w-4 h-4" />} title="مقاس التوزيع الفعلي">
              <table className="w-full text-sm border-collapse">
                <tbody>
                  <PrintRow label="العرض" value={d(distributionFootprint.w)} />
                  <PrintRow label="الارتفاع" value={d(distributionFootprint.h)} />
                  <PrintRow label="التباعد الأفقي" value={d(nesting.horizontalGap)} />
                  <PrintRow label="التباعد العمودي" value={d(nesting.verticalGap)} />
                </tbody>
              </table>
            </SectionBlock>
          )}

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

export default D003PrintSummary;
