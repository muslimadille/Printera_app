import { useState, useEffect } from 'react';

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

export interface HeroBannerData {
  title: string;
  subtitle: string;
  ctaText: string;
  bannerImage: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  desc: string;
  priceMonthly: number | string;
  priceYearly: number | string;
  badge?: string;
  cta: string;
  featured: boolean;
  features: string[];
}

export interface PricingContentData {
  heroTag: string;
  heroTitle: string;
  heroSubtitle: string;
  guaranteeTitle: string;
  guaranteeSubtitle: string;
  badge1: string;
  badge2: string;
  faqTitle: string;
  pricingFaqs: FAQItem[];
}

export interface StepItem {
  numberOrIcon: string;
  text: string;
  iconClass?: string;
}

export interface StepsSectionData {
  show: boolean;
  title: string;
  step1: StepItem;
  step2: StepItem;
  step3: StepItem;
}

const DEFAULT_BANNER: HeroBannerData = {
  title: 'حاسبة تسعير وقوالب التغليف والطباعة الأولى',
  subtitle: 'احسب التكاليف، اضبط الأبعاد بدقة، وصدّر ملفات القوالب الجاهزة للقص والطباعة في ثوانٍ.',
  ctaText: 'استكشف القوالب مجاناً',
  bannerImage: '/templates/preview/A10_20_02_02.svg',
};

const DEFAULT_FAQS: FAQItem[] = [
  {
    id: 'faq-1',
    question: 'كيف يمكنني تصدير ملفات القص والدايكات؟',
    answer: 'يمكنك فتح أي قالب وتحديد الأبعاد المطلوبة، ثم الضغط على زر "تصدير للإنتاج" لتنزيل ملفات DXF أو SVG أو PDF جاهزة لآلات القص.',
    category: 'الإنتاج والقص',
  },
  {
    id: 'faq-2',
    question: 'هل يمكنني إضافة أبعاد خاصة بشركتي أو عميلي؟',
    answer: 'نعم، المحرك المعلمي (Parametric Engine) يتيح لك تعديل الطول والعرض والارتفاع وسماكة الخامة، ويتم حساب الرسم والهيكل الهندسي تلقائياً.',
    category: 'التصميم والهيكلة',
  },
  {
    id: 'faq-3',
    question: 'ما هي طرق الاشتراك المتاحة؟',
    answer: 'نوفر خطط تجريبية مجانية، بالإضافة إلى باقات احترافية للمطابع والمصممين تشمل جميع القوالب وتصدير ملفات الإنتاج غير المحدودة.',
    category: 'الاشتراكات والأسعار',
  },
];

const DEFAULT_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan-free',
    name: 'المجانية التجريبية',
    desc: 'للتجربة واستكشاف النظام وأبعاد القوالب الأساسية بدون تكلفة',
    priceMonthly: 'مجانًا',
    priceYearly: 'مجانًا',
    badge: 'مجاناً',
    cta: 'ابدأ التجربة الآن',
    featured: false,
    features: ['معاينة القوالب 2D و3D', 'حساب الأبعاد الهندسية الأساسية', 'تصدير عينة مجانية'],
  },
  {
    id: 'plan-pro',
    name: 'الباقة الاحترافية PRO',
    desc: 'للمصممين والمطابع التي تحتاج جميع القوالب مع ملفات القص الجاهزة',
    priceMonthly: 149,
    priceYearly: 119,
    badge: 'الأكثر شعبية',
    cta: 'اشترك الآن في PRO',
    featured: true,
    features: ['جميع القوالب والموديلات', 'تصدير دقيق للقص (DXF/SVG/PDF)', 'توزيع الشيت التلقائي (Nesting)', 'دعم فني مباشر'],
  },
  {
    id: 'plan-business',
    name: 'باقة الشركات والمطابع',
    desc: 'للمصانع والمؤسسات الكبيرة التي تتطلب موظفين وأجهزة متعددة',
    priceMonthly: 399,
    priceYearly: 319,
    badge: 'للمؤسسات',
    cta: 'تواصل مع المبيعات',
    featured: false,
    features: ['كل مميزات PRO', 'عدد لا محدود من الموظفين والأجهزة', 'دعم الأنماط الهندسية الخاصة', 'ربط API وإدارة متقدمة'],
  },
];

const DEFAULT_PRICING_CONTENT: PricingContentData = {
  heroTag: 'بدون التزام سنوي',
  heroTitle: 'خطط تناسب حجم إنتاجك',
  heroSubtitle: 'من التجربة الفردية إلى خطوط الإنتاج الكاملة — اختر الخطة المناسبة وابدأ التصدير فورًا.',
  guaranteeTitle: 'كل الخطط تشمل ملفات قص جاهزة للإنتاج',
  guaranteeSubtitle: 'SVG وDXF وPDF بدقة هندسية كاملة، متوافقة مع ماكينات الكتر والليزر المعتادة في مصانع الكرتون.',
  badge1: 'ضمان استرجاع 14 يومًا',
  badge2: 'إلغاء في أي وقت',
  faqTitle: 'أسئلة حول الأسعار',
  pricingFaqs: [
    { id: 'p-faq-1', question: 'هل يمكن تغيير الخطة لاحقًا؟', answer: 'نعم، يمكنك الترقية أو التخفيض في أي وقت وسيُحتسب الفرق تلقائيًا في الفاتورة التالية.' },
    { id: 'p-faq-2', question: 'هل هناك حد لعدد القوالب المصدّرة؟', answer: 'خطة الأعمال والمصنع بدون حد. خطة البداية محدودة بعدد تصديرات شهرية معلن عنها في المقارنة.' },
    { id: 'p-faq-3', question: 'هل تدعمون الفوترة الضريبية؟', answer: 'نعم، تصدر كل الفواتير بشكل تلقائي وتشمل الرقم الضريبي عند إضافته لبيانات الحساب.' },
    { id: 'p-faq-4', question: 'ماذا يحدث بعد انتهاء الاشتراك؟', answer: 'تبقى قوالبك المحفوظة متاحة للعرض، ويُعاد تفعيل التصدير فور تجديد الاشتراك.' },
  ],
};

const DEFAULT_STEPS_SECTION: StepsSectionData = {
  show: true,
  title: 'فقط 3 خطوات',
  step1: { numberOrIcon: '1', text: 'أختر شكل القالب', iconClass: 'ph ph-number-one' },
  step2: { numberOrIcon: '2', text: 'أدخل الأبعاد', iconClass: 'ph ph-number-two' },
  step3: { numberOrIcon: '3', text: 'أرفع الملف', iconClass: 'ph ph-number-three' },
};

const KEYS = {
  banner: 'printCalc_heroBanner',
  faqs: 'printCalc_faqs',
  plans: 'printCalc_subscriptionPlans',
  pricing: 'printCalc_pricingPageContent',
  steps: 'printCalc_stepsSection',
};

const EVENT_NAME = 'appContentUpdated';

export function useAppContent() {
  const [banner, setBanner] = useState<HeroBannerData>(() => {
    try {
      const raw = localStorage.getItem(KEYS.banner);
      return raw ? JSON.parse(raw) : DEFAULT_BANNER;
    } catch {
      return DEFAULT_BANNER;
    }
  });

  const [faqs, setFaqs] = useState<FAQItem[]>(() => {
    try {
      const raw = localStorage.getItem(KEYS.faqs);
      return raw ? JSON.parse(raw) : DEFAULT_FAQS;
    } catch {
      return DEFAULT_FAQS;
    }
  });

  const [plans, setPlans] = useState<SubscriptionPlan[]>(() => {
    try {
      const raw = localStorage.getItem(KEYS.plans);
      return raw ? JSON.parse(raw) : DEFAULT_PLANS;
    } catch {
      return DEFAULT_PLANS;
    }
  });

  const [pricingContent, setPricingContent] = useState<PricingContentData>(() => {
    try {
      const raw = localStorage.getItem(KEYS.pricing);
      return raw ? JSON.parse(raw) : DEFAULT_PRICING_CONTENT;
    } catch {
      return DEFAULT_PRICING_CONTENT;
    }
  });

  const [stepsSection, setStepsSection] = useState<StepsSectionData>(() => {
    try {
      const raw = localStorage.getItem(KEYS.steps);
      return raw ? JSON.parse(raw) : DEFAULT_STEPS_SECTION;
    } catch {
      return DEFAULT_STEPS_SECTION;
    }
  });

  const reloadData = () => {
    try {
      const rawB = localStorage.getItem(KEYS.banner);
      if (rawB) setBanner(JSON.parse(rawB));
      const rawF = localStorage.getItem(KEYS.faqs);
      if (rawF) setFaqs(JSON.parse(rawF));
      const rawP = localStorage.getItem(KEYS.plans);
      if (rawP) setPlans(JSON.parse(rawP));
      const rawPr = localStorage.getItem(KEYS.pricing);
      if (rawPr) setPricingContent(JSON.parse(rawPr));
      const rawS = localStorage.getItem(KEYS.steps);
      if (rawS) setStepsSection(JSON.parse(rawS));
    } catch {}
  };

  useEffect(() => {
    window.addEventListener(EVENT_NAME, reloadData);
    window.addEventListener('storage', reloadData);
    return () => {
      window.removeEventListener(EVENT_NAME, reloadData);
      window.removeEventListener('storage', reloadData);
    };
  }, []);

  const notifyChange = () => {
    window.dispatchEvent(new Event(EVENT_NAME));
  };

  const updateBanner = (newBanner: HeroBannerData) => {
    setBanner(newBanner);
    localStorage.setItem(KEYS.banner, JSON.stringify(newBanner));
    notifyChange();
  };

  const updateFaqs = (newFaqs: FAQItem[]) => {
    setFaqs(newFaqs);
    localStorage.setItem(KEYS.faqs, JSON.stringify(newFaqs));
    notifyChange();
  };

  const updatePlans = (newPlans: SubscriptionPlan[]) => {
    setPlans(newPlans);
    localStorage.setItem(KEYS.plans, JSON.stringify(newPlans));
    notifyChange();
  };

  const updatePricingContent = (newContent: PricingContentData) => {
    setPricingContent(newContent);
    localStorage.setItem(KEYS.pricing, JSON.stringify(newContent));
    notifyChange();
  };

  const updateStepsSection = (newSteps: StepsSectionData) => {
    setStepsSection(newSteps);
    localStorage.setItem(KEYS.steps, JSON.stringify(newSteps));
    notifyChange();
  };

  return {
    banner,
    faqs,
    plans,
    pricingContent,
    stepsSection,
    updateBanner,
    updateFaqs,
    updatePlans,
    updatePricingContent,
    updateStepsSection,
  };
}
