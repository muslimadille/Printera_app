import { usePrintingStore, type PaperType, type PaperEntry, type PricingUnit } from '@/store/printingStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, Upload, Download, Search } from 'lucide-react';
import { useState, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const PaperTypesManager = () => {
  const { paperTypes, updatePaperType, addPaperType, removePaperType, savePaperTypes, setPaperTypes } = usePrintingStore();
  const [newTypeName, setNewTypeName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredPaperTypes = useMemo(() => {
    if (!searchQuery.trim()) return paperTypes.map((t, i) => ({ ...t, originalIndex: i }));
    const q = searchQuery.trim().toLowerCase();
    return paperTypes
      .map((t, i) => ({ ...t, originalIndex: i }))
      .filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.entries.some(e =>
          String(e.grammage).includes(q) ||
          (e.sizeName && e.sizeName.toLowerCase().includes(q))
        )
      );
  }, [paperTypes, searchQuery]);

  const handleAddType = () => {
    if (!newTypeName.trim()) return;
    addPaperType({ name: newTypeName.trim(), entries: [] });
    setNewTypeName('');
  };

  const handleAddEntry = (typeIndex: number) => {
    const type = paperTypes[typeIndex];
    const newEntry: PaperEntry = { grammage: 0, sizeName: '', width: 0, height: 0, pricePerTon: 0, pricingUnit: 'ton', pricePerReam: 0, sheetsPerReam: 500 };
    updatePaperType(typeIndex, { ...type, entries: [...type.entries, newEntry] });
  };

  const handleUpdateEntry = (typeIndex: number, entryIndex: number, updates: Partial<PaperEntry>) => {
    const type = paperTypes[typeIndex];
    const updatedEntries = type.entries.map((e, i) => (i === entryIndex ? { ...e, ...updates } : e));
    updatePaperType(typeIndex, { ...type, entries: updatedEntries });
  };

  const handleRemoveEntry = (typeIndex: number, entryIndex: number) => {
    const type = paperTypes[typeIndex];
    updatePaperType(typeIndex, { ...type, entries: type.entries.filter((_, i) => i !== entryIndex) });
  };

  // Export paper types to Excel
  const handleExport = () => {
    const rows: any[] = [];
    paperTypes.forEach((type) => {
      type.entries.forEach((entry) => {
        rows.push({
          'نوع الورق': type.name,
          'الجرامية': entry.grammage,
          'اسم المقاس': entry.sizeName,
          'العرض (سم)': entry.width,
          'الطول (سم)': entry.height,
          'وحدة التسعير': entry.pricingUnit === 'ream' ? 'رزمة' : 'طن',
          'سعر الطن (ريال)': entry.pricePerTon || 0,
          'سعر الرزمة (ريال)': entry.pricePerReam || 0,
          'عدد الورق بالرزمة': entry.sheetsPerReam || 500,
        });
      });
      if (type.entries.length === 0) {
        rows.push({ 'نوع الورق': type.name });
      }
    });

    if (rows.length === 0) {
      // Add template rows showing both pricing units
      rows.push({
        'نوع الورق': 'مثال: كوشيه',
        'الجرامية': 300,
        'اسم المقاس': '70×100',
        'العرض (سم)': 70,
        'الطول (سم)': 100,
        'وحدة التسعير': 'بالطن',
        'سعر الطن (ريال)': 4000,
        'سعر الرزمة (ريال)': 0,
        'عدد الورق بالرزمة': 500,
      });
      rows.push({
        'نوع الورق': 'مثال: مطفي',
        'الجرامية': 150,
        'اسم المقاس': '70×100',
        'العرض (سم)': 70,
        'الطول (سم)': 100,
        'وحدة التسعير': 'بالرزمة',
        'سعر الطن (ريال)': 0,
        'سعر الرزمة (ريال)': 250,
        'عدد الورق بالرزمة': 500,
      });
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    // Set RTL and column widths
    ws['!cols'] = [
      { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
      { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 18 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'أنواع الورق');
    XLSX.writeFile(wb, 'أنواع_الورق.xlsx');
    toast.success('تم تصدير الملف بنجاح');
  };

  // Import paper types from Excel
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);

        if (rows.length === 0) {
          toast.error('الملف فارغ');
          return;
        }

        // Normalize Arabic pricing unit text -> 'ton' | 'ream' | null (unknown)
        const normalizeUnit = (raw: unknown): PricingUnit | null => {
          if (raw === undefined || raw === null) return null;
          const s = String(raw)
            .normalize('NFKC')
            .replace(/[أإآ]/g, 'ا')
            .replace(/[ـ]/g, '')
            .replace(/\s+/g, '')
            .toLowerCase()
            .trim();
          if (!s) return null;
          // Ream variants
          if (['رزمة', 'رزمه', 'بالرزمة', 'بالرزمه', 'ream', 'reams', 'package', 'pack'].includes(s)) return 'ream';
          // Ton variants
          if (['طن', 'بالطن', 'ton', 'tons', 'tonne'].includes(s)) return 'ton';
          return null;
        };

        // Group by paper type name
        const importedMap = new Map<string, PaperEntry[]>();
        const unitErrors: string[] = [];
        rows.forEach((row, idx) => {
          const name = (row['نوع الورق'] || '').toString().trim();
          if (!name) return;

          const grammage = Number(row['الجرامية']) || 0;
          const sizeName = (row['اسم المقاس'] || '').toString().trim();
          if (!grammage && !sizeName) {
            // Just a type name with no entries
            if (!importedMap.has(name)) importedMap.set(name, []);
            return;
          }

          const unitRaw = row['وحدة التسعير'];
          const pricingUnit = normalizeUnit(unitRaw);
          if (pricingUnit === null) {
            unitErrors.push(`الصف ${idx + 2} (${name} - ${sizeName || grammage}): وحدة التسعير "${unitRaw ?? 'فارغة'}" غير معروفة`);
            return;
          }

          const entry: PaperEntry = {
            grammage,
            sizeName,
            width: Number(row['العرض (سم)']) || 0,
            height: Number(row['الطول (سم)']) || 0,
            pricePerTon: Number(row['سعر الطن (ريال)']) || 0,
            pricingUnit,
            pricePerReam: Number(row['سعر الرزمة (ريال)']) || 0,
            sheetsPerReam: Number(row['عدد الورق بالرزمة']) || 500,
          };

          if (!importedMap.has(name)) importedMap.set(name, []);
          importedMap.get(name)!.push(entry);
        });

        if (unitErrors.length > 0) {
          toast.error(`تم إيقاف الاستيراد - أخطاء في وحدة التسعير:\n${unitErrors.slice(0, 5).join('\n')}${unitErrors.length > 5 ? `\n...و ${unitErrors.length - 5} أخرى` : ''}`, { duration: 8000 });
          return;
        }

        // Merge with existing: update existing types by name, add new ones
        let updatedCount = 0;
        let addedCount = 0;
        const updatedTypes = [...paperTypes];

        importedMap.forEach((entries, name) => {
          const existingIndex = updatedTypes.findIndex(
            (t) => t.name.trim() === name
          );

          if (existingIndex >= 0) {
            // Update existing: merge entries by grammage+sizeName, add new ones
            const existing = updatedTypes[existingIndex];
            const mergedEntries = [...existing.entries];

            entries.forEach((importedEntry) => {
              const matchIdx = mergedEntries.findIndex(
                (e) => e.grammage === importedEntry.grammage && e.sizeName === importedEntry.sizeName
              );
              if (matchIdx >= 0) {
                mergedEntries[matchIdx] = importedEntry; // Update price
              } else {
                mergedEntries.push(importedEntry); // Add new entry
              }
            });

            updatedTypes[existingIndex] = { ...existing, entries: mergedEntries };
            updatedCount++;
          } else {
            // Add new type
            updatedTypes.push({ name, entries });
            addedCount++;
          }
        });

        setPaperTypes(updatedTypes);

        const messages = [];
        if (updatedCount > 0) messages.push(`تم تحديث ${updatedCount} نوع`);
        if (addedCount > 0) messages.push(`تم إضافة ${addedCount} نوع جديد`);
        toast.success(messages.join(' و ') || 'تم الاستيراد');
      } catch (err) {
        toast.error('خطأ في قراءة الملف. تأكد من صحة التنسيق');
        console.error(err);
      }
    };
    reader.readAsBinaryString(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Import/Export buttons */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 justify-center">
            <Button variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4 ml-2" /> تصدير إلى Excel
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 ml-2" /> استيراد من Excel
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImport}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            صدّر الملف أولاً لمعرفة التنسيق المطلوب، ثم عدّل الأسعار أو أضف أنواعاً جديدة واستوردها.
            <br />
            عند الاستيراد: الأنواع الموجودة يتم تحديث أسعارها، والأنواع الجديدة تُضاف تلقائياً.
          </p>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pr-10 h-10"
          placeholder="بحث عن نوع ورق، جرامية، أو مقاس..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {filteredPaperTypes.length === 0 && searchQuery.trim() && (
        <p className="text-center text-muted-foreground py-4">لا توجد نتائج للبحث "{searchQuery}"</p>
      )}

      {filteredPaperTypes.map((type) => {
        const typeIndex = type.originalIndex;
        return (<Card key={typeIndex}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg text-primary">{type.name}</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleAddEntry(typeIndex)}>
                <Plus className="w-4 h-4 ml-1" /> إضافة صف
              </Button>
              <Button size="sm" variant="destructive" onClick={() => removePaperType(typeIndex)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {type.entries.map((entry, entryIndex) => {
                const unit = entry.pricingUnit || 'ton';
                return (
                  <div key={entryIndex} className="border border-border/50 rounded-lg p-2 overflow-x-auto">
                    <div className="flex flex-nowrap gap-2 items-end min-w-max">
                      <div className="w-20 shrink-0">
                        <label className="text-[10px] text-muted-foreground block truncate">الجرامية</label>
                        <Input type="number" className="h-8 text-sm" value={entry.grammage}
                          onChange={(e) => handleUpdateEntry(typeIndex, entryIndex, { grammage: Number(e.target.value) })} />
                      </div>
                      <div className="w-28 shrink-0">
                        <label className="text-[10px] text-muted-foreground block truncate">اسم المقاس</label>
                        <Input className="h-8 text-sm" value={entry.sizeName}
                          onChange={(e) => handleUpdateEntry(typeIndex, entryIndex, { sizeName: e.target.value })} />
                      </div>
                      <div className="w-20 shrink-0">
                        <label className="text-[10px] text-muted-foreground block truncate">العرض (سم)</label>
                        <Input type="number" className="h-8 text-sm" value={entry.width}
                          onChange={(e) => handleUpdateEntry(typeIndex, entryIndex, { width: Number(e.target.value) })} />
                      </div>
                      <div className="w-20 shrink-0">
                        <label className="text-[10px] text-muted-foreground block truncate">الطول (سم)</label>
                        <Input type="number" className="h-8 text-sm" value={entry.height}
                          onChange={(e) => handleUpdateEntry(typeIndex, entryIndex, { height: Number(e.target.value) })} />
                      </div>
                      <div className="w-24 shrink-0">
                        <label className="text-[10px] text-muted-foreground block truncate">وحدة التسعير</label>
                        <Select value={unit} onValueChange={(v: PricingUnit) => handleUpdateEntry(typeIndex, entryIndex, { pricingUnit: v })}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ton">بالطن</SelectItem>
                            <SelectItem value="ream">بالرزمة</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {unit === 'ton' ? (
                        <div className="w-28 shrink-0">
                          <label className="text-[10px] text-muted-foreground block truncate">سعر الطن (ريال)</label>
                          <Input type="number" className="h-8 text-sm" value={entry.pricePerTon}
                            onChange={(e) => handleUpdateEntry(typeIndex, entryIndex, { pricePerTon: Number(e.target.value) })} />
                        </div>
                      ) : (
                        <div className="w-28 shrink-0">
                          <label className="text-[10px] text-muted-foreground block truncate">سعر الرزمة (ريال)</label>
                          <Input type="number" className="h-8 text-sm" value={entry.pricePerReam || 0}
                            onChange={(e) => handleUpdateEntry(typeIndex, entryIndex, { pricePerReam: Number(e.target.value) })} />
                        </div>
                      )}
                      {unit === 'ream' && (
                        <div className="w-28 shrink-0">
                          <label className="text-[10px] text-muted-foreground block truncate">عدد الورق بالرزمة</label>
                          <Input type="number" className="h-8 text-sm" value={entry.sheetsPerReam || 500}
                            onChange={(e) => handleUpdateEntry(typeIndex, entryIndex, { sheetsPerReam: Number(e.target.value) })} />
                        </div>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0"
                        onClick={() => handleRemoveEntry(typeIndex, entryIndex)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {type.entries.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">لا توجد بيانات بعد</p>
              )}
            </div>
          </CardContent>
        </Card>);
      })}

      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Input placeholder="اسم نوع الورق الجديد" value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddType()} />
            <Button onClick={handleAddType} disabled={!newTypeName.trim()}>
              <Plus className="w-4 h-4 ml-1" /> إضافة نوع
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button size="lg" className="w-full max-w-md" onClick={() => { savePaperTypes(); toast.success('تم حفظ أنواع الورق بنجاح'); }}>
          <Save className="w-4 h-4 ml-2" /> حفظ أنواع الورق
        </Button>
      </div>
    </div>
  );
};

export default PaperTypesManager;
