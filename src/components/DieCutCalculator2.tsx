import { useEffect, useMemo, useState } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Box, Ruler, Maximize2, Settings2, ChevronDown, Layers, Download, FileCode2, FileText, Upload, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  computeDieCutV2, buildDielineSvgV2,
  DEFAULT_V2_BASE_INPUTS,
  type DieCutV2Inputs, type DieCutV2Result, type V2StretchZones,
  type DieCutV2TemplateBox,
} from '@/lib/dieCutEngineV2';
import { buildDieCutV2Svg, type DieCutV2ExportMode } from '@/lib/dieCutExportV2';
import { usePreviewSettings } from '@/hooks/usePreviewSettings';

const SectionHeader = ({ title, icon: Icon }: { title: string; icon: any }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="p-2 rounded-lg bg-primary/10 text-primary"><Icon className="w-4 h-4" /></div>
    <h3 className="font-semibold text-foreground text-sm">{title}</h3>
  </div>
);

const NumField = ({
  label, hint, value, onChange, step = 1, min = 0,
}: {
  label: string; hint?: string; value: number;
  onChange: (n: number) => void; step?: number; min?: number;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <Input
      type="number" inputMode="decimal" step={step} min={min}
      value={Number.isFinite(value) ? value : 0}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      onFocus={e => e.target.select()}
      className="h-9 text-sm font-medium tabular-nums"
    />
    {hint && <p className="text-[10px] text-muted-foreground/70">{hint}</p>}
  </div>
);

/* ── Sheet preview ── */
const SheetPreview = ({
  result, svg, bbox,
}: { result: DieCutV2Result; svg: string; bbox: DieCutV2TemplateBox }) => {
  const PAD = 30;
  const longSide = result.longSide;
  const shortSide = result.shortSide;
  const vbW = longSide + PAD * 2;
  const vbH = shortSide + PAD * 2;

  const svgUri = useMemo(() => svg ? 'data:image/svg+xml;utf8,' + encodeURIComponent(svg) : '', [svg]);
  const best = result.best;

  const renderPiece = (p: DieCutV2Result['pieces'][number]) => {
    const px = PAD + p.x;
    const py = PAD + p.y;
    const fw = p.footprintW;
    const fh = p.footprintH;
    const pieceTransform = p.rotated
      ? `translate(${px + fh} ${py}) rotate(90)`
      : `translate(${px} ${py})`;

    // SINGLE-GEOMETRY RULE: one <image> per piece, scaled 1:1 from the
    // dieline SVG whose viewBox already equals the current footprint.
    // When the piece is rotated 90° on the sheet, the dieline must still be
    // drawn in its NATIVE orientation (footprintW × footprintH from the engine
    // refer to the on-sheet box AFTER rotation). The outer rotate(90) then
    // maps the native box onto the on-sheet rect. So local dims must be the
    // un-rotated footprint = (fh × fw) when rotated, else (fw × fh).
    const localW = p.rotated ? fh : fw;
    const localH = p.rotated ? fw : fh;
    const canDraw =
      svgUri && bbox.drawWmm > 0 && bbox.drawHmm > 0;
    let imgX = 0, imgY = 0, imgW = 0, imgH = 0;
    if (canDraw) {
      const sx = localW / bbox.drawWmm;
      const sy = localH / bbox.drawHmm;
      imgW = bbox.viewBoxWmm * sx;
      imgH = bbox.viewBoxHmm * sy;
      imgX = -bbox.drawOriginXmm * sx;
      imgY = -bbox.drawOriginYmm * sy;
    }

    return (
      <g key={p.index}>
        {canDraw ? (
          <g transform={pieceTransform}>
            <svg x={0} y={0} width={localW} height={localH}
              viewBox={`0 0 ${localW} ${localH}`} overflow="visible">
              <image href={svgUri}
                x={imgX} y={imgY} width={imgW} height={imgH}
                preserveAspectRatio="xMidYMid meet" opacity={0.95} />
            </svg>
          </g>
        ) : (
          <rect x={px} y={py} width={fw} height={fh}
            fill="none"
            stroke="hsl(var(--primary))" strokeWidth={0.4} />
        )}
      </g>
    );
  };

  return (
    <div className="w-full bg-gradient-to-br from-muted/30 to-muted/10 rounded-xl border border-border/50 p-3 sm:p-4">
      <svg viewBox={`0 0 ${vbW} ${vbH}`} className="w-full h-auto" style={{ maxHeight: '70vh' }}>
        <rect x={PAD} y={PAD} width={longSide} height={shortSide}
          fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth={1.5} />
        {/* nesting/layout helper overlay removed — preview shows only sheet bounds + dielines */}
        {result.pieces.map(renderPiece)}
        <text x={PAD + longSide / 2} y={PAD - 8}
          textAnchor="middle" fontSize={14} fill="hsl(var(--muted-foreground))">
          {longSide.toFixed(0)} mm
        </text>
        <text x={PAD - 8} y={PAD + shortSide / 2}
          textAnchor="middle" fontSize={14} fill="hsl(var(--muted-foreground))"
          transform={`rotate(-90 ${PAD - 8} ${PAD + shortSide / 2})`}>
          {shortSide.toFixed(0)} mm
        </text>
      </svg>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
        <Badge variant="outline" className="gap-1">
          <Maximize2 className="w-3 h-3" />
          مقاس التوزيع: {(best.layoutW / 10).toFixed(2)} × {(best.layoutH / 10).toFixed(2)} سم
        </Badge>
        <Badge variant="outline">
          المتبقي: {best.remainingW.toFixed(1)} × {best.remainingH.toFixed(1)} مم
        </Badge>
        <Badge variant="outline">استغلال: {(best.utilization * 100).toFixed(1)}٪</Badge>
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────── */
const DieCutCalculator2 = () => {
  const { showNestingPreview, show3DPreview } = usePreviewSettings();

  const [pieceSvg, setPieceSvg] = useState<string>('');
  const [attachedFileName, setAttachedFileName] = useState<string>('');
  const [inputs, setInputs] = useState<DieCutV2Inputs>({ ...DEFAULT_V2_BASE_INPUTS });
  const [baseInputs] = useState<DieCutV2Inputs>({ ...DEFAULT_V2_BASE_INPUTS });
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [zonesOpen, setZonesOpen] = useState(false);
  const [exportDialog, setExportDialog] = useState(false);
  const [exportMode, setExportMode] = useState<DieCutV2ExportMode>('svg-only');

  // Debounce heavy compute + dieline rebuild so rapid typing doesn't
  // freeze the UI. Field state updates instantly; recompute waits 250ms
  // after the last keystroke (latest-input-wins via cleanup).
  const debInputs = useDebouncedValue(inputs, 250);
  const debBaseInputs = useDebouncedValue(baseInputs, 250);
  const result = useMemo(() => computeDieCutV2(debInputs, debBaseInputs), [debInputs, debBaseInputs]);
  const zones = result.geometry.zones;
  const bbox = result.geometry.templateBbox;

  const loadDefaultSvg = () => {
    setAttachedFileName('');
    setPieceSvg(buildDielineSvgV2(debInputs));
  };

  // Auto-regenerate procedural dieline whenever debounced inputs change
  // (unless user attached a custom file).
  useEffect(() => {
    if (!attachedFileName) setPieceSvg(buildDielineSvgV2(debInputs));
  }, [debInputs, attachedFileName]);

  const handleAttachFile = async (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.svg')) {
      toast.error('يجب إرفاق ملف SVG فقط');
      return;
    }
    try {
      const text = await file.text();
      if (!text.includes('<svg')) {
        toast.error('الملف ليس SVG صالحاً');
        return;
      }
      setPieceSvg(text);
      setAttachedFileName(file.name);
      toast.success(`تم إرفاق: ${file.name}`);
    } catch {
      toast.error('فشل قراءة الملف');
    }
  };

  const setField = <K extends keyof DieCutV2Inputs>(key: K, value: DieCutV2Inputs[K]) =>
    setInputs(prev => ({ ...prev, [key]: value }));

  const best = result.best;

  const runExport = () => {
    if (result.best.total === 0) {
      toast.error('لا توجد قطع للتصدير — راجع الأبعاد');
      return;
    }
    const svg = buildDieCutV2Svg({
      mode: exportMode, inputs, result, pieceSvg, templateName: 'Die Cut 2',
    });
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diecut2_${result.best.total}pc_${stamp}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportDialog(false);
    toast.success('تم تصدير ملف الإنتاج');
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="border-primary/20 bg-gradient-to-br from-card via-card to-primary/5">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/15 text-primary">
                <Box className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-foreground">
                  Die Cut 2 — قالب Parametric مستقل
                </h2>
                <p className="text-[11px] sm:text-xs text-muted-foreground">
                  Template Zones · Side Flap Rule · Dynamic Vertical Interlock
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="diecut2-svg-upload"
                type="file"
                accept=".svg,image/svg+xml"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleAttachFile(f);
                  e.target.value = '';
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => document.getElementById('diecut2-svg-upload')?.click()}
                className="gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                إرفاق ملف SVG
              </Button>
              {attachedFileName && (
                <>
                  <Badge variant="secondary" className="max-w-[200px] truncate">
                    {attachedFileName}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={loadDefaultSvg}
                    className="gap-1.5"
                    title="استعادة القالب الافتراضي"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
              <Button size="sm" onClick={() => setExportDialog(true)} className="gap-1.5">
                <Download className="w-3.5 h-3.5" />
                تصدير للإنتاج
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <SectionHeader title="مقاس الشيت" icon={Ruler} />
              <div className="grid grid-cols-2 gap-3">
                <NumField label="عرض الشيت (مم)" value={inputs.sheetWidth}
                  onChange={v => setField('sheetWidth', v)} />
                <NumField label="ارتفاع الشيت (مم)" value={inputs.sheetHeight}
                  onChange={v => setField('sheetHeight', v)} />
                <NumField label="الفاصل بين القطع (مم)" value={inputs.gap}
                  onChange={v => setField('gap', v)} step={0.5} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-4">
              <SectionHeader title="أبعاد العلبة" icon={Box} />
              <div className="grid grid-cols-3 gap-3">
                <NumField label="Length L (مم)" value={inputs.boxLength}
                  onChange={v => setField('boxLength', v)} />
                <NumField label="Height H (مم)" value={inputs.boxHeight}
                  onChange={v => setField('boxHeight', v)} />
                <NumField label="Depth D (مم)" value={inputs.boxDepth}
                  onChange={v => setField('boxDepth', v)} />
              </div>
              <p className="text-[10px] text-muted-foreground/70">
                المرجع: {baseInputs.boxLength}×{baseInputs.boxHeight}×{baseInputs.boxDepth} مم
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <Collapsible open={calibrationOpen} onOpenChange={setCalibrationOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-semibold">
                  <span className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-primary" /> Calibration
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${calibrationOpen ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <NumField label="زيادة العرض (مم)" value={inputs.sideTrim}
                      onChange={v => setField('sideTrim', v)} step={0.5}
                      hint="تعديل يدوي على عرض الـ Footprint" />
                    <NumField label="زيادة الارتفاع (مم)" value={inputs.verticalTrim}
                      onChange={v => setField('verticalTrim', v)} step={0.5}
                      hint="تعديل يدوي على ارتفاع الـ Footprint" />
                    <NumField label="Vertical Interlock (مم)" value={inputs.verticalInterlock}
                      onChange={v => setField('verticalInterlock', v)} step={0.5}
                      hint="يدوي فقط — لا يوجد اشتقاق تلقائي من Depth" />
                    <NumField label="Horizontal Interlock (مم)" value={inputs.horizontalInterlock}
                      onChange={v => setField('horizontalInterlock', v)} step={0.5}
                      hint="يدوي فقط — لا يوجد اشتقاق تلقائي من Depth" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                    <NumField label="Pitch X يدوي (0=تلقائي)"
                      value={inputs.manualPitchX ?? 0}
                      onChange={v => setField('manualPitchX', v || null)} step={0.5} />
                    <NumField label="Pitch Y يدوي (0=تلقائي)"
                      value={inputs.manualPitchY ?? 0}
                      onChange={v => setField('manualPitchY', v || null)} step={0.5} />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <Collapsible open={zonesOpen} onOpenChange={setZonesOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-semibold">
                  <span className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" /> Stretch Zones
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${zonesOpen ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-3 text-[11px]">
                  {(['horizontal', 'vertical'] as const).map(axis => (
                    <div key={axis}>
                      <p className="font-semibold mb-1 text-muted-foreground">
                        {axis === 'horizontal' ? 'أفقي' : 'عمودي'}
                      </p>
                      <div className="space-y-1">
                        {zones[axis].map(z => (
                          <div key={z.key} className="flex justify-between gap-2 tabular-nums">
                            <span className="truncate">{z.label}</span>
                            <span className="text-muted-foreground">
                              {z.base.toFixed(1)} → <span className="text-foreground font-medium">{z.current.toFixed(1)}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {showNestingPreview && <SectionHeader title="معاينة التوزيع" icon={Maximize2} />}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default" className="text-sm">
                    {best.total} قطعة
                  </Badge>
                  <Badge variant="outline">
                    {best.cols} × {best.rows}
                  </Badge>
                  <Badge variant="outline">{best.orientation}</Badge>
                </div>
              </div>
              {showNestingPreview && <SheetPreview result={result} svg={pieceSvg} bbox={bbox} />}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-muted/40">
                  <p className="text-muted-foreground">Footprint</p>
                  <p className="font-semibold tabular-nums">
                    {result.footprintW.toFixed(1)} × {result.footprintH.toFixed(1)}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-muted/40">
                  <p className="text-muted-foreground">Pitch تلقائي</p>
                  <p className="font-semibold tabular-nums">
                    {result.autoPitchX.toFixed(2)} × {result.autoPitchY.toFixed(2)}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-muted/40">
                  <p className="text-muted-foreground">Vertical Interlock</p>
                  <p className="font-semibold tabular-nums">
                    {inputs.verticalInterlock.toFixed(2)} مم
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-muted/40">
                  <p className="text-muted-foreground">Horizontal Interlock</p>
                  <p className="font-semibold tabular-nums">
                    {inputs.horizontalInterlock.toFixed(2)} مم
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={exportDialog} onOpenChange={setExportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-4 h-4" /> تصدير ملف الإنتاج
            </DialogTitle>
            <DialogDescription className="text-xs">
              يتم تصدير الشيت بالحجم الحقيقي (مم) — مطابق 100٪ للمعاينة، جاهز لـ Illustrator.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <button type="button" onClick={() => setExportMode('svg-only')}
              className={`w-full text-right p-3 rounded-lg border transition-colors ${exportMode === 'svg-only' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}>
              <div className="flex items-center gap-2 font-semibold text-sm">
                <FileCode2 className="w-4 h-4 text-primary" /> SVG نظيف فقط
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                هندسة فقط — بدون أي بيانات إضافية.
              </p>
            </button>
            <button type="button" onClick={() => setExportMode('svg-with-info')}
              className={`w-full text-right p-3 rounded-lg border transition-colors ${exportMode === 'svg-with-info' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}>
              <div className="flex items-center gap-2 font-semibold text-sm">
                <FileText className="w-4 h-4 text-primary" /> SVG + بيانات الإنتاج
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                يضيف طبقة "Production Info" مخفية + Metadata.
              </p>
            </button>
          </div>
          <DialogFooter className="gap-2">
            <Button onClick={runExport} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> تصدير
            </Button>
            <Button variant="outline" onClick={() => setExportDialog(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DieCutCalculator2;
