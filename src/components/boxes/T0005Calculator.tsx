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
import { downloadT0005SingleTemplate, downloadT0005SingleTemplatePdf } from '@/lib/t0005/exportSingle';
import { downloadT0005SheetLayout, downloadT0005SheetLayoutPdf } from '@/lib/t0005/exportSheet';

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
    setParams(prev => {
      const next = { ...prev, [k]: v };
      return next;
    });
  };

  const resetToDefaults = () => {
    setParams(T0005_DEFAULTS);
    setNesting(DEFAULT_NESTING);
    setSegmentOverrides({ svg: null, segments: null });
  };

  // Base geometry calculation
  const baseGeo = useMemo(() => buildT0005Geometry(params), [params]);

  // Derived geometry incorporating canvas overrides
  const geo = useMemo<T0005Geometry>(() => {
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

  // Compute Nesting Layout
  const nestingResult = useMemo(() => computeT0005Nesting(params, nesting), [params, nesting]);

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

  // Exporter handlers
  const handleExportSingleSvg = () => {
    downloadT0005SingleTemplate(geo, `T0005-single-W${params.width}-H${params.height}-D${params.depth}.svg`);
  };

  const handleExportSinglePdf = async () => {
    const singleSvg = buildT0005DimensionsSvg(params, dimUnit);
    const combinedSvg = geo.svg.replace('</svg>', `${singleSvg}</svg>`);
    await downloadT0005SingleTemplatePdf(combinedSvg, `T0005-single-W${params.width}-H${params.height}-D${params.depth}.pdf`);
  };

  const handleExportSheetSvg = () => {
    downloadT0005SheetLayout(params, nesting, nestingResult);
  };

  const handleExportSheetPdf = async () => {
    await downloadT0005SheetLayoutPdf(params, nesting, nestingResult);
  };

  // Dimensions Overlay markup inside 2D SVG canvas
  const dimensionsMarkup = useMemo(() => {
    if (!showDimensions) return '';
    return buildT0005DimensionsSvg(params, dimUnit);
  }, [params, showDimensions, dimUnit]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-1" dir="rtl">
      {/* Parameters Panel */}
      <div className="lg:col-span-4 space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold">معلمات القالب T0005</CardTitle>
            <Button variant="ghost" size="icon" onClick={resetToDefaults} title="إعادة تعيين القوالب">
              <RotateCcw className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Reference Mode Switch */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">تثبيت النموذج المرجعي</Label>
                <p className="text-[11px] text-muted-foreground">توليد أبعاد القالب المرجعي بدقة مطابقة للتصميم</p>
              </div>
              <Switch checked={!!params.referenceMode} onCheckedChange={v => set('referenceMode', v)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <NumField label="العرض (W)" value={params.width} onChange={v => set('width', v)} unit={dimUnit} disabled={params.referenceMode} />
              <NumField label="الارتفاع (H)" value={params.height} onChange={v => set('height', v)} unit={dimUnit} disabled={params.referenceMode} />
              <NumField label="العمق (D)" value={params.depth} onChange={v => set('depth', v)} unit={dimUnit} disabled={params.referenceMode} />
              <NumField label="لسان اللصق" value={params.glueFlap} onChange={v => set('glueFlap', v)} unit={dimUnit} disabled={params.referenceMode} />
              <NumField label="ارتفاع لسان القفل" value={params.lidTongue} onChange={v => set('lidTongue', v)} unit={dimUnit} disabled={params.referenceMode} />
              <NumField label="ارتفاع لسان الغبار" value={params.dustFlap} onChange={v => set('dustFlap', v)} unit={dimUnit} disabled={params.referenceMode} />
            </div>
          </CardContent>
        </Card>

        {/* Sheet Nesting controls */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-md font-bold">معلمات التوزيع (Sheet Nesting)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <NumField label="عرض الشيت" value={params.sheetWidth} onChange={v => set('sheetWidth', v)} unit={dimUnit} />
              <NumField label="ارتفاع الشيت" value={params.sheetHeight} onChange={v => set('sheetHeight', v)} unit={dimUnit} />
              <NumField label="الهامش" value={params.sheetMargin} onChange={v => set('sheetMargin', v)} unit={dimUnit} />
              <NumField label="القابض (Gripper)" value={params.gripper} onChange={v => set('gripper', v)} unit={dimUnit} />
              <NumField label="تباعد أفقي" value={nesting.horizontalGap} onChange={v => setN('horizontalGap', v)} unit={dimUnit} />
              <NumField label="تباعد عمودي" value={nesting.verticalGap} onChange={v => setN('verticalGap', v)} unit={dimUnit} />
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">توزيع ذكي تلقائي (Smart Auto)</Label>
                <p className="text-[10px] text-muted-foreground">حساب تداخل متداخل بناءً على مجسم العلبة</p>
              </div>
              <Switch checked={!!nesting.smartAuto} onCheckedChange={v => setN('smartAuto', v)} />
            </div>

            {!nesting.smartAuto && (
              <div className="grid grid-cols-2 gap-3 border-t pt-3">
                <NumField label="تداخل أفقي يدوي" value={nesting.horizontalInterlock} onChange={v => setN('horizontalInterlock', v)} unit={dimUnit} />
                <NumField label="تداخل عمودي يدوي" value={nesting.verticalInterlock} onChange={v => setN('verticalInterlock', v)} unit={dimUnit} />
              </div>
            )}

            <div className="flex items-center justify-between border-t pt-3">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold font-sans">السماح بتدوير القالب 90°</Label>
              </div>
              <Switch checked={!!nesting.allowRotation} onCheckedChange={v => setN('allowRotation', v)} />
            </div>

            {nesting.allowRotation && (
              <div className="flex items-center justify-between">
                <Label className="text-xs">وضعية التدوير</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1">
                      {nesting.rotationMode === 'normal' ? 'Normal' : nesting.rotationMode === 'rotated' ? 'Rotated' : 'Auto'}
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setN('rotationMode', 'normal')}>Normal</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setN('rotationMode', 'rotated')}>Rotated</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setN('rotationMode', 'auto')}>Auto</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Canvas Area */}
      <div className="lg:col-span-8 space-y-4">
        <div className="flex items-center justify-between border-b pb-3 flex-wrap gap-3">
          <div className="flex items-center gap-1.5 bg-muted/60 p-0.5 rounded-lg border">
            <Button variant={previewMode === 'template' ? 'default' : 'ghost'} size="sm" onClick={() => setPreviewMode('template')} className="text-xs">المعاينة الثنائية (2D)</Button>
            <Button variant={previewMode === 'sheet' ? 'default' : 'ghost'} size="sm" onClick={() => setPreviewMode('sheet')} className="text-xs">معاينة التوزيع</Button>
            <Button variant={previewMode === 'three' ? 'default' : 'ghost'} size="sm" onClick={() => setPreviewMode('three')} className="text-xs">المعاينة المجسمة (3D)</Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">أبعاد المعاينة:</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1 font-sans">
                    {dimUnit}
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setDimUnit('mm')}>mm</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDimUnit('cm')}>cm</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDimUnit('in')}>in</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {previewMode === 'template' && (
              <div className="flex items-center gap-2 border-r pr-3">
                <Switch checked={showDimensions} onCheckedChange={setShowDimensions} id="show-dims" />
                <Label htmlFor="show-dims" className="text-xs">عرض الأبعاد</Label>
              </div>
            )}

            <Button size="sm" className="text-xs" onClick={() => setPrintOpen(true)}>عرض ملخص السعر</Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1">
                  <Download className="w-3.5 h-3.5" />
                  تصدير
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-right">
                <DropdownMenuItem onClick={handleExportSingleSvg}>SVG للمنتج</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportSinglePdf}>PDF للمنتج (مع الأبعاد)</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportSheetSvg} disabled={nestingResult.fitStatus === 'too_large'}>SVG لشيت التوزيع</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportSheetPdf} disabled={nestingResult.fitStatus === 'too_large'}>PDF لشيت التوزيع</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {previewMode === 'template' && (
          <div className="space-y-4">
            <InteractiveSvgCanvas
              segments={geo.segments}
              svgWidth={geo.bbox.w}
              svgHeight={geo.bbox.h}
              dimensionsMarkup={dimensionsMarkup}
              onChange={(updated) => setSegmentOverrides({ svg: null, segments: updated })}
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
          <T0005SheetNestingPreview params={params} nesting={nesting} result={nestingResult} />
        )}

        {previewMode === 'three' && (
          <div className="border rounded-lg bg-card overflow-hidden">
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
          </div>
        )}
      </div>

      <T0005PrintSummary
        open={printOpen}
        onOpenChange={setPrintOpen}
        params={params}
        nesting={nesting}
        nestingResult={nestingResult}
        dimUnit={dimUnit}
        distributionFootprint={distributionFootprint}
        derived={{
          faceHeight: T0005_RULES.faceHeight(params.height),
          depth1: params.depth,
          depth2: T0005_RULES.d2(params.depth),
        }}
      />
    </div>
  );
};

export default T0005Calculator;
