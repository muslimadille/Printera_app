import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TemplateCard from '@/components/TemplateCard';
import { HERO_STATS } from './TemplatesLibrary';
import { SavedQuote, listQuotes } from '@/lib/userApi';
import { supabase } from '@/integrations/supabase/client';

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!ref.current || shown) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);
  return { ref, shown };
}

const RevealAnim = ({
  children,
  animationClass = '',
  delay = 0,
}: {
  children: React.ReactNode;
  animationClass?: string;
  delay?: number;
}) => {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={shown ? animationClass : ''}
      style={{
        opacity: shown ? undefined : 0,
        animationDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};

const CATEGORY_ICONS: Record<string, string> = {
  folding: 'ph ph-package',
  tube: 'ph ph-cylinder',
  heavy: 'ph ph-cube',
  lidbase: 'ph ph-archive',
  retail: 'ph ph-shopping-bag',
  slide: 'ph ph-tray',
  nonrect: 'ph ph-hexagon',
};

const MOST_USED_IDS = ['T0005', 'T0002', 'T0006', 'D001-H'];

// Maps a saved quote's source_type to a representative preview image, the
// same heuristic Dashboard.tsx uses for its "saved templates" tab.
function previewFor(sourceType: string) {
  if (sourceType.includes('t0002') || sourceType.includes('lidtuck')) return '/templates/preview/A10_10_03_03.svg';
  if (sourceType.includes('t0006')) return '/templates/preview/A10_75_03_03.svg';
  if (sourceType.includes('d001')) return '/templates/preview/A10_10_02_02_11.svg';
  return '/templates/preview/A10_20_02_02.svg';
}

function editLinkFor(t: SavedQuote) {
  let templateId = 'T0005';
  if (t.source_type.startsWith('box_')) {
    templateId = t.source_type.replace('box_', '').toUpperCase();
  } else if (t.source_type === 'carryhandle') {
    templateId = 'HEX1';
  } else if (t.source_type === 'lidtuck') {
    templateId = 'T0002';
  }

  const data: Record<string, any> = t.quote_data || {};
  const query = new URLSearchParams({
    width: data.width || '200',
    height: data.height || '120',
    depth: data.depth || '80',
    glueFlap: data.glueFlap || '15',
    lidTongue: data.lidTongue || '20',
    dustFlap: data.dustFlap || '18',
    sheetWidth: data.sheetWidth || '700',
    sheetHeight: data.sheetHeight || '1000',
    gripper: data.gripper || '12',
    sheetMargin: data.sheetMargin || '5',
    unit: data.unit || 'mm',
    allowRotation: data.allowRotation !== false ? 'true' : 'false',
    rotationMode: data.rotationMode || 'auto',
  }).toString();

  return `/template/${templateId}?${query}`;
}

export default function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [sessionToken, setSessionToken] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<SavedQuote[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [homeCategories, setHomeCategories] = useState<any[]>([]);
  const [mostUsedTemplates, setMostUsedTemplates] = useState<any[]>([]);

  useEffect(() => {
    async function fetchHomeData() {
      try {
        const [catRes, tempRes] = await Promise.all([
          supabase.from('app_categories').select('*'),
          supabase.from('app_templates').select('*').in('id', MOST_USED_IDS)
        ]);
        if (catRes.data) {
          setHomeCategories(catRes.data);
        }
        if (tempRes.data) {
          const sorted = MOST_USED_IDS.map(id => tempRes.data.find(t => t.id === id)).filter(Boolean);
          setMostUsedTemplates(sorted);
        }
      } catch (err) {
        console.error("Failed to fetch home data", err);
      }
    }
    fetchHomeData();
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('printCalc_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.expiresAt && new Date(parsed.expiresAt) > new Date()) {
          setUser({ username: parsed.username });
          setSessionToken(parsed.session_token || '');
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!sessionToken) return;
    setLoadingSaved(true);
    listQuotes(sessionToken)
      .then((res) => setSavedTemplates(res.quotes || []))
      .catch(() => {})
      .finally(() => setLoadingSaved(false));
  }, [sessionToken]);

  const goSearch = () => {
    navigate(`/templates?q=${encodeURIComponent(query)}`);
  };

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--brand-bg)', color: 'var(--brand-navy)' }}>
      <Header variant="simple" active="home" />

      {/* Intro banner */}
      <section
        style={{
          padding: 'calc(var(--space-8) * 2) var(--space-8)',
          background: 'var(--brand-bg)',
          backgroundImage: 'radial-gradient(circle at 1px 1px, var(--brand-border) 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      >
        <div style={{ maxWidth: '820px', margin: '0 auto', textAlign: 'center' }}>
          <RevealAnim animationClass="anim-logo" delay={0}>
            <img
              src="/brand/printera-logo-trans.png"
              alt="Printera"
              style={{ width: '845px', maxWidth: '100%', height: 'auto', aspectRatio: '845 / 231', objectFit: 'contain', margin: '0 auto var(--space-5)', display: 'block' }}
            />
          </RevealAnim>
          <RevealAnim animationClass="anim-slide-up" delay={300}>
            <h1 style={{ fontSize: '38px', margin: '0 0 var(--space-4)', color: 'var(--brand-navy)', fontWeight: 700, lineHeight: 1.4 }}>
              قوالب جاهزة للتنفيذ... كما يجب أن تكون بخبرة متخصصين بتصنيع القوالب للمطابع
            </h1>
          </RevealAnim>
          <RevealAnim animationClass="anim-slide-up" delay={600}>
            <p style={{ fontSize: '16px', color: 'var(--brand-gold)', fontWeight: 700, margin: '0 0 var(--space-6)' }}>
              أول منصة عربية بُنيت بخبرة فريق مصممين وفنيين متخصصين في تشكيل القوالب
            </p>
          </RevealAnim>
          <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap', justifyContent: 'center' }}>
            {HERO_STATS.map((b, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: 'var(--brand-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {b.label} <i className={b.icon} style={{ color: 'var(--brand-gold)', fontSize: '17px' }}></i>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ width: '100%', boxSizing: 'border-box', padding: 'calc(var(--space-8) * 1.6) var(--space-8)' }}>

        {/* Search-first hero */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <h2 style={{ fontSize: '30px', margin: '0 0 8px', color: 'var(--brand-navy)' }}>وش القالب اللي تدور عليه؟</h2>
          <p style={{ color: 'var(--brand-muted)', fontSize: '15px', margin: '0 0 var(--space-6)' }}>اكتب اسم العلبة أو المقاس، أو اختر تصنيف بالأسفل</p>
          <div style={{ position: 'relative', maxWidth: '520px', margin: '0 auto' }}>
            <i className="ph ph-magnifying-glass" style={{ position: 'absolute', insetInlineStart: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', color: 'var(--brand-muted-2)' }}></i>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') goSearch(); }}
              placeholder="مثال: علبة بمقبض، صندوق شحن..."
              style={{
                width: '100%', boxSizing: 'border-box', height: '54px', borderRadius: '999px',
                border: '1px solid var(--brand-gold)', background: '#fff',
                paddingInlineStart: '48px', paddingInlineEnd: '20px', fontSize: '15px',
                color: 'var(--brand-navy)', boxShadow: '0 6px 18px rgba(15,29,45,0.06)', outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Category quick-access */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
          {homeCategories.map((c) => (
            <Link
              key={c.id}
              to={`/templates?cat=${c.id}`}
              className="cat-tile"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', background: '#fff', border: '1px solid var(--brand-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-8) var(--space-3)', textAlign: 'center' }}
            >
              <span className="cat-icon" style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--brand-tile-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={CATEGORY_ICONS[c.id] || 'ph ph-cube'} style={{ fontSize: '22px', color: 'var(--brand-gold)' }}></i>
              </span>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--brand-navy)' }}>{c.label}</span>
            </Link>
          ))}
        </div>

        {/* Most used templates */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ margin: 0, fontSize: '17px' }}>قوالبك الأكثر استخدامًا</h2>
          <Link to="/templates" className="link-arrow" style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--brand-navy)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            كل القوالب <i className="ph ph-arrow-left"></i>
          </Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
          {mostUsedTemplates.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>

        {/* Saved templates */}
        {user && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ margin: 0, fontSize: '17px' }}>القوالب المحفوظة</h2>
              <Link to="/dashboard" className="link-arrow" style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--brand-navy)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                كل المحفوظات <i className="ph ph-arrow-left"></i>
              </Link>
            </div>

            {loadingSaved ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--brand-muted-2)' }}>جاري تحميل قوالبك...</div>
            ) : savedTemplates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'calc(var(--space-8) * 1.4) var(--space-4)', background: '#fff', border: '1px dashed var(--brand-border)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-8)' }}>
                <i className="ph ph-cube-transparent" style={{ fontSize: '36px', display: 'block', marginBottom: 'var(--space-3)', color: 'var(--brand-muted-2)' }}></i>
                <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>لا توجد قوالب محفوظة</div>
                <p style={{ fontSize: '13.5px', color: 'var(--brand-muted-2)', margin: '0 0 var(--space-5)' }}>احفظ قوالبك المفضلة من المكتبة لتجدها هنا بسرعة.</p>
                <Link to="/templates" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--brand-navy)', color: '#fff', fontWeight: 700, fontSize: '13.5px', padding: '10px 18px', borderRadius: '999px' }}>
                  تصفح المكتبة <i className="ph ph-arrow-left"></i>
                </Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
                {savedTemplates.slice(0, 4).map((t) => (
                  <Link
                    key={t.id}
                    to={editLinkFor(t)}
                    className="hover-lift"
                    style={{ background: '#fff', border: '1px solid var(--brand-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', display: 'block', color: 'inherit' }}
                  >
                    <div style={{ aspectRatio: '4/3', background: 'var(--brand-tile-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-3)' }}>
                      <img src={previewFor(t.source_type)} alt={t.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div style={{ padding: 'var(--space-3)' }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '2px', color: 'var(--brand-navy)' }}>{t.title}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--brand-muted-2)' }}>آخر تعديل: {new Date(t.updated_at).toLocaleDateString('ar-SA')}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

      </div>

      <Footer variant="simple" />
    </div>
  );
}
