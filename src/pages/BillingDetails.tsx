import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { toast } from 'sonner';

export default function BillingDetails() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id: string; username: string; is_admin: boolean } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('printCalc_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.expiresAt && new Date(parsed.expiresAt) > new Date()) {
          setUser({ id: parsed.id, username: parsed.username, is_admin: parsed.is_admin });
          return;
        }
      }
      toast.error('يرجى تسجيل الدخول للوصول إلى بيانات الفوترة');
      navigate('/login');
    } catch {
      navigate('/login');
    }
  }, [navigate]);

  const plan = { name: 'خطة الأعمال', priceLabel: '149 ر.س / شهر', renewDate: '1 أغسطس 2026' };
  const card = { last4: '4242', expiry: '09/28' };
  const billingInfo = { company: 'ورشة التغليف الحديثة', taxId: '310123456700003', address: 'الرياض، حي العليا، السعودية' };

  const invoices = [
    { id: 'INV-2026-014', date: '1 يوليو 2026', amount: '149 ر.س' },
    { id: 'INV-2026-013', date: '1 يونيو 2026', amount: '149 ر.س' },
    { id: 'INV-2026-012', date: '1 مايو 2026', amount: '149 ر.س' },
    { id: 'INV-2026-011', date: '1 أبريل 2026', amount: '149 ر.س' },
  ];

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#faf6f0', color: '#2b2013', fontFamily: 'Cairo, sans-serif' }}>
      <Header />

      <div style={{ padding: 'var(--space-8)', maxWidth: '900px', margin: '0 auto' }}>
        
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#9c8f7c', marginBottom: 'var(--space-3)' }}>
          <Link to="/dashboard" style={{ color: '#9c8f7c', textDecoration: 'none' }}>حسابي</Link>
          <i className="ph ph-caret-left" style={{ fontSize: '11px' }}></i>
          <span style={{ color: '#2b2013', fontWeight: 600 }}>تفاصيل الفوترة</span>
        </div>
        <h1 style={{ fontSize: '26px', margin: '0 0 var(--space-6)', fontWeight: 700 }}>تفاصيل الفوترة</h1>

        {/* Current plan */}
        <div style={{ background: '#2b2013', color: '#fff', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-6)' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>الخطة الحالية</div>
            <div style={{ fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>{plan.name}</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>{plan.priceLabel} · يتجدد في {plan.renewDate}</div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Link to="/pricing" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', color: '#2b2013', fontWeight: 700, fontSize: '13.5px', padding: '11px 18px', borderRadius: '999px', textDecoration: 'none' }} className="btn-anim">
              ترقية الخطة
            </Link>
            <button 
              onClick={() => toast.info('يرجى التواصل مع الدعم الفني لإلغاء الاشتراك.')} 
              style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#fff', fontWeight: 600, fontSize: '13.5px', padding: '11px 18px', borderRadius: '999px', cursor: 'pointer' }}
            >
              إلغاء الاشتراك
            </button>
          </div>
        </div>

        {/* Payment method */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>طريقة الدفع</h2>
          <a href="#" onClick={(e) => { e.preventDefault(); toast.info('خدمة تغيير بطاقة الدفع غير متاحة حالياً.'); }} style={{ fontSize: '13.5px', fontWeight: 700, color: '#2b2013' }}>تغيير</a>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e6dccb', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
          <div style={{ width: '52px', height: '36px', borderRadius: '8px', background: '#f4ede1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ph ph-credit-card" style={{ fontSize: '20px', color: '#a9622f' }}></i>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>بطاقة تنتهي بـ {card.last4}</div>
            <div style={{ fontSize: '12.5px', color: '#9c8f7c', marginTop: '2px' }}>تنتهي صلاحيتها {card.expiry}</div>
          </div>
          <span style={{ background: '#f3e7d8', color: '#a9622f', fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '999px' }}>افتراضية</span>
        </div>

        {/* Billing address */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>بيانات الفوترة</h2>
          <a href="#" onClick={(e) => { e.preventDefault(); toast.info('لتغيير بيانات الفوترة، يرجى تقديم طلب دعم فني.'); }} style={{ fontSize: '13.5px', fontWeight: 700, color: '#2b2013' }}>تعديل</a>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e6dccb', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#9c8f7c', marginBottom: '4px' }}>اسم الشركة</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{billingInfo.company}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#9c8f7c', marginBottom: '4px' }}>الرقم الضريبي</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{billingInfo.taxId}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#9c8f7c', marginBottom: '4px' }}>العنوان</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{billingInfo.address}</div>
          </div>
        </div>

        {/* Invoices */}
        <h2 style={{ margin: '0 0 var(--space-4)', fontSize: '17px', fontWeight: 700 }}>الفواتير السابقة</h2>
        <div style={{ background: '#fff', border: '1px solid #e6dccb', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 100px', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)', background: '#f4ede1', fontSize: '12px', fontWeight: 700, color: '#5a4c3c' }}>
            <div>الفاتورة</div>
            <div>التاريخ</div>
            <div>المبلغ</div>
            <div></div>
          </div>
          {invoices.map((inv, idx) => (
            <div key={idx} className="row-hover" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 100px', gap: 'var(--space-2)', alignItems: 'center', padding: 'var(--space-4)', borderTop: '1px solid #eee2cf' }}>
              <div style={{ fontSize: '13.5px', fontWeight: 600 }}>{inv.id}</div>
              <div style={{ fontSize: '13px', color: '#8a7d6d' }}>{inv.date}</div>
              <div style={{ fontSize: '13.5px', fontWeight: 600 }}>{inv.amount}</div>
              <a href="#" onClick={(e) => { e.preventDefault(); toast.success('جاري تحميل الفاتورة بصيغة PDF...'); }} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', fontWeight: 700, color: '#2b2013', textDecoration: 'none' }}>
                <i className="ph ph-download-simple"></i> PDF
              </a>
            </div>
          ))}
        </div>

      </div>

      <Footer />
    </div>
  );
}
