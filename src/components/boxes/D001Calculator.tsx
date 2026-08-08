// D001 — Dynamic Dieline tab
// UI-only reorganization: side panel next to sheet preview groups Dimensions / Tongues / Sheet.
// No calculation logic, geometry, nesting, or export changed.

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
import { D001_DEFAULTS, D001_REFERENCE, D001_RULES, autoDepthTongueTotalHeight, type D001Params, usableSheet } from '@/lib/d001/types';
import { buildD001Geometry } from '@/lib/d001/geometry';
import { buildD001DimensionsSvg } from '@/lib/d001/dimensionsOverlay';
import { computeD001Nesting, type D001NestingParams, type RotationMode } from '@/lib/d001/nesting';
import D001SheetNestingPreview from './D001SheetNestingPreview';
import D001PrintSummary from './D001PrintSummary';
import Box3DPreview, { type Panel2DInfo } from './Box3DPreview';


const DEFAULT_NESTING: D001NestingParams = {
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

const defaultDepthTongueForWidth = (w: number) => (w <= 25 ? 3 : 5);

const UNIT_FACTORS: Record<'mm' | 'cm' | 'in', number> = { mm: 1, cm: 10, in: 25.4 };
const toDisplay = (mm: number, unit: 'mm' | 'cm' | 'in') => parseFloat((mm / UNIT_FACTORS[unit]).toFixed(4));
const toMm = (val: number, unit: 'mm' | 'cm' | 'in') => val * UNIT_FACTORS[unit];

const D001Preview = ({ params, fitContainer = false, showDebug = true, showDimensions = false, dimUnit = 'mm' }: { params: D001Params; fitContainer?: boolean; showDebug?: boolean; showDimensions?: boolean; dimUnit?: 'mm' | 'cm' | 'in' }) => {
  const geo = useMemo(() => buildD001Geometry(params), [params]);

  // Strip <svg ...> wrapper from geo.svg, keep inner content for re-embedding.
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
    () => (showDimensions ? buildD001DimensionsSvg(params, dimUnit, scale) : ''),
    [showDimensions, params, dimUnit, scale],
  );

  return (
    <div className="space-y-2">
      {showDebug && (
        <div className="text-xs text-muted-foreground">
          Mode: <b>{params.referenceMode ? 'Reference Clone' : 'Dynamic (WIP)'}</b>
          {' · '}Segments: <b>{geo.segments.length}</b>
          {' · '}BBox: <b>{geo.bbox.w.toFixed(2)} × {geo.bbox.h.toFixed(2)} mm</b>
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


const D001Calculator = ({ isAdmin = false }: { isAdmin?: boolean }) => {
  const hiddenCls = isAdmin ? '' : 'hidden';

  const [params, setParams] = useState<D001Params>(D001_DEFAULTS);
  const [nesting, setNesting] = useState<D001NestingParams>(DEFAULT_NESTING);
  const [previewMode, setPreviewMode] = useState<'template' | 'sheet' | 'three'>('template');
  const [showDimensions, setShowDimensions] = useState(true);
  const [dimUnit, setDimUnit] = useState<'mm' | 'cm' | 'in'>('mm');
  const [printOpen, setPrintOpen] = useState(false);
  const setN = <K extends keyof D001NestingParams>(k: K, v: D001NestingParams[K]) =>
    setNesting(prev => ({ ...prev, [k]: v }));
  const depthTongueTouched = useRef(false);
  const tongueTotalTouched = useRef(false);

  const set = <K extends keyof D001Params>(k: K, v: D001Params[K]) => {
    setParams(prev => {
      const next = { ...prev, [k]: v };
      if (k === 'width' && !next.referenceMode && !depthTongueTouched.current) {
        next.depthTongue = defaultDepthTongueForWidth(num(String(v), prev.width));
      }
      if (!next.referenceMode && !tongueTotalTouched.current &&
          (k === 'width' || k === 'depth' || k === 'depthTongue')) {
        next.depthTongueTotalHeight = autoDepthTongueTotalHeight(next.depthTongue, next.depth);
      }
      return next;
    });
  };

  const usable = useMemo(() => usableSheet(params), [params]);
  const nestingResult = useMemo(() => computeD001Nesting(params, nesting), [params, nesting]);

  const geo = useMemo(() => buildD001Geometry(params), [params]);

  const faceCoords = useMemo(() => {
    const W = params.width;
    const H = params.height;
    const D = params.depth;
    const Gf = params.glueFlap;
    const Lid = params.lidTongue;
    const DT = params.depthTongue;
    const Cov = D - 0.25;
    const d2 = D - 0.5;

    const Xg = 0;
    const Xf1 = Gf;
    const Xd1 = Gf + W;
    const Xf2 = Gf + W + D;
    const Xd2 = Gf + 2 * W + D;

    const Yft = Lid + Cov;
    const Yfb = Yft + H;

    const widthFallback = W <= 25 ? 3 : 5;
    const seg4H = (Number.isFinite(DT) && DT > 0) ? DT : widthFallback;
    const halfD = D / 2;
    const autoTongueH = seg4H + 4 + halfD; // SEG5_LEG = 4
    const userTongueH = params.depthTongueTotalHeight;
    const tongueTotalH = (Number.isFinite(userTongueH) && (userTongueH as number) > 0)
      ? (userTongueH as number) : autoTongueH;

    const tf1 = 0; // Face 1 has no top flap
    const tf2 = tongueTotalH;
    const tf3 = Lid + Cov;
    const tf4 = tongueTotalH;

    const bf1 = Lid + Cov;
    const bf2 = tongueTotalH;
    const bf3 = 0; // Face 2 has no bottom flap
    const bf4 = tongueTotalH;

    return {
      body: [
        { x: Xf1, y: Yft, w: W, h: H },
        { x: Xd1, y: Yft, w: D, h: H },
        { x: Xf2, y: Yft, w: W, h: H },
        { x: Xd2, y: Yft, w: d2, h: H },
      ] as [Panel2DInfo, Panel2DInfo, Panel2DInfo, Panel2DInfo],
      glue: { x: Xg, y: Yft, w: Gf, h: H },
      topFlaps: [
        { x: Xf1, y: Yft - tf1, w: W, h: tf1 },
        { x: Xd1, y: Yft - tf2, w: D, h: tf2 },
        { x: Xf2, y: Yft - tf3, w: W, h: tf3 },
        { x: Xd2, y: Yft - tf4, w: d2, h: tf4 },
      ] as [Panel2DInfo, Panel2DInfo, Panel2DInfo, Panel2DInfo],
      bottomFlaps: [
        { x: Xf1, y: Yfb, w: W, h: bf1 },
        { x: Xd1, y: Yfb, w: D, h: bf2 },
        { x: Xf2, y: Yfb, w: W, h: bf3 },
        { x: Xd2, y: Yfb, w: d2, h: bf4 },
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

  const derived = useMemo(() => ({
    faceHeight: D001_RULES.faceHeight(params.height),
    depth1: D001_RULES.depth1(params.depth),
    depth2: D001_RULES.depth2(params.depth),
    coverVertical: D001_RULES.coverVertical(params.depth),
    lidCurveHeight: D001_RULES.lidCurveHeight,
  }), [params]);

  const refOn = !!params.referenceMode;


  return (
    <div dir="rtl" className="space-y-4">
      {/* Header / Reference mode toggle (inputs moved to side panel) — UI hidden, logic preserved */}
      <Card className={hiddenCls}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">D001 — قالب ديناميكي</CardTitle>
          <div className="flex items-center gap-3">
            <Label htmlFor="d001-ref" className="text-sm font-normal">
              Reference Clone Mode {refOn && <span className="text-emerald-600">(مفعّل)</span>}
            </Label>
            <Switch id="d001-ref" checked={refOn}
              onCheckedChange={v => set('referenceMode', v)} />
          </div>
        </CardHeader>
        {refOn && (
          <CardContent>
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              وضع المرجع مفعّل: المخرجات مطابقة 100٪ لـ <code>TEMPLATE.svg</code>
              بقيم المرجع (W={D001_REFERENCE.width}، H={D001_REFERENCE.height}،
              D={D001_REFERENCE.depth}، Glue_Flap={D001_REFERENCE.glueFlap}،
              Lid_Tongue={D001_REFERENCE.lidTongue}،
              Depth_Tongue={D001_REFERENCE.depthTongue} mm).
            </div>
          </CardContent>
        )}
      </Card>

      {/* Derived dimensions (kept for reference) — UI hidden, logic preserved */}
      <Card className={hiddenCls}>
        <CardHeader>
          <CardTitle className="text-lg">الأبعاد المشتقة (محفوظة كما هي)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
            <div>Face_Height = H + 0.5 = <b>{derived.faceHeight.toFixed(2)}</b></div>
            <div>Depth_1 = D = <b>{derived.depth1.toFixed(2)}</b></div>
            <div>Depth_2 = D − 0.5 = <b>{derived.depth2.toFixed(2)}</b></div>
            <div>Cover_Vertical = D − 0.25 = <b>{derived.coverVertical.toFixed(2)}</b></div>
            <div>Lid_Curve_Height = <b>{derived.lidCurveHeight}</b></div>
          </div>
        </CardContent>
      </Card>

      {/* Smart Auto Nesting controls (gaps moved to side panel) — UI hidden, logic preserved */}
      <Card className={hiddenCls}>
        <CardHeader>
          <CardTitle className="text-lg">إعدادات التوزيع (Smart Auto Nesting)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2 flex flex-col gap-2">
              <Label>التعشيق الذكي Smart Auto</Label>
              <div className="flex items-center gap-2 h-10">
                <Switch id="d001-smart" checked={!!nesting.smartAuto}
                  onCheckedChange={v => setN('smartAuto', v)} />
                <Label htmlFor="d001-smart" className="text-sm font-normal">
                  {nesting.smartAuto ? 'يحسب Pitch و Interlock تلقائياً' : 'يدوي (Interlock من المستخدم)'}
                </Label>
              </div>
            </div>
            <div>
              <Label>التداخل الأفقي Horizontal Interlock ({dimUnit})</Label>
              <Input type="number" step="0.1" min="0" value={toDisplay(nesting.horizontalInterlock, dimUnit)}
                disabled={!!nesting.smartAuto}
                onChange={e => setN('horizontalInterlock', toMm(num(e.target.value, toDisplay(nesting.horizontalInterlock, dimUnit)), dimUnit))} />
            </div>
            <div>
              <Label>التداخل العمودي Vertical Interlock ({dimUnit})</Label>
              <Input type="number" step="0.1" min="0" value={toDisplay(nesting.verticalInterlock, dimUnit)}
                disabled={!!nesting.smartAuto}
                onChange={e => setN('verticalInterlock', toMm(num(e.target.value, toDisplay(nesting.verticalInterlock, dimUnit)), dimUnit))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>السماح بالدوران Allow Rotation</Label>
              <div className="flex items-center gap-2 h-10">
                <Switch id="d001-allow-rot" checked={nesting.allowRotation}
                  onCheckedChange={v => setN('allowRotation', v)} />
                <Label htmlFor="d001-allow-rot" className="text-sm font-normal">
                  {nesting.allowRotation ? 'مسموح' : 'غير مسموح'}
                </Label>
              </div>
            </div>
            <div>
              <Label>وضع الدوران Rotation Mode</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                disabled={!nesting.allowRotation}
                value={nesting.rotationMode}
                onChange={e => setN('rotationMode', e.target.value as RotationMode)}
              >
                <option value="normal">Normal</option>
                <option value="rotated">Rotated 90°</option>
                <option value="auto">Auto</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results — UI hidden, logic preserved */}
      <Card className={hiddenCls}>
        <CardHeader>
          <CardTitle className="text-lg">نتائج التوزيع</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            <div className="space-y-1">
              <div className="font-semibold text-muted-foreground">المدخلات</div>
              <div>مقاس القالب الحالي (BBox): <b>{toDisplay(nestingResult.templateBBox.width, dimUnit)} × {toDisplay(nestingResult.templateBBox.height, dimUnit)} {dimUnit}</b></div>
              <div>مقاس الشيت الصافي: <b>{toDisplay(nestingResult.usableSheet.width, dimUnit)} × {toDisplay(nestingResult.usableSheet.height, dimUnit)} {dimUnit}</b></div>
              <div>وضع الدوران الفعلي: <b>{nestingResult.effectiveRotationMode}</b></div>
              <div>Pitch (X × Y): <b>{toDisplay(nestingResult.pitchX, dimUnit)} × {toDisplay(nestingResult.pitchY, dimUnit)} {dimUnit}</b></div>
              <div>التداخل الفعلي (H × V): <b>{toDisplay(nestingResult.horizontalInterlock, dimUnit)} × {toDisplay(nestingResult.verticalInterlock, dimUnit)} {dimUnit}</b></div>
              <div>Row brick Δx: <b>{toDisplay(nestingResult.rowBrickDx, dimUnit)} {dimUnit}</b></div>

              <div>المصدر: <b>{nestingResult.smartAuto ? 'Smart Auto (silhouette)' : 'Manual'}</b></div>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-muted-foreground">السيناريوهات</div>
              <div>Normal: <b>{nestingResult.normal.columns} × {nestingResult.normal.rows} = {nestingResult.normal.total}</b></div>
              <div>Rotated 90°: <b>{nestingResult.rotated.columns} × {nestingResult.rotated.rows} = {nestingResult.rotated.total}</b></div>
              <div className={nestingResult.fitStatus === 'fits' ? 'text-emerald-700' : 'text-red-600'}>
                {nestingResult.fitStatus === 'fits' ? (
                  <>أفضل اتجاه: <b>{nestingResult.bestOrientation === 'normal' ? 'Normal' : 'Rotated 90°'}</b>{' · '}إجمالي: <b>{nestingResult.bestTotal}</b></>
                ) : (<>القالب لا يدخل داخل الشيت بالقيم الحالية.</>)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sheet preview + side input panel */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
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
                  <Switch id="d001-show-dims" checked={showDimensions}
                    onCheckedChange={setShowDimensions} />
                  <Label htmlFor="d001-show-dims" className="text-sm font-normal cursor-pointer">
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
            <ExportSingleButton params={params} />
            <ExportSheetButton params={params} nesting={nesting} result={nestingResult} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] gap-4 items-start min-w-0 w-full calc-shell">
            <div className="min-w-0">
              {previewMode === 'template' ? (
                <D001Preview params={params} fitContainer showDebug={false} showDimensions={showDimensions} dimUnit={dimUnit} />
              ) : previewMode === 'sheet' ? (
                <D001SheetNestingPreview params={params} nesting={nesting} result={nestingResult} />
              ) : (
                <Box3DPreview
                  boxType="D001"
                  lidTongue={params.lidTongue}
                  panelWidths={[params.width, params.depth, params.width, params.depth - 0.5]}
                  panelHeights={params.height}
                  glueFlapWidth={params.glueFlap}
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
            <aside className="space-y-5 rounded-lg border bg-muted/30 p-4">
              {/* أبعاد القالب */}
              <section>
                <h3 className="text-sm font-bold mb-2">أبعاد القالب</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="العرض" value={params.width} disabled={refOn} unit={dimUnit}
                    onChange={v => set('width', v)} />
                  <NumField label="الارتفاع" value={params.height} disabled={refOn} unit={dimUnit}
                    onChange={v => set('height', v)} />
                  <NumField label="العمق" value={params.depth} disabled={refOn} unit={dimUnit}
                    onChange={v => set('depth', v)} />
                </div>
              </section>

              {/* تخصيص متقدم */}
              <section>
                <h3 className="text-sm font-bold mb-2">تخصيص متقدم</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="لسان اللصق" value={params.glueFlap} disabled={refOn} unit={dimUnit}
                    onChange={v => set('glueFlap', v)} />
                  <NumField label="لسان الغطاء" value={params.lidTongue} disabled={refOn} unit={dimUnit}
                    onChange={v => set('lidTongue', v)} />
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">ارتفاع لسان العمق</Label>
                      <button type="button" disabled={refOn}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                        title="إعادة ضبط"
                        onClick={() => {
                          tongueTotalTouched.current = false;
                          set('depthTongueTotalHeight', autoDepthTongueTotalHeight(params.depthTongue, params.depth));
                        }}>
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                    <Input type="number" step="0.01"
                      value={toDisplay(params.depthTongueTotalHeight ?? autoDepthTongueTotalHeight(params.depthTongue, params.depth), dimUnit)}
                      disabled={refOn}
                      onChange={e => {
                        tongueTotalTouched.current = true;
                        set('depthTongueTotalHeight', toMm(num(e.target.value, toDisplay(params.depthTongueTotalHeight ?? autoDepthTongueTotalHeight(params.depthTongue, params.depth), dimUnit)), dimUnit));
                      }} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <Label className="text-xs">زاوية لسان اللصق</Label>
                    <div className="grid grid-cols-2 gap-1">
                      <Input type="number" step="0.1" min="0" max="89"
                        placeholder="علوي"
                        value={params.glueFlapTopAngle ?? 25} disabled={refOn}
                        onChange={e => set('glueFlapTopAngle', num(e.target.value, 25))} />
                      <Input type="number" step="0.1" min="0" max="89"
                        placeholder="سفلي"
                        value={params.glueFlapBottomAngle ?? 25} disabled={refOn}
                        onChange={e => set('glueFlapBottomAngle', num(e.target.value, 25))} />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                      <span>علوي</span><span>سفلي</span>
                    </div>
                  </div>
                  <NumField label="زاوية لسان العمق" value={params.depthTongueCornerRadius ?? 0}
                    disabled={refOn} step="0.1" min="0" unit={dimUnit}
                    onChange={v => set('depthTongueCornerRadius', v)} />
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">القفل</Label>
                      <button type="button" disabled={refOn}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                        title={`إعادة ضبط إلى ${toDisplay(defaultDepthTongueForWidth(params.width), dimUnit)}${dimUnit}`}
                        onClick={() => {
                          depthTongueTouched.current = false;
                          set('depthTongue', defaultDepthTongueForWidth(params.width));
                        }}>
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                    <Input type="number" step="0.01" value={toDisplay(params.depthTongue, dimUnit)}
                      disabled={refOn}
                      onChange={e => {
                        depthTongueTouched.current = true;
                        set('depthTongue', toMm(num(e.target.value, toDisplay(params.depthTongue, dimUnit)), dimUnit));
                      }} />
                  </div>
                </div>
              </section>

              {/* إعدادات الشيت */}
              <section>
                <h3 className="text-sm font-bold mb-2">{"إعدادات\u00A0الشيت"}</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="عرض الشيت" value={params.sheetWidth} unit={dimUnit}
                    onChange={v => set('sheetWidth', v)} />
                  <NumField label="ارتفاع الشيت" value={params.sheetHeight} unit={dimUnit}
                    onChange={v => set('sheetHeight', v)} />
                  <NumField label="القابض" value={params.gripper} unit={dimUnit}
                    onChange={v => set('gripper', v)} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <NumField label="الهامش" value={params.sheetMargin} unit={dimUnit}
                    onChange={v => set('sheetMargin', v)} />
                  <NumField label="التباعد الأفقي" value={nesting.horizontalGap} step="0.1" min="0" unit={dimUnit}
                    onChange={v => setN('horizontalGap', v)} />
                  <NumField label="التباعد العمودي" value={nesting.verticalGap} step="0.1" min="0" unit={dimUnit}
                    onChange={v => setN('verticalGap', v)} />
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                  <div>الصافي: {usable.width.toFixed(2)} × {usable.height.toFixed(2)} mm</div>
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
            </aside>
          </div>
        </CardContent>
      </Card>

      <D001PrintSummary
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

const ExportSingleButton = ({ params }: { params: D001Params }) => {
  const onExportSvg = async () => {
    const { buildD001Geometry } = await import('@/lib/d001/geometry');
    const { downloadD001SingleTemplate } = await import('@/lib/d001/exportSingle');
    const geo = buildD001Geometry(params);
    const name = `D001_${params.width}x${params.height}x${params.depth}.svg`;
    downloadD001SingleTemplate(geo, name);
  };
  const onExportPdf = async (mode: 'download' | 'preview') => {
    const { buildD001Geometry } = await import('@/lib/d001/geometry');
    const { buildD001SingleTemplateSvg, downloadD001SingleTemplatePdf, previewD001SingleTemplatePdf } = await import('@/lib/d001/exportSingle');
    const geo = buildD001Geometry(params);
    const svg = buildD001SingleTemplateSvg(geo);
    const name = `D001_${params.width}x${params.height}x${params.depth}.pdf`;
    if (mode === 'preview') await previewD001SingleTemplatePdf(svg, name);
    else await downloadD001SingleTemplatePdf(svg, name);
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
        <DropdownMenuItem onSelect={onExportSvg}>
          تصدير SVG
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void onExportPdf('preview')}>
          معاينة PDF
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void onExportPdf('download')}>
          تحميل PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const ExportSheetButton = ({
  params, nesting, result,
}: {
  params: D001Params;
  nesting: D001NestingParams;
  result: ReturnType<typeof computeD001Nesting>;
}) => {
  const disabled = result.fitStatus !== 'fits' || result.bestTotal <= 0;
  const onExportSvg = async () => {
    const { downloadD001SheetLayout } = await import('@/lib/d001/exportSheet');
    downloadD001SheetLayout(params, nesting, result);
  };
  const onExportPdf = async (mode: 'download' | 'preview') => {
    const { downloadD001SheetLayoutPdf, previewD001SheetLayoutPdf } = await import('@/lib/d001/exportSheet');
    if (mode === 'preview') await previewD001SheetLayoutPdf(params, nesting, result);
    else await downloadD001SheetLayoutPdf(params, nesting, result);
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
        <DropdownMenuItem onSelect={onExportSvg} disabled={disabled}>
          تصدير SVG
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void onExportPdf('preview')} disabled={disabled}>
          معاينة PDF
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void onExportPdf('download')} disabled={disabled}>
          تحميل PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default D001Calculator;
