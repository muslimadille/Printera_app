import { useState, useEffect, useCallback, useRef } from 'react';
import LoginDialog from '@/components/LoginDialog';
import AppHeader from '@/components/AppHeader';
import AppTabs from '@/components/AppTabs';
import AppSidebarNav from '@/components/AppSidebarNav';
import InteractiveTour from '@/components/InteractiveTour';
import QuoteTabPickerDialog from '@/components/QuoteTabPickerDialog';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useUiPrefs } from '@/hooks/useUiPrefs';
import { usePrintingStore } from '@/store/printingStore';
import { TabPermission, logoutSession, verifySession, saveUserSettings, SavedQuote } from '@/lib/userApi';
import { QUOTE_CAPABLE_TABS, SOURCE_TO_TAB, getTabLabel, isTabAvailable, getDefaultTabKey } from '@/lib/tabRegistry';
import { setActivitySession, trackActivity, flushNow } from '@/lib/activityTracker';
import { drainOutbox, onUserLogout, setOutboxPaused, setSessionUserId } from '@/lib/outbox';
import { useTabSEO } from '@/lib/seo';
import { toast } from 'sonner';

const Index = () => {
  const { layoutMode, toggleLayoutMode } = useUiPrefs();
  const guardedTabChangeRef = useRef<((tab: string) => void) | null>(null);

  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; is_admin: boolean; max_employees: number; employees_can_view_quotes: boolean; parent_user_id: string | null } | null>(() => {
    try {
      const saved = localStorage.getItem('printCalc_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.expiresAt && new Date(parsed.expiresAt) > new Date()) {
          return { id: parsed.id, username: parsed.username, is_admin: parsed.is_admin, max_employees: parsed.max_employees || 0, employees_can_view_quotes: parsed.employees_can_view_quotes || false, parent_user_id: parsed.parent_user_id ?? null };
        }
        localStorage.removeItem('printCalc_session');
      }
    } catch {}
    return null;
  });
  const [currentPassword, setCurrentPassword] = useState(() => {
    try {
      const saved = localStorage.getItem('printCalc_session');
      if (saved) return JSON.parse(saved).pw || '';
    } catch {}
    return '';
  });
  const [sessionToken, setSessionToken] = useState(() => {
    try {
      const saved = localStorage.getItem('printCalc_session');
      if (saved) return JSON.parse(saved).session_token || '';
    } catch {}
    return '';
  });
  // Permissions snapshot — persisted in localStorage so Remember Me sessions
  // keep the same visibility rules across refreshes/new tabs. The snapshot is
  // ALWAYS refreshed from the server on each verifySession call (server is the
  // source of truth) — so newly-published features stay hidden unless the
  // admin explicitly enabled them for this user.
  const [tabPermissions, setTabPermissions] = useState<TabPermission[]>(() => {
    try {
      const cached = localStorage.getItem('printCalc_tabPermsSnapshot');
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });
  const readSavedActiveTab = useCallback((userId?: string) => {
    try {
      const saved = userId ? localStorage.getItem(`printCalc_${userId}_activeTab`) : null;
      return saved || localStorage.getItem('printCalc_activeTab') || 'itemcost';
    } catch {
      return 'itemcost';
    }
  }, []);
  const [activeTab, setActiveTabState] = useState(() => {
    try {
      const saved = localStorage.getItem('printCalc_session');
      const userId = saved ? JSON.parse(saved).id : undefined;
      const userTab = userId ? localStorage.getItem(`printCalc_${userId}_activeTab`) : null;
      return userTab || localStorage.getItem('printCalc_activeTab') || 'itemcost';
    } catch {
      return 'itemcost';
    }
  });
  const setActiveTab = useCallback((tab: string) => {
    setActiveTabState(tab);
  }, []);

  const requestTabChange = useCallback((tab: string) => {
    (guardedTabChangeRef.current ?? setActiveTab)(tab);
  }, [setActiveTab]);

  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [editingAttachment, setEditingAttachment] = useState<{ url: string; name: string } | null>(null);
  // Pending quote awaiting user choice when its origin tab is unavailable.
  const [pendingQuote, setPendingQuote] = useState<SavedQuote | null>(null);

  useEffect(() => {
    if (!currentUser?.id) return;
    try {
      localStorage.setItem(`printCalc_${currentUser.id}_activeTab`, activeTab);
      localStorage.setItem('printCalc_activeTab', activeTab);
    } catch {}
    trackActivity('tab_open', activeTab);
  }, [currentUser?.id, activeTab]);

  // Wire activity tracker to current session.
  useEffect(() => {
    setActivitySession(sessionToken || null);
  }, [sessionToken]);

  // Sync browser title + share metadata with the active tab AND the current
  // quote context (item name, customer, quote number) so shared links and
  // browser tabs always reflect what the user is actually working on.
  const quoteInfo = usePrintingStore(s => s.quoteInfo);
  useTabSEO(activeTab, {
    itemName: quoteInfo?.itemName,
    itemNumber: quoteInfo?.itemNumber,
    customerName: quoteInfo?.customerName,
    quoteNumber: quoteInfo?.quoteNumber,
  });

  const [tourOpen, setTourOpen] = useState(false);
  const { setCurrentUsername, loadCloudSettings, setInputs, setQuoteInfo, setEditingQuoteData } = usePrintingStore();

  useEffect(() => {
    if (currentUser) {
      setCurrentUsername(currentUser.username);
      setSessionUserId(currentUser.id);
    }
  }, [currentUser, setCurrentUsername]);

  const handleLogin = (user: { id: string; username: string; is_admin: boolean; max_employees: number; employees_can_view_quotes: boolean; parent_user_id?: string | null }) => {
    setCurrentUser({ ...user, parent_user_id: user.parent_user_id ?? null });
    setSessionUserId(user.id);
    void setOutboxPaused(false).then(() => {
      window.dispatchEvent(new Event('printCalc:sessionReady'));
      void drainOutbox();
    });
    // Mark that we just logged in — the permissions-aware effect below will
    // pick the admin-configured default tab (or the first available one).
    setActiveTabState('__pending_login__');
  };
  const handlePasswordCapture = (pw: string) => setCurrentPassword(pw);
  const handleSessionToken = (token: string) => setSessionToken(token);

  // Ensure activeTab is always an available tab for the current user.
  // Falls back to the first available tab if 'itemcost' is disabled.
  useEffect(() => {
    if (!currentUser) return;
    const isAdmin = currentUser.is_admin;
    const isPendingLogin = activeTab === "__pending_login__";
    const available = !isPendingLogin && isTabAvailable(activeTab, isAdmin, tabPermissions);
    if (!available) {
      // Prefer admin-configured default tab when it is currently allowed.
      const defaultKey = getDefaultTabKey(tabPermissions);
      if (defaultKey && isTabAvailable(defaultKey, isAdmin, tabPermissions)) {
        setActiveTabState(defaultKey);
        return;
      }
      const firstAvailable = QUOTE_CAPABLE_TABS.find(t => isTabAvailable(t.key, isAdmin, tabPermissions));
      if (firstAvailable) setActiveTabState(firstAvailable.key);
    }
  }, [currentUser, tabPermissions, activeTab]);
  const handleTabPermissions = useCallback((perms: TabPermission[]) => {
    setTabPermissions(prev => {
      // Skip state update if permissions are unchanged — prevents
      // unnecessary re-renders every 60s from the heartbeat.
      try {
        const a = JSON.stringify(prev);
        const b = JSON.stringify(perms);
        if (a === b) return prev;
        localStorage.setItem('printCalc_tabPermsSnapshot', b);
      } catch {}
      return perms;
    });
  }, []);

  const handleCloudSettings = useCallback((settings: Record<string, any>) => {
    loadCloudSettings(settings);
  }, [loadCloudSettings]);

  useEffect(() => {
    if (currentUser && currentPassword) {
      const flag = sessionStorage.getItem('printCalc_rememberMe');
      if (flag === 'true') {
        const session = {
          id: currentUser.id,
          username: currentUser.username,
          is_admin: currentUser.is_admin,
          max_employees: currentUser.max_employees,
          employees_can_view_quotes: currentUser.employees_can_view_quotes,
          parent_user_id: currentUser.parent_user_id,
          pw: currentPassword,
          session_token: sessionToken,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        };
        localStorage.setItem('printCalc_session', JSON.stringify(session));
        sessionStorage.removeItem('printCalc_rememberMe');
      }
    }
  }, [currentUser, currentPassword, sessionToken]);

  // Session heartbeat: check every 60 seconds. Require 2 consecutive failures
  // (Grace Period ~2 minutes) before forcing logout to avoid false positives
  // from transient network errors or brief server hiccups.
  const loggingOutRef = useRef(false);
  const sessionVerifiedRef = useRef(false);
  const failureCountRef = useRef(0);
  const FAILURE_THRESHOLD = 2;

  const forceLogout = useCallback((message?: string) => {
    if (loggingOutRef.current) return;
    setCurrentUser(null);
    setCurrentPassword('');
    setSessionToken('');
    setTabPermissions([]);
    localStorage.removeItem('printCalc_session');
    localStorage.removeItem('printCalc_tabPermsSnapshot');
    setSessionUserId(null);
    void onUserLogout();
    sessionVerifiedRef.current = false;
    failureCountRef.current = 0;
    if (message) toast.error(message);
  }, []);

  // Listen for any session-expired 401 from any API call (not just heartbeat).
  useEffect(() => {
    const onExpired = () => forceLogout('انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى');
    window.addEventListener('printCalc:sessionExpired', onExpired);
    return () => window.removeEventListener('printCalc:sessionExpired', onExpired);
  }, [forceLogout]);

  useEffect(() => {
    if (!sessionToken || !currentUser) return;

    const checkSession = async () => {
      if (loggingOutRef.current) return;
      const result: any = await verifySession(sessionToken);
      if (result?.expired) {
        forceLogout('انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى');
        return;
      }
      if (result?.network_error) {
        failureCountRef.current += 1;
        if (failureCountRef.current >= FAILURE_THRESHOLD) {
          toast.warning('تحقق من الاتصال... محاولة جديدة قريباً');
        }
        return;
      }
      sessionVerifiedRef.current = true;
      failureCountRef.current = 0;
      if (result && Array.isArray(result.tab_permissions)) {
        handleTabPermissions(result.tab_permissions as TabPermission[]);
      }
    };

    checkSession();
    const interval = setInterval(checkSession, 60000);
    return () => clearInterval(interval);
  }, [sessionToken, currentUser, forceLogout]);

  const handleLogout = async () => {
    loggingOutRef.current = true;
    const token = sessionToken;
    try { await flushNow(); } catch {}
    setActivitySession(null);
    setCurrentUser(null);
    setCurrentPassword('');
    setSessionToken('');
    setTabPermissions([]);
    localStorage.removeItem('printCalc_session');
    localStorage.removeItem('printCalc_tabPermsSnapshot');
    setSessionUserId(null);
    void onUserLogout();
    if (token) {
      try { await logoutSession(token); } catch {}
    }
    loggingOutRef.current = false;
  };

  // Load a quote into a specific target tab. Shared by both the normal flow
  // and the "alternate tab" fallback flow.
  const loadQuoteIntoTab = useCallback((quote: SavedQuote, targetTab: string) => {
    const d = quote.quote_data || {};
    const sourceType = quote.source_type || d.sourceType || 'calculator';

    setQuoteInfo({
      customerName: quote.customer_name || '',
      quoteNumber: quote.quote_number || '',
      itemName: d.itemName || '',
      itemNumber: d.itemNumber || '',
      itemSize: d.itemSize || '',
    });

    // Legacy calculator format (no rawInputs) — only valid for calculator tab.
    if (sourceType === 'calculator' && targetTab === 'calculator' && !d.rawInputs && d.paperType !== undefined) {
      setInputs({
        paperType: d.paperType || '',
        purchaseSize: d.purchaseSize || '',
        grammage: d.grammage ?? null,
        printWidth: d.printWidth ?? 50,
        printHeight: d.printHeight ?? 70,
        quantity: d.quantity ?? 1000,
        cutsPerSheet: d.cutsPerSheet ?? 1,
        wastePercent: d.wastePercent ?? 0,
        printedFaces: d.printedFaces ?? 1,
        facesDifferent: !!d.facesDifferent,
        cellophaneFaces: d.cellophaneFaces ?? 0,
        dieCut: !!d.dieCut,
        moldPrice: d.moldPrice ?? 0,
      });
      setEditingQuoteData({ sourceType: 'calculator', itemName: d.itemName, itemNumber: d.itemNumber, itemSize: d.itemSize });
      setEditingQuoteId(quote.id);
      setEditingAttachment(
        d.attachmentUrl ? { url: d.attachmentUrl as string, name: (d.attachmentName as string) || 'ملف مرفق' } : null
      );
      setActiveTab('calculator');
      toast.success('تم تحميل العرض للتعديل');
      return;
    }

    setEditingQuoteData({
      sourceType,
      rawInputs: d.rawInputs || {},
      itemName: d.itemName || '',
      itemNumber: d.itemNumber || '',
      itemSize: d.itemSize || '',
      quoteId: quote.id,
    });
    setEditingQuoteId(quote.id);
    setEditingAttachment(
      d.attachmentUrl ? { url: d.attachmentUrl as string, name: (d.attachmentName as string) || 'ملف مرفق' } : null
    );

    setActiveTab(targetTab);
    toast.success('تم تحميل العرض للتعديل');
  }, [setInputs, setQuoteInfo, setEditingQuoteData]);

  const handleLoadQuote = useCallback((quote: SavedQuote) => {
    const sourceType = quote.source_type || quote.quote_data?.sourceType || 'calculator';
    const nativeTab = SOURCE_TO_TAB[sourceType] || 'calculator';
    const isAdmin = !!currentUser?.is_admin;

    // Native tab available → open directly.
    if (isTabAvailable(nativeTab, isAdmin, tabPermissions)) {
      loadQuoteIntoTab(quote, nativeTab);
      return;
    }

    // Otherwise: ask the user to pick an alternate available tab.
    setPendingQuote(quote);
  }, [currentUser, tabPermissions, loadQuoteIntoTab]);

  // Tabs the user can currently open a quote in (used by the picker dialog).
  const availableQuoteTabs = QUOTE_CAPABLE_TABS.filter(t =>
    isTabAvailable(t.key, !!currentUser?.is_admin, tabPermissions)
  );

  // Auto-save settings to cloud when they change
  const store = usePrintingStore();
  useEffect(() => {
    if (!currentUser?.id || !sessionVerifiedRef.current) return;
    const timeout = setTimeout(() => {
      if (loggingOutRef.current || !sessionVerifiedRef.current) return;
      saveUserSettings(sessionToken, currentUser.id, [
        { key: 'paperTypes', value: store.paperTypes },
        { key: 'priceSettings', value: store.priceSettings },
        { key: 'finishingItems', value: store.finishingItems },
        { key: 'profitMargins', value: store.profitMargins },
      ]).catch(() => {});
    }, 2000);
    return () => clearTimeout(timeout);
  }, [store.paperTypes, store.priceSettings, store.finishingItems, store.profitMargins, currentUser?.id, sessionToken]);

  if (!currentUser) {
    return (
      <LoginDialog
        onLogin={handleLogin}
        onPasswordCapture={handlePasswordCapture}
        onSessionToken={handleSessionToken}
        onTabPermissions={handleTabPermissions}
        onCloudSettings={handleCloudSettings}
      />
    );
  }

  const tourPerm = tabPermissions.find(p => p.tab_key === 'show_tour');
  const tourVisible = currentUser.is_admin || !tourPerm || tourPerm.is_enabled;
  const sidebarLayout = layoutMode === 'sidebar';

  const tabs = (
    <AppTabs
      activeTab={activeTab}
      onTabChange={setActiveTab}
      isAdmin={currentUser.is_admin}
      currentUser={currentUser}
      currentPassword={currentPassword}
      tabPermissions={tabPermissions}
      sessionToken={sessionToken}
      maxEmployees={currentUser.max_employees}
      userId={currentUser.id}
      employeesCanViewQuotes={currentUser.employees_can_view_quotes}
      onEmployeesViewChange={(enabled) => setCurrentUser(prev => prev ? { ...prev, employees_can_view_quotes: enabled } : null)}
      onLoadQuote={handleLoadQuote}
      editingQuoteId={editingQuoteId}
      editingAttachment={editingAttachment}
      onClearEditingQuote={() => { setEditingQuoteId(null); setEditingAttachment(null); }}
      hideNav={sidebarLayout}
      onProvideTabChange={(fn) => { guardedTabChangeRef.current = fn; }}
    />
  );

  const overlays = (
    <>
      <InteractiveTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        onNavigateTab={requestTabChange}
      />

      <QuoteTabPickerDialog
        open={!!pendingQuote}
        originalTabLabel={pendingQuote ? getTabLabel(SOURCE_TO_TAB[pendingQuote.source_type] || pendingQuote.source_type) : ''}
        availableTabs={availableQuoteTabs}
        onCancel={() => setPendingQuote(null)}
        onConfirm={(tabKey) => {
          const q = pendingQuote;
          setPendingQuote(null);
          if (q) loadQuoteIntoTab(q, tabKey);
        }}
      />
    </>
  );

  const header = (
    <AppHeader
      username={currentUser.username}
      onLogout={handleLogout}
      onTourStart={() => setTourOpen(true)}
      showTour={tourVisible}
      isAdmin={currentUser.is_admin}
      isAccountOwner={!currentUser.is_admin && !currentUser.parent_user_id}
      layoutMode={layoutMode}
      onToggleLayout={toggleLayoutMode}
      compact={sidebarLayout}
    />
  );

  if (sidebarLayout) {
    return (
      <SidebarProvider defaultOpen>
        <AppSidebarNav
          activeTab={activeTab}
          onTabChange={requestTabChange}
          isAdmin={currentUser.is_admin}
          tabPermissions={tabPermissions}
          maxEmployees={currentUser.max_employees}
        />
        <SidebarInset className="min-w-0 max-w-full overflow-x-clip bg-background">
          {header}
          <main className="container mx-auto min-w-0 max-w-full overflow-x-clip py-3 sm:py-4 md:py-6 px-2 sm:px-3 md:px-4">
            {tabs}
            {overlays}
          </main>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <div className="min-h-screen min-w-0 max-w-full overflow-x-clip bg-background">
      {header}
      <main className="container mx-auto min-w-0 max-w-full overflow-x-clip py-3 sm:py-4 md:py-6 px-2 sm:px-3 md:px-4">
        {tabs}
        {overlays}
      </main>
    </div>
  );
};

export default Index;
