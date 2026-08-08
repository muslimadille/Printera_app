import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type LayoutMode = 'topbar' | 'sidebar';

const LAYOUT_KEY = 'printCalc_layout';

function readLayout(): LayoutMode {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw === 'sidebar' || raw === 'topbar') return raw;
  } catch {
    /* ignore */
  }
  return 'topbar';
}

type UiPrefsContextValue = {
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  toggleLayoutMode: () => void;
};

const UiPrefsContext = createContext<UiPrefsContextValue | null>(null);

/** Single source of truth for layout prefs — wrap once near the app root. */
export function UiPrefsProvider({ children }: { children: ReactNode }) {
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>(() =>
    typeof window === 'undefined' ? 'topbar' : readLayout(),
  );

  useEffect(() => {
    setLayoutModeState(readLayout());
    const onStorage = (e: StorageEvent) => {
      if (e.key === LAYOUT_KEY) setLayoutModeState(readLayout());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setLayoutMode = useCallback((mode: LayoutMode) => {
    setLayoutModeState(mode);
    try {
      localStorage.setItem(LAYOUT_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleLayoutMode = useCallback(() => {
    setLayoutModeState((prev) => {
      const next: LayoutMode = prev === 'topbar' ? 'sidebar' : 'topbar';
      try {
        localStorage.setItem(LAYOUT_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ layoutMode, setLayoutMode, toggleLayoutMode }),
    [layoutMode, setLayoutMode, toggleLayoutMode],
  );

  return createElement(UiPrefsContext.Provider, { value }, children);
}

/**
 * Local-only UI preferences (no backend). Theme is owned by next-themes
 * (`printCalc_theme`); this hook owns layout mode (`printCalc_layout`).
 */
export function useUiPrefs(): UiPrefsContextValue {
  const ctx = useContext(UiPrefsContext);
  if (!ctx) {
    throw new Error('useUiPrefs must be used within UiPrefsProvider');
  }
  return ctx;
}
