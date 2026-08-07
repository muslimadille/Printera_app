import { useState, useRef } from 'react';
import { usePrintingStore, useCalculations } from '@/store/printingStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Printer, Save, Loader2, Eye, AlertCircle, Paperclip, X, FileIcon, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProfitMargins from '@/components/ProfitMargins';
import PrintPreview from '@/components/PrintPreview';
import { saveQuote, updateQuote, getUploadUrl, getFileUrl } from '@/lib/userApi';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ExistingAttachment {
  url: string;
  name: string;
}

interface PriceQuoteProps {
  sessionToken: string;
  editingQuoteId?: string | null;
  onClearEditingQuote?: () => void;
  existingAttachment?: ExistingAttachment | null;
}

const PriceQuote = ({ sessionToken, editingQuoteId, onClearEditingQuote, existingAttachment: initialAttachment }: PriceQuoteProps) => {
  const { inputs, quoteInfo, setQuoteInfo, currentUsername, unifiedQuote } = usePrintingStore();
  const calc = useCalculations();
  const [saving, setSaving] = useState(false);
  const [saveAsNew, setSaveAsNew] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [existingAttachment, setExistingAttachment] = useState<ExistingAttachment | null>(initialAttachment || null);
  const [showNoFileWarning, setShowNoFileWarning] = useState(false);
  const [showMissingInfoWarning, setShowMissingInfoWarning] = useState(false);
  const [pendingSaveAfterInfo, setPendingSaveAfterInfo] = useState(false);
  const [showSaveChoiceDialog, setShowSaveChoiceDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update existing attachment when prop changes (quote loaded for editing)
  const [prevInitial, setPrevInitial] = useState(initialAttachment);
  if (initialAttachment !== prevInitial) {
    setPrevInitial(initialAttachment);
    setExistingAttachment(initialAttachment || null);
    setAttachedFile(null);
  }

  const today = new Date().toLocaleDateString('ar-SA');

  const hasUnifiedQuote = !!unifiedQuote;
  const sourceLabel = unifiedQuote?.sourceLabel || 'حاسبة التسعير';

  const details = unifiedQuote?.details || [
    { label: 'نوع الورق', value: inputs.paperType || '—' },
    { label: 'مقاس الشراء', value: inputs.purchaseSize || '—' },
    { label: 'الجرامية', value: inputs.grammage?.toString() || '—' },
    { label: 'عدد القطع', value: inputs.quantity.toString() },
    { label: 'عرض الطباعة (سم)', value: inputs.printWidth.toString() },
    { label: 'طول الطباعة (سم)', value: inputs.printHeight.toString() },
    { label: 'عدد الأوجه', value: inputs.printedFaces.toString() },
    { label: 'الوجهان مختلفان؟', value: inputs.facesDifferent ? 'نعم' : 'لا' },
    { label: 'أوجه السلفان', value: inputs.cellophaneFaces.toString() },
    { label: 'تكسير / قالب؟', value: inputs.dieCut ? 'نعم' : 'لا' },
    { label: 'نسبة الهدر %', value: inputs.wastePercent.toString() },
    { label: 'قيمة القالب', value: inputs.moldPrice.toString() },
    { label: 'كم تفصل في الشيت', value: inputs.cutsPerSheet.toString() },
  ];

  const totalCost = unifiedQuote?.totalCost ?? calc.totalCost;
  const totalFinishing = unifiedQuote?.totalFinishing ?? calc.totalFinishing;
  const grandTotal = unifiedQuote?.grandTotal ?? calc.grandTotal;
  const pricePerPiece = unifiedQuote?.pricePerPiece ?? calc.pricePerPiece;
  const quantity = unifiedQuote?.quantity ?? inputs.quantity;
  const pieceLabel = unifiedQuote?.pieceLabel || 'قطعة';
  const costBreakdown = unifiedQuote?.costBreakdown;

  const handleDownloadFile = async (url: string, fileName: string) => {
    try {
      // Saved attachments are stored as `storage:{key}`, not as a fetchable URL — the
      // bucket is private, so a fresh signed URL has to be minted per download. Values
      // that are already a URL are legacy rows from when the bucket was public
      // (OPS-072 converts those to keys); they are still fetched directly so nothing
      // regresses before that command runs.
      const target = url.startsWith('storage:')
        ? (await getFileUrl(sessionToken, url.replace('storage:', ''))).signed_url
        : url;

      const response = await fetch(target);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('فشل تحميل الملف');
    }
  };


  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      const { path, upload_url } = await getUploadUrl(sessionToken, file.name);
      const uploadRes = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      return `storage:${path}`;
    } catch (err: any) {
      toast.error('فشل رفع الملف: ' + (err.message || ''));
      return null;
    }
  };

  const doSave = async (forceNew = false) => {
    setSaving(true);
    try {
      let attachmentUrl: string | undefined;
      if (attachedFile) {
        const url = await uploadFile(attachedFile);
        if (url) attachmentUrl = url;
      }

      // Determine attachment: new file > existing > none
      const finalAttachmentUrl = attachmentUrl || (existingAttachment?.url);
      const finalAttachmentName = attachedFile?.name || (existingAttachment?.name);

      const quoteData = unifiedQuote ? {
        ...unifiedQuote,
        itemName: quoteInfo.itemName,
        itemNumber: quoteInfo.itemNumber,
        itemSize: quoteInfo.itemSize,
        ...(finalAttachmentUrl && { attachmentUrl: finalAttachmentUrl, attachmentName: finalAttachmentName }),
      } : {
        paperType: inputs.paperType,
        purchaseSize: inputs.purchaseSize,
        grammage: inputs.grammage,
        quantity: inputs.quantity,
        printWidth: inputs.printWidth,
        printHeight: inputs.printHeight,
        printedFaces: inputs.printedFaces,
        facesDifferent: inputs.facesDifferent,
        cellophaneFaces: inputs.cellophaneFaces,
        dieCut: inputs.dieCut,
        wastePercent: inputs.wastePercent,
        moldPrice: inputs.moldPrice,
        cutsPerSheet: inputs.cutsPerSheet,
        totalCost: calc.totalCost,
        pricePerPiece: calc.pricePerPiece,
        totalFinishing: calc.totalFinishing,
        grandTotal: calc.grandTotal,
        itemName: quoteInfo.itemName,
        itemNumber: quoteInfo.itemNumber,
        itemSize: quoteInfo.itemSize,
        ...(finalAttachmentUrl && { attachmentUrl: finalAttachmentUrl, attachmentName: finalAttachmentName }),
      };

      const sourceType = unifiedQuote?.sourceType || 'calculator';
      const titleParts = [quoteInfo.itemName || currentUsername || 'بدون اسم'];
      if (quoteInfo.itemNumber) titleParts.push(`#${quoteInfo.itemNumber}`);
      const title = `عرض تكلفة - ${titleParts.join(' ')}`;

      if (editingQuoteId && !forceNew) {
        await updateQuote(sessionToken, editingQuoteId, {
          title,
          customer_name: currentUsername,
          quote_number: quoteInfo.quoteNumber,
          quote_data: quoteData,
        });
        toast.success('تم تحديث العرض بنجاح');
        onClearEditingQuote?.();
      } else {
        await saveQuote(sessionToken, {
          title,
          customer_name: currentUsername,
          quote_number: quoteInfo.quoteNumber,
          source_type: sourceType,
          quote_data: quoteData,
        });
        toast.success('تم حفظ العرض بنجاح');
        if (forceNew) onClearEditingQuote?.();
      }
      setAttachedFile(null);
      setSaveAsNew(false);
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  // الحقول المرتبطة بالبحث بالمواصفات (تُملأ تلقائياً من الإدخال الحالي عند الحفظ)
  // اسم/رقم الصنف يبقيان دائماً كما هما ولا يُعتبران ناقصين هنا.
  const missingInfoFields = () => {
    const missing: string[] = [];
    if (!quoteInfo.itemSize?.trim()) missing.push('مقاس الصنف');
    const src: any = unifiedQuote || inputs;
    const paperType = (src.paperType ?? '').toString().trim();
    const grammage = (src.grammage ?? '').toString().trim();
    const purchaseSize = (src.purchaseSize ?? '').toString().trim();
    const printWidth = (src.printWidth ?? '').toString().trim();
    const printHeight = (src.printHeight ?? '').toString().trim();
    const cutsPerSheet = (src.cutsPerSheet ?? '').toString().trim();
    if (!paperType) missing.push('نوع الورق');
    if (!grammage || grammage === '0') missing.push('الجرامية');
    if (!purchaseSize) missing.push('مقاس الشيت الأساسي');
    if (!printWidth || printWidth === '0' || !printHeight || printHeight === '0') missing.push('مقاس شيت الطباعة');
    if (!cutsPerSheet || cutsPerSheet === '0') missing.push('تفصيل الشيت');
    return missing;
  };

  const proceedToFilCheck = (asNew: boolean) => {
    if (!attachedFile && !existingAttachment) {
      setShowNoFileWarning(true);
      return;
    }
    doSave(asNew);
  };

  const handleSaveQuote = (asNew = false) => {
    setSaveAsNew(asNew);
    const missing = missingInfoFields();
    if (missing.length > 0) {
      setShowMissingInfoWarning(true);
      return;
    }
    proceedToFilCheck(asNew);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error('حجم الملف يتجاوز 20 ميجابايت');
        return;
      }
      setAttachedFile(file);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader className="text-center border-b">
         <CardTitle className="text-2xl text-primary">نموذج عرض تكلفة مختصر</CardTitle>
         {hasUnifiedQuote && (
           <Badge variant="secondary" className="mx-auto mt-2 text-sm">
             المصدر: {sourceLabel}
           </Badge>
         )}
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Customer info */}
          <div className="grid grid-cols-2 gap-4 items-end">
            <div className="space-y-1">
              <Label>اسم المستخدم</Label>
              <Input value={currentUsername} disabled className="bg-muted" />
            </div>
            <div className="space-y-1">
              <Label>رقم العرض</Label>
              <Input
                value={quoteInfo.quoteNumber}
                onChange={(e) => setQuoteInfo({ quoteNumber: e.target.value })}
                placeholder="رقم العرض"
              />
            </div>
            <div className="space-y-1">
              <Label>اسم الصنف</Label>
              <Input
                value={quoteInfo.itemName}
                onChange={(e) => setQuoteInfo({ itemName: e.target.value })}
                placeholder="اسم الصنف"
              />
            </div>
            <div className="space-y-1">
              <Label>رقم الصنف</Label>
              <Input
                value={quoteInfo.itemNumber}
                onChange={(e) => setQuoteInfo({ itemNumber: e.target.value })}
                placeholder="رقم الصنف"
              />
            </div>
            <div className="space-y-1">
              <Label>مقاس الصنف</Label>
              <Input
                value={quoteInfo.itemSize}
                onChange={(e) => setQuoteInfo({ itemSize: e.target.value })}
                placeholder="مقاس الصنف"
              />
            </div>
            <div className="space-y-1">
              <Label>التاريخ</Label>
              <Input value={today} disabled className="bg-muted" />
            </div>
          </div>

          {/* File attachment */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3 text-primary flex items-center gap-2">
              <Paperclip className="w-4 h-4" /> إرفاق ملف
            </h3>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={handleFileChange}
            />
            {attachedFile ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <FileIcon className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{attachedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(attachedFile.size / 1024).toFixed(1)} كيلوبايت
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  onClick={() => {
                    setAttachedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : existingAttachment ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <FileIcon className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{existingAttachment.name}</p>
                    <p className="text-xs text-muted-foreground">ملف مرفق محفوظ</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title="تحميل الملف"
                      type="button"
                      onClick={() => handleDownloadFile(existingAttachment.url, existingAttachment.name)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      title="حذف وإرفاق ملف جديد"
                      onClick={() => {
                        setExistingAttachment(null);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full gap-2 border-dashed"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="w-4 h-4" />
                اختر ملفاً للإرفاق (صورة، PDF، Word، Excel)
              </Button>
            )}
          </div>

          {/* Execution details */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3 text-primary">بيانات التنفيذ</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {details.map((d, i) => (
                <QuoteRow key={i} label={d.label} value={d.value} />
              ))}
            </div>
          </div>

          {/* Cost breakdown if available */}
          {costBreakdown && costBreakdown.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3 text-primary">تفاصيل التكاليف</h3>
              <div className="space-y-1">
                {costBreakdown.map((item, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5 px-2 rounded bg-muted/50">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-mono font-medium">{item.value.toFixed(2)} ريال</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final results */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3 text-primary">النتائج النهائية</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-primary/10 rounded-lg text-center border border-primary/20">
                <p className="text-sm text-muted-foreground">إجمالي التكلفة</p>
                <p className="text-xl font-bold text-primary">{totalCost.toFixed(2)} ريال</p>
              </div>
              <div className="p-4 bg-accent/10 rounded-lg text-center border border-accent/20">
                <p className="text-sm text-muted-foreground">سعر {pieceLabel === 'نسخة' ? 'النسخة' : 'القطعة'}</p>
                <p className="text-xl font-bold text-accent">{pricePerPiece.toFixed(4)} ريال</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-xs text-muted-foreground">تشطيبات إضافية</p>
                <p className="font-semibold">{totalFinishing.toFixed(2)} ريال</p>
              </div>
              <div className="p-3 bg-primary/5 rounded-lg text-center border border-primary/10">
                <p className="text-xs text-muted-foreground">الإجمالي الشامل</p>
                <p className="font-bold text-primary">{grandTotal.toFixed(2)} ريال</p>
              </div>
            </div>

            <ProfitMargins grandTotal={grandTotal} quantity={quantity} pieceLabel={pieceLabel === 'نسخة' ? 'سعر النسخة' : undefined} />
          </div>

          {!hasUnifiedQuote && grandTotal === 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-muted-foreground border">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="text-sm">لم يتم إرسال أي حسبة بعد. اذهب لأي حاسبة واضغط "إرسال لعرض السعر"</span>
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            {editingQuoteId ? (
              <>
                <Button
                  className="flex-1 gap-2"
                  variant="outline"
                  onClick={() => handleSaveQuote(false)}
                  disabled={saving}
                >
                  {saving && !saveAsNew ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  تحديث العرض
                </Button>
                <Button
                  className="flex-1 gap-2"
                  variant="default"
                  onClick={() => handleSaveQuote(true)}
                  disabled={saving}
                >
                  {saving && saveAsNew ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  حفظ كعرض جديد
                </Button>
              </>
            ) : (
              <Button
                className="flex-1 gap-2"
                variant="outline"
                onClick={() => handleSaveQuote(false)}
                disabled={saving}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                حفظ العرض
              </Button>
            )}
            <Button
              className="flex-1 gap-2"
              variant="secondary"
              onClick={() => setShowPreview(true)}
            >
              <Eye className="w-4 h-4" />
              معاينة احترافية
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={() => { import('@/lib/activityTracker').then(m => m.trackActivity('export_pdf', 'quote')); window.print(); }}
            >
              <Printer className="w-4 h-4" />
              طباعة سريعة
            </Button>
          </div>

          <PrintPreview open={showPreview} onOpenChange={setShowPreview} />
        </CardContent>
      </Card>

      {/* Missing search-fields warning (لا يُجبر — مجرد تنبيه ودود) */}
      <AlertDialog open={showMissingInfoWarning} onOpenChange={setShowMissingInfoWarning}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              بعض البيانات غير مكتملة
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>الحقول التالية فارغة وستُحفظ كما هي (تُستخدم للبحث بالمواصفات لاحقاً):</p>
                <ul className="list-disc pr-5 text-sm text-muted-foreground space-y-0.5">
                  {missingInfoFields().map(f => <li key={f}>{f}</li>)}
                </ul>
                <p className="text-xs text-muted-foreground pt-1">اسم الصنف ورقم الصنف يُحفظان دائماً كما هما.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:gap-0">
            <AlertDialogCancel>✏️ تعبئة البيانات الناقصة</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowMissingInfoWarning(false); proceedToFilCheck(saveAsNew); }}>
              ✔️ الاستمرار بدون تعبئة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* No file attachment warning */}
      <AlertDialog open={showNoFileWarning} onOpenChange={setShowNoFileWarning}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              لم يتم إرفاق ملف
            </AlertDialogTitle>
            <AlertDialogDescription>
              لم تقم بإرفاق أي ملف مع هذا العرض. هل تريد الاستمرار بالحفظ بدون ملف مرفق؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:gap-0">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => doSave(saveAsNew)}>
              استمرار بالحفظ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const QuoteRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-center py-1.5 px-2 rounded bg-muted/50">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

export default PriceQuote;