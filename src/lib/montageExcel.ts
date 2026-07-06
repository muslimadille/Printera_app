/**
 * Montage tab Excel template & parser.
 * Production-only: just item geometry + press sheet dimensions.
 * No paper, colors, finishings, or cost fields.
 */
import * as XLSX from 'xlsx';

const HEADERS = [
  'اسم الصنف',
  'عرض الصنف',
  'ارتفاع الصنف',
  'عرض شيت الطباعة',
  'ارتفاع شيت الطباعة',
];

const sample = {
  'اسم الصنف': 'كرت بزنس',
  'عرض الصنف': 9,
  'ارتفاع الصنف': 5,
  'عرض شيت الطباعة': 50,
  'ارتفاع شيت الطباعة': 70,
};

export function downloadMontageTemplate() {
  const ws = XLSX.utils.json_to_sheet([sample], { header: HEADERS });
  ws['!cols'] = HEADERS.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'مونتاج');
  XLSX.writeFile(wb, 'نموذج_استيراد_مونتاج.xlsx');
}

export interface MontageImportItem {
  name: string;
  itemW: number;
  itemH: number;
  pressW: number;
  pressH: number;
}

const arDigits = '٠١٢٣٤٥٦٧٨٩';
function readNum(row: Record<string, unknown>, key: string): number {
  const v = row[key];
  if (v == null || String(v).trim() === '') return 0;
  const s = String(v).replace(/[٠-٩]/g, d => String(arDigits.indexOf(d))).replace(/,/g, '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function readStr(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return v != null ? String(v).trim() : '';
}

export function parseMontageExcel(file: ArrayBuffer): MontageImportItem[] {
  const wb = XLSX.read(file, { type: 'array' });
  const out: MontageImportItem[] = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: '' });
    for (const r of rows) {
      const itemW = readNum(r, 'عرض الصنف');
      const itemH = readNum(r, 'ارتفاع الصنف');
      const pressW = readNum(r, 'عرض شيت الطباعة');
      const pressH = readNum(r, 'ارتفاع شيت الطباعة');
      const itemName = readStr(r, 'اسم الصنف');
      if (!itemW && !itemH && !pressW && !pressH && !itemName) continue;
      out.push({ name: itemName, itemW, itemH, pressW, pressH });
    }
  }
  return out;
}
