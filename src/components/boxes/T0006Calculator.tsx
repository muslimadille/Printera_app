import { TemplateEditorLayout, PreviewMode } from '@/components/layouts/TemplateEditorLayout';
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
  T0006_DEFAULTS,
  T0006_REFERENCE,
  T0006_RULES,
  type T0006Params,
  type T0006Geometry,
  usableSheet
} from '@/lib/t0006/types';
import { buildT0006Geometry } from '@/lib/t0006/geometry';
import { buildT0006DimensionsOverlay } from '@/lib/t0006/dimensionsOverlay';
import { calculateT0006Nesting } from '@/lib/t0006/nesting';
import T0006SheetNestingPreview from './T0006SheetNestingPreview';
import T0006PrintSummary from './T0006PrintSummary';
import Box3DPreview, { type Panel2DInfo } from './Box3DPreview';
import { InteractiveSvgCanvas, type Segment } from '@/components/InteractiveSvgCanvas';
import { exportT0006SinglePdf } from '@/lib/t0006/exportSingle';
import { exportT0006SheetPdf } from '@/lib/t0006/exportSheet';
import { usePreviewSettings } from '@/hooks/usePreviewSettings';

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

const T0006Calculator = ({ isAdmin = false }: { isAdmin?: boolean }) => {
  const { show2DPreview, showNestingPreview, show3DPreview } = usePreviewSettings('T0006');

  const hiddenCls = isAdmin ? '' : 'hidden';

  const [draftParams, setDraftParams] = useState<T0006Params>(T0006_DEFAULTS);
  const [appliedParams, setAppliedParams] = useState<T0006Params>(T0006_DEFAULTS);

  const [previewMode, setPreviewMode] = useState<'template' | 'sheet' | 'three'>('template');
  const [showDimensions, setShowDimensions] = useState(true);
  const [dimUnit, setDimUnit] = useState<'mm' | 'cm' | 'in'>('mm');
  const [dimScale, setDimScale] = useState(1);
  const [printOpen, setPrintOpen] = useState(false);

  const [segmentOverrides, setSegmentOverrides] = useState<{ svg: string | null; segments: Segment[] | null }>({
    svg: null,
    segments: null,
  });

  const set = <K extends keyof T0006Params>(k: K, v: T0006Params[K]) => {
    setDraftParams(prev => ({ ...prev, [k]: v }));
  };

  const handleSave = () => {
    setAppliedParams({ ...draftParams });
    setSegmentOverrides({ svg: null, segments: null });
    toast.success('تم حفظ التعديلات وتطبيقها');
  };

  const handleReset = () => {
    setDraftParams({ ...T0006_DEFAULTS });
    setAppliedParams({ ...T0006_DEFAULTS });
    setSegmentOverrides({ svg: null, segments: null });
    toast.info('تم إعادة تعيين جميع الأبعاد للقيم الافتراضية');
  };

  const usable = useMemo(() => usableSheet(appliedParams), [appliedParams]);

  const baseGeo = useMemo(() => buildT0006Geometry(appliedParams), [appliedParams]);

  const geo = useMemo<T0006Geometry>(() => {
    if (segmentOverrides.svg && segmentOverrides.segments) {
      const segs = segmentOverrides.segments;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const s of segs) {
        if (s.start.x < minX) minX = s.start.x;
        if (s.start.x > maxX) maxX = s.start.x;
        if (s.end.x < minX) minX = s.end.x;
        if (s.end.x > maxX) maxX = s.end.x;
        if (s.start.y < minY) minY = s.start.y;
        if (s.start.y > maxY) maxY = s.start.y;
        if (s.end.y < minY) minY = s.end.y;
        if (s.end.y > maxY) maxY = s.end.y;
      }
      const w = maxX - minX > 0 ? maxX - minX : baseGeo.bbox.w;
      const h = maxY - minY > 0 ? maxY - minY : baseGeo.bbox.h;
      return {
        ...baseGeo,
        svg: segmentOverrides.svg,
        segments: segmentOverrides.segments as any[],
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

    const Yft = Lt + 12.707;
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
            // Top thumb notch
            [
              [Xf1 + 0.415 * W, Yft],
              [Xf1 + 0.435 * W, Yft + 4.5],
              [Xf1 + 0.500 * W, Yft + 7.95],
              [Xf1 + 0.565 * W, Yft + 4.5],
              [Xf1 + 0.585 * W, Yft],
            ],
            // Bottom thumb notch
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
        {
          x: Xf1, y: Yft - Lt, w: W, h: Lt,
          polygon: [
            [Xf1, Yft],
            [Xf1 + 3.0, Yft - 3.0],
            [Xf1 + 3.0, Yft - Lt],
            [Xd1 - 3.0, Yft - Lt],
            [Xd1 - 3.0, Yft - 3.0],
            [Xd1, Yft],
          ] as [number, number][],
          holes: [
            // Top slot cutout
            [
              [Xf1 + 0.33 * W, Yft],
              [Xf1 + 0.37857 * W, Yft],
              [Xf1 + 0.3857 * W, Yft - 1.25],
              [Xf1 + 0.6143 * W, Yft - 1.25],
              [Xf1 + 0.62143 * W, Yft],
              [Xf1 + 0.67 * W, Yft],
            ]
          ] as [number, number][][],
        },
        {
          x: Xd1, y: Yft - Df, w: D, h: Df,
          polygon: [
            [Xd1 + 0.5, Yft],
            [Xd1 + 0.5, Yft - 3.0],
            [Xd1 + 6.0, Yft - Df],
            [Xf2 - 5.0, Yft - Df],
            [Xf2 - 3.0, Yft - 3.0],
            [Xf2, Yft],
          ] as [number, number][],
        },
        {
          x: Xf2, y: Yft - (Lt + 12.0), w: W, h: Lt + 12.0,
          polygon: [
            [Xf2, Yft],
            [Xf2, Yft - Lt - 0.75],
            [Xf2 + 0.37857 * W, Yft - Lt - 0.75],
            [Xf2 + 0.33 * W, Yft - Lt - 0.75],
            [Xf2 + 0.33 * W, Yft - Lt - 2.5],
            [Xf2 + 0.67 * W, Yft - Lt - 2.5],
            [Xf2 + 0.67 * W, Yft - Lt - 0.75],
            [Xf2 + 0.62143 * W, Yft - Lt - 0.75],
            [Xd2, Yft - Lt - 0.75],
            [Xd2, Yft],
          ] as [number, number][],
        },
        {
          x: Xd2, y: Yft - Df, w: d2, h: Df,
          polygon: [
            [Xd2, Yft],
            [Xd2 + 3.0, Yft - 3.0],
            [Xd2 + 5.0, Yft - Df],
            [Xd2R - 5.0, Yft - Df],
            [Xd2R - 3.0, Yft - 3.0],
            [Xd2R, Yft],
          ] as [number, number][],
        },
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
            // Bottom slot cutout
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
  }, [appliedParams]);

  const nestingResult = useMemo(() => calculateT0006Nesting(appliedParams, geo), [appliedParams, geo]);

  const downloadDielineSvg = () => {
    const blob = new Blob([geo.svg], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `T0006_Dieline_${appliedParams.width}x${appliedParams.height}x${appliedParams.depth}.svg`;
    link.click();
  };

  const downloadSinglePdf = () => {
    exportT0006SinglePdf(geo);
  };

  const downloadSheetPdf = () => {
    exportT0006SheetPdf(geo, nestingResult);
  };

  const dimsSvg = useMemo(
    () => (showDimensions ? buildT0006DimensionsOverlay(geo, dimUnit, dimScale) : ''),
    [showDimensions, geo, dimUnit, dimScale],
  );

  return (
    <>
      <TemplateEditorLayout
        title="T0006 — قفل مزدوج العلب (Double Wall Box)"
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
                      setSegmentOverrides({ svg: newSvg, segments: newSegs as any });
                    }}
                  />
                </div>
              ) : previewMode === 'sheet' ? (
                <T0006SheetNestingPreview params={appliedParams} result={nestingResult} />
              ) : (
                <Box3DPreview
                  boxType="T0006"
                  lidTongue={appliedParams.lidTongue}
                  panelWidths={[appliedParams.width, appliedParams.depth, appliedParams.width, appliedParams.depth]}
                  panelHeights={appliedParams.height}
                  glueFlapWidth={appliedParams.glueFlap}
                  topFlapHeights={[appliedParams.lidTongue, appliedParams.dustFlap, appliedParams.lidTongue, appliedParams.dustFlap]}
                  bottomFlapHeights={[appliedParams.lidTongue, appliedParams.dustFlap, appliedParams.lidTongue, appliedParams.dustFlap]}
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
            <section>
                <h3 className="text-sm font-bold mb-2">أبعاد العلبة</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="العرض" value={draftParams.width} unit={dimUnit} onChange={v => set('width', v)} />
                  <NumField label="الارتفاع" value={draftParams.height} unit={dimUnit} onChange={v => set('height', v)} />
                  <NumField label="العمق" value={draftParams.depth} unit={dimUnit} onChange={v => set('depth', v)} />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-bold border-b pb-1">تخصيص متقدم</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="لسان اللصق" value={draftParams.glueFlap} unit={dimUnit} onChange={v => set('glueFlap', v)} />
                  <NumField label="اللسان" value={draftParams.lidTongue} unit={dimUnit} onChange={v => set('lidTongue', v)} />
                  <NumField label="ألسنة الغبار" value={draftParams.dustFlap} unit={dimUnit} onChange={v => set('dustFlap', v)} />
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold mb-2">إعدادات الشيت</h3>
                <div className="grid grid-cols-2 gap-2">
                  <NumField label="عرض الشيت" value={draftParams.sheetWidth} unit={dimUnit} onChange={v => set('sheetWidth', v)} />
                  <NumField label="ارتفاع الشيت" value={draftParams.sheetHeight} unit={dimUnit} onChange={v => set('sheetHeight', v)} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <NumField label="الهامش" value={draftParams.sheetMargin} unit={dimUnit} onChange={v => set('sheetMargin', v)} />
                  <NumField label="القابض" value={draftParams.gripper} unit={dimUnit} onChange={v => set('gripper', v)} />
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                  <div>الصافي: {usable.width.toFixed(2)} × {usable.height.toFixed(2)} مم</div>
                </div>
              </section>

          </>
        }
      />

      <T0006PrintSummary
        open={printOpen}
        onOpenChange={setPrintOpen}
        params={appliedParams}
        nestingResult={nestingResult}
        dimUnit={dimUnit}
        derived={{
          W: appliedParams.width,
          H: appliedParams.height,
          D: appliedParams.depth,
          Gf: appliedParams.glueFlap,
          Lt: appliedParams.lidTongue,
          Df: appliedParams.dustFlap,
          d2: appliedParams.depth - 0.5,
        }}
      />
    </>  );
};

export default T0006Calculator;
