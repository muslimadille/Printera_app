import { usePrintingStore } from '@/store/printingStore';
import { Input } from '@/components/ui/input';
import { finite, formatMoney, isFiniteMoney, num, safeDiv } from '@/lib/safeNumber';

interface ProfitMarginsProps {
  grandTotal: number;
  quantity: number;
  pieceLabel?: string;
  /** When true (or totals non-finite), show placeholders instead of NaN */
  incomplete?: boolean;
}

const ProfitMargins = ({
  grandTotal,
  quantity,
  pieceLabel = 'سعر القطعة',
  incomplete = false,
}: ProfitMarginsProps) => {
  const { profitMargins, setProfitMargins } = usePrintingStore();

  const updateMargin = (index: number, value: number) => {
    const updated = [...profitMargins];
    updated[index] = num(value);
    setProfitMargins(updated);
  };

  const ready = !incomplete && isFiniteMoney(grandTotal) && num(quantity) >= 0;
  const safeTotal = ready ? finite(grandTotal) : NaN;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="text-sm font-semibold text-muted-foreground">هوامش الربح</h4>
        <div className="flex flex-wrap items-center gap-2">
          {profitMargins.map((m, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input
                type="number"
                value={m}
                onChange={(e) => updateMargin(i, Number(e.target.value))}
                className="w-14 h-7 text-xs text-center"
                min={0}
                max={100}
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          ))}
        </div>
      </div>

      {!ready && (
        <p className="text-[11px] text-muted-foreground text-center">أدخل البيانات لعرض التكلفة</p>
      )}

      {/* Horizontal row of margin cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full min-w-0">
        {profitMargins.map((percent, i) => {
          const totalWithProfit = ready ? finite(safeTotal * (1 + num(percent) / 100)) : NaN;
          const pieceWithProfit = ready ? safeDiv(totalWithProfit, quantity) : NaN;
          const profitDiff = ready ? finite(totalWithProfit - safeTotal) : NaN;
          return (
            <div
              key={i}
              className="min-w-0 rounded-xl border border-primary/20 bg-gradient-to-b from-primary/5 to-background p-2.5 text-center space-y-1.5"
            >
              <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                ربح {percent}%
              </span>
              <div>
                <p className="text-[10px] text-muted-foreground leading-tight">الإجمالي بالربح</p>
                <p className="text-sm font-bold text-foreground tabular-nums">{formatMoney(totalWithProfit)}</p>
              </div>
              <div className="border-t border-border pt-1.5">
                <p className="text-[10px] text-muted-foreground leading-tight">{pieceLabel}</p>
                <p className="text-xs font-semibold text-primary tabular-nums">{formatMoney(pieceWithProfit, 4)}</p>
              </div>
              <div className="border-t border-border pt-1.5">
                <p className="text-[10px] text-muted-foreground leading-tight">فرق الربح</p>
                <p className="text-xs font-bold text-primary tabular-nums">{formatMoney(profitDiff)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProfitMargins;
