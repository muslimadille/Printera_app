import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { usePrintingStore, useCalculations, type FinishingItem, type CalculatorInputs } from '@/store/printingStore';
import { calculateQuote } from '@/lib/calcEngine';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Calculator, FileText, Sparkles, ChevronDown, ChevronUp, Plus, Trash2, Copy, Save, Upload, Download, HelpCircle, Lightbulb, Brain, Hand, Check, ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import SmartSheetLayoutPreview from '@/components/SmartSheetLayoutPreview';
import EditableSheetLayout from '@/components/EditableSheetLayout';
import DielineImportDialog from '@/components/DielineImportDialog';
import type { ParsedDieline } from '@/lib/dielineImport';
import type { LayoutPiece } from '@/lib/sheetLayoutOptimizer';
import { SpotlightTour, LightHints, SMART_ENGINE_STEPS, type GuideStepExt } from '@/components/SmartEngineGuide';

/* ── Hybrid Engine tour steps ──
 * Reuses Smart Engine steps and inserts two Hybrid-specific explainers:
 *   1. "Smart vs Manual" mode toggle — first step.
 *   2. "Dieline import" — right before the Settings/Paper source steps,
 *      so the user knows how to bring a box template into Manual mode. */
const HYBRID_SETTINGS_IDX = SMART_ENGINE_STEPS.findIndex(s => s.selector === 'tab-settings');
const HYBRID_ENGINE_STEPS: GuideStepExt[] = [
  {
    selector: 'hybrid-mode',
    title: 'الوضع: ذكي أم يدوي؟',
    description: 'تبويبة المحرك الهجين تعمل بوضعين. الوضع الذكي يقوم بالتعشيق التلقائي ويقترح أفضل توزيع. الوضع اليدوي يفعّل استيراد قالب علبة ويعطيك حرية كاملة في التحريك والدوران والنسخ بدون أي تدخل من النظام.',
    example: '⚡ ذكي = تعشيق تلقائي • ✋ يدوي = تحكم كامل بدون توزيع تلقائي',
    hint: 'اختر الوضع المناسب أولاً قبل إدخال البيانات.',
  },
  ...SMART_ENGINE_STEPS.slice(0, HYBRID_SETTINGS_IDX),
  {
    selector: 'dieline-import',
    title: 'استيراد قالب العلبة (الوضع اليدوي)',
    description: 'في الوضع اليدوي اضغط على "استيراد قالب علبة" واختر ملف SVG للقالب. سيتم وضع القالب في زاوية الشيت بمقاسه الأصلي، ومقاس الصنف يُحدَّث تلقائياً ليطابق القالب. بعدها يمكنك تحريكه ودورانه ونسخه بحرية كاملة.',
    example: 'مثال: قالب علبة SVG ⇐ يظهر في الشيت جاهزاً للتعديل',
    hint: 'الزر يظهر فقط عند تفعيل الوضع اليدوي.',
  },
  ...SMART_ENGINE_STEPS.slice(HYBRID_SETTINGS_IDX),
];
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ProfitMargins from '@/components/ProfitMargins';
import { toast } from 'sonner';
import { calcTypeLabels } from '@/lib/calcTypeLabels';
import { downloadCostCalcTemplate, parseCostCalcExcelMulti } from '@/lib/costCalcExcel';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { saveQuote, updateQuote } from '@/lib/userApi';


/* ── Section Header ── */
const SectionHeader = ({ title, icon: Icon }: { title: string; icon: any }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="p-2 rounded-lg bg-primary/10 text-primary"><Icon className="w-4 h-4" /></div>
    <h3 className="font-semibold text-foreground text-sm">{title}</h3>
  </div>
);

/* ── Default finishing types ── */
const defaultCostFinishing: FinishingItem[] = [
  { name: 'ورنيش', enabled: false, calcType: 'per_piece', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'وتر بيز', enabled: false, calcType: 'per_piece', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'يوفي', enabled: false, calcType: 'per_piece', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'بصمة', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'تخريم', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'شباك', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'تجليد', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'حبل', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
];

/* ── Color Selector Dropdown ── */
const ColorDropdown = ({
  sizes, selectedSizeIdx, colorCount, extraColors, onSelect, onExtraChange,
}: {
  sizes: { sizeName: string; width: number; height: number }[];
  selectedSizeIdx: number;
  colorCount: number;
  extraColors: number;
  onSelect: (sizeIdx: number, colors: number) => void;
  onExtraChange: (extra: number) => void;
}) => {
  const [open, setOpen] = useState(false);

  const selectedLabel = selectedSizeIdx >= 0
    ? `${colorCount >= 5 ? `4+${extraColors}` : colorCount} ألوان - ${sizes[selectedSizeIdx].width}x${sizes[selectedSizeIdx].height}`
    : 'اختر الألوان';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between h-9 text-sm font-normal">
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[360px] p-3" align="start">
        <div className="space-y-2">
          {sizes.map((size, sIdx) => (
            <div key={sIdx} className={`flex items-center gap-2 p-2 rounded-lg transition-all ${selectedSizeIdx === sIdx ? 'bg-primary/10 border border-primary/30' : 'bg-muted/30 border border-transparent'}`}>
              <span className="text-xs font-semibold text-muted-foreground min-w-[65px] text-center">{size.width}x{size.height}</span>
              <div className="flex gap-1.5 items-center">
                {[0, 1, 2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => { onSelect(sIdx, n); setOpen(false); }}
                    className={`w-8 h-8 rounded-md text-sm font-bold transition-all border
                      ${selectedSizeIdx === sIdx && colorCount === n
                        ? 'bg-primary text-primary-foreground border-primary shadow-md'
                        : 'bg-background text-foreground border-border hover:border-primary/50 hover:bg-primary/5'
                      }`}
                  >
                    {n}
                  </button>
                ))}
                {/* Extra colors: show + button or counter */}
                {selectedSizeIdx === sIdx && colorCount >= 5 ? (
                  <div className="flex items-center gap-0.5 mr-1">
                    <button
                      onClick={() => {
                        if (extraColors <= 1) { onSelect(sIdx, 4); onExtraChange(0); }
                        else onExtraChange(extraColors - 1);
                      }}
                      className="w-6 h-8 rounded-md text-xs font-bold border border-border hover:border-destructive/50 hover:bg-destructive/5 text-muted-foreground transition-all"
                    >−</button>
                    <span className="w-7 text-center text-sm font-bold text-primary">+{extraColors}</span>
                    <button
                      onClick={() => onExtraChange(extraColors + 1)}
                      className="w-6 h-8 rounded-md text-xs font-bold border border-border hover:border-primary/50 hover:bg-primary/5 text-muted-foreground transition-all"
                    >+</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { onSelect(sIdx, 5); onExtraChange(1); setOpen(false); }}
                    className="w-8 h-8 rounded-md text-sm font-bold transition-all border border-dashed border-primary/40 text-primary/70 hover:bg-primary/10 hover:border-primary"
                  >
                    <Plus className="w-4 h-4 mx-auto" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
/* ── Paper Combobox ── */
const PaperCombobox = ({
  paperTypes, value, onChange,
}: {
  paperTypes: { name: string; entries: { grammage: number; sizeName: string }[] }[];
  value: string;
  onChange: (val: string) => void;
}) => {
  const [open, setOpen] = useState(false);

  const options = useMemo(() => {
    const list: { label: string; value: string }[] = [];
    paperTypes.forEach(pt => {
      pt.entries.forEach(e => {
        const label = `${pt.name} - ${e.grammage} جرام - ${e.sizeName}`;
        const val = `${pt.name}|${e.grammage}|${e.sizeName}`;
        list.push({ label, value: val });
      });
    });
    return list;
  }, [paperTypes]);

  const selectedLabel = options.find(o => o.value === value)?.label || 'اختر نوع الورق';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-9 text-sm font-normal">
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command>
          <CommandInput placeholder="بحث عن نوع الورق..." />
          <CommandList>
            <CommandEmpty>لا توجد نتائج</CommandEmpty>
            <CommandGroup>
              {options.map(opt => (
                <CommandItem key={opt.value} value={opt.label} onSelect={() => { onChange(opt.value); setOpen(false); }}>
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

/* ── Piece data interface ── */
interface PieceData {
  id: string;
  quantity: number;
  colorCount: number;
  extraColorCount: number;
  /** Index in priceSettings.sizes representing the chosen MACHINE size from color row.
   * This drives sort/print pricing AND the default press sheet size. */
  machineSizeIdx: number;
  printWidth: number;
  printHeight: number;
  /** Press sheet width (cm) — used by smart engine */
  pressWidth: number;
  /** Press sheet height (cm) — used by smart engine */
  pressHeight: number;
  /** Stage 1 scenario id (master → press) chosen by user */
  selectedStage1Id?: string;
  /** Stage 2 scenario id (press → product) chosen by user */
  selectedStage2Id?: string;
  /** Press sheets per master sheet — auto-set from Stage 1 selection */
  baseCuts: number;
  /** Products per press sheet — auto-set from Stage 2 selection */
  cutsPerSheet: number;
  paperType: string;
  grammage: number | null;
  purchaseSize: string;
  printedFaces: number;
  facesDifferent: boolean;
  wastePercent: number;
  wasteMode: 'number' | 'percent';
  cellophaneFaces: number;
  /** When true, use cellophaneOverridePerFace instead of size-table price */
  cellophaneOverrideEnabled: boolean;
  /** Manual cellophane price per face (used when override enabled) */
  cellophaneOverridePerFace: number;
  dieCut: boolean;
  moldPrice: number;
  wasteInCosts: boolean;
  finishing: FinishingItem[];
}

/* ── Sheet data interface ──
 * Each sheet owns its full state: pieces, mode (smart/manual), imported
 * dieline (manual only), live manual count, and the manual layout pieces.
 * This keeps every sheet a fully independent instance so switching tabs
 * never wipes the user's work on another sheet. */
interface SheetData {
  id: string;
  pieces: PieceData[];
  /** Per-sheet view mode: smart (auto) vs manual (free editor). */
  mode: 'smart' | 'manual';
  /** Imported dieline for manual mode (null = none). */
  importedDieline: ParsedDieline | null;
  /** Live count produced by manual editor (drives cutsPerSheet on confirm). */
  manualCount: number;
  /** Persisted manual layout pieces (positions, rotations, duplicates).
   *  Empty array = use a default starter piece. */
  manualPieces: LayoutPiece[];
}

const createEmptyPiece = (): PieceData => ({
  id: crypto.randomUUID(),
  quantity: 1000,
  colorCount: 0,
  extraColorCount: 0,
  machineSizeIdx: -1,
  printWidth: 0,
  printHeight: 0,
  pressWidth: 0,
  pressHeight: 0,
  selectedStage1Id: undefined,
  selectedStage2Id: undefined,
  baseCuts: 0,
  cutsPerSheet: 1,
  paperType: '',
  grammage: null,
  purchaseSize: '',
  printedFaces: 1,
  facesDifferent: false,
  wastePercent: 0,
  wasteMode: 'number',
  cellophaneFaces: 0,
  cellophaneOverrideEnabled: false,
  cellophaneOverridePerFace: 0,
  dieCut: false,
  moldPrice: 0,
  wasteInCosts: true,
  finishing: defaultCostFinishing.map(f => ({ ...f })),
});

const createEmptySheet = (): SheetData => ({
  id: crypto.randomUUID(),
  pieces: [createEmptyPiece()],
  mode: 'smart',
  importedDieline: null,
  manualCount: 0,
  manualPieces: [],
});

/* ── Manual Layout Host ──
 * Wrapper around EditableSheetLayout used by Hybrid Manual Mode.
 *
 * Controlled per-sheet: the parent owns the manual layout pieces for each
 * sheet (in SheetData.manualPieces). On mount we seed EditableSheetLayout
 * with the persisted pieces (or a default starter); every change is reported
 * back via onPiecesChange so the layout survives sheet switches and is
 * deep-copied when a sheet is duplicated.
 *
 * Stable seed rule: EditableSheetLayout re-seeds whenever its `optimalPieces`
 * prop reference changes. We compute the seed ONCE per mount via useRef so
 * unrelated parent re-renders never wipe the user's moves/rotations.
 */
const ManualLayoutHost = ({
  sheetW, sheetH, productW, productH,
  importedDieline, onDielineImported, onCountChange,
  initialPieces,
}: {
  sheetW: number; sheetH: number; productW: number; productH: number;
  importedDieline: ParsedDieline | null;
  onDielineImported: (d: ParsedDieline) => void;
  onCountChange: (count: number, pieces: LayoutPiece[]) => void;
  initialPieces: LayoutPiece[];
}) => {
  // Stable seed — created exactly once per mount. Deep-copied so future
  // edits inside the editor never mutate the parent's stored array.
  const seedRef = useRef<LayoutPiece[]>(
    initialPieces.length > 0
      ? initialPieces.map(p => ({ ...p }))
      : [{ index: 0, x: 0, y: 0, w: productW, h: productH, rotated: false }]
  );
  return (
    <EditableSheetLayout
      sheetW={sheetW}
      sheetH={sheetH}
      productW={productW}
      productH={productH}
      gap={0}
      optimalPieces={seedRef.current}
      importedDieline={importedDieline}
      onDielineImported={onDielineImported}
      onCountChange={onCountChange}
    />
  );
};

/* ── Workspace Scaler ──
 * Progressive canvas expansion for Manual Mode.
 * - Scales the visual workspace via container width (the inner SVG follows
 *   maxWidth: 100% so it grows with its parent — no transform required, so
 *   pointer math inside EditableSheetLayout stays exact).
 * - Supports stepped enlarge/shrink, reset, and a true fullscreen overlay.
 * - Pure presentation: does NOT change sheet size, calculations, or layout.
 */
const ZOOM_STEPS = [1, 1.25, 1.5, 2, 2.5, 3, 4];
const WorkspaceScaler = ({ children }: { children: React.ReactNode }) => {
  const [stepIdx, setStepIdx] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const scale = ZOOM_STEPS[stepIdx];

  // Esc to exit fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const Toolbar = (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5">
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
          onClick={() => setStepIdx(i => Math.max(0, i - 1))}
          disabled={stepIdx === 0}
          title="تصغير مساحة العمل">
          <ZoomOut className="w-3.5 h-3.5" />
        </Button>
        <span className="text-[11px] font-bold text-foreground tabular-nums min-w-[40px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
          onClick={() => setStepIdx(i => Math.min(ZOOM_STEPS.length - 1, i + 1))}
          disabled={stepIdx === ZOOM_STEPS.length - 1}
          title="تكبير مساحة العمل">
          <ZoomIn className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]"
          onClick={() => setStepIdx(0)}
          disabled={stepIdx === 0}
          title="إعادة للحجم الافتراضي">
          <RotateCcw className="w-3 h-3 ml-1" /> افتراضي
        </Button>
      </div>
      <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1"
        onClick={() => setFullscreen(f => !f)}
        title={fullscreen ? 'خروج من ملء الشاشة' : 'ملء الشاشة'}>
        {fullscreen ? <><Minimize2 className="w-3.5 h-3.5" /> خروج</> : <><Maximize2 className="w-3.5 h-3.5" /> ملء الشاشة</>}
      </Button>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-background/98 backdrop-blur-sm flex flex-col p-3 gap-2">
        {Toolbar}
        <div className="flex-1 overflow-auto rounded-lg border border-border bg-muted/20 p-3">
          <div style={{ width: `${scale * 100}%`, margin: '0 auto', minWidth: '100%' }}>
            {children}
          </div>
        </div>
        <p className="text-[10px] text-center text-muted-foreground">
          اضغط Esc للخروج • مساحة العمل قابلة للتمرير
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {Toolbar}
      <div className="overflow-auto rounded-lg border border-border bg-muted/10 p-1">
        <div style={{ width: `${scale * 100}%`, minWidth: '100%' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

const HybridEngineCalculator = ({ onNavigateToQuote, sessionToken }: { onNavigateToQuote?: () => void; sessionToken?: string }) => {
  const { paperTypes, priceSettings, setInputs, editingQuoteData, setEditingQuoteData } = usePrintingStore();
  const calc = useCalculations();

  const [sheets, setSheets] = useState<SheetData[]>(() => [createEmptySheet()]);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemNumber, setItemNumber] = useState('');
  const [itemSize, setItemSize] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingQuoteId, setEditingQuoteIdLocal] = useState<string | null>(null);
  const [addSheetPopoverOpen, setAddSheetPopoverOpen] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  // ── Interactive Guide state ──
  const [tourOpen, setTourOpen] = useState(false);
  const [hintsOpen, setHintsOpen] = useState(false);
  useEffect(() => {
    const seen = localStorage.getItem('hybridEngineTourSeen');
    if (!seen) {
      const t = setTimeout(() => {
        setTourOpen(true);
        localStorage.setItem('hybridEngineTourSeen', '1');
      }, 600);
      return () => clearTimeout(t);
    }
  }, []);

  // ── Hybrid mode state ──
  // Mode, imported dieline, manual count and the manual layout pieces are
  // all stored PER-SHEET (in SheetData). Switching sheets restores each
  // sheet's full state, and duplicating a sheet deep-copies all of it.
  // The helpers below patch fields on the active sheet only.
  const updateActiveSheet = useCallback((updates: Partial<SheetData>) => {
    setSheets(prev => prev.map((s, si) => si === activeSheetIdx ? { ...s, ...updates } : s));
  }, [activeSheetIdx]);

  const setMode = useCallback((m: 'smart' | 'manual') => updateActiveSheet({ mode: m }), [updateActiveSheet]);

  // Template Size Override Logic: dieline is the source of truth for itemSize.
  // - If itemSize empty → fill from template.
  // - If itemSize differs → overwrite + notify.
  const handleDielineImport = (d: ParsedDieline) => {
    // Reset count + layout when a new dieline is imported on the active sheet.
    updateActiveSheet({ importedDieline: d, manualCount: 0, manualPieces: [] });
    const w = Number(d.width).toFixed(1);
    const h = Number(d.height).toFixed(1);
    const templateSize = `${w}x${h}`;
    setItemSize((prev) => {
      const trimmed = (prev || '').trim();
      if (!trimmed) {
        toast.success(`تم اعتماد مقاس القالب كمقاس الصنف: ${templateSize} سم`);
        return templateSize;
      }
      if (trimmed !== templateSize) {
        toast.info(`تم تحديث مقاس الصنف ليتوافق مع القالب المستورد: ${templateSize} سم`);
        return templateSize;
      }
      return prev;
    });
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const results = parseCostCalcExcelMulti(ev.target?.result as ArrayBuffer);
        // Each Excel sheet becomes a separate sheet/tab
        const newSheets: SheetData[] = results.map(result => ({
          id: crypto.randomUUID(),
          pieces: result.pieces.map(p => ({
            id: crypto.randomUUID(),
            baseCuts: 0,
            pressWidth: 0,
            pressHeight: 0,
            machineSizeIdx: -1,
            cellophaneOverrideEnabled: false,
            cellophaneOverridePerFace: 0,
            ...p,
          })),
          mode: 'smart',
          importedDieline: null,
          manualCount: 0,
          manualPieces: [],
        }));
        // Use item info from first sheet
        if (results.length > 0) {
          setItemName(results[0].itemName);
          setItemNumber(results[0].itemNumber);
          setItemSize(results[0].itemSize);
        }
        if (newSheets.length > 0) {
          setSheets(newSheets);
          setActiveSheetIdx(0);
          setEditingQuoteIdLocal(null);
          toast.success(`تم استيراد ${results.length} تسعيرة من الملف`);
        }
      } catch (err: any) {
        toast.error('خطأ في قراءة الملف: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Load editing quote data
  useEffect(() => {
    if ((editingQuoteData?.sourceType === 'hybridengine' || editingQuoteData?.sourceType === 'smartengine') && editingQuoteData.rawInputs) {
      const raw = editingQuoteData.rawInputs;
      if (raw.sheets && Array.isArray(raw.sheets)) {
        // Migrate older saved sheets that did not store per-sheet hybrid state.
        const migrated: SheetData[] = raw.sheets.map((s: any) => ({
          id: s.id ?? crypto.randomUUID(),
          pieces: s.pieces ?? [],
          mode: s.mode === 'manual' ? 'manual' : 'smart',
          importedDieline: s.importedDieline ?? null,
          manualCount: typeof s.manualCount === 'number' ? s.manualCount : 0,
          manualPieces: Array.isArray(s.manualPieces) ? s.manualPieces : [],
        }));
        setSheets(migrated);
        setActiveSheetIdx(0);
      }
      setItemName(editingQuoteData.itemName || '');
      setItemNumber(editingQuoteData.itemNumber || '');
      setItemSize(editingQuoteData.itemSize || '');
      if (editingQuoteData.quoteId) {
        setEditingQuoteIdLocal(editingQuoteData.quoteId);
      }
      setEditingQuoteData(null);
    }
  }, [editingQuoteData, setEditingQuoteData]);

  const sheet = sheets[activeSheetIdx];
  const mainPiece = sheet?.pieces[0];

  // Per-sheet derived state. Reading these from `sheet` ensures every sheet
  // is a fully independent instance — switching tabs restores its own mode,
  // dieline, count, and manual layout.
  const mode: 'smart' | 'manual' = sheet?.mode ?? 'smart';
  const importedDieline: ParsedDieline | null = sheet?.importedDieline ?? null;
  const manualCount: number = sheet?.manualCount ?? 0;

  // Sync main piece to global inputs for calc engine
  useEffect(() => {
    if (!mainPiece) return;
    setInputs({
      quantity: mainPiece.quantity,
      colorCount: mainPiece.colorCount,
      printWidth: mainPiece.printWidth,
      printHeight: mainPiece.printHeight,
      cutsPerSheet: mainPiece.cutsPerSheet,
      paperType: mainPiece.paperType,
      grammage: mainPiece.grammage,
      purchaseSize: mainPiece.purchaseSize,
      printedFaces: mainPiece.printedFaces,
      facesDifferent: mainPiece.facesDifferent,
      wastePercent: mainPiece.wastePercent,
      cellophaneFaces: mainPiece.cellophaneFaces,
      dieCut: mainPiece.dieCut,
      moldPrice: mainPiece.moldPrice,
    });
  }, [mainPiece, setInputs]);

  const updatePiece = useCallback((sheetIdx: number, pieceIdx: number, updates: Partial<PieceData>) => {
    setSheets(prev => prev.map((s, si) => {
      if (si !== sheetIdx) return s;
      let changed = false;
      const pieces = s.pieces.map((p, pi) => {
        if (pi !== pieceIdx) return p;
        const hasChanges = Object.entries(updates).some(([key, value]) => !Object.is(p[key as keyof PieceData], value));
        if (!hasChanges) return p;
        changed = true;
        return { ...p, ...updates };
      });
      return changed ? { ...s, pieces } : s;
    }));
  }, []);

  /* ── Deep-clone helpers ──
   * Sheet duplication MUST produce a fully independent instance. Any shared
   * reference (pieces, finishing items, dieline, manualPieces) would cause
   * edits in the new sheet to mutate the original — which manifested as
   * the UI freezing when typing into a duplicated sheet. */
  const clonePiece = (p: PieceData): PieceData => ({
    ...p,
    id: crypto.randomUUID(),
    finishing: p.finishing.map(f => ({ ...f })),
  });
  const cloneSheet = (s: SheetData): SheetData => ({
    id: crypto.randomUUID(),
    pieces: s.pieces.map(clonePiece),
    mode: s.mode,
    importedDieline: s.importedDieline ? { ...s.importedDieline } : null,
    manualCount: s.manualCount,
    manualPieces: s.manualPieces.map(p => ({ ...p })),
  });

  const addSheet = (duplicate = false) => {
    const newSheet = duplicate ? cloneSheet(sheets[activeSheetIdx]) : createEmptySheet();
    setSheets(prev => [...prev, newSheet]);
    setActiveSheetIdx(sheets.length);
    setAddSheetPopoverOpen(false);
  };


  const removeSheet = (idx: number) => {
    if (sheets.length <= 1) return;
    setSheets(prev => prev.filter((_, i) => i !== idx));
    setActiveSheetIdx(prev => Math.min(prev, sheets.length - 2));
  };

  const addPiece = (sheetIdx: number, duplicate = false) => {
    setSheets(prev => prev.map((s, si) => {
      if (si !== sheetIdx) return s;
      const newPiece = duplicate
        ? { ...s.pieces[s.pieces.length - 1], id: crypto.randomUUID(), finishing: s.pieces[s.pieces.length - 1].finishing.map(f => ({ ...f })) }
        : createEmptyPiece();
      return { ...s, pieces: [...s.pieces, newPiece] };
    }));
  };

  const removePiece = (sheetIdx: number, pieceIdx: number) => {
    setSheets(prev => prev.map((s, si) => {
      if (si !== sheetIdx || s.pieces.length <= 1) return s;
      return { ...s, pieces: s.pieces.filter((_, pi) => pi !== pieceIdx) };
    }));
  };

  // Calculate costs for all pieces in active sheet
  const pieceCosts = useMemo(() => {
    if (!sheet) return [];
    return sheet.pieces.map(piece => {
      const inputs: CalculatorInputs & { wasteMode?: string; baseCuts?: number } = {
        quantity: piece.quantity,
        colorCount: piece.colorCount,
        printWidth: piece.printWidth,
        printHeight: piece.printHeight,
        cutsPerSheet: piece.cutsPerSheet,
        baseCuts: piece.baseCuts,
        paperType: piece.paperType,
        grammage: piece.grammage,
        purchaseSize: piece.purchaseSize,
        printedFaces: piece.printedFaces,
        facesDifferent: piece.facesDifferent,
        wastePercent: piece.wastePercent,
        cellophaneFaces: piece.cellophaneFaces,
        dieCut: piece.dieCut,
        moldPrice: piece.moldPrice,
        wasteInCosts: piece.wasteInCosts,
        extraColorCalcType: 'per_1000',
        extraColorPrice: 0,
        extraColorExtra1000: 0,
        extraColorCount: piece.extraColorCount,
        wasteMode: piece.wasteMode,
      };
      const result = calculateQuote(inputs, piece.finishing, paperTypes, priceSettings, {
        machineSizeIdx: piece.machineSizeIdx,
        cellophaneOverridePerFace: piece.cellophaneOverrideEnabled ? piece.cellophaneOverridePerFace : undefined,
      });
      return result;
    });
  }, [sheet, paperTypes, priceSettings]);

  const sheetGrandTotal = pieceCosts.reduce((sum, c) => sum + c.grandTotal, 0);
  const sheetTotalQuantity = sheet?.pieces.reduce((sum, p) => sum + p.quantity, 0) || 0;

  // Calculate totals for ALL sheets
  const allSheetsTotals = useMemo(() => {
    return sheets.map(s => {
      let total = 0;
      let qty = 0;
      for (const piece of s.pieces) {
        const inputs: CalculatorInputs & { wasteMode?: string; baseCuts?: number } = {
          quantity: piece.quantity,
          colorCount: piece.colorCount,
          printWidth: piece.printWidth,
          printHeight: piece.printHeight,
          cutsPerSheet: piece.cutsPerSheet,
          baseCuts: piece.baseCuts,
          paperType: piece.paperType,
          grammage: piece.grammage,
          purchaseSize: piece.purchaseSize,
          printedFaces: piece.printedFaces,
          facesDifferent: piece.facesDifferent,
          wastePercent: piece.wastePercent,
          cellophaneFaces: piece.cellophaneFaces,
          dieCut: piece.dieCut,
          moldPrice: piece.moldPrice,
          wasteInCosts: piece.wasteInCosts,
          extraColorCalcType: 'per_1000',
          extraColorPrice: 0,
          extraColorExtra1000: 0,
          extraColorCount: piece.extraColorCount,
          wasteMode: piece.wasteMode,
        };
        const result = calculateQuote(inputs, piece.finishing, paperTypes, priceSettings, {
          machineSizeIdx: piece.machineSizeIdx,
          cellophaneOverridePerFace: piece.cellophaneOverrideEnabled ? piece.cellophaneOverridePerFace : undefined,
        });
        total += result.grandTotal;
        qty += piece.quantity;
      }
      return { total, qty };
    });
  }, [sheets, paperTypes, priceSettings]);

  const allSheetsGrandTotal = allSheetsTotals.reduce((sum, s) => sum + s.total, 0);

  // Save handler
  const handleSave = async (skipMetadata = false) => {
    if (!sessionToken) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }
    setSaving(true);
    try {
      const quoteData: Record<string, any> = {
        sourceType: 'hybridengine',
        mode,
        rawInputs: { sheets },
        itemName,
        itemNumber,
        itemSize,
        grandTotal: allSheetsGrandTotal,
        sheetCount: sheets.length,
      };

      const title = itemName || `تكلفة - ${sheets.length} ورقة`;

      if (editingQuoteId) {
        await updateQuote(sessionToken, editingQuoteId, {
          title,
          customer_name: itemName,
          quote_number: itemNumber,
          quote_data: quoteData,
        });
        toast.success('تم تحديث التكلفة بنجاح');
      } else {
        const saved = await saveQuote(sessionToken, {
          title,
          customer_name: itemName,
          quote_number: itemNumber,
          source_type: 'hybridengine',
          quote_data: quoteData,
        });
        setEditingQuoteIdLocal(saved.id);
        toast.success('تم حفظ التكلفة بنجاح');
      }
      setSaveDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ في الحفظ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 pb-20 lg:pb-0">
      {/* ═══ Cost Summary (now on visual right via order-3 in RTL) ═══ */}
      <div className="hidden lg:block lg:col-span-3 space-y-4 lg:sticky lg:top-4 lg:self-start order-3">
        <Card className="shadow-sm border-primary/30 bg-gradient-to-b from-primary/5 to-transparent">
          <CardContent className="pt-5 pb-4">
            <SectionHeader icon={Calculator} title="ملخص التكلفة" />
            <div className="space-y-2 mb-4">
              {sheets.length > 1 && (
                <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">إجمالي كل الأوراق</p>
                  <p className="text-2xl font-bold text-accent-foreground">{allSheetsGrandTotal.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground">ريال</p>
                </div>
              )}
              {sheets.length > 1 && (
                <div className="space-y-1">
                  {sheets.map((s, si) => (
                    <div key={s.id} className={`flex justify-between text-xs px-2 py-1.5 rounded ${si === activeSheetIdx ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'}`}>
                      <span className={si === activeSheetIdx ? 'text-primary font-semibold' : 'text-muted-foreground'}>ورقة {si + 1}</span>
                      <span className="font-mono font-medium">{allSheetsTotals[si]?.total.toFixed(2) || '0.00'} ر.س</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">{sheets.length > 1 ? `إجمالي الورقة ${activeSheetIdx + 1}` : 'الإجمالي الشامل'}</p>
                <p className="text-2xl font-bold text-primary">{sheetGrandTotal.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">ريال</p>
              </div>
              {sheet?.pieces.length > 1 && (
                <div className="space-y-1">
                  {sheet.pieces.map((p, pi) => (
                    <div key={p.id} className="flex justify-between text-xs px-2 py-1 rounded bg-muted/50">
                      <span className="text-muted-foreground">قطعة {pi + 1}</span>
                      <span className="font-mono font-medium">{pieceCosts[pi]?.grandTotal.toFixed(2) || '0.00'} ر.س</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <ProfitMargins grandTotal={sheets.length > 1 ? allSheetsGrandTotal : sheetGrandTotal} quantity={sheetTotalQuantity} />
            <Button className="w-full mt-4 gap-2" onClick={() => setSaveDialogOpen(true)}>
              <Save className="w-4 h-4" /> حفظ التكلفة
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Main Inputs (middle column) ═══ */}
      <div className="lg:col-span-5 space-y-3 sm:space-y-4 order-2">



        {/* Sheet tabs - always visible */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {sheets.map((s, idx) => (
            <div key={s.id} className="flex items-center">
              <button
                onClick={() => setActiveSheetIdx(idx)}
                className={`px-4 py-2 text-sm rounded-lg border transition-all ${activeSheetIdx === idx ? 'bg-primary text-primary-foreground font-bold border-primary' : 'bg-muted/50 text-muted-foreground hover:bg-muted border-border'}`}
              >
                {idx + 1}
              </button>
              {sheets.length > 1 && (
                <button onClick={() => removeSheet(idx)} className="text-destructive/60 hover:text-destructive px-1 text-xs">×</button>
              )}
            </div>
          ))}
          <Popover open={addSheetPopoverOpen} onOpenChange={setAddSheetPopoverOpen}>
            <PopoverTrigger asChild>
              <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-dashed border-primary/40 text-primary hover:bg-primary/5 transition-all">
                <Plus className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-2" align="start">
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs gap-2" onClick={() => addSheet(false)}>
                <Plus className="w-3.5 h-3.5" /> جديدة
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs gap-2" onClick={() => addSheet(true)}>
                <Copy className="w-3.5 h-3.5" /> تكرار
              </Button>
            </PopoverContent>
          </Popover>

          {/* Help / Mode Toggle / Import / Template buttons */}
          <div className="flex items-center gap-1 mr-auto flex-wrap">
            {/* Mode toggle: Smart vs Manual (Hybrid Engine signature feature) */}
            <div data-tour="hybrid-mode" className="flex items-center gap-0.5 bg-muted/40 border border-border rounded-lg p-0.5">
              <button
                onClick={() => setMode('smart')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all ${mode === 'smart' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                title="المحرك الذكي: توزيع تلقائي وسيناريوهات"
              >
                <Brain className="w-3.5 h-3.5" /> ذكي
              </button>
              <button
                onClick={() => setMode('manual')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all ${mode === 'manual' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                title="استيراد قالب وتحكم يدوي بدون توزيع تلقائي"
              >
                <Hand className="w-3.5 h-3.5" /> يدوي
              </button>
            </div>

            <Button
              variant="ghost" size="sm"
              className="gap-1.5 text-xs h-9 text-primary hover:bg-primary/10"
              onClick={() => setTourOpen(true)}
              title="جولة إرشادية تفاعلية"
            >
              <HelpCircle className="w-3.5 h-3.5" /> شرح تفاعلي
            </Button>
            <Button
              variant="ghost" size="sm"
              className={`gap-1.5 text-xs h-9 ${hintsOpen ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary'}`}
              onClick={() => setHintsOpen(v => !v)}
              title="تلميحات سريعة"
            >
              <Lightbulb className="w-3.5 h-3.5" /> {hintsOpen ? 'إخفاء التلميحات' : 'تلميحات'}
            </Button>
            <input ref={importFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelImport} />
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-9 text-muted-foreground hover:text-primary" onClick={() => importFileRef.current?.click()}>
              <Upload className="w-3.5 h-3.5" /> استيراد Excel
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-9 text-muted-foreground hover:text-primary" onClick={downloadCostCalcTemplate}>
              <Download className="w-3.5 h-3.5" /> تحميل النموذج
            </Button>
          </div>
        </div>

        {/* Render all pieces for active sheet */}
        {sheet?.pieces.map((piece, pieceIdx) => (
          <PieceInputs
            key={piece.id}
            piece={piece}
            pieceIdx={pieceIdx}
            sheetIdx={activeSheetIdx}
            totalPieces={sheet.pieces.length}
            paperTypes={paperTypes}
            priceSettings={priceSettings}
            pieceCost={pieceCosts[pieceIdx]}
            updatePiece={updatePiece}
            removePiece={removePiece}
          />
        ))}

        {/* Add piece buttons */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 gap-2 border-dashed" onClick={() => addPiece(activeSheetIdx, false)}>
            <Plus className="w-4 h-4" /> قطعة جديدة
          </Button>
          <Button variant="outline" className="gap-2 border-dashed" onClick={() => addPiece(activeSheetIdx, true)}>
            <Copy className="w-4 h-4" /> تكرار
          </Button>
        </div>
      </div>

      {/* ═══ Visual Sheet Layout Preview + Calculation Details (now on visual left via order-1) ═══ */}
      <div className="lg:col-span-4 space-y-4 order-1">
        {/* Visual preview for the FIRST piece on the active sheet */}
        {mainPiece && (() => {
          const selectedType = paperTypes.find(t => t.name === mainPiece.paperType);
          const selectedEntry = selectedType?.entries.find(
            (e: any) => e.sizeName === mainPiece.purchaseSize && e.grammage === mainPiece.grammage
          );
          const masterW = selectedEntry?.width || 0;
          const masterH = selectedEntry?.height || 0;

          // ─── SMART MODE: original Smart Engine preview, untouched ───
          if (mode === 'smart') {
            return (
              <div data-tour="preview">
                <SmartSheetLayoutPreview
                  sheetW={masterW}
                  sheetH={masterH}
                  pressW={mainPiece.pressWidth}
                  pressH={mainPiece.pressHeight}
                  productW={mainPiece.printWidth}
                  productH={mainPiece.printHeight}
                  quantity={mainPiece.quantity}
                  onPressSizeChange={(w, h) => updatePiece(activeSheetIdx, 0, { pressWidth: w, pressHeight: h })}
                  onSelectStage1={(id, count) => updatePiece(activeSheetIdx, 0, { selectedStage1Id: id, baseCuts: count })}
                  onSelectStage2={(id, count) => updatePiece(activeSheetIdx, 0, { selectedStage2Id: id, cutsPerSheet: count })}
                />
              </div>
            );
          }

          // ─── MANUAL MODE: free dieline import + manual editor ───
          // No auto-distribution, no scenarios, no smart suggestions.
          // Cost engine consumes only the live `manualCount` -> cutsPerSheet.
          // CRITICAL: the EditableSheetLayout must NOT remount on every parent
          // re-render, otherwise the user's manual moves/rotations/duplicates
          // get wiped. We give it a stable key tied ONLY to the manual session
          // (active sheet + dieline file), and we let it own its piece state
          // for the entire session — we never push a new `optimalPieces`
          // array reference at it after mount.
          const sheetW = mainPiece.pressWidth || masterW;
          const sheetH = mainPiece.pressHeight || masterH;
          const pW = importedDieline?.width ?? mainPiece.printWidth;
          const pH = importedDieline?.height ?? mainPiece.printHeight;
          const canEdit = sheetW > 0 && sheetH > 0 && pW > 0 && pH > 0;

          return (
            <div data-tour="preview" className="space-y-3">
              {/* Manual mode header / dieline import */}
              <div className="rounded-lg border border-accent/40 bg-accent/5 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Hand className="w-4 h-4 text-accent-foreground" />
                    <span className="text-xs font-bold text-accent-foreground">وضع التحكم اليدوي</span>
                  </div>
                  <span data-tour="dieline-import">
                    <DielineImportDialog
                      onImported={handleDielineImport}
                      triggerLabel={importedDieline ? 'تغيير القالب' : 'استيراد قالب علبة'}
                      compact
                    />
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  المحرك الذكي مُعطَّل. القوالب تُستورد كما هي 100% — حرّك / دوّر / كرّر بدون تدخل.
                  العدد الناتج يُربط بحساب التكلفة عند الانتهاء.
                </p>
                {importedDieline && (
                  <div className="flex items-center justify-between gap-2 text-[10px] bg-primary/10 border border-primary/30 rounded px-2 py-1.5">
                    <span className="text-primary font-semibold truncate">
                      ✓ {importedDieline.fileName} ({importedDieline.width.toFixed(1)}×{importedDieline.height.toFixed(1)} سم)
                    </span>
                    <button
                      onClick={() => updateActiveSheet({ importedDieline: null, manualCount: 0, manualPieces: [] })}
                      className="text-destructive/70 hover:text-destructive shrink-0"
                    >إزالة</button>
                  </div>
                )}
              </div>

              {/* Live count badge — feeds the cost engine on confirm */}
              {manualCount > 0 && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                  <span className="text-xs text-muted-foreground">عدد القطع في الشيت (يدوي)</span>
                  <span className="text-lg font-bold text-primary tabular-nums">{manualCount}</span>
                </div>
              )}

              {/* Free editor — no auto distribution, no scenarios.
                  Each sheet owns its own manualPieces array; switching tabs
                  remounts the editor with that sheet's stored layout, so
                  every sheet keeps an independent free distribution. */}
              {canEdit ? (
                <WorkspaceScaler>
                  <ManualLayoutHost
                    key={`manual-${sheet?.id}-${importedDieline?.fileName || 'no-dl'}`}
                    sheetW={sheetW}
                    sheetH={sheetH}
                    productW={pW}
                    productH={pH}
                    importedDieline={importedDieline}
                    onDielineImported={handleDielineImport}
                    initialPieces={sheet?.manualPieces ?? []}
                    onCountChange={(count, layoutPieces) =>
                      updateActiveSheet({ manualCount: count, manualPieces: layoutPieces.map(p => ({ ...p })) })
                    }
                  />
                </WorkspaceScaler>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  أدخل مقاس الصنف ومقاس شيت الطباعة لبدء التحرير اليدوي.
                </div>
              )}

              {/* Confirm button — applies manualCount to cutsPerSheet */}
              {manualCount > 0 && (
                <Button
                  className="w-full gap-2"
                  onClick={() => {
                    updatePiece(activeSheetIdx, 0, { cutsPerSheet: manualCount, baseCuts: 1 });
                    toast.success(`تم اعتماد التوزيع: ${manualCount} قطعة لكل شيت`);
                  }}
                >
                  <Check className="w-4 h-4" /> اعتماد التوزيع وحساب التكلفة
                </Button>
              )}
            </div>
          );
        })()}

        {/* تفاصيل for each piece */}
        {sheet?.pieces.map((piece, pieceIdx) => {
          const cost = pieceCosts[pieceIdx];
          if (!cost?.valid) return null;

          const details: { label: string; value: string; highlight?: boolean }[] = [];

          const matchedSize = priceSettings.sizes.find(
            s => (s.width === piece.printWidth && s.height === piece.printHeight) ||
                 (s.width === piece.printHeight && s.height === piece.printWidth)
          );
          if (matchedSize) details.push({ label: 'مقاس الطباعة', value: matchedSize.sizeName, highlight: true });
          if (cost.thousands > 0) details.push({ label: 'عدد الآلاف', value: `${cost.thousands}` });
          if (cost.printSheetsPerPurchase > 0) details.push({ label: 'تفصيل الشيت الأساسي', value: cost.printSheetsPerPurchase.toString() });
          if (cost.printSheetsBeforeWaste > 0) details.push({ label: 'عدد شيتات الطباعة', value: cost.printSheetsBeforeWaste.toString() });
          if (cost.printSheetsAfterWaste > 0) details.push({ label: 'شيتات الطباعة بعد الهدر', value: cost.printSheetsAfterWaste.toString() });
          if (cost.purchaseSheetsNeeded > 0) details.push({ label: 'عدد شيتات الشراء', value: cost.purchaseSheetsNeeded.toString() });
          if (cost.paperCost > 0) details.push({ label: 'الورق', value: `${cost.paperCost.toFixed(2)} ر.س` });
          if (cost.sortCost > 0) details.push({ label: 'الفرز', value: `${cost.sortCost.toFixed(2)} ر.س` });
          if (cost.printCost > 0) details.push({ label: 'الطباعة', value: `${cost.printCost.toFixed(2)} ر.س` });
          if (cost.extraColorCost > 0) details.push({ label: 'ألوان إضافية', value: `${cost.extraColorCost.toFixed(2)} ر.س` });
          if (cost.cellophaneCost > 0) details.push({ label: 'السلفان', value: `${cost.cellophaneCost.toFixed(2)} ر.س` });
          if (cost.dieCutCost > 0) details.push({ label: 'التكسير', value: `${cost.dieCutCost.toFixed(2)} ر.س` });
          if (piece.moldPrice > 0) details.push({ label: 'قيمة القالب', value: `${piece.moldPrice.toFixed(2)} ر.س` });
          if (cost.customFieldsBreakdown?.length > 0) {
            cost.customFieldsBreakdown.forEach(cf => {
              details.push({ label: cf.name, value: `${cf.value.toFixed(2)} ر.س` });
            });
          }
          if (cost.totalFinishing > 0) details.push({ label: 'مجموع التشطيبات', value: `${cost.totalFinishing.toFixed(2)} ر.س` });

          piece.finishing.forEach((f) => {
            if (!f.enabled) return;
            const fCost = calculateFinishingCost(f, piece.quantity, cost.thousands);
            if (fCost > 0) details.push({ label: `  ${f.name}`, value: `${fCost.toFixed(2)} ر.س`, isSubItem: true } as any);
          });

          if (details.length === 0) return null;

          return (
            <Card key={piece.id} className="shadow-sm border-border/60">
              <CardContent className="pt-5 pb-4">
                <SectionHeader icon={Sparkles} title={sheet.pieces.length > 1 ? `تفاصيل قطعة ${pieceIdx + 1}` : 'تفاصيل الحساب'} />
                <div className="space-y-1 text-xs">
                  {details.map((d, i) => (
                    <DetailRow key={i} label={d.label} value={d.value} highlight={d.highlight} />
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ═══ Save Dialog ═══ */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>حفظ التكلفة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">اسم الصنف</Label>
              <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="مثال: كروت أعمال" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">رقم الصنف</Label>
              <Input value={itemNumber} onChange={(e) => setItemNumber(e.target.value)} placeholder="مثال: 001" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">مقاس الصنف</Label>
              <Input value={itemSize} onChange={(e) => setItemSize(e.target.value)} placeholder="مثال: 9x5.5" className="h-9 text-sm" />
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:flex-row-reverse mt-4">
            <Button onClick={() => handleSave(false)} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" /> {editingQuoteId ? 'تحديث' : 'حفظ'}
            </Button>
            <Button variant="outline" onClick={() => handleSave(true)} disabled={saving}>
              حفظ بدون بيانات الصنف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Mobile Floating Summary Bar ═══ */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden glass-header border-t border-border/50 shadow-[0_-4px_20px_-4px_hsl(221_83%_53%_/_0.15)]">
        <div className="container mx-auto px-3 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground leading-tight">الإجمالي</p>
              <p className="text-lg font-bold text-primary leading-tight">
                {(sheets.length > 1 ? allSheetsGrandTotal : sheetGrandTotal).toFixed(2)}
              </p>
            </div>
            {sheetTotalQuantity > 0 && sheetGrandTotal > 0 && (
              <div className="text-center border-r border-border/60 pr-3">
                <p className="text-[10px] text-muted-foreground leading-tight">سعر القطعة</p>
                <p className="text-sm font-semibold text-foreground leading-tight">
                  {(sheetGrandTotal / sheetTotalQuantity).toFixed(3)}
                </p>
              </div>
            )}
          </div>
          <Button size="sm" className="gap-1.5 shrink-0 h-9" onClick={() => setSaveDialogOpen(true)}>
            <Save className="w-3.5 h-3.5" /> حفظ
          </Button>
        </div>
      </div>

      {/* ═══ Interactive Guide ═══ */}
      <SpotlightTour open={tourOpen} steps={HYBRID_ENGINE_STEPS} onClose={() => setTourOpen(false)} />
      <LightHints enabled={hintsOpen} steps={HYBRID_ENGINE_STEPS} onDismiss={() => setHintsOpen(false)} />
    </div>
  );
};

/* ── Helper: calculate single finishing cost ── */
function calculateFinishingCost(item: FinishingItem, quantity: number, thousands: number): number {
  if (!item.enabled || !item.pricePerUnit) return 0;
  const m = item.multiplier || 1;
  switch (item.calcType) {
    case 'per_piece': return quantity * m * item.pricePerUnit;
    case 'per_1000': return thousands * m * item.pricePerUnit;
    case 'tiered_1000': return m * (item.pricePerUnit + Math.max(thousands - 1, 0) * item.extraPer1000);
    case 'flat': return m * item.pricePerUnit;
    default: return 0;
  }
}

/* ── Piece Inputs Component ── */
const PieceInputs = ({
  piece, pieceIdx, sheetIdx, totalPieces, paperTypes, priceSettings, pieceCost,
  updatePiece, removePiece,
}: {
  piece: PieceData;
  pieceIdx: number;
  sheetIdx: number;
  totalPieces: number;
  paperTypes: any[];
  priceSettings: any;
  pieceCost: any;
  updatePiece: (si: number, pi: number, u: Partial<PieceData>) => void;
  removePiece: (si: number, pi: number) => void;
}) => {
  const [finishingOpen, setFinishingOpen] = useState(false);
  const [additionalOpen, setAdditionalOpen] = useState(false);

  const update = useCallback((u: Partial<PieceData>) => updatePiece(sheetIdx, pieceIdx, u), [sheetIdx, pieceIdx, updatePiece]);

  const paperKey = piece.paperType && piece.grammage && piece.purchaseSize
    ? `${piece.paperType}|${piece.grammage}|${piece.purchaseSize}` : '';

  const handlePaperChange = (val: string) => {
    const [paperType, grammage, purchaseSize] = val.split('|');
    update({ paperType, grammage: Number(grammage), purchaseSize });
  };

  // Machine size = the size row chosen via the color picker (independent of product print size).
  const machineSize = piece.machineSizeIdx >= 0 ? priceSettings.sizes[piece.machineSizeIdx] : null;
  const machineW = machineSize?.width || 0;
  const machineH = machineSize?.height || 0;

  // Cellophane mismatch dialog state
  const [cellophaneAlertOpen, setCellophaneAlertOpen] = useState(false);
  const pendingPressRef = useRef<{ w: number; h: number } | null>(null);

  // Helper: does a (w,h) match any configured size row?
  const sizeRowMatches = useCallback((w: number, h: number) => {
    if (w <= 0 || h <= 0) return true; // empty input — no warning
    return priceSettings.sizes.some(
      (s: any) => (s.width === w && s.height === h) || (s.width === h && s.height === w)
    );
  }, [priceSettings.sizes]);

  const handleColorSelect = (sizeIdx: number, colors: number) => {
    const size = priceSettings.sizes[sizeIdx];
    if (!size) return;
    // Color row defines machine + colors only. Auto-fill press sheet if blank
    // OR if user previously had press matching the prior machine size.
    const updates: Partial<PieceData> = { machineSizeIdx: sizeIdx, colorCount: colors };
    const pressBlank = !piece.pressWidth || !piece.pressHeight;
    const pressMatchedOldMachine = machineSize &&
      ((piece.pressWidth === machineSize.width && piece.pressHeight === machineSize.height) ||
       (piece.pressWidth === machineSize.height && piece.pressHeight === machineSize.width));
    if (pressBlank || pressMatchedOldMachine) {
      updates.pressWidth = size.width;
      updates.pressHeight = size.height;
    }
    update(updates);
  };

  const applyPressChange = (w: number, h: number) => {
    update({ pressWidth: w, pressHeight: h });
  };

  // Handler when the user edits a press dimension. Shows warning dialog when:
  // - cellophane is enabled
  // - new size doesn't match any configured size row
  // - override isn't already set
  const handlePressChange = (w: number, h: number) => {
    if (
      piece.cellophaneFaces > 0 &&
      !piece.cellophaneOverrideEnabled &&
      w > 0 && h > 0 &&
      !sizeRowMatches(w, h)
    ) {
      pendingPressRef.current = { w, h };
      setCellophaneAlertOpen(true);
      return;
    }
    applyPressChange(w, h);
  };

  // Validation flags
  const productExceedsMachine = machineSize && piece.printWidth > 0 && piece.printHeight > 0 && (
    Math.max(piece.printWidth, piece.printHeight) > Math.max(machineW, machineH) ||
    Math.min(piece.printWidth, piece.printHeight) > Math.min(machineW, machineH)
  );
  const pressExceedsMachine = machineSize && piece.pressWidth > 0 && piece.pressHeight > 0 && (
    Math.max(piece.pressWidth, piece.pressHeight) > Math.max(machineW, machineH) ||
    Math.min(piece.pressWidth, piece.pressHeight) > Math.min(machineW, machineH)
  );

  const enabledFinishing = piece.finishing.filter(f => f.enabled);

  const updateFinishing = (fIdx: number, updates: Partial<FinishingItem>) => {
    update({ finishing: piece.finishing.map((f, i) => i === fIdx ? { ...f, ...updates } : f) });
  };

  const toggleFinishing = (fIdx: number) => {
    update({ finishing: piece.finishing.map((f, i) => i === fIdx ? { ...f, enabled: !f.enabled } : f) });
  };

  const addCustomFinishing = () => {
    update({ finishing: [...piece.finishing, { name: 'تشطيب جديد', enabled: true, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' }] });
  };

  const removeFinishing = (fIdx: number) => {
    update({ finishing: piece.finishing.filter((_, i) => i !== fIdx) });
  };

  const isExtraPiece = pieceIdx > 0;

  return (
    <>
      {isExtraPiece && (
        <div className="flex items-center gap-2 pt-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs font-semibold text-primary">قطعة {pieceIdx + 1}</span>
          <button onClick={() => removePiece(sheetIdx, pieceIdx)} className="text-destructive/60 hover:text-destructive text-xs">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      {/* ── بيانات الصنف ── */}
      <Card className="shadow-sm border-border/60">
        <CardContent className="pt-5 pb-4">
          <SectionHeader icon={FileText} title="بيانات الصنف" />

          {/* Vertical layout: each row = label (right) + inputs (left) */}
          <div className="space-y-3">

            {/* مقاس الصنف */}
            <div className="grid grid-cols-12 items-center gap-3" data-tour={pieceIdx === 0 ? 'item-size' : undefined}>
              <Label className="text-xs col-span-4 sm:col-span-3 text-right">مقاس الصنف</Label>
              <div className="col-span-8 sm:col-span-9 flex items-center gap-2">
                <Input
                  type="number" min={0} step={0.1}
                  className={`h-9 text-sm flex-1 ${productExceedsMachine ? 'border-destructive ring-1 ring-destructive/40' : ''}`}
                  value={piece.printWidth || ''}
                  onChange={(e) => update({ printWidth: Math.max(0, Number(e.target.value)) })}
                  placeholder="عرض الصنف"
                />
                <span className="text-xs text-muted-foreground font-bold">x</span>
                <Input
                  type="number" min={0} step={0.1}
                  className={`h-9 text-sm flex-1 ${productExceedsMachine ? 'border-destructive ring-1 ring-destructive/40' : ''}`}
                  value={piece.printHeight || ''}
                  onChange={(e) => update({ printHeight: Math.max(0, Number(e.target.value)) })}
                  placeholder="ارتفاع الصنف"
                />
              </div>
            </div>

            {/* نوع الورق */}
            <div className="grid grid-cols-12 items-center gap-3" data-tour={pieceIdx === 0 ? 'paper-type' : undefined}>
              <Label className="text-xs col-span-4 sm:col-span-3 text-right">نوع الورق</Label>
              <div className="col-span-8 sm:col-span-9">
                <PaperCombobox paperTypes={paperTypes} value={paperKey} onChange={handlePaperChange} />
              </div>
            </div>

            {/* الألوان */}
            <div className="grid grid-cols-12 items-center gap-3" data-tour={pieceIdx === 0 ? 'colors' : undefined}>
              <Label className="text-xs col-span-4 sm:col-span-3 text-right">الألوان</Label>
              <div className="col-span-8 sm:col-span-9">
                <ColorDropdown
                  sizes={priceSettings.sizes}
                  selectedSizeIdx={piece.machineSizeIdx}
                  colorCount={piece.colorCount}
                  extraColors={piece.extraColorCount}
                  onSelect={handleColorSelect}
                  onExtraChange={(extra) => update({ extraColorCount: extra })}
                />
              </div>
            </div>

            {/* كمية الصنف */}
            <div className="grid grid-cols-12 items-center gap-3" data-tour={pieceIdx === 0 ? 'quantity' : undefined}>
              <Label className="text-xs col-span-4 sm:col-span-3 text-right">كمية الصنف</Label>
              <div className="col-span-8 sm:col-span-9">
                <Input
                  type="number" className="h-9 text-sm"
                  value={piece.quantity}
                  onChange={(e) => update({ quantity: Number(e.target.value) })}
                  placeholder="الكمية"
                />
              </div>
            </div>

            {/* مقاس شيت الطباعة */}
            <div className="grid grid-cols-12 items-center gap-3" data-tour={pieceIdx === 0 ? 'press-sheet' : undefined}>
              <Label className="text-xs col-span-4 sm:col-span-3 text-right">
                مقاس شيت الطباعة
                {machineSize && (
                  <span className="block text-[10px] font-normal text-muted-foreground mt-0.5">
                    ماكينة: {machineW}×{machineH}
                  </span>
                )}
              </Label>
              <div className="col-span-8 sm:col-span-9 flex items-center gap-2">
                <Input
                  type="number" min={0} step={0.1}
                  className={`h-9 text-sm flex-1 ${pressExceedsMachine ? 'border-destructive ring-1 ring-destructive/40' : ''}`}
                  value={piece.pressWidth || ''}
                  onChange={(e) => handlePressChange(Math.max(0, Number(e.target.value)), piece.pressHeight)}
                  placeholder="عرض الشيت"
                />
                <span className="text-xs text-muted-foreground font-bold">x</span>
                <Input
                  type="number" min={0} step={0.1}
                  className={`h-9 text-sm flex-1 ${pressExceedsMachine ? 'border-destructive ring-1 ring-destructive/40' : ''}`}
                  value={piece.pressHeight || ''}
                  onChange={(e) => handlePressChange(piece.pressWidth, Math.max(0, Number(e.target.value)))}
                  placeholder="ارتفاع الشيت"
                />
              </div>
            </div>

          </div>

          {/* تنبيهات التحقق */}
          {productExceedsMachine && (
            <Alert variant="destructive" className="mt-3 py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                مقاس المنتج ({piece.printWidth}×{piece.printHeight}) أكبر من مقاس الماكينة ({machineW}×{machineH}).
                يرجى تعديل مقاس المنتج ليكون مناسباً للماكينة.
              </AlertDescription>
            </Alert>
          )}
          {pressExceedsMachine && (
            <Alert variant="destructive" className="mt-3 py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                مقاس شيت الطباعة ({piece.pressWidth}×{piece.pressHeight}) أكبر من مقاس الماكينة ({machineW}×{machineH}).
                يجب أن يكون شيت الطباعة مساوي أو أصغر من الماكينة.
              </AlertDescription>
            </Alert>
          )}

          {/* السلفان: عرض السعر المطبَّق ومفتاح التعديل اليدوي */}
          {piece.cellophaneFaces > 0 && (
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/30 rounded-md px-3 py-2 flex-wrap">
              <span>سعر السلفان للوجه:</span>
              {piece.cellophaneOverrideEnabled ? (
                <>
                  <span className="font-bold text-primary">{piece.cellophaneOverridePerFace.toFixed(4)} ر.س (يدوي)</span>
                  <Input
                    type="number" min={0} step={0.0001}
                    className="h-7 w-24 text-xs"
                    value={piece.cellophaneOverridePerFace}
                    onChange={(e) => update({ cellophaneOverridePerFace: Math.max(0, Number(e.target.value)) })}
                  />
                  <button
                    onClick={() => update({ cellophaneOverrideEnabled: false, cellophaneOverridePerFace: 0 })}
                    className="text-[10px] text-primary hover:underline mr-auto"
                  >
                    العودة لسعر الماكينة
                  </button>
                </>
              ) : (
                <>
                  <span className="font-bold">
                    {(() => {
                      const m = priceSettings.sizes.find((s: any) =>
                        (s.width === piece.pressWidth && s.height === piece.pressHeight) ||
                        (s.width === piece.pressHeight && s.height === piece.pressWidth)
                      );
                      const perFace = m?.cellophanePerFace ?? machineSize?.cellophanePerFace ?? 0;
                      return `${perFace.toFixed(4)} ر.س`;
                    })()}
                  </span>
                  <button
                    onClick={() => update({ cellophaneOverrideEnabled: true })}
                    className="text-[10px] text-primary hover:underline mr-auto"
                  >
                    تعديل يدوي
                  </button>
                </>
              )}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground mt-2">
            خانة الألوان تحدد مقاس الماكينة وأسعار الطباعة والفرز. شيت الطباعة يُملأ افتراضياً بنفس مقاس الماكينة ويمكن تعديله (≤ مقاس الماكينة).
          </p>

          {/* AlertDialog عند تعديل شيت الطباعة لمقاس غير موجود في إعدادات الألوان */}
          <AlertDialog open={cellophaneAlertOpen} onOpenChange={setCellophaneAlertOpen}>
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle>مقاس السلفان غير مطابق للإعدادات</AlertDialogTitle>
                <AlertDialogDescription>
                  مقاس شيت الطباعة الجديد ({pendingPressRef.current?.w ?? 0}×{pendingPressRef.current?.h ?? 0}) غير موجود
                  في إعدادات الألوان. اختر كيف تريد التعامل مع سعر السلفان:
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row-reverse gap-2">
                <AlertDialogAction
                  onClick={() => {
                    if (pendingPressRef.current) applyPressChange(pendingPressRef.current.w, pendingPressRef.current.h);
                    update({ cellophaneOverrideEnabled: true, cellophaneOverridePerFace: machineSize?.cellophanePerFace ?? 0 });
                    pendingPressRef.current = null;
                  }}
                >
                  تعديل سعر السلفان يدوياً
                </AlertDialogAction>
                <AlertDialogCancel
                  onClick={() => {
                    if (pendingPressRef.current) applyPressChange(pendingPressRef.current.w, pendingPressRef.current.h);
                    pendingPressRef.current = null;
                  }}
                >
                  الاستمرار بسعر الماكينة
                </AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

        </CardContent>
      </Card>

      {/* ── بيانات اضافية ── */}
      <Collapsible open={additionalOpen} onOpenChange={setAdditionalOpen}>
        <Card className="shadow-sm border-border/60">
          <CollapsibleTrigger asChild>
            <CardContent className="pt-5 pb-4 cursor-pointer hover:bg-muted/20 transition-colors">
              <div className="flex items-center justify-between">
                <SectionHeader icon={Sparkles} title="بيانات إضافية" />
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${additionalOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardContent>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">الأوجه المطبوعة</Label>
                  <Select value={piece.printedFaces.toString()} onValueChange={(val) => update({ printedFaces: Number(val), facesDifferent: Number(val) === 1 ? false : piece.facesDifferent })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">وجه واحد</SelectItem>
                      <SelectItem value="2">وجهان</SelectItem>
                    </SelectContent>
                  </Select>
                  {piece.printedFaces === 2 && (
                    <div className="flex items-center gap-2 mt-1">
                      <Switch checked={piece.facesDifferent} onCheckedChange={(val) => update({ facesDifferent: val })} />
                      <Label className="text-[10px] text-muted-foreground">هل مختلفان؟</Label>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">كمية الهدر</Label>
                    <button onClick={() => update({ wasteMode: piece.wasteMode === 'number' ? 'percent' : 'number' })} className="text-[10px] text-primary hover:underline">
                      {piece.wasteMode === 'number' ? 'تبديل إلى %' : 'تبديل إلى رقم'}
                    </button>
                  </div>
                  <div className="relative">
                    <Input type="number" className="h-9 text-sm" value={piece.wastePercent} onChange={(e) => update({ wastePercent: Number(e.target.value) })} />
                    {piece.wasteMode === 'percent' && (
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    )}
                  </div>
                  {piece.wastePercent > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <Switch checked={piece.wasteInCosts} onCheckedChange={(val) => update({ wasteInCosts: val })} className="scale-75" />
                      <Label className="text-[10px] text-muted-foreground">{piece.wasteInCosts ? 'جميع التكاليف' : 'ورق فقط'}</Label>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">السلفان</Label>
                  <Select value={piece.cellophaneFaces.toString()} onValueChange={(val) => update({ cellophaneFaces: Number(val) })}>
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
                    <Switch checked={piece.dieCut} onCheckedChange={(val) => update({ dieCut: val })} />
                    <span className="text-xs text-muted-foreground">{piece.dieCut ? 'مفعّل' : 'معطّل'}</span>
                  </div>
                </div>
              </div>

              {piece.dieCut && (
                <div className="mt-3 max-w-xs">
                  <Label className="text-xs">قيمة القالب (ريال)</Label>
                  <Input type="number" className="h-9 text-sm mt-1" value={piece.moldPrice} onChange={(e) => update({ moldPrice: Number(e.target.value) })} />
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
                  {enabledFinishing.length > 0 && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                      {enabledFinishing.length} مفعّل
                    </span>
                  )}
                </div>
                {finishingOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </CardContent>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4 space-y-2">
              {/* Column Headers */}
              {(() => { const hasTiered = piece.finishing.some(f => f.enabled && f.calcType === 'tiered_1000'); return (
              <div className="hidden sm:flex items-center gap-2 flex-wrap px-3 pb-1 border-b border-border/40">
                <span className="text-[10px] font-semibold text-muted-foreground w-28">التشطيب</span>
                <span className="text-[10px] font-semibold text-muted-foreground w-28">نوع الحساب</span>
                <span className="text-[10px] font-semibold text-muted-foreground w-20">المتغيرات</span>
                <span className="text-[10px] font-semibold text-muted-foreground w-24">سعر الوحدة</span>
                {hasTiered && <span className="text-[10px] font-semibold text-muted-foreground w-24">ألف إضافي</span>}
                <span className="text-[10px] font-semibold text-muted-foreground mr-auto">التكلفة</span>
              </div>); })()}
              {piece.finishing.map((item, idx) => (
                <FinishingRow
                  key={idx}
                  item={item}
                  cost={calculateFinishingCost(item, piece.quantity, pieceCost?.thousands || 1)}
                  onToggle={() => toggleFinishing(idx)}
                  onChange={(updates) => updateFinishing(idx, updates)}
                  onRemove={() => removeFinishing(idx)}
                />
              ))}
              <Button variant="outline" size="sm" className="w-full border-dashed mt-2" onClick={addCustomFinishing}>
                <Plus className="w-3.5 h-3.5 ml-1" /> إضافة تشطيب
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* المحرك الذكي يظهر في العمود الأيمن من تخطيط الصفحة (SmartSheetLayoutPreview) */}

    </>
  );
};

/* ── Finishing Row ── */
const FINISHING_HELP: Record<string, { title: string; desc: string }> = {
  name: { title: 'اسم الخدمة', desc: 'الاسم الذي يظهر في عرض السعر (مثل: تغليف، سلوفان، تذهيب).' },
  calcType: { title: 'نوع الحساب', desc: 'طريقة الاحتساب: لكل قطعة، لكل ألف، شرائح ألف (سعر مختلف بعد أول ألف)، أو مبلغ ثابت.' },
  multiplier: { title: 'عدد المتغيرات', desc: 'مضاعف يُطبَّق على السعر (مثلاً: عدد الأوجه المُذهَّبة أو طبقات السلوفان).' },
  pricePerUnit: { title: 'سعر الوحدة', desc: 'السعر الأساسي للوحدة وفق نوع الحساب المختار.' },
  extraPer1000: { title: 'كل ألف إضافي', desc: 'سعر كل ألف قطعة إضافية بعد الألف الأول (يظهر مع شرائح ألف فقط).' },
};

const FieldHelp = ({ field }: { field: keyof typeof FINISHING_HELP }) => {
  const info = FINISHING_HELP[field];
  return (
    <Popover>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="inline-flex items-center justify-center text-muted-foreground hover:text-primary transition-colors shrink-0"
          aria-label={`شرح: ${info.title}`}
        >
          <HelpCircle className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-60 p-3 text-right" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-bold text-foreground mb-1">{info.title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{info.desc}</p>
      </PopoverContent>
    </Popover>
  );
};

const FinishingRow = ({
  item, cost, onToggle, onChange, onRemove,
}: {
  item: FinishingItem; cost: number;
  onToggle: () => void; onChange: (u: Partial<FinishingItem>) => void; onRemove: () => void;
}) => {
  // Live Update: auto-enable on meaningful input, auto-disable when cleared
  const isMeaningful = (next: FinishingItem) => {
    const price = Number(next.pricePerUnit) || 0;
    const extra = Number(next.extraPer1000) || 0;
    if (next.calcType === 'tiered_1000') return price > 0 || extra > 0;
    return price > 0;
  };
  const handleFieldChange = (updates: Partial<FinishingItem>) => {
    const merged = { ...item, ...updates } as FinishingItem;
    const meaningful = isMeaningful(merged);
    if (meaningful && !item.enabled) onChange({ ...updates, enabled: true });
    else if (!meaningful && item.enabled) onChange({ ...updates, enabled: false });
    else onChange(updates);
  };

  return (
  <div
    className={`rounded-lg border p-2.5 sm:p-3 transition-all cursor-pointer
      ${item.enabled
        ? 'bg-primary/5 border-primary/30 shadow-sm'
        : 'bg-muted/20 border-transparent hover:bg-primary/5 hover:border-primary/20'
      }`}
    onClick={(e) => {
      if ((e.target as HTMLElement).closest('input, select, button, [role="combobox"]')) return;
      onToggle();
    }}
  >
    <div className="flex items-center gap-1.5 sm:flex-nowrap flex-wrap">
      <FieldHelp field="name" />
      <Input
        className="h-8 text-xs w-full sm:w-24 bg-background shrink-0"
        value={item.name}
        onChange={(e) => handleFieldChange({ name: e.target.value })}
        onClick={(e) => e.stopPropagation()}
      />
      <FieldHelp field="calcType" />
      <Select value={item.calcType} onValueChange={(val) => handleFieldChange({ calcType: val as FinishingItem['calcType'] })}>
        <SelectTrigger className="h-8 text-xs w-full sm:w-24 bg-background shrink-0" onClick={(e) => e.stopPropagation()}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(calcTypeLabels).map(([key, val]) => (
            <SelectItem key={key} value={key}>{val.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldHelp field="multiplier" />
      <Input type="number" className="h-8 text-xs w-16 bg-background shrink-0" value={item.multiplier} onChange={(e) => handleFieldChange({ multiplier: Number(e.target.value) })} onClick={(e) => e.stopPropagation()} placeholder="متغ" />
      <FieldHelp field="pricePerUnit" />
      <Input type="number" className="h-8 text-xs w-20 bg-background shrink-0" value={item.pricePerUnit} onChange={(e) => handleFieldChange({ pricePerUnit: Number(e.target.value) })} onClick={(e) => e.stopPropagation()} placeholder="سعر" />
      {item.calcType === 'tiered_1000' && (
        <>
          <FieldHelp field="extraPer1000" />
          <Input type="number" className="h-8 text-xs w-20 bg-background shrink-0" value={item.extraPer1000} onChange={(e) => handleFieldChange({ extraPer1000: Number(e.target.value) })} onClick={(e) => e.stopPropagation()} placeholder="ألف+" />
        </>
      )}
      {item.enabled && (
        <span className="text-xs font-bold text-primary whitespace-nowrap mr-auto">{cost.toFixed(2)} ر.س</span>
      )}
      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  </div>
  );
};

const DetailRow = ({ label, value, highlight, isSubItem }: { label: string; value: string; highlight?: boolean; isSubItem?: boolean }) => (
  <div className={`flex items-center justify-between py-1 px-2 rounded ${isSubItem ? 'opacity-50 pr-4' : ''}`}>
    <span className="text-muted-foreground">{label}</span>
    <span className={`font-mono ${highlight ? 'text-primary font-semibold' : isSubItem ? 'font-normal' : 'font-medium'}`}>{value}</span>
  </div>
);

export default HybridEngineCalculator;
