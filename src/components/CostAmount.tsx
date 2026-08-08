import { formatMoney, isFiniteMoney } from '@/lib/safeNumber';
import { cn } from '@/lib/utils';

type CostAmountProps = {
  value: unknown;
  digits?: number;
  className?: string;
  /** Suffix e.g. " ر.س" — omitted when value is non-finite */
  suffix?: string;
  empty?: string;
};

/** Renders a money value or "—" when non-finite — never raw NaN/Infinity. */
export function CostAmount({
  value,
  digits = 2,
  className,
  suffix = '',
  empty = '—',
}: CostAmountProps) {
  const ready = isFiniteMoney(value);
  return (
    <span className={cn('tabular-nums', className)}>
      {formatMoney(value, digits, empty)}
      {ready && suffix ? suffix : ''}
    </span>
  );
}

export function CostIncompleteHint({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="text-[11px] text-muted-foreground text-center mt-1">
      أدخل البيانات لعرض التكلفة
    </p>
  );
}
