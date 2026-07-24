import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer
      dir="rtl"
      style={{
        background: '#ffffff',
        borderTop: '1px solid var(--brand-border)',
        padding: 'calc(var(--space-8) * 2) var(--space-8) var(--space-8)',
        color: 'var(--brand-navy)',
      }}
    >
      <div 
        className="footer-grid"
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1.5fr 1fr 1fr',
          gap: 'var(--space-8)',
          marginBottom: 'var(--space-8)'
        }}
      >
        {/* Column 1: Brand / About Us */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '20px' }}>
            <img src="/brand/printera-logo-trans.png" alt="Printera" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
            <span>برين<span style={{ color: 'var(--brand-gold)' }}>تيرا</span></span>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--brand-muted-2)', lineHeight: '1.6', margin: 0, maxWidth: '35ch' }}>
            منصة برينتيرا لإنتاج وتصميم قوالب التغليف البارامترية الهندسية بدقة متناهية، جاهزة للقص المباشر لمصممي التغليف والمطابع.
          </p>
        </div>

        {/* Column 2: Quick Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--brand-navy)' }}>روابط سريعة</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
            <Link to="/" style={{ color: 'var(--brand-muted)', textDecoration: 'none', transition: 'color 0.2s' }} className="footer-link">الرئيسية</Link>
            <Link to="/templates" style={{ color: 'var(--brand-muted)', textDecoration: 'none', transition: 'color 0.2s' }} className="footer-link">القوالب</Link>
            <Link to="/pricing" style={{ color: 'var(--brand-muted)', textDecoration: 'none', transition: 'color 0.2s' }} className="footer-link">الأسعار</Link>
            <Link to="/about" style={{ color: 'var(--brand-muted)', textDecoration: 'none', transition: 'color 0.2s' }} className="footer-link">من نحن</Link>
          </div>
        </div>

        {/* Column 3: Contact Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--brand-navy)' }}>تواصل معنا</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: 'var(--brand-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="ph ph-map-pin" style={{ color: 'var(--brand-gold)', fontSize: '18px' }}></i>
              <span>الرياض، المملكة العربية السعودية</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="ph ph-envelope" style={{ color: 'var(--brand-gold)', fontSize: '18px' }}></i>
              <a href="mailto:info@printera.app" style={{ color: 'inherit', textDecoration: 'none' }} className="footer-link">info@printera.app</a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="ph ph-phone" style={{ color: 'var(--brand-gold)', fontSize: '18px' }}></i>
              <span dir="ltr">+966 50 000 0000</span>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div 
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          paddingTop: 'var(--space-4)',
          borderTop: '1px solid var(--brand-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          fontSize: '12px',
          color: 'var(--brand-muted-2)'
        }}
      >
        <span>جميع الحقوق محفوظة © 2026 برينتيرا</span>
        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          <Link to="/terms" style={{ color: 'inherit', textDecoration: 'none' }} className="footer-link">الشروط والأحكام</Link>
          <Link to="/privacy" style={{ color: 'inherit', textDecoration: 'none' }} className="footer-link">سياسة الخصوصية</Link>
        </div>
      </div>

      <style>{`
        .footer-grid {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr;
          gap: var(--space-8);
        }
        @media (max-width: 768px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
            gap: var(--space-6) !important;
          }
        }
        .footer-link:hover {
          color: var(--brand-navy) !important;
          text-decoration: underline !important;
        }
      `}</style>
    </footer>
  );
}
