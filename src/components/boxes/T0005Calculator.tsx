import { TemplateEditorLayout, PreviewMode } from '@/components/layouts/TemplateEditorLayout';
// T0005 — Dynamic Dieline tab (Open-Top Box with Locking Tab Bottom)
// Renders the calculator, 2D interactive canvas, 3D folding preview, and auto-nesting.

import { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Download, RotateCcw } from 'lucide-react';
import {
  T0005_DEFAULTS,
  T0005_REFERENCE,
  T0005_RULES,
  type T0005Params,
  type T0005Geometry,
  usableSheet
} from '@/lib/t0005/types';
import { buildT0005Geometry } from '@/lib/t0005/geometry';
import { buildT0005DimensionsSvg } from '@/lib/t0005/dimensionsOverlay';
import { computeT0005Nesting, type T0005NestingParams, type RotationMode } from '@/lib/t0005/nesting';
import T0005SheetNestingPreview from './T0005SheetNestingPreview';
import T0005PrintSummary from './T0005PrintSummary';
import Box3DPreview, { type Panel2DInfo } from './Box3DPreview';
import { InteractiveSvgCanvas, type Segment } from '@/components/InteractiveSvgCanvas';
import { usePreviewSettings } from '@/hooks/usePreviewSettings';

const DEFAULT_NESTING: T0005NestingParams = {
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
    <Label className="text-xs">{label} {unit && <span className="text-muted-foreground">({unit})</span>}</Label>
    <Input type="number" step={step} min={min}
      value={unit ? toDisplay(value, unit) : value}
      disabled={disabled}
      onChange={e => onChange(unit ? toMm(num(e.target.value, toDisplay(value, unit)), unit) : num(e.target.value, value))} />
  </div>
);

const T0005Calculator = ({ isAdmin = false }: { isAdmin?: boolean }) => {
  const { show2DPreview, showNestingPreview, show3DPreview } = usePreviewSettings('T0005');

  const hiddenCls = isAdmin ? '' : 'hidden';

  const [draftParams, setDraftParams] = useState<T0005Params>(T0005_DEFAULTS);
  const [appliedParams, setAppliedParams] = useState<T0005Params>(T0005_DEFAULTS);

  const [draftNesting, setDraftNesting] = useState<T0005NestingParams>(DEFAULT_NESTING);
  const [appliedNesting, setAppliedNesting] = useState<T0005NestingParams>(DEFAULT_NESTING);

  const [previewMode, setPreviewMode] = useState<'template' | 'sheet' | 'three'>('template');
  const [showDimensions, setShowDimensions] = useState(true);
  const [dimUnit, setDimUnit] = useState<'mm' | 'cm' | 'in'>('mm');
  const [printOpen, setPrintOpen] = useState(false);

  // Segment overrides state for interactive line adjustments
  const [segmentOverrides, setSegmentOverrides] = useState<{ svg: string | null; segments: Segment[] | null }>({
    svg: null,
    segments: null,
  });

  const setN = <K extends keyof T0005NestingParams>(k: K, v: T0005NestingParams[K]) =>
    setDraftNesting(prev => ({ ...prev, [k]: v }));

  const set = <K extends keyof T0005Params>(k: K, v: T0005Params[K]) => {
    setDraftParams(prev => ({ ...prev, [k]: v }));
  };

  const handleSave = () => {
    setAppliedParams({ ...draftParams });
    setAppliedNesting({ ...draftNesting });
    setSegmentOverrides({ svg: null, segments: null });
    toast.success('تم حفظ التعديلات وتطبيقها');
  };

  const handleReset = () => {
    setDraftParams({ ...T0005_DEFAULTS });
    setAppliedParams({ ...T0005_DEFAULTS });
    setDraftNesting({ ...DEFAULT_NESTING });
    setAppliedNesting({ ...DEFAULT_NESTING });
    setSegmentOverrides({ svg: null, segments: null });
    toast.info('تم إعادة تعيين جميع الأبعاد للقيم الافتراضية');
  };

  const usable = useMemo(() => usableSheet(appliedParams), [appliedParams]);
  const nestingResult = useMemo(() => computeT0005Nesting(appliedParams, appliedNesting), [appliedParams, appliedNesting]);

  // Base geometry calculation
  const baseGeo = useMemo(() => buildT0005Geometry(appliedParams), [appliedParams]);

  // Derived geometry incorporating canvas overrides
  const geo = useMemo<T0005Geometry>(() => {
    if (segmentOverrides.svg && segmentOverrides.segments) {
      const segs = segmentOverrides.segments;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const s of segs) {
        if (s.geometry === 'line') {
          if (s.start.x < minX) minX = s.start.x;
          if (s.start.x > maxX) maxX = s.start.x;
          if (s.end.x < minX) minX = s.end.x;
          if (s.end.x > maxX) maxX = s.end.x;
          if (s.start.y < minY) minY = s.start.y;
          if (s.start.y > maxY) maxY = s.start.y;
          if (s.end.y < minY) minY = s.end.y;
          if (s.end.y > maxY) maxY = s.end.y;
        } else if (s.geometry === 'polyline' && s.points) {
          s.points.forEach(pt => {
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
          });
        }
      }
      const w = maxX - minX > 0 ? maxX - minX : baseGeo.bbox.w;
      const h = maxY - minY > 0 ? maxY - minY : baseGeo.bbox.h;
      return {
        ...baseGeo,
        svg: segmentOverrides.svg,
        segments: segmentOverrides.segments,
        bbox: { w, h },
        derived: {
          ...baseGeo.derived,
          width: w,
          height: h
        }
      };
    }
    return baseGeo;
  }, [baseGeo, segmentOverrides]);

  const faceCoords = useMemo(() => {
    const W = params.width;
    const H = params.height;
    const D = params.depth;
    const Gf = params.glueFlap;
    const Lt = params.lidTongue;
    const Df = params.dustFlap;
    const d2 = D - 0.5;

    const Xg = 0;
    const Xf1 = Gf;
    const Xd1 = Gf + W;
    const Xf2 = Gf + W + D;
    const Xd2 = Gf + 2 * W + D;
    const Xd2R = Xd2 + d2;

    const Yft = 0.7055;
    const Yfb = Yft + H;

    return {
      body: [
        {
          x: Xf1, y: Yft, w: W, h: H,
          polygon: [
            [Xf1, Yft],
            [Xf1, Yfb],
            [Xd1, Yfb],
            [Xd1, Yft],
          ] as [number, number][],
          holes: [
            [
              [Xf1 + 0.415 * W, Yfb],
              [Xf1 + 0.435 * W, Yfb - 4.5],
              [Xf1 + 0.500 * W, Yfb - 7.95],
              [Xf1 + 0.565 * W, Yfb - 4.5],
              [Xf1 + 0.585 * W, Yfb],
            ]
          ] as [number, number][][],
        },
        { x: Xd1, y: Yft, w: D, h: H },
        { x: Xf2, y: Yft, w: W, h: H },
        { x: Xd2, y: Yft, w: d2, h: H },
      ] as [Panel2DInfo, Panel2DInfo, Panel2DInfo, Panel2DInfo],
      glue: {
        x: Xg, y: Yft, w: Gf, h: H,
        polygon: [
          [Xf1, Yft],
          [Xg + 0.71, Yft + 3.0],
          [Xg + 0.71, Yfb - 3.0],
          [Xf1, Yfb],
        ] as [number, number][],
      },
      topFlaps: [
        { x: Xf1, y: Yft, w: W, h: 0, polygon: [] as [number, number][] },
        { x: Xd1, y: Yft, w: D, h: 0, polygon: [] as [number, number][] },
        { x: Xf2, y: Yft, w: W, h: 0, polygon: [] as [number, number][] },
        { x: Xd2, y: Yft, w: d2, h: 0, polygon: [] as [number, number][] },
      ] as [Panel2DInfo, Panel2DInfo, Panel2DInfo, Panel2DInfo],
      bottomFlaps: [
        {
          x: Xf1, y: Yfb, w: W, h: Lt,
          polygon: [
            [Xf1, Yfb],
            [Xf1 + 3.0, Yfb + 3.0],
            [Xf1 + 3.0, Yfb + Lt],
            [Xd1 - 3.0, Yfb + Lt],
            [Xd1 - 3.0, Yfb + 3.0],
            [Xd1, Yfb],
          ] as [number, number][],
          holes: [
            [
              [Xf1 + 0.33 * W, Yfb],
              [Xf1 + 0.37857 * W, Yfb],
              [Xf1 + 0.3857 * W, Yfb + 1.25],
              [Xf1 + 0.6143 * W, Yfb + 1.25],
              [Xf1 + 0.62143 * W, Yfb],
              [Xf1 + 0.67 * W, Yfb],
            ]
          ] as [number, number][][],
        },
        {
          x: Xd1, y: Yfb, w: D, h: Df,
          polygon: [
            [Xf2, Yfb],
            [Xf2 - 3.0, Yfb + 3.0],
            [Xf2 - 5.0, Yfb + Df],
            [Xd1 + 6.0, Yfb + Df],
            [Xd1 + 0.5, Yfb + 3.0],
            [Xd1 + 0.5, Yfb],
          ] as [number, number][],
        },
        {
          x: Xf2, y: Yfb, w: W, h: Lt + 12.0,
          polygon: [
            [Xf2, Yfb],
            [Xf2, Yfb + Lt + 0.75],
            [Xf2 + 0.37857 * W, Yfb + Lt + 0.75],
            [Xf2 + 0.33 * W, Yfb + Lt + 0.75],
            [Xf2 + 0.33 * W, Yfb + Lt + 2.5],
            [Xf2 + 0.67 * W, Yfb + Lt + 2.5],
            [Xf2 + 0.67 * W, Yfb + Lt + 0.75],
            [Xf2 + 0.62143 * W, Yfb + Lt + 0.75],
            [Xd2, Yfb + Lt + 0.75],
            [Xd2, Yfb],
          ] as [number, number][],
        },
        {
          x: Xd2, y: Yfb, w: d2, h: Df,
          polygon: [
            [Xd2, Yfb],
            [Xd2 + 3.0, Yfb + 3.0],
            [Xd2 + 5.0, Yfb + Df],
            [Xd2R - 5.0, Yfb + Df],
            [Xd2R - 3.0, Yfb + 3.0],
            [Xd2R, Yfb],
          ] as [number, number][],
        },
      ] as [Panel2DInfo, Panel2DInfo, Panel2DInfo, Panel2DInfo],
    };
  }, [params]);

  // Sheet layout dimension overlay values
  const distributionFootprint = useMemo(() => {
    const grid = nestingResult.bestOrientation === 'rotated' ? nestingResult.rotated : nestingResult.normal;
    if (grid.total <= 0) return { w: 0, h: 0 };
    const cellW = nestingResult.bestOrientation === 'rotated' ? geo.bbox.h : geo.bbox.w;
    const cellH = nestingResult.bestOrientation === 'rotated' ? geo.bbox.w : geo.bbox.h;
    const maxCols = Math.max(...grid.perRowCols);
    const w = cellW + (maxCols - 1) * grid.pitchX;
    const h = cellH + (grid.rows - 1) * grid.pitchY;
    return { w, h };
  }, [nestingResult, geo.bbox]);

  const derived = useMemo(() => ({
    faceHeight: T0005_RULES.faceHeight(appliedParams.height),
    depth1: appliedParams.depth,
    depth2: T0005_RULES.d2(appliedParams.depth),
  }), [appliedParams]);

  const dimsSvg = useMemo(
    () => (showDimensions ? buildT0005DimensionsSvg(appliedParams, dimUnit) : ''),
    [showDimensions, appliedParams, dimUnit],
  );

  return (
    <>
      <TemplateEditorLayout
        title="T0005 — صندوق غطاء مفتوح مع إغلاق قفل (Open-Top Box)"
        previewMode={previewMode}
        onPreviewModeChange={setPreviewMode}
        hasTemplatePreview={show2DPreview}
        hasSheetPreview={showNestingPreview}
        has3DPreview={show3DPreview}
        showDimensions={showDimensions}
        onShowDimensionsChange={setShowDimensions}
        dimUnit={dimUnit}
        onDimUnitChange={setDimUnit}
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
                    onChange={(newSvg, newSegs) => {
                      setSegmentOverrides({ svg: newSvg, segments: newSegs });
                    }}
                  />
                </div>
              ) : previewMode === 'sheet' ? (
                <T0005SheetNestingPreview params={appliedParams} nesting={appliedNesting} result={nestingResult} />
              ) : (
                <Box3DPreview
                  boxType="T0005"
                  lidTongue={appliedParams.lidTongue}
                  panelWidths={[appliedParams.width, appliedParams.depth, appliedParams.width, appliedParams.depth - 0.5]}
                  panelHeights={appliedParams.height}
                  glueFlapWidth={appliedParams.glueFlap}
                  topFlapHeights={[0, 0, 0, 0]}
                  bottomFlapHeights={[
                    faceCoords.bottomFlaps[0].h,
                    faceCoords.bottomFlaps[1].h,
                    faceCoords.bottomFlaps[2].h,
                    faceCoords.bottomFlaps[3].h
                  ]}
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
            {/* أبعاد القالب */}
              <section>
                <h3 className="text-sm font-bold mb-2">أبعاد العلبة</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="العرض" value={draftParams.width} unit={dimUnit} onChange={v => set('width', v)} />
                  <NumField label="الارتفاع" value={draftParams.height} unit={dimUnit} onChange={v => set('height', v)} />
                  <NumField label="العمق" value={draftParams.depth} unit={dimUnit} onChange={v => set('depth', v)} />
                </div>
              </section>

              {/* تخصيص متقدم */}
              <section className="space-y-3">
                <h3 className="text-sm font-bold border-b pb-1">تخصيص متقدم</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="لسان اللصق" value={draftParams.glueFlap} unit={dimUnit} onChange={v => set('glueFlap', v)} />
                  <div>
                    <Label className="text-xs truncate block mb-1" title="ارتفاع لسان القفل">لسان القفل</Label>
                    <Input type="number" step="0.1" value={toDisplay(draftParams.lidTongue, dimUnit)}
                      onChange={e => set('lidTongue', toMm(num(e.target.value, toDisplay(draftParams.lidTongue, dimUnit)), dimUnit))} />
                  </div>
                  <div>
                    <Label className="text-xs truncate block mb-1" title="ارتفاع لسان الغبار">لسان الغبار</Label>
                    <Input type="number" step="0.1" value={toDisplay(draftParams.dustFlap, dimUnit)}
                      onChange={e => set('dustFlap', toMm(num(e.target.value, toDisplay(draftParams.dustFlap, dimUnit)), dimUnit))} />
                  </div>
                </div>
              </section>

              {/* إعدادات الشيت */}
              <section>
                <h3 className="text-sm font-bold mb-2">إعدادات الشيت</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="عرض الشيت" value={draftParams.sheetWidth} unit={dimUnit} onChange={v => set('sheetWidth', v)} />
                  <NumField label="ارتفاع الشيت" value={draftParams.sheetHeight} unit={dimUnit} onChange={v => set('sheetHeight', v)} />
                  <NumField label="القابض" value={draftParams.gripper} unit={dimUnit} onChange={v => set('gripper', v)} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <NumField label="الهامش" value={draftParams.sheetMargin} unit={dimUnit} onChange={v => set('sheetMargin', v)} />
                  <NumField label="التباعد الأفقي" value={draftNesting.horizontalGap} step="0.1" min="0" unit={dimUnit} onChange={v => setN('horizontalGap', v)} />
                  <NumField label="التباعد العمودي" value={draftNesting.verticalGap} step="0.1" min="0" unit={dimUnit} onChange={v => setN('verticalGap', v)} />
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                  <div>الصافي: {usable.width.toFixed(2)} × {usable.height.toFixed(2)} مم</div>
                </div>
              </section>

          </>
        }
      />

      <T0005PrintSummary
        open={printOpen}
        onOpenChange={setPrintOpen}
        params={appliedParams}
        nesting={appliedNesting}
        nestingResult={nestingResult}
        dimUnit={dimUnit}
        distributionFootprint={distributionFootprint}
        derived={derived}
      />
    </>  );
};

const ExportSingleButton = ({ params, geo }: { params: T0005Params; geo: T0005Geometry }) => {
  const onExportSvg = async () => {
    const { downloadT0005SingleTemplate } = await import('@/lib/t0005/exportSingle');
    const name = `T0005_${params.width}x${params.height}x${params.depth}.svg`;
    downloadT0005SingleTemplate(geo, name);
  };
  const onExportPdf = async () => {
    const { buildT0005SingleTemplateSvg, downloadT0005SingleTemplatePdf } = await import('@/lib/t0005/exportSingle');
    const svg = buildT0005SingleTemplateSvg(geo);
    const name = `T0005_${params.width}x${params.height}x${params.depth}.pdf`;
    await downloadT0005SingleTemplatePdf(svg, name);
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
  params: T0005Params;
  nesting: T0005NestingParams;
  result: ReturnType<typeof computeT0005Nesting>;
}) => {
  const disabled = result.fitStatus !== 'fits' || result.bestTotal <= 0;
  const onExportSvg = async () => {
    const { downloadT0005SheetLayout } = await import('@/lib/t0005/exportSheet');
    downloadT0005SheetLayout(params, nesting, result);
  };
  const onExportPdf = async () => {
    const { downloadT0005SheetLayoutPdf } = await import('@/lib/t0005/exportSheet');
    await downloadT0005SheetLayoutPdf(params, nesting, result);
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
        <DropdownMenuItem onSelect={onExportSvg}>تصدير SVG</DropdownMenuItem>
        <DropdownMenuItem onSelect={onExportPdf}>تصدير PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default T0005Calculator;
