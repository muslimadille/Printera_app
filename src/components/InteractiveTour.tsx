import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Layers, Settings, Sparkles, Calculator, BookOpen, PenTool, FileText, ArrowLeft, ArrowRight, X, Box, Archive, FileSpreadsheet, UserPen, CheckCircle2 } from 'lucide-react';

interface TourStep {
  tabValue: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  points: string[];
  tip?: string;
}

const tourSteps: TourStep[] = [
  {
    tabValue: 'papertypes',
    icon: <Layers className="w-7 h-7" />,
    title: '① قاعدة بيانات الورق',
    subtitle: 'الخطوة الأولى والأهم — أضف أنواع الورق المتوفرة لديك',
    points: [
      'أضف كل نوع ورق باسمه ومقاسه وجراميته وسعر الرزمة وشد الرزمة أو سعر الطن',
      'هذه البيانات هي الأساس الذي تعتمد عليه لحساب تكلفة الورق تلقائياً',
      'يمكنك تعديل أو حذف أي نوع ورق في أي وقت',
      'كلما كانت بياناتك دقيقة، كانت نتائج التسعير أدق',
    ],
    tip: 'ابدأ بإضافة الأنواع الأكثر استخداماً أولاً (كوشيه، انفر برش، بريستول...)',
  },
  {
    tabValue: 'settings',
    icon: <Settings className="w-7 h-7" />,
    title: '② إعدادات الأسعار',
    subtitle: 'حدد أسعار الطباعة الأساسية التي تعتمد عليها لحساب التكاليف',
    points: [
      'سعر الفرز: تكلفة إعداد كل لون طباعة (عادة 4 ألوان = 4 زنكات)',
      'سعر الطبعة: تكلفة طباعة كل ورقة على الماكينة',
      'سعر السلفان: تكلفة تغليف كل ورقة بالسلفان',
      'أسعار الفرز والتكسير: حسب طبيعة العمل',
    ],
    tip: 'راجع هذه الأسعار دورياً لتواكب تغيرات السوق',
  },
  {
    tabValue: 'finishing',
    icon: <Sparkles className="w-7 h-7" />,
    title: '③ خدمات التشطيب',
    subtitle: 'أضف جميع خدمات ما بعد الطباعة',
    points: [
      'أضف خدمات مثل: سلفان، يو في، بصمة، تقفيل...',
      'حدد طريقة حساب كل خدمة: لكل قطعة، لكل ألف، أو مبلغ ثابت',
      'عند استخدام الحاسبة، فعّل الخدمات المطلوبة وستُحسب تلقائياً',
      'يمكنك إضافة خدمات مخصصة حسب طبيعة مطبعتك',
    ],
    tip: 'الخدمات المُضافة هنا ستظهر كخيارات للاضافة او الحذف',
  },
  {
    tabValue: 'calculator',
    icon: <Calculator className="w-7 h-7" />,
    title: '④ حساب التكلفة',
    subtitle: 'احسب تكلفة أي طلب طباعة بدقة',
    points: [
      'اضف الكمية المطلوبة',
      'حدد عدد الوان الطباعة',
      'اضف تفصيل الشيت على مقاس ورق الطباعة',
      'حدد نوع الورق',
      'ويمكنك اضافة خيار عدد الأوجه المطبوعة وأوجه السلفان والتكسير',
      'فعّل التشطيبات المطلوبة من القائمة',
      'النظام يحسب: تكلفة الورق + الطباعة + السلفان + التشطيبات + الهدر',
      'تظهر النتيجة النهائية مع سعر القطعة والاجمالي وهوامش الربح',
    ],
    tip: 'عدد القطع في الشيت يُحسب تلقائياً، حسب مقاس الطبع',
  },
  {
    tabValue: 'savedquotes',
    icon: <Archive className="w-7 h-7" />,
    title: '⑤ التكاليف المحفوظة',
    subtitle: 'أرشيف جميع التكاليف السابقة',
    points: [
      'استعرض جميع التكاليف المحفوظة مع إمكانية البحث والتصفية',
      'تستطيع البحث حسب المواصفات',
    ],
    tip: 'يمكنك تعديل التكاليف المحفوظة في أي وقت',
  },
];

interface InteractiveTourProps {
  open: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
}

const InteractiveTour = ({ open, onClose, onNavigateTab }: InteractiveTourProps) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  useEffect(() => {
    if (open && tourSteps[step]) {
      onNavigateTab(tourSteps[step].tabValue);
    }
  }, [step, open]);

  if (!open) return null;

  const current = tourSteps[step];
  const isLast = step === tourSteps.length - 1;
  const isFirst = step === 0;
  const progress = ((step + 1) / tourSteps.length) * 100;

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
          {/* Points */}
          <ul className="space-y-2.5">
            {current.points.map((point, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>{point}</span>
              </li>
            ))}
          </ul>

          {/* Tip */}
          {current.tip && (
            <div className="rounded-lg bg-accent/10 border border-accent/20 p-3 text-sm">
              <span className="font-semibold text-accent">💡 نصيحة: </span>
              <span className="text-muted-foreground">{current.tip}</span>
            </div>
          )}

          {/* Progress bar */}
          <div className="space-y-1.5 pt-2">
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {step + 1} من {tourSteps.length}
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

export default InteractiveTour;