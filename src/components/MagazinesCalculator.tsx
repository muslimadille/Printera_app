/**
 * MagazinesCalculator — Smart magazine engine.
 *
 * Core rule: Sheet (paper sheet) = Page × 2  → one fold = 2 pages/face = 4 pages duplex.
 *
 * User inputs (minimal):
 *   1. مقاس الصفحة (Page size W×H cm)
 *   2. عدد الصفحات (rounded up to multiple of 4)
 *   3. الكمية (copies)
 *   4. نوع الورق + الجرامية (auto-suggested, user can change)
 *   5. الألوان (default 4)
 *
 * Engine logic:
 *   • derive sheetW × sheetH from page (sheet = page × 2 on short fold edge)
 *   • for every machine SizePricing whose dims ≥ sheetW×sheetH (or rotated),
 *     and for every plausible baseCuts (1,2,4) of the master purchase sheet,
 *     build a scenario:
 *        – baseCuts = press sheets per master purchase sheet
 *        – pressW × pressH = master / baseCuts (halve longer side per step)
 *        – pagesPerPressSheet = how many MAGAZINE PAGES fit on press sheet
 *          (we lay out pages directly — page × 2 = sheet, so a press sheet of
 *           sheet size carries 4 pages duplex, of 2× sheet size carries 8, etc.)
 *        – uses machine SizePricing for sort/print pricing
 *   • sort scenarios by total cost; user picks; selected drives summary.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  usePrintingStore,
  type SizePricing, type ColorPricing, type PaperType, type PaperEntry, type FinishingItem,
} from '@/store/printingStore';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BookOpen, Calculator, Save, Sparkles, ChevronDown, Info, Layers } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import ProfitMargins from '@/components/ProfitMargins';
import { saveQuote, updateQuote } from '@/lib/userApi';
import { buildScenarioLabel } from '@/lib/magazineLabel';
import { toast } from 'sonner';
import { usePreviewSettings } from '@/hooks/usePreviewSettings';

/* ── Helpers (parity with NewMagazineCalculator) ── */
function migrateSizePricing(s: any): SizePricing {
  if (s.color1) return s;
  const d: ColorPricing = { sortPerFace: 0, printFirst1000PerFace: 0, printExtra1000PerFace: 0 };
  return {
    ...s,
    color1: { sortPerFace: s.sortSingleFace || 0, printFirst1000PerFace: s.printFirst1000PerFace || 0, printExtra1000PerFace: s.printExtra1000PerFace || 0 },
    color2: { ...d }, color3: { ...d }, color4: { ...d },
  };
}
function getColorPricing(size: SizePricing, colorCount: number): ColorPricing | null {
  const m = migrateSizePricing(size);
  if (colorCount === 0) return null;
  if (colorCount === 1) return m.color1;
  if (colorCount === 2) return m.color2;
  if (colorCount === 3) return m.color3;
  return m.color4;
}
const roundUpTo4 = (n: number) => Math.ceil(Math.max(1, n) / 4) * 4;

function calcFinishing(item: FinishingItem, copies: number, thousands: number): number {
  if (!item.enabled || !item.pricePerUnit) return 0;
  const m = item.multiplier || 1;
  switch (item.calcType) {
    case 'per_piece': return copies * m * item.pricePerUnit;
    case 'per_1000': return thousands * m * item.pricePerUnit;
    case 'tiered_1000': return m * (item.pricePerUnit + Math.max(thousands - 1, 0) * item.extraPer1000);
    case 'flat': return m * item.pricePerUnit;
    default: return 0;
  }
}

/* ── Engine ── */
interface EngineInput {
  machineSize: SizePricing;   // drives sort/print pricing
  colorCount: number;
  baseCuts: number;           // master purchase sheets → press sheets
  pagesPerPressSheet: number; // magazine pages laid out on a single press sheet face
  printedFaces: 1 | 2;
  facesDifferent: boolean;
  paperEntry: PaperEntry;
  copies: number;             // number of magazine COPIES (not pages)
  actualPages: number;        // pages per magazine (multiple of 4)
  wastePercent: number;
  cellophaneFaces: 0 | 1 | 2;
  hasDieCut: boolean;
  moldPrice: number;
  finishing: FinishingItem[];
}
interface EngineResult {
  pagesProduced: number;       // unique pages produced per press sheet (front+back if duplex-diff)
  signaturesPerCopy: number;   // distinct print sheets needed per single magazine copy
  sheetsPerSignature: number;  // press sheets per signature (before waste) for copies
  printSheets: number;         // total press sheets BEFORE waste = signatures × sheetsPerSig
  printSheetsAfterWaste: number;
  purchaseSheetsNeeded: number;
  thousands: number;
  sortCost: number;
  printCost: number;
  paperCost: number;
  cellophaneCost: number;
  dieCutCost: number;
  finishingCost: number;
  rowTotal: number;
  repeatsPerSheet?: number;
  copiesPerSheet?: number;
  uniquePagesPerSheet?: number;
}

function runEngine(input: EngineInput): EngineResult {
  const empty: EngineResult = {
    pagesProduced: 0, signaturesPerCopy: 0, sheetsPerSignature: 0,
    printSheets: 0, printSheetsAfterWaste: 0, purchaseSheetsNeeded: 0, thousands: 0,
    sortCost: 0, printCost: 0, paperCost: 0, cellophaneCost: 0, dieCutCost: 0, finishingCost: 0, rowTotal: 0,
  };
  if (input.copies <= 0 || input.pagesPerPressSheet <= 0 || input.actualPages <= 0) return empty;

  const { machineSize, colorCount, baseCuts, pagesPerPressSheet, printedFaces, facesDifferent,
    paperEntry, copies, actualPages, wastePercent, cellophaneFaces, hasDieCut, moldPrice, finishing } = input;

  // ── Per-signature production model ──
  // Treat each signature (one printed/folded press sheet) as an independent print job.
  //   • Different-duplex: front & back of press sheet are 2 different signature faces →
  //     uniquePagesPerSheet = pagesPerPressSheet × 2, copiesPerSheet = 1
  //   • Identical-duplex (work-and-turn): same plate on both faces → uniquePagesPerSheet =
  //     pagesPerPressSheet, copiesPerSheet = 2 (one sheet yields 2 magazine copies of that signature)
  //   • Single-sided: uniquePagesPerSheet = pagesPerPressSheet, copiesPerSheet = 1
  const uniquePagesPerSheet = (printedFaces === 2 && facesDifferent)
    ? pagesPerPressSheet * 2
    : pagesPerPressSheet;
  const platesPerSignature = (printedFaces === 2 && facesDifferent) ? 2 : 1;

  // ── Signatures per copy (how many distinct printed sheets make one magazine) ──
  const signaturesPerCopy = Math.ceil(actualPages / Math.max(1, uniquePagesPerSheet));

  // ── Yield per press sheet (how many copies of THIS signature one printed sheet produces) ──
  // General rule: if the press sheet can hold MORE unique pages than this signature needs,
  // the surplus slots are filled with REPEATS of the same signature → multiple copies/sheet.
  // Examples:
  //   • 16-page magazine, sheet fits 16 pages diff-duplex → 1 copy/sheet
  //   • 8-page magazine, sheet fits 16 pages diff-duplex → 2 copies/sheet
  //   • Identical-duplex (work-and-turn): both faces print the same plate → ×2 copies/sheet
  const pagesNeededThisSignature = Math.min(uniquePagesPerSheet, actualPages);
  const repeatsPerSheet = Math.max(1, Math.floor(uniquePagesPerSheet / Math.max(1, pagesNeededThisSignature)));
  const duplexMultiplier = (printedFaces === 2 && !facesDifferent) ? 2 : 1;
  const copiesPerSheet = repeatsPerSheet * duplexMultiplier;

  const sheetsPerSignature = Math.ceil(copies / copiesPerSheet);
  const printSheets = signaturesPerCopy * sheetsPerSignature;
  const pagesProduced = uniquePagesPerSheet;

  const sheetsPerSignatureAfterWaste = Math.ceil(sheetsPerSignature * (1 + (wastePercent || 0) / 100));
  const printSheetsAfterWaste = signaturesPerCopy * sheetsPerSignatureAfterWaste;
  const purchaseSheetsNeeded = Math.ceil(printSheetsAfterWaste / Math.max(1, baseCuts));
  // thousands per signature run (for tiered print pricing)
  const thousandsPerSignature = Math.max(1, Math.ceil(sheetsPerSignatureAfterWaste / 1000));
  const thousands = Math.max(1, Math.ceil(printSheetsAfterWaste / 1000));

  const cp = colorCount > 0 ? getColorPricing(machineSize, Math.min(colorCount, 4)) : null;
  // Each signature is a separate print job: its own plates and its own first-1000 charge.
  let sortCost = 0;
  if (cp) sortCost = signaturesPerCopy * platesPerSignature * cp.sortPerFace;

  let printCost = 0;
  if (cp) {
    // Print is charged per face independently (first-1000 + extras), regardless of identical/different.
    // Identical sides save on plates/sort (platesPerSignature=1) but the press still runs each face.
    const perFace = cp.printFirst1000PerFace + Math.max(0, thousandsPerSignature - 1) * cp.printExtra1000PerFace;
    printCost = signaturesPerCopy * printedFaces * perFace;
  }

  const isHidden = (f: string) => machineSize.hiddenFields?.includes(f) ?? false;

  let cellophaneCost = 0;
  if (!isHidden('cellophane') && cellophaneFaces > 0) {
    cellophaneCost = printSheetsAfterWaste * cellophaneFaces * machineSize.cellophanePerFace;
  }

  let dieCutCost = 0;
  if (hasDieCut && !isHidden('diecut')) {
    dieCutCost = machineSize.diecut1st1000 + Math.max(0, thousands - 1) * machineSize.diecutExtra1000;
  }

  // Paper cost
  const purchaseArea = (paperEntry.width / 100) * (paperEntry.height / 100);
  const purchaseWeight = purchaseArea * (paperEntry.grammage || 0);
  const pricePerGram = (paperEntry.pricePerTon || 0) / 1_000_000;
  const pricingUnit = paperEntry.pricingUnit || 'ton';
  const pricePerSheet = pricingUnit === 'ream' && (paperEntry.sheetsPerReam || 500) > 0
    ? (paperEntry.pricePerReam || 0) / (paperEntry.sheetsPerReam || 500)
    : purchaseWeight * pricePerGram;
  const paperCost = pricePerSheet * purchaseSheetsNeeded;

  let finishingCost = 0;
  finishing.forEach(f => { finishingCost += calcFinishing(f, copies, thousands); });

  const moldTotal = hasDieCut ? moldPrice : 0;
  const rowTotal = sortCost + printCost + cellophaneCost + dieCutCost + paperCost + finishingCost + moldTotal;
  return { pagesProduced, signaturesPerCopy, sheetsPerSignature,
    printSheets, printSheetsAfterWaste, purchaseSheetsNeeded, thousands,
    sortCost, printCost, paperCost, cellophaneCost, dieCutCost, finishingCost, rowTotal,
    repeatsPerSheet, copiesPerSheet, uniquePagesPerSheet } as EngineResult;
}

/* ── Geometry helpers ── */
// How many rectangles of (w×h) fit inside (W×H), trying both orientations (NO mixed rotation).
function fitOnSheet(sheetW: number, sheetH: number, pieceW: number, pieceH: number): number {
  if (sheetW <= 0 || sheetH <= 0 || pieceW <= 0 || pieceH <= 0) return 0;
  const a = Math.floor(sheetW / pieceW) * Math.floor(sheetH / pieceH);
  const b = Math.floor(sheetW / pieceH) * Math.floor(sheetH / pieceW);
  return Math.max(a, b);
}

// Auto-pick the first usable paper entry: must fit at least 1 magazine sheet (page × 2).
function pickDefaultPaperKey(
  paperTypes: PaperType[],
  pageW: number, pageH: number,
): string {
  for (const pt of paperTypes) {
    for (const e of pt.entries) {
      // We want at least 4 pages (one full signature) on the press sheet (= the master itself for baseCuts=1)
      const pagesOnMaster = fitOnSheet(e.width, e.height, pageW, pageH);
      if (pagesOnMaster >= 4) return `${pt.name}|${e.grammage}|${e.sizeName}`;
    }
  }
  // Fallback: first entry overall
  const first = paperTypes[0]?.entries[0];
  return first ? `${paperTypes[0].name}|${first.grammage}|${first.sizeName}` : '';
}

function findPaperEntry(paperTypes: PaperType[], key: string): { type: string; entry: PaperEntry } | null {
  if (!key) return null;
  const [name, gStr, sizeName] = key.split('|');
  const g = Number(gStr);
  const pt = paperTypes.find(p => p.name === name);
  if (!pt) return null;
  const entry = pt.entries.find(e => e.grammage === g && e.sizeName === sizeName);
  return entry ? { type: pt.name, entry } : null;
}

interface Scenario {
  id: string;
  machineSizeIdx: number;
  machineSize: SizePricing;
  baseCuts: number;
  pressW: number;
  pressH: number;
  pagesPerPressSheet: number;
  label: string;
  description: string;
  result: EngineResult;
}

/* ── Component ── */
const MagazinesCalculator = ({
  onNavigateToQuote, sessionToken,
}: { onNavigateToQuote?: () => void; sessionToken?: string }) => {
  const { priceSettings, paperTypes, editingQuoteData, setEditingQuoteData } = usePrintingStore();
  const sizes = priceSettings.sizes;

  // ── Inputs ──
  const [pageWidth, setPageWidth] = useState(20);
  const [pageHeight, setPageHeight] = useState(28);
  const [pageCount, setPageCount] = useState(16);
  const [copies, setCopies] = useState(1000);
  const [paperKey, setPaperKey] = useState<string>('');
  const [colorCount, setColorCount] = useState(4);

  // Advanced
  const [printedFaces, setPrintedFaces] = useState<1 | 2>(2);
  const [facesDifferent, setFacesDifferent] = useState(false);
  const [wastePercent, setWastePercent] = useState(0);
  const [cellophaneFaces, setCellophaneFaces] = useState<0 | 1 | 2>(0);

  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);

  // Save dialog
  const [saveOpen, setSaveOpen] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemNumber, setItemNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);

  // Initialise default paper once paperTypes is ready
  useEffect(() => {
    if (!paperKey && paperTypes.length > 0) {
      setPaperKey(pickDefaultPaperKey(paperTypes, pageWidth, pageHeight));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperTypes]);

  // Re-suggest paper if user changes page size and current paper can no longer hold a signature
  useEffect(() => {
    if (paperTypes.length === 0) return;
    const cur = findPaperEntry(paperTypes, paperKey);
    if (!cur) {
      setPaperKey(pickDefaultPaperKey(paperTypes, pageWidth, pageHeight));
      return;
    }
    const fit = fitOnSheet(cur.entry.width, cur.entry.height, pageWidth, pageHeight);
    if (fit < 4) {
      setPaperKey(pickDefaultPaperKey(paperTypes, pageWidth, pageHeight));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageWidth, pageHeight, paperTypes]);

  // Load editing quote
  useEffect(() => {
    if (editingQuoteData?.sourceType === 'magazines' && editingQuoteData.rawInputs) {
      const r = editingQuoteData.rawInputs as any;
      if (r.pageWidth) setPageWidth(r.pageWidth);
      if (r.pageHeight) setPageHeight(r.pageHeight);
      if (r.pageCount) setPageCount(r.pageCount);
      if (r.copies) setCopies(r.copies);
      if (r.colorCount) setColorCount(r.colorCount);
      if (r.printedFaces) setPrintedFaces(r.printedFaces);
      if (typeof r.facesDifferent === 'boolean') setFacesDifferent(r.facesDifferent);
      if (typeof r.wastePercent === 'number') setWastePercent(r.wastePercent);
      if (typeof r.cellophaneFaces === 'number') setCellophaneFaces(r.cellophaneFaces);
      if (r.paperKey) setPaperKey(r.paperKey);
      setItemName(editingQuoteData.itemName || '');
      setItemNumber(editingQuoteData.itemNumber || '');
      if (editingQuoteData.quoteId) setEditingQuoteId(editingQuoteData.quoteId);
      setEditingQuoteData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived ──
  const actualPages = roundUpTo4(pageCount);
  const sheetsPerCopy = actualPages / 4; // 4 pages per sheet (duplex with fold)
  const totalMagazinePages = copies * actualPages;

  const paperPick = useMemo(() => findPaperEntry(paperTypes, paperKey), [paperTypes, paperKey]);

  /**
   * Build scenarios:
   *  For every machine SizePricing AND every baseCuts ∈ {1,2,4}:
   *    – press sheet = master / baseCuts (halve longer side)
   *    – press sheet must fit inside the machine size (else skip — machine can't print it)
   *    – count magazine pages on the press sheet (round down to multiple of 4)
   *    – run engine
   */
  const scenarios = useMemo<Scenario[]>(() => {
    if (!paperPick || sizes.length === 0) return [];
    const out: Scenario[] = [];
    const masterW = paperPick.entry.width;
    const masterH = paperPick.entry.height;

    sizes.forEach((machineSize, machineIdx) => {
      [1, 2, 4].forEach(baseCuts => {
        let pw = masterW;
        let ph = masterH;
        if (baseCuts === 2) { if (pw >= ph) pw /= 2; else ph /= 2; }
        else if (baseCuts === 4) { pw /= 2; ph /= 2; }

        // Press sheet must physically fit on the machine
        const fitsMachine =
          (pw <= machineSize.width && ph <= machineSize.height) ||
          (pw <= machineSize.height && ph <= machineSize.width);
        if (!fitsMachine) return;

        // How many magazine PAGES fit on this press sheet (one face)
        const fit = fitOnSheet(pw, ph, pageWidth, pageHeight);
        // Signature alignment: pages per face must be a multiple of 4 (a folded signature
        // = 4 pages). This prevents "extra" odd rows from inflating the count beyond what
        // can actually be folded into a valid signature.
        const pagesPerFace = Math.floor(fit / 4) * 4;
        if (pagesPerFace < 4) return;

        const result = runEngine({
          machineSize,
          colorCount,
          baseCuts,
          pagesPerPressSheet: pagesPerFace,
          printedFaces,
          facesDifferent,
          paperEntry: paperPick.entry,
          copies,
          actualPages,
          wastePercent,
          cellophaneFaces,
          hasDieCut: false,
          moldPrice: 0,
          finishing: [],
        });
        if (result.rowTotal <= 0) return;

        const labelText = buildScenarioLabel(machineSize.sizeName, {
          pagesPerFace,
          printedFaces: printedFaces as 1 | 2,
          facesDifferent,
        });
        out.push({
          id: `m${machineIdx}-b${baseCuts}`,
          machineSizeIdx: machineIdx,
          machineSize,
          baseCuts,
          pressW: pw,
          pressH: ph,
          pagesPerPressSheet: pagesPerFace,
          label: labelText,
          description: `ماكينة ${machineSize.width}×${machineSize.height} — شيت ${pw.toFixed(0)}×${ph.toFixed(0)} (تقطيع ${baseCuts}) — ${result.signaturesPerCopy} ملزمة × ${result.sheetsPerSignature.toLocaleString()} شيت`,
          result,
        });
      });
    });

    // Deduplicate: keep one scenario per (machine + press sheet + pages/sheet).
    // Including the machine in the key ensures every configured machine that can
    // actually print the press sheet (e.g. 50×35) appears as its own scenario,
    // instead of being collapsed into a larger machine's row.
    out.sort((a, b) => a.result.rowTotal - b.result.rowTotal);
    const seen = new Map<string, Scenario>();
    for (const s of out) {
      const key = `${s.machineSizeIdx}|${Math.round(s.pressW)}x${Math.round(s.pressH)}|${s.pagesPerPressSheet}`;
      if (!seen.has(key)) seen.set(key, s);
    }
    return Array.from(seen.values()).sort((a, b) => a.result.rowTotal - b.result.rowTotal);
  }, [paperPick, sizes, pageWidth, pageHeight, colorCount, printedFaces, facesDifferent,
      copies, actualPages, wastePercent, cellophaneFaces]);

  useEffect(() => {
    if (scenarios.length === 0) { setSelectedScenarioId(null); return; }
    if (!selectedScenarioId || !scenarios.find(s => s.id === selectedScenarioId)) {
      setSelectedScenarioId(scenarios[0].id);
    }
  }, [scenarios, selectedScenarioId]);

  const selected = scenarios.find(s => s.id === selectedScenarioId) || scenarios[0];
  const grandTotal = selected?.result.rowTotal || 0;
  const pricePerCopy = copies > 0 ? grandTotal / copies : 0;
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const paperOptions = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    paperTypes.forEach(pt => {
      pt.entries.forEach(e => {
        list.push({
          value: `${pt.name}|${e.grammage}|${e.sizeName}`,
          label: `${pt.name} - ${e.grammage}جم - ${e.sizeName} (${e.width}×${e.height})`,
        });
      });
    });
    return list;
  }, [paperTypes]);

  const handleSave = useCallback(async () => {
    if (!sessionToken) { toast.error('يجب تسجيل الدخول أولاً'); return; }
    if (!selected) { toast.error('لا توجد سيناريو محدد'); return; }
    setSaving(true);
    try {
      const quoteData = {
        sourceType: 'magazines',
        rawInputs: {
          pageWidth, pageHeight, pageCount, copies,
          paperKey, colorCount, printedFaces, facesDifferent,
          wastePercent, cellophaneFaces,
          selectedScenarioId: selected.id,
        },
        itemName, itemNumber, itemSize: `${pageWidth}×${pageHeight}`,
        grandTotal,
      };
      const title = itemName || `مجلة - ${actualPages} صفحة`;
      if (editingQuoteId) {
        await updateQuote(sessionToken, editingQuoteId, { title, customer_name: itemName, quote_number: itemNumber, quote_data: quoteData });
        toast.success('تم تحديث التكلفة بنجاح');
      } else {
        const saved = await saveQuote(sessionToken, { title, customer_name: itemName, quote_number: itemNumber, source_type: 'magazines', quote_data: quoteData });
        setEditingQuoteId(saved.id);
        toast.success('تم حفظ التكلفة بنجاح');
      }
      setSaveOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ في الحفظ');
    } finally { setSaving(false); }
  }, [sessionToken, selected, pageWidth, pageHeight, pageCount, copies, paperKey, colorCount, printedFaces, facesDifferent, wastePercent, cellophaneFaces, itemName, itemNumber, grandTotal, actualPages, editingQuoteId]);

  // ── Render ──
  if (sizes.length === 0 || paperTypes.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          يجب إضافة مقاسات الطباعة وأنواع الورق من الإعدادات قبل استخدام هذه التبويبة.
        </AlertDescription>
      </Alert>
    );
  }

  // sheet dims = page × 2 on the short fold side (purely informational hint)
  const sheetHintW = Math.max(pageWidth, pageHeight);
  const sheetHintH = Math.min(pageWidth, pageHeight) * 2;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" dir="rtl">
      {/* Main */}
      <div className="lg:col-span-2 space-y-4">
        <Card className="border-primary/20 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10 text-primary"><BookOpen className="w-4 h-4" /></div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">المجلات — محرك ذكي</h3>
                <p className="text-[11px] text-muted-foreground">
                  مقاس الصفحة × 2 = مقاس الورقة. يولّد سيناريوهات على كل ماكينة متاحة ويرتبها بالتكلفة.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">مقاس الصفحة (سم)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" min={1} step={0.1} value={pageWidth}
                    onChange={e => setPageWidth(Math.max(1, Number(e.target.value)))}
                    onFocus={e => e.target.select()} placeholder="عرض" />
                  <Input type="number" min={1} step={0.1} value={pageHeight}
                    onChange={e => setPageHeight(Math.max(1, Number(e.target.value)))}
                    onFocus={e => e.target.select()} placeholder="ارتفاع" />
                </div>
                <p className="text-[10px] text-primary">
                  مقاس الورقة الناتج: {sheetHintW}×{sheetHintH} سم
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">عدد الصفحات</Label>
                <Input type="number" min={4} value={pageCount}
                  onChange={e => setPageCount(Math.max(1, Number(e.target.value)))}
                  onFocus={e => e.target.select()} />
                {pageCount !== actualPages
                  ? <p className="text-[10px] text-amber-600">جُبر إلى {actualPages} (مضاعفات الـ4)</p>
                  : <p className="text-[10px] text-muted-foreground">{sheetsPerCopy} ورقة/نسخة</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">الكمية</Label>
                <Input type="number" min={1} value={copies}
                  onChange={e => setCopies(Math.max(0, Number(e.target.value)))}
                  onFocus={e => e.target.select()} />
                <p className="text-[10px] text-muted-foreground">{copies.toLocaleString()} نسخة</p>
              </div>
            </div>

            {/* Paper + colors row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div className="space-y-1.5">
                <Label className="text-xs">نوع الورق + الجرامية + المقاس</Label>
                <Select value={paperKey} onValueChange={setPaperKey}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="اختر الورق" /></SelectTrigger>
                  <SelectContent>
                    {paperOptions.map(o => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {paperPick && (
                  <p className="text-[10px] text-muted-foreground">
                    شيت الشراء: {paperPick.entry.width}×{paperPick.entry.height} سم
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">عدد الألوان</Label>
                <Select value={String(colorCount)} onValueChange={v => setColorCount(Number(v))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map(n => <SelectItem key={n} value={String(n)}>{n} لون</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">يُسعَّر حسب مقاس الماكينة في كل سيناريو</p>
              </div>
            </div>

            {/* Advanced */}
            <Collapsible className="mt-4">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8">
                  <span className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5" /> خيارات متقدمة</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                  <div className="space-y-1">
                    <Label className="text-[11px]">نوع الطباعة</Label>
                    <Select value={String(printedFaces)} onValueChange={v => setPrintedFaces(Number(v) as 1 | 2)}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">وجه واحد</SelectItem>
                        <SelectItem value="2">وجهين</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">الوجهين</Label>
                    <Select value={facesDifferent ? 'diff' : 'same'} onValueChange={v => setFacesDifferent(v === 'diff')}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="same">متطابقين</SelectItem>
                        <SelectItem value="diff">مختلفين</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">السلفان</Label>
                    <Select value={String(cellophaneFaces)} onValueChange={v => setCellophaneFaces(Number(v) as 0 | 1 | 2)}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">بدون</SelectItem>
                        <SelectItem value="1">وجه</SelectItem>
                        <SelectItem value="2">وجهين</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">نسبة الهدر %</Label>
                    <Input type="number" min={0} className="h-9 text-xs"
                      value={wastePercent}
                      onChange={e => setWastePercent(Math.max(0, Number(e.target.value)))}
                      onFocus={e => e.target.select()} />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {/* Scenarios */}
        <Card className="border-primary/20 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm text-foreground">السيناريوهات الذكية</h3>
              <span className="text-[10px] text-muted-foreground">— مرتبة من الأرخص للأغلى</span>
            </div>

            {scenarios.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  لا توجد سيناريوهات. تحقق من أن مقاس الصفحة يخرج من شيت الورق وأن مقاسات الماكينات تستوعب الشيت.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {scenarios.slice(0, 8).map((s, idx) => {
                  const isSelected = s.id === selectedScenarioId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedScenarioId(s.id)}
                      className={`w-full text-right p-3 rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-primary/10 border-primary shadow-md'
                          : 'bg-muted/20 border-border hover:bg-primary/5 hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          {idx === 0 && (
                            <span className="text-[9px] font-bold bg-emerald-500/15 text-emerald-600 px-1.5 py-0.5 rounded">الأفضل</span>
                          )}
                          <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                            {s.label}
                          </span>
                        </div>
                        <span className={`text-base font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                          {fmt(s.result.rowTotal)} ر.س
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">{s.description}</p>
                      <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-muted-foreground">
                        <span>شيتات الطباعة: <b className="text-foreground">{s.result.printSheets}</b></span>
                        <span>بعد الهدر: <b className="text-foreground">{s.result.printSheetsAfterWaste}</b></span>
                        <span>أوراق الشراء: <b className="text-foreground">{s.result.purchaseSheetsNeeded}</b></span>
                        <span>سعر النسخة: <b className="text-foreground">{(s.result.rowTotal / Math.max(1, copies)).toFixed(4)}</b></span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
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
                <span className="text-muted-foreground">صفحات المجلة</span>
                <span className="font-semibold">{actualPages} ({sheetsPerCopy} ورقة)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">الورق</span>
                <span className="font-semibold text-[12px]">
                  {paperPick ? `${paperPick.type} ${paperPick.entry.grammage}جم` : '—'}
                </span>
              </div>
              {selected && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الماكينة</span>
                    <span className="font-semibold text-[12px]">{selected.machineSize.sizeName}</span>
                  </div>
                  <div className="border-t border-border/50 pt-2" />
                  <div className="flex justify-between"><span className="text-muted-foreground">الورق</span><span>{fmt(selected.result.paperCost)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">الفرز</span><span>{fmt(selected.result.sortCost)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">الطباعة</span><span>{fmt(selected.result.printCost)}</span></div>
                  {selected.result.cellophaneCost > 0 && <div className="flex justify-between"><span className="text-muted-foreground">السلفان</span><span>{fmt(selected.result.cellophaneCost)}</span></div>}
                </>
              )}
              <div className="border-t border-border/50 pt-2" />
              <div className="flex justify-between text-base font-bold">
                <span>الإجمالي</span>
                <span className="text-primary">{fmt(grandTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">سعر النسخة</span>
                <span className="font-semibold">{pricePerCopy.toFixed(4)}</span>
              </div>
            </div>

            <ProfitMargins grandTotal={grandTotal} quantity={copies} pieceLabel="نسخة" />

            <Button className="w-full gap-2 mt-2" onClick={() => setSaveOpen(true)} disabled={grandTotal <= 0}>
              <Save className="w-4 h-4" /> حفظ التكلفة
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Save Dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>حفظ تكلفة المجلة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">اسم الصنف *</Label>
              <Input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="مثال: مجلة شركة..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">رقم الصنف</Label>
              <Input value={itemNumber} onChange={e => setItemNumber(e.target.value)} placeholder="اختياري" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)} disabled={saving}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving || !itemName.trim()}>
              {saving ? 'جارٍ الحفظ...' : 'حفظ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MagazinesCalculator;
