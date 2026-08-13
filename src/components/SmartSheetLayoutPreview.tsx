import { useState, useMemo, useEffect, useRef } from 'react';
import {
  optimizeTwoStage,
  enumerateProductionScenarios,
  optimizeLayout,
  type ProductionScenarios,
  type PressSizeScenario,
  type LayoutPiece,
} from '@/lib/sheetLayoutOptimizer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Brain,
  Trophy,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  Package,
} from 'lucide-react';

/* ──────────────────────────────────────────────
 * Smart-Engine specific layout preview.
 * - One card per production scenario.
 * - Each card collapsible (arrow in corner).
 * - Each card selectable (radio dot in corner).
 * - Best scenario expanded by default + "أفضل إنتاج" badge.
 * - No manual-edit, no dieline import.
 * ────────────────────────────────────────────── */

interface Props {
  /** Master (purchase) sheet dimensions */
  sheetW: number;
  sheetH: number;
  /** Currently applied press sheet dimensions */
  pressW: number;
  pressH: number;
  /** Final product dimensions */
  productW: number;
  productH: number;
  /** Required quantity */
  quantity: number;
  /** Auto/manual press-size propagation */
  onPressSizeChange?: (pressW: number, pressH: number) => void;
  /** Stage2 selection — sets cutsPerSheet */
  onSelectStage2?: (scenarioId: string, count: number) => void;
  /** Stage1 selection — sets baseCuts (press sheets per master) */
  onSelectStage1?: (scenarioId: string, count: number) => void;
  /** Optional explicit machine envelope (overrides pressW/pressH-derived envelope). */
  envelopeW?: number;
  envelopeH?: number;
  /** Optional manually entered press sheet (prepended as first scenario). */
  manualPress?: { w: number; h: number } | null;
  /** Use the full optimizer for master → press-sheet counts. Enabled only where requested. */
  optimizePressSheetLayout?: boolean;
}

const SmartSheetLayoutPreview = ({
  sheetW, sheetH, pressW, pressH, productW, productH, quantity,
  onPressSizeChange, onSelectStage1, onSelectStage2,
  envelopeW, envelopeH, manualPress, optimizePressSheetLayout = false,
}: Props) => {

  // Stable machine envelope (so subdivision search isn't narrowed by auto-pick).
  const [machineW, setMachineW] = useState(pressW);
  const [machineH, setMachineH] = useState(pressH);
  const userPickedRef = useRef(false);
  const lastAutoRef = useRef<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const last = lastAutoRef.current;
    const isOurAutoPush =
      last &&
      ((Math.abs(last.w - pressW) < 0.05 && Math.abs(last.h - pressH) < 0.05) ||
        (Math.abs(last.w - pressH) < 0.05 && Math.abs(last.h - pressW) < 0.05));
    if (!isOurAutoPush) {
      setMachineW(pressW);
      setMachineH(pressH);
      userPickedRef.current = false;
    }
  }, [pressW, pressH]);

  // Effective envelope: explicit prop wins, else state synced from pressW/H.
  const envW = envelopeW && envelopeW > 0 ? envelopeW : machineW;
  const envH = envelopeH && envelopeH > 0 ? envelopeH : machineH;

  const ready =
    sheetW > 0 && sheetH > 0 && envW > 0 && envH > 0 && productW > 0 && productH > 0;

  const scenarios = useMemo<ProductionScenarios | null>(() => {
    if (!ready) return null;
    return enumerateProductionScenarios(
      sheetW, sheetH, envW, envH, productW, productH, 0, null,
    );
  }, [ready, sheetW, sheetH, envW, envH, productW, productH]);

  // Manual scenario (prepended when user typed a custom press size).
  // Uses the SAME layout engine (optimizeLayout) as the auto scenarios so the
  // manual press is treated literally — Stage 1 = press sheets tiled in master,
  // Stage 2 = products tiled in press — with auto orientation/rotation.
  const manualScenario = useMemo<PressSizeScenario | null>(() => {
    if (!manualPress || manualPress.w <= 0 || manualPress.h <= 0) return null;
    if (!(sheetW > 0 && sheetH > 0 && productW > 0 && productH > 0)) return null;
    const mw = manualPress.w;
    const mh = manualPress.h;
    const stage1 = optimizeLayout(sheetW, sheetH, mw, mh, 0);
    const pressPerBase =
      stage1.recommendedIdx >= 0 ? stage1.scenarios[stage1.recommendedIdx].count : 0;
    const stage2 = optimizeLayout(mw, mh, productW, productH, 0, null);
    const productsPerPress =
      stage2.recommendedIdx >= 0 ? stage2.scenarios[stage2.recommendedIdx].count : 0;
    if (pressPerBase <= 0 || productsPerPress <= 0) return null;
    return {
      id: `manual-${mw}x${mh}`,
      pressW: mw,
      pressH: mh,
      pressPerBase,
      productsPerPress,
      total: pressPerBase * productsPerPress,
      stage1,
      stage2,
      isMachineSize: false,
      label: `${mw}×${mh}`,
    };
  }, [manualPress, sheetW, sheetH, productW, productH]);

  // Build flat list (direct + subdivisions), sorted by total desc.
  const autoList = useMemo<PressSizeScenario[]>(() => {
    if (!scenarios) return [];
    const normalizePressScenario = (s: PressSizeScenario): PressSizeScenario => {
      if (!optimizePressSheetLayout) return s;
      const stage1 = optimizeLayout(sheetW, sheetH, s.pressW, s.pressH, 0);
      const optimizedPressPerBase =
        stage1.recommendedIdx >= 0 ? stage1.scenarios[stage1.recommendedIdx].count : 0;
      return {
        ...s,
        stage1,
        pressPerBase: optimizedPressPerBase,
        total: optimizedPressPerBase * s.productsPerPress,
      };
    };
    const all = [scenarios.direct, ...scenarios.subdivisions]
      .map(normalizePressScenario)
      .filter(s => s.total > 0)
      // dedupe direct duplicates
      .filter((s, i, arr) =>
        arr.findIndex(o => Math.abs(o.pressW - s.pressW) < 0.05 && Math.abs(o.pressH - s.pressH) < 0.05) === i
      )
      .sort((a, b) => b.total - a.total);
    return all;
  }, [scenarios, optimizePressSheetLayout, sheetW, sheetH]);

  const list = useMemo<PressSizeScenario[]>(() => {
    if (manualPress && !manualScenario) return [];
    if (!manualScenario) return autoList;
    // Prepend manual; drop any auto entry with same press dims to avoid duplicates.
    const filtered = autoList.filter(s =>
      !((Math.abs(s.pressW - manualScenario.pressW) < 0.05 && Math.abs(s.pressH - manualScenario.pressH) < 0.05) ||
        (Math.abs(s.pressW - manualScenario.pressH) < 0.05 && Math.abs(s.pressH - manualScenario.pressW) < 0.05)),
    );
    return [manualScenario, ...filtered];
  }, [manualPress, manualScenario, autoList]);

  const autoBest = autoList[0] ?? null;
  const bestId = autoBest?.id;

  // Auto-apply best when scenarios change & user hasn't manually picked.
  // Guard with a ref tracking the last pushed (best) signature to break
  // any potential ping-pong between this effect and the machineW/H sync.
  const lastPushedSigRef = useRef<string>('');
  useEffect(() => {
    if (!autoBest || !onPressSizeChange) return;
    // Respect manual user entry: never override it with the auto-best.
    if (manualScenario) return;

    const all = list;
    const matchesCurrent = all.some(
      s =>
        (Math.abs(s.pressW - pressW) < 0.05 && Math.abs(s.pressH - pressH) < 0.05) ||
        (Math.abs(s.pressW - pressH) < 0.05 && Math.abs(s.pressH - pressW) < 0.05),
    );
    if (matchesCurrent && userPickedRef.current) return;
    const best = autoBest;
    if (!best || best.total <= 0) return;
    const sig = `${best.id}|${best.pressW.toFixed(2)}x${best.pressH.toFixed(2)}|${best.pressPerBase}|${best.productsPerPress}`;
    if (sig === lastPushedSigRef.current) return;
    lastPushedSigRef.current = sig;
    if (Math.abs(best.pressW - pressW) > 0.05 || Math.abs(best.pressH - pressH) > 0.05) {
      lastAutoRef.current = { w: best.pressW, h: best.pressH };
      onPressSizeChange(best.pressW, best.pressH);
    }
    // Also propagate stage counts for the best scenario
    onSelectStage1?.(best.id + ':s1', best.pressPerBase);
    onSelectStage2?.(best.id + ':s2', best.productsPerPress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBest, manualScenario]);

  // When a manual press scenario exists, propagate its stage counts so that
  // "تفاصيل الحساب" mirrors the visual preview for the manual press size.
  const lastManualSigRef = useRef<string>('');
  useEffect(() => {
    if (!manualScenario) { lastManualSigRef.current = ''; return; }
    const m = manualScenario;
    const sig = `${m.id}|${m.pressW.toFixed(2)}x${m.pressH.toFixed(2)}|${m.pressPerBase}|${m.productsPerPress}`;
    if (sig === lastManualSigRef.current) return;
    lastManualSigRef.current = sig;
    if (Math.abs(m.pressW - pressW) > 0.05 || Math.abs(m.pressH - pressH) > 0.05) {
      lastAutoRef.current = { w: m.pressW, h: m.pressH };
      onPressSizeChange?.(m.pressW, m.pressH);
    }
    onSelectStage1?.(m.id + ':s1', m.pressPerBase);
    onSelectStage2?.(m.id + ':s2', m.productsPerPress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualScenario]);

  useEffect(() => {
    if (!ready || !manualPress || manualPress.w <= 0 || manualPress.h <= 0 || manualScenario) return;
    const sig = `manual-invalid-${manualPress.w.toFixed(2)}x${manualPress.h.toFixed(2)}`;
    if (sig === lastManualSigRef.current) return;
    lastManualSigRef.current = sig;
    onSelectStage1?.('manual-invalid:s1', 0);
    onSelectStage2?.('manual-invalid:s2', 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, manualPress, manualScenario]);

  // Per-card expanded state — keyed by id.
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  // When best changes, default-open it.
  useEffect(() => {
    if (!bestId) return;
    setOpenMap(prev => (prev[bestId] === undefined ? { ...prev, [bestId]: true } : prev));
  }, [bestId]);

  // Default-open the manual scenario whenever it exists.
  useEffect(() => {
    if (!manualScenario) return;
    setOpenMap(prev => (prev[manualScenario.id] === undefined ? { ...prev, [manualScenario.id]: true } : prev));
  }, [manualScenario?.id]);


  const toggleAll = (open: boolean) => {
    const next: Record<string, boolean> = {};
    list.forEach(s => { next[s.id] = open; });
    setOpenMap(next);
  };

  const isSelected = (s: PressSizeScenario) =>
    (Math.abs(s.pressW - pressW) < 0.05 && Math.abs(s.pressH - pressH) < 0.05) ||
    (Math.abs(s.pressW - pressH) < 0.05 && Math.abs(s.pressH - pressW) < 0.05);

  const handleSelect = (s: PressSizeScenario) => {
    userPickedRef.current = true;
    lastAutoRef.current = { w: s.pressW, h: s.pressH };
    onPressSizeChange?.(s.pressW, s.pressH);
    onSelectStage1?.(s.id + ':s1', s.pressPerBase);
    onSelectStage2?.(s.id + ':s2', s.productsPerPress);
    setOpenMap(prev => ({ ...prev, [s.id]: true }));
  };

  return (
    <Card className="shadow-md border-primary/30 overflow-hidden">
      <div className="h-1 bg-gradient-to-l from-primary via-emerald-500 to-primary" />
      <CardContent className="pt-5 pb-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Brain className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground text-sm">العرض المرئي للسيناريوهات</h3>
            <p className="text-[10px] text-muted-foreground">
              يتم اختيار الأفضل تلقائياً — اضغط أي سيناريو لاعتماده يدوياً
            </p>
          </div>
        </div>

        {!ready ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            أدخل مقاس المنتج ونوع الورق ومقاس شيت الطباعة لعرض السيناريوهات
          </p>
        ) : list.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            لا يوجد توزيع ممكن بهذه المقاسات
          </p>
        ) : (
          <>
            {/* Toolbar: expand/collapse all */}
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] gap-1"
                onClick={() => toggleAll(true)}
              >
                <ChevronDown className="w-3.5 h-3.5" />
                فتح الكل
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] gap-1"
                onClick={() => toggleAll(false)}
              >
                <ChevronUp className="w-3.5 h-3.5" />
                إغلاق الكل
              </Button>
            </div>

            <div className="space-y-3">
              {list.map((s, idx) => {
                const isManual = manualScenario?.id === s.id;
                const cardLabel = isManual
                  ? 'سيناريو يدوي'
                  : `سيناريو ${String.fromCharCode(0x0041 + (manualScenario ? idx - 1 : idx))}`;
                return (
                <div key={s.id} data-tour={s.id === bestId ? 'best-scenario' : undefined}>
                <ScenarioCard
                  scenario={s}
                  label={cardLabel}
                  masterW={sheetW}
                  masterH={sheetH}
                  productW={productW}
                  productH={productH}
                  isBest={s.id === bestId}
                  isSelected={isSelected(s)}
                  isOpen={openMap[s.id] ?? (s.id === bestId || isManual)}
                  onToggle={() => setOpenMap(prev => ({ ...prev, [s.id]: !(prev[s.id] ?? (s.id === bestId || isManual)) }))}
                  onSelect={() => handleSelect(s)}
                  quantity={quantity}
                  useOptimizedStage1Preview={optimizePressSheetLayout}
                />
                </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>

  );
};

/* ═══════════════ Scenario Card ═══════════════ */
const ScenarioCard = ({
  scenario, label, masterW, masterH, productW, productH,
  isBest, isSelected, isOpen, onToggle, onSelect, quantity, useOptimizedStage1Preview,
}: {
  scenario: PressSizeScenario;
  label: string;
  masterW: number;
  masterH: number;
  productW: number;
  productH: number;
  isBest: boolean;
  isSelected: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: () => void;
  quantity: number;
  useOptimizedStage1Preview?: boolean;
}) => {
  const { pressW, pressH, pressPerBase, productsPerPress, total } = scenario;
  const sheetsNeeded = total > 0 && quantity > 0 ? Math.ceil(quantity / total) : 0;

  return (
    <div
      className={`rounded-xl border-2 overflow-hidden transition-all ${
        isSelected
          ? 'border-primary shadow-md bg-primary/5'
          : isBest
            ? 'border-yellow-400/70 bg-yellow-50/30 dark:bg-yellow-500/5'
            : 'border-border bg-card'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border/60">
        {/* Selection radio */}
        <button
          type="button"
          onClick={onSelect}
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
            isSelected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/40 hover:border-primary'
          }`}
          title={isSelected ? 'مختار' : 'اختيار هذا السيناريو'}
          aria-label={isSelected ? 'مختار' : 'اختيار'}
        >
          {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
        </button>

        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
          isSelected ? 'bg-primary text-primary-foreground' : 'bg-foreground/10 text-foreground'
        }`}>
          {label}
        </span>

        {isBest && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-400 text-yellow-900">
            <Trophy className="w-3 h-3" />
            أفضل إنتاج
          </span>
        )}
        {isSelected && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary">
            مُطبَّق
          </span>
        )}

        <div className="mr-auto flex items-center gap-2">
          <div className="text-left">
            <p className="text-[10px] text-muted-foreground leading-none">الإجمالي</p>
            <p className="text-base font-extrabold text-primary tabular-nums leading-tight">{total} <span className="text-[10px] font-normal text-muted-foreground">قطعة</span></p>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center"
            aria-label={isOpen ? 'إغلاق' : 'فتح'}
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Body */}
      {isOpen && (
        <div className="p-3 space-y-3">
          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <Stat
              icon={<Layers className="w-3 h-3" />}
              label="شيت طباعة"
              value={`${pressW}×${pressH}`}
              sub={`${pressPerBase} من الأساسي`}
            />
            <Stat
              icon={<Package className="w-3 h-3" />}
              label="قطع/شيت طباعة"
              value={`${productsPerPress}`}
              sub={`${productW}×${productH}`}
            />
            <Stat
              label="إجمالي القطع"
              value={`${total}`}
              sub={sheetsNeeded > 0 ? `${sheetsNeeded} شيت أساسي` : '—'}
              highlight
            />
          </div>

          {/* Visualization 1: master sheet cut into press sheets */}
          <div>
            <p className="text-[10px] text-muted-foreground mb-1 font-semibold">
              تفصيل الشيت الأساسي ({masterW}×{masterH}) → {pressPerBase} شيت طباعة ({pressW}×{pressH})
            </p>
            <SheetGrid
              sheetW={masterW}
              sheetH={masterH}
              cellW={pressW}
              cellH={pressH}
              accent="primary"
              maxW={420}
              maxH={210}
              pieces={
                useOptimizedStage1Preview && scenario.stage1?.recommendedIdx >= 0
                  ? scenario.stage1.scenarios[scenario.stage1.recommendedIdx]?.pieces
                  : undefined
              }
            />
          </div>

          {/* Visualization 2: press sheet → product placement */}
          <div>
            <p className="text-[10px] text-muted-foreground mb-1 font-semibold">
              توزيع المنتج ({productW}×{productH}) في شيت الطباعة = {productsPerPress} قطعة
            </p>
            <SheetGrid
              sheetW={pressW}
              sheetH={pressH}
              cellW={productW}
              cellH={productH}
              accent="emerald"
              maxW={420}
              maxH={210}
              pieces={
                scenario.stage2?.recommendedIdx >= 0
                  ? scenario.stage2.scenarios[scenario.stage2.recommendedIdx]?.pieces
                  : undefined
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};

const Stat = ({
  icon, label, value, sub, highlight,
}: { icon?: React.ReactNode; label: string; value: string; sub?: string; highlight?: boolean }) => (
  <div className={`rounded-md border px-2 py-1.5 text-center ${
    highlight ? 'border-primary/40 bg-primary/5' : 'border-border/50 bg-muted/20'
  }`}>
    <p className="text-[9px] text-muted-foreground leading-none flex items-center justify-center gap-1">
      {icon}
      {label}
    </p>
    <p className={`text-sm font-bold tabular-nums leading-tight ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</p>
    {sub && <p className="text-[9px] text-muted-foreground leading-none">{sub}</p>}
  </div>
);

/* ═══════════════ Sheet grid SVG (numbered cells, dimension labels) ═══════════════ */
const SheetGrid = ({
  sheetW, sheetH, cellW, cellH, accent, maxW, maxH, pieces,
}: {
  sheetW: number;
  sheetH: number;
  cellW: number;
  cellH: number;
  accent: 'primary' | 'emerald';
  maxW: number;
  maxH: number;
  pieces?: LayoutPiece[];
}) => {
  if (sheetW <= 0 || sheetH <= 0 || cellW <= 0 || cellH <= 0) return null;

  // If real placements were provided (from optimizer), use them — they may mix
  // orientations and pack more pieces than a uniform cols×rows grid.
  let realPieces: LayoutPiece[] | null = null;
  if (pieces && pieces.length > 0) {
    realPieces = pieces;
  }

  // Fallback: uniform grid, try both cell orientations and pick the denser one.
  const fits = (w: number, h: number) => {
    if (w > sheetW + 0.01 || h > sheetH + 0.01) return null;
    const cols = Math.floor(sheetW / w);
    const rows = Math.floor(sheetH / h);
    if (cols <= 0 || rows <= 0) return null;
    return { cols, rows, w, h, total: cols * rows };
  };
  const a = fits(cellW, cellH);
  const b = fits(cellH, cellW);
  const layout = realPieces ? null : (a && b ? (a.total >= b.total ? a : b) : a || b);

  // Always display landscape
  const isPortrait = sheetH > sheetW;
  const dispW = isPortrait ? sheetH : sheetW;
  const dispH = isPortrait ? sheetW : sheetH;
  const scale = Math.min(maxW / dispW, maxH / dispH);
  const svgW = dispW * scale;
  const svgH = dispH * scale;

  const fillColor = accent === 'emerald' ? 'hsl(142 76% 36% / 0.18)' : 'hsl(var(--primary) / 0.18)';
  const strokeColor = accent === 'emerald' ? 'hsl(142 76% 36%)' : 'hsl(var(--primary))';

  const padX = Math.max(dispW * 0.08, 2.5);
  const padY = Math.max(dispH * 0.12, 3.5);

  return (
    <div className="flex justify-center bg-background rounded-md border border-border/60 p-2 overflow-visible">
      <svg
        width={svgW}
        height={svgH}
        viewBox={`${-padX} ${-padY} ${dispW + padX * 2} ${dispH + padY * 2.4}`}
        className="block"
        style={{ maxWidth: '100%', height: 'auto' }}
      >
        <defs>
          <pattern id={`grid-${accent}-${sheetW}-${sheetH}-${cellW}-${cellH}`} width={5} height={5} patternUnits="userSpaceOnUse">
            <path d="M 5 0 L 0 0 0 5" fill="none" stroke="hsl(var(--border))" strokeWidth={0.08} />
          </pattern>
        </defs>
        <g transform={isPortrait ? `translate(${sheetH} 0) rotate(90)` : undefined}>
          <rect
            x={0} y={0}
            width={sheetW} height={sheetH}
            fill="hsl(var(--muted))"
            stroke="hsl(var(--border))"
            strokeWidth={0.6 / scale}
            rx={0.4}
          />
          <rect
            x={0} y={0}
            width={sheetW} height={sheetH}
            fill={`url(#grid-${accent}-${sheetW}-${sheetH}-${cellW}-${cellH})`}
            opacity={0.6}
          />
          {realPieces && realPieces.map((p, i) => {
            const labelSize = Math.min(p.w, p.h) * 0.32;
            return (
              <g key={i}>
                <rect
                  x={p.x} y={p.y}
                  width={p.w} height={p.h}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={0.4 / scale}
                  rx={0.2}
                />
                <g transform={isPortrait ? `rotate(-90, ${p.x + p.w / 2}, ${p.y + p.h / 2})` : undefined}>
                  <text
                    x={p.x + p.w / 2}
                    y={p.y + p.h / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={strokeColor}
                    fontSize={labelSize}
                    fontWeight="bold"
                    fontFamily="'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif"
                  >
                    {i + 1}
                  </text>
                </g>
              </g>
            );
          })}
          {!realPieces && layout && Array.from({ length: layout.cols * layout.rows }).map((_, i) => {
            const c = i % layout.cols;
            const r = Math.floor(i / layout.cols);
            const x = c * layout.w;
            const y = r * layout.h;
            const labelSize = Math.min(layout.w, layout.h) * 0.32;
            return (
              <g key={i}>
                <rect
                  x={x} y={y}
                  width={layout.w} height={layout.h}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={0.4 / scale}
                  rx={0.2}
                />
                <g transform={isPortrait ? `rotate(-90, ${x + layout.w / 2}, ${y + layout.h / 2})` : undefined}>
                  <text
                    x={x + layout.w / 2}
                    y={y + layout.h / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={strokeColor}
                    fontSize={labelSize}
                    fontWeight="bold"
                    fontFamily="'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif"
                  >
                    {i + 1}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
        {/* Dimension labels (always landscape) */}
        <text
          x={dispW / 2} y={-1}
          textAnchor="middle"
          fontSize={Math.max(1.8, dispW * 0.028)}
          fill="hsl(var(--muted-foreground))"
          fontFamily="'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif"
          fontWeight="600"
        >
          {isPortrait ? sheetH : sheetW} سم
        </text>
        <text
          x={-1} y={dispH / 2}
          textAnchor="middle"
          fontSize={Math.max(1.8, dispH * 0.028)}
          fill="hsl(var(--muted-foreground))"
          fontFamily="'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif"
          fontWeight="600"
          transform={`rotate(-90, -1, ${dispH / 2})`}
        >
          {isPortrait ? sheetW : sheetH} سم
        </text>
      </svg>
    </div>
  );
};

export default SmartSheetLayoutPreview;
