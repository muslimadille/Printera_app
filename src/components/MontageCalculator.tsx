import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Copy, Upload, Download, Combine, RotateCcw } from 'lucide-react';
import { downloadMontageTemplate, parseMontageExcel } from '@/lib/montageExcel';
import SmartSheetLayoutPreview from '@/components/SmartSheetLayoutPreview';
import { toast } from 'sonner';

/* ──────────────────────────────────────────────
 * Montage — internal production tab.
 * Two-column UX:
 *  • Left  → vertical input rows (item / base sheet / press sheet)
 *  • Right → smart layout (base→press split + item-in-press + scenarios)
 * Auto-fills the press sheet from the base sheet (largest even split that
 * still fits the item) — but stays editable.
 * ────────────────────────────────────────────── */

interface MontageItem {
  id: string;
  name: string;
  itemW: number;
  itemH: number;
  baseW: number;
  baseH: number;
  pressW: number;
  pressH: number;
  /** Last value we auto-filled into press, used to detect manual overrides. */
  autoPressW?: number;
  autoPressH?: number;
}

const STORAGE_KEY = 'printCalc_montage_state_v4';

const newItem = (): MontageItem => ({
  id: crypto.randomUUID(),
  name: '',
  itemW: 0, itemH: 0,
  baseW: 0, baseH: 0,
  pressW: 0, pressH: 0,
});

/** Suggest a press-sheet size from base sheet by halving the longer side
 *  while keeping the result ≥ item size. Falls back to base itself. */
function suggestPress(baseW: number, baseH: number, itemW: number, itemH: number) {
  if (baseW <= 0 || baseH <= 0) return null;
  const fits = (w: number, h: number) =>
    itemW <= 0 || itemH <= 0 ||
    (Math.min(w, h) >= Math.min(itemW, itemH) && Math.max(w, h) >= Math.max(itemW, itemH));

  const candidates: Array<[number, number]> = [];
  // Prefer halving the longer side first.
  if (baseW >= baseH) {
    candidates.push([baseW / 2, baseH], [baseW, baseH / 2], [baseW, baseH]);
  } else {
    candidates.push([baseW, baseH / 2], [baseW / 2, baseH], [baseW, baseH]);
  }
  for (const [w, h] of candidates) {
    if (fits(w, h)) return { w: +w.toFixed(2), h: +h.toFixed(2) };
  }
  return { w: baseW, h: baseH };
}

const MontageCalculator = () => {
  const [items, setItems] = useState<MontageItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch {}
    return [newItem()];
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  }, [items]);

  const update = useCallback((id: string, patch: Partial<MontageItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  }, []);

  const remove = (id: string) => setItems(prev => prev.length === 1 ? prev : prev.filter(i => i.id !== id));
  const duplicate = (id: string) => setItems(prev => {
    const idx = prev.findIndex(i => i.id === id);
    if (idx < 0) return prev;
    return [...prev.slice(0, idx + 1), { ...prev[idx], id: crypto.randomUUID() }, ...prev.slice(idx + 1)];
  });
  const add = () => setItems(prev => [...prev, newItem()]);
  const reset = () => setItems([newItem()]);

  const handleImport = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseMontageExcel(buf);
      if (!parsed.length) {
        toast.error('لم يتم العثور على بيانات صالحة في الملف');
        return;
      }
      setItems(parsed.map(p => ({
        id: crypto.randomUUID(),
        name: p.name,
        itemW: p.itemW, itemH: p.itemH,
        baseW: 0, baseH: 0,
        pressW: p.pressW, pressH: p.pressH,
      })));
      toast.success(`تم استيراد ${parsed.length} صنف`);
    } catch (e) {
      console.error(e);
      toast.error('فشل قراءة الملف');
    }
  };

  return (
    <div className="space-y-4 p-4" dir="rtl">
      <Card className="border-primary/20">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Combine className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-lg font-bold">مونتاج — توزيع الصنف داخل شيت الطباعة</h2>
              <p className="text-xs text-muted-foreground">أداة إنتاج داخلية فقط — بدون أي حسابات تكلفة</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleImport(f);
                  e.target.value = '';
                }}
              />
              <Button size="sm" variant="outline" asChild>
                <span><Upload className="w-4 h-4 ml-1" />استيراد Excel</span>
              </Button>
            </label>
            <Button size="sm" variant="outline" onClick={downloadMontageTemplate}>
              <Download className="w-4 h-4 ml-1" />نموذج Excel
            </Button>
            <Button size="sm" variant="outline" onClick={reset}>
              <RotateCcw className="w-4 h-4 ml-1" />تفريغ
            </Button>
            <Button size="sm" onClick={add}>
              <Plus className="w-4 h-4 ml-1" />إضافة صنف
            </Button>
          </div>
        </CardContent>
      </Card>

      {items.map((item, idx) => (
        <MontageItemCard
          key={item.id}
          index={idx}
          item={item}
          onChange={p => update(item.id, p)}
          onRemove={() => remove(item.id)}
          onDuplicate={() => duplicate(item.id)}
          canRemove={items.length > 1}
        />
      ))}
    </div>
  );
};

/* ───────── Single item card ───────── */

interface ItemCardProps {
  index: number;
  item: MontageItem;
  onChange: (patch: Partial<MontageItem>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  canRemove: boolean;
}

const MontageItemCard = ({ index, item, onChange, onRemove, onDuplicate, canRemove }: ItemCardProps) => {
  /* ── Auto-fill press sheet from base sheet ──
   * Triggers when base changes AND press is empty or still matches the
   * previous auto-suggestion (so manual edits aren't overwritten). */
  const lastBaseRef = useRef<{ w: number; h: number }>({ w: item.baseW, h: item.baseH });
  useEffect(() => {
    const baseChanged = item.baseW !== lastBaseRef.current.w || item.baseH !== lastBaseRef.current.h;
    lastBaseRef.current = { w: item.baseW, h: item.baseH };
    if (!baseChanged) return;
    if (item.baseW <= 0 || item.baseH <= 0) return;

    const pressIsEmpty = item.pressW <= 0 && item.pressH <= 0;
    const pressMatchesAuto =
      item.autoPressW != null && item.autoPressH != null &&
      item.pressW === item.autoPressW && item.pressH === item.autoPressH;

    if (pressIsEmpty || pressMatchesAuto) {
      const s = suggestPress(item.baseW, item.baseH, item.itemW, item.itemH);
      if (s) onChange({ pressW: s.w, pressH: s.h, autoPressW: s.w, autoPressH: s.h });
    }
  }, [item.baseW, item.baseH]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = item.itemW > 0 && item.itemH > 0 && item.pressW > 0 && item.pressH > 0;
  const hasBase = item.baseW > 0 && item.baseH > 0;

  // SmartSheetLayoutPreview requires a master sheet. When base sheet isn't
  // entered, fall back to using the press sheet as the master (1:1 split).
  const masterW = hasBase ? item.baseW : item.pressW;
  const masterH = hasBase ? item.baseH : item.pressH;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-base">صنف #{index + 1}{item.name ? ` — ${item.name}` : ''}</h3>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={onDuplicate} title="نسخ">
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onRemove}
              disabled={!canRemove}
              title="حذف"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Two-column layout: inputs (left) + smart layout (right) */}
        <div className="grid gap-4 lg:grid-cols-5">
          {/* ── Left: inputs ── */}
          <div className="lg:col-span-2 space-y-4">
            <Field label="اسم الصنف">
              <Input
                value={item.name}
                onChange={e => onChange({ name: e.target.value })}
                placeholder="اختياري"
              />
            </Field>

            <SectionRow title="مقاس الصنف">
              <NumField label="عرض الصنف (سم)" value={item.itemW} onChange={v => onChange({ itemW: v })} />
              <NumField label="ارتفاع الصنف (سم)" value={item.itemH} onChange={v => onChange({ itemH: v })} />
            </SectionRow>

            <SectionRow title="مقاس شيت الورق">
              <NumField label="عرض شيت الورق (سم)" value={item.baseW} onChange={v => onChange({ baseW: v })} />
              <NumField label="ارتفاع شيت الورق (سم)" value={item.baseH} onChange={v => onChange({ baseH: v })} />
            </SectionRow>

            <SectionRow
              title="مقاس شيت الطباعة"
              hint={hasBase ? 'تم اقتراحه تلقائيًا — يمكن تعديله' : undefined}
            >
              <NumField
                label="عرض شيت الطباعة (سم)"
                value={item.pressW}
                onChange={v => onChange({ pressW: v, autoPressW: undefined, autoPressH: undefined })}
              />
              <NumField
                label="ارتفاع شيت الطباعة (سم)"
                value={item.pressH}
                onChange={v => onChange({ pressH: v, autoPressW: undefined, autoPressH: undefined })}
              />
            </SectionRow>
          </div>

          {/* ── Right: smart layout (same component used in تكلفة صنف) ── */}
          <div className="lg:col-span-3 space-y-4">
            {!ready ? (
              <div className="border border-dashed rounded-lg p-10 text-center text-sm text-muted-foreground">
                أدخل مقاس الصنف ومقاس شيت الطباعة لعرض التوزيع الذكي.
              </div>
            ) : (
              <SmartSheetLayoutPreview
                sheetW={masterW}
                sheetH={masterH}
                pressW={item.pressW}
                pressH={item.pressH}
                productW={item.itemW}
                productH={item.itemH}
                quantity={0}
                onPressSizeChange={(w, h) => onChange({ pressW: w, pressH: h, autoPressW: w, autoPressH: h })}
              />
            )}
          </div>
        </div>

      </CardContent>
    </Card>
  );
};

/* ───────── Helpers ───────── */

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <Label className="text-xs">{label}</Label>
    {children}
  </div>
);

const NumField = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
  <Field label={label}>
    <Input
      type="number"
      inputMode="decimal"
      min={0}
      value={value || ''}
      onChange={e => onChange(Number(e.target.value) || 0)}
      onFocus={e => e.target.select()}
    />
  </Field>
);

const SectionRow = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <div className="rounded-md border bg-muted/20 p-3 space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-foreground">{title}</span>
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </div>
    <div className="grid grid-cols-2 gap-2">{children}</div>
  </div>
);



export default MontageCalculator;
