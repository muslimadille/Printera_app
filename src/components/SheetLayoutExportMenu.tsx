import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Download, Eye, FileImage, FileText, Loader2 } from 'lucide-react';
import { buildPDF, exportLayout, type ExportFormat } from '@/lib/sheetLayoutExport';
import { downloadPdf, previewPdf } from '@/lib/pdf/pdfService';
import type { LayoutPiece } from '@/lib/sheetLayoutOptimizer';
import type { ParsedDieline } from '@/lib/dielineImport';
import { toast } from '@/hooks/use-toast';

interface Props {
  sheetW: number;
  sheetH: number;
  pieces: LayoutPiece[];
  baseName?: string;
  /** Visual size — defaults to 'sm' */
  size?: 'sm' | 'default';
  /** Render as a smaller compact button (used inside scenario cards) */
  compact?: boolean;
  /** When provided, every piece is exported as the dieline geometry */
  dieline?: ParsedDieline | null;
}

const SheetLayoutExportMenu = ({ sheetW, sheetH, pieces, baseName = 'sheet-layout', size = 'sm', compact = false, dieline = null }: Props) => {
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeWaste, setIncludeWaste] = useState(false);
  const [includeBoundary, setIncludeBoundary] = useState(true);
  const [cleanMode, setCleanMode] = useState(false);
  const [busy, setBusy] = useState<'preview' | 'download' | null>(null);

  const disabled = !pieces || pieces.length === 0 || sheetW <= 0 || sheetH <= 0;

  const exportOpts = {
    sheetW,
    sheetH,
    pieces,
    includeNumbers,
    includeWaste,
    includeBoundary,
    cleanMode,
    title: baseName,
    dieline,
  };

  const handleExport = (format: ExportFormat) => {
    if (disabled) return;
    try {
      exportLayout(format, exportOpts, baseName);
      toast({
        title: 'تم التصدير بنجاح',
        description: `${format.toUpperCase()} — ${pieces.length} قطعة · ${sheetW}×${sheetH} سم${dieline ? ' · مع القالب' : ''}`,
      });
    } catch (e) {
      console.error('Export failed', e);
      toast({ title: 'فشل التصدير', description: String(e), variant: 'destructive' });
    }
  };

  const handlePdf = async (mode: 'preview' | 'download') => {
    if (disabled || busy) return;
    setBusy(mode);
    try {
      const safeName = baseName.replace(/[^\w\u0600-\u06FF\-_.]+/g, '_');
      const filename = `${safeName}.pdf`;
      const bytes = buildPDF(exportOpts);
      const ab = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(ab).set(bytes);
      const blob = new Blob([ab], { type: 'application/pdf' });
      if (mode === 'preview') await previewPdf(blob, filename);
      else downloadPdf(blob, filename);
      toast({
        title: mode === 'preview' ? 'تمت المعاينة' : 'تم التصدير بنجاح',
        description: `PDF — ${pieces.length} قطعة · ${sheetW}×${sheetH} سم${dieline ? ' · مع القالب' : ''}`,
      });
    } catch (e) {
      console.error('PDF export failed', e);
      toast({ title: 'فشل التصدير', description: String(e), variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  // Stop the click bubbling up to parent ScenarioCard buttons.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div onClick={stop} onPointerDown={stop}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size={size}
            variant="outline"
            disabled={disabled || !!busy}
            className={compact ? 'h-7 px-2 text-[10px] gap-1' : 'h-8 px-3 text-xs gap-1.5'}
          >
            {busy ? <Loader2 className={compact ? 'w-3 h-3 animate-spin' : 'w-3.5 h-3.5 animate-spin'} /> : <Download className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
            تصدير إنتاجي
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 text-right">
          <DropdownMenuLabel className="text-xs">صيغة الملف</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => void handlePdf('preview')} className="text-xs gap-2">
            <Eye className="w-3.5 h-3.5 text-sky-500" />
            <div className="flex-1">
              <div className="font-semibold">معاينة PDF</div>
              <div className="text-[10px] text-muted-foreground">عرض كتيار PDF داخل التطبيق</div>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handlePdf('download')} className="text-xs gap-2">
            <FileText className="w-3.5 h-3.5 text-red-500" />
            <div className="flex-1">
              <div className="font-semibold">تحميل PDF</div>
              <div className="text-[10px] text-muted-foreground">ملف .pdf — مقاسات mm حقيقية</div>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport('svg')} className="text-xs gap-2">
            <FileImage className="w-3.5 h-3.5 text-emerald-500" />
            <div className="flex-1">
              <div className="font-semibold">SVG</div>
              <div className="text-[10px] text-muted-foreground">متجه قابل للتحرير في برامج التصميم</div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs">الطبقات</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={includeBoundary}
            onCheckedChange={(v) => setIncludeBoundary(!!v)}
            onSelect={(e) => e.preventDefault()}
            className="text-xs"
          >
            حدود الشيت
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={includeNumbers}
            onCheckedChange={(v) => setIncludeNumbers(!!v)}
            onSelect={(e) => e.preventDefault()}
            className="text-xs"
            disabled={cleanMode}
          >
            أرقام القطع
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={includeWaste}
            onCheckedChange={(v) => setIncludeWaste(!!v)}
            onSelect={(e) => e.preventDefault()}
            className="text-xs"
            disabled={cleanMode}
          >
            طبقة الهدر
          </DropdownMenuCheckboxItem>

          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={cleanMode}
            onCheckedChange={(v) => setCleanMode(!!v)}
            onSelect={(e) => e.preventDefault()}
            className="text-xs"
          >
            <span className="font-semibold">Clean Print File</span>
            <span className="mr-auto text-[10px] text-muted-foreground">بدون أرقام أو مساعدات</span>
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default SheetLayoutExportMenu;
