// T0001 — Reverse Tuck-End Box (A10.10.03.03) — Parametric Dieline Calculator
// ---------------------------------------------------------------------------

import { useMemo, useState, useRef } from 'react';
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
  T0001_DEFAULTS,
  T0001_RULES,
  type T0001Params,
  usableSheet
} from '@/lib/t0001/types';
import { buildT0001Geometry } from '@/lib/t0001/geometry';
import { buildT0001DimensionsSvg } from '@/lib/t0001/dimensionsOverlay';
import { computeT0001Nesting, type T0001NestingParams, type RotationMode } from '@/lib/t0001/nesting';
import { downloadT0001SingleTemplate, downloadT0001SingleTemplatePdf, previewT0001SingleTemplatePdf } from '@/lib/t0001/exportSingle';
import { downloadT0001SheetLayout, downloadT0001SheetLayoutPdf, previewT0001SheetLayoutPdf } from '@/lib/t0001/exportSheet';
import T0001SheetNestingPreview from './T0001SheetNestingPreview';
import T0001PrintSummary from './T0001PrintSummary';
import Box3DPreview, { type Panel2DInfo } from './Box3DPreview';

const DEFAULT_NESTING: T0001NestingParams = {
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

// ---- SVG Preview ----------------------------------------------------------
const T0001Preview = ({
  params,
  fitContainer = false,
  showDebug = true,
  showDimensions = false,
  dimUnit = 'mm',
}: {
  params: T0001Params;
  fitContainer?: boolean;
  showDebug?: boolean;
  showDimensions?: boolean;
  dimUnit?: 'mm' | 'cm' | 'in';
}) => {
  const geo = useMemo(() => buildT0001Geometry(params), [params]);

  const innerSvg = useMemo(() => {
    const m = geo.svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
    return m ? m[1] : geo.svg;
  }, [geo.svg]);

  const sw = params.sheetWidth;
  const sh = params.sheetHeight;
  const bw = geo.bbox.w;
  const bh = geo.bbox.h;
  const scale = fitContainer ? Math.min(sw / bw, sh / bh) : 1;

  const dimsSvg = useMemo(
    () => (showDimensions ? buildT0001DimensionsSvg(params, dimUnit, scale) : ''),
    [showDimensions, params, dimUnit, scale],
  );

  return (
    <div className="space-y-2">
      {showDebug && (
        <div className="text-xs text-muted-foreground">
          Segments: <b>{geo.segments.length}</b>
          {' · '}BBox: <b>{geo.bbox.w.toFixed(2)} × {geo.bbox.h.toFixed(2)} mm</b>
          {' · '}Type: Reverse Tuck-End Box
        </div>
      )}
      {fitContainer ? (
        <div className="border rounded-lg p-3 bg-white overflow-auto">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`0 0 ${params.sheetWidth} ${params.sheetHeight}`}
            width="100%"
            style={{ height: 'auto', display: 'block' }}
          >
            {(() => {
              const tx = (sw - bw * scale) / 2;
              const ty = (sh - bh * scale) / 2;
              return (
                <g transform={`translate(${tx} ${ty}) scale(${scale})`} dangerouslySetInnerHTML={{ __html: innerSvg + dimsSvg }} />
              );
            })()}
          </svg>
        </div>
      ) : (
        <div
          className="border rounded-lg p-3 bg-white overflow-auto flex justify-center"
          dangerouslySetInnerHTML={{ __html: geo.svg }}
        />
      )}
    </div>
  );
};

// ---- Main Calculator ------------------------------------------------------
const T0001Calculator = ({ isAdmin = false }: { isAdmin?: boolean }) => {
  const [params, setParams] = useState<T0001Params>(T0001_DEFAULTS);
  const [nesting, setNesting] = useState<T0001NestingParams>(DEFAULT_NESTING);
  const [previewMode, setPreviewMode] = useState<'template' | 'sheet' | 'three'>('template');
  const [showDimensions, setShowDimensions] = useState(true);
  const [dimUnit, setDimUnit] = useState<'mm' | 'cm' | 'in'>('mm');
  const [printOpen, setPrintOpen] = useState(false);

  const set = <K extends keyof T0001Params>(k: K, v: T0001Params[K]) => {
    setParams(prev => ({ ...prev, [k]: v }));
  };

  const setN = <K extends keyof T0001NestingParams>(k: K, v: T0001NestingParams[K]) => {
    setNesting(prev => ({ ...prev, [k]: v }));
  };

  const reset = () => {
    setParams({ ...T0001_DEFAULTS });
    setNesting({ ...DEFAULT_NESTING });
  };

  const nestingResult = useMemo(() => computeT0001Nesting(params, nesting), [params, nesting]);
  const geo = useMemo(() => buildT0001Geometry(params), [params]);
  const usable = useMemo(() => usableSheet(params), [params]);

  const faceCoords = useMemo(() => {
    const W = params.W;
    const H = params.H;
    const D = params.D;
    const GF = params.GF;
    const TH = params.TH ?? 138.9;
    const DH = params.DH ?? 62.64;
    const CL = params.CL ?? 1.41;
    const D4 = D - CL;

    const Xg = 0;
    const Xf1 = GF;
    const Xd1 = GF + W;
    const Xf2 = GF + W + D;
    const Xd2 = GF + 2 * W + D;

    const Yft = TH;
    const Yfb = Yft + H;

    return {
      body: [
        { x: Xf1, y: Yft, w: W, h: H },
        { x: Xd1, y: Yft, w: D, h: H },
        { x: Xf2, y: Yft, w: W, h: H },
        { x: Xd2, y: Yft, w: D4, h: H },
      ] as [Panel2DInfo, Panel2DInfo, Panel2DInfo, Panel2DInfo],
      glue: { x: Xg, y: Yft, w: GF, h: H },
      topFlaps: [
        { x: Xf1, y: Yft - TH, w: W, h: TH },
        { x: Xd1, y: Yft - DH, w: D, h: DH },
        { x: Xf2, y: Yft - TH, w: W, h: TH },
        { x: Xd2, y: Yft - DH, w: D4, h: DH },
      ] as [Panel2DInfo, Panel2DInfo, Panel2DInfo, Panel2DInfo],
      bottomFlaps: [
        { x: Xf1, y: Yfb, w: W, h: TH },
        { x: Xd1, y: Yfb, w: D, h: DH },
        { x: Xf2, y: Yfb, w: W, h: TH },
        { x: Xd2, y: Yfb, w: D4, h: DH },
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

  const refOn = params.referenceMode;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] gap-4 p-2 sm:p-4 min-w-0 w-full calc-shell">
      {/* Left: Preview Panel */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPreviewMode('template')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                previewMode === 'template'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-input hover:bg-muted'
              }`}
            >
              معاينة القالب
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('sheet')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                previewMode === 'sheet'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-input hover:bg-muted'
              }`}
            >
              معاينة التوزيع على الشيت
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('three')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                previewMode === 'three'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-input hover:bg-muted'
              }`}
            >
              معاينة ثلاثية الأبعاد 3D
            </button>
            <div className="flex items-center gap-2 pl-3 ml-1 border-l border-input">
              {previewMode === 'template' && (
                <>
                  <Switch id="t0001-show-dims" checked={showDimensions}
                    onCheckedChange={setShowDimensions} />
                  <Label htmlFor="t0001-show-dims" className="text-sm font-normal cursor-pointer">
                    إظهار القياسات
                  </Label>
                </>
              )}
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                value={dimUnit}
                onChange={e => setDimUnit(e.target.value as 'mm' | 'cm' | 'in')}
              >
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="in">in</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Export Single Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Download className="w-4 h-4" />
                  <span>تصدير القالب</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => downloadT0001SingleTemplate(geo)}>
                  تنزيل SVG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void previewT0001SingleTemplatePdf(geo.svg)}>
                  معاينة PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void downloadT0001SingleTemplatePdf(geo.svg)}>
                  تحميل PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export Sheet Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Download className="w-4 h-4" />
                  <span>تصدير الشيت</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => downloadT0001SheetLayout(params, nesting, nestingResult)}>
                  تنزيل SVG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void previewT0001SheetLayoutPdf(params, nesting, nestingResult)}>
                  معاينة PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void downloadT0001SheetLayoutPdf(params, nesting, nestingResult)}>
                  تحميل PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button onClick={() => setPrintOpen(true)} variant="outline">
              ملخص الطباعة
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="min-w-0">
            {previewMode === 'template' ? (
              <T0001Preview params={params} fitContainer showDebug={false} showDimensions={showDimensions} dimUnit={dimUnit} />
            ) : previewMode === 'sheet' ? (
              <T0001SheetNestingPreview params={params} nesting={nesting} result={nestingResult} />
            ) : (
              <Box3DPreview
                boxType="T0001"
                lidTongue={params.TH ?? 138.9}
                panelWidths={[params.W, params.D, params.W, params.D - (params.CL ?? 1.41)]}
                panelHeights={params.H}
                glueFlapWidth={params.GF}
                topFlapHeights={[
                  faceCoords.topFlaps[0].h,
                  faceCoords.topFlaps[1].h,
                  faceCoords.topFlaps[2].h,
                  faceCoords.topFlaps[3].h
                ]}
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
        </CardContent>
      </Card>

      {/* Right: Controls Panel */}
      <aside className="space-y-5 rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">T0001 — Reverse Tuck-End</h2>
          <Button variant="ghost" size="icon" onClick={reset} title="Reset defaults">
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        {/* أبعاد القالب */}
        <section className="space-y-3 border-t pt-3">
          <h3 className="text-sm font-bold">أبعاد القالب</h3>
          <div className="grid grid-cols-3 gap-2">
            <NumField label="العرض (W)" value={params.W} disabled={refOn} unit={dimUnit}
              onChange={v => set('W', v)} min={String(T0001_RULES.minW)} />
            <NumField label="الارتفاع (H)" value={params.H} disabled={refOn} unit={dimUnit}
              onChange={v => set('H', v)} min={String(T0001_RULES.minH)} />
            <NumField label="العمق (D)" value={params.D} disabled={refOn} unit={dimUnit}
              onChange={v => set('D', v)} min={String(T0001_RULES.minD)} />
          </div>
        </section>

        {/* تخصيص متقدم */}
        <section className="space-y-3 border-t pt-3">
          <h3 className="text-sm font-bold">تخصيص متقدم</h3>
          <div className="grid grid-cols-3 gap-2">
            <NumField label="لسان اللصق (GF)" value={params.GF} disabled={refOn} unit={dimUnit}
              onChange={v => set('GF', v)} min={String(T0001_RULES.minGF)} />
            <NumField label="شطف اللصق (GH)" value={params.GH ?? 8.44} disabled={refOn} unit={dimUnit}
              onChange={v => set('GH', v)} />
            <NumField label="ارتفاع الغطاء (TH)" value={params.TH ?? 138.9} disabled={refOn} unit={dimUnit}
              onChange={v => set('TH', v)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <NumField label="شطف الغطاء (TC)" value={params.TC ?? 21.26} disabled={refOn} unit={dimUnit}
              onChange={v => set('TC', v)} />
            <NumField label="رفرف الغبار (DH)" value={params.DH ?? 62.64} disabled={refOn} unit={dimUnit}
              onChange={v => set('DH', v)} />
            <NumField label="نصف قطر الرفرف (DR)" value={params.DR ?? 8.5} disabled={refOn} unit={dimUnit}
              onChange={v => set('DR', v)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <NumField label="نصف القطر الصغير (SR)" value={params.SR ?? 3.4} disabled={refOn} unit={dimUnit}
              onChange={v => set('SR', v)} />
            <NumField label="الخلوص (CL)" value={params.CL ?? 1.41} disabled={refOn} unit={dimUnit}
              onChange={v => set('CL', v)} />
            <NumField label="ارتفاع الحز (NH)" value={params.NH ?? 26.22} disabled={refOn} unit={dimUnit}
              onChange={v => set('NH', v)} />
          </div>
        </section>

        {/* إعدادات الشيت */}
        <section className="space-y-3 border-t pt-3">
          <h3 className="text-sm font-bold">إعدادات الشيت</h3>
          <div className="grid grid-cols-3 gap-2">
            <NumField label="عرض الشيت" value={params.sheetWidth} unit={dimUnit}
              onChange={v => set('sheetWidth', v)} />
            <NumField label="ارتفاع الشيت" value={params.sheetHeight} unit={dimUnit}
              onChange={v => set('sheetHeight', v)} />
            <NumField label="القابض" value={params.gripper} unit={dimUnit}
              onChange={v => set('gripper', v)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <NumField label="الهامش" value={params.sheetMargin} unit={dimUnit}
              onChange={v => set('sheetMargin', v)} />
            <NumField label="التباعد الأفقي" value={nesting.horizontalGap} step="0.1" min="0" unit={dimUnit}
              onChange={v => setN('horizontalGap', v)} />
            <NumField label="التباعد العمودي" value={nesting.verticalGap} step="0.1" min="0" unit={dimUnit}
              onChange={v => setN('verticalGap', v)} />
          </div>
          <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1">
            <div>المنطقة الصافية: {usable.width.toFixed(2)} × {usable.height.toFixed(2)} mm</div>
          </div>
        </section>

        {/* ملخص التوزيع */}
        <section className="space-y-2 border-t pt-3">
          <h3 className="text-sm font-bold">ملخص التوزيع</h3>
          <div className="grid grid-cols-1 gap-1 text-sm">
            <div>إجمالي عدد القطع: <b>{nestingResult.bestTotal}</b></div>
            <div>مقاس التوزيع الفعلي: <b>{toDisplay(distributionFootprint.w, dimUnit)} × {toDisplay(distributionFootprint.h, dimUnit)} {dimUnit}</b></div>
          </div>
        </section>
      </aside>

      {/* Summary Dialog */}
      <T0001PrintSummary
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

export default T0001Calculator;
