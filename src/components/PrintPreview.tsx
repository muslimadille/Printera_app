import { usePrintingStore, useCalculations } from '@/store/printingStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, FileText, Layers, DollarSign, TrendingUp, Scissors } from 'lucide-react';

interface PrintPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PrintPreview = ({ open, onOpenChange }: PrintPreviewProps) => {
  const { inputs, quoteInfo, finishingItems, profitMargins } = usePrintingStore();
  const calc = useCalculations();

  const today = new Date().toLocaleDateString('ar-SA');
  const enabledFinishing = finishingItems.filter(f => f.enabled);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible print:shadow-none print:border-none">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            معاينة احترافية
          </DialogTitle>
        </DialogHeader>

        {/* Printable content */}
        <div id="print-area" className="bg-background print:bg-white space-y-6" dir="rtl">

          {/* Header */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-l from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6">
            <div className="absolute top-0 left-0 w-32 h-32 bg-primary/5 rounded-full -translate-x-10 -translate-y-10" />
            <div className="flex items-center justify-between relative z-10">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                  <FileText className="w-6 h-6" />
                  عرض تكلفة مختصر
                </h1>
                <p className="text-sm text-muted-foreground">التاريخ: {today}</p>
              </div>
              <div className="text-left">
                <div className="inline-block rounded-xl bg-primary/10 px-5 py-3 border border-primary/20 shadow-sm">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">رقم العرض</p>
                  <p className="text-xl font-bold text-primary tracking-wide">{quoteInfo.quoteNumber || '—'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Customer info */}
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground bg-muted/60 rounded-md px-2 py-1">العميل</span>
                <span className="text-sm font-semibold">{quoteInfo.customerName || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground bg-muted/60 rounded-md px-2 py-1">رقم العرض</span>
                <span className="text-sm font-semibold">{quoteInfo.quoteNumber || '—'}</span>
              </div>
            </div>
          </div>

          {/* Execution details */}
          <SectionBlock icon={<Layers className="w-4 h-4" />} title="بيانات التنفيذ">
            <table className="w-full text-sm border-collapse">
              <tbody>
                <PrintRow label="نوع الورق" value={inputs.paperType || '—'} />
                <PrintRow label="مقاس الشراء" value={inputs.purchaseSize || '—'} />
                <PrintRow label="الجرامية" value={inputs.grammage?.toString() || '—'} />
                <PrintRow label="عدد القطع المطلوبة" value={inputs.quantity.toLocaleString('ar-SA')} />
                <PrintRow label="مقاس الطباعة" value={`${inputs.printWidth} × ${inputs.printHeight} سم`} />
                <PrintRow label="عدد الأوجه المطبوعة" value={inputs.printedFaces.toString()} />
                <PrintRow label="الوجهان مختلفان" value={inputs.facesDifferent ? 'نعم' : 'لا'} />
                <PrintRow label="أوجه السلفان" value={inputs.cellophaneFaces.toString()} />
                <PrintRow label="تكسير / قالب" value={inputs.dieCut ? 'نعم' : 'لا'} />
                {inputs.dieCut && <PrintRow label="قيمة القالب" value={`${inputs.moldPrice.toLocaleString('ar-SA')} ريال`} />}
                <PrintRow label="نسبة الهدر" value={`${inputs.wastePercent}%`} />
                <PrintRow label="عدد القطع في الشيت" value={inputs.cutsPerSheet.toString()} />
              </tbody>
            </table>
          </SectionBlock>

          {/* Finishing services */}
          {enabledFinishing.length > 0 && (
            <SectionBlock icon={<Scissors className="w-4 h-4" />} title="التشطيبات">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-primary/10">
                    <th className="border border-border/50 p-2.5 text-right font-semibold">الخدمة</th>
                    <th className="border border-border/50 p-2.5 text-center font-semibold">نوع الحساب</th>
                    <th className="border border-border/50 p-2.5 text-center font-semibold">التكلفة</th>
                  </tr>
                </thead>
                <tbody>
                  {enabledFinishing.map((item, i) => {
                    const idx = finishingItems.indexOf(item);
                    return (
                      <tr key={i} className={i % 2 === 0 ? 'bg-muted/20' : 'bg-background'}>
                        <td className="border border-border/50 p-2.5">{item.name}</td>
                        <td className="border border-border/50 p-2.5 text-center">
                          {item.calcType === 'per_piece' ? 'لكل قطعة' :
                           item.calcType === 'per_1000' ? 'لكل ألف' :
                           item.calcType === 'tiered_1000' ? 'شرائح ألف' : 'مبلغ ثابت'}
                        </td>
                        <td className="border border-border/50 p-2.5 text-center font-medium">
                          {calc.finishingCosts[idx]?.toFixed(2) || '0.00'} ريال
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-primary/5 font-bold">
                    <td className="border border-border/50 p-2.5" colSpan={2}>إجمالي التشطيبات</td>
                    <td className="border border-border/50 p-2.5 text-center text-primary">{calc.totalFinishing.toFixed(2)} ريال</td>
                  </tr>
                </tbody>
              </table>
            </SectionBlock>
          )}

          {/* Cost breakdown */}
          <SectionBlock icon={<DollarSign className="w-4 h-4" />} title="تفاصيل التكاليف">
            <table className="w-full text-sm border-collapse">
              <tbody>
                <PrintRow label="تكلفة الورق" value={`${calc.paperCost.toFixed(2)} ريال`} />
                <PrintRow label="تكلفة الفرز" value={`${calc.sortCost.toFixed(2)} ريال`} />
                <PrintRow label="تكلفة الطباعة" value={`${calc.printCost.toFixed(2)} ريال`} />
                <PrintRow label="تكلفة السلفان" value={`${calc.cellophaneCost.toFixed(2)} ريال`} />
                {inputs.dieCut && <PrintRow label="تكلفة التكسير" value={`${calc.dieCutCost.toFixed(2)} ريال`} />}
                {inputs.moldPrice > 0 && <PrintRow label="قيمة القالب" value={`${inputs.moldPrice.toFixed(2)} ريال`} />}
                {calc.totalFinishing > 0 && <PrintRow label="إجمالي التشطيبات" value={`${calc.totalFinishing.toFixed(2)} ريال`} />}
              </tbody>
            </table>
          </SectionBlock>

          {/* Final totals */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border-2 border-primary bg-gradient-to-br from-primary/10 to-primary/5 p-6 text-center shadow-sm">
              <p className="text-xs text-muted-foreground mb-2 font-medium">الإجمالي الشامل</p>
              <p className="text-3xl font-bold text-primary">{calc.grandTotal.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">ريال سعودي</p>
            </div>
            <div className="rounded-xl border-2 border-accent bg-gradient-to-br from-accent/10 to-accent/5 p-6 text-center shadow-sm">
              <p className="text-xs text-muted-foreground mb-2 font-medium">سعر القطعة الواحدة</p>
              <p className="text-3xl font-bold text-accent">{calc.pricePerPiece.toFixed(4)}</p>
              <p className="text-xs text-muted-foreground mt-1">ريال سعودي</p>
            </div>
          </div>

          {/* Profit margins */}
          <SectionBlock icon={<TrendingUp className="w-4 h-4" />} title="هوامش الربح">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-primary/10">
                  <th className="border border-border/50 p-2.5 font-semibold">نسبة الربح</th>
                  <th className="border border-border/50 p-2.5 font-semibold">الإجمالي بالربح</th>
                  <th className="border border-border/50 p-2.5 font-semibold">سعر القطعة</th>
                  <th className="border border-border/50 p-2.5 font-semibold">فرق الربح</th>
                </tr>
              </thead>
              <tbody>
                {profitMargins.map((percent, i) => {
                  const totalWithProfit = calc.grandTotal * (1 + percent / 100);
                  const pieceWithProfit = inputs.quantity === 0 ? 0 : totalWithProfit / inputs.quantity;
                  const profitDiff = totalWithProfit - calc.grandTotal;
                  return (
                    <tr key={i} className={i % 2 === 0 ? 'bg-muted/20' : 'bg-background'}>
                      <td className="border border-border/50 p-2.5 text-center font-semibold">{percent}%</td>
                      <td className="border border-border/50 p-2.5 text-center">{totalWithProfit.toFixed(2)} ريال</td>
                      <td className="border border-border/50 p-2.5 text-center">{pieceWithProfit.toFixed(4)} ريال</td>
                      <td className="border border-border/50 p-2.5 text-center text-primary font-medium">{profitDiff.toFixed(2)} ريال</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </SectionBlock>

          {/* Montage image */}
          {quoteInfo.montageUrl && quoteInfo.montageUrl.match(/\.(png|jpg|jpeg|webp)$/i) && (
            <div>
              <h2 className="text-base font-bold text-primary mb-3 flex items-center gap-2">
                <span className="w-1 h-5 bg-primary rounded-full inline-block" />
                المونتاج
              </h2>
              <div className="rounded-xl border overflow-hidden bg-muted/10 p-2">
                <img src={quoteInfo.montageUrl} alt="مونتاج" className="max-h-64 rounded-lg object-contain mx-auto" />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-border/50 pt-4 text-center text-xs text-muted-foreground space-y-1">
            <p>هذا العرض صالح لمدة 15 يوماً من تاريخه</p>
            <p className="text-[10px]">تم إعداد هذا العرض بتاريخ {today}</p>
          </div>
        </div>

        {/* Print button */}
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

export default PrintPreview;