import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, FileText } from 'lucide-react';
import type { A60_20_01_01Params, A60_20_01_01Geometry } from '@/lib/a60_20_01_01/types';
import type { A60_20_01_01NestingParams } from '@/lib/a60_20_01_01/nesting';

interface A60_20_01_01PrintSummaryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  params: A60_20_01_01Params;
  nesting: A60_20_01_01NestingParams;
  geo: A60_20_01_01Geometry;
}

const A60_20_01_01PrintSummary = ({
  open, onOpenChange, params, nesting, geo,
}: A60_20_01_01PrintSummaryProps) => {
  const today = new Date().toLocaleDateString('ar-EG');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            ملخص القالب A60_20_01_01 — مواصفات الطباعة والدايكت
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6" dir="rtl">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                علبة ذاتية القفل ECMA A60_20_01_01
              </h1>
              <p className="text-xs text-muted-foreground">التاريخ: {today}</p>
            </div>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 ml-1" /> طباعة الملخص
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="border p-3 rounded-lg">
              <span className="text-muted-foreground block text-xs">أبعاد المنتج (W × H × D)</span>
              <span className="font-semibold">{params.width} × {params.height} × {params.depth} mm</span>
            </div>
            <div className="border p-3 rounded-lg">
              <span className="text-muted-foreground block text-xs">أبعاد الدايكت الإجمالية</span>
              <span className="font-semibold">{geo.bbox.w.toFixed(1)} × {geo.bbox.h.toFixed(1)} mm</span>
            </div>
            <div className="border p-3 rounded-lg">
              <span className="text-muted-foreground block text-xs">لسان اللصق الجانبي</span>
              <span className="font-semibold">{params.glueFlap} mm</span>
            </div>
            <div className="border p-3 rounded-lg">
              <span className="text-muted-foreground block text-xs">لسان الغلق العلوي (Tuck)</span>
              <span className="font-semibold">{params.tuck} mm</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default A60_20_01_01PrintSummary;
