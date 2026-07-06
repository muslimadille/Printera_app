/**
 * Item-Cost-specific Excel template & parser.
 *
 * Mapping rules (تبويبة "تكلفة صنف"):
 *  - "عرض الصنف"               → عرض الصنف داخل النظام (itemSize)
 *  - "ارتفاع الصنف"             → ارتفاع الصنف داخل النظام (itemSize)
 *  - "عرض شيت الورق (سم)"       → عرض شيت الورق / الشراء (purchaseSize)
 *  - "طول شيت الورق (سم)"       → طول شيت الورق / الشراء (purchaseSize)
 *  - "عرض شيت الطباعة (سم)"     → عرض شيت الطباعة (printWidth)
 *  - "ارتفاع شيت الطباعة (سم)"  → ارتفاع شيت الطباعة (printHeight)
 *
 * Legacy fallbacks accepted (older templates):
 *   "مقاس الصنف", "مقاس الشراء",
 *   "عرض الطباعة (سم)", "طول الطباعة (سم)" — old print headers, now treated
 *      as paper-sheet dims (that's how users were filling them).
 */
import * as XLSX from 'xlsx';
import {
  parseCostCalcExcelMulti as parseSharedMulti,
  type CostCalcImportResult,
} from '@/lib/costCalcExcel';

const itemHeaders = ['اسم الصنف', 'رقم الصنف', 'عرض الصنف', 'ارتفاع الصنف'];

const pieceHeaders = [
  'الكمية', 'نوع الورق', 'الجرامية',
  'عرض شيت الورق (سم)', 'طول شيت الورق (سم)',
  'عرض شيت الطباعة (سم)', 'ارتفاع شيت الطباعة (سم)',
  'عدد الألوان (0-4)', 'ألوان إضافية',
  'الأوجه المطبوعة (1-2)', 'الوجهان مختلفان (نعم/لا)',
  'كمية الهدر', 'نوع الهدر (رقم/نسبة)', 'الهدر في جميع التكاليف (نعم/لا)',
  'أوجه السلفان (0-2)', 'تكسير (نعم/لا)', 'قيمة القالب',
];

const finishingHeaders = (n: number) => {
  const headers: string[] = [];
  for (let i = 1; i <= n; i++) {
    headers.push(
      `تشطيب ${i} - الاسم`,
      `تشطيب ${i} - نوع الحساب`,
      `تشطيب ${i} - عدد المتغيرات`,
      `تشطيب ${i} - سعر الوحدة`,
      `تشطيب ${i} - سعر ألف إضافي`,
    );
  }
  return headers;
};

const MAX_FINISHING = 8;
const allHeaders = [...itemHeaders, ...pieceHeaders, ...finishingHeaders(MAX_FINISHING)];

const sampleRow: Record<string, unknown> = {
  'اسم الصنف': 'كرت بزنس',
  'رقم الصنف': 'ITM-001',
  'عرض الصنف': 9,
  'ارتفاع الصنف': 5,
  'الكمية': 5000,
  'نوع الورق': 'كوشيه',
  'الجرامية': 300,
  'عرض شيت الورق (سم)': 70,
  'طول شيت الورق (سم)': 100,
  'عرض شيت الطباعة (سم)': 50,
  'ارتفاع شيت الطباعة (سم)': 70,
  'عدد الألوان (0-4)': 4,
  'ألوان إضافية': 0,
  'الأوجه المطبوعة (1-2)': 1,
  'الوجهان مختلفان (نعم/لا)': 'لا',
  'كمية الهدر': 0,
  'نوع الهدر (رقم/نسبة)': 'رقم',
  'الهدر في جميع التكاليف (نعم/لا)': 'نعم',
  'أوجه السلفان (0-2)': 1,
  'تكسير (نعم/لا)': 'نعم',
  'قيمة القالب': 150,
  'تشطيب 1 - الاسم': 'ورنيش',
  'تشطيب 1 - نوع الحساب': 'لكل قطعة',
  'تشطيب 1 - عدد المتغيرات': 1,
  'تشطيب 1 - سعر الوحدة': 0.05,
  'تشطيب 1 - سعر ألف إضافي': 0,
};

export function downloadItemCostTemplate() {
  const ws = XLSX.utils.json_to_sheet([sampleRow], { header: allHeaders });
  ws['!cols'] = allHeaders.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'تسعيرة 1');
  const ws2 = XLSX.utils.json_to_sheet([], { header: allHeaders });
  ws2['!cols'] = allHeaders.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, ws2, 'تسعيرة 2');
  XLSX.writeFile(wb, 'نموذج_استيراد_تكلفة_صنف.xlsx');
}

/* ── Helpers ── */
function readStr(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return v != null && String(v).trim() !== '' ? String(v).trim() : '';
}
function readNum(row: Record<string, unknown>, key: string): number {
  const s = readStr(row, key);
  if (!s) return 0;
  const n = Number(s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/,/g, '.'));
  return Number.isFinite(n) ? n : 0;
}

interface SheetSizes {
  itemSize: string;
  itemWidth: number;
  itemHeight: number;
  rows: {
    pressWidth: number;
    pressHeight: number;
    purchaseSize: string;
  }[];
}

function readSizesPerSheet(file: ArrayBuffer): SheetSizes[] {
  const wb = XLSX.read(file, { type: 'array' });
  return wb.SheetNames.map(name => {
    const sheet = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    if (!rows.length) return { itemSize: '', itemWidth: 0, itemHeight: 0, rows: [] };

    // ── Item size: from first row's "عرض الصنف" / "ارتفاع الصنف"
    const first = rows[0];
    const itemWidth = readNum(first, 'عرض الصنف');
    const itemHeight = readNum(first, 'ارتفاع الصنف');
    let itemSize = '';
    if (itemWidth || itemHeight) {
      itemSize = itemWidth && itemHeight ? `${itemWidth}x${itemHeight}` : String(itemWidth || itemHeight);
    } else {
      itemSize = readStr(first, 'مقاس الصنف');
    }

    const pieceRows = rows.map(r => {
      // Paper-sheet (purchase) dims → purchaseSize string.
      const pw = readStr(r, 'عرض شيت الورق (سم)');
      const ph = readStr(r, 'طول شيت الورق (سم)');
      let purchaseSize = '';
      if (pw && ph) purchaseSize = `${pw}x${ph}`;
      else if (pw || ph) purchaseSize = pw || ph;
      else purchaseSize = readStr(r, 'مقاس الشراء');

      // Print-sheet dims → pressWidth / pressHeight (the press sheet inputs).
      const pressWidth = readNum(r, 'عرض شيت الطباعة (سم)');
      const pressHeight = readNum(r, 'ارتفاع شيت الطباعة (سم)')
        || readNum(r, 'طول شيت الطباعة (سم)');

      return { pressWidth, pressHeight, purchaseSize };
    });

    return { itemSize, itemWidth, itemHeight, rows: pieceRows };
  }).filter(s => s.rows.length > 0);
}

export interface ItemCostImportPiece {
  pressWidth: number;
  pressHeight: number;
}

export function parseItemCostExcelMulti(file: ArrayBuffer): (CostCalcImportResult & {
  pieces: (CostCalcImportResult['pieces'][number] & ItemCostImportPiece)[];
})[] {
  const results = parseSharedMulti(file);
  const sizes = readSizesPerSheet(file);
  return results.map((r, i) => {
    const sz = sizes[i];
    return {
      ...r,
      itemSize: sz?.itemSize || r.itemSize,
      pieces: r.pieces.map((p, j) => {
        const override = sz?.rows[j];
        return {
          ...p,
          cutsPerSheet: 0,
          // System "مقاس الصنف" = printWidth/printHeight ← Excel عرض/ارتفاع الصنف
          printWidth: sz?.itemWidth || 0,
          printHeight: sz?.itemHeight || 0,
          // System "مقاس شيت الطباعة" = pressWidth/pressHeight ← Excel print-sheet headers
          pressWidth: override?.pressWidth || 0,
          pressHeight: override?.pressHeight || 0,
          purchaseSize: override?.purchaseSize || p.purchaseSize,
        };
      }),
    };
  });
}

export type { CostCalcImportResult };
