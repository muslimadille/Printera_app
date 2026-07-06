import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { usePrintingStore } from '@/store/printingStore';
import { calculateQuote, CalcResult } from '@/lib/calcEngine';
import { saveQuote } from '@/lib/userApi';
import type { CalculatorInputs, FinishingItem } from '@/store/printingStore';
import {
  bulkQuoteFieldAliases,
  bulkQuoteTemplateHeaders,
  bulkQuoteTemplateSample,
  parseBulkQuoteBooleanField,
  parseFinishingItems,
  readBulkQuoteNullableNumberField,
  readBulkQuoteNumberField,
  readBulkQuoteStringField,
} from '@/lib/bulkQuoteImport';

interface BulkQuoteImportProps {
  sessionToken: string;
  onComplete?: () => void;
}

interface ParsedRow {
  rowNum: number;
  customerName: string;
  quoteNumber: string;
  itemName: string;
  itemNumber: string;
  itemSize: string;
  inputs: CalculatorInputs;
  finishing: FinishingItem[];
  result?: CalcResult;
  saved?: boolean;
  error?: string;
}

const BulkQuoteImport = ({ sessionToken, onComplete }: BulkQuoteImportProps) => {
  const { paperTypes, priceSettings } = usePrintingStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<'idle' | 'parsed' | 'calculated' | 'saving' | 'done'>('idle');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    import('@/lib/activityTracker').then(m => m.trackActivity('import_excel', 'bulkimport', { file: file.name }));
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
        if (!data.length) { toast.error('الملف فارغ'); return; }

        const parsed: ParsedRow[] = data.map((row, idx) => {
          const inputs: CalculatorInputs = {
            paperType: readBulkQuoteStringField(row, bulkQuoteFieldAliases.paperType),
            purchaseSize: readBulkQuoteStringField(row, bulkQuoteFieldAliases.purchaseSize),
            grammage: readBulkQuoteNullableNumberField(row, bulkQuoteFieldAliases.grammage),
            quantity: readBulkQuoteNumberField(row, bulkQuoteFieldAliases.quantity, 0),
            printWidth: readBulkQuoteNumberField(row, bulkQuoteFieldAliases.printWidth, 50),
            printHeight: readBulkQuoteNumberField(row, bulkQuoteFieldAliases.printHeight, 70),
            cutsPerSheet: readBulkQuoteNumberField(row, bulkQuoteFieldAliases.cutsPerSheet, 1),
            wastePercent: readBulkQuoteNumberField(row, bulkQuoteFieldAliases.wastePercent, 0),
            colorCount: readBulkQuoteNumberField(row, bulkQuoteFieldAliases.colorCount, 4),
            printedFaces: readBulkQuoteNumberField(row, bulkQuoteFieldAliases.printedFaces, 1),
            facesDifferent: parseBulkQuoteBooleanField(row, bulkQuoteFieldAliases.facesDifferent),
            cellophaneFaces: readBulkQuoteNumberField(row, bulkQuoteFieldAliases.cellophaneFaces, 0),
            dieCut: parseBulkQuoteBooleanField(row, bulkQuoteFieldAliases.dieCut),
            moldPrice: readBulkQuoteNumberField(row, bulkQuoteFieldAliases.moldPrice, 0),
            extraColorCalcType: 'per_1000',
            extraColorPrice: 0,
            extraColorExtra1000: 0,
            extraColorCount: 1,
            wasteInCosts: true,
          };
          return {
            rowNum: idx + 2,
            customerName: readBulkQuoteStringField(row, bulkQuoteFieldAliases.customerName),
            quoteNumber: readBulkQuoteStringField(row, bulkQuoteFieldAliases.quoteNumber),
            itemName: readBulkQuoteStringField(row, bulkQuoteFieldAliases.itemName),
            itemNumber: readBulkQuoteStringField(row, bulkQuoteFieldAliases.itemNumber),
            itemSize: readBulkQuoteStringField(row, bulkQuoteFieldAliases.itemSize),
            inputs,
            finishing: parseFinishingItems(row),
          };
        });

        setRows(parsed);
        setStage('parsed');
        toast.success(`تم قراءة ${parsed.length} تسعيرة من الملف`);
      } catch (err: any) {
        toast.error('خطأ في قراءة الملف: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const runCalculations = () => {
    const updated = rows.map(row => {
      const result = calculateQuote(row.inputs, row.finishing, paperTypes, priceSettings);
      return { ...row, result, error: result.valid ? undefined : result.error };
    });
    setRows(updated);
    setStage('calculated');
    const valid = updated.filter(r => r.result?.valid).length;
    const invalid = updated.length - valid;
    toast.success(`تم حساب ${valid} تسعيرة بنجاح${invalid ? ` (${invalid} بها أخطاء)` : ''}`);
  };

  const saveAll = async () => {
    const validRows = rows.filter(r => r.result?.valid && !r.saved);
    if (!validRows.length) { toast.info('لا توجد تسعيرات صالحة للحفظ'); return; }

    setStage('saving');
    setProcessing(true);
    setProgress(0);

    let saved = 0;
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        await saveQuote(sessionToken, {
          title: `عرض سعر - ${row.customerName || 'بدون اسم'}${row.itemName ? ` - ${row.itemName}` : ''}`,
          customer_name: row.customerName,
          quote_number: row.quoteNumber,
          source_type: 'calculator',
          quote_data: {
            ...row.inputs,
            itemName: row.itemName,
            itemNumber: row.itemNumber,
            itemSize: row.itemSize,
            totalCost: row.result!.totalCost,
            pricePerPiece: row.result!.pricePerPiece,
            totalFinishing: row.result!.totalFinishing,
            grandTotal: row.result!.grandTotal,
            finishingItems: row.finishing.filter(f => f.enabled),
          },
        });
        row.saved = true;
        saved++;
      } catch (err: any) {
        row.error = err.message;
      }
      setProgress(Math.round(((i + 1) / validRows.length) * 100));
      setRows([...rows]);
    }

    setProcessing(false);
    setStage('done');
    toast.success(`تم حفظ ${saved} عرض سعر بنجاح`);
    onComplete?.();
  };

  const validCount = rows.filter(r => r.result?.valid).length;
  const errorCount = rows.filter(r => r.result && !r.result.valid).length;
  const savedCount = rows.filter(r => r.saved).length;

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          استيراد تسعيرات من Excel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload */}
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4" /> اختر ملف Excel
          </Button>
          {rows.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary">{rows.length} صف</Badge>
              {stage !== 'idle' && <Badge variant="outline" className="text-emerald-600">{validCount} صالح</Badge>}
              {errorCount > 0 && <Badge variant="destructive">{errorCount} خطأ</Badge>}
              {savedCount > 0 && <Badge className="bg-primary">{savedCount} محفوظ</Badge>}
            </div>
          )}
        </div>

        {/* Actions */}
        {stage === 'parsed' && (
          <Button className="gap-2" onClick={runCalculations}>
            حساب جميع التسعيرات
          </Button>
        )}

        {stage === 'calculated' && validCount > 0 && (
          <Button className="gap-2" onClick={saveAll}>
            حفظ {validCount} عرض سعر في التكاليف المحفوظة
          </Button>
        )}

        {(stage === 'saving') && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              جاري الحفظ... {progress}%
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {stage === 'done' && (
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
            تم الانتهاء - يمكنك عرض التكاليف المحفوظة
          </div>
        )}

        {/* Preview table */}
        {rows.length > 0 && (
          <div className="border rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2 text-right">#</th>
                  <th className="p-2 text-right">العميل</th>
                  <th className="p-2 text-right">رقم العرض</th>
                  <th className="p-2 text-right">اسم الصنف</th>
                  <th className="p-2 text-right">نوع الورق</th>
                  <th className="p-2 text-right">الكمية</th>
                  <th className="p-2 text-right">نسبة الهدر</th>
                  <th className="p-2 text-right">التشطيبات</th>
                  <th className="p-2 text-right">الإجمالي</th>
                  <th className="p-2 text-right">سعر القطعة</th>
                  <th className="p-2 text-right">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={`border-t ${row.error ? 'bg-destructive/5' : row.saved ? 'bg-emerald-50' : ''}`}>
                    <td className="p-2">{row.rowNum}</td>
                    <td className="p-2">{row.customerName || '—'}</td>
                    <td className="p-2">{row.quoteNumber || '—'}</td>
                    <td className="p-2">{row.itemName || '—'}</td>
                    <td className="p-2">{row.inputs.paperType || '—'}</td>
                    <td className="p-2">{row.inputs.quantity.toLocaleString('ar-SA')}</td>
                    <td className="p-2">{row.inputs.wastePercent}%</td>
                    <td className="p-2">
                      {row.finishing.length > 0 ? (
                        <span className="text-xs">{row.finishing.map(f => `${f.name} (${f.pricePerUnit})`).join('، ')}</span>
                      ) : '—'}
                    </td>
                    <td className="p-2 font-medium">
                      {row.result?.valid ? `${row.result.grandTotal.toFixed(2)} ريال` : '—'}
                    </td>
                    <td className="p-2">
                      {row.result?.valid ? `${row.result.pricePerPiece.toFixed(4)} ريال` : '—'}
                    </td>
                    <td className="p-2">
                      {row.saved ? (
                        <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3 h-3" /> محفوظ</span>
                      ) : row.error ? (
                        <span className="flex items-center gap-1 text-destructive"><AlertCircle className="w-3 h-3" /> {row.error}</span>
                      ) : row.result?.valid ? (
                        <span className="text-muted-foreground">جاهز</span>
                      ) : (
                        <span className="text-muted-foreground">بانتظار الحساب</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Download template */}
        <div className="border-t pt-3">
          <Button variant="ghost" size="sm" className="gap-2 text-xs text-muted-foreground" onClick={downloadTemplate}>
            <Download className="w-3.5 h-3.5" /> تحميل نموذج Excel فارغ
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

function downloadTemplate() {
  const ws = XLSX.utils.json_to_sheet([bulkQuoteTemplateSample], { header: [...bulkQuoteTemplateHeaders] });
  ws['!cols'] = bulkQuoteTemplateHeaders.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'تسعيرات');
  XLSX.writeFile(wb, 'نموذج_استيراد_تسعيرات.xlsx');
}

export default BulkQuoteImport;
