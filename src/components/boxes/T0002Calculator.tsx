// T0002 — Self-Locking Tray with Hinged Lid (Mailer Style Box) — Parametric Dieline Calculator
// -------------------------------------------------------------------------------------

import { useMemo, useState } from 'react';
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
import { ChevronDown, Download, RotateCcw, Printer } from 'lucide-react';
import {
  T0002_DEFAULTS,
  T0002_RULES,
  type T0002Params,
  T0002_REFERENCE,
  usableSheet
} from '@/lib/t0002/types';
import { buildT0002Geometry } from '@/lib/t0002/geometry';
import { buildT0002DimensionsSvg } from '@/lib/t0002/dimensionsOverlay';
import { computeT0002Nesting, type T0002NestingParams, type RotationMode } from '@/lib/t0002/nesting';
import { downloadT0002SingleTemplate, downloadT0002SingleTemplatePdf, previewT0002SingleTemplatePdf } from '@/lib/t0002/exportSingle';
import { downloadT0002SheetLayout, downloadT0002SheetLayoutPdf, previewT0002SheetLayoutPdf } from '@/lib/t0002/exportSheet';
import T0002SheetNestingPreview from './T0002SheetNestingPreview';
import T0002PrintSummary from './T0002PrintSummary';
import Box3DPreview, { type Panel2DInfo } from './Box3DPreview';
import { InteractiveSvgCanvas, type Segment } from '@/components/InteractiveSvgCanvas';

const DEFAULT_NESTING: T0002NestingParams = {
  horizontalGap: 3,
  verticalGap: 3,
  allowRotation: true,
  rotationMode: 'auto',
  horizontalInterlock: 0,
  verticalInterlock: 0,
};

const num = (v: string, fallback: number) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

const UNIT_FACTORS: Record<'mm' | 'cm' | 'in', number> = { mm: 1, cm: 10, in: 25.4 };
const toDisplay = (mm: number, unit: 'mm' | 'cm' | 'in') =>
  parseFloat((mm / UNIT_FACTORS[unit]).toFixed(4));
const toMm = (val: number, unit: 'mm' | 'cm' | 'in') => val * UNIT_FACTORS[unit];

const NumField = ({
  label, value, onChange, step = '0.01', min, unit, disabled,
}: {
  label: string; value: number; onChange: (v: number) => void;
  step?: string; min?: string; unit?: 'mm' | 'cm' | 'in'; disabled?: boolean;
}) => (
  <div>
    <Label className="text-xs">{label} {unit && <span className="text-muted-foreground">({unit})</span>}</Label>
    <Input type="number" step={step} min={min}
      value={unit ? toDisplay(value, unit) : value}
      disabled={disabled}
      onChange={e => onChange(unit ? toMm(num(e.target.value, toDisplay(value, unit)), unit) : num(e.target.value, value))} />
  </div>
);

const T0002Calculator = ({ isAdmin = false }: { isAdmin?: boolean }) => {
  const [params, setParams] = useState<T0002Params>(T0002_DEFAULTS);
  const [nesting, setNesting] = useState<T0002NestingParams>(DEFAULT_NESTING);
  const [previewMode, setPreviewMode] = useState<'template' | 'sheet' | 'three'>('template');
  const [showDimensions, setShowDimensions] = useState(true);
  const [dimUnit, setDimUnit] = useState<'mm' | 'cm' | 'in'>('mm');
  const [printOpen, setPrintOpen] = useState(false);

  // Segment overrides state for interactive line adjustments
  const [segmentOverrides, setSegmentOverrides] = useState<{ svg: string | null; segments: Segment[] | null }>({
    svg: null,
    segments: null,
  });

  const set = <K extends keyof T0002Params>(k: K, v: T0002Params[K]) => {
    setParams(prev => ({ ...prev, [k]: v }));
    // Clear overrides when params are updated by inputs
    setSegmentOverrides({ svg: null, segments: null });
  };

  const setN = <K extends keyof T0002NestingParams>(k: K, v: T0002NestingParams[K]) => {
    setNesting(prev => ({ ...prev, [k]: v }));
  };

  const reset = () => {
    setParams({ ...T0002_DEFAULTS });
    setNesting({ ...DEFAULT_NESTING });
    setSegmentOverrides({ svg: null, segments: null });
  };

  const nestingResult = useMemo(() => computeT0002Nesting(params, nesting), [params, nesting]);

  const baseGeo = useMemo(() => buildT0002Geometry(params), [params]);

  // Derived geometry using segment overrides if active
  const geo = useMemo(() => {
    if (segmentOverrides.svg && segmentOverrides.segments) {
      const segments = segmentOverrides.segments;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      segments.forEach(seg => {
        if (seg.geometry === 'line') {
          minX = Math.min(minX, seg.start.x, seg.end.x);
          maxX = Math.max(maxX, seg.start.x, seg.end.x);
          minY = Math.min(minY, seg.start.y, seg.end.y);
          maxY = Math.max(maxY, seg.start.y, seg.end.y);
        } else if (seg.geometry === 'polyline' && seg.points) {
          seg.points.forEach(pt => {
            minX = Math.min(minX, pt.x);
            maxX = Math.max(maxX, pt.x);
            minY = Math.min(minY, pt.y);
            maxY = Math.max(maxY, pt.y);
          });
        } else {
          minX = Math.min(minX, seg.start.x, seg.end.x);
          maxX = Math.max(maxX, seg.start.x, seg.end.x);
          minY = Math.min(minY, seg.start.y, seg.end.y);
          maxY = Math.max(maxY, seg.start.y, seg.end.y);
        }
      });
      const w = Number.isFinite(maxX - minX) ? (maxX - minX) : baseGeo.bbox.w;
      const h = Number.isFinite(maxY - minY) ? (maxY - minY) : baseGeo.bbox.h;
      return {
        ...baseGeo,
        svg: segmentOverrides.svg,
        segments: segmentOverrides.segments,
        bbox: { w, h },
      };
    }
    return baseGeo;
  }, [baseGeo, segmentOverrides]);

  const usable = useMemo(() => usableSheet(params), [params]);

  const faceCoords = useMemo(() => {
    const W = params.W;
    const H = params.H;
    const D = params.D;
    const LH = params.LH;
    const LFH = params.LFH;
    const LTW = params.LTW;

    const pad = 2;
    const xMainCreaseL = pad + LTW + D;
    const yMiddleCreaseT = pad + LFH + LH + D;

    return {
      body: [
        { x: xMainCreaseL, y: yMiddleCreaseT, w: W, h: H },
        { x: xMainCreaseL + W, y: yMiddleCreaseT, w: D + LTW, h: H },
        { x: pad, y: yMiddleCreaseT, w: LTW + D, h: H },
        { x: xMainCreaseL, y: yMiddleCreaseT + H, w: W, h: D },
      ] as [Panel2DInfo, Panel2DInfo, Panel2DInfo, Panel2DInfo],
      glue: { x: 0, y: 0, w: 0, h: 0 },
      topFlaps: [
        { x: 0, y: 0, w: 0, h: 0 },
        { x: 0, y: 0, w: 0, h: 0 },
        { x: 0, y: 0, w: 0, h: 0 },
        { x: 0, y: 0, w: 0, h: 0 },
      ] as [Panel2DInfo, Panel2DInfo, Panel2DInfo, Panel2DInfo],
      bottomFlaps: [
        { x: 0, y: 0, w: 0, h: 0 },
        { x: 0, y: 0, w: 0, h: 0 },
        { x: 0, y: 0, w: 0, h: 0 },
        { x: 0, y: 0, w: 0, h: 0 },
      ] as [Panel2DInfo, Panel2DInfo, Panel2DInfo, Panel2DInfo],
    };
  }, [params]);

  const distributionFootprint = useMemo(() => {
    if (nestingResult.fitStatus !== 'fits' || nestingResult.bestTotal <= 0) {
      return { w: 0, h: 0 };
    }
    const grid = nestingResult.bestOrientation === 'normal' ? nestingResult.normal : nestingResult.rotated;
    const cellW = nestingResult.bestOrientation === 'normal' ? nestingResult.templateBBox.width : nestingResult.templateBBox.height;
    const cellH = nestingResult.bestOrientation === 'normal' ? nestingResult.templateBBox.height : nestingResult.templateBBox.width;
    const usableW = nestingResult.usableSheet.width;
    const brickDx = grid.rowBrickDx ?? 0;
    const brickPhase = grid.brickPhase ?? 1;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    for (let r = 0; r < grid.rows; r++) {
      const shifted = (r % 2) === brickPhase;
      const startX = Math.max(0, Math.min(usable.width - cellW, shifted ? brickDx : 0));
      const cols = grid.perRowCols[r] ?? grid.columns;
      for (let c = 0; c < cols; c++) {
        const x = startX + c * grid.pitchX;
        const y = r * grid.pitchY;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x + cellW);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y + cellH);
      }
    }

    return {
      w: maxX - minX,
      h: maxY - minY,
    };
  }, [nestingResult, usable.width]);

  const dimsSvg = useMemo(
    () => (showDimensions ? buildT0002DimensionsSvg(params, dimUnit, 1) : ''),
    [showDimensions, params, dimUnit],
  );

  return (
    <div className="container mx-auto p-4 space-y-6" dir="rtl">
      {/* Title */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">T0002 — علبة ذاتية الإغلاق بغطاء متصل (Tray with Hinged Lid)</CardTitle>
          <div className="flex items-center gap-3">
            <Label htmlFor="t0002-ref" className="text-sm font-normal cursor-pointer">
              وضع المرجعية Reference Mode {params.referenceMode && <span className="text-emerald-600">(مفعّل)</span>}
            </Label>
            <Switch id="t0002-ref" checked={!!params.referenceMode} onCheckedChange={v => set('referenceMode', v)} />
          </div>
        </CardHeader>
        {params.referenceMode && (
          <CardContent>
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              وضع المرجعية مفعّل: الأبعاد الافتراضية مقفلة للمعايرة (W=350, H=290, D=100 مم).
            </div>
          </CardContent>
        )}
      </Card>

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
              <Printer className="w-4 h-4 ml-1.5" />
              ملخص الطباعة
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Download className="w-4 h-4" />
                  تحميل الملفات
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => downloadT0002SingleTemplate(geo)}>
                  تحميل القالب المفرد (SVG)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void previewT0002SingleTemplatePdf(geo.svg)}>
                  معاينة القالب المفرد (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void downloadT0002SingleTemplatePdf(geo.svg)}>
                  تحميل القالب المفرد (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadT0002SheetLayout(params, nesting, nestingResult)}>
                  تحميل توزيع الشيت (SVG)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void previewT0002SheetLayoutPdf(params, nesting, nestingResult)}>
                  معاينة توزيع الشيت (PDF)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void downloadT0002SheetLayoutPdf(params, nesting, nestingResult)}>
                  تحميل توزيع الشيت (PDF)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] gap-4 items-start min-w-0 w-full calc-shell">
            <div className="min-w-0">
              {previewMode === 'template' ? (
                <div className="space-y-4">
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
                <T0002SheetNestingPreview params={params} nesting={nesting} result={nestingResult} />
              ) : (
                <Box3DPreview
                  boxType="T0002"
                  panelWidths={[params.D, params.W, params.D, params.W]}
                  panelHeights={params.H}
                  glueFlapWidth={0}
                  topFlapHeights={[0, 0, 0, 0]}
                  bottomFlapHeights={[0, 0, 0, 0]}
                  svgMarkup={geo.svg}
                  svgWidth={geo.bbox.w}
                  svgHeight={geo.bbox.h}
                  faceCoords={faceCoords}
                />
              )}
            </div>

            <aside className="space-y-5 rounded-lg border bg-muted/30 p-4">
              <section className="space-y-3">
                <h3 className="text-sm font-bold border-b pb-1">أبعاد العلبة الأساسية</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="العرض (W)" value={params.W} disabled={params.referenceMode} unit={dimUnit} onChange={v => set('W', v)} />
                  <NumField label="الارتفاع (H)" value={params.H} disabled={params.referenceMode} unit={dimUnit} onChange={v => set('H', v)} />
                  <NumField label="العمق (D)" value={params.D} disabled={params.referenceMode} unit={dimUnit} onChange={v => set('D', v)} />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-bold border-b pb-1">الغطاء والأغطية المتداخلة</h3>
                <div className="grid grid-cols-2 gap-2">
                  <NumField label="ارتفاع الغطاء (LH)" value={params.LH} disabled={params.referenceMode} unit={dimUnit} onChange={v => set('LH', v)} />
                  <NumField label="لسان الغطاء (LFH)" value={params.LFH} disabled={params.referenceMode} unit={dimUnit} onChange={v => set('LFH', v)} />
                  <NumField label="شطف الغطاء (LFR)" value={params.LFR} disabled={params.referenceMode} unit={dimUnit} onChange={v => set('LFR', v)} />
                  <NumField label="عرض لسان القفل (LTW)" value={params.LTW} disabled={params.referenceMode} unit={dimUnit} onChange={v => set('LTW', v)} />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-bold border-b pb-1">رفارف الغبار (Dust Flaps)</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="العرض (DFW)" value={params.DFW} disabled={params.referenceMode} unit={dimUnit} onChange={v => set('DFW', v)} />
                  <NumField label="التداخل (DFI)" value={params.DFI} disabled={params.referenceMode} unit={dimUnit} onChange={v => set('DFI', v)} />
                  <NumField label="الميل (DFS)" value={params.DFS} disabled={params.referenceMode} unit={dimUnit} onChange={v => set('DFS', v)} />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-bold border-b pb-1">إعدادات الشيت (Sheet Settings)</h3>
                <div className="grid grid-cols-2 gap-2">
                  <NumField label="عرض الشيت" value={params.sheetWidth} unit={dimUnit} onChange={v => set('sheetWidth', v)} />
                  <NumField label="ارتفاع الشيت" value={params.sheetHeight} unit={dimUnit} onChange={v => set('sheetHeight', v)} />
                  <NumField label="هامش الشيت" value={params.sheetMargin} unit={dimUnit} onChange={v => set('sheetMargin', v)} />
                  <NumField label="القابض (Gripper)" value={params.gripper} unit={dimUnit} onChange={v => set('gripper', v)} />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-bold border-b pb-1">خيارات التوزيع والتكرار</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="t0002-allow-rot" className="text-xs">السماح بتدوير التصميم 90°</Label>
                    <Switch id="t0002-allow-rot" checked={nesting.allowRotation} onCheckedChange={v => setN('allowRotation', v)} />
                  </div>
                  {nesting.allowRotation && (
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="t0002-rot-mode" className="text-xs">وضع التدوير</Label>
                      <select id="t0002-rot-mode" className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                        value={nesting.rotationMode} onChange={e => setN('rotationMode', e.target.value as RotationMode)}>
                        <option value="auto">تلقائي (الأفضل)</option>
                        <option value="normal">بدون تدوير (0°)</option>
                        <option value="rotated">تدوير فقط (90°)</option>
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                    <NumField label="مسافة أفقية" value={nesting.horizontalGap} unit={dimUnit} onChange={v => setN('horizontalGap', v)} />
                    <NumField label="مسافة رأسية" value={nesting.verticalGap} unit={dimUnit} onChange={v => setN('verticalGap', v)} />
                  </div>
                </div>
              </section>

              {/* Reset Controls */}
              <div className="flex justify-end gap-2 border-t pt-3 print:hidden">
                <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground hover:text-foreground">
                  <RotateCcw className="w-3.5 h-3.5 ml-1" />
                  إعادة تعيين
                </Button>
              </div>
            </aside>
          </div>
        </CardContent>
      </Card>

      {/* Print summary popup */}
      <T0002PrintSummary
        open={printOpen}
        onOpenChange={setPrintOpen}
        params={params}
        nesting={nesting}
        nestingResult={nestingResult}
        dimUnit={dimUnit}
        distributionFootprint={distributionFootprint}
      />
    </div>
  );
};

export default T0002Calculator;
