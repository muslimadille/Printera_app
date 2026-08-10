import { useMemo, useState } from 'react';
import { TemplateEditorLayout, PreviewMode } from '@/components/layouts/TemplateEditorLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Download, RotateCcw } from 'lucide-react';
import {
  A60_20_01_01_DEFAULTS,
  usableSheet,
  type A60_20_01_01Params,
  type A60_20_01_01Geometry,
} from '@/lib/a60_20_01_01/types';
import { buildA60_20_01_01Geometry } from '@/lib/a60_20_01_01/geometry';
import { buildA60_20_01_01DimensionsSvg } from '@/lib/a60_20_01_01/dimensionsOverlay';
import { computeA60_20_01_01Nesting, type A60_20_01_01NestingParams, type RotationMode } from '@/lib/a60_20_01_01/nesting';
import A60_20_01_01SheetNestingPreview from './A60_20_01_01SheetNestingPreview';
import A60_20_01_01PrintSummary from './A60_20_01_01PrintSummary';
import Box3DPreview from './Box3DPreview';
import { InteractiveSvgCanvas, type Segment } from '@/components/InteractiveSvgCanvas';
import { usePreviewSettings } from '@/hooks/usePreviewSettings';

const DEFAULT_NESTING: A60_20_01_01NestingParams = {
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
  return isNaN(n) ? fallback : n;
};

const UNIT_FACTORS: Record<'mm' | 'cm' | 'in', number> = { mm: 1, cm: 10, in: 25.4 };
const toDisplay = (mm: number, unit: 'mm' | 'cm' | 'in') => parseFloat((mm / UNIT_FACTORS[unit]).toFixed(4));
const toMm = (val: number, unit: 'mm' | 'cm' | 'in') => val * UNIT_FACTORS[unit];

const NumField = ({
  label, value, defaultValue, onChange, disabled, step = '0.01', min, unit,
}: {
  label: string; value: number; defaultValue?: number; onChange: (v: number) => void;
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

const A60_20_01_01Calculator = ({ isAdmin = true }: { isAdmin?: boolean }) => {
  const { show2DPreview, showNestingPreview, show3DPreview } = usePreviewSettings('A60_20_01_01');

  const [draftParams, setDraftParams] = useState<A60_20_01_01Params>(A60_20_01_01_DEFAULTS);
  const [appliedParams, setAppliedParams] = useState<A60_20_01_01Params>(A60_20_01_01_DEFAULTS);

  const [draftNesting, setDraftNesting] = useState<A60_20_01_01NestingParams>(DEFAULT_NESTING);
  const [appliedNesting, setAppliedNesting] = useState<A60_20_01_01NestingParams>(DEFAULT_NESTING);

  const [previewMode, setPreviewMode] = useState<PreviewMode>('template');
  const [showDimensions, setShowDimensions] = useState(true);
  const [dimUnit, setDimUnit] = useState<'mm' | 'cm' | 'in'>('mm');
  const [dimScale, setDimScale] = useState(1);
  const [printOpen, setPrintOpen] = useState(false);

  const [segmentOverrides, setSegmentOverrides] = useState<{ svg: string | null; segments: Segment[] | null }>({
    svg: null,
    segments: null,
  });

  const setN = <K extends keyof A60_20_01_01NestingParams>(k: K, v: A60_20_01_01NestingParams[K]) =>
    setDraftNesting(prev => ({ ...prev, [k]: v }));

  const set = <K extends keyof A60_20_01_01Params>(k: K, v: A60_20_01_01Params[K]) => {
    setDraftParams(prev => ({ ...prev, [k]: v }));
  };

  const handleSave = () => {
    setAppliedParams({ ...draftParams });
    setAppliedNesting({ ...draftNesting });
    setSegmentOverrides({ svg: null, segments: null });
    toast.success('تم تطبيق التعديلات بنجاح');
  };

  const handleReset = () => {
    setDraftParams({ ...A60_20_01_01_DEFAULTS });
    setAppliedParams({ ...A60_20_01_01_DEFAULTS });
    setDraftNesting({ ...DEFAULT_NESTING });
    setAppliedNesting({ ...DEFAULT_NESTING });
    setSegmentOverrides({ svg: null, segments: null });
    toast.info('تم إعادة تعيين جميع الأبعاد للقيم الافتراضية');
  };

  const nestingResult = useMemo(() => computeA60_20_01_01Nesting(appliedParams, appliedNesting), [appliedParams, appliedNesting]);
  const baseGeo = useMemo(() => buildA60_20_01_01Geometry(appliedParams), [appliedParams]);
  const usable = useMemo(() => usableSheet(appliedParams), [appliedParams]);

  const geo = useMemo<A60_20_01_01Geometry>(() => {
    if (segmentOverrides.svg && segmentOverrides.segments) {
      return {
        ...baseGeo,
        svg: segmentOverrides.svg,
        segments: segmentOverrides.segments,
      };
    }
    return baseGeo;
  }, [baseGeo, segmentOverrides]);

  const faceCoords = useMemo(() => {
    const W = appliedParams.width;
    const H = appliedParams.height;
    const D = appliedParams.depth;
    const Gf = appliedParams.glueFlap;
    const Tuck = appliedParams.tuck;

    const w1 = W;
    const w2 = D;
    const w3 = W;
    const w4 = Math.max(10, D - 0.5);

    const x0 = 0;
    const x1 = Gf;
    const x2 = x1 + w1;
    const x3 = x2 + w2;
    const x4 = x3 + w3;
    const x5 = x4 + w4;

    const lidCoverH = Math.max(10, D - 0.25);
    const y0 = 0;
    const yTuckCrease = y0 + Tuck;
    const y1 = yTuckCrease + lidCoverH;
    const y2 = y1 + H;
    const dustH = Math.min(32.0, D * 0.6);
    const crashH = 0.675 * D;
    const suppH = D / 2;

    const tMargin = Math.min(7.0, W * 0.15);
    const yLidSideTop = yTuckCrease - 0.75;
    const hTop = y0 + 0.7056;
    const vArcMid = y0 + 9.9554;

    // Top Lid Tuck Tongue Flap Polygon
    const lidPolygon: [number, number][] = [
      [x1, y1],
      [x1, yLidSideTop],
      [x1 + tMargin, yLidSideTop],
      [x1 + tMargin, yTuckCrease + 1.25],
      [x1 + 0.6, yLidSideTop],
      [x1 + 0.6, vArcMid],
      [x1 + 5.225, hTop],
      [x2 - 5.225, hTop],
      [x2 - 0.6, vArcMid],
      [x2 - 0.6, yLidSideTop],
      [x2 - tMargin, yTuckCrease + 1.25],
      [x2 - tMargin, yLidSideTop],
      [x2, yLidSideTop],
      [x2, y1],
    ];

    // Top Dust Flap 1 (over Side Panel 2)
    const df1Polygon: [number, number][] = [
      [x2, y1],
      [x2 + 3.0, y1 - 3.0],
      [x2 + 5.0, y1 - dustH],
      [x3 - 9.2, y1 - dustH],
      [x3 - 2.7, y1 - 7.0],
      [x3 - 0.75, y1 - 5.0],
      [x3 - 0.75, y1],
    ];

    // Top Dust Flap 2 (over Side Panel 4)
    const df2Polygon: [number, number][] = [
      [x5, y1],
      [x5 - 3.0, y1 - 3.0],
      [x5 - 5.0, y1 - dustH],
      [x4 + 9.2, y1 - dustH],
      [x4 + 2.75, y1 - 7.0],
      [x4 + 0.75, y1 - 5.0],
      [x4 + 0.75, y1],
    ];

    // Auto Lock Bottom Flap 1 (under Front Panel 1)
    const stepX = Math.min(D, W * 0.5);
    const foldStartX = x1 + W - suppH;
    const f1Polygon: [number, number][] = [
      [x1, y2],
      [x1 + 5.8632, y2 + crashH],
      [x1 + stepX - 5.75, y2 + crashH],
      [x1 + stepX, y2 + crashH - 5.75],
      [x1 + stepX, y2 + suppH],
      [foldStartX, y2 + suppH],
      [x1 + W - D / 4 - 1.25, y2 + crashH],
      [x2 - 2.0, y2 + crashH],
      [x2 - 2.0, y2 + 8.6],
      [x2 - 5.3, y2 + 5.3],
      [x2, y2],
    ];

    // Auto Lock Bottom Flap 2 (under Side Panel 2)
    const f2Polygon: [number, number][] = [
      [x2 + 1.5, y2],
      [x2 + 6.47, y2 + suppH],
      [x2 + suppH, y2 + suppH],
      [x3, y2],
    ];

    // Auto Lock Bottom Flap 3 (under Back Panel 3)
    const foldStartX3 = x3 + W - suppH;
    const f3Polygon: [number, number][] = [
      [x3, y2],
      [x3 + 5.8632, y2 + crashH],
      [x3 + stepX - 5.75, y2 + crashH],
      [x3 + stepX, y2 + crashH - 5.75],
      [x3 + stepX, y2 + suppH],
      [foldStartX3, y2 + suppH],
      [x3 + W - D / 4 - 1.25, y2 + crashH],
      [x4 - 2.0, y2 + crashH],
      [x4 - 2.0, y2 + 8.6],
      [x4 - 5.3, y2 + 5.3],
      [x4, y2],
    ];

    // Auto Lock Bottom Flap 4 (under Side Panel 4)
    const f4Polygon: [number, number][] = [
      [x4 + 1.5, y2],
      [x4 + 6.4065, y2 + suppH - 0.25],
      [x4 + w4 / 2, y2 + suppH - 0.25],
      [x5, y2],
    ];

    return {
      body: [
        { name: 'Front', x: x1, y: y1, w: W, h: H },
        { name: 'Side1', x: x2, y: y1, w: D, h: H },
        { name: 'Back',  x: x3, y: y1, w: W, h: H },
        { name: 'Side2', x: x4, y: y1, w: w4, h: H },
      ] as any,
      glue: { name: 'GlueFlap', x: x0, y: y1, w: Gf, h: H },
      topFlaps: [
        { name: 'TopLid', x: x1, y: y0, w: W, h: lidCoverH + Tuck, polygon: lidPolygon },
        { name: 'TopDust1', x: x2, y: y1 - dustH, w: D, h: dustH, polygon: df1Polygon },
        { name: 'TopDust2', x: x3, y: y1, w: W, h: 0 },
        { name: 'TopDust3', x: x4, y: y1 - dustH, w: w4, h: dustH, polygon: df2Polygon },
      ] as any,
      bottomFlaps: [
        { name: 'AutoLock1', x: x1, y: y2, w: W, h: crashH, polygon: f1Polygon },
        { name: 'AutoLock2', x: x2, y: y2, w: D, h: suppH, polygon: f2Polygon },
        { name: 'AutoLock3', x: x3, y: y2, w: W, h: crashH, polygon: f3Polygon },
        { name: 'AutoLock4', x: x4, y: y2, w: w4, h: suppH, polygon: f4Polygon },
      ] as any,
    };
  }, [appliedParams]);

  const dimsSvg = useMemo(
    () => (showDimensions ? buildA60_20_01_01DimensionsSvg(appliedParams, dimUnit, dimScale) : ''),
    [showDimensions, appliedParams, dimUnit, dimScale],
  );

  return (
    <>
      <TemplateEditorLayout
        title="A60_20_01_01 — علبة ذاتية القفل ECMA (Auto Lock Bottom Box)"
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
            <ExportSheetButton params={appliedParams} nesting={appliedNesting} result={nestingResult} />
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
              <A60_20_01_01SheetNestingPreview params={appliedParams} nesting={appliedNesting} />
            ) : (
              <Box3DPreview
                boxType="A60_20_01_01"
                lidTongue={appliedParams.tuck}
                panelWidths={[appliedParams.width, appliedParams.depth, appliedParams.width, Math.max(10, appliedParams.depth - 0.5)]}
                panelHeights={appliedParams.height}
                glueFlapWidth={appliedParams.glueFlap}
                topFlapHeights={[appliedParams.depth - 0.25 + appliedParams.tuck, Math.min(32.0, appliedParams.depth * 0.6), 0, Math.min(32.0, appliedParams.depth * 0.6)]}
                bottomFlapHeights={[0.675 * appliedParams.depth, appliedParams.depth / 2, 0.675 * appliedParams.depth, appliedParams.depth / 2]}
                svgMarkup={geo.svg}
                svgWidth={geo.bbox.w}
                svgHeight={geo.bbox.h}
                faceCoords={faceCoords}
              />
            )}
          </>
        }
        sidebarArea={
          <>
            {/* أبعاد العلبة */}
            <section className="pt-3 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold mb-2">أبعاد العلبة</h3>
              <div className="grid grid-cols-3 gap-2">
                <NumField label="العرض" value={draftParams.width} defaultValue={A60_20_01_01_DEFAULTS.width} unit={dimUnit} onChange={v => set('width', v)} />
                <NumField label="الارتفاع" value={draftParams.height} defaultValue={A60_20_01_01_DEFAULTS.height} unit={dimUnit} onChange={v => set('height', v)} />
                <NumField label="العمق" value={draftParams.depth} defaultValue={A60_20_01_01_DEFAULTS.depth} unit={dimUnit} onChange={v => set('depth', v)} />
              </div>
            </section>

            {/* تخصيص متقدم */}
            <section className="pt-2 pb-3 border-b border-slate-100 space-y-2">
              <h3 className="text-sm font-bold mb-2">تخصيص متقدم</h3>
              <div className="grid grid-cols-2 gap-2">
                <NumField label="لسان اللصق" value={draftParams.glueFlap} defaultValue={A60_20_01_01_DEFAULTS.glueFlap} unit={dimUnit} onChange={v => set('glueFlap', v)} />
                <NumField label="لسان الغطاء" value={draftParams.tuck} defaultValue={A60_20_01_01_DEFAULTS.tuck} unit={dimUnit} onChange={v => set('tuck', v)} />
              </div>
            </section>

            {/* إعدادات الشيت */}
            {showNestingPreview && previewMode === 'sheet' && (
              <section className="pt-2 pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold mb-2">إعدادات الشيت</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="عرض الشيت" value={draftParams.sheetWidth} defaultValue={A60_20_01_01_DEFAULTS.sheetWidth} unit={dimUnit} onChange={v => set('sheetWidth', v)} />
                  <NumField label="ارتفاع الشيت" value={draftParams.sheetHeight} defaultValue={A60_20_01_01_DEFAULTS.sheetHeight} unit={dimUnit} onChange={v => set('sheetHeight', v)} />
                  <NumField label="القابض" value={draftParams.gripper} defaultValue={A60_20_01_01_DEFAULTS.gripper} unit={dimUnit} onChange={v => set('gripper', v)} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <NumField label="الهامش" value={draftParams.sheetMargin} defaultValue={A60_20_01_01_DEFAULTS.sheetMargin} unit={dimUnit} onChange={v => set('sheetMargin', v)} />
                  <NumField label="التباعد الأفقي" value={draftNesting.horizontalGap} defaultValue={DEFAULT_NESTING.horizontalGap} step="0.1" min="0" unit={dimUnit} onChange={v => setN('horizontalGap', v)} />
                  <NumField label="التباعد العمودي" value={draftNesting.verticalGap} defaultValue={DEFAULT_NESTING.verticalGap} step="0.1" min="0" unit={dimUnit} onChange={v => setN('verticalGap', v)} />
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                  <div>الصافي: {usable.width.toFixed(2)} × {usable.height.toFixed(2)} مم</div>
                </div>
              </section>
            )}
          </>
        }
      />

      <A60_20_01_01PrintSummary
        open={printOpen}
        onOpenChange={setPrintOpen}
        params={appliedParams}
        nesting={appliedNesting}
        geo={geo}
      />
    </>
  );
};

const ExportSingleButton = ({ params, geo }: { params: A60_20_01_01Params; geo: A60_20_01_01Geometry }) => {
  const onExportSvg = async () => {
    const { downloadA60_20_01_01SingleTemplate } = await import('@/lib/a60_20_01_01/exportSingle');
    downloadA60_20_01_01SingleTemplate(geo, `A60_20_01_01_${params.width}x${params.height}x${params.depth}mm.svg`);
  };
  const onExportPdf = async () => {
    const { buildA60_20_01_01SingleTemplateSvg, downloadA60_20_01_01SingleTemplatePdf } = await import('@/lib/a60_20_01_01/exportSingle');
    const svg = buildA60_20_01_01SingleTemplateSvg(geo);
    await downloadA60_20_01_01SingleTemplatePdf(svg, `A60_20_01_01_${params.width}x${params.height}x${params.depth}mm.pdf`);
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
  params, nesting, result,
}: {
  params: A60_20_01_01Params;
  nesting: A60_20_01_01NestingParams;
  result: ReturnType<typeof computeA60_20_01_01Nesting>;
}) => {
  const disabled = result.fitStatus !== 'fits' || result.total <= 0;
  const onExportSvg = async () => {
    const { downloadA60_20_01_01SheetLayout } = await import('@/lib/a60_20_01_01/exportSheet');
    downloadA60_20_01_01SheetLayout(params, nesting, result);
  };
  const onExportPdf = async () => {
    const { downloadA60_20_01_01SheetLayoutPdf } = await import('@/lib/a60_20_01_01/exportSheet');
    await downloadA60_20_01_01SheetLayoutPdf(params, nesting, result);
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

export default A60_20_01_01Calculator;
