import { useState, useMemo, useEffect } from 'react';
import { usePrintingStore, PaperType, SizePricing, getColorPricing, type ExtraColorConfig, calcExtraColorCost } from '@/store/printingStore';
import ColorCountSelect from '@/components/ColorCountSelect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Box, Plus, Trash2, Package, Layers, Calculator, FileText, Sparkles, AlertCircle } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { calcTypeLabels } from '@/lib/calcTypeLabels';
import ProfitMargins from '@/components/ProfitMargins';
import { toast } from 'sonner';

interface PieceInputs extends ExtraColorConfig {
  id: string;
  name: string;
  paperType: string;
  grammage: number | null;
  purchaseSize: string;
  printWidth: number;
  printHeight: number;
  cutsPerSheet: number;
  wastePercent: number;
  colorCount: number;
  printedFaces: number;
  facesDifferent: boolean;
  cellophaneFaces: number;
  dieCut: boolean;
  moldPrice: number;
}

interface BoxFinishingItem {
  name: string;
  enabled: boolean;
  calcType: 'per_piece' | 'per_1000' | 'tiered_1000' | 'flat';
  pricePerUnit: number;
  extraPer1000: number;
}

const defaultPiece = (id: string, name: string): PieceInputs => ({
  id, name,
  paperType: '', grammage: null, purchaseSize: '',
  printWidth: 50, printHeight: 70,
  cutsPerSheet: 1, wastePercent: 0,
  colorCount: 4, printedFaces: 1, facesDifferent: false,
  cellophaneFaces: 0, dieCut: false, moldPrice: 0,
  extraColorCalcType: 'per_1000', extraColorPrice: 0, extraColorExtra1000: 0, extraColorCount: 1,
});

const defaultFinishing: BoxFinishingItem[] = [
  { name: 'ورنيش', enabled: false, calcType: 'per_piece', pricePerUnit: 0, extraPer1000: 0 },
  { name: 'يوفي', enabled: false, calcType: 'per_piece', pricePerUnit: 0, extraPer1000: 0 },
  { name: 'فويل', enabled: false, calcType: 'per_1000', pricePerUnit: 0, extraPer1000: 0 },
  { name: 'بصمة', enabled: false, calcType: 'per_1000', pricePerUnit: 0, extraPer1000: 0 },
  { name: 'لصق', enabled: false, calcType: 'per_piece', pricePerUnit: 0, extraPer1000: 0 },
  { name: 'تجميع', enabled: false, calcType: 'per_piece', pricePerUnit: 0, extraPer1000: 0 },
];

const emptyBorder = 'border-destructive/50 ring-1 ring-destructive/30';

function findSizePricing(sizes: SizePricing[], pw: number, ph: number) {
  return sizes.find(s => (s.width === pw && s.height === ph) || (s.width === ph && s.height === pw));
}

function calcPiece(piece: PieceInputs, quantity: number, paperTypes: PaperType[], sizes: SizePricing[]) {
  const selectedType = paperTypes.find(t => t.name === piece.paperType);
  const selectedEntry = selectedType?.entries.find(
    e => e.sizeName === piece.purchaseSize && e.grammage === piece.grammage
  );

  const purchaseW = selectedEntry?.width || 0;
  const purchaseH = selectedEntry?.height || 0;
  const pricePerTon = selectedEntry?.pricePerTon || 0;
  const pricingUnit = selectedEntry?.pricingUnit || 'ton';
  const pricePerReam = selectedEntry?.pricePerReam || 0;
  const sheetsPerReam = selectedEntry?.sheetsPerReam || 500;

  const availableGrammages = selectedType
    ? [...new Set(selectedType.entries.map(e => e.grammage))] : [];
  const availableSizes = selectedType
    ? [...new Set(selectedType.entries.filter(e => piece.grammage === null || e.grammage === piece.grammage).map(e => e.sizeName))] : [];

  const purchaseArea = (purchaseW / 100) * (purchaseH / 100);
  const purchaseWeight = purchaseArea * (piece.grammage || 0);
  const pricePerGram = pricePerTon / 1000000;
  const pricePerSheet = pricingUnit === 'ream' && sheetsPerReam > 0
    ? pricePerReam / sheetsPerReam
    : purchaseWeight * pricePerGram;

  const pw = piece.printWidth;
  const ph = piece.printHeight;
  const opt1 = pw ? Math.floor(purchaseW / pw) * Math.floor(purchaseH / ph) : 0;
  const opt2 = ph ? Math.floor(purchaseW / ph) * Math.floor(purchaseH / pw) : 0;
  const printSheetsPerPurchase = Math.max(opt1, opt2);

  const sheetsBeforeWaste = piece.cutsPerSheet > 0 ? Math.ceil(quantity / piece.cutsPerSheet) : 0;
  const sheetsAfterWaste = Math.ceil(sheetsBeforeWaste * (1 + piece.wastePercent / 100));
  const purchaseSheetsNeeded = printSheetsPerPurchase === 0 ? 0 : Math.ceil(sheetsAfterWaste / printSheetsPerPurchase);

  const paperCost = pricePerSheet * purchaseSheetsNeeded;
  const matchedSize = findSizePricing(sizes, pw, ph);
  const sizeType = matchedSize ? matchedSize.sizeName : 'غير معتمد';
  const thousands = Math.max(1, Math.ceil(sheetsAfterWaste / 1000));

  const effectiveColorCount = piece.colorCount >= 5 ? 4 : piece.colorCount;

  let sortCost = 0;
  if (matchedSize && effectiveColorCount > 0) {
    const cp = getColorPricing(matchedSize, effectiveColorCount);
    if (cp) {
      sortCost = piece.printedFaces === 2 && piece.facesDifferent
        ? cp.sortPerFace * 2
        : cp.sortPerFace;
    }
  }

  let printCost = 0;
  if (matchedSize && effectiveColorCount > 0) {
    const cp = getColorPricing(matchedSize, effectiveColorCount);
    if (cp) {
      printCost = piece.printedFaces * (cp.printFirst1000PerFace + Math.max(0, thousands - 1) * cp.printExtra1000PerFace);
    }
  }

  let extraColorCost = 0;
  if (piece.colorCount >= 5 && piece.extraColorPrice > 0) {
    extraColorCost = calcExtraColorCost(piece, quantity, thousands);
  }

  let cellophaneCost = 0;
  if (matchedSize) {
    cellophaneCost = sheetsAfterWaste * piece.cellophaneFaces * matchedSize.cellophanePerFace;
  }

  let dieCutCost = 0;
  if (piece.dieCut && matchedSize) {
    dieCutCost = matchedSize.diecut1st1000 + Math.max(0, thousands - 1) * matchedSize.diecutExtra1000;
  }

  const totalCost = paperCost + sortCost + printCost + extraColorCost + cellophaneCost + dieCutCost + piece.moldPrice;

  return {
    purchaseW, purchaseH, pricePerTon, purchaseArea, purchaseWeight, pricePerGram,
    pricePerSheet, printSheetsPerPurchase, sheetsBeforeWaste,
    sheetsAfterWaste, purchaseSheetsNeeded, paperCost,
    sizeType, thousands, sortCost, printCost, extraColorCost, cellophaneCost, dieCutCost,
    totalCost, availableGrammages, availableSizes,
    pricingUnit, pricePerReam, sheetsPerReam,
  };
}

import ItemInfoCard, { ItemInfo, validateItemInfo } from '@/components/ItemInfoCard';
import VoiceInput from '@/components/VoiceInput';
import { usePreviewSettings } from '@/hooks/usePreviewSettings';

const BoxPricingCalculator = ({ onNavigateToQuote }: { onNavigateToQuote?: () => void }) => {
  const { showNestingPreview, show3DPreview } = usePreviewSettings();

  const { paperTypes, priceSettings, setUnifiedQuote, setQuoteInfo, editingQuoteData, setEditingQuoteData } = usePrintingStore();
  const [itemInfo, setItemInfo] = useState<ItemInfo>(() => {
    if (editingQuoteData?.sourceType === 'boxpricing') {
      return { itemName: editingQuoteData.itemName || '', itemNumber: editingQuoteData.itemNumber || '', itemSize: editingQuoteData.itemSize || '' };
    }
    return { itemName: '', itemNumber: '', itemSize: '' };
  });
  const [showItemValidation, setShowItemValidation] = useState(false);

  const [quantity, setQuantity] = useState(() => {
    if (editingQuoteData?.sourceType === 'boxpricing' && editingQuoteData.rawInputs) return editingQuoteData.rawInputs.quantity || 1000;
    return 1000;
  });
  const [mainPiece, setMainPiece] = useState<PieceInputs>(() => {
    if (editingQuoteData?.sourceType === 'boxpricing' && editingQuoteData.rawInputs?.mainPiece) return editingQuoteData.rawInputs.mainPiece;
    return defaultPiece('main', 'القطعة الرئيسية');
  });
  const [extraPieces, setExtraPieces] = useState<PieceInputs[]>(() => {
    if (editingQuoteData?.sourceType === 'boxpricing' && editingQuoteData.rawInputs?.extraPieces) return editingQuoteData.rawInputs.extraPieces;
    return [];
  });
  const [finishing, setFinishing] = useState<BoxFinishingItem[]>(() => {
    if (editingQuoteData?.sourceType === 'boxpricing' && editingQuoteData.rawInputs?.finishing) return editingQuoteData.rawInputs.finishing;
    return defaultFinishing;
  });

  // Load editing data when editingQuoteData changes
  useEffect(() => {
    if (editingQuoteData?.sourceType === 'boxpricing') {
      setItemInfo({ itemName: editingQuoteData.itemName || '', itemNumber: editingQuoteData.itemNumber || '', itemSize: editingQuoteData.itemSize || '' });
      if (editingQuoteData.rawInputs) {
        setQuantity(editingQuoteData.rawInputs.quantity || 1000);
        if (editingQuoteData.rawInputs.mainPiece) setMainPiece(editingQuoteData.rawInputs.mainPiece);
        if (editingQuoteData.rawInputs.extraPieces) setExtraPieces(editingQuoteData.rawInputs.extraPieces);
        if (editingQuoteData.rawInputs.finishing) setFinishing(editingQuoteData.rawInputs.finishing);
      }
      setEditingQuoteData(null);
    }
  }, [editingQuoteData]);

  const mainCalc = useMemo(() => calcPiece(mainPiece, quantity, paperTypes, priceSettings.sizes), [mainPiece, quantity, paperTypes, priceSettings.sizes]);
  const extraCalcs = useMemo(() => extraPieces.map(p => ({
    piece: p,
    calc: calcPiece(p, quantity, paperTypes, priceSettings.sizes),
  })), [extraPieces, quantity, paperTypes, priceSettings.sizes]);

  const finishingTotal = useMemo(() => {
    const mainThousands = mainCalc.thousands;
    return finishing.reduce((sum, item) => {
      if (!item.enabled || !item.pricePerUnit) return sum;
      switch (item.calcType) {
        case 'per_piece': return sum + quantity * item.pricePerUnit;
        case 'per_1000': return sum + mainThousands * item.pricePerUnit;
        case 'tiered_1000': return sum + (item.pricePerUnit + Math.max(mainThousands - 1, 0) * item.extraPer1000);
        case 'flat': return sum + item.pricePerUnit;
        default: return sum;
      }
    }, 0);
  }, [finishing, quantity, mainCalc.thousands]);

  const extraTotal = extraCalcs.reduce((s, e) => s + e.calc.totalCost, 0);
  const grandTotal = mainCalc.totalCost + extraTotal + finishingTotal;
  const pricePerBox = quantity > 0 ? grandTotal / quantity : 0;

  const addExtraPiece = () => {
    const id = crypto.randomUUID();
    setExtraPieces(prev => [...prev, defaultPiece(id, `قطعة إضافية ${prev.length + 1}`)]);
  };

  const updateExtra = (id: string, updates: Partial<PieceInputs>) => {
    setExtraPieces(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const removeExtra = (id: string) => {
    setExtraPieces(prev => prev.filter(p => p.id !== id));
  };

  const updatePiece = (updates: Partial<PieceInputs>) => {
    setMainPiece(prev => ({ ...prev, ...updates }));
  };

  const updateFinishing = (index: number, updates: Partial<BoxFinishingItem>) => {
    setFinishing(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
  };

  const getMissingFields = () => {
    const m: string[] = [];
    if (!itemInfo.itemName.trim()) m.push('اسم الصنف');
    if (!itemInfo.itemNumber.trim()) m.push('رقم الصنف');
    if (!itemInfo.itemSize.trim()) m.push('مقاس الصنف');
    return m;
  };
  const [showMissingItemInfo, setShowMissingItemInfo] = useState(false);

  const doSendToQuote = () => {
    setQuoteInfo({ itemName: itemInfo.itemName, itemNumber: itemInfo.itemNumber, itemSize: itemInfo.itemSize });
    const details = [
      { label: 'الكمية المطلوبة', value: quantity.toString() },
      { label: 'ورق القطعة الرئيسية', value: mainPiece.paperType || '—' },
      { label: 'جرامية القطعة الرئيسية', value: mainPiece.grammage?.toString() || '—' },
      { label: 'مقاس الشراء', value: mainPiece.purchaseSize || '—' },
      { label: 'عدد القطع الإضافية', value: extraPieces.length.toString() },
    ];
    const costBreakdown = [
      { label: 'القطعة الرئيسية', value: mainCalc.totalCost },
      ...extraCalcs.map(e => ({ label: e.piece.name, value: e.calc.totalCost })),
      { label: 'التشطيبات', value: finishingTotal },
    ];
    setUnifiedQuote({
      sourceType: 'boxpricing',
      sourceLabel: 'العلب والأكياس',
      quantity,
      details,
      costBreakdown,
      totalCost: mainCalc.totalCost + extraTotal,
      totalFinishing: finishingTotal,
      grandTotal,
      pricePerPiece: pricePerBox,
      pieceLabel: 'قطعة',
      rawInputs: { quantity, mainPiece, extraPieces, finishing },
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
      {/* Main Content */}
      <div className="lg:col-span-2 space-y-4">
        <ItemInfoCard value={itemInfo} onChange={setItemInfo} showValidation={showItemValidation} />
        <VoiceInput
          calcType="box"
          paperTypeNames={paperTypes.map(t => t.name)}
          onFieldsParsed={(fields) => {
            const { itemName, itemNumber, itemSize, quantity: qty, ...rest } = fields;
            if (itemName || itemNumber || itemSize) {
              setItemInfo(prev => ({
                ...prev,
                ...(itemName && { itemName }),
                ...(itemNumber && { itemNumber }),
                ...(itemSize && { itemSize }),
              }));
            }
            if (qty) setQuantity(Number(qty));
            if (rest.pieces?.[0] || rest.paperType || rest.grammage) {
              const piece = rest.pieces?.[0] || rest;
              const updates: any = {};
              if (piece.paperType) updates.paperType = piece.paperType;
              if (piece.grammage) updates.grammage = Number(piece.grammage);
              if (piece.printWidth) updates.printWidth = Number(piece.printWidth);
              if (piece.printHeight) updates.printHeight = Number(piece.printHeight);
              if (piece.cutsPerSheet) updates.cutsPerSheet = Number(piece.cutsPerSheet);
              if (piece.colorCount) updates.colorCount = Number(piece.colorCount);
              if (piece.printedFaces) updates.printedFaces = Number(piece.printedFaces);
              if (piece.cellophaneFaces !== undefined) updates.cellophaneFaces = Number(piece.cellophaneFaces);
              if (piece.dieCut !== undefined) updates.dieCut = Boolean(piece.dieCut);
              if (Object.keys(updates).length > 0) updatePiece(updates);
            }
          }}
        />
        {/* Quantity Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Box className="h-5 w-5 text-primary" />
              <Label className="text-sm font-semibold whitespace-nowrap">الكمية المطلوبة</Label>
              <Input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} className={`max-w-[160px] h-9 ${!quantity ? emptyBorder : ''}`} />
              <span className="text-xs text-muted-foreground">علبة</span>
            </div>
          </CardContent>
        </Card>

        {/* Main Piece */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              القطعة الرئيسية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PieceFields
              piece={mainPiece}
              calc={mainCalc}
              paperTypes={paperTypes}
              onUpdate={updatePiece}
              onPaperTypeChange={(val) => updatePiece({ paperType: val, purchaseSize: '', grammage: null })}
              onGrammageChange={(val) => updatePiece({ grammage: Number(val), purchaseSize: '' })}
            />
          </CardContent>
        </Card>

        {/* Extra Pieces */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                القطع الإضافية
              </CardTitle>
              <Button variant="outline" size="sm" className="border-dashed gap-1" onClick={addExtraPiece}>
                <Plus className="w-4 h-4" /> إضافة قطعة
              </Button>
            </div>
          </CardHeader>
          {extraPieces.length > 0 && (
            <CardContent className="space-y-4">
              {extraPieces.map((piece) => {
                const ec = extraCalcs.find(e => e.piece.id === piece.id);
                return (
                  <div key={piece.id} className="rounded-xl border p-4 space-y-3 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Input value={piece.name} onChange={e => updateExtra(piece.id, { name: e.target.value })} className="h-9 font-semibold flex-1 bg-background" />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive" onClick={() => removeExtra(piece.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <PieceFields
                      piece={piece}
                      calc={ec?.calc}
                      paperTypes={paperTypes}
                      onUpdate={(u) => updateExtra(piece.id, u)}
                      onPaperTypeChange={(val) => updateExtra(piece.id, { paperType: val, purchaseSize: '', grammage: null })}
                      onGrammageChange={(val) => updateExtra(piece.id, { grammage: Number(val), purchaseSize: '' })}
                    />
                    {ec && (
                      <div className="flex justify-end">
                        <span className="text-sm font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">{ec.calc.totalCost.toFixed(2)} ﷼</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          )}
        </Card>

        {/* Finishing */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="text-primary">✨</span>
              تشطيبات القطعة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {finishing.map((item, i) => (
              <div key={i} className={`rounded-xl border p-3 transition-all ${item.enabled ? 'bg-primary/5 border-primary/30' : 'bg-muted/30'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Input className="h-8 text-sm font-semibold flex-1 bg-background" value={item.name} onChange={e => updateFinishing(i, { name: e.target.value })} />
                  <Switch checked={item.enabled} onCheckedChange={val => updateFinishing(i, { enabled: val })} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground block mb-0.5">نوع الحساب</Label>
                    <Select value={item.calcType} onValueChange={val => updateFinishing(i, { calcType: val as any })}>
                      <SelectTrigger className="h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="per_piece">{calcTypeLabels.per_piece.label}</SelectItem>
                        <SelectItem value="per_1000">{calcTypeLabels.per_1000.label}</SelectItem>
                        <SelectItem value="tiered_1000">{calcTypeLabels.tiered_1000.label}</SelectItem>
                        <SelectItem value="flat">{calcTypeLabels.flat.label}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground block mb-0.5">السعر</Label>
                    <Input type="number" className="h-8 text-xs bg-background" value={item.pricePerUnit} onChange={e => updateFinishing(i, { pricePerUnit: Number(e.target.value) })} />
                  </div>
                  {(item.calcType === 'per_1000' || item.calcType === 'tiered_1000') && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground block mb-0.5">ألف إضافي</Label>
                      <Input type="number" className="h-8 text-xs bg-background" value={item.extraPer1000} onChange={e => updateFinishing(i, { extraPer1000: Number(e.target.value) })} />
                    </div>
                  )}
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full border-dashed text-xs" onClick={() => setFinishing(prev => [...prev, { name: 'خدمة جديدة', enabled: false, calcType: 'per_piece', pricePerUnit: 0, extraPer1000: 0 }])}>
              <Plus className="w-3.5 h-3.5 ml-1" /> إضافة خدمة
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
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
                <p className="text-2xl font-bold text-primary">{grandTotal.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">ريال</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-muted/80 text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5">تكلفة الإنتاج</p>
                  <p className="text-base font-bold text-foreground">{(grandTotal - finishingTotal).toFixed(2)}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/80 text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5">سعر القطعة</p>
                  <p className="text-base font-bold text-foreground">{pricePerBox.toFixed(4)}</p>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-muted/50 text-center">
                <p className="text-[10px] text-muted-foreground">التشطيبات الإضافية</p>
                <p className="text-sm font-semibold">{finishingTotal.toFixed(2)} ريال</p>
              </div>
            </div>
            <ProfitMargins grandTotal={grandTotal} quantity={quantity} pieceLabel="سعر القطعة" />
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
              <CostRow label="القطعة الرئيسية" value={mainCalc.totalCost.toFixed(2)} />
              {extraCalcs.map((e) => (
                <CostRow key={e.piece.id} label={e.piece.name} value={e.calc.totalCost.toFixed(2)} />
              ))}
              <CostRow label="التشطيبات" value={finishingTotal.toFixed(2)} />
              <div className="border-t pt-2 mt-2">
                <CostRow label="الإجمالي" value={grandTotal.toFixed(2)} bold />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Breakdown - Main Piece */}
        <Card className="shadow-sm border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10 text-primary"><Sparkles className="w-4 h-4" /></div>
              <h3 className="font-semibold text-foreground text-sm">تفاصيل الحساب — القطعة الرئيسية</h3>
            </div>
            <div className="space-y-1">
              <DetailRow label="مساحة ورقة الشراء" value={`${mainCalc.purchaseArea.toFixed(4)} م²`} />
              <DetailRow label="وزن ورقة الشراء" value={`${mainCalc.purchaseWeight.toFixed(2)} جم`} />
              <DetailRow label="وحدة التسعير" value={mainCalc.pricingUnit === 'ream' ? 'رزمة' : 'طن'} highlight />
              {mainCalc.pricingUnit === 'ream' && (
                <DetailRow label="ورق الرزمة" value={`${mainCalc.sheetsPerReam} ورقة`} />
              )}
              {mainCalc.pricingUnit !== 'ream' && (
                <DetailRow label="سعر الجرام" value={`${mainCalc.pricePerGram.toFixed(6)} ريال`} />
              )}
              <DetailRow label="سعر ورقة الشراء" value={`${mainCalc.pricePerSheet.toFixed(4)} ريال`} />
              <div className="border-t border-border/50 my-1.5" />
              <DetailRow label="طباعة من ورقة شراء" value={`${mainCalc.printSheetsPerPurchase} ورقة`} />
              <DetailRow label="أوراق قبل الهدر" value={mainCalc.sheetsBeforeWaste.toString()} />
              <DetailRow label="أوراق بعد الهدر" value={mainCalc.sheetsAfterWaste.toString()} />
              <DetailRow label="ورقات شراء مطلوبة" value={mainCalc.purchaseSheetsNeeded.toString()} />
              <div className="border-t border-border/50 my-1.5" />
              <DetailRow label="مقاس الطباعة" value={mainCalc.sizeType} highlight />
              <DetailRow label="عدد الآلاف" value={`${mainCalc.thousands} ألف`} />
              <div className="border-t border-border/50 my-1.5" />
              <DetailRow label="قيمة الورق" value={`${mainCalc.paperCost.toFixed(2)} ريال`} />
              <DetailRow label="قيمة الفرز" value={`${mainCalc.sortCost.toFixed(2)} ريال`} />
              <DetailRow label="قيمة الطباعة" value={`${mainCalc.printCost.toFixed(2)} ريال`} />
              {mainCalc.extraColorCost > 0 && <DetailRow label="ألوان إضافية" value={`${mainCalc.extraColorCost.toFixed(2)} ريال`} />}
              <DetailRow label="قيمة السلفان" value={`${mainCalc.cellophaneCost.toFixed(2)} ريال`} />
              <DetailRow label="قيمة التكسير" value={`${mainCalc.dieCutCost.toFixed(2)} ريال`} />
            </div>
          </CardContent>
        </Card>

        {/* Detailed Breakdown - Extra Pieces */}
        {extraCalcs.map((e) => (
          <Card key={e.piece.id} className="shadow-sm border-border/60">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10 text-primary"><Sparkles className="w-4 h-4" /></div>
                <h3 className="font-semibold text-foreground text-sm">تفاصيل الحساب — {e.piece.name}</h3>
              </div>
              <div className="space-y-1">
                <DetailRow label="مساحة ورقة الشراء" value={`${e.calc.purchaseArea.toFixed(4)} م²`} />
                <DetailRow label="وزن ورقة الشراء" value={`${e.calc.purchaseWeight.toFixed(2)} جم`} />
                <DetailRow label="وحدة التسعير" value={e.calc.pricingUnit === 'ream' ? 'رزمة' : 'طن'} highlight />
                {e.calc.pricingUnit === 'ream' && (
                  <DetailRow label="ورق الرزمة" value={`${e.calc.sheetsPerReam} ورقة`} />
                )}
                {e.calc.pricingUnit !== 'ream' && (
                  <DetailRow label="سعر الجرام" value={`${e.calc.pricePerGram.toFixed(6)} ريال`} />
                )}
                <DetailRow label="سعر ورقة الشراء" value={`${e.calc.pricePerSheet.toFixed(4)} ريال`} />
                <div className="border-t border-border/50 my-1.5" />
                <DetailRow label="طباعة من ورقة شراء" value={`${e.calc.printSheetsPerPurchase} ورقة`} />
                <DetailRow label="أوراق قبل الهدر" value={e.calc.sheetsBeforeWaste.toString()} />
                <DetailRow label="أوراق بعد الهدر" value={e.calc.sheetsAfterWaste.toString()} />
                <DetailRow label="ورقات شراء مطلوبة" value={e.calc.purchaseSheetsNeeded.toString()} />
                <div className="border-t border-border/50 my-1.5" />
                <DetailRow label="مقاس الطباعة" value={e.calc.sizeType} highlight />
                <DetailRow label="عدد الآلاف" value={`${e.calc.thousands} ألف`} />
                <div className="border-t border-border/50 my-1.5" />
                <DetailRow label="قيمة الورق" value={`${e.calc.paperCost.toFixed(2)} ريال`} />
                <DetailRow label="قيمة الفرز" value={`${e.calc.sortCost.toFixed(2)} ريال`} />
                <DetailRow label="قيمة الطباعة" value={`${e.calc.printCost.toFixed(2)} ريال`} />
                {e.calc.extraColorCost > 0 && <DetailRow label="ألوان إضافية" value={`${e.calc.extraColorCost.toFixed(2)} ريال`} />}
                <DetailRow label="قيمة السلفان" value={`${e.calc.cellophaneCost.toFixed(2)} ريال`} />
                <DetailRow label="قيمة التكسير" value={`${e.calc.dieCutCost.toFixed(2)} ريال`} />
              </div>
            </CardContent>
          </Card>
        ))}
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

/* ─── Piece Fields ─── */
const PieceFields = ({
  piece, calc, paperTypes, onUpdate, onPaperTypeChange, onGrammageChange,
}: {
  piece: PieceInputs;
  calc?: ReturnType<typeof calcPiece>;
  paperTypes: PaperType[];
  onUpdate: (u: Partial<PieceInputs>) => void;
  onPaperTypeChange: (v: string) => void;
  onGrammageChange: (v: string) => void;
}) => (
  <div className="space-y-4">
    {/* Paper Selection */}
    <div className="p-3 rounded-lg bg-muted/40 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground">بيانات الورق</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">نوع الورق</Label>
          <Select value={piece.paperType} onValueChange={onPaperTypeChange}>
            <SelectTrigger className={`h-9 text-xs ${!piece.paperType ? emptyBorder : ''}`}><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>
              {paperTypes.map(t => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">الجرامية</Label>
          <Select value={piece.grammage?.toString() || ''} onValueChange={onGrammageChange} disabled={!piece.paperType}>
            <SelectTrigger className={`h-9 text-xs ${!piece.grammage ? emptyBorder : ''}`}><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>
              {calc?.availableGrammages.map(g => <SelectItem key={g} value={g.toString()}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">مقاس الشراء</Label>
          <Select value={piece.purchaseSize} onValueChange={v => onUpdate({ purchaseSize: v })} disabled={!piece.grammage}>
            <SelectTrigger className={`h-9 text-xs ${!piece.purchaseSize ? emptyBorder : ''}`}><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>
              {calc?.availableSizes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">{calc?.pricingUnit === 'ream' ? 'سعر الرزمة' : 'سعر الطن'}</Label>
          <Input className="h-9 text-xs bg-muted" value={calc?.pricingUnit === 'ream' ? (calc?.pricePerReam || '—') : (calc?.pricePerTon || '—')} disabled />
        </div>
        {calc?.pricingUnit === 'ream' && (
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">ورق/رزمة</Label>
            <Input className="h-9 text-xs bg-muted" value={calc?.sheetsPerReam} disabled />
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
          <Input className="h-9 text-xs" type="number" value={piece.printWidth} onChange={e => onUpdate({ printWidth: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">طول ورقة الطباعة</Label>
          <Input className="h-9 text-xs" type="number" value={piece.printHeight} onChange={e => onUpdate({ printHeight: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">تفصل في الشيت</Label>
          <Input className="h-9 text-xs" type="number" value={piece.cutsPerSheet} onChange={e => onUpdate({ cutsPerSheet: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">نسبة الهدر %</Label>
          <Input className="h-9 text-xs" type="number" value={piece.wastePercent} onChange={e => onUpdate({ wastePercent: Number(e.target.value) })} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
        <ColorCountSelect
          colorCount={piece.colorCount}
          onColorCountChange={v => onUpdate({ colorCount: v })}
          extraColorConfig={{ extraColorCalcType: piece.extraColorCalcType, extraColorPrice: piece.extraColorPrice, extraColorExtra1000: piece.extraColorExtra1000, extraColorCount: piece.extraColorCount || 1 }}
          onExtraColorChange={(cfg) => onUpdate(cfg as any)}
          label="عدد الألوان"
          triggerClassName="h-9 text-xs"
        />
        {piece.colorCount > 0 && (
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">الأوجه المطبوعة</Label>
            <Select value={piece.printedFaces.toString()} onValueChange={v => onUpdate({ printedFaces: Number(v) })}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">وجه واحد</SelectItem>
                <SelectItem value="2">وجهان</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">أوجه السلفان</Label>
          <Select value={piece.cellophaneFaces.toString()} onValueChange={v => onUpdate({ cellophaneFaces: Number(v) })}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">بدون</SelectItem>
              <SelectItem value="1">وجه</SelectItem>
              <SelectItem value="2">وجهان</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 h-9">
          <Switch checked={piece.facesDifferent} onCheckedChange={v => onUpdate({ facesDifferent: v })} disabled={piece.printedFaces !== 2} />
          <Label className="text-xs">وجهان مختلفان</Label>
        </div>
        <div className="flex items-center gap-2 h-9">
          <Switch checked={piece.dieCut} onCheckedChange={v => onUpdate({ dieCut: v })} />
          <Label className="text-xs">تكسير</Label>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">قيمة القالب</Label>
          <Input className="h-9 text-xs" type="number" value={piece.moldPrice} onChange={e => onUpdate({ moldPrice: Number(e.target.value) })} />
        </div>
      </div>
    </div>
  </div>
);

/* ─── Cost Row ─── */
const CostRow = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
  <div className={`flex justify-between items-center py-1.5 ${bold ? 'font-bold text-primary' : ''}`}>
    <span className="text-sm">{label}</span>
    <span className="text-sm font-mono">{value} ﷼</span>
  </div>
);

export default BoxPricingCalculator;

const DetailRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className="flex items-center justify-between py-1 px-2 rounded text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className={`font-mono ${highlight ? 'text-primary font-semibold' : 'font-medium'}`}>{value}</span>
  </div>
);
