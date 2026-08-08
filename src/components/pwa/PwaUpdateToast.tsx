import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * When a new service worker is waiting → RTL toast "يتوفر تحديث — إعادة التحميل".
 */
const PwaUpdateToast = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Periodic update check while the app is open.
      if (registration) {
        setInterval(() => {
          void registration.update();
        }, 60 * 60 * 1000);
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      dir="rtl"
      className="fixed bottom-4 inset-x-0 z-[70] flex justify-center px-3 pointer-events-none"
    >
      <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-card/95 backdrop-blur-md shadow-lg px-4 py-3 max-w-md w-full">
        <RefreshCw className="w-4 h-4 text-primary shrink-0" />
        <p className="flex-1 text-sm font-medium">يتوفر تحديث — إعادة التحميل</p>
        <Button
          size="sm"
          className="min-h-9 gap-1.5"
          onClick={() => {
            void updateServiceWorker(true);
          }}
        >
          تحديث
        </Button>
        <Button size="sm" variant="ghost" className="min-h-9" onClick={() => setNeedRefresh(false)}>
          لاحقاً
        </Button>
      </div>
    </div>
  );
};

export default PwaUpdateToast;
