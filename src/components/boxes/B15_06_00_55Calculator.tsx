import { TemplateEditorLayout, PreviewMode } from '@/components/layouts/TemplateEditorLayout';
// B15_06_00_55 — ECMA B15 Lock-Bottom Box with Rollover Lid
// Strictly standardized to match T0002 gold standard.

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
  B15_06_00_55_DEFAULTS,
  B15_06_00_55_REFERENCE,
  type B15_06_00_55Params,
  type B15_06_00_55Geometry,
  usableSheet,
} from '@/lib/b15_06_00_55/types';
import { buildB15_06_00_55Geometry } from '@/lib/b15_06_00_55/geometry';
import { buildB15_06_00_55DimensionsSvg } from '@/lib/b15_06_00_55/dimensionsOverlay';
import {
  computeB15_06_00_55Nesting,
  type B15_06_00_55NestingParams,
  type RotationMode,
} from '@/lib/b15_06_00_55/nesting';
import B15_06_00_55SheetNestingPreview from './B15_06_00_55SheetNestingPreview';
import B15_06_00_55Box3DPreview from './B15_06_00_55Box3DPreview';
import { InteractiveSvgCanvas, type Segment } from '@/components/InteractiveSvgCanvas';
import { usePreviewSettings } from '@/hooks/usePreviewSettings';

const DEFAULT_NESTING: B15_06_00_55NestingParams = {
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

const B15_06_00_55Calculator = ({ isAdmin = false }: { isAdmin?: boolean }) => {
  const { show2DPreview, showNestingPreview, show3DPreview } = usePreviewSettings('B15_06_00_55');

  // Draft params (for sidebar input controls)
  const [draftParams, setDraftParams] = useState<B15_06_00_55Params>(B15_06_00_55_DEFAULTS);
  const [draftNesting, setDraftNesting] = useState<B15_06_00_55NestingParams>(DEFAULT_NESTING);

  // Applied params (for 2D canvas, geometry, 3D preview, nesting layout & exports)
  const [appliedParams, setAppliedParams] = useState<B15_06_00_55Params>(B15_06_00_55_DEFAULTS);
  const [appliedNesting, setAppliedNesting] = useState<B15_06_00_55NestingParams>(DEFAULT_NESTING);

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
  const setDraft = <K extends keyof B15_06_00_55Params>(k: K, v: B15_06_00_55Params[K]) => {
    setDraftParams(prev => ({ ...prev, [k]: v }));
  };

  const setDraftN = <K extends keyof B15_06_00_55NestingParams>(k: K, v: B15_06_00_55NestingParams[K]) =>
    setDraftNesting(prev => ({ ...prev, [k]: v }));

  // Applies draft changes to the actual template canvas & 3D model
  const handleSave = () => {
    setAppliedParams(draftParams);
    setAppliedNesting(draftNesting);
    setSegmentOverrides({ svg: null, segments: null });
  };

  // Resets both draft and applied params back to default values
  const handleReset = () => {
    setDraftParams(B15_06_00_55_DEFAULTS);
    setAppliedParams(B15_06_00_55_DEFAULTS);
    setDraftNesting(DEFAULT_NESTING);
    setAppliedNesting(DEFAULT_NESTING);
    setSegmentOverrides({ svg: null, segments: null });
    setDimScale(1);
  };

  const usable = useMemo(() => usableSheet(appliedParams), [appliedParams]);

  const geo = useMemo<B15_06_00_55Geometry>(() => {
    const raw = buildB15_06_00_55Geometry(appliedParams);
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
    () => computeB15_06_00_55Nesting(appliedParams, appliedNesting, geo.bbox.w, geo.bbox.h),
    [appliedParams, appliedNesting, geo.bbox.w, geo.bbox.h]
  );

  const dimsSvg = useMemo(
    () => (showDimensions ? buildB15_06_00_55DimensionsSvg(geo, dimUnit, dimScale) : ''),
    [geo, showDimensions, dimUnit, dimScale]
  );

  return (
    <>
      <TemplateEditorLayout
        title="B15_06_00_55 — علبة بقفل ذاتي وغطاء متداخل (ECMA Lock-Bottom Box)"
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
              <B15_06_00_55SheetNestingPreview
                params={appliedParams}
                nesting={appliedNesting}
                result={nestingResult}
              />
            ) : (
              <B15_06_00_55Box3DPreview
                width={appliedParams.width}
                height={appliedParams.height}
                depth={appliedParams.depth}
                tuckFlap={appliedParams.tuckFlap}
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
                <NumField label="العرض" value={draftParams.width} defaultValue={B15_06_00_55_DEFAULTS.width} unit={dimUnit} onChange={v => setDraft('width', v)} />
                <NumField label="الارتفاع" value={draftParams.height} defaultValue={B15_06_00_55_DEFAULTS.height} unit={dimUnit} onChange={v => setDraft('height', v)} />
                <NumField label="العمق" value={draftParams.depth} defaultValue={B15_06_00_55_DEFAULTS.depth} unit={dimUnit} onChange={v => setDraft('depth', v)} />
              </div>
            </section>

            <section className="pt-2 pb-3 border-b border-slate-100 space-y-2">
              <h3 className="text-sm font-bold mb-2">تخصيص متقدم</h3>
              <div className="grid grid-cols-2 gap-2">
                <NumField label="لسان التداخل" value={draftParams.tuckFlap} defaultValue={B15_06_00_55_DEFAULTS.tuckFlap} unit={dimUnit} onChange={v => setDraft('tuckFlap', v)} />
              </div>
            </section>

            {showNestingPreview && previewMode === 'sheet' && (
              <section className="pt-2 pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold mb-2">إعدادات الشيت</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="عرض الشيت" value={draftParams.sheetWidth} defaultValue={B15_06_00_55_DEFAULTS.sheetWidth} unit={dimUnit} onChange={v => setDraft('sheetWidth', v)} />
                  <NumField label="ارتفاع الشيت" value={draftParams.sheetHeight} defaultValue={B15_06_00_55_DEFAULTS.sheetHeight} unit={dimUnit} onChange={v => setDraft('sheetHeight', v)} />
                  <NumField label="القابض" value={draftParams.gripper} defaultValue={B15_06_00_55_DEFAULTS.gripper} unit={dimUnit} onChange={v => setDraft('gripper', v)} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <NumField label="الهامش" value={draftParams.sheetMargin} defaultValue={B15_06_00_55_DEFAULTS.sheetMargin} unit={dimUnit} onChange={v => setDraft('sheetMargin', v)} />
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

const ExportSingleButton = ({ params, geo }: { params: B15_06_00_55Params; geo: B15_06_00_55Geometry }) => {
  const onExportSvg = async () => {
    const { downloadB15_06_00_55SingleTemplate } = await import('@/lib/b15_06_00_55/exportSingle');
    const name = `B15_06_00_55_${params.width}x${params.height}x${params.depth}.svg`;
    downloadB15_06_00_55SingleTemplate(geo, name);
  };
  const onExportPdf = async () => {
    const { downloadB15_06_00_55SingleTemplatePdf } = await import('@/lib/b15_06_00_55/exportSingle');
    const name = `B15_06_00_55_${params.width}x${params.height}x${params.depth}.pdf`;
    await downloadB15_06_00_55SingleTemplatePdf(geo.svg, name);
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
  params: B15_06_00_55Params;
  nesting: B15_06_00_55NestingParams;
  result: ReturnType<typeof computeB15_06_00_55Nesting>;
}) => {
  const disabled = result.fitStatus !== 'fits' || result.total <= 0;
  const onExportSvg = async () => {
    const { downloadB15_06_00_55SheetLayout } = await import('@/lib/b15_06_00_55/exportSheet');
    downloadB15_06_00_55SheetLayout(params, nesting, result);
  };
  const onExportPdf = async () => {
    const { downloadB15_06_00_55SheetLayoutPdf } = await import('@/lib/b15_06_00_55/exportSheet');
    await downloadB15_06_00_55SheetLayoutPdf(params, nesting, result);
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

export default B15_06_00_55Calculator;
