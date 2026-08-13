import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { SavedQuote, listQuotes } from '@/lib/userApi';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'saved' | 'orders' | 'account'>('saved');
  const [user, setUser] = useState<{ id: string; username: string; is_admin: boolean } | null>(null);
  const [sessionToken, setSessionToken] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<SavedQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('printCalc_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.expiresAt && new Date(parsed.expiresAt) > new Date()) {
          // Force logout if old mock session
          if (parsed.id?.startsWith('mock-') || parsed.session_token?.startsWith('mock-')) {
            localStorage.removeItem('printCalc_session');
            toast.error('انتهت الجلسة. يرجى تسجيل الدخول مجدداً.');
            navigate('/login');
            return;
          }
          setUser({ id: parsed.id, username: parsed.username, is_admin: parsed.is_admin });
          setSessionToken(parsed.session_token || '');
          return;
        }
      }
      toast.error('يرجى تسجيل الدخول للوصول إلى لوحة التحكم');
      navigate('/login');
    } catch {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    if (!sessionToken) return;
    setLoading(true);
    listQuotes(sessionToken)
      .then((res) => {
        // Filter quotes that belong to boxes/templates
        setSavedTemplates(res.quotes || []);
      })
      .catch((err) => {
        console.error('Failed to load saved templates', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sessionToken]);

  const handleSignOut = () => {
    localStorage.removeItem('printCalc_session');
    localStorage.removeItem('printCalc_tabPermsSnapshot');
    toast.success('تم تسجيل الخروج بنجاح');
    navigate('/');
  };

  const userInitial = user ? user.username.trim().charAt(0) : 'م';
  const userName = user ? user.username : 'محمد العتيبي';
  const userEmail = user ? `${user.username}@company.com` : 'mohammed@company.com';
  const userPlan = user?.is_admin ? 'الخطة برو (مسؤول)' : 'خطة الأعمال';

  const tabStyle = (id: typeof activeTab) => {
    const isActive = id === activeTab;
    return {
      padding: '12px 18px',
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif",
      fontSize: '14px',
      fontWeight: isActive ? 700 : 600,
      color: isActive ? 'var(--brand-navy)' : 'var(--brand-muted)',
      borderBottom: `2px solid ${isActive ? 'var(--brand-navy)' : 'transparent'}`,
      marginBottom: '-1px',
      transition: 'border-color .2s ease, color .2s ease',
    };
  };

  const [exportHistory, setExportHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    async function fetchExportHistory() {
      if (!user) return;
      setLoadingHistory(true);
      try {
        const { data, error } = await supabase
          .from('export_history')
          .select('*')
          .eq('user_id', user.id)
          .order('exported_at', { ascending: false });
          
        if (!error && data && data.length > 0) {
          const formatted = data.map((d: any) => ({
            name: d.file_name,
            date: new Date(d.exported_at).toLocaleDateString('ar-SA'),
            format: d.format
          }));
          setExportHistory(formatted);
        } else {
          setExportHistory([]);
        }
      } catch (err) {
        console.error("Failed to fetch export history", err);
        setExportHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    }
    fetchExportHistory();
  }, [user]);

  // Helper to resolve template edit link with params
  const getEditLink = (t: SavedQuote) => {
    // Resolve template ID. e.g. T0005, etc.
    let templateId = 'T0005';
    if (t.source_type.startsWith('box_')) {
      templateId = t.source_type.replace('box_', '').toUpperCase();
    } else if (t.source_type === 'carryhandle') {
      templateId = 'HEX1';
    } else if (t.source_type === 'lidtuck') {
      templateId = 'T0002';
    }

    const data = t.quote_data || {};
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
  };

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--brand-bg)', color: 'var(--brand-navy)', fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif" }}>
      <Header />

      <div style={{ padding: 'var(--space-8)', maxWidth: '960px', margin: '0 auto' }}>
        
        {/* Profile header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-8)', flexWrap: 'wrap' }}>
          <div className="anim-logo" style={{ width: '76px', height: '76px', borderRadius: '50%', background: 'var(--brand-gold)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '28px', flexShrink: 0 }}>
            {userInitial}
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <h1 className="anim-slide-up delay-100" style={{ fontSize: '24px', margin: '0 0 4px', fontWeight: 700 }}>{userName}</h1>
            <div className="anim-slide-up delay-200" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13.5px', color: 'var(--brand-muted)' }}>{userEmail}</span>
              <span style={{ background: 'var(--brand-tag-bg)', color: 'var(--brand-navy)', fontSize: '11.5px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px' }}>{userPlan}</span>
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => toast.info('تعديل الملف الشخصي متاح من خلال شاشة المشرف فقط.')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--brand-border)', background: '#fff', color: 'var(--brand-navy)', fontWeight: 600, fontSize: '13.5px', padding: '10px 16px', borderRadius: '999px', cursor: 'pointer' }} 
            className="btn-anim"
          >
            <i className="ph ph-pencil-simple"></i> تعديل الملف الشخصي
          </button>
          <button 
            type="button" 
            onClick={handleSignOut}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', border: 'none', background: 'transparent', color: 'var(--brand-muted-2)', fontSize: '13.5px', padding: '10px 12px', cursor: 'pointer' }}
          >
            <i className="ph ph-sign-out"></i> خروج
          </button>
        </div>

        {/* Tabs navigation */}
        <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--brand-border)', marginBottom: 'var(--space-6)' }}>
          <button type="button" onClick={() => setActiveTab('saved')} style={tabStyle('saved')}>قوالبي المحفوظة</button>
          <button type="button" onClick={() => setActiveTab('orders')} style={tabStyle('orders')}>سجل التصدير</button>
          <button type="button" onClick={() => setActiveTab('account')} style={tabStyle('account')}>الحساب</button>
          <Link to="/billing" style={{ padding: '12px 18px', fontSize: '14px', fontWeight: 600, color: 'var(--brand-muted)', textDecoration: 'none', borderBottom: '2px solid transparent', marginBottom: '-1px' }}>الفوترة</Link>
        </div>

        {/* Tab 1: Saved templates */}
        {activeTab === 'saved' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>قوالبي المحفوظة</h2>
              <Link to="/templates" style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--brand-navy)', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                تصفح المزيد <i className="ph ph-arrow-left"></i>
              </Link>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>جاري تحميل قوالبك...</div>
            ) : savedTemplates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--brand-muted-2)', background: '#fff', borderRadius: '12px', border: '1px solid var(--brand-border)' }}>
                <i className="ph ph-cube" style={{ fontSize: '48px', color: 'var(--brand-border)', display: 'block', marginBottom: '10px' }}></i>
                ليس لديك أي قوالب محفوظة حالياً.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                {savedTemplates.map((t) => {
                  let img = '/templates/preview/A10_20_02_02.svg';
                  if (t.source_type.includes('t0002') || t.source_type.includes('lidtuck')) {
                    img = '/templates/preview/A10_10_03_03.svg';
                  } else if (t.source_type.includes('t0006')) {
                    img = '/templates/preview/A10_75_03_03.svg';
                  } else if (t.source_type.includes('d001')) {
                    img = '/templates/preview/A10_10_02_02_11.svg';
                  }
                  
                  return (
                    <Link 
                      key={t.id}
                      to={getEditLink(t)} 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover-lift" 
                      style={{ background: '#fff', border: '1px solid var(--brand-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', display: 'block', textDecoration: 'none', color: 'inherit' }}
                    >
                      <div style={{ aspectRatio: '4/3', background: 'var(--brand-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-3)' }}>
                        <img src={img} alt={t.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                      <div style={{ padding: 'var(--space-3)' }}>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '2px', color: 'var(--brand-navy)' }}>{t.title}</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--brand-muted-2)' }}>آخر تعديل: {new Date(t.updated_at).toLocaleDateString('ar-SA')}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Export logs */}
        {activeTab === 'orders' && (
          <div>
            <h2 style={{ margin: '0 0 var(--space-4)', fontSize: '17px', fontWeight: 700 }}>سجل التصدير</h2>
            <div style={{ background: '#fff', border: '1px solid var(--brand-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              {exportHistory.map((e, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4)', borderBottom: idx < exportHistory.length - 1 ? '1px solid var(--brand-border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <i className="ph ph-file-arrow-down" style={{ fontSize: '20px', color: 'var(--brand-navy)' }}></i>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>{e.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--brand-muted)', marginTop: '2px' }}>{e.date}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--brand-muted)', fontWeight: 600 }}>{e.format}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Account info */}
        {activeTab === 'account' && (
          <div>
            <h2 style={{ margin: '0 0 var(--space-4)', fontSize: '17px', fontWeight: 700 }}>معلومات الحساب</h2>
            <div style={{ background: '#fff', border: '1px solid var(--brand-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-6)' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--brand-muted)', marginBottom: '4px' }}>الاسم</div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{userName}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--brand-muted)', marginBottom: '4px' }}>البريد الإلكتروني</div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{userEmail}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--brand-muted)', marginBottom: '4px' }}>الخطة الحالية</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--brand-navy)' }}>{userPlan}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button 
                  type="button" 
                  onClick={() => navigate('/billing')}
                  style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--brand-navy)', border: '1px solid var(--brand-border)', background: '#fff', padding: '8px 16px', borderRadius: '999px', cursor: 'pointer' }}
                >
                  إدارة الاشتراك والفوترة
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      <Footer />
    </div>
  );
}
