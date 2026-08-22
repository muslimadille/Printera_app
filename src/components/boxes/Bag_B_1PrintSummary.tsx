import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { Bag_B_1Dimensions, exportBag_B_1SinglePdf } from '@/lib/bag_b_1';

export default function Bag_B_1PrintSummary({ dimensions }: { dimensions: Bag_B_1Dimensions }) {
  return (
    <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex flex-col">
        <span className="text-sm text-slate-500 font-medium">ملخص القالب</span>
        <span className="text-lg font-bold text-slate-900">
          كيس ورقي {dimensions.width} × {dimensions.height} × {dimensions.depth} mm
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => exportBag_B_1SinglePdf(dimensions)}
          className="bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-sm rounded-lg h-10 px-6"
        >
          <Download className="w-4 h-4 ml-2" />
          تحميل PDF
        </Button>
      </div>
    </div>
  );
}
