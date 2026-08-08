import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser, forceLogin } from '@/lib/userApi';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ActiveSession {
  id: string;
  device_info: string | null;
  last_active_at: string;
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  // Device limit state
  const [showDeviceLimit, setShowDeviceLimit] = useState(false);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [forceLoading, setForceLoading] = useState(false);

  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    const isMobile = /Mobile|Android|iPhone/i.test(ua);
    return `${isMobile ? 'Mobile' : 'Desktop'} - ${navigator.platform}`;
  };

  const handleLoginSuccess = (result: any) => {
    const session = {
      id: result.user.id,
      username: result.user.username,
      is_admin: result.user.is_admin,
      max_employees: result.user.max_employees || 0,
      employees_can_view_quotes: result.user.employees_can_view_quotes || false,
      parent_user_id: result.user.parent_user_id ?? null,
      pw: password,
      session_token: result.session_token,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
    localStorage.setItem('printCalc_session', JSON.stringify(session));
    localStorage.setItem('printCalc_tabPermsSnapshot', JSON.stringify(result.tab_permissions || []));
    
    toast.success('تم تسجيل الدخول بنجاح');
    if (result.user.is_admin) {
      navigate('/admin');
    } else {
      navigate('/');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }
    setLoading(true);
    try {
      // 1. Check manage-users backend Edge Function / app_users table API
      const result = await loginUser(email, password, getDeviceInfo());
      handleLoginSuccess(result);
    } catch (err: any) {
      if (err.device_limit_reached) {
        setActiveSessions(err.active_sessions || []);
        setSelectedSessions([]);
        setShowDeviceLimit(true);
      } else {
        // 2. Fallback to Supabase Auth login
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (!error && data?.user) {
            handleLoginSuccess({
              user: {
                id: data.user.id,
                username: data.user.email || email,
                is_admin: false,
                max_employees: 0,
                employees_can_view_quotes: false,
              },
              session_token: data.session?.access_token || `sb_${Date.now()}`,
              tab_permissions: [],
            });
            return;
          }
        } catch {}

        toast.error(err.message || 'فشل تسجيل الدخول. يرجى التحقق من بياناتك.');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleSession = (id: string) => {
    setSelectedSessions(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleForceLogin = async () => {
    if (selectedSessions.length === 0) {
      toast.error('يرجى تحديد جلسة واحدة على الأقل لإنهائها');
      return;
    }
    setForceLoading(true);
    try {
      const result = await forceLogin(email, password, selectedSessions, getDeviceInfo());
      setShowDeviceLimit(false);
      handleLoginSuccess(result);
    } catch (err: any) {
      toast.error(err.message || 'تعذر إتمام الدخول القسري');
    } finally {
      setForceLoading(false);
    }
  };

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--brand-bg)', color: 'var(--brand-navy)', display: 'grid', gridTemplateColumns: '1fr 1fr', fontFamily: 'Cairo, sans-serif' }}>
      
      {/* ===== Form side ===== */}
      <div style={{ display: 'flex', flexDirection: 'column', padding: 'var(--space-8)' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '18px', color: 'var(--brand-navy)', textDecoration: 'none' }}>
          <img src="/brand/printera-logo-trans.png" alt="Printera" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          <span>برين<span style={{ color: 'var(--brand-gold)' }}>تيرا</span></span>
        </Link>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: '380px' }}>
            
            {!showDeviceLimit ? (
              <>
                <h1 style={{ fontSize: '28px', marginBottom: '6px', fontWeight: 700 }}>تسجيل الدخول</h1>
                <p style={{ color: 'var(--brand-muted)', fontSize: '14px', marginBottom: 'var(--space-6)' }}>
                  ادخل إلى حسابك لمتابعة تصميم قوالب التغليف الخاصة بك.
                </p>

                <form style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }} onSubmit={handleSubmit}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--brand-navy)' }}>اسم المستخدم أو البريد الإلكتروني</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="name@company.com" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', height: '46px', borderRadius: '10px', border: '1px solid var(--brand-border)', background: '#fff', padding: '0 14px', fontSize: '14px', fontFamily: 'Cairo,sans-serif', color: 'var(--brand-navy)', outlineColor: 'var(--brand-gold)' }} 
                    />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--brand-navy)' }}>كلمة المرور</label>
                      <a href="#" onClick={(e) => { e.preventDefault(); toast.info('يرجى التواصل مع مدير النظام لإعادة تعيين كلمة المرور الخاصة بك.'); }} style={{ fontSize: '12.5px', color: 'var(--brand-gold)', fontWeight: 600 }}>نسيت كلمة المرور؟</a>
                    </div>
                    <input 
                      type="password" 
                      required 
                      placeholder="••••••••" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', height: '46px', borderRadius: '10px', border: '1px solid var(--brand-border)', background: '#fff', padding: '0 14px', fontSize: '14px', fontFamily: 'Cairo,sans-serif', color: 'var(--brand-navy)', outlineColor: 'var(--brand-gold)' }} 
                    />
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--brand-navy)', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={rememberMe} 
                      onChange={(e) => setRememberMe(e.target.checked)} 
                      style={{ accentColor: 'var(--brand-navy)' }}
                    />
                    تذكرني على هذا الجهاز
                  </label>

                  <button 
                    type="submit" 
                    className="btn-anim" 
                    disabled={loading}
                    style={{ height: '48px', borderRadius: '999px', border: 'none', background: 'var(--brand-navy)', color: '#fff', fontWeight: 700, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    {loading ? 'جاري التحقق...' : (
                      <>
                        دخول <i className="ph ph-arrow-left"></i>
                      </>
                    )}
                  </button>
                </form>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 'var(--space-6) 0' }}>
                  <div style={{ flex: 1, height: '1px', background: 'var(--brand-border)' }}></div>
                  <span style={{ fontSize: '12px', color: 'var(--brand-muted)' }}>أو</span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--brand-border)' }}></div>
                </div>

                <button 
                  type="button" 
                  className="btn-anim" 
                  onClick={() => toast.info('تسجيل الدخول عبر جوجل متوفر لعملاء الاشتراكات المؤسسية فقط.')}
                  style={{ width: '100%', height: '48px', borderRadius: '999px', border: '1px solid var(--brand-border)', background: '#fff', color: 'var(--brand-navy)', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <i className="ph ph-google-logo"></i> الدخول عبر جوجل
                </button>

                <p style={{ textAlign: 'center', fontSize: '13.5px', color: 'var(--brand-muted)', marginTop: 'var(--space-6)' }}>
                  ليس لديك حساب؟ <Link to="/signup" style={{ color: 'var(--brand-gold)', fontWeight: 700, textDecoration: 'none' }}>أنشئ حسابًا جديدًا</Link>
                </p>
              </>
            ) : (
              <div style={{ animation: 'fade-in 0.3s ease-out' }}>
                <h1 style={{ fontSize: '24px', marginBottom: '8px', fontWeight: 700, color: '#ef4444' }}>وصلت إلى حد الأجهزة المسموح به</h1>
                <p style={{ color: 'var(--brand-muted)', fontSize: '13.5px', marginBottom: 'var(--space-5)', lineHeight: 1.6 }}>
                  الرجاء إنهاء إحدى الجلسات النشطة التالية للمتابعة على هذا الجهاز:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: 'var(--space-6)' }}>
                  {activeSessions.map((session) => (
                    <div 
                      key={session.id} 
                      onClick={() => toggleSession(session.id)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '12px', 
                        borderRadius: '8px', 
                        border: `1px solid ${selectedSessions.includes(session.id) ? 'var(--brand-gold)' : 'var(--brand-border)'}`,
                        background: selectedSessions.includes(session.id) ? 'var(--brand-tag-bg)' : '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--brand-navy)' }}>{session.device_info || 'جهاز غير معروف'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--brand-muted)', marginTop: '3px' }}>نشط منذ: {new Date(session.last_active_at).toLocaleString('ar-SA')}</div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={selectedSessions.includes(session.id)} 
                        onChange={() => {}} // handled by div click
                        style={{ accentColor: 'var(--brand-gold)' }}
                      />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    type="button"
                    onClick={handleForceLogin}
                    disabled={forceLoading || selectedSessions.length === 0}
                    style={{ flex: 1, height: '44px', border: 'none', borderRadius: '999px', background: 'var(--brand-navy)', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
                  >
                    {forceLoading ? 'جاري الإنهاء والتحويل...' : 'إنهاء الجلسات المحددة والدخول'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowDeviceLimit(false)}
                    style={{ height: '44px', border: '1px solid var(--brand-border)', borderRadius: '999px', background: '#fff', color: 'var(--brand-navy)', fontWeight: 600, fontSize: '14px', padding: '0 20px', cursor: 'pointer' }}
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ===== Visual side ===== */}
      <div style={{ position: 'relative', background: 'var(--brand-navy)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '26px 26px' }}></div>
        <div style={{ position: 'absolute', left: '-15%', top: '-10%', width: '420px', height: '420px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(224, 172, 105, 0.2), transparent 70%)' }}></div>

        <div style={{ position: 'relative', maxWidth: '400px', color: '#fff', textAlign: 'center' }}>
          <img src="/templates/preview/A10_20_02_02.svg" alt="معاينة قالب" style={{ width: '220px', height: 'auto', margin: '0 auto var(--space-6)', filter: 'brightness(0) invert(75%) sepia(21%) saturate(795%) hue-rotate(348deg) brightness(93%) contrast(91%) opacity(0.9)' }} />
          <h2 style={{ fontSize: '22px', marginBottom: '10px', fontWeight: 700, color: 'var(--brand-gold)' }}>دقة هندسية في كل قصة كرتون</h2>
          <p style={{ fontSize: '14px', opacity: 0.9, lineHeight: 1.7 }}>
            قوالب بارامترية جاهزة للقص والطباعة، مبنية على معايير التغليف الصناعية.
          </p>
        </div>
      </div>

    </div>
  );
}
