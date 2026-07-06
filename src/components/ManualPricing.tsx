import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { usePrintingStore, type PricingUnit } from '@/store/printingStore';
import { FileText, Printer, Settings, Calculator, Layers, AlertCircle, Sparkles } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import ProfitMargins from '@/components/ProfitMargins';
import { toast } from 'sonner';

const vBorder = 'border-destructive/50 ring-1 ring-destructive/30';

interface ManualInputs {
  paperName: string;
  grammage: number;
  purchaseWidth: number;
  purchaseHeight: number;
  pricingUnit: PricingUnit;
  pricePerTon: number;
  pricePerReam: number;
  sheetsPerReam: number;
  sortCost: number;
  printFirst1000PerFace: number;
  printExtra1000PerFace: number;
  printWidth: number;
  printHeight: number;
  quantity: number;
  cutsPerSheet: number;
  printSheetsPerPurchaseManual: number;
  wastePercent: number;
  printedFaces: number;
  facesDifferent: boolean;
  cellophaneFaces: number;
  cellophanePerFace: number;
  dieCut: boolean;
  moldPrice: number;
  diecut1st1000: number;
  diecutExtra1000: number;
}

const defaultManual: ManualInputs = {
  paperName: '',
  grammage: 0,
  purchaseWidth: 0,
  purchaseHeight: 0,
  pricingUnit: 'ton',
  pricePerTon: 0,
  pricePerReam: 0,
  sheetsPerReam: 500,
  sortCost: 0,
  printFirst1000PerFace: 0,
  printExtra1000PerFace: 0,
  printWidth: 50,
  printHeight: 70,
  quantity: 1000,
  cutsPerSheet: 1,
  printSheetsPerPurchaseManual: 0,
  wastePercent: 0,
  printedFaces: 1,
  facesDifferent: false,
  cellophaneFaces: 0,
  cellophanePerFace: 0,
  dieCut: false,
  moldPrice: 0,
  diecut1st1000: 0,
  diecutExtra1000: 0,
};

function useManualCalc(inp: ManualInputs, finishingItems: any[]) {
  const purchaseArea = (inp.purchaseWidth / 100) * (inp.purchaseHeight / 100);
  const purchaseWeight = purchaseArea * inp.grammage;
  const pricePerGram = inp.pricePerTon / 1_000_000;
  const pricePerSheet = inp.pricingUnit === 'ream' && inp.sheetsPerReam > 0
    ? inp.pricePerReam / inp.sheetsPerReam
    : purchaseWeight * pricePerGram;

  const pw = inp.printWidth;
  const ph = inp.printHeight;
  const o1 = Math.floor(inp.purchaseWidth / pw) * Math.floor(inp.purchaseHeight / ph);
  const o2 = Math.floor(inp.purchaseWidth / ph) * Math.floor(inp.purchaseHeight / pw);
  const autoSheets = Math.max(o1, o2);
  const printSheetsPerPurchase = inp.printSheetsPerPurchaseManual > 0 ? inp.printSheetsPerPurchaseManual : autoSheets;

  const printSheetsBeforeWaste =
    inp.quantity <= 0 || inp.cutsPerSheet <= 0 ? 0 : Math.ceil(inp.quantity / inp.cutsPerSheet);
  const printSheetsAfterWaste = Math.ceil(printSheetsBeforeWaste * (1 + inp.wastePercent / 100));
  const purchaseSheetsNeeded =
    printSheetsPerPurchase === 0 ? 0 : Math.ceil(printSheetsAfterWaste / printSheetsPerPurchase);

  const paperCost = pricePerSheet * purchaseSheetsNeeded;
  const thousands = Math.max(1, Math.ceil(printSheetsAfterWaste / 1000));

  let sortCost = 0;
  if (inp.printedFaces === 1) sortCost = inp.sortCost;
  else if (inp.printedFaces === 2 && inp.facesDifferent) sortCost = inp.sortCost * 2;
  else sortCost = inp.sortCost;

  const printCost =
    inp.printedFaces *
    (inp.printFirst1000PerFace + Math.max(0, thousands - 1) * inp.printExtra1000PerFace);

  const cellophaneCost = printSheetsAfterWaste * inp.cellophaneFaces * inp.cellophanePerFace;

  let dieCutCost = 0;
  if (inp.dieCut) {
    dieCutCost = inp.diecut1st1000 + Math.max(0, thousands - 1) * inp.diecutExtra1000;
  }

  const totalCost = paperCost + sortCost + printCost + cellophaneCost + dieCutCost + inp.moldPrice;

  const finishingCosts = finishingItems.map((item) => {
    if (!item.enabled || !item.pricePerUnit) return 0;
    switch (item.calcType) {
      case 'per_piece': return inp.quantity * item.multiplier * item.pricePerUnit;
      case 'per_1000': return thousands * item.multiplier * item.pricePerUnit;
      case 'tiered_1000': return item.multiplier * (item.pricePerUnit + Math.max(thousands - 1, 0) * item.extraPer1000);
      case 'flat': return item.multiplier * item.pricePerUnit;
      default: return 0;
    }
  });

  const totalFinishing = finishingCosts.reduce((a, b) => a + b, 0);
  const grandTotal = totalCost + totalFinishing;
  const pricePerPiece = inp.quantity === 0 ? 0 : grandTotal / inp.quantity;

  let validationMessage = '';
  if (inp.cutsPerSheet <= 0 || inp.quantity <= 0) validationMessage = 'أدخل عدد القطع وعدد ما يفصل في الشيت';
  else if (printSheetsPerPurchase === 0) validationMessage = 'مقاس ورقة الطباعة لا يخرج من ورقة الشراء';
  else if (!inp.purchaseWidth || !inp.purchaseHeight || !inp.grammage || (inp.pricingUnit === 'ton' ? !inp.pricePerTon : !inp.pricePerReam))
    validationMessage = 'أدخل بيانات الورق (مقاس الشراء، الجرامية، السعر)';

  return {
    purchaseArea, purchaseWeight, pricePerGram, pricePerSheet,
    printSheetsPerPurchase, printSheetsBeforeWaste, printSheetsAfterWaste,
    purchaseSheetsNeeded, paperCost, thousands, sortCost, printCost,
    cellophaneCost, dieCutCost, totalCost, totalFinishing, grandTotal,
    pricePerPiece, validationMessage,
  };
}

/* ── Tiny helpers ── */
const Field = ({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={`space-y-1.5 ${className}`}>
    <Label className="text-xs text-muted-foreground">{label}</Label>
    {children}
  </div>
);

const StatChip = ({ label, value, unit }: { label: string; value: string; unit?: string }) => (
  <div className="bg-muted/50 rounded-lg p-2.5 text-center">
    <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
    <p className="text-sm font-bold text-foreground">{value}</p>
    {unit && <p className="text-[10px] text-muted-foreground">{unit}</p>}
  </div>
);

const CostRow = ({ label, value, bold, primary }: { label: string; value: string; bold?: boolean; primary?: boolean }) => (
  <div className={`flex justify-between items-center py-1.5 px-2 rounded ${primary ? 'bg-primary/10' : bold ? 'bg-muted/50' : ''}`}>
    <span className={`text-xs ${bold || primary ? 'font-bold' : ''} ${primary ? 'text-primary' : ''}`}>{label}</span>
    <span className={`font-mono text-xs ${bold ? 'font-bold' : ''} ${primary ? 'text-primary font-bold text-sm' : ''}`}>{value} <span className="text-muted-foreground">ريال</span></span>
  </div>
);

import ItemInfoCard, { ItemInfo, validateItemInfo } from '@/components/ItemInfoCard';
import VoiceInput from '@/components/VoiceInput';

const ManualPricing = ({ onNavigateToQuote }: { onNavigateToQuote?: () => void }) => {
  const { finishingItems, setUnifiedQuote, setQuoteInfo, editingQuoteData, setEditingQuoteData } = usePrintingStore();
  const [inp, setInp] = useState<ManualInputs>(() => {
    if (editingQuoteData?.sourceType === 'manual' && editingQuoteData.rawInputs) {
      const restored = { ...defaultManual, ...editingQuoteData.rawInputs };
      return restored;
    }
    return defaultManual;
  });
  const [itemInfo, setItemInfo] = useState<ItemInfo>(() => {
    if (editingQuoteData?.sourceType === 'manual') {
      return { itemName: editingQuoteData.itemName || '', itemNumber: editingQuoteData.itemNumber || '', itemSize: editingQuoteData.itemSize || '' };
    }
    return { itemName: '', itemNumber: '', itemSize: '' };
  });
  const [showItemValidation, setShowItemValidation] = useState(false);
  const [showMissingItemInfo, setShowMissingItemInfo] = useState(false);
  const calc = useManualCalc(inp, finishingItems);

  // Load editing data when editingQuoteData changes
  useEffect(() => {
    if (editingQuoteData?.sourceType === 'manual') {
      setItemInfo({ itemName: editingQuoteData.itemName || '', itemNumber: editingQuoteData.itemNumber || '', itemSize: editingQuoteData.itemSize || '' });
      if (editingQuoteData.rawInputs) {
        setInp({ ...defaultManual, ...editingQuoteData.rawInputs });
      }
      setEditingQuoteData(null);
    }
  }, [editingQuoteData]);

  const set = (partial: Partial<ManualInputs>) => setInp((p) => ({ ...p, ...partial }));

  const getMissingFields = () => {
    const m: string[] = [];
    if (!itemInfo.itemName.trim()) m.push('اسم الصنف');
    if (!itemInfo.itemNumber.trim()) m.push('رقم الصنف');
    if (!itemInfo.itemSize.trim()) m.push('مقاس الصنف');
    return m;
  };

  const doSendToQuote = () => {
    setQuoteInfo({ itemName: itemInfo.itemName, itemNumber: itemInfo.itemNumber, itemSize: itemInfo.itemSize });
    setUnifiedQuote({
      sourceType: 'manual',
      sourceLabel: 'تسعيرة يدوي',
      quantity: inp.quantity,
      details: [
        { label: 'نوع الورق', value: inp.paperName || '—' },
        { label: 'الجرامية', value: inp.grammage.toString() },
        { label: 'مقاس الشراء', value: `${inp.purchaseWidth}×${inp.purchaseHeight}` },
        { label: 'عدد القطع', value: inp.quantity.toString() },
        { label: 'عرض الطباعة (سم)', value: inp.printWidth.toString() },
        { label: 'طول الطباعة (سم)', value: inp.printHeight.toString() },
        { label: 'عدد الأوجه', value: inp.printedFaces.toString() },
        { label: 'أوجه السلفان', value: inp.cellophaneFaces.toString() },
        { label: 'تكسير؟', value: inp.dieCut ? 'نعم' : 'لا' },
        { label: 'نسبة الهدر %', value: inp.wastePercent.toString() },
        { label: 'كم تفصل في الشيت', value: inp.cutsPerSheet.toString() },
      ],
      costBreakdown: [
        { label: 'الورق', value: calc.paperCost },
        { label: 'الفرز', value: calc.sortCost },
        { label: 'الطباعة', value: calc.printCost },
        { label: 'السلفان', value: calc.cellophaneCost },
        { label: 'التكسير', value: calc.dieCutCost },
      ],
      totalCost: calc.totalCost,
      totalFinishing: calc.totalFinishing,
      grandTotal: calc.grandTotal,
      pricePerPiece: calc.pricePerPiece,
      pieceLabel: 'قطعة',
      rawInputs: { ...inp },
    } as any);
    toast.success('تم إرسال الحسبة لعرض السعر');
    onNavigateToQuote?.();
  };

  const handleSendToQuote = () => {
    if (!validateItemInfo(itemInfo)) {
      setShowItemValidation(true);
      setShowMissingItemInfo(true);
      return;
    }
    doSendToQuote();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* ═══ Main Inputs ═══ */}
      <div className="lg:col-span-2 space-y-4">
        <ItemInfoCard value={itemInfo} onChange={setItemInfo} showValidation={showItemValidation} />
        <VoiceInput
          calcType="manual"
          onFieldsParsed={(fields) => {
            const { itemName, itemNumber, itemSize, ...rest } = fields;
            if (itemName || itemNumber || itemSize) {
              setItemInfo(prev => ({
                ...prev,
                ...(itemName && { itemName }),
                ...(itemNumber && { itemNumber }),
                ...(itemSize && { itemSize }),
              }));
            }
            const updates: any = {};
            if (rest.paperName) updates.paperName = rest.paperName;
            if (rest.grammage) updates.grammage = Number(rest.grammage);
            if (rest.purchaseWidth) updates.purchaseWidth = Number(rest.purchaseWidth);
            if (rest.purchaseHeight) updates.purchaseHeight = Number(rest.purchaseHeight);
            if (rest.pricePerTon) updates.pricePerTon = Number(rest.pricePerTon);
            if (rest.printWidth) updates.printWidth = Number(rest.printWidth);
            if (rest.printHeight) updates.printHeight = Number(rest.printHeight);
            if (rest.quantity) updates.quantity = Number(rest.quantity);
            if (rest.cutsPerSheet) updates.cutsPerSheet = Number(rest.cutsPerSheet);
            if (rest.wastePercent !== undefined) updates.wastePercent = Number(rest.wastePercent);
            if (rest.printedFaces) updates.printedFaces = Number(rest.printedFaces);
            if (rest.cellophaneFaces !== undefined) updates.cellophaneFaces = Number(rest.cellophaneFaces);
            if (rest.dieCut !== undefined) updates.dieCut = Boolean(rest.dieCut);
            if (Object.keys(updates).length > 0) set(updates);
          }}
        />

        {/* Paper Data */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              بيانات الورق
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="نوع الورق">
                <Input value={inp.paperName} onChange={(e) => set({ paperName: e.target.value })} placeholder="مثال: كوشيه خاص" className={`h-9 text-sm ${!inp.paperName ? vBorder : ''}`} />
              </Field>
              <Field label="الجرامية (GSM)">
                <Input type="number" value={inp.grammage || ''} onChange={(e) => set({ grammage: Number(e.target.value) })} className={`h-9 text-sm ${!inp.grammage ? vBorder : ''}`} />
              </Field>
              <Field label="وحدة التسعير">
                <Select value={inp.pricingUnit} onValueChange={(v) => set({ pricingUnit: v as PricingUnit })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ton">بالطن</SelectItem>
                    <SelectItem value="ream">بالرزمة</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="عرض ورق الشراء (سم)">
                <Input type="number" value={inp.purchaseWidth || ''} onChange={(e) => set({ purchaseWidth: Number(e.target.value) })} className={`h-9 text-sm ${!inp.purchaseWidth ? vBorder : ''}`} />
              </Field>
              <Field label="طول ورق الشراء (سم)">
                <Input type="number" value={inp.purchaseHeight || ''} onChange={(e) => set({ purchaseHeight: Number(e.target.value) })} className={`h-9 text-sm ${!inp.purchaseHeight ? vBorder : ''}`} />
              </Field>
              {inp.pricingUnit === 'ton' ? (
                <Field label="سعر الطن (ريال)">
                  <Input type="number" value={inp.pricePerTon || ''} onChange={(e) => set({ pricePerTon: Number(e.target.value) })} className={`h-9 text-sm ${!inp.pricePerTon ? vBorder : ''}`} />
                </Field>
              ) : (
                <>
                  <Field label="سعر الرزمة (ريال)">
                    <Input type="number" value={inp.pricePerReam || ''} onChange={(e) => set({ pricePerReam: Number(e.target.value) })} className={`h-9 text-sm ${!inp.pricePerReam ? vBorder : ''}`} />
                  </Field>
                  <Field label="عدد ورق الرزمة">
                    <Input type="number" value={inp.sheetsPerReam} onChange={(e) => set({ sheetsPerReam: Number(e.target.value) })} className="h-9 text-sm" />
                  </Field>
                </>
              )}
              {inp.pricingUnit === 'ton' && (
                <div className="flex items-end">
                  <StatChip label="سعر الورقة" value={calc.pricePerSheet.toFixed(3)} unit="ريال" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Print Costs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Printer className="h-4 w-4 text-primary" />
              تكاليف الطباعة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="تكلفة الفرز">
                <Input type="number" value={inp.sortCost || ''} onChange={(e) => set({ sortCost: Number(e.target.value) })} className="h-9 text-sm" />
              </Field>
              <Field label="طباعة أول ألف / وجه">
                <Input type="number" value={inp.printFirst1000PerFace || ''} onChange={(e) => set({ printFirst1000PerFace: Number(e.target.value) })} className="h-9 text-sm" />
              </Field>
              <Field label="كل ألف إضافي / وجه">
                <Input type="number" value={inp.printExtra1000PerFace || ''} onChange={(e) => set({ printExtra1000PerFace: Number(e.target.value) })} className="h-9 text-sm" />
              </Field>
              <Field label="سعر سلفان / وجه">
                <Input type="number" value={inp.cellophanePerFace || ''} onChange={(e) => set({ cellophanePerFace: Number(e.target.value) })} className="h-9 text-sm" />
              </Field>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="تكسير أول ألف">
                <Input type="number" value={inp.diecut1st1000 || ''} onChange={(e) => set({ diecut1st1000: Number(e.target.value) })} className="h-9 text-sm" />
              </Field>
              <Field label="تكسير كل ألف إضافي">
                <Input type="number" value={inp.diecutExtra1000 || ''} onChange={(e) => set({ diecutExtra1000: Number(e.target.value) })} className="h-9 text-sm" />
              </Field>
              <Field label="قيمة القالب (ريال)">
                <Input type="number" value={inp.moldPrice || ''} onChange={(e) => set({ moldPrice: Number(e.target.value) })} className="h-9 text-sm" />
              </Field>
            </div>
          </CardContent>
        </Card>

        {/* Print Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              إعدادات الطباعة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="عرض ورقة الطباعة (سم)">
                <Input type="number" value={inp.printWidth} onChange={(e) => set({ printWidth: Number(e.target.value) })} className={`h-9 text-sm ${!inp.printWidth ? vBorder : ''}`} />
              </Field>
              <Field label="طول ورقة الطباعة (سم)">
                <Input type="number" value={inp.printHeight} onChange={(e) => set({ printHeight: Number(e.target.value) })} className={`h-9 text-sm ${!inp.printHeight ? vBorder : ''}`} />
              </Field>
              <Field label="عدد القطع المطلوبة">
                <Input type="number" value={inp.quantity} onChange={(e) => set({ quantity: Number(e.target.value) })} className={`h-9 text-sm ${!inp.quantity ? vBorder : ''}`} />
              </Field>
              <Field label="كم تفصل في الشيت">
                <Input type="number" value={inp.cutsPerSheet} onChange={(e) => set({ cutsPerSheet: Number(e.target.value) })} className={`h-9 text-sm ${!inp.cutsPerSheet ? vBorder : ''}`} />
              </Field>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="ورقات طباعة من ورقة شراء">
                <Input type="number" value={inp.printSheetsPerPurchaseManual || ''} onChange={(e) => set({ printSheetsPerPurchaseManual: Number(e.target.value) })} placeholder="تلقائي" className="h-9 text-sm" />
              </Field>
              <Field label="نسبة الهدر (%)">
                <Input type="number" value={inp.wastePercent} onChange={(e) => set({ wastePercent: Number(e.target.value) })} className="h-9 text-sm" />
              </Field>
              <Field label="عدد الأوجه المطبوعة">
                <Select value={inp.printedFaces.toString()} onValueChange={(v) => set({ printedFaces: Number(v) })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - وجه واحد</SelectItem>
                    <SelectItem value="2">2 - وجهان</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="عدد أوجه السلفان">
                <Select value={inp.cellophaneFaces.toString()} onValueChange={(v) => set({ cellophaneFaces: Number(v) })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 - بدون</SelectItem>
                    <SelectItem value="1">1 - وجه</SelectItem>
                    <SelectItem value="2">2 - وجهان</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-6 pt-1">
              <div className="flex items-center gap-2">
                <Switch checked={inp.facesDifferent} onCheckedChange={(v) => set({ facesDifferent: v })} disabled={inp.printedFaces !== 2} />
                <Label className="text-xs">الوجهان مختلفان؟</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={inp.dieCut} onCheckedChange={(v) => set({ dieCut: v })} />
                <Label className="text-xs">التكسير / قالب خاص</Label>
              </div>
            </div>

            {calc.validationMessage && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-xs">{calc.validationMessage}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Sidebar ═══ */}
      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        {/* Cost Summary */}
        <Card className="shadow-sm border-primary/30 bg-gradient-to-b from-primary/5 to-transparent">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10 text-primary"><Calculator className="w-4 h-4" /></div>
              <h3 className="font-semibold text-foreground text-sm">ملخص التكلفة</h3>
            </div>
            <div className="space-y-2 mb-4">
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">الإجمالي الشامل</p>
                <p className="text-2xl font-bold text-primary">{calc.grandTotal.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">ريال</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-muted/80 text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5">إجمالي التكلفة</p>
                  <p className="text-base font-bold text-foreground">{calc.totalCost.toFixed(2)}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/80 text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5">سعر القطعة</p>
                  <p className="text-base font-bold text-foreground">{calc.pricePerPiece.toFixed(4)}</p>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-muted/50 text-center">
                <p className="text-[10px] text-muted-foreground">التشطيبات الإضافية</p>
                <p className="text-sm font-semibold">{calc.totalFinishing.toFixed(2)} ريال</p>
              </div>
            </div>
            <ProfitMargins grandTotal={calc.grandTotal} quantity={inp.quantity} />
            <Button className="w-full mt-4 gap-2" onClick={handleSendToQuote}>
              <FileText className="w-4 h-4" />
              إرسال لعرض السعر
            </Button>
          </CardContent>
        </Card>

        {/* Detailed Breakdown */}
        <Card className="shadow-sm border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10 text-primary"><Sparkles className="w-4 h-4" /></div>
              <h3 className="font-semibold text-foreground text-sm">تفاصيل الحساب</h3>
            </div>
            <div className="space-y-1">
              <DetailRow label="مساحة ورقة الشراء" value={`${calc.purchaseArea.toFixed(4)} م²`} />
              <DetailRow label="وزن ورقة الشراء" value={`${calc.purchaseWeight.toFixed(2)} جم`} />
              <DetailRow label="وحدة التسعير" value={inp.pricingUnit === 'ream' ? 'رزمة' : 'طن'} highlight />
              {inp.pricingUnit === 'ream' && (
                <DetailRow label="ورق الرزمة" value={`${inp.sheetsPerReam} ورقة`} />
              )}
              {inp.pricingUnit !== 'ream' && (
                <DetailRow label="سعر الجرام" value={`${calc.pricePerGram.toFixed(6)} ريال`} />
              )}
              <DetailRow label="سعر ورقة الشراء" value={`${calc.pricePerSheet.toFixed(4)} ريال`} />
              <div className="border-t border-border/50 my-1.5" />
              <DetailRow label="طباعة من ورقة شراء" value={`${calc.printSheetsPerPurchase} ورقة`} />
              <DetailRow label="أوراق قبل الهدر" value={calc.printSheetsBeforeWaste.toString()} />
              <DetailRow label="أوراق بعد الهدر" value={calc.printSheetsAfterWaste.toString()} />
              <DetailRow label="ورقات شراء مطلوبة" value={calc.purchaseSheetsNeeded.toString()} />
              <div className="border-t border-border/50 my-1.5" />
              <DetailRow label="عدد الآلاف" value={`${calc.thousands} ألف`} />
              <div className="border-t border-border/50 my-1.5" />
              <DetailRow label="قيمة الورق" value={`${calc.paperCost.toFixed(2)} ريال`} />
              <DetailRow label="قيمة الفرز" value={`${calc.sortCost.toFixed(2)} ريال`} />
              <DetailRow label="قيمة الطباعة" value={`${calc.printCost.toFixed(2)} ريال`} />
              <DetailRow label="قيمة السلفان" value={`${calc.cellophaneCost.toFixed(2)} ريال`} />
              <DetailRow label="قيمة التكسير" value={`${calc.dieCutCost.toFixed(2)} ريال`} />
            </div>
          </CardContent>
        </Card>
      </div>
      <AlertDialog open={showMissingItemInfo} onOpenChange={setShowMissingItemInfo}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              بيانات الصنف ناقصة
            </AlertDialogTitle>
            <AlertDialogDescription>
              لم يتم إدخال: {getMissingFields().join('، ')}. هل تريد الاستمرار بدون هذه البيانات؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:gap-0">
            <AlertDialogCancel>العودة للتعديل</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowMissingItemInfo(false); doSendToQuote(); }}>
              استمرار
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ManualPricing;

const DetailRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className="flex items-center justify-between py-1 px-2 rounded text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className={`font-mono ${highlight ? 'text-primary font-semibold' : 'font-medium'}`}>{value}</span>
  </div>
);
