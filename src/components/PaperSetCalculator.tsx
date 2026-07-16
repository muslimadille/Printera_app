import { useState, useMemo, useCallback, useRef } from 'react';
import { usePrintingStore, type SizePricing, type ColorPricing, type PaperType, type FinishingItem } from '@/store/printingStore';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, Calculator, Layers, FileText, ChevronDown, ChevronUp, Sparkles, Copy, Save, AlertTriangle } from 'lucide-react';
import SheetLayoutPreview from '@/components/SheetLayoutPreview';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import ProfitMargins from '@/components/ProfitMargins';
import { toast } from 'sonner';
import { calcTypeLabels } from '@/lib/calcTypeLabels';
import { saveQuote, updateQuote } from '@/lib/userApi';
import { usePreviewSettings } from '@/hooks/usePreviewSettings';

/* ── helpers ── */
function migrateSizePricing(s: any): SizePricing {
  if (s.color1) return s;
  const d: ColorPricing = { sortPerFace: 0, printFirst1000PerFace: 0, printExtra1000PerFace: 0 };
  return { ...s, color1: { sortPerFace: s.sortSingleFace || 0, printFirst1000PerFace: s.printFirst1000PerFace || 0, printExtra1000PerFace: s.printExtra1000PerFace || 0 }, color2: { ...d }, color3: { ...d }, color4: { ...d } };
}

function getColorPricing(size: SizePricing, colorCount: number): ColorPricing | null {
  const m = migrateSizePricing(size);
  if (colorCount === 0) return null;
  if (colorCount === 1) return m.color1;
  if (colorCount === 2) return m.color2;
  if (colorCount === 3) return m.color3;
  return m.color4;
}

/* ── Color Selector ── */
const ColorSelector = ({
  sizes, selectedSizeIdx, colorCount, onSelect,
}: {
  sizes: SizePricing[];
  selectedSizeIdx: number;
  colorCount: number;
  onSelect: (sizeIdx: number, colors: number) => void;
}) => {
  const [open, setOpen] = useState(false);
  const selectedLabel = selectedSizeIdx >= 0
    ? `${colorCount} ألوان - ${sizes[selectedSizeIdx].width}×${sizes[selectedSizeIdx].height}`
    : 'اختر الألوان والمقاس';

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
              <span className="text-xs font-semibold text-muted-foreground min-w-[65px] text-center">{size.width}×{size.height}</span>
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
  paperTypes: PaperType[];
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

/* ── Default finishing ── */
const defaultFinishing: FinishingItem[] = [
  { name: 'ورنيش', enabled: false, calcType: 'per_piece', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'وتر بيز', enabled: false, calcType: 'per_piece', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'يوفي', enabled: false, calcType: 'per_piece', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'بصمة', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'تخريم', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'تجليد', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
];

/* ── Row interface ── */
interface PrintRow {
  id: string;
  sizeIdx: number;
  colorCount: number;
  baseCuts: number;
  cutsPerSheet: number;
  printSheets: number;
  printedFaces: number;
  facesDifferent: boolean;
  paperType: string;
  grammage: number | null;
  purchaseSize: string;
  /** Press sheet width (cm) — used by smart engine */
  pressWidth: number;
  /** Press sheet height (cm) — used by smart engine */
  pressHeight: number;
  /** Stage 1 scenario id (master → press) chosen by user */
  selectedStage1Id?: string;
  /** Stage 2 scenario id (press → product) chosen by user */
  selectedStage2Id?: string;
  // Per-row additional data
  wastePercent: number;
  wasteMode: 'number' | 'percent';
  wasteInCosts: boolean;
  cellophaneFaces: number;
  /** Manual cellophane price override (used when press sheet doesn't match a configured size). */
  cellophaneOverrideEnabled?: boolean;
  cellophaneOverridePerFace?: number;
  hasDieCut: boolean;
  moldPrice: number;
  finishing: FinishingItem[];
}

/* ── Sheet interface ── */
interface SheetData {
  id: string;
  rows: PrintRow[];
}

const defaultRow = (sizes: SizePricing[]): PrintRow => ({
  id: crypto.randomUUID(),
  sizeIdx: sizes.length > 0 ? 0 : -1,
  colorCount: 4,
  baseCuts: 1,
  cutsPerSheet: 1,
  printSheets: 0,
  printedFaces: 2,
  facesDifferent: false,
  paperType: '',
  grammage: null,
  purchaseSize: '',
  pressWidth: 0,
  pressHeight: 0,
  selectedStage1Id: undefined,
  selectedStage2Id: undefined,
  wastePercent: 0,
  wasteMode: 'number',
  wasteInCosts: true,
  cellophaneFaces: 0,
  cellophaneOverrideEnabled: false,
  cellophaneOverridePerFace: 0,
  hasDieCut: false,
  moldPrice: 0,
  finishing: defaultFinishing.map(f => ({ ...f })),
});

const createEmptySheet = (sizes: SizePricing[]): SheetData => ({
  id: crypto.randomUUID(),
  rows: [defaultRow(sizes)],
});

/* ── Finishing cost calculation ── */
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

/* ── Row cost calculation ── */
interface RowResult {
  pagesProduced: number;
  printSheets: number;
  printSheetsAfterWaste: number;
  sortCost: number;
  printCost: number;
  cellophaneCost: number;
  dieCutCost: number;
  paperCost: number;
  finishingCost: number;
  rowTotal: number;
  thousands: number;
}

function calcRow(
  row: PrintRow,
  copies: number,
  sizes: SizePricing[],
  paperTypes: PaperType[],
): RowResult {
  const empty: RowResult = { pagesProduced: 0, printSheets: 0, printSheetsAfterWaste: 0, sortCost: 0, printCost: 0, cellophaneCost: 0, dieCutCost: 0, paperCost: 0, finishingCost: 0, rowTotal: 0, thousands: 0 };
  if (row.sizeIdx < 0 || row.sizeIdx >= sizes.length || copies <= 0) return empty;

  const size = sizes[row.sizeIdx];
  const cuts = row.cutsPerSheet || 1;

  const pagesProduced = (row.printedFaces === 2 && !row.facesDifferent)
    ? Math.ceil(cuts / 2)
    : cuts;

  const autoPrintSheets = Math.ceil(copies * pagesProduced / cuts);
  const printSheets = row.printSheets || autoPrintSheets;

  // Apply waste
  const printSheetsAfterWaste = row.wasteMode === 'number'
    ? printSheets + (row.wastePercent || 0)
    : Math.ceil(printSheets * (1 + row.wastePercent / 100));

  const useWasteInCosts = row.wasteInCosts !== false;
  const effectiveSheets = useWasteInCosts ? printSheetsAfterWaste : printSheets;
  const thousands = Math.max(1, Math.ceil(effectiveSheets / 1000));

  const effectiveColors = Math.min(row.colorCount, 4);
  const cp = effectiveColors > 0 ? getColorPricing(size, effectiveColors) : null;

  let sortCost = 0;
  if (cp) {
    sortCost = (row.printedFaces === 2 && row.facesDifferent) ? cp.sortPerFace * 2 : cp.sortPerFace;
  }

  let printCost = 0;
  if (cp) {
    printCost = row.printedFaces * (cp.printFirst1000PerFace + Math.max(0, thousands - 1) * cp.printExtra1000PerFace);
  }

  const isHidden = (f: string) => size.hiddenFields?.includes(f) ?? false;

  let cellophaneCost = 0;
  if (!isHidden('cellophane') && row.cellophaneFaces > 0) {
    let perFace = size.cellophanePerFace;
    if (row.cellophaneOverrideEnabled) {
      perFace = row.cellophaneOverridePerFace || 0;
    } else if (row.pressWidth > 0 && row.pressHeight > 0) {
      // If press sheet matches a configured size row, prefer its cellophane price
      const matched = sizes.find(s =>
        (s.width === row.pressWidth && s.height === row.pressHeight) ||
        (s.width === row.pressHeight && s.height === row.pressWidth)
      );
      if (matched) perFace = matched.cellophanePerFace;
    }
    cellophaneCost = effectiveSheets * row.cellophaneFaces * perFace;
  }

  let dieCutCost = 0;
  if (row.hasDieCut && !isHidden('diecut')) {
    dieCutCost = size.diecut1st1000 + Math.max(0, thousands - 1) * size.diecutExtra1000;
  }

  // Paper cost
  let paperCost = 0;
  if (row.paperType && row.grammage && row.purchaseSize) {
    const selectedType = paperTypes.find(t => t.name === row.paperType);
    const selectedEntry = selectedType?.entries.find(
      e => e.sizeName === row.purchaseSize && e.grammage === row.grammage
    );
    if (selectedEntry) {
      const purchaseArea = (selectedEntry.width / 100) * (selectedEntry.height / 100);
      const purchaseWeight = purchaseArea * (row.grammage || 0);
      const pricePerGram = selectedEntry.pricePerTon / 1000000;
      const pricingUnit = selectedEntry.pricingUnit || 'ton';
      const pricePerSheet = pricingUnit === 'ream' && (selectedEntry.sheetsPerReam || 500) > 0
        ? (selectedEntry.pricePerReam || 0) / (selectedEntry.sheetsPerReam || 500)
        : purchaseWeight * pricePerGram;

      const baseCuts = row.baseCuts || 1;
      const purchaseSheetsNeeded = Math.ceil(printSheetsAfterWaste / baseCuts);
      paperCost = pricePerSheet * purchaseSheetsNeeded;
    }
  }

  // Finishing cost
  let finishingCost = 0;
  row.finishing.forEach(f => {
    finishingCost += calculateFinishingCost(f, copies, thousands);
  });

  const moldTotal = row.hasDieCut ? row.moldPrice : 0;
  const rowTotal = sortCost + printCost + cellophaneCost + dieCutCost + paperCost + finishingCost + moldTotal;
  return { pagesProduced, printSheets, printSheetsAfterWaste, sortCost, printCost, cellophaneCost, dieCutCost, paperCost, finishingCost, rowTotal, thousands };
}

/* ── Finishing Row Component ── */
const FinishingRow = ({
  item, cost, onToggle, onChange, onRemove,
}: {
  item: FinishingItem; cost: number;
  onToggle: () => void; onChange: (u: Partial<FinishingItem>) => void; onRemove: () => void;
}) => (
  <div
    className={`rounded-lg border p-2.5 transition-all cursor-pointer
      ${item.enabled ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-muted/20 border-transparent hover:bg-primary/5 hover:border-primary/20'}`}
    onClick={(e) => {
      if ((e.target as HTMLElement).closest('input, select, button, [role="combobox"]')) return;
      onToggle();
    }}
  >
    <div className="flex items-center gap-2 flex-wrap">
      <Input className="h-8 text-xs w-full sm:w-28 bg-background" value={item.name} onChange={(e) => onChange({ name: e.target.value })} onClick={(e) => e.stopPropagation()} />
      <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto flex-1">
        <Select value={item.calcType} onValueChange={(val) => onChange({ calcType: val as FinishingItem['calcType'] })}>
          <SelectTrigger className="h-8 text-xs w-full sm:w-28 bg-background" onClick={(e) => e.stopPropagation()}><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(calcTypeLabels).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <Input type="number" className="h-8 text-xs flex-1 min-w-0 bg-background" value={item.multiplier} onChange={(e) => onChange({ multiplier: Number(e.target.value) })} onClick={(e) => e.stopPropagation()} placeholder="متغيرات" />
          <Input type="number" className="h-8 text-xs flex-1 min-w-0 bg-background" value={item.pricePerUnit} onChange={(e) => onChange({ pricePerUnit: Number(e.target.value) })} onClick={(e) => e.stopPropagation()} placeholder="سعر الوحدة" />
          {item.calcType === 'tiered_1000' && (
            <Input type="number" className="h-8 text-xs flex-1 min-w-0 bg-background" value={item.extraPer1000} onChange={(e) => onChange({ extraPer1000: Number(e.target.value) })} onClick={(e) => e.stopPropagation()} placeholder="ألف إضافي" />
          )}
        </div>
        {item.enabled && <span className="text-xs font-bold text-primary whitespace-nowrap">{cost.toFixed(2)} ر.س</span>}
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive shrink-0 mr-auto sm:mr-0" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  </div>
);

/* ── Main Component ── */
const PaperSetCalculator = ({ onNavigateToQuote, sessionToken }: { onNavigateToQuote?: () => void; sessionToken?: string }) => {
  const { showNestingPreview, show3DPreview } = usePreviewSettings();

  const { priceSettings, paperTypes, editingQuoteData, setEditingQuoteData } = usePrintingStore();
  const sizes = priceSettings.sizes;

  const [copies, setCopies] = useState(1000);
  const [pagesPerCopy, setPagesPerCopy] = useState(13);
  const [sheets, setSheets] = useState<SheetData[]>([createEmptySheet(sizes)]);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [addRowPopoverOpen, setAddRowPopoverOpen] = useState(false);
  const [addSheetPopoverOpen, setAddSheetPopoverOpen] = useState(false);

  // Save dialog
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [cellophaneAlertOpen, setCellophaneAlertOpen] = useState(false);
  const [pendingPress, setPendingPress] = useState<{ rowId: string; w: number; h: number } | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemNumber, setItemNumber] = useState('');
  const [itemSize, setItemSize] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);

  // Load editing quote data
  useState(() => {
    if (editingQuoteData?.sourceType === 'paperset' && editingQuoteData.rawInputs) {
      const raw = editingQuoteData.rawInputs;
      if (raw.sheets) { setSheets(raw.sheets); }
      else if (raw.rows) { setSheets([{ id: crypto.randomUUID(), rows: raw.rows }]); }
      if (raw.copies) setCopies(raw.copies);
      if (raw.pagesPerCopy) setPagesPerCopy(raw.pagesPerCopy);
      setItemName(editingQuoteData.itemName || '');
      setItemNumber(editingQuoteData.itemNumber || '');
      setItemSize(editingQuoteData.itemSize || '');
      if (editingQuoteData.quoteId) setEditingQuoteId(editingQuoteData.quoteId);
      setEditingQuoteData(null);
    }
  });

  const sheet = sheets[activeSheetIdx];
  const rows = sheet?.rows || [];

  const updateRow = useCallback((id: string, updates: Partial<PrintRow>) => {
    setSheets(prev => prev.map((s, si) => si === activeSheetIdx
      ? { ...s, rows: s.rows.map(r => r.id === id ? { ...r, ...updates } : r) }
      : s
    ));
  }, [activeSheetIdx]);

  const setRows = useCallback((fn: (prev: PrintRow[]) => PrintRow[]) => {
    setSheets(prev => prev.map((s, si) => si === activeSheetIdx ? { ...s, rows: fn(s.rows) } : s));
  }, [activeSheetIdx]);

  const addRow = useCallback((duplicate = false) => {
    setSheets(prev => prev.map((s, si) => {
      if (si !== activeSheetIdx) return s;
      const newRow = duplicate && s.rows.length > 0
        ? { ...s.rows[s.rows.length - 1], id: crypto.randomUUID(), finishing: s.rows[s.rows.length - 1].finishing.map(f => ({ ...f })) }
        : defaultRow(sizes);
      return { ...s, rows: [...s.rows, newRow] };
    }));
    setAddRowPopoverOpen(false);
  }, [sizes, activeSheetIdx]);

  const removeRow = useCallback((id: string) => {
    setSheets(prev => prev.map((s, si) => {
      if (si !== activeSheetIdx || s.rows.length <= 1) return s;
      return { ...s, rows: s.rows.filter(r => r.id !== id) };
    }));
  }, [activeSheetIdx]);

  const addSheet = (duplicate = false) => {
    const newSheet = duplicate
      ? { id: crypto.randomUUID(), rows: sheets[activeSheetIdx].rows.map(r => ({ ...r, id: crypto.randomUUID(), finishing: r.finishing.map(f => ({ ...f })) })) }
      : createEmptySheet(sizes);
    setSheets(prev => [...prev, newSheet]);
    setActiveSheetIdx(sheets.length);
    setAddSheetPopoverOpen(false);
  };

  const removeSheet = (idx: number) => {
    if (sheets.length <= 1) return;
    setSheets(prev => prev.filter((_, i) => i !== idx));
    setActiveSheetIdx(prev => Math.min(prev, sheets.length - 2));
  };

  const results = useMemo(() => rows.map(r => calcRow(r, copies, sizes, paperTypes)), [rows, copies, sizes, paperTypes]);
  const sheetTotal = useMemo(() => results.reduce((s, r) => s + r.rowTotal, 0), [results]);
  const totalPages = useMemo(() => results.reduce((s, r) => s + r.pagesProduced, 0), [results]);

  // All sheets totals
  const allSheetsTotals = useMemo(() => {
    return sheets.map(s => {
      const rowResults = s.rows.map(r => calcRow(r, copies, sizes, paperTypes));
      return rowResults.reduce((sum, r) => sum + r.rowTotal, 0);
    });
  }, [sheets, copies, sizes, paperTypes]);
  const grandTotal = allSheetsTotals.reduce((s, t) => s + t, 0);

  const pricePerCopy = copies > 0 ? grandTotal / copies : 0;

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const handlePaperChange = (rowId: string, val: string) => {
    const [paperType, grammage, purchaseSize] = val.split('|');
    updateRow(rowId, { paperType, grammage: Number(grammage), purchaseSize });
  };

  // Save handler
  const handleSave = async () => {
    if (!sessionToken) { toast.error('يجب تسجيل الدخول أولاً'); return; }
    setSaving(true);
    try {
      const quoteData: Record<string, any> = {
        sourceType: 'paperset',
        rawInputs: { sheets, copies, pagesPerCopy },
        itemName, itemNumber, itemSize,
        grandTotal,
      };
      const title = itemName || `مجموعة أوراق - ${sheets.length} ورقة`;
      if (editingQuoteId) {
        await updateQuote(sessionToken, editingQuoteId, { title, customer_name: itemName, quote_number: itemNumber, quote_data: quoteData });
        toast.success('تم تحديث التكلفة بنجاح');
      } else {
        const saved = await saveQuote(sessionToken, { title, customer_name: itemName, quote_number: itemNumber, source_type: 'paperset', quote_data: quoteData });
        setEditingQuoteId(saved.id);
        toast.success('تم حفظ التكلفة بنجاح');
      }
      setSaveDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ في الحفظ');
    } finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" dir="rtl">
      {/* Main area */}
      <div className="lg:col-span-2 space-y-4">
        {/* Header inputs */}
        <Card className="border-primary/20 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10 text-primary"><Layers className="w-4 h-4" /></div>
              <h3 className="font-semibold text-foreground text-sm">بيانات المطبوعة</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">عدد النسخ</Label>
                <Input type="number" value={copies} onChange={e => setCopies(Number(e.target.value))} min={0} onFocus={e => e.target.select()} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">عدد أوراق كل نسخة</Label>
                <Input type="number" value={pagesPerCopy} onChange={e => setPagesPerCopy(Number(e.target.value))} min={0} onFocus={e => e.target.select()} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sheet tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {sheets.map((s, idx) => (
            <div key={s.id} className="flex items-center">
              <button
                onClick={() => setActiveSheetIdx(idx)}
                className={`px-4 py-2 text-sm rounded-lg border transition-all ${activeSheetIdx === idx ? 'bg-primary text-primary-foreground font-bold border-primary' : 'bg-muted/50 text-muted-foreground hover:bg-muted border-border'}`}
              >
                ورقة {idx + 1}
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
        </div>
        {rows.map((row, idx) => {
          const res = results[idx];
          const pagesFromSheet = (row.printedFaces === 2 && !row.facesDifferent) ? Math.ceil((row.cutsPerSheet || 1) / 2) : (row.cutsPerSheet || 1);
          const autoPrintSheets = Math.ceil(copies * pagesFromSheet / (row.cutsPerSheet || 1));
          const paperKey = row.paperType && row.grammage && row.purchaseSize
            ? `${row.paperType}|${row.grammage}|${row.purchaseSize}` : '';
          const enabledFinishing = row.finishing.filter(f => f.enabled);

          // Machine size = currently selected color row
          const machineSize = row.sizeIdx >= 0 ? sizes[row.sizeIdx] : undefined;
          const machineW = machineSize?.width ?? 0;
          const machineH = machineSize?.height ?? 0;
          const sizeRowMatches = (w: number, h: number) => {
            if (w <= 0 || h <= 0) return true;
            return sizes.some(s => (s.width === w && s.height === h) || (s.width === h && s.height === w));
          };
          const productExceedsMachine = !!machineSize && row.pressWidth >= 0 && false; // product not entered here
          const pressExceedsMachine = !!machineSize && row.pressWidth > 0 && row.pressHeight > 0 && (
            Math.max(row.pressWidth, row.pressHeight) > Math.max(machineW, machineH) ||
            Math.min(row.pressWidth, row.pressHeight) > Math.min(machineW, machineH)
          );

          const handleColorSelect = (sIdx: number, colors: number) => {
            const newSize = sizes[sIdx];
            const updates: Partial<PrintRow> = { sizeIdx: sIdx, colorCount: colors, selectedStage1Id: undefined, selectedStage2Id: undefined };
            const pressBlank = !row.pressWidth || !row.pressHeight;
            const pressMatchedOldMachine = machineSize &&
              ((row.pressWidth === machineSize.width && row.pressHeight === machineSize.height) ||
               (row.pressWidth === machineSize.height && row.pressHeight === machineSize.width));
            if (newSize && (pressBlank || pressMatchedOldMachine)) {
              updates.pressWidth = newSize.width;
              updates.pressHeight = newSize.height;
            }
            updateRow(row.id, updates);
          };

          const applyPressChange = (w: number, h: number) => {
            updateRow(row.id, { pressWidth: w, pressHeight: h, selectedStage1Id: undefined, selectedStage2Id: undefined });
          };
          const handlePressChange = (w: number, h: number) => {
            if (
              row.cellophaneFaces > 0 &&
              !row.cellophaneOverrideEnabled &&
              w > 0 && h > 0 &&
              !sizeRowMatches(w, h)
            ) {
              setPendingPress({ rowId: row.id, w, h });
              setCellophaneAlertOpen(true);
              return;
            }
            applyPressChange(w, h);
          };

          return (
            <Card key={row.id} className="border-border/60 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-primary">صف {idx + 1}</span>
                  {rows.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeRow(row.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  {/* Row 1: Colors + Press Sheet Size + Print sheets count */}
                  <div className="space-y-1 sm:col-span-5">
                    <Label className="text-xs">الألوان (تحدد مقاس الماكينة والتسعير)</Label>
                    <ColorSelector
                      sizes={sizes}
                      selectedSizeIdx={row.sizeIdx}
                      colorCount={row.colorCount}
                      onSelect={handleColorSelect}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-4">
                    <Label className="text-xs">
                      مقاس شيت الطباعة (سم)
                      {machineSize && (
                        <span className="text-[10px] font-normal text-muted-foreground mr-1">
                          — الماكينة: {machineW}×{machineH}
                        </span>
                      )}
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" min={0} step={0.1}
                        className={`h-9 text-sm ${pressExceedsMachine ? 'border-destructive ring-1 ring-destructive/40' : ''}`}
                        value={row.pressWidth || ''}
                        onChange={e => handlePressChange(Math.max(0, Number(e.target.value)), row.pressHeight)}
                        placeholder="عرض" />
                      <Input type="number" min={0} step={0.1}
                        className={`h-9 text-sm ${pressExceedsMachine ? 'border-destructive ring-1 ring-destructive/40' : ''}`}
                        value={row.pressHeight || ''}
                        onChange={e => handlePressChange(row.pressWidth, Math.max(0, Number(e.target.value)))}
                        placeholder="ارتفاع" />
                    </div>
                  </div>
                  <div className="space-y-1 sm:col-span-3">
                    <Label className="text-xs">عدد شيتات الطباعة</Label>
                    <Input type="number" value={row.printSheets || autoPrintSheets} onChange={e => updateRow(row.id, { printSheets: Number(e.target.value) })} min={0} onFocus={e => e.target.select()} />
                  </div>

                  {/* Row 2: Paper type + Faces */}
                  <div className="space-y-1 sm:col-span-6">
                    <Label className="text-xs">نوع الورق (يحدد مقاس الشيت الأساسي)</Label>
                    <PaperCombobox paperTypes={paperTypes} value={paperKey} onChange={val => handlePaperChange(row.id, val)} />
                  </div>
                  <div className="space-y-1 sm:col-span-3">
                    <Label className="text-xs">نوع الطباعة</Label>
                    <Select value={String(row.printedFaces)} onValueChange={v => updateRow(row.id, { printedFaces: Number(v) })}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">وجه واحد</SelectItem>
                        <SelectItem value="2">وجهين</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {row.printedFaces === 2 && (
                    <div className="flex items-center gap-2 pt-5 sm:col-span-3">
                      <Switch checked={row.facesDifferent} onCheckedChange={v => updateRow(row.id, { facesDifferent: v })} />
                      <Label className="text-xs">وجهين مختلفين</Label>
                    </div>
                  )}
                </div>

                {/* تنبيه: شيت الطباعة أكبر من الماكينة */}
                {pressExceedsMachine && (
                  <Alert variant="destructive" className="py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      مقاس شيت الطباعة ({row.pressWidth}×{row.pressHeight}) أكبر من مقاس الماكينة ({machineW}×{machineH}).
                      يجب أن يكون شيت الطباعة مساوي أو أصغر من الماكينة.
                    </AlertDescription>
                  </Alert>
                )}

                {/* السلفان: عرض السعر المطبَّق ومفتاح التعديل اليدوي */}
                {row.cellophaneFaces > 0 && (
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/30 rounded-md px-3 py-2 flex-wrap">
                    <span>سعر السلفان للوجه:</span>
                    {row.cellophaneOverrideEnabled ? (
                      <>
                        <span className="font-bold text-primary">{(row.cellophaneOverridePerFace ?? 0).toFixed(4)} ر.س (يدوي)</span>
                        <Input type="number" min={0} step={0.0001} className="h-7 w-24 text-xs"
                          value={row.cellophaneOverridePerFace ?? 0}
                          onChange={(e) => updateRow(row.id, { cellophaneOverridePerFace: Math.max(0, Number(e.target.value)) })} />
                        <button onClick={() => updateRow(row.id, { cellophaneOverrideEnabled: false, cellophaneOverridePerFace: 0 })}
                          className="text-[10px] text-primary hover:underline mr-auto">العودة لسعر الماكينة</button>
                      </>
                    ) : (
                      <>
                        <span className="font-bold">
                          {(() => {
                            const m = sizes.find(s =>
                              (s.width === row.pressWidth && s.height === row.pressHeight) ||
                              (s.width === row.pressHeight && s.height === row.pressWidth)
                            );
                            const perFace = m?.cellophanePerFace ?? machineSize?.cellophanePerFace ?? 0;
                            return `${perFace.toFixed(4)} ر.س`;
                          })()}
                        </span>
                        <button onClick={() => updateRow(row.id, { cellophaneOverrideEnabled: true })}
                          className="text-[10px] text-primary hover:underline mr-auto">تعديل يدوي</button>
                      </>
                    )}
                  </div>
                )}

                {/* Auto-computed cuts (from smart engine) */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-md bg-primary/5 border border-primary/20 px-2 py-1.5 text-center">
                    <p className="text-[9px] text-muted-foreground">تفصيل الشيت الأساسي (تلقائي)</p>
                    <p className="font-bold text-primary">{row.baseCuts} شيت طباعة</p>
                  </div>
                  <div className="rounded-md bg-primary/5 border border-primary/20 px-2 py-1.5 text-center">
                    <p className="text-[9px] text-muted-foreground">تفصيل شيت الطباعة (تلقائي)</p>
                    <p className="font-bold text-primary">{row.cutsPerSheet} ورقة</p>
                  </div>
                </div>

                {/* Row result summary */}
                <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-muted/40 rounded-lg p-2">
                    <span className="text-muted-foreground">أوراق من الشيت</span>
                    <p className="font-bold text-foreground">{res.pagesProduced} ورقة</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-2">
                    <span className="text-muted-foreground">شيتات الطباعة</span>
                    <p className="font-bold text-foreground">{res.printSheets}</p>
                  </div>
                  {row.wastePercent > 0 && (
                    <div className="bg-muted/40 rounded-lg p-2">
                      <span className="text-muted-foreground">بعد الهدر</span>
                      <p className="font-bold text-foreground">{res.printSheetsAfterWaste}</p>
                    </div>
                  )}
                  <div className="bg-primary/10 rounded-lg p-2">
                    <span className="text-muted-foreground">إجمالي الصف</span>
                    <p className="font-bold text-primary">{fmt(res.rowTotal)}</p>
                  </div>
                </div>

                {/* Per-row Additional Data */}
                <Collapsible>
                  <Card className="shadow-sm border-border/40">
                    <CollapsibleTrigger asChild>
                      <CardContent className="p-3 cursor-pointer hover:bg-muted/20 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-semibold text-foreground">بيانات إضافية</span>
                          </div>
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 pb-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {/* Waste */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs">كمية الهدر</Label>
                              <button onClick={() => updateRow(row.id, { wasteMode: row.wasteMode === 'number' ? 'percent' : 'number' })} className="text-[10px] text-primary hover:underline">
                                {row.wasteMode === 'number' ? 'تبديل إلى %' : 'تبديل إلى رقم'}
                              </button>
                            </div>
                            <div className="relative">
                              <Input type="number" className="h-9 text-sm" value={row.wastePercent} onChange={e => updateRow(row.id, { wastePercent: Number(e.target.value) })} onFocus={e => e.target.select()} />
                              {row.wasteMode === 'percent' && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>}
                            </div>
                            {row.wastePercent > 0 && (
                              <div className="flex items-center gap-2 mt-1">
                                <Switch checked={row.wasteInCosts} onCheckedChange={v => updateRow(row.id, { wasteInCosts: v })} className="scale-75" />
                                <Label className="text-[10px] text-muted-foreground">{row.wasteInCosts ? 'جميع التكاليف' : 'ورق فقط'}</Label>
                              </div>
                            )}
                          </div>
                          {/* Cellophane */}
                          <div className="space-y-1.5">
                            <Label className="text-xs">السلفان</Label>
                            <Select value={String(row.cellophaneFaces)} onValueChange={v => updateRow(row.id, { cellophaneFaces: Number(v) })}>
                              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">بدون</SelectItem>
                                <SelectItem value="1">وجه واحد</SelectItem>
                                <SelectItem value="2">وجهان</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {/* Die cut */}
                          <div className="space-y-1.5">
                            <Label className="text-xs">تكسير / قالب خاص</Label>
                            <div className="flex items-center gap-2 h-9">
                              <Switch checked={row.hasDieCut} onCheckedChange={v => updateRow(row.id, { hasDieCut: v })} />
                              <span className="text-xs text-muted-foreground">{row.hasDieCut ? 'مفعّل' : 'معطّل'}</span>
                            </div>
                          </div>
                          {row.hasDieCut && (
                            <div className="space-y-1.5">
                              <Label className="text-xs">قيمة القالب (ريال)</Label>
                              <Input type="number" className="h-9 text-sm" value={row.moldPrice} onChange={e => updateRow(row.id, { moldPrice: Number(e.target.value) })} onFocus={e => e.target.select()} />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {/* Per-row Finishing */}
                <Collapsible>
                  <Card className="shadow-sm border-border/40">
                    <CollapsibleTrigger asChild>
                      <CardContent className="p-3 cursor-pointer hover:bg-muted/20 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-semibold text-foreground">التشطيبات</span>
                            {enabledFinishing.length > 0 && (
                              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{enabledFinishing.length} مفعّل</span>
                            )}
                          </div>
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 pb-3 space-y-2">
                        {row.finishing.map((item, fIdx) => (
                          <FinishingRow
                            key={fIdx}
                            item={item}
                            cost={calculateFinishingCost(item, copies, res.thousands)}
                            onToggle={() => {
                              const updated = row.finishing.map((f, i) => i === fIdx ? { ...f, enabled: !f.enabled } : f);
                              updateRow(row.id, { finishing: updated });
                            }}
                            onChange={(updates) => {
                              const updated = row.finishing.map((f, i) => i === fIdx ? { ...f, ...updates } : f);
                              updateRow(row.id, { finishing: updated });
                            }}
                            onRemove={() => {
                              updateRow(row.id, { finishing: row.finishing.filter((_, i) => i !== fIdx) });
                            }}
                          />
                        ))}
                        <Button variant="outline" size="sm" className="w-full border-dashed mt-2" onClick={() => {
                          updateRow(row.id, { finishing: [...row.finishing, { name: 'تشطيب جديد', enabled: true, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' }] });
                        }}>
                          <Plus className="w-3.5 h-3.5 ml-1" /> إضافة تشطيب
                        </Button>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {/* ── محرك القرار الذكي (تحت التشطيبات) ── */}
                {(() => {
                  const selectedType = paperTypes.find(t => t.name === row.paperType);
                  const selectedEntry = selectedType?.entries.find(
                    e => e.sizeName === row.purchaseSize && e.grammage === row.grammage
                  );
                  const masterW = selectedEntry?.width || 0;
                  const masterH = selectedEntry?.height || 0;
                  const productSize = row.sizeIdx >= 0 && row.sizeIdx < sizes.length ? sizes[row.sizeIdx] : null;
                  const productW = productSize?.width || 0;
                  const productH = productSize?.height || 0;
                  return (
                    <SheetLayoutPreview
                      sheetW={masterW}
                      sheetH={masterH}
                      pressW={row.pressWidth}
                      pressH={row.pressHeight}
                      productW={productW}
                      productH={productH}
                      quantity={copies}
                      selectedStage1Id={row.selectedStage1Id}
                      selectedStage2Id={row.selectedStage2Id}
                      onSelectStage1={(id, count) => updateRow(row.id, { selectedStage1Id: id, baseCuts: count })}
                      onSelectStage2={(id, count) => updateRow(row.id, { selectedStage2Id: id, cutsPerSheet: count })}
                      onPressSizeChange={(w, h) => updateRow(row.id, { pressWidth: w, pressHeight: h })}
                    />
                  );
                })()}
              </CardContent>
            </Card>
          );
        })}

        {/* Add row buttons */}
        <Popover open={addRowPopoverOpen} onOpenChange={setAddRowPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full gap-2 border-dashed">
              <Plus className="w-4 h-4" /> إضافة صف طباعة
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="center">
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs gap-2" onClick={() => addRow(false)}>
              <Plus className="w-3.5 h-3.5" /> إضافة صف طباعة جديد
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs gap-2" onClick={() => addRow(true)}>
              <Copy className="w-3.5 h-3.5" /> تكرار
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {/* Sidebar */}
      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        {/* Summary */}
        <Card className="border-primary/30 shadow-md bg-gradient-to-br from-card to-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm text-foreground">ملخص التكلفة</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">عدد النسخ</span>
                <span className="font-semibold">{copies.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">أوراق النسخة</span>
                <span className="font-semibold">{pagesPerCopy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">إجمالي الأوراق المنتجة</span>
                <span className="font-semibold">{totalPages}</span>
              </div>
              <div className="border-t border-border/50 pt-2" />
              {sheets.length > 1 && sheets.map((s, sIdx) => (
                <div key={s.id} className="flex justify-between">
                  <span className={`text-muted-foreground ${sIdx === activeSheetIdx ? 'font-bold text-primary' : ''}`}>ورقة {sIdx + 1}</span>
                  <span className="font-semibold">{fmt(allSheetsTotals[sIdx])}</span>
                </div>
              ))}
              {sheets.length > 1 && <div className="border-t border-border/50 pt-2" />}
              {results.map((r, i) => {
                if (r.rowTotal <= 0) return null;
                const size = sizes[rows[i]?.sizeIdx];
                return (
                  <div key={i} className="flex justify-between">
                    <span className="text-muted-foreground">{size?.sizeName || `صف ${i + 1}`} ({rows[i].colorCount} ألوان)</span>
                    <span className="font-semibold">{fmt(r.rowTotal)}</span>
                  </div>
                );
              })}
              <div className="border-t border-border/50 pt-2" />
              <div className="flex justify-between text-base font-bold">
                <span>الإجمالي</span>
                <span className="text-primary">{fmt(grandTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">سعر النسخة</span>
                <span className="font-semibold">{fmt(pricePerCopy)}</span>
              </div>
            </div>

            <ProfitMargins grandTotal={grandTotal} quantity={copies} pieceLabel="نسخة" />

            <Button className="w-full gap-2 mt-2" onClick={() => setSaveDialogOpen(true)} disabled={grandTotal <= 0}>
              <Save className="w-4 h-4" /> حفظ التكلفة
            </Button>
          </CardContent>
        </Card>

        {/* Details - matching CostCalculator style */}
        {results.map((r, i) => {
          if (r.rowTotal <= 0) return null;
          const size = sizes[rows[i]?.sizeIdx];
          const row = rows[i];
          const details: { label: string; value: string; highlight?: boolean; isSubItem?: boolean }[] = [];

          if (size) details.push({ label: 'مقاس الطباعة', value: size.sizeName, highlight: true });
          if (row.colorCount > 0) details.push({ label: 'عدد الألوان', value: `${row.colorCount}` });
          if (r.thousands > 0) details.push({ label: 'عدد الآلاف', value: `${r.thousands}` });
          details.push({ label: 'تفصيل الشيت الأساسي', value: `${row.baseCuts} شيت طباعة` });
          details.push({ label: 'تفصيل شيت الطباعة', value: `${row.cutsPerSheet} ورقة` });
          if (r.printSheets > 0) details.push({ label: 'شيتات الطباعة', value: r.printSheets.toString() });
          if (row.wastePercent > 0) details.push({ label: 'أوراق بعد الهدر', value: r.printSheetsAfterWaste.toString() });
          details.push({ label: 'الأوراق المنتجة', value: `${r.pagesProduced} ورقة` });
          if (row.paperType) details.push({ label: 'نوع الورق', value: `${row.paperType} ${row.grammage} جرام` });
          if (r.paperCost > 0) details.push({ label: 'الورق', value: `${r.paperCost.toFixed(2)} ر.س` });
          if (r.sortCost > 0) details.push({ label: 'الفرز', value: `${r.sortCost.toFixed(2)} ر.س` });
          if (r.printCost > 0) details.push({ label: 'الطباعة', value: `${r.printCost.toFixed(2)} ر.س` });
          if (r.cellophaneCost > 0) details.push({ label: 'السلفان', value: `${r.cellophaneCost.toFixed(2)} ر.س` });
          if (r.dieCutCost > 0) details.push({ label: 'التكسير', value: `${r.dieCutCost.toFixed(2)} ر.س` });
          if (row.hasDieCut && row.moldPrice > 0) details.push({ label: 'قيمة القالب', value: `${row.moldPrice.toFixed(2)} ر.س` });
          if (r.finishingCost > 0) details.push({ label: 'مجموع التشطيبات', value: `${r.finishingCost.toFixed(2)} ر.س` });
          // Individual finishing sub-items
          row.finishing.forEach(f => {
            if (!f.enabled) return;
            const m = f.multiplier || 1;
            let fCost = 0;
            switch (f.calcType) {
              case 'per_piece': fCost = copies * m * f.pricePerUnit; break;
              case 'per_1000': fCost = r.thousands * m * f.pricePerUnit; break;
              case 'tiered_1000': fCost = m * (f.pricePerUnit + Math.max(r.thousands - 1, 0) * f.extraPer1000); break;
              case 'flat': fCost = m * f.pricePerUnit; break;
            }
            if (fCost > 0) details.push({ label: `  ${f.name}`, value: `${fCost.toFixed(2)} ر.س`, isSubItem: true });
          });

          if (details.length === 0) return null;
          return (
            <Card key={i} className="shadow-sm border-border/60">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary"><Sparkles className="w-4 h-4" /></div>
                  <h3 className="font-semibold text-foreground text-sm">{rows.length > 1 ? `تفاصيل صف ${i + 1}` : 'تفاصيل الحساب'}</h3>
                </div>
                <div className="space-y-1 text-xs">
                  {details.map((d, di) => (
                    <div key={di} className={`flex items-center justify-between py-1 px-2 rounded ${d.isSubItem ? 'opacity-50 pr-4' : ''}`}>
                      <span className="text-muted-foreground">{d.label}</span>
                      <span className={`font-mono ${d.highlight ? 'text-primary font-semibold' : d.isSubItem ? 'font-normal' : 'font-medium'}`}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>حفظ التكلفة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">اسم الصنف</Label>
              <Input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="مثال: كتيب تعريفي" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">رقم الصنف</Label>
              <Input value={itemNumber} onChange={e => setItemNumber(e.target.value)} placeholder="مثال: 001" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">مقاس الصنف</Label>
              <Input value={itemSize} onChange={e => setItemSize(e.target.value)} placeholder="مثال: A4" className="h-9 text-sm" />
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:flex-row-reverse mt-4">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" /> {editingQuoteId ? 'تحديث' : 'حفظ'}
            </Button>
            <Button variant="outline" onClick={() => { setItemName(''); setItemNumber(''); setItemSize(''); handleSave(); }} disabled={saving}>
              حفظ بدون بيانات الصنف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: شيت الطباعة بمقاس غير موجود في إعدادات الألوان */}
      <AlertDialog open={cellophaneAlertOpen} onOpenChange={setCellophaneAlertOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>مقاس السلفان غير مطابق للإعدادات</AlertDialogTitle>
            <AlertDialogDescription>
              مقاس شيت الطباعة الجديد ({pendingPress?.w ?? 0}×{pendingPress?.h ?? 0}) غير موجود في إعدادات الألوان.
              اختر كيف تريد التعامل مع سعر السلفان:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction
              onClick={() => {
                if (pendingPress) {
                  const r = rows.find(x => x.id === pendingPress.rowId);
                  const m = r && r.sizeIdx >= 0 ? sizes[r.sizeIdx] : undefined;
                  updateRow(pendingPress.rowId, {
                    pressWidth: pendingPress.w, pressHeight: pendingPress.h,
                    cellophaneOverrideEnabled: true,
                    cellophaneOverridePerFace: m?.cellophanePerFace ?? 0,
                    selectedStage1Id: undefined, selectedStage2Id: undefined,
                  });
                }
                setPendingPress(null);
              }}
            >
              تعديل سعر السلفان يدوياً
            </AlertDialogAction>
            <AlertDialogCancel
              onClick={() => {
                if (pendingPress) {
                  updateRow(pendingPress.rowId, {
                    pressWidth: pendingPress.w, pressHeight: pendingPress.h,
                    selectedStage1Id: undefined, selectedStage2Id: undefined,
                  });
                }
                setPendingPress(null);
              }}
            >
              الاستمرار بسعر الماكينة
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PaperSetCalculator;
