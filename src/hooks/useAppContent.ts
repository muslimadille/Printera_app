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

export interface DiscountCode {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  targetPlanId: string;
  maxUses?: number | null;
  usedCount: number;
  expiresAt?: string | null;
  isActive: boolean;
  createdAt: string;
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

export interface LegalSection {
  id: string;
  title: string;
  content: string;
}

export interface LegalDocumentData {
  title: string;
  subtitle: string;
  lastUpdated: string;
  sections: LegalSection[];
}

const DEFAULT_TERMS: LegalDocumentData = {
  title: 'الشروط والأحكام',
  subtitle: 'يرجى قراءة شروط واستخدام منصة برينتيرا بعناية قبل استخدام خدماتنا وتصدير القوالب',
  lastUpdated: '10 أغسطس 2026',
  sections: [
    {
      id: 'term-1',
      title: '1. قبول الشروط وتغييرها',
      content: 'باستخدامك لمنصة برينتيرا (Printera)، فإنك توافق التام على الالتزام بكافة الشروط والأحكام المدونة هنا. تحق للمنصة التعديل والتحديث في أي وقت وسيتم إشعار المستخدمين بذلك.',
    },
    {
      id: 'term-2',
      title: '2. تراخيص الاستخدام وتصدير القوالب',
      content: 'جميع القوالب الهندسية وملفات القص (DXF, SVG, PDF) المتاحة في المنصة مخصصة للاستخدام في أعمالك التجارية والطباعية الخاصة وحساباتك مع العملاء. يُحظر إعادة بيع الخدمة البرمجية كمنصة منافسة.',
    },
    {
      id: 'term-3',
      title: '3. دقة الأبعاد والمسؤولية الهندسيّة',
      content: 'توفر برينتيرا محرك قوالب بارامترية هندسي يحسب خطوط القص والتجهيز وسماكة الخامات بدقة عالية. يتوجب على المستخدم تجربة عينة قص (Prototype) قبل البدء في الإنتاج الكمي والمقاسات الضخمة.',
    },
    {
      id: 'term-4',
      title: '4. الاشتراكات والدفع والإنهاء',
      content: 'تُحتسب رسوم الاشتراكات بناءً على الباقة المختارة (شهرياً أو سنوياً). يمكن إلغاء الاشتراك في أي وقت، وستظل المميزات مفعّلة حتى نهاية فترة الفوترة الحالية.',
    },
    {
      id: 'term-5',
      title: '5. حقوق الملكية الفكرية',
      content: 'تظل الخوارزميات والبرمجيات والمحرك الهندسية ملكاً حصرياً لـ برينتيرا. بينما تعود الملكية الفكرية للتصاميم والشعارات التي يرفعها المستخدم له ولعملاؤه.',
    },
  ],
};

const DEFAULT_PRIVACY: LegalDocumentData = {
  title: 'سياسة الخصوصية',
  subtitle: 'نحن نلتزم بحماية بياناتك الشخصية وأبعاد تصاميمك بأعلى معايير الأمان والتشفير',
  lastUpdated: '10 أغسطس 2026',
  sections: [
    {
      id: 'priv-1',
      title: '1. جمع المعلومات والبيانات',
      content: 'نجمع المعلومات التي تزودنا بها عند إنشاء الحساب مثل الاسم والبريد الإلكتروني واسم الشركة، بالإضافة إلى أبعاد وقوالب التغليف التي تقوم بإعدادها أو حفظها على حسابك.',
    },
    {
      id: 'priv-2',
      title: '2. استخدام البيانات والتصاميم',
      content: 'نستخدم بياناتك لتوفير خدمات المنصة وتخصيص تجربة المستخدم وتحديث ملفات التصدير، ولا نقوم بنشر أو مبيعات أي تصاميم أو مقاسات خاصة بعملائك لأطراف خارجية.',
    },
    {
      id: 'priv-3',
      title: '3. حماية البيانات والتشفير',
      content: 'نطبق تدابير أمنية متقدمة وتشفير SSL لحماية بيانات حسابك وملفات الدايكات والقوالب ضد الوصول غير المصرح به أو الفقدان.',
    },
    {
      id: 'priv-4',
      title: '4. مشاركة البيانات مع أطراف ثالثة',
      content: 'لا نشارك أي معلومات شخصية مع أي جهة خارجية إلا في الحالات المحددة قانوناً أو لتشغيل الخدمات الأساسية (مثل معالجة الدفع السحابي المعتمد).',
    },
    {
      id: 'priv-5',
      title: '5. حقوق المستخدم والتحكم بالبيانات',
      content: 'يحق لك في أي وقت طلب استخراج ملفاتك وتصاميمك أو طلب حذف حسابك وبياناتك بالكامل من خوادم منصة برينتيرا بالتواصل مع الدعم الفني.',
    },
  ],
};

const DEFAULT_DISCOUNT_CODES: DiscountCode[] = [
  {
    id: 'disc-1',
    code: 'WELCOME20',
    discountType: 'percentage',
    discountValue: 20,
    targetPlanId: 'all',
    maxUses: 100,
    usedCount: 14,
    expiresAt: null,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'disc-2',
    code: 'PRO50',
    discountType: 'fixed',
    discountValue: 50,
    targetPlanId: 'plan-pro',
    maxUses: 50,
    usedCount: 8,
    expiresAt: null,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

const KEYS = {
  banner: 'printCalc_heroBanner',
  faqs: 'printCalc_faqs',
  plans: 'printCalc_subscriptionPlans',
  pricing: 'printCalc_pricingPageContent',
  steps: 'printCalc_stepsSection',
  terms: 'printCalc_termsContent',
  privacy: 'printCalc_privacyContent',
  discountCodes: 'printCalc_discountCodes',
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

  const [termsContent, setTermsContent] = useState<LegalDocumentData>(() => {
    try {
      const raw = localStorage.getItem(KEYS.terms);
      return raw ? JSON.parse(raw) : DEFAULT_TERMS;
    } catch {
      return DEFAULT_TERMS;
    }
  });

  const [privacyContent, setPrivacyContent] = useState<LegalDocumentData>(() => {
    try {
      const raw = localStorage.getItem(KEYS.privacy);
      return raw ? JSON.parse(raw) : DEFAULT_PRIVACY;
    } catch {
      return DEFAULT_PRIVACY;
    }
  });

  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>(() => {
    try {
      const raw = localStorage.getItem(KEYS.discountCodes);
      return raw ? JSON.parse(raw) : DEFAULT_DISCOUNT_CODES;
    } catch {
      return DEFAULT_DISCOUNT_CODES;
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
      const rawT = localStorage.getItem(KEYS.terms);
      if (rawT) setTermsContent(JSON.parse(rawT));
      const rawPv = localStorage.getItem(KEYS.privacy);
      if (rawPv) setPrivacyContent(JSON.parse(rawPv));
      const rawD = localStorage.getItem(KEYS.discountCodes);
      if (rawD) setDiscountCodes(JSON.parse(rawD));
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

  const updateTermsContent = (newTerms: LegalDocumentData) => {
    setTermsContent(newTerms);
    localStorage.setItem(KEYS.terms, JSON.stringify(newTerms));
    notifyChange();
  };

  const updatePrivacyContent = (newPrivacy: LegalDocumentData) => {
    setPrivacyContent(newPrivacy);
    localStorage.setItem(KEYS.privacy, JSON.stringify(newPrivacy));
    notifyChange();
  };

  const updateDiscountCodes = (newCodes: DiscountCode[]) => {
    setDiscountCodes(newCodes);
    localStorage.setItem(KEYS.discountCodes, JSON.stringify(newCodes));
    notifyChange();
  };

  return {
    banner,
    faqs,
    plans,
    pricingContent,
    stepsSection,
    termsContent,
    privacyContent,
    discountCodes,
    updateBanner,
    updateFaqs,
    updatePlans,
    updatePricingContent,
    updateStepsSection,
    updateTermsContent,
    updatePrivacyContent,
    updateDiscountCodes,
  };
}
