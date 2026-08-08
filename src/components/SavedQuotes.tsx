import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Trash2, Edit, Loader2, RefreshCw, FileText, User, Hash, Download, Search, Ruler, Paperclip, Filter, ArrowRightLeft, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { SavedQuote, listQuotes, deleteQuote, toggleEmployeesViewQuotes, transferQuotes, listEmployees, AppUser, saveQuote } from '@/lib/userApi';
import * as XLSX from 'xlsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableScroller } from '@/components/layout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseCostCalcExcelMulti, type CostCalcImportResult } from '@/lib/costCalcExcel';
import { calculateQuote } from '@/lib/calcEngine';
import { usePrintingStore } from '@/store/printingStore';

interface SavedQuotesProps {
  sessionToken: string;
  userId: string;
  isEmployee: boolean;
  employeesCanViewQuotes: boolean;
  onEmployeesViewChange?: (enabled: boolean) => void;
  onLoadQuote?: (quote: SavedQuote) => void;
  canExport?: boolean;
  showEmployeesView?: boolean;
  showTransfer?: boolean;
  showImport?: boolean;
  showExport?: boolean;
  showRowActions?: boolean;
}

const SOURCE_LABELS: Record<string, string> = {
  calculator: 'حاسبة التسعير',
  magazine: 'المجلات',
  boxpricing: 'العلب',
  manual: 'يدوي',
};

const SOURCE_COLORS: Record<string, string> = {
  calculator: 'bg-primary/10 text-primary border-primary/20',
  magazine: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  boxpricing: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  manual: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
};


const exportQuotesExcel = (quotes: SavedQuote[]) => {
  const rows = quotes.map(q => ({
    'العنوان': q.title,
    'اسم العميل': q.customer_name,
    'رقم العرض': q.quote_number,
    'النوع': SOURCE_LABELS[q.source_type] || q.source_type,
    'التاريخ': new Date(q.created_at).toLocaleDateString('ar-SA'),
    'اسم الصنف': q.quote_data?.itemName || '',
    'رقم الصنف': q.quote_data?.itemNumber || '',
    'مقاس الصنف': q.quote_data?.itemSize || '',
    'نوع الورق': q.quote_data?.paperType || '',
    'مقاس الشراء': q.quote_data?.purchaseSize || '',
    'الجرامية': q.quote_data?.grammage || '',
    'الكمية': q.quote_data?.quantity || '',
    'عرض الطباعة': q.quote_data?.printWidth || '',
    'طول الطباعة': q.quote_data?.printHeight || '',
    'تفصل في الشيت': q.quote_data?.cutsPerSheet || '',
    'نسبة الهدر %': q.quote_data?.wastePercent ?? '',
    'عدد الألوان': q.quote_data?.colorCount || '',
    'عدد الأوجه': q.quote_data?.printedFaces || '',
    'إجمالي التكلفة': q.quote_data?.totalCost || '',
    'التشطيبات': q.quote_data?.totalFinishing || '',
    'الإجمالي الشامل': q.quote_data?.grandTotal || '',
    'سعر القطعة': q.quote_data?.pricePerPiece || '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0] || {}).map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'التكاليف المحفوظة');
  XLSX.writeFile(wb, `عروض_الأسعار_${new Date().toLocaleDateString('ar-SA')}.xlsx`);
  toast.success('تم تصدير العروض بنجاح');
};

const SavedQuotes = ({ sessionToken, userId, isEmployee, employeesCanViewQuotes, onEmployeesViewChange, onLoadQuote, canExport = false, showEmployeesView = true, showTransfer = true, showImport = true, showExport = true, showRowActions = true }: SavedQuotesProps) => {
  const { paperTypes, priceSettings } = usePrintingStore();
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [relatedQuotes, setRelatedQuotes] = useState<SavedQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SavedQuote | null>(null);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('mine');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advPrintSize, setAdvPrintSize] = useState('');
  const [advCutsPerSheet, setAdvCutsPerSheet] = useState('');
  const [advPaperType, setAdvPaperType] = useState('');
  const [advGrammage, setAdvGrammage] = useState('');

  // Transfer quotes state
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferFromId, setTransferFromId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<{ id: string; username: string }[]>([]);

  // Extract all pieces from any quote structure (supports both old mainPiece and new sheets[].pieces[])
  const extractPieces = (q: SavedQuote): Record<string, unknown>[] => {
    const raw = q.quote_data?.rawInputs || {};
    const pieces: Record<string, unknown>[] = [];
    // New costcalc structure: sheets[].pieces[]
    const sheets = raw.sheets || [];
    if (Array.isArray(sheets)) {
      for (const sheet of sheets) {
        const sp = (sheet as any)?.pieces || [];
        if (Array.isArray(sp)) pieces.push(...sp);
      }
    }
    // Old structure: mainPiece
    if (raw.mainPiece) pieces.push(raw.mainPiece as Record<string, unknown>);
    // Top-level quote_data fields as fallback
    if (!pieces.length) pieces.push(q.quote_data || {});
    return pieces;
  };

  const hasAdvancedFilter = advPrintSize || advCutsPerSheet || advPaperType || advGrammage;

  const clearAdvanced = () => {
    setAdvPrintSize('');
    setAdvCutsPerSheet('');
    setAdvPaperType('');
    setAdvGrammage('');
  };

  // Get unique employee names from relatedQuotes
  const employeeNames = useMemo(() => {
    const names = new Set<string>();
    relatedQuotes.forEach(q => {
      if (q.employee_username) names.add(q.employee_username);
    });
    return Array.from(names);
  }, [relatedQuotes]);

  // Get unique paper types from all quotes for autocomplete
  const allPaperTypes = useMemo(() => {
    const types = new Set<string>();
    [...quotes, ...relatedQuotes].forEach(q => {
      for (const p of extractPieces(q)) {
        const pt = ((p as any).paperType || '').toString().trim();
        if (pt) types.add(pt);
      }
    });
    return Array.from(types).sort();
  }, [quotes, relatedQuotes]);

  // Combine all quotes into one list based on ownerFilter
  const allDisplayQuotes = useMemo(() => {
    let items: SavedQuote[] = [];
    if (ownerFilter === 'mine') {
      items = quotes;
    } else if (ownerFilter === 'all') {
      items = [...quotes, ...relatedQuotes];
    } else {
      items = relatedQuotes.filter(q => q.employee_username === ownerFilter);
    }

    // Apply text search
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      items = items.filter(q => {
        const itemName = (q.quote_data?.itemName || '').toString().toLowerCase();
        const itemNumber = (q.quote_data?.itemNumber || '').toString().toLowerCase();
        const itemSize = (q.quote_data?.itemSize || '').toString().toLowerCase();
        const title = (q.title || '').toLowerCase();
        const customerName = (q.customer_name || '').toLowerCase();
        if (itemName.includes(term) || itemNumber.includes(term) || itemSize.includes(term) || title.includes(term) || customerName.includes(term)) return true;
        // Also search in pieces data
        for (const p of extractPieces(q)) {
          const pp = p as any;
          if ((pp.paperType || '').toString().toLowerCase().includes(term)) return true;
          if ((pp.purchaseSize || '').toString().toLowerCase().includes(term)) return true;
          if ((pp.grammage || '').toString().includes(term)) return true;
        }
        return false;
      });
    }

    // Apply source filter
    if (sourceFilter !== 'all') {
      items = items.filter(q => q.source_type === sourceFilter);
    }

    // Apply advanced filters
    if (advPrintSize.trim()) {
      const size = advPrintSize.trim().toLowerCase();
      items = items.filter(q => {
        for (const p of extractPieces(q)) {
          const pp = p as any;
          const pw = (pp.printWidth || '').toString();
          const ph = (pp.printHeight || '').toString();
          const combined = `${pw}x${ph}`;
          const combinedAlt = `${pw}×${ph}`;
          const reverseCombined = `${ph}x${pw}`;
          const reverseCombinedAlt = `${ph}×${pw}`;
          const ps = (pp.purchaseSize || '').toString().toLowerCase();
          if (combined.includes(size) || combinedAlt.includes(size) || reverseCombined.includes(size) || reverseCombinedAlt.includes(size) || ps.includes(size) || pw === size || ph === size) return true;
        }
        return false;
      });
    }

    if (advCutsPerSheet.trim()) {
      const cuts = advCutsPerSheet.trim();
      items = items.filter(q => {
        for (const p of extractPieces(q)) {
          if (((p as any).cutsPerSheet || '').toString() === cuts) return true;
        }
        return false;
      });
    }

    if (advPaperType.trim()) {
      const pt = advPaperType.trim().toLowerCase();
      items = items.filter(q => {
        for (const p of extractPieces(q)) {
          if (((p as any).paperType || '').toString().toLowerCase().includes(pt)) return true;
        }
        return false;
      });
    }

    if (advGrammage.trim()) {
      const gr = advGrammage.trim();
      items = items.filter(q => {
        for (const p of extractPieces(q)) {
          if (((p as any).grammage || '').toString() === gr) return true;
        }
        return false;
      });
    }

    return items;
  }, [quotes, relatedQuotes, ownerFilter, searchTerm, sourceFilter, advPrintSize, advCutsPerSheet, advPaperType, advGrammage]);

  const totalCount = quotes.length + relatedQuotes.length;

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const data = await listQuotes(sessionToken);
      setQuotes(data.quotes);
      setRelatedQuotes(data.related_quotes);
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchQuotes(); }, []);

  const handleDelete = (quote: SavedQuote) => setDeleteTarget(quote);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteQuote(sessionToken, deleteTarget.id);
      toast.success('تم حذف العرض');
      fetchQuotes();
    } catch (err: any) { toast.error(err.message); }
    finally { setDeleteTarget(null); }
  };

  const handleToggleView = async () => {
    setToggling(true);
    try {
      const newVal = !employeesCanViewQuotes;
      await toggleEmployeesViewQuotes(sessionToken, newVal);
      onEmployeesViewChange?.(newVal);
      toast.success(newVal ? 'تم السماح للموظفين برؤية عروضك' : 'تم حجب العروض عن الموظفين');
    } catch (err: any) { toast.error(err.message); }
    finally { setToggling(false); }
  };

  const openTransferDialog = async () => {
    setTransferFromId('');
    setTransferToId('');
    setShowTransferDialog(true);
    if (!isEmployee) {
      try {
        const emps = await listEmployees(sessionToken);
        setFamilyMembers([
          { id: userId, username: 'حسابي الأساسي' },
          ...emps.map(e => ({ id: e.id, username: e.username })),
        ]);
      } catch { setFamilyMembers([{ id: userId, username: 'حسابي الأساسي' }]); }
    }
  };

  const handleTransfer = async () => {
    if (!transferFromId || !transferToId || transferFromId === transferToId) {
      toast.error('يرجى اختيار مصدر ووجهة مختلفين');
      return;
    }
    setTransferLoading(true);
    try {
      await transferQuotes(sessionToken, transferFromId, transferToId);
      const fromName = familyMembers.find(m => m.id === transferFromId)?.username || '';
      const toName = familyMembers.find(m => m.id === transferToId)?.username || '';
      toast.success(`تم ترحيل العروض من "${fromName}" إلى "${toName}"`);
      setShowTransferDialog(false);
      fetchQuotes();
    } catch (err: any) { toast.error(err.message); }
    finally { setTransferLoading(false); }
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const results = parseCostCalcExcelMulti(ev.target?.result as ArrayBuffer);
        let savedCount = 0;
        for (const result of results) {
          const sheets = [{ id: crypto.randomUUID(), pieces: result.pieces.map(p => ({ id: crypto.randomUUID(), ...p })) }];
          let grandTotal = 0;
          for (const piece of result.pieces) {
            const inputs = {
              quantity: piece.quantity, colorCount: piece.colorCount, printWidth: piece.printWidth,
              printHeight: piece.printHeight, cutsPerSheet: piece.cutsPerSheet, paperType: piece.paperType,
              grammage: piece.grammage, purchaseSize: piece.purchaseSize, printedFaces: piece.printedFaces,
              facesDifferent: piece.facesDifferent, wastePercent: piece.wastePercent,
              cellophaneFaces: piece.cellophaneFaces, dieCut: piece.dieCut, moldPrice: piece.moldPrice,
              wasteInCosts: piece.wasteInCosts || true,
              extraColorCalcType: 'per_1000' as const, extraColorPrice: 0, extraColorExtra1000: 0,
              extraColorCount: piece.extraColorCount,
            };
            const calc = calculateQuote(inputs, piece.finishing, paperTypes, priceSettings);
            grandTotal += calc.grandTotal;
          }
          const quoteData = {
            sourceType: 'costcalc', rawInputs: { sheets },
            itemName: result.itemName, itemNumber: result.itemNumber, itemSize: result.itemSize,
            grandTotal, sheetCount: 1,
          };
          await saveQuote(sessionToken, {
            title: result.itemName || 'تكلفة مستوردة',
            customer_name: result.itemName, quote_number: result.itemNumber,
            source_type: 'costcalc', quote_data: quoteData,
          });
          savedCount++;
        }
        toast.success(`تم استيراد وحفظ ${savedCount} تسعيرة بنجاح`);
        fetchQuotes();
      } catch (err: any) {
        toast.error('خطأ في استيراد الملف: ' + err.message);
      } finally { setImporting(false); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
  const formatTime = (d: string) => new Date(d).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

  const formatCurrency = (val: any) => {
    const num = Number(val);
    if (isNaN(num) || !val) return '—';
    return num.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ر.س';
  };

  const QuotesTable = ({ items, showOwner, canEdit }: { items: SavedQuote[]; showOwner: boolean; canEdit: boolean }) => (
    <TableScroller hint="اسحب أفقياً لعرض كل الأعمدة">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="text-start font-bold w-8">#</TableHead>
            <TableHead className="text-start font-bold">الصنف</TableHead>
            <TableHead className="text-start font-bold">النوع</TableHead>
            <TableHead className="text-start font-bold">الإجمالي</TableHead>
            <TableHead className="text-start font-bold">الكمية</TableHead>
            <TableHead className="text-start font-bold">التاريخ</TableHead>
            {showOwner && <TableHead className="text-start font-bold">الموظف</TableHead>}
            <TableHead className="text-center font-bold w-[140px]">إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((q, idx) => (
            <TableRow key={q.id} className="group hover:bg-muted/30 transition-colors">
              <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
              <TableCell>
                <div className="space-y-0.5">
                  <p className="font-semibold text-sm leading-tight">
                    {q.quote_data?.itemName || q.title || 'بدون اسم'}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {q.quote_data?.itemNumber && (
                      <span className="flex items-center gap-0.5">
                        <Hash className="w-2.5 h-2.5" />{q.quote_data.itemNumber}
                      </span>
                    )}
                    {q.quote_data?.itemSize && (
                      <span className="flex items-center gap-0.5">
                        <Ruler className="w-2.5 h-2.5" />{q.quote_data.itemSize}
                      </span>
                    )}
                    {q.quote_data?.attachmentUrl && (
                      <span className="text-primary"><Paperclip className="w-2.5 h-2.5 inline" /></span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border whitespace-nowrap ${SOURCE_COLORS[q.source_type] || ''}`}>
                  {SOURCE_LABELS[q.source_type] || q.source_type}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="font-bold text-sm text-primary whitespace-nowrap">
                  {formatCurrency(q.quote_data?.grandTotal)}
                </span>
              </TableCell>
              <TableCell className="text-sm">
                {q.quote_data?.quantity ? Number(q.quote_data.quantity).toLocaleString('ar-SA') : '—'}
              </TableCell>
              <TableCell>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  <div>{formatDate(q.created_at)}</div>
                  <div className="text-[10px]">{formatTime(q.created_at)}</div>
                </div>
              </TableCell>
              {showOwner && (
                <TableCell>
                  <span className="text-xs">{q.employee_username || '—'}</span>
                </TableCell>
              )}
              <TableCell>
                <div className="flex items-center justify-center gap-1">
                  {canEdit && onLoadQuote && (
                    <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-7 sm:w-7 text-primary" title="تعديل" onClick={() => onLoadQuote(q)}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {canEdit && (
                    <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-7 sm:w-7 text-destructive hover:text-destructive" title="حذف" onClick={() => handleDelete(q)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableScroller>
  );

  return (
    <div dir="rtl" className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-primary" />
              التكاليف المحفوظة
              <Badge variant="secondary" className="mr-1 text-xs">{allDisplayQuotes.length} / {totalCount}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {!isEmployee && showEmployeesView && (
                <div className="flex items-center gap-2 text-sm border rounded-lg px-3 py-1.5 bg-muted/30">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">رؤية الموظفين</Label>
                  <Switch checked={employeesCanViewQuotes} onCheckedChange={handleToggleView} disabled={toggling} />
                </div>
              )}
              {!isEmployee && showTransfer && (
                <Button variant="outline" size="sm" onClick={openTransferDialog} className="gap-1.5 h-8">
                  <ArrowRightLeft className="w-3.5 h-3.5" /> ترحيل عروض
                </Button>
              )}
              {showImport && (
                <>
                  <input ref={importFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelImport} />
                  <Button variant="outline" size="sm" onClick={() => importFileRef.current?.click()} disabled={importing} className="gap-1.5 h-8">
                    {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} استيراد Excel
                  </Button>
                </>
              )}
              {canExport && showExport && (
                <Button variant="outline" size="sm" onClick={() => { import('@/lib/activityTracker').then(m => m.trackActivity('export_excel', 'savedquotes', { count: quotes.length })); exportQuotesExcel(quotes); }} disabled={quotes.length === 0} className="gap-1.5 h-8">
                  <Download className="w-3.5 h-3.5" /> تصدير
                </Button>
              )}
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={fetchQuotes} disabled={loading}>
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث باسم الصنف، رقم الصنف، المقاس، أو العنوان..."
                className="pr-9 h-9"
              />
            </div>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="h-9 w-full sm:w-[150px]">
                <Filter className="w-3.5 h-3.5 ml-1.5 text-muted-foreground" />
                <SelectValue placeholder="نوع الحاسبة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأنواع</SelectItem>
                <SelectItem value="calculator">حاسبة التسعير</SelectItem>
                <SelectItem value="magazine">المجلات</SelectItem>
                <SelectItem value="boxpricing">العلب</SelectItem>
                <SelectItem value="manual">يدوي</SelectItem>
                <SelectItem value="employee">إدخال موظف</SelectItem>
              </SelectContent>
            </Select>
            {(relatedQuotes.length > 0 || employeeNames.length > 0) && (
              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="h-9 w-full sm:w-[160px]">
                  <User className="w-3.5 h-3.5 ml-1.5 text-muted-foreground" />
                  <SelectValue placeholder="العروض" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mine">عروضي فقط</SelectItem>
                  <SelectItem value="all">الكل</SelectItem>
                  {employeeNames.map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant={showAdvanced ? 'secondary' : 'outline'}
              size="sm"
              className="h-9 gap-1.5 whitespace-nowrap"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Ruler className="w-3.5 h-3.5" />
              بحث بالمواصفات
              {hasAdvancedFilter && <Badge variant="default" className="h-4 px-1 text-[10px] mr-1">فعّال</Badge>}
            </Button>
          </div>

          {/* Advanced Search */}
          {showAdvanced && (
            <div className="mt-2 p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5" />
                  بحث بمواصفات الطباعة
                </p>
                {hasAdvancedFilter && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground px-2" onClick={clearAdvanced}>
                    مسح الكل
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">مقاس شيت الطباعة</Label>
                  <Input
                    value={advPrintSize}
                    onChange={(e) => setAdvPrintSize(e.target.value)}
                    placeholder="مثال: 70x100 أو 70"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">نوع الورق</Label>
                  {allPaperTypes.length > 0 ? (
                    <Select value={advPaperType || '__all__'} onValueChange={(v) => setAdvPaperType(v === '__all__' ? '' : v)}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="اختيار نوع الورق" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">الكل</SelectItem>
                        {allPaperTypes.map(pt => (
                          <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={advPaperType}
                      onChange={(e) => setAdvPaperType(e.target.value)}
                      placeholder="مثال: كوشيه"
                      className="h-8 text-sm"
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">الجرامية</Label>
                  <Input
                    type="number"
                    value={advGrammage}
                    onChange={(e) => setAdvGrammage(e.target.value)}
                    placeholder="مثال: 300"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">التفصيل في الشيت</Label>
                  <Input
                    type="number"
                    value={advCutsPerSheet}
                    onChange={(e) => setAdvCutsPerSheet(e.target.value)}
                    placeholder="مثال: 4"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

        </CardHeader>

        <CardContent className="pt-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
              <p className="text-sm text-muted-foreground">جاري تحميل العروض...</p>
            </div>
          ) : allDisplayQuotes.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
                <FileText className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <p className="font-medium text-muted-foreground">
                {searchTerm || sourceFilter !== 'all' || ownerFilter !== 'mine' ? 'لا توجد نتائج مطابقة' : 'لا توجد عروض محفوظة'}
              </p>
              <p className="text-xs text-muted-foreground/70">
                {searchTerm || sourceFilter !== 'all' ? 'جرب تغيير معايير البحث أو الفلاتر' : 'احفظ عرض سعر من صفحة "عرض سعر" لتظهر هنا'}
              </p>
            </div>
          ) : (
            <QuotesTable items={allDisplayQuotes} showOwner={ownerFilter !== 'mine'} canEdit={showRowActions} />
          )}
        </CardContent>
      </Card>


      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد حذف العرض "{deleteTarget?.title || 'بدون عنوان'}"؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:gap-0">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Quotes Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-primary" />
              ترحيل العروض
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">ترحيل من</Label>
              <Select value={transferFromId} onValueChange={setTransferFromId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="اختر المصدر" />
                </SelectTrigger>
                <SelectContent>
                  {familyMembers.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">ترحيل إلى</Label>
              <Select value={transferToId} onValueChange={setTransferToId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="اختر الوجهة" />
                </SelectTrigger>
                <SelectContent>
                  {familyMembers.filter(m => m.id !== transferFromId).map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferDialog(false)}>إلغاء</Button>
            <Button onClick={handleTransfer} disabled={transferLoading || !transferFromId || !transferToId} className="gap-1">
              {transferLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              ترحيل العروض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SavedQuotes;
