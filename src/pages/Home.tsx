import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TemplateCard from '@/components/TemplateCard';
import { HERO_STATS } from './TemplatesLibrary';
import { SavedQuote, listQuotes } from '@/lib/userApi';
import { supabase } from '@/integrations/supabase/client';

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!ref.current || shown) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);
  return { ref, shown };
}

const RevealAnim = ({
  children,
  animationClass = '',
  delay = 0,
}: {
  children: React.ReactNode;
  animationClass?: string;
  delay?: number;
}) => {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={shown ? animationClass : ''}
      style={{
        opacity: shown ? undefined : 0,
        animationDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};

const CATEGORY_ICONS: Record<string, string> = {
  folding: 'ph ph-package',
  tube: 'ph ph-cylinder',
  heavy: 'ph ph-cube',
  lidbase: 'ph ph-archive',
  retail: 'ph ph-shopping-bag',
  slide: 'ph ph-tray',
  nonrect: 'ph ph-hexagon',
};

const MOST_USED_IDS = ['T0005', 'T0002', 'T0006', 'D001-H'];

// Maps a saved quote's source_type to a representative preview image, the
// same heuristic Dashboard.tsx uses for its "saved templates" tab.
function previewFor(sourceType: string) {
  if (sourceType.includes('t0002') || sourceType.includes('lidtuck')) return '/templates/preview/A10_10_03_03.svg';
  if (sourceType.includes('t0006')) return '/templates/preview/A10_75_03_03.svg';
  if (sourceType.includes('d001')) return '/templates/preview/A10_10_02_02_11.svg';
  return '/templates/preview/A10_20_02_02.svg';
}

function editLinkFor(t: SavedQuote) {
  let templateId = 'T0005';
  if (t.source_type.startsWith('box_')) {
    templateId = t.source_type.replace('box_', '').toUpperCase();
  } else if (t.source_type === 'carryhandle') {
    templateId = 'HEX1';
  } else if (t.source_type === 'lidtuck') {
    templateId = 'T0002';
  }

  const data: Record<string, any> = t.quote_data || {};
  const query = new URLSearchParams({
    width: data.width || '200',
    height: data.height || '120',
    depth: data.depth || '80',
    glueFlap: data.glueFlap || '15',
    lidTongue: data.lidTongue || '20',
    dustFlap: data.dustFlap || '18',
    sheetWidth: data.sheetWidth || '700',
    sheetHeight: data.sheetHeight || '1000',
    gripper: data.gripper || '12',
    sheetMargin: data.sheetMargin || '5',
    unit: data.unit || 'mm',
    allowRotation: data.allowRotation !== false ? 'true' : 'false',
    rotationMode: data.rotationMode || 'auto',
  }).toString();
  return `/template/${templateId}?${query}`;
}

const SLIDES = [
  {
    title: "مجموعة واسعة من القوالب",
    subtitle: "قوالب بشكل فني واقعي جاهزة للتنفيذ المباشر بمقاييس دقيقة",
    buttonText: "اكتشف القوالب",
    link: "/templates",
    graphic: "templates"
  },
  {
    title: "تحكم كامل بالتفاصيل",
    subtitle: "التحكم الكامل بألسنة الغطاء، ألسنة الغبار، وزوايا القفل بشكل بسيط ومرن واقعي",
    buttonText: "ابدأ التصميم",
    link: "/templates",
    graphic: "controls"
  },
  {
    title: "مونتاج ذكي للقوالب",
    subtitle: "تعشيق تلقائي ذكي لتوزيع القالب على شيت الطباعة لتقليل الهدر وتحسين التكلفة",
    buttonText: "جرّب التوزيع",
    link: "/templates",
    graphic: "nesting"
  },
  {
    title: "عرض مرئي ثلاثي الأبعاد",
    subtitle: "معاينة ثلاثية أبعاد فورية وتفاعلية لمنتجك قبل البدء بالإنتاج والتصنيع",
    buttonText: "شاهد المعاينة",
    link: "/templates",
    graphic: "3d"
  },
  {
    title: "باقات الاشتراك",
    subtitle: "اشتراكات مرنة ومميزة تناسب المصممين المستقلين والمطابع برسوم رمزية تشغيلية",
    buttonText: "عرض الباقات",
    link: "/pricing",
    graphic: "pricing"
  }
];

const HeroSlider = () => {
  const [current, setCurrent] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const nextSlide = () => {
    setCurrent(prev => (prev + 1) % SLIDES.length);
  };

  const prevSlide = () => {
    setCurrent(prev => (prev - 1 + SLIDES.length) % SLIDES.length);
  };

  useEffect(() => {
    if (isHovered) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(nextSlide, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHovered]);

  const renderGraphic = (type: string) => {
    switch (type) {
      case 'templates':
        return (
          <div className="slider-graphic-container templates-graphic">
            <div className="card card-1">
              <span className="card-tag">T0002</span>
              <svg viewBox="0 0 100 100" className="mini-svg">
                <path d="M20,10 L80,10 L80,90 L20,90 Z M20,30 L80,30 M20,70 L80,70" fill="none" stroke="var(--brand-gold)" strokeWidth="1.5" strokeDasharray="2,2"/>
              </svg>
            </div>
            <div className="card card-2">
              <span className="card-tag">T0005</span>
              <svg viewBox="0 0 100 100" className="mini-svg">
                <path d="M10,20 L90,20 L90,80 L10,80 Z M30,20 L30,80 M70,20 L70,80" fill="none" stroke="var(--brand-gold)" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="card card-3">
              <span className="card-tag">D001</span>
              <svg viewBox="0 0 100 100" className="mini-svg">
                <circle cx="50" cy="50" r="30" fill="none" stroke="var(--brand-gold)" strokeWidth="1.5" />
                <path d="M50,10 L50,90 M10,50 L90,50" fill="none" stroke="var(--brand-gold)" strokeWidth="1.5" strokeDasharray="1,1"/>
              </svg>
            </div>
          </div>
        );
      case 'controls':
        return (
          <div className="slider-graphic-container controls-graphic">
            <div className="controls-sidebar">
              <div className="control-row"><span className="control-label">العرض</span><div className="control-bar"><div className="control-fill" style={{width: '70%'}}></div></div></div>
              <div className="control-row"><span className="control-label">الارتفاع</span><div className="control-bar"><div className="control-fill" style={{width: '45%'}}></div></div></div>
              <div className="control-row"><span className="control-label">العمق</span><div className="control-bar"><div className="control-fill" style={{width: '60%'}}></div></div></div>
            </div>
            <div className="controls-canvas">
              <div className="canvas-box">
                <svg viewBox="0 0 100 100" className="w-full h-full stroke-blue-500" fill="none" strokeWidth="1.5">
                  <rect x="25" y="25" width="50" height="50" rx="4" />
                  <line x1="25" y1="25" x2="15" y2="15" strokeDasharray="2,2" />
                  <line x1="75" y1="25" x2="85" y2="15" strokeDasharray="2,2" />
                  <line x1="25" y1="75" x2="15" y2="85" strokeDasharray="2,2" />
                  <line x1="75" y1="75" x2="85" y2="85" strokeDasharray="2,2" />
                </svg>
              </div>
            </div>
          </div>
        );
      case 'nesting':
        return (
          <div className="slider-graphic-container nesting-graphic">
            <div className="nesting-sheet">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="nesting-cell">
                  <span className="cell-num">{i + 1}</span>
                  <div className="cell-border"></div>
                </div>
              ))}
            </div>
          </div>
        );
      case '3d':
        return (
          <div className="slider-graphic-container threed-graphic">
            <div className="scene3d">
              <div className="cube">
                <div className="face front">PRINTERA</div>
                <div className="face back">3D</div>
                <div className="face right"></div>
                <div className="face left"></div>
                <div className="face top"></div>
                <div className="face bottom"></div>
              </div>
            </div>
          </div>
        );
      case 'pricing':
        return (
          <div className="slider-graphic-container pricing-graphic">
            <div className="pricing-badge">
              <div className="badge-header">الاشتراك المميز</div>
              <div className="badge-price">
                <span className="price-num">9.99</span>
                <span className="price-unit">$/أسبوع</span>
              </div>
              <ul className="badge-features">
                <li><i className="ph ph-check-circle"></i> وصول غير محدود لجميع القوالب</li>
                <li><i className="ph ph-check-circle"></i> تصدير بصيغ SVG و PDF</li>
                <li><i className="ph ph-check-circle"></i> تعشيق وتوزيع ذكي للشيت</li>
              </ul>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div 
      className="hero-slider"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="slider-bg-pattern"></div>
      
      <div className="slides-wrapper" style={{ transform: `translateX(-${current * 100}%)` }}>
        {SLIDES.map((slide, idx) => (
          <div key={idx} className={`slide-item ${current === idx ? 'active' : ''}`}>
            <div className="slide-content">
              <div className="slide-graphic-col">
                {renderGraphic(slide.graphic)}
              </div>
              
              <div className="slide-text-col">
                <h2 className="slide-title">{slide.title}</h2>
                <p className="slide-subtitle">{slide.subtitle}</p>
                <Link to={slide.link} className="slide-btn">
                  {slide.buttonText}
                  <i className="ph ph-arrow-left"></i>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="slider-arrow prev" onClick={prevSlide} aria-label="السابق">
        <i className="ph ph-caret-right"></i>
      </button>
      <button className="slider-arrow next" onClick={nextSlide} aria-label="التالي">
        <i className="ph ph-caret-left"></i>
      </button>

      <div className="slider-dots">
        {SLIDES.map((_, idx) => (
          <button 
            key={idx} 
            className={`dot-item ${current === idx ? 'active' : ''}`}
            onClick={() => setCurrent(idx)}
            aria-label={`شريحة ${idx + 1}`}
          />
        ))}
      </div>

      <style>{`
        .hero-slider {
          position: relative;
          width: 100%;
          height: 480px;
          background: #fff;
          border-bottom: 1px solid var(--brand-border);
          overflow: hidden;
          direction: ltr;
        }
        .slider-bg-pattern {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle at 1px 1px, var(--brand-border) 1px, transparent 0);
          background-size: 22px 22px;
          opacity: 0.7;
          pointer-events: none;
        }
        .slides-wrapper {
          display: flex;
          width: 100%;
          height: 100%;
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .slide-item {
          flex: 0 0 100%;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          direction: rtl;
        }
        .slide-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          max-width: 1100px;
          width: 100%;
          padding: 0 60px;
          align-items: center;
        }
        @media (max-width: 768px) {
          .slide-content {
            grid-template-columns: 1fr;
            text-align: center;
            gap: 20px;
            padding: 0 40px;
          }
          .hero-slider {
            height: 600px;
          }
        }
        .slide-text-col {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 16px;
          opacity: 0;
          transform: translateY(20px);
          transition: all 0.6s ease;
        }
        @media (max-width: 768px) {
          .slide-text-col {
            align-items: center;
          }
        }
        .active .slide-text-col {
          opacity: 1;
          transform: translateY(0);
        }
        .slide-title {
          font-size: 34px;
          font-weight: 800;
          color: var(--brand-navy);
          margin: 0;
          line-height: 1.3;
        }
        .slide-subtitle {
          font-size: 16px;
          color: var(--brand-muted);
          margin: 0;
          line-height: 1.6;
          max-width: 480px;
        }
        .slide-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--brand-gold);
          color: #fff;
          font-weight: 700;
          font-size: 14.5px;
          padding: 12px 28px;
          border-radius: 99px;
          text-decoration: none;
          transition: all 0.3s ease;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);
        }
        .slide-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
          background: var(--brand-navy);
        }
        .slide-btn i {
          font-size: 16px;
        }

        .slide-graphic-col {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 320px;
          opacity: 0;
          transform: scale(0.95);
          transition: all 0.6s ease;
        }
        .active .slide-graphic-col {
          opacity: 1;
          transform: scale(1);
        }

        .slider-graphic-container {
          position: relative;
          width: 320px;
          height: 260px;
          background: #f8fafc;
          border-radius: 16px;
          border: 1px solid var(--brand-border);
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(15, 29, 45, 0.04);
        }

        .templates-graphic {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .templates-graphic .card {
          position: absolute;
          width: 130px;
          height: 170px;
          background: #fff;
          border: 1px solid var(--brand-border);
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(15, 29, 45, 0.08);
          padding: 12px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: transform 0.4s ease;
        }
        .templates-graphic .card-1 {
          transform: translate(-35px, -10px) rotate(-8deg);
          z-index: 1;
        }
        .templates-graphic .card-2 {
          transform: translate(0, 0) rotate(0deg);
          z-index: 2;
          border-color: var(--brand-gold);
        }
        .templates-graphic .card-3 {
          transform: translate(35px, 10px) rotate(8deg);
          z-index: 1;
        }
        .templates-graphic .card-tag {
          font-size: 10px;
          font-weight: 700;
          color: var(--brand-muted);
          text-transform: uppercase;
        }
        .templates-graphic .mini-svg {
          width: 100%;
          height: 110px;
        }

        .controls-graphic {
          display: grid;
          grid-template-columns: 110px 1fr;
          height: 100%;
        }
        .controls-sidebar {
          background: #fff;
          border-left: 1px solid var(--brand-border);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .control-row {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .control-label {
          font-size: 10px;
          font-weight: 600;
          color: var(--brand-muted);
        }
        .control-bar {
          width: 100%;
          height: 6px;
          background: var(--brand-tag-bg);
          border-radius: 99px;
          overflow: hidden;
        }
        .control-fill {
          height: 100%;
          background: var(--brand-gold);
          border-radius: 99px;
        }
        .controls-canvas {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .canvas-box {
          width: 110px;
          height: 110px;
          background: #fff;
          border: 1px dashed var(--brand-gold);
          border-radius: 12px;
          padding: 10px;
        }

        .nesting-graphic {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .nesting-sheet {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 6px;
          width: 100%;
          height: 100%;
          background: #fff;
          border: 1px solid var(--brand-navy);
          border-radius: 8px;
          padding: 10px;
        }
        .nesting-cell {
          position: relative;
          background: var(--brand-tag-bg);
          border: 1px solid var(--brand-border);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          aspect-ratio: 4/5;
        }
        .cell-num {
          font-size: 9px;
          font-weight: 700;
          color: var(--brand-muted-2);
        }
        .cell-border {
          position: absolute;
          inset: 2px;
          border: 1px dashed rgba(37, 99, 235, 0.3);
          border-radius: 2px;
        }

        .threed-graphic {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0f172a;
        }
        .scene3d {
          width: 120px;
          height: 120px;
          perspective: 600px;
        }
        .cube {
          width: 100%;
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
          animation: rotateBox 12s infinite linear;
        }
        .face {
          position: absolute;
          width: 120px;
          height: 120px;
          background: rgba(37, 99, 235, 0.1);
          border: 2px solid var(--brand-gold);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: 800;
          font-size: 14px;
          box-sizing: border-box;
        }
        .front  { transform: rotateY(  0deg) translateZ(60px); }
        .back   { transform: rotateY(180deg) translateZ(60px); }
        .right  { transform: rotateY( 90deg) translateZ(60px); }
        .left   { transform: rotateY(-90deg) translateZ(60px); }
        .top    { transform: rotateX( 90deg) translateZ(60px); }
        .bottom { transform: rotateX(-90deg) translateZ(60px); }

        @keyframes rotateBox {
          from { transform: rotateX(-20deg) rotateY(0deg); }
          to   { transform: rotateX(-20deg) rotateY(360deg); }
        }

        .pricing-graphic {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: linear-gradient(135deg, #0F1D2D 0%, #1e3a5f 100%);
        }
        .pricing-badge {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 16px;
          color: #fff;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .badge-header {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--brand-gold);
        }
        .badge-price {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .price-num {
          font-size: 28px;
          font-weight: 800;
        }
        .price-unit {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.6);
        }
        .badge-features {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 11px;
        }
        .badge-features li {
          display: flex;
          align-items: center;
          gap: 6px;
          color: rgba(255, 255, 255, 0.85);
        }
        .badge-features li i {
          color: var(--brand-gold);
        }

        .slider-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #fff;
          border: 1px solid var(--brand-border);
          color: var(--brand-navy);
          font-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(15, 29, 45, 0.05);
          z-index: 10;
        }
        .slider-arrow:hover {
          background: var(--brand-navy);
          color: #fff;
          border-color: var(--brand-navy);
        }
        .slider-arrow.prev {
          right: 20px;
        }
        .slider-arrow.next {
          left: 20px;
        }

        .slider-dots {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 8px;
          z-index: 10;
          direction: rtl;
        }
        .dot-item {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--brand-border);
          border: none;
          cursor: pointer;
          padding: 0;
          transition: all 0.3s ease;
        }
        .dot-item.active {
          background: var(--brand-gold);
          width: 24px;
          border-radius: 99px;
        }
      `}</style>
    </div>
  );
};

export default function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [sessionToken, setSessionToken] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<SavedQuote[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [homeCategories, setHomeCategories] = useState<any[]>([]);
  const [mostUsedTemplates, setMostUsedTemplates] = useState<any[]>([]);

  useEffect(() => {
    async function fetchHomeData() {
      try {
        const [catRes, tempRes] = await Promise.all([
          supabase.from('app_categories').select('*'),
          supabase.from('app_templates').select('*').in('id', MOST_USED_IDS)
        ]);
        if (catRes.data) {
          setHomeCategories(catRes.data);
        }
        if (tempRes.data) {
          const sorted = MOST_USED_IDS.map(id => tempRes.data.find(t => t.id === id)).filter(Boolean);
          setMostUsedTemplates(sorted);
        }
      } catch (err) {
        console.error("Failed to fetch home data", err);
      }
    }
    fetchHomeData();
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('printCalc_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.expiresAt && new Date(parsed.expiresAt) > new Date()) {
          setUser({ username: parsed.username });
          setSessionToken(parsed.session_token || '');
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!sessionToken) return;
    setLoadingSaved(true);
    listQuotes(sessionToken)
      .then((res) => setSavedTemplates(res.quotes || []))
      .catch(() => {})
      .finally(() => setLoadingSaved(false));
  }, [sessionToken]);

  const goSearch = () => {
    navigate(`/templates?q=${encodeURIComponent(query)}`);
  };

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--brand-bg)', color: 'var(--brand-navy)' }}>
      <Header variant="simple" active="home" />

      {/* Animated Hero Slider */}
      <HeroSlider />

      <div style={{ width: '100%', boxSizing: 'border-box', padding: 'calc(var(--space-8) * 1.6) var(--space-8)' }}>

        {/* Search-first hero */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <h2 style={{ fontSize: '30px', margin: '0 0 8px', color: 'var(--brand-navy)' }}>وش القالب اللي تدور عليه؟</h2>
          <p style={{ color: 'var(--brand-muted)', fontSize: '15px', margin: '0 0 var(--space-6)' }}>اكتب اسم العلبة أو المقاس، أو اختر تصنيف بالأسفل</p>
          <div style={{ position: 'relative', maxWidth: '520px', margin: '0 auto' }}>
            <i className="ph ph-magnifying-glass" style={{ position: 'absolute', insetInlineStart: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', color: 'var(--brand-muted-2)' }}></i>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') goSearch(); }}
              placeholder="مثال: علبة بمقبض، صندوق شحن..."
              style={{
                width: '100%', boxSizing: 'border-box', height: '54px', borderRadius: '999px',
                border: '1px solid var(--brand-gold)', background: '#fff',
                paddingInlineStart: '48px', paddingInlineEnd: '20px', fontSize: '15px',
                color: 'var(--brand-navy)', boxShadow: '0 6px 18px rgba(15,29,45,0.06)', outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Category quick-access */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
          {homeCategories.map((c) => (
            <Link
              key={c.id}
              to={`/templates?cat=${c.id}`}
              className="cat-tile"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', background: '#fff', border: '1px solid var(--brand-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-8) var(--space-3)', textAlign: 'center' }}
            >
              <span className="cat-icon" style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--brand-tile-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={CATEGORY_ICONS[c.id] || 'ph ph-cube'} style={{ fontSize: '22px', color: 'var(--brand-gold)' }}></i>
              </span>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--brand-navy)' }}>{c.label}</span>
            </Link>
          ))}
        </div>

        {/* Most used templates */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ margin: 0, fontSize: '17px' }}>قوالبك الأكثر استخدامًا</h2>
          <Link to="/templates" className="link-arrow" style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--brand-navy)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            كل القوالب <i className="ph ph-arrow-left"></i>
          </Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
          {mostUsedTemplates.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>

        {/* Saved templates */}
        {user && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ margin: 0, fontSize: '17px' }}>القوالب المحفوظة</h2>
              <Link to="/dashboard" className="link-arrow" style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--brand-navy)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                كل المحفوظات <i className="ph ph-arrow-left"></i>
              </Link>
            </div>

            {loadingSaved ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--brand-muted-2)' }}>جاري تحميل قوالبك...</div>
            ) : savedTemplates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'calc(var(--space-8) * 1.4) var(--space-4)', background: '#fff', border: '1px dashed var(--brand-border)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-8)' }}>
                <i className="ph ph-cube-transparent" style={{ fontSize: '36px', display: 'block', marginBottom: 'var(--space-3)', color: 'var(--brand-muted-2)' }}></i>
                <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>لا توجد قوالب محفوظة</div>
                <p style={{ fontSize: '13.5px', color: 'var(--brand-muted-2)', margin: '0 0 var(--space-5)' }}>احفظ قوالبك المفضلة من المكتبة لتجدها هنا بسرعة.</p>
                <Link to="/templates" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--brand-navy)', color: '#fff', fontWeight: 700, fontSize: '13.5px', padding: '10px 18px', borderRadius: '999px' }}>
                  تصفح المكتبة <i className="ph ph-arrow-left"></i>
                </Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
                {savedTemplates.slice(0, 4).map((t) => (
                  <Link
                    key={t.id}
                    to={editLinkFor(t)}
                    className="hover-lift"
                    style={{ background: '#fff', border: '1px solid var(--brand-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', display: 'block', color: 'inherit' }}
                  >
                    <div style={{ aspectRatio: '4/3', background: 'var(--brand-tile-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-3)' }}>
                      <img src={previewFor(t.source_type)} alt={t.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div style={{ padding: 'var(--space-3)' }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '2px', color: 'var(--brand-navy)' }}>{t.title}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--brand-muted-2)' }}>آخر تعديل: {new Date(t.updated_at).toLocaleDateString('ar-SA')}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

      </div>

      <Footer variant="simple" />
    </div>
  );
}
