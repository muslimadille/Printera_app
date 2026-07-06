import { usePrintingStore, useMagazineCalculations, type MagazineSectionInputs, type MagazineFinishingItem } from '@/store/printingStore';
import ColorCountSelect from '@/components/ColorCountSelect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, BookOpen, Layers, Image, Calculator, FileText, Sparkles, AlertCircle } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { calcTypeLabels } from '@/lib/calcTypeLabels';
import ProfitMargins from '@/components/ProfitMargins';
import { toast } from 'sonner';

const emptyBorder = 'border-destructive/50 ring-1 ring-destructive/30';

import ItemInfoCard, { ItemInfo, validateItemInfo } from '@/components/ItemInfoCard';
import VoiceInput from '@/components/VoiceInput';
import { useState, useEffect } from 'react';

const MagazineCalculator = ({ onNavigateToQuote }: { onNavigateToQuote?: () => void }) => {
  const { magazineInputs: mag, setMagazineInputs, setMagazineSection, paperTypes, updateMagazineFinishingItem, addMagazineFinishingItem, removeMagazineFinishingItem, setUnifiedQuote, setQuoteInfo, editingQuoteData, setEditingQuoteData } = usePrintingStore();
  const calc = useMagazineCalculations();
  const [itemInfo, setItemInfo] = useState<ItemInfo>(() => {
    if (editingQuoteData?.sourceType === 'magazine') {
      return { itemName: editingQuoteData.itemName || '', itemNumber: editingQuoteData.itemNumber || '', itemSize: editingQuoteData.itemSize || '' };
    }
    return { itemName: '', itemNumber: '', itemSize: '' };
  });
  const [showItemValidation, setShowItemValidation] = useState(false);
  const [showMissingItemInfo, setShowMissingItemInfo] = useState(false);

  // Load editing data when editingQuoteData changes
  useEffect(() => {
    if (editingQuoteData?.sourceType === 'magazine') {
      setItemInfo({ itemName: editingQuoteData.itemName || '', itemNumber: editingQuoteData.itemNumber || '', itemSize: editingQuoteData.itemSize || '' });
      if (editingQuoteData.rawInputs) {
        setMagazineInputs(editingQuoteData.rawInputs);
      }
      setEditingQuoteData(null);
    }
  }, [editingQuoteData]);

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
      sourceType: 'magazine',
      sourceLabel: 'حاسبة المجلات',
      quantity: mag.quantity,
      details: [
        { label: 'عدد النسخ', value: mag.quantity.toString() },
        { label: 'عدد الصفحات', value: mag.totalPages.toString() },
        { label: 'صفحات في الشيت', value: mag.pagesPerSheet.toString() },
        { label: 'ورق الداخلي', value: mag.inner.paperType || '—' },
        { label: 'جرامية الداخلي', value: mag.inner.grammage?.toString() || '—' },
        { label: 'ورق الغلاف', value: mag.cover.paperType || '—' },
        { label: 'جرامية الغلاف', value: mag.cover.grammage?.toString() || '—' },
      ],
      costBreakdown: [
        { label: 'الداخلي', value: calc.innerTotal },
        { label: 'الغلاف', value: calc.coverTotal },
        { label: 'التجميع', value: calc.assemblyCost },
      ],
      totalCost: calc.innerTotal + calc.coverTotal,
      totalFinishing: calc.totalInnerFinishing + calc.totalCoverFinishing,
      grandTotal: calc.magazineTotal,
      pricePerPiece: calc.pricePerCopy,
      pieceLabel: 'نسخة',
      rawInputs: { ...mag },
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
      {/* Main Content - 2 columns */}
      <div className="lg:col-span-2 space-y-4">
        <ItemInfoCard value={itemInfo} onChange={setItemInfo} showValidation={showItemValidation} />
        <VoiceInput
          calcType="magazine"
          paperTypeNames={paperTypes.map(t => t.name)}
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
            const magUpdates: any = {};
            if (rest.quantity) magUpdates.quantity = Number(rest.quantity);
            if (rest.totalPages) magUpdates.totalPages = Number(rest.totalPages);
            if (rest.pagesPerSheet) magUpdates.pagesPerSheet = Number(rest.pagesPerSheet);
            if (Object.keys(magUpdates).length > 0) setMagazineInputs(magUpdates);
            if (rest.inner) {
              const innerU: any = {};
              if (rest.inner.paperType) innerU.paperType = rest.inner.paperType;
              if (rest.inner.grammage) innerU.grammage = Number(rest.inner.grammage);
              if (rest.inner.colorCount) innerU.colorCount = Number(rest.inner.colorCount);
              if (Object.keys(innerU).length > 0) setMagazineSection('inner', innerU);
            }
            if (rest.cover) {
              const coverU: any = {};
              if (rest.cover.paperType) coverU.paperType = rest.cover.paperType;
              if (rest.cover.grammage) coverU.grammage = Number(rest.cover.grammage);
              if (rest.cover.colorCount) coverU.colorCount = Number(rest.cover.colorCount);
              if (rest.cover.cellophaneFaces !== undefined) coverU.cellophaneFaces = Number(rest.cover.cellophaneFaces);
              if (Object.keys(coverU).length > 0) setMagazineSection('cover', coverU);
            }
          }}
        />
        {/* General Inputs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              بيانات المجلة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <FieldInput label="عدد النسخ" value={mag.quantity} onChange={(v) => setMagazineInputs({ quantity: v })} required />
              <FieldInput label="عدد الصفحات" value={mag.totalPages} onChange={(v) => setMagazineInputs({ totalPages: v })} required />
              <FieldInput label="صفحات في الشيت" value={mag.pagesPerSheet} onChange={(v) => setMagazineInputs({ pagesPerSheet: v })} required />
              <FieldInput label="قطع بالشيت (داخلي)" value={mag.cutsPerSheetInner} onChange={(v) => setMagazineInputs({ cutsPerSheetInner: v })} required />
              <FieldInput label="قطع بالشيت (غلاف)" value={mag.cutsPerSheetCover} onChange={(v) => setMagazineInputs({ cutsPerSheetCover: v })} required />
              <FieldInput label="تجميع / ألف" value={mag.assemblyCostPer1000} onChange={(v) => setMagazineInputs({ assemblyCostPer1000: v })} required />
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
              <StatChip label="ورقات/مجلة" value={calc.sheetsPerMagazine} />
              <StatChip label="قطع داخلي" value={calc.totalInnerPieces} />
              <StatChip label="شيتات داخلي" value={calc.innerSheetsBeforeWaste} />
              <StatChip label="شيتات غلاف" value={calc.coverSheetsBeforeWaste} />
              <StatChip label="آلاف مرجعية" value={calc.referenceThousands} />
              <StatChip label="تكلفة تجميع" value={calc.assemblyCost.toFixed(0)} suffix="﷼" />
            </div>
          </CardContent>
        </Card>

        {/* Inner Section */}
        <SectionCard
          title="الداخلي"
          icon={<Layers className="h-5 w-5 text-primary" />}
          section={mag.inner}
          paperTypes={paperTypes}
          onUpdate={(u) => setMagazineSection('inner', u)}
          results={calc.inner}
          finishingItems={mag.innerFinishing}
          finishingCosts={calc.innerFinishingCosts}
          totalFinishing={calc.totalInnerFinishing}
          totalSection={calc.innerTotal}
          onUpdateFinishing={(i, u) => updateMagazineFinishingItem('inner', i, u)}
          onAddFinishing={(item) => addMagazineFinishingItem('inner', item)}
          onRemoveFinishing={(i) => removeMagazineFinishingItem('inner', i)}
        />

        {/* Cover Section */}
        <SectionCard
          title="الغلاف"
          icon={<Image className="h-5 w-5 text-primary" />}
          section={mag.cover}
          paperTypes={paperTypes}
          onUpdate={(u) => setMagazineSection('cover', u)}
          results={calc.cover}
          finishingItems={mag.coverFinishing}
          finishingCosts={calc.coverFinishingCosts}
          totalFinishing={calc.totalCoverFinishing}
          totalSection={calc.coverTotal}
          onUpdateFinishing={(i, u) => updateMagazineFinishingItem('cover', i, u)}
          onAddFinishing={(item) => addMagazineFinishingItem('cover', item)}
          onRemoveFinishing={(i) => removeMagazineFinishingItem('cover', i)}
        />
      </div>

      {/* Sidebar - Results */}
      <div className="space-y-4">
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
                <p className="text-2xl font-bold text-primary">{calc.magazineTotal.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">ريال</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-muted/80 text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5">إجمالي التكلفة</p>
                  <p className="text-base font-bold text-foreground">{(calc.innerTotal + calc.coverTotal).toFixed(2)}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/80 text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5">سعر النسخة</p>
                  <p className="text-base font-bold text-foreground">{calc.pricePerCopy.toFixed(4)}</p>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-muted/50 text-center">
                <p className="text-[10px] text-muted-foreground">التشطيبات الإضافية</p>
                <p className="text-sm font-semibold">{(calc.totalInnerFinishing + calc.totalCoverFinishing).toFixed(2)} ريال</p>
              </div>
            </div>
            <ProfitMargins grandTotal={calc.magazineTotal} quantity={mag.quantity} pieceLabel="سعر النسخة" />
            <Button className="w-full mt-4 gap-2" onClick={handleSendToQuote}>
              <FileText className="w-4 h-4" />
              إرسال لعرض السعر
            </Button>
          </CardContent>
        </Card>

        {/* Cost Breakdown */}
        <Card className="shadow-sm border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10 text-primary"><Sparkles className="w-4 h-4" /></div>
              <h3 className="font-semibold text-foreground text-sm">تفاصيل التكلفة</h3>
            </div>
            <div className="space-y-1">
              <CostRow label="الداخلي" value={calc.innerTotal.toFixed(2)} />
              <CostRow label="الغلاف" value={calc.coverTotal.toFixed(2)} />
              <CostRow label="التجميع" value={calc.assemblyCost.toFixed(2)} />
              <div className="border-t pt-2 mt-2">
                <CostRow label="الإجمالي" value={calc.magazineTotal.toFixed(2)} bold />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Breakdown - Inner */}
        <Card className="shadow-sm border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10 text-primary"><Sparkles className="w-4 h-4" /></div>
              <h3 className="font-semibold text-foreground text-sm">تفاصيل الحساب — الداخلي</h3>
            </div>
            <div className="space-y-1">
              <DetailRow label="مساحة ورقة الشراء" value={`${calc.inner.purchaseArea.toFixed(4)} م²`} />
              <DetailRow label="وزن ورقة الشراء" value={`${calc.inner.purchaseWeight.toFixed(2)} جم`} />
              <DetailRow label="وحدة التسعير" value={calc.inner.pricingUnit === 'ream' ? 'رزمة' : 'طن'} highlight />
              {calc.inner.pricingUnit === 'ream' && (
                <DetailRow label="ورق الرزمة" value={`${calc.inner.sheetsPerReam} ورقة`} />
              )}
              {calc.inner.pricingUnit !== 'ream' && (
                <DetailRow label="سعر الجرام" value={`${calc.inner.pricePerGram.toFixed(6)} ريال`} />
              )}
              <DetailRow label="سعر ورقة الشراء" value={`${calc.inner.pricePerSheet.toFixed(4)} ريال`} />
              <div className="border-t border-border/50 my-1.5" />
              <DetailRow label="طباعة من ورقة شراء" value={`${calc.inner.printSheetsPerPurchase} ورقة`} />
              <DetailRow label="أوراق قبل الهدر" value={calc.innerSheetsBeforeWaste.toString()} />
              <DetailRow label="أوراق بعد الهدر" value={calc.inner.sheetsAfterWaste.toString()} />
              <DetailRow label="ورقات شراء مطلوبة" value={calc.inner.purchaseSheetsNeeded.toString()} />
              <div className="border-t border-border/50 my-1.5" />
              <DetailRow label="مقاس الطباعة" value={calc.inner.sizeType} highlight />
              <DetailRow label="عدد الآلاف" value={`${calc.inner.thousands} ألف`} />
              <div className="border-t border-border/50 my-1.5" />
              <DetailRow label="قيمة الورق" value={`${calc.inner.paperCost.toFixed(2)} ريال`} />
              <DetailRow label="قيمة الفرز" value={`${calc.inner.sortCost.toFixed(2)} ريال`} />
              <DetailRow label="قيمة الطباعة" value={`${calc.inner.printCost.toFixed(2)} ريال`} />
              {calc.inner.extraColorCost > 0 && <DetailRow label="ألوان إضافية" value={`${calc.inner.extraColorCost.toFixed(2)} ريال`} />}
              <DetailRow label="قيمة السلفان" value={`${calc.inner.cellophaneCost.toFixed(2)} ريال`} />
              <DetailRow label="قيمة التكسير" value={`${calc.inner.dieCutCost.toFixed(2)} ريال`} />
            </div>
          </CardContent>
        </Card>

        {/* Detailed Breakdown - Cover */}
        <Card className="shadow-sm border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10 text-primary"><Sparkles className="w-4 h-4" /></div>
              <h3 className="font-semibold text-foreground text-sm">تفاصيل الحساب — الغلاف</h3>
            </div>
            <div className="space-y-1">
              <DetailRow label="مساحة ورقة الشراء" value={`${calc.cover.purchaseArea.toFixed(4)} م²`} />
              <DetailRow label="وزن ورقة الشراء" value={`${calc.cover.purchaseWeight.toFixed(2)} جم`} />
              <DetailRow label="وحدة التسعير" value={calc.cover.pricingUnit === 'ream' ? 'رزمة' : 'طن'} highlight />
              {calc.cover.pricingUnit === 'ream' && (
                <DetailRow label="ورق الرزمة" value={`${calc.cover.sheetsPerReam} ورقة`} />
              )}
              {calc.cover.pricingUnit !== 'ream' && (
                <DetailRow label="سعر الجرام" value={`${calc.cover.pricePerGram.toFixed(6)} ريال`} />
              )}
              <DetailRow label="سعر ورقة الشراء" value={`${calc.cover.pricePerSheet.toFixed(4)} ريال`} />
              <div className="border-t border-border/50 my-1.5" />
              <DetailRow label="طباعة من ورقة شراء" value={`${calc.cover.printSheetsPerPurchase} ورقة`} />
              <DetailRow label="أوراق قبل الهدر" value={calc.coverSheetsBeforeWaste.toString()} />
              <DetailRow label="أوراق بعد الهدر" value={`${calc.cover.sheetsAfterWaste}`} />
              <DetailRow label="ورقات شراء مطلوبة" value={calc.cover.purchaseSheetsNeeded.toString()} />
              <div className="border-t border-border/50 my-1.5" />
              <DetailRow label="مقاس الطباعة" value={calc.cover.sizeType} highlight />
              <DetailRow label="عدد الآلاف" value={`${calc.cover.thousands} ألف`} />
              <div className="border-t border-border/50 my-1.5" />
              <DetailRow label="قيمة الورق" value={`${calc.cover.paperCost.toFixed(2)} ريال`} />
              <DetailRow label="قيمة الفرز" value={`${calc.cover.sortCost.toFixed(2)} ريال`} />
              <DetailRow label="قيمة الطباعة" value={`${calc.cover.printCost.toFixed(2)} ريال`} />
              {calc.cover.extraColorCost > 0 && <DetailRow label="ألوان إضافية" value={`${calc.cover.extraColorCost.toFixed(2)} ريال`} />}
              <DetailRow label="قيمة السلفان" value={`${calc.cover.cellophaneCost.toFixed(2)} ريال`} />
              <DetailRow label="قيمة التكسير" value={`${calc.cover.dieCutCost.toFixed(2)} ريال`} />
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

/* ─── Section Card (Inner / Cover) ─── */
interface SectionCardProps {
  title: string;
  icon: React.ReactNode;
  section: MagazineSectionInputs;
  paperTypes: { name: string; entries: { grammage: number; sizeName: string }[] }[];
  onUpdate: (u: Partial<MagazineSectionInputs>) => void;
  results: ReturnType<typeof useMagazineCalculations>['inner'];
  finishingItems: MagazineFinishingItem[];
  finishingCosts: number[];
  totalFinishing: number;
  totalSection: number;
  onUpdateFinishing: (i: number, u: Partial<MagazineFinishingItem>) => void;
  onAddFinishing: (item: MagazineFinishingItem) => void;
  onRemoveFinishing: (i: number) => void;
}

const SectionCard = ({ title, icon, section, paperTypes, onUpdate, results, finishingItems, finishingCosts, totalFinishing, totalSection, onUpdateFinishing, onAddFinishing, onRemoveFinishing }: SectionCardProps) => {
  const handlePaperTypeChange = (val: string) => onUpdate({ paperType: val, purchaseSize: '', grammage: null });
  const handleGrammageChange = (val: string) => onUpdate({ grammage: Number(val), purchaseSize: '' });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Paper Selection */}
        <div className="p-3 rounded-lg bg-muted/40 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">بيانات الورق</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">نوع الورق</Label>
              <Select value={section.paperType} onValueChange={handlePaperTypeChange}>
                <SelectTrigger className={`h-9 text-xs ${!section.paperType ? emptyBorder : ''}`}><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  {paperTypes.map((t) => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">الجرامية</Label>
              <Select value={section.grammage?.toString() || ''} onValueChange={handleGrammageChange} disabled={!section.paperType}>
                <SelectTrigger className={`h-9 text-xs ${!section.grammage ? emptyBorder : ''}`}><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  {results.availableGrammages.map((g) => <SelectItem key={g} value={g.toString()}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">مقاس الشراء</Label>
              <Select value={section.purchaseSize} onValueChange={(val) => onUpdate({ purchaseSize: val })} disabled={!section.grammage}>
                <SelectTrigger className={`h-9 text-xs ${!section.purchaseSize ? emptyBorder : ''}`}><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  {results.availableSizes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">{results.pricingUnit === 'ream' ? 'سعر الرزمة' : 'سعر الطن'}</Label>
              <Input className="h-9 text-xs bg-muted" value={results.pricingUnit === 'ream' ? (results.pricePerReam || '—') : (results.pricePerTon || '—')} disabled />
            </div>
            {results.pricingUnit === 'ream' && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">ورق/رزمة</Label>
                <Input className="h-9 text-xs bg-muted" value={results.sheetsPerReam} disabled />
              </div>
            )}
          </div>
        </div>

        {/* Dimensions & Print Options */}
        <div className="p-3 rounded-lg bg-muted/40 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">الطباعة والمقاسات</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">عرض ورقة الطباعة</Label>
              <Input className={`h-9 text-xs ${!section.printWidth ? emptyBorder : ''}`} type="number" value={section.printWidth} onChange={(e) => onUpdate({ printWidth: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">طول ورقة الطباعة</Label>
              <Input className={`h-9 text-xs ${!section.printHeight ? emptyBorder : ''}`} type="number" value={section.printHeight} onChange={(e) => onUpdate({ printHeight: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">نسبة الهدر %</Label>
              <Input className={`h-9 text-xs ${!section.wastePercent ? emptyBorder : ''}`} type="number" value={section.wastePercent} onChange={(e) => onUpdate({ wastePercent: Number(e.target.value) })} />
            </div>
            <ColorCountSelect
              colorCount={section.colorCount}
              onColorCountChange={(val) => onUpdate({ colorCount: val })}
              extraColorConfig={{ extraColorCalcType: section.extraColorCalcType, extraColorPrice: section.extraColorPrice, extraColorExtra1000: section.extraColorExtra1000, extraColorCount: section.extraColorCount || 1 }}
              onExtraColorChange={(cfg) => onUpdate(cfg as any)}
              label="عدد الألوان"
              triggerClassName="h-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            {section.colorCount > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">الأوجه المطبوعة</Label>
                <Select value={section.printedFaces.toString()} onValueChange={(val) => onUpdate({ printedFaces: Number(val) })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">وجه واحد</SelectItem>
                    <SelectItem value="2">وجهان</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2 h-9">
              <Switch checked={section.facesDifferent} onCheckedChange={(val) => onUpdate({ facesDifferent: val })} disabled={section.printedFaces !== 2} />
              <Label className="text-xs">وجهان مختلفان</Label>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">أوجه السلفان</Label>
              <Select value={section.cellophaneFaces.toString()} onValueChange={(val) => onUpdate({ cellophaneFaces: Number(val) })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">بدون</SelectItem>
                  <SelectItem value="1">وجه</SelectItem>
                  <SelectItem value="2">وجهان</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 h-9">
              <Switch checked={section.dieCut} onCheckedChange={(val) => onUpdate({ dieCut: val })} />
              <Label className="text-xs">تكسير</Label>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">قيمة القالب</Label>
              <Input className={`h-9 text-xs`} type="number" value={section.moldPrice} onChange={(e) => onUpdate({ moldPrice: Number(e.target.value) })} />
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          <StatChip label="ورق الطباعة" value={results.printSheetsPerPurchase} />
          <StatChip label="بعد الهدر" value={results.sheetsAfterWaste} />
          <StatChip label="ورق شراء" value={results.purchaseSheetsNeeded} />
          <StatChip label="نوع المقاس" value={results.sizeType} />
          <StatChip label="آلاف طباعة" value={results.thousands} />
        </div>

        {/* Cost Breakdown */}
        <div className="grid grid-cols-5 gap-2">
          <MiniCost label="ورق" value={results.paperCost} />
          <MiniCost label="فرز" value={results.sortCost} />
          <MiniCost label="طباعة" value={results.printCost} />
          <MiniCost label="سلفان" value={results.cellophaneCost} />
          <MiniCost label="تكسير" value={results.dieCutCost} />
        </div>

        {/* Finishing Services */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">تشطيبات إضافية</p>
          {finishingItems.map((item, idx) => (
            <div key={idx} className={`rounded-lg border p-3 transition-all ${item.enabled ? 'bg-primary/5 border-primary/30' : 'bg-muted/30'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Input className="h-8 text-xs font-semibold flex-1 bg-background" value={item.name} onChange={(e) => onUpdateFinishing(idx, { name: e.target.value })} />
                <Switch checked={item.enabled} onCheckedChange={(val) => onUpdateFinishing(idx, { enabled: val })} />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => onRemoveFinishing(idx)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground block mb-0.5">نوع الحساب</Label>
                  <Select value={item.calcType} onValueChange={(val) => onUpdateFinishing(idx, { calcType: val as MagazineFinishingItem['calcType'] })}>
                    <SelectTrigger className="h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(calcTypeLabels).map(([key, val]) => (
                        <SelectItem key={key} value={key}>{val.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground block mb-0.5">عدد المتغيرات</Label>
                  <Input className="h-8 text-xs bg-background" type="number" value={item.multiplier} onChange={(e) => onUpdateFinishing(idx, { multiplier: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground block mb-0.5">سعر الوحدة</Label>
                  <Input className="h-8 text-xs bg-background" type="number" value={item.pricePerUnit} onChange={(e) => onUpdateFinishing(idx, { pricePerUnit: Number(e.target.value) })} />
                </div>
                {item.calcType === 'tiered_1000' && (
                  <div>
                    <Label className="text-[10px] text-muted-foreground block mb-0.5">ألف إضافي</Label>
                    <Input className="h-8 text-xs bg-background" type="number" value={item.extraPer1000} onChange={(e) => onUpdateFinishing(idx, { extraPer1000: Number(e.target.value) })} />
                  </div>
                )}
              </div>
              {item.enabled && (
                <div className="flex justify-end mt-2">
                  <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{finishingCosts[idx]?.toFixed(2)} ﷼</span>
                </div>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full border-dashed text-xs" onClick={() => onAddFinishing({ name: 'خدمة جديدة', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0 })}>
            <Plus className="h-3.5 w-3.5 ml-1" /> إضافة خدمة
          </Button>
        </div>

        {/* Section Total */}
        <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 flex justify-between items-center">
          <span className="font-bold text-primary text-sm">إجمالي {title}</span>
          <span className="text-lg font-bold text-primary">{totalSection.toFixed(2)} ريال</span>
        </div>
      </CardContent>
    </Card>
  );
};

/* ─── Helper Components ─── */
const FieldInput = ({ label, value, onChange, required }: { label: string; value: number; onChange: (v: number) => void; required?: boolean }) => (
  <div>
    <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
    <Input type="number" className={`h-9 text-sm ${required && !value ? emptyBorder : ''}`} value={value} onChange={(e) => onChange(Number(e.target.value))} />
  </div>
);

const StatChip = ({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) => (
  <div className="bg-muted/60 rounded-lg p-2 text-center">
    <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
    <p className="text-sm font-bold text-foreground">{value}{suffix && <span className="text-[10px] mr-0.5">{suffix}</span>}</p>
  </div>
);

const MiniCost = ({ label, value }: { label: string; value: number }) => (
  <div className="bg-card rounded-lg border p-2 text-center">
    <p className="text-[10px] text-muted-foreground">{label}</p>
    <p className="text-xs font-bold font-mono">{value.toFixed(0)}</p>
  </div>
);

const CostRow = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
  <div className={`flex justify-between items-center py-1.5 ${bold ? 'font-bold text-primary' : ''}`}>
    <span className="text-sm">{label}</span>
    <span className="text-sm font-mono">{value} ﷼</span>
  </div>
);

export default MagazineCalculator;

const DetailRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className="flex items-center justify-between py-1 px-2 rounded text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className={`font-mono ${highlight ? 'text-primary font-semibold' : 'font-medium'}`}>{value}</span>
  </div>
);
