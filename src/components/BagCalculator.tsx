import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Trophy, ChevronDown, Settings2, Sparkles, Plus, Trash2 } from 'lucide-react';
import { usePrintingStore } from '@/store/printingStore';
import { calculateBag, type BagInputs } from '@/lib/bagCalcEngine';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { calcTypeLabels } from '@/lib/calcTypeLabels';
import { usePreviewSettings } from '@/hooks/usePreviewSettings';

interface BagFinishingItem {
  name: string;
  enabled: boolean;
  calcType: 'per_piece' | 'per_1000' | 'tiered_1000' | 'flat';
  multiplier: number;
  pricePerUnit: number;
  extraPer1000: number;
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 0 });

interface Props {
  onNavigateToQuote?: () => void;
  sessionToken?: string;
}

const BagCalculator = ({}: Props) => {
  const { showNestingPreview, show3DPreview } = usePreviewSettings();

  const { paperTypes, priceSettings } = usePrintingStore();

  const [width, setWidth] = useState(33);
  const [gusset, setGusset] = useState(14);
  const [height, setHeight] = useState(30);
  const [quantity, setQuantity] = useState(1000);
  const [colorCount, setColorCount] = useState(4);
  const [printedFaces, setPrintedFaces] = useState(1);

  // Combined paper key: "name|grammage|sizeName"
  const [paperKey, setPaperKey] = useState<string>('');
  const paperOptions = useMemo(() => {
    const list: { value: string; label: string; name: string; grammage: number; sizeName: string }[] = [];
    paperTypes.forEach(pt => {
      pt.entries.forEach(e => {
        list.push({
          value: `${pt.name}|${e.grammage}|${e.sizeName}`,
          label: `${pt.name} - ${e.grammage}جم - ${e.sizeName} (${e.width}×${e.height})`,
          name: pt.name, grammage: e.grammage, sizeName: e.sizeName,
        });
      });
    });
    return list;
  }, [paperTypes]);
  const paperPick = paperOptions.find(o => o.value === paperKey);
  const paperType = paperPick?.name || '';
  const purchaseSize = paperPick?.sizeName || '';
  const grammage = paperPick?.grammage ?? null;

  const [topFlap, setTopFlap] = useState(4);
  const [glueFlap, setGlueFlap] = useState(2.5);
  const defaultBase = useMemo(() => +(gusset / 2 + 2.5).toFixed(2), [gusset]);
  const [baseOverride, setBaseOverride] = useState<number | null>(null);
  const base = baseOverride ?? defaultBase;

  const [cellophane, setCellophane] = useState(true);
  const [diecut, setDiecut] = useState(true);
  const [moldPrice, setMoldPrice] = useState(250);
  const [otherFinishing, setOtherFinishing] = useState(0);
  const [wastePercent, setWastePercent] = useState(0);

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [finishingOpen, setFinishingOpen] = useState(false);
  const [extraFinishingOpen, setExtraFinishingOpen] = useState(true);
  const [allScenariosOpen, setAllScenariosOpen] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Finishing services (Magazine-style list)
  const [finishingList, setFinishingList] = useState<BagFinishingItem[]>([]);
  const updateFinishing = (i: number, u: Partial<BagFinishingItem>) =>
    setFinishingList(list => list.map((f, idx) => idx === i ? { ...f, ...u } : f));
  const addFinishing = () =>
    setFinishingList(list => [...list, { name: 'خدمة جديدة', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0 }]);
  const removeFinishing = (i: number) =>
    setFinishingList(list => list.filter((_, idx) => idx !== i));

  const inputs: BagInputs = {
    width, gusset, height, quantity,
    paperType, purchaseSize, grammage,
    colorCount, printedFaces,
    topFlap, base, glueFlap,
    cellophane, cellophaneFaces: 1,
    diecut, moldPrice, otherFinishing, wastePercent,
  };

  const result = useMemo(
    () => calculateBag(inputs, paperTypes, priceSettings),
    [inputs, paperTypes, priceSettings],
  );

  const best = result.bestIndex >= 0 ? result.scenarios[result.bestIndex] : null;
  const validScenarios = result.scenarios.filter(s => s.valid);

  const scenarioKey = (s: { machineLabel: string; method: string }) => `${s.machineLabel}|${s.method}`;
  const selectedFromUser = selectedKey
    ? result.scenarios.find(s => s.valid && scenarioKey(s) === selectedKey)
    : null;
  const selected = selectedFromUser || best;
  const isUserPicked = !!selectedFromUser && best && scenarioKey(selectedFromUser) !== scenarioKey(best);

  // Finishing computation (per-scenario based on its print-sheet thousands)
  const computeFinishingFor = (printSheets: number) => {
    const thousands = Math.max(1, Math.ceil(printSheets / 1000));
    const costs = finishingList.map(item => {
      if (!item.enabled) return 0;
      const m = item.multiplier || 1;
      switch (item.calcType) {
        case 'per_piece': return quantity * m * item.pricePerUnit;
        case 'per_1000': return thousands * m * item.pricePerUnit;
        case 'tiered_1000': return m * (item.pricePerUnit + Math.max(thousands - 1, 0) * item.extraPer1000);
        case 'flat': return m * item.pricePerUnit;
        default: return 0;
      }
    });
    return { costs, total: costs.reduce((a, b) => a + b, 0) };
  };
  const selectedFinishing = selected ? computeFinishingFor(selected.printSheets) : { costs: [], total: 0 };
  const finalTotal = (selected?.total || 0) + selectedFinishing.total;
  const finalPricePerBag = quantity > 0 ? finalTotal / quantity : 0;

  return (
    <div dir="rtl" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ── المدخلات (يمين في RTL) ── */}
      <div className="lg:col-span-2 space-y-4">
        <Card className="border-primary/20 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-lg bg-primary/10 text-primary"><ShoppingBag className="w-4 h-4" /></div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">حساب الأكياس</h3>
                <p className="text-[11px] text-muted-foreground">أدخل أبعاد الكيس واختر الورق — يولّد سيناريوهات على كل ماكينة.</p>
              </div>
            </div>

            {/* الصف الأول: عرض / جنب / ارتفاع */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <CompactField label="عرض الكيس W (سم)" value={width} onChange={setWidth} />
              <CompactField label="الجنب / العمق G (سم)" value={gusset} onChange={setGusset} />
              <CompactField label="ارتفاع الكيس H (سم)" value={height} onChange={setHeight} />
            </div>

            {/* الصف الثاني: الكمية / الألوان / نوع الورق */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <CompactField label="الكمية" value={quantity} onChange={setQuantity} step={100} />
              <div className="space-y-1">
                <Label className="text-xs">عدد الألوان</Label>
                <Select value={String(colorCount)} onValueChange={(v) => setColorCount(Number(v))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map(c => <SelectItem key={c} value={String(c)}>{c} لون</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">نوع الورق + الجرامية + المقاس</Label>
                <Select value={paperKey} onValueChange={setPaperKey}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="اختر الورق" /></SelectTrigger>
                  <SelectContent>
                    {paperOptions.map(o => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* قيم محسوبة */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 py-1.5 rounded-md bg-muted/40 border text-[11px]">
              <InlineInfo label="عرض الفرد" value={`${fmt(result.flatWidth)} سم`} />
              <InlineInfo label="طول الفرد" value={`${fmt(result.flatHeight)} سم`} />
              <InlineInfo label="القاعدة" value={`${fmt(base)} سم`} />
            </div>

            {/* القيم الفنية */}
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8">
                  <span className="flex items-center gap-2"><Settings2 className="w-3.5 h-3.5" /> القيم الفنية</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3">
                  <div className="space-y-1">
                    <Label className="text-[11px]">عدد الأوجه المطبوعة</Label>
                    <Select value={String(printedFaces)} onValueChange={(v) => setPrintedFaces(Number(v))}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">وجه واحد</SelectItem>
                        <SelectItem value="2">وجهين</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <CompactField label="اللسان العلوي (سم)" value={topFlap} onChange={setTopFlap} />
                  <div className="space-y-1">
                    <Label className="text-[11px]">القاعدة (سم)</Label>
                    <Input
                      className="h-9 text-xs"
                      type="number" step="0.01" value={base}
                      onChange={(e) => setBaseOverride(e.target.value === '' ? null : Number(e.target.value))}
                    />
                  </div>
                  <CompactField label="لسان اللصق (سم)" value={glueFlap} onChange={setGlueFlap} />
                  <CompactField label="نسبة الهدر %" value={wastePercent} onChange={setWastePercent} step={1} />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* الإضافات */}
            <Collapsible open={finishingOpen} onOpenChange={setFinishingOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8">
                  <span className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5" /> الإضافات (سلوفان / تكسير / قالب)</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${finishingOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end pt-3">
                  <div className="flex items-center gap-2 h-9">
                    <Switch checked={cellophane} onCheckedChange={setCellophane} />
                    <Label className="text-xs">السلوفان</Label>
                  </div>
                  <div className="flex items-center gap-2 h-9">
                    <Switch checked={diecut} onCheckedChange={setDiecut} />
                    <Label className="text-xs">التكسير</Label>
                  </div>
                  <CompactField label="قيمة القالب" value={moldPrice} onChange={setMoldPrice} step={10} />
                  <CompactField label="تشطيبات أخرى" value={otherFinishing} onChange={setOtherFinishing} />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {/* ── التشطيبات (صف مستقل، بنفس أسلوب حساب المجلة) ── */}
        <Card>
          <Collapsible open={extraFinishingOpen} onOpenChange={setExtraFinishingOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> التشطيبات الإضافية
                  {finishingList.filter(f => f.enabled).length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">{finishingList.filter(f => f.enabled).length}</Badge>
                  )}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${extraFinishingOpen ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-2 border-t pt-3">
                {finishingList.length === 0 && (
                  <p className="text-[11px] text-muted-foreground text-center py-2">
                    لا توجد تشطيبات إضافية. اضغط "إضافة خدمة" لإضافة تذهيب، تنقيط، أو غيره.
                  </p>
                )}
                {finishingList.map((item, idx) => (
                  <div key={idx} className={`rounded-lg border p-3 transition-all ${item.enabled ? 'bg-primary/5 border-primary/30' : 'bg-muted/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Input className="h-8 text-xs font-semibold flex-1 bg-background" value={item.name} onChange={(e) => updateFinishing(idx, { name: e.target.value })} />
                      <Switch checked={item.enabled} onCheckedChange={(val) => updateFinishing(idx, { enabled: val })} />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => removeFinishing(idx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground block mb-0.5">نوع الحساب</Label>
                        <Select value={item.calcType} onValueChange={(val) => updateFinishing(idx, { calcType: val as BagFinishingItem['calcType'] })}>
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
                        <Input className="h-8 text-xs bg-background" type="number" value={item.multiplier} onChange={(e) => updateFinishing(idx, { multiplier: Number(e.target.value) })} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground block mb-0.5">سعر الوحدة</Label>
                        <Input className="h-8 text-xs bg-background" type="number" value={item.pricePerUnit} onChange={(e) => updateFinishing(idx, { pricePerUnit: Number(e.target.value) })} />
                      </div>
                      {item.calcType === 'tiered_1000' && (
                        <div>
                          <Label className="text-[10px] text-muted-foreground block mb-0.5">ألف إضافي</Label>
                          <Input className="h-8 text-xs bg-background" type="number" value={item.extraPer1000} onChange={(e) => updateFinishing(idx, { extraPer1000: Number(e.target.value) })} />
                        </div>
                      )}
                    </div>
                    {item.enabled && (
                      <div className="flex justify-end mt-2">
                        <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {fmt(selectedFinishing.costs[idx] || 0)} ﷼
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full border-dashed text-xs" onClick={addFinishing}>
                  <Plus className="h-3.5 w-3.5 ml-1" /> إضافة خدمة
                </Button>
                {selectedFinishing.total > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t mt-2">
                    <span className="text-xs font-semibold text-primary">إجمالي التشطيبات</span>
                    <span className="text-sm font-bold text-primary">{fmt(selectedFinishing.total)} ﷼</span>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* كل السيناريوهات */}
        {result.scenarios.length > 0 && (
          <Card>
            <Collapsible open={allScenariosOpen} onOpenChange={setAllScenariosOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                  <span className="text-sm font-medium">
                    كل السيناريوهات ({validScenarios.length} صالح من {result.scenarios.length})
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${allScenariosOpen ? 'rotate-180' : ''}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="overflow-x-auto border-t">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-2 text-right font-medium">المقاس</th>
                        <th className="p-2 text-right font-medium">الطريقة</th>
                        <th className="p-2 text-right font-medium">شيتات طباعة</th>
                        <th className="p-2 text-right font-medium">الإجمالي</th>
                        <th className="p-2 text-right font-medium">سعر الكيس</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.scenarios.map((s, i) => {
                        const isBest = i === result.bestIndex;
                        const isSelected = selected ? scenarioKey(s) === scenarioKey(selected) : false;
                        return (
                          <tr
                            key={i}
                            onClick={() => s.valid && setSelectedKey(scenarioKey(s))}
                            className={`border-t transition-colors ${s.valid ? 'cursor-pointer hover:bg-accent/50' : 'opacity-50'} ${isSelected ? 'bg-primary/15 ring-1 ring-inset ring-primary' : ''} ${isBest && !isSelected ? 'bg-amber-500/10' : ''}`}
                          >
                            <td className="p-2 font-medium">
                              {isBest && <Badge className="ml-1 bg-amber-500 text-[10px] py-0 px-1.5">★</Badge>}
                              {isSelected && !isBest && <Badge className="ml-1 bg-primary text-[10px] py-0 px-1.5">✓</Badge>}
                              {s.machineLabel}
                            </td>
                            <td className="p-2 text-muted-foreground">
                              {s.valid ? s.method : (s.note || 'غير صالح')}
                            </td>
                            <td className="p-2">{s.valid ? fmtInt(s.printSheets) : '—'}</td>
                            <td className="p-2">{s.valid ? fmt(s.total) : '—'}</td>
                            <td className="p-2 text-primary">{s.valid ? fmt(s.pricePerBag) : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}
      </div>

      {/* ── النتائج (يسار) ── */}
      <div className="lg:col-span-1 space-y-4">
        <div className="lg:sticky lg:top-4 space-y-4">
          {selected ? (
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isUserPicked ? (
                      <>
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold">السيناريو المختار</span>
                      </>
                    ) : (
                      <>
                        <Trophy className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-semibold">أفضل ماكينة</span>
                      </>
                    )}
                  </div>
                  {isUserPicked && (
                    <Button
                      variant="ghost" size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => setSelectedKey(null)}
                    >
                      عُد لأفضل سيناريو
                    </Button>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{selected.machineLabel}</Badge>
                  <span className="text-[11px] text-muted-foreground">{selected.method}</span>
                </div>

                <div className="text-center py-2 border-y border-primary/20">
                  <div className="text-[11px] text-muted-foreground">سعر الكيس</div>
                  <div className="text-2xl font-bold text-primary leading-tight">{fmt(finalPricePerBag)}</div>
                  {selectedFinishing.total > 0 && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      شامل التشطيبات (قبل التشطيبات: {fmt(selected.pricePerBag)})
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <MiniStat label="الورق" value={fmt(selected.paperCost)} />
                  <MiniStat label="الطباعة" value={fmt(selected.printCost)} />
                  <MiniStat label="الفرز" value={fmt(selected.sortCost)} />
                  <MiniStat label="القالب" value={fmt(selected.moldCost)} />
                  {selected.cellophaneCost > 0 && <MiniStat label="السلوفان" value={fmt(selected.cellophaneCost)} />}
                  {selected.diecutCost > 0 && <MiniStat label="التكسير" value={fmt(selected.diecutCost)} />}
                  {selectedFinishing.total > 0 && <MiniStat label="تشطيبات إضافية" value={fmt(selectedFinishing.total)} />}
                </div>

                <div className="space-y-1 pt-2 border-t border-primary/20 text-[11px] text-muted-foreground">
                  <div className="flex justify-between"><span>شيتات طباعة:</span><span className="font-semibold text-foreground">{fmtInt(selected.printSheets)}</span></div>
                  <div className="flex justify-between"><span>شيتات شراء:</span><span className="font-semibold text-foreground">{fmtInt(selected.purchaseSheets)}</span></div>
                  {selected.bagsPerSheet > 0 && (
                    <div className="flex justify-between"><span>توزيع الشيت:</span><span className="font-semibold text-foreground">{selected.bagsPerSheet} كيس/شيت</span></div>
                  )}
                  {selected.sheetsPerBag > 0 && (
                    <div className="flex justify-between"><span>توزيع الشيت:</span><span className="font-semibold text-foreground">{selected.sheetsPerBag} شيت/كيس</span></div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-primary/20">
                  <span className="text-xs text-muted-foreground">الإجمالي</span>
                  <span className="text-base font-bold text-primary">{fmt(finalTotal)}</span>
                </div>

                {isUserPicked && best && (
                  <div className="text-[10px] text-muted-foreground text-center pt-1 border-t border-primary/10">
                    أفضل سيناريو: {best.machineLabel} — {fmt(best.pricePerBag)}/كيس
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="py-4 text-center text-xs text-muted-foreground">
                {paperType && grammage
                  ? 'لا يوجد سيناريو صالح — تحقق من المقاسات أو إعدادات المكائن.'
                  : 'اختر نوع الورق لبدء الحساب.'}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

const CompactField = ({ label, value, onChange, step = 0.5 }: {
  label: string; value: number; onChange: (n: number) => void; step?: number;
}) => (
  <div className="space-y-1">
    <Label className="text-xs">{label}</Label>
    <Input
      className="h-9 text-xs"
      type="number" step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
    />
  </div>
);

const InlineInfo = ({ label, value }: { label: string; value: string }) => (
  <span className="inline-flex items-center gap-1">
    <span className="text-muted-foreground">{label}:</span>
    <span className="font-semibold">{value}</span>
  </span>
);

const MiniStat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between px-2 py-1.5 rounded bg-card border">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-semibold">{value}</span>
  </div>
);

export default BagCalculator;
