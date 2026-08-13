import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';
import { useAppContent } from '@/hooks/useAppContent';

export default function Pricing() {
  const { plans, pricingContent } = useAppContent();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  const yearly = billing === 'yearly';

  const segStyle = (active: boolean) => ({
    padding: '9px 18px',
    borderRadius: '999px',
    fontSize: '13.5px',
    fontWeight: active ? 700 : 600,
    border: 'none',
    cursor: 'pointer',
    fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif",
    background: active ? 'var(--brand-navy)' : 'transparent',
    color: active ? '#ffffff' : 'var(--brand-muted)',
    transition: 'background .2s ease, color .2s ease',
  });

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--brand-bg)', color: 'var(--brand-navy)', fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif" }}>
      <Header active="pricing" />

      {/* ===== Hero ===== */}
      <section style={{ padding: 'calc(var(--space-8) * 2) var(--space-8) var(--space-6)', textAlign: 'center', backgroundImage: 'radial-gradient(circle at 1px 1px, var(--brand-border) 1px, transparent 0)', backgroundSize: '22px 22px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-4)', background: 'var(--brand-tag-bg)', color: 'var(--brand-navy)', fontSize: '12px', fontWeight: 700, padding: '6px 14px', borderRadius: '999px' }}>
          <i className="ph ph-sparkle" style={{ color: 'var(--brand-gold)' }}></i> {pricingContent.heroTag}
        </span>
        <h1 style={{ fontSize: '42px', margin: '0 auto 10px', maxWidth: '16ch', fontWeight: 700 }}>{pricingContent.heroTitle}</h1>
        <p style={{ color: 'var(--brand-muted)', maxWidth: '52ch', margin: '0 auto var(--space-6)', fontSize: '15px', lineHeight: 1.6 }}>
          {pricingContent.heroSubtitle}
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
            const displayPrice = typeof p.priceMonthly === 'number'
              ? (yearly ? `${p.priceYearly} ر.س` : `${p.priceMonthly} ر.س`)
              : p.priceMonthly;
            const periodLabel = typeof p.priceMonthly === 'number'
              ? (yearly ? '/ شهر (سنوي)' : '/ شهر')
              : '';
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
                key={p.id || idx} 
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
                {(p.badge || featured) && (
                  <span style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: 'var(--brand-gold)', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '4px 14px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
                    {p.badge || 'الأكثر اختيارًا'}
                  </span>
                )}
                <div style={{ fontSize: '18px', fontWeight: 700, color: accentText }}>{p.name}</div>
                <p style={{ fontSize: '13.5px', color: mutedText, margin: '6px 0 var(--space-4)', minHeight: '2.4em', lineHeight: 1.5 }}>{p.desc}</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', marginBottom: 'var(--space-6)' }}>
                  <span style={{ fontSize: '38px', fontWeight: 700, color: priceText }}>{displayPrice}</span>
                  <span style={{ fontSize: '13px', color: mutedText, marginBottom: '6px' }}>{periodLabel}</span>
                </div>
                <button type="button" className="btn-anim" style={btnStyle}>{p.cta || 'اشترك الآن'}</button>
                <div style={{ height: '1px', background: dividerColor, margin: 'var(--space-6) 0' }}></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(p.features || []).map((f, fIdx) => (
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
          <h2 style={{ fontSize: '22px', marginBottom: 'var(--space-3)', fontWeight: 700 }}>{pricingContent.guaranteeTitle}</h2>
          <p style={{ color: 'var(--brand-muted)', fontSize: '14px', margin: '0 0 var(--space-6)', lineHeight: 1.6 }}>
            {pricingContent.guaranteeSubtitle}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--brand-muted)', fontWeight: 600 }}>
              <i className="ph ph-shield-check" style={{ color: 'var(--brand-gold)', fontSize: '16px' }}></i> {pricingContent.badge1}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--brand-muted)', fontWeight: 600 }}>
              <i className="ph ph-x-circle" style={{ color: 'var(--brand-gold)', fontSize: '16px' }}></i> {pricingContent.badge2}
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section style={{ padding: '0 var(--space-8) calc(var(--space-8) * 2)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <h2 style={{ marginBottom: 'var(--space-6)', textAlign: 'center', fontSize: '22px', fontWeight: 700 }}>{pricingContent.faqTitle}</h2>
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {pricingContent.pricingFaqs.map((q, idx) => (
              <div key={q.id || idx} style={{ border: '1px solid var(--brand-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', background: '#fff' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: '14.5px', fontWeight: 700 }}>{q.question}</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--brand-muted)', lineHeight: 1.6 }}>{q.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
