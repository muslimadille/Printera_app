import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableScroller } from '@/components/layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Trash2, Edit, Users, Loader2, RefreshCw, Layers, FileText, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import { AppUser, TabPermission, listEmployees, createEmployee, updateEmployee, deleteEmployee, checkEmployeeQuotes, getEmployeeTabPermissions, updateEmployeeTabPermissions } from '@/lib/userApi';

const TAB_LABELS: Record<string, string> = {
  hybridengine: 'حساب الصنف',
  itemcost: 'تكلفة صنف',
  templates: 'قوالب',
  templatecost: 'تكلفة بقالب',
  costcalc: 'حساب التكلفة',
  smartengine: 'المحرك الذكي',
  calculator: 'حاسبة التسعير',
  paperset: 'مجموعة أوراق',
  magazines: 'المجلات',
  magazinesheet: 'تكلفة مجلة',
  montage: 'مونتاج',
  bagcalc: 'حساب الأكياس',
  newmagazine: 'المجلة',
  employee: 'إدخال الموظف',
  quote: 'عرض سعر',
  finishing: 'التشطيبات',
  papertypes: 'أنواع الورق',
  settings: 'الإعدادات',
  magazine: 'المجلات (قديم)',
  manual: 'يدوي',
  boxpricing: 'العلب والأكياس',
  guide: 'الدليل',
  bulkimport: 'استيراد تسعيرات',
  savedquotes: 'التكاليف المحفوظة',
  boxes: 'علب',
  box_d001: 'علب — D001',
  box_t0001: 'علب — T0001',
  box_t0002: 'علب — T0002',
  box_t0003: 'علب — T0003',
  box_t0004: 'علب — T0004',
};

// عناصر إظهار/إخفاء داخل قسم التكاليف المحفوظة (Visibility Control فقط)
const VISIBILITY_LABELS: Record<string, string> = {
  sq_show_employees_view: 'إظهار: رؤية الموظفين',
  sq_show_transfer: 'إظهار: ترحيل العروض',
  sq_show_import: 'إظهار: استيراد البيانات',
  sq_show_export: 'إظهار: تصدير البيانات',
  sq_show_actions: 'إظهار: إجراءات الصف (تعديل/حذف)',
};

interface EmployeeManagementProps {
  sessionToken: string;
  maxEmployees: number;
  parentTabPermissions: TabPermission[];
  userId: string;
}

const EmployeeManagement = ({ sessionToken, maxEmployees, parentTabPermissions, userId }: EmployeeManagementProps) => {
  const [employees, setEmployees] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<AppUser | null>(null);
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [saving, setSaving] = useState(false);

  // Tab permissions
  const [tabDialogOpen, setTabDialogOpen] = useState(false);
  const [tabUserId, setTabUserId] = useState('');
  const [tabUserName, setTabUserName] = useState('');
  const [tabPerms, setTabPerms] = useState<TabPermission[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  // Delete with quote transfer
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [deleteQuoteCount, setDeleteQuoteCount] = useState(0);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);
  const [transferTarget, setTransferTarget] = useState<string>('parent');

  const fetchEmployees = async () => {
    setLoading(true);
    try { setEmployees(await listEmployees(sessionToken)); } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchEmployees(); }, []);

  const openCreateDialog = () => {
    setEditingEmployee(null);
    setFormData({ username: '', password: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (emp: AppUser) => {
    setEditingEmployee(emp);
    setFormData({ username: emp.username, password: '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.username) { toast.error('يرجى إدخال اسم المستخدم'); return; }
    if (!editingEmployee && !formData.password) { toast.error('يرجى إدخال كلمة المرور'); return; }
    setSaving(true);
    try {
      if (editingEmployee) {
        await updateEmployee(sessionToken, {
          user_id: editingEmployee.id, username: formData.username,
          password: formData.password || undefined,
        });
        toast.success('تم تحديث الموظف');
      } else {
        await createEmployee(sessionToken, {
          username: formData.username, password: formData.password,
        });
        toast.success('تم إنشاء الموظف');
      }
      setDialogOpen(false);
      fetchEmployees();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDeleteClick = async (emp: AppUser) => {
    setDeleteTarget(emp);
    setDeleteLoading(true);
    setTransferTarget('parent');
    try {
      const result = await checkEmployeeQuotes(sessionToken, emp.id);
      setDeleteQuoteCount(result.count);
      if (result.count > 0) {
        setShowDeleteOptions(true);
      } else {
        setShowDeleteOptions(false);
      }
    } catch {
      setDeleteQuoteCount(0);
      setShowDeleteOptions(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  const confirmDelete = async (transferTo?: string) => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteEmployee(sessionToken, deleteTarget.id, transferTo);
      toast.success('تم حذف الموظف');
      fetchEmployees();
    } catch (err: any) { toast.error(err.message); }
    finally {
      setDeleteTarget(null);
      setShowDeleteOptions(false);
      setDeleteLoading(false);
    }
  };

  const handleToggleActive = async (emp: AppUser) => {
    try {
      await updateEmployee(sessionToken, { user_id: emp.id, is_active: !emp.is_active });
      toast.success(emp.is_active ? 'تم تعطيل الموظف' : 'تم تفعيل الموظف');
      fetchEmployees();
    } catch (err: any) { toast.error(err.message); }
  };

  const openTabDialog = async (emp: AppUser) => {
    setTabUserId(emp.id);
    setTabUserName(emp.username);
    setTabLoading(true);
    setTabDialogOpen(true);
    try {
      const perms = await getEmployeeTabPermissions(sessionToken, emp.id);
      const parentEnabledTabs = parentTabPermissions.length > 0
        ? Object.keys(TAB_LABELS).filter(tab => {
            const parentPerm = parentTabPermissions.find(p => p.tab_key === tab);
            return !parentPerm || parentPerm.is_enabled;
          })
        : Object.keys(TAB_LABELS);
      const visibilityKeys = Object.keys(VISIBILITY_LABELS).filter(key => {
        const parentPerm = parentTabPermissions.find(p => p.tab_key === key);
        return !parentPerm || parentPerm.is_enabled;
      });
      const allKeys = [...parentEnabledTabs, ...visibilityKeys];
      const permMap = new Map(perms.map(p => [p.tab_key, p.is_enabled]));
      setTabPerms(allKeys.map(key => ({ tab_key: key, is_enabled: permMap.get(key) ?? true })));
    } catch (err: any) { toast.error(err.message); }
    finally { setTabLoading(false); }
  };

  const handleSaveTabPerms = async () => {
    setTabLoading(true);
    try {
      await updateEmployeeTabPermissions(sessionToken, tabUserId, tabPerms);
      toast.success('تم تحديث صلاحيات الموظف');
      setTabDialogOpen(false);
    } catch (err: any) { toast.error(err.message); }
    finally { setTabLoading(false); }
  };

  const otherEmployees = employees.filter(e => e.id !== deleteTarget?.id);

  return (
    <div dir="rtl" className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" /> إدارة الموظفين
            <Badge variant="outline" className="mr-2">{employees.length} / {maxEmployees}</Badge>
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchEmployees} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" onClick={openCreateDialog} className="gap-1" disabled={employees.length >= maxEmployees}>
              <UserPlus className="w-4 h-4" /> إضافة موظف
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : employees.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لم تقم بإضافة موظفين بعد</p>
          ) : (
            <TableScroller>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">اسم الموظف</TableHead>
                    <TableHead className="text-start">الحالة</TableHead>
                    <TableHead className="text-start">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map(emp => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.username}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={emp.is_active} onCheckedChange={() => handleToggleActive(emp)} />
                          <span className={emp.is_active ? 'text-green-600 dark:text-green-400' : 'text-destructive'}>
                            {emp.is_active ? 'مفعل' : 'معطل'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button variant="ghost" size="sm" className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0" onClick={() => openEditDialog(emp)} title="تعديل"><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0" onClick={() => openTabDialog(emp)} title="صلاحيات التبويبات"><Layers className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 text-destructive" onClick={() => handleDeleteClick(emp)} title="حذف"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroller>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Employee Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? 'تعديل موظف' : 'إضافة موظف جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>اسم المستخدم</Label>
              <Input value={formData.username} onChange={(e) => setFormData(p => ({ ...p, username: e.target.value }))} placeholder="اسم الموظف" />
            </div>
            <div className="space-y-2">
              <Label>{editingEmployee ? 'كلمة المرور الجديدة (اتركها فارغة للإبقاء)' : 'كلمة المرور'}</Label>
              <Input type="password" value={formData.password} onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))} placeholder="كلمة المرور" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingEmployee ? 'تحديث' : 'إنشاء'}
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
                <h4 className="text-xs font-bold text-muted-foreground mb-2 px-1">تبويبات النظام</h4>
                <div className="space-y-1 rounded-lg border border-border/50 p-2">
                  {tabPerms.filter(p => TAB_LABELS[p.tab_key]).map((perm) => {
                    const idx = tabPerms.findIndex(t => t.tab_key === perm.tab_key);
                    return (
                      <div key={perm.tab_key} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                        <Label className="text-sm">{TAB_LABELS[perm.tab_key]}</Label>
                        <Switch checked={perm.is_enabled} onCheckedChange={(v) => setTabPerms(prev => prev.map((p, i) => i === idx ? { ...p, is_enabled: v } : p))} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {tabPerms.some(p => VISIBILITY_LABELS[p.tab_key]) && (
                <div>
                  <h4 className="text-xs font-bold text-primary mb-2 px-1">إظهار العناصر داخل التكاليف المحفوظة</h4>
                  <p className="text-[11px] text-muted-foreground mb-2 px-1">يتحكم في ظهور الأزرار والأدوات في الواجهة فقط (لا يؤثر على صلاحيات التنفيذ).</p>
                  <div className="space-y-1 rounded-lg border border-primary/20 bg-primary/5 p-2">
                    {tabPerms.filter(p => VISIBILITY_LABELS[p.tab_key]).map((perm) => {
                      const idx = tabPerms.findIndex(t => t.tab_key === perm.tab_key);
                      return (
                        <div key={perm.tab_key} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                          <Label className="text-sm">{VISIBILITY_LABELS[perm.tab_key]}</Label>
                          <Switch checked={perm.is_enabled} onCheckedChange={(v) => setTabPerms(prev => prev.map((p, i) => i === idx ? { ...p, is_enabled: v } : p))} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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

      {/* Delete Employee Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setShowDeleteOptions(false); } }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              تأكيد حذف الموظف
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>هل تريد حذف الموظف "{deleteTarget?.username}"؟ لا يمكن التراجع عن هذا الإجراء.</p>
                
                {deleteLoading && (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!deleteLoading && deleteQuoteCount > 0 && (
                  <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 space-y-3">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <FileText className="w-4 h-4" />
                      <span className="font-semibold text-sm">
                        هذا الموظف لديه {deleteQuoteCount} عرض سعر محفوظ
                      </span>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">ماذا تريد أن تفعل بالعروض؟</Label>
                      <Select value={transferTarget} onValueChange={setTransferTarget}>
                        <SelectTrigger className="h-9">
                          <ArrowRightLeft className="w-3.5 h-3.5 ml-1.5" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="parent">ترحيل للحساب الأساسي</SelectItem>
                          {otherEmployees.map(emp => (
                            <SelectItem key={emp.id} value={emp.id}>ترحيل إلى: {emp.username}</SelectItem>
                          ))}
                          <SelectItem value="none">حذف بدون ترحيل</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:flex-row-reverse">
            {!deleteLoading && (
              <AlertDialogAction
                onClick={() => {
                  if (deleteQuoteCount > 0 && transferTarget !== 'none') {
                    const targetId = transferTarget === 'parent' ? userId : transferTarget;
                    confirmDelete(targetId);
                  } else {
                    confirmDelete();
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteQuoteCount > 0 && transferTarget !== 'none' ? 'ترحيل وحذف' : 'حذف'}
              </AlertDialogAction>
            )}
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EmployeeManagement;
