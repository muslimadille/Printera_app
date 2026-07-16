import { useEffect, useMemo, useState } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Box, Layers, Sparkles, Save, Copy, Trash2, Upload, ChevronDown, ChevronUp,
  Ruler, Maximize2, Settings2, Library, Download, FileCode2, FileText,
  Move, Plus, Calculator,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  computeDieCut, buildPreviewTiles,
  DEFAULT_CALIBRATION, DEFAULT_BASE_INPUTS,
  type DieCutInputs, type DieCutResult, type StretchZones,
} from '@/lib/dieCutEngine';
import { buildDieCutSvg, downloadText, type DieCutExportMode } from '@/lib/dieCutExport';
import defaultDieSvgMarkup from '@/assets/diecut-default.svg?raw';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ColorCountSelect from '@/components/ColorCountSelect';
import { usePrintingStore, type ExtraColorConfig, type CalculatorInputs, type FinishingItem } from '@/store/printingStore';
import { calculateQuote } from '@/lib/calcEngine';
import { calcTypeLabels } from '@/lib/calcTypeLabels';
import { DollarSign } from 'lucide-react';
import { usePreviewSettings } from '@/hooks/usePreviewSettings';

/* ── Types ── */
interface DieTemplate {
  id: string;
  name: string;
  svg: string;                  // raw inline SVG markup (visual only)
  inputs: DieCutInputs;         // last-saved working values
  baseInputs: DieCutInputs;     // reference snapshot used for zone-based stretching
  createdAt: string;
}

const STORAGE_KEY = 'printCalc_dieCutTemplates';

/* ── Helpers ── */
function loadBuiltInSvg(): string {
  return defaultDieSvgMarkup;
}

function loadTemplates(): DieTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw) as DieTemplate[];
      // Back-fill baseInputs / horizontalInterlock for templates saved by older versions.
      return list.map(t => ({
        ...t,
        inputs: { horizontalInterlock: 0, ...t.inputs },
        baseInputs: t.baseInputs
          ? { horizontalInterlock: 0, ...t.baseInputs }
          : { horizontalInterlock: 0, ...t.inputs },
      }));
    }
  } catch {}
  return [];
}

function saveTemplates(list: DieTemplate[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

/* ── Section Header ── */
const SectionHeader = ({ title, icon: Icon }: { title: string; icon: any }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="p-2 rounded-lg bg-primary/10 text-primary"><Icon className="w-4 h-4" /></div>
    <h3 className="font-semibold text-foreground text-sm">{title}</h3>
  </div>
);

/* ── Number field ── */
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

/* ── Sheet preview — zone-based n-patch stretching ── */
const SheetPreview = ({
  result, svg, zones,
}: {
  result: DieCutResult; svg: string; zones: StretchZones;
}) => {
  const PAD = 30;
  const longSide = result.longSide;
  const shortSide = result.shortSide;
  const vbW = longSide + PAD * 2;
  const vbH = shortSide + PAD * 2;

  // Encode SVG as data URI for use in <image> tags inside clipped groups.
  const svgUri = useMemo(() => {
    if (!svg) return '';
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }, [svg]);

  const best = result.best;
  const layoutW = best.layoutW;
  const layoutH = best.layoutH;

  // For each piece we tile the source SVG across the (rows × cols) of zones.
  // Each zone tile clips to its CURRENT rect and scales the source so the
  // matching BASE rect lands exactly inside. When current == base, the
  // transform reduces to the legacy uniform render (pixel-identical).
  const hZones = zones.horizontal;
  const vZones = zones.vertical;
  const baseFW = zones.baseFootprintW;
  const baseFH = zones.baseFootprintH;
  const previewTiles = buildPreviewTiles(zones);

  const renderPiece = (p: DieCutResult['pieces'][number]) => {
    const px = PAD + p.x;
    const py = PAD + p.y;
    const fw = p.footprintW;
    const fh = p.footprintH;
    const zoneW = zones.footprintW;
    const zoneH = zones.footprintH;
    const pieceTransform = p.rotated
      ? `translate(${px + fw} ${py}) rotate(90)`
      : `translate(${px} ${py})`;

    if (!svgUri || baseFW <= 0 || baseFH <= 0) {
      return (
        <g key={p.index}>
          <rect x={px} y={py} width={fw} height={fh}
            fill="hsl(var(--primary) / 0.08)"
            stroke="hsl(var(--primary))" strokeWidth={0.4} />
          <text x={px + fw / 2} y={py + fh / 2}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={Math.min(fw, fh) * 0.18} fontWeight={700}
            fill="hsl(var(--primary))" opacity={0.55}>
            {p.index}
          </text>
        </g>
      );
    }

    const renderImageTile = (
      key: string,
      cx: number, cy: number,
      cw: number, ch: number,
      srcAbsX: number, srcAbsY: number,
      sw: number, sh: number,
      opacity = 0.92,
    ) => {
      if (cw <= 0 || ch <= 0) return null;
      const scaleX = cw / (sw || 0.0001);
      const scaleY = ch / (sh || 0.0001);
      const imgX = cx - srcAbsX * scaleX;
      const imgY = cy - srcAbsY * scaleY;
      return (
        <svg key={key} x={cx} y={cy} width={cw} height={ch}
          viewBox={`${cx} ${cy} ${cw} ${ch}`} overflow="hidden">
          <image href={svgUri}
            x={imgX} y={imgY} width={baseFW * scaleX} height={baseFH * scaleY}
            preserveAspectRatio="none" opacity={opacity} />
        </svg>
      );
    };

    // STRICT: Preview renders ONLY the final tile list from buildPreviewTiles.
    // Export consumes the exact same list, so the two can never diverge.
    const renderTiles = () =>
      previewTiles.map(t => renderImageTile(
        `pt-${t.k}`, t.tx, t.ty, t.tw, t.th, t.sx, t.sy, t.sw, t.sh,
      ));

    return (
      <g key={p.index}>
        <g transform={pieceTransform}>
        {renderTiles()}
        </g>
        <rect x={px} y={py} width={fw || zoneW} height={fh || zoneH}
          fill="none" stroke="hsl(var(--primary) / 0.25)" strokeWidth={0.35} />
        <text x={px + fw / 2} y={py + fh / 2}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={Math.min(fw, fh) * 0.18} fontWeight={700}
          fill="hsl(var(--primary))" opacity={0.5}
          style={{ pointerEvents: 'none' }}>
          {p.index}
        </text>
      </g>
    );
  };

  return (
    <div className="w-full bg-gradient-to-br from-muted/30 to-muted/10 rounded-xl border border-border/50 p-3 sm:p-4">
      <svg viewBox={`0 0 ${vbW} ${vbH}`} className="w-full h-auto"
        style={{ maxHeight: '70vh' }}>
        <rect x={PAD} y={PAD} width={longSide} height={shortSide}
          fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth={1.5} />
        {layoutW > 0 && layoutH > 0 && (
          <rect x={PAD} y={PAD} width={layoutW} height={layoutH}
            fill="none" stroke="hsl(var(--primary) / 0.35)"
            strokeWidth={0.6} strokeDasharray="3 3" />
        )}
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
          مقاس التوزيع: {(layoutW / 10).toFixed(2)} × {(layoutH / 10).toFixed(2)} سم
        </Badge>
        <Badge variant="outline">
          المتبقي: {best.remainingW.toFixed(1)} × {best.remainingH.toFixed(1)} مم
        </Badge>
        <Badge variant="outline">
          استغلال: {(best.utilization * 100).toFixed(1)}٪
        </Badge>
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────── */
/*  Main calculator                                            */
/* ──────────────────────────────────────────────────────────── */
const DieCutCalculator = ({ isAdmin = true }: { isAdmin?: boolean } = {}) => {
  const { showNestingPreview, show3DPreview } = usePreviewSettings();

  const [pieceSvg, setPieceSvg] = useState<string>('');
  const [templates, setTemplates] = useState<DieTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string>('');
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [zonesOpen, setZonesOpen] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [saveDialog, setSaveDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  // Working inputs (live edits).
  const [inputs, setInputs] = useState<DieCutInputs>({ ...DEFAULT_BASE_INPUTS });
  // Base profile = the reference dimensions the active template was calibrated against.
  // Stretch zones are computed relative to this. When no template is active we use
  // the default base — which equals the initial `inputs`, so preview is identical to
  // legacy at the reference values.
  const [baseInputs, setBaseInputs] = useState<DieCutInputs>({ ...DEFAULT_BASE_INPUTS });

  useEffect(() => {
    setPieceSvg(loadBuiltInSvg());
    setTemplates(loadTemplates());
  }, []);

  // Debounce heavy compute: typing updates `inputs` instantly for UI,
  // but layout/packing only re-runs 250ms after the user stops typing.
  const debInputs = useDebouncedValue(inputs, 250);
  const debBaseInputs = useDebouncedValue(baseInputs, 250);
  const result = useMemo(() => computeDieCut(debInputs, debBaseInputs), [debInputs, debBaseInputs]);
  const zones = result.geometry.zones;

  const setField = <K extends keyof DieCutInputs>(key: K, value: DieCutInputs[K]) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  /* ── Cost calculation (Paper / Quantity / Colors) ── */
  const paperTypes = usePrintingStore(s => s.paperTypes);
  const priceSettings = usePrintingStore(s => s.priceSettings);
  // Combined paper key: `${name}|${grammage}|${sizeName}` (مطابق لتبويبة تكلفة صنف)
  const [costPaperKey, setCostPaperKey] = useState<string>('');
  const [costQuantity, setCostQuantity] = useState<number>(1000);
  const [costColorCount, setCostColorCount] = useState<number>(4);
  const [costExtraColor, setCostExtraColor] = useState<ExtraColorConfig>({
    extraColorCalcType: 'per_1000', extraColorPrice: 0, extraColorExtra1000: 0, extraColorCount: 1,
  });
  const [costPrintedFaces, setCostPrintedFaces] = useState<number>(1);

  // بيانات إضافية
  const [additionalOpen, setAdditionalOpen] = useState(false);
  const [costFacesDifferent, setCostFacesDifferent] = useState(false);
  const [costWaste, setCostWaste] = useState(0);
  const [costWasteMode, setCostWasteMode] = useState<'number' | 'percent'>('percent');
  const [costWasteInCosts, setCostWasteInCosts] = useState(false);
  const [costCellophaneFaces, setCostCellophaneFaces] = useState(0);
  const [costDieCut, setCostDieCut] = useState(false);
  const [costMoldPrice, setCostMoldPrice] = useState(0);

  // التشطيبات
  const [finishingOpen, setFinishingOpen] = useState(false);
  const [costFinishing, setCostFinishing] = useState<FinishingItem[]>([]);

  // Default selection on first paperTypes load
  useEffect(() => {
    if (!costPaperKey && paperTypes.length > 0) {
      const first = paperTypes[0];
      const e = first.entries[0];
      if (e) setCostPaperKey(`${first.name}|${e.grammage}|${e.sizeName}`);
    }
  }, [paperTypes, costPaperKey]);

  // Paper combobox options
  const paperOptions = useMemo(() => {
    const list: { label: string; value: string }[] = [];
    paperTypes.forEach(pt => pt.entries.forEach(e => {
      list.push({
        label: `${pt.name} - ${e.grammage} جرام - ${e.sizeName}`,
        value: `${pt.name}|${e.grammage}|${e.sizeName}`,
      });
    }));
    return list;
  }, [paperTypes]);

  const parsedPaperKey = useMemo(() => {
    if (!costPaperKey) return null;
    const [name, gram, size] = costPaperKey.split('|');
    return { name, grammage: Number(gram), sizeName: size };
  }, [costPaperKey]);
  const selectedPaper = parsedPaperKey ? paperTypes.find(p => p.name === parsedPaperKey.name) : undefined;
  const selectedEntry = parsedPaperKey && selectedPaper
    ? selectedPaper.entries.find(e => e.grammage === parsedPaperKey.grammage && e.sizeName === parsedPaperKey.sizeName)
    : undefined;

  const costResult = useMemo(() => {
    if (!selectedEntry || result.best.total === 0 || costQuantity <= 0 || !parsedPaperKey) return null;
    const calcInputs: CalculatorInputs & { baseCuts?: number } = {
      paperType: parsedPaperKey.name,
      purchaseSize: selectedEntry.sizeName,
      grammage: selectedEntry.grammage,
      printWidth: selectedEntry.width,
      printHeight: selectedEntry.height,
      quantity: costQuantity,
      cutsPerSheet: result.best.total,
      wastePercent: costWaste,
      wasteMode: costWasteMode,
      colorCount: costColorCount,
      printedFaces: costPrintedFaces,
      facesDifferent: costFacesDifferent,
      cellophaneFaces: costCellophaneFaces,
      dieCut: costDieCut,
      moldPrice: costMoldPrice,
      wasteInCosts: costWasteInCosts,
      ...costExtraColor,
      baseCuts: 1,
    } as any;
    return calculateQuote(calcInputs, costFinishing, paperTypes, priceSettings);
  }, [selectedEntry, parsedPaperKey, result.best.total, costQuantity, costColorCount, costPrintedFaces, costExtraColor, costFacesDifferent, costWaste, costWasteMode, costWasteInCosts, costCellophaneFaces, costDieCut, costMoldPrice, costFinishing, paperTypes, priceSettings]);

  const addFinishing = () => setCostFinishing(prev => [...prev, {
    name: 'تشطيب', enabled: true, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '',
  }]);
  const updateFinishing = (idx: number, u: Partial<FinishingItem>) =>
    setCostFinishing(prev => prev.map((f, i) => i === idx ? { ...f, ...u } : f));
  const removeFinishing = (idx: number) => setCostFinishing(prev => prev.filter((_, i) => i !== idx));

  /* ── Template ops ── */
  const applyTemplate = (t: DieTemplate) => {
    setActiveTemplateId(t.id);
    setPieceSvg(t.svg || pieceSvg);
    setInputs({ horizontalInterlock: 0, ...t.inputs });
    setBaseInputs({ horizontalInterlock: 0, ...(t.baseInputs || t.inputs) });
    toast.success(`تم تطبيق القالب: ${t.name}`);
  };

  const cloneTemplate = (t: DieTemplate) => {
    const copy: DieTemplate = {
      ...t,
      id: crypto.randomUUID(),
      name: `${t.name} (نسخة)`,
      // Clone preserves SVG, calibration, stretch reference (baseInputs),
      // offsets and pitch rules — then recomputes layout on the current inputs.
      inputs: { ...t.inputs },
      baseInputs: { ...(t.baseInputs || t.inputs) },
      createdAt: new Date().toISOString(),
    };
    const next = [copy, ...templates];
    setTemplates(next);
    saveTemplates(next);
    applyTemplate(copy);
    toast.success('تم استنساخ القالب — يمكنك الآن تعديل الأبعاد');
  };

  const deleteTemplate = (id: string) => {
    const next = templates.filter(t => t.id !== id);
    setTemplates(next);
    saveTemplates(next);
    if (activeTemplateId === id) setActiveTemplateId('');
    toast.success('تم حذف القالب');
  };

  const saveAsTemplate = () => {
    const name = newTemplateName.trim();
    if (!name) { toast.error('أدخل اسماً للقالب'); return; }
    // The CURRENT working dimensions become the template's base profile —
    // this captures the proven layout as the new reference for zone stretching.
    const snapshot = { ...inputs };
    const t: DieTemplate = {
      id: crypto.randomUUID(),
      name,
      svg: pieceSvg,
      inputs: snapshot,
      baseInputs: snapshot,
      createdAt: new Date().toISOString(),
    };
    const next = [t, ...templates];
    setTemplates(next);
    saveTemplates(next);
    setActiveTemplateId(t.id);
    setBaseInputs(snapshot);
    setSaveDialog(false);
    setNewTemplateName('');
    toast.success('تم حفظ القالب — أصبح هو المرجع لتمدد المناطق');
  };

  const onUploadSvg = async (file: File) => {
    const text = await file.text();
    if (!text.includes('<svg')) { toast.error('الملف ليس SVG صالحاً'); return; }
    setPieceSvg(text);
    toast.success('تم تحميل الـ SVG');
  };

  const runExport = () => {
    if (result.best.total === 0) {
      toast.error('لا توجد قطع للتصدير — راجع الأبعاد');
      return;
    }
    const activeName = templates.find(t => t.id === activeTemplateId)?.name;
    try {
      // Export Visible Layout — WYSIWYG. Uses the exact same geometry as Preview.
      const svg = buildDieCutSvg({
        inputs, result, pieceSvg, templateName: activeName,
      });
      const stamp = new Date().toISOString().slice(0, 10);
      const base = (activeName || 'diecut').replace(/[^\w\u0600-\u06FF\-_.]+/g, '_');
      downloadText(`${base}_${result.best.total}pc_${stamp}.svg`, 'image/svg+xml;charset=utf-8', svg);
      toast.success('تم تصدير العرض المرئي');
    } catch (err) {
      console.error('Die Cut export failed:', err);
      toast.error(`فشل التصدير: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`);
    }
  };

  /* ── Render ── */
  const best = result.best;
  const usingManualX = (inputs.manualPitchX ?? 0) > 0;
  const usingManualY = (inputs.manualPitchY ?? 0) > 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header bar */}
      <Card className="border-primary/20 bg-gradient-to-br from-card via-card to-primary/5">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/15 text-primary">
                <Box className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-foreground">
                  Die Cut — حاسبة توزيع القوالب الديناميكية
                </h2>
                <p className="text-[11px] sm:text-xs text-muted-foreground">
                  Stretch Zones · Calibration · Pitch Override · مكتبة قوالب
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline"
                onClick={() => setShowLibrary(v => !v)} className="gap-1.5">
                <Library className="w-3.5 h-3.5" />
                المكتبة ({templates.length})
              </Button>
              <Button size="sm" variant="outline"
                onClick={runExport} className="gap-1.5">
                <Download className="w-3.5 h-3.5" />
                تصدير التوزيع
              </Button>
              <Button size="sm" variant="default"
                onClick={() => setSaveDialog(true)} className="gap-1.5">
                <Save className="w-3.5 h-3.5" />
                حفظ كقالب
              </Button>
            </div>
          </div>

          {showLibrary && (
            <div className="mt-4 pt-4 border-t border-border/50">
              {templates.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  لا توجد قوالب محفوظة بعد. عدّل الأبعاد ثم اضغط "حفظ كقالب".
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {templates.map(t => (
                    <div key={t.id}
                      className={`p-3 rounded-lg border transition-all ${
                        activeTemplateId === t.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border/50 bg-card hover:border-primary/40'
                      }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{t.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            مرجع: {t.baseInputs?.boxLength ?? t.inputs.boxLength}×
                            {t.baseInputs?.boxDepth ?? t.inputs.boxDepth}×
                            {t.baseInputs?.boxHeight ?? t.inputs.boxHeight} مم
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1 mt-2">
                        <Button size="sm" variant="default" className="h-7 text-[11px] flex-1"
                          onClick={() => applyTemplate(t)}>تطبيق</Button>
                        <Button size="sm" variant="outline" className="h-7 px-2"
                          onClick={() => cloneTemplate(t)} title="استنساخ">
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-destructive"
                          onClick={() => deleteTemplate(t.id)} title="حذف">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* ── Left: Inputs ── */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardContent className="p-4 sm:p-5">
              <SectionHeader title="الشيت والتباعد" icon={Ruler} />
              <div className="grid grid-cols-3 gap-3">
                <NumField label="عرض الشيت (مم)" value={inputs.sheetWidth}
                  onChange={v => setField('sheetWidth', v)} />
                <NumField label="ارتفاع الشيت (مم)" value={inputs.sheetHeight}
                  onChange={v => setField('sheetHeight', v)} />
                <NumField label="التباعد (مم)" value={inputs.gap} step={0.5}
                  onChange={v => setField('gap', v)} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                يتم فحص اتجاه الشيت تلقائياً — 70×100 و 100×70 تعطيان نفس النتيجة.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5">
              <SectionHeader title="أبعاد المنتج النهائي" icon={Box} />
              <div className="grid grid-cols-3 gap-3">
                <NumField label="الطول / الواجهة (مم)" value={inputs.boxLength}
                  onChange={v => setField('boxLength', v)} />
                <NumField label="العمق / الجانب (مم)" value={inputs.boxDepth}
                  onChange={v => setField('boxDepth', v)} />
                <NumField label="الارتفاع (مم)" value={inputs.boxHeight}
                  onChange={v => setField('boxHeight', v)} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                تعديل أي بُعد يمدد المناطق المرتبطة به فقط داخل القالب.
              </p>
            </CardContent>
          </Card>

          {/* Calibration (Admin only) */}
          {isAdmin && (
          <Card>
            <CardContent className="p-4 sm:p-5">
              <Collapsible open={calibrationOpen} onOpenChange={setCalibrationOpen}>
                <CollapsibleTrigger className="w-full flex items-center justify-between">
                  <SectionHeader title="عوامل المعايرة (Calibration)" icon={Settings2} />
                  <ChevronDown className={`w-4 h-4 transition-transform ${calibrationOpen ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <NumField label="Width Expansion (مم)"
                      hint="زيادة عرض القالب خارج مجموع الأوجه"
                      value={inputs.sideTrim} step={0.01}
                      onChange={v => setField('sideTrim', v)} />
                    <NumField label="Height Expansion (مم)"
                      hint="زيادة ارتفاع القالب بسبب الألسنة"
                      value={inputs.verticalTrim} step={0.01}
                      onChange={v => setField('verticalTrim', v)} />
                    <NumField label="Vertical Interlock (مم)"
                      hint="دخول الألسنة بين الصفوف"
                      value={inputs.verticalInterlock} step={0.01}
                      onChange={v => setField('verticalInterlock', v)} />
                    <NumField label="Horizontal Interlock (مم)"
                      hint="تعشيق أفقي بين الأعمدة — اتركه 0 للقالب المرجعي"
                      value={inputs.horizontalInterlock ?? 0} step={0.01}
                      onChange={v => setField('horizontalInterlock', v)} />
                  </div>
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Pitch Override (الأولوية: يدوي ← تلقائي)
                      </p>
                      <div className="flex gap-1">
                        {usingManualX && (
                          <Badge variant="outline" className="text-[10px] h-5 border-primary/40 text-primary">
                            Manual X
                          </Badge>
                        )}
                        {usingManualY && (
                          <Badge variant="outline" className="text-[10px] h-5 border-primary/40 text-primary">
                            Manual Y
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <NumField
                        label={`Pitch X يدوي (تلقائي: ${result.autoPitchX.toFixed(2)} مم)`}
                        hint="0 = استخدام الحساب التلقائي"
                        value={inputs.manualPitchX ?? 0} step={0.01}
                        onChange={v => setField('manualPitchX', v > 0 ? v : null)} />
                      <NumField
                        label={`Pitch Y يدوي (تلقائي: ${result.autoPitchY.toFixed(2)} مم)`}
                        hint="0 = استخدام الحساب التلقائي"
                        value={inputs.manualPitchY ?? 0} step={0.01}
                        onChange={v => setField('manualPitchY', v > 0 ? v : null)} />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
          )}

          {/* Stretch Zones inspector (Admin only) */}
          {isAdmin && (
          <Card>
            <CardContent className="p-4 sm:p-5">
              <Collapsible open={zonesOpen} onOpenChange={setZonesOpen}>
                <CollapsibleTrigger className="w-full flex items-center justify-between">
                  <SectionHeader title="مناطق التمدد (Stretch Zones)" icon={Move} />
                  <ChevronDown className={`w-4 h-4 transition-transform ${zonesOpen ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-3 pt-2">
                    <ZoneTable title="أفقي" zones={zones.horizontal} />
                    <ZoneTable title="رأسي" zones={zones.vertical} />
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      كل منطقة تتمدد فقط حسب البُعد المرتبط بها — Length / Depth / Height /
                      Calibration. القيم المرجعية تأتي من بروفايل القالب.
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
          )}

          {/* SVG upload */}
          <Card>
            <CardContent className="p-4 sm:p-5">
              <SectionHeader title="قالب SVG (للعرض البصري فقط)" icon={Upload} />
              <input type="file" accept=".svg,image/svg+xml"
                onChange={e => { const f = e.target.files?.[0]; if (f) onUploadSvg(f); }}
                className="text-xs file:me-3 file:py-1.5 file:px-3 file:rounded-md
                  file:border-0 file:text-xs file:font-medium
                  file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
              <p className="text-[10px] text-muted-foreground mt-2">
                الـ SVG عنصر مرئي فقط
              </p>
            </CardContent>
          </Card>

          {/* ── حساب التكلفة (نُقل أسفل قالب SVG) ── */}
          <Card>
            <CardContent className="p-4 sm:p-5">
              <SectionHeader title="حساب التكلفة" icon={DollarSign} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">نوع الورق</Label>
                  <Select value={costPaperKey} onValueChange={setCostPaperKey}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="اختر نوع الورق" /></SelectTrigger>
                    <SelectContent>
                      {paperOptions.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">الكمية</Label>
                  <Input type="number" min={1} className="h-9 text-sm"
                    value={costQuantity}
                    onChange={e => setCostQuantity(Math.max(1, Number(e.target.value) || 0))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">عدد الأوجه المطبوعة</Label>
                  <Select value={costPrintedFaces.toString()} onValueChange={(v) => setCostPrintedFaces(Number(v))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">وجه واحد</SelectItem>
                      <SelectItem value="2">وجهين</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <ColorCountSelect
                  colorCount={costColorCount}
                  onColorCountChange={setCostColorCount}
                  extraColorConfig={costExtraColor}
                  onExtraColorChange={(c) => setCostExtraColor(prev => ({ ...prev, ...c }))}
                />
              </div>
              {/* ملخص KPI الداخلي مخفي — يظهر في قسم "ملخص التكلفة" المستقل */}
            </CardContent>
          </Card>

          {/* ── بيانات إضافية ── */}
          <Collapsible open={additionalOpen} onOpenChange={setAdditionalOpen}>
            <Card className="shadow-sm border-border/60">
              <CollapsibleTrigger asChild>
                <CardContent className="pt-5 pb-4 cursor-pointer hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between">
                    <SectionHeader title="بيانات إضافية" icon={Sparkles} />
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${additionalOpen ? 'rotate-180' : ''}`} />
                  </div>
                </CardContent>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">الأوجه المطبوعة</Label>
                      <Select value={costPrintedFaces.toString()} onValueChange={(v) => { const n = Number(v); setCostPrintedFaces(n); if (n === 1) setCostFacesDifferent(false); }}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">وجه واحد</SelectItem>
                          <SelectItem value="2">وجهان</SelectItem>
                        </SelectContent>
                      </Select>
                      {costPrintedFaces === 2 && (
                        <div className="flex items-center gap-2 mt-1">
                          <Switch checked={costFacesDifferent} onCheckedChange={setCostFacesDifferent} />
                          <Label className="text-[10px] text-muted-foreground">هل مختلفان؟</Label>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">كمية الهدر</Label>
                        <button onClick={() => setCostWasteMode(costWasteMode === 'number' ? 'percent' : 'number')} className="text-[10px] text-primary hover:underline">
                          {costWasteMode === 'number' ? 'تبديل إلى %' : 'تبديل إلى رقم'}
                        </button>
                      </div>
                      <div className="relative">
                        <Input type="number" className="h-9 text-sm" value={costWaste} onChange={e => setCostWaste(Number(e.target.value) || 0)} />
                        {costWasteMode === 'percent' && (
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                        )}
                      </div>
                      {costWaste > 0 && (
                        <div className="flex items-center gap-2 mt-1">
                          <Switch checked={costWasteInCosts} onCheckedChange={setCostWasteInCosts} className="scale-75" />
                          <Label className="text-[10px] text-muted-foreground">{costWasteInCosts ? 'جميع التكاليف' : 'ورق فقط'}</Label>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">السلفان</Label>
                      <Select value={costCellophaneFaces.toString()} onValueChange={(v) => setCostCellophaneFaces(Number(v))}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">بدون</SelectItem>
                          <SelectItem value="1">وجه واحد</SelectItem>
                          <SelectItem value="2">وجهان</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">تكسير / قالب خاص</Label>
                      <div className="flex items-center gap-2 h-9">
                        <Switch checked={costDieCut} onCheckedChange={setCostDieCut} />
                        <span className="text-xs text-muted-foreground">{costDieCut ? 'مفعّل' : 'معطّل'}</span>
                      </div>
                    </div>
                  </div>

                  {costDieCut && (
                    <div className="mt-3 max-w-xs">
                      <Label className="text-xs">قيمة القالب (ريال)</Label>
                      <Input type="number" className="h-9 text-sm mt-1" value={costMoldPrice} onChange={e => setCostMoldPrice(Number(e.target.value) || 0)} />
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* ── التشطيبات ── */}
          <Collapsible open={finishingOpen} onOpenChange={setFinishingOpen}>
            <Card className="shadow-sm border-border/60">
              <CollapsibleTrigger asChild>
                <CardContent className="pt-5 pb-4 cursor-pointer hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary"><Sparkles className="w-4 h-4" /></div>
                      <h3 className="font-semibold text-foreground text-sm">التشطيبات</h3>
                      {costFinishing.filter(f => f.enabled).length > 0 && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                          {costFinishing.filter(f => f.enabled).length} مفعّل
                        </span>
                      )}
                    </div>
                    {finishingOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </CardContent>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-4 space-y-2">
                  {costFinishing.map((item, idx) => (
                    <div key={idx} className={`rounded-lg border p-2.5 sm:p-3 transition-all ${item.enabled ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-muted/20 border-transparent'}`}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Input className="h-8 text-xs w-full sm:w-28 bg-background shrink-0" value={item.name}
                          onChange={e => updateFinishing(idx, { name: e.target.value })} placeholder="الاسم" />
                        <Select value={item.calcType} onValueChange={(v) => updateFinishing(idx, { calcType: v as FinishingItem['calcType'] })}>
                          <SelectTrigger className="h-8 text-xs w-full sm:w-28 bg-background shrink-0"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(calcTypeLabels).map(([key, val]) => (
                              <SelectItem key={key} value={key}>{val.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input type="number" className="h-8 text-xs w-16 bg-background shrink-0" value={item.multiplier}
                          onChange={e => updateFinishing(idx, { multiplier: Number(e.target.value) || 0 })} placeholder="متغ" />
                        <Input type="number" className="h-8 text-xs w-20 bg-background shrink-0" value={item.pricePerUnit}
                          onChange={e => updateFinishing(idx, { pricePerUnit: Number(e.target.value) || 0, enabled: (Number(e.target.value) || 0) > 0 })} placeholder="سعر" />
                        {item.calcType === 'tiered_1000' && (
                          <Input type="number" className="h-8 text-xs w-20 bg-background shrink-0" value={item.extraPer1000}
                            onChange={e => updateFinishing(idx, { extraPer1000: Number(e.target.value) || 0 })} placeholder="ألف+" />
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive shrink-0 mr-auto"
                          onClick={() => removeFinishing(idx)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full border-dashed mt-2" onClick={addFinishing}>
                    <Plus className="w-3.5 h-3.5 ml-1" /> إضافة تشطيب
                  </Button>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* ── ملخص التكلفة ── */}
          <Card className="shadow-sm border-primary/30 bg-gradient-to-b from-primary/5 to-transparent">
            <CardContent className="pt-5 pb-4">
              <SectionHeader title="ملخص التكلفة" icon={Calculator} />
              {costResult && costResult.valid ? (
                <>
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center mb-3">
                    <p className="text-xs text-muted-foreground mb-0.5">الإجمالي الشامل</p>
                    <p className="text-2xl font-bold text-primary">{costResult.grandTotal.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">ريال</p>
                  </div>
                  <div className="space-y-1 text-xs">
                    {costResult.thousands > 0 && <DetailRow label="عدد الآلاف" value={`${costResult.thousands}`} />}
                    {costResult.printSheetsPerPurchase > 0 && <DetailRow label="تفصيل الشيت الأساسي" value={costResult.printSheetsPerPurchase.toString()} />}
                    {costResult.printSheetsBeforeWaste > 0 && <DetailRow label="عدد شيتات الطباعة" value={costResult.printSheetsBeforeWaste.toString()} />}
                    {costResult.printSheetsAfterWaste > 0 && <DetailRow label="شيتات الطباعة بعد الهدر" value={costResult.printSheetsAfterWaste.toString()} />}
                    {costResult.purchaseSheetsNeeded > 0 && <DetailRow label="عدد شيتات الشراء" value={costResult.purchaseSheetsNeeded.toString()} />}
                    {costResult.paperCost > 0 && <DetailRow label="الورق" value={`${costResult.paperCost.toFixed(2)} ر.س`} />}
                    {costResult.sortCost > 0 && <DetailRow label="الفرز" value={`${costResult.sortCost.toFixed(2)} ر.س`} />}
                    {costResult.printCost > 0 && <DetailRow label="الطباعة" value={`${costResult.printCost.toFixed(2)} ر.س`} />}
                    {costResult.extraColorCost > 0 && <DetailRow label="ألوان إضافية" value={`${costResult.extraColorCost.toFixed(2)} ر.س`} />}
                    {costResult.cellophaneCost > 0 && <DetailRow label="السلفان" value={`${costResult.cellophaneCost.toFixed(2)} ر.س`} />}
                    {costResult.dieCutCost > 0 && <DetailRow label="التكسير" value={`${costResult.dieCutCost.toFixed(2)} ر.س`} />}
                    {costMoldPrice > 0 && <DetailRow label="قيمة القالب" value={`${costMoldPrice.toFixed(2)} ر.س`} />}
                    {costResult.totalFinishing > 0 && <DetailRow label="مجموع التشطيبات" value={`${costResult.totalFinishing.toFixed(2)} ر.س`} />}
                    <DetailRow label="سعر القطعة" value={`${costResult.pricePerPiece.toFixed(4)} ر.س`} highlight />
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground">سيتم عرض الملخص تلقائياً عند توفر البيانات.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right: Preview + Admin scenarios ── */}
        <div className="lg:col-span-7 space-y-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              {showNestingPreview && <SectionHeader title="معاينة التوزيع داخل الشيت" icon={Layers} />}
              {showNestingPreview && <SheetPreview result={result} svg={pieceSvg} zones={zones} />}
            </CardContent>
          </Card>

          {isAdmin && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-card">
            <CardContent className="p-4 sm:p-5">
              <SectionHeader title="أفضل سيناريو" icon={Sparkles} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KPI label="إجمالي القطع" value={best.total.toString()} accent />
                <KPI label="السيناريو" value={best.orientation} />
                <KPI label="الأعمدة × الصفوف" value={`${best.cols} × ${best.rows}`} />
                <KPI label="نسبة الاستغلال" value={`${(best.utilization * 100).toFixed(1)}٪`} />
                <KPI label="مقاس التوزيع"
                  value={`${(best.layoutW / 10).toFixed(2)} × ${(best.layoutH / 10).toFixed(2)} سم`} />
                <KPI label="Pitch X / Y"
                  value={`${best.pitchX.toFixed(1)} / ${best.pitchY.toFixed(1)}`} />
                <KPI label="المتبقي (طول)" value={`${best.remainingW.toFixed(1)} مم`} />
                <KPI label="المتبقي (عرض)" value={`${best.remainingH.toFixed(1)} مم`} />
              </div>
            </CardContent>
          </Card>
          )}

          {isAdmin && (
          <Card>
            <CardContent className="p-4 sm:p-5">
              <SectionHeader title="مقارنة السيناريوهات" icon={Layers} />
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 text-muted-foreground">
                      <th className="text-start py-2 px-2 font-medium">السيناريو</th>
                      <th className="text-center py-2 px-2 font-medium">الاتجاه</th>
                      <th className="text-center py-2 px-2 font-medium">أعمدة</th>
                      <th className="text-center py-2 px-2 font-medium">صفوف</th>
                      <th className="text-center py-2 px-2 font-medium">القطع</th>
                      <th className="text-center py-2 px-2 font-medium">الاستغلال</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.scenarios.map(s => (
                      <tr key={s.key}
                        className={`border-b border-border/30 ${s === best ? 'bg-primary/5 font-semibold text-primary' : ''}`}>
                        <td className="py-2 px-2">{s.label}</td>
                        <td className="text-center py-2 px-2">{s.orientation}</td>
                        <td className="text-center py-2 px-2 tabular-nums">{s.cols}</td>
                        <td className="text-center py-2 px-2 tabular-nums">{s.rows}</td>
                        <td className="text-center py-2 px-2 tabular-nums">{s.total}</td>
                        <td className="text-center py-2 px-2 tabular-nums">{(s.utilization * 100).toFixed(1)}٪</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          )}
        </div>
      </div>

      {/* Save template dialog */}
      <Dialog open={saveDialog} onOpenChange={setSaveDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>حفظ كقالب جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-sm">اسم القالب</Label>
            <Input value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)}
              placeholder="مثال: علبة دواء 65×25×100" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              سيُحفظ: الـ SVG، الأبعاد الحالية (بروفايل مرجعي للتمدد)، عوامل المعايرة،
              Pitch Override، Interlock، قواعد الدوران.
            </p>
          </div>
          <DialogFooter className="flex gap-2 sm:flex-row-reverse">
            <Button onClick={saveAsTemplate}>حفظ</Button>
            <Button variant="outline" onClick={() => setSaveDialog(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

/* ── KPI / Zone Table ── */
const KPI = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className={`p-3 rounded-lg border ${accent
    ? 'bg-primary text-primary-foreground border-primary shadow-md'
    : 'bg-muted/30 border-border/40'}`}>
    <p className={`text-[10px] mb-1 ${accent ? 'opacity-80' : 'text-muted-foreground'}`}>{label}</p>
    <p className="text-sm sm:text-base font-bold tabular-nums leading-tight">{value}</p>
  </div>
);

const ZoneTable = ({ title, zones }: { title: string; zones: StretchZones['horizontal'] }) => (
  <div>
    <p className="text-[11px] font-semibold text-foreground/80 mb-1.5">{title}</p>
    <div className="overflow-x-auto rounded-md border border-border/40">
      <table className="w-full text-[11px]">
        <thead className="bg-muted/30 text-muted-foreground">
          <tr>
            <th className="text-start py-1.5 px-2 font-medium">المنطقة</th>
            <th className="text-center py-1.5 px-2 font-medium">يعتمد على</th>
            <th className="text-center py-1.5 px-2 font-medium">مرجعي (مم)</th>
            <th className="text-center py-1.5 px-2 font-medium">حالي (مم)</th>
            <th className="text-center py-1.5 px-2 font-medium">Δ</th>
          </tr>
        </thead>
        <tbody>
          {zones.map(z => {
            const delta = z.current - z.base;
            return (
              <tr key={z.key} className="border-t border-border/30">
                <td className="py-1.5 px-2">{z.label}</td>
                <td className="text-center py-1.5 px-2 text-muted-foreground">{z.depends}</td>
                <td className="text-center py-1.5 px-2 tabular-nums">{z.base.toFixed(2)}</td>
                <td className="text-center py-1.5 px-2 tabular-nums font-medium">{z.current.toFixed(2)}</td>
                <td className={`text-center py-1.5 px-2 tabular-nums ${delta === 0 ? 'text-muted-foreground' : 'text-primary font-semibold'}`}>
                  {delta > 0 ? '+' : ''}{delta.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

const DetailRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className="flex items-center justify-between py-1 px-2 rounded">
    <span className="text-muted-foreground">{label}</span>
    <span className={`font-mono ${highlight ? 'text-primary font-semibold' : 'font-medium'}`}>{value}</span>
  </div>
);

export default DieCutCalculator;
