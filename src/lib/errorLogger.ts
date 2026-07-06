// Internal error logger — captures 404 and proxy errors silently.
// Does NOT show anything to end users. Logs are kept in memory + localStorage
// (capped) for later inspection by admins/devs only.

export interface LoggedError {
  ts: string;
  type: '404' | 'proxy' | 'network' | 'tab-crash';
  url?: string;
  status?: number;
  message?: string;
  source?: string;
  stack?: string;
  componentStack?: string;
  context?: Record<string, unknown>;
}

const STORAGE_KEY = 'printCalc_internal_error_log';
const MAX_ENTRIES = 200;

function loadLog(): LoggedError[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLog(entries: LoggedError[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {}
}

export function logInternalError(entry: Omit<LoggedError, 'ts'>) {
  try {
    const entries = loadLog();
    entries.push({ ...entry, ts: new Date().toISOString() });
    saveLog(entries);
  } catch {}
}

export function getInternalErrorLog(): LoggedError[] {
  return loadLog();
}

export function clearInternalErrorLog() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

// Install global hooks once. Captures only 404s and proxy/network errors.
let installed = false;
export function installInternalErrorLogger() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  // Wrap fetch to catch 404 responses + network failures (silent).
  const origFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url;
    try {
      const res = await origFetch(...args);
      if (res.status === 404) {
        logInternalError({ type: '404', url, status: 404, source: 'fetch' });
      }
      return res;
    } catch (err: any) {
      const msg = String(err?.message || err);
      const isProxy = /proxy|failed to fetch|networkerror/i.test(msg);
      logInternalError({
        type: isProxy ? 'proxy' : 'network',
        url,
        message: msg,
        source: 'fetch',
      });
      throw err;
    }
  };

  // Capture failed resource loads (scripts, images, chunks → often 404).
  window.addEventListener('error', (e) => {
    const target: any = e.target;
    if (target && target !== window && (target.src || target.href)) {
      logInternalError({
        type: '404',
        url: target.src || target.href,
        message: 'resource load failed',
        source: target.tagName?.toLowerCase(),
      });
    }
  }, true);
}
