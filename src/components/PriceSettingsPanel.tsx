import { usePrintingStore, type SizePricing, type ColorPricing, type SizeCustomField } from '@/store/printingStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, Download, Upload } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { STATIC_TITLE_KEY, STATIC_TITLE, applyTabSEO } from '@/lib/seo';
import * as XLSX from 'xlsx';
import { calcTypeLabels } from '@/lib/calcTypeLabels';

const defaultColorPricing: ColorPricing = { sortPerFace: 0, printFirst1000PerFace: 0, printExtra1000PerFace: 0 };

const emptySizePricing: SizePricing = {
  sizeName: '', width: 0, height: 0,
  color1: { ...defaultColorPricing }, color2: { ...defaultColorPricing },
  color3: { ...defaultColorPricing }, color4: { ...defaultColorPricing },
  diecut1st1000: 0, diecutExtra1000: 0, cellophanePerFace: 0,
  hiddenFields: [], customFields: [],
};

const colorLabels = [
  { key: 'color1' as const, label: 'فرز (١ لون)' },
  { key: 'color2' as const, label: 'فرز (٢ لون)' },
  { key: 'color3' as const, label: 'فرز (٣ لون)' },
  { key: 'color4' as const, label: 'فرز (٤ لون)' },
];

// Toggleable built-in field definitions
const TOGGLEABLE_FIELDS = [
  { key: 'colors', label: 'الألوان (فرز + طباعة)' },
  { key: 'diecut', label: 'التكسير' },
  { key: 'cellophane', label: 'السلفان' },
];

const ColorPricingFields = ({
  colorPricing, label, onChange,
}: {
  colorPricing: ColorPricing; label: string;
  onChange: (updates: Partial<ColorPricing>) => void;
}) => (
  <div className="border rounded-lg p-3 space-y-2">
    <p className="text-sm font-semibold text-primary">{label}</p>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0">
      <div className="space-y-1 min-w-0">
        <Label className="text-xs">فرز الوجه</Label>
        <Input type="number" value={colorPricing.sortPerFace} onChange={(e) => onChange({ sortPerFace: Number(e.target.value) })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">طباعة أول ألف / وجه</Label>
        <Input type="number" value={colorPricing.printFirst1000PerFace} onChange={(e) => onChange({ printFirst1000PerFace: Number(e.target.value) })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">طباعة كل ألف إضافي / وجه</Label>
        <Input type="number" value={colorPricing.printExtra1000PerFace} onChange={(e) => onChange({ printExtra1000PerFace: Number(e.target.value) })} />
      </div>
    </div>
  </div>
);

const PriceSettingsPanel = () => {
  const { priceSettings, updateSizePricing, addSizePricing, removeSizePricing, savePriceSettings } = usePrintingStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSize, setNewSize] = useState<SizePricing>({ ...emptySizePricing });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFieldHidden = (size: SizePricing, fieldKey: string) => {
    return size.hiddenFields?.includes(fieldKey) ?? false;
  };

  const toggleField = (sizeIndex: number, fieldKey: string, isNew: boolean, size: SizePricing) => {
    const hidden = size.hiddenFields || [];
    const newHidden = hidden.includes(fieldKey)
      ? hidden.filter(f => f !== fieldKey)
      : [...hidden, fieldKey];
    if (isNew) {
      setNewSize(prev => ({ ...prev, hiddenFields: newHidden }));
    } else {
      updateSizePricing(sizeIndex, { hiddenFields: newHidden });
    }
  };

  const addCustomField = (sizeIndex: number, isNew: boolean, size: SizePricing) => {
    const fields = size.customFields || [];
    const newField: SizeCustomField = { id: crypto.randomUUID(), name: 'حقل جديد', calcType: 'flat', multiplier: 1, pricePerUnit: 0, extraPer1000: 0 };
    if (isNew) {
      setNewSize(prev => ({ ...prev, customFields: [...(prev.customFields || []), newField] }));
    } else {
      updateSizePricing(sizeIndex, { customFields: [...fields, newField] });
    }
  };

  const updateCustomField = (sizeIndex: number, fieldId: string, updates: Partial<SizeCustomField>, isNew: boolean, size: SizePricing) => {
    const fields = (size.customFields || []).map(f => f.id === fieldId ? { ...f, ...updates } : f);
    if (isNew) {
      setNewSize(prev => ({ ...prev, customFields: fields }));
    } else {
      updateSizePricing(sizeIndex, { customFields: fields });
    }
  };

  const removeCustomField = (sizeIndex: number, fieldId: string, isNew: boolean, size: SizePricing) => {
    const fields = (size.customFields || []).filter(f => f.id !== fieldId);
    if (isNew) {
      setNewSize(prev => ({ ...prev, customFields: fields }));
    } else {
      updateSizePricing(sizeIndex, { customFields: fields });
    }
  };

  const handleExportExcel = () => {
    const rows: any[] = [];
    priceSettings.sizes.forEach((size) => {
      const s = {
        ...size,
        color1: size.color1 || { sortPerFace: 0, printFirst1000PerFace: 0, printExtra1000PerFace: 0 },
        color2: size.color2 || { sortPerFace: 0, printFirst1000PerFace: 0, printExtra1000PerFace: 0 },
        color3: size.color3 || { sortPerFace: 0, printFirst1000PerFace: 0, printExtra1000PerFace: 0 },
        color4: size.color4 || { sortPerFace: 0, printFirst1000PerFace: 0, printExtra1000PerFace: 0 },
      };
      [
        { key: 'color1', label: '1 لون' },
        { key: 'color2', label: '2 لون' },
        { key: 'color3', label: '3 لون' },
        { key: 'color4', label: '4 لون' },
      ].forEach(({ key, label }) => {
        const c = s[key as keyof typeof s] as ColorPricing;
        rows.push({
          'اسم المقاس': size.sizeName,
          'العرض (سم)': size.width,
          'الطول (سم)': size.height,
          'عدد الألوان': label,
          'فرز الوجه': c.sortPerFace,
          'طباعة أول ألف / وجه': c.printFirst1000PerFace,
          'طباعة كل ألف إضافي / وجه': c.printExtra1000PerFace,
          'تكسير أول ألف': size.diecut1st1000,
          'تكسير كل ألف إضافي': size.diecutExtra1000,
          'سلفان الوجه': size.cellophanePerFace,
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'مقاسات الطباعة');
    ws['!cols'] = Array(10).fill({ wch: 22 });
    XLSX.writeFile(wb, 'إعدادات_مقاسات_الطباعة.xlsx');
    toast.success('تم تصدير الملف بنجاح');
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
        if (!data.length) { toast.error('الملف فارغ'); return; }

        const colorKeyMap: Record<string, keyof SizePricing> = {
          '1 لون': 'color1', '2 لون': 'color2', '3 لون': 'color3', '4 لون': 'color4',
        };

        const sizeMap = new Map<string, SizePricing>();
        data.forEach((row) => {
          const name = String(row['اسم المقاس'] || '').trim();
          if (!name) return;
          if (!sizeMap.has(name)) {
            sizeMap.set(name, {
              sizeName: name,
              width: Number(row['العرض (سم)']) || 0,
              height: Number(row['الطول (سم)']) || 0,
              color1: { ...defaultColorPricing },
              color2: { ...defaultColorPricing },
              color3: { ...defaultColorPricing },
              color4: { ...defaultColorPricing },
              diecut1st1000: Number(row['تكسير أول ألف']) || 0,
              diecutExtra1000: Number(row['تكسير كل ألف إضافي']) || 0,
              cellophanePerFace: Number(row['سلفان الوجه']) || 0,
            });
          }
          const sp = sizeMap.get(name)!;
          const colorLabel = String(row['عدد الألوان'] || '').trim();
          const colorKey = colorKeyMap[colorLabel];
          if (colorKey) {
            (sp[colorKey] as ColorPricing) = {
              sortPerFace: Number(row['فرز الوجه']) || 0,
              printFirst1000PerFace: Number(row['طباعة أول ألف / وجه']) || 0,
              printExtra1000PerFace: Number(row['طباعة كل ألف إضافي / وجه']) || 0,
            };
          }
          sp.diecut1st1000 = Number(row['تكسير أول ألف']) || 0;
          sp.diecutExtra1000 = Number(row['تكسير كل ألف إضافي']) || 0;
          sp.cellophanePerFace = Number(row['سلفان الوجه']) || 0;
        });

        const currentSizes = [...priceSettings.sizes];
        sizeMap.forEach((imported, name) => {
          const existingIdx = currentSizes.findIndex(s => s.sizeName.trim() === name);
          if (existingIdx >= 0) {
            updateSizePricing(existingIdx, imported);
          } else {
            addSizePricing(imported);
          }
        });

        savePriceSettings();
        toast.success(`تم استيراد ${sizeMap.size} مقاس بنجاح`);
      } catch {
        toast.error('حدث خطأ في قراءة الملف');
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddSize = () => {
    if (!newSize.sizeName.trim() || newSize.width <= 0 || newSize.height <= 0) return;
    addSizePricing(newSize);
    setNewSize({ ...emptySizePricing });
    setShowAddForm(false);
  };

  const renderFieldToggles = (size: SizePricing, sizeIndex: number, isNew?: boolean) => (
    <div className="border rounded-lg p-3 space-y-3">
      <p className="text-sm font-semibold text-foreground">إظهار / إخفاء التفاصيل</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TOGGLEABLE_FIELDS.map(field => (
          <div key={field.key} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/30">
            <Label className="text-xs">{field.label}</Label>
            <Switch
              checked={!isFieldHidden(size, field.key)}
              onCheckedChange={() => toggleField(sizeIndex, field.key, !!isNew, size)}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const renderCustomFields = (size: SizePricing, sizeIndex: number, isNew?: boolean) => (
    <div className="border rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">حقول مخصصة</p>
        <Button variant="outline" size="sm" onClick={() => addCustomField(sizeIndex, !!isNew, size)}>
          <Plus className="w-3.5 h-3.5 ml-1" /> إضافة حقل
        </Button>
      </div>
      {(size.customFields || []).length > 0 && (
        <div className="space-y-2">
          {(size.customFields || []).map(field => (
            <div key={field.id} className="flex items-center gap-2 flex-wrap p-2 rounded-md bg-muted/30">
              <Input
                className="h-8 text-xs w-28"
                value={field.name}
                onChange={(e) => updateCustomField(sizeIndex, field.id, { name: e.target.value }, !!isNew, size)}
                placeholder="اسم الحقل"
              />
              <Select value={field.calcType} onValueChange={(val) => updateCustomField(sizeIndex, field.id, { calcType: val as SizeCustomField['calcType'] }, !!isNew, size)}>
                <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(calcTypeLabels).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                className="h-8 text-xs w-20"
                value={field.multiplier}
                onChange={(e) => updateCustomField(sizeIndex, field.id, { multiplier: Number(e.target.value) }, !!isNew, size)}
                placeholder="المتغيرات"
              />
              <Input
                type="number"
                className="h-8 text-xs w-24"
                value={field.pricePerUnit}
                onChange={(e) => updateCustomField(sizeIndex, field.id, { pricePerUnit: Number(e.target.value) }, !!isNew, size)}
                placeholder="سعر الوحدة"
              />
              {field.calcType === 'tiered_1000' && (
                <Input
                  type="number"
                  className="h-8 text-xs w-24"
                  value={field.extraPer1000}
                  onChange={(e) => updateCustomField(sizeIndex, field.id, { extraPer1000: Number(e.target.value) }, !!isNew, size)}
                  placeholder="ألف إضافي"
                />
              )}
              <Button
                variant="ghost" size="icon"
                className="h-7 w-7 text-destructive/60 hover:text-destructive shrink-0"
                onClick={() => removeCustomField(sizeIndex, field.id, !!isNew, size)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {(size.customFields || []).length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">لا توجد حقول مخصصة. أضف حقلاً ليظهر في الحاسبات.</p>
      )}
    </div>
  );

  const renderSizeCard = (size: SizePricing, sizeIndex: number, isNew?: boolean) => {
    const updateFn = isNew
      ? (_idx: number, updates: Partial<SizePricing>) => setNewSize(prev => ({ ...prev, ...updates }))
      : updateSizePricing;
    const idx = isNew ? 0 : sizeIndex;
    const s = {
      ...size,
      color1: size.color1 || { ...defaultColorPricing },
      color2: size.color2 || { ...defaultColorPricing },
      color3: size.color3 || { ...defaultColorPricing },
      color4: size.color4 || { ...defaultColorPricing },
    };

    return (
      <div className="space-y-3">
        {/* Field toggles */}
        {renderFieldToggles(s, sizeIndex, isNew)}

        {/* Color pricing - only if not hidden */}
        {!isFieldHidden(s, 'colors') && colorLabels.map(({ key, label }) => (
          <ColorPricingFields
            key={key}
            label={label}
            colorPricing={s[key]}
            onChange={(updates) => {
              if (isNew) {
                setNewSize(prev => ({ ...prev, [key]: { ...prev[key], ...updates } }));
              } else {
                updateFn(idx, { [key]: { ...s[key], ...updates } });
              }
            }}
          />
        ))}

        {/* Diecut & cellophane - only if not hidden */}
        <div className="border-t pt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 min-w-0">
          {!isFieldHidden(s, 'diecut') && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">تكسير أول ألف</Label>
                <Input type="number" value={s.diecut1st1000}
                  onChange={(e) => isNew ? setNewSize(prev => ({ ...prev, diecut1st1000: Number(e.target.value) })) : updateFn(idx, { diecut1st1000: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">تكسير كل ألف إضافي</Label>
                <Input type="number" value={s.diecutExtra1000}
                  onChange={(e) => isNew ? setNewSize(prev => ({ ...prev, diecutExtra1000: Number(e.target.value) })) : updateFn(idx, { diecutExtra1000: Number(e.target.value) })} />
              </div>
            </>
          )}
          {!isFieldHidden(s, 'cellophane') && (
            <div className="space-y-1">
              <Label className="text-xs">سلفان الوجه الواحد</Label>
              <Input type="number" step="0.01" value={s.cellophanePerFace}
                onChange={(e) => isNew ? setNewSize(prev => ({ ...prev, cellophanePerFace: Number(e.target.value) })) : updateFn(idx, { cellophanePerFace: Number(e.target.value) })} />
            </div>
          )}
        </div>

        {/* Custom fields */}
        {renderCustomFields(s, sizeIndex, isNew)}
      </div>
    );
  };

  const [staticTitle, setStaticTitle] = useState<boolean>(() => {
    try { return localStorage.getItem(STATIC_TITLE_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => {
    try {
      if (staticTitle) localStorage.setItem(STATIC_TITLE_KEY, '1');
      else localStorage.removeItem(STATIC_TITLE_KEY);
    } catch {}
    if (staticTitle) document.title = STATIC_TITLE;
    else applyTabSEO(localStorage.getItem('printCalc_activeTab') || 'itemcost');
  }, [staticTitle]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">عنوان تبويبة المتصفح</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label className="text-sm">تثبيت العنوان على "{STATIC_TITLE}"</Label>
            <p className="text-xs text-muted-foreground">عند التفعيل لن يتغير عنوان التبويبة باسم الصنف أو العميل.</p>
          </div>
          <Switch checked={staticTitle} onCheckedChange={setStaticTitle} />
        </CardContent>
      </Card>

      <div className="flex gap-2 justify-end">
        <input type="file" accept=".xlsx,.xls" ref={fileInputRef} className="hidden" onChange={handleImportExcel} />
        <Button variant="outline" size="sm" onClick={handleExportExcel}>
          <Download className="w-4 h-4 ml-1" /> تصدير Excel
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-4 h-4 ml-1" /> استيراد Excel
        </Button>
      </div>
      {priceSettings.sizes.map((size, sizeIndex) => (
        <Card key={sizeIndex}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg text-primary">مقاس {size.sizeName}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">{size.width} × {size.height} سم</p>
            </div>
            {priceSettings.sizes.length > 1 && (
              <Button size="sm" variant="destructive" onClick={() => removeSizePricing(sizeIndex)}>
                <Trash2 className="w-4 h-4 ml-1" /> حذف
              </Button>
            )}
          </CardHeader>
          <CardContent>{renderSizeCard(size, sizeIndex)}</CardContent>
        </Card>
      ))}

      {!showAddForm ? (
        <Card className="border-dashed cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setShowAddForm(true)}>
          <CardContent className="pt-6 flex items-center justify-center gap-2 text-muted-foreground">
            <Plus className="w-5 h-5" /><span>إضافة مقاس جديد</span>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-lg text-primary">إضافة مقاس جديد</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 min-w-0">
              <div className="space-y-1 min-w-0">
                <Label className="text-xs">اسم المقاس</Label>
                <Input placeholder="مثال: 60×90" value={newSize.sizeName} onChange={(e) => setNewSize({ ...newSize, sizeName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">العرض (سم)</Label>
                <Input type="number" value={newSize.width || ''} onChange={(e) => setNewSize({ ...newSize, width: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">الطول (سم)</Label>
                <Input type="number" value={newSize.height || ''} onChange={(e) => setNewSize({ ...newSize, height: Number(e.target.value) })} />
              </div>
            </div>
            {renderSizeCard(newSize, 0, true)}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAddForm(false)}>إلغاء</Button>
              <Button onClick={handleAddSize} disabled={!newSize.sizeName.trim() || newSize.width <= 0 || newSize.height <= 0}>
                <Plus className="w-4 h-4 ml-1" /> إضافة
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center">
        <Button size="lg" className="w-full max-w-md" onClick={() => { savePriceSettings(); toast.success('تم حفظ إعدادات الأسعار بنجاح'); }}>
          <Save className="w-4 h-4 ml-2" /> حفظ الإعدادات
        </Button>
      </div>
    </div>
  );
};

export default PriceSettingsPanel;
