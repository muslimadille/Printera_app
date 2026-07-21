import { TemplateEditorLayout, PreviewMode } from '@/components/layouts/TemplateEditorLayout';
import { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Label className="text-xs">{label} {unit && <span className="text-muted-foreground">({unit})</span>}</Label>
    <Input type="number" step={step} min={min}
      value={unit ? toDisplay(value, unit) : value}
      disabled={disabled}
      onChange={e => onChange(unit ? toMm(num(e.target.value, toDisplay(value, unit)), unit) : num(e.target.value, value))} />
  </div>
);

const T0006Calculator = ({ isAdmin = false }: { isAdmin?: boolean }) => {
  const { showNestingPreview, show3DPreview } = usePreviewSettings();

  const hiddenCls = isAdmin ? '' : 'hidden';

  const [params, setParams] = useState<T0006Params>(T0006_DEFAULTS);
  const [previewMode, setPreviewMode] = useState<'template' | 'sheet' | 'three'>('template');
  const [showDimensions, setShowDimensions] = useState(true);
  const [dimUnit, setDimUnit] = useState<'mm' | 'cm' | 'in'>('mm');
  const [printOpen, setPrintOpen] = useState(false);

  const [segmentOverrides, setSegmentOverrides] = useState<{ svg: string | null; segments: Segment[] | null }>({
    svg: null,
    segments: null,
  });

  const set = <K extends keyof T0006Params>(k: K, v: T0006Params[K]) => {
    setParams(prev => ({ ...prev, [k]: v }));
  };

  const reset = () => {
    setParams({ ...T0006_DEFAULTS });
    setSegmentOverrides({ svg: null, segments: null });
  };

  const usable = useMemo(() => usableSheet(params), [params]);

  const baseGeo = useMemo(() => buildT0006Geometry(params), [params]);

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
  }, [params]);

  const nestingResult = useMemo(() => calculateT0006Nesting(params, geo), [params, geo]);

  const downloadDielineSvg = () => {
    const blob = new Blob([geo.svg], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `T0006_Dieline_${params.width}x${params.height}x${params.depth}.svg`;
    link.click();
  };

  const downloadSinglePdf = () => {
    exportT0006SinglePdf(geo);
  };

  const downloadSheetPdf = () => {
    exportT0006SheetPdf(geo, nestingResult);
  };

  const refOn = !!params.referenceMode;

  const dimsSvg = useMemo(
    () => (showDimensions ? buildT0006DimensionsOverlay(geo) : ''),
    [showDimensions, geo],
  );

  return (
    <>
      <TemplateEditorLayout
        title="T0006 — قفل مزدوج العلب (Double Wall Box)"
        hasReferenceMode={true}
        referenceModeOn={refOn}
        onReferenceModeChange={v => set('referenceMode', v)}
        previewMode={previewMode}
        onPreviewModeChange={setPreviewMode}
        hasSheetPreview={showNestingPreview}
        has3DPreview={show3DPreview}
        showDimensions={showDimensions}
        onShowDimensionsChange={setShowDimensions}
        dimUnit={dimUnit}
        onDimUnitChange={setDimUnit}
        actionButtons={
          <>
            <Button variant="outline" size="sm" onClick={() => setPrintOpen(true)}>
              ملخص الطباعة
            </Button>
          </>
        }
        previewArea={
          <>
            {previewMode === 'template' ? (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    القطع والخطوط الخارجية: <b>{geo.segments.length}</b>
                    {' · '}مقاس القالب: <b>{geo.bbox.w.toFixed(2)} × {geo.bbox.h.toFixed(2)} مم</b>
                  </div>
                  <InteractiveSvgCanvas
                    segments={geo.segments}
                    svgWidth={geo.bbox.w}
                    svgHeight={geo.bbox.h}
                    dimensionsMarkup={dimsSvg}
                    onChange={(newSvg, newSegs) => {
                      setSegmentOverrides({ svg: newSvg, segments: newSegs as any });
                    }}
                  />
                </div>
              ) : previewMode === 'sheet' ? (
                <T0006SheetNestingPreview params={params} result={nestingResult} />
              ) : (
                <Box3DPreview
                  boxType="T0006"
                  lidTongue={params.lidTongue}
                  panelWidths={[params.width, params.depth, params.width, params.depth]}
                  panelHeights={params.height}
                  glueFlapWidth={params.glueFlap}
                  topFlapHeights={[params.lidTongue, params.dustFlap, params.lidTongue, params.dustFlap]}
                  bottomFlapHeights={[params.lidTongue, params.dustFlap, params.lidTongue, params.dustFlap]}
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
                  <NumField label="العرض" value={params.width} disabled={refOn} unit={dimUnit} onChange={v => set('width', v)} />
                  <NumField label="الارتفاع" value={params.height} disabled={refOn} unit={dimUnit} onChange={v => set('height', v)} />
                  <NumField label="العمق" value={params.depth} disabled={refOn} unit={dimUnit} onChange={v => set('depth', v)} />
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold mb-2">تخصيص متقدم</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="لسان اللصق" value={params.glueFlap} disabled={refOn} unit={dimUnit} onChange={v => set('glueFlap', v)} />
                  <NumField label="اللسان" value={params.lidTongue} disabled={refOn} unit={dimUnit} onChange={v => set('lidTongue', v)} />
                  <NumField label="ألسنة الغبار" value={params.dustFlap} disabled={refOn} unit={dimUnit} onChange={v => set('dustFlap', v)} />
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold mb-2">إعدادات الشيت</h3>
                <div className="grid grid-cols-2 gap-2">
                  <NumField label="عرض الشيت" value={params.sheetWidth} unit={dimUnit} onChange={v => set('sheetWidth', v)} />
                  <NumField label="ارتفاع الشيت" value={params.sheetHeight} unit={dimUnit} onChange={v => set('sheetHeight', v)} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <NumField label="الهامش" value={params.sheetMargin} unit={dimUnit} onChange={v => set('sheetMargin', v)} />
                  <NumField label="القابض" value={params.gripper} unit={dimUnit} onChange={v => set('gripper', v)} />
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                  <div>الصافي: {usable.width.toFixed(2)} × {usable.height.toFixed(2)} مم</div>
                </div>
              </section>

              <section className="pt-3 border-t">
                <h3 className="text-sm font-bold mb-2">ملخص التوزيع</h3>
                <div className="grid grid-cols-1 gap-1 text-sm">
                  <div>الإجمالي: <b>{nestingResult.total}</b></div>
                  <div>الكفاءة: <b>{(nestingResult.efficiency * 100).toFixed(1)}%</b></div>
                  <div>المستغل: <b>{nestingResult.widthUsed.toFixed(0)} × {nestingResult.heightUsed.toFixed(0)} مم</b></div>
                </div>
              </section>

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground hover:text-foreground">
                  <RotateCcw className="w-3.5 h-3.5 ml-1" />
                  إعادة تعيين
                </Button>
              </div>
          </>
        }
      />

      <T0006PrintSummary
        open={printOpen}
        onOpenChange={setPrintOpen}
        params={params}
        nestingResult={nestingResult}
        dimUnit={dimUnit}
        derived={{
          W: params.width,
          H: params.height,
          D: params.depth,
          Gf: params.glueFlap,
          Lt: params.lidTongue,
          Df: params.dustFlap,
          d2: params.depth - 0.5,
        }}
      />
    </>  );
};

export default T0006Calculator;
