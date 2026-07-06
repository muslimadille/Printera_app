import type { FinishingItem } from '@/store/printingStore';

type RowData = Record<string, unknown>;

const digitMap: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

export const bulkQuoteFieldAliases = {
  customerName: ['اسم العميل'],
  quoteNumber: ['رقم العرض'],
  itemName: ['اسم الصنف'],
  itemNumber: ['رقم الصنف'],
  itemSize: ['مقاس الصنف'],
  paperType: ['نوع الورق'],
  purchaseSize: ['مقاس الشراء'],
  grammage: ['الجرامية'],
  quantity: ['الكمية', 'عدد القطع'],
  printWidth: ['عرض الطباعة', 'عرض الطباعة (سم)', 'عرض الطباعة سم'],
  printHeight: ['طول الطباعة', 'طول الطباعة (سم)', 'طول الطباعة سم'],
  cutsPerSheet: ['تفصل في الشيت', 'كم تفصل في الشيت'],
  wastePercent: ['نسبة الهدر %', 'نسبة الهدر'],
  colorCount: ['عدد الألوان', 'عدد الألوان (0-4)', 'عدد الألوان 0-4'],
  printedFaces: ['عدد الأوجه', 'عدد الأوجه المطبوعة (1-2)', 'عدد الأوجه المطبوعة 1-2', 'عدد الأوجه المطبوعة'],
  facesDifferent: ['الوجهان مختلفان', 'الوجهان مختلفان (نعم/لا)', 'الوجهان مختلفان نعم/لا'],
  cellophaneFaces: ['أوجه السلفان', 'أوجه السلفان (0-2)', 'أوجه السلفان 0-2'],
  dieCut: ['تكسير', 'تكسير (نعم/لا)', 'تكسير نعم/لا'],
  moldPrice: ['قيمة القالب'],
} as const;

export const bulkQuoteTemplateHeaders = [
  'اسم العميل', 'رقم العرض', 'اسم الصنف', 'رقم الصنف', 'مقاس الصنف',
  'نوع الورق', 'مقاس الشراء', 'الجرامية', 'عدد القطع',
  'عرض الطباعة (سم)', 'طول الطباعة (سم)', 'كم تفصل في الشيت', 'نسبة الهدر %',
  'عدد الألوان (0-4)', 'عدد الأوجه المطبوعة (1-2)', 'الوجهان مختلفان (نعم/لا)', 'أوجه السلفان (0-2)', 'تكسير (نعم/لا)', 'قيمة القالب',
  'تشطيب 1 - الاسم', 'تشطيب 1 - نوع الحساب', 'تشطيب 1 - عدد المتغيرات', 'تشطيب 1 - السعر', 'تشطيب 1 - سعر كل 1000 إضافي',
  'تشطيب 2 - الاسم', 'تشطيب 2 - نوع الحساب', 'تشطيب 2 - عدد المتغيرات', 'تشطيب 2 - السعر', 'تشطيب 2 - سعر كل 1000 إضافي',
  'تشطيب 3 - الاسم', 'تشطيب 3 - نوع الحساب', 'تشطيب 3 - عدد المتغيرات', 'تشطيب 3 - السعر', 'تشطيب 3 - سعر كل 1000 إضافي',
] as const;

export const bulkQuoteTemplateSample = {
  'اسم العميل': 'شركة النور',
  'رقم العرض': 'Q-001',
  'اسم الصنف': 'كرت بزنس',
  'رقم الصنف': 'ITM-001',
  'مقاس الصنف': '9×5 سم',
  'نوع الورق': 'كوشيه',
  'مقاس الشراء': '70×100',
  'الجرامية': 300,
  'عدد القطع': 5000,
  'عرض الطباعة (سم)': 70,
  'طول الطباعة (سم)': 100,
  'كم تفصل في الشيت': 4,
  'نسبة الهدر %': 0,
  'عدد الألوان (0-4)': 4,
  'عدد الأوجه المطبوعة (1-2)': 1,
  'الوجهان مختلفان (نعم/لا)': 'لا',
  'أوجه السلفان (0-2)': 1,
  'تكسير (نعم/لا)': 'نعم',
  'قيمة القالب': 150,
  'تشطيب 1 - الاسم': 'ورنيش',
  'تشطيب 1 - نوع الحساب': 'لكل قطعة',
  'تشطيب 1 - عدد المتغيرات': 1,
  'تشطيب 1 - السعر': 0.05,
  'تشطيب 1 - سعر كل 1000 إضافي': 0,
  'تشطيب 2 - الاسم': 'بصمة',
  'تشطيب 2 - نوع الحساب': 'لكل ألف',
  'تشطيب 2 - عدد المتغيرات': 1,
  'تشطيب 2 - السعر': 50,
  'تشطيب 2 - سعر كل 1000 إضافي': 0,
};

function toAsciiDigits(value: string): string {
  return value
    .replace(/[٠-٩۰-۹]/g, (digit) => digitMap[digit] ?? digit)
    .replace(/٫/g, '.')
    .replace(/٬/g, ',');
}

function normalizeArabic(value: string): string {
  return toAsciiDigits(value)
    .normalize('NFKC')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[–—−]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/[ـ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeComparable(value: unknown): string {
  return normalizeArabic(String(value ?? ''))
    .replace(/[()%]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function isProvided(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function buildLookup(row: RowData): Map<string, unknown> {
  return new Map(Object.entries(row).map(([key, value]) => [normalizeComparable(key), value]));
}

export function getBulkQuoteField(row: RowData, aliases: readonly string[]): unknown {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias)) return row[alias];
  }

  const lookup = buildLookup(row);
  for (const alias of aliases) {
    const matched = lookup.get(normalizeComparable(alias));
    if (matched !== undefined) return matched;
  }

  return undefined;
}

export function readBulkQuoteStringField(row: RowData, aliases: readonly string[]): string {
  const value = getBulkQuoteField(row, aliases);
  return isProvided(value) ? normalizeArabic(String(value)) : '';
}

export function parseExcelNumber(value: unknown, fallback = 0): number {
  if (!isProvided(value)) return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;

  let normalized = normalizeArabic(String(value)).replace(/%/g, '').replace(/\s+/g, '');
  if (!normalized) return fallback;

  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');

  if (hasComma && hasDot) {
    normalized = normalized.replace(/,/g, '');
  } else if (hasComma) {
    normalized = /^-?\d{1,3}(,\d{3})+$/.test(normalized)
      ? normalized.replace(/,/g, '')
      : normalized.replace(/,/g, '.');
  }

  normalized = normalized.replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readBulkQuoteNumberField(row: RowData, aliases: readonly string[], fallback: number): number {
  return parseExcelNumber(getBulkQuoteField(row, aliases), fallback);
}

export function readBulkQuoteNullableNumberField(row: RowData, aliases: readonly string[]): number | null {
  const value = getBulkQuoteField(row, aliases);
  return isProvided(value) ? parseExcelNumber(value, 0) : null;
}

export function parseExcelBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeComparable(value);
  return ['1', 'true', 'yes', 'y', 'on', 'نعم', 'صح', 'مفعل'].includes(normalized);
}

export function parseBulkQuoteBooleanField(row: RowData, aliases: readonly string[]): boolean {
  return parseExcelBool(getBulkQuoteField(row, aliases));
}

export function parseFinishingCalcType(value: unknown): FinishingItem['calcType'] {
  const normalized = normalizeComparable(value).replace(/[-_]/g, '');
  const map: Record<string, FinishingItem['calcType']> = {
    perpiece: 'per_piece',
    piece: 'per_piece',
    لكلقطعه: 'per_piece',
    لكلقطعة: 'per_piece',
    قطعه: 'per_piece',
    قطعة: 'per_piece',
    per1000: 'per_1000',
    لكلالف: 'per_1000',
    لكلألف: 'per_1000',
    بالالف: 'per_1000',
    tiered1000: 'tiered_1000',
    شرائحالف: 'tiered_1000',
    شرائحألف: 'tiered_1000',
    flat: 'flat',
    fixed: 'flat',
    مبلغثابت: 'flat',
    ثابت: 'flat',
  };

  return map[normalized] ?? 'per_piece';
}

function finishingFieldAliases(index: number, label: string): string[] {
  const prefix = `تشطيب ${index}`;
  return [`${prefix} - ${label}`, `${prefix}-${label}`, `${prefix} – ${label}`, `${prefix} — ${label}`];
}

function getFinishingIndexes(row: RowData): number[] {
  const indexes = new Set<number>();
  Object.keys(row).forEach((key) => {
    const match = normalizeArabic(key).match(/تشطيب\s*(\d+)/);
    if (match) indexes.add(Number(match[1]));
  });

  return indexes.size ? Array.from(indexes).sort((a, b) => a - b) : [1, 2, 3];
}

export function parseFinishingItems(row: RowData): FinishingItem[] {
  return getFinishingIndexes(row).flatMap((index) => {
    const name = readBulkQuoteStringField(row, finishingFieldAliases(index, 'الاسم'));
    if (!name) return [];

    const multiplier = readBulkQuoteNumberField(row, finishingFieldAliases(index, 'عدد المتغيرات'), 1);
    const pricePerUnit = readBulkQuoteNumberField(row, finishingFieldAliases(index, 'السعر'), 0);
    const extraPer1000 = readBulkQuoteNumberField(row, finishingFieldAliases(index, 'سعر كل 1000 إضافي'), 0);

    return [{
      name,
      enabled: true,
      calcType: parseFinishingCalcType(getBulkQuoteField(row, finishingFieldAliases(index, 'نوع الحساب'))),
      multiplier: Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1,
      pricePerUnit: Number.isFinite(pricePerUnit) ? pricePerUnit : 0,
      extraPer1000: Number.isFinite(extraPer1000) ? extraPer1000 : 0,
      notes: '',
    }];
  });
}