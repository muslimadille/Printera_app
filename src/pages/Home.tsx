import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TemplateCard, { Template } from '@/components/TemplateCard';
import { supabase } from '@/integrations/supabase/client';

const FALLBACK_TEMPLATES: Template[] = [
  {
    id: 'T0002',
    title: 'علبة قابلة للطي (Straight Tuck End)',
    category: 'folding',
    categoryLabel: 'علب قابلة للطي',
    desc: 'علبة كرتون قياسية قابلة للطي مع ألسنة إغلاق علوية وسفلية',
    tags: ['كرتون', 'طي', 'تغليف'],
    pro: false,
    svg: '/templates/preview/T0002.svg'
  },
  {
    id: 'T0005',
    title: 'علبة قاع أوتوماتيكي (Crash Lock)',
    category: 'auto-bottom',
    categoryLabel: 'علب أوتوماتيكية',
    desc: 'علبة كرتون بقاع كراش لوك أوتوماتيكي للتركيب السريع',
    tags: ['أوتوماتيك', 'سريع', 'كرتون'],
    pro: false,
    svg: '/templates/preview/T0005.svg'
  },
  {
    id: 'D001-H',
    title: 'علبة شحن بريدية (Mailer Box)',
    category: 'mailer',
    categoryLabel: 'علب شحن',
    desc: 'علبة كرتون مضلع للشحن والتوصيل مع غطاء مدمج',
    tags: ['شحن', 'مضلع', 'بريد'],
    pro: true,
    svg: '/templates/preview/D001-H.svg'
  },
  {
    id: 'T00012',
    title: 'علبة غطاء وقاعدة (Two-Piece Rigid)',
    category: 'rigid',
    categoryLabel: 'علب صلبة',
    desc: 'علبة فاخرة مكونة من جزأين غطاء وقاعدة منفصلين',
    tags: ['صلب', 'فاخر', 'غطاء وقاعدة'],
    pro: false,
    svg: '/templates/preview/T00012.svg'
  },
  {
    id: 'T0006',
    title: 'علبة غلاف كم (Sleeve Box)',
    category: 'sleeve',
    categoryLabel: 'أغلفة كم',
    desc: 'غلاف كرتوني منزلق للعلب والمجموعات',
    tags: ['كم', 'منزلق', 'غلاف'],
    pro: false,
    svg: '/templates/preview/T0006.svg'
  },
  {
    id: 'fefco_0427',
    title: 'علبة بيتزا وتغليف (FEFCO 0427)',
    category: 'fefco',
    categoryLabel: 'قوالب FEFCO',
    desc: 'علبة كرتون مطوية قياسية حسب مواصفات FEFCO الدولية',
    tags: ['FEFCO', 'قياسي', 'تغليف'],
    pro: false,
    svg: '/templates/preview/fefco_0427.svg'
  }
];

const FAQS = [
  {
    q: "ما هي الصيغ المتاحة لتصدير القوالب؟",
    a: "نوفر تصدير الملفات بصيغ SVG، DXF، و PDF متجهة عالية الدقة ودقيقة 100% لتكون جاهزة للطباعة والتنفيذ المباشر على ماكينات القص ورسامات النماذج."
  },
  {
    q: "هل يمكنني تغيير الأبعاد والألسنة بحرية؟",
    a: "نعم، جميع قوالب منصة برينتيرا هي قوالب بارامترية ديناميكية، تتيح لك إدخال العرض، الارتفاع، العمق، وسماكة الكرتون وأبعاد الألسنة والتعشيق بمرونة فائقة."
  },
  {
    q: "كيف تعمل خاصية المونتاج والتوزيع الذكي (Smart Nesting)؟",
    a: "تقوم خوارزمياتنا الحسابية بتوزيع وتداخل أجزاء العلبة تلقائياً على شيت الطباعة بزوايا تداخل مدروسة لتقليل هدر الورق وتوفير تكلفتك التشغيلية."
  },
  {
    q: "هل القوالب مجربة ومطابقة للمواصفات التجارية للمطابع؟",
    a: "نعم، تم تصميم وبرمجة كافة القوالب بواسطة فريق من الفنيين والمصممين المتخصصين بالطباعة والتغليف وفق معايير التغليف الدولية المعتمدة (FEFCO & ECMA)."
  }
];

function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <section className="faq-section" style={{ background: '#FFFFFF', padding: '65px 24px 80px', borderTop: '1px solid #E2E8F0' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '32px', fontWeight: 800, color: '#0F172A', marginBottom: '38px' }}>
          أسئلة شائعة
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {FAQS.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div 
                key={idx}
                style={{
                  background: isOpen ? '#FAF7F2' : '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                  boxShadow: isOpen ? '0 4px 14px rgba(0,0,0,0.03)' : 'none'
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  style={{
                    width: '100%',
                    padding: '18px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'none',
                    border: 'none',
                    textAlign: 'right',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 700,
                    color: '#0F172A'
                  }}
                >
                  <span>{faq.q}</span>
                  <i className={`ph ph-caret-${isOpen ? 'up' : 'down'}`} style={{ fontSize: '18px', color: '#007BFF' }}></i>
                </button>
                {isOpen && (
                  <div style={{ padding: '0 24px 20px', fontSize: '14.5px', color: '#475569', lineHeight: '1.7' }}>
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [mostUsedTemplates, setMostUsedTemplates] = useState<Template[]>(FALLBACK_TEMPLATES);

  useEffect(() => {
    async function fetchHomeData() {
      try {
        const tempRes = await supabase.from('app_templates').select('*');
        if (tempRes.data && tempRes.data.length > 0) {
          setMostUsedTemplates(tempRes.data.slice(0, 9));
        }
      } catch (err) {
        console.error("Failed to fetch templates from Supabase, using standard templates", err);
      }
    }
    fetchHomeData();
  }, []);

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#FFFFFF', color: '#0F172A', fontFamily: "'Cairo', sans-serif" }}>
      {/* Top Navbar with Pure White Background (#ffffff) as requested */}
      <Header variant="simple" active="home" bg="#ffffff" />

      {/* Hero Banner Section (Warm Off-White Background #F6F4EF) */}
      <section 
        style={{ 
          background: '#F6F4EF',
          padding: '60px 24px 50px', 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}
      >
        <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Main Title */}
          <h1 
            style={{ 
              fontSize: 'clamp(28px, 4.5vw, 40px)', 
              fontWeight: 800, 
              color: '#0F172A', 
              margin: 0,
              lineHeight: '1.4',
              letterSpacing: '-0.01em',
            }}
          >
            قوالب كما يجب أن تكون ... جاهزة للتصنيع
          </h1>

          {/* Subtitle */}
          <p 
            style={{ 
              fontSize: 'clamp(16px, 2.5vw, 19px)', 
              fontWeight: 500, 
              color: '#475569', 
              marginTop: '12px',
              marginBottom: 0
            }}
          >
            أول منصة في الشرق الأوسط لحلول وتشكيل القوالب الصناعية
          </p>

          {/* 3 Stats Bar Row */}
          <div 
            style={{ 
              width: '100%',
              maxWidth: '820px',
              marginTop: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              background: '#F6F4EF',
              borderTop: '1px solid #E2E8F0',
              borderBottom: '1px solid #E2E8F0',
              padding: '24px 0'
            }}
            className="hero-stats-row"
          >
            {/* Stat 1 */}
            <div style={{ flex: 1, textAlign: 'center', padding: '0 12px' }}>
              <div style={{ fontSize: '36px', fontWeight: 800, color: '#007BFF', lineHeight: 1.2 }}>
                +20
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#475569', marginTop: '6px' }}>
                عام خبرة بتشكيل القوالب
              </div>
            </div>

            {/* Divider 1 */}
            <div style={{ width: '1px', height: '42px', background: '#E2E8F0' }} className="stat-divider"></div>

            {/* Stat 2 */}
            <div style={{ flex: 1, textAlign: 'center', padding: '0 12px' }}>
              <div style={{ fontSize: '36px', fontWeight: 800, color: '#007BFF', lineHeight: 1.2 }}>
                سرعة
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#475569', marginTop: '6px' }}>
                بانشاء القوالب اون لاين
              </div>
            </div>

            {/* Divider 2 */}
            <div style={{ width: '1px', height: '42px', background: '#E2E8F0' }} className="stat-divider"></div>

            {/* Stat 3 */}
            <div style={{ flex: 1, textAlign: 'center', padding: '0 12px' }}>
              <div style={{ fontSize: '36px', fontWeight: 800, color: '#007BFF', lineHeight: 1.2 }}>
                صناعية
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#475569', marginTop: '6px' }}>
                بتفاصيل فنية جاهزة للتنفيذ
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Templates Section with Original TemplateCard Component & Interactions */}
      <section style={{ background: '#FFFFFF', padding: '50px 24px 60px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="home-templates-grid">
            {mostUsedTemplates.map((template) => (
              <div key={template.id} style={{ height: '100%' }}>
                <TemplateCard template={template} />
              </div>
            ))}
          </div>

          {/* Show All Button */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '44px' }}>
            <Link 
              to="/templates"
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '10px', 
                background: '#007BFF', 
                color: '#FFFFFF', 
                fontWeight: 700, 
                fontSize: '15px', 
                padding: '12px 36px', 
                borderRadius: '8px', 
                textDecoration: 'none',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 14px rgba(0, 123, 255, 0.22)'
              }}
              className="btn-show-all"
            >
              <span>عرض الكل</span>
              <i className="ph ph-arrow-left" style={{ fontSize: '16px' }}></i>
            </Link>
          </div>
        </div>

        <style>{`
          .home-templates-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
          }
          .btn-show-all:hover {
            background: #0066CC !important;
            transform: translateY(-2px);
          }
          @media (max-width: 900px) {
            .home-templates-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }
          @media (max-width: 600px) {
            .home-templates-grid {
              grid-template-columns: repeat(1, 1fr);
            }
            .hero-stats-row {
              flex-direction: column;
              gap: 24px;
            }
            .stat-divider {
              display: none;
            }
          }
        `}</style>
      </section>

      {/* 3 Steps Section ("فقط 3 خطوات") */}
      <section 
        style={{ 
          background: '#F6F4EF', 
          padding: '60px 24px 80px', 
          borderTop: '1px solid #E2E8F0' 
        }}
      >
        <div style={{ maxWidth: '860px', margin: '0 auto', textAlign: 'center' }}>
          {/* Section Header */}
          <h2 
            style={{ 
              fontSize: '32px', 
              fontWeight: 800, 
              color: '#0F172A', 
              margin: '0 0 50px 0'
            }}
          >
            فقط 3 خطوات
          </h2>

          {/* 3 Steps Row */}
          <div className="three-steps-grid">
            {/* Step 1 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <div 
                style={{ 
                  width: '50px', 
                  height: '50px', 
                  borderRadius: '50%', 
                  border: '2px solid #007BFF', 
                  background: '#FFFFFF',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: '#007BFF', 
                  fontSize: '22px',
                  fontWeight: 800,
                  boxShadow: '0 2px 8px rgba(0, 123, 255, 0.08)'
                }}
              >
                1
              </div>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B' }}>
                أختر شكل القالب
              </span>
            </div>

            {/* Step 2 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <div 
                style={{ 
                  width: '50px', 
                  height: '50px', 
                  borderRadius: '50%', 
                  border: '2px solid #007BFF', 
                  background: '#FFFFFF',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: '#007BFF', 
                  fontSize: '22px',
                  fontWeight: 800,
                  boxShadow: '0 2px 8px rgba(0, 123, 255, 0.08)'
                }}
              >
                2
              </div>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B' }}>
                أدخل الأبعاد
              </span>
            </div>

            {/* Step 3 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <div 
                style={{ 
                  width: '50px', 
                  height: '50px', 
                  borderRadius: '50%', 
                  border: '2px solid #007BFF', 
                  background: '#FFFFFF',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: '#007BFF', 
                  fontSize: '22px',
                  fontWeight: 800,
                  boxShadow: '0 2px 8px rgba(0, 123, 255, 0.08)'
                }}
              >
                3
              </div>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B' }}>
                أرفع الملف
              </span>
            </div>
          </div>
        </div>

        <style>{`
          .three-steps-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 32px;
          }
          @media (max-width: 640px) {
            .three-steps-grid {
              grid-template-columns: 1fr;
              gap: 36px;
            }
          }
        `}</style>
      </section>

      {/* FAQ Section */}
      <FaqSection />

      {/* Footer */}
      <Footer />
    </div>
  );
}





