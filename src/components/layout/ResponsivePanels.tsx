import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useUiPrefs } from '@/hooks/useUiPrefs';

type ResponsivePanelsProps = {
  /** Preview / scenarios / manual canvas — full-width on top in sidebar & below lg */
  preview?: ReactNode;
  /** Main form inputs */
  form: ReactNode;
  /** Cost summary (sticky on desktop; use with MobileCostBar on small screens) */
  summary: ReactNode;
  /** Extra siblings (dialogs, mobile bars) rendered after the layout */
  children?: ReactNode;
  className?: string;
};

/**
 * Calculator shell: desktop multi-column ↔ stacked column below `lg`.
 * Sidebar layout: preview full-width on top, then form + summary.
 * Topbar layout: classic 3-col (preview | form | summary) with order classes.
 */
export function ResponsivePanels({
  preview,
  form,
  summary,
  children,
  className,
}: ResponsivePanelsProps) {
  const { layoutMode } = useUiPrefs();
  const sidebarNav = layoutMode === 'sidebar';

  return (
    <div
      data-layout={layoutMode}
      className={cn(
        'pb-20 lg:pb-0 min-w-0 w-full',
        'calc-shell',
        sidebarNav
          ? 'flex flex-col gap-4 sm:gap-5'
          : 'grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5',
        className,
      )}
    >

      {preview != null && (
        <div
          className={cn(
            'min-w-0',
            sidebarNav
              ? 'w-full max-w-full shrink-0 basis-full space-y-4 order-first'
              : 'lg:col-span-4 space-y-4 lg:order-1',
          )}
        >
          {preview}
        </div>
      )}

      <div
        className={cn(
          'min-w-0',
          sidebarNav
            ? 'grid w-full grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5'
            : 'contents',
        )}
      >
        <div
          className={cn(
            'space-y-3 sm:space-y-4 min-w-0',
            sidebarNav ? 'lg:col-span-8' : 'lg:col-span-5 lg:order-2',
          )}
        >
          {form}
        </div>

        <div
          className={cn(
            'min-w-0 space-y-4',
            /* Show summary inline on mobile when no floating bar covers it —
               keep sticky desktop panel; hide on small if MobileCostBar is used
               by the parent (summary still in DOM for a11y via sr-only skip). */
            'lg:block lg:sticky lg:top-4 lg:self-start',
            sidebarNav ? 'lg:col-span-4' : 'lg:col-span-3 lg:order-3',
            'hidden lg:block',
          )}
        >
          {summary}
        </div>
      </div>

      {children}
    </div>
  );
}
