import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { UserPlus, Trash2, Edit, Shield, Clock, Loader2, RefreshCw, Monitor, Layers, Users, HelpCircle, Activity, BarChart3, Circle, ChevronDown, ChevronLeft, LogIn, LogOut, Heart, AlertCircle, Download, Save, Calculator, FileText, Settings as SettingsIcon, Upload, MousePointerClick, Sparkles } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { AppUser, TabPermission, UserAnalytics, listUsers, createUser, updateUser, deleteUser, getTabPermissions, updateTabPermissions, getUserSessions, terminateSession, getUserAnalytics, getUserPlan, saveUserPlan } from '@/lib/userApi';
import { useAppContent } from '@/hooks/useAppContent';
import AdminPanelTour from '@/components/AdminPanelTour';

interface UserManagementProps {
  currentUser: { username: string; is_admin: boolean };
  currentPassword: string;
}

const TAB_LABELS: Record<string, string> = {
  hybridengine: 'حساب الصنف',
  itemcost: 'تكلفة صنف',
  flat: 'مسطح',
  templates: 'قوالب',
  boxes: 'علب',
  box_d001: 'علب — D001',
  box_t0001: 'علب — T0001',
  box_t0002: 'علب — T0002',
  box_t0004: 'علب — T0004',
  box_t0005: 'علب — T0005',
  templatecost: 'تكلفة بقالب',
  costcalc: 'حساب التكلفة',
  smartengine: 'المحرك الذكي',
  mergeitems: 'دمج أصناف',
  savedquotes: 'التكاليف المحفوظة',
  settings: 'الإعدادات',
  papertypes: 'أنواع الورق',
  calculator: 'حاسبة التسعير',
  paperset: 'مجموعة أوراق',
  magazines: 'المجلات',
  magazinesheet: 'تكلفة مجلة',
  montage: 'مونتاج',
  montag: 'Montag',
  bagcalc: 'حساب الأكياس',
  newmagazine: 'المجلة',
  magazine: 'المجلات (قديم)',
  boxpricing: 'العلب والأكياس',
  manual: 'يدوي',
  employee: 'إدخال الموظف',
  quote: 'عرض سعر',
  finishing: 'التشطيبات',
  bulkimport: 'استيراد تسعيرات',
  export_quotes: 'تصدير التكاليف',
  guide: 'الدليل',
  users: 'إدارة المستخدمين',
  employees: 'إدارة الموظفين',
  loginhistory: 'سجل الدخول',
  _unknown: 'غير محدد',
};

// عناصر إظهار/إخفاء داخل قسم التكاليف المحفوظة + الجولة التعريفية (Visibility Control فقط)
const VISIBILITY_LABELS: Record<string, string> = {
  sq_show_employees_view: 'إظهار: رؤية الموظفين',
  sq_show_transfer: 'إظهار: ترحيل العروض',
  sq_show_import: 'إظهار: استيراد البيانات',
  sq_show_export: 'إظهار: تصدير البيانات',
  sq_show_actions: 'إظهار: إجراءات الصف (تعديل/حذف)',
  show_tour: 'إظهار: الجولة التعريفية للمستخدم',
};

const ALL_PERMISSION_KEYS = [...Object.keys(TAB_LABELS), ...Object.keys(VISIBILITY_LABELS)];

const UserManagement = ({ currentUser, currentPassword }: UserManagementProps) => {
  const { plans } = useAppContent();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [formData, setFormData] = useState({
    username: '', password: '', is_admin: false, expires_in_hours: '', max_devices: '2', max_employees: '0',
  });
  const [saving, setSaving] = useState(false);

  // Tab permissions dialog
  const [tabDialogOpen, setTabDialogOpen] = useState(false);
  const [tabUserId, setTabUserId] = useState('');
  const [tabUserName, setTabUserName] = useState('');
  const [tabPerms, setTabPerms] = useState<TabPermission[]>([]);
  const [defaultTab, setDefaultTab] = useState<string>('');
  const [tabLoading, setTabLoading] = useState(false);

  // Sessions dialog
  const [sessionsDialogOpen, setSessionsDialogOpen] = useState(false);
  const [sessionsUserId, setSessionsUserId] = useState('');
  const [sessionsUserName, setSessionsUserName] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Analytics
  const [analyticsMap, setAnalyticsMap] = useState<Record<string, UserAnalytics>>({});
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsDialogOpen, setAnalyticsDialogOpen] = useState(false);
  const [analyticsTarget, setAnalyticsTarget] = useState<UserAnalytics | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set());
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [heatCell, setHeatCell] = useState<{ day: number; hour: number } | null>(null);

  // Admin panel guided tour
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    const seen = localStorage.getItem('printCalc_adminTourSeen');
    if (!seen) {
      setTourOpen(true);
      localStorage.setItem('printCalc_adminTourSeen', '1');
    }
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await listUsers(currentUser.username, currentPassword);
      setUsers(data || []);
    } catch (err: any) {
      toast.error(err.message || 'تعذر تحميل قائمة المستخدمين من السيرفر');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const data = await getUserAnalytics(currentUser.username, currentPassword);
      const map: Record<string, UserAnalytics> = {};
      for (const a of data) map[a.user_id] = a;
      setAnalyticsMap(map);
    } catch (err: any) {
      // Silent fail — analytics is non-critical UI enhancement
      console.error('analytics error', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [currentUser.username, currentPassword]);

  useEffect(() => { fetchUsers(); fetchAnalytics(); }, []);

  const getPlanName = (planId?: string) => {
    const match = plans.find(p => p.id === planId);
    if (match) return match.name;
    if (planId === 'plan-pro') return 'الباقة الاحترافية PRO';
    if (planId === 'plan-business') return 'باقة الشركات والمطابع';
    return 'المجانية التجريبية';
  };

  const openCreateDialog = () => {
    setEditingUser(null);
    setFormData({ username: '', password: '', is_admin: false, expires_in_hours: '', max_devices: '2', max_employees: '0', subscription_plan: 'plan-free' });
    setDialogOpen(true);
  };

  const openEditDialog = (user: AppUser) => {
    setEditingUser(user);
    const userPlan = user.subscription_plan || getUserPlan(user.id, user.username);
    setFormData({
      username: user.username, password: '', is_admin: user.is_admin,
      expires_in_hours: '', max_devices: String(user.max_devices || 2),
      max_employees: String(user.max_employees || 0),
      subscription_plan: userPlan || 'plan-free',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.username) { toast.error('يرجى إدخال اسم المستخدم'); return; }
    if (!editingUser && !formData.password) { toast.error('يرجى إدخال كلمة المرور'); return; }

    setSaving(true);
    try {
      const expiresAt = formData.expires_in_hours
        ? new Date(Date.now() + Number(formData.expires_in_hours) * 3600000).toISOString()
        : null;

      if (editingUser) {
        await updateUser(currentUser.username, currentPassword, {
          user_id: editingUser.id, username: formData.username,
          password: formData.password || undefined, is_admin: formData.is_admin,
          expires_at: expiresAt, max_devices: Number(formData.max_devices) || 2,
          max_employees: Number(formData.max_employees) || 0,
          subscription_plan: formData.subscription_plan,
        });
        saveUserPlan(editingUser.id, formData.username, formData.subscription_plan);
        toast.success('تم تحديث المستخدم بنجاح');
      } else {
        await createUser(currentUser.username, currentPassword, {
          username: formData.username, password: formData.password,
          is_admin: formData.is_admin, expires_at: expiresAt,
          max_devices: Number(formData.max_devices) || 2,
          max_employees: Number(formData.max_employees) || 0,
          subscription_plan: formData.subscription_plan,
        });
        saveUserPlan(undefined, formData.username, formData.subscription_plan);
        toast.success('تم إنشاء المستخدم بنجاح');
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUser(currentUser.username, currentPassword, deleteTarget.id, deleteTarget.username);
      toast.success('تم حذف المستخدم');
      fetchUsers();
    } catch (err: any) { toast.error(err.message); }
    finally { setDeleteTarget(null); }
  };

  const handleDeleteClick = (user: AppUser) => {
    if (user.username === currentUser.username) { toast.error('لا يمكنك حذف حسابك الحالي'); return; }
    setDeleteTarget(user);
  };

  const handleToggleActive = async (user: AppUser) => {
    try {
      await updateUser(currentUser.username, currentPassword, { user_id: user.id, is_active: !user.is_active });
      toast.success(user.is_active ? 'تم تعطيل المستخدم' : 'تم تفعيل المستخدم');
      fetchUsers();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleRemoveExpiry = async (user: AppUser) => {
    try {
      await updateUser(currentUser.username, currentPassword, { user_id: user.id, expires_at: null });
      toast.success('تم إزالة تاريخ الانتهاء');
      fetchUsers();
    } catch (err: any) { toast.error(err.message); }
  };

  // Tab permissions
  const openTabDialog = async (user: AppUser) => {
    setTabUserId(user.id);
    setTabUserName(user.username);
    setTabLoading(true);
    setTabDialogOpen(true);
    try {
      const perms = await getTabPermissions(currentUser.username, currentPassword, user.id);
      const permMap = new Map(perms.map(p => [p.tab_key, p.is_enabled]));
      // Build standard rows
      const baseRows = ALL_PERMISSION_KEYS.map(key => ({ tab_key: key, is_enabled: permMap.get(key) ?? true }));
      // Preserve any default_tab:* rows so we can include them on save.
      const defaultRows = perms.filter(p => p.tab_key.startsWith('default_tab:'));
      setTabPerms([...baseRows, ...defaultRows]);
      // Resolve current default tab (the enabled default_tab:* row).
      const current = defaultRows.find(r => r.is_enabled);
      setDefaultTab(current ? current.tab_key.slice('default_tab:'.length) : '');
    } catch (err: any) { toast.error(err.message); }
    finally { setTabLoading(false); }
  };

  const handleSaveTabPerms = async () => {
    setTabLoading(true);
    try {
      // Compose payload: standard perms + default_tab updates.
      // Disable any previously-set default_tab:* rows then enable the chosen one.
      const stripped = tabPerms.filter(p => !p.tab_key.startsWith('default_tab:'));
      const defaultDisables = tabPerms
        .filter(p => p.tab_key.startsWith('default_tab:'))
        .map(p => ({ tab_key: p.tab_key, is_enabled: false }));
      const payload: TabPermission[] = [...stripped, ...defaultDisables];
      if (defaultTab) {
        payload.push({ tab_key: `default_tab:${defaultTab}`, is_enabled: true });
      }
      await updateTabPermissions(currentUser.username, currentPassword, tabUserId, payload);
      toast.success('تم تحديث الصلاحيات وإعدادات الإظهار');
      setTabDialogOpen(false);
    } catch (err: any) { toast.error(err.message); }
    finally { setTabLoading(false); }
  };

  // Sessions
  const openSessionsDialog = async (user: AppUser) => {
    setSessionsUserId(user.id);
    setSessionsUserName(user.username);
    setSessionsLoading(true);
    setSessionsDialogOpen(true);
    try {
      const data = await getUserSessions(currentUser.username, currentPassword, user.id);
      setSessions(data);
    } catch (err: any) { toast.error(err.message); }
    finally { setSessionsLoading(false); }
  };

  const handleTerminateSession = async (sessionId: string) => {
    try {
      await terminateSession(currentUser.username, currentPassword, sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast.success('تم إنهاء الجلسة');
    } catch (err: any) { toast.error(err.message); }
  };

  const getExpiryStatus = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const expiry = new Date(expiresAt);
    if (expiry < new Date()) return 'expired';
    const hoursLeft = Math.ceil((expiry.getTime() - Date.now()) / 3600000);
    return `${hoursLeft} ساعة متبقية`;
  };

  const formatDuration = (ms: number) => {
    if (!ms || ms < 1000) return '—';
    const totalMinutes = Math.floor(ms / 60000);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h > 0) return `${h} س ${m} د`;
    return `${m} د`;
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('ar-SA', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const openAnalyticsDialog = (user: AppUser) => {
    setAnalyticsTarget(analyticsMap[user.id] || null);
    setExpandedSessions(new Set());
    setEventFilter('all');
    setAnalyticsDialogOpen(true);
  };

  const toggleSession = (idx: number) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const eventTypeMeta: Record<string, { label: string; icon: any; color: string }> = {
    login: { label: 'تسجيل دخول', icon: LogIn, color: 'text-green-600' },
    logout: { label: 'تسجيل خروج', icon: LogOut, color: 'text-blue-600' },
    auto_logout: { label: 'إنهاء تلقائي', icon: AlertCircle, color: 'text-orange-600' },
    heartbeat: { label: 'نشاط', icon: Heart, color: 'text-muted-foreground' },
    tab_open: { label: 'فتح تبويبة', icon: MousePointerClick, color: 'text-indigo-600' },
    calculate: { label: 'حساب', icon: Calculator, color: 'text-purple-600' },
    save_quote: { label: 'حفظ تكلفة', icon: Save, color: 'text-green-700' },
    update_quote: { label: 'تعديل تكلفة', icon: Edit, color: 'text-amber-600' },
    delete_quote: { label: 'حذف تكلفة', icon: Trash2, color: 'text-red-600' },
    export_pdf: { label: 'تصدير PDF', icon: FileText, color: 'text-rose-600' },
    export_excel: { label: 'تصدير Excel', icon: Download, color: 'text-emerald-600' },
    import_excel: { label: 'استيراد Excel', icon: Upload, color: 'text-cyan-600' },
    settings_change: { label: 'تغيير إعدادات', icon: SettingsIcon, color: 'text-slate-600' },
  };

  const alertMeta: Record<string, { label: string; tone: string }> = {
    long_session: { label: 'جلسة طويلة جداً (+4 ساعات)', tone: 'bg-orange-100 text-orange-800 border-orange-200' },
    many_calc_no_save: { label: 'حسابات كثيرة بدون حفظ', tone: 'bg-amber-100 text-amber-800 border-amber-200' },
    frequent_tab_switching: { label: 'تنقّل متكرر بين التبويبات', tone: 'bg-blue-100 text-blue-800 border-blue-200' },
  };

  const performanceMeta: Record<string, { label: string; tone: string }> = {
    active: { label: '🚀 نشط جداً', tone: 'bg-green-600 text-white' },
    average: { label: '📊 متوسط', tone: 'bg-blue-500 text-white' },
    low: { label: '💤 منخفض', tone: 'bg-muted text-muted-foreground' },
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const tabLabel = (key: string | null) => (key ? (TAB_LABELS[key] || key) : '—');

  const exportAnalyticsExcel = () => {
    if (!analyticsTarget) return;
    const a = analyticsTarget;
    const wb = XLSX.utils.book_new();

    const addSheet = (name: string, rows: any[][], colWidths?: number[]) => {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      if (colWidths) ws['!cols'] = colWidths.map(w => ({ wch: w }));
      else if (rows[0]) ws['!cols'] = rows[0].map(() => ({ wch: 20 }));
      (ws as any)['!rtl'] = true;
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    };

    // 1) ملخص عام
    addSheet('① الملخص العام', [
      ['البند', 'القيمة'],
      ['المستخدم', a.username],
      ['الحالة', a.is_online ? `متصل (${a.active_session_count} جلسة)` : 'غير متصل'],
      ['التقييم', performanceMeta[a.performance_tier]?.label || a.performance_tier],
      ['إجمالي الجلسات', a.total_sessions],
      ['إجمالي وقت الاستخدام', formatDuration(a.total_duration_ms)],
      ['متوسط مدة الجلسة', formatDuration(Math.round(a.avg_session_ms))],
      ['متوسط العمليات لكل جلسة', a.avg_acts_per_session.toFixed(1)],
      ['إجمالي العمليات', a.total_activities],
      ['إجمالي الحسابات', a.total_calcs],
      ['إجمالي عمليات الحفظ', a.total_saves],
      ['نسبة التحويل (حفظ/حساب)', a.total_calcs > 0 ? `${((a.total_saves / a.total_calcs) * 100).toFixed(1)}%` : '—'],
      ['التبويبة الأكثر استخداماً', tabLabel(a.most_used_tab)],
      ['عدد التبويبات المستخدمة', (a.tab_stats || []).length],
      ['آخر دخول', formatDateTime(a.last_login_at)],
      ['آخر خروج', formatDateTime(a.last_logout_at)],
    ], [28, 35]);

    // 2) تحليل تفصيلي لكل تبويبة (الأهم)
    const allActs = a.sessions.flatMap(s => (s.activities || []).map(act => ({ ...act, _session: s })));
    const tabAnalysis: Record<string, any> = {};
    for (const act of allActs) {
      const k = act.tab_key || '_unknown';
      if (!tabAnalysis[k]) {
        tabAnalysis[k] = {
          actions: 0, calc: 0, save: 0, update: 0, delete: 0,
          exportPdf: 0, exportXl: 0, importXl: 0, voice: 0, settings: 0, inputs: 0,
          errors: 0, sessions: new Set<string>(), firstTs: Infinity, lastTs: 0,
        };
      }
      const t = tabAnalysis[k];
      t.actions++;
      const ts = new Date(act.occurred_at).getTime();
      if (ts < t.firstTs) t.firstTs = ts;
      if (ts > t.lastTs) t.lastTs = ts;
      if (act._session.session_token) t.sessions.add(act._session.session_token);
      switch (act.action) {
        case 'calculate': t.calc++; break;
        case 'save_quote': t.save++; break;
        case 'update_quote': t.update++; break;
        case 'delete_quote': t.delete++; break;
        case 'export_pdf': t.exportPdf++; break;
        case 'export_excel': t.exportXl++; break;
        case 'import_excel': t.importXl++; break;
        case 'voice_input': t.voice++; break;
        case 'settings_change': t.settings++; break;
        case 'input_change': t.inputs++; break;
      }
      const det = act.details || {};
      if (det.error || det.failed === true || det.success === false) t.errors++;
    }
    const tabDurations: Record<string, number> = {};
    (a.tab_stats || []).forEach(t => { tabDurations[t.tab_key] = t.duration_ms; });

    const tabAnalysisRows = [
      ['التبويبة', 'الجلسات', 'مدة الاستخدام', 'إجمالي العمليات', 'حسابات', 'حفظ', 'تعديل', 'حذف', 'تصدير PDF', 'تصدير Excel', 'استيراد', 'إدخال صوتي', 'تغيير إعدادات', 'تغييرات حقول', 'أخطاء', 'أول استخدام', 'آخر استخدام'],
      ...Object.entries(tabAnalysis)
        .sort((x, y) => y[1].actions - x[1].actions)
        .map(([k, v]: [string, any]) => [
          tabLabel(k), v.sessions.size, formatDuration(tabDurations[k] || 0),
          v.actions, v.calc, v.save, v.update, v.delete,
          v.exportPdf, v.exportXl, v.importXl, v.voice, v.settings, v.inputs, v.errors,
          v.firstTs !== Infinity ? formatDateTime(new Date(v.firstTs).toISOString()) : '—',
          v.lastTs ? formatDateTime(new Date(v.lastTs).toISOString()) : '—',
        ]),
    ];
    addSheet('② تحليل التبويبات', tabAnalysisRows,
      [22, 10, 16, 14, 10, 8, 10, 8, 12, 12, 10, 12, 14, 14, 8, 18, 18]);

    // 3) الجلسات
    const sessRows = [
      ['#', 'البداية', 'النهاية', 'المدة', 'حالة', 'أحداث', 'عمليات', 'حسابات', 'حفظ', 'تبويبات مستخدمة', 'الجهاز', 'IP', 'تنبيهات'],
      ...a.sessions.map((s, i) => [
        i + 1,
        formatDateTime(s.started_at),
        s.is_active ? 'جارية' : formatDateTime(s.ended_at),
        formatDuration(s.duration_ms),
        s.is_active ? 'نشطة' : 'منتهية',
        s.event_count, s.activity_count, s.calc_count, s.save_count,
        (s.tab_stats || []).map(t => tabLabel(t.tab_key)).join('، '),
        s.device_info || '—', s.ip_address || '—',
        (s.alerts || []).map(al => alertMeta[al]?.label || al).join('، '),
      ]),
    ];
    addSheet('③ الجلسات', sessRows, [4, 18, 18, 12, 10, 8, 8, 8, 8, 30, 25, 14, 25]);

    // 4) جلسات × تبويبات
    const sessionTabRows: any[][] = [['#الجلسة', 'البداية', 'التبويبة', 'عدد العمليات', 'مدة الاستخدام']];
    a.sessions.forEach((s, i) => {
      (s.tab_stats || []).forEach(t => {
        sessionTabRows.push([i + 1, formatDateTime(s.started_at), tabLabel(t.tab_key), t.count, formatDuration(t.duration_ms)]);
      });
    });
    addSheet('④ جلسات × تبويبات', sessionTabRows, [10, 18, 22, 14, 16]);

    // 5) النشاط بالتفصيل
    const actRows: any[][] = [['#الجلسة', 'الوقت', 'العملية', 'التبويبة', 'تفاصيل']];
    a.sessions.forEach((s, i) => {
      (s.activities || []).forEach(act => {
        actRows.push([
          i + 1, formatDateTime(act.occurred_at),
          eventTypeMeta[act.action]?.label || act.action,
          tabLabel(act.tab_key),
          Object.entries(act.details || {}).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' | '),
        ]);
      });
    });
    addSheet('⑤ سجل النشاط الكامل', actRows, [10, 20, 18, 22, 60]);

    // 6) الأخطاء والتنبيهات
    const errorRows: any[][] = [['الوقت', 'التبويبة', 'العملية', 'النوع', 'التفاصيل']];
    a.sessions.forEach((s) => {
      (s.activities || []).forEach(act => {
        const d = act.details || {};
        if (d.error || d.failed === true || d.success === false) {
          errorRows.push([formatDateTime(act.occurred_at), tabLabel(act.tab_key),
            eventTypeMeta[act.action]?.label || act.action, 'خطأ في العملية',
            d.error || d.message || JSON.stringify(d)]);
        }
      });
      (s.alerts || []).forEach(al => {
        errorRows.push([formatDateTime(s.started_at), '—', '—', 'تنبيه جلسة', alertMeta[al]?.label || al]);
      });
    });
    if (errorRows.length === 1) errorRows.push(['—', '—', '—', 'لا توجد أخطاء', '—']);
    addSheet('⑥ الأخطاء والتنبيهات', errorRows, [20, 22, 18, 18, 50]);

    // 7) النشاط حسب الساعة (heatmap بسيط)
    const hourly = Array(24).fill(0);
    const daily: Record<string, number> = {};
    allActs.forEach(act => {
      const d = new Date(act.occurred_at);
      hourly[d.getHours()]++;
      const day = d.toLocaleDateString('ar-SA');
      daily[day] = (daily[day] || 0) + 1;
    });
    addSheet('⑦ النشاط حسب الساعة', [
      ['الساعة', 'عدد العمليات'],
      ...hourly.map((c, i) => [`${String(i).padStart(2, '0')}:00`, c]),
    ], [10, 16]);

    addSheet('⑧ النشاط اليومي', [
      ['اليوم', 'عدد العمليات'],
      ...Object.entries(daily).sort().map(([d, c]) => [d, c]),
    ], [20, 16]);

    XLSX.writeFile(wb, `تحليل_${a.username}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div dir="rtl" className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" /> إدارة المستخدمين
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setTourOpen(true)} className="gap-1" title="جولة تعريفية">
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">جولة</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => { fetchUsers(); fetchAnalytics(); }} disabled={loading || analyticsLoading} title="تحديث">
              <RefreshCw className={`w-4 h-4 ${(loading || analyticsLoading) ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" onClick={openCreateDialog} className="gap-1">
              <UserPlus className="w-4 h-4" /> إضافة مستخدم
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">اسم المستخدم</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الاتصال</TableHead>
                  <TableHead className="text-right">الجلسات</TableHead>
                  <TableHead className="text-right">الاستخدام</TableHead>
                  <TableHead className="text-right">آخر دخول</TableHead>
                  <TableHead className="text-right">الصلاحية</TableHead>
                  <TableHead className="text-right">الأجهزة</TableHead>
                  <TableHead className="text-right">الموظفين</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const expiryStatus = getExpiryStatus(user.expires_at);
                  const a = analyticsMap[user.id];
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5 items-start">
                          <Badge variant={user.is_admin ? 'default' : 'secondary'}>
                            {user.is_admin ? 'مدير' : 'مستخدم'}
                          </Badge>
                          {!user.is_admin && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-950 border-amber-300/80 text-[11px] font-semibold gap-1 py-0.5 whitespace-nowrap">
                              <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                              {getPlanName(user.subscription_plan || getUserPlan(user.id, user.username))}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={user.is_active} onCheckedChange={() => handleToggleActive(user)} />
                          <span className={user.is_active ? 'text-green-600' : 'text-destructive'}>
                            {user.is_active ? 'مفعل' : 'معطل'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {a?.is_online ? (
                          <Badge className="gap-1 bg-green-600 hover:bg-green-600/90 text-white">
                            <Circle className="w-2 h-2 fill-current" /> متصل
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-muted-foreground">
                            <Circle className="w-2 h-2" /> غير متصل
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm tabular-nums">{a ? a.total_sessions : '—'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm tabular-nums">{a ? formatDuration(a.total_duration_ms) : '—'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{a?.last_login_at ? formatDateTime(a.last_login_at) : '—'}</span>
                      </TableCell>
                      <TableCell>
                        {expiryStatus === 'expired' ? (
                          <Badge variant="destructive" className="gap-1"><Clock className="w-3 h-3" /> منتهي</Badge>
                        ) : expiryStatus ? (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> {expiryStatus}</Badge>
                            <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => handleRemoveExpiry(user)} title="إزالة تاريخ الانتهاء">✕</Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">دائم</span>
                        )}
                      </TableCell>
                       <TableCell>
                         <Badge variant="outline" className="gap-1">
                           <Monitor className="w-3 h-3" /> {user.max_devices || 2}
                         </Badge>
                       </TableCell>
                       <TableCell>
                         <Badge variant="outline" className="gap-1">
                           <Users className="w-3 h-3" /> {user.max_employees || 0}
                         </Badge>
                       </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openAnalyticsDialog(user)} title="تحليلات الجلسات">
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(user)} title="تعديل">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openTabDialog(user)} title="صلاحيات التبويبات">
                            <Layers className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openSessionsDialog(user)} title="الأجهزة النشطة">
                            <Monitor className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteClick(user)} title="حذف">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>اسم المستخدم</Label>
              <Input value={formData.username} onChange={(e) => setFormData(p => ({ ...p, username: e.target.value }))} placeholder="أدخل اسم المستخدم" />
            </div>
            <div className="space-y-2">
              <Label>{editingUser ? 'كلمة المرور الجديدة (اتركها فارغة للإبقاء)' : 'كلمة المرور'}</Label>
              <Input type="password" value={formData.password} onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))} placeholder="أدخل كلمة المرور" />
            </div>
            <div className="flex items-center justify-between">
              <Label>مدير (صلاحيات كاملة)</Label>
              <Switch checked={formData.is_admin} onCheckedChange={(v) => setFormData(p => ({ ...p, is_admin: v }))} />
            </div>

            {!formData.is_admin && (
              <div className="space-y-2 background-[#fffbeb] p-3 rounded-lg border border-amber-200">
                <Label className="flex items-center gap-1.5 text-amber-900 font-semibold text-xs">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  نوع باقة الاشتراك للمستخدم
                </Label>
                <Select
                  value={formData.subscription_plan}
                  onValueChange={(val) => setFormData(p => ({ ...p, subscription_plan: val }))}
                >
                  <SelectTrigger className="w-full bg-white" dir="rtl">
                    <SelectValue placeholder="اختر باقة الاشتراك" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({typeof p.priceMonthly === 'number' ? `${p.priceMonthly} ر.س/شهر` : p.priceMonthly})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>الحد الأقصى للأجهزة المتصلة</Label>
              <Input type="number" value={formData.max_devices} onChange={(e) => setFormData(p => ({ ...p, max_devices: e.target.value }))} placeholder="2" min="1" max="10" />
            </div>
            <div className="space-y-2">
              <Label>عدد الموظفين المسموح (0 = لا يمكنه إضافة موظفين)</Label>
              <Input type="number" value={formData.max_employees} onChange={(e) => setFormData(p => ({ ...p, max_employees: e.target.value }))} placeholder="0" min="0" max="50" />
            </div>
            <div className="space-y-2">
              <Label>مدة الصلاحية (بالساعات) - اتركها فارغة لصلاحية دائمة</Label>
              <Input type="number" value={formData.expires_in_hours} onChange={(e) => setFormData(p => ({ ...p, expires_in_hours: e.target.value }))} placeholder="مثال: 24 لمدة يوم واحد" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingUser ? 'تحديث' : 'إنشاء'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tab Permissions Dialog */}
      <Dialog open={tabDialogOpen} onOpenChange={setTabDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>الصلاحيات وإظهار العناصر - {tabUserName}</DialogTitle>
          </DialogHeader>
          {tabLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <div className="space-y-5">
              <div>
                <h4 className="text-xs font-bold text-primary mb-2 px-1">التبويبة الرئيسية (تفتح بعد تسجيل الدخول)</h4>
                <p className="text-[11px] text-muted-foreground mb-2 px-1">يجب أن تكون من ضمن التبويبات المُفعّلة لهذا المستخدم.</p>
                <Select value={defaultTab || '__none__'} onValueChange={(v) => setDefaultTab(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="بدون (أول تبويبة متاحة)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">بدون (أول تبويبة متاحة)</SelectItem>
                    {tabPerms
                      .filter(p => TAB_LABELS[p.tab_key] && p.is_enabled)
                      .map(p => (
                        <SelectItem key={p.tab_key} value={p.tab_key}>{TAB_LABELS[p.tab_key]}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <h4 className="text-xs font-bold text-muted-foreground mb-2 px-1">تبويبات النظام</h4>
                <div className="space-y-1 rounded-lg border border-border/50 p-2">
                  {tabPerms.filter(p => TAB_LABELS[p.tab_key]).map((perm) => {
                    const idx = tabPerms.findIndex(t => t.tab_key === perm.tab_key);
                    return (
                      <div key={perm.tab_key} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                        <Label className="text-sm">{TAB_LABELS[perm.tab_key]}</Label>
                        <Switch
                          checked={perm.is_enabled}
                          onCheckedChange={(v) => {
                            setTabPerms(prev => prev.map((p, i) => i === idx ? { ...p, is_enabled: v } : p));
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-primary mb-2 px-1">إظهار العناصر داخل التكاليف المحفوظة</h4>
                <p className="text-[11px] text-muted-foreground mb-2 px-1">يتحكم في ظهور الأزرار والأدوات في الواجهة فقط (لا يؤثر على صلاحيات التنفيذ).</p>
                <div className="space-y-1 rounded-lg border border-primary/20 bg-primary/5 p-2">
                  {tabPerms.filter(p => VISIBILITY_LABELS[p.tab_key]).map((perm) => {
                    const idx = tabPerms.findIndex(t => t.tab_key === perm.tab_key);
                    return (
                      <div key={perm.tab_key} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                        <Label className="text-sm">{VISIBILITY_LABELS[perm.tab_key]}</Label>
                        <Switch
                          checked={perm.is_enabled}
                          onCheckedChange={(v) => {
                            setTabPerms(prev => prev.map((p, i) => i === idx ? { ...p, is_enabled: v } : p));
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTabDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSaveTabPerms} disabled={tabLoading} className="gap-1">
              {tabLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sessions Dialog */}
      <Dialog open={sessionsDialogOpen} onOpenChange={setSessionsDialogOpen}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>الأجهزة النشطة - {sessionsUserName}</DialogTitle>
          </DialogHeader>
          {sessionsLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : sessions.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">لا توجد جلسات نشطة</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 border border-border/50 rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Monitor className="w-4 h-4" />
                      {session.device_info || 'جهاز غير معروف'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      آخر نشاط: {new Date(session.last_active_at).toLocaleString('ar')}
                    </p>
                    {session.ip_address && (
                      <p className="text-xs text-muted-foreground">IP: {session.ip_address}</p>
                    )}
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => handleTerminateSession(session.id)}>
                    إنهاء
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد حذف المستخدم "{deleteTarget?.username}"؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:flex-row-reverse">
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Analytics Dialog */}
      <Dialog open={analyticsDialogOpen} onOpenChange={setAnalyticsDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[88vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                تحليل جلسات: {analyticsTarget?.username || '—'}
              </span>
              {analyticsTarget && (
                <Button size="sm" variant="outline" onClick={exportAnalyticsExcel} className="gap-1.5">
                  <Download className="w-3.5 h-3.5" /> تصدير Excel
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {!analyticsTarget ? (
            <p className="text-center text-muted-foreground py-8">لا توجد بيانات تحليل لهذا المستخدم بعد.</p>
          ) : (
            <div className="space-y-4">
              {/* KPI strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
                <div className="border rounded-lg p-2.5">
                  <div className="text-[11px] text-muted-foreground mb-1">الحالة</div>
                  <div className="font-semibold text-sm">
                    {analyticsTarget.is_online
                      ? <span className="text-green-600 flex items-center gap-1"><Circle className="w-2 h-2 fill-current" /> متصل ({analyticsTarget.active_session_count})</span>
                      : <span className="text-muted-foreground">غير متصل</span>}
                  </div>
                </div>
                <div className="border rounded-lg p-2.5">
                  <div className="text-[11px] text-muted-foreground mb-1">التقييم</div>
                  <Badge className={`${performanceMeta[analyticsTarget.performance_tier]?.tone || ''} text-[11px]`}>
                    {performanceMeta[analyticsTarget.performance_tier]?.label || analyticsTarget.performance_tier}
                  </Badge>
                </div>
                <div className="border rounded-lg p-2.5">
                  <div className="text-[11px] text-muted-foreground mb-1">الجلسات</div>
                  <div className="font-semibold tabular-nums text-sm">{analyticsTarget.total_sessions}</div>
                </div>
                <div className="border rounded-lg p-2.5">
                  <div className="text-[11px] text-muted-foreground mb-1">الاستخدام</div>
                  <div className="font-semibold tabular-nums text-sm">{formatDuration(analyticsTarget.total_duration_ms)}</div>
                </div>
                <div className="border rounded-lg p-2.5">
                  <div className="text-[11px] text-muted-foreground mb-1">حسابات / حفظ</div>
                  <div className="font-semibold tabular-nums text-sm">{analyticsTarget.total_calcs} / {analyticsTarget.total_saves}</div>
                </div>
                <div className="border rounded-lg p-2.5">
                  <div className="text-[11px] text-muted-foreground mb-1">متوسط الجلسة</div>
                  <div className="font-semibold tabular-nums text-sm">{formatDuration(Math.round(analyticsTarget.avg_session_ms))}</div>
                </div>
                <div className="border rounded-lg p-2.5 col-span-2 sm:col-span-2">
                  <div className="text-[11px] text-muted-foreground mb-1">آخر دخول</div>
                  <div className="font-medium text-xs">{formatDateTime(analyticsTarget.last_login_at)}</div>
                </div>
                <div className="border rounded-lg p-2.5 col-span-2 sm:col-span-2">
                  <div className="text-[11px] text-muted-foreground mb-1">آخر خروج</div>
                  <div className="font-medium text-xs">{formatDateTime(analyticsTarget.last_logout_at)}</div>
                </div>
                <div className="border rounded-lg p-2.5 col-span-2 sm:col-span-2">
                  <div className="text-[11px] text-muted-foreground mb-1">الأكثر استخداماً</div>
                  <div className="font-medium text-xs">{tabLabel(analyticsTarget.most_used_tab)}</div>
                </div>
              </div>

              {/* Per-tab usage */}
              {analyticsTarget.tab_stats && analyticsTarget.tab_stats.length > 0 && (
                <div className="border rounded-lg p-3">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4" /> استخدام التبويبات
                  </h4>
                  <div className="space-y-1.5">
                    {(() => {
                      const max = Math.max(...analyticsTarget.tab_stats.map(t => t.count), 1);
                      return analyticsTarget.tab_stats.slice(0, 10).map(t => (
                        <div key={t.tab_key} className="flex items-center gap-2">
                          <span className="text-xs w-32 shrink-0 truncate" title={tabLabel(t.tab_key)}>{tabLabel(t.tab_key)}</span>
                          <div className="flex-1 bg-muted rounded h-2 overflow-hidden">
                            <div className="bg-primary h-full" style={{ width: `${(t.count / max) * 100}%` }} />
                          </div>
                          <span className="text-[11px] tabular-nums text-muted-foreground w-12 text-left">{t.count}</span>
                          <span className="text-[11px] tabular-nums text-muted-foreground w-16 text-left">{formatDuration(t.duration_ms)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* === تحليلات متقدمة (مشتقة من البيانات الموجودة) === */}
              {(() => {
                const a = analyticsTarget;
                const allActs = a.sessions.flatMap(s => (s.activities || []).map(act => ({ ...act, _session: s })));

                // Heatmap: 7 days × 24 hours
                const heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
                let maxHeat = 0;
                allActs.forEach(act => {
                  const d = new Date(act.occurred_at);
                  const day = d.getDay();
                  const hour = d.getHours();
                  heat[day][hour]++;
                  if (heat[day][hour] > maxHeat) maxHeat = heat[day][hour];
                });

                // زمن أول حساب لكل تبويبة (متوسط)
                const firstCalc: Record<string, number[]> = {};
                a.sessions.forEach(s => {
                  const tabFirstOpen: Record<string, number> = {};
                  (s.activities || []).forEach(act => {
                    const tab = act.tab_key || '_unknown';
                    const ts = new Date(act.occurred_at).getTime();
                    if (act.action === 'tab_open' && !tabFirstOpen[tab]) {
                      tabFirstOpen[tab] = ts;
                    }
                    if (act.action === 'calculate' && tabFirstOpen[tab]) {
                      const delta = ts - tabFirstOpen[tab];
                      if (delta > 0 && delta < 30 * 60 * 1000) {
                        if (!firstCalc[tab]) firstCalc[tab] = [];
                        firstCalc[tab].push(delta);
                      }
                      delete tabFirstOpen[tab];
                    }
                  });
                });
                const firstCalcAvg = Object.entries(firstCalc).map(([tab, arr]) => ({
                  tab,
                  avgMs: arr.reduce((s, v) => s + v, 0) / arr.length,
                  samples: arr.length,
                })).sort((x, y) => y.avgMs - x.avgMs).slice(0, 5);

                // معدل التراجع: تبويبات فُتحت بدون أي حساب
                const tabOpens: Record<string, { opens: number; calcs: number }> = {};
                a.sessions.forEach(s => {
                  const seen = new Set<string>();
                  (s.activities || []).forEach(act => {
                    const tab = act.tab_key || '_unknown';
                    if (act.action === 'tab_open') {
                      if (!tabOpens[tab]) tabOpens[tab] = { opens: 0, calcs: 0 };
                      const key = `${s.session_token}_${tab}`;
                      if (!seen.has(key)) { tabOpens[tab].opens++; seen.add(key); }
                    }
                    if (act.action === 'calculate') {
                      if (!tabOpens[tab]) tabOpens[tab] = { opens: 0, calcs: 0 };
                      tabOpens[tab].calcs++;
                    }
                  });
                });
                const bounceRates = Object.entries(tabOpens)
                  .filter(([, v]) => v.opens >= 2)
                  .map(([tab, v]) => ({
                    tab,
                    opens: v.opens,
                    calcs: v.calcs,
                    bounce: v.calcs === 0 ? 100 : Math.max(0, ((v.opens - v.calcs) / v.opens) * 100),
                  }))
                  .sort((x, y) => y.bounce - x.bounce)
                  .slice(0, 5);

                const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                const fmtMs = (ms: number) => ms < 1000 ? `${Math.round(ms)}ms` : ms < 60000 ? `${(ms/1000).toFixed(1)}ث` : `${Math.floor(ms/60000)}د ${Math.floor((ms%60000)/1000)}ث`;

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* Heatmap */}
                    <div className="border rounded-lg p-3 lg:col-span-2">
                      <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                        <BarChart3 className="w-4 h-4" /> خريطة النشاط (يوم × ساعة)
                      </h4>
                      {maxHeat === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">لا يوجد نشاط بعد.</p>
                      ) : (
                        <div className="overflow-x-auto" dir="ltr">
                          <table className="text-[10px] tabular-nums mx-auto">
                            <thead>
                              <tr>
                                <th className="text-right pr-2 text-muted-foreground font-normal"></th>
                                {Array.from({ length: 24 }, (_, h) => (
                                  <th key={h} className="text-center text-muted-foreground font-normal w-5">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {heat.map((row, d) => (
                                <tr key={d}>
                                  <td className="text-right pr-2 text-muted-foreground whitespace-nowrap">{dayNames[d]}</td>
                                  {row.map((c, h) => {
                                    const intensity = c === 0 ? 0 : Math.max(0.15, c / maxHeat);
                                    const isSelected = heatCell?.day === d && heatCell?.hour === h;
                                    return (
                                      <td key={h} className="p-0.5">
                                        <button
                                          type="button"
                                          disabled={c === 0}
                                          onClick={() => setHeatCell(isSelected ? null : { day: d, hour: h })}
                                          className={`w-4 h-4 rounded-sm transition-all ${c > 0 ? 'cursor-pointer hover:ring-2 hover:ring-primary' : 'cursor-default'} ${isSelected ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
                                          style={{ backgroundColor: c === 0 ? 'hsl(var(--muted))' : `hsl(var(--primary) / ${intensity})` }}
                                          title={`${dayNames[d]} ${h}:00 — ${c} عملية${c > 0 ? ' (انقر للتفاصيل)' : ''}`}
                                        />
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="flex items-center justify-center gap-2 mt-2 text-[10px] text-muted-foreground" dir="rtl">
                            <span>أقل</span>
                            {[0.15, 0.35, 0.55, 0.75, 1].map(o => (
                              <div key={o} className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(var(--primary) / ${o})` }} />
                            ))}
                            <span>أكثر</span>
                            <span className="mr-2">• الذروة: {maxHeat} عملية</span>
                          </div>
                          {heatCell && (() => {
                            const cellActs = allActs.filter(act => {
                              const dt = new Date(act.occurred_at);
                              return dt.getDay() === heatCell.day && dt.getHours() === heatCell.hour;
                            });
                            const tabCounts: Record<string, number> = {};
                            const actionCounts: Record<string, number> = {};
                            const errors: { time: string; tab: string; detail: string }[] = [];
                            cellActs.forEach(act => {
                              const tab = act.tab_key || '_unknown';
                              tabCounts[tab] = (tabCounts[tab] || 0) + 1;
                              actionCounts[act.action] = (actionCounts[act.action] || 0) + 1;
                              if (act.action === 'error' || act.action === 'calc_error' || (act.details && /error|fail|خطأ/i.test(JSON.stringify(act.details)))) {
                                errors.push({
                                  time: new Date(act.occurred_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                                  tab: tabLabel(tab),
                                  detail: typeof act.details === 'string' ? act.details : JSON.stringify(act.details || {}).slice(0, 120),
                                });
                              }
                            });
                            const actionLabel: Record<string, string> = {
                              tab_open: 'فتح تبويبة', calculate: 'حساب', save_quote: 'حفظ عرض',
                              voice_input: 'إدخال صوتي', settings_change: 'تغيير إعدادات',
                              error: 'خطأ', calc_error: 'خطأ حساب', login: 'دخول', logout: 'خروج',
                            };
                            const last5 = [...cellActs].sort((x, y) =>
                              new Date(y.occurred_at).getTime() - new Date(x.occurred_at).getTime()
                            ).slice(0, 5);
                            return (
                              <div dir="rtl" className="mt-3 border-t pt-3 space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <h5 className="font-semibold flex items-center gap-1.5">
                                    🕐 {dayNames[heatCell.day]} — {String(heatCell.hour).padStart(2, '0')}:00 إلى {String(heatCell.hour).padStart(2, '0')}:59
                                  </h5>
                                  <button onClick={() => setHeatCell(null)} className="text-muted-foreground hover:text-foreground text-[11px]">✕ إغلاق</button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="bg-muted/30 rounded p-2">
                                    <div className="text-[10px] text-muted-foreground mb-1">📑 التبويبات المستخدمة</div>
                                    <div className="space-y-0.5">
                                      {Object.entries(tabCounts).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                                        <div key={t} className="flex justify-between gap-2">
                                          <span className="truncate">{tabLabel(t)}</span>
                                          <span className="tabular-nums text-muted-foreground">{n}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="bg-muted/30 rounded p-2">
                                    <div className="text-[10px] text-muted-foreground mb-1">⚙️ نوع العمليات</div>
                                    <div className="space-y-0.5">
                                      {Object.entries(actionCounts).sort((a, b) => b[1] - a[1]).map(([act, n]) => (
                                        <div key={act} className="flex justify-between gap-2">
                                          <span className="truncate">{actionLabel[act] || act}</span>
                                          <span className="tabular-nums text-muted-foreground">{n}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                {errors.length > 0 && (
                                  <div className="bg-destructive/10 border border-destructive/30 rounded p-2">
                                    <div className="text-[10px] text-destructive font-semibold mb-1">❌ الأخطاء ({errors.length})</div>
                                    <div className="space-y-0.5 text-[11px]">
                                      {errors.slice(0, 4).map((e, i) => (
                                        <div key={i} className="flex gap-2">
                                          <span className="text-muted-foreground tabular-nums shrink-0">{e.time}</span>
                                          <span className="truncate">{e.tab}: {e.detail}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <div className="bg-muted/30 rounded p-2">
                                  <div className="text-[10px] text-muted-foreground mb-1">🎯 آخر {last5.length} أنشطة</div>
                                  <div className="space-y-0.5 text-[11px]">
                                    {last5.map((act, i) => (
                                      <div key={i} className="flex gap-2">
                                        <span className="text-muted-foreground tabular-nums shrink-0">
                                          {new Date(act.occurred_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                        <Badge variant="outline" className="text-[10px] h-4 shrink-0">{tabLabel(act.tab_key)}</Badge>
                                        <span className="truncate">{actionLabel[act.action] || act.action}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="text-[10px] text-muted-foreground text-center">
                                  إجمالي {cellActs.length} نشاط في هذه الفترة
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {/* زمن أول حساب */}
                    <div className="border rounded-lg p-3">
                      <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                        <Clock className="w-4 h-4" /> زمن أول حساب (متوسط)
                      </h4>
                      <p className="text-[10px] text-muted-foreground mb-2">من فتح التبويبة حتى أول عملية حساب — كلما زاد، صعُب فهم التبويبة.</p>
                      {firstCalcAvg.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">بيانات غير كافية.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {firstCalcAvg.map(f => (
                            <div key={f.tab} className="flex items-center justify-between text-xs gap-2">
                              <span className="truncate flex-1" title={tabLabel(f.tab)}>{tabLabel(f.tab)}</span>
                              <Badge variant="outline" className="text-[10px] tabular-nums shrink-0">{fmtMs(f.avgMs)}</Badge>
                              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 w-12 text-left">({f.samples}×)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* معدل التراجع */}
                    <div className="border rounded-lg p-3">
                      <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4" /> معدل التراجع (تبويبات فُتحت بلا حساب)
                      </h4>
                      <p className="text-[10px] text-muted-foreground mb-2">نسبة الفتحات التي لم تُؤدِّ إلى حساب — مؤشر على حيرة المستخدم.</p>
                      {bounceRates.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">بيانات غير كافية.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {bounceRates.map(b => (
                            <div key={b.tab} className="flex items-center gap-2 text-xs">
                              <span className="w-28 truncate shrink-0" title={tabLabel(b.tab)}>{tabLabel(b.tab)}</span>
                              <div className="flex-1 bg-muted rounded h-2 overflow-hidden">
                                <div
                                  className="h-full"
                                  style={{
                                    width: `${b.bounce}%`,
                                    backgroundColor: b.bounce > 70 ? 'hsl(var(--destructive))' : b.bounce > 40 ? 'hsl(38 92% 50%)' : 'hsl(var(--primary))',
                                  }}
                                />
                              </div>
                              <span className="text-[10px] tabular-nums w-10 text-left shrink-0">{b.bounce.toFixed(0)}%</span>
                              <span className="text-[10px] text-muted-foreground tabular-nums w-14 text-left shrink-0">{b.calcs}/{b.opens}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div>
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <h4 className="font-semibold text-sm">قائمة الجلسات ({analyticsTarget.sessions.length})</h4>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">تصفية:</Label>
                    <Select value={eventFilter} onValueChange={setEventFilter}>
                      <SelectTrigger className="h-8 w-[160px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">كل العمليات</SelectItem>
                        <SelectItem value="login">تسجيل دخول</SelectItem>
                        <SelectItem value="logout">تسجيل خروج</SelectItem>
                        <SelectItem value="auto_logout">إنهاء تلقائي</SelectItem>
                        <SelectItem value="tab_open">فتح تبويبة</SelectItem>
                        <SelectItem value="calculate">حساب</SelectItem>
                        <SelectItem value="save_quote">حفظ تكلفة</SelectItem>
                        <SelectItem value="export_pdf">تصدير PDF</SelectItem>
                        <SelectItem value="export_excel">تصدير Excel</SelectItem>
                        <SelectItem value="import_excel">استيراد Excel</SelectItem>
                        <SelectItem value="settings_change">تغيير إعدادات</SelectItem>
                        <SelectItem value="heartbeat">نشاط (heartbeat)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {analyticsTarget.sessions.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-6">لا توجد جلسات مسجّلة بعد.</p>
                ) : (
                  <div className="space-y-2">
                    {analyticsTarget.sessions.map((s, i) => {
                      const isOpen = expandedSessions.has(i);
                      // Merge events + activities into one timeline
                      const merged = [
                        ...(s.events || []).map(e => ({ kind: e.event_type, when: e.occurred_at, tab: null as string | null, details: {} as Record<string, any> })),
                        ...(s.activities || []).map(a => ({ kind: a.action, when: a.occurred_at, tab: a.tab_key, details: a.details })),
                      ].sort((x, y) => new Date(x.when).getTime() - new Date(y.when).getTime());
                      const filtered = eventFilter === 'all' ? merged : merged.filter(e => e.kind === eventFilter);
                      return (
                        <div key={i} className="border rounded-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleSession(i)}
                            className="w-full flex items-center justify-between gap-3 p-3 hover:bg-muted/50 transition-colors text-right"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronLeft className="w-4 h-4 shrink-0" />}
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-medium tabular-nums">{formatDateTime(s.started_at)}</span>
                                  <span className="text-muted-foreground text-xs">←</span>
                                  <span className="text-xs tabular-nums">
                                    {s.is_active ? <span className="text-green-600">جارية</span> : formatDateTime(s.ended_at)}
                                  </span>
                                  <Badge variant="outline" className="text-[10px] h-5">{s.activity_count} عملية</Badge>
                                  {s.calc_count > 0 && <Badge variant="outline" className="text-[10px] h-5 text-purple-600">{s.calc_count} حساب</Badge>}
                                  {s.save_count > 0 && <Badge variant="outline" className="text-[10px] h-5 text-green-700">{s.save_count} حفظ</Badge>}
                                  {(s.alerts || []).map(a => (
                                    <Badge key={a} variant="outline" className={`text-[10px] h-5 ${alertMeta[a]?.tone || ''}`}>
                                      <AlertCircle className="w-2.5 h-2.5 ml-0.5" />{alertMeta[a]?.label || a}
                                    </Badge>
                                  ))}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground truncate">
                                  <span className="tabular-nums">{formatDuration(s.duration_ms)}</span>
                                  <span>•</span>
                                  <span className="truncate" title={s.device_info || ''}>{s.device_info || 'جهاز غير معروف'}</span>
                                  {s.ip_address && <><span>•</span><span className="tabular-nums">{s.ip_address}</span></>}
                                </div>
                                {/* mini tab usage in session */}
                                {s.tab_stats && s.tab_stats.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-1">
                                    {s.tab_stats.slice(0, 5).map(t => (
                                      <span key={t.tab_key} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                                        {tabLabel(t.tab_key)} <span className="tabular-nums text-muted-foreground">({t.count})</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            {s.is_active
                              ? <Badge className="bg-green-600 hover:bg-green-600/90 text-white shrink-0">نشطة</Badge>
                              : s.last_event_type === 'auto_logout'
                                ? <Badge variant="outline" className="text-orange-600 shrink-0">إنهاء تلقائي</Badge>
                                : <Badge variant="secondary" className="shrink-0">منتهية</Badge>}
                          </button>
                          {isOpen && (
                            <div className="border-t bg-muted/20 p-3">
                              {filtered.length === 0 ? (
                                <p className="text-xs text-center text-muted-foreground py-3">لا توجد عمليات تطابق التصفية.</p>
                              ) : (
                                <ol className="relative border-r-2 border-border/60 pr-4 space-y-2.5 max-h-80 overflow-y-auto">
                                  {filtered.map((ev, j) => {
                                    const meta = eventTypeMeta[ev.kind] || { label: ev.kind, icon: Activity, color: 'text-muted-foreground' };
                                    const Icon = meta.icon;
                                    const detailsStr = ev.details && Object.keys(ev.details).length
                                      ? Object.entries(ev.details).map(([k,v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' • ')
                                      : '';
                                    return (
                                      <li key={j} className="relative">
                                        <span className={`absolute -right-[22px] top-0.5 w-4 h-4 rounded-full bg-background border-2 border-border flex items-center justify-center ${meta.color}`}>
                                          <Icon className="w-2.5 h-2.5" />
                                        </span>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                                          {ev.tab && <Badge variant="outline" className="text-[10px] h-4">{tabLabel(ev.tab)}</Badge>}
                                          <span className="text-[11px] text-muted-foreground tabular-nums">{formatTime(ev.when)}</span>
                                        </div>
                                        {detailsStr && (
                                          <div className="text-[10px] text-muted-foreground mt-0.5 truncate" title={detailsStr}>{detailsStr}</div>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ol>
                              )}
                              <div className="text-[10px] text-muted-foreground mt-2 text-left">
                                عرض {filtered.length} من {merged.length} عملية
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnalyticsDialogOpen(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminPanelTour open={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  );
};

export default UserManagement;
