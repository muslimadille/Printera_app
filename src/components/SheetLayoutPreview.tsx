import { useState, useMemo, useEffect, useRef } from 'react';
import { optimizeTwoStage, enumerateProductionScenarios, type LayoutScenario, type LayoutResult, type LayoutPiece, type TwoStageResult, type ProductionScenarios, type PressSizeScenario } from '@/lib/sheetLayoutOptimizer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LayoutGrid, RotateCw, ChevronDown, ChevronUp, Trophy, Layers, Package, Brain, CheckCircle2, X, Zap, Scissors } from 'lucide-react';
import EditableSheetLayout from './EditableSheetLayout';
import SheetLayoutExportMenu from './SheetLayoutExportMenu';
import DielineImportDialog from './DielineImportDialog';
import type { ParsedDieline } from '@/lib/dielineImport';
import {
  translateRings,
  rotateRings90,
  polygonToSvgPath,
  type DielineShape,
} from '@/lib/dielineGeometry';
import { toast } from '@/hooks/use-toast';

interface SheetLayoutPreviewProps {
  /** Master (purchase) sheet dimensions */
  sheetW: number;
  sheetH: number;
  /** Press sheet dimensions */
  pressW: number;
  pressH: number;
  /** Final product dimensions */
  productW: number;
  productH: number;
  /** Required quantity (for "sheets needed" display) */
  quantity: number;
  /** Currently selected stage1 scenario id (press sheets / master sheet) */
  selectedStage1Id?: string;
  /** Currently selected stage2 scenario id (products / press sheet) */
  selectedStage2Id?: string;
  /** Called when the user picks a stage1 scenario — value is the piece count */
  onSelectStage1?: (scenarioId: string, count: number) => void;
  /** Called when the user picks a stage2 scenario — value is the piece count */
  onSelectStage2?: (scenarioId: string, count: number) => void;
  /** Called when an imported dieline changes the effective product size (cm) */
  onProductSizeChange?: (width: number, height: number) => void;
  /** Called when a production scenario is auto/manual-selected and supplies a press-sheet size */
  onPressSizeChange?: (pressW: number, pressH: number) => void;
}

const SheetLayoutPreview = ({
  sheetW, sheetH, pressW, pressH, productW, productH, quantity,
  selectedStage1Id, selectedStage2Id, onSelectStage1, onSelectStage2, onProductSizeChange, onPressSizeChange,
}: SheetLayoutPreviewProps) => {
  const [gap, setGap] = useState(0);
  const [importedDieline, setImportedDieline] = useState<ParsedDieline | null>(null);
  // Tracks whether the current pressW/H came from user-explicit scenario click vs auto-pick
  const userPickedPressRef = useRef(false);

  // The "machine envelope" is the original press-sheet size the user typed in
  // the item card. We need to keep it stable so the production engine can
  // enumerate sub-sheets within the SAME envelope, even after we auto-fill a
  // smaller pressW/H back into the form.
  const [machineW, setMachineW] = useState(pressW);
  const [machineH, setMachineH] = useState(pressH);
  const lastAutoRef = useRef<{ w: number; h: number } | null>(null);

  // When the parent's pressW/H change AND it's not the value we just auto-pushed,
  // treat it as the user editing the machine size — update the envelope.
  useEffect(() => {
    const last = lastAutoRef.current;
    const isOurAutoPush =
      last &&
      ((Math.abs(last.w - pressW) < 0.05 && Math.abs(last.h - pressH) < 0.05) ||
        (Math.abs(last.w - pressH) < 0.05 && Math.abs(last.h - pressW) < 0.05));
    if (!isOurAutoPush) {
      setMachineW(pressW);
      setMachineH(pressH);
      userPickedPressRef.current = false;
    }
  }, [pressW, pressH]);

  // When a dieline is imported, its real dimensions OVERRIDE the product size
  // typed in the item card — the layout, optimizer, and export all use the dieline size.
  const effProductW = importedDieline?.width ?? productW;
  const effProductH = importedDieline?.height ?? productH;

  // Push the dieline dimensions back to the parent so the product size inputs
  // (printWidth/printHeight on the piece) update automatically and stay in sync.
  useEffect(() => {
    if (!importedDieline || !onProductSizeChange) return;
    const w = +importedDieline.width.toFixed(2);
    const h = +importedDieline.height.toFixed(2);
    if (Math.abs(w - productW) > 0.01 || Math.abs(h - productH) > 0.01) {
      onProductSizeChange(w, h);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importedDieline]);

  const ready = sheetW > 0 && sheetH > 0 && pressW > 0 && pressH > 0 && effProductW > 0 && effProductH > 0;

  const twoStageResult = useMemo(() => {
    if (!ready) return null;
    return optimizeTwoStage(sheetW, sheetH, pressW, pressH, effProductW, effProductH, gap, importedDieline?.shape ?? null);
  }, [ready, sheetW, sheetH, pressW, pressH, effProductW, effProductH, gap, importedDieline]);

  // Production scenarios: enumerate alternative press-sheet sizes (≤ machine envelope)
  // taken from the base sheet, vs. printing directly on machine size.
  const productionScenarios = useMemo<ProductionScenarios | null>(() => {
    if (!ready || machineW <= 0 || machineH <= 0) return null;
    return enumerateProductionScenarios(
      sheetW, sheetH, machineW, machineH, effProductW, effProductH, gap, importedDieline?.shape ?? null,
    );
  }, [ready, sheetW, sheetH, machineW, machineH, effProductW, effProductH, gap, importedDieline]);

  // Auto-pick the BEST press-sheet size from production scenarios and propagate
  // it to the parent (auto-fills pressWidth/pressHeight). User clicks override.
  useEffect(() => {
    if (!productionScenarios || !onPressSizeChange) return;
    const all = [productionScenarios.direct, ...productionScenarios.subdivisions];
    const matchesCurrent = all.some(
      (s) =>
        (Math.abs(s.pressW - pressW) < 0.05 && Math.abs(s.pressH - pressH) < 0.05) ||
        (Math.abs(s.pressW - pressH) < 0.05 && Math.abs(s.pressH - pressW) < 0.05),
    );
    // If user-typed/picked press already matches a valid scenario, leave it alone.
    if (matchesCurrent) return;
    // Also leave alone if user typed a press that fits within paper+machine envelope,
    // even if it's not one of the auto-enumerated subdivisions.
    const fitsPaper =
      pressW > 0 && pressH > 0 &&
      ((pressW <= sheetW + 0.05 && pressH <= sheetH + 0.05) ||
       (pressW <= sheetH + 0.05 && pressH <= sheetW + 0.05));
    const fitsMachine =
      pressW > 0 && pressH > 0 &&
      ((pressW <= machineW + 0.05 && pressH <= machineH + 0.05) ||
       (pressW <= machineH + 0.05 && pressH <= machineW + 0.05));
    if (userPickedPressRef.current && fitsPaper && fitsMachine) return;
    const best = productionScenarios.best;
    if (!best || best.total <= 0) return;
    if (Math.abs(best.pressW - pressW) > 0.05 || Math.abs(best.pressH - pressH) > 0.05) {
      lastAutoRef.current = { w: best.pressW, h: best.pressH };
      onPressSizeChange(best.pressW, best.pressH);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productionScenarios]);

  // Auto-select recommended stage scenarios when results change & nothing is selected (or selection no longer exists)
  useEffect(() => {
    if (!twoStageResult) return;
    const s1 = twoStageResult.stage1;
    const s2 = twoStageResult.stage2;
    if (s1.recommendedIdx >= 0) {
      const rec = s1.scenarios[s1.recommendedIdx];
      const exists = selectedStage1Id && s1.scenarios.some(s => s.id === selectedStage1Id);
      if (!exists) onSelectStage1?.(rec.id, rec.count);
    }
    if (s2.recommendedIdx >= 0) {
      const rec = s2.scenarios[s2.recommendedIdx];
      const exists = selectedStage2Id && s2.scenarios.some(s => s.id === selectedStage2Id);
      if (!exists) onSelectStage2?.(rec.id, rec.count);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twoStageResult]);

  // Effective totals based on the user's selection (falls back to recommended).
  const stage1Selected = useMemo(() => {
    if (!twoStageResult) return null;
    const s1 = twoStageResult.stage1;
    return s1.scenarios.find(s => s.id === selectedStage1Id) ?? s1.scenarios[s1.recommendedIdx];
  }, [twoStageResult, selectedStage1Id]);

  const stage2Selected = useMemo(() => {
    if (!twoStageResult) return null;
    const s2 = twoStageResult.stage2;
    return s2.scenarios.find(s => s.id === selectedStage2Id) ?? s2.scenarios[s2.recommendedIdx];
  }, [twoStageResult, selectedStage2Id]);

  // Manual edit override for stage 2 piece count (Edit Mode in EditableSheetLayout)
  const [stage2EditedCount, setStage2EditedCount] = useState<number | null>(null);
  // Optional override of the stage2 pieces themselves (set by Auto-Nest "تطبيق")
  const [stage2OverridePieces, setStage2OverridePieces] = useState<LayoutPiece[] | null>(null);
  
  const lastPropagatedRef = useRef<{ id: string; count: number } | null>(null);

  // Reset manual edit whenever the selected stage2 scenario changes
  useEffect(() => {
    setStage2EditedCount(null);
    setStage2OverridePieces(null);
    lastPropagatedRef.current = null;
  }, [stage2Selected?.id]);

  const effectiveStage2Pieces = stage2OverridePieces ?? stage2Selected?.pieces ?? [];

  const effectiveStage2Count = stage2EditedCount ?? stage2Selected?.count ?? 0;
  const totalProducts = (stage1Selected?.count ?? 0) * effectiveStage2Count;
  const sheetsNeeded = totalProducts > 0 && quantity > 0 ? Math.ceil(quantity / totalProducts) : 0;

  const handleEditedCount = (count: number) => {
    if (!stage2Selected) return;
    setStage2EditedCount((prev) => (prev === count ? prev : count));
    const last = lastPropagatedRef.current;
    if (!last || last.id !== stage2Selected.id || last.count !== count) {
      lastPropagatedRef.current = { id: stage2Selected.id, count };
      onSelectStage2?.(stage2Selected.id, count);
    }
  };

  return (
    <Card className="shadow-md border-primary/30 overflow-hidden">
      <div className="h-1 bg-gradient-to-l from-primary via-emerald-500 to-primary" />
      <CardContent className="pt-5 pb-4 space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Brain className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground text-sm">محرك القرار الإنتاجي الذكي</h3>
            <p className="text-[10px] text-muted-foreground">
              يقارن سيناريوهات التوزيع تلقائياً — اختر التوزيع المناسب لتطبيقه على التكلفة
            </p>
          </div>
          <DielineImportDialog onImported={setImportedDieline} compact />
          <LayoutGrid className="w-4 h-4 text-muted-foreground" />
        </div>

        {importedDieline && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1.5 text-[11px]">
            <Package className="w-3.5 h-3.5 text-emerald-700" />
            <span className="font-semibold text-emerald-700 truncate flex-1">
              قالب مستورد: {importedDieline.fileName}
            </span>
            <span className="text-muted-foreground">
              {importedDieline.width.toFixed(1)}×{importedDieline.height.toFixed(1)} سم
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => setImportedDieline(null)}
              title="إزالة القالب"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* Read-only summary of inputs taken from item data */}
        {ready ? (
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <InfoChip
              label={importedDieline ? 'المنتج (من القالب)' : 'المنتج'}
              value={`${effProductW.toFixed(1)}×${effProductH.toFixed(1)}`}
            />
            <InfoChip label="شيت الطباعة" value={`${pressW}×${pressH}`} />
            <InfoChip label="الشيت الأساسي" value={`${sheetW}×${sheetH}`} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">
            أدخل مقاس المنتج، مقاس شيت الطباعة، ونوع الورق في بيانات الصنف لعرض السيناريوهات
          </p>
        )}

        {/* Optional gap control */}
        {ready && (
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-muted-foreground whitespace-nowrap">المسافة بين القطع (سم):</label>
            <input
              type="number" min={0} step={0.1} value={gap}
              onChange={(e) => setGap(Math.max(0, Number(e.target.value)))}
              className="h-7 text-xs w-20 rounded-md border border-input bg-background px-2"
            />
          </div>
        )}

        {/* ───────── Production scenario comparison: Direct vs multiple subdivisions ───────── */}
        {productionScenarios && (
          <ProductionComparison
            masterW={sheetW}
            masterH={sheetH}
            machineW={machineW}
            machineH={machineH}
            currentPressW={pressW}
            currentPressH={pressH}
            scenarios={productionScenarios}
            onSelect={(s) => {
              userPickedPressRef.current = true;
              lastAutoRef.current = { w: s.pressW, h: s.pressH };
              onPressSizeChange?.(s.pressW, s.pressH);
            }}
          />
        )}

        {twoStageResult && (
          <div className="space-y-3">
            <StageSection
              title={`المرحلة ١: تقطيع الشيت الأساسي (${sheetW}×${sheetH}) إلى شيتات طباعة`}
              icon={<Layers className="w-3.5 h-3.5" />}
              result={twoStageResult.stage1}
              sheetW={sheetW}
              sheetH={sheetH}
              selectedId={stage1Selected?.id}
              onSelect={(s) => onSelectStage1?.(s.id, s.count)}
              unitLabel="شيت طباعة"
            />

            <StageSection
              title={`المرحلة ٢: توزيع المنتج (${effProductW.toFixed(1)}×${effProductH.toFixed(1)}) في شيت الطباعة${importedDieline ? ' — من القالب المستورد' : ''}`}
              icon={<Package className="w-3.5 h-3.5" />}
              result={twoStageResult.stage2}
              sheetW={pressW}
              sheetH={pressH}
              selectedId={stage2Selected?.id}
              onSelect={(s) => {
                setStage2EditedCount(null);
                onSelectStage2?.(s.id, s.count);
              }}
              unitLabel="منتج"
              dieline={importedDieline}
            />

            {/* Manual Edit Mode (Stage 2 only) */}
            {stage2Selected && (
              <EditableSheetLayout
                sheetW={pressW}
                sheetH={pressH}
                productW={effProductW}
                productH={effProductH}
                gap={gap}
                optimalPieces={effectiveStage2Pieces}
                onCountChange={handleEditedCount}
                importedDieline={importedDieline}
                onDielineImported={setImportedDieline}
                initialEnabled={true}
              />
            )}

            {/* Final result */}
            <div className="rounded-lg border-2 border-primary bg-primary/5 p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span className="text-xs font-bold text-primary">القرار النهائي (حسب التوزيع المختار)</span>
                {stage2Selected && (
                  <div className="mr-auto">
                    <SheetLayoutExportMenu
                      sheetW={pressW}
                      sheetH={pressH}
                      pieces={stage2Selected.pieces}
                      baseName={`final-${pressW}x${pressH}-${effectiveStage2Count}pcs`}
                      dieline={importedDieline}
                      compact
                    />
                  </div>
                )}
              </div>
              <div className="text-center">
                <span className="text-2xl font-bold text-primary">{totalProducts}</span>
                <span className="text-sm text-muted-foreground mr-1">منتج / شيت أساسي</span>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                {effectiveStage2Count} منتج × {stage1Selected?.count ?? 0} شيت طباعة = {totalProducts} منتج
                {stage2EditedCount !== null && stage2EditedCount !== stage2Selected?.count && (
                  <span className="text-amber-600 font-semibold"> (تعديل يدوي)</span>
                )}
              </p>
              {quantity > 0 && sheetsNeeded > 0 && (
                <div className="border-t border-border/50 pt-1.5 mt-1.5 text-center">
                  <span className="text-lg font-bold text-primary">{sheetsNeeded}</span>
                  <span className="text-xs text-muted-foreground mr-1">شيت أساسي مطلوب لإنتاج {quantity} قطعة</span>
                </div>
              )}
            </div>
          </div>
        )}

        {ready && !twoStageResult && (
          <p className="text-xs text-muted-foreground text-center">لا يمكن التوزيع بهذه المقاسات</p>
        )}

      </CardContent>
    </Card>
  );
};

const InfoChip = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md bg-muted/40 border border-border/50 px-2 py-1 text-center">
    <p className="text-[9px] text-muted-foreground leading-tight">{label}</p>
    <p className="text-xs font-bold text-foreground leading-tight">{value}</p>
  </div>
);

/* ═══════════════ Stage Section ═══════════════ */
const StageSection = ({
  title,
  icon,
  result,
  sheetW,
  sheetH,
  selectedId,
  onSelect,
  unitLabel,
  dieline,
}: {
  title: string;
  icon: React.ReactNode;
  result: LayoutResult;
  sheetW: number;
  sheetH: number;
  selectedId?: string;
  onSelect: (s: LayoutScenario) => void;
  unitLabel: string;
  dieline?: ParsedDieline | null;
}) => {
  const [showAll, setShowAll] = useState(false);
  if (result.scenarios.length === 0) return null;

  const featuredSet = new Set<number>();
  if (result.recommendedIdx >= 0) featuredSet.add(result.recommendedIdx);
  if (result.maxOutputIdx >= 0) featuredSet.add(result.maxOutputIdx);
  if (result.alternativeIdx >= 0) featuredSet.add(result.alternativeIdx);

  const featured = Array.from(featuredSet).map(i => result.scenarios[i]);
  const others = result.scenarios.filter((_, i) => !featuredSet.has(i));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-primary">
        {icon}
        <span>{title}</span>
        <span className="text-[9px] text-muted-foreground font-normal mr-auto">
          {result.scenarios.length} سيناريو
        </span>
      </div>

      {featured.map(s => (
        <ScenarioCard
          key={s.id}
          scenario={s}
          sheetW={sheetW}
          sheetH={sheetH}
          selected={s.id === selectedId}
          onSelect={() => onSelect(s)}
          unitLabel={unitLabel}
          dieline={dieline}
        />
      ))}

      {others.length > 0 && (
        <>
          <Button variant="ghost" size="sm" className="w-full text-xs gap-1.5" onClick={() => setShowAll(!showAll)}>
            {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showAll ? 'إخفاء البدائل' : `${others.length} بديل إضافي`}
          </Button>
          {showAll && others.map(s => (
            <ScenarioCard
              key={s.id}
              scenario={s}
              sheetW={sheetW}
              sheetH={sheetH}
              selected={s.id === selectedId}
              onSelect={() => onSelect(s)}
              unitLabel={unitLabel}
              dieline={dieline}
            />
          ))}
        </>
      )}
    </div>
  );
};

/* ═══════════════ Category Badge ═══════════════ */
const CategoryBadge = ({ category }: { category?: LayoutScenario['category'] }) => {
  if (!category) return null;
  const map = {
    recommended: { label: 'موصى به', className: 'bg-primary text-primary-foreground' },
    'max-output': { label: 'أعلى إنتاج', className: 'bg-emerald-600 text-white' },
    alternative: { label: 'بديل', className: 'bg-muted text-foreground border border-border' },
  } as const;
  const c = map[category];
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${c.className}`}>{c.label}</span>;
};

/* ═══════════════ Scenario Card ═══════════════ */
const ScenarioCard = ({
  scenario,
  sheetW,
  sheetH,
  selected,
  onSelect,
  unitLabel,
  dieline,
}: {
  scenario: LayoutScenario;
  sheetW: number;
  sheetH: number;
  selected: boolean;
  onSelect: () => void;
  unitLabel: string;
  dieline?: ParsedDieline | null;
}) => {
  const isRecommended = scenario.category === 'recommended';
  const isMaxOutput = scenario.category === 'max-output';

  // Visual-only landscape orientation: if the sheet is portrait, rotate the
  // preview 90° so it always shows horizontally — data, math, and piece coords stay untouched.
  const isPortrait = sheetH > sheetW;
  const dispW = isPortrait ? sheetH : sheetW;
  const dispH = isPortrait ? sheetW : sheetH;

  const maxSvgWidth = 540;
  const maxSvgHeight = 320;
  const scale = Math.min(maxSvgWidth / dispW, maxSvgHeight / dispH);
  const svgW = dispW * scale;
  const svgH = dispH * scale;

  const borderClass = selected
    ? 'border-primary ring-2 ring-primary/40 bg-primary/10 shadow-md'
    : isRecommended
      ? 'border-primary/40 bg-primary/5 hover:shadow-sm'
      : isMaxOutput
        ? 'border-emerald-500/40 bg-emerald-500/5 hover:shadow-sm'
        : 'border-border/60 bg-muted/10 hover:bg-muted/20';

  const fillColor = selected || isRecommended
    ? 'hsl(var(--primary) / 0.22)'
    : isMaxOutput
      ? 'hsl(142 76% 36% / 0.22)'
      : 'hsl(var(--accent) / 0.18)';
  const strokeColor = selected || isRecommended
    ? 'hsl(var(--primary))'
    : isMaxOutput
      ? 'hsl(142 76% 36%)'
      : 'hsl(var(--accent))';

  // Extract inner content + viewBox from imported dieline so we can embed it
  // inside a nested <svg> (which handles SVG namespace + aspect ratio natively).
  let dielineInner: string | null = null;
  let dielineVB = '0 0 1 1';
  if (dieline?.svgMarkup) {
    const vbMatch = dieline.svgMarkup.match(/viewBox\s*=\s*"([^"]+)"/);
    if (vbMatch) dielineVB = vbMatch[1];
    dielineInner = dieline.svgMarkup.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  }
  const dlW = dieline?.width || 0;
  const dlH = dieline?.height || 0;

  // Visual usage bar color
  const usagePct = Math.min(100, Math.max(0, scenario.usagePercent));
  const usageBarColor = usagePct >= 85
    ? 'bg-emerald-500'
    : usagePct >= 65
      ? 'bg-primary'
      : usagePct >= 40
        ? 'bg-amber-500'
        : 'bg-destructive/70';

  const padX = Math.max(dispW * 0.08, 2.5);
  const padY = Math.max(dispH * 0.12, 3.5);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-right rounded-lg border p-3 space-y-2.5 transition-all hover:border-primary/60 cursor-pointer ${borderClass}`}
    >
      <div className="flex items-center justify-between flex-wrap gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          {selected && <CheckCircle2 className="w-4 h-4 text-primary" />}
          {!selected && isRecommended && <Trophy className="w-4 h-4 text-yellow-500" />}
          {scenario.rotated && (
            <span title="القطع مدورة" className="inline-flex items-center justify-center w-5 h-5 rounded bg-muted text-muted-foreground">
              <RotateCw className="w-3 h-3" />
            </span>
          )}
          <span className="text-sm font-semibold">{scenario.label}</span>
          <CategoryBadge category={scenario.category} />
          {selected && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
              مُطبَّق على الحساب
            </span>
          )}
          {scenario.nestedAdded && scenario.nestedAdded > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white">
              استغلال فراغات +{scenario.nestedAdded}
            </span>
          )}
          {dieline && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white">
              قالب مُحمَّل
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-extrabold tabular-nums ${selected || isRecommended ? 'text-primary' : 'text-foreground'}`}>
            {scenario.count}
          </span>
          <span className="text-[10px] text-muted-foreground">{unitLabel}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
        <div className="rounded bg-background/60 border border-border/40 px-1.5 py-1 text-center">
          <p className="text-muted-foreground leading-none">الترتيب</p>
          <p className="font-bold text-foreground tabular-nums">{scenario.cols} × {scenario.rows}</p>
        </div>
        <div className="rounded bg-background/60 border border-border/40 px-1.5 py-1 text-center">
          <p className="text-muted-foreground leading-none">الاستغلال</p>
          <p className="font-bold text-foreground tabular-nums">{scenario.usagePercent.toFixed(1)}%</p>
        </div>
        <div className="rounded bg-background/60 border border-border/40 px-1.5 py-1 text-center">
          <p className="text-muted-foreground leading-none">الهدر</p>
          <p className="font-bold text-foreground tabular-nums">{scenario.wasteArea.toFixed(0)} سم²</p>
        </div>
      </div>

      {/* Usage bar */}
      <div className="space-y-0.5">
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${usageBarColor} transition-all rounded-full`}
            style={{ width: `${usagePct}%` }}
          />
        </div>
        {scenario.baseCount !== undefined && (
          <p className="text-[9px] text-amber-600 font-semibold text-center">
            أساسي: {scenario.baseCount} → بعد التحسين: {scenario.count}
          </p>
        )}
      </div>

      <div className="flex justify-center bg-background rounded-md border border-border/60 p-2 overflow-visible shadow-inner">
        <svg
          width={svgW}
          height={svgH}
          viewBox={`${-padX} ${-padY} ${dispW + padX * 2} ${dispH + padY * 2.4}`}
          className="block"
          style={{ maxWidth: '100%', height: 'auto' }}
        >
          <defs>
            <pattern id={`grid-${scenario.id}`} width={5} height={5} patternUnits="userSpaceOnUse">
              <path d="M 5 0 L 0 0 0 5" fill="none" stroke="hsl(var(--border))" strokeWidth={0.08} />
            </pattern>
          </defs>
          {/* When portrait, rotate the entire scene 90° clockwise so it displays landscape. */}
          <g transform={isPortrait ? `translate(${sheetH} 0) rotate(90)` : undefined}>
            <rect x={0} y={0} width={sheetW} height={sheetH} fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth={0.6 / scale} rx={0.5} />
            <rect x={0} y={0} width={sheetW} height={sheetH} fill={`url(#grid-${scenario.id})`} opacity={0.6} />
            {scenario.pieces.map((p) => {
              // True silhouette from dieline — matches manual editor view.
              const dlShape = dieline?.shape ?? null;
              let outlinePath: string | null = null;
              if (dlShape) {
                const base = p.rotated
                  ? rotateRings90(dlShape.rings, dlShape.width, dlShape.height)
                  : dlShape.rings;
                const rings = translateRings(base, p.x, p.y);
                outlinePath = rings.map(polygonToSvgPath).join(' ');
              }
              const labelSize = Math.min(p.w, p.h) * 0.32;
              return (
                <g key={p.index}>
                  {outlinePath ? (
                    <path
                      d={outlinePath}
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={0.35 / scale}
                      fillRule="evenodd"
                    />
                  ) : (
                    <rect
                      x={p.x}
                      y={p.y}
                      width={p.w}
                      height={p.h}
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={0.35 / scale}
                      rx={0.2}
                    />
                  )}
                  {dielineInner && dlW > 0 && dlH > 0 && (
                    <svg
                      x={p.x}
                      y={p.y}
                      width={p.w}
                      height={p.h}
                      viewBox={dielineVB}
                      preserveAspectRatio="none"
                      style={{ pointerEvents: 'none', overflow: 'visible' }}
                      dangerouslySetInnerHTML={{ __html: dielineInner }}
                    />
                  )}
                  {/* Piece number badge — always visible, even with dieline */}
                  <g transform={isPortrait ? `rotate(-90, ${p.x + p.w / 2}, ${p.y + p.h / 2})` : undefined}>
                    <circle
                      cx={p.x + p.w / 2}
                      cy={p.y + p.h / 2}
                      r={Math.min(p.w, p.h) * 0.18}
                      fill="hsl(var(--background) / 0.85)"
                      stroke={strokeColor}
                      strokeWidth={0.15 / scale}
                    />
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
                      {p.index}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
          {/* Dimension labels follow the displayed orientation (always landscape) */}
          <text x={dispW / 2} y={-1} textAnchor="middle" fontSize={Math.max(1.8, dispW * 0.028)} fill="hsl(var(--muted-foreground))" fontFamily="'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif" fontWeight="600">
            {isPortrait ? sheetH : sheetW} سم
          </text>
          <text x={-1} y={dispH / 2} textAnchor="middle" fontSize={Math.max(1.8, dispH * 0.028)} fill="hsl(var(--muted-foreground))" fontFamily="'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif" fontWeight="600" transform={`rotate(-90, -1, ${dispH / 2})`}>
            {isPortrait ? sheetW : sheetH} سم
          </text>
        </svg>
      </div>
    </button>
  );
};

/* ═══════════════ Production Comparison (multi-scenario) ═══════════════ */
/**
 * Compares production strategies for the smart engine:
 *   • Direct (A): print on the machine sheet directly (1 input sheet).
 *   • Subdivisions (B…): try several press-sheet sizes ≤ machine that tile the
 *     base sheet, picking the combination with max total products.
 *
 * Total = (products per press sheet) × (press sheets per base sheet).
 * The scenario with the highest total is highlighted as "أفضل إنتاج".
 */
const ProductionComparison = ({
  masterW,
  masterH,
  machineW,
  machineH,
  currentPressW,
  currentPressH,
  scenarios,
  onSelect,
}: {
  masterW: number;
  masterH: number;
  machineW: number;
  machineH: number;
  currentPressW: number;
  currentPressH: number;
  scenarios: ProductionScenarios;
  onSelect: (s: PressSizeScenario) => void;
}) => {
  const { direct, subdivisions, best } = scenarios;
  // Show top N alternative subdivisions to keep UI tidy
  const TOP_N = 4;
  // Filter out the subdivision that's literally the machine size (it duplicates "direct")
  // unless it produces more pieces (it shouldn't, by definition).
  const subList = subdivisions.filter(
    (s) => !(s.isMachineSize && s.pressPerBase === 1),
  );
  const [showAll, setShowAll] = useState(false);
  const visibleSubs = showAll ? subList : subList.slice(0, TOP_N);

  const sameInput = Math.abs(masterW - machineW) < 0.01 && Math.abs(masterH - machineH) < 0.01;

  // Match a scenario to current press size (either orientation)
  const isSelected = (s: PressSizeScenario) =>
    (Math.abs(s.pressW - currentPressW) < 0.05 && Math.abs(s.pressH - currentPressH) < 0.05) ||
    (Math.abs(s.pressW - currentPressH) < 0.05 && Math.abs(s.pressH - currentPressW) < 0.05);

  if (direct.total === 0 && subList.length === 0) return null;

  return (
    <div className="rounded-lg border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-emerald-500/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Brain className="w-4 h-4 text-primary" />
        <span className="text-xs font-bold text-primary">مقارنة سيناريوهات الإنتاج</span>
        <span className="text-[10px] text-muted-foreground mr-auto">
          النظام يختار الأفضل تلقائياً — اضغط لاختيار يدوي
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <ScenarioBox
          tag="A"
          tagClass="bg-emerald-600 text-white"
          icon={<Zap className="w-3.5 h-3.5" />}
          title="مباشر — طباعة على شيت الماكينة"
          sheetLabel={`شيت الإدخال: ${machineW}×${machineH} سم`}
          productsPerSheet={direct.productsPerPress}
          sheetsCount={direct.pressPerBase}
          sheetsLabel="شيت طباعة من الإدخال"
          total={direct.total}
          isBest={best.id === direct.id}
          isSelected={isSelected(direct)}
          onSelect={() => onSelect(direct)}
          accent="emerald"
          baseW={machineW}
          baseH={machineH}
          pressW={direct.pressW}
          pressH={direct.pressH}
        />

        {visibleSubs.map((s, i) => (
          <ScenarioBox
            key={s.id}
            tag={`B${i + 1}`}
            tagClass="bg-blue-600 text-white"
            icon={<Scissors className="w-3.5 h-3.5" />}
            title={`تقسيم الشيت الأساسي → ${s.label}`}
            sheetLabel={`الشيت الأساسي: ${masterW}×${masterH} → ${s.pressPerBase} شيت طباعة (${s.label})`}
            productsPerSheet={s.productsPerPress}
            sheetsCount={s.pressPerBase}
            sheetsLabel="شيت طباعة من الشيت الأساسي"
            total={s.total}
            isBest={best.id === s.id}
            isSelected={isSelected(s)}
            onSelect={() => onSelect(s)}
            accent="primary"
            baseW={masterW}
            baseH={masterH}
            pressW={s.pressW}
            pressH={s.pressH}
          />
        ))}
      </div>

      {subList.length > TOP_N && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[10px] w-full"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? (
            <>
              <ChevronUp className="w-3 h-3 ml-1" />
              عرض أقل
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3 ml-1" />
              عرض المزيد ({subList.length - TOP_N})
            </>
          )}
        </Button>
      )}

      {sameInput && (
        <p className="text-[10px] text-muted-foreground text-center">
          الشيت الأساسي ومقاس الماكينة متطابقان — قد لا يوجد فرق بين السيناريوهات.
        </p>
      )}
      <p className="text-[10px] text-muted-foreground text-center bg-background/50 rounded px-2 py-1">
        المعادلة: <span className="font-semibold text-foreground">إجمالي القطع = (قطع داخل شيت الطباعة) × (عدد شيتات الطباعة من الشيت الأساسي)</span>
      </p>
    </div>
  );
};

const ScenarioBox = ({
  tag,
  tagClass,
  icon,
  title,
  sheetLabel,
  productsPerSheet,
  sheetsCount,
  sheetsLabel,
  total,
  isBest,
  isSelected,
  onSelect,
  accent,
  disabled,
  baseW,
  baseH,
  pressW,
  pressH,
}: {
  tag: string;
  tagClass: string;
  icon: React.ReactNode;
  title: string;
  sheetLabel: string;
  productsPerSheet: number;
  sheetsCount: number;
  sheetsLabel: string;
  total: number;
  isBest: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  accent: 'emerald' | 'primary';
  disabled?: boolean;
  baseW: number;
  baseH: number;
  pressW: number;
  pressH: number;
}) => {
  const accentClass =
    accent === 'emerald'
      ? 'border-emerald-500/40 bg-emerald-500/5'
      : 'border-primary/40 bg-primary/5';
  const bestClass = isBest
    ? 'ring-2 ring-yellow-400 border-yellow-500 bg-yellow-50/50 dark:bg-yellow-500/10'
    : '';
  const selectedClass = isSelected
    ? 'ring-2 ring-primary border-primary shadow-lg'
    : '';
  const totalColor =
    accent === 'emerald' ? 'text-emerald-700 dark:text-emerald-400' : 'text-primary';
  const cutColor = accent === 'emerald' ? 'hsl(142 76% 36%)' : 'hsl(var(--primary))';

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled || !onSelect}
      className={`relative w-full text-right rounded-lg border p-3 space-y-2 transition-all hover:shadow-md hover:border-primary/60 cursor-pointer ${accentClass} ${bestClass} ${selectedClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${isBest ? 'shadow-md' : ''}`}
    >
      {isBest && (
        <div className="absolute -top-2 right-3 flex items-center gap-1 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md z-10">
          <Trophy className="w-3 h-3" />
          أفضل إنتاج
        </div>
      )}
      {isSelected && (
        <div className="absolute -top-2 left-3 flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md z-10">
          <CheckCircle2 className="w-3 h-3" />
          مُطبَّق
        </div>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tagClass}`}>
          سيناريو {tag}
        </span>
        {icon}
        <span className="text-xs font-semibold flex-1">{title}</span>
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug">{sheetLabel}</p>

      {/* Mini visual: base sheet with cut lines for press sheets */}
      <BaseSheetCutDiagram
        baseW={baseW}
        baseH={baseH}
        pressW={pressW}
        pressH={pressH}
        cutColor={cutColor}
        productsPerPress={productsPerSheet}
      />

      <div className="grid grid-cols-2 gap-1.5 text-[10px] pt-1 border-t border-border/40">
        <div className="text-center rounded bg-background/60 py-1">
          <p className="text-muted-foreground leading-none">قطع/شيت طباعة</p>
          <p className="font-bold text-base text-foreground tabular-nums">{productsPerSheet}</p>
        </div>
        <div className="text-center rounded bg-background/60 py-1">
          <p className="text-muted-foreground leading-none">شيتات الطباعة</p>
          <p className="font-bold text-base text-foreground tabular-nums">{sheetsCount || '—'}</p>
        </div>
      </div>
      <div className="text-center pt-1.5 border-t border-border/40">
        <p className="text-[10px] text-muted-foreground">{sheetsLabel}</p>
        <p className={`text-3xl font-extrabold tabular-nums ${totalColor}`}>
          {total > 0 ? total : '—'}
        </p>
        <p className="text-[10px] text-muted-foreground">إجمالي القطع</p>
      </div>
    </button>
  );
};

/* ═══════════════ Mini base-sheet diagram with cut lines ═══════════════ */
const BaseSheetCutDiagram = ({
  baseW,
  baseH,
  pressW,
  pressH,
  cutColor,
  productsPerPress,
}: {
  baseW: number;
  baseH: number;
  pressW: number;
  pressH: number;
  cutColor: string;
  productsPerPress: number;
}) => {
  if (baseW <= 0 || baseH <= 0 || pressW <= 0 || pressH <= 0) return null;

  // Display always landscape
  const isPortrait = baseH > baseW;
  const dispW = isPortrait ? baseH : baseW;
  const dispH = isPortrait ? baseW : baseH;
  const maxW = 280;
  const maxH = 110;
  const scale = Math.min(maxW / dispW, maxH / dispH);
  const svgW = dispW * scale;
  const svgH = dispH * scale;

  // Try both orientations of press inside base, pick the one that fits more.
  const fits = (pw: number, ph: number) => {
    if (pw > baseW + 0.01 || ph > baseH + 0.01) return null;
    const cols = Math.floor(baseW / pw);
    const rows = Math.floor(baseH / ph);
    return { cols, rows, pw, ph, total: cols * rows };
  };
  const a = fits(pressW, pressH);
  const b = fits(pressH, pressW);
  const layout = (a && b ? (a.total >= b.total ? a : b) : a || b) ?? null;

  const padX = Math.max(dispW * 0.05, 2);
  const padY = Math.max(dispH * 0.08, 2);

  return (
    <div className="flex justify-center bg-background/70 rounded border border-border/40 p-1.5 overflow-visible">
      <svg
        width={svgW}
        height={svgH}
        viewBox={`${-padX} ${-padY} ${dispW + padX * 2} ${dispH + padY * 2.2}`}
        className="block"
        style={{ maxWidth: '100%', height: 'auto' }}
      >
        <g transform={isPortrait ? `translate(${baseH} 0) rotate(90)` : undefined}>
          <rect
            x={0}
            y={0}
            width={baseW}
            height={baseH}
            fill="hsl(var(--muted))"
            stroke="hsl(var(--border))"
            strokeWidth={0.4 / scale}
            rx={0.4}
          />
          {layout &&
            Array.from({ length: layout.cols * layout.rows }).map((_, i) => {
              const c = i % layout.cols;
              const r = Math.floor(i / layout.cols);
              const x = c * layout.pw;
              const y = r * layout.ph;
              return (
                <g key={i}>
                  <rect
                    x={x}
                    y={y}
                    width={layout.pw}
                    height={layout.ph}
                    fill={cutColor}
                    fillOpacity={0.12}
                    stroke={cutColor}
                    strokeWidth={0.5 / scale}
                    strokeDasharray={`${1.2 / scale} ${0.8 / scale}`}
                  />
                  <text
                    x={x + layout.pw / 2}
                    y={y + layout.ph / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={cutColor}
                    fontSize={Math.min(layout.pw, layout.ph) * 0.28}
                    fontWeight="bold"
                    fontFamily="'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif"
                    transform={isPortrait ? `rotate(-90, ${x + layout.pw / 2}, ${y + layout.ph / 2})` : undefined}
                  >
                    {productsPerPress}
                  </text>
                </g>
              );
            })}
        </g>
      </svg>
    </div>
  );
};

export default SheetLayoutPreview;
