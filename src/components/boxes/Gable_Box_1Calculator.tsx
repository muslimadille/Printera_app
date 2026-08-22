import React, { useState, useMemo, useCallback } from 'react';
import { TemplateEditorLayout, PreviewMode } from '@/components/layouts/TemplateEditorLayout';
import InteractiveSvgCanvas from '@/components/InteractiveSvgCanvas';
import Gable_Box_1SheetNestingPreview from './Gable_Box_1SheetNestingPreview';
import Gable_Box_1Box3DPreview from './Gable_Box_1Box3DPreview';
import Gable_Box_1PrintSummary from './Gable_Box_1PrintSummary';
import {
  Gable_Box_1Dimensions,
  GABLE_BOX_1_DEFAULTS,
  Gable_Box_1NestingParams,
  GABLE_BOX_1_DEFAULT_NESTING,
  generateGable_Box_1Geometry,
  buildGable_Box_1DimensionsSvg,
  getGable_Box_1SingleSvg,
  exportGable_Box_1SinglePdf,
  exportGable_Box_1SheetPdf,
  computeGable_Box_1Nesting,
} from '@/lib/gable_box_1';
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

export default function Gable_Box_1Calculator() {
  const [previewMode, setPreviewMode] = useState<PreviewMode>('template');
  const [dimUnit, setDimUnit] = useState<'mm' | 'cm' | 'in'>('mm');
  const [dimScale, setDimScale] = useState<number>(1);
  const [showDimensions, setShowDimensions] = useState(true);
  const [printSummaryOpen, setPrintSummaryOpen] = useState(false);

  // Draft state (for live editing in sidebar before clicking Save)
  const [draftDims, setDraftDims] = useState<Gable_Box_1Dimensions>(GABLE_BOX_1_DEFAULTS);
  const [draftNesting, setDraftNesting] = useState<Gable_Box_1NestingParams>(GABLE_BOX_1_DEFAULT_NESTING);

  // Applied state (rendered in 2D/3D models and calculations)
  const [appliedDims, setAppliedDims] = useState<Gable_Box_1Dimensions>(GABLE_BOX_1_DEFAULTS);
  const [appliedNesting, setAppliedNesting] = useState<Gable_Box_1NestingParams>(GABLE_BOX_1_DEFAULT_NESTING);

  const handleSaveChanges = useCallback(() => {
    setAppliedDims({ ...draftDims });
    setAppliedNesting({ ...draftNesting });
  }, [draftDims, draftNesting]);

  const handleResetDefaults = useCallback(() => {
    setDraftDims(GABLE_BOX_1_DEFAULTS);
    setDraftNesting(GABLE_BOX_1_DEFAULT_NESTING);
    setAppliedDims(GABLE_BOX_1_DEFAULTS);
    setAppliedNesting(GABLE_BOX_1_DEFAULT_NESTING);
  }, []);

  const geo = useMemo(() => generateGable_Box_1Geometry(appliedDims), [appliedDims]);
  const nestingResult = useMemo(() => computeGable_Box_1Nesting(appliedDims, appliedNesting), [appliedDims, appliedNesting]);

  const dimensionsSvgMarkup = useMemo(() => {
    if (!showDimensions) return undefined;
    return buildGable_Box_1DimensionsSvg(appliedDims, dimScale);
  }, [appliedDims, showDimensions, dimScale]);

  const singleSvgMarkup = useMemo(() => {
    return getGable_Box_1SingleSvg(appliedDims);
  }, [appliedDims]);

  return (
    <>
      <TemplateEditorLayout
        title="علبة قمة هرمية بمقبض وثقوب حبل (Gable Box with Handle & Rope Holes)"
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
            <Gable_Box_1Box3DPreview
              width={appliedDims.width}
              height={appliedDims.height}
              depth={appliedDims.depth}
              glueFlap={appliedDims.glueFlap}
              svgMarkup={singleSvgMarkup}
              svgWidth={geo.width}
              svgHeight={geo.height}
            />
          ) : (
            <Gable_Box_1SheetNestingPreview
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
                <NumField label="العرض (W)" value={draftDims.width} defaultValue={GABLE_BOX_1_DEFAULTS.width} unit={dimUnit} onChange={v => setDraftDims(prev => ({ ...prev, width: v }))} />
                <NumField label="الارتفاع (H)" value={draftDims.height} defaultValue={GABLE_BOX_1_DEFAULTS.height} unit={dimUnit} onChange={v => setDraftDims(prev => ({ ...prev, height: v }))} />
                <NumField label="العمق (D)" value={draftDims.depth} defaultValue={GABLE_BOX_1_DEFAULTS.depth} unit={dimUnit} onChange={v => setDraftDims(prev => ({ ...prev, depth: v }))} />
              </div>
            </section>

            <section className="pt-2 pb-3 border-b border-slate-100 space-y-2">
              <h3 className="text-sm font-bold mb-2">تخصيص متقدم</h3>
              <div className="grid grid-cols-2 gap-2">
                <NumField label="لسان اللصق" value={draftDims.glueFlap} defaultValue={GABLE_BOX_1_DEFAULTS.glueFlap} unit={dimUnit} onChange={v => setDraftDims(prev => ({ ...prev, glueFlap: v }))} />
                <NumField label="ارتفاع الرأس" value={draftDims.topHeaderHeight ?? GABLE_BOX_1_DEFAULTS.topHeaderHeight!} defaultValue={GABLE_BOX_1_DEFAULTS.topHeaderHeight} unit={dimUnit} onChange={v => setDraftDims(prev => ({ ...prev, topHeaderHeight: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <NumField label="قطر الثقب" value={draftDims.holeDiameter ?? GABLE_BOX_1_DEFAULTS.holeDiameter!} defaultValue={GABLE_BOX_1_DEFAULTS.holeDiameter} unit={dimUnit} onChange={v => setDraftDims(prev => ({ ...prev, holeDiameter: v }))} />
                <NumField label="ارتفاع القمة (Gable)" value={draftDims.gableHeight ?? GABLE_BOX_1_DEFAULTS.gableHeight!} defaultValue={GABLE_BOX_1_DEFAULTS.gableHeight} unit={dimUnit} onChange={v => setDraftDims(prev => ({ ...prev, gableHeight: v }))} />
              </div>
            </section>

            {previewMode === 'sheet' && (
              <section className="pt-2 pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold mb-2">إعدادات الشيت</h3>
                <div className="grid grid-cols-2 gap-2">
                  <NumField label="عرض الفرخ" value={draftNesting.sheetWidth} defaultValue={GABLE_BOX_1_DEFAULT_NESTING.sheetWidth} unit={dimUnit} onChange={v => setDraftNesting(prev => ({ ...prev, sheetWidth: v }))} />
                  <NumField label="ارتفاع الفرخ" value={draftNesting.sheetHeight} defaultValue={GABLE_BOX_1_DEFAULT_NESTING.sheetHeight} unit={dimUnit} onChange={v => setDraftNesting(prev => ({ ...prev, sheetHeight: v }))} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <NumField label="الهامش" value={draftNesting.margin} defaultValue={GABLE_BOX_1_DEFAULT_NESTING.margin} unit={dimUnit} onChange={v => setDraftNesting(prev => ({ ...prev, margin: v }))} />
                  <NumField label="المسافة (Gap)" value={draftNesting.spacing} defaultValue={GABLE_BOX_1_DEFAULT_NESTING.spacing} unit={dimUnit} onChange={v => setDraftNesting(prev => ({ ...prev, spacing: v }))} />
                </div>
              </section>
            )}
          </>
        }
      />

      <Gable_Box_1PrintSummary
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

const ExportSingleButton = ({ dims }: { dims: Gable_Box_1Dimensions }) => {
  const onExportSvg = () => {
    const svgStr = getGable_Box_1SingleSvg(dims, false);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Gable_Box_1.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onExportPdf = async () => {
    await exportGable_Box_1SinglePdf(dims);
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

const ExportSheetButton = ({ dims, nesting }: { dims: Gable_Box_1Dimensions; nesting: Gable_Box_1NestingParams }) => {
  const onExportSvg = async () => {
    const { downloadGable_Box_1SheetSvg } = await import('@/lib/gable_box_1/exportSheet');
    downloadGable_Box_1SheetSvg(dims, nesting);
  };
  const onExportPdf = async () => {
    await exportGable_Box_1SheetPdf(dims, nesting.sheetWidth, nesting.sheetHeight, nesting.margin, nesting.spacing);
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
