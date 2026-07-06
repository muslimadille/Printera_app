import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ArrowLeft, Plus, Minus } from 'lucide-react';

/**
 * PrintingOS — Landing V2 (Industrial Premium re-skin).
 * Independent page at /v2. Does NOT modify the original Landing.
 *
 * Identity:
 *  - Deep Navy   #0F172A  (ink / dark sections)
 *  - Royal Blue  #2563EB  (primary accent)
 *  - Indus. Gold #C8A75B  (secondary accent — used sparingly)
 *  - Off-white   #F7F6F2  (calm background)
 *  - White       #FFFFFF  (canvas)
 *
 * Inspired pacing: Stripe / Linear / Apple sections — calm, asymmetric,
 * typography-led. No card grids, no SaaS template feel.
 */

const NAVY = '#0F172A';
const BLUE = '#2563EB';
const GOLD = '#C8A75B';
const PAPER = '#F7F6F2';
const RULE = '#E7E5DE';

/* -------------------------------- Hooks --------------------------------- */

function useFont() {
  useEffect(() => {
    const id = 'ibm-plex-arabic-font-v2';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap';
    document.head.appendChild(link);
  }, []);
}

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
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);
  return { ref, shown };
}

function Reveal({
  children,
  delay = 0,
  className = '',
  y = 16,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={{
        transitionDelay: `${delay}ms`,
        transitionDuration: '1100ms',
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
        transform: shown ? 'translateY(0)' : `translateY(${y}px)`,
        opacity: shown ? 1 : 0,
      }}
      className={`will-change-transform transition-all ${className}`}
    >
      {children}
    </div>
  );
}

/* ---------------------------- Shared atoms ------------------------------ */

function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div
      className="inline-flex items-center gap-3 text-[10px] font-medium uppercase"
      style={{
        letterSpacing: '0.24em',
        color: dark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.55)',
        fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      <span
        className="inline-block w-8 h-px"
        style={{ background: dark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.35)' }}
      />
      {children}
    </div>
  );
}

/* --------------------------- Smart Nesting visual ----------------------- */

function NestingDemo() {
  const W = 360;
  const H = 240;

  // Before — plain rectangular grid 5×3
  const before: JSX.Element[] = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 5; c++)
      before.push(
        <rect
          key={`b${r}-${c}`}
          x={20 + c * 64}
          y={20 + r * 64}
          width={56}
          height={56}
          fill="rgba(15,23,42,0.04)"
          stroke="rgba(15,23,42,0.35)"
          strokeWidth="0.6"
          rx="2"
        />
      );

  // After — interlocked silhouettes (column mirroring)
  const after: JSX.Element[] = [];
  let i = 0;
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 6; c++) {
      const flip = (r + c) % 2 === 0;
      const x = 14 + c * 56;
      const y = 14 + r * 70;
      after.push(
        <g key={`a${i++}`} transform={flip ? '' : `rotate(180 ${x + 26} ${y + 32})`}>
          <path
            d={`M${x} ${y} h52 v8 l-10 6 v18 l10 6 v18 h-52 v-18 l10 -6 v-18 l-10 -6 z`}
            fill="rgba(37,99,235,0.10)"
            stroke={BLUE}
            strokeWidth="0.85"
          />
        </g>
      );
    }

  return (
    <div className="grid lg:grid-cols-2 gap-px" style={{ background: 'rgba(255,255,255,0.08)' }}>
      {/* BEFORE — light panel */}
      <div className="bg-white p-8">
        <div className="flex items-center justify-between mb-6">
          <Eyebrow>Before</Eyebrow>
          <div
            className="text-sm font-medium"
            style={{ color: NAVY, fontFamily: "'IBM Plex Mono', monospace" }}
          >
            15 / sheet
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          <rect
            x="6"
            y="6"
            width={W - 12}
            height={H - 12}
            fill="none"
            stroke="rgba(15,23,42,0.18)"
            strokeDasharray="3 3"
          />
          {before}
        </svg>
        <p className="mt-6 text-sm leading-relaxed" style={{ color: 'rgba(15,23,42,0.55)' }}>
          توزيع تقليدي يعتبر القالب مستطيلًا ويترك فراغات بين الألسنة.
        </p>
      </div>

      {/* AFTER — dark panel */}
      <div className="p-8" style={{ background: NAVY }}>
        <div className="flex items-center justify-between mb-6">
          <Eyebrow dark>After</Eyebrow>
          <div
            className="text-sm font-medium flex items-center gap-2"
            style={{ color: '#fff', fontFamily: "'IBM Plex Mono', monospace" }}
          >
            <span style={{ color: GOLD }}>18</span> / sheet
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          <rect
            x="6"
            y="6"
            width={W - 12}
            height={H - 12}
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeDasharray="3 3"
          />
          {after}
        </svg>
        <p className="mt-6 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
          تعشيق ذكي يُمرّر الألسنة بين بعضها — كل سنتيمتر مستغل.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------ Hero visual ----------------------------- */

function HeroSheet() {
  return (
    <div className="relative">
      {/* soft shadow plate */}
      <div
        aria-hidden
        className="absolute -inset-8 rounded-[28px] blur-3xl opacity-60"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 40%, rgba(37,99,235,0.10), transparent 70%)',
        }}
      />
      <div
        className="relative rounded-2xl border bg-white"
        style={{
          borderColor: RULE,
          boxShadow:
            '0 1px 0 rgba(15,23,42,0.04), 0 30px 60px -30px rgba(15,23,42,0.25), 0 8px 20px -10px rgba(15,23,42,0.10)',
        }}
      >
        {/* header strip */}
        <div
          className="flex items-center justify-between px-5 h-10 border-b"
          style={{ borderColor: RULE }}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#cbd5e1' }} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#cbd5e1' }} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#cbd5e1' }} />
          </div>
          <div
            className="text-[10px] tracking-[0.22em] uppercase"
            style={{ color: 'rgba(15,23,42,0.45)', fontFamily: "'IBM Plex Mono', monospace" }}
          >
            Smart Imposition · 100×70
          </div>
          <div
            className="text-[10px] font-medium px-2 py-0.5 rounded"
            style={{ background: 'rgba(37,99,235,0.08)', color: BLUE }}
          >
            +20%
          </div>
        </div>

        <div className="p-6">
          <svg viewBox="0 0 360 240" className="w-full h-auto">
            <defs>
              <pattern id="grid-v2" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(15,23,42,0.05)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="360" height="240" fill="url(#grid-v2)" />
            <rect
              x="4"
              y="4"
              width="352"
              height="232"
              fill="none"
              stroke="rgba(15,23,42,0.18)"
              strokeDasharray="3 3"
            />
            {Array.from({ length: 18 }).map((_, k) => {
              const c = k % 6;
              const r = Math.floor(k / 6);
              const flip = (r + c) % 2 === 0;
              const x = 14 + c * 56;
              const y = 14 + r * 70;
              return (
                <g key={k} transform={flip ? '' : `rotate(180 ${x + 26} ${y + 32})`}>
                  <path
                    d={`M${x} ${y} h52 v8 l-10 6 v18 l10 6 v18 h-52 v-18 l10 -6 v-18 l-10 -6 z`}
                    fill="rgba(37,99,235,0.08)"
                    stroke={BLUE}
                    strokeWidth="0.8"
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* footer meta */}
        <div
          className="grid grid-cols-3 border-t text-center"
          style={{ borderColor: RULE }}
        >
          {[
            { k: '18', v: 'قطعة' },
            { k: '−18%', v: 'هدر' },
            { k: '<2s', v: 'حساب' },
          ].map((m, idx) => (
            <div
              key={m.k}
              className="py-4"
              style={{
                borderInlineStart: idx === 0 ? 'none' : `1px solid ${RULE}`,
              }}
            >
              <div
                className="text-base font-semibold"
                style={{ color: NAVY, fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {m.k}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: 'rgba(15,23,42,0.5)' }}>
                {m.v}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Page --------------------------------- */

export default function LandingV2() {
  useFont();
  const fontStack = `'IBM Plex Sans Arabic', system-ui, -apple-system, Segoe UI, sans-serif`;

  return (
    <div
      dir="rtl"
      style={{ fontFamily: fontStack, background: PAPER, color: NAVY }}
      className="min-h-screen selection:bg-[#0F172A] selection:text-white antialiased"
    >
      {/* ============================== HEADER ============================== */}
      <header
        className="sticky top-0 z-40 backdrop-blur-md"
        style={{
          background: 'rgba(247,246,242,0.78)',
          borderBottom: `1px solid ${RULE}`,
        }}
      >
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-6 h-6 rounded-[6px] flex items-center justify-center"
              style={{ background: NAVY }}
            >
              <div className="w-2 h-2 rounded-[2px]" style={{ background: GOLD }} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">PrintingOS</span>
            <span
              className="text-[10px] mr-2 px-1.5 py-0.5 rounded"
              style={{
                background: 'rgba(15,23,42,0.06)',
                color: 'rgba(15,23,42,0.55)',
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              v2
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-9 text-[13.5px]" style={{ color: 'rgba(15,23,42,0.65)' }}>
            <a href="#clarity" className="hover:text-[#0F172A] transition-colors">وضوح التشغيل</a>
            <a href="#nesting" className="hover:text-[#0F172A] transition-colors">المونتاج الذكي</a>
            <a href="#workflow" className="hover:text-[#0F172A] transition-colors">المسار</a>
            <a href="#vision" className="hover:text-[#0F172A] transition-colors">الرؤية</a>
            <a href="#faq" className="hover:text-[#0F172A] transition-colors">أسئلة</a>
          </nav>
          <Link
            to="/app"
            className="text-[13px] font-medium px-4 py-2 rounded-full text-white transition-colors"
            style={{ background: NAVY }}
          >
            جرّب النظام
          </Link>
        </div>
      </header>

      {/* ================================ HERO ================================ */}
      <section
        className="relative overflow-hidden"
        style={{ minHeight: '88vh' }}
      >
        {/* subtle backdrop rules */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(to left, rgba(15,23,42,0.04) 1px, transparent 1px)',
            backgroundSize: '120px 100%',
            maskImage: 'linear-gradient(to bottom, black, transparent 80%)',
          }}
        />
        <div className="relative max-w-[1200px] mx-auto px-6 lg:px-10 pt-20 lg:pt-28 pb-28">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Copy */}
            <div className="lg:col-span-7">
              <Reveal>
                <Eyebrow>Operating system · للمطابع والتغليف</Eyebrow>
              </Reveal>

              <Reveal delay={100}>
                <h1
                  className="mt-8 text-[40px] sm:text-[56px] lg:text-[74px] leading-[1.05] font-semibold tracking-[-0.02em]"
                  style={{ color: NAVY }}
                >
                  نصمم مستقبل التشغيل
                  <br />
                  <span style={{ color: 'rgba(15,23,42,0.45)' }}>في قطاع الطباعة</span>
                  <br />
                  <span style={{ color: 'rgba(15,23,42,0.45)' }}>والتغليف.</span>
                </h1>
              </Reveal>

              <Reveal delay={220}>
                <p
                  className="mt-10 text-lg lg:text-xl leading-[1.7] max-w-xl"
                  style={{ color: 'rgba(15,23,42,0.65)' }}
                >
                  ماذا لو أصبحت التكلفة والتشغيل أسرع وأكثر وضوحًا
                  <span style={{ color: NAVY }}> وترابطًا</span>؟
                </p>
              </Reveal>

              <Reveal delay={320}>
                <div className="mt-12 flex flex-wrap items-center gap-3">
                  <a
                    href="#contact"
                    className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-white text-[14px] font-medium transition-all"
                    style={{
                      background: NAVY,
                      boxShadow: '0 12px 30px -12px rgba(15,23,42,0.5)',
                    }}
                  >
                    اطلب عرض النظام
                    <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                  </a>
                  <Link
                    to="/app"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-[14px] font-medium transition-colors"
                    style={{
                      border: `1px solid ${RULE}`,
                      color: NAVY,
                      background: 'rgba(255,255,255,0.6)',
                    }}
                  >
                    جرّب PrintingOS
                  </Link>
                </div>
              </Reveal>

              <Reveal delay={420}>
                <div
                  className="mt-16 grid grid-cols-3 max-w-lg"
                  style={{ borderTop: `1px solid ${RULE}` }}
                >
                  {[
                    { k: '10×', v: 'سرعة التسعير' },
                    { k: '+20%', v: 'استغلال الشيت' },
                    { k: '−18%', v: 'هدر المواد' },
                  ].map((s, i) => (
                    <div
                      key={s.k}
                      className="pt-5"
                      style={{
                        borderInlineStart: i === 0 ? 'none' : `1px solid ${RULE}`,
                        paddingInlineStart: i === 0 ? 0 : '20px',
                      }}
                    >
                      <div
                        className="text-2xl lg:text-3xl font-semibold tracking-tight"
                        style={{ color: NAVY, fontFamily: "'IBM Plex Mono', monospace" }}
                      >
                        {s.k}
                      </div>
                      <div className="mt-1.5 text-[12.5px]" style={{ color: 'rgba(15,23,42,0.55)' }}>
                        {s.v}
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* Visual */}
            <div className="lg:col-span-5">
              <Reveal delay={250} y={24}>
                <HeroSheet />
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ STATEMENT BAND ========================= */}
      <section
        className="relative"
        style={{ background: '#fff', borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}` }}
      >
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-24 lg:py-32">
          <Reveal>
            <p
              className="text-[28px] sm:text-[36px] lg:text-[44px] leading-[1.3] font-medium tracking-[-0.01em] max-w-4xl"
              style={{ color: NAVY }}
            >
              التشغيل في المطابع لا تنقصه الخبرة —{' '}
              <span style={{ color: 'rgba(15,23,42,0.4)' }}>
                ينقصه الوضوح، والترابط، وأدوات تعكس حجم التحوّل في القطاع.
              </span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ============================== CLARITY ============================== */}
      <section id="clarity" style={{ background: PAPER }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-28 lg:py-36">
          <div className="grid lg:grid-cols-12 gap-12 mb-20">
            <Reveal className="lg:col-span-4">
              <Eyebrow>وضوح التشغيل</Eyebrow>
              <h2
                className="mt-6 text-[34px] lg:text-[44px] leading-[1.15] font-semibold tracking-[-0.015em]"
                style={{ color: NAVY }}
              >
                لماذا أصبح الوضوح أهم اليوم.
              </h2>
            </Reveal>
            <Reveal className="lg:col-span-7 lg:col-start-6 lg:pt-10" delay={120}>
              <p className="text-[17px] leading-[1.85]" style={{ color: 'rgba(15,23,42,0.65)' }}>
                مع توسّع الطلبات وتعدّد المراحل، لم يعد الوضوح في التشغيل والتكلفة
                رفاهية — بل أساسٌ للنمو والاستقرار اليومي. هذه الأسئلة الستة
                تختصر الواقع الذي يعيشه أصحاب المطابع كل يوم.
              </p>
            </Reveal>
          </div>

          {/* Asymmetric editorial list */}
          <div className="space-y-px" style={{ background: RULE }}>
            {[
              {
                n: '01',
                t: 'وضوح التشغيل',
                b: 'بعض تفاصيل التكلفة والتشغيل يصعب متابعتها بوضوح مع نمو العمل وتعدد الطلبات.',
              },
              {
                n: '02',
                t: 'نقل المعرفة التشغيلية',
                b: 'كلما أصبحت المعرفة أوضح وأسهل بالمشاركة، أصبح التوسع والمتابعة أكثر استقرارًا.',
              },
              {
                n: '03',
                t: 'التكلفة والتشغيل',
                b: 'دقة التكلفة ترتبط مباشرةً بفهم التشغيل الحقيقي ومراحل الإنتاج واستهلاك المواد.',
              },
              {
                n: '04',
                t: 'تشغيل أكثر ثباتًا',
                b: 'وضوح دورة العمل يساعد على سرعة التنفيذ، تقليل التفاوت، وتحسين استقرار التشغيل اليومي.',
              },
              {
                n: '05',
                t: 'سوق يتغيّر بسرعة',
                b: 'مع توسع سوق الباكجينج وكثرة الطلبات المخصصة، أصبحت سرعة ودقة التشغيل جزءًا من المنافسة.',
              },
              {
                n: '06',
                t: 'فرص أوضح للنمو',
                b: 'إمكانيات التشغيل الحالية أكبر مما يظهر يوميًا — والتنظيم يساعد على الاستفادة منها بوضوح.',
              },
            ].map((row, i) => (
              <Reveal key={row.n} delay={i * 60}>
                <div
                  className="grid lg:grid-cols-12 gap-6 lg:gap-10 px-2 lg:px-6 py-8 lg:py-10 group transition-colors"
                  style={{ background: PAPER }}
                >
                  <div
                    className="lg:col-span-2 text-sm font-medium"
                    style={{
                      color: 'rgba(15,23,42,0.4)',
                      fontFamily: "'IBM Plex Mono', monospace",
                      letterSpacing: '0.1em',
                    }}
                  >
                    {row.n}
                  </div>
                  <h3
                    className="lg:col-span-4 text-[20px] lg:text-[22px] font-semibold tracking-tight"
                    style={{ color: NAVY }}
                  >
                    {row.t}
                  </h3>
                  <p
                    className="lg:col-span-6 text-[15.5px] leading-[1.8]"
                    style={{ color: 'rgba(15,23,42,0.62)' }}
                  >
                    {row.b}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== NESTING — DARK ============================== */}
      <section id="nesting" style={{ background: NAVY, color: '#fff' }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-28 lg:py-40">
          <div className="grid lg:grid-cols-12 gap-10 items-end mb-20">
            <Reveal className="lg:col-span-7">
              <Eyebrow dark>Smart Imposition · المحرّك</Eyebrow>
              <h2
                className="mt-6 text-[36px] sm:text-[48px] lg:text-[64px] leading-[1.05] font-semibold tracking-[-0.02em]"
              >
                استغلال الشيت{' '}
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>كما لم يحدث من قبل.</span>
              </h2>
            </Reveal>
            <Reveal className="lg:col-span-5" delay={140}>
              <p
                className="text-[16.5px] leading-[1.85] max-w-md"
                style={{ color: 'rgba(255,255,255,0.6)' }}
              >
                محرك تعشيق ذكي يستفيد من الفراغات بين الألسنة الخارجية للقالب،
                ويحوّل كل سنتيمتر من الورق إلى قطعة منتجة فعليًا.
              </p>
            </Reveal>
          </div>

          <Reveal delay={120}>
            <NestingDemo />
          </Reveal>

          {/* metrics row — minimal, mono */}
          <Reveal delay={220}>
            <div
              className="mt-20 grid grid-cols-2 md:grid-cols-4"
              style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}
            >
              {[
                { k: '+20%', v: 'استغلال إضافي للشيت' },
                { k: '−18%', v: 'هدر مادة خام' },
                { k: '×10', v: 'سرعة احتساب التكلفة' },
                { k: '< 2s', v: 'حساب مونتاج كامل' },
              ].map((s, idx) => (
                <div
                  key={s.k}
                  className="px-4 py-10"
                  style={{
                    borderInlineStart:
                      idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  <div
                    className="text-3xl lg:text-4xl font-semibold tracking-tight"
                    style={{
                      color: idx === 0 ? GOLD : '#fff',
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    {s.k}
                  </div>
                  <div
                    className="mt-3 text-[13px]"
                    style={{ color: 'rgba(255,255,255,0.5)' }}
                  >
                    {s.v}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================== WORKFLOW ============================== */}
      <section id="workflow" style={{ background: '#fff' }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-28 lg:py-36">
          <Reveal>
            <Eyebrow>كيف يساعد PrintingOS</Eyebrow>
            <h2
              className="mt-6 text-[34px] lg:text-[48px] leading-[1.1] font-semibold tracking-[-0.015em] max-w-3xl"
              style={{ color: NAVY }}
            >
              من الطلب إلى التسليم —{' '}
              <span style={{ color: 'rgba(15,23,42,0.4)' }}>في مسار واحد واضح.</span>
            </h2>
          </Reveal>

          <div className="mt-20 relative">
            {/* center vertical rule (desktop) */}
            <div
              aria-hidden
              className="hidden lg:block absolute top-2 bottom-2 w-px"
              style={{ background: RULE, right: 'calc(16.6667% - 0.5px)' }}
            />
            <div className="space-y-20 lg:space-y-28">
              {[
                {
                  step: '01',
                  title: 'تسعير دقيق في ثوانٍ',
                  body:
                    'يتحوّل طلب العميل إلى عرض سعر واضح، مبني على بيانات تشغيل حقيقية لا على تقديرات.',
                },
                {
                  step: '02',
                  title: 'مونتاج ذكي تلقائي',
                  body:
                    'يقترح المحرك أفضل توزيع للقطع على الشيت — ويترك لك القرار النهائي بكامل التحكم.',
                },
                {
                  step: '03',
                  title: 'أوامر إنتاج مترابطة',
                  body:
                    'كل أمر إنتاج مرتبط بتكلفته ومراحله، فتعرف أين الطلب وكم استهلك فعلًا في كل خطوة.',
                },
                {
                  step: '04',
                  title: 'متابعة هادئة وواضحة',
                  body:
                    'لوحة واحدة تجمع التكلفة، الإنتاج، والمخزون — بدون ضجيج وبدون تعقيد.',
                },
              ].map((s, i) => (
                <Reveal key={s.step} delay={i * 90}>
                  <div className="grid lg:grid-cols-12 gap-6 lg:gap-12 items-start">
                    <div className="lg:col-span-2 flex lg:block items-center gap-4">
                      <div
                        className="text-[11px] font-medium"
                        style={{
                          color: 'rgba(15,23,42,0.45)',
                          fontFamily: "'IBM Plex Mono', monospace",
                          letterSpacing: '0.18em',
                        }}
                      >
                        STEP / {s.step}
                      </div>
                    </div>
                    <div className="lg:col-span-10 lg:pr-10">
                      <h3
                        className="text-[24px] lg:text-[32px] font-semibold tracking-tight leading-[1.2]"
                        style={{ color: NAVY }}
                      >
                        {s.title}
                      </h3>
                      <p
                        className="mt-4 text-[16px] lg:text-[17px] leading-[1.85] max-w-2xl"
                        style={{ color: 'rgba(15,23,42,0.62)' }}
                      >
                        {s.body}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================== VISION ============================== */}
      <section id="vision" style={{ background: PAPER, borderTop: `1px solid ${RULE}` }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-28 lg:py-36">
          <div className="grid lg:grid-cols-12 gap-10 mb-20">
            <Reveal className="lg:col-span-6">
              <Eyebrow>الرؤية المستقبلية</Eyebrow>
              <h2
                className="mt-6 text-[34px] lg:text-[48px] leading-[1.1] font-semibold tracking-[-0.015em]"
                style={{ color: NAVY }}
              >
                نظام يكبر مع المطبعة —{' '}
                <span style={{ color: 'rgba(15,23,42,0.4)' }}>لا العكس.</span>
              </h2>
            </Reveal>
            <Reveal className="lg:col-span-5 lg:col-start-8 lg:pt-10" delay={120}>
              <p className="text-[16.5px] leading-[1.85]" style={{ color: 'rgba(15,23,42,0.62)' }}>
                طبقة فوق طبقة، يتوسّع PrintingOS تدريجيًا ليغطي كامل دورة التشغيل —
                من الحساب الأول إلى شبكة موردين متكاملة.
              </p>
            </Reveal>
          </div>

          {/* Evolution rail */}
          <Reveal delay={100}>
            <div className="relative">
              {/* horizontal rule */}
              <div
                aria-hidden
                className="absolute right-0 left-0 top-[34px] h-px"
                style={{ background: RULE }}
              />
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
                {[
                  { label: 'حساب التكلفة', tag: 'اليوم', live: true },
                  { label: 'المونتاج الذكي', tag: 'اليوم', live: true },
                  { label: 'أوامر الإنتاج', tag: 'قريبًا' },
                  { label: 'المتابعة التشغيلية', tag: 'قريبًا' },
                  { label: 'المخزون', tag: 'لاحقًا' },
                  { label: 'Marketplace', tag: 'لاحقًا' },
                  { label: 'AI · ERP · Suppliers', tag: 'مستقبلًا' },
                ].map((item, i) => (
                  <div
                    key={item.label}
                    className="relative pt-0 pb-2 px-4 lg:px-5 first:pr-0 last:pl-0"
                  >
                    {/* node */}
                    <div className="flex justify-center">
                      <div
                        className="relative w-[14px] h-[14px] rounded-full flex items-center justify-center"
                        style={{
                          background: item.live ? NAVY : '#fff',
                          border: `1.5px solid ${item.live ? NAVY : 'rgba(15,23,42,0.25)'}`,
                          boxShadow: item.live
                            ? `0 0 0 4px rgba(37,99,235,0.10)`
                            : 'none',
                        }}
                      >
                        {item.live && (
                          <span
                            className="w-1 h-1 rounded-full"
                            style={{ background: GOLD }}
                          />
                        )}
                      </div>
                    </div>
                    {/* label */}
                    <div className="mt-8 text-center">
                      <div
                        className="text-[10px] uppercase tracking-[0.18em]"
                        style={{
                          color: item.live ? BLUE : 'rgba(15,23,42,0.4)',
                          fontFamily: "'IBM Plex Mono', monospace",
                        }}
                      >
                        {item.tag}
                      </div>
                      <div
                        className="mt-2 text-[14px] font-medium leading-snug"
                        style={{ color: NAVY }}
                      >
                        {item.label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================== FAQ ============================== */}
      <section id="faq" style={{ background: '#fff', borderTop: `1px solid ${RULE}` }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-28 lg:py-36">
          <div className="grid lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4">
              <Reveal>
                <Eyebrow>أسئلة هادئة</Eyebrow>
                <h2
                  className="mt-6 text-[32px] lg:text-[40px] leading-[1.15] font-semibold tracking-[-0.015em]"
                  style={{ color: NAVY }}
                >
                  ما يسأله أصحاب المطابع عادةً.
                </h2>
              </Reveal>
            </div>

            <div className="lg:col-span-7 lg:col-start-6">
              <Reveal delay={120}>
                <Accordion type="single" collapsible className="w-full">
                  {[
                    {
                      q: 'هل الهدف استبدال الموظفين؟',
                      a: 'لا. الهدف تمكين الفريق من العمل بوضوح أكبر، ونقل المعرفة التشغيلية بدل أن تبقى محصورة في أشخاص.',
                    },
                    {
                      q: 'هل يناسب المطابع الصغيرة؟',
                      a: 'نعم. النظام مبني ليكبر مع المطبعة — تبدأ بالتسعير والمونتاج، وتضيف ما تحتاجه عند الحاجة.',
                    },
                    {
                      q: 'هل يساعد على سرعة التسعير؟',
                      a: 'يحوّل ساعات من العمل اليدوي إلى ثوانٍ، مع دقة مبنية على بيانات تشغيلية حقيقية.',
                    },
                    {
                      q: 'كيف يساعد على وضوح التكلفة؟',
                      a: 'يربط كل تكلفة بمرحلة إنتاج فعلية — فتعرف أين تذهب الموارد ولماذا.',
                    },
                    {
                      q: 'هل يساعد على نقل المعرفة التشغيلية؟',
                      a: 'نعم. كل قرار وكل إعداد محفوظ ومُوثّق، بحيث تنتقل المعرفة بسهولة بين الفرق والأجيال.',
                    },
                  ].map((item, i) => (
                    <AccordionItem
                      key={i}
                      value={`q-${i}`}
                      className="border-b last:border-b-0"
                      style={{ borderColor: RULE }}
                    >
                      <AccordionTrigger
                        className="text-right text-[17px] lg:text-[19px] font-medium py-7 hover:no-underline [&>svg]:hidden group"
                        style={{ color: NAVY }}
                      >
                        <span className="flex-1 text-right">{item.q}</span>
                        <span
                          className="ml-2 inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors"
                          style={{ border: `1px solid ${RULE}` }}
                        >
                          <Plus className="w-3.5 h-3.5 group-data-[state=open]:hidden" />
                          <Minus className="w-3.5 h-3.5 hidden group-data-[state=open]:block" />
                        </span>
                      </AccordionTrigger>
                      <AccordionContent
                        className="pb-7 text-[15.5px] leading-[1.85]"
                        style={{ color: 'rgba(15,23,42,0.65)' }}
                      >
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== ENDING ============================== */}
      <section
        id="contact"
        className="relative overflow-hidden"
        style={{ background: NAVY, color: '#fff' }}
      >
        {/* faint backdrop */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 0%, rgba(37,99,235,0.18), transparent 70%)',
          }}
        />
        <div className="relative max-w-[1100px] mx-auto px-6 lg:px-10 py-36 lg:py-48 text-center">
          <Reveal>
            <Eyebrow dark>PrintingOS</Eyebrow>
          </Reveal>
          <Reveal delay={120}>
            <h2 className="mt-10 text-[44px] sm:text-[60px] lg:text-[80px] leading-[1.05] font-semibold tracking-[-0.02em]">
              مستقبل التشغيل
              <br />
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>في القطاع</span>
              <br />
              بدأ يتغيّر <span style={{ color: GOLD }}>فعلًا</span>.
            </h2>
          </Reveal>
          <Reveal delay={220}>
            <p
              className="mt-10 text-[16.5px] lg:text-[18px] leading-[1.8] max-w-xl mx-auto"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              انضم إلى المطابع التي اختارت أن تعمل بوضوح أكثر — منذ اليوم.
            </p>
          </Reveal>
          <Reveal delay={320}>
            <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
              <a
                href="mailto:hello@printingos.app"
                className="group inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-[14px] font-medium transition-colors"
                style={{ color: NAVY }}
              >
                اطلب عرض النظام
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              </a>
              <Link
                to="/app"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-[14px] font-medium transition-colors"
                style={{
                  border: '1px solid rgba(255,255,255,0.22)',
                  color: 'rgba(255,255,255,0.92)',
                }}
              >
                جرّب PrintingOS
              </Link>
            </div>
          </Reveal>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-8 flex items-center justify-between text-[12px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              © {new Date().getFullYear()} PrintingOS
            </span>
            <Link to="/" className="hover:text-white transition-colors">
              النسخة الأولى ↗
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
