/**
 * MergeItemsCalculator — "دمج أصناف"
 *
 * Single shared print sheet, multiple items.
 * - All items share ONE set of production settings (paper, colors, faces,
 *   cellophane, finishing, sheet size).
 * - Each item only carries: name + width × height + required quantity.
 * - The smart layout engine distributes items on the shared sheet and
 *   reports cuts-per-sheet per item.
 * - Cost is computed ONCE for the whole sheet, then split proportionally
 *   to each item by its share of cuts on the sheet.
 *
 * The visual distribution and the cost are bound together: every layout
 * change re-feeds the engine and recomputes everything.
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { usePrintingStore, type FinishingItem, type CalculatorInputs } from '@/store/printingStore';
import { calculateQuote } from '@/lib/calcEngine';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import {
  Layers, Plus, Trash2, Calculator, Settings2, Package, ChevronDown,
} from 'lucide-react';
import MergeSmartLayoutPreview from '@/components/MergeSmartLayoutPreview';
import { toast } from 'sonner';
import { usePreviewSettings } from '@/hooks/usePreviewSettings';

/* ── Types ────────────────────────────────────────────────────────────── */

interface MergeItem {
  id: string;
  name: string;
  width: number;   // cm
  height: number;  // cm
  requiredQty: number;
}

/** Global (shared) settings for the entire merge job. */
interface SharedSettings {
  paperType: string;          // paperType.name
  grammage: number | null;
  purchaseSize: string;       // entry.sizeName
  pressWidth: number;         // cm — the print sheet size
  pressHeight: number;        // cm
  /** Index in priceSettings.sizes — drives sort/print pricing rows. */
  machineSizeIdx: number;
  colorCount: number;         // 0..5 (5 = "more than 4")
  extraColorCount: number;    // when colorCount === 5
  printedFaces: 1 | 2;
  facesDifferent: boolean;    // for 2 faces, different plates
  cellophaneFaces: 0 | 1 | 2;
  cellophaneOverrideEnabled: boolean;
  cellophaneOverridePerFace: number;
  dieCut: boolean;
  moldPrice: number;
  wasteMode: 'number' | 'percent';
  wastePercent: number;
  wasteInCosts: boolean;
  finishing: FinishingItem[];
}

const PALETTE = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(142 70% 45%)',
  'hsl(38 92% 50%)',
  'hsl(280 65% 55%)',
  'hsl(0 72% 55%)',
  'hsl(190 80% 45%)',
  'hsl(50 90% 50%)',
];

const defaultFinishing: FinishingItem[] = [
  { name: 'ورنيش', enabled: false, calcType: 'per_piece', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'وتر بيز', enabled: false, calcType: 'per_piece', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'يوفي', enabled: false, calcType: 'per_piece', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'بصمة', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'تخريم', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'شباك', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'تجليد', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
];

const createItem = (): MergeItem => ({
  id: crypto.randomUUID(),
  name: '',
  width: 0,
  height: 0,
  requiredQty: 1000,
});

const createSharedSettings = (): SharedSettings => ({
  paperType: '',
  grammage: null,
  purchaseSize: '',
  pressWidth: 0,
  pressHeight: 0,
  machineSizeIdx: -1,
  colorCount: 4,
  extraColorCount: 0,
  printedFaces: 1,
  facesDifferent: false,
  cellophaneFaces: 0,
  cellophaneOverrideEnabled: false,
  cellophaneOverridePerFace: 0,
  dieCut: false,
  moldPrice: 0,
  wasteMode: 'number',
  wastePercent: 0,
  wasteInCosts: true,
  finishing: defaultFinishing.map(f => ({ ...f })),
});

/* ── Section header ───────────────────────────────────────────────────── */
const SectionHeader = ({ title, icon: Icon }: { title: string; icon: any }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="p-2 rounded-lg bg-primary/10 text-primary"><Icon className="w-4 h-4" /></div>
    <h3 className="font-semibold text-foreground text-sm">{title}</h3>
  </div>
);

/* ── Paper combobox ───────────────────────────────────────────────────── */
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
        list.push({
          label: `${pt.name} - ${e.grammage} جرام - ${e.sizeName}`,
          value: `${pt.name}|${e.grammage}|${e.sizeName}`,
        });
      });
    });
    return list;
  }, [paperTypes]);

  const selectedLabel = options.find(o => o.value === value)?.label || 'اختر نوع الورق';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between h-9 text-sm font-normal">
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command>
          <CommandInput placeholder="بحث..." />
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

/* ── Main component ───────────────────────────────────────────────────── */
const MergeItemsCalculator = (_props: { onNavigateToQuote?: () => void; sessionToken?: string }) => {
  const { showNestingPreview, show3DPreview } = usePreviewSettings();

  const paperTypes = usePrintingStore(s => s.paperTypes);
  const priceSettings = usePrintingStore(s => s.priceSettings);

  const [shared, setShared] = useState<SharedSettings>(createSharedSettings);
  const [items, setItems] = useState<MergeItem[]>([createItem(), createItem()]);
  /** Allocations per item (cuts per sheet) reported by the layout engine. */
  const [allocations, setAllocations] = useState<number[]>([]);

  /* Update helpers */
  const updateShared = (partial: Partial<SharedSettings>) =>
    setShared(s => ({ ...s, ...partial }));

  const updateItem = (id: string, partial: Partial<MergeItem>) =>
    setItems(arr => arr.map(it => (it.id === id ? { ...it, ...partial } : it)));

  const addItem = () => setItems(arr => [...arr, createItem()]);
  const removeItem = (id: string) =>
    setItems(arr => arr.length <= 1 ? arr : arr.filter(it => it.id !== id));

  /* Paper triple → shared fields */
  const paperKey = shared.paperType && shared.grammage != null && shared.purchaseSize
    ? `${shared.paperType}|${shared.grammage}|${shared.purchaseSize}` : '';

  const onPaperChange = (val: string) => {
    const [name, gramStr, sizeName] = val.split('|');
    updateShared({ paperType: name, grammage: Number(gramStr), purchaseSize: sizeName });
  };

  /* Pieces fed to the layout engine — one per item. */
  const layoutPieces = useMemo(() =>
    items.map((it, i) => ({
      id: it.id,
      name: it.name || `صنف ${i + 1}`,
      printWidth: it.width,
      printHeight: it.height,
      quantity: it.requiredQty,
      color: PALETTE[i % PALETTE.length],
    })),
  [items]);

  /* Stabilize allocations callback */
  const handleAllocations = useCallback((a: number[]) => setAllocations(a), []);

  /* ── Unified cost calculation ────────────────────────────────────────
   * Treat the whole job as ONE sheet run:
   *  • totalSheets = max over items of ceil(required / cutsPerSheet)
   *  • Use one calculateQuote() call with quantity = totalSheets * 1
   *    BUT we want the engine to compute paper/print/finishing on the
   *    shared sheet; so we feed quantity = printSheetsBeforeWaste cuts'
   *    equivalent. Easiest: set cutsPerSheet = 1 and quantity = totalSheets
   *    → engine produces printSheetsBeforeWaste = totalSheets and all
   *    per-1000 / per-piece numbers reflect the SHARED RUN.
   *  • Then proportionally split grandTotal across items by allocation share.
   */
  const calc = useMemo(() => {
    if (!shared.paperType || !shared.grammage || !shared.purchaseSize) return null;
    if (shared.pressWidth <= 0 || shared.pressHeight <= 0) return null;
    if (allocations.length !== items.length || allocations.every(a => a === 0)) return null;

    // Total sheets = limited by the item that needs the most sheets to satisfy its required qty
    let totalSheets = 0;
    items.forEach((it, i) => {
      const a = allocations[i] || 0;
      if (a <= 0) return;
      const needed = Math.ceil(Math.max(0, it.requiredQty) / a);
      if (needed > totalSheets) totalSheets = needed;
    });
    if (totalSheets <= 0) return null;

    const inputs: CalculatorInputs = {
      paperType: shared.paperType,
      grammage: shared.grammage,
      purchaseSize: shared.purchaseSize,
      printWidth: shared.pressWidth,
      printHeight: shared.pressHeight,
      // Trick: drive engine with sheets directly so paper/print are for the shared run.
      quantity: totalSheets,
      cutsPerSheet: 1,
      wastePercent: shared.wastePercent,
      colorCount: shared.colorCount,
      printedFaces: shared.printedFaces,
      facesDifferent: shared.facesDifferent,
      cellophaneFaces: shared.cellophaneFaces,
      dieCut: shared.dieCut,
      moldPrice: shared.moldPrice,
      wasteInCosts: shared.wasteInCosts,
      extraColorCalcType: 'per_1000',
      extraColorPrice: 0,
      extraColorExtra1000: 0,
      extraColorCount: shared.extraColorCount,
    };
    // wasteMode is not in the type but the engine reads it via cast
    (inputs as any).wasteMode = shared.wasteMode;

    const result = calculateQuote(inputs, shared.finishing, paperTypes, priceSettings, {
      machineSizeIdx: shared.machineSizeIdx,
      cellophaneOverridePerFace: shared.cellophaneOverrideEnabled
        ? shared.cellophaneOverridePerFace
        : undefined,
    });

    if (!result.valid) return { valid: false, error: result.error, totalSheets };

    // Per-item proportional split based on cuts-per-sheet share
    const totalCutsPerSheet = allocations.reduce((s, a) => s + a, 0) || 1;
    const perItem = items.map((it, i) => {
      const a = allocations[i] || 0;
      const share = a / totalCutsPerSheet;
      const actualQty = a * totalSheets;
      const surplus = actualQty - it.requiredQty;
      const surplusPct = it.requiredQty > 0 ? (surplus / it.requiredQty) * 100 : 0;
      return {
        id: it.id,
        name: it.name || `صنف ${i + 1}`,
        cutsPerSheet: a,
        share,
        requiredQty: it.requiredQty,
        actualQty,
        surplus,
        surplusPct,
        cost: result.grandTotal * share,
      };
    });

    return {
      valid: true as const,
      totalSheets,
      result,
      perItem,
    };
  }, [shared, items, allocations, paperTypes, priceSettings]);

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border border-primary/20 p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/15 text-primary"><Layers className="w-5 h-5" /></div>
          <div className="flex-1">
            <h2 className="font-bold text-foreground">دمج أصناف داخل شيت طباعة واحد</h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              جميع الأصناف تشترك في نفس شيت الطباعة، نفس الورق، نفس الألوان، نفس التشطيبات.
              يتم حساب التكلفة مرة واحدة للشيت ثم توزيعها على الأصناف نسبيًا حسب عدد القطع لكل صنف داخل الشيت.
            </p>
          </div>
        </div>
      </div>

      {/* GLOBAL SHARED SETTINGS */}
      <Card>
        <CardContent className="pt-5">
          <SectionHeader title="إعدادات شيت الطباعة المشتركة" icon={Settings2} />

          {/* Paper + sheet size */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="space-y-1.5">
              <Label className="text-xs">نوع الورق (شراء)</Label>
              <PaperCombobox paperTypes={paperTypes} value={paperKey} onChange={onPaperChange} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">عرض شيت الطباعة (سم)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={shared.pressWidth || ''}
                  onChange={e => updateShared({ pressWidth: parseFloat(e.target.value) || 0 })}
                  onFocus={e => e.target.select()}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">طول شيت الطباعة (سم)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={shared.pressHeight || ''}
                  onChange={e => updateShared({ pressHeight: parseFloat(e.target.value) || 0 })}
                  onFocus={e => e.target.select()}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {/* Machine size (for color pricing) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="space-y-1.5">
              <Label className="text-xs">مقاس الماكينة (لتسعير الألوان)</Label>
              <Select
                value={shared.machineSizeIdx >= 0 ? String(shared.machineSizeIdx) : ''}
                onValueChange={v => updateShared({ machineSizeIdx: Number(v) })}
              >
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="اختر مقاس" /></SelectTrigger>
                <SelectContent>
                  {priceSettings.sizes.map((s, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {s.width}×{s.height}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">عدد الألوان</Label>
              <Select
                value={String(shared.colorCount)}
                onValueChange={v => updateShared({ colorCount: Number(v) })}
              >
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">بدون طباعة</SelectItem>
                  <SelectItem value="1">1 لون</SelectItem>
                  <SelectItem value="2">2 لون</SelectItem>
                  <SelectItem value="3">3 ألوان</SelectItem>
                  <SelectItem value="4">4 ألوان</SelectItem>
                  <SelectItem value="5">أكثر من 4</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">عدد الأوجه</Label>
              <Select
                value={String(shared.printedFaces)}
                onValueChange={v => updateShared({ printedFaces: Number(v) as 1 | 2 })}
              >
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">وجه واحد</SelectItem>
                  <SelectItem value="2">وجهين</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 2-face different + Cellophane + waste */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {shared.printedFaces === 2 && (
              <div className="flex items-center justify-between rounded-lg border border-border p-2 h-9">
                <Label className="text-xs">وجهين مختلفين (زنكات مختلفة)</Label>
                <Switch checked={shared.facesDifferent} onCheckedChange={v => updateShared({ facesDifferent: v })} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">سلوفان</Label>
              <Select
                value={String(shared.cellophaneFaces)}
                onValueChange={v => updateShared({ cellophaneFaces: Number(v) as 0 | 1 | 2 })}
              >
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">بدون سلوفان</SelectItem>
                  <SelectItem value="1">وجه واحد</SelectItem>
                  <SelectItem value="2">وجهين</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">الزيادة (للهالك)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={shared.wastePercent || ''}
                  onChange={e => updateShared({ wastePercent: parseFloat(e.target.value) || 0 })}
                  onFocus={e => e.target.select()}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">نوع الزيادة</Label>
                <Select
                  value={shared.wasteMode}
                  onValueChange={v => updateShared({ wasteMode: v as 'number' | 'percent' })}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="number">عدد شيتات</SelectItem>
                    <SelectItem value="percent">نسبة %</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Diecut + mold */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-2 h-9">
              <Label className="text-xs">تكسير (Die-cut)</Label>
              <Switch checked={shared.dieCut} onCheckedChange={v => updateShared({ dieCut: v })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">سعر القالب (إن وُجد)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={shared.moldPrice || ''}
                onChange={e => updateShared({ moldPrice: parseFloat(e.target.value) || 0 })}
                onFocus={e => e.target.select()}
                className="h-9"
              />
            </div>
          </div>

          {/* Finishing */}
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <h4 className="text-xs font-bold mb-2">التشطيبات (مشتركة لكل الأصناف)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {shared.finishing.map((f, idx) => (
                <div key={f.name} className={`flex items-center gap-2 rounded-md border p-2 ${f.enabled ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border bg-background'}`}>
                  <Switch
                    checked={f.enabled}
                    onCheckedChange={v => updateShared({
                      finishing: shared.finishing.map((x, i) => i === idx ? { ...x, enabled: v } : x),
                    })}
                  />
                  <span className="text-xs font-semibold w-16">{f.name}</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="السعر"
                    value={f.pricePerUnit || ''}
                    onChange={e => updateShared({
                      finishing: shared.finishing.map((x, i) => i === idx ? { ...x, pricePerUnit: parseFloat(e.target.value) || 0 } : x),
                    })}
                    onFocus={e => e.target.select()}
                    className="h-8 text-xs"
                  />
                  <Select
                    value={f.calcType}
                    onValueChange={v => updateShared({
                      finishing: shared.finishing.map((x, i) => i === idx ? { ...x, calcType: v as FinishingItem['calcType'] } : x),
                    })}
                  >
                    <SelectTrigger className="h-8 text-[11px] w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_piece">لكل قطعة</SelectItem>
                      <SelectItem value="per_1000">لكل 1000</SelectItem>
                      <SelectItem value="tiered_1000">تصاعدي/1000</SelectItem>
                      <SelectItem value="flat">إجمالي ثابت</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ITEMS LIST — only name + size + qty */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader title="الأصناف (داخل نفس الشيت)" icon={Package} />
            <Button size="sm" variant="outline" onClick={addItem} className="gap-1">
              <Plus className="w-3.5 h-3.5" /> إضافة صنف
            </Button>
          </div>

          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={it.id} className="grid grid-cols-12 gap-2 items-end rounded-lg border border-border bg-muted/10 p-2">
                <div className="col-span-12 sm:col-span-1 flex items-center gap-1">
                  <span className="w-3 h-3 rounded shrink-0" style={{ backgroundColor: PALETTE[idx % PALETTE.length] }} />
                  <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                </div>
                <div className="col-span-12 sm:col-span-4 space-y-1">
                  <Label className="text-[11px]">اسم الصنف</Label>
                  <Input
                    value={it.name}
                    onChange={e => updateItem(it.id, { name: e.target.value })}
                    placeholder={`صنف ${idx + 1}`}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="col-span-4 sm:col-span-2 space-y-1">
                  <Label className="text-[11px]">العرض</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={it.width || ''}
                    onChange={e => updateItem(it.id, { width: parseFloat(e.target.value) || 0 })}
                    onFocus={e => e.target.select()}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="col-span-4 sm:col-span-2 space-y-1">
                  <Label className="text-[11px]">الطول</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={it.height || ''}
                    onChange={e => updateItem(it.id, { height: parseFloat(e.target.value) || 0 })}
                    onFocus={e => e.target.select()}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="col-span-3 sm:col-span-2 space-y-1">
                  <Label className="text-[11px]">الكمية المطلوبة</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={it.requiredQty || ''}
                    onChange={e => updateItem(it.id, { requiredQty: parseInt(e.target.value) || 0 })}
                    onFocus={e => e.target.select()}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeItem(it.id)}
                    disabled={items.length <= 1}
                    className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* SMART LAYOUT — feeds allocations into the cost engine */}
      <Card>
        <CardContent className="pt-5">
          <SectionHeader title="التوزيع الذكي داخل الشيت" icon={Layers} />
          <MergeSmartLayoutPreview
            sheetW={shared.pressWidth}
            sheetH={shared.pressHeight}
            pieces={layoutPieces}
            onAllocationsChange={handleAllocations}
          />
        </CardContent>
      </Card>

      {/* RESULTS — single sheet cost + per-item proportional breakdown */}
      <Card>
        <CardContent className="pt-5">
          <SectionHeader title="النتائج (حساب موحد للشيت)" icon={Calculator} />

          {!calc && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              أكمل إعدادات الشيت المشتركة وأدخل مقاسات/كميات الأصناف لعرض النتائج.
            </div>
          )}

          {calc && !calc.valid && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {calc.error || 'تعذر الحساب — راجع البيانات.'}
            </div>
          )}

          {calc?.valid && (
            <div className="space-y-4">
              {/* Sheet summary */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <h4 className="text-sm font-bold text-primary mb-3">ملخص الشيت المشترك</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="عدد شيتات الطباعة" value={calc.totalSheets.toLocaleString()} />
                  <Stat label="شيتات بعد الزيادة" value={calc.result.printSheetsAfterWaste.toLocaleString()} />
                  <Stat label="شيتات الشراء" value={calc.result.purchaseSheetsNeeded.toLocaleString()} />
                  <Stat label="إجمالي القطع/شيت" value={(allocations.reduce((s, a) => s + a, 0)).toLocaleString()} />
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <Stat label="تكلفة الورق" value={fmt(calc.result.paperCost)} />
                  <Stat label="تكلفة الفرز" value={fmt(calc.result.sortCost)} />
                  <Stat label="تكلفة الطباعة" value={fmt(calc.result.printCost)} />
                  <Stat label="السلوفان" value={fmt(calc.result.cellophaneCost)} />
                  <Stat label="التكسير" value={fmt(calc.result.dieCutCost)} />
                  <Stat label="التشطيبات" value={fmt(calc.result.totalFinishing)} />
                </div>

                <div className="mt-3 flex items-center justify-between rounded-md bg-primary text-primary-foreground px-3 py-2">
                  <span className="text-sm font-bold">الإجمالي النهائي للشيت</span>
                  <span className="text-base font-bold tabular-nums">{fmt(calc.result.grandTotal)} ج.م</span>
                </div>
              </div>

              {/* Per-item proportional breakdown */}
              <div className="rounded-lg border border-border bg-card p-3">
                <h4 className="text-sm font-bold mb-3">توزيع الأصناف</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border">
                        <th className="text-right p-2">الصنف</th>
                        <th className="text-center p-2">قطع/شيت</th>
                        <th className="text-center p-2">المطلوب</th>
                        <th className="text-center p-2">الفعلي</th>
                        <th className="text-center p-2">الزيادة</th>
                        <th className="text-center p-2">% زيادة</th>
                        <th className="text-center p-2">حصة الشيت</th>
                        <th className="text-left p-2">التكلفة النسبية</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calc.perItem.map((p, idx) => (
                        <tr key={p.id} className="border-b border-border/50 last:border-0">
                          <td className="p-2 font-semibold">
                            <span className="inline-flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: PALETTE[idx % PALETTE.length] }} />
                              {p.name}
                            </span>
                          </td>
                          <td className="p-2 text-center font-mono">{p.cutsPerSheet}</td>
                          <td className="p-2 text-center font-mono">{p.requiredQty.toLocaleString()}</td>
                          <td className="p-2 text-center font-mono">{p.actualQty.toLocaleString()}</td>
                          <td className={`p-2 text-center font-mono ${p.surplus > p.requiredQty * 0.1 ? 'text-destructive' : 'text-emerald-600'}`}>
                            {p.surplus >= 0 ? '+' : ''}{p.surplus.toLocaleString()}
                          </td>
                          <td className="p-2 text-center font-mono">{p.surplusPct.toFixed(1)}%</td>
                          <td className="p-2 text-center font-mono">{(p.share * 100).toFixed(1)}%</td>
                          <td className="p-2 text-left font-mono font-bold text-primary">{fmt(p.cost)} ج.م</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                  💡 التكلفة لكل صنف = إجمالي تكلفة الشيت × (عدد قطع الصنف ÷ إجمالي القطع داخل الشيت).
                  أي تغيير في التوزيع يُحدّث الحساب فورًا.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between bg-background/60 rounded px-2 py-1.5 border border-border">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-mono font-bold">{value}</span>
  </div>
);

const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default MergeItemsCalculator;
