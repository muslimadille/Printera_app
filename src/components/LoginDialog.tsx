import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Printer, LogIn, Loader2, Monitor, Smartphone, LogOut, KeyRound } from 'lucide-react';
import { loginUser, forceLogin, changePassword, TabPermission } from '@/lib/userApi';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'sonner';

interface ActiveSession {
  id: string;
  device_info: string | null;
  last_active_at: string;
}

interface LoginDialogProps {
  onLogin: (user: { id: string; username: string; is_admin: boolean; max_employees: number; employees_can_view_quotes: boolean }) => void;
  onPasswordCapture?: (password: string) => void;
  onSessionToken?: (token: string) => void;
  onTabPermissions?: (perms: TabPermission[]) => void;
  onCloudSettings?: (settings: Record<string, any>) => void;
}

const LoginDialog = ({ onLogin, onPasswordCapture, onSessionToken, onTabPermissions, onCloudSettings }: LoginDialogProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  // Device limit state
  const [showDeviceLimit, setShowDeviceLimit] = useState(false);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [maxDevices, setMaxDevices] = useState(1);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [forceLoading, setForceLoading] = useState(false);

  // Change password state
  const [showChangePw, setShowChangePw] = useState(false);
  const [cpUsername, setCpUsername] = useState('');
  const [cpOldPw, setCpOldPw] = useState('');
  const [cpNewPw, setCpNewPw] = useState('');
  const [cpConfirmPw, setCpConfirmPw] = useState('');
  const [cpError, setCpError] = useState('');
  const [cpLoading, setCpLoading] = useState(false);

  const openChangePw = () => {
    setCpUsername(username);
    setCpOldPw(password);
    setCpNewPw('');
    setCpConfirmPw('');
    setCpError('');
    setShowChangePw(true);
  };

  const handleChangePassword = async () => {
    setCpError('');
    if (!cpUsername || !cpOldPw || !cpNewPw) {
      setCpError('يرجى تعبئة جميع الحقول');
      return;
    }
    if (cpNewPw.length < 6) {
      setCpError('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (cpNewPw !== cpConfirmPw) {
      setCpError('كلمتا المرور غير متطابقتين');
      return;
    }
    if (cpNewPw === cpOldPw) {
      setCpError('كلمة المرور الجديدة يجب أن تختلف عن القديمة');
      return;
    }
    setCpLoading(true);
    try {
      await changePassword(cpUsername, cpOldPw, cpNewPw);
      setShowChangePw(false);
      toast.success('تم تغيير كلمة المرور بنجاح. يرجى تسجيل الدخول بكلمة المرور الجديدة');
      setUsername(cpUsername);
      setPassword('');
    } catch (err: any) {
      setCpError(err?.message || 'تعذر تغيير كلمة المرور');
    } finally {
      setCpLoading(false);
    }
  };

  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    const isMobile = /Mobile|Android|iPhone/i.test(ua);
    return `${isMobile ? 'Mobile' : 'Desktop'} - ${navigator.platform}`;
  };

  const handleLoginSuccess = (result: any) => {
    setError('');
    if (rememberMe) {
      sessionStorage.setItem('printCalc_rememberMe', 'true');
    }
    onPasswordCapture?.(password);
    onSessionToken?.(result.session_token);
    onTabPermissions?.(result.tab_permissions || []);
    onCloudSettings?.(result.settings || {});
    onLogin({ id: result.user.id, username: result.user.username, is_admin: result.user.is_admin, max_employees: result.user.max_employees || 0, employees_can_view_quotes: result.user.employees_can_view_quotes || false });
  };

  const handleLogin = async () => {
    if (!username || !password) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }
    setLoading(true);
    try {
      const result = await loginUser(username, password, getDeviceInfo());
      handleLoginSuccess(result);
    } catch (err: any) {
      if (err.device_limit_reached) {
        setActiveSessions(err.active_sessions || []);
        setMaxDevices(err.max_devices || 1);
        setSelectedSessions([]);
        setShowDeviceLimit(true);
      } else {
        setError(err.message || 'اسم المستخدم أو كلمة المرور غير صحيحة');
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleSession = (id: string) => {
    setSelectedSessions(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleForceLogin = async () => {
    if (selectedSessions.length === 0) return;
    setForceLoading(true);
    try {
      const result = await forceLogin(username, password, selectedSessions, getDeviceInfo());
      setShowDeviceLimit(false);
      handleLoginSuccess(result);
    } catch (err: any) {
      if (err.device_limit_reached) {
        setActiveSessions(err.active_sessions || []);
        setMaxDevices(err.max_devices || 1);
        setSelectedSessions([]);
        setShowDeviceLimit(true);
        setError(err.message || 'لا يزال عدد الأجهزة النشطة يتجاوز الحد المسموح');
      } else {
        setError(err.message || 'حدث خطأ أثناء تسجيل الدخول');
        setShowDeviceLimit(false);
      }
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setForceLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' });
    } catch { return dateStr; }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <Dialog open={true}>
        {/*
          No position utility in this className. DialogContent composes it with cn(),
          which runs tailwind-merge, and tailwind-merge treats `relative` and the base
          component's `fixed` as the same group — last one wins, so `relative` silently
          DROPS `fixed`. left-[50%]/top-[50%] then resolve against the document instead
          of the viewport and the dialog renders entirely off-screen.
          The ThemeToggle below is `absolute`, but `fixed` is already a positioned
          ancestor for it, so nothing needs `relative` here.
        */}
        <DialogContent
          className={`sm:max-w-md border-border/50 shadow-2xl shadow-primary/10 transition-transform ${shake ? 'animate-shake' : ''}`}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="absolute top-3 start-3 z-10">
            <ThemeToggle />
          </div>
          <DialogHeader className="items-center text-center gap-4">
            <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center mx-auto shadow-xl shadow-primary/30 animate-float">
              <Printer className="w-10 h-10 text-primary-foreground" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-2xl font-extrabold bg-gradient-to-l from-primary to-accent bg-clip-text text-transparent">
                حاسبة تكلفة الطباعة الذكية
              </DialogTitle>
              <p className="text-base font-semibold text-primary/80 italic leading-relaxed">
                احسبها صح… يكفي تحسبها مرة
              </p>
              <DialogDescription className="text-sm text-muted-foreground">
                مرحباً بك، يرجى تسجيل الدخول للمتابعة
              </DialogDescription>
            </div>
          </DialogHeader>

          <form
            onSubmit={(e) => { e.preventDefault(); handleLogin(); }}
            className="space-y-4 mt-3"
            dir="rtl"
          >
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-semibold">اسم المستخدم</Label>
              <Input
                id="username" value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                placeholder="أدخل اسم المستخدم" autoFocus disabled={loading}
                className="h-11 bg-muted/40 border-border/50 focus:border-primary/50 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold">كلمة المرور</Label>
              <Input
                id="password" type="password" value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="أدخل كلمة المرور" disabled={loading}
                className="h-11 bg-muted/40 border-border/50 focus:border-primary/50 transition-colors"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Checkbox id="rememberMe" checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)} disabled={loading} />
                <Label htmlFor="rememberMe" className="text-sm cursor-pointer text-muted-foreground">تذكرني لمدة 30 يوم</Label>
              </div>
              <button
                type="button"
                onClick={openChangePw}
                disabled={loading}
                className="text-xs font-medium text-primary hover:text-primary/80 hover:underline transition-colors flex items-center gap-1"
              >
                <KeyRound className="w-3.5 h-3.5" />
                تغيير كلمة المرور
              </button>
            </div>
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-2.5 text-center">
                <p className="text-sm text-destructive font-medium">{error}</p>
              </div>
            )}
            <Button type="submit"
              className="w-full gap-2 text-base h-12 gradient-primary hover:opacity-90 transition-all shadow-lg shadow-primary/25 rounded-xl font-bold"
              disabled={loading}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
              {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Device Limit Dialog */}
      <AlertDialog open={showDeviceLimit} onOpenChange={setShowDeviceLimit}>
        <AlertDialogContent className="sm:max-w-lg" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-lg text-destructive flex items-center justify-center gap-2">
              <Monitor className="w-5 h-5" />
              تم الوصول للحد الأقصى من الأجهزة
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              الحد المسموح: {maxDevices} {maxDevices === 1 ? 'جهاز' : 'أجهزة'}. اختر الجلسات التي تريد تسجيل الخروج منها للمتابعة.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 my-3 max-h-60 overflow-y-auto">
            {activeSessions.map((session) => {
              const isMobile = session.device_info?.includes('Mobile');
              const isSelected = selectedSessions.includes(session.id);
              return (
                <div
                  key={session.id}
                  onClick={() => toggleSession(session.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected ? 'border-destructive bg-destructive/10' : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <Checkbox checked={isSelected} onCheckedChange={() => toggleSession(session.id)} />
                  {isMobile ? <Smartphone className="w-5 h-5 text-muted-foreground" /> : <Monitor className="w-5 h-5 text-muted-foreground" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{session.device_info || 'جهاز غير معروف'}</p>
                    <p className="text-xs text-muted-foreground">آخر نشاط: {formatDate(session.last_active_at)}</p>
                  </div>
                  {isSelected && <LogOut className="w-4 h-4 text-destructive" />}
                </div>
              );
            })}
          </div>

          <AlertDialogFooter className="flex gap-2 sm:flex-row-reverse">
            <AlertDialogAction
              onClick={handleForceLogin}
              disabled={selectedSessions.length === 0 || forceLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {forceLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <LogOut className="w-4 h-4 ml-2" />}
              تسجيل خروج ودخول
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Password Dialog */}
      <Dialog open={showChangePw} onOpenChange={setShowChangePw}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="w-5 h-5 text-primary" />
              تغيير كلمة المرور
            </DialogTitle>
            <DialogDescription>
              أدخل كلمة المرور الحالية ثم كلمة المرور الجديدة. سيتم تسجيل الخروج من جميع الأجهزة بعد التغيير.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }}
            className="space-y-3 mt-2"
          >
            <div className="space-y-1.5">
              <Label htmlFor="cp-username" className="text-sm font-semibold">اسم المستخدم</Label>
              <Input id="cp-username" value={cpUsername}
                onChange={(e) => { setCpUsername(e.target.value); setCpError(''); }}
                disabled={cpLoading} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-old" className="text-sm font-semibold">كلمة المرور الحالية</Label>
              <Input id="cp-old" type="password" value={cpOldPw}
                onChange={(e) => { setCpOldPw(e.target.value); setCpError(''); }}
                disabled={cpLoading} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-new" className="text-sm font-semibold">كلمة المرور الجديدة</Label>
              <Input id="cp-new" type="password" value={cpNewPw}
                onChange={(e) => { setCpNewPw(e.target.value); setCpError(''); }}
                disabled={cpLoading} className="h-10" placeholder="6 أحرف على الأقل" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-confirm" className="text-sm font-semibold">تأكيد كلمة المرور الجديدة</Label>
              <Input id="cp-confirm" type="password" value={cpConfirmPw}
                onChange={(e) => { setCpConfirmPw(e.target.value); setCpError(''); }}
                disabled={cpLoading} className="h-10" />
            </div>
            {cpError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-2.5 text-center">
                <p className="text-sm text-destructive font-medium">{cpError}</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={cpLoading}
                className="flex-1 gap-2 gradient-primary hover:opacity-90 font-bold">
                {cpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                {cpLoading ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowChangePw(false)} disabled={cpLoading}>
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoginDialog;
