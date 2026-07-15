// T0005 — Dynamic Dieline tab (Open-Top Box with Locking Tab Bottom)
// Renders the calculator, 2D interactive canvas, 3D folding preview, and auto-nesting.

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
  const hiddenCls = isAdmin ? '' : 'hidden';

  const [params, setParams] = useState<T0005Params>(T0005_DEFAULTS);
  const [nesting, setNesting] = useState<T0005NestingParams>(DEFAULT_NESTING);
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
    setNesting(prev => ({ ...prev, [k]: v }));

  const set = <K extends keyof T0005Params>(k: K, v: T0005Params[K]) => {
    setParams(prev => ({ ...prev, [k]: v }));
    // Clear overrides when params are updated by inputs
    setSegmentOverrides({ svg: null, segments: null });
  };

  const reset = () => {
    setParams({ ...T0005_DEFAULTS });
    setNesting({ ...DEFAULT_NESTING });
    setSegmentOverrides({ svg: null, segments: null });
  };

  const usable = useMemo(() => usableSheet(params), [params]);
  const nestingResult = useMemo(() => computeT0005Nesting(params, nesting), [params, nesting]);

  // Base geometry calculation
  const baseGeo = useMemo(() => buildT0005Geometry(params), [params]);

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
    faceHeight: T0005_RULES.faceHeight(params.height),
    depth1: params.depth,
    depth2: T0005_RULES.d2(params.depth),
  }), [params]);

  const refOn = !!params.referenceMode;

  const dimsSvg = useMemo(
    () => (showDimensions ? buildT0005DimensionsSvg(params, dimUnit) : ''),
    [showDimensions, params, dimUnit],
  );

  return (
    <div dir="rtl" className="space-y-4">
      {/* Header / Reference mode toggle */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">T0005 — صندوق غطاء مفتوح مع إغلاق قفل (Open-Top Box)</CardTitle>
          <div className="flex items-center gap-3">
            <Label htmlFor="t0005-ref" className="text-sm font-normal cursor-pointer">
              وضع المرجعية Reference Mode {refOn && <span className="text-emerald-600">(مفعّل)</span>}
            </Label>
            <Switch id="t0005-ref" checked={refOn}
              onCheckedChange={v => set('referenceMode', v)} />
          </div>
        </CardHeader>
        {refOn && (
          <CardContent>
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              وضع المرجعية مفعّل: الأبعاد الافتراضية مقفلة للمعايرة (W={T0005_REFERENCE.width}، H={T0005_REFERENCE.height}،
              D={T0005_REFERENCE.depth}، Glue_Flap={T0005_REFERENCE.glueFlap}،
              Lid_Tongue={T0005_REFERENCE.lidTongue}، Dust_Flap={T0005_REFERENCE.dustFlap} مم).
            </div>
          </CardContent>
        )}
      </Card>

      {/* Derived dimensions (WIP / admin view) */}
      <Card className={hiddenCls}>
        <CardHeader>
          <CardTitle className="text-lg">الأبعاد المشتقة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>Face_Height = H + 0.5 = <b>{derived.faceHeight.toFixed(2)}</b></div>
            <div>Depth_1 = D = <b>{derived.depth1.toFixed(2)}</b></div>
            <div>Depth_2 = D − 0.5 = <b>{derived.depth2.toFixed(2)}</b></div>
          </div>
        </CardContent>
      </Card>

      {/* Smart Auto Nesting controls */}
      <Card className={hiddenCls}>
        <CardHeader>
          <CardTitle className="text-lg">إعدادات التوزيع الذكي</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2 flex flex-col gap-2">
              <Label>التعشيق الذكي Smart Auto</Label>
              <div className="flex items-center gap-2 h-10">
                <Switch id="t0005-smart" checked={!!nesting.smartAuto}
                  onCheckedChange={v => setN('smartAuto', v)} />
                <Label htmlFor="t0005-smart" className="text-sm font-normal">
                  {nesting.smartAuto ? 'يحسب Pitch و Interlock تلقائياً' : 'يدوي (Interlock من المستخدم)'}
                </Label>
              </div>
            </div>
            <div>
              <Label>التداخل الأفقي ({dimUnit})</Label>
              <Input type="number" step="0.1" min="0" value={toDisplay(nesting.horizontalInterlock, dimUnit)}
                disabled={!!nesting.smartAuto}
                onChange={e => setN('horizontalInterlock', toMm(num(e.target.value, toDisplay(nesting.horizontalInterlock, dimUnit)), dimUnit))} />
            </div>
            <div>
              <Label>التداخل العمودي ({dimUnit})</Label>
              <Input type="number" step="0.1" min="0" value={toDisplay(nesting.verticalInterlock, dimUnit)}
                disabled={!!nesting.smartAuto}
                onChange={e => setN('verticalInterlock', toMm(num(e.target.value, toDisplay(nesting.verticalInterlock, dimUnit)), dimUnit))} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sheet preview + side input panel */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => setPreviewMode('template')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${previewMode === 'template' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-input hover:bg-muted'}`}>
              معاينة القالب
            </button>
            <button type="button" onClick={() => setPreviewMode('sheet')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${previewMode === 'sheet' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-input hover:bg-muted'}`}>
              معاينة التوزيع على الشيت
            </button>
            <button type="button" onClick={() => setPreviewMode('three')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${previewMode === 'three' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-input hover:bg-muted'}`}>
              معاينة ثلاثية الأبعاد 3D
            </button>
            <div className="flex items-center gap-2 pl-3 ml-1 border-l border-input">
              {previewMode === 'template' && (
                <>
                  <Switch id="t0005-show-dims" checked={showDimensions} onCheckedChange={setShowDimensions} />
                  <Label htmlFor="t0005-show-dims" className="text-sm font-normal cursor-pointer">إظهار القياسات</Label>
                </>
              )}
              <select className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                value={dimUnit} onChange={e => setDimUnit(e.target.value as 'mm' | 'cm' | 'in')}>
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="in">in</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPrintOpen(true)}>
              ملخص الطباعة
            </Button>
            <ExportSingleButton params={params} geo={geo} />
            <ExportSheetButton params={params} nesting={nesting} result={nestingResult} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-4 items-start">
            <div className="min-w-0">
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
                      setSegmentOverrides({ svg: newSvg, segments: newSegs });
                    }}
                  />
                </div>
              ) : previewMode === 'sheet' ? (
                <T0005SheetNestingPreview params={params} nesting={nesting} result={nestingResult} />
              ) : (
                <Box3DPreview
                  boxType="T0005"
                  lidTongue={params.lidTongue}
                  panelWidths={[params.width, params.depth, params.width, params.depth - 0.5]}
                  panelHeights={params.height}
                  glueFlapWidth={params.glueFlap}
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
            </div>

            <aside className="space-y-5 rounded-lg border bg-muted/30 p-4">
              {/* أبعاد القالب */}
              <section>
                <h3 className="text-sm font-bold mb-2">أبعاد العلبة</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="العرض" value={params.width} disabled={refOn} unit={dimUnit} onChange={v => set('width', v)} />
                  <NumField label="الارتفاع" value={params.height} disabled={refOn} unit={dimUnit} onChange={v => set('height', v)} />
                  <NumField label="العمق" value={params.depth} disabled={refOn} unit={dimUnit} onChange={v => set('depth', v)} />
                </div>
              </section>

              {/* تخصيص متقدم */}
              <section>
                <h3 className="text-sm font-bold mb-2">تخصيص متقدم</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="لسان اللصق" value={params.glueFlap} disabled={refOn} unit={dimUnit} onChange={v => set('glueFlap', v)} />
                  <NumField label="ارتفاع لسان القفل" value={params.lidTongue} disabled={refOn} unit={dimUnit} onChange={v => set('lidTongue', v)} />
                  <NumField label="ارتفاع لسان الغبار" value={params.dustFlap} disabled={refOn} unit={dimUnit} onChange={v => set('dustFlap', v)} />
                </div>
              </section>

              {/* إعدادات الشيت */}
              <section>
                <h3 className="text-sm font-bold mb-2">إعدادات الشيت</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="عرض الشيت" value={params.sheetWidth} unit={dimUnit} onChange={v => set('sheetWidth', v)} />
                  <NumField label="ارتفاع الشيت" value={params.sheetHeight} unit={dimUnit} onChange={v => set('sheetHeight', v)} />
                  <NumField label="القابض" value={params.gripper} unit={dimUnit} onChange={v => set('gripper', v)} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <NumField label="الهامش" value={params.sheetMargin} unit={dimUnit} onChange={v => set('sheetMargin', v)} />
                  <NumField label="التباعد الأفقي" value={nesting.horizontalGap} step="0.1" min="0" unit={dimUnit} onChange={v => setN('horizontalGap', v)} />
                  <NumField label="التباعد العمودي" value={nesting.verticalGap} step="0.1" min="0" unit={dimUnit} onChange={v => setN('verticalGap', v)} />
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                  <div>الصافي: {usable.width.toFixed(2)} × {usable.height.toFixed(2)} مم</div>
                </div>
              </section>

              {/* خيارات التدوير */}
              <section className="space-y-3">
                <h3 className="text-sm font-bold border-b pb-1">خيارات التدوير والتكرار</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="t0005-allow-rot" className="text-xs">السماح بتدوير التصميم 90°</Label>
                    <Switch id="t0005-allow-rot" checked={nesting.allowRotation} onCheckedChange={v => setN('allowRotation', v)} />
                  </div>
                  {nesting.allowRotation && (
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="t0005-rot-mode" className="text-xs">وضع التدوير</Label>
                      <select id="t0005-rot-mode" className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                        value={nesting.rotationMode} onChange={e => setN('rotationMode', e.target.value as RotationMode)}>
                        <option value="auto">تلقائي (الأفضل)</option>
                        <option value="normal">بدون تدوير (0°)</option>
                        <option value="rotated">تدوير فقط (90°)</option>
                      </select>
                    </div>
                  )}
                </div>
              </section>

              {/* ملخص التوزيع */}
              <section className="pt-3 border-t">
                <h3 className="text-sm font-bold mb-2">ملخص التوزيع</h3>
                <div className="grid grid-cols-1 gap-1 text-sm">
                  <div>الإجمالي: <b>{nestingResult.bestTotal}</b></div>
                  <div>مقاس التوزيع: <b>{toDisplay(distributionFootprint.w, dimUnit)} × {toDisplay(distributionFootprint.h, dimUnit)} {dimUnit}</b></div>
                </div>
              </section>

              {/* إعادة الضبط */}
              <div className="flex justify-end gap-2 border-t pt-3">
                <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground hover:text-foreground">
                  <RotateCcw className="w-3.5 h-3.5 ml-1" />
                  إعادة تعيين
                </Button>
              </div>
            </aside>
          </div>
        </CardContent>
      </Card>

      <T0005PrintSummary
        open={printOpen}
        onOpenChange={setPrintOpen}
        params={params}
        nesting={nesting}
        nestingResult={nestingResult}
        dimUnit={dimUnit}
        distributionFootprint={distributionFootprint}
        derived={derived}
      />
    </div>
  );
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
