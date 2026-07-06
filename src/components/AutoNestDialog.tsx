/**
 * AutoNestDialog — side-by-side preview of "current" vs "auto-nested" layouts.
 * Spawns the worker on open, shows live progress, lets the user apply,
 * cancel, or re-run.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, RefreshCw, CheckCircle2, X, Trophy } from 'lucide-react';
import type { LayoutPiece } from '@/lib/sheetLayoutOptimizer';
import type { ParsedDieline } from '@/lib/dielineImport';
import type { AutoNestResult, AutoNestProgress, AutoNestScenario } from '@/lib/autoNestEngine';
import type { AutoNestV2DebugSummary, AutoNestV2RejectReason, AutoNestV2StageDiagnostics } from '@/lib/autoNestEngineV2';
import {
  translateRings,
  rotateRings90,
  polygonToSvgPath,
  type DielineShape,
} from '@/lib/dielineGeometry';
import { computeContactOverlay } from '@/lib/contactOverlay';
import { computeNegativeSpaceOverlay } from '@/lib/negativeSpaceOverlay';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheetW: number;
  sheetH: number;
  gap: number;
  currentPieces: LayoutPiece[];
  dieline: ParsedDieline | null;
  onApply: (pieces: LayoutPiece[]) => void;
  /** Which auto-nest engine worker to use. 'advanced' = V2 (4-rotation + Skyline BLF). */
  workerVariant?: 'basic' | 'advanced';
}

const AutoNestDialog = ({
  open,
  onOpenChange,
  sheetW,
  sheetH,
  gap,
  currentPieces,
  dieline,
  onApply,
  workerVariant = 'basic',
}: Props) => {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<AutoNestProgress | null>(null);
  const [result, setResult] = useState<AutoNestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const [manualRef, setManualRef] = useState<string | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState(0.55);
  const [overlayMode, setOverlayMode] = useState<'side' | 'overlay'>('overlay');
  const [showContacts, setShowContacts] = useState(true);
  const [showPockets, setShowPockets] = useState(true);
  const [showAnchors, setShowAnchors] = useState(true);

  const handleUploadManual = (file: File | null) => {
    if (!file) { setManualRef(null); return; }
    const reader = new FileReader();
    reader.onload = () => setManualRef(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const startRun = () => {
    if (!dieline?.shape) {
      setError('يلزم استيراد قالب dieline أولاً');
      return;
    }
    setError(null);
    setResult(null);
    setProgress(null);
    setRunning(true);

    // Tear down any previous worker
    workerRef.current?.terminate();
    const worker =
      workerVariant === 'advanced'
        ? new Worker(new URL('../workers/autoNest.worker.v2.ts', import.meta.url), { type: 'module' })
        : new Worker(new URL('../workers/autoNest.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        setProgress(msg.payload as AutoNestProgress);
      } else if (msg.type === 'done') {
        setResult(msg.payload as AutoNestResult);
        setRunning(false);
        worker.terminate();
        workerRef.current = null;
      } else if (msg.type === 'error') {
        setError(msg.message ?? 'تعذر إكمال التعشيق');
        setRunning(false);
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.postMessage({
      type: 'run',
      shape: dieline.shape,
      sheetW,
      sheetH,
      gap,
      footprintW: dieline.width,
      footprintH: dieline.height,
    });
  };

  // Auto-start on open; clean up on close.
  useEffect(() => {
    if (open) {
      startRun();
    } else {
      workerRef.current?.terminate();
      workerRef.current = null;
      setRunning(false);
      setProgress(null);
      setResult(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const currentUsage = (() => {
    const sheetArea = sheetW * sheetH;
    if (sheetArea <= 0) return 0;
    const used = currentPieces.reduce((s, p) => s + p.w * p.h, 0);
    return (used / sheetArea) * 100;
  })();

  const best = result?.best ?? null;
  const improvement = best ? best.count - currentPieces.length : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {workerVariant === 'advanced'
              ? 'معاينة التعشيق الذكي المتقدم (4 اتجاهات + Skyline BLF)'
              : 'معاينة التعشيق التلقائي الذكي'}
          </DialogTitle>
          <DialogDescription>
            {workerVariant === 'advanced'
              ? 'محرك مطوّر: يدوّر كل نسخة من القالب باستقلالية بين 0°/90°/180°/270° ويستغل الفراغات بأسلوب Skyline Bottom-Left-Fill.'
              : 'مقارنة بين توزيعك الحالي وأفضل توزيع يقترحه المحرك (NFP + تدوير متعدد).'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {running && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <div className="text-sm font-semibold">جاري البحث عن أفضل توزيع…</div>
            {progress && (
              <div className="w-full max-w-xs space-y-1">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>سيناريو {progress.scenarioIndex} / {progress.totalScenarios}</span>
                  <span>الأفضل حالياً: {progress.currentBestCount} قطعة</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded">
                  <div
                    className="h-1.5 bg-primary rounded transition-all"
                    style={{
                      width: `${(progress.scenarioIndex / progress.totalScenarios) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {!running && result && (
          <div className="space-y-4">
            {/* Manual reference comparison controls */}
            <div className="rounded-md border border-amber-300/40 bg-amber-50/40 dark:bg-amber-950/20 p-2.5 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  📐 مقارنة بالتوزيع اليدوي المرفق
                </div>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer text-[11px] px-2 py-1 rounded border border-border bg-background hover:bg-muted">
                    {manualRef ? 'تغيير الصورة' : 'رفع صورة التوزيع اليدوي'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUploadManual(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {manualRef && (
                    <button
                      type="button"
                      onClick={() => setManualRef(null)}
                      className="text-[11px] px-2 py-1 rounded border border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      إزالة
                    </button>
                  )}
                </div>
              </div>
              {manualRef && (
                <div className="flex items-center gap-3 flex-wrap text-[11px]">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setOverlayMode('overlay')}
                      className={`px-2 py-0.5 rounded border ${overlayMode === 'overlay' ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}
                    >
                      تراكب
                    </button>
                    <button
                      type="button"
                      onClick={() => setOverlayMode('side')}
                      className={`px-2 py-0.5 rounded border ${overlayMode === 'side' ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}
                    >
                      جنباً لجنب
                    </button>
                  </div>
                  {overlayMode === 'overlay' && (
                    <label className="flex items-center gap-2">
                      <span className="text-muted-foreground">شفافية اليدوي:</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={overlayOpacity}
                        onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                      />
                      <span className="font-mono">{Math.round(overlayOpacity * 100)}%</span>
                    </label>
                  )}
                  <span className="text-muted-foreground">
                    استخدم هذه المقارنة لتحديد فراغات الأغطية والألسنة التي لا يستغلها المحرك.
                  </span>
                </div>
              )}
              {manualRef && overlayMode === 'side' && (
                <div className="rounded-md border border-border bg-background p-1.5 flex justify-center">
                  <img src={manualRef} alt="التوزيع اليدوي" className="max-h-[220px] object-contain" />
                </div>
              )}
            </div>

            {/* Negative-space pockets diagnostic toggle */}
            <div className="rounded-md border border-border bg-muted/20 p-2 flex items-center justify-between flex-wrap gap-2 text-[11px]">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPockets}
                    onChange={(e) => setShowPockets(e.target.checked)}
                  />
                  <span className="font-semibold">إظهار الفراغات السالبة</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAnchors}
                    onChange={(e) => setShowAnchors(e.target.checked)}
                    disabled={!showPockets}
                  />
                  <span className="font-semibold">نقاط الإدخال</span>
                </label>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm bg-slate-900/90 border border-slate-900" />
                  جيب فارغ (pocket)
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-fuchsia-500 border border-fuchsia-700" />
                  مرساة الإدخال
                </span>
              </div>
              <span className="text-muted-foreground">
                المساحات والممرات التي يحاول المحرك ملأها (Negative Space).
              </span>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-2 flex items-center justify-between flex-wrap gap-2 text-[11px]">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showContacts}
                    onChange={(e) => setShowContacts(e.target.checked)}
                  />
                  <span className="font-semibold">إظهار التماس والتداخل</span>
                </label>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500/70 border border-emerald-700" />
                  تماس صحيح (touch)
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm bg-red-500/70 border border-red-700" />
                  تداخل حقيقي (overlap)
                </span>
              </div>
              <span className="text-muted-foreground">
                يُحسب من polygons الـ SVG الحقيقية، لا من المستطيلات الخارجية.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <PreviewCard
                title="التوزيع الحالي"
                pieces={currentPieces}
                sheetW={sheetW}
                sheetH={sheetH}
                dieline={dieline}
                count={currentPieces.length}
                usage={currentUsage}
                accent="muted"
                showContacts={showContacts}
                showPockets={showPockets}
                showAnchors={showAnchors}
                sheetGap={gap}
              />
              <PreviewCard
                title="التوزيع المقترح"
                pieces={best?.pieces ?? []}
                sheetW={sheetW}
                sheetH={sheetH}
                dieline={dieline}
                count={best?.count ?? 0}
                usage={best?.usagePercent ?? 0}
                accent="primary"
                badge={best ? <Trophy className="w-3.5 h-3.5 text-yellow-500" /> : null}
                debug={(best as unknown as { diagnostics?: AutoNestV2StageDiagnostics } | null)?.diagnostics?.debug}
                overlayImage={overlayMode === 'overlay' ? manualRef : null}
                overlayOpacity={overlayOpacity}
                showContacts={showContacts}
                showPockets={showPockets}
                showAnchors={showAnchors}
                sheetGap={gap}
              />
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs flex items-center justify-between">
              <div>
                <span className="font-semibold">الفرق:</span>{' '}
                <span
                  className={
                    improvement > 0
                      ? 'text-emerald-600 font-bold'
                      : improvement < 0
                        ? 'text-destructive font-bold'
                        : 'text-muted-foreground'
                  }
                >
                  {improvement > 0 ? `+${improvement}` : improvement} قطعة
                </span>
              </div>
              <div className="text-muted-foreground">
                المدة: {(result.durationMs / 1000).toFixed(2)} ثانية • {result.scenarios.length} سيناريو
              </div>
            </div>

            {workerVariant === 'advanced' && result.scenarios.length > 0 && (
              <details className="text-[11px] rounded-md border border-amber-300/40 bg-amber-50/40 dark:bg-amber-950/20" open>
                <summary className="cursor-pointer px-2 py-1.5 font-semibold text-amber-700 dark:text-amber-300">
                  🔬 اختبار تعشيق سريع — مراحل المحرك ({result.scenarios.length} سيناريو)
                </summary>
                <div className="px-2 py-1.5 space-y-1">
                  <div className="grid grid-cols-7 gap-1 text-[10px] font-semibold text-muted-foreground border-b border-border/50 pb-1">
                    <div className="col-span-2">السيناريو</div>
                    <div className="text-center">NFP أساس</div>
                    <div className="text-center">NFP إضافي</div>
                    <div className="text-center">احتياطي</div>
                    <div className="text-center">بعد التحقق</div>
                    <div className="text-center">المصدر</div>
                  </div>
                  {result.scenarios.map((s) => {
                    const d = (s as unknown as { diagnostics?: AutoNestV2StageDiagnostics }).diagnostics;
                    return (
                      <div key={s.id} className={`grid grid-cols-7 gap-1 items-center rounded px-1 py-0.5 ${s.id === best?.id ? 'bg-primary/10 font-semibold' : ''}`}>
                        <div className="col-span-2 truncate">{s.label}</div>
                        <div className="text-center font-mono">{d?.nfpBaseCount ?? '—'}</div>
                        <div className="text-center font-mono">{d?.nfpExtraCount ?? '—'}</div>
                        <div className="text-center font-mono">{d?.fallbackCount ?? '—'}</div>
                        <div className="text-center font-mono">
                          <span className="text-emerald-600">{d?.validatedNfpCount ?? '—'}</span>
                          {' / '}
                          <span className="text-blue-600">{d?.validatedFallbackCount ?? '—'}</span>
                        </div>
                        <div className="text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                            d?.chosenSource === 'nfp' ? 'bg-emerald-500/20 text-emerald-700' :
                            d?.chosenSource === 'staggered' ? 'bg-primary/20 text-primary' :
                            d?.chosenSource === 'fallback' ? 'bg-blue-500/20 text-blue-700' :
                            'bg-destructive/20 text-destructive'
                          }`}>
                            {d?.chosenSource === 'nfp' ? 'NFP' : d?.chosenSource === 'staggered' ? 'مزاح' : d?.chosenSource === 'fallback' ? 'احتياطي' : 'لا شيء'} → {s.count}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-1 mt-1 border-t border-border/50 text-[10px] text-muted-foreground">
                    الحد الأعلى المُقدَّر: {(result.scenarios[0] as unknown as { diagnostics?: AutoNestV2StageDiagnostics }).diagnostics?.upperBound ?? '—'} •
                    {' '}شكل القالب: {(result.scenarios[0] as unknown as { diagnostics?: AutoNestV2StageDiagnostics }).diagnostics?.forcedBBox ? 'مستطيل احتياطي (Sparse)' : 'القالب الأصلي'}
                  </div>
                </div>
              </details>
            )}

            {result.scenarios.length > 0 && (
              <details className="text-[11px]">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  عرض جميع السيناريوهات ({result.scenarios.length})
                </summary>
                <div className="mt-2 space-y-1">
                  {result.scenarios
                    .slice()
                    .sort((a, b) => b.count - a.count || b.usagePercent - a.usagePercent)
                    .map((s) => (
                      <ScenarioRow key={s.id} s={s} isBest={s.id === best?.id} />
                    ))}
                </div>
              </details>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={running}
          >
            <X className="w-3.5 h-3.5 ml-1" />
            إلغاء
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={startRun}
            disabled={running || !dieline?.shape}
          >
            <RefreshCw className="w-3.5 h-3.5 ml-1" />
            إعادة التشغيل
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (best) {
                onApply(best.pieces);
                onOpenChange(false);
              }
            }}
            disabled={running || !best || best.count === 0}
          >
            <CheckCircle2 className="w-3.5 h-3.5 ml-1" />
            تطبيق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ───────────── Preview card ───────────── */

const PreviewCard = ({
  title,
  pieces,
  sheetW,
  sheetH,
  dieline,
  count,
  usage,
  accent,
  badge,
  debug,
  overlayImage,
  overlayOpacity = 0.5,
  showContacts = false,
  showPockets = false,
  showAnchors = false,
  sheetGap = 0,
}: {
  title: string;
  pieces: LayoutPiece[];
  sheetW: number;
  sheetH: number;
  dieline: ParsedDieline | null;
  count: number;
  usage: number;
  accent: 'primary' | 'muted';
  badge?: React.ReactNode;
  debug?: AutoNestV2DebugSummary;
  overlayImage?: string | null;
  overlayOpacity?: number;
  showContacts?: boolean;
  showPockets?: boolean;
  showAnchors?: boolean;
  sheetGap?: number;
}) => {
  const dlShape: DielineShape | null = dieline?.shape ?? null;
  const isPortrait = sheetH > sheetW;
  const dispW = isPortrait ? sheetH : sheetW;
  const dispH = isPortrait ? sheetW : sheetH;
  const maxW = 320;
  const scale = Math.min(maxW / dispW, 200 / dispH);
  const svgW = dispW * scale;
  const svgH = dispH * scale;

  const fillColor =
    accent === 'primary' ? 'hsl(var(--primary) / 0.18)' : 'hsl(var(--muted-foreground) / 0.12)';
  const strokeColor =
    accent === 'primary' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))';
  const borderClass =
    accent === 'primary'
      ? 'border-primary/40 bg-primary/5'
      : 'border-border bg-muted/20';

  const contacts = showContacts ? computeContactOverlay(pieces, dlShape) : null;
  // inflate=0 so the pocket reflects the actual whitespace between the
  // *visible* cut lines (matches the user's black-fill reference image).
  const pockets = showPockets
    ? computeNegativeSpaceOverlay(pieces, dlShape, sheetW, sheetH, 0.25, 0)
    : null;

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${borderClass}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        {badge}
        <span>{title}</span>
        <span className="mr-auto text-muted-foreground font-normal">
          {count} قطعة • {usage.toFixed(1)}%
          {contacts && (contacts.touchPairs > 0 || contacts.overlapPairs > 0) && (
            <>
              {' • '}
              {contacts.touchPairs > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400">تماس: {contacts.touchPairs}</span>
              )}
              {contacts.overlapPairs > 0 && (
                <span className="ml-1 text-red-600 dark:text-red-400">
                  تداخل: {contacts.overlapPairs} ({contacts.overlapArea.toFixed(2)} cm²)
                </span>
              )}
            </>
          )}
          {pockets && pockets.pockets.length > 0 && (
            <span className="ml-1 text-amber-600 dark:text-amber-400">
              {' • '}جيوب: {pockets.pockets.length} ({pockets.freePercent.toFixed(1)}%)
            </span>
          )}
        </span>
      </div>
      <div className="relative flex justify-center bg-background rounded-md border border-border/50 p-1.5">
        {debug && <DebugOverlay debug={debug} />}
        <div className="relative" style={{ width: svgW, height: svgH }}>
        <svg width={svgW} height={svgH} viewBox={`0 0 ${dispW} ${dispH}`} className="block absolute inset-0">
          <g transform={isPortrait ? `translate(${sheetH} 0) rotate(90)` : undefined}>
            <rect
              x={0}
              y={0}
              width={sheetW}
              height={sheetH}
              fill="hsl(var(--muted))"
              stroke="hsl(var(--border))"
              strokeWidth={0.5 / scale}
            />
            {pieces.map((p) => {
              let path: string | null = null;
              if (dlShape) {
                const turns = typeof p.rotation === 'number' ? ((p.rotation % 4) + 4) % 4 : p.rotated ? 1 : 0;
                let base = dlShape.rings;
                let curW = dlShape.width;
                let curH = dlShape.height;
                for (let t = 0; t < turns; t++) {
                  base = rotateRings90(base, curW, curH);
                  [curW, curH] = [curH, curW];
                }
                if (p.mirrored) {
                  base = base.map((r) => r.map((pt) => ({ x: curW - pt.x, y: pt.y })));
                }
                const rings = translateRings(base, p.x, p.y);
                path = rings.map(polygonToSvgPath).join(' ');
              }
              return path ? (
                <path
                  key={p.index}
                  d={path}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={0.3 / scale}
                  fillRule="evenodd"
                />
              ) : (
                <rect
                  key={p.index}
                  x={p.x}
                  y={p.y}
                  width={p.w}
                  height={p.h}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={0.3 / scale}
                  rx={0.2}
                />
              );
            })}
            {pockets && pockets.pockets.length > 0 && (
              <>
                <path
                  d={pockets.pockets.flatMap((pk) => pk.rings.map(polygonToSvgPath)).join(' ')}
                  fill="rgb(15 23 42 / 0.92)"
                  stroke="rgb(15 23 42)"
                  strokeWidth={0.15 / scale}
                  fillRule="evenodd"
                  pointerEvents="none"
                />
                {showAnchors && pockets.pockets.flatMap((pk, pi) =>
                  pk.anchors.map((a, ai) => (
                    <circle
                      key={`anchor-${pi}-${ai}`}
                      cx={a.x}
                      cy={a.y}
                      r={(a.kind === 'centroid' ? 0.55 : 0.35) / scale * 1.6}
                      fill={a.kind === 'centroid' ? 'rgb(217 70 239)' : 'rgb(217 70 239 / 0.7)'}
                      stroke="rgb(112 26 117)"
                      strokeWidth={0.15 / scale}
                      pointerEvents="none"
                    />
                  )),
                )}
              </>
            )}
            {contacts && contacts.touch.length > 0 && (
              <path
                d={contacts.touch.map((poly) => polygonToSvgPath(poly)).join(' ')}
                fill="rgb(16 185 129 / 0.55)"
                stroke="rgb(5 122 85)"
                strokeWidth={0.25 / scale}
                fillRule="evenodd"
              />
            )}
            {contacts && contacts.overlap.length > 0 && (
              <path
                d={contacts.overlap.map((poly) => polygonToSvgPath(poly)).join(' ')}
                fill="rgb(239 68 68 / 0.6)"
                stroke="rgb(153 27 27)"
                strokeWidth={0.3 / scale}
                fillRule="evenodd"
              />
            )}
          </g>
        </svg>
        {overlayImage && (
          <img
            src={overlayImage}
            alt="التوزيع اليدوي"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none mix-blend-multiply"
            style={{ opacity: overlayOpacity }}
          />
        )}
        </div>
      </div>
    </div>
  );
};

const rejectReasonLabel: Record<AutoNestV2RejectReason, string> = {
  overlap: 'تداخل',
  'outside-sheet': 'خروج خارج الشيت',
  'gap-violation': 'مخالفة gap',
  'no-silhouette-contact': 'لا يوجد تلامس حدود حقيقي',
  'no-count-improvement': 'لم تحسن عدد القطع',
  'no-usage-improvement': 'لم تحسن الاستغلال',
  'insufficient-space': 'مساحة غير كافية',
  'not-compacting': 'لا يضغط الشبكة',
};

const DebugOverlay = ({ debug }: { debug: AutoNestV2DebugSummary }) => {
  const rejected = Object.entries(debug.rejectionCounts)
    .filter(([, count]) => (count ?? 0) > 0)
    .slice(0, 6) as [AutoNestV2RejectReason, number][];
  const recentRejected = debug.rejected.slice(0, 5);

  return (
    <div className="absolute right-2 top-2 z-10 max-w-[78%] rounded-md border border-border bg-background/90 p-2 text-[10px] shadow-sm backdrop-blur">
      <div className="font-semibold text-foreground">Debug Overlay</div>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
        <span>تحريك: {debug.movedPieces.length ? debug.movedPieces.join(', ') : '—'}</span>
        <span>تدوير 180°: {debug.rotated180Pieces.length ? debug.rotated180Pieces.join(', ') : '—'}</span>
        <span>تكرارات: {debug.postIterations}</span>
        <span>Offsets: {debug.staggeredOffsetsTried.length ? debug.staggeredOffsetsTried.join('%، ') + '%' : '—'}</span>
      </div>
      {rejected.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {rejected.map(([reason, count]) => (
            <span key={reason} className="rounded border border-border bg-muted/60 px-1 py-0.5">
              {rejectReasonLabel[reason]}: {count}
            </span>
          ))}
        </div>
      )}
      {recentRejected.length > 0 && (
        <div className="mt-1 space-y-0.5 text-muted-foreground">
          {recentRejected.map((a, i) => (
            <div key={i} className="truncate">
              رفض {a.action}{a.pieceIndex ? ` #${a.pieceIndex}` : ''}: {a.reason ? rejectReasonLabel[a.reason] : '—'}
            </div>
          ))}
        </div>
      )}
      <div className="mt-1 border-t border-border/50 pt-1 text-muted-foreground">{debug.note}</div>
    </div>
  );
};

const ScenarioRow = ({ s, isBest }: { s: AutoNestScenario; isBest: boolean }) => (
  <div
    className={`flex items-center justify-between rounded border px-2 py-1 ${
      isBest ? 'border-primary/50 bg-primary/5' : 'border-border/40 bg-background'
    }`}
  >
    <div className="flex items-center gap-1.5">
      {isBest && <Trophy className="w-3 h-3 text-yellow-500" />}
      <span className={isBest ? 'font-semibold' : ''}>{s.label}</span>
    </div>
    <div className="flex gap-2 text-muted-foreground">
      <span>{s.count} قطعة</span>
      <span>•</span>
      <span>{s.usagePercent.toFixed(1)}%</span>
    </div>
  </div>
);

export default AutoNestDialog;
