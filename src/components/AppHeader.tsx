import { Download, LogOut, Play, Menu, Printer, PanelRight, PanelTop } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { LayoutMode } from '@/hooks/useUiPrefs';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  username: string;
  onLogout: () => void;
  onTourStart: () => void;
  showTour?: boolean;
  isAdmin?: boolean;
  isAccountOwner?: boolean;
  layoutMode?: LayoutMode;
  onToggleLayout?: () => void;
  /** Slimmer chrome when sidebar owns primary nav */
  compact?: boolean;
}

const AppHeader = ({
  username,
  onLogout,
  onTourStart,
  showTour = true,
  isAdmin = false,
  isAccountOwner = false,
  layoutMode = 'topbar',
  onToggleLayout,
  compact = false,
}: AppHeaderProps) => {
  const roleLabel = isAdmin ? 'مدير النظام' : isAccountOwner ? 'مدير الحساب' : null;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const sidebarLayout = layoutMode === 'sidebar';

  const layoutToggle = onToggleLayout ? (
    <Button
      variant="ghost"
      size="icon"
      className="h-11 w-11 sm:h-9 sm:w-9 transition-colors duration-200"
      onClick={onToggleLayout}
      aria-label={sidebarLayout ? 'التبديل إلى شريط علوي' : 'التبديل إلى قائمة جانبية'}
      title={sidebarLayout ? 'شريط علوي' : 'قائمة جانبية'}
    >
      {sidebarLayout ? <PanelTop className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
    </Button>
  ) : null;

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-border/50 glass-header py-2.5 sm:py-3 px-3 sm:px-4 md:px-6',
        'shadow-[0_1px_15px_-3px_hsl(var(--primary)_/_0.08)] dark:shadow-[0_1px_18px_-3px_hsl(var(--primary)_/_0.22)]',
      )}
    >
      <div className="container mx-auto flex items-center gap-3">
        {sidebarLayout && (
          <SidebarTrigger
            className="h-11 w-11 sm:h-9 sm:w-9"
            aria-label="فتح أو طي قائمة التنقّل"
          />
        )}

        {/* Logo */}
        <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/25 animate-fade-in-scale shrink-0">
          <Printer className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h1
            className={cn(
              'font-extrabold bg-gradient-to-l from-primary to-accent bg-clip-text text-transparent truncate',
              compact ? 'text-base md:text-lg' : 'text-lg md:text-xl',
            )}
          >
            حاسبة تكلفة الطباعة الذكية
          </h1>
          {!compact && (
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              احسب تكاليف الطباعة في أقل من 30 ثانية
            </p>
          )}
        </div>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-1.5" dir="rtl">
          {layoutToggle}
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-primary transition-all duration-200"
            onClick={() => window.dispatchEvent(new Event('printCalc:openInstall'))}
            aria-label="تثبيت التطبيق"
            title="تثبيت التطبيق"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">تثبيت التطبيق</span>
          </Button>
          {showTour && (
            <>
              <div className="h-6 w-px bg-border/60 mx-1" />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/40 transition-all duration-200"
                onClick={onTourStart}
              >
                <Play className="w-3.5 h-3.5" />
                جولة تعريفية
              </Button>
            </>
          )}
          <div className="h-6 w-px bg-border/60 mx-1" />
          <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-1.5">
            <div className="w-7 h-7 rounded-full gradient-accent flex items-center justify-center text-xs font-bold text-accent-foreground shadow-sm">
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-medium text-foreground">{username}</span>
              {roleLabel && (
                <span className="text-[10px] text-primary font-semibold">{roleLabel}</span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all duration-200"
            onClick={onLogout}
          >
            <LogOut className="w-3.5 h-3.5" />
            خروج
          </Button>
        </div>

        {/* Mobile actions — account sheet only (nav is SidebarTrigger when sidebar layout) */}
        <div className="flex md:hidden items-center gap-1">
          {layoutToggle}
          <ThemeToggle />
          <div className="w-8 h-8 rounded-full gradient-accent flex items-center justify-center text-xs font-bold text-accent-foreground shadow-sm">
            {username.charAt(0).toUpperCase()}
          </div>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="قائمة الحساب">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 border-l-primary/10" dir="rtl">
              <div className="p-5 gradient-primary">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary-foreground/20 flex items-center justify-center text-lg font-bold text-primary-foreground">
                    {username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-primary-foreground">{username}</p>
                    <p className="text-xs text-primary-foreground/70">{roleLabel ?? 'مرحباً بك'}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2 p-4">
                <ThemeToggle fullWidth />
                {onToggleLayout && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-11 transition-colors duration-200"
                    onClick={() => {
                      onToggleLayout();
                      setMobileMenuOpen(false);
                    }}
                  >
                    {sidebarLayout ? <PanelTop className="w-4 h-4 text-primary" /> : <PanelRight className="w-4 h-4 text-primary" />}
                    {sidebarLayout ? 'شريط علوي' : 'قائمة جانبية'}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-11"
                  onClick={() => {
                    window.dispatchEvent(new Event('printCalc:openInstall'));
                    setMobileMenuOpen(false);
                  }}
                >
                  <Download className="w-4 h-4 text-primary" />
                  تثبيت التطبيق
                </Button>
                {showTour && (
                  <>
                    <div className="border-t my-2" />
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 h-11"
                      onClick={() => {
                        onTourStart();
                        setMobileMenuOpen(false);
                      }}
                    >
                      <Play className="w-4 h-4 text-primary" />
                      جولة تعريفية
                    </Button>
                  </>
                )}
                <div className="border-t my-2" />
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-11 text-destructive hover:text-destructive hover:bg-destructive/5"
                  onClick={onLogout}
                >
                  <LogOut className="w-4 h-4" />
                  تسجيل خروج
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
