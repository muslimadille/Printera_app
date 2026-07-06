import { useState, useEffect } from 'react';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  originalTabLabel: string;
  availableTabs: { key: string; label: string }[];
  onCancel: () => void;
  onConfirm: (tabKey: string) => void;
}

const QuoteTabPickerDialog = ({ open, originalTabLabel, availableTabs, onCancel, onConfirm }: Props) => {
  const [selected, setSelected] = useState<string>('');

  useEffect(() => {
    if (open) setSelected(availableTabs[0]?.key || '');
  }, [open, availableTabs]);

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            التبويبة الأصلية غير متاحة
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              هذه العملية مرتبطة بتبويبة <span className="font-semibold text-foreground">"{originalTabLabel}"</span> وهي غير متاحة حاليًا لحسابك.
            </span>
            <span className="block text-xs">
              يمكنك اختيار تبويبة أخرى لفتحها، وقد يختلف عرض أو سلوك بعض البيانات.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-2">
          <p className="text-sm font-medium mb-2">اختر التبويبة البديلة:</p>
          {availableTabs.length === 0 ? (
            <p className="text-sm text-destructive">لا توجد تبويبات متاحة لفتح هذه العملية.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-auto">
              {availableTabs.map(t => (
                <Button
                  key={t.key}
                  type="button"
                  variant={selected === t.key ? 'default' : 'outline'}
                  size="sm"
                  className="justify-start"
                  onClick={() => setSelected(t.key)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          )}
        </div>

        <AlertDialogFooter className="flex gap-2 sm:flex-row-reverse">
          <AlertDialogAction
            disabled={!selected}
            onClick={() => selected && onConfirm(selected)}
          >
            فتح في التبويبة المختارة
          </AlertDialogAction>
          <AlertDialogCancel onClick={onCancel}>إلغاء</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default QuoteTabPickerDialog;
