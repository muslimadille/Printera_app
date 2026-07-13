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

  const resetToDefaults = () => {
    setParams(T0006_DEFAULTS);
    setSegmentOverrides({ svg: null, segments: null });
  };

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

  const handleCanvasChange = (newSvg: string, newSegs: Segment[]) => {
    setSegmentOverrides({ svg: newSvg, segments: newSegs });
  };

  // Dimensions overlays inside the 2D canvas
  const dimensionsOverlaySvg = useMemo(() => {
    if (!showDimensions) return '';
    return buildT0006DimensionsOverlay(geo);
  }, [geo, showDimensions]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" dir="rtl">
      {/* Inputs Column */}
      <div className="lg:col-span-4 space-y-4">
        <Card className="shadow-sm border-primary/10">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold">قالب T0006 (قفل مزدوج)</CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={resetToDefaults}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 font-sans">
            <div className="flex items-center justify-between pb-2 border-b">
              <Label className="text-xs">وضع الكلون والمطابقة</Label>
              <Switch checked={params.referenceMode} onCheckedChange={c => set('referenceMode', c)} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <NumField label="العرض W" value={params.width} onChange={v => set('width', v)} disabled={params.referenceMode} unit={dimUnit} />
              <NumField label="الارتفاع H" value={params.height} onChange={v => set('height', v)} disabled={params.referenceMode} unit={dimUnit} />
              <NumField label="العمق D" value={params.depth} onChange={v => set('depth', v)} disabled={params.referenceMode} unit={dimUnit} />
            </div>

            <div className="grid grid-cols-3 gap-2 border-t pt-3">
              <NumField label="اللاصق Gf" value={params.glueFlap} onChange={v => set('glueFlap', v)} disabled={params.referenceMode} unit={dimUnit} />
              <NumField label="اللسان Lt" value={params.lidTongue} onChange={v => set('lidTongue', v)} disabled={params.referenceMode} unit={dimUnit} />
              <NumField label="ألسنة الغبار" value={params.dustFlap} onChange={v => set('dustFlap', v)} disabled={params.referenceMode} unit={dimUnit} />
            </div>

            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs font-bold block mb-1">أبعاد الشيت الورقي</Label>
              <div className="grid grid-cols-2 gap-2">
                <NumField label="عرض الشيت" value={params.sheetWidth} onChange={v => set('sheetWidth', v)} unit={dimUnit} />
                <NumField label="ارتفاع الشيت" value={params.sheetHeight} onChange={v => set('sheetHeight', v)} unit={dimUnit} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumField label="هامش الشيت" value={params.sheetMargin} onChange={v => set('sheetMargin', v)} unit={dimUnit} />
                <NumField label="هامش القابض" value={params.gripper} onChange={v => set('gripper', v)} unit={dimUnit} />
              </div>
            </div>

            <div className="border-t pt-3 flex flex-wrap gap-2 justify-between items-center text-xs">
              <div className="flex items-center gap-1.5">
                <Switch id="dims" checked={showDimensions} onCheckedChange={setShowDimensions} />
                <Label htmlFor="dims" className="text-xs">إظهار الأبعاد</Label>
              </div>
              <div className="flex items-center gap-1">
                {(['mm', 'cm', 'in'] as const).map(u => (
                  <Button key={u} variant={dimUnit === u ? 'default' : 'outline'} size="sm" className="h-6 px-2 text-[10px]" onClick={() => setDimUnit(u)}>
                    {u}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Nesting Summary Card */}
        <Card className="shadow-sm border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold">ملخص كفاءة التوزيع التلقائي</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">عدد العلب بالشيت:</span>
              <span className="font-bold text-primary">{nestingResult.total} علبة</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">كفاءة استغلال الورق:</span>
              <span className="font-bold">{(nestingResult.efficiency * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">المستغل:</span>
              <span className="font-bold">{nestingResult.widthUsed.toFixed(0)}x{nestingResult.heightUsed.toFixed(0)} mm</span>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-2 gap-1.5 text-xs h-8" onClick={() => setPrintOpen(true)}>
              عرض الملخص الفني للطباعة
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Visualizer Column */}
      <div className="lg:col-span-8 space-y-3">
        <div className="flex justify-between items-center bg-muted/40 p-1.5 rounded-lg border">
          <div className="flex gap-1.5">
            <Button variant={previewMode === 'template' ? 'default' : 'ghost'} size="sm" onClick={() => setPreviewMode('template')}>
              المعاينة الثنائية (2D)
            </Button>
            <Button variant={previewMode === 'sheet' ? 'default' : 'ghost'} size="sm" onClick={() => setPreviewMode('sheet')}>
              معاينة التوزيع
            </Button>
            <Button variant={previewMode === 'three' ? 'default' : 'ghost'} size="sm" onClick={() => setPreviewMode('three')}>
              المعاينة المجسمة (3D)
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Download className="w-4 h-4" />
                تصدير
                <ChevronDown className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={downloadDielineSvg}>تحميل الرسم المتجهي (SVG)</DropdownMenuItem>
              <DropdownMenuItem onClick={downloadSinglePdf}>تحميل ملف السكين مفرد (PDF)</DropdownMenuItem>
              <DropdownMenuItem onClick={downloadSheetPdf} disabled={nestingResult.total === 0}>تحميل توزيع الشيت الكامل (PDF)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="min-h-[550px] relative border rounded-xl bg-slate-50 flex items-center justify-center p-3 shadow-inner">
          {previewMode === 'template' && (
            <div className="space-y-4 w-full">
              <InteractiveSvgCanvas
                segments={geo.segments}
                svgWidth={geo.bbox.w}
                svgHeight={geo.bbox.h}
                dimensionsMarkup={dimensionsOverlaySvg}
                onChange={(updated) => setSegmentOverrides({ svg: null, segments: updated as any })}
              />
              {segmentOverrides.segments && (
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setSegmentOverrides({ svg: null, segments: null })} className="text-xs text-destructive gap-1">
                    <RotateCcw className="w-3 h-3" />
                    إلغاء التعديلات اليدوية
                  </Button>
                </div>
              )}
            </div>
          )}

          {previewMode === 'sheet' && (
            <div className="w-full">
              <T0006SheetNestingPreview params={params} result={nestingResult} />
            </div>
          )}

          {previewMode === 'three' && (
            <div className="w-full h-[530px] min-w-0">
              <Box3DPreview
                boxType="T0006"
                panelWidths={[params.width, params.depth, params.width, params.depth]}
                panelHeights={params.height}
                glueFlapWidth={params.glueFlap}
                topFlapHeights={[params.lidTongue, params.dustFlap, params.lidTongue, params.dustFlap]}
                bottomFlapHeights={[params.lidTongue, params.dustFlap, params.lidTongue, params.dustFlap]}
                faceCoords={faceCoords}
              />
            </div>
          )}
        </div>
      </div>

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
    </div>
  );
};

export default T0006Calculator;
