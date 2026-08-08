import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import InstallPrompt from '@/components/pwa/InstallPrompt';
import OfflineBanner from '@/components/pwa/OfflineBanner';
import PwaUpdateToast from '@/components/pwa/PwaUpdateToast';
import {
  drainOutbox,
  installOutboxListeners,
  markEngagementForInstall,
  setOutboxPaused,
} from '@/lib/outbox';

/**
 * Mounts PWA chrome once: offline banner, install card, SW update toast, outbox drain.
 * Manual install: dispatch `printCalc:openInstall`.
 */
const PwaRoot = () => {
  const [forceInstall, setForceInstall] = useState(false);

  useEffect(() => {
    installOutboxListeners();
    markEngagementForInstall('visit');

    const onSynced = (e: Event) => {
      const count = (e as CustomEvent<{ count: number }>).detail?.count || 0;
      if (count > 0) {
        toast.success(`تمت مزامنة ${count} ${count === 1 ? 'عنصر' : 'عناصر'}`);
      }
    };
    const onPaused = () => {
      toast.error('سجّل الدخول لإكمال المزامنة');
    };
    const onLoginResume = () => {
      void setOutboxPaused(false).then(() => drainOutbox());
    };
    const onOpenInstall = () => setForceInstall(true);

    window.addEventListener('printCalc:outboxSynced', onSynced);
    window.addEventListener('printCalc:outboxPaused', onPaused);
    window.addEventListener('printCalc:sessionReady', onLoginResume);
    window.addEventListener('printCalc:openInstall', onOpenInstall);
    return () => {
      window.removeEventListener('printCalc:outboxSynced', onSynced);
      window.removeEventListener('printCalc:outboxPaused', onPaused);
      window.removeEventListener('printCalc:sessionReady', onLoginResume);
      window.removeEventListener('printCalc:openInstall', onOpenInstall);
    };
  }, []);

  // Do not register a SW in normal DEV — leftover Workbox caches dual-load React.
  const allowSw =
    import.meta.env.PROD || import.meta.env.VITE_PWA_DEV === "1";

  return (
    <>
      <OfflineBanner />
      <InstallPrompt
        forceOpen={forceInstall}
        onForceClose={() => setForceInstall(false)}
      />
      {allowSw ? <PwaUpdateToast /> : null}
    </>
  );
};

export default PwaRoot;
