import { useCallback, useEffect, useState } from 'react';
import { getEngagement } from '@/lib/outbox';

const DISMISS_KEY = 'printCalc_pwa_install_dismiss';
const NEVER_KEY = 'printCalc_pwa_install_never';
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return true;
  const mq = window.matchMedia('(display-mode: standalone)').matches;
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return mq || ios;
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iP(ad|hone|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/i.test(ua);
  const criOS = /CriOS/i.test(ua);
  const fxIOS = /FxiOS/i.test(ua);
  return iOS && webkit && !criOS && !fxIOS;
}

function canShowByCooldown(): boolean {
  try {
    if (localStorage.getItem(NEVER_KEY) === '1') return false;
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return true;
    const t = Number(raw);
    if (!Number.isFinite(t)) return true;
    return Date.now() - t >= COOLDOWN_MS;
  } catch {
    return true;
  }
}

function hasEngagement(): boolean {
  const e = getEngagement();
  return e.saves >= 1 || e.calcs >= 1 || e.visits >= 3;
}

export type PwaInstallPlatform = 'android' | 'ios' | 'unsupported';

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const platform: PwaInstallPlatform = deferred
    ? 'android'
    : isIosSafari()
      ? 'ios'
      : 'unsupported';

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setOpen(false);
      setManualOpen(false);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    if (installed || !canShowByCooldown()) return;

    const maybeOpen = () => {
      if (installed || !canShowByCooldown() || !hasEngagement()) return;
      if (deferred || isIosSafari()) setOpen(true);
    };

    const onEngagement = () => maybeOpen();
    window.addEventListener('printCalc:pwaEngagement', onEngagement);

    // Delayed check — not on first paint.
    const t = window.setTimeout(maybeOpen, 2500);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('printCalc:pwaEngagement', onEngagement);
    };
  }, [deferred, installed]);

  const dismiss = useCallback((never = false) => {
    try {
      if (never) localStorage.setItem(NEVER_KEY, '1');
      else localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch { /* */ }
    setOpen(false);
    setManualOpen(false);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return { outcome: 'dismissed' as const };
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === 'accepted') setInstalled(true);
    setOpen(false);
    setManualOpen(false);
    return choice;
  }, [deferred]);

  const openManual = useCallback(() => {
    setManualOpen(true);
    setOpen(true);
  }, []);

  const visible = (open || manualOpen) && !installed && (platform !== 'unsupported' || manualOpen);

  return {
    platform,
    installed,
    visible,
    deferredReady: !!deferred,
    dismiss,
    promptInstall,
    openManual,
    isIos: platform === 'ios',
  };
}
