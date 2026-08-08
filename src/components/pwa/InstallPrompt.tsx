import { Download, Share, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { cn } from '@/lib/utils';

/**
 * Non-intrusive RTL install card.
 * Android/Chromium → beforeinstallprompt. iOS Safari → Share → Add to Home Screen.
 */
const InstallPrompt = ({ forceOpen, onForceClose }: { forceOpen?: boolean; onForceClose?: () => void }) => {
  const { platform, visible, dismiss, promptInstall, isIos } = usePwaInstall();
  const show = forceOpen || visible;
  if (!show) return null;

  const close = (never = false) => {
    dismiss(never);
    onForceClose?.();
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] flex justify-center p-3 sm:p-4 pointer-events-none"
      dir="rtl"
    >
      <div
        role="dialog"
        aria-label="تثبيت التطبيق"
        className={cn(
          'pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-primary/15',
          'bg-card/95 backdrop-blur-md shadow-[0_12px_40px_-12px_hsl(var(--primary)_/_0.35)]',
          'animate-in slide-in-from-bottom-4 fade-in duration-300',
        )}
      >
        <div className="relative px-4 pt-4 pb-3 sm:px-5">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-primary via-primary/80 to-accent" />
          <button
            type="button"
            onClick={() => close(false)}
            className="absolute top-3 left-3 h-9 w-9 inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted/80 transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3 pe-8">
            <div className="shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-primary shadow-md shadow-primary/25 flex items-center justify-center">
              <img src="/icons/pwa-192.png" alt="" className="w-full h-full object-cover" width={48} height={48} />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-semibold tracking-wide text-primary/80 uppercase">
                Printera
              </p>
              <h2 className="text-base font-bold text-foreground leading-snug">
                ثبّت التطبيق للوصول السريع
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                والعمل دون اتصال — عروضك وإعداداتك تُزامَن عند عودة الشبكة.
              </p>
            </div>
          </div>

          {isIos || platform === 'ios' ? (
            <div className="mt-4 rounded-xl bg-muted/50 border border-border/60 p-3 space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Share className="w-4 h-4 text-primary shrink-0" />
                اضغط زر المشاركة
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-background border text-base" aria-hidden>
                  ⬆️
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Smartphone className="w-4 h-4 text-primary shrink-0" />
                ثم اختر: <span className="font-semibold text-foreground">أضِف إلى الشاشة الرئيسية</span>
              </div>
            </div>
          ) : platform === 'android' ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                className="flex-1 min-h-11 gap-2 shadow-sm"
                onClick={() => void promptInstall()}
              >
                <Download className="w-4 h-4" />
                تثبيت
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => close(false)}>
                لاحقاً
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                من Chrome على Android استخدم زر التثبيت، أو من Safari على iPhone:
                المشاركة ← أضِف إلى الشاشة الرئيسية.
              </p>
              <Button type="button" variant="outline" className="w-full min-h-11" onClick={() => close(false)}>
                حسناً
              </Button>
            </div>
          )}

          <button
            type="button"
            className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
            onClick={() => close(true)}
          >
            لا تُظهر مجددًا
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;
