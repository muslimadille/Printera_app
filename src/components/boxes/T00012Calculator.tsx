import { TemplateEditorLayout, PreviewMode } from '@/components/layouts/TemplateEditorLayout';
// T00012 — Dynamic Dieline tab (Mailer Box - Roll End Tuck Top)
import { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
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
  return isNaN(n) ? fallback : n;
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

  const [draftParams, setDraftParams] = useState<T00012Params>(T00012_DEFAULTS);
  const [appliedParams, setAppliedParams] = useState<T00012Params>(T00012_DEFAULTS);

  const [draftNesting, setDraftNesting] = useState<T00012NestingParams>(DEFAULT_NESTING);
  const [appliedNesting, setAppliedNesting] = useState<T00012NestingParams>(DEFAULT_NESTING);

  const [previewMode, setPreviewMode] = useState<'template' | 'sheet' | 'three'>('template');
  const [showDimensions, setShowDimensions] = useState(true);
  const [dimUnit, setDimUnit] = useState<'mm' | 'cm' | 'in'>('mm');
  const [dimScale, setDimScale] = useState(1);
  const [printOpen, setPrintOpen] = useState(false);

  const [segmentOverrides, setSegmentOverrides] = useState<{ svg: string | null; segments: Segment[] | null }>({
    svg: null,
    segments: null,
  });

  const setN = <K extends keyof T00012NestingParams>(k: K, v: T00012NestingParams[K]) =>
    setDraftNesting(prev => ({ ...prev, [k]: v }));

  const set = <K extends keyof T00012Params>(k: K, v: T00012Params[K]) => {
    setDraftParams(prev => {
      const next = { ...prev, [k]: v };
      if (k === 'referenceMode') {
        if (v) {
          return { ...T00012_REFERENCE, referenceMode: true };
        } else {
          return { ...T00012_DEFAULTS, referenceMode: false };
        }
      }
      return next;
    });
  };

  const handleSave = () => {
    setAppliedParams({ ...draftParams });
    setAppliedNesting({ ...draftNesting });
    setSegmentOverrides({ svg: null, segments: null });
    toast.success('تم حفظ التعديلات وتطبيقها');
  };

  const handleReset = () => {
    setDraftParams({ ...T00012_DEFAULTS });
    setAppliedParams({ ...T00012_DEFAULTS });
    setDraftNesting({ ...DEFAULT_NESTING });
    setAppliedNesting({ ...DEFAULT_NESTING });
    setSegmentOverrides({ svg: null, segments: null });
    toast.info('تم إعادة تعيين جميع الأبعاد للقيم الافتراضية');
  };

  const usable = useMemo(() => usableSheet(appliedParams), [appliedParams]);
  const nestingResult = useMemo(() => computeT00012Nesting(appliedParams, appliedNesting), [appliedParams, appliedNesting]);

  const baseGeo = useMemo(() => buildT00012Geometry(appliedParams), [appliedParams]);

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

  const refOn = !!draftParams.referenceMode;

  const dimsSvg = useMemo(
    () => (showDimensions ? buildT00012DimensionsSvg(appliedParams, dimUnit, dimScale) : ''),
    [showDimensions, appliedParams, dimUnit, dimScale],
  );

  return (
    <>
      <TemplateEditorLayout
        title="T00012 — علبة بريدية مغلقة (Mailer Box - Roll End Tuck Top)"
        previewMode={previewMode}
        onPreviewModeChange={setPreviewMode}
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
            <ExportSheetButton params={appliedParams} nesting={appliedNesting} result={nestingResult} />
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
                <T00012SheetNestingPreview params={appliedParams} nesting={appliedNesting} result={nestingResult} />
              ) : (
                <MailerBox3DPreview
                  svgMarkup={geo.svg}
                  svgWidth={geo.bbox.w}
                  svgHeight={geo.bbox.h}
                  faceCoords={geo.faceCoords}
                />
              )}
          </>
        }
        sidebarArea={
          <>
              {/* أبعاد القالب */}
              <section className="space-y-3">
                <h3 className="text-sm font-bold border-b pb-1">أبعاد العلبة</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="العرض" value={draftParams.width} unit={dimUnit} onChange={v => set('width', v)} />
                  <NumField label="الارتفاع" value={draftParams.height} unit={dimUnit} onChange={v => set('height', v)} />
                  <NumField label="العمق" value={draftParams.depth} unit={dimUnit} onChange={v => set('depth', v)} />
                </div>
              </section>

              {/* تخصيص متقدم */}
              <section className="space-y-3">
                <h3 className="text-sm font-bold border-b pb-1">تخصيص متقدم</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="لسان الغبار" value={draftParams.dustFlapLength ?? draftParams.depth} unit={dimUnit} onChange={v => set('dustFlapLength', v)} />
                  <NumField label="اللسان العلوي" value={draftParams.topFlapTuckLength ?? 20} unit={dimUnit} onChange={v => set('topFlapTuckLength', v)} />
                  <NumField label="الألسنة الجانبية" value={draftParams.sideFlapsLength ?? 15.5} unit={dimUnit} onChange={v => set('sideFlapsLength', v)} />
                </div>
              </section>

              {/* إعدادات الشيت */}
              <section>
                <h3 className="text-sm font-bold mb-2">إعدادات الشيت</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="عرض الشيت" value={draftParams.sheetWidth} unit={dimUnit} onChange={v => set('sheetWidth', v)} />
                  <NumField label="ارتفاع الشيت" value={draftParams.sheetHeight} unit={dimUnit} onChange={v => set('sheetHeight', v)} />
                  <NumField label="القابض" value={draftParams.gripper} unit={dimUnit} onChange={v => set('gripper', v)} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <NumField label="الهامش" value={draftParams.sheetMargin} unit={dimUnit} onChange={v => set('sheetMargin', v)} />
                  <NumField label="التباعد الأفقي" value={draftNesting.horizontalGap} step="0.1" min="0" unit={dimUnit} onChange={v => setN('horizontalGap', v)} />
                  <NumField label="التباعد العمودي" value={draftNesting.verticalGap} step="0.1" min="0" unit={dimUnit} onChange={v => setN('verticalGap', v)} />
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                  <div>الصافي: {usable.width.toFixed(2)} × {usable.height.toFixed(2)} مم</div>
                </div>
              </section>

          </>
        }
      />

      <T00012PrintSummary
        open={printOpen}
        onOpenChange={setPrintOpen}
        params={appliedParams}
        nesting={appliedNesting}
        nestingResult={nestingResult}
        dimUnit={dimUnit}
        distributionFootprint={distributionFootprint}
      />
    </>  );
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
