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
    <Label className="text-xs">{label}</Label>
    <Input type="number" step={step} min={min}
      value={unit ? toDisplay(value, unit) : value}
      disabled={disabled}
      onChange={e => onChange(unit ? toMm(num(e.target.value, toDisplay(value, unit)), unit) : num(e.target.value, value))} />
  </div>
);

const T0002Calculator = ({ isAdmin = false }: { isAdmin?: boolean }) => {
  const { show2DPreview, showNestingPreview, show3DPreview } = usePreviewSettings('T0002');

  const hiddenCls = isAdmin ? '' : 'hidden';

  // Draft params (for sidebar input controls)
  const [draftParams, setDraftParams] = useState<T0002Params>(T0002_DEFAULTS);
  const [draftNesting, setDraftNesting] = useState<T0002NestingParams>(DEFAULT_NESTING);

  // Applied params (for 2D canvas, geometry, 3D preview, nesting layout & exports)
  const [appliedParams, setAppliedParams] = useState<T0002Params>(T0002_DEFAULTS);
  const [appliedNesting, setAppliedNesting] = useState<T0002NestingParams>(DEFAULT_NESTING);

  const [previewMode, setPreviewMode] = useState<'template' | 'sheet' | 'three'>('template');
  const [showDimensions, setShowDimensions] = useState(true);
  const [dimUnit, setDimUnit] = useState<'mm' | 'cm' | 'in'>('mm');
  const [dimScale, setDimScale] = useState(1);
  const [printOpen, setPrintOpen] = useState(false);

  // Segment overrides state for interactive line adjustments
  const [segmentOverrides, setSegmentOverrides] = useState<{ svg: string | null; segments: Segment[] | null }>({
    svg: null,
    segments: null,
  });

  const depthTongueTouched = useRef(false);
  const tongueTotalTouched = useRef(false);

  // Updates ONLY draft state (sidebar inputs), DOES NOT re-render template canvas
  const setDraft = <K extends keyof T0002Params>(k: K, v: T0002Params[K]) => {
    setDraftParams(prev => {
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

  const setDraftN = <K extends keyof T0002NestingParams>(k: K, v: T0002NestingParams[K]) =>
    setDraftNesting(prev => ({ ...prev, [k]: v }));

  // Applies draft changes to the actual template canvas & 3D model
  const handleSave = () => {
    setAppliedParams(draftParams);
    setAppliedNesting(draftNesting);
    setSegmentOverrides({ svg: null, segments: null });
  };

  // Resets both draft and applied params back to default values
  const handleReset = () => {
    setDraftParams(T0002_DEFAULTS);
    setAppliedParams(T0002_DEFAULTS);
    setDraftNesting(DEFAULT_NESTING);
    setAppliedNesting(DEFAULT_NESTING);
    setSegmentOverrides({ svg: null, segments: null });
    setDimScale(1);
    depthTongueTouched.current = false;
    tongueTotalTouched.current = false;
  };

  const usable = useMemo(() => usableSheet(appliedParams), [appliedParams]);

  const geo = useMemo<T0002Geometry>(() => {
    const raw = buildT0002Geometry(appliedParams);
    if (segmentOverrides.svg) {
      return {
        ...raw,
        svg: segmentOverrides.svg,
        segments: segmentOverrides.segments || raw.segments,
      };
    }
    return raw;
  }, [appliedParams, segmentOverrides]);

  const nestingResult = useMemo(
    () => computeT0002Nesting(appliedParams, appliedNesting, geo.bbox.w, geo.bbox.h),
    [appliedParams, appliedNesting, geo.bbox.w, geo.bbox.h],
  );

  const faceCoords = useMemo(() => {
    const W = appliedParams.width;
    const H = appliedParams.height;
    const D = appliedParams.depth;
    const Gf = appliedParams.glueFlap;
    const Lid = appliedParams.lidTongue;
    const DT = appliedParams.depthTongue;
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

    const topAngle = (Number.isFinite(appliedParams.glueFlapTopAngle) && (appliedParams.glueFlapTopAngle as number) >= 0)
      ? (appliedParams.glueFlapTopAngle as number) : GLUE_FLAP_ANGLE_DEG;
    const botAngle = (Number.isFinite(appliedParams.glueFlapBottomAngle) && (appliedParams.glueFlapBottomAngle as number) >= 0)
      ? (appliedParams.glueFlapBottomAngle as number) : GLUE_FLAP_ANGLE_DEG;
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
    const userTongueH = appliedParams.depthTongueTotalHeight;
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
  }, [appliedParams]);

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
      }
    }

    if (!Number.isFinite(minX)) return { w: 0, h: 0 };
    return { w: maxX - minX, h: maxY - minY };
  }, [nestingResult]);

  const dimsSvg = useMemo(
    () => (showDimensions ? buildT0002DimensionsSvg(appliedParams, dimUnit, dimScale) : ''),
    [showDimensions, appliedParams, dimUnit, dimScale],
  );

  const derived = useMemo(() => ({
    faceHeight: T0002_RULES.faceHeight(appliedParams.height),
    depth1: T0002_RULES.depth1(appliedParams.depth),
    depth2: T0002_RULES.depth2(appliedParams.depth),
    coverVertical: T0002_RULES.coverVertical(appliedParams.depth),
    lidCurveHeight: T0002_RULES.lidCurveHeight,
  }), [appliedParams]);

  return (
    <>
      <TemplateEditorLayout
        title="T0002 — علبة مستقيمة الإغلاق (Straight Tuck-End Box)"
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
        actionButtons={
          <>
            <ExportSingleButton params={appliedParams} geo={geo} />
            {showNestingPreview && (
              <ExportSheetButton params={appliedParams} nesting={appliedNesting} result={nestingResult} />
            )}
          </>
        }
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
                      setSegmentOverrides({ svg: newSvg, segments: newSegs });
                    }}
                  />
                </div>
              ) : previewMode === 'sheet' ? (
                <T0002SheetNestingPreview params={appliedParams} nesting={appliedNesting} result={nestingResult} />
              ) : (
                <Box3DPreview
                  boxType="T0002"
                  lidTongue={appliedParams.lidTongue}
                  panelWidths={[appliedParams.width, appliedParams.depth, appliedParams.width, appliedParams.depth - 0.5]}
                  panelHeights={appliedParams.height}
                  glueFlapWidth={appliedParams.glueFlap}
                  topFlapHeights={[
                    faceCoords.topFlaps[0].h,
                    faceCoords.topFlaps[1].h,
                    faceCoords.topFlaps[2].h,
                    faceCoords.topFlaps[3].h,
                  ]}
                  bottomFlapHeights={[
                    faceCoords.bottomFlaps[0].h,
                    faceCoords.bottomFlaps[1].h,
                    faceCoords.bottomFlaps[2].h,
                    faceCoords.bottomFlaps[3].h,
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
              <section className="pt-3 pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold mb-2">أبعاد العلبة</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="العرض" value={draftParams.width} defaultValue={T0002_DEFAULTS.width} unit={dimUnit} onChange={v => setDraft('width', v)} />
                  <NumField label="الارتفاع" value={draftParams.height} defaultValue={T0002_DEFAULTS.height} unit={dimUnit} onChange={v => setDraft('height', v)} />
                  <NumField label="العمق" value={draftParams.depth} defaultValue={T0002_DEFAULTS.depth} unit={dimUnit} onChange={v => setDraft('depth', v)} />
                </div>
              </section>

              <section className="pt-2 pb-3 border-b border-slate-100 space-y-2">
                <h3 className="text-sm font-bold mb-2">تخصيص متقدم</h3>
                
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="لسان اللصق" value={draftParams.glueFlap} defaultValue={T0002_DEFAULTS.glueFlap} unit={dimUnit} onChange={v => setDraft('glueFlap', v)} />
                  <NumField label="لسان الغطاء" value={draftParams.lidTongue} defaultValue={T0002_DEFAULTS.lidTongue} unit={dimUnit} onChange={v => setDraft('lidTongue', v)} />
                  <div>
                    <Label className="text-xs truncate mb-1 block" title="ارتفاع لسان العمق">ارتفاع لسان العمق</Label>
                    <Input type="number" step="0.01"
                      value={toDisplay(draftParams.depthTongueTotalHeight ?? autoDepthTongueTotalHeight(draftParams.depthTongue, draftParams.depth), dimUnit)}
                      onChange={e => {
                        tongueTotalTouched.current = true;
                        setDraft('depthTongueTotalHeight', toMm(num(e.target.value, toDisplay(draftParams.depthTongueTotalHeight ?? autoDepthTongueTotalHeight(draftParams.depthTongue, draftParams.depth), dimUnit)), dimUnit));
                      }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <NumField label="زاوية لسان العمق" value={draftParams.depthTongueCornerRadius ?? 0} defaultValue={0}
                    step="0.1" min="0" unit={dimUnit}
                    onChange={v => setDraft('depthTongueCornerRadius', v)} />
                    
                  <div>
                    <Label className="text-xs truncate mb-1 block">القفل</Label>
                    <Input type="number" step="0.01" value={toDisplay(draftParams.depthTongue, dimUnit)}
                      onChange={e => {
                        depthTongueTouched.current = true;
                        setDraft('depthTongue', toMm(num(e.target.value, toDisplay(draftParams.depthTongue, dimUnit)), dimUnit));
                      }} />
                  </div>
                </div>

                <div className="pt-1">
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <Label className="text-xs font-semibold">زاوية لسان اللصق (°)</Label>
                    {(draftParams.glueFlapTopAngle !== 25 || draftParams.glueFlapBottomAngle !== 25) && (
                      <button
                        type="button"
                        onClick={() => {
                          setDraft('glueFlapTopAngle', 25);
                          setDraft('glueFlapBottomAngle', 25);
                        }}
                        className="text-slate-400 hover:text-slate-700 disabled:opacity-30 p-0.5 rounded hover:bg-slate-100 transition-colors"
                        title="إعادة ضبط زوايا لسان اللصق إلى 25°"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5 bg-slate-50 border rounded-md px-2.5 py-1">
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">علوي:</span>
                      <input type="number" step="0.1" min="0" max="89"
                        className="w-full bg-transparent text-xs font-medium focus:outline-none text-left"
                        dir="ltr"
                        value={draftParams.glueFlapTopAngle ?? 25}
                        onChange={e => setDraft('glueFlapTopAngle', num(e.target.value, 25))} />
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-50 border rounded-md px-2.5 py-1">
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">سفلي:</span>
                      <input type="number" step="0.1" min="0" max="89"
                        className="w-full bg-transparent text-xs font-medium focus:outline-none text-left"
                        dir="ltr"
                        value={draftParams.glueFlapBottomAngle ?? 25}
                        onChange={e => setDraft('glueFlapBottomAngle', num(e.target.value, 25))} />
                    </div>
                  </div>
                </div>
              </section>

              {showNestingPreview && previewMode === 'sheet' && (
                <section className="pt-2 pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold mb-2">إعدادات الشيت</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <NumField label="عرض الشيت" value={draftParams.sheetWidth} defaultValue={T0002_DEFAULTS.sheetWidth} unit={dimUnit} onChange={v => setDraft('sheetWidth', v)} />
                    <NumField label="ارتفاع الشيت" value={draftParams.sheetHeight} defaultValue={T0002_DEFAULTS.sheetHeight} unit={dimUnit} onChange={v => setDraft('sheetHeight', v)} />
                    <NumField label="القابض" value={draftParams.gripper} defaultValue={T0002_DEFAULTS.gripper} unit={dimUnit} onChange={v => setDraft('gripper', v)} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <NumField label="الهامش" value={draftParams.sheetMargin} defaultValue={T0002_DEFAULTS.sheetMargin} unit={dimUnit} onChange={v => setDraft('sheetMargin', v)} />
                    <NumField label="التباعد الأفقي" value={draftNesting.horizontalGap} defaultValue={DEFAULT_NESTING.horizontalGap} step="0.1" min="0" unit={dimUnit} onChange={v => setDraftN('horizontalGap', v)} />
                    <NumField label="التباعد العمودي" value={draftNesting.verticalGap} defaultValue={DEFAULT_NESTING.verticalGap} step="0.1" min="0" unit={dimUnit} onChange={v => setDraftN('verticalGap', v)} />
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                    <div>الصافي: {usable.width.toFixed(2)} × {usable.height.toFixed(2)} مم</div>
                  </div>
                </section>
              )}

          </>
        }
      />
    </>
  );
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
