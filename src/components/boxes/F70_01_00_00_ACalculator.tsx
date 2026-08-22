import { TemplateEditorLayout, PreviewMode } from '@/components/layouts/TemplateEditorLayout';
// F70_01_00_00_A — ECMA Pillow Box (علبة وسادة)
// Official reference implementation strictly standardized to match T0002 gold standard.

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Download, RotateCcw } from 'lucide-react';
import {
  F70_01_00_00_A_DEFAULTS,
  F70_01_00_00_A_REFERENCE,
  type F70_01_00_00_AParams,
  type F70_01_00_00_AGeometry,
  usableSheet,
} from '@/lib/f70_01_00_00_a/types';
import { buildF70_01_00_00_AGeometry } from '@/lib/f70_01_00_00_a/geometry';
import { buildF70_01_00_00_ADimensionsSvg } from '@/lib/f70_01_00_00_a/dimensionsOverlay';
import {
  computeF70_01_00_00_ANesting,
  type F70_01_00_00_ANestingParams,
  type RotationMode,
} from '@/lib/f70_01_00_00_a/nesting';
import F70_01_00_00_ASheetNestingPreview from './F70_01_00_00_ASheetNestingPreview';
import PillowBox3DPreview from './PillowBox3DPreview';
import { InteractiveSvgCanvas, type Segment } from '@/components/InteractiveSvgCanvas';
import { usePreviewSettings } from '@/hooks/usePreviewSettings';

const DEFAULT_NESTING: F70_01_00_00_ANestingParams = {
  horizontalGap: 3,
  verticalGap: 3,
  allowRotation: true,
  rotationMode: 'auto',
  horizontalInterlock: 0,
  verticalInterlock: 0,
  smartAuto: true,
};

const num = (v: string, fallback: number) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

const UNIT_FACTORS: Record<'mm' | 'cm' | 'in', number> = { mm: 1, cm: 10, in: 25.4 };
const toDisplay = (mm: number, unit: 'mm' | 'cm' | 'in') => parseFloat((mm / UNIT_FACTORS[unit]).toFixed(4));
const toMm = (val: number, unit: 'mm' | 'cm' | 'in') => val * UNIT_FACTORS[unit];

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

const F70_01_00_00_ACalculator = ({ isAdmin = false }: { isAdmin?: boolean }) => {
  const { show2DPreview, showNestingPreview, show3DPreview } = usePreviewSettings('F70_01_00_00_A');

  // Draft params (for sidebar input controls)
  const [draftParams, setDraftParams] = useState<F70_01_00_00_AParams>(F70_01_00_00_A_DEFAULTS);
  const [draftNesting, setDraftNesting] = useState<F70_01_00_00_ANestingParams>(DEFAULT_NESTING);

  // Applied params (for 2D canvas, geometry, 3D preview, nesting layout & exports)
  const [appliedParams, setAppliedParams] = useState<F70_01_00_00_AParams>(F70_01_00_00_A_DEFAULTS);
  const [appliedNesting, setAppliedNesting] = useState<F70_01_00_00_ANestingParams>(DEFAULT_NESTING);

  const [previewMode, setPreviewMode] = useState<'template' | 'sheet' | 'three'>('template');
  const [showDimensions, setShowDimensions] = useState(true);
  const [dimUnit, setDimUnit] = useState<'mm' | 'cm' | 'in'>('mm');
  const [dimScale, setDimScale] = useState(1);

  // Segment overrides state for interactive line adjustments
  const [segmentOverrides, setSegmentOverrides] = useState<{ svg: string | null; segments: Segment[] | null }>({
    svg: null,
    segments: null,
  });

  // Updates ONLY draft state (sidebar inputs), DOES NOT re-render template canvas
  const setDraft = <K extends keyof F70_01_00_00_AParams>(k: K, v: F70_01_00_00_AParams[K]) => {
    setDraftParams(prev => ({ ...prev, [k]: v }));
  };

  const setDraftN = <K extends keyof F70_01_00_00_ANestingParams>(k: K, v: F70_01_00_00_ANestingParams[K]) =>
    setDraftNesting(prev => ({ ...prev, [k]: v }));

  // Applies draft changes to the actual template canvas & 3D model
  const handleSave = () => {
    setAppliedParams(draftParams);
    setAppliedNesting(draftNesting);
    setSegmentOverrides({ svg: null, segments: null });
  };

  // Resets both draft and applied params back to default values
  const handleReset = () => {
    setDraftParams(F70_01_00_00_A_DEFAULTS);
    setAppliedParams(F70_01_00_00_A_DEFAULTS);
    setDraftNesting(DEFAULT_NESTING);
    setAppliedNesting(DEFAULT_NESTING);
    setSegmentOverrides({ svg: null, segments: null });
    setDimScale(1);
  };

  const usable = useMemo(() => usableSheet(appliedParams), [appliedParams]);

  const geo = useMemo<F70_01_00_00_AGeometry>(() => {
    const raw = buildF70_01_00_00_AGeometry(appliedParams);
    if (segmentOverrides.svg) {
      return {
        ...raw,
        svg: segmentOverrides.svg,
        segments: segmentOverrides.segments || raw.segments,
      };
    }
    return raw;
  }, [appliedParams, segmentOverrides]);

  const nestingResult = useMemo(
    () => computeF70_01_00_00_ANesting(appliedParams, appliedNesting),
    [appliedParams, appliedNesting]
  );

  const dimsSvg = useMemo(
    () => (showDimensions ? buildF70_01_00_00_ADimensionsSvg(geo, dimUnit, dimScale) : ''),
    [geo, showDimensions, dimUnit, dimScale]
  );

  return (
    <>
      <TemplateEditorLayout
        title="F70_01_00_00_A — علبة وسادة (ECMA Pillow Box)"
        previewMode={previewMode}
        onPreviewModeChange={setPreviewMode}
        hasTemplatePreview={show2DPreview}
        hasSheetPreview={showNestingPreview}
        has3DPreview={show3DPreview}
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
            <ExportSingleButton params={appliedParams} geo={geo} />
            {showNestingPreview && (
              <ExportSheetButton params={appliedParams} nesting={appliedNesting} result={nestingResult} />
            )}
          </>
        }
        previewArea={
          <>
            {previewMode === 'template' ? (
              <div className="w-full h-full relative overflow-hidden">
                <InteractiveSvgCanvas
                  segments={geo.segments}
                  svgWidth={geo.bbox.w}
                  svgHeight={geo.bbox.h}
                  dimensionsMarkup={dimsSvg}
                  showDimensions={showDimensions}
                  onShowDimensionsChange={setShowDimensions}
                  onChange={(newSvg, newSegs) => {
                    setSegmentOverrides({ svg: newSvg, segments: newSegs });
                  }}
                />
              </div>
            ) : previewMode === 'sheet' ? (
              <F70_01_00_00_ASheetNestingPreview
                params={appliedParams}
                nesting={appliedNesting}
                result={nestingResult}
              />
            ) : (
              <PillowBox3DPreview
                width={appliedParams.width}
                height={appliedParams.height}
                depth={appliedParams.depth}
                glueFlap={appliedParams.glueFlap}
                svgMarkup={geo.svg}
                svgWidth={geo.bbox.w}
                svgHeight={geo.bbox.h}
              />
            )}
          </>
        }
        sidebarArea={
          <>
            <section className="pt-3 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold mb-2">أبعاد العلبة</h3>
              <div className="grid grid-cols-3 gap-2">
                <NumField label="العرض" value={draftParams.width} defaultValue={F70_01_00_00_A_DEFAULTS.width} unit={dimUnit} onChange={v => setDraft('width', v)} />
                <NumField label="الارتفاع" value={draftParams.height} defaultValue={F70_01_00_00_A_DEFAULTS.height} unit={dimUnit} onChange={v => setDraft('height', v)} />
                <NumField label="العمق" value={draftParams.depth} defaultValue={F70_01_00_00_A_DEFAULTS.depth} unit={dimUnit} onChange={v => setDraft('depth', v)} />
              </div>
            </section>

            <section className="pt-2 pb-3 border-b border-slate-100 space-y-2">
              <h3 className="text-sm font-bold mb-2">تخصيص متقدم</h3>
              <div className="grid grid-cols-2 gap-2">
                <NumField label="لسان اللصق" value={draftParams.glueFlap} defaultValue={F70_01_00_00_A_DEFAULTS.glueFlap} unit={dimUnit} onChange={v => setDraft('glueFlap', v)} />
                <NumField label="فتحة الإصبع" value={draftParams.thumbNotchRadius} defaultValue={F70_01_00_00_A_DEFAULTS.thumbNotchRadius} unit={dimUnit} onChange={v => setDraft('thumbNotchRadius', v)} />
              </div>
            </section>

            {showNestingPreview && previewMode === 'sheet' && (
              <section className="pt-2 pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold mb-2">إعدادات الشيت</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="عرض الشيت" value={draftParams.sheetWidth} defaultValue={F70_01_00_00_A_DEFAULTS.sheetWidth} unit={dimUnit} onChange={v => setDraft('sheetWidth', v)} />
                  <NumField label="ارتفاع الشيت" value={draftParams.sheetHeight} defaultValue={F70_01_00_00_A_DEFAULTS.sheetHeight} unit={dimUnit} onChange={v => setDraft('sheetHeight', v)} />
                  <NumField label="القابض" value={draftParams.gripper} defaultValue={F70_01_00_00_A_DEFAULTS.gripper} unit={dimUnit} onChange={v => setDraft('gripper', v)} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <NumField label="الهامش" value={draftParams.sheetMargin} defaultValue={F70_01_00_00_A_DEFAULTS.sheetMargin} unit={dimUnit} onChange={v => setDraft('sheetMargin', v)} />
                  <NumField label="التباعد الأفقي" value={draftNesting.horizontalGap} defaultValue={DEFAULT_NESTING.horizontalGap} step="0.1" min="0" unit={dimUnit} onChange={v => setDraftN('horizontalGap', v)} />
                  <NumField label="التباعد العمودي" value={draftNesting.verticalGap} defaultValue={DEFAULT_NESTING.verticalGap} step="0.1" min="0" unit={dimUnit} onChange={v => setDraftN('verticalGap', v)} />
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                  <div>الصافي: {usable.width.toFixed(2)} × {usable.height.toFixed(2)} مم</div>
                </div>
              </section>
            )}
          </>
        }
      />
    </>
  );
};

const ExportSingleButton = ({ params, geo }: { params: F70_01_00_00_AParams; geo: F70_01_00_00_AGeometry }) => {
  const onExportSvg = async () => {
    const { downloadF70_01_00_00_ASingleTemplate } = await import('@/lib/f70_01_00_00_a/exportSingle');
    const name = `F70_01_00_00_A_${params.width}x${params.height}x${params.depth}.svg`;
    downloadF70_01_00_00_ASingleTemplate(geo, name);
  };
  const onExportPdf = async () => {
    const { downloadF70_01_00_00_ASingleTemplatePdf } = await import('@/lib/f70_01_00_00_a/exportSingle');
    const name = `F70_01_00_00_A_${params.width}x${params.height}x${params.depth}.pdf`;
    await downloadF70_01_00_00_ASingleTemplatePdf(geo.svg, name);
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

const ExportSheetButton = ({
  params,
  nesting,
  result,
}: {
  params: F70_01_00_00_AParams;
  nesting: F70_01_00_00_ANestingParams;
  result: ReturnType<typeof computeF70_01_00_00_ANesting>;
}) => {
  const disabled = result.fitStatus !== 'fits' || result.total <= 0;
  const onExportSvg = async () => {
    const { downloadF70_01_00_00_ASheetLayout } = await import('@/lib/f70_01_00_00_a/exportSheet');
    downloadF70_01_00_00_ASheetLayout(params, nesting, result);
  };
  const onExportPdf = async () => {
    const { downloadF70_01_00_00_ASheetLayoutPdf } = await import('@/lib/f70_01_00_00_a/exportSheet');
    await downloadF70_01_00_00_ASheetLayoutPdf(params, nesting, result);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" size="sm" disabled={disabled}>
          <Download className="w-4 h-4 ml-1.5" />
          تصدير التوزيع
          <ChevronDown className="w-3 h-3 mr-1.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onExportSvg} disabled={disabled}>تصدير SVG</DropdownMenuItem>
        <DropdownMenuItem onSelect={onExportPdf} disabled={disabled}>تصدير PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default F70_01_00_00_ACalculator;
