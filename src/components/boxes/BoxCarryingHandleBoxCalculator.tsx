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
import { Box, Ruler, Maximize2, Layers, Download, Eye, FileCode2, FileText, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  computeCarry, buildCarryDielineSvg, auditCarryMapping, DEFAULT_CARRY_INPUTS,
  type CarryHandleInputs, type CarryResult,
} from '@/lib/carryingHandleBoxEngine';
import { buildCarryExportSvg, type CarryExportMode } from '@/lib/carryingHandleBoxExport';
import { buildCarryAsPdf } from '@/lib/carryingHandleBoxPdfExport';
import { downloadPdf, previewPdf } from '@/lib/pdf/pdfService';

type CarryExportFormat = 'svg' | 'pdf';
import CarryingHandleBoxMappingDialog from '../CarryingHandleBoxMappingDialog';
import CarryingHandleBoxDebugDialog from '../CarryingHandleBoxDebugDialog';

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
      className="h-9 text-sm font-medium tabular-nums"
    />
    {hint && <p className="text-[10px] text-muted-foreground/70">{hint}</p>}
  </div>
);

const SheetPreview = ({
  result, svg, sheetW, sheetH,
}: { result: CarryResult; svg: string; sheetW: number; sheetH: number }) => {
  const PAD = 30;
  const flip = result.best.flipSheet;
  const rW = flip ? sheetH : sheetW;
  const rH = flip ? sheetW : sheetH;
  const vbW = rW + PAD * 2;
  const vbH = rH + PAD * 2;
  const svgUri = useMemo(
    () => svg ? 'data:image/svg+xml;utf8,' + encodeURIComponent(svg) : '',
    [svg],
  );
  const fw = result.footprintW;
  const fh = result.footprintH;

  return (
    <div className="w-full bg-gradient-to-br from-muted/30 to-muted/10 rounded-xl border border-border/50 p-3 sm:p-4">
      <svg viewBox={`0 0 ${vbW} ${vbH}`} className="w-full h-auto" style={{ maxHeight: '70vh' }}>
        <rect x={PAD} y={PAD} width={rW} height={rH}
          fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth={1.5} />
        {result.pieces.map(p => {
          const px = PAD + p.x;
          const py = PAD + p.y;
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
        <text x={PAD + rW / 2} y={PAD - 8}
          textAnchor="middle" fontSize={14} fill="hsl(var(--muted-foreground))">
          {rW.toFixed(0)} mm
        </text>
        <text x={PAD - 8} y={PAD + rH / 2}
          textAnchor="middle" fontSize={14} fill="hsl(var(--muted-foreground))"
          transform={`rotate(-90 ${PAD - 8} ${PAD + rH / 2})`}>
          {rH.toFixed(0)} mm
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

const CarryingHandleBoxCalculator = () => {
  const [inputs, setInputs] = useState<CarryHandleInputs>({ ...DEFAULT_CARRY_INPUTS });
  const [zonesOpen, setZonesOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [exportDialog, setExportDialog] = useState(false);
  const [exportMode, setExportMode] = useState<CarryExportMode>('svg-only');
  const [exportFormat, setExportFormat] = useState<CarryExportFormat>('svg');
  const [filled, setFilled] = useState(false);

  const debInputs = useDebouncedValue(inputs, 250);
  const result = useMemo(() => computeCarry(debInputs), [debInputs]);
  const audit = useMemo(() => auditCarryMapping(debInputs), [debInputs]);
  const dieline = useMemo(
    () => buildCarryDielineSvg(debInputs, { filled }),
    [debInputs, filled],
  );

  const setField = <K extends keyof CarryHandleInputs>(key: K, value: CarryHandleInputs[K]) =>
    setInputs(prev => ({ ...prev, [key]: value }));

  const d = result.derived;
  const best = result.best;

  const runExport = async (pdfAction: 'download' | 'preview' = 'download') => {
    if (best.total === 0) {
      toast.error('لا توجد قطع للتصدير — راجع الأبعاد');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const baseName = `carrying_handle_${best.total}pc_${stamp}`;

    if (exportFormat === 'pdf') {
      try {
        const pdf = await buildCarryAsPdf({ mode: exportMode, inputs, result });
        if (pdfAction === 'preview') await previewPdf(pdf, `${baseName}.pdf`);
        else downloadPdf(pdf, `${baseName}.pdf`);
        setExportDialog(false);
        toast.success(pdfAction === 'preview' ? 'تمت معاينة ملف PDF' : 'تم تصدير ملف PDF');
      } catch (e) {
        console.error('PDF export failed', e);
        toast.error('فشل تصدير PDF — ' + (e instanceof Error ? e.message : String(e)));
      }
      return;
    }

    // SVG path — unchanged.
    const svg = buildCarryExportSvg({ mode: exportMode, inputs, result });
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}.svg`;
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
                  Carrying Handle Box — Parametric
                </h2>
                <p className="text-[11px] sm:text-xs text-muted-foreground">
                  Excel-driven geometry · Auto sheet orientation · Preview = Export
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CarryingHandleBoxMappingDialog />
              <CarryingHandleBoxDebugDialog inputs={inputs} />
              <Button size="sm" variant="outline" onClick={() => setFilled(v => !v)}
                title={filled ? 'تحويل إلى Production Dieline' : 'تحويل إلى Debug Components'}>
                {filled ? 'Production Dieline' : 'Debug Components'}
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
                <NumField label="Length L (مم)" value={inputs.length}
                  onChange={v => setField('length', v)} />
                <NumField label="Depth D (مم)" value={inputs.depth}
                  onChange={v => setField('depth', v)} />
                <NumField label="Height H (مم)" value={inputs.height}
                  onChange={v => setField('height', v)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumField
                  label="مقاس لسان اللصق (مم) — 0 = تلقائي"
                  hint={`تلقائي عند Depth>=100 → 30 ، وإلا 25 (الحالي: ${d.glueFlapAuto})`}
                  value={inputs.glueFlapManual ?? 0}
                  onChange={v => setField('glueFlapManual', v || null)}
                  step={0.5}
                />
                <div className="text-[11px] text-muted-foreground self-end">
                  المعتمد حالياً: <span className="font-semibold text-foreground">{d.glueFlap.toFixed(1)} مم</span>
                </div>
              </div>
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
                    ['Length (L)', d.L],
                    ['Depth (D)', d.D],
                    ['Height (H)', d.H],
                    ['Glue Flap', d.glueFlap],
                    ['Cover Lower (D/2)', d.coverLower],
                    ['Cover Upper (min(D/2,80))', d.coverUpper],
                    ['Cover Total', d.coverTotal],
                    ['Upper Depth Flap', d.upperDepthFlap],
                    ['Front Bottom Flap (D/2+30)', d.frontBottomFlap],
                    ['Lower Depth Flap (D×0.7)', d.lowerDepthFlap],
                    ['Bottom Void H (D/5)', d.bottomVoidH],
                    ['Bottom Void W (L-(D-1))', d.bottomVoidW],
                    ['Footprint W', result.footprintW],
                    ['Footprint H', result.footprintH],
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
                  <Badge variant="outline">{best.rotated ? '90°' : '0°'}</Badge>
                  {best.flipSheet && <Badge variant="outline">Sheet swap</Badge>}
                </div>
              </div>
              <SheetPreview
                result={result}
                svg={dieline}
                sheetW={inputs.sheetWidth}
                sheetH={inputs.sheetHeight}
              />
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
                  <p className="text-muted-foreground">Glue Flap</p>
                  <p className="font-semibold tabular-nums">
                    {d.glueFlap.toFixed(1)} مم
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4">
          <Collapsible open={auditOpen} onOpenChange={setAuditOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-semibold">
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> Mapping Audit (Debug)
                <Badge variant={audit.allPass ? 'default' : 'destructive'} className="text-[10px]">
                  {audit.allPass ? 'ALL PASS' : 'FAIL'}
                </Badge>
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${auditOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2 text-[10px]" dir="ltr">
                <Badge variant="outline" className="tabular-nums">
                  X: {[audit.xBoundaries.x0, audit.xBoundaries.x1, audit.xBoundaries.x2, audit.xBoundaries.x3, audit.xBoundaries.x4, audit.xBoundaries.x5].map(v => v.toFixed(1)).join(' → ')}
                </Badge>
                <Badge variant="outline" className="tabular-nums">
                  Y: {[audit.yBoundaries.y0, audit.yBoundaries.y1, audit.yBoundaries.y2, audit.yBoundaries.y3].map(v => v.toFixed(1)).join(' → ')}
                </Badge>
                <Badge variant={audit.xIndependentOfHeight ? 'outline' : 'destructive'}>
                  Height→X leak: {audit.xIndependentOfHeight ? 'NONE ✓' : 'DETECTED ✗'}
                </Badge>
                <Badge variant={audit.yIndependentOfLength ? 'outline' : 'destructive'}>
                  Length→Y leak: {audit.yIndependentOfLength ? 'NONE ✓' : 'DETECTED ✗'}
                </Badge>
                <Badge variant="outline" className="tabular-nums">
                  Footprint: {audit.footprintW.toFixed(1)} × {audit.footprintH.toFixed(1)}
                </Badge>
                <Badge variant="outline" className="tabular-nums">
                  Pitch: {result.pitchX.toFixed(2)} × {result.pitchY.toFixed(2)}
                </Badge>
              </div>
              <div className="overflow-x-auto" dir="ltr">
                <table className="w-full text-[10px] tabular-nums border-collapse">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      {['Component', 'Axis', 'Linked Dim', 'Base Start', 'Base End', 'Base Size',
                        'Cur Start', 'Cur End', 'Cur Size', 'Expected', 'Formula', 'Behavior',
                        'Depends On', 'Fixed', 'Mirrored', 'Moved', 'Resized', 'Pass'].map(h => (
                        <th key={h} className="px-1.5 py-1 text-left whitespace-nowrap font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {audit.rows.map(r => (
                      <tr key={r.component} className={`border-b border-border/40 ${r.pass ? '' : 'bg-destructive/10'}`}>
                        <td className="px-1.5 py-1 whitespace-nowrap font-medium">{r.component}</td>
                        <td className="px-1.5 py-1">{r.axis}</td>
                        <td className="px-1.5 py-1 whitespace-nowrap">{r.linkedDimension}</td>
                        <td className="px-1.5 py-1">{r.baseStart.toFixed(1)}</td>
                        <td className="px-1.5 py-1">{r.baseEnd.toFixed(1)}</td>
                        <td className="px-1.5 py-1">{r.baseSize.toFixed(1)}</td>
                        <td className="px-1.5 py-1">{r.currentStart.toFixed(1)}</td>
                        <td className="px-1.5 py-1">{r.currentEnd.toFixed(1)}</td>
                        <td className="px-1.5 py-1 font-semibold">{r.currentSize.toFixed(1)}</td>
                        <td className="px-1.5 py-1 font-semibold">{r.expectedSize.toFixed(1)}</td>
                        <td className="px-1.5 py-1 whitespace-nowrap text-muted-foreground">{r.formula}</td>
                        <td className="px-1.5 py-1">{r.behavior}</td>
                        <td className="px-1.5 py-1 whitespace-nowrap">{r.dependsOn}</td>
                        <td className="px-1.5 py-1">{r.isFixed ? 'Yes' : 'No'}</td>
                        <td className="px-1.5 py-1">{r.isMirrored ? 'Yes' : 'No'}</td>
                        <td className="px-1.5 py-1">{r.isMoved ? 'Yes' : 'No'}</td>
                        <td className="px-1.5 py-1">{r.isResized ? 'Yes' : 'No'}</td>
                        <td className={`px-1.5 py-1 font-bold ${r.pass ? 'text-green-600' : 'text-destructive'}`}>
                          {r.pass ? 'PASS' : 'FAIL'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>


      <Dialog open={exportDialog} onOpenChange={setExportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-4 h-4" /> تصدير ملف الإنتاج
            </DialogTitle>
            <DialogDescription className="text-xs">
              SVG بالحجم الحقيقي (مم) — مطابق 100٪ للمعاينة، جاهز لـ Illustrator / Acrobat / CorelDRAW.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">صيغة الملف</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setExportFormat('svg')}
                  className={`p-2.5 rounded-lg border text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${exportFormat === 'svg' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted/40'}`}>
                  <FileCode2 className="w-4 h-4" /> SVG
                </button>
                <button type="button" onClick={() => setExportFormat('pdf')}
                  className={`p-2.5 rounded-lg border text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${exportFormat === 'pdf' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted/40'}`}>
                  <FileText className="w-4 h-4" /> PDF
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                PDF يستخدم نفس هندسة SVG النهائية (Vector، mm، نفس الطبقات).
              </p>
            </div>
            <div className="space-y-2">
              <button type="button" onClick={() => setExportMode('svg-only')}
                className={`w-full text-right p-3 rounded-lg border transition-colors ${exportMode === 'svg-only' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}>
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <FileCode2 className="w-4 h-4 text-primary" /> نظيف فقط
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">هندسة فقط — بدون بيانات إضافية.</p>
              </button>
              <button type="button" onClick={() => setExportMode('svg-with-info')}
                className={`w-full text-right p-3 rounded-lg border transition-colors ${exportMode === 'svg-with-info' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}>
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <FileText className="w-4 h-4 text-primary" /> + بيانات إنتاج
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">يضيف Footprint, Pitch, Utilization كنص.</p>
              </button>
            </div>
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setExportDialog(false)}>إلغاء</Button>
            {exportFormat === 'pdf' && (
              <Button variant="secondary" onClick={() => void runExport('preview')} className="gap-1.5">
                <Eye className="w-3.5 h-3.5" /> معاينة PDF
              </Button>
            )}
            <Button onClick={() => void runExport('download')} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> {exportFormat === 'pdf' ? 'تحميل PDF' : 'تصدير'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CarryingHandleBoxCalculator;
