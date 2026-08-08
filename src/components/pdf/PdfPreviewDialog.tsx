import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FileText, X } from 'lucide-react';
import {
  closePdfPreview,
  downloadPdf,
  subscribePdfPreview,
} from '@/lib/pdf/pdfService';

/**
 * Global in-app PDF stream viewer. Mount once near the app root.
 * Opened via previewPdf() from the shared pdfService.
 */
const PdfPreviewDialog = () => {
  const [state, setState] = useState<{ url: string; filename: string } | null>(null);

  useEffect(() => subscribePdfPreview(setState), []);

  const open = !!state?.url;

  const handleOpenChange = (next: boolean) => {
    if (!next) closePdfPreview();
  };

  const handleDownload = async () => {
    if (!state?.url) return;
    const blob = await fetch(state.url).then((r) => r.blob());
    downloadPdf(blob, state.filename);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-w-5xl w-[min(96vw,64rem)] h-[min(92vh,900px)] flex flex-col gap-3 p-4 sm:p-6"
      >
        <DialogHeader className="space-y-1 text-right">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <FileText className="w-5 h-5 text-primary shrink-0" />
            <span className="truncate">{state?.filename || 'معاينة PDF'}</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            معاينة ملف PDF داخل التطبيق — ليست معاينة طباعة المتصفح
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 rounded-md border bg-muted/30 overflow-hidden">
          {state?.url ? (
            <iframe
              title={state.filename}
              src={state.url}
              className="w-full h-[min(70vh,720px)] sm:h-[75vh] border-0 bg-white"
            />
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button type="button" variant="outline" className="gap-2" onClick={() => closePdfPreview()}>
            <X className="w-4 h-4" />
            إغلاق
          </Button>
          <Button type="button" className="gap-2" disabled={!state} onClick={() => void handleDownload()}>
            <Download className="w-4 h-4" />
            تحميل PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PdfPreviewDialog;
