import { TemplateEditorLayout, PreviewMode } from '@/components/layouts/TemplateEditorLayout';
// T0002 — Dynamic Dieline tab (Straight Tuck-End Box)
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
  T0002_DEFAULTS,
  T0002_REFERENCE,
  T0002_RULES,
  autoDepthTongueTotalHeight,
  type T0002Params,
  type T0002Geometry,
  usableSheet
} from '@/lib/t0002/types';
import { buildT0002Geometry } from '@/lib/t0002/geometry';
import { buildT0002DimensionsSvg } from '@/lib/t0002/dimensionsOverlay';
import { computeT0002Nesting, type T0002NestingParams, type RotationMode } from '@/lib/t0002/nesting';
import T0002SheetNestingPreview from './T0002SheetNestingPreview';
import T0002PrintSummary from './T0002PrintSummary';
import Box3DPreview, { type Panel2DInfo } from './Box3DPreview';
import { InteractiveSvgCanvas, type Segment } from '@/components/InteractiveSvgCanvas';
import { usePreviewSettings } from '@/hooks/usePreviewSettings';

const DEFAULT_NESTING: T0002NestingParams = {
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

const T0002Calculator = ({ isAdmin = false }: { isAdmin?: boolean }) => {
  const { showNestingPreview, show3DPreview } = usePreviewSettings();

  const hiddenCls = isAdmin ? '' : 'hidden';

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

  const setN = <K extends keyof T0002NestingParams>(k: K, v: T0002NestingParams[K]) =>
    setNesting(prev => ({ ...prev, [k]: v }));

  const depthTongueTouched = useRef(false);
  const tongueTotalTouched = useRef(false);

  const set = <K extends keyof T0002Params>(k: K, v: T0002Params[K]) => {
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
    // Clear overrides when params are updated by inputs
    setSegmentOverrides({ svg: null, segments: null });
  };

  const reset = () => {
    setParams({ ...T0002_DEFAULTS });
    setNesting({ ...DEFAULT_NESTING });
    setSegmentOverrides({ svg: null, segments: null });
    depthTongueTouched.current = false;
    tongueTotalTouched.current = false;
  };

  const usable = useMemo(() => usableSheet(params), [params]);
  const nestingResult = useMemo(() => computeT0002Nesting(params, nesting), [params, nesting]);

  const baseGeo = useMemo(() => buildT0002Geometry(params), [params]);

  // Derived geometry using segment overrides if active
  const geo = useMemo<T0002Geometry>(() => {
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

    // Constants identical to geometry.ts
    const GLUE_FLAP_ANGLE_DEG = 25;
    const SEG3_LEN = 0.75;
    const SEG5_LEG = 2;
    const SEG9_LEG = 3;
    const RAMP_RATIO = 5.358 / 20;
    const SEG7_LID_GAP = 5;
    const SEG8_LEG = 2;
    const CREASE_OFFSET = 0.5;
    const CURL_DX = 7.7297;

    const topAngle = (Number.isFinite(params.glueFlapTopAngle) && (params.glueFlapTopAngle as number) >= 0)
      ? (params.glueFlapTopAngle as number) : GLUE_FLAP_ANGLE_DEG;
    const botAngle = (Number.isFinite(params.glueFlapBottomAngle) && (params.glueFlapBottomAngle as number) >= 0)
      ? (params.glueFlapBottomAngle as number) : GLUE_FLAP_ANGLE_DEG;
    const gDyTop = Gf * Math.tan((topAngle * Math.PI) / 180);
    const gDyBot = Gf * Math.tan((botAngle * Math.PI) / 180);

    const Xd2R = Xd2 + d2;
    const Ylp = Lid;
    const Ybe = Yfb + Cov;
    const Yab = Ybe + Lid;
    const Y0 = 0;

    const widthFallback = W <= 25 ? 3 : 5;
    const seg4H = (Number.isFinite(DT) && DT > 0) ? DT : widthFallback;
    const halfD = D / 2;
    const autoTongueH = seg4H + SEG5_LEG + halfD;
    const userTongueH = params.depthTongueTotalHeight;
    const tongueTotalH = (Number.isFinite(userTongueH) && (userTongueH as number) > 0)
      ? (userTongueH as number)
      : autoTongueH;
    const middleExt = Math.max(0.001, tongueTotalH - seg4H - SEG5_LEG);
    const rampDx = middleExt * RAMP_RATIO;
    const seg8Dy = tongueTotalH - SEG9_LEG;

    const Xtpl = Xf2 + CREASE_OFFSET;
    const Xtpr = Xd2 - CREASE_OFFSET;
    const Xbpl = Xf1 + CREASE_OFFSET;
    const Xbpr = Xd1 - CREASE_OFFSET;
    const Xtal = Xtpl + CURL_DX;
    const Xtar = Xtpr - CURL_DX;
    const Xbal = Xbpl + CURL_DX;
    const Xbar = Xbpr - CURL_DX;

    const k = Lid / 14.25;

    const getBezierPoints = (p1: [number, number], cp1: [number, number], cp2: [number, number], p2: [number, number], steps = 8): [number, number][] => {
      const pts: [number, number][] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        const w1 = mt * mt * mt;
        const w2 = 3 * mt * mt * t;
        const w3 = 3 * mt * t * t;
        const w4 = t * t * t;
        const x = w1 * p1[0] + w2 * cp1[0] + w3 * cp2[0] + w4 * p2[0];
        const y = w1 * p1[1] + w2 * cp1[1] + w3 * cp2[1] + w4 * p2[1];
        pts.push([x, y]);
      }
      return pts;
    };

    // Calculate Bezier points for top lid
    const pts12 = getBezierPoints(
      [Xtal, Y0],
      [Xtal - 4.8228, Y0 + 3.1385 * k],
      [Xtal - CURL_DX, Y0 + 8.5019 * k],
      [Xtpl, Ylp]
    ).reverse();

    const pts14 = getBezierPoints(
      [Xtpr, Ylp],
      [Xtpr + 0, Ylp - 5.7518 * k],
      [Xtpr - 2.9087, Ylp - 11.1135 * k],
      [Xtar, Y0]
    ).reverse();

    // Calculate Bezier points for bottom lid
    const pts43 = getBezierPoints(
      [Xbpl, Ybe],
      [Xbpl + 0, Ybe + 5.7518 * k],
      [Xbpl + 2.9087, Ybe + 11.1135 * k],
      [Xbal, Yab]
    );

    const pts41 = getBezierPoints(
      [Xbar, Yab],
      [Xbar + 4.8228, Yab - 3.1385 * k],
      [Xbar + CURL_DX, Yab - 8.5019 * k],
      [Xbpr, Ybe]
    );

    const tf1 = 0;
    const tf2 = tongueTotalH;
    const tf3 = Lid + Cov;
    const tf4 = tongueTotalH;

    const bf1 = Lid + Cov;
    const bf2 = tongueTotalH;
    const bf3 = 0;
    const bf4 = tongueTotalH;

    return {
      body: [
        { x: Xf1, y: Yft, w: W, h: H },
        { x: Xd1, y: Yft, w: D, h: H },
        { x: Xf2, y: Yft, w: W, h: H },
        { x: Xd2, y: Yft, w: d2, h: H },
      ] as [Panel2DInfo, Panel2DInfo, Panel2DInfo, Panel2DInfo],
      glue: {
        x: Xg, y: Yft, w: Gf, h: H,
        polygon: [
          [Xf1, Yft],
          [Xg, Yft + gDyTop],
          [Xg, Yfb - gDyBot],
          [Xf1, Yfb],
        ] as [number, number][],
      },
      topFlaps: [
        { x: Xf1, y: Yft, w: W, h: 0, polygon: [] as [number, number][] },
        {
          x: Xd1, y: Yft - tf2, w: D, h: tf2,
          polygon: [
            [Xd1, Yft],
            [Xd1 + SEG3_LEN, Yft],
            [Xd1 + SEG3_LEN, Yft - seg4H],
            [Xd1 + SEG3_LEN + SEG5_LEG, Yft - seg4H - SEG5_LEG],
            [Xd1 + SEG3_LEN + SEG5_LEG + rampDx, Yft - tongueTotalH],
            [Xf2 - SEG9_LEG - SEG8_LEG, Yft - tongueTotalH],
            [Xf2 - SEG9_LEG, Yft - SEG9_LEG],
            [Xf2, Yft],
          ] as [number, number][],
        },
        {
          x: Xf2, y: 0, w: W, h: tf3,
          polygon: [
            [Xf2, Yft],
            [Xf2, Ylp],
            ...pts12,
            ...pts14,
            [Xd2, Ylp],
            [Xd2, Yft],
          ] as [number, number][],
        },
        {
          x: Xd2, y: Yft - tf4, w: d2, h: tf4,
          polygon: [
            [Xd2, Yft],
            [Xd2 + SEG9_LEG, Yft - SEG9_LEG],
            [Xd2 + SEG7_LID_GAP, Yft - tongueTotalH],
            [Xd2R - SEG5_LEG - rampDx, Yft - tongueTotalH],
            [Xd2R - SEG5_LEG, Yft - seg4H - SEG5_LEG],
            [Xd2R, Yft - seg4H],
            [Xd2R, Yft],
          ] as [number, number][],
        },
      ] as [Panel2DInfo, Panel2DInfo, Panel2DInfo, Panel2DInfo],
      bottomFlaps: [
        {
          x: Xf1, y: Yfb, w: W, h: bf1,
          polygon: [
            [Xf1, Yfb],
            [Xf1, Ybe],
            ...pts43,
            ...pts41,
            [Xd1, Ybe],
            [Xd1, Yfb],
          ] as [number, number][],
        },
        {
          x: Xd1, y: Yfb, w: D, h: bf2,
          polygon: [
            [Xd1, Yfb],
            [Xd1 + SEG9_LEG, Yfb + SEG9_LEG],
            [Xd1 + SEG9_LEG + SEG8_LEG, Yfb + tongueTotalH],
            [Xf2 - SEG3_LEN - SEG5_LEG - rampDx, Yfb + tongueTotalH],
            [Xf2 - SEG3_LEN - SEG5_LEG, Yfb + seg4H + SEG5_LEG],
            [Xf2 - SEG3_LEN, Yfb + seg4H],
            [Xf2 - SEG3_LEN, Yfb],
            [Xf2, Yfb],
          ] as [number, number][],
        },
        { x: Xf2, y: Yfb, w: W, h: 0, polygon: [] as [number, number][] },
        {
          x: Xd2, y: Yfb, w: d2, h: bf4,
          polygon: [
            [Xd2, Yfb],
            [Xd2 + SEG3_LEN, Yfb],
            [Xd2 + SEG3_LEN, Yfb + seg4H],
            [Xd2 + SEG3_LEN + SEG5_LEG, Yfb + seg4H + SEG5_LEG],
            [Xd2 + SEG3_LEN + SEG5_LEG + rampDx, Yfb + tongueTotalH],
            [Xd2R - SEG9_LEG - SEG8_LEG, Yfb + tongueTotalH],
            [Xd2R - SEG9_LEG, Yfb + SEG9_LEG],
            [Xd2R, Yfb],
          ] as [number, number][],
        },
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
    faceHeight: T0002_RULES.faceHeight(params.height),
    depth1: T0002_RULES.depth1(params.depth),
    depth2: T0002_RULES.depth2(params.depth),
    coverVertical: T0002_RULES.coverVertical(params.depth),
    lidCurveHeight: T0002_RULES.lidCurveHeight,
  }), [params]);

  const refOn = !!params.referenceMode;

  const dimsSvg = useMemo(
    () => (showDimensions ? buildT0002DimensionsSvg(params, dimUnit, 1) : ''),
    [showDimensions, params, dimUnit],
  );

  return (
    <>
      <TemplateEditorLayout
        title="T0002 — علبة مستقيمة الإغلاق (Straight Tuck-End Box)"
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
        topPanels={
          <>
            {/* Derived dimensions (WIP / admin view) */}
      <Card className={hiddenCls}>
        <CardHeader>
          <CardTitle className="text-lg">الأبعاد المشتقة</CardTitle>
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
                <Switch id="t0002-smart" checked={!!nesting.smartAuto}
                  onCheckedChange={v => setN('smartAuto', v)} />
                <Label htmlFor="t0002-smart" className="text-sm font-normal">
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
          </>
        }
        actionButtons={
          <>
            <Button variant="outline" size="sm" onClick={() => setPrintOpen(true)}>
              ملخص الطباعة
            </Button>
            <ExportSingleButton params={params} geo={geo} />
            <ExportSheetButton params={params} nesting={nesting} result={nestingResult} />
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
                      setSegmentOverrides({ svg: newSvg, segments: newSegs });
                    }}
                  />
                </div>
              ) : previewMode === 'sheet' ? (
                <T0002SheetNestingPreview params={params} nesting={nesting} result={nestingResult} />
              ) : (
                <Box3DPreview
                  boxType="T0002"
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
          </>
        }
        sidebarArea={
          <>
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
                  <NumField label="لسان الغطاء" value={params.lidTongue} disabled={refOn} unit={dimUnit} onChange={v => set('lidTongue', v)} />
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
                      <Input type="number" step="0.1" min="0" max="89" placeholder="علوي"
                        value={params.glueFlapTopAngle ?? 25} disabled={refOn}
                        onChange={e => set('glueFlapTopAngle', num(e.target.value, 25))} />
                      <Input type="number" step="0.1" min="0" max="89" placeholder="سفلي"
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
          </>
        }
      />

      <T0002PrintSummary
        open={printOpen}
        onOpenChange={setPrintOpen}
        params={params}
        nesting={nesting}
        nestingResult={nestingResult}
        dimUnit={dimUnit}
        distributionFootprint={distributionFootprint}
        derived={derived}
      />
    </>  );
};

const ExportSingleButton = ({ params, geo }: { params: T0002Params; geo: T0002Geometry }) => {
  const onExportSvg = async () => {
    const { downloadT0002SingleTemplate } = await import('@/lib/t0002/exportSingle');
    const name = `T0002_${params.width}x${params.height}x${params.depth}.svg`;
    downloadT0002SingleTemplate(geo, name);
  };
  const onExportPdf = async () => {
    const { buildT0002SingleTemplateSvg, downloadT0002SingleTemplatePdf } = await import('@/lib/t0002/exportSingle');
    const svg = buildT0002SingleTemplateSvg(geo);
    const name = `T0002_${params.width}x${params.height}x${params.depth}.pdf`;
    await downloadT0002SingleTemplatePdf(svg, name);
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
  params: T0002Params;
  nesting: T0002NestingParams;
  result: ReturnType<typeof computeT0002Nesting>;
}) => {
  const disabled = result.fitStatus !== 'fits' || result.bestTotal <= 0;
  const onExportSvg = async () => {
    const { downloadT0002SheetLayout } = await import('@/lib/t0002/exportSheet');
    downloadT0002SheetLayout(params, nesting, result);
  };
  const onExportPdf = async () => {
    const { downloadT0002SheetLayoutPdf } = await import('@/lib/t0002/exportSheet');
    await downloadT0002SheetLayoutPdf(params, nesting, result);
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
        <DropdownMenuItem onSelect={onExportSvg} disabled={disabled}>تصدير SVG</DropdownMenuItem>
        <DropdownMenuItem onSelect={onExportPdf} disabled={disabled}>تصدير PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default T0002Calculator;
