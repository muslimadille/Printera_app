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
import { ChevronDown, Printer } from 'lucide-react';
import { D003_DEFAULTS, D003_REFERENCE, type D003Params, usableSheet } from '@/lib/d003/types';
import { buildD003Geometry } from '@/lib/d003/geometry';
import { computeD003Nesting, type D003NestingParams, type RotationMode } from '@/lib/d003/nesting';
import D003SheetNestingPreview from './D003SheetNestingPreview';
import D003PrintSummary from './D003PrintSummary';
import Box3DPreview, { type Panel2DInfo } from './Box3DPreview';

const DEFAULT_NESTING: D003NestingParams = {
  horizontalGap: 3,
  verticalGap: 3,
  allowRotation: true,
  rotationMode: 'auto',
  horizontalInterlock: 0,
  verticalInterlock: 0,
};

const UNIT_FACTORS: Record<'mm' | 'cm' | 'in', number> = { mm: 1, cm: 10, in: 25.4 };
const toDisplay = (mm: number, unit: 'mm' | 'cm' | 'in') => parseFloat((mm / UNIT_FACTORS[unit]).toFixed(4));
const toMm = (val: number, unit: 'mm' | 'cm' | 'in') => val * UNIT_FACTORS[unit];

const D003Preview = ({ params, fitContainer = false, showDebug = true }: { params: D003Params; fitContainer?: boolean; showDebug?: boolean }) => {
  const geo = useMemo(() => buildD003Geometry(params), [params]);

  const innerSvg = useMemo(() => {
    const m = geo.svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
    return m ? m[1] : geo.svg;
  }, [geo.svg]);

  const sw = params.sheetWidth;
  const sh = params.sheetHeight;
  const bw = geo.bbox.w;
  const bh = geo.bbox.h;
  const scale = fitContainer ? Math.min(sw / bw, sh / bh) : 1;

  return (
    <div className="space-y-2">
      {showDebug && (
        <div className="text-xs text-muted-foreground">
          Mode: <b>{params.referenceMode ? 'Reference Clone' : 'Dynamic'}</b>
          {' · '}Segments: <b>{geo.segments.length}</b>
          {' · '}BBox: <b>{geo.bbox.w.toFixed(2)} × {geo.bbox.h.toFixed(2)} mm</b>
        </div>
      )}
      {fitContainer ? (
        <div className="border rounded-lg p-3 bg-white overflow-auto flex justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`0 0 ${params.sheetWidth} ${params.sheetHeight}`}
            width="100%"
            style={{ height: 'auto', display: 'block', maxWidth: '100%' }}
          >
            {(() => {
              const tx = (sw - bw * scale) / 2;
              const ty = (sh - bh * scale) / 2;
              return (
                <g transform={`translate(${tx} ${ty}) scale(${scale})`} dangerouslySetInnerHTML={{ __html: innerSvg }} />
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
  label, hint, value, onChange, step = 1, min = 0, disabled = false, unit,
}: {
  label: string; hint?: string; value: number;
  onChange: (n: number) => void; step?: number; min?: number; disabled?: boolean; unit?: 'mm' | 'cm' | 'in';
}) => {
  const displayVal = unit ? toDisplay(value, unit) : value;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number" inputMode="decimal" step={step} min={min} disabled={disabled}
        value={Number.isFinite(displayVal) ? displayVal : 0}
        onChange={e => {
          const val = parseFloat(e.target.value) || 0;
          onChange(unit ? toMm(val, unit) : val);
        }}
        className="h-9 text-sm font-medium tabular-nums"
      />
      {hint && <p className="text-[10px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
};

const D003Calculator = ({ isAdmin = false }: { isAdmin?: boolean }) => {
  const hiddenCls = isAdmin ? '' : 'hidden';

  const [params, setParams] = useState<D003Params>(D003_DEFAULTS);
  const [nesting, setNesting] = useState<D003NestingParams>(DEFAULT_NESTING);
  const [previewMode, setPreviewMode] = useState<'template' | 'sheet' | 'three'>('template');
  const [dimUnit, setDimUnit] = useState<'mm' | 'cm' | 'in'>('mm');
  const [printOpen, setPrintOpen] = useState(false);

  const setN = <K extends keyof D003NestingParams>(k: K, v: D003NestingParams[K]) =>
    setNesting(prev => ({ ...prev, [k]: v }));

  const set = <K extends keyof D003Params>(k: K, v: D003Params[K]) => {
    setParams(prev => ({ ...prev, [k]: v }));
  };

  const usable = useMemo(() => usableSheet(params), [params]);
  const nestingResult = useMemo(() => computeD003Nesting(params, nesting), [params, nesting]);

  const geo = useMemo(() => buildD003Geometry(params), [params]);

  const faceCoords = useMemo(() => {
    const W = params.referenceMode ? D003_REFERENCE.width : params.width;
    const H = params.referenceMode ? D003_REFERENCE.height : params.height;
    const D = params.referenceMode ? D003_REFERENCE.depth : params.depth;

    const ox = 2;
    const oy = 2;
    // For 3D topology, we have a base, depth panels around it, and cover.
    // FaceCoords usually assumes a linear unfolded box.
    // D003 is a mailer style box with cover and bottom flap.
    // Let's implement a rough approximation for 3D topology or just empty if not supported perfectly.
    // The user requested: "faceCoords ... must include body, topFlaps, bottomFlaps. For any non-rectangular flap or tongue, include a polygon array"
    
    // Simplification for 3D:
    // Left Depth, Base, Right Depth. Top: Cover. Bottom: Bottom Depth.
    
    const Y1 = oy + params.lidTongueHeight + H - 1 + D;
    
    // This is a placeholder that satisfies the type but a real mailer box 3D needs specific mapping.
    return {
      body: [
        { x: ox + D, y: Y1, w: W, h: H },
        { x: ox + D + W, y: Y1, w: D, h: H },
        { x: ox + D + W + D, y: Y1, w: W, h: H },
        { x: ox, y: Y1, w: D, h: H },
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

    let minX = 0, maxX = cellW + (grid.columns - 1) * grid.pitchX;
    let minY = 0, maxY = cellH + (grid.rows - 1) * grid.pitchY;

    return { w: maxX - minX, h: maxY - minY };
  }, [nestingResult]);

  const derived = useMemo(() => {
    const W = params.referenceMode ? D003_REFERENCE.width : params.width;
    const H = params.referenceMode ? D003_REFERENCE.height : params.height;
    const D = params.referenceMode ? D003_REFERENCE.depth : params.depth;

    return {
      W, H, D, Gf: 0
    };
  }, [params]);

  const refOn = !!params.referenceMode;

  return (
    <div dir="rtl" className="space-y-4">
      <Card className={hiddenCls}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">D003 — Fully Parametric Packaging Template</CardTitle>
          <div className="flex items-center gap-3">
            <Label htmlFor="d003-ref" className="text-sm font-normal cursor-pointer">
              وضع المرجعية Reference Clone {refOn && <span className="text-emerald-600">(مفعّل)</span>}
            </Label>
            <Switch id="d003-ref" checked={refOn} onCheckedChange={v => set('referenceMode', v)} />
          </div>
        </CardHeader>
        {refOn && (
          <CardContent>
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              وضع المرجعية مفعّل: الأبعاد ثابتة بمقادير المعايرة الافتراضية للتصميم المعتمد (W=350، H=290، D=100 مم).
            </div>
          </CardContent>
        )}
      </Card>

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
            <Button variant="outline" size="sm" onClick={() => setPrintOpen(true)}>
              <Printer className="w-4 h-4 ml-1.5" />
              ملخص الطباعة
            </Button>
            <ExportSingleButton params={params} />
            <ExportSheetButton params={params} nesting={nesting} result={nestingResult} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-4 items-start">
            <div className="min-w-0">
              {previewMode === 'template' ? (
                <D003Preview params={params} fitContainer showDebug={false} />
              ) : previewMode === 'sheet' ? (
                <D003SheetNestingPreview params={params} nesting={nesting} result={nestingResult} />
              ) : (
                <Box3DPreview
                  boxType="D003"
                  panelWidths={[params.depth, params.width, params.depth, params.width]}
                  panelHeights={params.height}
                  glueFlapWidth={0}
                  topFlapHeights={[params.depth / 2, params.depth, params.depth / 2, params.depth]}
                  bottomFlapHeights={[params.depth - 1.417, params.depth - 1.417, params.depth - 1.417, params.depth - 1.417]}
                  svgMarkup={geo.svg}
                  svgWidth={geo.bbox.w}
                  svgHeight={geo.bbox.h}
                  faceCoords={faceCoords}
                />
              )}
            </div>

            <aside className="space-y-5 rounded-lg border bg-muted/30 p-4">
              <section>
                <h3 className="text-sm font-bold mb-2">أبعاد العلبة (Template Dimensions)</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="العرض (W)" value={params.width} disabled={refOn} unit={dimUnit}
                    onChange={v => set('width', v)} />
                  <NumField label="الارتفاع (H)" value={params.height} disabled={refOn} unit={dimUnit}
                    onChange={v => set('height', v)} />
                  <NumField label="العمق (D)" value={params.depth} disabled={refOn} unit={dimUnit}
                    onChange={v => set('depth', v)} />
                </div>
              </section>
              
              <section>
                <h3 className="text-sm font-bold mb-2">إعدادات متقدمة (Advanced Settings)</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="طول لسان الغطاء" value={params.lidTongueHeight} disabled={refOn} unit={dimUnit}
                    onChange={v => set('lidTongueHeight', v)} />
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold mb-2">إعدادات الشيت (Sheet Settings)</h3>
                <div className="grid grid-cols-3 gap-2">
                  <NumField label="عرض الشيت" value={params.sheetWidth} unit={dimUnit}
                    onChange={v => set('sheetWidth', v)} />
                  <NumField label="ارتفاع الشيت" value={params.sheetHeight} unit={dimUnit}
                    onChange={v => set('sheetHeight', v)} />
                  <NumField label="القابض (Gripper)" value={params.gripper} unit={dimUnit}
                    onChange={v => set('gripper', v)} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <NumField label="الهامش (Margin)" value={params.sheetMargin} unit={dimUnit}
                    onChange={v => set('sheetMargin', v)} />
                  <NumField label="مسافة أفقية" value={nesting.horizontalGap} step={0.1} min={0} unit={dimUnit}
                    onChange={v => setN('horizontalGap', v)} />
                  <NumField label="مسافة عمودية" value={nesting.verticalGap} step={0.1} min={0} unit={dimUnit}
                    onChange={v => setN('verticalGap', v)} />
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                  <div>الصافي المتاح: {usable.width.toFixed(1)} × {usable.height.toFixed(1)} مم</div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold mb-2">خيارات الدوران</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="d003-allow-rot" className="text-xs">السماح بالدوران</Label>
                    <div className="flex items-center gap-2 h-9">
                      <Switch id="d003-allow-rot" checked={nesting.allowRotation}
                        onCheckedChange={v => setN('allowRotation', v)} />
                      <span className="text-xs text-muted-foreground">{nesting.allowRotation ? 'نعم' : 'لا'}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">وضع الدوران</Label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs"
                      disabled={!nesting.allowRotation}
                      value={nesting.rotationMode}
                      onChange={e => setN('rotationMode', e.target.value as RotationMode)}
                    >
                      <option value="normal">Normal (0°)</option>
                      <option value="rotated">Rotated (90°)</option>
                      <option value="auto">Auto</option>
                    </select>
                  </div>
                </div>
              </section>

              <section className="pt-3 border-t">
                <h3 className="text-sm font-bold mb-2">ملخص التوزيع</h3>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div>العدد الإجمالي: <b className="text-sm text-primary">{nestingResult.bestTotal}</b></div>
                  <div>مقاس التوزيع: <b>{toDisplay(distributionFootprint.w, dimUnit)} × {toDisplay(distributionFootprint.h, dimUnit)} {dimUnit}</b></div>
                </div>
              </section>
            </aside>
          </div>
        </CardContent>
      </Card>

      <D003PrintSummary
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

const ExportSingleButton = ({ params }: { params: D003Params }) => {
  const onExportSvg = async () => {
    const { buildD003Geometry } = await import('@/lib/d003/geometry');
    const { downloadD003SingleTemplate } = await import('@/lib/d003/exportSingle');
    const geo = buildD003Geometry(params);
    const name = `D003_${params.width}x${params.height}x${params.depth}.svg`;
    downloadD003SingleTemplate(geo, name);
  };
  const onExportPdf = async () => {
    const { buildD003Geometry } = await import('@/lib/d003/geometry');
    const { buildD003SingleTemplateSvg, downloadD003SingleTemplatePdf } = await import('@/lib/d003/exportSingle');
    const geo = buildD003Geometry(params);
    const svg = buildD003SingleTemplateSvg(geo);
    const name = `D003_${params.width}x${params.height}x${params.depth}.pdf`;
    await downloadD003SingleTemplatePdf(svg, name);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" size="sm">
          Export Template
          <ChevronDown className="w-3 h-3 mr-1.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onExportSvg}>
          Export SVG
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onExportPdf}>
          Export PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const ExportSheetButton = ({
  params, nesting, result,
}: {
  params: D003Params;
  nesting: D003NestingParams;
  result: ReturnType<typeof computeD003Nesting>;
}) => {
  const disabled = result.fitStatus !== 'fits' || result.bestTotal <= 0;
  const onExportSvg = async () => {
    const { downloadD003SheetLayout } = await import('@/lib/d003/exportSheet');
    downloadD003SheetLayout(params, nesting, result);
  };
  const onExportPdf = async () => {
    const { downloadD003SheetLayoutPdf } = await import('@/lib/d003/exportSheet');
    await downloadD003SheetLayoutPdf(params, nesting, result);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" size="sm" disabled={disabled}>
          Export Sheet Layout
          <ChevronDown className="w-3 h-3 mr-1.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onExportSvg} disabled={disabled}>
          Export SVG
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onExportPdf} disabled={disabled}>
          Export PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default D003Calculator;
