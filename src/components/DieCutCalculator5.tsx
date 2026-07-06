import { useMemo, useState } from 'react';
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
import { Box, Ruler, Maximize2, Settings2, ChevronDown, Layers, Download, FileCode2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import {
  computeDieCut5, buildDieline5Svg,
  DEFAULT_D5_INPUTS, D5_NATIVE,
  type DieCut5Inputs, type DieCut5Result,
} from '@/lib/diecut5Engine';
import { buildDieCut5ExportSvg, type DieCut5ExportMode } from '@/lib/diecut5Export';

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

const SheetPreview = ({
  result, svg,
}: { result: DieCut5Result; svg: string }) => {
  const PAD = 30;
  const longSide = result.longSide;
  const shortSide = result.shortSide;
  const vbW = longSide + PAD * 2;
  const vbH = shortSide + PAD * 2;
  const svgUri = useMemo(
    () => svg ? 'data:image/svg+xml;utf8,' + encodeURIComponent(svg) : '',
    [svg],
  );

  return (
    <div className="w-full bg-gradient-to-br from-muted/30 to-muted/10 rounded-xl border border-border/50 p-3 sm:p-4">
      <svg viewBox={`0 0 ${vbW} ${vbH}`} className="w-full h-auto" style={{ maxHeight: '70vh' }}>
        <rect x={PAD} y={PAD} width={longSide} height={shortSide}
          fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth={1.5} />
        {result.pieces.map(p => {
          const px = PAD + p.x;
          const py = PAD + p.y;
          const fw = p.footprintW;
          const fh = p.footprintH;
          const localW = p.rotated ? fh : fw;
          const localH = p.rotated ? fw : fh;
          const transform = p.rotated
            ? `translate(${px + fh} ${py}) rotate(90)`
            : `translate(${px} ${py})`;
          return (
            <g key={p.index} transform={transform}>
              <image href={svgUri} x={0} y={0} width={localW} height={localH}
                preserveAspectRatio="none" />
            </g>
          );
        })}
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
          مقاس التوزيع: {(result.best.layoutW / 10).toFixed(2)} × {(result.best.layoutH / 10).toFixed(2)} سم
        </Badge>
        <Badge variant="outline">استغلال: {(result.best.utilization * 100).toFixed(1)}٪</Badge>
      </div>
    </div>
  );
};

const DieCutCalculator5 = () => {
  const [inputs, setInputs] = useState<DieCut5Inputs>({ ...DEFAULT_D5_INPUTS });
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [zonesOpen, setZonesOpen] = useState(false);
  const [exportDialog, setExportDialog] = useState(false);
  const [exportMode, setExportMode] = useState<DieCut5ExportMode>('svg-only');
  const [filled, setFilled] = useState(true);

  const debInputs = useDebouncedValue(inputs, 250);
  const result = useMemo(() => computeDieCut5(debInputs), [debInputs]);
  const dielineSvg = useMemo(
    () => buildDieline5Svg(debInputs, { filled }),
    [debInputs, filled],
  );

  const setField = <K extends keyof DieCut5Inputs>(key: K, value: DieCut5Inputs[K]) =>
    setInputs(prev => ({ ...prev, [key]: value }));

  const best = result.best;
  const d = result.derived;

  const runExport = async () => {
    if (best.total === 0) {
      toast.error('لا توجد قطع للتصدير — راجع الأبعاد');
      return;
    }
    const svg = buildDieCut5ExportSvg({ mode: exportMode, inputs, result });
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diecut5_${best.total}pc_${stamp}.svg`;
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
                  Die Cut 5 — Parametric (Die Cut 2 Architecture)
                </h2>
                <p className="text-[11px] sm:text-xs text-muted-foreground">
                  Anchor-first · Procedural Pieces · Sacred Curves · One Builder
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setFilled(v => !v)}>
                {filled ? 'Outline' : 'Colored'}
              </Button>
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
              <SectionHeader title="أبعاد العلبة (L × D × H)" icon={Box} />
              <div className="grid grid-cols-3 gap-3">
                <NumField label="Length L (مم)" value={inputs.boxLength}
                  onChange={v => setField('boxLength', v)} />
                <NumField label="Depth D (مم)" value={inputs.boxDepth}
                  onChange={v => setField('boxDepth', v)} />
                <NumField label="Height H (مم)" value={inputs.boxHeight}
                  onChange={v => setField('boxHeight', v)} />
              </div>
              <p className="text-[10px] text-muted-foreground/70">
                المرجع: {D5_NATIVE.refL}×{D5_NATIVE.refD}×{D5_NATIVE.refH} مم — Glue ثابت {D5_NATIVE.glueWidthMm.toFixed(1)} مم
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-4">
              <Collapsible open={calibrationOpen} onOpenChange={setCalibrationOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-semibold">
                  <span className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-primary" /> Calibration / Pitch
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${calibrationOpen ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <NumField label="زيادة العرض (مم)" value={inputs.sideTrim}
                      onChange={v => setField('sideTrim', v)} step={0.5}
                      hint="Envelope-only — لا يغير القطع" />
                    <NumField label="زيادة الارتفاع (مم)" value={inputs.verticalTrim}
                      onChange={v => setField('verticalTrim', v)} step={0.5}
                      hint="Envelope-only — لا يغير القطع" />
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
                    <Layers className="w-4 h-4 text-primary" /> القيم المُشتقة (Blueprint)
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${zonesOpen ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-1 text-[11px] tabular-nums">
                  {([
                    ['Face Width (L)', d.L],
                    ['Depth 1 (D)', d.D],
                    ['Depth 2 (D − 0.5)', d.dCal],
                    ['Face Height (H)', d.H],
                    ['Handle Width (L − 1)', d.handleW],
                    ['Handle / Top Lid (D × 0.5)', d.handleH],
                    ['Bottom Flap (D × 0.70)', d.bottomFlapH],
                    ['Center Gap (D / 5)', d.centerGap],
                    ['Purple Tongue W (D − 1.5)', d.topDepthTongueW],
                    ['Purple Tongue H ((D×0.5)×1.086)', d.topDepthTongueH],
                    ['Lower Side Portion ((D/2)−0.5)', d.lowerSidePortion],
                  ] as const).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-medium">{v.toFixed(2)} مم</span>
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
                <SectionHeader title="معاينة التوزيع (Preview = Export)" icon={Maximize2} />
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default" className="text-sm">{best.total} قطعة</Badge>
                  <Badge variant="outline">{best.cols} × {best.rows}</Badge>
                  <Badge variant="outline">{best.orientation}</Badge>
                </div>
              </div>
              <SheetPreview result={result} svg={dielineSvg} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-muted/40">
                  <p className="text-muted-foreground">Footprint</p>
                  <p className="font-semibold tabular-nums">
                    {result.footprintW.toFixed(1)} × {result.footprintH.toFixed(1)}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-muted/40">
                  <p className="text-muted-foreground">Pitch</p>
                  <p className="font-semibold tabular-nums">
                    {result.pitchX.toFixed(2)} × {result.pitchY.toFixed(2)}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-muted/40">
                  <p className="text-muted-foreground">L × D × H</p>
                  <p className="font-semibold tabular-nums">
                    {d.L} × {d.D} × {d.H}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-muted/40">
                  <p className="text-muted-foreground">Bottom Flap</p>
                  <p className="font-semibold tabular-nums">
                    {d.bottomFlapH.toFixed(2)} مم
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
              SVG بالحجم الحقيقي (مم) — مطابق 100٪ للمعاينة (نفس Builder)، جاهز لـ Illustrator.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <button type="button" onClick={() => setExportMode('svg-only')}
              className={`w-full text-right p-3 rounded-lg border transition-colors ${exportMode === 'svg-only' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}>
              <div className="flex items-center gap-2 font-semibold text-sm">
                <FileCode2 className="w-4 h-4 text-primary" /> SVG نظيف فقط
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">هندسة فقط — بدون أي بيانات إضافية.</p>
            </button>
            <button type="button" onClick={() => setExportMode('svg-with-info')}
              className={`w-full text-right p-3 rounded-lg border transition-colors ${exportMode === 'svg-with-info' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}>
              <div className="flex items-center gap-2 font-semibold text-sm">
                <FileText className="w-4 h-4 text-primary" /> SVG + بيانات إنتاج
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">يضم Footprint, Pitch, Utilization كبيانات نصية مخفية.</p>
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialog(false)}>إلغاء</Button>
            <Button onClick={runExport} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> تصدير
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DieCutCalculator5;
