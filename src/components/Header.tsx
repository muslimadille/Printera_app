import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

interface HeaderProps {
  transparent?: boolean;
}

export default function Header({ transparent = false }: HeaderProps) {
  const location = useLocation();
  const [user, setUser] = useState<{ username: string; is_admin: boolean } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('printCalc_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.expiresAt && new Date(parsed.expiresAt) > new Date()) {
          setUser({ username: parsed.username, is_admin: parsed.is_admin });
        }
      }
    } catch {}
  }, [location.pathname]);

  const userInitial = user ? user.username.trim().charAt(0) : 'م';

  const isHome = location.pathname === '/';

  return (
    <header 
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-6)',
        borderBottom: transparent ? 'none' : '1px solid #e8ded0',
        padding: 'var(--space-4) var(--space-8)',
        background: transparent ? 'transparent' : '#ffffff',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '18px', letterSpacing: '-0.01em', color: '#2b2013' }}>
        <span style={{ width: '30px', height: '30px', borderRadius: 'var(--radius-md)', background: '#2b2013', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '15px', fontWeight: 700 }}>ق</span>
        قوالب<span style={{ color: '#a9622f' }}>لاين</span>
      </Link>
      
      <nav style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', marginInlineEnd: 'auto' }}>
        {isHome ? (
          <>
            <a href="#library" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#a9622f' }}>
              <i className="ph ph-cube" style={{ fontSize: '16px' }}></i> العلب
            </a>
            <a href="#categories" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#5a4c3c' }}>
              <i className="ph ph-squares-four" style={{ fontSize: '16px' }}></i> التصنيفات
            </a>
          </>
        ) : (
          <>
            <Link to="/#library" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#5a4c3c' }}>
              <i className="ph ph-cube" style={{ fontSize: '16px' }}></i> العلب
            </Link>
            <Link to="/#categories" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#5a4c3c' }}>
              <i className="ph ph-squares-four" style={{ fontSize: '16px' }}></i> التصنيفات
            </Link>
          </>
        )}
        <Link to="/pricing" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#5a4c3c' }}>
          <i className="ph ph-tag" style={{ fontSize: '16px' }}></i> الأسعار
        </Link>
      </nav>

      {user ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          {user.is_admin && (
            <Link to="/admin" className="btn-anim" style={{ fontSize: '13.5px', fontWeight: 600, color: '#a9622f', border: '1px solid #a9622f', borderRadius: '999px', padding: '6px 14px' }}>
              لوحة الإدارة
            </Link>
          )}
          <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#2b2013' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#a9622f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px' }}>
              {userInitial}
            </div>
            حسابي
          </Link>
        </div>
      ) : (
        <>
          <Link to="/login" className="btn-anim" style={{ color: '#5a4c3c', fontSize: '14px', fontWeight: 600, borderRadius: '999px', padding: '8px 10px' }}>
            تسجيل الدخول
          </Link>
          <Link to="/signup" className="btn-anim" style={{ background: '#2b2013', color: '#fff', fontWeight: 700, fontSize: '14px', padding: '10px 20px', borderRadius: '999px' }}>
            ابدأ مجانًا
          </Link>
        </>
      )}
    </header>
  );
}
