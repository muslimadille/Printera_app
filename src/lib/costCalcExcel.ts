import * as XLSX from 'xlsx';
import type { FinishingItem } from '@/store/printingStore';
import {
  parseExcelNumber,
  parseExcelBool,
  parseFinishingCalcType,
} from '@/lib/bulkQuoteImport';

function normalizeArabic(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[–—−]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/[ـ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ── Template Headers ── */
const itemHeaders = ['اسم الصنف', 'رقم الصنف', 'مقاس الصنف'];

const pieceHeaders = [
  'الكمية', 'نوع الورق', 'الجرامية', 'مقاس الشراء',
  'عرض الطباعة (سم)', 'طول الطباعة (سم)', 'عدد الألوان (0-4)', 'ألوان إضافية',
  'تفصيل الشيت', 'الأوجه المطبوعة (1-2)', 'الوجهان مختلفان (نعم/لا)',
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
  'مقاس الصنف': '9×5 سم',
  'الكمية': 5000,
  'نوع الورق': 'كوشيه',
  'الجرامية': 300,
  'مقاس الشراء': '70×100',
  'عرض الطباعة (سم)': 70,
  'طول الطباعة (سم)': 100,
  'عدد الألوان (0-4)': 4,
  'ألوان إضافية': 0,
  'تفصيل الشيت': 4,
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

export function downloadCostCalcTemplate() {
  const ws = XLSX.utils.json_to_sheet([sampleRow], { header: allHeaders });
  ws['!cols'] = allHeaders.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'تسعيرة 1');
  // Add a second empty sheet as example
  const ws2 = XLSX.utils.json_to_sheet([], { header: allHeaders });
  ws2['!cols'] = allHeaders.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, ws2, 'تسعيرة 2');
  XLSX.writeFile(wb, 'نموذج_استيراد_تكلفة.xlsx');
}

/* ── Field reader helpers ── */
function str(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return v != null && String(v).trim() !== '' ? normalizeArabic(String(v)) : '';
}

function num(row: Record<string, unknown>, key: string, fallback = 0): number {
  return parseExcelNumber(row[key], fallback);
}

function bool(row: Record<string, unknown>, key: string): boolean {
  return parseExcelBool(row[key]);
}

/* ── Parse finishing from row ── */
function parseFinishing(row: Record<string, unknown>): FinishingItem[] {
  const items: FinishingItem[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = str(row, `تشطيب ${i} - الاسم`);
    if (!name) continue;
    items.push({
      name,
      enabled: true,
      calcType: parseFinishingCalcType(row[`تشطيب ${i} - نوع الحساب`]),
      multiplier: Math.max(num(row, `تشطيب ${i} - عدد المتغيرات`, 1), 1),
      pricePerUnit: num(row, `تشطيب ${i} - سعر الوحدة`, 0),
      extraPer1000: num(row, `تشطيب ${i} - سعر ألف إضافي`, 0),
      notes: '',
    });
  }
  return items;
}

/* ── Parsed result ── */
export interface CostCalcImportResult {
  itemName: string;
  itemNumber: string;
  itemSize: string;
  pieces: {
    quantity: number;
    paperType: string;
    grammage: number | null;
    purchaseSize: string;
    printWidth: number;
    printHeight: number;
    colorCount: number;
    extraColorCount: number;
    cutsPerSheet: number;
    printedFaces: number;
    facesDifferent: boolean;
    wastePercent: number;
    wasteMode: 'number' | 'percent';
    wasteInCosts: boolean;
    cellophaneFaces: number;
    dieCut: boolean;
    moldPrice: number;
    finishing: FinishingItem[];
  }[];
}

function parseSheet(data: Record<string, unknown>[]): CostCalcImportResult | null {
  if (!data.length) return null;

  const firstRow = data[0];
  const itemName = str(firstRow, 'اسم الصنف');
  const itemNumber = str(firstRow, 'رقم الصنف');
  const itemSize = str(firstRow, 'مقاس الصنف');

  const pieces = data.map(row => {
    const wasteTypeRaw = str(row, 'نوع الهدر (رقم/نسبة)').replace(/[()]/g, '');
    const wasteMode: 'number' | 'percent' =
      wasteTypeRaw === 'نسبة' || wasteTypeRaw === '%' || wasteTypeRaw === 'percent' ? 'percent' : 'number';

    const grammageVal = num(row, 'الجرامية', 0);

    return {
      quantity: num(row, 'الكمية', 1000),
      paperType: str(row, 'نوع الورق'),
      grammage: grammageVal || null,
      purchaseSize: str(row, 'مقاس الشراء'),
      printWidth: num(row, 'عرض الطباعة (سم)', 0),
      printHeight: num(row, 'طول الطباعة (سم)', 0),
      colorCount: Math.min(num(row, 'عدد الألوان (0-4)', 0), 5),
      extraColorCount: num(row, 'ألوان إضافية', 0),
      cutsPerSheet: num(row, 'تفصيل الشيت', 1),
      printedFaces: Math.min(Math.max(num(row, 'الأوجه المطبوعة (1-2)', 1), 1), 2),
      facesDifferent: bool(row, 'الوجهان مختلفان (نعم/لا)'),
      wastePercent: num(row, 'كمية الهدر', 0),
      wasteMode,
      wasteInCosts: bool(row, 'الهدر في جميع التكاليف (نعم/لا)'),
      cellophaneFaces: Math.min(num(row, 'أوجه السلفان (0-2)', 0), 2),
      dieCut: bool(row, 'تكسير (نعم/لا)'),
      moldPrice: num(row, 'قيمة القالب', 0),
      finishing: parseFinishing(row),
    };
  });

  return { itemName, itemNumber, itemSize, pieces };
}

/** Parse single sheet (backward compat) */
export function parseCostCalcExcel(file: ArrayBuffer): CostCalcImportResult {
  const results = parseCostCalcExcelMulti(file);
  if (!results.length) throw new Error('الملف فارغ');
  return results[0];
}

/** Parse all sheets - each Excel sheet becomes a separate cost entry */
export function parseCostCalcExcelMulti(file: ArrayBuffer): CostCalcImportResult[] {
  const wb = XLSX.read(file, { type: 'array' });
  const results: CostCalcImportResult[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    if (!data.length) continue;
    const result = parseSheet(data);
    if (result) results.push(result);
  }

  if (!results.length) throw new Error('الملف فارغ');
  return results;
}
