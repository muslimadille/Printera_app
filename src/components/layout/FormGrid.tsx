import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type FormGridProps = {
  children: ReactNode;
  className?: string;
  /** Default: 1 col mobile → 2 col from sm */
  cols?: 1 | 2 | 3;
};

/** Responsive form field grid. Children should use min-w-0. */
export function FormGrid({ children, className, cols = 2 }: FormGridProps) {
  return (
    <div
      className={cn(
        'grid gap-3 min-w-0 w-full',
        cols === 1 && 'grid-cols-1',
        cols === 2 && 'grid-cols-1 sm:grid-cols-2',
        cols === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {children}
    </div>
  );
}

type FormRowProps = {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  /** Keep paired inputs (e.g. W×H) on one line when possible */
  inline?: boolean;
};

/** Label + control row that wraps safely in RTL. */
export function FormRow({ label, children, className, inline }: FormRowProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-12 items-center gap-2 sm:gap-3 min-w-0',
        className,
      )}
    >
      <div className="col-span-12 sm:col-span-3 text-start min-w-0">
        {label}
      </div>
      <div
        className={cn(
          'col-span-12 sm:col-span-9 min-w-0',
          inline && 'flex flex-wrap items-center gap-2',
        )}
      >
        {children}
      </div>
    </div>
  );
}
