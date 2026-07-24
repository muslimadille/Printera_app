import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';

const FAQS = [
  { q: 'هل يمكن تغيير الخطة لاحقًا؟', a: 'نعم، يمكنك الترقية أو التخفيض في أي وقت وسيُحتسب الفرق تلقائيًا في الفاتورة التالية.' },
  { q: 'هل هناك حد لعدد القوالب المصدّرة؟', a: 'خطة الأعمال والمصنع بدون حد. خطة البداية محدودة بعدد تصديرات شهرية معلن عنها في المقارنة.' },
  { q: 'هل تدعمون الفوترة الضريبية؟', a: 'نعم، تصدر كل الفواتير بشكل تلقائي وتشمل الرقم الضريبي عند إضافته لبيانات الحساب.' },
  { q: 'ماذا يحدث بعد انتهاء الاشتراك؟', a: 'تبقى قوالبك المحفوظة متاحة للعرض، ويُعاد تفعيل التصدير فور تجديد الاشتراك.' },
];

export default function Pricing() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  const yearly = billing === 'yearly';

  const segStyle = (active: boolean) => ({
    padding: '9px 18px',
    borderRadius: '999px',
    fontSize: '13.5px',
    fontWeight: active ? 700 : 600,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'Cairo, sans-serif',
    background: active ? 'var(--brand-navy)' : 'transparent',
    color: active ? '#ffffff' : 'var(--brand-muted)',
    transition: 'background .2s ease, color .2s ease',
  });

  const priceFor = (monthly: string, yearlyPrice: string) => (yearly ? yearlyPrice : monthly);

  // Plans are now fetched purely from the backend

  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPlans() {
      setIsLoading(true);
      try {
        const { data: plansData, error: plansErr } = await supabase.from('subscription_plans').select('*');
        const { data: featsData, error: featsErr } = await supabase.from('plan_features').select('*').order('sort_order');
        
        if (!plansErr && !featsErr && plansData && plansData.length > 0) {
          const dynamicPlans = plansData.map((p: any) => {
            const fts = featsData ? featsData.filter((f: any) => f.plan_id === p.id).map((f: any) => f.feature) : [];
            return {
              name: p.name,
              desc: p.description,
              price: priceFor(p.price_monthly, p.price_yearly),
              period: yearly ? 'ر.س / شهر (سنوي)' : (p.price_monthly === 'مجانًا' ? '' : 'ر.س / شهر'),
              cta: p.cta,
              featured: p.featured,
              features: fts
            };
          });
          setPlans(dynamicPlans);
        } else {
          setPlans([]);
        }
      } catch (err) {
        console.error("Failed to fetch plans", err);
        setPlans([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPlans();
  }, [yearly]);

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--brand-bg)', color: 'var(--brand-navy)', fontFamily: 'Cairo, sans-serif' }}>
      <Header active="pricing" />

      {/* ===== Hero ===== */}
      <section style={{ padding: 'calc(var(--space-8) * 2) var(--space-8) var(--space-6)', textAlign: 'center', backgroundImage: 'radial-gradient(circle at 1px 1px, var(--brand-border) 1px, transparent 0)', backgroundSize: '22px 22px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-4)', background: 'var(--brand-tag-bg)', color: 'var(--brand-navy)', fontSize: '12px', fontWeight: 700, padding: '6px 14px', borderRadius: '999px' }}>
          <i className="ph ph-sparkle" style={{ color: 'var(--brand-gold)' }}></i> بدون التزام سنوي
        </span>
        <h1 style={{ fontSize: '42px', margin: '0 auto 10px', maxWidth: '16ch', fontWeight: 700 }}>خطط تناسب حجم إنتاجك</h1>
        <p style={{ color: 'var(--brand-muted)', maxWidth: '52ch', margin: '0 auto var(--space-6)', fontSize: '15px', lineHeight: 1.6 }}>
          من التجربة الفردية إلى خطوط الإنتاج الكاملة — اختر الخطة المناسبة وابدأ التصدير فورًا.
        </p>

        {/* Billing toggle */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fff', border: '1px solid var(--brand-border)', borderRadius: '999px', padding: '4px' }}>
          <button type="button" onClick={() => setBilling('monthly')} style={segStyle(!yearly)}>شهري</button>
          <button type="button" onClick={() => setBilling('yearly')} style={segStyle(yearly)}>سنوي — وفّر 20٪</button>
        </div>
      </section>

      {/* ===== Plans ===== */}
      <section style={{ padding: 'var(--space-6) var(--space-8) calc(var(--space-8) * 2)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-6)', maxWidth: '1100px', margin: '0 auto', alignItems: 'start' }}>
          {plans.map((p, idx) => {
            const featured = p.featured;
            const accentText = featured ? 'var(--brand-gold)' : 'var(--brand-navy)';
            const mutedText = featured ? 'rgba(255,255,255,0.65)' : 'var(--brand-muted)';
            const priceText = featured ? '#ffffff' : 'var(--brand-navy)';
            const featureText = featured ? 'rgba(255,255,255,0.85)' : 'var(--brand-muted-2)';
            const checkColor = 'var(--brand-gold)';
            const dividerColor = featured ? 'rgba(255,255,255,0.15)' : 'var(--brand-border)';
            const btnStyle = {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              boxSizing: 'border-box' as const,
              height: '46px',
              borderRadius: '999px',
              fontWeight: 700,
              fontSize: '14px',
              background: featured ? 'var(--brand-gold)' : 'var(--brand-navy)',
              color: featured ? '#ffffff' : '#ffffff',
              border: 'none',
              cursor: 'pointer',
            };

            return (
              <div 
                key={idx} 
                className="hover-lift" 
                style={{
                  position: 'relative', 
                  borderRadius: 'var(--radius-lg)', 
                  padding: 'var(--space-6)',
                  background: featured ? 'var(--brand-navy)' : '#ffffff',
                  border: `1px solid ${featured ? 'var(--brand-navy)' : 'var(--brand-border)'}`,
                  transform: featured ? 'scale(1.02)' : 'none',
                  boxShadow: featured ? '0 20px 40px rgba(15,29,45,0.15)' : 'none',
                }}
              >
                {featured && (
                  <span style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: 'var(--brand-gold)', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '4px 14px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
                    الأكثر اختيارًا
                  </span>
                )}
                <div style={{ fontSize: '18px', fontWeight: 700, color: accentText }}>{p.name}</div>
                <p style={{ fontSize: '13.5px', color: mutedText, margin: '6px 0 var(--space-4)', minHeight: '2.4em', lineHeight: 1.5 }}>{p.desc}</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', marginBottom: 'var(--space-6)' }}>
                  <span style={{ fontSize: '38px', fontWeight: 700, color: priceText }}>{p.price}</span>
                  <span style={{ fontSize: '13px', color: mutedText, marginBottom: '6px' }}>{p.period}</span>
                </div>
                <button type="button" className="btn-anim" style={btnStyle}>{p.cta}</button>
                <div style={{ height: '1px', background: dividerColor, margin: 'var(--space-6) 0' }}></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {p.features.map((f, fIdx) => (
                    <div key={fIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13.5px', color: featureText }}>
                      <i className="ph ph-check-circle" style={{ color: checkColor, fontSize: '16px', flexShrink: 0, marginTop: '2px' }}></i>
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ height: '1px', background: 'var(--brand-border)', margin: '0 var(--space-8)' }}></div>

      {/* ===== Comparison note ===== */}
      <section style={{ padding: 'calc(var(--space-8) * 1.6) var(--space-8)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '22px', marginBottom: 'var(--space-3)', fontWeight: 700 }}>كل الخطط تشمل ملفات قص جاهزة للإنتاج</h2>
          <p style={{ color: 'var(--brand-muted)', fontSize: '14px', margin: '0 0 var(--space-6)', lineHeight: 1.6 }}>
            SVG وDXF وPDF بدقة هندسية كاملة، متوافقة مع ماكينات الكتر والليزر المعتادة في مصانع الكرتون.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--brand-muted)', fontWeight: 600 }}>
              <i className="ph ph-shield-check" style={{ color: 'var(--brand-gold)', fontSize: '16px' }}></i> ضمان استرجاع 14 يومًا
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--brand-muted)', fontWeight: 600 }}>
              <i className="ph ph-x-circle" style={{ color: 'var(--brand-gold)', fontSize: '16px' }}></i> إلغاء في أي وقت
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section style={{ padding: '0 var(--space-8) calc(var(--space-8) * 2)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <h2 style={{ marginBottom: 'var(--space-6)', textAlign: 'center', fontSize: '22px', fontWeight: 700 }}>أسئلة حول الأسعار</h2>
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {FAQS.map((q, idx) => (
              <div key={idx} style={{ border: '1px solid var(--brand-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', background: '#fff' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: '14.5px', fontWeight: 700 }}>{q.q}</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--brand-muted)', lineHeight: 1.6 }}>{q.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
