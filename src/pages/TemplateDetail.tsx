import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';

// Import all calculators
import T00012Calculator from '@/components/boxes/T00012Calculator';
import T0002Calculator from '@/components/boxes/T0002Calculator';
import T0005Calculator from '@/components/boxes/T0005Calculator';
import T0006Calculator from '@/components/boxes/T0006Calculator';
import D001Calculator from '@/components/boxes/D001Calculator';
import BoxDieCutCalculatorMedicine1 from '@/components/boxes/BoxDieCutCalculatorMedicine1';
import BoxDieCutCalculator from '@/components/boxes/BoxDieCutCalculator';
import BoxDieCutCalculator3 from '@/components/boxes/BoxDieCutCalculator3';
import BoxDieCutCalculator4 from '@/components/boxes/BoxDieCutCalculator4';
import BoxDieCutCalculator5 from '@/components/boxes/BoxDieCutCalculator5';
import BoxCarryingHandleBoxCalculator from '@/components/boxes/BoxCarryingHandleBoxCalculator';
import BoxDieCutCalculator2 from '@/components/boxes/BoxDieCutCalculator2';

// Fallback metadata just in case DB fetch fails or doesn't have it
const TEMPLATE_META_FALLBACK: Record<string, { title: string; categoryLabel: string; desc: string; pro?: boolean }> = {
  'T00012': { title: 'علبة بريدية بغطاء ملتف', categoryLabel: 'تغليف تجزئة', desc: 'علبة بريدية مغلقة بالكامل مع غطاء ملتف، مناسبة للشحن المباشر للعميل.' },
  'T0002': { title: 'علبة مستقيمة الإغلاق', categoryLabel: 'طي وصواني', desc: 'التصميم الأساسي لعلب الطي الكرتونية، إغلاق علوي وسفلي بسيط بدون لصق.' },
  'T0005': { title: 'صندوق غطاء مفتوح بقفل', categoryLabel: 'طي وصواني', desc: 'غطاء علوي مفتوح مع لسان قفل ولسان غبار جانبي لثبات إضافي.' },
  'T0006': { title: 'علبة قفل مزدوج الجدار', categoryLabel: 'غطاء وقاعدة', desc: 'جدار مزدوج للمتانة، غطاء وقاعدة منفصلان بنفس آلية القفل.' },
  'D001-H': { title: 'علبة كيك بمقبض حمل', categoryLabel: 'تغليف تجزئة', desc: 'علبة كلاسيكية بمقبض حمل مدمج، مثالية للمخبوزات والهدايا الصغيرة.' },
  'MED1': { title: 'علبة دواء صغيرة', categoryLabel: 'طي وصواني', desc: 'قالب دقيق للعلب الصغيرة، مضبوط لأبعاد الشرائط والأمبولات الدوائية.' },
  'SELFLOCK': { title: 'علبة ذاتية القفل', categoryLabel: 'طي وصواني', desc: 'قفل من جهة واحدة بدون لاصق، تصميم شبيه بعلب البيتزا سريعة التركيب.' },
  'LIDBASE': { title: 'علبة غطاء وقاعدة منفصلة', categoryLabel: 'غطاء وقاعدة', desc: 'قطعتان منفصلتان تمامًا، مظهر فاخر يناسب علب الهدايا والمنتجات المميزة.' },
  'TUBE1': { title: 'علبة أسطوانية بغطاء علوي', categoryLabel: 'علب أسطوانية', desc: 'هيكل أسطواني بغطاء علوي منفصل، مناسب للمنتجات الدائرية والعطور.' },
  'SLIDE1': { title: 'علبة سحب درج', categoryLabel: 'علب سحب', desc: 'درج داخلي ينزلق داخل غلاف خارجي، تجربة فتح فاخرة للمنتجات المميزة.' },
  'HEX1': { title: 'علبة سداسية الشكل', categoryLabel: 'أشكال غير مستطيلة', desc: 'هيكل سداسي غير تقليدي يبرز المنتج على الرف بشكل مختلف عن المعتاد.' },
  'HD1': { title: 'صينية تعبئة ثقيلة', categoryLabel: 'تغليف ثقيل', desc: 'صينية مقواة بجدارين لتحمل الأوزان الثقيلة أثناء الشحن والتخزين.' },
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
        if (data) {
          setTemplate(data);
        } else {
          // Fallback if not found in db
          setTemplate(TEMPLATE_META_FALLBACK[id] || null);
        }
      } catch (err) {
        console.error("Failed to fetch template", err);
        setTemplate(TEMPLATE_META_FALLBACK[id] || null);
      } finally {
        setLoading(false);
      }
    }
    fetchTemplate();
  }, [id]);

  // Helper to render the calculator component
  const renderCalculator = () => {
    switch (id) {
      case 'T00012': return <T00012Calculator />;
      case 'T0002': return <T0002Calculator />;
      case 'T0005': return <T0005Calculator />;
      case 'T0006': return <T0006Calculator />;
      case 'D001-H': return <D001Calculator />;
      case 'MED1': return <BoxDieCutCalculatorMedicine1 />;
      case 'SELFLOCK': return <BoxDieCutCalculator />;
      case 'LIDBASE': return <BoxDieCutCalculator3 />;
      case 'TUBE1': return <BoxDieCutCalculator4 />;
      case 'SLIDE1': return <BoxDieCutCalculator5 />;
      case 'HEX1': return <BoxCarryingHandleBoxCalculator />;
      case 'HD1': return <BoxDieCutCalculator2 />;
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
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--brand-bg)', color: 'var(--brand-navy)' }}>
      <Header />

      {/* ===== Breadcrumb + title ===== */}
      <div style={{ padding: 'var(--space-6) var(--space-8) 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--brand-muted-2)', marginBottom: 'var(--space-3)' }}>
          <Link to="/templates" style={{ color: 'var(--brand-muted-2)', textDecoration: 'none' }} className="hover:text-brand-navy transition-colors">القوالب</Link>
          <i className="ph ph-caret-left" style={{ fontSize: '11px' }}></i>
          {template && <span style={{ color: 'var(--brand-gold)' }}>{template.category_label || template.categoryLabel}</span>}
          {template && <i className="ph ph-caret-left" style={{ fontSize: '11px' }}></i>}
          <span style={{ color: 'var(--brand-navy)', fontWeight: 600 }}>{id}</span>
        </div>

        {template && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 700, color: 'var(--brand-navy)' }}>{template.title}</h1>
              {isPro && (
                <span style={{ background: 'var(--brand-pro)', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '6px' }}>PRO</span>
              )}
            </div>
            <p style={{ margin: 0, color: 'var(--brand-muted)', maxWidth: '56ch', fontSize: '14px', lineHeight: 1.5 }}>{template.description || template.desc}</p>
          </div>
        )}
      </div>

      {/* ===== Main editor workspace ===== */}
      <main className="qawalib-editor" style={{ padding: '0 var(--space-8) var(--space-8)' }}>
        {renderCalculator()}
      </main>

      <Footer />
    </div>
  );
}
