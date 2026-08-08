import { useEffect, useState } from 'react';
import { CloudOff, RefreshCw, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import {
  getOutboxCount,
  isOutboxPaused,
  subscribeOutboxCount,
  subscribeOutboxPaused,
} from '@/lib/outbox';
import { cn } from '@/lib/utils';

/**
 * Subtle top strip: offline notice, pending sync count, or auth-pause hint.
 */
const OfflineBanner = () => {
  const online = useOnlineStatus();
  const [pending, setPending] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const unsubCount = subscribeOutboxCount(setPending);
    const unsubPause = subscribeOutboxPaused(setPaused);
    void getOutboxCount().then(setPending);
    void isOutboxPaused().then(setPaused);
    return () => {
      unsubCount();
      unsubPause();
    };
  }, []);

  if (online && pending === 0 && !paused) return null;

  const offline = !online;
  const authPause = paused && online;

  return (
    <div
      dir="rtl"
      role="status"
      className={cn(
        'sticky top-0 z-[55] border-b px-3 py-2 text-sm',
        offline && 'bg-amber-50 text-amber-950 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-50 dark:border-amber-800/50',
        authPause && 'bg-destructive/10 text-destructive border-destructive/20',
        !offline && !authPause && pending > 0 && 'bg-primary/5 text-foreground border-primary/15',
      )}
    >
      <div className="container mx-auto flex items-center gap-2.5 min-h-9">
        {offline ? (
          <WifiOff className="w-4 h-4 shrink-0 opacity-80" />
        ) : authPause ? (
          <CloudOff className="w-4 h-4 shrink-0" />
        ) : (
          <RefreshCw className="w-4 h-4 shrink-0 text-primary animate-spin [animation-duration:2.2s]" />
        )}
        <p className="flex-1 leading-snug">
          {offline && (
            <>
              أنت غير متصل — سيتم الحفظ محليًا والمزامنة عند عودة الاتصال
              {pending > 0 ? ` · ${pending} بانتظار المزامنة` : ''}
            </>
          )}
          {authPause && <>سجّل الدخول لإكمال المزامنة — لن تُفقد بياناتك المحفوظة محليًا</>}
          {!offline && !authPause && pending > 0 && (
            <>جاري مزامنة {pending} {pending === 1 ? 'عنصر' : 'عناصر'}…</>
          )}
        </p>
        {pending > 0 && (
          <span className="shrink-0 inline-flex items-center justify-center min-w-7 h-7 rounded-full bg-background/80 border text-xs font-bold tabular-nums px-1.5">
            {pending}
          </span>
        )}
      </div>
    </div>
  );
};

export default OfflineBanner;
