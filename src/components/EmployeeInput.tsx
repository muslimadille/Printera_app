import { usePrintingStore, useCalculations } from '@/store/printingStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ColorCountSelect from '@/components/ColorCountSelect';
import { Switch } from '@/components/ui/switch';
import { FileText, Settings, Calculator, Layers, AlertCircle, Sparkles } from 'lucide-react';
import ProfitMargins from '@/components/ProfitMargins';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/* ── Tiny helpers ── */
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
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

import ItemInfoCard, { ItemInfo, validateItemInfo } from '@/components/ItemInfoCard';
import VoiceInput from '@/components/VoiceInput';
import { useState, useEffect } from 'react';

const EmployeeInput = ({ onNavigateToQuote }: { onNavigateToQuote?: () => void }) => {
  const { inputs, setInputs, paperTypes, setUnifiedQuote, setQuoteInfo, editingQuoteData, setEditingQuoteData } = usePrintingStore();
  const [itemInfo, setItemInfo] = useState<ItemInfo>(() => {
    if (editingQuoteData?.sourceType === 'employee') {
      return { itemName: editingQuoteData.itemName || '', itemNumber: editingQuoteData.itemNumber || '', itemSize: editingQuoteData.itemSize || '' };
    }
    return { itemName: '', itemNumber: '', itemSize: '' };
  });
  const [showItemValidation, setShowItemValidation] = useState(false);
  const [showMissingItemInfo, setShowMissingItemInfo] = useState(false);
  const calc = useCalculations();

  // Load editing data when editingQuoteData changes
  useEffect(() => {
    if (editingQuoteData?.sourceType === 'employee') {
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
      sourceType: 'employee',
      sourceLabel: 'إدخال الموظف',
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
        { label: 'أوجه السلفان', value: inputs.cellophaneFaces.toString() },
        { label: 'تكسير / قالب؟', value: inputs.dieCut ? 'نعم' : 'لا' },
        { label: 'نسبة الهدر %', value: inputs.wastePercent.toString() },
        { label: 'كم تفصل في الشيت', value: inputs.cutsPerSheet.toString() },
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* ═══ Main Inputs ═══ */}
      <div className="lg:col-span-2 space-y-4">
        <ItemInfoCard value={itemInfo} onChange={setItemInfo} showValidation={showItemValidation} />
        <VoiceInput
          calcType="employee"
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
            const inputUpdates: any = {};
            if (rest.paperType) inputUpdates.paperType = rest.paperType;
            if (rest.grammage) inputUpdates.grammage = Number(rest.grammage);
            if (rest.printWidth) inputUpdates.printWidth = Number(rest.printWidth);
            if (rest.printHeight) inputUpdates.printHeight = Number(rest.printHeight);
            if (rest.quantity) inputUpdates.quantity = Number(rest.quantity);
            if (rest.cutsPerSheet) inputUpdates.cutsPerSheet = Number(rest.cutsPerSheet);
            if (rest.wastePercent !== undefined) inputUpdates.wastePercent = Number(rest.wastePercent);
            if (rest.colorCount) inputUpdates.colorCount = Number(rest.colorCount);
            if (rest.printedFaces) inputUpdates.printedFaces = Number(rest.printedFaces);
            if (rest.cellophaneFaces !== undefined) inputUpdates.cellophaneFaces = Number(rest.cellophaneFaces);
            if (rest.dieCut !== undefined) inputUpdates.dieCut = Boolean(rest.dieCut);
            if (rest.moldPrice) inputUpdates.moldPrice = Number(rest.moldPrice);
            if (Object.keys(inputUpdates).length > 0) setInputs(inputUpdates);
          }}
        />

        {/* Paper Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              بيانات الورق
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="نوع الورق">
                <Select value={inputs.paperType} onValueChange={(val) => setInputs({ paperType: val, purchaseSize: '', grammage: null })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="اختيار" /></SelectTrigger>
                  <SelectContent>
                    {paperTypes.map((t) => (
                      <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="الجرامية (GSM)">
                <Select
                  value={inputs.grammage?.toString() || ''}
                  onValueChange={(val) => setInputs({ grammage: Number(val), purchaseSize: '' })}
                  disabled={!inputs.paperType}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="اختيار" /></SelectTrigger>
                  <SelectContent>
                    {calc.availableGrammages.map((g) => (
                      <SelectItem key={g} value={g.toString()}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="مقاس ورق الشراء">
                <Select
                  value={inputs.purchaseSize}
                  onValueChange={(val) => setInputs({ purchaseSize: val })}
                  disabled={!inputs.grammage}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="اختيار" /></SelectTrigger>
                  <SelectContent>
                    {calc.availableSizes.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Input type="number" value={inputs.printWidth} onChange={(e) => setInputs({ printWidth: Number(e.target.value) })} className="h-9 text-sm" />
              </Field>
              <Field label="طول ورقة الطباعة (سم)">
                <Input type="number" value={inputs.printHeight} onChange={(e) => setInputs({ printHeight: Number(e.target.value) })} className="h-9 text-sm" />
              </Field>
              <Field label="عدد القطع المطلوبة">
                <Input type="number" value={inputs.quantity} onChange={(e) => setInputs({ quantity: Number(e.target.value) })} className="h-9 text-sm" />
              </Field>
              <Field label="كم تفصل في الشيت">
                <Input type="number" value={inputs.cutsPerSheet} onChange={(e) => setInputs({ cutsPerSheet: Number(e.target.value) })} className="h-9 text-sm" />
              </Field>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="نسبة الهدر (%)">
                <Input type="number" value={inputs.wastePercent} onChange={(e) => setInputs({ wastePercent: Number(e.target.value) })} className="h-9 text-sm" />
              </Field>
              <ColorCountSelect
                colorCount={inputs.colorCount}
                onColorCountChange={(val) => setInputs({ colorCount: val })}
                extraColorConfig={{ extraColorCalcType: inputs.extraColorCalcType, extraColorPrice: inputs.extraColorPrice, extraColorExtra1000: inputs.extraColorExtra1000, extraColorCount: inputs.extraColorCount || 1 }}
                onExtraColorChange={(cfg) => setInputs(cfg as any)}
                label="عدد الألوان"
                triggerClassName="h-9 text-sm"
              />
              <Field label="عدد الأوجه المطبوعة">
                <Select value={inputs.printedFaces.toString()} onValueChange={(val) => setInputs({ printedFaces: Number(val) })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - وجه واحد</SelectItem>
                    <SelectItem value="2">2 - وجهان</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="عدد أوجه السلفان">
                <Select value={inputs.cellophaneFaces.toString()} onValueChange={(val) => setInputs({ cellophaneFaces: Number(val) })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 - بدون</SelectItem>
                    <SelectItem value="1">1 - وجه</SelectItem>
                    <SelectItem value="2">2 - وجهان</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="قيمة القالب (ريال)">
                <Input type="number" value={inputs.moldPrice} onChange={(e) => setInputs({ moldPrice: Number(e.target.value) })} className="h-9 text-sm" />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-6 pt-1">
              <div className="flex items-center gap-2">
                <Switch checked={inputs.facesDifferent} onCheckedChange={(val) => setInputs({ facesDifferent: val })} disabled={inputs.printedFaces !== 2} />
                <Label className="text-xs">الوجهان مختلفان؟</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={inputs.dieCut} onCheckedChange={(val) => setInputs({ dieCut: val })} />
                <Label className="text-xs">التكسير / قالب خاص</Label>
              </div>
            </div>
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
            <ProfitMargins grandTotal={calc.grandTotal} quantity={inputs.quantity} />
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
              <StatChip label="الكمية" value={inputs.quantity.toLocaleString()} />
              <StatChip label="عدد الآلاف" value={calc.thousands?.toString() || '0'} />
              <StatChip label="تفصيل شيت الطباعة من شيت الشراء" value={calc.printSheetsPerPurchase?.toString() || '0'} />
              <StatChip label="تفصيل شيت الطباعة للكمية المطلوبة" value={calc.printSheetsBeforeWaste?.toString() || '0'} />
              <StatChip label="أوراق بعد الهدر" value={calc.printSheetsAfterWaste?.toString() || '0'} />
              <StatChip label="عدد شيتات الشراء" value={calc.purchaseSheetsNeeded?.toString() || '0'} />
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

export default EmployeeInput;
