import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import UserManagement from '@/components/UserManagement';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<'overview' | 'templates' | 'orders' | 'users' | 'billing' | 'settings'>('overview');
  const [session, setSession] = useState<any>(null);
  const [usersTab, setUsersTab] = useState<'list' | 'roles'>('list');
  const [search, setSearch] = useState('');

  // Template Editing State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateCat, setTemplateCat] = useState('');
  const [templateW, setTemplateW] = useState('');
  const [templateH, setTemplateH] = useState('');
  const [templateD, setTemplateD] = useState('');

  // Preview Settings State
  const [showNestingPreview, setShowNestingPreview] = useState(true);
  const [show3DPreview, setShow3DPreview] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('printCalc_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.expiresAt && new Date(parsed.expiresAt) > new Date() && parsed.is_admin) {
          if (parsed.id?.startsWith('mock-') || parsed.session_token?.startsWith('mock-')) {
            localStorage.removeItem('printCalc_session');
            toast.error('انتهت الجلسة. يرجى تسجيل الدخول مجدداً.');
            navigate('/admin/login');
            return;
          }
          setSession(parsed);
          
          // Load preview settings
          const previewSettings = localStorage.getItem('printCalc_previewSettings');
          if (previewSettings) {
            const parsedSettings = JSON.parse(previewSettings);
            setShowNestingPreview(parsedSettings.showNestingPreview ?? true);
            setShow3DPreview(parsedSettings.show3DPreview ?? true);
          }
          
          return;
        }
      }
      toast.error('الدخول للمسؤولين فقط. يرجى تسجيل الدخول الإداري.');
      navigate('/admin/login');
    } catch {
      navigate('/admin/login');
    }
  }, [navigate]);

  const [dbTemplates, setDbTemplates] = useState<any[]>([]);

  useEffect(() => {
    async function loadAdminData() {
      const { data } = await supabase.from('app_templates').select('*');
      if (data) setDbTemplates(data);
    }
    if (session) loadAdminData();
  }, [session]);

  if (!session) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>جاري التحقق من الهوية الإدارية...</div>;
  }

  const handleSignOut = () => {
    localStorage.removeItem('printCalc_session');
    localStorage.removeItem('printCalc_tabPermsSnapshot');
    toast.success('تم تسجيل الخروج الإداري');
    navigate('/admin/login');
  };

  // Mock Data
  const recentOrders = [
    { id: 'ORD-2026-908', customer: 'أحمد الغامدي', date: 'منذ ساعتين', template: 'T0005', amount: '119 ر.س', status: 'completed', statusLabel: 'مكتمل' },
    { id: 'ORD-2026-907', customer: 'شركة حلول الرياض', date: 'منذ 5 ساعات', template: 'T0012', amount: '359 ر.س', status: 'completed', statusLabel: 'مكتمل' },
    { id: 'ORD-2026-906', customer: 'مخبز الكرم', date: 'منذ يوم', template: 'D001-H', amount: '119 ر.س', status: 'pending', statusLabel: 'قيد المراجعة' },
    { id: 'ORD-2026-905', customer: 'رائد المطيري', date: 'منذ يومين', template: 'T0002', amount: '0 ر.س', status: 'cancelled', statusLabel: 'ملغي' },
  ];

  const recentUsers = [
    { name: 'فهد السبيعي', email: 'fahad@company.com', date: 'منذ ساعة' },
    { name: 'عمر القحطاني', email: 'omar@site.sa', date: 'منذ 4 ساعات' },
    { name: 'منى الحربي', email: 'mona.h@design.com', date: 'منذ يوم' },
  ];



  const openTemplateEdit = (t: any) => {
    setSelectedTemplateId(t.id || '');
    setTemplateName(t.title || '');
    setTemplateCat(t.categoryLabel || t.category || '');
    setTemplateW('200');
    setTemplateH('120');
    setTemplateD('80');
  };

  const handleSaveTemplate = () => {
    toast.success('تم حفظ التغييرات بنجاح');
    setSelectedTemplateId(null);
  };

  // Nav side items list
  const navItems = [
    { id: 'overview', label: 'لوحة القيادة', icon: 'ph ph-squares-four' },
    { id: 'templates', label: 'القوالب', icon: 'ph ph-cube' },
    { id: 'orders', label: 'الطلبات', icon: 'ph ph-shopping-cart' },
    { id: 'users', label: 'المستخدمون', icon: 'ph ph-users' },
    { id: 'billing', label: 'الفوترة', icon: 'ph ph-receipt' },
    { id: 'settings', label: 'الإعدادات', icon: 'ph ph-gear' },
  ] as const;

  const styleTable: React.CSSProperties = {
    borderCollapse: 'collapse',
    width: '100%',
  };

  const styleTdTh: React.CSSProperties = {
    padding: '12px 14px',
    fontSize: '13.5px',
    textAlign: 'right',
  };

  const styleTh: React.CSSProperties = {
    ...styleTdTh,
    background: '#f1f5f9',
    color: '#5a4c3c',
    fontWeight: 700,
    borderBottom: '1px solid #e2e8f0',
  };

  const styleTd: React.CSSProperties = {
    ...styleTdTh,
    borderBottom: '1px solid #f2e9d9',
    color: '#1e293b',
  };

  const badgeColor = (status: string) => {
    if (status === 'completed') return { bg: '#e6f4ea', color: '#3f8f5c' };
    if (status === 'pending') return { bg: '#fdf3d9', color: '#b98a17' };
    return { bg: '#fbe7e5', color: '#c0392b' };
  };

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', fontFamily: 'Cairo, sans-serif' }}>
      
      {/* ===== Sidebar ===== */}
      <aside style={{ width: '240px', background: '#1e293b', color: '#f1f5f9', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ padding: 'var(--space-6) var(--space-5)', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContext: 'space-between', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="anim-logo" style={{ width: '30px', height: '30px', borderRadius: 'var(--radius-sm)', background: '#3b82f6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '15px', fontWeight: 700 }}>ق</span>
            <span className="anim-slide-down" style={{ fontWeight: 700, fontSize: '16px', color: '#fff' }}>قوالب<span style={{ color: '#c98a52' }}>لاين</span></span>
          </div>
          <span style={{ background: '#334155', color: '#cbd5e1', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>أدمن</span>
        </div>

        <nav style={{ flex: 1, padding: 'var(--space-4) var(--space-3)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const active = item.id === activeSection;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveSection(item.id); setSelectedTemplateId(null); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Cairo, sans-serif',
                  fontSize: '14px',
                  fontWeight: active ? 700 : 500,
                  background: active ? '#334155' : 'transparent',
                  color: active ? '#ffffff' : '#c9bfae',
                  textAlign: 'right',
                  transition: 'background .15s ease, color .15s ease'
                }}
              >
                <i className={item.icon} style={{ fontSize: '18px' }}></i>
                {item.label}
              </button>
            );
          })}
        </nav>

        <div style={{ padding: 'var(--space-4)', borderTop: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', color: '#fff' }}>
            {session.username.trim().charAt(0)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{session.username}</div>
            <div style={{ fontSize: '10.5px', color: '#a89c88' }}>مدير النظام</div>
          </div>
          <button 
            type="button" 
            onClick={handleSignOut}
            style={{ border: 'none', background: 'transparent', color: '#c9bfae', cursor: 'pointer', padding: '4px' }}
          >
            <i className="ph ph-sign-out" style={{ fontSize: '18px' }}></i>
          </button>
        </div>
      </aside>

      {/* ===== Main Content Area ===== */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        
        {/* Top Header */}
        <header style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '14px var(--space-8)', display: 'flex', alignItems: 'center', justifyContext: 'space-between', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
          <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 700 }}>
            {navItems.find(n => n.id === activeSection)?.label}
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative', width: '220px' }}>
              <i className="ph ph-magnifying-glass" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: '#94a3b8' }}></i>
              <input 
                type="text" 
                placeholder="بحث عام..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', height: '36px', borderRadius: '999px', border: '1px solid #e2e8f0', background: '#fff', padding: '0 34px 0 12px', fontSize: '13px', fontFamily: 'Cairo,sans-serif' }}
              />
            </div>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #e2e8f0', background: '#fff', color: '#1e293b', fontWeight: 700, fontSize: '13px', padding: '8px 16px', borderRadius: '999px', textDecoration: 'none' }}>
              عرض الموقع <i className="ph ph-arrow-square-out"></i>
            </Link>
          </div>
        </header>

        {/* Scrollable Container */}
        <main style={{ flex: 1, padding: 'var(--space-8)', maxWidth: '1180px', width: '100%', boxSizing: 'border-box' }}>
          
          {/* SECTION: Overview */}
          {activeSection === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
              
              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-5)' }}>
                {[
                  { title: 'إجمالي القوالب', value: '312', trend: '+8', icon: 'ph ph-cube', iconBg: '#efe4d3' },
                  { title: 'الطلبات هذا الشهر', value: '1,204', trend: '+14%', icon: 'ph ph-shopping-cart', iconBg: '#e6f4ea' },
                  { title: 'المستخدمون النشطون', value: '4,890', trend: '+3%', icon: 'ph ph-users', iconBg: '#e8f0fb' },
                  { title: 'الإيرادات الشهرية', value: '38,420 ر.س', trend: '-2%', icon: 'ph ph-receipt', iconBg: '#fbe7e5' },
                ].map((s, idx) => (
                  <div key={idx} className="hover-lift" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContext: 'space-between', justifyContent: 'space-between' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: s.iconBg, display: 'flex', alignItems: 'center', justifyContext: 'center', justifyContent: 'center' }}>
                        <i className={s.icon} style={{ fontSize: '18px', color: '#1e293b' }}></i>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: s.trend.startsWith('+') ? '#3f8f5c' : '#c0392b' }}>{s.trend}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '24px', fontWeight: 700 }}>{s.value}</div>
                      <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>{s.title}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Lists section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
                
                {/* Recent Orders */}
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>أحدث الطلبات</h3>
                    <button onClick={() => setActiveSection('orders')} style={{ border: 'none', background: 'transparent', color: '#3b82f6', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>عرض الكل</button>
                  </div>
                  <table style={styleTable}>
                    <thead>
                      <tr>
                        <th style={styleTh}>رقم الطلب</th>
                        <th style={styleTh}>العميل</th>
                        <th style={styleTh}>القالب</th>
                        <th style={styleTh}>المبلغ</th>
                        <th style={styleTh}>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((o) => {
                        const statusColors = badgeColor(o.status);
                        return (
                          <tr key={o.id} className="row-hover">
                            <td style={{ ...styleTd, fontWeight: 700 }}>{o.id}</td>
                            <td style={styleTd}>{o.customer}</td>
                            <td style={styleTd}>{o.template}</td>
                            <td style={styleTd}>{o.amount}</td>
                            <td style={styleTd}>
                              <span style={{ background: statusColors.bg, color: statusColors.color, fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px' }}>{o.statusLabel}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* New Users */}
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>مستخدمون جدد</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {recentUsers.map((u, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderBottom: idx < recentUsers.length - 1 ? '1px solid #f2e9d9' : 'none' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f1f5f9', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContext: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px' }}>
                          {u.name.trim().charAt(0)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13.5px', fontWeight: 700 }}>{u.name}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>{u.email}</div>
                        </div>
                        <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>{u.date}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* SECTION: Templates */}
          {activeSection === 'templates' && (
            <div>
              {!selectedTemplateId ? (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContext: 'space-between', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>إدارة القوالب</h3>
                    <button onClick={() => toast.info('يرجى استخدام شروحات create-packaging-template لإضافة قالب جديد.')} style={{ background: '#1e293b', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '999px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }} className="btn-anim">
                      <i className="ph ph-plus" style={{ marginLeft: '4px' }}></i> قالب جديد
                    </button>
                  </div>
                  <table style={styleTable}>
                    <thead>
                      <tr>
                        <th style={styleTh}>القالب</th>
                        <th style={styleTh}>التصنيف</th>
                        <th style={styleTh}>التنزيلات</th>
                        <th style={styleTh}>الحالة</th>
                        <th style={styleTh}>إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbTemplates.map((t) => (
                        <tr key={t.id} className="row-hover">
                          <td style={{ ...styleTd, fontWeight: 700 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <i className="ph ph-cube" style={{ color: '#3b82f6' }}></i>
                              <span>{t.title} ({t.id})</span>
                            </div>
                          </td>
                          <td style={styleTd}>{t.categoryLabel}</td>
                          <td style={styleTd}>{t.downloads || 0}</td>
                          <td style={styleTd}>
                            <span style={{ background: '#e6f4ea', color: '#3f8f5c', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px' }}>نشط</span>
                          </td>
                          <td style={styleTd}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => openTemplateEdit(t)} style={{ border: 'none', background: 'transparent', color: '#5a4c3c', cursor: 'pointer' }}><i className="ph ph-pencil-simple" style={{ fontSize: '16px' }}></i></button>
                              <button onClick={() => toast.error('حذف القالب الأساسي غير مسموح.')} style={{ border: 'none', background: 'transparent', color: '#c0392b', cursor: 'pointer' }}><i className="ph ph-trash" style={{ fontSize: '16px' }}></i></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 'var(--space-6)', alignItems: 'start' }}>
                  {/* Left visual */}
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', textAlign: 'center' }}>
                    <h3 style={{ margin: '0 0 10px', fontSize: '15px', fontWeight: 700, color: '#94a3b8' }}>معاينة قالب {selectedTemplateId}</h3>
                    <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={`/templates/preview/A10_20_02_02.svg`} alt="معاينة" style={{ width: '80%', height: 'auto' }} />
                    </div>
                  </div>

                  {/* Right edit form */}
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContext: 'space-between', justifyContent: 'space-between', marginBottom: 'var(--space-5)', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>تعديل قالب {selectedTemplateId}</h3>
                      <button onClick={() => setSelectedTemplateId(null)} style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '13.5px', fontWeight: 600 }}>إغلاق</button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>اسم القالب</label>
                        <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', height: '40px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13.5px', fontFamily: 'Cairo,sans-serif' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>التصنيف</label>
                        <input type="text" value={templateCat} onChange={e => setTemplateCat(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', height: '40px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13.5px', fontFamily: 'Cairo,sans-serif' }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11.5px', color: '#5a4c3c', marginBottom: '4px' }}>العرض الافتراضي</label>
                          <input type="number" value={templateW} onChange={e => setTemplateW(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', height: '40px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13.5px' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11.5px', color: '#5a4c3c', marginBottom: '4px' }}>الارتفاع الافتراضي</label>
                          <input type="number" value={templateH} onChange={e => setTemplateH(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', height: '40px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13.5px' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11.5px', color: '#5a4c3c', marginBottom: '4px' }}>العمق الافتراضي</label>
                          <input type="number" value={templateD} onChange={e => setTemplateD(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', height: '40px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13.5px' }} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <button onClick={handleSaveTemplate} style={{ flex: 1, height: '44px', border: 'none', borderRadius: '999px', background: '#1e293b', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }} className="btn-anim">حفظ التغييرات</button>
                        <button onClick={() => setSelectedTemplateId(null)} style={{ height: '44px', border: '1px solid #c0392b', borderRadius: '999px', background: 'transparent', color: '#c0392b', fontWeight: 600, fontSize: '14px', padding: '0 20px', cursor: 'pointer' }}>حذف القالب</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION: Orders */}
          {activeSection === 'orders' && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>سجل طلبات الاشتراكات والتراخيص</h3>
              </div>
              <table style={styleTable}>
                <thead>
                  <tr>
                    <th style={styleTh}>الطلب</th>
                    <th style={styleTh}>العميل</th>
                    <th style={styleTh}>التاريخ</th>
                    <th style={styleTh}>المبلغ</th>
                    <th style={styleTh}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => {
                    const statusColors = badgeColor(o.status);
                    return (
                      <tr key={o.id} className="row-hover">
                        <td style={{ ...styleTd, fontWeight: 700 }}>{o.id}</td>
                        <td style={styleTd}>{o.customer}</td>
                        <td style={styleTd}>{o.date}</td>
                        <td style={styleTd}>{o.amount}</td>
                        <td style={styleTd}>
                          <span style={{ background: statusColors.bg, color: statusColors.color, fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px' }}>{o.statusLabel}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* SECTION: Users */}
          {activeSection === 'users' && (
            <div>
              {/* Local tabs switcher */}
              <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid #e2e8f0', marginBottom: 'var(--space-6)' }}>
                <button type="button" onClick={() => setUsersTab('list')} style={{ padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'Cairo', fontSize: '13.5px', fontWeight: usersTab === 'list' ? 700 : 500, color: usersTab === 'list' ? '#1e293b' : '#94a3b8', borderBottom: `2px solid ${usersTab === 'list' ? '#3b82f6' : 'transparent'}`, marginBottom: '-1px' }}>المستخدمون</button>
                <button type="button" onClick={() => setUsersTab('roles')} style={{ padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'Cairo', fontSize: '13.5px', fontWeight: usersTab === 'roles' ? 700 : 500, color: usersTab === 'roles' ? '#1e293b' : '#94a3b8', borderBottom: `2px solid ${usersTab === 'roles' ? '#3b82f6' : 'transparent'}`, marginBottom: '-1px' }}>الأدوار والصلاحيات</button>
              </div>

              {usersTab === 'list' ? (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
                  <UserManagement 
                    currentUser={{ username: session.username, is_admin: session.is_admin }}
                    currentPassword={session.pw}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-5)' }}>
                    {[
                      { name: 'أدمن', label: 'كامل الصلاحيات', count: 1, permissions: ['إدارة القوالب', 'عرض الطلبات', 'إدارة المستخدمين', 'الفوترة والاشتراكات', 'إعدادات النظام'], active: [true, true, true, true, true] },
                      { name: 'محرر', label: 'إدارة المحتوى فقط', count: 2, permissions: ['إدارة القوالب', 'عرض الطلبات', 'إدارة المستخدمين', 'الفوترة والاشتراكات', 'إعدادات النظام'], active: [true, true, false, false, false] },
                      { name: 'مستخدم', label: 'صلاحية واجهة العميل', count: 1420, permissions: ['إدارة القوالب', 'عرض الطلبات', 'إدارة المستخدمين', 'الفوترة والاشتراكات', 'إعدادات النظام'], active: [false, false, false, false, false] },
                    ].map((r, idx) => (
                      <div key={idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContext: 'space-between', justifyContent: 'space-between', marginBottom: '14px' }}>
                          <span style={{ background: idx === 0 ? '#f0e9f7' : idx === 1 ? '#e8f0fb' : '#eee7da', color: idx === 0 ? '#7a5ea8' : idx === 1 ? '#3b6bc9' : '#5a4c3c', fontSize: '12px', fontWeight: 700, padding: '3px 12px', borderRadius: '6px' }}>{r.name}</span>
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>{r.count} مستخدم</span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: 'var(--space-4)' }}>{r.label}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {r.permissions.map((p, pIdx) => (
                            <label key={pIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1e293b' }}>
                              <input type="checkbox" checked={r.active[pIdx]} readOnly disabled style={{ accentColor: '#3b82f6' }} />
                              {p}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button onClick={() => toast.info('إضافة دور جديد تتطلب ترقية خطة الاستضافة الخاصة بالنظام.')} style={{ border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '16px', background: 'transparent', color: '#3b82f6', fontWeight: 700, fontSize: '14px', cursor: 'pointer', textAlign: 'center' }}>
                    <i className="ph ph-plus" style={{ marginLeft: '4px' }}></i> إضافة دور جديد
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION: Billing */}
          {activeSection === 'billing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                {[
                  { title: 'الإيرادات هذا الشهر', value: '38,420 ر.س' },
                  { title: 'الاشتراكات النشطة', value: '286 اشتراك' },
                  { title: 'معدل التجديد', value: '94.2%' },
                ].map((b, idx) => (
                  <div key={idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
                    <div style={{ fontSize: '22px', fontWeight: 700 }}>{b.value}</div>
                    <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>{b.title}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>الفواتير</h3>
                </div>
                <table style={styleTable}>
                  <thead>
                    <tr>
                      <th style={styleTh}>العميل</th>
                      <th style={styleTh}>الخطة</th>
                      <th style={styleTh}>المبلغ</th>
                      <th style={styleTh}>التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { client: 'أحمد الغامدي', plan: 'الأعمال (شهري)', amount: '149 ر.س', date: '15 يوليو 2026' },
                      { client: 'شركة حلول الرياض', plan: 'المصنع (شهري)', amount: '449 ر.س', date: '15 يوليو 2026' },
                      { client: 'ورشة التغليف الحديثة', plan: 'الأعمال (سنوي)', amount: '1,428 ر.س', date: '12 يوليو 2026' },
                    ].map((i, idx) => (
                      <tr key={idx} className="row-hover">
                        <td style={{ ...styleTd, fontWeight: 700 }}>{i.client}</td>
                        <td style={styleTd}>{i.plan}</td>
                        <td style={styleTd}>{i.amount}</td>
                        <td style={styleTd}>{i.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION: Settings */}
          {activeSection === 'settings' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
              
              {/* general */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>عام</h3>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>اسم المنصة</label>
                  <input type="text" defaultValue="برينتيرا" style={{ width: '100%', boxSizing: 'border-box', height: '40px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13.5px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>بريد الدعم</label>
                  <input type="email" defaultValue="support@qawalibline.sa" style={{ width: '100%', boxSizing: 'border-box', height: '40px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13.5px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>العملة الافتراضية</label>
                  <input type="text" defaultValue="ر.س" style={{ width: '100%', boxSizing: 'border-box', height: '40px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13.5px' }} />
                </div>
              </div>

              {/* preview settings */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>إعدادات المعاينة</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: '#1e293b', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showNestingPreview} onChange={(e) => {
                    const newVal = e.target.checked;
                    setShowNestingPreview(newVal);
                    localStorage.setItem('printCalc_previewSettings', JSON.stringify({ showNestingPreview: newVal, show3DPreview }));
                    toast.success('تم التحديث بنجاح');
                  }} style={{ accentColor: '#3b82f6' }} />
                  إظهار معاينة التوزيع (Nesting)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: '#1e293b', cursor: 'pointer' }}>
                  <input type="checkbox" checked={show3DPreview} onChange={(e) => {
                    const newVal = e.target.checked;
                    setShow3DPreview(newVal);
                    localStorage.setItem('printCalc_previewSettings', JSON.stringify({ showNestingPreview, show3DPreview: newVal }));
                    toast.success('تم التحديث بنجاح');
                  }} style={{ accentColor: '#3b82f6' }} />
                  إظهار المعاينة ثلاثية الأبعاد (3D)
                </label>
              </div>

              {/* categories */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>تصنيفات القوالب</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {['طي وصواني', 'علب أسطوانية', 'تغليف تجزئة', 'علب سحب', 'أشكال غير مستطيلة'].map((cat, idx) => (
                    <span key={idx} style={{ background: '#f1f5f9', color: '#5a4c3c', fontSize: '12px', padding: '5px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {cat}
                      <i className="ph ph-x" style={{ cursor: 'pointer' }} onClick={() => toast.error('لا يمكن حذف التصنيف الأساسي')}></i>
                    </span>
                  ))}
                </div>
                <button onClick={() => toast.info('إضافة تصنيف يتطلب ضبط ملفات القوالب البرمجية أولاً.')} style={{ border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '10px', background: 'transparent', color: '#3b82f6', fontWeight: 700, fontSize: '13px', cursor: 'pointer', textAlign: 'center' }}>
                  <i className="ph ph-plus" style={{ marginLeft: '4px' }}></i> إضافة تصنيف
                </button>
              </div>

              {/* notification */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>الإشعارات</h3>
                {[
                  { label: 'إرسال بريد إلكتروني عند طلب جديد', defaultChecked: true },
                  { label: 'إشعار تسجيل مستخدم جديد', defaultChecked: true },
                  { label: 'ملخص أسبوعي للأداء المالي والتنزيلات', defaultChecked: false },
                ].map((n, idx) => (
                  <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: '#1e293b', cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked={n.defaultChecked} style={{ accentColor: '#3b82f6' }} />
                    {n.label}
                  </label>
                ))}
              </div>

              {/* danger zone */}
              <div style={{ background: '#fff', border: '1px solid #c0392b', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#c0392b', borderBottom: '1px solid rgba(192,57,43,0.15)', paddingBottom: '8px' }}>منطقة الخطر</h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                  تعطيل المنصة مؤقتًا يمنع المستخدمين من تسجيل الدخول أو تصدير القوالب.
                </p>
                <button onClick={() => toast.error('لا تملك صلاحيات كافية لتعطيل المنصة.')} style={{ height: '40px', border: '1px solid #c0392b', borderRadius: '999px', background: 'transparent', color: '#c0392b', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>تعطيل المنصة مؤقتًا</button>
              </div>

              {/* bottom save button */}
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button onClick={() => toast.success('تم حفظ إعدادات النظام بنجاح')} style={{ height: '46px', border: 'none', borderRadius: '999px', background: '#1e293b', color: '#fff', fontWeight: 700, fontSize: '14px', padding: '0 32px', cursor: 'pointer' }} className="btn-anim">حفظ الإعدادات</button>
              </div>

            </div>
          )}

        </main>

      </div>

    </div>
  );
}
