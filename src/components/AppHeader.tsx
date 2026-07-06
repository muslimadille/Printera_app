import { Calculator, LogOut, Play, Menu, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';

interface AppHeaderProps {
  username: string;
  onLogout: () => void;
  onTourStart: () => void;
  showTour?: boolean;
  isAdmin?: boolean;
  isAccountOwner?: boolean;
}

const AppHeader = ({ username, onLogout, onTourStart, showTour = true, isAdmin = false, isAccountOwner = false }: AppHeaderProps) => {
  const roleLabel = isAdmin ? 'مدير النظام' : isAccountOwner ? 'مدير الحساب' : null;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 glass-header py-2.5 sm:py-3 px-3 sm:px-4 md:px-6 shadow-[0_1px_15px_-3px_hsl(221_83%_53%_/_0.08)]">
      <div className="container mx-auto flex items-center gap-3">
        {/* Logo */}
        <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/25 animate-fade-in-scale">
          <Printer className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg md:text-xl font-extrabold bg-gradient-to-l from-primary to-accent bg-clip-text text-transparent truncate">
            حاسبة تكلفة الطباعة الذكية
          </h1>
          <p className="text-[11px] text-muted-foreground hidden sm:block">احسب تكاليف الطباعة في أقل من 30 ثانية</p>
        </div>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-2.5" dir="rtl">
          {showTour && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/40 transition-all"
                onClick={onTourStart}
              >
                <Play className="w-3.5 h-3.5" />
                جولة تعريفية
              </Button>
              <div className="h-6 w-px bg-border/60" />
            </>
          )}
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
            className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all"
            onClick={onLogout}
          >
            <LogOut className="w-3.5 h-3.5" />
            خروج
          </Button>
        </div>

        {/* Mobile actions */}
        <div className="flex md:hidden items-center gap-2">
          <div className="w-8 h-8 rounded-full gradient-accent flex items-center justify-center text-xs font-bold text-accent-foreground shadow-sm">
            {username.charAt(0).toUpperCase()}
          </div>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
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
                {showTour && (
                  <>
                    <Button variant="ghost" className="w-full justify-start gap-3 h-11" onClick={() => { onTourStart(); setMobileMenuOpen(false); }}>
                      <Play className="w-4 h-4 text-primary" />
                      جولة تعريفية
                    </Button>
                    <div className="border-t my-2" />
                  </>
                )}
                <Button variant="ghost" className="w-full justify-start gap-3 h-11 text-destructive hover:text-destructive hover:bg-destructive/5" onClick={onLogout}>
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
