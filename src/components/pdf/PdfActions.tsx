import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Eye, Loader2 } from 'lucide-react';
import {
  downloadPdf,
  generatePdfFromElement,
  previewPdf,
  type PdfSource,
} from '@/lib/pdf/pdfService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type PdfActionsProps = {
  /** Meaningful Arabic filename, e.g. عرض-سعر-Q1-2026-08-08.pdf */
  filename: string;
  /** Resolve the DOM source for html→PDF (preferred for quotes/summaries). */
  getElement?: () => HTMLElement | null;
  /** Or supply a custom generator (vector exporters, prebuilt blobs). */
  generate?: () => Promise<PdfSource>;
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  previewLabel?: string;
  downloadLabel?: string;
  onDone?: (mode: 'preview' | 'download') => void;
};

/**
 * Drop-in Preview + Download controls wired to the shared PDF pipeline.
 */
const PdfActions = ({
  filename,
  getElement,
  generate,
  className,
  size = 'default',
  previewLabel = 'معاينة PDF',
  downloadLabel = 'تحميل PDF',
  onDone,
}: PdfActionsProps) => {
  const [busy, setBusy] = useState<'preview' | 'download' | null>(null);

  const build = async (): Promise<PdfSource> => {
    if (generate) return generate();
    const el = getElement?.() ?? null;
    if (!el) throw new Error('لا يوجد محتوى لتصديره');
    return generatePdfFromElement(el);
  };

  const run = async (mode: 'preview' | 'download') => {
    if (busy) return;
    setBusy(mode);
    try {
      const pdf = await build();
      if (mode === 'preview') await previewPdf(pdf, filename);
      else downloadPdf(pdf, filename);
      onDone?.(mode);
    } catch (e) {
      console.error('PDF action failed', e);
      toast.error(e instanceof Error ? e.message : 'فشل إنشاء ملف PDF');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Button
        type="button"
        variant="outline"
        size={size}
        className="gap-2"
        disabled={!!busy}
        onClick={() => void run('preview')}
      >
        {busy === 'preview' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
        {previewLabel}
      </Button>
      <Button
        type="button"
        size={size}
        className="gap-2"
        disabled={!!busy}
        onClick={() => void run('download')}
      >
        {busy === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {downloadLabel}
      </Button>
    </div>
  );
};

export default PdfActions;
