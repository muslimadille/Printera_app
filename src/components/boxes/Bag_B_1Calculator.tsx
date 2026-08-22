import React, { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown, Download, Save, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TemplateEditorLayout, PreviewMode } from '@/components/layouts/TemplateEditorLayout';

import {
  Bag_B_1Dimensions,
  getBag_B_1SingleSvg,
  generateBag_B_1Geometry,
  exportBag_B_1SheetPdf
} from '@/lib/bag_b_1';

import { buildBag_B_1DimensionsSvg } from '@/lib/bag_b_1/dimensionsOverlay';
import Bag_B_1Box3DPreview from './Bag_B_1Box3DPreview';
import Bag_B_1SheetNestingPreview, { Bag_B_1NestingParams } from './Bag_B_1SheetNestingPreview';
import Bag_B_1PrintSummary from './Bag_B_1PrintSummary';
import { InteractiveSvgCanvas, type Segment } from '@/components/InteractiveSvgCanvas';
import { exportBag_B_1SinglePdf } from '@/lib/bag_b_1/exportSingle';

import {
  BAG_B_1_DEFAULTS,
  MIN_BAG_DEPTH,
  getBottomFlapBounds,
  clampBottomFlap,
} from '@/lib/bag_b_1/types';

const DEFAULT_DIMS: Bag_B_1Dimensions = BAG_B_1_DEFAULTS;

const DEFAULT_NESTING: Bag_B_1NestingParams = {
  sheetWidth: 700,
  sheetHeight: 500,
  margin: 10,
  spacing: 5,
};

const UNIT_FACTORS: Record<'mm' | 'cm' | 'in', number> = { mm: 1, cm: 10, in: 25.4 };
const toDisplay = (mm: number, unit: 'mm' | 'cm' | 'in') => parseFloat((mm / UNIT_FACTORS[unit]).toFixed(4));
const toMm = (val: number, unit: 'mm' | 'cm' | 'in') => val * UNIT_FACTORS[unit];
const num = (v: string, fallback: number) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

const NumField = ({
  label, value, onChange, disabled, step = '0.01', min, unit,
}: {
  label: string; value: number; onChange: (v: number) => void;
  disabled?: boolean; step?: string; min?: string; unit?: 'mm' | 'cm' | 'in';
}) => (
  <div>
    <Label className="text-xs">{label}</Label>
    <Input type="number" step={step} min={min}
      value={unit ? toDisplay(value, unit) : value}
      disabled={disabled}
      onChange={e => onChange(unit ? toMm(num(e.target.value, toDisplay(value, unit)), unit) : num(e.target.value, value))} />
  </div>
);

export default function Bag_B_1Calculator() {
  const { toast } = useToast();
  
  const [draftDims, setDraftDims] = useState<Bag_B_1Dimensions>(DEFAULT_DIMS);
  const [appliedDims, setAppliedDims] = useState<Bag_B_1Dimensions>(DEFAULT_DIMS);
  
  const [draftNesting, setDraftNesting] = useState<Bag_B_1NestingParams>(DEFAULT_NESTING);
  const [appliedNesting, setAppliedNesting] = useState<Bag_B_1NestingParams>(DEFAULT_NESTING);
  
  const [hasChanges, setHasChanges] = useState(false);

  const [previewMode, setPreviewMode] = useState<PreviewMode>('template');
  const [showDimensions, setShowDimensions] = useState(true);
  const [dimUnit, setDimUnit] = useState<'mm' | 'cm' | 'in'>('mm');
  const [dimScale, setDimScale] = useState(1);
  
  const [segmentOverrides, setSegmentOverrides] = useState<{ svg: string | null; segments: Segment[] | null }>({
    svg: null,
    segments: null,
  });

  useEffect(() => {
    const isChanged = JSON.stringify(draftDims) !== JSON.stringify(appliedDims) || 
                      JSON.stringify(draftNesting) !== JSON.stringify(appliedNesting);
    setHasChanges(isChanged);
  }, [draftDims, appliedDims, draftNesting, appliedNesting]);

  const handleDepthChange = (newDepth: number) => {
    setDraftDims(prev => {
      const bounds = getBottomFlapBounds(newDepth);
      const autoFlap = parseFloat((Math.max(bounds.min, Math.min(bounds.max, newDepth / 2 + 20))).toFixed(2));
      return {
        ...prev,
        depth: newDepth,
        bottomFlap: autoFlap,
      };
    });
  };

  const handleSave = () => {
    if (draftDims.width <= 0 || draftDims.height <= 0 || draftDims.depth < MIN_BAG_DEPTH) {
      toast({
        title: "أبعاد غير صالحة",
        description: `يرجى التأكد من أن العرض والارتفاع أكبر من الصفر، والعمق لا يقل عن ${MIN_BAG_DEPTH} مم.`,
        variant: "destructive",
      });
      return;
    }
    
    const bounds = getBottomFlapBounds(draftDims.depth);
    let finalBottomFlap = draftDims.bottomFlap;

    if (finalBottomFlap < bounds.min || finalBottomFlap > bounds.max) {
      finalBottomFlap = parseFloat(clampBottomFlap(draftDims.depth, finalBottomFlap).toFixed(2));
      toast({
        title: "تنبيه قاعدة الإغلاق",
        description: `تم تعديل مقاس قاعدة الإغلاق لتتوافق مع الشروط (${bounds.min.toFixed(1)} - ${bounds.max.toFixed(1)} مم).`,
      });
    }

    const finalDims: Bag_B_1Dimensions = {
      ...draftDims,
      bottomFlap: finalBottomFlap,
    };

    setDraftDims(finalDims);
    setAppliedDims(finalDims);
    setAppliedNesting({ ...draftNesting });
    setSegmentOverrides({ svg: null, segments: null });
    toast({
      title: "تم تحديث الأبعاد",
      description: "تم تطبيق الأبعاد الجديدة على جميع المعاينات بنجاح.",
    });
  };

  const handleReset = () => {
    setDraftDims(DEFAULT_DIMS);
    setAppliedDims(DEFAULT_DIMS);
    setDraftNesting(DEFAULT_NESTING);
    setAppliedNesting(DEFAULT_NESTING);
    setSegmentOverrides({ svg: null, segments: null });
    toast({
      title: "إعادة تعيين",
      description: "تم استعادة الأبعاد الافتراضية للقالب.",
    });
  };

  const geo = useMemo(() => {
    const raw = generateBag_B_1Geometry(appliedDims);
    raw.svg = getBag_B_1SingleSvg(appliedDims);
    if (segmentOverrides.svg) {
      return {
        ...raw,
        svg: segmentOverrides.svg,
        segments: segmentOverrides.segments || raw.segments,
      };
    }
    return raw;
  }, [appliedDims, segmentOverrides]);

  const dimsSvg = useMemo(
    () => (showDimensions ? buildBag_B_1DimensionsSvg(appliedDims, dimUnit, dimScale) : ''),
    [showDimensions, appliedDims, dimUnit, dimScale],
  );

  return (
    <TemplateEditorLayout
      title="Bag_B_1 — كيس ورقي بقاعدة مستطيلة (Gusseted Paper Bag)"
      previewMode={previewMode}
      onPreviewModeChange={setPreviewMode}
      hasTemplatePreview={true}
      hasSinglePreview={false}
      hasSheetPreview={true}
      has3DPreview={true}
      showDimensions={showDimensions}
      onShowDimensionsChange={setShowDimensions}
      dimUnit={dimUnit}
      onDimUnitChange={setDimUnit}
      dimScale={dimScale}
      onDimScaleChange={setDimScale}
      onSave={handleSave}
      onReset={handleReset}
      actionButtons={
        <>
          <ExportSingleButton dims={appliedDims} />
          {previewMode === 'sheet' && (
            <ExportSheetButton dims={appliedDims} nesting={appliedNesting} />
          )}
        </>
      }
      previewArea={
        <>
          {previewMode === 'template' ? (
              <div className="w-full h-full relative overflow-hidden">
                <InteractiveSvgCanvas
                  segments={geo.segments}
                  svgWidth={geo.width}
                  svgHeight={geo.height}
                  dimensionsMarkup={dimsSvg}
                  showDimensions={showDimensions}
                  onShowDimensionsChange={setShowDimensions}
                  onChange={(newSvg, newSegs) => {
                    setSegmentOverrides({ svg: newSvg, segments: newSegs });
                  }}
                />
              </div>
          ) : previewMode === 'sheet' ? (
              <Bag_B_1SheetNestingPreview dimensions={appliedDims} nesting={appliedNesting} />
          ) : (
            <Bag_B_1Box3DPreview
              width={appliedDims.width}
              height={appliedDims.height}
              depth={appliedDims.depth}
              topHem={appliedDims.topHem}
              bottomFlap={appliedDims.bottomFlap}
              glueFlap={appliedDims.glueFlap}
              svgMarkup={geo.svg}
              svgWidth={geo.width}
              svgHeight={geo.height}
            />
          )}
        </>
      }
      sidebarArea={
        <>
          <section className="pt-3 pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold mb-2">أبعاد الكيس</h3>
            <div className="grid grid-cols-3 gap-2">
              <NumField label="العرض" value={draftDims.width} unit={dimUnit} onChange={v => setDraftDims(prev => ({ ...prev, width: v }))} />
              <NumField label="الارتفاع" value={draftDims.height} unit={dimUnit} onChange={v => setDraftDims(prev => ({ ...prev, height: v }))} />
              <NumField label="العمق (الحد الأدنى 25)" min="25" value={draftDims.depth} unit={dimUnit} onChange={handleDepthChange} />
            </div>
          </section>

          <section className="pt-2 pb-3 border-b border-slate-100 space-y-2">
            <h3 className="text-sm font-bold mb-2">تخصيص متقدم</h3>
            <div className="grid grid-cols-3 gap-2">
              <NumField label="لسان اللصق" value={draftDims.glueFlap} unit={dimUnit} onChange={v => setDraftDims(prev => ({ ...prev, glueFlap: v }))} />
              <NumField label="طية علوية" value={draftDims.topHem} unit={dimUnit} onChange={v => setDraftDims(prev => ({ ...prev, topHem: v }))} />
              <div>
                <NumField label="قاعدة الإغلاق" value={draftDims.bottomFlap} unit={dimUnit} onChange={v => setDraftDims(prev => ({ ...prev, bottomFlap: v }))} />
              </div>
            </div>
            <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-md border border-slate-100 flex justify-between items-center">
              <span>نطاق قاعدة الإغلاق المسموح:</span>
              <span className="font-mono font-semibold text-slate-700">
                {toDisplay(getBottomFlapBounds(draftDims.depth).min, dimUnit)} - {toDisplay(getBottomFlapBounds(draftDims.depth).max, dimUnit)} {dimUnit}
              </span>
            </div>
          </section>
          
          {previewMode === 'sheet' && (
            <section className="pt-2 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold mb-2">إعدادات الشيت</h3>
              <div className="grid grid-cols-2 gap-2">
                <NumField label="عرض الفرخ" value={draftNesting.sheetWidth} unit={dimUnit} onChange={v => setDraftNesting(prev => ({ ...prev, sheetWidth: v }))} />
                <NumField label="ارتفاع الفرخ" value={draftNesting.sheetHeight} unit={dimUnit} onChange={v => setDraftNesting(prev => ({ ...prev, sheetHeight: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <NumField label="الهامش" value={draftNesting.margin} unit={dimUnit} onChange={v => setDraftNesting(prev => ({ ...prev, margin: v }))} />
                <NumField label="المسافة (Gap)" value={draftNesting.spacing} unit={dimUnit} onChange={v => setDraftNesting(prev => ({ ...prev, spacing: v }))} />
              </div>
            </section>
          )}
        </>
      }
      floatingSummary={<Bag_B_1PrintSummary dimensions={appliedDims} />}
    />
  );
}

const ExportSingleButton = ({ dims }: { dims: Bag_B_1Dimensions }) => {
  const onExportSvg = () => {
    const svgStr = getBag_B_1SingleSvg(dims);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bag_B_1_${dims.width}x${dims.height}x${dims.depth}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onExportPdf = async () => {
    await exportBag_B_1SinglePdf(dims, `Bag_B_1_${dims.width}x${dims.height}x${dims.depth}.pdf`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" size="sm">
          <Download className="w-4 h-4 ml-1.5" />
          تصدير القالب
          <ChevronDown className="w-3 h-3 mr-1.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onExportSvg}>تصدير SVG</DropdownMenuItem>
        <DropdownMenuItem onSelect={onExportPdf}>تصدير PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const ExportSheetButton = ({ dims, nesting }: { dims: Bag_B_1Dimensions, nesting: Bag_B_1NestingParams }) => {
  const onExportSvg = async () => {
    const { downloadBag_B_1SheetSvg } = await import('@/lib/bag_b_1/exportSheet');
    downloadBag_B_1SheetSvg(dims, nesting);
  };
  const onExportPdf = async () => {
    await exportBag_B_1SheetPdf(dims, nesting.sheetWidth, nesting.sheetHeight, nesting.margin, nesting.spacing);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" size="sm">
          <Download className="w-4 h-4 ml-1.5" />
          تصدير التوزيع
          <ChevronDown className="w-3 h-3 mr-1.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onExportSvg}>تصدير SVG</DropdownMenuItem>
        <DropdownMenuItem onSelect={onExportPdf}>تصدير PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
