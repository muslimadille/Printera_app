import { Link } from 'react-router-dom';

interface FooterProps {
  /** "simple" = compact single-row footer (Home/Contact/About).
   *  "rich" = 3-column grid footer + copyright bar (library/pricing/template pages). */
  variant?: 'simple' | 'rich';
  /** rich variant only: third column content. */
  thirdColumn?: 'categories' | 'account';
}

export default function Footer({ variant = 'rich', thirdColumn = 'categories' }: FooterProps) {
  if (variant === 'simple') {
    return (
      <footer
        style={{
          padding: 'calc(var(--space-8) * 1.6) var(--space-8)',
          borderTop: '1px solid var(--brand-border)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '16px' }}>
          <img src="/brand/printera-logo-trans.png" alt="Printera" style={{ width: '26px', height: '26px', objectFit: 'contain' }} />
          <span style={{ whiteSpace: 'nowrap' }}>برين<span style={{ color: 'var(--brand-gold)' }}>تيرا</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', fontSize: '13.5px' }}>
          <Link to="/about" style={{ color: 'var(--brand-muted)' }}>من نحن</Link>
          <Link to="/contact" style={{ color: 'var(--brand-muted)' }}>تواصل معنا</Link>
          <Link to="/pricing" style={{ color: 'var(--brand-muted)' }}>الأسعار</Link>
        </div>
        <span style={{ fontSize: '12px', color: 'var(--brand-muted-2)' }}>© 2026 برينتيرا</span>
      </footer>
    );
  }

  return (
    <>
      <footer
        style={{
          padding: 'calc(var(--space-8) * 2.4) var(--space-8)',
          borderTop: '1px solid var(--brand-border)',
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr 1fr',
          gap: 'var(--space-8)',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: 'var(--space-2)', color: 'var(--brand-navy)', whiteSpace: 'nowrap' }}>
            برين<span style={{ color: 'var(--brand-gold)' }}>تيرا</span>
          </div>
          <p style={{ fontSize: '13px', maxWidth: '32ch', color: 'var(--brand-muted-2)' }}>قوالب تغليف بارامترية دقيقة، بدون لصق، جاهزة للقص والإنتاج.</p>
        </div>
        <div>
          <h6 style={{ marginBottom: 'var(--space-3)', color: 'var(--brand-navy)' }}>القوالب</h6>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <Link to="/templates" style={{ color: 'var(--brand-muted)' }}>تصفح كل العلب</Link>
            <Link to="/pricing" style={{ color: 'var(--brand-muted)' }}>الأسعار</Link>
          </div>
        </div>
        <div>
          {thirdColumn === 'account' ? (
            <>
              <h6 style={{ marginBottom: 'var(--space-3)', color: 'var(--brand-navy)' }}>الحساب</h6>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <Link to="/login" style={{ color: 'var(--brand-muted)' }}>تسجيل الدخول</Link>
                <Link to="/signup" style={{ color: 'var(--brand-muted)' }}>إنشاء حساب</Link>
              </div>
            </>
          ) : (
            <>
              <h6 style={{ marginBottom: 'var(--space-3)', color: 'var(--brand-navy)' }}>التصنيفات</h6>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <Link to="/templates" style={{ color: 'var(--brand-muted)' }}>تصفح كل التصنيفات</Link>
              </div>
            </>
          )}
        </div>
      </footer>
      <div style={{ textAlign: 'center', padding: 'var(--space-4)', fontSize: '12px', color: 'var(--brand-muted-2)', borderTop: '1px solid var(--brand-border)' }}>
        © 2026 برينتيرا
      </div>
    </>
  );
}
