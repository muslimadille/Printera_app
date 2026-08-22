import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';

import A60_20_01_01Calculator from '@/components/boxes/A60_20_01_01Calculator';
import T0002Calculator from '@/components/boxes/T0002Calculator';
import F70_01_00_00_ACalculator from '@/components/boxes/F70_01_00_00_ACalculator';
import B15_06_00_55Calculator from '@/components/boxes/B15_06_00_55Calculator';
import Bag_B_1Calculator from '@/components/boxes/Bag_B_1Calculator';
import F10_41_00_00Calculator from '@/components/boxes/F10_41_00_00Calculator';
import Gable_Box_1Calculator from '@/components/boxes/Gable_Box_1Calculator';
import Basket_Box_1Calculator from '@/components/boxes/Basket_Box_1Calculator';

// Fallback metadata just in case DB fetch fails or doesn't have it
const TEMPLATE_META_FALLBACK: Record<string, { title: string; categoryLabel: string; desc: string; pro?: boolean }> = {
  'A60_20_01_01': { title: 'علبة ذاتية القفل ECMA', categoryLabel: 'طي وصواني', desc: 'علبة كرتون بقاع أوتوماتيكي سريع الغلق (Crash Lock / 2-Point Gluing).' },
  'T0002': { title: 'علبة مستقيمة الإغلاق', categoryLabel: 'طي وصواني', desc: 'التصميم الأساسي لعلب الطي الكرتونية، إغلاق علوي وسفلي بسيط بدون لصق.' },
  'F70_01_00_00_A': { title: 'علبة وسادة ECMA', categoryLabel: 'طي وصواني', desc: 'علبة كرتون بتصميم وسادة مقوسة مع ألسنة إغلاق هلالية سريعة.' },
  'B15_06_00_55': { title: 'علبة بقفل ذاتي وغطاء متداخل', categoryLabel: 'طي وصواني', desc: 'علبة كرتون ECMA B15 بقاع ذاتي القفل وألسنة تعشيق مع غطاء متداخل.' },
  'Bag_B_1': { title: 'كيس ورقي بقاعدة مستطيلة', categoryLabel: 'أكياس ورقية', desc: 'كيس ورقي بقاعدة مستطيلة وطيات جانبية (Gusseted Paper Bag).' },
  'F10_41_00_00': { title: 'علبة قفل أوتوماتيكي مع نافذة', categoryLabel: 'طي وصواني', desc: 'علبة كرتون بقفل أوتوماتيكي علوي وسفلي مع نافذة عرض مقصوصة (ECMA F10.41.00.00).' },
  'Gable_Box_1': { title: 'علبة قمة هرمية بمقبض وثقوب حبل', categoryLabel: 'علب وأكياس بمقبض', desc: 'علبة كرتون بقمة هرمية مطوية مع مقبض علوي وثقوب دائرية لحبال الحمل وقاع قفل أوتوماتيكي.' },
  'Basket_Box_1': { title: 'علبة سلة بمقبض وأقفال مقوسة', categoryLabel: 'علب وأكياس بمقبض', desc: 'علبة سلة هدايا بمقبض حمل علوي مريح وأقفال جانبية مقوسة ذاتية التجميع.' },
};

export default function TemplateDetail() {
  const { id } = useParams<{ id: string }>();
  const [template, setTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTemplate() {
      if (!id) return;
      try {
        const { data } = await supabase.from('app_templates').select('*').eq('id', id).maybeSingle();
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
      case 'F70_01_00_00_A': return <F70_01_00_00_ACalculator isAdmin={true} />;
      case 'B15_06_00_55': return <B15_06_00_55Calculator isAdmin={true} />;
      case 'Bag_B_1': return <Bag_B_1Calculator />;
      case 'F10_41_00_00': return <F10_41_00_00Calculator />;
      case 'Gable_Box_1': return <Gable_Box_1Calculator />;
      case 'Basket_Box_1': return <Basket_Box_1Calculator />;
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
