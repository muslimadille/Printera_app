import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TemplateCard, { Template } from '@/components/TemplateCard';

// Hook for scroll reveals
function useReveal() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, className: `reveal ${isVisible ? 'is-visible' : ''}` };
}

const ALL_TEMPLATES: Template[] = [
  {
    id: 'T00012', title: 'علبة بريدية بغطاء ملتف', category: 'retail', categoryLabel: 'تغليف تجزئة',
    desc: 'علبة بريدية مغلقة بالكامل مع غطاء ملتف، مناسبة للشحن المباشر للعميل.',
    tags: ['T00012', 'بريد'], pro: true, svg: 'public/templates/preview/A10_20_03_01.svg',
  },
  {
    id: 'T0002', title: 'علبة مستقيمة الإغلاق', category: 'folding', categoryLabel: 'طي وصواني',
    desc: 'التصميم الأساسي لعلب الطي الكرتونية، إغلاق علوي وسفلي بسيط بدون لصق.',
    tags: ['T0002', 'أساسية'], pro: false, svg: 'public/templates/preview/A10_10_03_03.svg',
  },
  {
    id: 'T0005', title: 'صندوق غطاء مفتوح بقفل', category: 'folding', categoryLabel: 'طي وصواني',
    desc: 'غطاء علوي مفتوح مع لسان قفل ولسان غبار جانبي لثبات إضافي.',
    tags: ['T0005', 'قفل'], pro: false, svg: 'public/templates/preview/A10_20_02_02.svg',
  },
  {
    id: 'T0006', title: 'علبة قفل مزدوج الجدار', category: 'lidbase', categoryLabel: 'غطاء وقاعدة',
    desc: 'جدار مزدوج للمتانة، غطاء وقاعدة منفصلان بنفس آلية القفل.',
    tags: ['T0006', 'جدار مزدوج'], pro: false, svg: 'public/templates/preview/A10_75_03_03.svg',
  },
  {
    id: 'D001-H', title: 'علبة كيك بمقبض حمل', category: 'retail', categoryLabel: 'تغليف تجزئة',
    desc: 'علبة كلاسيكية بمقبض حمل مدمج، مثالية للمخبوزات والهدايا الصغيرة.',
    tags: ['مقبض', 'كيك'], pro: true, svg: 'public/templates/preview/A10_10_02_02_11.svg',
  },
  {
    id: 'MED1', title: 'علبة دواء صغيرة', category: 'folding', categoryLabel: 'طي وصواني',
    desc: 'قالب دقيق للعلب الصغيرة، مضبوط لأبعاد الشرائط والأمبولات الدوائية.',
    tags: ['دواء', 'دقة عالية'], pro: false, svg: 'public/templates/preview/A20_01_02_00.svg',
  },
  {
    id: 'SELFLOCK', title: 'علبة ذاتية القفل', category: 'folding', categoryLabel: 'طي وصواني',
    desc: 'قفل من جهة واحدة بدون لاصق، تصميم شبيه بعلب البيتزا سريعة التركيب.',
    tags: ['بدون لصق', 'بيتزا'], pro: false, svg: 'public/templates/preview/A20_01_03_00.svg',
  },
  {
    id: 'LIDBASE', title: 'علبة غطاء وقاعدة منفصلة', category: 'lidbase', categoryLabel: 'غطاء وقاعدة',
    desc: 'قطعتان منفصلتان تمامًا، مظهر فاخر يناسب علب الهدايا والمنتجات المميزة.',
    tags: ['غطاء منفصل', 'هدايا'], pro: true, svg: 'public/templates/preview/A10_40_03_03.svg',
  },
  {
    id: 'TUBE1', title: 'علبة أسطوانية بغطاء علوي', category: 'tube', categoryLabel: 'علب أسطوانية',
    desc: 'هيكل أسطواني بغطاء علوي منفصل، مناسب للمنتجات الدائرية والعطور.',
    tags: ['أسطواني', 'غطاء علوي'], pro: false, svg: 'public/templates/preview/A10_80_02_02.svg',
  },
  {
    id: 'SLIDE1', title: 'علبة سحب درج', category: 'slide', categoryLabel: 'علب سحب',
    desc: 'درج داخلي ينزلق داخل غلاف خارجي، تجربة فتح فاخرة للمنتجات المميزة.',
    tags: ['درج', 'فخامة'], pro: true, svg: 'public/templates/preview/A11_11_03_03.svg',
  },
  {
    id: 'HEX1', title: 'علبة سداسية الشكل', category: 'nonrect', categoryLabel: 'أشكال غير مستطيلة',
    desc: 'هيكل سداسي غير تقليدي يبرز المنتج على الرف بشكل مختلف عن المعتاد.',
    tags: ['سداسي', 'غير قياسي'], pro: true, svg: 'public/templates/preview/A10_99_03_03.svg',
  },
  {
    id: 'HD1', title: 'صينية تعبئة ثقيلة', category: 'heavy', categoryLabel: 'تغليف ثقيل',
    desc: 'صينية مقواة بجدارين لتحمل الأوزان الثقيلة أثناء الشحن والتخزين.',
    tags: ['مضاعف', 'شحن'], pro: false, svg: 'public/templates/preview/A10_70_03_00.svg',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'الكل' },
  { id: 'folding', label: 'طي وصواني' },
  { id: 'tube', label: 'علب أسطوانية' },
  { id: 'heavy', label: 'تغليف ثقيل' },
  { id: 'lidbase', label: 'غطاء وقاعدة' },
  { id: 'retail', label: 'تغليف تجزئة' },
  { id: 'slide', label: 'علب سحب' },
  { id: 'nonrect', label: 'أشكال غير مستطيلة' },
];

const HERO_STATS = [
  { icon: 'ph ph-check-circle', label: 'دقة هندسية بكسل بكسل' },
  { icon: 'ph ph-scissors', label: 'جاهزة للطباعة والقص' },
  { icon: 'ph ph-users', label: 'موثوقة لدى المصممين' },
  { icon: 'ph ph-shield-check', label: 'هندسة موثقة' },
];

const STEPS = [
  { n: '01', title: 'اختر المقاس القياسي', desc: 'اختر من مكتبة القوالب البارامترية المطابقة لمعايير FEFCO.' },
  { n: '02', title: 'أدخل الأبعاد', desc: 'اكتب المقاسات بالمليمتر أو البوصة، وتتحدث الألسنة والطيات فورا.' },
  { n: '03', title: 'صدر الملف المتجه', desc: 'حمل ملف DXF أو PDF جاهزا للإنتاج مباشرة على ماكينة القص.' },
];

const FEATURES = [
  { icon: 'ph ph-cpu', title: 'محرك هندسي خاص', desc: 'مسارات متجهة مغلقة تمامًا بدون تقاطعات، مضمونة للقص النظيف.' },
  { icon: 'ph ph-stack', title: 'فصل الطبقات', desc: 'الملفات مفصولة مسبقا: طبقة القص وطبقة الطي جاهزتان للتصنيع.' },
  { icon: 'ph ph-printer', title: 'متوافقة مع ماكينات القص', desc: 'مهيأة لأجهزة الليزر والبلوتر بدون خطوط مزدوجة أو مسارات مفتوحة.' },
  { icon: 'ph ph-function', title: 'منطق بارامتري', desc: 'غير سمك الخامة وتحسب فراغات الوصل تلقائيا داخل المحرك.' },
];

const FAQS = [
  { q: 'هل يمكن استخدام الملفات لأعمال تجارية؟', a: 'نعم، الملفات الناتجة غير مقيدة بحقوق، ويمكن استخدامها في مشاريع العملاء والتصنيع.' },
  { q: 'ما البرامج التي تفتح هذه الملفات؟', a: 'تعمل ملفات DXF مع AutoCAD وIllustrator وCorelDRAW وأغلب برامج تشغيل ماكينات القص.' },
  { q: 'هل الأبعاد داخلية أم خارجية؟', a: 'الأبعاد الافتراضية هي المقاس الداخلي لضمان ملاءمة المنتج، وتُضاف سماكة الخامة للخارج.' },
  { q: 'هل يمكن ضبط سماكة الخامة؟', a: 'نعم، كل قالب يحتوي حقل سماكة، وتغييره يعيد حساب سماحات الطي تلقائيًا.' },
];

export default function TemplatesLibrary() {
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState('all');

  const trendingReveal = useReveal();
  const howReveal = useReveal();
  const whyReveal = useReveal();
  const libraryReveal = useReveal();
  const categoriesReveal = useReveal();
  const faqReveal = useReveal();
  const ctaReveal = useReveal();

  const filteredTemplates = ALL_TEMPLATES.filter((t) => {
    const matchesCat = activeCat === 'all' || t.category === activeCat;
    const matchesQuery =
      !query ||
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      t.id.toLowerCase().includes(query.toLowerCase()) ||
      t.tags.some((tg) => tg.toLowerCase().includes(query.toLowerCase()));
    return matchesCat && matchesQuery;
  });

  const categoryCounts = ALL_TEMPLATES.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#faf6f0', color: '#2b2013', fontFamily: 'Cairo, sans-serif' }}>
      <Header />

      {/* ===== Hero ===== */}
      <section style={{ position: 'relative', padding: 'calc(var(--space-8) * 2) var(--space-8) var(--space-8)', overflow: 'hidden', backgroundImage: 'radial-gradient(circle at 1px 1px, #e9ddc9 1px, transparent 0)', backgroundSize: '22px 22px' }}>
        <div className="hero-blob" style={{ position: 'absolute', right: '-8%', top: '-15%', width: '460px', height: '460px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(181,101,47,0.16), transparent 70%)', pointerEvents: 'none' }}></div>
        <div style={{ position: 'relative', maxWidth: '760px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-4)', background: '#f3e7d8', color: '#a9622f', fontSize: '12px', fontWeight: 700, padding: '6px 14px', borderRadius: '999px' }}>
            <i className="ph ph-sparkle"></i> تحديث جديد — قوالب مضافة هذا الأسبوع
          </span>
          <h1 style={{ fontSize: '52px', maxWidth: '18ch', color: '#2b2013', fontWeight: 700, lineHeight: 1.2, marginBottom: 'var(--space-3)' }}>مولد قوالب التغليف الجاهزة للقص</h1>
          <p style={{ fontSize: '17px', color: '#5a4c3c', maxWidth: '52ch', marginBottom: 'var(--space-6)', lineHeight: 1.6 }}>
            صمم تغليفا احترافيا <strong style={{ color: '#a9622f', fontWeight: 700 }}>بدون لصق</strong> في ثوان.
            صدّر ملفات SVG وDXF وPDF جاهزة للإنتاج والقص مباشرة.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
            <a href="#library" className="btn-anim" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#2b2013', color: '#fff', fontWeight: 700, fontSize: '15px', padding: 'var(--space-3) var(--space-6)', borderRadius: '999px' }}>
              ابدأ التصميم <i className="ph ph-arrow-left"></i>
            </a>
            <a href="#how" className="btn-anim" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fff', color: '#2b2013', fontWeight: 700, fontSize: '15px', padding: 'var(--space-3) var(--space-6)', borderRadius: '999px', border: '1px solid #ddd0bb' }}>
              كيف تعمل؟
            </a>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
            {HERO_STATS.map((s, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#5a4c3c', fontWeight: 600 }}>
                <i className={s.icon} style={{ color: '#a9622f', fontSize: '16px' }}></i>
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ height: '1px', background: '#e8ded0', margin: '0 var(--space-8)' }}></div>

      {/* ===== Trending ===== */}
      <section ref={trendingReveal.ref} className={trendingReveal.className} style={{ padding: 'calc(var(--space-8) * 2.4) var(--space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContext: 'space-between', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-6)' }}>
          <div>
            <h2 style={{ color: '#2b2013', fontSize: '24px', fontWeight: 700 }}>النماذج الرائجة</h2>
            <p style={{ color: '#8a7d6d', maxWidth: '56ch', fontSize: '14px', marginTop: '4px' }}>هياكل معتمدة صناعيًا للقص بالكتر والليزر — الأكثر تحميلًا هذا الشهر.</p>
          </div>
          <a href="#library" className="link-arrow" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#2b2013', fontSize: '14px' }}>
            عرض المكتبة الكاملة <i className="ph ph-arrow-left"></i>
          </a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-6)' }}>
          {ALL_TEMPLATES.slice(0, 4).map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      </section>

      <div style={{ height: '1px', background: '#e8ded0', margin: '0 var(--space-8)' }}></div>

      {/* ===== How it works ===== */}
      <section id="how" ref={howReveal.ref} className={howReveal.className} style={{ padding: 'calc(var(--space-8) * 2.4) var(--space-8)' }}>
        <h2 style={{ marginBottom: 'var(--space-2)', color: '#2b2013', fontSize: '24px', fontWeight: 700 }}>من الفكرة إلى القص</h2>
        <p style={{ color: '#8a7d6d', maxWidth: '56ch', marginBottom: 'var(--space-8)', fontSize: '14px' }}>مسار عمل مباشر لمصممي التغليف ومشغلي ماكينات القص.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-6)' }}>
          {STEPS.map((st, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <span style={{ fontSize: '32px', fontWeight: 700, color: '#e6d9c3' }}>{st.n}</span>
              <h4 style={{ margin: 0, color: '#2b2013', fontSize: '16px', fontWeight: 700 }}>{st.title}</h4>
              <p style={{ fontSize: '14px', margin: 0, color: '#8a7d6d', lineHeight: 1.6 }}>{st.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div style={{ height: '1px', background: '#e8ded0', margin: '0 var(--space-8)' }}></div>

      {/* ===== Why us ===== */}
      <section ref={whyReveal.ref} className={whyReveal.className} style={{ padding: 'calc(var(--space-8) * 2.4) var(--space-8)' }}>
        <h2 style={{ maxWidth: '16ch', marginBottom: 'var(--space-8)', color: '#2b2013', fontSize: '24px', fontWeight: 700, lineHeight: 1.3 }}>دقة هندسية داخل واجهة بسيطة</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-6)' }}>
          {FEATURES.map((f, idx) => (
            <div key={idx} className="hover-lift" style={{ border: '1px solid #e8ded0', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: '8px', background: '#ffffff' }}>
              <i className={f.icon} style={{ fontSize: '22px', color: '#a9622f' }}></i>
              <h4 style={{ margin: 0, color: '#2b2013', fontSize: '16px', fontWeight: 700 }}>{f.title}</h4>
              <p style={{ margin: 0, fontSize: '13.5px', color: '#8a7d6d', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div style={{ height: '1px', background: '#e8ded0', margin: '0 var(--space-8)' }}></div>

      {/* ===== Library (full grid, search + filter) ===== */}
      <section id="library" ref={libraryReveal.ref} className={libraryReveal.className} style={{ padding: 'calc(var(--space-8) * 2.4) var(--space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: '0 0 6px', color: '#2b2013', fontSize: '38px', fontWeight: 700 }}>مكتبة القوالب</h1>
            <div style={{ fontSize: '13px', letterSpacing: '0.06em', color: '#9c8f7c', fontWeight: 700 }}>
              {filteredTemplates.length} قالب قياسي
            </div>
          </div>
          <div style={{ width: '320px', maxWidth: '100%', position: 'relative' }}>
            <i className="ph ph-magnifying-glass" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', color: '#9c8f7c' }}></i>
            <input 
              style={{ width: '100%', padding: '11px 40px 11px 14px', border: '1px solid #e6dccb', borderRadius: 'var(--radius-md)', background: '#f5efe4', fontSize: '14px', fontFamily: 'Cairo, sans-serif', color: '#2b2013' }} 
              type="text" 
              placeholder="ابحث في القوالب..." 
              value={query} 
              onChange={(e) => setQuery(e.target.value)} 
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 'var(--space-6)', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#9c8f7c', fontWeight: 700, paddingLeft: 'var(--space-3)', borderLeft: '1px solid #e8ded0', marginLeft: '6px' }}>
            <i className="ph ph-funnel"></i> تصفية
          </span>
          {CATEGORIES.map((cat) => {
            const active = cat.id === activeCat;
            return (
              <button 
                key={cat.id}
                type="button" 
                className="cat-pill" 
                onClick={() => setActiveCat(cat.id)} 
                style={{
                  padding: '8px 18px',
                  borderRadius: '999px',
                  fontSize: '14px',
                  fontWeight: active ? 700 : 600,
                  cursor: 'pointer',
                  fontFamily: 'Cairo, sans-serif',
                  whiteSpace: 'nowrap',
                  border: 'none',
                  background: active ? '#2b2013' : 'transparent',
                  color: active ? '#ffffff' : '#5a4c3c'
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 'var(--space-6)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-6)' }}>
          {filteredTemplates.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)', color: '#9c8f7c' }}>
            <i className="ph ph-cube-transparent" style={{ fontSize: '36px', display: 'block', marginBottom: 'var(--space-2)' }}></i>
            لا توجد قوالب مطابقة لبحثك
          </div>
        )}
      </section>

      <div style={{ height: '1px', background: '#e8ded0', margin: '0 var(--space-8)' }}></div>

      {/* ===== Categories ===== */}
      <section id="categories" ref={categoriesReveal.ref} className={categoriesReveal.className} style={{ padding: 'calc(var(--space-8) * 2.4) var(--space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-6)' }}>
          <h2 style={{ marginBottom: 0, color: '#2b2013', fontSize: '24px', fontWeight: 700 }}>تصفح حسب التصنيف</h2>
          <a href="#library" className="link-arrow" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#2b2013', fontSize: '14px' }}>
            عرض كل التصنيفات <i className="ph ph-arrow-left"></i>
          </a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
          {CATEGORIES.filter((c) => c.id !== 'all').map((c) => {
            const count = categoryCounts[c.id] || 0;
            return (
              <a 
                key={c.id}
                href="#library" 
                className="hover-lift" 
                onClick={(e) => {
                  e.preventDefault();
                  setActiveCat(c.id);
                  const el = document.getElementById('library');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }} 
                style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #e8ded0', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', background: '#ffffff' }}
              >
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#2b2013' }}>{c.label}</div>
                  <div style={{ fontSize: '12px', color: '#9c8f7c', marginTop: '2px' }}>{count} قالب</div>
                </div>
                <i className="ph ph-arrow-left" style={{ color: '#a9622f' }}></i>
              </a>
            );
          })}
        </div>
      </section>

      <div style={{ height: '1px', background: '#e8ded0', margin: '0 var(--space-8)' }}></div>

      {/* ===== FAQ ===== */}
      <section ref={faqReveal.ref} className={faqReveal.className} style={{ padding: 'calc(var(--space-8) * 2.4) var(--space-8)' }}>
        <h2 style={{ marginBottom: 'var(--space-6)', color: '#2b2013', fontSize: '24px', fontWeight: 700 }}>أسئلة شائعة</h2>
        <div style={{ display: 'grid', gap: 'var(--space-3)', maxWidth: '760px' }}>
          {FAQS.map((q, idx) => (
            <div key={idx} className="hover-lift" style={{ border: '1px solid #e8ded0', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: '6px', background: '#ffffff' }}>
              <h4 style={{ margin: 0, fontSize: '15px', color: '#2b2013', fontWeight: 700 }}>{q.q}</h4>
              <p style={{ margin: 0, fontSize: '13.5px', color: '#8a7d6d', lineHeight: 1.6 }}>{q.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section ref={ctaReveal.ref} className={ctaReveal.className} style={{ margin: 'var(--space-8)', padding: 'calc(var(--space-8) * 2.4) var(--space-8)', borderRadius: 'var(--radius-lg)', background: '#2b2013', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ marginBottom: '6px', color: '#fff', fontSize: '24px', fontWeight: 700 }}>ابدأ خط الإنتاج الخاص بك</h2>
          <p style={{ opacity: 0.7, margin: 0, color: '#fff', fontSize: '14px' }}>قوالب غير محدودة، جاهزة للتصدير في أي وقت.</p>
        </div>
        <a href="#library" className="btn-anim" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fff', color: '#2b2013', fontWeight: 700, fontSize: '15px', padding: 'var(--space-3) var(--space-6)', borderRadius: '999px' }}>
          شغل التطبيق <i className="ph ph-arrow-left"></i>
        </a>
      </section>

      <Footer />
    </div>
  );
}
