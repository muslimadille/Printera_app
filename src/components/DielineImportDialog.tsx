import { forwardRef, useRef, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileUp, AlertCircle, CheckCircle2, RefreshCw, FileText } from 'lucide-react';
import { parseDielineFile, type ParsedDieline } from '@/lib/dielineImport';
import { ringsToSvgPath } from '@/lib/dielineGeometry';
import { pdfFileToSvgFile } from '@/lib/pdfToSvg';

interface DielineImportDialogProps {
  onImported: (dieline: ParsedDieline) => void;
  triggerLabel?: string;
  compact?: boolean;
}

type Phase = 'idle' | 'converting' | 'reading' | 'analyzing' | 'extracting' | 'success' | 'error';

const PHASE_LABEL: Record<Phase, string> = {
  idle: '',
  converting: 'جاري تحويل PDF إلى SVG...',
  reading: 'جاري قراءة الملف...',
  analyzing: 'جاري تحليل القالب...',
  extracting: 'جاري استخراج خطوط القص والطي...',
  success: 'تم الاستيراد بنجاح',
  error: 'تعذر قراءة الملف',
};

const PHASE_PROGRESS: Record<Phase, number> = {
  idle: 0, converting: 15, reading: 35, analyzing: 60, extracting: 85, success: 100, error: 0,
};

const DielineImportDialog = ({ onImported, triggerLabel = 'استيراد قالب علبة', compact = false }: DielineImportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParsedDieline | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPhase('idle');
    setError(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (rawFile: File) => {
    reset();
    try {
      let file = rawFile;
      const isPdf = /\.pdf$/i.test(rawFile.name) || rawFile.type === 'application/pdf';
      if (isPdf) {
        setPhase('converting');
        await new Promise((r) => setTimeout(r, 50));
        const { file: svgFile } = await pdfFileToSvgFile(rawFile, { pageNumber: 1 });
        file = svgFile;
      }
      setPhase('reading');
      await new Promise((r) => setTimeout(r, 100));
      setPhase('analyzing');
      await new Promise((r) => setTimeout(r, 80));
      setPhase('extracting');
      const parsed = await parseDielineFile(file);
      setResult(parsed);
      setPhase('success');
    } catch (e: any) {
      setError(e?.message || 'تعذر قراءة الملف');
      setPhase('error');
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const apply = () => {
    if (!result) return;
    onImported(result);
    setOpen(false);
    setTimeout(reset, 300);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setTimeout(reset, 300); }}>
      <DialogTrigger asChild>
        <Button
          size={compact ? 'sm' : 'default'}
          variant="outline"
          className={compact ? 'h-7 text-xs gap-1' : 'gap-2'}
        >
          <FileUp className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="w-4 h-4 text-primary" />
            استيراد قالب علبة (Dieline)
          </DialogTitle>
          <DialogDescription>
            ارفع قالب العلبة بصيغة <strong>SVG</strong> أو <strong>PDF متجهي</strong> لاستخراج المقاسات وخطوط القص والطي بدقة 100%.
            <br />
            <span className="text-[11px] text-muted-foreground">
              ملفات PDF يتم تحويلها تلقائيًا إلى SVG (الصفحة الأولى) مع الحفاظ على المتجهات.
            </span>
          </DialogDescription>
        </DialogHeader>

        {phase === 'idle' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              dragOver ? 'border-primary bg-primary/10' : 'border-border bg-muted/20 hover:bg-muted/40'
            }`}
          >
            <Upload className="w-10 h-10 mx-auto text-primary mb-3" />
            <p className="text-sm font-semibold text-foreground">اسحب الملف هنا أو اضغط للاختيار</p>
            <p className="text-xs text-muted-foreground mt-1">الصيغ المدعومة: <strong>SVG</strong> أو <strong>PDF</strong> (متجهي)</p>
            <input
              ref={inputRef}
              type="file"
              accept=".svg,image/svg+xml,.pdf,application/pdf"
              className="hidden"
              onChange={onPick}
            />
          </div>
        )}

        {(phase === 'converting' || phase === 'reading' || phase === 'analyzing' || phase === 'extracting') && (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-sm text-primary">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{PHASE_LABEL[phase]}</span>
            </div>
            <Progress value={PHASE_PROGRESS[phase]} className="h-2" />
          </div>
        )}

        {phase === 'success' && result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-emerald-600 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              {PHASE_LABEL.success}
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-semibold truncate">{result.fileName}</span>
                <span className="text-muted-foreground uppercase">[{result.format}]</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Stat label="العرض" value={`${result.width.toFixed(2)} سم`} />
                <Stat label="الارتفاع" value={`${result.height.toFixed(2)} سم`} />
                <Stat label="عدد الخطوط" value={String(result.lines.length)} />
              </div>
              <DielinePreview parsed={result} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={reset}>
                <RefreshCw className="w-4 h-4 ml-1" />
                ملف آخر
              </Button>
              <Button className="flex-1" onClick={apply}>
                استخدام القالب في الشيت
              </Button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-destructive">{PHASE_LABEL.error}</p>
                {error && <p className="text-xs text-muted-foreground mt-1">{error}</p>}
              </div>
            </div>
            <Button className="w-full" onClick={reset}>
              <RefreshCw className="w-4 h-4 ml-1" />
              إعادة الرفع
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

/**
 * Renders a guaranteed-visible preview of the imported dieline.
 * Strategy: draw the parsed shape rings as a filled+stroked path so the user
 * always sees the silhouette, even when the original SVG uses fill="none"
 * with strokes that depend on lost CSS context.
 */
const DielinePreview = ({ parsed }: { parsed: ParsedDieline }) => {
  const pathD = useMemo(
    () => (parsed.shape ? ringsToSvgPath(parsed.shape.rings) : ''),
    [parsed.shape],
  );
  const w = parsed.shape?.width || parsed.width;
  const h = parsed.shape?.height || parsed.height;
  return (
    <div className="mx-auto w-full max-h-48 flex items-center justify-center bg-background rounded border border-border/60 p-2 overflow-hidden">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        className="max-h-44 w-auto"
        style={{ maxWidth: '100%' }}
      >
        {/* Original SVG underlay (decorative — may be invisible if styles missing) */}
        <g
          opacity={0.4}
          dangerouslySetInnerHTML={{
            __html: parsed.svgMarkup
              .replace(/^<svg[^>]*>/i, `<g transform="scale(${w / (parsed.shape?.width || w)} ${h / (parsed.shape?.height || h)})">`)
              .replace(/<\/svg>\s*$/i, '</g>'),
          }}
        />
        {/* Guaranteed silhouette from parsed geometry */}
        {pathD && (
          <path
            d={pathD}
            fill="hsl(var(--primary) / 0.12)"
            stroke="hsl(var(--primary))"
            strokeWidth={Math.max(0.04, Math.min(w, h) * 0.006)}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  );
};

const Stat = forwardRef<HTMLDivElement, { label: string; value: string }>(({ label, value }, ref) => (
  <div ref={ref} className="rounded bg-background border border-border/50 px-2 py-1 text-center">
    <p className="text-[9px] text-muted-foreground">{label}</p>
    <p className="text-xs font-bold">{value}</p>
  </div>
));
Stat.displayName = 'Stat';

export default DielineImportDialog;
