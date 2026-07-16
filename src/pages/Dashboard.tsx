import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { SavedQuote, listQuotes } from '@/lib/userApi';
import { toast } from 'sonner';

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
      fontFamily: 'Cairo, sans-serif',
      fontSize: '14px',
      fontWeight: isActive ? 700 : 600,
      color: isActive ? '#2b2013' : '#9c8f7c',
      borderBottom: `2px solid ${isActive ? '#a9622f' : 'transparent'}`,
      marginBottom: '-1px',
      transition: 'border-color .2s ease, color .2s ease',
    };
  };

  // Mock export history to match design
  const exportHistory = [
    { name: 'T0005_200x120x80.pdf', date: '12 يوليو 2026', format: 'PDF' },
    { name: 'T0002_180x100x60.svg', date: '9 يوليو 2026', format: 'SVG' },
    { name: 'T0006_sheet_layout.pdf', date: '2 يوليو 2026', format: 'PDF' },
    { name: 'D001_handle_box.dxf', date: '28 يونيو 2026', format: 'DXF' },
  ];

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
    <div dir="rtl" style={{ minHeight: '100vh', background: '#faf6f0', color: '#2b2013', fontFamily: 'Cairo, sans-serif' }}>
      <Header />

      <div style={{ padding: 'var(--space-8)', maxWidth: '960px', margin: '0 auto' }}>
        
        {/* Profile header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-8)', flexWrap: 'wrap' }}>
          <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: '#a9622f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '28px', flexShrink: 0 }}>
            {userInitial}
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <h1 style={{ fontSize: '24px', margin: '0 0 4px', fontWeight: 700 }}>{userName}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13.5px', color: '#8a7d6d' }}>{userEmail}</span>
              <span style={{ background: '#f3e7d8', color: '#a9622f', fontSize: '11.5px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px' }}>{userPlan}</span>
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => toast.info('تعديل الملف الشخصي متاح من خلال شاشة المشرف فقط.')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #e6dccb', background: '#fff', color: '#5a4c3c', fontWeight: 600, fontSize: '13.5px', padding: '10px 16px', borderRadius: '999px', cursor: 'pointer' }} 
            className="btn-anim"
          >
            <i className="ph ph-pencil-simple"></i> تعديل الملف الشخصي
          </button>
          <button 
            type="button" 
            onClick={handleSignOut}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', border: 'none', background: 'transparent', color: '#9c8f7c', fontSize: '13.5px', padding: '10px 12px', cursor: 'pointer' }}
          >
            <i className="ph ph-sign-out"></i> خروج
          </button>
        </div>

        {/* Tabs navigation */}
        <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid #e8ded0', marginBottom: 'var(--space-6)' }}>
          <button type="button" onClick={() => setActiveTab('saved')} style={tabStyle('saved')}>قوالبي المحفوظة</button>
          <button type="button" onClick={() => setActiveTab('orders')} style={tabStyle('orders')}>سجل التصدير</button>
          <button type="button" onClick={() => setActiveTab('account')} style={tabStyle('account')}>الحساب</button>
          <Link to="/billing" style={{ padding: '12px 18px', fontSize: '14px', fontWeight: 600, color: '#9c8f7c', textDecoration: 'none', borderBottom: '2px solid transparent', marginBottom: '-1px' }}>الفوترة</Link>
        </div>

        {/* Tab 1: Saved templates */}
        {activeTab === 'saved' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>قوالبي المحفوظة</h2>
              <Link to="/#library" style={{ fontSize: '13.5px', fontWeight: 700, color: '#2b2013', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                تصفح المزيد <i className="ph ph-arrow-left"></i>
              </Link>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>جاري تحميل قوالبك...</div>
            ) : savedTemplates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: '#9c8f7c', background: '#fff', borderRadius: '12px', border: '1px solid #e6dccb' }}>
                <i className="ph ph-cube" style={{ fontSize: '48px', color: '#d8cbb5', display: 'block', marginBottom: '10px' }}></i>
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
                      className="hover-lift" 
                      style={{ background: '#fff', border: '1px solid #e6dccb', borderRadius: 'var(--radius-lg)', overflow: 'hidden', display: 'block', textDecoration: 'none', color: 'inherit' }}
                    >
                      <div style={{ aspectRatio: '4/3', background: '#f4ede1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-3)' }}>
                        <img src={img} alt={t.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                      <div style={{ padding: 'var(--space-3)' }}>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '2px', color: '#2b2013' }}>{t.title}</div>
                        <div style={{ fontSize: '11.5px', color: '#9c8f7c' }}>آخر تعديل: {new Date(t.updated_at).toLocaleDateString('ar-SA')}</div>
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
            <div style={{ background: '#fff', border: '1px solid #e6dccb', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              {exportHistory.map((e, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4)', borderBottom: idx < exportHistory.length - 1 ? '1px solid #eee2cf' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <i className="ph ph-file-arrow-down" style={{ fontSize: '20px', color: '#a9622f' }}></i>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>{e.name}</div>
                      <div style={{ fontSize: '12px', color: '#9c8f7c', marginTop: '2px' }}>{e.date}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: '#8a7d6d', fontWeight: 600 }}>{e.format}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Account info */}
        {activeTab === 'account' && (
          <div>
            <h2 style={{ margin: '0 0 var(--space-4)', fontSize: '17px', fontWeight: 700 }}>معلومات الحساب</h2>
            <div style={{ background: '#fff', border: '1px solid #e6dccb', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-6)' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#9c8f7c', marginBottom: '4px' }}>الاسم</div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{userName}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#9c8f7c', marginBottom: '4px' }}>البريد الإلكتروني</div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{userEmail}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#9c8f7c', marginBottom: '4px' }}>الخطة الحالية</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#a9622f' }}>{userPlan}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button 
                  type="button" 
                  onClick={() => navigate('/billing')}
                  style={{ fontSize: '13.5px', fontWeight: 700, color: '#2b2013', border: '1px solid #e6dccb', background: '#fff', padding: '8px 16px', borderRadius: '999px', cursor: 'pointer' }}
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
