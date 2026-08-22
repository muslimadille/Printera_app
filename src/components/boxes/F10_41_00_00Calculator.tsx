import React, { useState, useMemo, useCallback } from 'react';
import { TemplateEditorLayout, PreviewMode } from '@/components/layouts/TemplateEditorLayout';
import InteractiveSvgCanvas from '@/components/InteractiveSvgCanvas';
import F10_41_00_00SheetNestingPreview from './F10_41_00_00SheetNestingPreview';
import F10_41_00_00Box3DPreview from './F10_41_00_00Box3DPreview';
import F10_41_00_00PrintSummary from './F10_41_00_00PrintSummary';
import { 
  F10_41_00_00Dimensions, 
  F10_41_00_00_DEFAULTS, 
  F10_41_00_00NestingParams, 
  F10_41_00_00_DEFAULT_NESTING,
  generateF10_41_00_00Geometry,
  buildF10_41_00_00DimensionsSvg,
  getF10_41_00_00SingleSvg,
  exportF10_41_00_00SinglePdf,
  exportF10_41_00_00SheetPdf,
  computeF10_41_00_00Nesting,
} from '@/lib/f10_41_00_00';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem 
} from '@/components/ui/dropdown-menu';
import { Download, ChevronDown } from 'lucide-react';

const NumField = ({
  label,
  value,
  defaultValue,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  defaultValue?: number;
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

export default function F10_41_00_00Calculator() {
  const [previewMode, setPreviewMode] = useState<PreviewMode>('template');
  const [dimUnit, setDimUnit] = useState<'mm' | 'cm' | 'in'>('mm');
  const [dimScale, setDimScale] = useState<number>(1);
  const [showDimensions, setShowDimensions] = useState(true);
  const [printSummaryOpen, setPrintSummaryOpen] = useState(false);

  // Draft state (for live editing in sidebar before clicking Save)
  const [draftDims, setDraftDims] = useState<F10_41_00_00Dimensions>(F10_41_00_00_DEFAULTS);
  const [draftNesting, setDraftNesting] = useState<F10_41_00_00NestingParams>(F10_41_00_00_DEFAULT_NESTING);

  // Applied state (rendered in 2D/3D models and calculations)
  const [appliedDims, setAppliedDims] = useState<F10_41_00_00Dimensions>(F10_41_00_00_DEFAULTS);
  const [appliedNesting, setAppliedNesting] = useState<F10_41_00_00NestingParams>(F10_41_00_00_DEFAULT_NESTING);

  const handleSaveChanges = useCallback(() => {
    setAppliedDims({ ...draftDims });
    setAppliedNesting({ ...draftNesting });
  }, [draftDims, draftNesting]);

  const handleResetDefaults = useCallback(() => {
    setDraftDims(F10_41_00_00_DEFAULTS);
    setDraftNesting(F10_41_00_00_DEFAULT_NESTING);
    setAppliedDims(F10_41_00_00_DEFAULTS);
    setAppliedNesting(F10_41_00_00_DEFAULT_NESTING);
  }, []);

  const geo = useMemo(() => generateF10_41_00_00Geometry(appliedDims), [appliedDims]);
  const nestingResult = useMemo(() => computeF10_41_00_00Nesting(appliedDims, appliedNesting), [appliedDims, appliedNesting]);

  const dimensionsSvgMarkup = useMemo(() => {
    if (!showDimensions) return undefined;
    return buildF10_41_00_00DimensionsSvg(appliedDims, dimScale);
  }, [appliedDims, showDimensions, dimScale]);

  const singleSvgMarkup = useMemo(() => {
    return getF10_41_00_00SingleSvg(appliedDims);
  }, [appliedDims]);

  return (
    <>
      <TemplateEditorLayout
        title="علبة قفل أوتوماتيكي مع نافذة (ECMA F10.41.00.00)"
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
        actionButtons={
          <>
            <ExportSingleButton dims={appliedDims} />
            <ExportSheetButton dims={appliedDims} nesting={appliedNesting} />
          </>
        }
        previewArea={
          previewMode === 'template' ? (
            <div className="w-full h-full relative overflow-hidden">
              <InteractiveSvgCanvas
                segments={geo.segments as any}
                svgWidth={geo.width}
                svgHeight={geo.height}
                dimensionsMarkup={dimensionsSvgMarkup}
                showDimensions={showDimensions}
                onShowDimensionsChange={setShowDimensions}
              />
            </div>
          ) : previewMode === 'three' ? (
            <F10_41_00_00Box3DPreview
              width={appliedDims.width}
              height={appliedDims.height}
              depth={appliedDims.depth}
              glueFlap={appliedDims.glueFlap}
              hasWindow={appliedDims.hasWindow}
              svgMarkup={singleSvgMarkup}
              svgWidth={geo.width}
              svgHeight={geo.height}
            />
          ) : (
            <F10_41_00_00SheetNestingPreview
              dimensions={appliedDims}
              nesting={appliedNesting}
            />
          )
        }
        sidebarArea={
          <>
            <section className="pt-3 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold mb-2">أبعاد العلبة</h3>
              <div className="grid grid-cols-3 gap-2">
                <NumField label="العرض" value={draftDims.width} defaultValue={F10_41_00_00_DEFAULTS.width} unit={dimUnit} onChange={v => setDraftDims(prev => ({ ...prev, width: v }))} />
                <NumField label="الارتفاع" value={draftDims.height} defaultValue={F10_41_00_00_DEFAULTS.height} unit={dimUnit} onChange={v => setDraftDims(prev => ({ ...prev, height: v }))} />
                <NumField label="العمق" value={draftDims.depth} defaultValue={F10_41_00_00_DEFAULTS.depth} unit={dimUnit} onChange={v => setDraftDims(prev => ({ ...prev, depth: v }))} />
              </div>
            </section>

            <section className="pt-2 pb-3 border-b border-slate-100 space-y-2">
              <h3 className="text-sm font-bold mb-2">تخصيص متقدم</h3>
              <div className="grid grid-cols-2 gap-2">
                <NumField label="لسان اللصق" value={draftDims.glueFlap} defaultValue={F10_41_00_00_DEFAULTS.glueFlap} unit={dimUnit} onChange={v => setDraftDims(prev => ({ ...prev, glueFlap: v }))} />
                <NumField label="ارتفاع الإغلاق" value={draftDims.flapHeight ?? draftDims.depth * 0.675} defaultValue={F10_41_00_00_DEFAULTS.flapHeight} unit={dimUnit} onChange={v => setDraftDims(prev => ({ ...prev, flapHeight: v }))} />
              </div>
            </section>

            {previewMode === 'sheet' && (
              <section className="pt-2 pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold mb-2">إعدادات الشيت</h3>
                <div className="grid grid-cols-2 gap-2">
                  <NumField label="عرض الفرخ" value={draftNesting.sheetWidth} defaultValue={F10_41_00_00_DEFAULT_NESTING.sheetWidth} unit={dimUnit} onChange={v => setDraftNesting(prev => ({ ...prev, sheetWidth: v }))} />
                  <NumField label="ارتفاع الفرخ" value={draftNesting.sheetHeight} defaultValue={F10_41_00_00_DEFAULT_NESTING.sheetHeight} unit={dimUnit} onChange={v => setDraftNesting(prev => ({ ...prev, sheetHeight: v }))} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <NumField label="الهامش" value={draftNesting.margin} defaultValue={F10_41_00_00_DEFAULT_NESTING.margin} unit={dimUnit} onChange={v => setDraftNesting(prev => ({ ...prev, margin: v }))} />
                  <NumField label="المسافة (Gap)" value={draftNesting.spacing} defaultValue={F10_41_00_00_DEFAULT_NESTING.spacing} unit={dimUnit} onChange={v => setDraftNesting(prev => ({ ...prev, spacing: v }))} />
                </div>
              </section>
            )}
          </>
        }
      />

      <F10_41_00_00PrintSummary
        open={printSummaryOpen}
        onOpenChange={setPrintSummaryOpen}
        params={appliedDims}
        nesting={appliedNesting}
        nestingResult={nestingResult}
        dimUnit={dimUnit}
        geo={geo}
      />
    </>
  );
}

const ExportSingleButton = ({ dims }: { dims: F10_41_00_00Dimensions }) => {
  const onExportSvg = () => {
    const svgStr = getF10_41_00_00SingleSvg(dims);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'F10_41_00_00.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onExportPdf = async () => {
    await exportF10_41_00_00SinglePdf(dims);
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

const ExportSheetButton = ({ dims, nesting }: { dims: F10_41_00_00Dimensions; nesting: F10_41_00_00NestingParams }) => {
  const onExportSvg = async () => {
    const { downloadF10_41_00_00SheetSvg } = await import('@/lib/f10_41_00_00/exportSheet');
    downloadF10_41_00_00SheetSvg(dims, nesting);
  };
  const onExportPdf = async () => {
    await exportF10_41_00_00SheetPdf(dims, nesting.sheetWidth, nesting.sheetHeight, nesting.margin, nesting.spacing);
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
