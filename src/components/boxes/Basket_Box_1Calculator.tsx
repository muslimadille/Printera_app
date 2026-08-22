import React, { useState, useMemo, useCallback } from 'react';
import { TemplateEditorLayout, PreviewMode } from '@/components/layouts/TemplateEditorLayout';
import { InteractiveSvgCanvas } from '@/components/InteractiveSvgCanvas';
import Basket_Box_1SheetNestingPreview from './Basket_Box_1SheetNestingPreview';
import Basket_Box_1Box3DPreview from './Basket_Box_1Box3DPreview';
import Basket_Box_1PrintSummary from './Basket_Box_1PrintSummary';
import {
  Basket_Box_1Params,
  DEFAULT_BASKET_BOX_1_PARAMS,
  generateBasket_Box_1Geometry,
  buildBasket_Box_1DimensionsSvg,
  exportBasket_Box_1SinglePdf,
  exportBasket_Box_1SheetPdf,
  computeBasket_Box_1Nesting,
} from '@/lib/basket_box_1';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Download, ChevronDown } from 'lucide-react';

const NumField = ({
  label,
  value,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  onChange: (val: number) => void;
}) => {
  const [localVal, setLocalVal] = useState<string>(value.toString());

  React.useEffect(() => {
    setLocalVal(value.toString());
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const txt = e.target.value;
    setLocalVal(txt);
    const parsed = parseFloat(txt);
    if (!isNaN(parsed) && parsed > 0) {
      onChange(parsed);
    }
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          value={localVal}
          onChange={handleChange}
          className="h-8 text-xs font-mono font-bold pl-7 bg-white text-slate-900 border-slate-200"
        />
        <span className="absolute left-2 top-2 text-[10px] text-muted-foreground font-mono">
          {unit}
        </span>
      </div>
    </div>
  );
};

export default function Basket_Box_1Calculator() {
  const [previewMode, setPreviewMode] = useState<PreviewMode>('template');
  const [dimUnit, setDimUnit] = useState<'mm' | 'cm' | 'in'>('mm');
  const [dimScale, setDimScale] = useState<number>(1);
  const [showDimensions, setShowDimensions] = useState(true);
  const [printSummaryOpen, setPrintSummaryOpen] = useState(false);

  // Draft state
  const [draftParams, setDraftParams] = useState<Basket_Box_1Params>(DEFAULT_BASKET_BOX_1_PARAMS);

  // Applied state
  const [appliedParams, setAppliedParams] = useState<Basket_Box_1Params>(DEFAULT_BASKET_BOX_1_PARAMS);

  const handleSaveChanges = useCallback(() => {
    setAppliedParams({ ...draftParams });
  }, [draftParams]);

  const handleResetDefaults = useCallback(() => {
    setDraftParams(DEFAULT_BASKET_BOX_1_PARAMS);
    setAppliedParams(DEFAULT_BASKET_BOX_1_PARAMS);
  }, []);

  // Compute 2D geometry & nesting
  const geo = useMemo(() => generateBasket_Box_1Geometry(appliedParams), [appliedParams]);
  const nestingResult = useMemo(() => computeBasket_Box_1Nesting(appliedParams), [appliedParams]);
  const dimsSvg = useMemo(
    () => (showDimensions ? buildBasket_Box_1DimensionsSvg(appliedParams, dimUnit, dimScale) : ''),
    [showDimensions, appliedParams, dimUnit, dimScale]
  );

  // Usable sheet area
  const usableSheetW = Math.max(0, appliedParams.sheetWidth - appliedParams.sheetMargin * 2);
  const usableSheetH = Math.max(
    0,
    appliedParams.sheetHeight - appliedParams.sheetMargin * 2 - appliedParams.gripper
  );

  // Exports
  const handleExportSingleSvg = useCallback(() => {
    const totalW = geo.bbox.width;
    const totalH = geo.bbox.height;
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW.toFixed(2)} ${totalH.toFixed(2)}" width="${totalW.toFixed(2)}mm" height="${totalH.toFixed(2)}mm">
      <g id="GEOMETRY">${geo.svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}</g>
      ${showDimensions ? dimsSvg : ''}
    </svg>`;
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Basket_Box_1_${appliedParams.width}x${appliedParams.depth}x${appliedParams.height}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [appliedParams, geo, showDimensions, dimsSvg]);

  const handleExportSinglePdf = useCallback(async () => {
    await exportBasket_Box_1SinglePdf(appliedParams);
  }, [appliedParams]);

  const handleExportSheetPdf = useCallback(async () => {
    await exportBasket_Box_1SheetPdf(appliedParams);
  }, [appliedParams]);

  const totalArea = appliedParams.sheetWidth * appliedParams.sheetHeight;
  const pieceArea = geo.bbox.width * geo.bbox.height;
  const totalUsedArea = nestingResult.count * pieceArea;
  const usagePercent = totalArea > 0 ? Math.min(100, (totalUsedArea / totalArea) * 100) : 0;
  const wastePercent = 100 - usagePercent;

  return (
    <>
      <TemplateEditorLayout
        title="علبة سلة بمقبض وأقفال مقوسة - K018 (Basket Box with Handle & Arch Locks)"
        previewMode={previewMode}
        onPreviewModeChange={setPreviewMode}
        hasTemplatePreview={true}
        hasSheetPreview={true}
        has3DPreview={true}
        dimUnit={dimUnit}
        onDimUnitChange={setDimUnit}
        dimScale={dimScale}
        onDimScaleChange={setDimScale}
        showDimensions={showDimensions}
        onShowDimensionsChange={setShowDimensions}
        onSave={handleSaveChanges}
        onReset={handleResetDefaults}
        floatingSummary={
          <div className="bg-white/95 backdrop-blur-sm border border-slate-200/80 shadow-lg rounded-2xl p-3 px-5 flex items-center justify-between gap-6 max-w-2xl mx-auto mb-3 font-mono text-xs text-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-sans">العدد في الفرخ:</span>
              <strong className="text-slate-900 text-sm font-bold">{nestingResult.count} قطعة</strong>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-sans">نسبة الاستغلال:</span>
              <strong className="text-emerald-600 font-bold">{usagePercent.toFixed(1)}%</strong>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-sans">نسبة الهالك:</span>
              <strong className="text-amber-600 font-bold">{wastePercent.toFixed(1)}%</strong>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPrintSummaryOpen(true)}
              className="h-7 text-xs font-sans font-bold bg-slate-900 text-white hover:bg-slate-800 hover:text-white border-transparent rounded-lg px-3"
            >
              تقرير الطباعة
            </Button>
          </div>
        }
        actionButtons={
          <div className="flex items-center gap-2">
            {/* Export Single Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs font-bold gap-1.5 h-8 px-3 rounded-lg border-slate-200 hover:bg-slate-100"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير القالب</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-right dir-rtl w-40">
                <DropdownMenuItem onClick={handleExportSingleSvg} className="text-xs cursor-pointer">
                  تصدير كـ SVG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportSinglePdf} className="text-xs cursor-pointer">
                  تصدير كـ PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export Sheet Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  className="bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold gap-1.5 h-8 px-3 rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير التوزيع</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-right dir-rtl w-40">
                <DropdownMenuItem onClick={handleExportSheetPdf} className="text-xs cursor-pointer">
                  تصدير كـ PDF (فرخ كامل)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
        sidebarArea={
          <div className="space-y-5 text-right dir-rtl p-1">
            {/* Dimensions Section (Always visible) */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-800 border-b pb-1.5">أبعاد العلبة (المقاس الداخلي)</h4>
              <div className="grid grid-cols-3 gap-2">
                <NumField
                  label="الطول (L)"
                  value={draftParams.width}
                  unit={dimUnit}
                  onChange={v => setDraftParams(p => ({ ...p, width: v }))}
                />
                <NumField
                  label="العرض (W)"
                  value={draftParams.depth}
                  unit={dimUnit}
                  onChange={v => setDraftParams(p => ({ ...p, depth: v }))}
                />
                <NumField
                  label="العمق (D)"
                  value={draftParams.height}
                  unit={dimUnit}
                  onChange={v => setDraftParams(p => ({ ...p, height: v }))}
                />
              </div>
            </div>

            {/* Overall Dieline Box Calculation Info */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
              <div className="font-bold text-slate-700 pb-1 border-b border-slate-200/60">
                مقاس الإفراد الكلي (Total Die-cut)
              </div>
              <div className="flex justify-between text-slate-600 font-mono text-[11px]">
                <span>العرض الكلي:</span>
                <span className="font-bold text-slate-900">{geo.bbox.width.toFixed(1)} مم</span>
              </div>
              <div className="flex justify-between text-slate-600 font-mono text-[11px]">
                <span>الارتفاع الكلي:</span>
                <span className="font-bold text-slate-900">{geo.bbox.height.toFixed(1)} مم</span>
              </div>
              <div className="flex justify-between text-slate-600 font-mono text-[11px]">
                <span>ارتفاع الرقبة:</span>
                <span className="font-bold text-slate-900">{geo.derived.handleNeckH.toFixed(1)} مم</span>
              </div>
            </div>

            {/* Sheet & Nesting Section (Visible ONLY in Sheet mode) */}
            {previewMode === 'sheet' && (
              <div className="space-y-3 animate-in fade-in-50 duration-200">
                <h4 className="text-xs font-bold text-slate-800 border-b pb-1.5">إعدادات الشيت والفرخ</h4>
                <div className="grid grid-cols-3 gap-2">
                  <NumField
                    label="عرض الشيت"
                    value={draftParams.sheetWidth}
                    unit={dimUnit}
                    onChange={v => setDraftParams(p => ({ ...p, sheetWidth: v }))}
                  />
                  <NumField
                    label="ارتفاع الشيت"
                    value={draftParams.sheetHeight}
                    unit={dimUnit}
                    onChange={v => setDraftParams(p => ({ ...p, sheetHeight: v }))}
                  />
                  <NumField
                    label="القابض"
                    value={draftParams.gripper}
                    unit={dimUnit}
                    onChange={v => setDraftParams(p => ({ ...p, gripper: v }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <NumField
                    label="الهامش"
                    value={draftParams.sheetMargin}
                    unit={dimUnit}
                    onChange={v => setDraftParams(p => ({ ...p, sheetMargin: v }))}
                  />
                  <NumField
                    label="التباعد بين العلب"
                    value={draftParams.spacing}
                    unit={dimUnit}
                    onChange={v => setDraftParams(p => ({ ...p, spacing: v }))}
                  />
                </div>
                <div className="text-[11px] text-muted-foreground pt-1">
                  الصافي: {usableSheetW.toFixed(1)} × {usableSheetH.toFixed(1)} مم
                </div>
              </div>
            )}
          </div>
        }
        previewArea={
          <div className="w-full h-full relative overflow-hidden">
            {previewMode === 'template' && (
              <InteractiveSvgCanvas
                segments={geo.segments as any}
                svgWidth={geo.bbox.width}
                svgHeight={geo.bbox.height}
                dimensionsMarkup={dimsSvg}
                showDimensions={showDimensions}
                onShowDimensionsChange={setShowDimensions}
              />
            )}

            {previewMode === 'sheet' && (
              <Basket_Box_1SheetNestingPreview params={appliedParams} />
            )}

            {previewMode === 'three' && (
              <Basket_Box_1Box3DPreview
                width={appliedParams.width}
                depth={appliedParams.depth}
                height={appliedParams.height}
                handleNeckH={geo.derived.handleNeckH}
                handleGripH={geo.derived.handleGripH}
              />
            )}
          </div>
        }
      />

      <Basket_Box_1PrintSummary
        open={printSummaryOpen}
        onOpenChange={setPrintSummaryOpen}
        params={appliedParams}
        nestingResult={nestingResult}
        dimUnit={dimUnit}
        geo={geo}
      />
    </>
  );
}
