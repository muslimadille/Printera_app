// T00012 — Dynamic Dieline tab (Mailer Box - Roll End Tuck Top)
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
  T00012_DEFAULTS,
  T00012_REFERENCE,
  type T00012Params,
  type T00012Geometry,
  usableSheet
} from '@/lib/t00012/types';
import { buildT00012Geometry } from '@/lib/t00012/geometry';
import { buildT00012DimensionsSvg } from '@/lib/t00012/dimensionsOverlay';
import { computeT00012Nesting, type T00012NestingParams, type RotationMode } from '@/lib/t00012/nesting';
import T00012SheetNestingPreview from './T00012SheetNestingPreview';
import T00012PrintSummary from './T00012PrintSummary';
import MailerBox3DPreview from './MailerBox3DPreview';
import { InteractiveSvgCanvas, type Segment } from '@/components/InteractiveSvgCanvas';
import { downloadT00012SingleTemplate, downloadT00012SingleTemplatePdf, buildT00012SingleTemplateSvg } from '@/lib/t00012/exportSingle';
import { downloadT00012SheetLayout, downloadT00012SheetLayoutPdf } from '@/lib/t00012/exportSheet';
import { usePreviewSettings } from '@/hooks/usePreviewSettings';

const DEFAULT_NESTING: T00012NestingParams = {
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

const T00012Calculator = ({ isAdmin = false, onSaveBox }: { isAdmin?: boolean; onSaveBox?: (box: any) => void }) => {
  const { showNestingPreview, show3DPreview } = usePreviewSettings();

  const hiddenCls = isAdmin ? '' : 'hidden';

  const [params, setParams] = useState<T00012Params>(T00012_DEFAULTS);
  const [nesting, setNesting] = useState<T00012NestingParams>(DEFAULT_NESTING);
  const [previewMode, setPreviewMode] = useState<'template' | 'sheet' | 'three'>('template');
  const [showDimensions, setShowDimensions] = useState(true);
  const [dimUnit, setDimUnit] = useState<'mm' | 'cm' | 'in'>('mm');
  const [printOpen, setPrintOpen] = useState(false);

  const [segmentOverrides, setSegmentOverrides] = useState<{ svg: string | null; segments: Segment[] | null }>({
    svg: null,
    segments: null,
  });

  const setN = <K extends keyof T00012NestingParams>(k: K, v: T00012NestingParams[K]) =>
    setNesting(prev => ({ ...prev, [k]: v }));

  const set = <K extends keyof T00012Params>(k: K, v: T00012Params[K]) => {
    setParams(prev => ({ ...prev, [k]: v }));
    setSegmentOverrides({ svg: null, segments: null });
  };

  const reset = () => {
    setParams({ ...T00012_DEFAULTS });
    setNesting({ ...DEFAULT_NESTING });
    setSegmentOverrides({ svg: null, segments: null });
  };

  const usable = useMemo(() => usableSheet(params), [params]);
  const nestingResult = useMemo(() => computeT00012Nesting(params, nesting), [params, nesting]);

  const baseGeo = useMemo(() => buildT00012Geometry(params), [params]);

  const geo = useMemo<T00012Geometry>(() => {
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
        }
      });
      const w = Number.isFinite(maxX - minX) ? (maxX - minX) : baseGeo.bbox.w;
      const h = Number.isFinite(maxY - minY) ? (maxY - minY) : baseGeo.bbox.h;
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
      const startX = Math.max(0, Math.min(usableW - cellW, shifted ? brickDx : 0));
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

    if (!Number.isFinite(minX)) return { w: 0, h: 0 };
    return { w: maxX - minX, h: maxY - minY };
  }, [nestingResult]);

  const refOn = !!params.referenceMode;

  const dimsSvg = useMemo(
    () => (showDimensions ? buildT00012DimensionsSvg(params, dimUnit, 1) : ''),
    [showDimensions, params, dimUnit],
  );

  return (
    <div dir="rtl" className="space-y-4">
      {/* Header / Reference mode toggle */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">T00012 — علبة بريدية مغلقة (Mailer Box - Roll End Tuck Top)</CardTitle>
          <div className="flex items-center gap-3">
            <Label htmlFor="t00012-ref" className="text-sm font-normal cursor-pointer">
              وضع المرجعية Reference Mode {refOn && <span className="text-emerald-600">(مفعّل)</span>}
            </Label>
            <Switch id="t00012-ref" checked={refOn}
              onCheckedChange={v => set('referenceMode', v)} />
          </div>
        </CardHeader>
        {refOn && (
          <CardContent>
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              وضع المرجعية مفعّل: الأبعاد الافتراضية مقفلة للمعايرة.
            </div>
          </CardContent>
        )}
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
                <Switch id="t00012-smart" checked={!!nesting.smartAuto}
                  onCheckedChange={v => setN('smartAuto', v)} />
                <Label htmlFor="t00012-smart" className="text-sm font-normal">
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
            {showNestingPreview && (<button type="button" onClick={() => setPreviewMode('sheet')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${previewMode === 'sheet' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-input hover:bg-muted'}`}>
              معاينة التوزيع على الشيت
            </button>)}
            {show3DPreview && (<button type="button" onClick={() => setPreviewMode('three')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${previewMode === 'three' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-input hover:bg-muted'}`}>
              معاينة ثلاثية الأبعاد 3D
            </button>)}
            <div className="flex items-center gap-2 pl-3 ml-1 border-l border-input">
              {previewMode === 'template' && (
                <>
                  <Switch id="t00012-show-dims" checked={showDimensions} onCheckedChange={setShowDimensions} />
                  <Label htmlFor="t00012-show-dims" className="text-sm font-normal cursor-pointer">إظهار القياسات</Label>
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
                <T00012SheetNestingPreview params={params} nesting={nesting} result={nestingResult} />
              ) : (
                <MailerBox3DPreview
                  svgMarkup={geo.svg}
                  svgWidth={geo.bbox.w}
                  svgHeight={geo.bbox.h}
                  faceCoords={geo.faceCoords}
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
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <NumField label="لسان الغبار" value={params.dustFlapLength ?? params.depth} disabled={refOn} unit={dimUnit} onChange={v => set('dustFlapLength', v)} />
                  <NumField label="اللسان العلوي" value={params.topFlapTuckLength ?? 20} disabled={refOn} unit={dimUnit} onChange={v => set('topFlapTuckLength', v)} />
                  <NumField label="الألسنة الجانبية" value={params.sideFlapsLength ?? 15.5} disabled={refOn} unit={dimUnit} onChange={v => set('sideFlapsLength', v)} />
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
                    <Label htmlFor="t00012-allow-rot" className="text-xs">السماح بتدوير التصميم 90°</Label>
                    <Switch id="t00012-allow-rot" checked={nesting.allowRotation} onCheckedChange={v => setN('allowRotation', v)} />
                  </div>
                  {nesting.allowRotation && (
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="t00012-rot-mode" className="text-xs">وضع التدوير</Label>
                      <select id="t00012-rot-mode" className="h-8 rounded-md border border-input bg-background px-2 text-sm"
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

      <T00012PrintSummary
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

const ExportSingleButton = ({ params, geo }: { params: T00012Params; geo: T00012Geometry }) => {
  const onExportSvg = async () => {
    const { downloadT00012SingleTemplate } = await import('@/lib/t00012/exportSingle');
    const name = `T00012_${params.width}x${params.height}x${params.depth}.svg`;
    downloadT00012SingleTemplate(geo, name);
  };
  const onExportPdf = async () => {
    const { buildT00012SingleTemplateSvg, downloadT00012SingleTemplatePdf } = await import('@/lib/t00012/exportSingle');
    const svg = buildT00012SingleTemplateSvg(geo);
    const name = `T00012_${params.width}x${params.height}x${params.depth}.pdf`;
    await downloadT00012SingleTemplatePdf(svg, name);
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
  params: T00012Params;
  nesting: T00012NestingParams;
  result: ReturnType<typeof computeT00012Nesting>;
}) => {
  const disabled = result.fitStatus !== 'fits' || result.bestTotal <= 0;
  const onExportSvg = async () => {
    const { downloadT00012SheetLayout } = await import('@/lib/t00012/exportSheet');
    downloadT00012SheetLayout(params, nesting, result);
  };
  const onExportPdf = async () => {
    const { downloadT00012SheetLayoutPdf } = await import('@/lib/t00012/exportSheet');
    await downloadT00012SheetLayoutPdf(params, nesting, result);
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

export default T00012Calculator;
