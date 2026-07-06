import { usePrintingStore, useCalculations, type FinishingItem } from '@/store/printingStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Sparkles, Calculator, Info, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { calcTypeLabels } from '@/lib/calcTypeLabels';

const FIELD_HELP: Record<string, { title: string; desc: string }> = {
  name: {
    title: 'اسم الخدمة',
    desc: 'الاسم الذي يظهر في عرض السعر والمعاينة (مثل: تغليف، سلوفان، تذهيب).',
  },
  enabled: {
    title: 'تفعيل الخدمة',
    desc: 'عند التفعيل تُحتسب تكلفة هذه الخدمة ضمن الإجمالي. أوقفه لاستثنائها مؤقتًا دون حذفها.',
  },
  calcType: {
    title: 'نوع الحساب',
    desc: 'طريقة احتساب التكلفة: لكل قطعة، لكل ألف، شرائح ألف (سعر مختلف بعد أول ألف)، أو مبلغ ثابت.',
  },
  multiplier: {
    title: 'عدد المتغيرات',
    desc: 'مضاعف يُطبَّق على السعر (مثلاً: عدد الأوجه المُذهَّبة أو عدد طبقات السلوفان).',
  },
  pricePerUnit: {
    title: 'سعر الوحدة',
    desc: 'السعر الأساسي للوحدة وفق نوع الحساب المختار (لكل قطعة / لكل ألف / المبلغ الثابت).',
  },
  extraPer1000: {
    title: 'كل ألف إضافي',
    desc: 'يظهر فقط مع "شرائح ألف". يُحدِّد سعر كل ألف قطعة إضافية بعد الألف الأول.',
  },
};

const FieldInfo = ({ field }: { field: keyof typeof FIELD_HELP }) => {
  const info = FIELD_HELP[field];
  return (
    <Popover>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="inline-flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
          aria-label={`شرح: ${info.title}`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-64 p-3 text-right"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-bold text-foreground mb-1">{info.title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{info.desc}</p>
      </PopoverContent>
    </Popover>
  );
};

const FinishingServices = () => {
  const { finishingItems, updateFinishingItem, addFinishingItem, removeFinishingItem, inputs } = usePrintingStore();
  const calc = useCalculations();

  const handleAddService = () => {
    addFinishingItem({
      name: 'خدمة جديدة',
      enabled: false,
      calcType: 'per_1000',
      multiplier: 1,
      pricePerUnit: 0,
      extraPer1000: 0,
      notes: '',
    });
  };

  const enabledCount = finishingItems.filter(i => i.enabled).length;

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card rounded-xl border p-3 text-center">
              <p className="text-xs text-muted-foreground">الكمية</p>
              <p className="text-lg font-bold text-foreground">{inputs.quantity.toLocaleString()}</p>
            </div>
            <div className="bg-card rounded-xl border p-3 text-center">
              <p className="text-xs text-muted-foreground">عدد الآلاف</p>
              <p className="text-lg font-bold text-foreground">{calc.thousands}</p>
            </div>
            <div className="bg-card rounded-xl border p-3 text-center">
              <p className="text-xs text-muted-foreground">خدمات مفعّلة</p>
              <p className="text-lg font-bold text-primary">{enabledCount}</p>
            </div>
          </div>

          {/* Services List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                خدمات التشطيب
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {finishingItems.map((item, index) => (
                <FinishingCard
                  key={index}
                  item={item}
                  cost={calc.finishingCosts[index]}
                  onChange={(updates) => updateFinishingItem(index, updates)}
                  onRemove={() => removeFinishingItem(index)}
                />
              ))}

              <Button variant="outline" size="sm" className="w-full mt-2 border-dashed" onClick={handleAddService}>
                <Plus className="h-4 w-4 ml-2" />
                إضافة خدمة
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Total */}
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-5 text-center">
              <Calculator className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-1">إجمالي التشطيبات</p>
              <p className="text-3xl font-bold text-primary">{calc.totalFinishing.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">ريال</p>
            </CardContent>
          </Card>

          {/* Guide */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <Info className="h-4 w-4" />
                دليل أنواع الحساب
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(calcTypeLabels).map(([key, val]) => (
                <div key={key} className="text-xs p-2 rounded-lg bg-muted/50">
                  <span className="font-semibold text-foreground">{val.label}</span>
                  <p className="text-muted-foreground mt-0.5">{val.desc}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
};

const FinishingCard = ({
  item,
  cost,
  onChange,
  onRemove,
}: {
  item: FinishingItem;
  cost: number;
  onChange: (updates: Partial<FinishingItem>) => void;
  onRemove: () => void;
}) => {
  // Live Update: auto-enable when meaningful values are entered,
  // and auto-disable when values are cleared back to defaults/empty.
  const isMeaningful = (next: FinishingItem) => {
    const price = Number(next.pricePerUnit) || 0;
    const extra = Number(next.extraPer1000) || 0;
    if (next.calcType === 'tiered_1000') return price > 0 || extra > 0;
    return price > 0;
  };

  const handleFieldChange = (updates: Partial<FinishingItem>) => {
    const merged = { ...item, ...updates } as FinishingItem;
    const meaningful = isMeaningful(merged);
    if (meaningful && !item.enabled) {
      onChange({ ...updates, enabled: true });
    } else if (!meaningful && item.enabled) {
      onChange({ ...updates, enabled: false });
    } else {
      onChange(updates);
    }
  };

  return (
  <div
    className={`rounded-xl border p-4 transition-all cursor-pointer
      ${item.enabled
        ? 'bg-primary/5 border-primary/30 shadow-sm'
        : 'bg-muted/30 hover:bg-primary/5 hover:border-primary/20'
      }`}
    onClick={(e) => {
      if ((e.target as HTMLElement).closest('input, select, button, [role="combobox"]')) return;
      onChange({ enabled: !item.enabled });
    }}
  >
    {/* Row 1: Name + Inputs + Delete */}
    <div className="flex items-center gap-2 mb-3">
      <FieldInfo field="name" />
      <Input
        className="h-9 text-sm font-semibold flex-1 bg-background"
        value={item.name}
        onChange={(e) => handleFieldChange({ name: e.target.value })}
        onClick={(e) => e.stopPropagation()}
        placeholder="اسم الخدمة"
      />
      <FieldInfo field="enabled" />
      <Switch checked={item.enabled} onCheckedChange={(val) => { onChange({ enabled: val }); }} onClick={(e) => e.stopPropagation()} />
    </div>

    {/* Row 2: Inputs Grid - always visible */}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div>
        <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
          نوع الحساب
          <FieldInfo field="calcType" />
        </Label>
        <Select value={item.calcType} onValueChange={(val) => handleFieldChange({ calcType: val as FinishingItem['calcType'] })}>
          <SelectTrigger className="h-9 text-xs bg-background" onClick={(e) => e.stopPropagation()}><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(calcTypeLabels).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
          عدد المتغيرات
          <FieldInfo field="multiplier" />
        </Label>
        <Input type="number" className="h-9 text-xs bg-background" value={item.multiplier} onChange={(e) => handleFieldChange({ multiplier: Number(e.target.value) })} onClick={(e) => e.stopPropagation()} />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
          سعر الوحدة
          <FieldInfo field="pricePerUnit" />
        </Label>
        <Input type="number" className="h-9 text-xs bg-background" value={item.pricePerUnit} onChange={(e) => handleFieldChange({ pricePerUnit: Number(e.target.value) })} onClick={(e) => e.stopPropagation()} />
      </div>
      {item.calcType === 'tiered_1000' && (
        <div>
          <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            كل ألف إضافي
            <FieldInfo field="extraPer1000" />
          </Label>
          <Input type="number" className="h-9 text-xs bg-background" value={item.extraPer1000} onChange={(e) => handleFieldChange({ extraPer1000: Number(e.target.value) })} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>

    {/* Cost Badge + Delete */}
    <div className="mt-3 flex items-center justify-between">
      {item.enabled ? (
        <span className="text-sm font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">
          {cost.toFixed(2)} ريال
        </span>
      ) : <span />}
      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  </div>
  );
};

export default FinishingServices;
