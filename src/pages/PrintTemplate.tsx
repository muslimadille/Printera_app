import { useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';

const TEMPLATE_META: Record<string, { title: string; categoryLabel: string; desc: string; svg: string }> = {
  'T00012': { title: 'علبة بريدية بغطاء ملتف', categoryLabel: 'تغليف تجزئة', desc: 'علبة بريدية مغلقة بالكامل مع غطاء ملتف، مناسبة للشحن المباشر للعميل.', svg: '/templates/preview/A10_20_03_01.svg' },
  'T0002': { title: 'علبة مستقيمة الإغلاق', categoryLabel: 'طي وصواني', desc: 'التصميم الأساسي لعلب الطي الكرتونية، إغلاق علوي وسفلي بسيط بدون لصق.', svg: '/templates/preview/A10_10_03_03.svg' },
  'T0005': { title: 'صندوق غطاء مفتوح بقفل', categoryLabel: 'طي وصواني', desc: 'غطاء علوي مفتوح مع لسان قفل ولسان غبار جانبي لثبات إضافي.', svg: '/templates/preview/A10_20_02_02.svg' },
  'T0006': { title: 'علبة قفل مزدوج الجدار', categoryLabel: 'غطاء وقاعدة', desc: 'جدار مزدوج للمتانة، غطاء وقاعدة منفصلان بنفس آلية القفل.', svg: '/templates/preview/A10_75_03_03.svg' },
  'D001-H': { title: 'علبة كيك بمقبض حمل', categoryLabel: 'تغليف تجزئة', desc: 'علبة كلاسيكية بمقبض حمل مدمج، مثالية للمخبوزات والهدايا الصغيرة.', svg: '/templates/preview/A10_10_02_02_11.svg' },
  'MED1': { title: 'علبة دواء صغيرة', categoryLabel: 'طي وصواني', desc: 'قالب دقيق للعلب الصغيرة، مضبوط لأبعاد الشرائط والأمبولات الدوائية.', svg: '/templates/preview/A20_01_02_00.svg' },
  'SELFLOCK': { title: 'علبة ذاتية القفل', categoryLabel: 'طي وصواني', desc: 'قفل من جهة واحدة بدون لاصق، تصميم شبيه بعلب البيتزا سريعة التركيب.', svg: '/templates/preview/A20_01_03_00.svg' },
  'LIDBASE': { title: 'علبة غطاء وقاعدة منفصلة', categoryLabel: 'غطاء وقاعدة', desc: 'قطعتان منفصلتان تمامًا، مظهر فاخر يناسب علب الهدايا والمنتجات المميزة.', svg: '/templates/preview/A10_40_03_03.svg' },
  'TUBE1': { title: 'علبة أسطوانية بغطاء علوي', categoryLabel: 'علب أسطوانية', desc: 'هيكل أسطواني بغطاء علوي منفصل، مناسب للمنتجات الدائرية والعطور.', svg: '/templates/preview/A10_80_02_02.svg' },
  'SLIDE1': { title: 'علبة سحب درج', categoryLabel: 'علب سحب', desc: 'درج داخلي ينزلق داخل غلاف خارجي، تجربة فتح فاخرة للمنتجات المميزة.', svg: '/templates/preview/A11_11_03_03.svg' },
  'HEX1': { title: 'علبة سداسية الشكل', categoryLabel: 'أشكال غير مستطيلة', desc: 'هيكل سداسي غير تقليدي يبرز المنتج على الرف بشكل مختلف عن المعتاد.', svg: '/templates/preview/A10_99_03_03.svg' },
  'HD1': { title: 'صينية تعبئة ثقيلة', categoryLabel: 'تغليف ثقيل', desc: 'صينية مقواة بجدارين لتحمل الأوزان الثقيلة أثناء الشحن والتخزين.', svg: '/templates/preview/A10_70_03_00.svg' },
};

const UNIT_FACTORS = { mm: 1, cm: 10, in: 25.4 };
const toDisplay = (mm: number, unit: string) => {
  const factor = UNIT_FACTORS[unit as 'mm' | 'cm' | 'in'] || 1;
  return parseFloat((mm / factor).toFixed(2));
};

export default function PrintTemplate() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  // Retrieve params from URL with fallback values
  const unit = searchParams.get('unit') || 'mm';
  const width = parseFloat(searchParams.get('width') || '200');
  const height = parseFloat(searchParams.get('height') || '120');
  const depth = parseFloat(searchParams.get('depth') || '80');
  const glueFlap = parseFloat(searchParams.get('glueFlap') || '15');
  const lidTongue = parseFloat(searchParams.get('lidTongue') || '20');
  const dustFlap = parseFloat(searchParams.get('dustFlap') || '18');
  
  const sheetWidth = parseFloat(searchParams.get('sheetWidth') || '700');
  const sheetHeight = parseFloat(searchParams.get('sheetHeight') || '1000');
  const gripper = parseFloat(searchParams.get('gripper') || '12');
  const sheetMargin = parseFloat(searchParams.get('sheetMargin') || '5');
  
  const allowRotation = searchParams.get('allowRotation') !== 'false';
  const rotationMode = searchParams.get('rotationMode') || 'auto';

  useEffect(() => {
    // Automatically trigger print dialog shortly after loading resources
    const timer = setTimeout(() => {
      window.print();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const meta = id ? TEMPLATE_META[id] : null;
  if (!meta) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>القالب غير موجود</h2>
      </div>
    );
  }

  // Basic bounding box calculations for display
  const bboxW = width * 2 + depth * 1.5 + glueFlap;
  const bboxH = height + lidTongue + dustFlap + 20;
  const usableW = sheetWidth - sheetMargin * 2;
  const usableH = sheetHeight - gripper - sheetMargin;
  const cols = Math.max(1, Math.floor(usableW / (bboxW + 3)));
  const rows = Math.max(1, Math.floor(usableH / (bboxH + 3)));

  const rotationLabels: Record<string, string> = {
    auto: 'تلقائي (الأفضل)',
    normal: 'بدون تدوير (0°)',
    rotated: 'تدوير فقط (90°)',
  };

  const styleTable: React.CSSProperties = {
    borderCollapse: 'collapse',
    width: '100%',
    marginBottom: '18px',
  };

  const styleTdTh: React.CSSProperties = {
    padding: '8px 10px',
    fontSize: '13px',
    textAlign: 'right',
  };

  const styleTh: React.CSSProperties = {
    ...styleTdTh,
    background: '#f4ede1',
    color: '#5a4c3c',
    fontWeight: 700,
    borderBottom: '1px solid #e6dccb',
  };

  const styleTd: React.CSSProperties = {
    ...styleTdTh,
    borderBottom: '1px solid #eee2cf',
    color: '#2b2013',
  };

  return (
    <div dir="rtl" style={{ background: '#ffffff', color: '#2b2013', fontFamily: 'Cairo, sans-serif', padding: '0.5in', maxWidth: '8.5in', margin: '0 auto' }}>
      
      {/* ===== Breadcrumbs ===== */}
      <div className="print:hidden" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#9c8f7c', marginBottom: '14px' }}>
        <Link to="/" style={{ color: '#9c8f7c', textDecoration: 'none' }}>مكتبة القوالب</Link>
        <i className="ph ph-caret-left" style={{ fontSize: '10px' }}></i>
        <span style={{ color: '#5a4c3c' }}>{meta.categoryLabel}</span>
        <i className="ph ph-caret-left" style={{ fontSize: '10px' }}></i>
        <span style={{ color: '#2b2013', fontWeight: 600 }}>{id}</span>
      </div>

      {/* ===== Header Row ===== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', borderBottom: '1px solid #eee2cf', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#2b2013', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '15px', fontWeight: 700 }}>ق</span>
          <div style={{ fontWeight: 700, fontSize: '16px' }}>قوالب<span style={{ color: '#a9622f' }}>لاين</span></div>
        </div>
        <div style={{ fontSize: '11px', color: '#9c8f7c' }}>ملخص طباعة القالب</div>
      </div>

      {/* ===== Title ===== */}
      <h1 style={{ fontSize: '26px', margin: '14px 0 4px', fontWeight: 700 }}>{meta.title} — {id}</h1>
      <p style={{ margin: '0 0 20px', color: '#8a7d6d', fontSize: '13px', maxWidth: '64ch', lineHeight: 1.5 }}>{meta.desc}</p>

      {/* ===== Preview Image ===== */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 24px' }}>
        <div style={{ width: '70%', maxWidth: '300px', background: '#faf6f0', border: '1px solid #e6dccb', borderRadius: '12px', padding: '20px' }}>
          <img src={meta.svg} alt={meta.title} style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
      </div>

      {/* ===== Specs Table ===== */}
      <div style={{ marginBottom: '18px' }}>
        <h2 style={{ fontSize: '16px', margin: '0 0 10px', borderBottom: '2px solid #2b2013', paddingBottom: '6px', fontWeight: 700 }}>أبعاد العلبة ({unit})</h2>
        <table style={styleTable}>
          <thead>
            <tr>
              <th style={styleTh}>العرض</th>
              <th style={styleTh}>الارتفاع</th>
              <th style={styleTh}>العمق</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styleTd}>{toDisplay(width, unit)}</td>
              <td style={styleTd}>{toDisplay(height, unit)}</td>
              <td style={styleTd}>{toDisplay(depth, unit)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ===== Advanced Customisation Table ===== */}
      <div style={{ marginBottom: '18px' }}>
        <h2 style={{ fontSize: '16px', margin: '0 0 10px', borderBottom: '2px solid #2b2013', paddingBottom: '6px', fontWeight: 700 }}>تخصيص متقدم ({unit})</h2>
        <table style={styleTable}>
          <thead>
            <tr>
              <th style={styleTh}>لسان اللصق</th>
              <th style={styleTh}>لسان القفل</th>
              <th style={styleTh}>لسان الغبار</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styleTd}>{toDisplay(glueFlap, unit)}</td>
              <td style={styleTd}>{toDisplay(lidTongue, unit)}</td>
              <td style={styleTd}>{toDisplay(dustFlap, unit)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ===== Sheet Settings Table ===== */}
      <div style={{ marginBottom: '18px' }}>
        <h2 style={{ fontSize: '16px', margin: '0 0 10px', borderBottom: '2px solid #2b2013', paddingBottom: '6px', fontWeight: 700 }}>إعدادات الشيت ({unit})</h2>
        <table style={styleTable}>
          <thead>
            <tr>
              <th style={styleTh}>عرض الشيت</th>
              <th style={styleTh}>ارتفاع الشيت</th>
              <th style={styleTh}>القابض</th>
              <th style={styleTh}>الهامش</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styleTd}>{toDisplay(sheetWidth, unit)}</td>
              <td style={styleTd}>{toDisplay(sheetHeight, unit)}</td>
              <td style={styleTd}>{toDisplay(gripper, unit)}</td>
              <td style={styleTd}>{toDisplay(sheetMargin, unit)}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: '11.5px', color: '#9c8f7c', margin: '8px 0 0' }}>
          الصافي: {toDisplay(usableW, unit)} × {toDisplay(usableH, unit)} {unit}
        </p>
      </div>

      {/* ===== Rotation & Repetition ===== */}
      <div style={{ marginBottom: '18px' }}>
        <h2 style={{ fontSize: '16px', margin: '0 0 10px', borderBottom: '2px solid #2b2013', paddingBottom: '6px', fontWeight: 700 }}>خيارات التدوير</h2>
        <table style={styleTable}>
          <tbody>
            <tr>
              <td style={{ ...styleTd, width: '60%' }}>السماح بتدوير التصميم 90°</td>
              <td style={styleTd}>{allowRotation ? 'مفعّل' : 'غير مفعّل'}</td>
            </tr>
            <tr>
              <td style={styleTd}>وضع التدوير</td>
              <td style={styleTd}>{rotationLabels[rotationMode] || rotationMode}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ===== Nesting Summary ===== */}
      <div style={{ marginBottom: '18px' }}>
        <h2 style={{ fontSize: '16px', margin: '0 0 10px', borderBottom: '2px solid #2b2013', paddingBottom: '6px', fontWeight: 700 }}>ملخص التوزيع</h2>
        <table style={styleTable}>
          <tbody>
            <tr>
              <td style={{ ...styleTd, width: '60%' }}>إجمالي القطع على الشيت</td>
              <td style={styleTd}>{cols * rows}</td>
            </tr>
            <tr>
              <td style={styleTd}>مقاس التوزيع (صفوف × أعمدة)</td>
              <td style={styleTd}>{rows} × {cols}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="print:hidden" style={{ textAlign: 'center', marginTop: '30px' }}>
        <button 
          onClick={() => window.print()} 
          style={{ background: '#2b2013', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '999px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
        >
          طباعة الآن
        </button>
      </div>
    </div>
  );
}
