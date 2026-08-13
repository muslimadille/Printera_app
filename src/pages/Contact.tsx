import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function Contact() {
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--brand-bg)', color: 'var(--brand-navy)', fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif" }}>
      <Header active="contact" />
      <section style={{ padding: 'calc(var(--space-8) * 2) var(--space-8)', textAlign: 'center', backgroundImage: 'radial-gradient(circle at 1px 1px, var(--brand-border) 1px, transparent 0)', backgroundSize: '22px 22px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-4)', background: 'var(--brand-tag-bg)', color: 'var(--brand-navy)', fontSize: '12px', fontWeight: 700, padding: '6px 14px', borderRadius: '999px' }}>
          <i className="ph ph-envelope-simple" style={{ color: 'var(--brand-gold)' }}></i> تواصل معنا
        </span>
        <h1 style={{ fontSize: '42px', margin: '0 auto 10px', fontWeight: 700 }}>كيف يمكننا مساعدتك؟</h1>
        <p style={{ color: 'var(--brand-muted)', maxWidth: '52ch', margin: '0 auto', fontSize: '15px', lineHeight: 1.6 }}>
          سواء كان لديك استفسار عن قوالب التغليف أو خطط الاشتراك، فإن فريقنا متواجد دائماً للرد وتقديم الدعم الكامل.
        </p>
      </section>

      <section style={{ padding: '0 var(--space-8) calc(var(--space-8) * 2)', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-8)' }}>
          {/* Info */}
          <div>
            <h3 style={{ fontSize: '20px', marginBottom: 'var(--space-6)', fontWeight: 700 }}>معلومات التواصل</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--brand-tag-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-gold)', fontSize: '20px' }}>
                  <i className="ph ph-envelope-simple"></i>
                </div>
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--brand-muted)', fontWeight: 600 }}>البريد الإلكتروني</div>
                  <div style={{ fontWeight: 700 }}>support@printera.com</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--brand-tag-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-gold)', fontSize: '20px' }}>
                  <i className="ph ph-phone"></i>
                </div>
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--brand-muted)', fontWeight: 600 }}>رقم الهاتف</div>
                  <div style={{ fontWeight: 700, direction: 'ltr', textAlign: 'right' }}>+966 50 123 4567</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--brand-tag-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-gold)', fontSize: '20px' }}>
                  <i className="ph ph-map-pin"></i>
                </div>
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--brand-muted)', fontWeight: 600 }}>الموقع</div>
                  <div style={{ fontWeight: 700 }}>الرياض، المملكة العربية السعودية</div>
                </div>
              </div>
            </div>
            
            <div style={{ height: '1px', background: 'var(--brand-border)', margin: 'var(--space-6) 0' }}></div>
            
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--brand-muted)', lineHeight: 1.6 }}>
              ساعات العمل الرسمية: الأحد إلى الخميس، من 9 صباحاً حتى 6 مساءً بتوقيت الرياض.
            </p>
          </div>
          
          {/* Form */}
          <div style={{ background: '#fff', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--brand-border)', boxShadow: '0 4px 20px rgba(15,29,45,0.03)' }}>
            <form style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }} onSubmit={(e) => { e.preventDefault(); alert('تم إرسال رسالتك بنجاح!'); }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--brand-navy)', marginBottom: '6px' }}>الاسم الكامل</label>
                <input type="text" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1px solid var(--brand-border)', borderRadius: 'var(--radius-md)', background: 'var(--brand-tag-bg)', outline: 'none', fontFamily: 'inherit' }} placeholder="أدخل اسمك" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--brand-navy)', marginBottom: '6px' }}>البريد الإلكتروني</label>
                <input type="email" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1px solid var(--brand-border)', borderRadius: 'var(--radius-md)', background: 'var(--brand-tag-bg)', outline: 'none', fontFamily: 'inherit', direction: 'ltr' }} placeholder="example@domain.com" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--brand-navy)', marginBottom: '6px' }}>الموضوع</label>
                <input type="text" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1px solid var(--brand-border)', borderRadius: 'var(--radius-md)', background: 'var(--brand-tag-bg)', outline: 'none', fontFamily: 'inherit' }} placeholder="عنوان الرسالة" required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--brand-navy)', marginBottom: '6px' }}>الرسالة</label>
                <textarea rows={4} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1px solid var(--brand-border)', borderRadius: 'var(--radius-md)', background: 'var(--brand-tag-bg)', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} placeholder="كيف يمكننا مساعدتك؟" required></textarea>
              </div>
              <button type="submit" className="btn-anim hover-lift" style={{ width: '100%', padding: '12px', background: 'var(--brand-navy)', color: '#fff', border: 'none', borderRadius: '999px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', marginTop: 'var(--space-2)' }}>
                إرسال الرسالة
              </button>
            </form>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
