import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

type SimpleActive = 'home' | 'contact' | 'about' | null;
type AppActive = 'library' | 'categories' | 'pricing' | 'template' | null;

interface HeaderProps {
  /** "simple" = text-nav header (الرئيسية/مكتبة القوالب/الأسعار/تواصل معنا/عننا).
   *  "app" = icon-nav header (العلب/التصنيفات/الأسعار) used on library/pricing/template pages. */
  variant?: 'simple' | 'app';
  active?: SimpleActive | AppActive;
  /** app variant only: page background the header sits on. */
  bg?: string;
  /** app variant only: guest right-side CTAs. "full" = login + signup, "simple" = login only. */
  guestCta?: 'full' | 'simple';
}

export default function Header({ variant = 'app', active = null, bg, guestCta = 'full' }: HeaderProps) {
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

  const navLink = (key: string | null, to: string, label: string) => (
    <Link to={to} style={{ color: active === key ? 'var(--brand-navy)' : 'var(--brand-muted)', fontWeight: active === key ? 700 : 400, fontSize: '14px' }}>
      {label}
    </Link>
  );

  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', borderBottom: '1px solid var(--brand-border)', padding: 'var(--space-4) var(--space-8)', background: bg || '#ffffff', position: 'sticky', top: 0, zIndex: 20 }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '18px' }}>
        <img src="/brand/printera-logo-trans.png" alt="Printera" className="anim-logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
        <span className="anim-slide-down" style={{ whiteSpace: 'nowrap' }}>برين<span style={{ color: 'var(--brand-gold)' }}>تيرا</span></span>
      </Link>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', marginInlineEnd: 'auto' }}>
        {navLink('home', '/', 'الرئيسية')}
        {navLink('library', '/templates', 'مكتبة القوالب')}
        {navLink('pricing', '/pricing', 'الأسعار')}
        {navLink('contact', '/contact', 'تواصل معنا')}
        {navLink('about', '/about', 'عننا')}
      </nav>
      {user ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={{ fontSize: '13.5px', color: 'var(--brand-muted)' }}>مرحبًا، {user.username}</span>
          <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--brand-navy)' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--brand-gold)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px' }}>
              {userInitial}
            </div>
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link to="/signup" className="btn-anim" style={{ background: 'var(--brand-navy)', color: '#fff', fontWeight: 700, fontSize: '14px', padding: '10px 20px', borderRadius: '999px' }}>ابدأ مجانًا</Link>
        </div>
      )}
    </header>
  );
}
