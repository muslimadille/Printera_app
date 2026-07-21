import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '@/lib/userApi';
import { toast } from 'sonner';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !otp) {
      toast.error('يرجى تعبئة كافة البيانات بما فيها رمز التحقق الثنائي (2FA)');
      return;
    }

    setLoading(true);
    try {
      const result = await loginUser(email, password, 'Admin Panel Portal');
      
      if (!result.user.is_admin) {
        toast.error('هذا الحساب لا يملك صلاحيات إدارية لدخول لوحة تحكم المسؤولين');
        return;
      }

      // Check OTP placeholder (in a real production app this is validated on the backend)
      if (otp.length !== 6 || isNaN(Number(otp))) {
        toast.error('رمز التحقق الثنائي غير صحيح');
        return;
      }

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

      toast.success('مرحباً بك في لوحة تحكم المسؤولين');
      navigate('/admin');
    } catch (err: any) {
      toast.error(err.message || 'فشل التحقق من بيانات الدخول الإدارية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cairo, sans-serif', padding: '20px', position: 'relative', overflow: 'hidden' }}>
      
      {/* Background decorations */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '26px 26px', pointerEvents: 'none' }}></div>
      <div style={{ position: 'absolute', right: '-10%', top: '-10%', width: '420px', height: '420px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.25), transparent 70%)', pointerEvents: 'none' }}></div>

      <div className="hover-lift" style={{ width: '100%', maxWidth: '400px', background: '#332616', border: '1px solid #334155', borderRadius: 'var(--radius-lg)', padding: 'var(--space-8)', zIndex: 10 }}>
        
        {/* Logo block */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContext: 'space-between', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#3b82f6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '15px', fontWeight: 700 }}>ق</span>
            <span style={{ fontWeight: 700, fontSize: '17px', color: '#fff' }}>قوالب<span style={{ color: '#c98a52' }}>لاين</span></span>
          </div>
          <span style={{ fontSize: '11px', color: '#a89c88', background: '#334155', padding: '3px 8px', borderRadius: '4px' }}>لوحة تحكم الإدارة</span>
        </div>

        <h1 style={{ fontSize: '22px', color: '#fff', fontWeight: 700, margin: '0 0 6px' }}>تسجيل دخول المسؤول</h1>
        <p style={{ fontSize: '13.5px', color: '#a89c88', margin: '0 0 var(--space-6)', lineHeight: 1.5 }}>هذه اللوحة مخصصة لفريق الإدارة فقط.</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#c9bfae', marginBottom: '6px' }}>البريد الإلكتروني الإداري</label>
            <input 
              type="text" 
              required
              placeholder="admin@qawalibline.sa"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', height: '46px', borderRadius: '10px', border: '1px solid #334155', background: '#1e293b', padding: '0 14px', fontSize: '14px', fontFamily: 'Cairo,sans-serif', color: '#f1f5f9' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#c9bfae', marginBottom: '6px' }}>كلمة المرور</label>
            <input 
              type="password" 
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', height: '46px', borderRadius: '10px', border: '1px solid #334155', background: '#1e293b', padding: '0 14px', fontSize: '14px', fontFamily: 'Cairo,sans-serif', color: '#f1f5f9' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#c9bfae', marginBottom: '6px' }}>رمز التحقق الثنائي (2FA)</label>
            <input 
              type="text" 
              required
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', height: '46px', borderRadius: '10px', border: '1px solid #334155', background: '#1e293b', padding: '0 14px', fontSize: '16px', fontWeight: 700, letterSpacing: '6px', textAlign: 'center', fontFamily: 'Cairo,sans-serif', color: '#f1f5f9' }}
            />
          </div>

          <button 
            type="submit"
            className="btn-anim"
            disabled={loading}
            style={{ width: '100%', height: '48px', borderRadius: '999px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', marginTop: '10px' }}
          >
            {loading ? 'جاري التحقق...' : (
              <>
                <i className="ph ph-shield-check" style={{ fontSize: '18px' }}></i>
                دخول إلى لوحة الإدارة
              </>
            )}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', justifyContext: 'center', justifyContent: 'center', gap: '6px', marginTop: 'var(--space-6)', fontSize: '12px', color: '#a89c88' }}>
          <i className="ph ph-lock"></i>
          <span>جميع محاولات الدخول مسجّلة لأغراض أمنية.</span>
        </div>

      </div>

    </div>
  );
}
