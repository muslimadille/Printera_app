import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getInternalErrorLog, clearInternalErrorLog, LoggedError } from '@/lib/errorLogger';
import { verifySession } from '@/lib/userApi';

type AuthState = 'checking' | 'allowed' | 'denied';

// Hidden internal page — accessible only at /__internal/errors. Authorization
// is enforced server-side by calling the manage-users Edge Function with the
// stored session_token. The server returns the authoritative `is_admin` flag;
// localStorage is NOT trusted for the access decision.
export default function InternalErrors() {
  const [auth, setAuth] = useState<AuthState>('checking');
  const [entries, setEntries] = useState<LoggedError[]>([]);
  const [filter, setFilter] = useState<'all' | '404' | 'proxy' | 'network' | 'tab-crash'>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let token = '';
      try {
        const raw = localStorage.getItem('printCalc_session');
        if (raw) token = JSON.parse(raw)?.session_token || '';
      } catch {}
      if (!token) { if (!cancelled) setAuth('denied'); return; }

      const res: any = await verifySession(token);
      if (cancelled) return;
      if (res?.valid && res?.user?.is_admin === true) {
        setAuth('allowed');
      } else {
        setAuth('denied');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (auth !== 'allowed') return;
    setEntries(getInternalErrorLog());
    const t = setInterval(() => setEntries(getInternalErrorLog()), 2000);
    return () => clearInterval(t);
  }, [auth]);

  if (auth === 'checking') {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background font-cairo">
        <p className="text-muted-foreground">جارٍ التحقق…</p>
      </div>
    );
  }
  if (auth === 'denied') return <Navigate to="/app" replace />;

  const filtered = filter === 'all' ? entries : entries.filter(e => e.type === filter);
  const reversed = [...filtered].reverse();

  return (
    <div dir="rtl" className="min-h-screen bg-background p-6 font-cairo">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">سجل الأخطاء الداخلي</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEntries(getInternalErrorLog())}>تحديث</Button>
            <Button variant="destructive" size="sm" onClick={() => { clearInternalErrorLog(); setEntries([]); }}>مسح السجل</Button>
          </div>
        </div>

        <div className="flex gap-2">
          {(['all', '404', 'proxy', 'network', 'tab-crash'] as const).map(f => (
            <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
              {f === 'all' ? 'الكل' : f} ({f === 'all' ? entries.length : entries.filter(e => e.type === f).length})
            </Button>
          ))}
        </div>

        <Card className="p-4">
          {reversed.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">لا توجد أخطاء مسجلة</p>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-auto">
              {reversed.map((e, i) => (
                <div key={i} className="border rounded p-3 text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      e.type === '404' ? 'bg-yellow-100 text-yellow-800' :
                      e.type === 'proxy' ? 'bg-red-100 text-red-800' :
                      e.type === 'tab-crash' ? 'bg-purple-100 text-purple-800' :
                      'bg-orange-100 text-orange-800'
                    }`}>{e.type}</span>
                    <span className="text-muted-foreground text-xs">{new Date(e.ts).toLocaleString('ar')}</span>
                  </div>
                  {e.url && <div className="break-all text-xs"><b>URL:</b> {e.url}</div>}
                  {e.status && <div className="text-xs"><b>Status:</b> {e.status}</div>}
                  {e.message && <div className="text-xs"><b>Message:</b> {e.message}</div>}
                  {e.source && <div className="text-xs text-muted-foreground"><b>Source:</b> {e.source}</div>}
                  {e.stack && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground"><b>Stack trace</b></summary>
                      <pre className="mt-1 p-2 bg-muted rounded overflow-auto text-[11px] whitespace-pre-wrap break-all" dir="ltr">{e.stack}</pre>
                    </details>
                  )}
                  {e.componentStack && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground"><b>Component stack</b></summary>
                      <pre className="mt-1 p-2 bg-muted rounded overflow-auto text-[11px] whitespace-pre-wrap break-all" dir="ltr">{e.componentStack}</pre>
                    </details>
                  )}
                  {e.context && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground"><b>بيانات التحميل الأخيرة</b></summary>
                      <pre className="mt-1 p-2 bg-muted rounded overflow-auto text-[11px] whitespace-pre-wrap break-all" dir="ltr">{JSON.stringify(e.context, null, 2)}</pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
