import { useState, useEffect } from 'react';
import { usePrintingStore, useCalculations } from '@/store/printingStore';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ColorCountSelect from '@/components/ColorCountSelect';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, FileText, Ruler, Layers, Palette, Sparkles, Calculator, FileText as QuoteIcon } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import ProfitMargins from '@/components/ProfitMargins';
import { toast } from 'sonner';

const emptyBorder = 'border-destructive/50 ring-1 ring-destructive/30';

const SectionHeader = ({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="p-2 rounded-lg bg-primary/10 text-primary">
      <Icon className="w-4 h-4" />
    </div>
    <div>
      <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  </div>
);

import ItemInfoCard, { ItemInfo, validateItemInfo } from '@/components/ItemInfoCard';
import { usePreviewSettings } from '@/hooks/usePreviewSettings';

const PricingCalculator = ({ onNavigateToQuote }: { onNavigateToQuote?: () => void }) => {
  const { showNestingPreview, show3DPreview } = usePreviewSettings();

  const { inputs, setInputs, paperTypes, setUnifiedQuote, setQuoteInfo, editingQuoteData, setEditingQuoteData } = usePrintingStore();
  const calc = useCalculations();
  const [itemInfo, setItemInfo] = useState<ItemInfo>(() => {
    if (editingQuoteData?.sourceType === 'calculator') {
      return { itemName: editingQuoteData.itemName || '', itemNumber: editingQuoteData.itemNumber || '', itemSize: editingQuoteData.itemSize || '' };
    }
    return { itemName: '', itemNumber: '', itemSize: '' };
  });
  const [showItemValidation, setShowItemValidation] = useState(false);
  const [showMissingItemInfo, setShowMissingItemInfo] = useState(false);

  // Load editing data when editingQuoteData changes
  useEffect(() => {
    if (editingQuoteData?.sourceType === 'calculator') {
      setItemInfo({ itemName: editingQuoteData.itemName || '', itemNumber: editingQuoteData.itemNumber || '', itemSize: editingQuoteData.itemSize || '' });
      if (editingQuoteData.rawInputs) {
        setInputs(editingQuoteData.rawInputs);
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
      sourceType: 'calculator',
      sourceLabel: 'حاسبة التسعير',
      quantity: inputs.quantity,
      details: [
        { label: 'نوع الورق', value: inputs.paperType || '—' },
        { label: 'مقاس الشراء', value: inputs.purchaseSize || '—' },
        { label: 'الجرامية', value: inputs.grammage?.toString() || '—' },
        { label: 'عدد القطع', value: inputs.quantity.toString() },
        { label: 'عرض الطباعة (سم)', value: inputs.printWidth.toString() },
        { label: 'طول الطباعة (سم)', value: inputs.printHeight.toString() },
        { label: 'عدد الألوان', value: inputs.colorCount.toString() },
        { label: 'عدد الأوجه', value: inputs.printedFaces.toString() },
        { label: 'الوجهان مختلفان؟', value: inputs.facesDifferent ? 'نعم' : 'لا' },
        { label: 'أوجه السلفان', value: inputs.cellophaneFaces.toString() },
        { label: 'تكسير / قالب؟', value: inputs.dieCut ? 'نعم' : 'لا' },
        { label: 'نسبة الهدر %', value: inputs.wastePercent.toString() },
        { label: 'قيمة القالب', value: inputs.moldPrice.toString() },
        { label: 'كم تفصل في الشيت', value: inputs.cutsPerSheet.toString() },
      ],
      costBreakdown: [
        { label: 'الورق', value: calc.paperCost },
        { label: 'الفرز', value: calc.sortCost },
        { label: 'الطباعة', value: calc.printCost },
        ...(calc.extraColorCost > 0 ? [{ label: 'ألوان إضافية', value: calc.extraColorCost }] : []),
        { label: 'السلفان', value: calc.cellophaneCost },
        { label: 'التكسير', value: calc.dieCutCost },
      ],
      totalCost: calc.totalCost,
      totalFinishing: calc.totalFinishing,
      grandTotal: calc.grandTotal,
      pricePerPiece: calc.pricePerPiece,
      pieceLabel: 'قطعة',
      rawInputs: { ...inputs },
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

  const handlePaperTypeChange = (val: string) => {
    setInputs({ paperType: val, purchaseSize: '', grammage: null });
  };

  const handleGrammageChange = (val: string) => {
    setInputs({ grammage: Number(val), purchaseSize: '' });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ===== Column 1: Inputs ===== */}
        <div className="lg:col-span-2 space-y-4">
          <ItemInfoCard value={itemInfo} onChange={setItemInfo} showValidation={showItemValidation} />
          {/* Paper Selection */}
          <Card className="shadow-sm border-border/60">
            <CardContent className="pt-5 pb-4">
              <SectionHeader icon={FileText} title="اختيار الورق" subtitle="حدد نوع الورق والجرامية والمقاس" />
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">نوع الورق</Label>
                  <Select value={inputs.paperType || undefined} onValueChange={handlePaperTypeChange}>
                    <SelectTrigger className={`h-9 ${!inputs.paperType ? emptyBorder : ''}`}>
                      <SelectValue placeholder="اختر" />
                    </SelectTrigger>
                    <SelectContent>
                      {paperTypes.map((t) => (
                        <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">الجرامية</Label>
                  <Select
                    value={inputs.grammage?.toString() || ''}
                    onValueChange={handleGrammageChange}
                    disabled={!inputs.paperType}
                  >
                    <SelectTrigger className={`h-9 ${!inputs.grammage ? emptyBorder : ''}`}>
                      <SelectValue placeholder="GSM" />
                    </SelectTrigger>
                    <SelectContent>
                      {calc.availableGrammages.map((g) => (
                        <SelectItem key={g} value={g.toString()}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">مقاس الشراء</Label>
                  <Select
                    value={inputs.purchaseSize || undefined}
                    onValueChange={(val) => setInputs({ purchaseSize: val })}
                    disabled={!inputs.grammage}
                  >
                    <SelectTrigger className={`h-9 ${!inputs.purchaseSize ? emptyBorder : ''}`}>
                      <SelectValue placeholder="المقاس" />
                    </SelectTrigger>
                    <SelectContent>
                      {calc.availableSizes.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Auto paper info */}
              {inputs.purchaseSize && (
                <div className="mt-3 flex gap-3 text-xs">
                  <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground">
                    أبعاد الشراء: {calc.purchaseWidth}×{calc.purchaseHeight} سم
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground">
                    {calc.pricingUnit === 'ream' ? `سعر الرزمة: ${calc.pricePerReam} ريال` : `سعر الطن: ${calc.pricePerTon} ريال`}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Print Dimensions & Quantity */}
          <Card className="shadow-sm border-border/60">
            <CardContent className="pt-5 pb-4">
              <SectionHeader icon={Ruler} title="أبعاد الطباعة والكمية" />
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">عرض الطباعة (سم)</Label>
                  <Input
                    type="number"
                    className={`h-9 ${!inputs.printWidth ? emptyBorder : ''}`}
                    value={inputs.printWidth}
                    onChange={(e) => setInputs({ printWidth: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">طول الطباعة (سم)</Label>
                  <Input
                    type="number"
                    className={`h-9 ${!inputs.printHeight ? emptyBorder : ''}`}
                    value={inputs.printHeight}
                    onChange={(e) => setInputs({ printHeight: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">عدد القطع</Label>
                  <Input
                    type="number"
                    className={`h-9 ${!inputs.quantity ? emptyBorder : ''}`}
                    value={inputs.quantity}
                    onChange={(e) => setInputs({ quantity: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">تفصيل بالشيت</Label>
                  <Input
                    type="number"
                    className={`h-9 ${!inputs.cutsPerSheet ? emptyBorder : ''}`}
                    value={inputs.cutsPerSheet}
                    onChange={(e) => setInputs({ cutsPerSheet: Number(e.target.value) })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Print Options */}
          <Card className="shadow-sm border-border/60">
            <CardContent className="pt-5 pb-4">
              <SectionHeader icon={Palette} title="خيارات الطباعة" subtitle="الألوان والأوجه والهدر" />
              <div className="grid grid-cols-3 gap-3">
                <ColorCountSelect
                  colorCount={inputs.colorCount}
                  onColorCountChange={(val) => setInputs({ colorCount: val })}
                  extraColorConfig={{ extraColorCalcType: inputs.extraColorCalcType, extraColorPrice: inputs.extraColorPrice, extraColorExtra1000: inputs.extraColorExtra1000, extraColorCount: inputs.extraColorCount || 1 }}
                  onExtraColorChange={(cfg) => setInputs(cfg as any)}
                />
                {inputs.colorCount > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">الأوجه المطبوعة</Label>
                    <Select
                      value={inputs.printedFaces.toString()}
                      onValueChange={(val) => setInputs({ printedFaces: Number(val) })}
                    >
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">وجه واحد</SelectItem>
                        <SelectItem value="2">وجهان</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs">نسبة الهدر %</Label>
                  <Input
                    type="number"
                    className={`h-9 ${!inputs.wastePercent ? emptyBorder : ''}`}
                    value={inputs.wastePercent}
                    onChange={(e) => setInputs({ wastePercent: Number(e.target.value) })}
                  />
                </div>
              </div>
              {/* Toggle options */}
              <div className="mt-3 flex flex-wrap gap-4">
                {inputs.colorCount > 0 && inputs.printedFaces === 2 && (
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Switch
                      checked={inputs.facesDifferent}
                      onCheckedChange={(val) => setInputs({ facesDifferent: val })}
                    />
                    <span>الوجهان مختلفان</span>
                  </label>
                )}
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Switch
                    checked={inputs.dieCut}
                    onCheckedChange={(val) => setInputs({ dieCut: val })}
                  />
                  <span>تكسير / قالب خاص</span>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Finishing & Extras */}
          <Card className="shadow-sm border-border/60">
            <CardContent className="pt-5 pb-4">
              <SectionHeader icon={Layers} title="السلفان والقالب" />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">أوجه السلفان</Label>
                  <Select
                    value={inputs.cellophaneFaces.toString()}
                    onValueChange={(val) => setInputs({ cellophaneFaces: Number(val) })}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">بدون</SelectItem>
                      <SelectItem value="1">وجه واحد</SelectItem>
                      <SelectItem value="2">وجهان</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">قيمة القالب (ريال)</Label>
                  <Input
                    type="number"
                    className="h-9"
                    value={inputs.moldPrice}
                    onChange={(e) => setInputs({ moldPrice: Number(e.target.value) })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {calc.validationMessage && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="text-sm">{calc.validationMessage}</span>
            </div>
          )}
        </div>

        {/* ===== Column 2: Results ===== */}
        <div className="space-y-4">
          {/* Summary Cards */}
          <Card className="shadow-sm border-primary/30 bg-gradient-to-b from-primary/5 to-transparent">
            <CardContent className="pt-5 pb-4">
              <SectionHeader icon={Calculator} title="ملخص التكلفة" />
              
              {/* Main totals */}
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

              {/* Profit Margins */}
              <ProfitMargins grandTotal={calc.grandTotal} quantity={inputs.quantity} />

              <Button
                className="w-full mt-4 gap-2"
                onClick={handleSendToQuote}
              >
                <FileText className="w-4 h-4" />
                إرسال لعرض السعر
              </Button>
            </CardContent>
          </Card>

          {/* Detailed Breakdown */}
          <Card className="shadow-sm border-border/60">
            <CardContent className="pt-5 pb-4">
              <SectionHeader icon={Sparkles} title="تفاصيل الحساب" />
              <div className="space-y-1">
                <DetailRow label="مساحة ورقة الشراء" value={`${calc.purchaseArea.toFixed(4)} م²`} />
                <DetailRow label="وزن ورقة الشراء" value={`${calc.purchaseWeight.toFixed(2)} جم`} />
                <DetailRow label="وحدة التسعير" value={calc.pricingUnit === 'ream' ? 'رزمة' : 'طن'} highlight />
                {calc.pricingUnit === 'ream' && (
                  <DetailRow label="ورق الرزمة" value={`${calc.sheetsPerReam} ورقة`} />
                )}
                {calc.pricingUnit !== 'ream' && (
                  <DetailRow label="سعر الجرام" value={`${calc.pricePerGram.toFixed(6)} ريال`} />
                )}
                <DetailRow label="سعر ورقة الشراء" value={`${calc.pricePerSheet.toFixed(4)} ريال`} />
                <div className="border-t border-border/50 my-1.5" />
                <DetailRow label="طباعة من ورقة شراء" value={`${calc.printSheetsPerPurchase} ورقة`} />
                <DetailRow label="أوراق قبل الهدر" value={calc.printSheetsBeforeWaste.toString()} />
                <DetailRow label="أوراق بعد الهدر" value={calc.printSheetsAfterWaste.toString()} />
                <DetailRow label="ورقات شراء مطلوبة" value={calc.purchaseSheetsNeeded.toString()} />
                <div className="border-t border-border/50 my-1.5" />
                <DetailRow label="مقاس الطباعة" value={calc.printSizeType} highlight />
                <DetailRow label="عدد الآلاف" value={`${calc.thousands} ألف`} />
                <div className="border-t border-border/50 my-1.5" />
                <DetailRow label="قيمة الورق" value={`${calc.paperCost.toFixed(2)} ريال`} />
                <DetailRow label="قيمة الفرز" value={`${calc.sortCost.toFixed(2)} ريال`} />
                <DetailRow label="قيمة الطباعة" value={`${calc.printCost.toFixed(2)} ريال`} />
                {calc.extraColorCost > 0 && (
                  <DetailRow label="ألوان إضافية" value={`${calc.extraColorCost.toFixed(2)} ريال`} />
                )}
                <DetailRow label="قيمة السلفان" value={`${calc.cellophaneCost.toFixed(2)} ريال`} />
                <DetailRow label="قيمة التكسير" value={`${calc.dieCutCost.toFixed(2)} ريال`} />
              </div>
            </CardContent>
          </Card>
        </div>
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

const DetailRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className="flex items-center justify-between py-1 px-2 rounded text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className={`font-mono ${highlight ? 'text-primary font-semibold' : 'font-medium'}`}>{value}</span>
  </div>
);

export default PricingCalculator;
