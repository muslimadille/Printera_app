import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function About() {
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--brand-bg)', color: 'var(--brand-navy)', fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif" }}>
      <Header active="about" />

      {/* Hero */}
      <section style={{ padding: 'calc(var(--space-8) * 2) var(--space-8)', textAlign: 'center', backgroundImage: 'radial-gradient(circle at 1px 1px, var(--brand-border) 1px, transparent 0)', backgroundSize: '22px 22px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-4)', background: 'var(--brand-tag-bg)', color: 'var(--brand-navy)', fontSize: '12px', fontWeight: 700, padding: '6px 14px', borderRadius: '999px' }}>
          <i className="ph ph-info" style={{ color: 'var(--brand-gold)' }}></i> عن برينتيرا
        </span>
        <h1 style={{ fontSize: '42px', margin: '0 auto 10px', fontWeight: 700 }}>نبتكر لتسهيل صناعة التغليف</h1>
        <p style={{ color: 'var(--brand-muted)', maxWidth: '60ch', margin: '0 auto', fontSize: '16px', lineHeight: 1.6 }}>
          أول منصة عربية بُنيت بخبرة فريق مصممين وفنيين متخصصين في تشكيل القوالب للمطابع ومصانع الكرتون.
        </p>
      </section>

      {/* Mission & Vision */}
      <section style={{ padding: 'var(--space-8) var(--space-8) calc(var(--space-8) * 2)', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
          <div className="hover-lift" style={{ background: '#fff', padding: 'var(--space-8)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--brand-border)', boxShadow: '0 4px 20px rgba(15,29,45,0.03)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--brand-tag-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-gold)', fontSize: '24px', marginBottom: 'var(--space-4)' }}>
              <i className="ph ph-target"></i>
            </div>
            <h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: 'var(--space-3)' }}>مهمتنا</h3>
            <p style={{ color: 'var(--brand-muted)', fontSize: '15px', lineHeight: 1.7, margin: 0 }}>
              تمكين المطابع ووكالات الدعاية والإعلان من الحصول على قوالب تغليف دقيقة هندسياً وجاهزة للإنتاج الفوري، مما يقلل من وقت التصميم ويمنع الأخطاء المكلفة في خطوط الإنتاج.
            </p>
          </div>

          <div className="hover-lift" style={{ background: '#fff', padding: 'var(--space-8)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--brand-border)', boxShadow: '0 4px 20px rgba(15,29,45,0.03)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--brand-tag-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-gold)', fontSize: '24px', marginBottom: 'var(--space-4)' }}>
              <i className="ph ph-eye"></i>
            </div>
            <h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: 'var(--space-3)' }}>رؤيتنا</h3>
            <p style={{ color: 'var(--brand-muted)', fontSize: '15px', lineHeight: 1.7, margin: 0 }}>
              أن نصبح المرجع الأول والمكتبة الأضخم لتصميم وإنتاج قوالب التغليف في الشرق الأوسط، وتقديم أدوات ذكية تسهل تحويل الأفكار الإبداعية إلى واقع ملموس بدقة فائقة.
            </p>
          </div>
        </div>
      </section>

      {/* Stats/Values */}
      <section style={{ padding: '0 var(--space-8) calc(var(--space-8) * 3)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', background: 'var(--brand-navy)', borderRadius: 'var(--radius-lg)', padding: 'calc(var(--space-8) * 1.5)', color: '#fff', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-8)', justifyContent: 'space-around', textAlign: 'center', boxShadow: '0 10px 40px rgba(15,29,45,0.2)' }}>
          <div>
            <div style={{ fontSize: '36px', fontWeight: 700, color: 'var(--brand-gold)', marginBottom: '8px' }}>+15</div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>سنة من الخبرة الفنية</div>
          </div>
          <div>
            <div style={{ fontSize: '36px', fontWeight: 700, color: 'var(--brand-gold)', marginBottom: '8px' }}>+500</div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>قالب هندسي دقيق</div>
          </div>
          <div>
            <div style={{ fontSize: '36px', fontWeight: 700, color: 'var(--brand-gold)', marginBottom: '8px' }}>100%</div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>جاهزية للقص والإنتاج</div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
