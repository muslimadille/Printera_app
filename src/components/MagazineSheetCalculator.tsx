/**
 * MagazineSheetCalculator — تبويبة "حساب المجلة" (جديدة، مستقلة)
 *
 * مرجع المنطق: ملف_حساب_المجلات_مع_الغلاف.xlsx
 * المحرك النقي: src/lib/magazineCalcEngine.ts
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { usePrintingStore, type PaperType } from '@/store/printingStore';

/** Persisted state key for "حساب المجلة" tab (per-user scoping done at runtime) */
const MAG_SHEET_DRAFT_KEY = 'printCalc_draft_magazineSheet';

const loadDraft = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch { return fallback; }
};
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BookOpen, ChevronDown, Sparkles, AlertTriangle, Check, Plus, Trash2, Settings2, Info, Save } from 'lucide-react';
import ProfitMargins from '@/components/ProfitMargins';
import PdfActions from '@/components/pdf/PdfActions';
import { generatePdfFromHtml } from '@/lib/pdf/pdfService';
import { saveQuote, updateQuote } from '@/lib/userApi';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { calcTypeLabels } from '@/lib/calcTypeLabels';
import {
  buildMagazineScenarios,
  computeFoldedSheet,
  validatePagesCount,
  getActivePaperPricing,
  type MagazineCalcInputs,
  type MagazineFinishing,
  type FacesMode,
} from '@/lib/magazineCalcEngine';

interface Props {
  onNavigateToQuote?: () => void;
  sessionToken?: string;
}

/* ── Paper Combobox ── */
const PaperCombobox = ({
  paperTypes, value, onChange, placeholder = 'اختر نوع الورق',
}: {
  paperTypes: PaperType[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) => {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => {
    const list: { label: string; value: string }[] = [];
    paperTypes.forEach(pt => {
      pt.entries.forEach(e => {
        const label = `${pt.name} - ${e.grammage}جم - ${e.sizeName}`;
        const val = `${pt.name}|${e.grammage}|${e.sizeName}`;
        list.push({ label, value: val });
      });
    });
    return list;
  }, [paperTypes]);
  const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between h-9 text-sm font-normal">
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[360px] p-0" align="start">
        <Command>
          <CommandInput placeholder="ابحث..." className="h-9" />
          <CommandList>
            <CommandEmpty>لا يوجد ورق</CommandEmpty>
            <CommandGroup>
              {options.map(o => (
                <CommandItem key={o.value} value={o.label} onSelect={() => { onChange(o.value); setOpen(false); }}>
                  <Check className={`ml-2 h-4 w-4 ${value === o.value ? 'opacity-100' : 'opacity-0'}`} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

/* ── Decode paper combobox value → triple ── */
const decodePaper = (v: string): { name: string; grammage: number | null; sizeName: string } => {
  if (!v) return { name: '', grammage: null, sizeName: '' };
  const [name, g, sizeName] = v.split('|');
  return { name: name || '', grammage: g ? Number(g) : null, sizeName: sizeName || '' };
};

/** عرض جميع الأرقام بالأرقام الإنجليزية (en-US) داخل تبويبة حساب المجلة. */
const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const fmtInt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

/** يلخّص توزيع الملازم بشكل مبسّط: مثل "2 ملازم (16 + 4) صفحة". */
const summarizeSignatures = (
  breakdown: { pages: number; sheetsPerCopy: number }[] | undefined,
): string => {
  if (!breakdown || breakdown.length === 0) return '—';
  const total = breakdown.length;
  const pagesList = breakdown.map((s) => s.pages).join(' + ');
  const label = total === 1 ? 'ملزمة' : total === 2 ? 'ملزمتين' : `${total} ملازم`;
  return `${label} (${pagesList}) صفحة`;
};

/** يبني HTML تقرير تفاصيل الملازم — يُحوَّل إلى PDF حقيقي عبر pdfService. */
const buildSignaturesPdfHtml = (
  sel: any,
  opts?: { innerPaper?: string; coverPaper?: string },
): string | null => {
  if (!sel?.innerSignaturesBreakdown?.length) return null;
  const fmtN = (n: number) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const fmtI = (n: number) => Math.round(Number(n || 0)).toLocaleString('en-US');
  const inP = decodePaper(opts?.innerPaper || '');
  const cvP = decodePaper(opts?.coverPaper || '');
  const innerPaperLabel = inP.name
    ? `${inP.name}${inP.grammage ? ` - ${inP.grammage} جم` : ''}`
    : '—';
  const coverPaperLabel = cvP.name
    ? `${cvP.name}${cvP.grammage ? ` - ${cvP.grammage} جم` : ''}`
    : '—';
  const rows = sel.innerSignaturesBreakdown.map((sig: any, i: number) => {
    // كاملة = شيت كامل على ماكينتها (sheetsPerCopy >= 1)، وإلا فهي جزئية
    const isFull = sig.sheetsPerCopy >= 1 - 1e-9;
    const sheets = Math.ceil(sig.sheetsPerCopy * sel.innerPrintQtyPerSig);
    return `<tr class="${isFull ? '' : 'partial'}">
      <td class="num">${i + 1}</td>
      <td>${isFull ? 'كاملة' : 'جزئية'}</td>
      <td class="num">${fmtI(sig.pages)}</td>
      <td class="num">${fmtI(sheets)}</td>
      <td class="num">${fmtI(sig.machineWidth)}×${fmtI(sig.machineHeight)} سم</td>
      <td>${inP.name || '—'}</td>
      <td class="num">${inP.grammage ? `${inP.grammage} جم` : '—'}</td>
    </tr>`;
  }).join('');
  const totalPages = sel.innerSignaturesBreakdown.reduce((a: number, s: any) => a + s.pages, 0);
  const hasCover = !!sel.coverEnabled && (sel.coverPrintSheets > 0 || sel.coverPurchaseSheets > 0);
  const coverSection = hasCover ? `
      <h3 style="margin:14pt 0 6pt; font-size:11pt; color:#1e3a8a;">الغلاف</h3>
      <table>
        <thead><tr>
          <th style="width:25%">نوع الورق</th>
          <th style="width:15%">الجرامية</th>
          <th style="width:20%">شيتات الطباعة</th>
          <th style="width:20%">شيتات الشراء</th>
          <th style="width:20%">مقاس شيت الشراء</th>
        </tr></thead>
        <tbody><tr>
          <td>${cvP.name || '—'}</td>
          <td class="num">${cvP.grammage ? `${cvP.grammage} جم` : '—'}</td>
          <td class="num">${fmtI(sel.coverPrintSheets)}</td>
          <td class="num">${fmtI(sel.coverPurchaseSheets)}</td>
          <td>${cvP.sizeName || '—'}</td>
        </tr></tbody>
      </table>` : '';
  const today = new Date().toLocaleDateString('en-GB');
  const logoUrl = `${window.location.origin}/favicon.png`;
  const brandName = 'حاسبة تسعير الطباعة';
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
    <title>تفاصيل الملازم - ${sel.machineSizeName || ''}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      /* مساحات ثابتة محجوزة للترويسة (28mm) والتذييل (18mm) في كل صفحة */
      @page {
        size: A4;
        margin: 32mm 14mm 22mm 14mm;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: 'Cairo', Tahoma, Arial, sans-serif;
        color: #0f172a;
        font-size: 10.5pt;
        line-height: 1.5;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      /* ترويسة وتذييل ثابتة تتكرر على كل الصفحات عند الطباعة */
      .pdf-header {
        position: fixed;
        top: 0; left: 0; right: 0;
        height: 26mm;
        padding: 4mm 14mm;
        background: #fff;
        border-bottom: 2pt solid #1e3a8a;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8mm;
      }
      .pdf-header .brand { display: flex; align-items: center; gap: 8pt; }
      .pdf-header .brand img { height: 16mm; width: 16mm; object-fit: contain; }
      .pdf-header .brand .titles { display: flex; flex-direction: column; line-height: 1.2; }
      .pdf-header .brand .name { font-size: 13pt; font-weight: 700; color: #1e3a8a; }
      .pdf-header .brand .sub { font-size: 9pt; color: #64748b; }
      .pdf-header .doc { text-align: left; font-size: 9pt; color: #64748b; }
      .pdf-header .doc .title { font-size: 11pt; font-weight: 600; color: #0f172a; }

      .pdf-footer {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        height: 16mm;
        padding: 4mm 14mm;
        border-top: 1pt solid #cbd5e1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 8.5pt;
        color: #64748b;
        background: #fff;
      }
      .pdf-footer .pageNum::after { content: counter(page) " / " counter(pages); }

      /* المحتوى الرئيسي بعد المساحة المحجوزة */
      main { display: block; }

      .meta {
        display: grid; grid-template-columns: repeat(3, 1fr); gap: 6pt;
        background: #f8fafc; border: 1pt solid #e2e8f0; border-radius: 4pt;
        padding: 8pt 10pt; margin: 0 0 10pt; font-size: 10pt;
      }
      .meta .item { display: flex; flex-direction: column; }
      .meta .label { color: #64748b; font-size: 9pt; }
      .meta .val { color: #0f172a; font-weight: 600; }

      table { width: 100%; border-collapse: collapse; font-size: 10pt; page-break-inside: auto; }
      thead { display: table-header-group; background: #1e3a8a; color: #fff; }
      tfoot { display: table-footer-group; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      th, td {
        border: 0.75pt solid #cbd5e1; padding: 5pt 7pt; text-align: right;
        vertical-align: middle;
      }
      th { font-weight: 600; font-size: 10pt; }
      tbody tr:nth-child(even) td { background: #f8fafc; }
      tr.partial td { background: #fef3c7 !important; }
      tr.partial td:nth-child(2) { font-weight: 700; color: #92400e; }
      tfoot td { background: #e2e8f0; font-weight: 700; }
      .num { font-variant-numeric: tabular-nums; }

      /* في وضع الشاشة فقط: تعويض المساحة العلوية والسفلية لمحاكاة الطباعة */
      @media screen {
        body { background: #f1f5f9; padding: 32mm 14mm 22mm; }
        main { background: #fff; padding: 8mm; max-width: 210mm; margin: 0 auto; min-height: 200mm; }
      }
    </style></head><body>
    <div class="pdf-header">
      <div class="brand">
        <img src="${logoUrl}" alt="logo" onerror="this.style.display='none'"/>
        <div class="titles">
          <span class="name">${brandName}</span>
          <span class="sub">تقرير تفاصيل الملازم</span>
        </div>
      </div>
      <div class="doc">
        <div>التاريخ: ${today}</div>
      </div>
    </div>

    <div class="pdf-footer">
      <span>تم التوليد تلقائياً من حاسبة المجلة</span>
      <span class="pageNum">صفحة </span>
    </div>

    <main>
      <div class="meta">
        <div class="item"><span class="label">عدد الملازم</span><span class="val num">${fmtI(sel.innerSignaturesBreakdown.length)}</span></div>
        <div class="item"><span class="label">إجمالي شيتات الطباعة</span><span class="val num">${fmtI(sel.innerPrintSheets)}</span></div>
        <div class="item"><span class="label">إجمالي شيتات الشراء</span><span class="val num">${fmtI(sel.innerPurchaseSheets)}</span></div>
      </div>
      <h3 style="margin:6pt 0 6pt; font-size:11pt; color:#1e3a8a;">الداخل</h3>
      <table>
        <thead><tr>
          <th style="width:6%">#</th>
          <th style="width:10%">النوع</th>
          <th style="width:14%">صفحات/ملزمة</th>
          <th style="width:16%">شيتات الطباعة</th>
          <th style="width:20%">مقاس شيت الطباعة</th>
          <th style="width:22%">نوع الورق</th>
          <th style="width:12%">الجرامية</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
          <td colspan="2">الإجمالي</td>
          <td class="num">${fmtI(totalPages)}</td>
          <td class="num">${fmtI(sel.innerPrintSheets)}</td>
          <td>—</td>
          <td>${inP.name || '—'}</td>
          <td class="num">${inP.grammage ? `${inP.grammage} جم` : '—'}</td>
        </tr></tfoot>
      </table>
      ${coverSection}
    </main>
    </body></html>`;
  return html;
};

/** شارة توضح وحدة التسعير الفعلية (رزمة/طن) المأخوذة تلقائيًا من إعدادات المستخدم. */
const PricingUnitBadge = ({
  paperTypes, value,
}: { paperTypes: PaperType[]; value: string }) => {
  const dec = value ? value.split('|') : [];
  if (dec.length < 3) return null;
  const info = getActivePaperPricing(paperTypes, dec[0], dec[1] ? Number(dec[1]) : null, dec[2]);
  if (!info) return null;
  const unitLabel = info.unit === 'ream' ? 'رزمة' : 'طن';
  const detail = info.unit === 'ream'
    ? `${fmt(info.pricePerReam || 0)} / ${fmtInt(info.sheetsPerReam || 0)} ورقة`
    : `${fmt(info.pricePerTon || 0)} للطن`;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px]">
      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
        التسعير: {unitLabel} (تلقائي من الإعدادات)
      </span>
      <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">{detail}</span>
      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
        سعر الشيت: {fmt(info.pricePerSheet)}
      </span>
    </div>
  );
};

/** صف موحّد: عنوان (يمين) + مدخل (يسار) — مطابق لتصميم تبويبة التحكم الذكي. */
const Field = ({
  label, hint, children, wide = false,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  /** عند true: العنوان أعرض (5/12) — للحقول التي تحتاج شرحًا. */
  wide?: boolean;
}) => (
  <div className="grid grid-cols-12 items-center gap-3">
    <Label className={`text-xs ${wide ? 'col-span-5' : 'col-span-4'} text-right leading-tight`}>
      {label}
      {hint && (
        <span className="block text-[10px] font-normal text-muted-foreground mt-0.5">{hint}</span>
      )}
    </Label>
    <div className={wide ? 'col-span-7' : 'col-span-8'}>{children}</div>
  </div>
);


/** يبحث عن أول ورق متاح يطابق (الاسم/الجرام/المقاس) — للقيم الافتراضية. */
const findDefaultPaper = (
  paperTypes: PaperType[], name: string, grammage: number, size: string,
): string => {
  const t = paperTypes.find(p => p.name === name);
  if (!t) return '';
  const e = t.entries.find(x => x.grammage === grammage && x.sizeName === size);
  return e ? `${t.name}|${e.grammage}|${e.sizeName}` : '';
};

const MagazineSheetCalculator = ({ onNavigateToQuote, sessionToken }: Props) => {
  const { paperTypes, priceSettings, currentUsername } = usePrintingStore();

  /* ── Per-user draft key ── */
  const draftKey = useMemo(
    () => currentUsername ? `${MAG_SHEET_DRAFT_KEY}_${currentUsername}` : MAG_SHEET_DRAFT_KEY,
    [currentUsername],
  );

  /* ── القيم الافتراضية للورق: كوشيه 115 / 70×100 للداخل، كوشيه 300 / 70×100 للغلاف ── */
  const defaultInnerPaper = useMemo(
    () => findDefaultPaper(paperTypes, 'كوشيه', 115, '70×100'),
    [paperTypes],
  );
  const defaultCoverPaper = useMemo(
    () => findDefaultPaper(paperTypes, 'كوشيه', 300, '70×100'),
    [paperTypes],
  );

  /* ── Default state shape ── */
  const defaultDraft = useMemo(() => ({
    pageW: 21, pageH: 30, pagesCount: 16, quantity: 1000,
    innerFacesMode: 'different' as FacesMode, innerColors: 4 as 0|1|2|3|4,
    innerPaper: defaultInnerPaper,
    innerDiecut: false, innerMold: 0,
    innerCellophane: 0 as 0|1|2,
    wasteMode: 'count' as 'count' | 'percent',
    wasteCount: 0, wastePercent: 0,
    coverEnabled: false,
    coverPaper: defaultCoverPaper,
    coverColors: 4 as 0|1|2|3|4,
    coverFacesMode: 'different' as FacesMode,
    coverPrintFaces: 2 as 1 | 2,
    coverMachineSize: '' as string,
    coverDiecut: false, coverMold: 0,
    coverCellophane: 0 as 0|1|2,
    finishingInner: [] as MagazineFinishing[],
    finishingCover: [] as MagazineFinishing[],
    selectedIdx: 0,
  }), [defaultInnerPaper, defaultCoverPaper]);

  const initialDraft = useMemo(() => loadDraft(draftKey, defaultDraft), [draftKey, defaultDraft]);

  /* ── State: inputs (initialized from draft) ── */
  const [pageW, setPageW] = useState(initialDraft.pageW);
  const [pageH, setPageH] = useState(initialDraft.pageH);
  const [pagesCount, setPagesCount] = useState(initialDraft.pagesCount);
  const [quantity, setQuantity] = useState(initialDraft.quantity);
  const [innerFacesMode, setInnerFacesMode] = useState<FacesMode>(initialDraft.innerFacesMode);
  const [innerColors, setInnerColors] = useState<0 | 1 | 2 | 3 | 4>(initialDraft.innerColors);
  const [innerPaper, setInnerPaper] = useState(initialDraft.innerPaper || defaultInnerPaper);
  const [innerDiecut, setInnerDiecut] = useState(initialDraft.innerDiecut);
  const [innerMold, setInnerMold] = useState(initialDraft.innerMold);
  const [innerCellophane, setInnerCellophane] = useState<0 | 1 | 2>(initialDraft.innerCellophane);

  /* الهدر: نمط (count/percent) + قيمة لكلٍّ منهما */
  const [wasteMode, setWasteMode] = useState<'count' | 'percent'>(initialDraft.wasteMode ?? 'count');
  const [wasteCount, setWasteCount] = useState<number>(initialDraft.wasteCount ?? 0);
  const [wastePercent, setWastePercent] = useState<number>(initialDraft.wastePercent ?? 0);

  /* Cover */
  const [coverEnabled, setCoverEnabled] = useState(initialDraft.coverEnabled);
  const [coverPaper, setCoverPaper] = useState(initialDraft.coverPaper || defaultCoverPaper);
  const [coverColors, setCoverColors] = useState<0 | 1 | 2 | 3 | 4>(initialDraft.coverColors);
  const [coverFacesMode, setCoverFacesMode] = useState<FacesMode>(initialDraft.coverFacesMode);
  const [coverPrintFaces, setCoverPrintFaces] = useState<1 | 2>(initialDraft.coverPrintFaces ?? 2);
  const [coverMachineSize, setCoverMachineSize] = useState<string>(initialDraft.coverMachineSize ?? '');
  const [coverDiecut, setCoverDiecut] = useState(initialDraft.coverDiecut);
  const [coverMold, setCoverMold] = useState(initialDraft.coverMold);
  const [coverCellophane, setCoverCellophane] = useState<0 | 1 | 2>(initialDraft.coverCellophane);

  /* Finishing — مفصول: داخل / غلاف */
  const [finishingInner, setFinishingInner] = useState<MagazineFinishing[]>(initialDraft.finishingInner ?? []);
  const [finishingCover, setFinishingCover] = useState<MagazineFinishing[]>(initialDraft.finishingCover ?? []);

  /* ── Derived ── */
  const pagesCheck = validatePagesCount(pagesCount);
  const folded = computeFoldedSheet(pageW, pageH);

  /**
   * تحويل الهدر إلى نسبة قبل تمريرها للمحرك:
   *  - وضع "العدد": النسبة = العدد / كمية أوراق الطباعة المتوقعة × 100
   *    (نقدّر شيتات الطباعة من ملازم × كمية/ملزمة عبر تقريب بسيط بناءً على
   *    أكبر ماكينة متاحة. التقدير يكفي للتحويل لأن المحرك يعيد التطبيق على
   *    شيتات الطباعة الفعلية لكل سيناريو.)
   *  - وضع "النسبة": تُمرَّر النسبة كما هي.
   */
  const estimatedPrintSheets = useMemo(() => {
    // تقدير بسيط: ملزمة كاملة = كمية، ملازم ≈ ceil(صفحات / 4) / 1
    const sigsApprox = Math.max(1, Math.ceil(pagesCount / 4));
    const qtyPerSig = innerFacesMode === 'different' ? quantity : Math.ceil(quantity / 2);
    return sigsApprox * qtyPerSig;
  }, [pagesCount, quantity, innerFacesMode]);

  const effectiveWastePercent = useMemo(() => {
    if (wasteMode === 'percent') return wastePercent;
    if (estimatedPrintSheets <= 0) return 0;
    return (wasteCount / estimatedPrintSheets) * 100;
  }, [wasteMode, wastePercent, wasteCount, estimatedPrintSheets]);

  const calcInputs: MagazineCalcInputs = useMemo(() => {
    const inP = decodePaper(innerPaper);
    const cvP = decodePaper(coverPaper);
    return {
      inner: {
        pageWidth: pageW, pageHeight: pageH, pagesCount, quantity,
        facesMode: innerFacesMode, colorCount: innerColors,
        paperType: inP.name, grammage: inP.grammage, purchaseSize: inP.sizeName,
        diecut: innerDiecut, diecutMoldPrice: innerMold,
        cellophaneFaces: innerCellophane,
        wastePercent: effectiveWastePercent,
      },
      cover: {
        enabled: coverEnabled,
        paperType: cvP.name, grammage: cvP.grammage, purchaseSize: cvP.sizeName,
        colorCount: coverColors, facesMode: coverFacesMode,
        printFaces: coverPrintFaces,
        machineSizeName: coverMachineSize || undefined,
        diecut: coverDiecut, diecutMoldPrice: coverMold,
        cellophaneFaces: coverCellophane,
      },
      finishing: [
        ...finishingInner.map(f => ({ ...f, scope: 'inner' as const })),
        ...finishingCover.map(f => ({ ...f, scope: 'cover' as const })),
      ],
    };
  }, [pageW, pageH, pagesCount, quantity, innerFacesMode, innerColors, innerPaper,
      innerDiecut, innerMold, innerCellophane, effectiveWastePercent,
      coverEnabled, coverPaper, coverColors, coverFacesMode, coverPrintFaces,
      coverMachineSize, coverDiecut, coverMold, coverCellophane,
      finishingInner, finishingCover]);

  const scenarios = useMemo(
    () => buildMagazineScenarios({ inputs: calcInputs, paperTypes, priceSettings }),
    [calcInputs, paperTypes, priceSettings],
  );

  const [selectedIdx, setSelectedIdx] = useState(initialDraft.selectedIdx ?? 0);
  const [showSigDetails, setShowSigDetails] = useState(false);
  const selected = scenarios[Math.min(selectedIdx, Math.max(0, scenarios.length - 1))] || null;

  /* ── Auto-save full draft (debounced) so tab restores on return/refresh ── */
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          pageW, pageH, pagesCount, quantity,
          innerFacesMode, innerColors, innerPaper, innerDiecut, innerMold,
          innerCellophane, wasteMode, wasteCount, wastePercent,
          coverEnabled, coverPaper, coverColors, coverFacesMode, coverPrintFaces,
          coverMachineSize, coverDiecut, coverMold, coverCellophane,
          finishingInner, finishingCover, selectedIdx,
        }));
      } catch {}
    }, 300);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [draftKey, pageW, pageH, pagesCount, quantity, innerFacesMode, innerColors,
      innerPaper, innerDiecut, innerMold, innerCellophane,
      wasteMode, wasteCount, wastePercent,
      coverEnabled, coverPaper, coverColors, coverFacesMode, coverPrintFaces,
      coverMachineSize, coverDiecut, coverMold, coverCellophane,
      finishingInner, finishingCover, selectedIdx]);

  /* ── Finishing helpers (مكرّرة لكلٍ من الداخل والغلاف) ── */
  const makeFinishingHandlers = (
    list: MagazineFinishing[],
    setList: React.Dispatch<React.SetStateAction<MagazineFinishing[]>>,
  ) => ({
    update: (i: number, patch: Partial<MagazineFinishing>) =>
      setList(prev => prev.map((f, idx) => idx === i ? { ...f, ...patch } : f)),
    add: () => setList(prev => [...prev, {
      name: `تشطيب ${prev.length + 1}`, enabled: true, calcType: 'per_1000',
      multiplier: 1, pricePerUnit: 0, extraPer1000: 0,
    }]),
    remove: (i: number) => setList(prev => prev.filter((_, idx) => idx !== i)),
  });
  const innerFinHandlers = useMemo(
    () => makeFinishingHandlers(finishingInner, setFinishingInner),
    [finishingInner],
  );
  const coverFinHandlers = useMemo(
    () => makeFinishingHandlers(finishingCover, setFinishingCover),
    [finishingCover],
  );

  /* ── Collapsible open states ── */
  const [openAdditional, setOpenAdditional] = useState(false);
  const [openInnerFin, setOpenInnerFin] = useState(false);
  const [openCoverFin, setOpenCoverFin] = useState(false);

  /* ── Save Quote ── */
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemNumber, setItemNumber] = useState('');

  const grandTotal = selected?.totalCost || 0;

  const handleSave = useCallback(async () => {
    if (!sessionToken) { toast.error('يجب تسجيل الدخول أولاً'); return; }
    if (!selected) { toast.error('لا توجد نتيجة لحفظها'); return; }
    if (!itemName.trim()) { toast.error('يجب إدخال اسم الصنف'); return; }
    setSaving(true);
    try {
      const quoteData = {
        sourceType: 'magazinesheet',
        rawInputs: {
          pageW, pageH, pagesCount, quantity,
          innerFacesMode, innerColors, innerPaper, innerDiecut, innerMold, innerCellophane,
          wasteMode, wasteCount, wastePercent,
          coverEnabled, coverPaper, coverColors, coverFacesMode, coverPrintFaces,
          coverMachineSize, coverDiecut, coverMold, coverCellophane,
          finishingInner, finishingCover, selectedIdx,
        },
        itemName,
        itemNumber,
        itemSize: `${pageW}×${pageH}`,
        grandTotal,
      };
      const title = itemName || `مجلة - ${pagesCount} صفحة`;
      if (editingQuoteId) {
        await updateQuote(sessionToken, editingQuoteId, { title, customer_name: itemName, quote_number: itemNumber, quote_data: quoteData });
        toast.success('تم تحديث التكلفة بنجاح');
      } else {
        const saved = await saveQuote(sessionToken, { title, customer_name: itemName, quote_number: itemNumber, source_type: 'magazinesheet', quote_data: quoteData });
        setEditingQuoteId(saved.id);
        toast.success('تم حفظ التكلفة بنجاح');
      }
      setSaveOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ في الحفظ');
    } finally { setSaving(false); }
  }, [selected, itemName, itemNumber, pageW, pageH, pagesCount, quantity,
      innerFacesMode, innerColors, innerPaper, innerDiecut, innerMold, innerCellophane,
      wasteMode, wasteCount, wastePercent,
      coverEnabled, coverPaper, coverColors, coverFacesMode, coverPrintFaces,
      coverMachineSize, coverDiecut, coverMold, coverCellophane,
      finishingInner, finishingCover, selectedIdx, grandTotal, editingQuoteId, sessionToken]);

  const machineSizes = priceSettings.sizes;

  return (
    <div dir="rtl" className="space-y-4 sm:space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <BookOpen className="w-5 h-5 text-primary" />
            حساب المجلة
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 min-w-0 w-full calc-shell">
        {/* ── العمود الأيمن: المدخلات ── */}
        <div className="lg:col-span-7 space-y-4">
          {/* المدخلات الأساسية للداخل */}
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">بيانات الداخل</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* مجموعة: المقاس والكمية */}
              <div className="space-y-3 pb-3">
              {/* مقاس الصفحة (عرض × طول) */}
              <Field label="مقاس الصفحة (سم)">
                <div className="flex items-center gap-2">
                  <Input type="number" inputMode="decimal" value={pageW || ''}
                    onChange={e => setPageW(Number(e.target.value) || 0)}
                    onFocus={e => e.target.select()}
                    className="h-9 text-sm flex-1" placeholder="عرض" />
                  <span className="text-xs text-muted-foreground font-bold">x</span>
                  <Input type="number" inputMode="decimal" value={pageH || ''}
                    onChange={e => setPageH(Number(e.target.value) || 0)}
                    onFocus={e => e.target.select()}
                    className="h-9 text-sm flex-1" placeholder="طول" />
                </div>
              </Field>

              {/* عدد الصفحات + الكمية في صف واحد */}
              <Field label="الصفحات / الكمية">
                <div className="flex items-center gap-2">
                  <Input type="number" inputMode="numeric" value={pagesCount || ''}
                    onChange={e => setPagesCount(Number(e.target.value) || 0)}
                    onFocus={e => e.target.select()}
                    className={`h-9 text-sm flex-1 ${!pagesCheck.ok ? 'border-destructive' : ''}`}
                    placeholder="صفحات" />
                  <span className="text-xs text-muted-foreground">×</span>
                  <Input type="number" inputMode="numeric" value={quantity || ''}
                    onChange={e => setQuantity(Number(e.target.value) || 0)}
                    onFocus={e => e.target.select()}
                    className="h-9 text-sm flex-1" placeholder="نسخة" />
                </div>
              </Field>
              </div>

              {/* مجموعة: الورق */}
              <div className="space-y-3 py-3 border-t border-border/50">
              {/* نوع الورق */}
              <Field label="نوع الورق">
                <PaperCombobox paperTypes={paperTypes} value={innerPaper} onChange={setInnerPaper} />
              </Field>
              {innerPaper && (
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-4" />
                  <div className="col-span-8">
                    <PricingUnitBadge paperTypes={paperTypes} value={innerPaper} />
                  </div>
                </div>
              )}
              </div>

              {/* مجموعة: الألوان */}
              <div className="space-y-3 py-3 border-t border-border/50">
              {/* الألوان + نوع الوجهين في صف */}
              <Field label="الألوان">
                <div className="flex items-center gap-2">
                  <Select value={String(innerColors)} onValueChange={v => setInnerColors(Number(v) as 0|1|2|3|4)}>
                    <SelectTrigger className="h-9 text-sm flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4].map(n => <SelectItem key={n} value={String(n)}>{n} لون</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={innerFacesMode} onValueChange={v => setInnerFacesMode(v as FacesMode)}>
                    <SelectTrigger className="h-9 text-sm flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="different">وجهين مختلفين</SelectItem>
                      <SelectItem value="identical">وجهين متطابقين</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Field>
              </div>

              {/* البيانات الإضافية — مطوية افتراضيًا */}
              <div className="pt-2 border-t border-border/50">
              <Collapsible open={openAdditional} onOpenChange={setOpenAdditional}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between h-9 px-2 hover:bg-muted">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Settings2 className="w-4 h-4 text-primary" />
                      بيانات إضافية
                      <span className="text-[10px] text-muted-foreground">
                        (السلوفان، التكسير، الهدر)
                      </span>
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${openAdditional ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-3">
                  <Field label="سلوفان الداخل">
                    <Select value={String(innerCellophane)} onValueChange={v => setInnerCellophane(Number(v) as 0|1|2)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">بدون</SelectItem>
                        <SelectItem value="1">وجه واحد</SelectItem>
                        <SelectItem value="2">وجهين</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="تكسير الداخل">
                    <div className="flex items-center gap-3">
                      <Switch checked={innerDiecut} onCheckedChange={setInnerDiecut} id="inner-dc" />
                      {innerDiecut && (
                        <Input type="number" inputMode="decimal" value={innerMold || ''}
                          onChange={e => setInnerMold(Number(e.target.value) || 0)}
                          onFocus={e => e.target.select()}
                          className="h-9 text-sm flex-1" placeholder="قيمة القالب" />
                      )}
                    </div>
                  </Field>

                  {/* الهدر */}
                  <div className="rounded-md bg-muted/40 border border-border p-2 space-y-3">
                    <Field label="طريقة عرض الهدر">
                      <Select value={wasteMode} onValueChange={v => setWasteMode(v as 'count' | 'percent')}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="count">بالعدد (أوراق)</SelectItem>
                          <SelectItem value="percent">بالنسبة %</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    {wasteMode === 'count' ? (
                      <Field label="عدد أوراق الهدر">
                        <Input type="number" inputMode="numeric" value={wasteCount || ''}
                          onChange={e => setWasteCount(Number(e.target.value) || 0)}
                          onFocus={e => e.target.select()} className="h-9 text-sm" />
                      </Field>
                    ) : (
                      <Field label="نسبة الهدر %">
                        <Input type="number" inputMode="decimal" value={wastePercent || ''}
                          onChange={e => setWastePercent(Number(e.target.value) || 0)}
                          onFocus={e => e.target.select()} className="h-9 text-sm" />
                      </Field>
                    )}
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-4" />
                      <div className="col-span-8">
                        <span className="text-[10px] text-muted-foreground">
                          النسبة الفعلية: <strong>{fmt(effectiveWastePercent)}%</strong>
                        </span>
                      </div>
                    </div>
                    {wasteMode === 'percent' && (
                      <Alert className="py-2">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <AlertDescription className="text-[11px]">
                          النسبة تُحسب بناءً على شيتات الطباعة (مماثل لتبويبة حساب الصنف).
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
              </div>

              {/* تفاصيل شرح الداخل — تبقى ظاهرة دائمًا */}
              <div className="flex flex-wrap items-center gap-2 text-xs pt-2 border-t">
                <span className={`px-2 py-1 rounded ${pagesCheck.ok ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-destructive/10 text-destructive'}`}>
                  {pagesCheck.message}
                </span>
                <span className="px-2 py-1 rounded bg-muted">
                  ورقة بعد الطي: <strong>{fmt(folded.width)}×{fmt(folded.height)}</strong> سم
                </span>
                <span className="px-2 py-1 rounded bg-muted">
                  أوراق الداخل المنطقية: <strong>{fmtInt(Math.ceil(pagesCount / 4))}</strong>
                </span>
              </div>
            </CardContent>
          </Card>

          {/* الغلاف — Collapsible */}
          <Card className="shadow-sm border-border/60">
            <Collapsible open={coverEnabled} onOpenChange={setCoverEnabled}>
              <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">الغلاف</CardTitle>
                <div className="flex items-center gap-2">
                  <Switch checked={coverEnabled} onCheckedChange={setCoverEnabled} id="cover-en" />
                  <Label htmlFor="cover-en" className="text-xs cursor-pointer">
                    {coverEnabled ? 'مفعّل' : 'بدون غلاف'}
                  </Label>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-3">
                  <Field label="نوع الورق">
                    <PaperCombobox paperTypes={paperTypes} value={coverPaper} onChange={setCoverPaper}
                      placeholder="اختر ورق الغلاف" />
                  </Field>
                  {coverPaper && (
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-4" />
                      <div className="col-span-8">
                        <PricingUnitBadge paperTypes={paperTypes} value={coverPaper} />
                      </div>
                    </div>
                  )}

                  <Field label="مقاس الماكينة + الألوان">
                    <div className="flex items-center gap-2">
                      <Select
                        value={coverMachineSize || '__same__'}
                        onValueChange={v => setCoverMachineSize(v === '__same__' ? '' : v)}
                      >
                        <SelectTrigger className="h-9 text-sm flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__same__">نفس ماكينة الداخل</SelectItem>
                          {machineSizes.map(s => (
                            <SelectItem key={s.sizeName} value={s.sizeName}>{s.sizeName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={String(coverColors)} onValueChange={v => setCoverColors(Number(v) as 0|1|2|3|4)}>
                        <SelectTrigger className="h-9 text-sm w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[0, 1, 2, 3, 4].map(n => <SelectItem key={n} value={String(n)}>{n} لون</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </Field>

                  <Field label="أوجه الطباعة / التصميم">
                    <div className="flex items-center gap-2">
                      <Select value={String(coverPrintFaces)} onValueChange={v => setCoverPrintFaces(Number(v) as 1 | 2)}>
                        <SelectTrigger className="h-9 text-sm flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">طباعة وجه</SelectItem>
                          <SelectItem value="2">طباعة وجهين</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={coverFacesMode} onValueChange={v => setCoverFacesMode(v as FacesMode)}>
                        <SelectTrigger className="h-9 text-sm flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="different">وجهين مختلفين</SelectItem>
                          <SelectItem value="identical">وجهين متطابقين</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </Field>

                  <Field label="سلوفان الغلاف">
                    <Select value={String(coverCellophane)} onValueChange={v => setCoverCellophane(Number(v) as 0|1|2)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">بدون</SelectItem>
                        <SelectItem value="1">وجه واحد</SelectItem>
                        <SelectItem value="2">وجهين</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="تكسير الغلاف">
                    <div className="flex items-center gap-3">
                      <Switch checked={coverDiecut} onCheckedChange={setCoverDiecut} id="cover-dc" />
                      {coverDiecut && (
                        <Input type="number" inputMode="decimal" value={coverMold || ''}
                          onChange={e => setCoverMold(Number(e.target.value) || 0)}
                          onFocus={e => e.target.select()}
                          className="h-9 text-sm flex-1" placeholder="قيمة القالب" />
                      )}
                    </div>
                  </Field>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>


          {/* تشطيبات الداخل — Collapsible (مطوي افتراضيًا) */}
          <Card>
            <Collapsible open={openInnerFin} onOpenChange={setOpenInnerFin}>
              <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 text-base sm:text-lg font-semibold flex-1 text-right hover:text-primary transition-colors">
                    <Sparkles className="w-4 h-4 text-primary" /> تشطيبات الداخل
                    <span className="text-[10px] font-normal text-muted-foreground">
                      ({fmtInt(finishingInner.length)})
                    </span>
                    <ChevronDown className={`w-4 h-4 mr-auto transition-transform ${openInnerFin ? 'rotate-180' : ''}`} />
                  </button>
                </CollapsibleTrigger>
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); innerFinHandlers.add(); setOpenInnerFin(true); }} className="h-8">
                  <Plus className="w-3.5 h-3.5 ml-1" /> إضافة
                </Button>
              </CardHeader>
              <CollapsibleContent>
                <FinishingList
                  list={finishingInner}
                  handlers={innerFinHandlers}
                  emptyText="لا توجد تشطيبات للداخل"
                />
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* تشطيبات الغلاف — Collapsible (مطوي افتراضيًا، تظهر فقط عند تفعيل الغلاف) */}
          {coverEnabled && (
            <Card>
              <Collapsible open={openCoverFin} onOpenChange={setOpenCoverFin}>
                <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 text-base sm:text-lg font-semibold flex-1 text-right hover:text-primary transition-colors">
                      <Sparkles className="w-4 h-4 text-primary" /> تشطيبات الغلاف
                      <span className="text-[10px] font-normal text-muted-foreground">
                        ({fmtInt(finishingCover.length)})
                      </span>
                      <ChevronDown className={`w-4 h-4 mr-auto transition-transform ${openCoverFin ? 'rotate-180' : ''}`} />
                    </button>
                  </CollapsibleTrigger>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); coverFinHandlers.add(); setOpenCoverFin(true); }} className="h-8">
                    <Plus className="w-3.5 h-3.5 ml-1" /> إضافة
                  </Button>
                </CardHeader>
                <CollapsibleContent>
                  <FinishingList
                    list={finishingCover}
                    handlers={coverFinHandlers}
                    emptyText="لا توجد تشطيبات للغلاف"
                  />
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )}
        </div>

        {/* ── العمود الأيسر: السيناريوهات والنتائج ── */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">السيناريوهات حسب المكائن</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {scenarios.length === 0 ? (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription className="text-xs">
                    لا توجد ماكينة تستوعب الورقة بمقاس <strong>{fmt(folded.width)}×{fmt(folded.height)}</strong>.
                    تأكد من إضافة المقاسات المناسبة في الإعدادات.
                  </AlertDescription>
                </Alert>
              ) : (
                scenarios.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedIdx(idx)}
                    className={`w-full text-right p-3 rounded-lg border transition-all ${
                      selectedIdx === idx
                        ? 'bg-primary/10 border-primary shadow-sm'
                        : 'bg-card border-border hover:border-primary/50'
                    } ${s.isSplitRun ? 'border-dashed' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="font-bold text-sm flex items-center gap-1.5">
                        ماكينة {s.machineSizeName}
                        {s.isSplitRun && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold">
                            تشغيل مستقل
                          </span>
                        )}
                      </span>
                      <span className="text-xs font-bold text-primary whitespace-nowrap">
                        {fmt(s.totalCost)} ريال
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed">
                      {s.isSplitRun && s.splitMachineSizeName
                        ? `${summarizeSignatures(s.innerSignaturesBreakdown)} • زائد ${s.splitPagesCount} صفحة على ${s.splitMachineSizeName}`
                        : summarizeSignatures(s.innerSignaturesBreakdown)}
                      {' • سعر النسخة: '}
                      <strong>{fmt(s.pricePerCopy)}</strong>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {/* تفاصيل السيناريو المختار */}
          {selected && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  تفاصيل: ماكينة {selected.machineSizeName}
                  {selected.isSplitRun && selected.splitMachineSizeName && (
                    <span className="ms-2 text-xs font-normal text-amber-700 dark:text-amber-300">
                      + تشغيل مستقل على {selected.splitMachineSizeName}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  {selected.explanation}
                </div>
                {selected.warnings.map((w, i) => (
                  <Alert key={i} variant="destructive" className="py-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <AlertDescription className="text-xs">{w}</AlertDescription>
                  </Alert>
                ))}

                {/* الداخل */}
                <div className="space-y-1">
                  <div className="grid grid-cols-12 items-center gap-2 border-b pb-1 mb-1">
                    <h4 className="col-span-6 text-xs font-bold text-primary">الداخل</h4>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="col-span-6 text-[10px] text-muted-foreground text-left font-mono cursor-help inline-flex items-center gap-1 justify-end">
                          <Info className="w-3 h-3" />
                          ماكينة {selected.machineWidth}×{selected.machineHeight} سم
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        المقاس الأقصى الذي تستوعبه ماكينة الطباعة المختارة (عرض × طول بالسنتيمتر).
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Row
                    label="مقاس شيت الطباعة"
                    value={`${fmt(selected.sheetWidth)}×${fmt(selected.sheetHeight)} سم`}
                    hint="مقاس (عرض × طول بالسنتيمتر)."
                  />
                  <Row
                    label="ملازم"
                    value={fmtInt(selected.innerSignatures)}
                    hint="عدد الملازم المطلوبة لطباعة كامل صفحات الداخل (قد تشمل ملزمة جزئية)."
                  />
                  <Row
                    label="سعة الملزمة الكاملة"
                    value={`${fmtInt(selected.innerPagesPerSignature)} صفحة`}
                    hint="أقصى عدد صفحات يمكن وضعها في ملزمة واحدة على هذه الماكينة بهذا المقاس."
                  />
                  <Row
                    label="توزيع الصفحات"
                    value={summarizeSignatures(selected.innerSignaturesBreakdown)}
                    hint="كيف تم توزيع الصفحات على الملازم: عدد الكاملة + الجزئية إن وجدت."
                  />

                  {/* زر عرض/إخفاء التفاصيل */}
                  {selected.innerSignaturesBreakdown && selected.innerSignaturesBreakdown.length > 0 && (
                    <>
                      <div className="flex flex-wrap justify-end gap-2">
                        <PdfActions
                          size="sm"
                          filename={`تفاصيل-ملازم-${new Date().toISOString().slice(0, 10)}.pdf`}
                          generate={async () => {
                            const html = buildSignaturesPdfHtml(selected, {
                              innerPaper,
                              coverPaper: coverEnabled ? coverPaper : '',
                            });
                            if (!html) throw new Error('لا توجد بيانات للتصدير');
                            return generatePdfFromHtml(html);
                          }}
                          className="[&_button]:h-7 [&_button]:px-2 [&_button]:text-xs"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-primary hover:text-primary"
                          onClick={() => setShowSigDetails((v) => !v)}
                        >
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform ${showSigDetails ? 'rotate-180' : ''}`}
                          />
                          {showSigDetails ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
                        </Button>
                      </div>

                      {showSigDetails && (
                        <div className="mt-1 rounded-md border border-border overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/60 text-muted-foreground">
                              <tr>
                                <th className="px-2 py-1 text-right font-semibold">#</th>
                                <th className="px-2 py-1 text-right font-semibold">النوع</th>
                                <th className="px-2 py-1 text-right font-semibold">صفحات/ملزمة</th>
                                <th className="px-2 py-1 text-right font-semibold">شيتات الطباعة</th>
                                <th className="px-2 py-1 text-right font-semibold">مقاس الشيت</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selected.innerSignaturesBreakdown.map((sig, i) => {
                                // كاملة = شيت كامل على ماكينتها، أما الجزئية فلها كسر شيت فقط
                                const isFull = sig.sheetsPerCopy >= 1 - 1e-9;
                                const sheets = Math.ceil(sig.sheetsPerCopy * selected.innerPrintQtyPerSig);
                                return (
                                  <tr
                                    key={i}
                                    className={`border-t border-border ${
                                      isFull
                                        ? 'odd:bg-background even:bg-muted/20'
                                        : 'bg-amber-500/5'
                                    }`}
                                  >
                                    <td className="px-2 py-1">{i + 1}</td>
                                    <td className="px-2 py-1">
                                      {isFull ? (
                                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">كاملة</span>
                                      ) : (
                                        <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold">جزئية</span>
                                      )}
                                    </td>
                                    <td className="px-2 py-1">{fmtInt(sig.pages)}</td>
                                    <td className="px-2 py-1">{fmtInt(sheets)}</td>
                                    <td className="px-2 py-1 font-mono">{fmtInt(sig.machineWidth)}×{fmtInt(sig.machineHeight)} سم</td>
                                  </tr>
                                );
                              })}
                              <tr className="border-t border-border bg-muted/40 font-bold">
                                <td className="px-2 py-1" colSpan={2}>الإجمالي</td>
                                <td className="px-2 py-1">{fmtInt(selected.innerSignaturesBreakdown.reduce((a, s) => a + s.pages, 0))}</td>
                                <td className="px-2 py-1">{fmtInt(selected.innerPrintSheets)}</td>
                                <td className="px-2 py-1 font-mono">—</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}

                  <Row label="شيتات الطباعة" value={fmtInt(selected.innerPrintSheets)} hint="إجمالي عدد شيتات الطباعة الفعلية للداخل (بدون الهدر)." />
                  <Row label="شيتات الشراء" value={fmtInt(selected.innerPurchaseSheets)} hint="عدد ورقات الشراء المطلوبة بعد إضافة الهدر وحساب التفصيل من ورقة الشراء." />
                  <Row label="تكلفة الورق" value={fmt(selected.innerPaperCost)} hint="تكلفة ورق الداخل = شيتات الشراء × سعر ورقة الشراء." />
                  <Row label="الفرز" value={fmt(selected.innerSortCost)} hint="تكلفة فرز ورق الداخل حسب إعدادات الماكينة." />
                  <Row label="الطباعة" value={fmt(selected.innerPrintCost)} hint="تكلفة الطباعة على الماكينة المختارة لعدد الألوان والأوجه." />
                  {selected.innerCellophaneCost > 0 && <Row label="السلوفان" value={fmt(selected.innerCellophaneCost)} />}
                  {selected.innerDiecutCost > 0 && <Row label="التكسير" value={fmt(selected.innerDiecutCost)} />}
                  {selected.innerMoldCost > 0 && <Row label="قيمة القالب" value={fmt(selected.innerMoldCost)} />}
                </div>

                {/* الغلاف */}
                {selected.coverEnabled && (
                  <div className="space-y-1">
                    <div className="grid grid-cols-12 items-center gap-2 border-b pb-1 mb-1">
                      <h4 className="col-span-12 text-xs font-bold text-primary">الغلاف</h4>
                    </div>
                    <Row label="تكرار/شيت" value={fmtInt(selected.coverRepeatPerSheet)} />
                    <Row label="شيتات الطباعة" value={fmtInt(selected.coverPrintSheets)} />
                    <Row label="شيتات الشراء" value={fmtInt(selected.coverPurchaseSheets)} />
                    <Row label="تكلفة الورق" value={fmt(selected.coverPaperCost)} />
                    <Row label="الفرز" value={fmt(selected.coverSortCost)} />
                    <Row label="الطباعة" value={fmt(selected.coverPrintCost)} />
                    {selected.coverCellophaneCost > 0 && <Row label="السلوفان" value={fmt(selected.coverCellophaneCost)} />}
                    {selected.coverDiecutCost > 0 && <Row label="التكسير" value={fmt(selected.coverDiecutCost)} />}
                    {selected.coverMoldCost > 0 && <Row label="قيمة القالب" value={fmt(selected.coverMoldCost)} />}
                  </div>
                )}

                {/* التشطيبات */}
                {selected.finishingBreakdown.length > 0 && (
                  <div className="space-y-1">
                    <div className="grid grid-cols-12 items-center gap-2 border-b pb-1 mb-1">
                      <h4 className="col-span-12 text-xs font-bold text-primary">التشطيبات</h4>
                    </div>
                    {selected.finishingBreakdown.map((f, i) => (
                      <Row
                        key={i}
                        label={`${f.name}${f.scope === 'inner' ? ' (داخل)' : f.scope === 'cover' ? ' (غلاف)' : ''}`}
                        value={fmt(f.cost)}
                      />
                    ))}
                    <Row label="مجموع التشطيبات" value={fmt(selected.finishingCost)} bold />
                  </div>
                )}

                {/* الإجمالي */}
                <div className="space-y-1 pt-2 border-t-2 border-primary/30">
                  <Row label="الإجمالي النهائي" value={`${fmt(selected.totalCost)} ريال`} bold />
                  <Row label="سعر النسخة" value={`${fmt(selected.pricePerCopy)} ريال`} bold />
                </div>

                {/* هوامش الربح + حفظ التكلفة */}
                <div className="pt-3 border-t border-border/50 space-y-3">
                  <ProfitMargins grandTotal={grandTotal} quantity={quantity} pieceLabel="نسخة" />
                  <Button
                    className="w-full gap-2"
                    onClick={() => setSaveOpen(true)}
                    disabled={grandTotal <= 0}
                  >
                    <Save className="w-4 h-4" /> حفظ التكلفة
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Save Dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>حفظ تكلفة المجلة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">اسم الصنف *</Label>
              <Input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="مثال: مجلة شركة..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">رقم الصنف</Label>
              <Input value={itemNumber} onChange={e => setItemNumber(e.target.value)} placeholder="اختياري" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)} disabled={saving}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving || !itemName.trim()}>
              {saving ? 'جارٍ الحفظ...' : 'حفظ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/** قائمة عناصر تشطيب قابلة لإعادة الاستخدام (داخل/غلاف). */
const FinishingList = ({
  list, handlers, emptyText,
}: {
  list: MagazineFinishing[];
  handlers: { update: (i: number, p: Partial<MagazineFinishing>) => void; add: () => void; remove: (i: number) => void };
  emptyText: string;
}) => (
  <CardContent className="space-y-2">
    {list.length === 0 && (
      <p className="text-xs text-muted-foreground text-center py-3">{emptyText}</p>
    )}
    {list.map((f, i) => (
      <div key={i} className="grid grid-cols-12 gap-2 items-end p-2 rounded-lg bg-muted/30">
        <div className="col-span-12 sm:col-span-3">
          <Label className="text-[10px]">الاسم</Label>
          <Input value={f.name} onChange={e => handlers.update(i, { name: e.target.value })} className="h-8 text-xs" />
        </div>
        <div className="col-span-6 sm:col-span-2">
          <Label className="text-[10px]">النوع</Label>
          <Select value={f.calcType} onValueChange={(v) => handlers.update(i, { calcType: v as MagazineFinishing['calcType'] })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(calcTypeLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-3 sm:col-span-1">
          <Label className="text-[10px]">المتغير</Label>
          <Input type="number" value={f.multiplier || ''} onChange={e => handlers.update(i, { multiplier: Number(e.target.value) || 1 })} className="h-8 text-xs" onFocus={e => e.target.select()} />
        </div>
        <div className="col-span-3 sm:col-span-2">
          <Label className="text-[10px]">السعر</Label>
          <Input type="number" value={f.pricePerUnit || ''} onChange={e => handlers.update(i, { pricePerUnit: Number(e.target.value) || 0 })} className="h-8 text-xs" onFocus={e => e.target.select()} />
        </div>
        <div className="col-span-4 sm:col-span-2">
          <Label className="text-[10px]">ألف إضافي</Label>
          <Input type="number" value={f.extraPer1000 || ''} onChange={e => handlers.update(i, { extraPer1000: Number(e.target.value) || 0 })} className="h-8 text-xs" onFocus={e => e.target.select()} />
        </div>
        <div className="col-span-4 sm:col-span-1 flex items-center gap-1 pt-4">
          <Switch checked={f.enabled} onCheckedChange={v => handlers.update(i, { enabled: v })} />
        </div>
        <div className="col-span-4 sm:col-span-1 pt-4">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handlers.remove(i)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    ))}
  </CardContent>
);

const Row = ({ label, value, bold, hint }: { label: string; value: string; bold?: boolean; hint?: string }) => (
  <div className={`grid grid-cols-12 items-center gap-2 text-xs py-0.5 ${bold ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
    <span className="col-span-5 text-right flex items-center gap-1 justify-end">
      {label}
      {hint && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-muted-foreground/60 hover:text-primary transition-colors">
              <Info className="w-3 h-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">{hint}</TooltipContent>
        </Tooltip>
      )}
    </span>
    <span className="col-span-7 font-mono text-foreground">{value}</span>
  </div>
);

export default MagazineSheetCalculator;
