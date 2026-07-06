import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Shield, UserPlus, Edit, Layers, Monitor, Clock, Users, ToggleLeft, ArrowLeft, ArrowRight, X, CheckCircle2, History } from 'lucide-react';

interface TourStep {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  points: string[];
  tip?: string;
}

const ADMIN_TOUR_STEPS: TourStep[] = [
  {
    icon: <Shield className="w-7 h-7" />,
    title: '① لوحة إدارة المستخدمين',
    subtitle: 'مرحبًا بك في مركز التحكم — هنا تدير جميع حسابات النظام',
    points: [
      'استعرض جميع المستخدمين المسجّلين في النظام مع حالة كل حساب',
      'تحكّم كامل في الإنشاء والتعديل والحذف والصلاحيات',
      'كل مستخدم له بياناته المستقلة (الورق، الإعدادات، التكاليف المحفوظة)',
    ],
    tip: 'يمكنك الوصول لهذه اللوحة في أي وقت من تبويبة "المستخدمين"',
  },
  {
    icon: <UserPlus className="w-7 h-7" />,
    title: '② إضافة مستخدم جديد',
    subtitle: 'أنشئ حسابات جديدة بنقرة واحدة',
    points: [
      'اضغط زر "إضافة مستخدم" أعلى اللوحة',
      'حدّد اسم المستخدم وكلمة المرور',
      'فعّل خيار "مدير" لمنح صلاحيات كاملة (اختياري)',
      'حدّد عدد الأجهزة المسموح اتصالها بنفس الحساب',
      'حدّد عدد الموظفين المسموح للحساب إنشاؤهم (0 = لا يمكنه إضافة موظفين)',
      'يمكنك تحديد مدة صلاحية بالساعات أو تركها دائمة',
    ],
    tip: 'حسابات الموظفين تُنشأ من قِبَل المستخدم نفسه، أنت تحدد الحد الأقصى فقط',
  },
  {
    icon: <ToggleLeft className="w-7 h-7" />,
    title: '③ تفعيل وتعطيل الحسابات',
    subtitle: 'تحكّم سريع في الوصول دون حذف الحساب',
    points: [
      'استخدم مفتاح "الحالة" بجانب كل مستخدم لتفعيل/تعطيل حسابه فورًا',
      'الحساب المعطّل لا يستطيع الدخول لكن بياناته تبقى محفوظة',
      'يظهر تاريخ انتهاء الصلاحية بشكل واضح، ويمكن إزالته بضغطة زر',
    ],
    tip: 'مفيد عند توقّف الاشتراك مؤقتًا أو في حالات الإجازة',
  },
  {
    icon: <Edit className="w-7 h-7" />,
    title: '④ تعديل بيانات المستخدم',
    subtitle: 'حدّث أي معلومة بسهولة',
    points: [
      'اضغط أيقونة القلم بجانب المستخدم لفتح نافذة التعديل',
      'يمكنك تغيير اسم المستخدم أو كلمة المرور',
      'عدّل عدد الأجهزة أو عدد الموظفين المسموح بهم',
      'اترك حقل كلمة المرور فارغًا للاحتفاظ بالقديمة',
    ],
  },
  {
    icon: <Layers className="w-7 h-7" />,
    title: '⑤ صلاحيات التبويبات والإظهار',
    subtitle: 'الميزة الأقوى — تحكّم دقيق في ما يراه كل مستخدم',
    points: [
      'اضغط أيقونة الطبقات لفتح نافذة الصلاحيات',
      '🟢 تبويبات النظام: تفعيل/تعطيل ظهور كل تبويب (المحرك الذكي، حساب التكلفة، إلخ)',
      '🔵 إظهار العناصر داخل التكاليف المحفوظة: تحكّم في ظهور الأزرار (رؤية الموظفين، ترحيل، استيراد، تصدير، إجراءات الصف)',
      'الإخفاء يحجب العنصر من الواجهة بالكامل دون التأثير على المنطق الداخلي',
      'الموظفون يرثون تلقائيًا من قيود مديرهم — لا يمكنهم رؤية ما هو مخفي عن الحساب الأم',
    ],
    tip: 'استخدم هذه الميزة لتبسيط الواجهة وعرض الأدوات المناسبة لكل دور فقط',
  },
  {
    icon: <Monitor className="w-7 h-7" />,
    title: '⑥ إدارة الأجهزة النشطة',
    subtitle: 'راقب وأنهِ الجلسات عن بُعد',
    points: [
      'اضغط أيقونة الشاشة لاستعراض جميع الأجهزة المتصلة بالحساب',
      'شاهد معلومات كل جهاز: نوعه، آخر نشاط، عنوان IP',
      'أنهِ أي جلسة فورًا بزر "إنهاء" — يخرج المستخدم تلقائيًا من ذلك الجهاز',
    ],
    tip: 'مفيد عند فقدان جهاز أو شك في وصول غير مصرّح به',
  },
  {
    icon: <Clock className="w-7 h-7" />,
    title: '⑦ صلاحية الحساب (اختياري)',
    subtitle: 'أنشئ حسابات مؤقتة بسهولة',
    points: [
      'حدّد مدة بالساعات عند الإنشاء أو التعديل',
      'النظام يعرض الوقت المتبقي على شكل شارة بجانب المستخدم',
      'بعد انتهاء المدة، لن يستطيع المستخدم الدخول',
      'يمكنك إزالة تاريخ الانتهاء بضغطة (✕) لجعل الحساب دائمًا',
    ],
  },
  {
    icon: <History className="w-7 h-7" />,
    title: '⑧ سجل الدخول',
    subtitle: 'تتبّع جميع عمليات الدخول للنظام',
    points: [
      'انتقل إلى تبويبة "السجل" لاستعراض جميع تسجيلات الدخول',
      'تظهر تفاصيل كل عملية: المستخدم، الوقت، عنوان IP',
      'ساعدك في مراقبة أي نشاط مشبوه أو غير معتاد',
    ],
    tip: 'راجع السجل دوريًا لرصد أي محاولات دخول غريبة',
  },
];

interface AdminPanelTourProps {
  open: boolean;
  onClose: () => void;
}

const AdminPanelTour = ({ open, onClose }: AdminPanelTourProps) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  if (!open) return null;

  const current = ADMIN_TOUR_STEPS[step];
  const isLast = step === ADMIN_TOUR_STEPS.length - 1;
  const isFirst = step === 0;
  const progress = ((step + 1) / ADMIN_TOUR_STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              {current.icon}
            </div>
            <div className="space-y-0.5 min-w-0">
              <DialogTitle className="text-lg leading-tight">{current.title}</DialogTitle>
              <p className="text-sm text-muted-foreground leading-tight">{current.subtitle}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="py-3 space-y-4">
          <ul className="space-y-2.5">
            {current.points.map((point, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>{point}</span>
              </li>
            ))}
          </ul>

          {current.tip && (
            <div className="rounded-lg bg-accent/10 border border-accent/20 p-3 text-sm">
              <span className="font-semibold text-accent">💡 نصيحة: </span>
              <span className="text-muted-foreground">{current.tip}</span>
            </div>
          )}

          <div className="space-y-1.5 pt-2">
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {step + 1} من {ADMIN_TOUR_STEPS.length}
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-1">
            <X className="w-4 h-4" /> تخطي
          </Button>
          <div className="flex gap-2">
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)} className="gap-1">
                <ArrowRight className="w-4 h-4" /> السابق
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={onClose} className="gap-1">
                ✓ إنهاء الجولة
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep(s => s + 1)} className="gap-1">
                التالي <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPanelTour;
