import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import UserManagement from '@/components/UserManagement';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAppContent, FAQItem, SubscriptionPlan, HeroBannerData, PricingContentData, LegalDocumentData, LegalSection, DiscountCode } from '@/hooks/useAppContent';
import { getMergedTemplatesList } from '@/hooks/useAppTemplates';
import { listUsers, getUserPlan } from '@/lib/userApi';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Eye } from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<'overview' | 'templates' | 'users' | 'billing' | 'content' | 'legal' | 'settings'>('overview');
  const [session, setSession] = useState<any>(null);
  const { banner, faqs, plans, pricingContent, stepsSection, termsContent, privacyContent, discountCodes, updateBanner, updateFaqs, updatePlans, updatePricingContent, updateStepsSection, updateTermsContent, updatePrivacyContent, updateDiscountCodes } = useAppContent();
  const [bannerForm, setBannerForm] = useState<HeroBannerData>(banner);
  const [faqsList, setFaqsList] = useState<FAQItem[]>(faqs);
  const [plansList, setPlansList] = useState<SubscriptionPlan[]>(plans);
  const [pricingForm, setPricingForm] = useState<PricingContentData>(pricingContent);
  const [stepsForm, setStepsForm] = useState<StepsSectionData>(stepsSection);
  const [termsForm, setTermsForm] = useState<LegalDocumentData>(termsContent);
  const [privacyForm, setPrivacyForm] = useState<LegalDocumentData>(privacyContent);

  // Core Data States
  const [dbTemplates, setDbTemplates] = useState<any[]>(() => getMergedTemplatesList());
  const [adminUsersList, setAdminUsersList] = useState<any[]>([]);

  // Discount codes state
  const [discountCodesList, setDiscountCodesList] = useState<DiscountCode[]>(discountCodes || []);
  const [newCodeName, setNewCodeName] = useState('');
  const [newCodeType, setNewCodeType] = useState<'percentage' | 'fixed'>('percentage');
  const [newCodeValue, setNewCodeValue] = useState('');
  const [newCodeTargetPlan, setNewCodeTargetPlan] = useState('all');
  const [newCodeMaxUses, setNewCodeMaxUses] = useState('');

  // Invoice viewing state
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  const realInvoices = useMemo(() => {
    const clients = adminUsersList.filter(u => !u.is_admin);
    if (clients.length === 0) return [];

    return clients.map((u, idx) => {
      const planId = u.subscription_plan || getUserPlan(u.id, u.username) || 'plan-free';
      const matchedPlan = plansList.find(p => p.id === planId);
      const planName = matchedPlan ? matchedPlan.name : (planId === 'plan-pro' ? 'الباقة الاحترافية PRO' : planId === 'plan-business' ? 'باقة الشركات والمطابع' : 'المجانية التجريبية');

      let amountVal = 0;
      if (matchedPlan) {
        amountVal = typeof matchedPlan.priceMonthly === 'number' 
          ? matchedPlan.priceMonthly 
          : (parseFloat(String(matchedPlan.priceMonthly)) || 0);
      } else {
        if (planId === 'plan-pro') amountVal = 149;
        else if (planId === 'plan-business') amountVal = 399;
      }

      const invId = `INV-2026-${String(1001 + idx)}`;
      const dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : '1 أغسطس 2026';
      const isPaid = u.is_active !== false && amountVal > 0;
      const statusText = amountVal === 0 ? 'مجاني (تجريبي)' : (isPaid ? 'مدفوع' : 'معلق / غير نشط');

      return {
        id: invId,
        client: u.username,
        planId,
        planName,
        amountValue: amountVal,
        amount: amountVal === 0 ? 'مجانًا' : `${amountVal} ر.س`,
        date: dateStr,
        status: statusText,
        userObj: u,
      };
    });
  }, [adminUsersList, plansList]);

  const handleDownloadInvoicePDF = (invToPrint?: any) => {
    const inv = invToPrint || selectedInvoice;
    if (!inv) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('يرجى السماح بتطبيقات النوافذ المنبثقة للطباعة والتنزيل');
      return;
    }
    
    const vatAmount = (inv.amountValue - (inv.amountValue / 1.15)).toFixed(2);
    const baseAmount = (inv.amountValue / 1.15).toFixed(2);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>فاتورة ضريبية - ${inv.id}</title>
        <style>
          body { font-family: 'Cairo', system-ui, sans-serif; padding: 30px; direction: rtl; color: #0f172a; background: #fff; }
          .invoice-box { border: 1px solid #e2e8f0; padding: 24px; border-radius: 12px; max-width: 750px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 20px; }
          .brand { font-size: 22px; font-weight: bold; color: #1e293b; }
          .sub-brand { font-size: 12px; color: #64748b; margin-top: 2px; }
          .meta { text-align: left; font-size: 12px; color: #475569; }
          .badge { display: inline-block; padding: 4px 10px; background: #ecfdf5; color: #047857; font-weight: bold; border-radius: 6px; font-size: 12px; }
          .grid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafc; padding: 14px; border-radius: 8px; font-size: 13px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: right; }
          th { background: #f1f5f9; font-weight: 700; color: #334155; }
          .totals { display: flex; justify-content: flex-end; margin-top: 10px; }
          .totals-box { width: 280px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px; font-size: 13px; }
          .totals-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
          .totals-row.final { font-size: 15px; font-weight: bold; color: #1d4ed8; border-top: 1px solid #cbd5e1; padding-top: 6px; margin-bottom: 0; }
          .footer-stamp { text-align: center; margin-top: 30px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
          @media print { body { padding: 0; } .invoice-box { border: none; } }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <div class="header">
            <div>
              <div class="brand">منصة برينتيرا — Print Logic</div>
              <div class="sub-brand">فاتورة ضريبية مبسطة (Tax Invoice)</div>
              <div class="sub-brand">الرقم الضريبي للمنصة: 310045981200003</div>
            </div>
            <div class="meta">
              <div class="badge">${inv.status}</div>
              <div style="margin-top: 8px;"><strong>رقم الفاتورة:</strong> ${inv.id}</div>
              <div><strong>تاريخ الفاتورة:</strong> ${inv.date}</div>
            </div>
          </div>

          <div class="grid-info">
            <div>
              <span style="color:#64748b;">اسم العميل / المؤسسة:</span><br/>
              <strong>${inv.client}</strong>
            </div>
            <div>
              <span style="color:#64748b;">باقة الاشتراك المعتمدة:</span><br/>
              <strong>${inv.planName}</strong>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>الوصف والتفاصيل</th>
                <th style="text-align: center;">المدة</th>
                <th style="text-align: left;">المبلغ الخاضع للضريبة</th>
                <th style="text-align: left;">الضريبة (15%)</th>
                <th style="text-align: left;">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>رسوم ترخيص وااشتراك ${inv.planName} - حاسبة وتصاميم التغليف</td>
                <td style="text-align: center;">شهري</td>
                <td style="text-align: left;">${baseAmount} ر.س</td>
                <td style="text-align: left;">${vatAmount} ر.س</td>
                <td style="text-align: left; font-weight: bold;">${inv.amountValue.toFixed(2)} ر.س</td>
              </tr>
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-box">
              <div class="totals-row">
                <span>المجموع قبل الضريبة:</span>
                <span>${baseAmount} ر.س</span>
              </div>
              <div class="totals-row">
                <span>ضريبة القيمة المضافة (15%):</span>
                <span>${vatAmount} ر.س</span>
              </div>
              <div class="totals-row final">
                <span>المبلغ الإجمالي المدفوع:</span>
                <span>${inv.amountValue.toFixed(2)} ر.س</span>
              </div>
            </div>
          </div>

          <div class="footer-stamp">
            صدرت هذه الفاتورة إلكترونياً من نظام برينتيرا الإلكتروني وتعتبر وثيقة رسمية معتمدة لا تتطلب التوقيع.
          </div>
        </div>
        <script>
          setTimeout(() => { window.print(); }, 400);
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
    toast.success('تم فتح نافذة الطباعة والتنزيل للفاتورة');
  };

  useEffect(() => {
    setTermsForm(termsContent);
    setPrivacyForm(privacyContent);
    if (discountCodes) setDiscountCodesList(discountCodes);
  }, [termsContent, privacyContent, discountCodes]);
  const [newFaqQuestion, setNewFaqQuestion] = useState('');
  const [newFaqAnswer, setNewFaqAnswer] = useState('');
  const [newFaqCat, setNewFaqCat] = useState('عام');
  const [newPricingFaqQ, setNewPricingFaqQ] = useState('');
  const [newPricingFaqA, setNewPricingFaqA] = useState('');
  
  // New Plan Form State
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanDesc, setNewPlanDesc] = useState('');
  const [newPlanPriceMonthly, setNewPlanPriceMonthly] = useState('');
  const [newPlanPriceYearly, setNewPlanPriceYearly] = useState('');
  const [newPlanBadge, setNewPlanBadge] = useState('');
  const [newPlanCta, setNewPlanCta] = useState('اشترك الآن');
  const [newPlanFeatured, setNewPlanFeatured] = useState(false);
  const [newPlanFeaturesText, setNewPlanFeaturesText] = useState('');

  const handleAddDiscountCode = () => {
    const cleanCode = newCodeName.trim().toUpperCase();
    if (!cleanCode) {
      toast.error('يرجى كتابة كود الخصم');
      return;
    }
    const valNum = parseFloat(newCodeValue);
    if (isNaN(valNum) || valNum <= 0) {
      toast.error('يرجى إدخال قيمة خصم صالحة أكبر من صفر');
      return;
    }

    const newCodeItem: DiscountCode = {
      id: `disc_${Date.now()}`,
      code: cleanCode,
      discountType: newCodeType,
      discountValue: valNum,
      targetPlanId: newCodeTargetPlan,
      maxUses: newCodeMaxUses ? parseInt(newCodeMaxUses) : null,
      usedCount: 0,
      expiresAt: null,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const updated = [newCodeItem, ...discountCodesList];
    setDiscountCodesList(updated);
    updateDiscountCodes(updated);
    toast.success(`تم إنشاء كود الخصم (${cleanCode}) بنجاح`);

    setNewCodeName('');
    setNewCodeValue('');
    setNewCodeMaxUses('');
  };

  const [usersTab, setUsersTab] = useState<'list' | 'roles'>('list');
  const [search, setSearch] = useState('');

  // Template Editing State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateCat, setTemplateCat] = useState('');
  const [templateW, setTemplateW] = useState('');
  const [templateH, setTemplateH] = useState('');
  const [templateD, setTemplateD] = useState('');
  const [templateStatus, setTemplateStatus] = useState<'active' | 'inactive'>('active');

  // Global & Per-Template Preview Settings State
  const [show2DPreview, setShow2DPreview] = useState(true);
  const [showNestingPreview, setShowNestingPreview] = useState(true);
  const [show3DPreview, setShow3DPreview] = useState(true);
  const [templateOverrides, setTemplateOverrides] = useState<Record<string, { show2D?: boolean; show3D?: boolean; showNesting?: boolean }>>(() => {
    try {
      const raw = localStorage.getItem('printCalc_templatePreviewOverrides');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const getTmplSetting = (tmplId: string, key: 'show2D' | 'show3D' | 'showNesting') => {
    const tmplOverride = templateOverrides[tmplId];
    if (tmplOverride && tmplOverride[key] !== undefined) {
      return tmplOverride[key]!;
    }
    if (key === 'show2D') return show2DPreview;
    if (key === 'showNesting') return showNestingPreview;
    if (key === 'show3D') return show3DPreview;
    return true;
  };

  const toggleTemplateOverride = (tmplId: string, key: 'show2D' | 'show3D' | 'showNesting') => {
    const currentVal = getTmplSetting(tmplId, key);
    const updated = {
      ...templateOverrides,
      [tmplId]: {
        ...(templateOverrides[tmplId] || {}),
        [key]: !currentVal,
      },
    };
    setTemplateOverrides(updated);
    localStorage.setItem('printCalc_templatePreviewOverrides', JSON.stringify(updated));
    window.dispatchEvent(new Event('previewSettingsUpdated'));
    toast.success(`تم تحديث خيارات عرض القالب ${tmplId}`);
  };

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
            setShow2DPreview(parsedSettings.show2DPreview ?? true);
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



  useEffect(() => {
    async function loadAdminData() {
      try {
        const { data } = await supabase.from('app_templates').select('*');
        const merged = getMergedTemplatesList(data || []);
        setDbTemplates(merged);
      } catch {
        setDbTemplates(getMergedTemplatesList());
      }

      if (session?.username && session?.pw) {
        try {
          const users = await listUsers(session.username, session.pw);
          setAdminUsersList(users || []);
        } catch {
          const { data: dbUsers } = await supabase.from('app_users').select('*');
          if (dbUsers) setAdminUsersList(dbUsers);
        }
      }
    }
    if (session) {
      loadAdminData();
      const handleUpdate = () => loadAdminData();
      window.addEventListener('userPlansUpdated', handleUpdate);
      return () => window.removeEventListener('userPlansUpdated', handleUpdate);
    }
  }, [session]);

  const totalUsersCount = adminUsersList.length;
  const clientUsersList = adminUsersList.filter(u => !u.is_admin);
  const totalClientsCount = clientUsersList.length;

  // Active client subscriptions: non-admin, active flag true, and unexpired
  const activeSubscriptionsList = clientUsersList.filter(u => {
    if (u.is_active === false) return false;
    if (u.expires_at && new Date(u.expires_at).getTime() < Date.now()) return false;
    return true;
  });
  const activeSubscriptionsCount = activeSubscriptionsList.length;

  // Active paid subscriptions: active subscriptions with price > 0
  const activePaidSubscriptionsCount = activeSubscriptionsList.filter(u => {
    const planId = u.subscription_plan || getUserPlan(u.id, u.username) || 'plan-free';
    const matchedPlan = plans.find(p => p.id === planId);
    if (matchedPlan) {
      const price = typeof matchedPlan.priceMonthly === 'number' 
        ? matchedPlan.priceMonthly 
        : (parseFloat(String(matchedPlan.priceMonthly)) || 0);
      return price > 0;
    }
    return planId === 'plan-pro' || planId === 'plan-business';
  }).length;

  const realMonthlyRevenue = activeSubscriptionsList.reduce((sum, u) => {
    const planId = u.subscription_plan || getUserPlan(u.id, u.username) || 'plan-free';
    const matchedPlan = plans.find(p => p.id === planId);
    let planPrice = 0;
    if (matchedPlan) {
      planPrice = typeof matchedPlan.priceMonthly === 'number' 
        ? matchedPlan.priceMonthly 
        : (parseFloat(String(matchedPlan.priceMonthly)) || 0);
    } else {
      if (planId === 'plan-pro') planPrice = 149;
      else if (planId === 'plan-business') planPrice = 399;
    }
    return sum + planPrice;
  }, 0);

  const activationRateVal = totalClientsCount > 0 
    ? ((activeSubscriptionsCount / totalClientsCount) * 100).toFixed(1) 
    : '0.0';

  const paidRenewalRateVal = totalClientsCount > 0 
    ? ((activePaidSubscriptionsCount / totalClientsCount) * 100).toFixed(1) 
    : '0.0';

  if (!session) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>جاري التحقق من الهوية الإدارية...</div>;
  }

  const handleSignOut = () => {
    localStorage.removeItem('printCalc_session');
    localStorage.removeItem('printCalc_tabPermsSnapshot');
    toast.success('تم تسجيل الخروج الإداري');
    navigate('/admin/login');
  };





  const openTemplateEdit = (t: any) => {
    const rawOverrides = localStorage.getItem('printCalc_customTemplateOverrides');
    const overrides = rawOverrides ? JSON.parse(rawOverrides) : {};
    const ov = overrides[t.id];

    setSelectedTemplateId(t.id || '');
    setTemplateName(ov?.title || t.title || '');
    setTemplateCat(ov?.categoryLabel || t.categoryLabel || t.category || '');
    setTemplateW(String(ov?.defaultW ?? t.default_w ?? 200));
    setTemplateH(String(ov?.defaultH ?? t.default_h ?? 120));
    setTemplateD(String(ov?.defaultD ?? t.default_d ?? 80));
    setTemplateStatus(ov?.status || t.status || 'active');
  };

  const toggleTemplateStatus = async (tmplId: string) => {
    const storedOverrides = JSON.parse(localStorage.getItem('printCalc_customTemplateOverrides') || '{}');
    const currentStatus = storedOverrides[tmplId]?.status || dbTemplates.find(t => t.id === tmplId)?.status || 'active';
    const newStatus: 'active' | 'inactive' = currentStatus === 'active' ? 'inactive' : 'active';

    storedOverrides[tmplId] = {
      ...(storedOverrides[tmplId] || {}),
      status: newStatus,
    };
    localStorage.setItem('printCalc_customTemplateOverrides', JSON.stringify(storedOverrides));

    try {
      await supabase.from('app_templates').update({ status: newStatus }).eq('id', tmplId);
    } catch {}

    setDbTemplates(prev => prev.map(t => t.id === tmplId ? { ...t, status: newStatus } : t));
    window.dispatchEvent(new Event('appTemplatesUpdated'));
    toast.success(`تم تغيير حالة القالب ${tmplId} إلى (${newStatus === 'active' ? 'نشط' : 'غير نشط'})`);
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplateId) return;

    try {
      // 1. Try updating in Supabase database
      const { error } = await supabase
        .from('app_templates')
        .update({
          title: templateName,
          category_label: templateCat,
          category: templateCat,
          default_w: Number(templateW) || 200,
          default_h: Number(templateH) || 120,
          default_d: Number(templateD) || 80,
          status: templateStatus,
        })
        .eq('id', selectedTemplateId);

      if (error) {
        console.warn('Supabase template update info/warning:', error);
      }

      // 2. Save custom overrides in localStorage so all pages reflect changes instantly
      const storedOverrides = JSON.parse(localStorage.getItem('printCalc_customTemplateOverrides') || '{}');
      storedOverrides[selectedTemplateId] = {
        title: templateName,
        categoryLabel: templateCat,
        defaultW: Number(templateW) || 200,
        defaultH: Number(templateH) || 120,
        defaultD: Number(templateD) || 80,
        status: templateStatus,
      };
      localStorage.setItem('printCalc_customTemplateOverrides', JSON.stringify(storedOverrides));

      // 3. Update local state in AdminDashboard
      setDbTemplates(prev => prev.map(t => t.id === selectedTemplateId ? {
        ...t,
        title: templateName,
        categoryLabel: templateCat,
        default_w: Number(templateW) || 200,
        default_h: Number(templateH) || 120,
        default_d: Number(templateD) || 80,
        status: templateStatus,
      } : t));

      // 4. Broadcast real-time event across windows and hooks
      window.dispatchEvent(new Event('appTemplatesUpdated'));
      window.dispatchEvent(new Event('appContentUpdated'));

      toast.success(`تم حفظ اسم وحالة القالب (${selectedTemplateId}) بنجاح وتحديثها في جميع الصفحات`);
      setSelectedTemplateId(null);
    } catch (err) {
      console.error('Error saving template:', err);
      toast.error('حدث خطأ أثناء حفظ القالب');
    }
  };

  // Nav side items list
  const navItems = [
    { id: 'overview', label: 'لوحة القيادة', icon: 'ph ph-squares-four' },
    { id: 'templates', label: 'القوالب والعرض', icon: 'ph ph-cube' },
    { id: 'users', label: 'المستخدمون', icon: 'ph ph-users' },
    { id: 'billing', label: 'باقات الاشتراك', icon: 'ph ph-receipt' },
    { id: 'content', label: 'البانر والأسئلة الشائعة', icon: 'ph ph-article' },
    { id: 'legal', label: 'الشروط والسياسات', icon: 'ph ph-file-text' },
    { id: 'settings', label: 'إعدادات النظام', icon: 'ph ph-gear' },
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
        <main style={{ flex: 1, padding: 'var(--space-8)', maxWidth: activeSection === 'users' ? '100%' : '1400px', width: '100%', boxSizing: 'border-box' }}>
          
          {/* SECTION: Overview */}
          {activeSection === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
              
              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-5)' }}>
                {[
                  { title: 'إجمالي القوالب المتاحة', value: `${dbTemplates.length}`, trend: `${dbTemplates.length} قالب`, icon: 'ph ph-cube', iconBg: '#efe4d3' },
                  { title: 'إجمالي المستخدمين العملاء', value: `${totalClientsCount} عميل`, trend: `${totalUsersCount} كلي`, icon: 'ph ph-users', iconBg: '#e8f0fb' },
                  { title: 'الاشتراكات النشطة', value: `${activeSubscriptionsCount} اشتراك`, trend: `${activationRateVal}% تفعيل`, icon: 'ph ph-check-circle', iconBg: '#e6f4ea' },
                  { title: 'الإيرادات الشهرية الحقيقية', value: `${realMonthlyRevenue.toLocaleString('ar-EG')} ر.س`, trend: 'مباشر', icon: 'ph ph-receipt', iconBg: '#fbe7e5' },
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



            </div>
          )}

          {/* SECTION: Templates */}
          {activeSection === 'templates' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              {/* Display Controls Card */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="ph ph-sliders" style={{ color: '#3b82f6' }}></i> إعدادات العرض الشاملة لجميع القوالب (Global Preview Settings)
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>تتحكم في الإظهار والإخفاء الشامل في كافة القوالب (مع إمكانية التخصيص الفردي)</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  {/* 2D Dieline Toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={show2DPreview}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setShow2DPreview(val);
                        const updated = { show2DPreview: val, showNestingPreview, show3DPreview };
                        localStorage.setItem('printCalc_previewSettings', JSON.stringify(updated));
                        window.dispatchEvent(new Event('previewSettingsUpdated'));
                        toast.success('تم تحديث إعداد رسم 2D الشامل');
                      }}
                      style={{ accentColor: '#3b82f6', width: '18px', height: '18px' }}
                    />
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700 }}>معاينة الرسم الهيكلي (2D Geometry)</div>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>إظهار أو إخفاء مخطط الدايكات وخطوط القص والطي</div>
                    </div>
                  </label>

                  {/* Nesting Toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showNestingPreview}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setShowNestingPreview(val);
                        const updated = { show2DPreview, showNestingPreview: val, show3DPreview };
                        localStorage.setItem('printCalc_previewSettings', JSON.stringify(updated));
                        window.dispatchEvent(new Event('previewSettingsUpdated'));
                        toast.success('تم تحديث إعداد توزيع الشيت (Nesting) الشامل');
                      }}
                      style={{ accentColor: '#3b82f6', width: '18px', height: '18px' }}
                    />
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700 }}>معاينة وتوزيع الشيت (Nesting 2D)</div>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>عرض أو إخفاء رسم وتوزيع الشيت التلقائي</div>
                    </div>
                  </label>

                  {/* 3D Model Toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={show3DPreview}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setShow3DPreview(val);
                        const updated = { show2DPreview, showNestingPreview, show3DPreview: val };
                        localStorage.setItem('printCalc_previewSettings', JSON.stringify(updated));
                        window.dispatchEvent(new Event('previewSettingsUpdated'));
                        toast.success('تم تحديث إعداد العرض 3D الشامل');
                      }}
                      style={{ accentColor: '#3b82f6', width: '18px', height: '18px' }}
                    />
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700 }}>المعاينة ثلاثية الأبعاد (3D Model)</div>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>عرض أو إخفاء النموذج ثلاثي الأبعاد والطي التفاعلي</div>
                    </div>
                  </label>
                </div>
              </div>

              {!selectedTemplateId ? (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContext: 'space-between', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>إدارة القوالب وإعدادات العرض لكل قالب على حدة</h3>
                    <button onClick={() => toast.info('يرجى استخدام شروحات create-packaging-template لإضافة قالب جديد.')} style={{ background: '#1e293b', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '999px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }} className="btn-anim">
                      <i className="ph ph-plus" style={{ marginLeft: '4px' }}></i> قالب جديد
                    </button>
                  </div>
                  <table style={styleTable}>
                    <thead>
                      <tr>
                        <th style={styleTh}>القالب</th>
                        <th style={styleTh}>التصنيف</th>
                        <th style={styleTh}>خيارات العرض الفردية (2D / Nesting / 3D)</th>
                        <th style={styleTh}>الحالة</th>
                        <th style={styleTh}>إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbTemplates.map((t) => {
                        const is2DOn = getTmplSetting(t.id, 'show2D');
                        const isNestingOn = getTmplSetting(t.id, 'showNesting');
                        const is3DOn = getTmplSetting(t.id, 'show3D');

                        return (
                          <tr key={t.id} className="row-hover">
                            <td style={{ ...styleTd, fontWeight: 700 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="ph ph-cube" style={{ color: '#3b82f6' }}></i>
                                <span>{t.title} ({t.id})</span>
                              </div>
                            </td>
                            <td style={styleTd}>{t.categoryLabel}</td>
                            <td style={styleTd}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  onClick={() => toggleTemplateOverride(t.id, 'show2D')}
                                  style={{
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    background: is2DOn ? '#dbeafe' : '#f1f5f9',
                                    color: is2DOn ? '#1d4ed8' : '#94a3b8',
                                  }}
                                  title="انقر لتعديل إظهار/إخفاء رسم 2D لهذا القالب"
                                >
                                  2D {is2DOn ? '✓' : '✗'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => toggleTemplateOverride(t.id, 'showNesting')}
                                  style={{
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    background: isNestingOn ? '#e0e7ff' : '#f1f5f9',
                                    color: isNestingOn ? '#4338ca' : '#94a3b8',
                                  }}
                                  title="انقر لتعديل إظهار/إخفاء التوزيع (Nesting) لهذا القالب"
                                >
                                  توزيع {isNestingOn ? '✓' : '✗'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => toggleTemplateOverride(t.id, 'show3D')}
                                  style={{
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    background: is3DOn ? '#dcfce7' : '#f1f5f9',
                                    color: is3DOn ? '#15803d' : '#94a3b8',
                                  }}
                                  title="انقر لتعديل إظهار/إخفاء 3D لهذا القالب"
                                >
                                  3D {is3DOn ? '✓' : '✗'}
                                </button>
                              </div>
                            </td>
                            <td style={styleTd}>
                              <button
                                type="button"
                                onClick={() => toggleTemplateStatus(t.id)}
                                style={{
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '4px 10px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  background: (t.status || 'active') === 'active' ? '#e6f4ea' : '#fef2f2',
                                  color: (t.status || 'active') === 'active' ? '#3f8f5c' : '#991b1b',
                                }}
                                title="انقر لتغير حالة القالب بين (نشط / غير نشط)"
                              >
                                {(t.status || 'active') === 'active' ? 'نشط ✓' : 'غير نشط ✗'}
                              </button>
                            </td>
                            <td style={styleTd}>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => openTemplateEdit(t)} style={{ border: 'none', background: 'transparent', color: '#5a4c3c', cursor: 'pointer' }}><i className="ph ph-pencil-simple" style={{ fontSize: '16px' }}></i></button>
                                <button onClick={() => toast.error('حذف القالب الأساسي غير مسموح.')} style={{ border: 'none', background: 'transparent', color: '#c0392b', cursor: 'pointer' }}><i className="ph ph-trash" style={{ fontSize: '16px' }}></i></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>حالة القالب (نشط / غير نشط)</label>
                        <select
                          value={templateStatus}
                          onChange={e => setTemplateStatus(e.target.value as 'active' | 'inactive')}
                          style={{ width: '100%', boxSizing: 'border-box', height: '40px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13.5px', fontFamily: 'Cairo,sans-serif' }}
                        >
                          <option value="active">نشط ✓ (يظهر للمستخدمين ويقبل التخصيص)</option>
                          <option value="inactive">غير نشط ✗ (مخفي من الصفحة الرئيسية والمكتبة)</option>
                        </select>
                      </div>     <button onClick={() => setSelectedTemplateId(null)} style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '13.5px', fontWeight: 600 }}>إغلاق</button>
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

                      {/* Per-Template Display Controls Box */}
                      <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px', marginTop: '6px' }}>
                        <h4 style={{ margin: '0 0 10px', fontSize: '13.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: '#1e293b' }}>
                          <i className="ph ph-sliders" style={{ color: '#3b82f6' }}></i> إعدادات خيارات العرض لهذا القالب فقط ({selectedTemplateId})
                        </h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer', color: '#334155' }}>
                            <input
                              type="checkbox"
                              checked={getTmplSetting(selectedTemplateId, 'show2D')}
                              onChange={() => toggleTemplateOverride(selectedTemplateId, 'show2D')}
                              style={{ accentColor: '#3b82f6', width: '16px', height: '16px' }}
                            />
                            <span>📐 إظهار معاينة الرسم الهيكلي 2D (Geometry Dieline)</span>
                          </label>

                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer', color: '#334155' }}>
                            <input
                              type="checkbox"
                              checked={getTmplSetting(selectedTemplateId, 'showNesting')}
                              onChange={() => toggleTemplateOverride(selectedTemplateId, 'showNesting')}
                              style={{ accentColor: '#3b82f6', width: '16px', height: '16px' }}
                            />
                            <span>📦 إظهار معاينة وتوزيع الشيت (Nesting / Distribution)</span>
                          </label>

                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer', color: '#334155' }}>
                            <input
                              type="checkbox"
                              checked={getTmplSetting(selectedTemplateId, 'show3D')}
                              onChange={() => toggleTemplateOverride(selectedTemplateId, 'show3D')}
                              style={{ accentColor: '#3b82f6', width: '16px', height: '16px' }}
                            />
                            <span>🧊 إظهار المعاينة ثلاثية الأبعاد (3D Model & Fold)</span>
                          </label>
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
                  { title: 'الإيرادات هذا الشهر (حقيقي)', value: `${realMonthlyRevenue.toLocaleString('ar-EG')} ر.س` },
                  { title: 'الاشتراكات النشطة (حقيقي)', value: `${activeSubscriptionsCount} / ${totalClientsCount} اشتراك (${activePaidSubscriptionsCount} مدفوع)` },
                  { title: 'معدل التفعيل والتجديد الحقيقي', value: `${activationRateVal}% تفعيل (${paidRenewalRateVal}% مدفوع)` },
                ].map((b, idx) => (
                  <div key={idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' }}>
                    <div style={{ fontSize: '22px', fontWeight: 700 }}>{b.value}</div>
                    <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>{b.title}</div>
                  </div>
                ))}
              </div>

              {/* Subscription Plans Management Card */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '17px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="ph ph-package" style={{ color: '#3b82f6' }}></i> إدارة باقات الاشتراك وتفاصيلها (Subscription Plans CRUD)
                </h3>

                {/* Add New Plan Form */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '14.5px', fontWeight: 700 }}>إضافة باقة اشتراك جديدة</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>اسم الباقة</label>
                      <input
                        type="text"
                        placeholder="مثال: الباقة الذهبية"
                        value={newPlanName}
                        onChange={(e) => setNewPlanName(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', fontFamily: 'Cairo,sans-serif' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>السعر الشهري (ر.س)</label>
                      <input
                        type="text"
                        placeholder="مثال: 199 أو مجاناً"
                        value={newPlanPriceMonthly}
                        onChange={(e) => setNewPlanPriceMonthly(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', fontFamily: 'Cairo,sans-serif' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>السعر السنوي (ر.س / شهر)</label>
                      <input
                        type="text"
                        placeholder="مثال: 159 أو مجاناً"
                        value={newPlanPriceYearly}
                        onChange={(e) => setNewPlanPriceYearly(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', fontFamily: 'Cairo,sans-serif' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>الوصف المختصر</label>
                      <input
                        type="text"
                        placeholder="وصف الباقة والفئة المستهدفة..."
                        value={newPlanDesc}
                        onChange={(e) => setNewPlanDesc(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', fontFamily: 'Cairo,sans-serif' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>نص الشارة (Badge)</label>
                      <input
                        type="text"
                        placeholder="مثال: الأكثر شعبية / خصم 20%"
                        value={newPlanBadge}
                        onChange={(e) => setNewPlanBadge(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', fontFamily: 'Cairo,sans-serif' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>ميزات الباقة (كل ميزة في سطر منفصل)</label>
                    <textarea
                      placeholder="تصدير دقيق للقص (DXF/SVG/PDF)&#10;توزيع الشيت التلقائي&#10;معاينة ثلاثية الأبعاد"
                      value={newPlanFeaturesText}
                      onChange={(e) => setNewPlanFeaturesText(e.target.value)}
                      rows={3}
                      style={{ width: '100%', boxSizing: 'border-box', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '8px 10px', fontSize: '13px', fontFamily: 'Cairo,sans-serif' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={newPlanFeatured}
                        onChange={(e) => setNewPlanFeatured(e.target.checked)}
                        style={{ accentColor: '#3b82f6' }}
                      />
                      تميز هذه الباقة (الباقة المميزة - Featured)
                    </label>

                    <button
                      onClick={() => {
                        if (!newPlanName) { toast.error('يرجى إدخال اسم الباقة'); return; }
                        const featuresList = newPlanFeaturesText
                          .split('\n')
                          .map(s => s.trim())
                          .filter(Boolean);
                        
                        const newPlan: SubscriptionPlan = {
                          id: `plan-${Date.now()}`,
                          name: newPlanName,
                          desc: newPlanDesc,
                          priceMonthly: isNaN(Number(newPlanPriceMonthly)) ? newPlanPriceMonthly : Number(newPlanPriceMonthly),
                          priceYearly: isNaN(Number(newPlanPriceYearly)) ? newPlanPriceYearly : Number(newPlanPriceYearly),
                          badge: newPlanBadge || undefined,
                          cta: newPlanCta || 'اشترك الآن',
                          featured: newPlanFeatured,
                          features: featuresList,
                        };

                        const updated = [...plansList, newPlan];
                        setPlansList(updated);
                        updatePlans(updated);
                        
                        // Clear form
                        setNewPlanName('');
                        setNewPlanDesc('');
                        setNewPlanPriceMonthly('');
                        setNewPlanPriceYearly('');
                        setNewPlanBadge('');
                        setNewPlanFeaturesText('');
                        setNewPlanFeatured(false);
                        toast.success('تمت إضافة باقة الاشتراك بنجاح');
                      }}
                      style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      إضافة الباقة
                    </button>
                  </div>
                </div>

                {/* List Existing Plans */}
                <h4 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700 }}>الباقات الحالية والمفعلة</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {plansList.map((plan, index) => (
                    <div key={plan.id || index} style={{ border: `1px solid ${plan.featured ? '#3b82f6' : '#e2e8f0'}`, borderRadius: '8px', padding: '16px', background: plan.featured ? '#f0f7ff' : '#fff', position: 'relative' }}>
                      {plan.badge && (
                        <span style={{ position: 'absolute', top: '-10px', left: '16px', background: '#3b82f6', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 10px', borderRadius: '999px' }}>
                          {plan.badge}
                        </span>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>{plan.name}</div>
                        <button
                          onClick={() => {
                            const updated = plansList.filter(p => p.id !== plan.id);
                            setPlansList(updated);
                            updatePlans(updated);
                            toast.success('تم حذف الباقة');
                          }}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                        >
                          <i className="ph ph-trash" style={{ fontSize: '16px' }}></i>
                        </button>
                      </div>

                      <p style={{ fontSize: '12.5px', color: '#64748b', margin: '0 0 12px', minHeight: '2.4em' }}>{plan.desc}</p>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>السعر الشهري</label>
                          <input
                            type="text"
                            value={plan.priceMonthly}
                            onChange={(e) => {
                              const val = isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value);
                              const updated = plansList.map(p => p.id === plan.id ? { ...p, priceMonthly: val } : p);
                              setPlansList(updated);
                              updatePlans(updated);
                            }}
                            style={{ width: '100%', boxSizing: 'border-box', height: '32px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12.5px', fontWeight: 700 }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>السعر السنوي</label>
                          <input
                            type="text"
                            value={plan.priceYearly}
                            onChange={(e) => {
                              const val = isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value);
                              const updated = plansList.map(p => p.id === plan.id ? { ...p, priceYearly: val } : p);
                              setPlansList(updated);
                              updatePlans(updated);
                            }}
                            style={{ width: '100%', boxSizing: 'border-box', height: '32px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12.5px', fontWeight: 700 }}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>الميزات (ميزة بكل سطر)</label>
                        <textarea
                          value={(plan.features || []).join('\n')}
                          onChange={(e) => {
                            const newFeats = e.target.value.split('\n');
                            const updated = plansList.map(p => p.id === plan.id ? { ...p, features: newFeats } : p);
                            setPlansList(updated);
                            updatePlans(updated);
                          }}
                          rows={3}
                          style={{ width: '100%', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '6px 8px', fontSize: '12px', fontFamily: 'Cairo,sans-serif' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discount Promo Codes Management Card */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '17px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="ph ph-tag" style={{ color: '#ec4899' }}></i> إدارة أكواد الخصم والتخفيضات (Discount Codes & Coupons)
                </h3>

                {/* Add New Discount Code Form */}
                <div style={{ background: '#fdf2f8', border: '1px solid #fbcfe8', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '14.5px', fontWeight: 700, color: '#9d174d' }}>إنشاء كود خصم ترويجي جديد</h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#831843', marginBottom: '4px' }}>رمز الخصم (Coupon Code)</label>
                      <input
                        type="text"
                        placeholder="مثال: SAVE20"
                        value={newCodeName}
                        onChange={(e) => setNewCodeName(e.target.value.toUpperCase())}
                        style={{ width: '100%', boxSizing: 'border-box', height: '38px', borderRadius: '6px', border: '1px solid #f472b6', padding: '0 10px', fontSize: '13px', fontFamily: 'monospace', fontWeight: 700, background: '#fff' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#831843', marginBottom: '4px' }}>نوع الخصم</label>
                      <select
                        value={newCodeType}
                        onChange={(e) => setNewCodeType(e.target.value as any)}
                        style={{ width: '100%', boxSizing: 'border-box', height: '38px', borderRadius: '6px', border: '1px solid #f472b6', padding: '0 10px', fontSize: '13px', fontFamily: 'Cairo,sans-serif', background: '#fff' }}
                      >
                        <option value="percentage">نسبة مئوية (%)</option>
                        <option value="fixed">مبلغ ثابت (ر.س)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#831843', marginBottom: '4px' }}>قيمة الخصم</label>
                      <input
                        type="number"
                        placeholder={newCodeType === 'percentage' ? '20' : '50'}
                        value={newCodeValue}
                        onChange={(e) => setNewCodeValue(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', height: '38px', borderRadius: '6px', border: '1px solid #f472b6', padding: '0 10px', fontSize: '13px', fontFamily: 'Cairo,sans-serif', background: '#fff' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#831843', marginBottom: '4px' }}>تطبيق على الباقة</label>
                      <select
                        value={newCodeTargetPlan}
                        onChange={(e) => setNewCodeTargetPlan(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', height: '38px', borderRadius: '6px', border: '1px solid #f472b6', padding: '0 10px', fontSize: '13px', fontFamily: 'Cairo,sans-serif', background: '#fff' }}
                      >
                        <option value="all">جميع الباقات (All Plans)</option>
                        {plansList.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#831843', marginBottom: '4px' }}>حد الاستخدام (اختياري)</label>
                      <input
                        type="number"
                        placeholder="100"
                        value={newCodeMaxUses}
                        onChange={(e) => setNewCodeMaxUses(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', height: '38px', borderRadius: '6px', border: '1px solid #f472b6', padding: '0 10px', fontSize: '13px', fontFamily: 'Cairo,sans-serif', background: '#fff' }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddDiscountCode}
                    style={{ background: '#db2777', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 20px', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    + إنشاء كود الخصم
                  </button>
                </div>

                {/* Discount Codes Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={styleTable}>
                    <thead>
                      <tr>
                        <th style={styleTh}>كود الخصم</th>
                        <th style={styleTh}>قيمة الخصم</th>
                        <th style={styleTh}>الباقة المشمولة</th>
                        <th style={styleTh}>الاستخدامات</th>
                        <th style={styleTh}>الحالة</th>
                        <th style={styleTh}>الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {discountCodesList.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                            لا يوجد أكواد خصم حالية. أنشئ كود جديد أعلاه.
                          </td>
                        </tr>
                      ) : (
                        discountCodesList.map((dc) => {
                          const targetPlanObj = plansList.find(p => p.id === dc.targetPlanId);
                          const targetName = dc.targetPlanId === 'all' ? 'جميع الباقات' : (targetPlanObj?.name || dc.targetPlanId);
                          const valLabel = dc.discountType === 'percentage' ? `${dc.discountValue}% خصم` : `${dc.discountValue} ر.س خصم`;

                          return (
                            <tr key={dc.id} className="row-hover">
                              <td style={{ ...styleTd, fontWeight: 700 }}>
                                <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', padding: '4px 10px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '13px' }}>
                                  {dc.code}
                                </span>
                              </td>
                              <td style={{ ...styleTd, fontWeight: 700, color: '#059669' }}>{valLabel}</td>
                              <td style={styleTd}>{targetName}</td>
                              <td style={styleTd}>{dc.usedCount} / {dc.maxUses || 'غير محدود'}</td>
                              <td style={styleTd}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = discountCodesList.map(item => item.id === dc.id ? { ...item, isActive: !item.isActive } : item);
                                    setDiscountCodesList(updated);
                                    updateDiscountCodes(updated);
                                    toast.success(dc.isActive ? 'تم تعطيل الكود' : 'تم تفعيل الكود');
                                  }}
                                  style={{ border: 'none', background: dc.isActive ? '#ecfdf5' : '#fef2f2', color: dc.isActive ? '#047857' : '#b91c1c', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}
                                >
                                  {dc.isActive ? 'مفعل ✓' : 'معطل ✕'}
                                </button>
                              </td>
                              <td style={styleTd}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(dc.code);
                                      toast.success(`تم نسخ الكود (${dc.code}) إلى الحافظة`);
                                    }}
                                    style={{ border: 'none', background: '#f1f5f9', color: '#334155', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                                    title="نسخ الكود"
                                  >
                                    <i className="ph ph-copy"></i>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = discountCodesList.filter(item => item.id !== dc.id);
                                      setDiscountCodesList(updated);
                                      updateDiscountCodes(updated);
                                      toast.success('تم حذف كود الخصم');
                                    }}
                                    style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                    title="حذف"
                                  >
                                    <i className="ph ph-trash" style={{ fontSize: '16px' }}></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Real Invoices List Table */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="ph ph-receipt" style={{ color: '#3b82f6' }}></i> سجل فواتير الاشتراكات الحقيقية ({realInvoices.length})
                  </h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={styleTable}>
                    <thead>
                      <tr>
                        <th style={styleTh}>رقم الفاتورة</th>
                        <th style={styleTh}>العميل</th>
                        <th style={styleTh}>باقة الاشتراك</th>
                        <th style={styleTh}>المبلغ</th>
                        <th style={styleTh}>التاريخ</th>
                        <th style={styleTh}>الحالة</th>
                        <th style={styleTh}>الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {realInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                            لا يوجد فواتير اشتراكات حتى الآن.
                          </td>
                        </tr>
                      ) : (
                        realInvoices.map((inv) => (
                          <tr key={inv.id} className="row-hover">
                            <td style={{ ...styleTd, fontWeight: 700, fontFamily: 'monospace', color: '#1e293b' }}>
                              {inv.id}
                            </td>
                            <td style={{ ...styleTd, fontWeight: 700 }}>{inv.client}</td>
                            <td style={styleTd}>
                              <span style={{ background: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                                {inv.planName}
                              </span>
                            </td>
                            <td style={{ ...styleTd, fontWeight: 700, color: inv.amountValue > 0 ? '#059669' : '#64748b' }}>
                              {inv.amount}
                            </td>
                            <td style={styleTd}>{inv.date}</td>
                            <td style={styleTd}>
                              <span style={{ background: inv.amountValue === 0 ? '#f1f5f9' : (inv.status === 'مدفوع' ? '#ecfdf5' : '#fef2f2'), color: inv.amountValue === 0 ? '#475569' : (inv.status === 'مدفوع' ? '#047857' : '#b91c1c'), fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px' }}>
                                {inv.status}
                              </span>
                            </td>
                            <td style={styleTd}>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedInvoice(inv)}
                                  style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#1e293b', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                                  title="عرض الفاتورة"
                                >
                                  <Eye className="w-3.5 h-3.5 text-blue-600" /> عرض الفاتورة
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadInvoicePDF(inv)}
                                  style={{ border: 'none', background: '#3b82f6', color: '#fff', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                                  title="تنزيل / طباعة"
                                >
                                  <Download className="w-3.5 h-3.5" /> تنزيل
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pricing Page Texts & FAQs Form */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '17px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="ph ph-currency-dollar" style={{ color: '#3b82f6' }}></i> إدارة محتوى نصوص صفحة الأسعار (/pricing)
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>نص الشارة العلوية (Hero Tag)</label>
                    <input
                      type="text"
                      value={pricingForm.heroTag}
                      onChange={(e) => setPricingForm({ ...pricingForm, heroTag: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', height: '40px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13.5px', fontFamily: 'Cairo,sans-serif' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>عنوان صفحة الأسعار الرئيسي</label>
                    <input
                      type="text"
                      value={pricingForm.heroTitle}
                      onChange={(e) => setPricingForm({ ...pricingForm, heroTitle: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', height: '40px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13.5px', fontFamily: 'Cairo,sans-serif' }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>الوصف التوضيحي بالهيدر</label>
                    <textarea
                      value={pricingForm.heroSubtitle}
                      onChange={(e) => setPricingForm({ ...pricingForm, heroSubtitle: e.target.value })}
                      rows={2}
                      style={{ width: '100%', boxSizing: 'border-box', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '10px 12px', fontSize: '13.5px', fontFamily: 'Cairo,sans-serif', resize: 'vertical' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>عنوان قسم التصدير والضمانات</label>
                    <input
                      type="text"
                      value={pricingForm.guaranteeTitle}
                      onChange={(e) => setPricingForm({ ...pricingForm, guaranteeTitle: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', height: '40px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13.5px', fontFamily: 'Cairo,sans-serif' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>عنوان قسم أسئلة الأسعار</label>
                    <input
                      type="text"
                      value={pricingForm.faqTitle}
                      onChange={(e) => setPricingForm({ ...pricingForm, faqTitle: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', height: '40px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13.5px', fontFamily: 'Cairo,sans-serif' }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>وصف قسم التصدير والضمانات</label>
                    <textarea
                      value={pricingForm.guaranteeSubtitle}
                      onChange={(e) => setPricingForm({ ...pricingForm, guaranteeSubtitle: e.target.value })}
                      rows={2}
                      style={{ width: '100%', boxSizing: 'border-box', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '10px 12px', fontSize: '13.5px', fontFamily: 'Cairo,sans-serif', resize: 'vertical' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>شارة الضمان الأولى</label>
                    <input
                      type="text"
                      value={pricingForm.badge1}
                      onChange={(e) => setPricingForm({ ...pricingForm, badge1: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', height: '40px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13.5px', fontFamily: 'Cairo,sans-serif' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>شارة الضمان الثانية</label>
                    <input
                      type="text"
                      value={pricingForm.badge2}
                      onChange={(e) => setPricingForm({ ...pricingForm, badge2: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', height: '40px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13.5px', fontFamily: 'Cairo,sans-serif' }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    updatePricingContent(pricingForm);
                    toast.success('تم حفظ نصوص صفحة الأسعار بنجاح');
                  }}
                  style={{ background: '#1e293b', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '999px', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', marginBottom: '24px' }}
                >
                  حفظ نصوص صفحة الأسعار
                </button>

                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '20px 0' }} />

                <h4 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700 }}>إدارة أسئلة صفحة الأسعار</h4>

                {/* Add new Pricing FAQ */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', marginBottom: '10px' }}>
                    <input
                      type="text"
                      placeholder="السؤال حول الأسعار..."
                      value={newPricingFaqQ}
                      onChange={(e) => setNewPricingFaqQ(e.target.value)}
                      style={{ height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', fontFamily: 'Cairo,sans-serif' }}
                    />
                    <textarea
                      placeholder="الإجابة..."
                      value={newPricingFaqA}
                      onChange={(e) => setNewPricingFaqA(e.target.value)}
                      rows={2}
                      style={{ width: '100%', boxSizing: 'border-box', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '8px 12px', fontSize: '13px', fontFamily: 'Cairo,sans-serif' }}
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (!newPricingFaqQ || !newPricingFaqA) { toast.error('يرجى إدخال السؤال والإجابة'); return; }
                      const updatedFaqs = [
                        ...pricingForm.pricingFaqs,
                        { id: `p-faq-${Date.now()}`, question: newPricingFaqQ, answer: newPricingFaqA },
                      ];
                      const updatedForm = { ...pricingForm, pricingFaqs: updatedFaqs };
                      setPricingForm(updatedForm);
                      updatePricingContent(updatedForm);
                      setNewPricingFaqQ('');
                      setNewPricingFaqA('');
                      toast.success('تمت إضافة السؤال بنجاح');
                    }}
                    style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    إضافة سؤال أسعار جديد
                  </button>
                </div>

                {/* List Pricing FAQs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {pricingForm.pricingFaqs.map((pf) => (
                    <div key={pf.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', background: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#1e293b' }}>{pf.question}</div>
                        <button
                          onClick={() => {
                            const updatedFaqs = pricingForm.pricingFaqs.filter(f => f.id !== pf.id);
                            const updatedForm = { ...pricingForm, pricingFaqs: updatedFaqs };
                            setPricingForm(updatedForm);
                            updatePricingContent(updatedForm);
                            toast.success('تم حذف السؤال');
                          }}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                        >
                          <i className="ph ph-trash" style={{ fontSize: '16px' }}></i>
                        </button>
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#64748b', lineHeight: 1.5 }}>{pf.answer}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION: Content (Hero Banner & FAQs) */}
          {activeSection === 'content' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              
              {/* Hero Banner Form */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '17px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="ph ph-image" style={{ color: '#3b82f6' }}></i> تعديل البانر الرئيسي (Hero Banner)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>العنوان الرئيسي</label>
                    <input
                      type="text"
                      value={bannerForm.title}
                      onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', height: '40px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13.5px', fontFamily: 'Cairo,sans-serif' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>نص زر الإجراء (CTA Button)</label>
                    <input
                      type="text"
                      value={bannerForm.ctaText}
                      onChange={(e) => setBannerForm({ ...bannerForm, ctaText: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', height: '40px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13.5px', fontFamily: 'Cairo,sans-serif' }}
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>الوصف الفرعي (Subtitle)</label>
                    <textarea
                      value={bannerForm.subtitle}
                      onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })}
                      rows={3}
                      style={{ width: '100%', boxSizing: 'border-box', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '10px 12px', fontSize: '13.5px', fontFamily: 'Cairo,sans-serif', resize: 'vertical' }}
                    />
                  </div>
                </div>
                <button
                  onClick={() => {
                    updateBanner(bannerForm);
                    toast.success('تم حفظ بيانات البانر الرئيسي بنجاح');
                  }}
                  style={{ marginTop: '16px', background: '#1e293b', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '999px', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  حفظ البانر
                </button>
              </div>

              {/* FAQs Management */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '17px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="ph ph-question" style={{ color: '#3b82f6' }}></i> إدارة الأسئلة الشائعة (FAQs)
                </h3>

                {/* Add new FAQ */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700 }}>إضافة سؤال جديد</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <input
                      type="text"
                      placeholder="السؤال..."
                      value={newFaqQuestion}
                      onChange={(e) => setNewFaqQuestion(e.target.value)}
                      style={{ height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', fontFamily: 'Cairo,sans-serif' }}
                    />
                    <input
                      type="text"
                      placeholder="التصنيف (مثال: الأسعار، الإنتاج)..."
                      value={newFaqCat}
                      onChange={(e) => setNewFaqCat(e.target.value)}
                      style={{ height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', fontFamily: 'Cairo,sans-serif' }}
                    />
                  </div>
                  <textarea
                    placeholder="الإجابة التفصيلية..."
                    value={newFaqAnswer}
                    onChange={(e) => setNewFaqAnswer(e.target.value)}
                    rows={2}
                    style={{ width: '100%', boxSizing: 'border-box', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '8px 12px', fontSize: '13px', fontFamily: 'Cairo,sans-serif', marginBottom: '12px' }}
                  />
                  <button
                    onClick={() => {
                      if (!newFaqQuestion || !newFaqAnswer) { toast.error('يرجى إدخال السؤال والإجابة'); return; }
                      const newItem: FAQItem = {
                        id: `faq-${Date.now()}`,
                        question: newFaqQuestion,
                        answer: newFaqAnswer,
                        category: newFaqCat || 'عام',
                      };
                      const updated = [...faqsList, newItem];
                      setFaqsList(updated);
                      updateFaqs(updated);
                      setNewFaqQuestion('');
                      setNewFaqAnswer('');
                      toast.success('تمت إضافة السؤال بنجاح');
                    }}
                    style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    إضافة السؤال
                  </button>
                </div>

                {/* FAQs List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {faqsList.map((item) => (
                    <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', background: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>
                          <span style={{ background: '#e2e8f0', color: '#475569', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', marginLeft: '8px' }}>{item.category || 'عام'}</span>
                          {item.question}
                        </div>
                        <button
                          onClick={() => {
                            const updated = faqsList.filter(f => f.id !== item.id);
                            setFaqsList(updated);
                            updateFaqs(updated);
                            toast.success('تم حذف السؤال');
                          }}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                        >
                          <i className="ph ph-trash" style={{ fontSize: '16px' }}></i>
                        </button>
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>{item.answer}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* SECTION: Legal (Terms & Privacy) */}
          {activeSection === 'legal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              
              {/* Terms & Conditions Form */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="ph ph-file-text" style={{ color: '#3b82f6' }}></i> إدارة الشروط والأحكام
                  </h3>
                  <Link to="/terms" target="_blank" style={{ fontSize: '13px', color: '#3b82f6', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    معاينة الصفحة <i className="ph ph-arrow-square-out"></i>
                  </Link>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>العنوان الرئيسي</label>
                    <input
                      type="text"
                      value={termsForm.title}
                      onChange={(e) => setTermsForm({ ...termsForm, title: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', height: '40px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13.5px', fontFamily: 'Cairo,sans-serif' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>تاريخ آخر تحديث</label>
                    <input
                      type="text"
                      value={termsForm.lastUpdated}
                      onChange={(e) => setTermsForm({ ...termsForm, lastUpdated: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', height: '40px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13.5px', fontFamily: 'Cairo,sans-serif' }}
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>الوصف الفرعي (Subtitle)</label>
                    <textarea
                      value={termsForm.subtitle}
                      onChange={(e) => setTermsForm({ ...termsForm, subtitle: e.target.value })}
                      rows={2}
                      style={{ width: '100%', boxSizing: 'border-box', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '10px 12px', fontSize: '13.5px', fontFamily: 'Cairo,sans-serif', resize: 'vertical' }}
                    />
                  </div>
                </div>

                {/* Terms Sections list */}
                <h4 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>بنود الشروط والأحكام</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
                  {termsForm.sections.map((sec, idx) => (
                    <div key={sec.id || idx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', background: '#f8fafc' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>بند {idx + 1}</span>
                        <input
                          type="text"
                          value={sec.title}
                          onChange={(e) => {
                            const updated = [...termsForm.sections];
                            updated[idx] = { ...updated[idx], title: e.target.value };
                            setTermsForm({ ...termsForm, sections: updated });
                          }}
                          placeholder="عنوان البند..."
                          style={{ flex: 1, height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', fontFamily: 'Cairo,sans-serif', fontWeight: 700 }}
                        />
                        <button
                          onClick={() => {
                            const updated = termsForm.sections.filter((_, i) => i !== idx);
                            setTermsForm({ ...termsForm, sections: updated });
                          }}
                          title="حذف البند"
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px 8px' }}
                        >
                          <i className="ph ph-trash" style={{ fontSize: '16px' }}></i>
                        </button>
                      </div>
                      <textarea
                        value={sec.content}
                        onChange={(e) => {
                          const updated = [...termsForm.sections];
                          updated[idx] = { ...updated[idx], content: e.target.value };
                          setTermsForm({ ...termsForm, sections: updated });
                        }}
                        rows={3}
                        placeholder="محتوى البند..."
                        style={{ width: '100%', boxSizing: 'border-box', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '8px 12px', fontSize: '13px', fontFamily: 'Cairo,sans-serif', resize: 'vertical' }}
                      />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      const newSec: LegalSection = {
                        id: `term-${Date.now()}`,
                        title: `${termsForm.sections.length + 1}. بند جديد`,
                        content: 'نص البند الجديد هنا...',
                      };
                      setTermsForm({ ...termsForm, sections: [...termsForm.sections, newSec] });
                    }}
                    style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <i className="ph ph-plus"></i> إضافة بند جديد
                  </button>

                  <button
                    onClick={() => {
                      updateTermsContent(termsForm);
                      toast.success('تم حفظ الشروط والأحكام ونشرها بنجاح');
                    }}
                    style={{ background: '#1e293b', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '999px', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    حفظ الشروط والأحكام
                  </button>
                </div>
              </div>

              {/* Privacy Policy Form */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="ph ph-shield-check" style={{ color: '#3b82f6' }}></i> إدارة سياسة الخصوصية
                  </h3>
                  <Link to="/privacy" target="_blank" style={{ fontSize: '13px', color: '#3b82f6', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    معاينة الصفحة <i className="ph ph-arrow-square-out"></i>
                  </Link>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>العنوان الرئيسي</label>
                    <input
                      type="text"
                      value={privacyForm.title}
                      onChange={(e) => setPrivacyForm({ ...privacyForm, title: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', height: '40px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13.5px', fontFamily: 'Cairo,sans-serif' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>تاريخ آخر تحديث</label>
                    <input
                      type="text"
                      value={privacyForm.lastUpdated}
                      onChange={(e) => setPrivacyForm({ ...privacyForm, lastUpdated: e.target.value })}
                      style={{ width: '100%', boxSizing: 'border-box', height: '40px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13.5px', fontFamily: 'Cairo,sans-serif' }}
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>الوصف الفرعي (Subtitle)</label>
                    <textarea
                      value={privacyForm.subtitle}
                      onChange={(e) => setPrivacyForm({ ...privacyForm, subtitle: e.target.value })}
                      rows={2}
                      style={{ width: '100%', boxSizing: 'border-box', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '10px 12px', fontSize: '13.5px', fontFamily: 'Cairo,sans-serif', resize: 'vertical' }}
                    />
                  </div>
                </div>

                {/* Privacy Sections list */}
                <h4 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>بنود سياسة الخصوصية</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
                  {privacyForm.sections.map((sec, idx) => (
                    <div key={sec.id || idx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', background: '#f8fafc' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>بند {idx + 1}</span>
                        <input
                          type="text"
                          value={sec.title}
                          onChange={(e) => {
                            const updated = [...privacyForm.sections];
                            updated[idx] = { ...updated[idx], title: e.target.value };
                            setPrivacyForm({ ...privacyForm, sections: updated });
                          }}
                          placeholder="عنوان البند..."
                          style={{ flex: 1, height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px', fontFamily: 'Cairo,sans-serif', fontWeight: 700 }}
                        />
                        <button
                          onClick={() => {
                            const updated = privacyForm.sections.filter((_, i) => i !== idx);
                            setPrivacyForm({ ...privacyForm, sections: updated });
                          }}
                          title="حذف البند"
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px 8px' }}
                        >
                          <i className="ph ph-trash" style={{ fontSize: '16px' }}></i>
                        </button>
                      </div>
                      <textarea
                        value={sec.content}
                        onChange={(e) => {
                          const updated = [...privacyForm.sections];
                          updated[idx] = { ...updated[idx], content: e.target.value };
                          setPrivacyForm({ ...privacyForm, sections: updated });
                        }}
                        rows={3}
                        placeholder="محتوى البند..."
                        style={{ width: '100%', boxSizing: 'border-box', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '8px 12px', fontSize: '13px', fontFamily: 'Cairo,sans-serif', resize: 'vertical' }}
                      />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      const newSec: LegalSection = {
                        id: `priv-${Date.now()}`,
                        title: `${privacyForm.sections.length + 1}. بند جديد`,
                        content: 'نص البند الجديد هنا...',
                      };
                      setPrivacyForm({ ...privacyForm, sections: [...privacyForm.sections, newSec] });
                    }}
                    style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <i className="ph ph-plus"></i> إضافة بند جديد
                  </button>

                  <button
                    onClick={() => {
                      updatePrivacyContent(privacyForm);
                      toast.success('تم حفظ سياسة الخصوصية ونشرها بنجاح');
                    }}
                    style={{ background: '#1e293b', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '999px', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    حفظ سياسة الخصوصية
                  </button>
                </div>
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

          {/* View Invoice Dialog */}
          <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
            <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between border-b pb-3 font-bold text-base">
                  <span>تفاصيل الفاتورة الضريبية — {selectedInvoice?.id}</span>
                </DialogTitle>
              </DialogHeader>

              {selectedInvoice && (
                <div className="space-y-5 p-2 bg-white text-slate-900 text-right">
                  {/* Header */}
                  <div className="flex justify-between items-start border-b pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">منصة برينتيرا — Print Logic</h3>
                      <p className="text-xs text-slate-500">حسابات وقوالب هندسة التغليف والعلب</p>
                      <p className="text-xs text-slate-500 mt-1">الرقم الضريبي: 310045981200003</p>
                    </div>
                    <div className="text-left">
                      <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded ${selectedInvoice.amountValue === 0 ? 'bg-slate-100 text-slate-700' : 'bg-green-100 text-green-800'}`}>
                        {selectedInvoice.status}
                      </span>
                      <p className="text-xs font-mono font-bold text-slate-700 mt-2">رقم: {selectedInvoice.id}</p>
                      <p className="text-xs text-slate-500">{selectedInvoice.date}</p>
                    </div>
                  </div>

                  {/* Client & Plan Info */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block mb-0.5">بيانات المشترك:</span>
                      <strong className="text-slate-900 text-sm">{selectedInvoice.client}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-0.5">خطة الاشتراك:</span>
                      <strong className="text-blue-700 text-sm">{selectedInvoice.planName}</strong>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="border rounded-lg overflow-hidden border-slate-200">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">الوصف والخدمة</th>
                          <th className="p-2.5 text-center">المدة</th>
                          <th className="p-2.5 text-left">الأساسي</th>
                          <th className="p-2.5 text-left">الضريبة (15%)</th>
                          <th className="p-2.5 text-left">المجموع</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        <tr>
                          <td className="p-2.5 font-semibold">ترخيص وقوالب {selectedInvoice.planName}</td>
                          <td className="p-2.5 text-center">شهري</td>
                          <td className="p-2.5 text-left">{(selectedInvoice.amountValue / 1.15).toFixed(2)} ر.س</td>
                          <td className="p-2.5 text-left">{(selectedInvoice.amountValue - (selectedInvoice.amountValue / 1.15)).toFixed(2)} ر.س</td>
                          <td className="p-2.5 text-left font-bold text-slate-900">{selectedInvoice.amountValue.toFixed(2)} ر.س</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Totals Box */}
                  <div className="flex justify-end pt-1">
                    <div className="w-64 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-600">المبلغ قبل الضريبة:</span>
                        <span className="font-semibold">{(selectedInvoice.amountValue / 1.15).toFixed(2)} ر.س</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">ضريبة القيمة المضافة (15%):</span>
                        <span className="font-semibold">{(selectedInvoice.amountValue - (selectedInvoice.amountValue / 1.15)).toFixed(2)} ر.س</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1.5 text-sm">
                        <span>الإجمالي المدفوع:</span>
                        <span className="text-blue-600">{selectedInvoice.amountValue.toFixed(2)} ر.س</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0 mt-4">
                <Button variant="outline" onClick={() => setSelectedInvoice(null)}>إغلاق</Button>
                <Button onClick={() => handleDownloadInvoicePDF()} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                  <Download className="w-4 h-4" /> تنزيل / طباعة الفاتورة PDF
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </main>
      </div>
    </div>
  );
}
