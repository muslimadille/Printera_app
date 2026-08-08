import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type TableScrollerProps = {
  children: ReactNode;
  className?: string;
  /** Optional hint shown on small screens */
  hint?: string;
};

/**
 * Contained horizontal scroll for wide tables — never causes page overflow.
 * Pair with mobile card stacks when a table needs a true stacked alternate view.
 */
export function TableScroller({ children, className, hint }: TableScrollerProps) {
  return (
    <div className={cn('min-w-0 w-full max-w-full', className)}>
      {hint && (
        <p className="mb-1.5 text-[10px] text-muted-foreground sm:hidden">
          {hint}
        </p>
      )}
      <div
        className={cn(
          'relative w-full max-w-full overflow-x-auto overscroll-x-contain',
          'rounded-lg border border-border/50',
          '[-webkit-overflow-scrolling:touch]',
        )}
      >
        {children}
      </div>
    </div>
  );
}
