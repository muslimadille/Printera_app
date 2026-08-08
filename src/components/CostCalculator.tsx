import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { usePrintingStore, useCalculations, type FinishingItem, type CalculatorInputs } from '@/store/printingStore';
import { calculateQuote } from '@/lib/calcEngine';
import { finite, formatMoney, isFiniteMoney } from '@/lib/safeNumber';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Calculator, FileText, Sparkles, ChevronDown, ChevronUp, Plus, Trash2, Copy, Save, Upload, Download } from 'lucide-react';
import SheetLayoutPreview from '@/components/SheetLayoutPreview';
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

/* ── Sheet data interface ── */
interface SheetData {
  id: string;
  pieces: PieceData[];
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
});

/* ═══════════════════════════════════════════════════════ */
const CostCalculator = ({ onNavigateToQuote, sessionToken }: { onNavigateToQuote?: () => void; sessionToken?: string }) => {
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
    if (editingQuoteData?.sourceType === 'costcalc' && editingQuoteData.rawInputs) {
      const raw = editingQuoteData.rawInputs;
      if (raw.sheets && Array.isArray(raw.sheets)) {
        setSheets(raw.sheets);
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

  const addSheet = (duplicate = false) => {
    const newSheet = duplicate
      ? { id: crypto.randomUUID(), pieces: sheets[activeSheetIdx].pieces.map(p => ({ ...p, id: crypto.randomUUID(), finishing: p.finishing.map(f => ({ ...f })) })) }
      : createEmptySheet();
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

  const sheetGrandTotal = finite(pieceCosts.reduce((sum, c) => sum + finite(c.grandTotal), 0));
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

  const allSheetsGrandTotal = finite(allSheetsTotals.reduce((sum, s) => sum + finite(s.total), 0));

  // Save handler
  const handleSave = async (skipMetadata = false) => {
    if (!sessionToken) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }
    setSaving(true);
    try {
      const quoteData: Record<string, any> = {
        sourceType: 'costcalc',
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
          source_type: 'costcalc',
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 pb-20 lg:pb-0 min-w-0 w-full calc-shell">
      {/* ═══ Main Inputs ═══ */}
      <div className="lg:col-span-2 space-y-3 sm:space-y-4">

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

          {/* Import / Template buttons */}
          <div className="flex items-center gap-1 mr-auto">
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

      {/* ═══ Sidebar ═══ */}
      <div className="hidden lg:block space-y-4 lg:sticky lg:top-4 lg:self-start">
         <Card className="shadow-sm border-primary/30 bg-gradient-to-b from-primary/5 to-transparent">
          <CardContent className="pt-5 pb-4">
            <SectionHeader icon={Calculator} title="ملخص التكلفة" />
            <div className="space-y-2 mb-4">
              {/* All sheets grand total */}
              {sheets.length > 1 && (
                <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">إجمالي كل الأوراق</p>
                  <p className="text-2xl font-bold text-accent-foreground">{formatMoney(allSheetsGrandTotal)}</p>
                  <p className="text-[10px] text-muted-foreground">ريال</p>
                </div>
              )}
              {/* Per-sheet breakdown when multiple sheets */}
              {sheets.length > 1 && (
                <div className="space-y-1">
                  {sheets.map((s, si) => (
                    <div key={s.id} className={`flex justify-between text-xs px-2 py-1.5 rounded ${si === activeSheetIdx ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'}`}>
                      <span className={si === activeSheetIdx ? 'text-primary font-semibold' : 'text-muted-foreground'}>ورقة {si + 1}</span>
                      <span className="font-mono font-medium">{formatMoney(allSheetsTotals[si]?.total)} ر.س</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Current sheet total */}
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">{sheets.length > 1 ? `إجمالي الورقة ${activeSheetIdx + 1}` : 'الإجمالي الشامل'}</p>
                <p className="text-2xl font-bold text-primary">{formatMoney(sheetGrandTotal)}</p>
                <p className="text-[10px] text-muted-foreground">ريال</p>
              </div>
              {sheet?.pieces.length > 1 && (
                <div className="space-y-1">
                  {sheet.pieces.map((p, pi) => (
                    <div key={p.id} className="flex justify-between text-xs px-2 py-1 rounded bg-muted/50">
                      <span className="text-muted-foreground">قطعة {pi + 1}</span>
                      <span className="font-mono font-medium">{formatMoney(pieceCosts[pi]?.grandTotal)} ر.س</span>
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

      {/* ═══ Calculation Details (full width, below sidebar/main on all screens) ═══ */}
      <div className="lg:col-span-3 space-y-4 pb-24 lg:pb-0">
        {/* تفاصيل for each piece */}
        {sheet?.pieces.map((piece, pieceIdx) => {
          const cost = pieceCosts[pieceIdx];
          if (!cost?.valid) return null;

          const details: { label: string; value: string; highlight?: boolean }[] = [];
          
          // Always show print size
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
          // Custom fields breakdown
          if (cost.customFieldsBreakdown?.length > 0) {
            cost.customFieldsBreakdown.forEach(cf => {
              details.push({ label: cf.name, value: `${cf.value.toFixed(2)} ر.س` });
            });
          }
          if (cost.totalFinishing > 0) details.push({ label: 'مجموع التشطيبات', value: `${cost.totalFinishing.toFixed(2)} ر.س` });

          // Individual finishing items (sub-items, lighter style)
          piece.finishing.forEach((f, fi) => {
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

        {/* Sheet Layout Preview moved into main column under each piece's Finishing section */}
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

  // Resolve purchase (master) sheet dimensions for validation
  const _selType = paperTypes.find(t => t.name === piece.paperType);
  const _selEntry = _selType?.entries.find(
    (e: any) => e.sizeName === piece.purchaseSize && e.grammage === piece.grammage,
  );
  const paperW = _selEntry?.width || 0;
  const paperH = _selEntry?.height || 0;

  // Validation flags
  const productExceedsMachine = machineSize && piece.printWidth > 0 && piece.printHeight > 0 && (
    Math.max(piece.printWidth, piece.printHeight) > Math.max(machineW, machineH) ||
    Math.min(piece.printWidth, piece.printHeight) > Math.min(machineW, machineH)
  );
  const pressExceedsMachine = machineSize && piece.pressWidth > 0 && piece.pressHeight > 0 && (
    Math.max(piece.pressWidth, piece.pressHeight) > Math.max(machineW, machineH) ||
    Math.min(piece.pressWidth, piece.pressHeight) > Math.min(machineW, machineH)
  );
  const pressExceedsPaper = paperW > 0 && paperH > 0 && piece.pressWidth > 0 && piece.pressHeight > 0 && (
    Math.max(piece.pressWidth, piece.pressHeight) > Math.max(paperW, paperH) + 0.05 ||
    Math.min(piece.pressWidth, piece.pressHeight) > Math.min(paperW, paperH) + 0.05
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
          {/* الصف الأول: مقاس المنتج + كمية المنتج + الألوان */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
            {/* مقاس المنتج (عرض × ارتفاع) */}
            <div className="space-y-1.5 sm:col-span-6">
              <Label className="text-xs">مقاس المنتج (عرض × ارتفاع - سم)</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number" min={0} step={0.1}
                  className={`h-9 text-sm ${productExceedsMachine ? 'border-destructive ring-1 ring-destructive/40' : ''}`}
                  value={piece.printWidth || ''}
                  onChange={(e) => update({ printWidth: Math.max(0, Number(e.target.value)) })}
                  placeholder="عرض المنتج"
                />
                <Input
                  type="number" min={0} step={0.1}
                  className={`h-9 text-sm ${productExceedsMachine ? 'border-destructive ring-1 ring-destructive/40' : ''}`}
                  value={piece.printHeight || ''}
                  onChange={(e) => update({ printHeight: Math.max(0, Number(e.target.value)) })}
                  placeholder="ارتفاع المنتج"
                />
              </div>
            </div>

            {/* كمية المنتج */}
            <div className="space-y-1.5 sm:col-span-3">
              <Label className="text-xs">كمية المنتج</Label>
              <Input
                type="number" className="h-9 text-sm"
                value={piece.quantity}
                onChange={(e) => update({ quantity: Number(e.target.value) })}
                placeholder="الكمية"
              />
            </div>

            {/* الألوان */}
            <div className="space-y-1.5 sm:col-span-3">
              <Label className="text-xs">الألوان (تحدد مقاس الماكينة)</Label>
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

          {/* الصف الثاني: نوع الورق + مقاس شيت الطباعة */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 mt-3 sm:mt-4">
            {/* نوع الورق */}
            <div className="space-y-1.5 sm:col-span-6">
              <Label className="text-xs">نوع الورق (يحدد مقاس الشيت الأساسي)</Label>
              <PaperCombobox paperTypes={paperTypes} value={paperKey} onChange={handlePaperChange} />
            </div>

            {/* مقاس شيت الطباعة (عرض × ارتفاع) */}
            <div className="space-y-1.5 sm:col-span-6">
              <Label className="text-xs">
                مقاس شيت الطباعة (عرض × ارتفاع - سم)
                {machineSize && (
                  <span className="text-[10px] font-normal text-muted-foreground mr-1">
                    — مقاس الماكينة: {machineW}×{machineH}
                  </span>
                )}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number" min={0} step={0.1}
                  className={`h-9 text-sm ${(pressExceedsMachine || pressExceedsPaper) ? 'border-destructive ring-1 ring-destructive/40' : ''}`}
                  value={piece.pressWidth || ''}
                  onChange={(e) => handlePressChange(Math.max(0, Number(e.target.value)), piece.pressHeight)}
                  placeholder="عرض شيت الطباعة"
                />
                <Input
                  type="number" min={0} step={0.1}
                  className={`h-9 text-sm ${(pressExceedsMachine || pressExceedsPaper) ? 'border-destructive ring-1 ring-destructive/40' : ''}`}
                  value={piece.pressHeight || ''}
                  onChange={(e) => handlePressChange(piece.pressWidth, Math.max(0, Number(e.target.value)))}
                  placeholder="ارتفاع شيت الطباعة"
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                يتم اقتراح مقاس شيت الطباعة تلقائيًا حسب الورق والماكينة، ويمكنك تعديله يدويًا إذا لزم.
              </p>
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
          {pressExceedsPaper && (
            <Alert variant="destructive" className="mt-3 py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                مقاس شيت الطباعة ({piece.pressWidth}×{piece.pressHeight}) أكبر من مقاس شيت الشراء ({paperW}×{paperH}).
                لا يمكن الطباعة على مساحة أكبر من الورق المتاح.
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

      {/* ── محرك القرار الذكي (تحت التشطيبات) ── */}
      {(() => {
        const selectedType = paperTypes.find(t => t.name === piece.paperType);
        const selectedEntry = selectedType?.entries.find(
          (e: any) => e.sizeName === piece.purchaseSize && e.grammage === piece.grammage
        );
        const masterW = selectedEntry?.width || 0;
        const masterH = selectedEntry?.height || 0;
        return (
          <SheetLayoutPreview
            sheetW={masterW}
            sheetH={masterH}
            pressW={piece.pressWidth}
            pressH={piece.pressHeight}
            productW={piece.printWidth}
            productH={piece.printHeight}
            quantity={piece.quantity}
            selectedStage1Id={piece.selectedStage1Id}
            selectedStage2Id={piece.selectedStage2Id}
            onSelectStage1={(id, count) => update({ selectedStage1Id: id, baseCuts: count })}
            onSelectStage2={(id, count) => update({ selectedStage2Id: id, cutsPerSheet: count })}
            onProductSizeChange={(w, h) => update({ printWidth: w, printHeight: h })}
            onPressSizeChange={(w, h) => update({ pressWidth: w, pressHeight: h })}
          />
        );
      })()}
    </>
  );
};

/* ── Finishing Row ── */
const FinishingRow = ({
  item, cost, onToggle, onChange, onRemove,
}: {
  item: FinishingItem; cost: number;
  onToggle: () => void; onChange: (u: Partial<FinishingItem>) => void; onRemove: () => void;
}) => (
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
    <div className="flex items-center gap-2 flex-wrap">
      <Input
        className="h-9 sm:h-8 text-xs w-full sm:w-28 bg-background"
        value={item.name}
        onChange={(e) => onChange({ name: e.target.value })}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto flex-1">
        <Select value={item.calcType} onValueChange={(val) => onChange({ calcType: val as FinishingItem['calcType'] })}>
          <SelectTrigger className="h-9 sm:h-8 text-xs w-full sm:w-28 bg-background" onClick={(e) => e.stopPropagation()}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(calcTypeLabels).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <Input type="number" className="h-9 sm:h-8 text-xs flex-1 min-w-0 bg-background" value={item.multiplier} onChange={(e) => onChange({ multiplier: Number(e.target.value) })} onClick={(e) => e.stopPropagation()} placeholder="متغيرات" />
          <Input type="number" className="h-9 sm:h-8 text-xs flex-1 min-w-0 bg-background" value={item.pricePerUnit} onChange={(e) => onChange({ pricePerUnit: Number(e.target.value) })} onClick={(e) => e.stopPropagation()} placeholder="سعر الوحدة" />
          {item.calcType === 'tiered_1000' && (
            <Input type="number" className="h-9 sm:h-8 text-xs flex-1 min-w-0 bg-background" value={item.extraPer1000} onChange={(e) => onChange({ extraPer1000: Number(e.target.value) })} onClick={(e) => e.stopPropagation()} placeholder="ألف إضافي" />
          )}
        </div>
        {item.enabled && (
          <span className="text-xs font-bold text-primary whitespace-nowrap">{cost.toFixed(2)} ر.س</span>
        )}
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-7 sm:w-7 text-destructive/60 hover:text-destructive shrink-0 mr-auto sm:mr-0" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  </div>
);

const DetailRow = ({ label, value, highlight, isSubItem }: { label: string; value: string; highlight?: boolean; isSubItem?: boolean }) => (
  <div className={`flex items-center justify-between py-1 px-2 rounded ${isSubItem ? 'opacity-50 pr-4' : ''}`}>
    <span className="text-muted-foreground">{label}</span>
    <span className={`font-mono ${highlight ? 'text-primary font-semibold' : isSubItem ? 'font-normal' : 'font-medium'}`}>{value}</span>
  </div>
);

export default CostCalculator;
