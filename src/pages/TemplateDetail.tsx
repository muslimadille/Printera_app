import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';

import A60_20_01_01Calculator from '@/components/boxes/A60_20_01_01Calculator';
import T0002Calculator from '@/components/boxes/T0002Calculator';

// Fallback metadata just in case DB fetch fails or doesn't have it
const TEMPLATE_META_FALLBACK: Record<string, { title: string; categoryLabel: string; desc: string; pro?: boolean }> = {
  'A60_20_01_01': { title: 'علبة ذاتية القفل ECMA', categoryLabel: 'طي وصواني', desc: 'علبة كرتون بقاع أوتوماتيكي سريع الغلق (Crash Lock / 2-Point Gluing).' },
  'T0002': { title: 'علبة مستقيمة الإغلاق', categoryLabel: 'طي وصواني', desc: 'التصميم الأساسي لعلب الطي الكرتونية، إغلاق علوي وسفلي بسيط بدون لصق.' },
};

export default function TemplateDetail() {
  const { id } = useParams<{ id: string }>();
  const [template, setTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTemplate() {
      if (!id) return;
      try {
        const { data } = await supabase.from('app_templates').select('*').eq('id', id).single();
        const storedOverrides = JSON.parse(localStorage.getItem('printCalc_customTemplateOverrides') || '{}');
        const ov = storedOverrides[id];
        
        const base = data || TEMPLATE_META_FALLBACK[id] || null;
        if (base && ov) {
          setTemplate({
            ...base,
            title: ov.title || base.title,
            categoryLabel: ov.categoryLabel || base.categoryLabel,
            default_w: ov.defaultW ?? base.default_w,
            default_h: ov.defaultH ?? base.default_h,
            default_d: ov.defaultD ?? base.default_d,
          });
        } else {
          setTemplate(base);
        }
      } catch (err) {
        console.error("Failed to fetch template", err);
        const storedOverrides = JSON.parse(localStorage.getItem('printCalc_customTemplateOverrides') || '{}');
        const ov = storedOverrides[id];
        const base = TEMPLATE_META_FALLBACK[id] || null;
        if (base && ov) {
          setTemplate({
            ...base,
            title: ov.title || base.title,
            categoryLabel: ov.categoryLabel || base.categoryLabel,
            default_w: ov.defaultW ?? base.default_w,
            default_h: ov.defaultH ?? base.default_h,
            default_d: ov.defaultD ?? base.default_d,
          });
        } else {
          setTemplate(base);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchTemplate();

    window.addEventListener('appTemplatesUpdated', fetchTemplate);
    window.addEventListener('appContentUpdated', fetchTemplate);
    window.addEventListener('storage', fetchTemplate);
    return () => {
      window.removeEventListener('appTemplatesUpdated', fetchTemplate);
      window.removeEventListener('appContentUpdated', fetchTemplate);
      window.removeEventListener('storage', fetchTemplate);
    };
  }, [id]);

  // Helper to render the calculator component
  const renderCalculator = () => {
    switch (id) {
      case 'A60_20_01_01': return <A60_20_01_01Calculator isAdmin={true} />;
      case 'T0002': return <T0002Calculator isAdmin={true} />;
      default:
        return (
          <div style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)', color: 'var(--brand-muted-2)' }}>
            <i className="ph ph-warning" style={{ fontSize: '48px', color: 'var(--brand-pro)', display: 'block', marginBottom: 'var(--space-2)' }}></i>
            القالب المطلوب غير متوفر حالياً.
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--brand-bg)', color: 'var(--brand-navy)' }}>
        <Header />
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--brand-muted-2)' }}>جاري تحميل بيانات القالب...</div>
      </div>
    );
  }

  const isPro = template?.pro ?? false;

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#ffffff', color: 'var(--brand-navy)' }}>
      {/* ===== Main editor workspace ===== */}
      <main className="qawalib-editor" style={{ padding: 0 }}>
        {renderCalculator()}
      </main>

      <Footer />
    </div>
  );
}
