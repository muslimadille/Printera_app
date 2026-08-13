import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAppContent } from '@/hooks/useAppContent';

export default function Privacy() {
  const { privacyContent } = useAppContent();

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--brand-bg)', color: 'var(--brand-navy)', fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif" }}>
      <Header active="privacy" />

      {/* Hero Section */}
      <section style={{ padding: 'calc(var(--space-8) * 1.5) var(--space-8)', textAlign: 'center', backgroundImage: 'radial-gradient(circle at 1px 1px, var(--brand-border) 1px, transparent 0)', backgroundSize: '22px 22px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-4)', background: 'var(--brand-tag-bg)', color: 'var(--brand-navy)', fontSize: '12px', fontWeight: 700, padding: '6px 14px', borderRadius: '999px' }}>
            <i className="ph ph-shield-check" style={{ color: 'var(--brand-gold)' }}></i> حماية البيانات والأمان
          </span>
          <h1 style={{ fontSize: '38px', margin: '0 auto 12px', fontWeight: 800, color: 'var(--brand-navy)' }}>
            {privacyContent.title || 'سياسة الخصوصية'}
          </h1>
          <p style={{ color: 'var(--brand-muted)', maxWidth: '65ch', margin: '0 auto 16px', fontSize: '16px', lineHeight: 1.6 }}>
            {privacyContent.subtitle || 'نحن نلتزم بحماية بياناتك الشخصية وأبعاد تصاميمك بأعلى معايير الأمان والتشفير'}
          </p>
          <div style={{ fontSize: '13px', color: 'var(--brand-muted-2)', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fff', padding: '6px 16px', borderRadius: '8px', border: '1px solid var(--brand-border)' }}>
            <i className="ph ph-clock" style={{ color: 'var(--brand-gold)' }}></i>
            <span>تاريخ آخر تحديث: <strong>{privacyContent.lastUpdated || '10 أغسطس 2026'}</strong></span>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section style={{ padding: '0 var(--space-8) calc(var(--space-8) * 2)', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 'var(--space-8)', alignItems: 'start' }} className="privacy-grid">
          
          {/* Index Sidebar */}
          <div style={{ background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--brand-border)', padding: 'var(--space-5)', position: 'sticky', top: '100px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="ph ph-list-bullets" style={{ color: 'var(--brand-gold)' }}></i> بنود السياسة
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              {privacyContent.sections.map((sec, idx) => (
                <a
                  key={sec.id || idx}
                  href={`#${sec.id || `priv-${idx}`}`}
                  style={{ color: 'var(--brand-muted)', textDecoration: 'none', padding: '6px 10px', borderRadius: '6px', transition: 'all 0.2s', display: 'block', lineHeight: 1.4 }}
                  className="sidebar-link"
                >
                  {sec.title}
                </a>
              ))}
            </div>
          </div>

          {/* Sections List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {privacyContent.sections.map((sec, idx) => (
              <div
                key={sec.id || idx}
                id={sec.id || `priv-${idx}`}
                style={{
                  background: '#fff',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--brand-border)',
                  padding: 'var(--space-7)',
                  boxShadow: '0 4px 20px rgba(15,29,45,0.02)',
                  scrollMarginTop: '100px',
                }}
              >
                <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 12px', color: 'var(--brand-navy)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--brand-tag-bg)', color: 'var(--brand-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800 }}>
                    {idx + 1}
                  </span>
                  {sec.title}
                </h2>
                <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.8, color: 'var(--brand-muted)', whiteSpace: 'pre-line' }}>
                  {sec.content}
                </p>
              </div>
            ))}

          </div>

        </div>
      </section>

      <Footer />

      <style>{`
        @media (max-width: 850px) {
          .privacy-grid {
            grid-template-columns: 1fr !important;
          }
        }
        .sidebar-link:hover {
          background: var(--brand-tag-bg);
          color: var(--brand-navy) !important;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
