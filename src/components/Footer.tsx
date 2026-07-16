import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <>
      <footer 
        style={{
          padding: 'calc(var(--space-8) * 2.4) var(--space-8)',
          borderTop: '1px solid #e8ded0',
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr 1fr',
          gap: 'var(--space-8)',
          background: '#ffffff',
          color: '#2b2013',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: 'var(--space-2)', color: '#2b2013' }}>
            قوانب<span style={{ color: '#a9622f' }}>لاين</span>
          </div>
          <p style={{ fontSize: '13px', maxWidth: '32ch', color: '#8a7d6d', lineHeight: '1.6' }}>
            قوالب تغليف بارامترية دقيقة، بدون لصق، جاهزة للقص والإنتاج.
          </p>
        </div>
        <div>
          <h6 style={{ marginBottom: 'var(--space-3)', color: '#2b2013', fontWeight: 700 }}>القوالب</h6>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <Link to="/#library" style={{ color: '#5a4c3c' }}>تصفح كل العلب</Link>
            <Link to="/#how" style={{ color: '#5a4c3c' }}>كيف تعمل</Link>
            <a href="#" style={{ color: '#5a4c3c' }}>اطلب قالبًا</a>
          </div>
        </div>
        <div>
          <h6 style={{ marginBottom: 'var(--space-3)', color: '#2b2013', fontWeight: 700 }}>التصنيفات</h6>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <Link to="/#categories" style={{ color: '#5a4c3c' }}>طي وصواني</Link>
            <Link to="/#categories" style={{ color: '#5a4c3c' }}>علب أسطوانية</Link>
            <Link to="/#categories" style={{ color: '#5a4c3c' }}>تغليف تجزئة</Link>
          </div>
        </div>
      </footer>
      <div 
        style={{
          textAlign: 'center',
          padding: 'var(--space-4)',
          fontSize: '12px',
          color: '#9c8f7c',
          borderTop: '1px solid #e8ded0',
          background: '#ffffff',
        }}
      >
        © 2026 قوالبلاين
      </div>
    </>
  );
}
