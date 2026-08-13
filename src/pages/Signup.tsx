import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { registerUser, loginUser } from '@/lib/userApi';
import { toast } from 'sonner';

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agree, setAgree] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !email || !password || !confirmPassword) {
      toast.error('يرجى تعبئة جميع الحقول المطلوبة');
      return;
    }

    if (password.length < 6) {
      toast.error('كلمة المرور يجب أن لا تقل عن 6 أحرف');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('كلمتا المرور غير متطابقتين');
      return;
    }

    if (!agree) {
      toast.error('يجب الموافقة على شروط الاستخدام وسياسة الخصوصية للمتابعة');
      return;
    }

    setLoading(true);
    try {
      // 1. Backend Edge Function / app_users table registration
      try {
        await registerUser(email, password, name);
      } catch (apiErr) {
        console.warn('Backend API registration:', apiErr);
      }

      // 2. Supabase Auth registration
      const { data: sbData } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            username: email.split('@')[0],
          }
        }
      });

      // 3. Attempt direct login against backend API / Supabase Session
      try {
        const loginRes = await loginUser(email, password);
        const session = {
          id: loginRes.user.id,
          username: loginRes.user.username,
          is_admin: loginRes.user.is_admin,
          max_employees: loginRes.user.max_employees || 0,
          employees_can_view_quotes: loginRes.user.employees_can_view_quotes || false,
          parent_user_id: null,
          pw: password,
          session_token: loginRes.session_token,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        };
        localStorage.setItem('printCalc_session', JSON.stringify(session));
        localStorage.setItem('printCalc_tabPermsSnapshot', JSON.stringify(loginRes.tab_permissions || []));
        toast.success('تم إنشاء الحساب وتسجيل الدخول بنجاح!');
        navigate('/');
        return;
      } catch {
        if (sbData?.session) {
          const session = {
            id: sbData.user?.id || `sb_${Date.now()}`,
            username: sbData.user?.email || email,
            is_admin: false,
            max_employees: 0,
            employees_can_view_quotes: false,
            parent_user_id: null,
            pw: password,
            session_token: sbData.session.access_token,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          };
          localStorage.setItem('printCalc_session', JSON.stringify(session));
          localStorage.setItem('printCalc_tabPermsSnapshot', JSON.stringify([]));
          toast.success('تم إنشاء الحساب وتسجيل الدخول بنجاح!');
          navigate('/');
          return;
        }
      }

      toast.success('تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.');
      navigate('/login');
    } catch (err: any) {
      toast.error(err.message || 'تعذر إنشاء الحساب');
    } finally {
      setLoading(false);
    }
  };

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--brand-bg)', color: 'var(--brand-navy)', display: 'grid', gridTemplateColumns: '1fr 1fr', fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif" }}>
      
      {/* ===== Visual side ===== */}
      <div style={{ position: 'relative', background: 'var(--brand-navy)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '26px 26px' }}></div>
        <div style={{ position: 'absolute', right: '-15%', bottom: '-10%', width: '420px', height: '420px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(224, 172, 105, 0.2), transparent 70%)' }}></div>

        <div style={{ position: 'relative', maxWidth: '400px', color: '#fff', textAlign: 'center' }}>
          <img src="/templates/preview/A10_75_03_03.svg" alt="معاينة قالب" style={{ width: '220px', height: 'auto', margin: '0 auto var(--space-6)', filter: 'brightness(0) invert(75%) sepia(21%) saturate(795%) hue-rotate(348deg) brightness(93%) contrast(91%) opacity(0.9)' }} />
          <h2 style={{ fontSize: '22px', marginBottom: '10px', fontWeight: 700, color: 'var(--brand-gold)' }}>انضم لمصممي التغليف</h2>
          <p style={{ fontSize: '14px', opacity: 0.9, lineHeight: 1.7 }}>
            احفظ قوالبك، خصص الأبعاد، وصدّر ملفات القص في دقائق.
          </p>
        </div>
      </div>

      {/* ===== Form side ===== */}
      <div style={{ display: 'flex', flexDirection: 'column', padding: 'var(--space-8)' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '18px', color: 'var(--brand-navy)', textDecoration: 'none' }}>
          <img src="/brand/printera-logo-trans.png" alt="Printera" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          <span>برين<span style={{ color: 'var(--brand-gold)' }}>تيرا</span></span>
        </Link>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: '380px' }}>
            <h1 style={{ fontSize: '28px', marginBottom: '6px', fontWeight: 700 }}>إنشاء حساب جديد</h1>
            <p style={{ color: 'var(--brand-muted)', fontSize: '14px', marginBottom: 'var(--space-6)' }}>
              ابدأ تصميم قوالب التغليف الخاصة بك مجانًا.
            </p>

            <form style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }} onSubmit={handleSubmit}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--brand-navy)' }}>الاسم الكامل</label>
                <input 
                  type="text" 
                  required 
                  placeholder="مثال: أحمد محمد" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', height: '46px', borderRadius: '10px', border: '1px solid var(--brand-border)', background: '#fff', padding: '0 14px', fontSize: '14px', fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif", color: 'var(--brand-navy)', outlineColor: 'var(--brand-gold)' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--brand-navy)' }}>البريد الإلكتروني</label>
                <input 
                  type="email" 
                  required 
                  placeholder="name@company.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', height: '46px', borderRadius: '10px', border: '1px solid var(--brand-border)', background: '#fff', padding: '0 14px', fontSize: '14px', fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif", color: 'var(--brand-navy)', outlineColor: 'var(--brand-gold)' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--brand-navy)' }}>كلمة المرور</label>
                <input 
                  type="password" 
                  required 
                  placeholder="8 أحرف على الأقل" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', height: '46px', borderRadius: '10px', border: '1px solid var(--brand-border)', background: '#fff', padding: '0 14px', fontSize: '14px', fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif", color: 'var(--brand-navy)', outlineColor: 'var(--brand-gold)' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--brand-navy)' }}>تأكيد كلمة المرور</label>
                <input 
                  type="password" 
                  required 
                  placeholder="أعد كتابة كلمة المرور" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', height: '46px', borderRadius: '10px', border: `1px solid ${mismatch ? '#ef4444' : 'var(--brand-border)'}`, background: '#fff', padding: '0 14px', fontSize: '14px', fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif", color: 'var(--brand-navy)', outlineColor: 'var(--brand-gold)' }} 
                />
                {mismatch && (
                  <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '5px' }}>كلمتا المرور غير متطابقتين</div>
                )}
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12.5px', color: 'var(--brand-navy)', cursor: 'pointer', lineHeight: '1.6' }}>
                <input 
                  type="checkbox" 
                  checked={agree} 
                  onChange={(e) => setAgree(e.target.checked)} 
                  style={{ marginTop: '3px', accentColor: 'var(--brand-gold)' }}
                />
                <span>أوافق على <a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'var(--brand-gold)' }}>شروط الاستخدام</a> و<a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'var(--brand-gold)' }}>سياسة الخصوصية</a></span>
              </label>

              <button 
                type="submit" 
                className="btn-anim" 
                disabled={loading}
                style={{ height: '48px', borderRadius: '999px', border: 'none', background: 'var(--brand-navy)', color: '#fff', fontWeight: 700, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {loading ? 'جاري التسجيل...' : (
                  <>
                    إنشاء الحساب <i className="ph ph-arrow-left"></i>
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
              onClick={() => toast.info('التسجيل عبر جوجل متوفر لعملاء الاشتراكات المؤسسية فقط.')}
              style={{ width: '100%', height: '48px', borderRadius: '999px', border: '1px solid var(--brand-border)', background: '#fff', color: 'var(--brand-navy)', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <i className="ph ph-google-logo"></i> التسجيل عبر جوجل
            </button>

            <p style={{ textAlign: 'center', fontSize: '13.5px', color: 'var(--brand-muted)', marginTop: 'var(--space-6)' }}>
              لديك حساب بالفعل؟ <Link to="/login" style={{ color: 'var(--brand-gold)', fontWeight: 700, textDecoration: 'none' }}>سجّل الدخول</Link>
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
