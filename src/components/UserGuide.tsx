import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { BookOpen, Layers, Settings, Calculator, Sparkles, Archive, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const steps = [
  {
    icon: <Layers className="w-5 h-5 text-primary" />,
    title: 'قاعدة بيانات الورق',
    badge: 'الخطوة 1 — الإعداد الأساسي',
    description: 'الخطوة الأولى والأهم — أضف أنواع الورق المتوفرة لديك.',
    details: [
      'أضف كل نوع ورق باسمه ومقاسه وجراميته وسعر الرزمة وشد الرزمة أو سعر الطن.',
      'هذه البيانات هي الأساس الذي تعتمد عليه لحساب تكلفة الورق تلقائياً.',
      'يمكنك تعديل أو حذف أي نوع ورق في أي وقت.',
      'كلما كانت بياناتك دقيقة، كانت نتائج التسعير أدق.',
    ],
    tip: 'ابدأ بإضافة الأنواع الأكثر استخداماً أولاً (كوشيه، انفر برش، بريستول...)',
  },
  {
    icon: <Settings className="w-5 h-5 text-primary" />,
    title: 'إعدادات الأسعار',
    badge: 'الخطوة 2 — ضبط الأسعار',
    description: 'حدد أسعار الطباعة الأساسية التي تعتمد عليها لحساب التكاليف.',
    details: [
      'سعر الفرز: تكلفة إعداد كل لون طباعة (عادة 4 ألوان = 4 زنكات).',
      'سعر الطبعة: تكلفة طباعة كل ورقة على الماكينة.',
      'سعر السلفان: تكلفة تغليف كل ورقة بالسلفان.',
      'أسعار الفرز والتكسير: حسب طبيعة العمل.',
    ],
    tip: 'راجع هذه الأسعار دورياً لتواكب تغيرات السوق.',
  },
  {
    icon: <Sparkles className="w-5 h-5 text-primary" />,
    title: 'خدمات التشطيب',
    badge: 'الخطوة 3 — خدمات إضافية',
    description: 'أضف جميع خدمات ما بعد الطباعة.',
    details: [
      'أضف خدمات مثل: سلفان، يو في، بصمة، تقفيل...',
      'حدد طريقة حساب كل خدمة: لكل قطعة، لكل ألف، أو مبلغ ثابت.',
      'عند استخدام الحاسبة، فعّل الخدمات المطلوبة وستُحسب تلقائياً.',
      'يمكنك إضافة خدمات مخصصة حسب طبيعة مطبعتك.',
    ],
    tip: 'الخدمات المُضافة هنا ستظهر كخيارات للاضافة او الحذف.',
  },
  {
    icon: <Calculator className="w-5 h-5 text-primary" />,
    title: 'حساب التكلفة',
    badge: 'الخطوة 4 — الاستخدام',
    description: 'احسب تكلفة أي طلب طباعة بدقة.',
    details: [
      'اضف الكمية المطلوبة.',
      'حدد عدد الوان الطباعة.',
      'اضف تفصيل الشيت على مقاس ورق الطباعة.',
      'حدد نوع الورق.',
      'ويمكنك اضافة خيار عدد الأوجه المطبوعة وأوجه السلفان والتكسير.',
      'فعّل التشطيبات المطلوبة من القائمة.',
      'النظام يحسب: تكلفة الورق + الطباعة + السلفان + التشطيبات + الهدر.',
      'تظهر النتيجة النهائية مع سعر القطعة والاجمالي وهوامش الربح.',
    ],
    tip: 'عدد القطع في الشيت يُحسب تلقائياً، حسب مقاس الطبع.',
  },
  {
    icon: <Archive className="w-5 h-5 text-primary" />,
    title: 'التكاليف المحفوظة',
    badge: 'أرشيف التكاليف',
    description: 'أرشيف جميع التكاليف السابقة.',
    details: [
      'استعرض جميع التكاليف المحفوظة مع إمكانية البحث والتصفية.',
      'تستطيع البحث حسب المواصفات.',
    ],
    tip: 'يمكنك تعديل التكاليف المحفوظة في أي وقت.',
  },
];

const UserGuide = () => {
  return (
    <div dir="rtl" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            دليل استخدام البرنامج
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            تعرّف على كيفية إعداد البرنامج واستخدامه خطوة بخطوة. اتبع الترتيب أدناه للحصول على أفضل النتائج.
          </p>
        </CardHeader>
        <CardContent>
          {/* Workflow diagram */}
          <div className="flex items-center justify-center gap-2 flex-wrap mb-8 p-4 rounded-lg bg-muted/50 border">
            <Badge variant="default" className="text-sm py-1 px-3">قاعدة بيانات الورق</Badge>
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            <Badge variant="default" className="text-sm py-1 px-3">إعدادات الأسعار</Badge>
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            <Badge variant="default" className="text-sm py-1 px-3">خدمات التشطيب</Badge>
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            <Badge variant="secondary" className="text-sm py-1 px-3">حساب التكلفة</Badge>
          </div>

          <Accordion type="multiple" className="w-full">
            {steps.map((step, i) => (
              <AccordionItem key={i} value={`step-${i}`}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 text-right">
                    {step.icon}
                    <div>
                      <span className="font-semibold">{step.title}</span>
                      <Badge variant="outline" className="mr-2 text-xs">{step.badge}</Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pr-8 space-y-3">
                    <p className="text-sm text-foreground">{step.description}</p>
                    <ul className="space-y-1.5">
                      {step.details.map((d, j) => (
                        <li key={j} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          {d}
                        </li>
                      ))}
                    </ul>
                    {step.tip && (
                      <div className="rounded-lg bg-accent/10 border border-accent/20 p-3 text-sm mt-2">
                        <span className="font-semibold">💡 نصيحة: </span>
                        <span className="text-muted-foreground">{step.tip}</span>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserGuide;
