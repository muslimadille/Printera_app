import { usePrintingStore } from '@/store/printingStore';
import { Input } from '@/components/ui/input';

interface ProfitMarginsProps {
  grandTotal: number;
  quantity: number;
  pieceLabel?: string;
}

const ProfitMargins = ({ grandTotal, quantity, pieceLabel = 'سعر القطعة' }: ProfitMarginsProps) => {
  const { profitMargins, setProfitMargins } = usePrintingStore();

  const updateMargin = (index: number, value: number) => {
    const updated = [...profitMargins];
    updated[index] = value;
    setProfitMargins(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-muted-foreground">هوامش الربح</h4>
        <div className="flex items-center gap-2">
          {profitMargins.map((m, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input
                type="number"
                value={m}
                onChange={(e) => updateMargin(i, Number(e.target.value))}
                className="w-16 h-7 text-xs text-center"
                min={0}
                max={100}
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {profitMargins.map((percent, i) => {
          const totalWithProfit = grandTotal * (1 + percent / 100);
          const pieceWithProfit = quantity === 0 ? 0 : totalWithProfit / quantity;
          const profitDiff = totalWithProfit - grandTotal;
          return (
            <div
              key={i}
              className="rounded-xl border border-primary/20 bg-gradient-to-b from-primary/5 to-background p-3 text-center space-y-2"
            >
              <span className="inline-block rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
                ربح {percent}%
              </span>
              <div>
                <p className="text-[11px] text-muted-foreground">الإجمالي بالربح</p>
                <p className="text-base font-bold text-foreground">{totalWithProfit.toFixed(2)}</p>
              </div>
              <div className="border-t border-border pt-2">
                <p className="text-[11px] text-muted-foreground">{pieceLabel}</p>
                <p className="text-sm font-semibold text-primary">{pieceWithProfit.toFixed(4)}</p>
              </div>
              <div className="border-t border-border pt-2">
                <p className="text-[11px] text-muted-foreground">فرق الربح</p>
                <p className="text-sm font-bold text-primary">{profitDiff.toFixed(2)} ريال</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProfitMargins;
