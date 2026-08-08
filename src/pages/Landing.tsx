import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAppContent } from '@/hooks/useAppContent';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  ArrowLeft,
  Layers,
  Gauge,
  Workflow,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  Boxes,
  LineChart,
  Network,
  Cpu,
  Warehouse,
  Receipt,
} from 'lucide-react';

/**
 * PrintingOS — Landing page.
 * Calm, premium, industrial SaaS aesthetic. Story-driven, generous spacing.
 */

// Lightweight in-view hook for fade/slide reveals (no extra deps).
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

const Reveal = ({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      } ${className}`}
    >
      {children}
    </div>
  );
};

// Decorative SVG: nesting "after" — 18 pieces tightly packed (interlocked).
const NestingVisual = ({ optimized = false }: { optimized?: boolean }) => {
  // Simple visual: rows of stylized dieline silhouettes inside a sheet.
  const cols = optimized ? 6 : 5;
  const rows = 3;
  const pieces: { x: number; y: number; flip: boolean }[] = [];
  const cellW = optimized ? 46 : 56;
  const cellH = 70;
  const offsetX = optimized ? 20 : 30;
  const offsetY = 25;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      pieces.push({
        x: offsetX + c * cellW,
        y: offsetY + r * cellH,
        flip: optimized && c % 2 === 1,
      });
    }
  }
  return (
    <svg viewBox="0 0 340 240" className="w-full h-auto">
      <defs>
        <linearGradient id="sheetBg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(214 30% 98%)" />
          <stop offset="100%" stopColor="hsl(214 25% 94%)" />
        </linearGradient>
      </defs>
      <rect
        x="6"
        y="6"
        width="328"
        height="228"
        rx="4"
        fill="url(#sheetBg)"
        stroke="hsl(214 20% 80%)"
        strokeWidth="1"
      />
      {pieces.map((p, i) => {
        const pathW = optimized ? 44 : 48;
        const pathH = 64;
        // Stylized box with two tabs on top/bottom (silhouette-ish).
        const d = `M${p.x} ${p.y + 10} L${p.x} ${p.y + pathH - 10}
                   Q${p.x} ${p.y + pathH} ${p.x + 10} ${p.y + pathH}
                   L${p.x + pathW - 10} ${p.y + pathH}
                   Q${p.x + pathW} ${p.y + pathH} ${p.x + pathW} ${p.y + pathH - 10}
                   L${p.x + pathW} ${p.y + 10}
                   Q${p.x + pathW} ${p.y} ${p.x + pathW - 10} ${p.y}
                   L${p.x + 10} ${p.y}
                   Q${p.x} ${p.y} ${p.x} ${p.y + 10} Z`;
        return (
          <g
            key={i}
            transform={
              p.flip
                ? `translate(${p.x + pathW},${p.y}) scale(-1,1) translate(${-p.x},${-p.y})`
                : undefined
            }
            style={{
              transformOrigin: 'center',
              animation: `fade-in 0.5s ease-out ${i * 25}ms both`,
            }}
          >
            <path
              d={d}
              fill={optimized ? 'hsl(221 83% 53% / 0.10)' : 'hsl(214 15% 75% / 0.18)'}
              stroke={optimized ? 'hsl(221 83% 53%)' : 'hsl(215 16% 55%)'}
              strokeWidth="0.8"
            />
          </g>
        );
      })}
      <text
        x="170"
        y="222"
        textAnchor="middle"
        className="font-cairo"
        fontSize="9"
        fill="hsl(215 16% 47%)"
      >
        {optimized ? `${pieces.length} قطعة على نفس الشيت` : `${pieces.length} قطعة`}
      </text>
    </svg>
  );
};

// Hero visual — abstract sheet with imposed pieces.
const HeroVisual = () => (
  <div className="relative">
    <div className="absolute -inset-8 bg-gradient-to-tr from-primary/5 via-transparent to-accent/5 blur-3xl rounded-full pointer-events-none" />
    <div className="relative rounded-2xl border bg-card shadow-[0_20px_60px_-30px_hsl(221_83%_53%_/_0.35)] p-6">
      <div className="flex items-center justify-between mb-4 text-xs text-muted-foreground">
        <span className="font-medium">Smart Nesting Preview</span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          مباشر
        </span>
      </div>
      <NestingVisual optimized />
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted/50 py-2">
          <div className="text-xs text-muted-foreground">قبل</div>
          <div className="text-base font-semibold">15</div>
        </div>
        <div className="rounded-lg bg-primary/5 py-2 border border-primary/15">
          <div className="text-xs text-primary">بعد</div>
          <div className="text-base font-semibold text-primary">18</div>
        </div>
        <div className="rounded-lg bg-accent/5 py-2 border border-accent/15">
          <div className="text-xs text-accent">+20%</div>
          <div className="text-base font-semibold text-accent">استغلال</div>
        </div>
      </div>
    </div>
  </div>
);

const Landing = () => {
  const { banner, faqs } = useAppContent();

  // Update meta tags for SEO (single H1, title, description).
  useEffect(() => {
    document.title = 'PrintingOS — نظام تشغيل المطابع الحديث';
    const desc =
      'PrintingOS يساعد المطابع على تنظيم التشغيل وتقليل الهدر وتحسين استغلال الإنتاج عبر نظام مونتاج وتسعير ذكي.';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', desc);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ========== NAV ========== */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border/60">
        <div className="container mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Layers className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold tracking-tight text-lg">PrintingOS</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#losses" className="hover:text-foreground transition-colors">المشكلة</a>
            <a href="#workflow" className="hover:text-foreground transition-colors">الحل</a>
            <a href="#faq" className="hover:text-foreground transition-colors">الأسئلة</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="rounded-full">تسجيل الدخول</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="rounded-full">البدء مجاناً</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ========== HERO ========== */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32">
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-20 -left-20 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-accent/5 blur-3xl" />
        </div>
        <div className="container mx-auto px-6 lg:px-10 pt-20 pb-28 lg:pt-32 lg:pb-40">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-20 items-center">
            <div className="lg:col-span-7">
              <Reveal>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/70 border text-xs text-muted-foreground mb-8">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  نظام تشغيل مصمم خصيصًا للمطابع
                </div>
              </Reveal>
              <Reveal delay={80}>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.15] tracking-tight">
                  {banner.title}
                </h1>
              </Reveal>
              <Reveal delay={180}>
                <p className="mt-8 text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-2xl">
                  {banner.subtitle}
                </p>
              </Reveal>
              <Reveal delay={280}>
                <div className="mt-10 flex flex-wrap items-center gap-4">
                  </Button>
                </div>
              </Reveal>
            </div>
            <div className="lg:col-span-5">
              <Reveal delay={200}>
                <HeroVisual />
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ========== SECTION 2 — INVISIBLE LOSSES ========== */}
      <section id="losses" className="py-28 lg:py-40 border-t border-border/60">
        <div className="container mx-auto px-6 lg:px-10">
          <Reveal>
            <div className="max-w-3xl mb-20">
              <div className="text-xs uppercase tracking-[0.2em] text-primary mb-4">01 — الواقع</div>
              <h2 className="text-3xl lg:text-5xl font-bold tracking-tight leading-tight">
                ما لا يُقاس… لا يمكن تحسينه.
              </h2>
              <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
                خمسة أنماط هادئة تتراكم يوميًا داخل كل مطبعة، دون أن تظهر في التقارير.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden border">
            {[
              {
                icon: Gauge,
                title: 'الخسائر غير المرئية',
                body:
                  'بعض أكبر الخسائر اليومية لا تظهر بوضوح… لكنها تتراكم داخل التشغيل والتسعير والهدر دون ملاحظة.',
              },
              {
                icon: ShieldCheck,
                title: 'الاعتماد على الخبرة الفردية',
                body:
                  'عندما تبقى المعرفة داخل أشخاص فقط… يصبح توحيد التشغيل ونقل الخبرة والتوسع أكثر صعوبة.',
              },
              {
                icon: Receipt,
                title: 'التسعير والإنتاج',
                body:
                  'دقة التسعير لا تعتمد على الأرقام فقط… بل على فهم التشغيل الحقيقي واستهلاك المواد واستغلال الشيت ومراحل الإنتاج.',
              },
              {
                icon: Workflow,
                title: 'استقرار التشغيل',
                body:
                  'الأنظمة الواضحة تساعد المطابع على تقليل الخسائر ورفع الإنتاجية والعمل بثبات وسرعة أكبر.',
              },
              {
                icon: TrendingUp,
                title: 'سوق يتغير بسرعة',
                body:
                  'مع توسع سوق الباكجينج والبراندينج… أصبحت سرعة التشغيل والتنظيم جزءًا من القدرة على المنافسة.',
              },
              {
                icon: Sparkles,
                title: 'فرص لم تُستثمر بعد',
                body:
                  'إمكانيات المطبعة الحالية غالبًا أكبر مما هو مُستفاد منها — التنظيم يُظهر ذلك.',
              },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="bg-card p-10 h-full hover:bg-muted/30 transition-colors duration-500 group">
                  <item.icon className="w-7 h-7 text-primary mb-6 transition-transform duration-500 group-hover:-translate-y-1" />
                  <h3 className="text-lg font-semibold mb-3 tracking-tight">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========== SECTION 3 — REALITY OF OPERATION (DARK) ========== */}
      <section className="py-28 lg:py-40 bg-foreground text-background relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }} />
        <div className="container mx-auto px-6 lg:px-10 relative">
          <Reveal>
            <div className="max-w-3xl mb-20">
              <div className="text-xs uppercase tracking-[0.2em] text-background/50 mb-4">
                02 — داخل المطبعة
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold tracking-tight leading-tight">
                واقع التشغيل اليوم… أكثر تعقيدًا مما يبدو.
              </h2>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-x-16 gap-y-10 max-w-5xl">
            {[
              ['عمليات يدوية متكررة', 'تستهلك وقت الإدارة وتُربك تتبّع الإنتاج.'],
              ['ضغط تشغيل يومي', 'الطلبات تتسارع، والقرارات تتأخر.'],
              ['تعقيد التسعير', 'كل عرض سعر يحتاج فهمًا للمواد والمراحل والهدر.'],
              ['تمركز المعرفة', 'الخبرة تبقى داخل الأشخاص، لا داخل النظام.'],
              ['صعوبة التوسع', 'النمو يتطلب بنية تشغيل لا اجتهادًا فرديًا.'],
              ['غياب الرؤية اللحظية', 'الأرقام تظهر متأخرة، بعد فوات فرصة التحسين.'],
            ].map(([title, body], i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="border-r border-background/15 pr-6">
                  <h3 className="text-base font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-background/60 leading-relaxed">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========== SECTION 4 — WHY IT'S HARDER NOW ========== */}
      <section className="py-28 lg:py-40">
        <div className="container mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-5">
              <Reveal>
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-4">03 — السوق</div>
                <h2 className="text-3xl lg:text-5xl font-bold tracking-tight leading-tight">
                  لماذا أصبح الوضع
                  <br />
                  أكثر صعوبة؟
                </h2>
                <p className="mt-8 text-lg text-muted-foreground leading-relaxed">
                  الإمكانيات القوية تحتاج أيضًا إلى تشغيل منظم يساعد على
                  الاستفادة منها بشكل أفضل.
                </p>
              </Reveal>
            </div>
            <div className="lg:col-span-7">
              <div className="space-y-px bg-border rounded-2xl overflow-hidden border">
                {[
                  ['زيادة المنافسة', 'مطابع جديدة، أسعار متغيرة، عملاء أكثر تطلبًا.'],
                  ['تنوع الطلبات', 'كميات صغيرة، تخصيص أعلى، مواد متعددة.'],
                  ['ارتفاع التكاليف', 'هامش الخطأ في التسعير لم يعد محتملًا.'],
                  ['سرعة السوق', 'العميل يتوقع عرض سعر اليوم، لا غدًا.'],
                  ['الباكجينج والبراندينج', 'سوق يتوسع ويتطلب مرونة وسرعة استجابة.'],
                ].map(([t, b], i) => (
                  <Reveal key={i} delay={i * 50}>
                    <div className="bg-card px-8 py-7 flex items-start gap-6 hover:bg-muted/40 transition-colors">
                      <div className="text-2xl font-light text-muted-foreground/50 tabular-nums w-8 shrink-0">
                        0{i + 1}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">{t}</h3>
                        <p className="text-sm text-muted-foreground">{b}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== SECTION 5 — WHY PRINTINGOS ========== */}
      <section className="py-28 lg:py-40 bg-muted/30 border-y border-border/60">
        <div className="container mx-auto px-6 lg:px-10">
          <Reveal>
            <div className="max-w-3xl">
              <div className="text-xs uppercase tracking-[0.2em] text-primary mb-4">
                04 — لهذا
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold tracking-tight leading-tight">
                تم بناء PrintingOS.
              </h2>
              <p className="mt-8 text-lg text-muted-foreground leading-relaxed">
                نظام تشغيل واحد يربط التسعير والمونتاج والإنتاج في مكان واحد —
                مصمم من فهم حقيقي لقطاع الطباعة، لا من قوالب جاهزة.
              </p>
            </div>
          </Reveal>

          <div className="mt-20 grid md:grid-cols-3 gap-10 max-w-5xl">
            {[
              { icon: Receipt, title: 'تسعير دقيق', body: 'مبني على التشغيل الحقيقي، لا على التقدير.' },
              { icon: Layers, title: 'مونتاج ذكي', body: 'يستفيد من كل سنتيمتر داخل الشيت.' },
              { icon: Workflow, title: 'تشغيل منظم', body: 'بنية واضحة تنقل الخبرة من الأفراد إلى النظام.' },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 100}>
                <div>
                  <f.icon className="w-6 h-6 text-primary mb-5" />
                  <h3 className="font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========== SECTION 6 — SMART NESTING (HERO MOMENT) ========== */}
      <section id="nesting" className="py-28 lg:py-44">
        <div className="container mx-auto px-6 lg:px-10">
          <Reveal>
            <div className="max-w-3xl mb-20">
              <div className="text-xs uppercase tracking-[0.2em] text-accent mb-4">
                05 — Smart Nesting
              </div>
              <h2 className="text-3xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
                نفس الشيت.
                <br />
                <span className="text-accent">قطع أكثر.</span>
              </h2>
              <p className="mt-8 text-lg text-muted-foreground leading-relaxed max-w-2xl">
                محرك المونتاج يكتشف التعشيق الفعلي بين القوالب، ويستفيد من
                الفراغات بين الألسنة الخارجية — ليرفع استغلال الشيت دون تغيير
                المقاس أو المواد.
              </p>
            </div>
          </Reveal>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
            <Reveal>
              <div className="rounded-2xl border bg-card p-8">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">قبل</span>
                  <span className="text-sm font-semibold text-muted-foreground">15 قطعة</span>
                </div>
                <NestingVisual optimized={false} />
                <p className="mt-6 text-sm text-muted-foreground">
                  ترتيب تقليدي يعتبر القالب مستطيلًا — فراغات كثيرة بين الألسنة.
                </p>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <div className="rounded-2xl border-2 border-accent/30 bg-gradient-to-br from-accent/5 to-primary/5 p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 px-3 py-1 bg-accent text-accent-foreground text-xs font-semibold rounded-bl-lg">
                  +20%
                </div>
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs uppercase tracking-wider text-accent">بعد</span>
                  <span className="text-sm font-semibold text-accent">18 قطعة</span>
                </div>
                <NestingVisual optimized />
                <p className="mt-6 text-sm text-muted-foreground">
                  تعشيق متبادل بين الأعمدة — تلامس حقيقي بحدود السيلويت دون تجاوز.
                </p>
              </div>
            </Reveal>
          </div>

          <div className="mt-16 grid md:grid-cols-3 gap-8 max-w-4xl mx-auto text-center">
            {[
              ['+20%', 'استغلال إضافي للشيت'],
              ['−15%', 'هدر في المواد'],
              ['×3', 'سرعة في تجهيز المونتاج'],
            ].map(([n, l], i) => (
              <Reveal key={i} delay={i * 80}>
                <div>
                  <div className="text-4xl lg:text-5xl font-bold tracking-tight text-primary">{n}</div>
                  <div className="mt-2 text-sm text-muted-foreground">{l}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========== SECTION 7 — GROWTH ========== */}
      <section className="py-28 lg:py-40 bg-muted/30 border-y border-border/60">
        <div className="container mx-auto px-6 lg:px-10">
          <Reveal>
            <div className="max-w-3xl mb-20">
              <div className="text-xs uppercase tracking-[0.2em] text-primary mb-4">06 — النمو</div>
              <h2 className="text-3xl lg:text-5xl font-bold tracking-tight leading-tight">
                التنظيم… هو ما يفتح باب النمو.
              </h2>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10">
            {[
              ['الاستفادة من الإمكانيات الحالية', 'دون الحاجة لاستثمار جديد.'],
              ['التعامل مع منتجات جديدة', 'بنية تشغيل تتسع لأنواع مختلفة من الطلبات.'],
              ['استقرار التشغيل', 'أقل اعتماد على الاجتهاد الفردي.'],
              ['جاهزية للتوسع', 'فروع، خطوط جديدة، أسواق إضافية.'],
            ].map(([t, b], i) => (
              <Reveal key={i} delay={i * 80}>
                <div>
                  <div className="w-10 h-px bg-primary mb-6" />
                  <h3 className="font-semibold mb-2">{t}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{b}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========== SECTION 8 — VISION / EVOLUTION (Layered Stack) ========== */}
      <section id="vision" className="py-28 lg:py-44 bg-foreground text-background relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }} />

        <div className="container mx-auto px-6 lg:px-10 relative">
          <Reveal>
            <div className="max-w-3xl mb-6">
              <div className="text-xs uppercase tracking-[0.2em] text-background/50 mb-4">
                07 — الرؤية
              </div>
              <h2 className="text-3xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
                نظام يتطور
                <br />
                طبقة فوق طبقة.
              </h2>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <p className="text-lg text-background/50 leading-relaxed max-w-2xl mb-20">
              كل طبقة تبني على التي قبلها… حتى يتحول النظام من أداة تسعير إلى بيئة تشغيل متكاملة.
            </p>
          </Reveal>

          <div className="max-w-4xl mx-auto">
            {/* Vertical connector line — desktop only */}
            <div className="absolute right-[3.5rem] lg:right-[calc(50%-18rem+2.5rem)] top-[28rem] bottom-[8rem] w-px bg-background/10 hidden lg:block" />

            {[
              {
                icon: Receipt,
                num: '01',
                title: 'التسعير',
                body: 'تسعير دقيق مبني على التشغيل الحقيقي — استهلاك المواد، استغلال الشيت، ومراحل الإنتاج الفعلية.',
                accent: 'hsl(221 83% 53%)',
                bg: 'hsla(221, 83%, 53%, 0.10)',
              },
              {
                icon: Layers,
                num: '02',
                title: 'المونتاج الذكي',
                body: 'محرك مونتاج يكتشف التعشيق الفعلي بين القوالب، ويستفيد من كل فراغ بين الألسنة الخارجية.',
                accent: 'hsl(161 60% 45%)',
                bg: 'hsla(161, 60%, 45%, 0.10)',
              },
              {
                icon: Workflow,
                num: '03',
                title: 'أوامر الإنتاج',
                body: 'تتبّع لحظي لكل أمر تشغيل — من الموافقة على العرض إلى التسليم، بخطوات واضحة وموثقة.',
                accent: 'hsl(221 83% 63%)',
                bg: 'hsla(221, 83%, 63%, 0.10)',
              },
              {
                icon: Warehouse,
                num: '04',
                title: 'المخزون',
                body: 'ربط استهلاك المواد بكل أمر تشغيل — رؤية حقيقية لما يُستخدم وما يتبقى، دون تخمين.',
                accent: 'hsl(215 16% 65%)',
                bg: 'hsla(215, 16%, 65%, 0.10)',
              },
              {
                icon: Boxes,
                num: '05',
                title: 'Marketplace',
                body: 'مساحة تربط المطابع بالعملاء والموردين — طلبات جديدة، مواد، وشراكات تشغيلية مباشرة.',
                accent: 'hsl(161 60% 55%)',
                bg: 'hsla(161, 60%, 55%, 0.10)',
              },
            ].map((layer, i) => (
              <Reveal key={i} delay={i * 120}>
                <div
                  className={`relative ${i > 0 ? 'lg:-mt-5' : ''}`}
                  style={{ zIndex: 5 - i }}
                >
                  <div
                    className="relative rounded-2xl border border-background/10 overflow-hidden transition-all duration-500 hover:border-background/25 group"
                    style={{
                      background: 'linear-gradient(135deg, hsl(222 30% 14% / 0.85), hsl(222 30% 11% / 0.90))',
                      boxShadow: `0 ${8 + i * 3}px ${32 + i * 6}px -${6 + i}px hsl(222 47% 5% / ${0.35 + i * 0.04})`,
                    }}
                  >
                    {/* Colored left accent */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-[3px]"
                      style={{ backgroundColor: layer.accent, opacity: 0.7 }}
                    />

                    <div className="p-7 lg:p-10">
                      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                        {/* Icon pill */}
                        <div className="flex items-center gap-5 lg:w-72 shrink-0">
                          <div
                            className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: layer.bg }}
                          >
                            <layer.icon className="w-6 h-6" style={{ color: layer.accent }} />
                          </div>
                          <div>
                            <div className="text-xs text-background/40 tabular-nums mb-1">
                              طبقة {layer.num}
                            </div>
                            <h3 className="text-xl lg:text-2xl font-bold tracking-tight">
                              {layer.title}
                            </h3>
                          </div>
                        </div>

                        {/* Divider on desktop */}
                        <div className="hidden lg:block w-px self-stretch bg-background/10 mx-2" />

                        {/* Description */}
                        <div className="flex-1">
                          <p className="text-background/60 leading-relaxed text-base lg:text-[17px]">
                            {layer.body}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Subtle bottom glow on hover */}
                    <div
                      className="absolute inset-x-0 bottom-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{ backgroundColor: layer.accent, opacity: 0.4 }}
                    />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========== SECTION 9 — EARLY JOIN ========== */}
      <section className="py-28 lg:py-40">
        <div className="container mx-auto px-6 lg:px-10">
          <Reveal>
            <div className="max-w-3xl mx-auto text-center">
              <div className="text-xs uppercase tracking-[0.2em] text-primary mb-4">
                08 — Early Access
              </div>
              <h2 className="text-3xl lg:text-5xl font-bold tracking-tight leading-tight">
                المطابع التي تبدأ مبكرًا…
                <br />
                <span className="text-muted-foreground/70">تتقدم أسرع.</span>
              </h2>
              <p className="mt-8 text-lg text-muted-foreground leading-relaxed">
                نعمل اليوم مع مجموعة محدودة من المطابع لتشكيل ملامح النظام
                وتطوير ميزاته من الواقع التشغيلي مباشرة.
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Button size="lg" className="rounded-full px-8 h-12">
                  انضم إلى الموجة الأولى
                </Button>
                <Button size="lg" variant="ghost" className="rounded-full px-8 h-12">
                  تحدث مع الفريق
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ========== FAQ ========== */}
      <section id="faq" className="py-28 lg:py-40 border-t border-border/60">
        <div className="container mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-12 gap-16">
            <div className="lg:col-span-4">
              <Reveal>
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-4">
                  09 — الأسئلة
                </div>
                <h2 className="text-3xl lg:text-5xl font-bold tracking-tight leading-tight">
                  أسئلة هادئة،
                  <br />
                  إجابات واضحة.
                </h2>
              </Reveal>
            </div>
            <div className="lg:col-span-8">
              <Reveal delay={100}>
                <Accordion type="single" collapsible className="w-full">
                  {faqs.map((item, i) => (
                    <AccordionItem
                      key={item.id || i}
                      value={`item-${i}`}
                      className="border-b border-border/60"
                    >
                      <AccordionTrigger className="text-right text-base font-semibold py-6 hover:no-underline">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground leading-relaxed pb-6 text-base">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ========== CLOSING ========== */}
      <section className="relative py-32 lg:py-48 bg-foreground text-background overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-primary/20 blur-[120px]" />
        </div>
        <div className="container mx-auto px-6 lg:px-10 relative">
          <Reveal>
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
                مستقبل القطاع
                <br />
                <span className="text-background/50">يبدأ الآن.</span>
              </h2>
              <p className="mt-10 text-lg lg:text-xl text-background/60 leading-relaxed max-w-2xl mx-auto">
                PrintingOS لا يقدّم وعودًا… بل بنية هادئة تساعد المطابع على
                العمل بثبات، والاستفادة من إمكانياتها بالكامل.
              </p>
              <div className="mt-12">
                <Button
                  size="lg"
                  variant="secondary"
                  className="rounded-full px-10 h-14 text-base"
                >
                  ابدأ معنا
                  <ArrowLeft className="w-4 h-4 mr-2" />
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="border-t border-border/60 py-10">
        <div className="container mx-auto px-6 lg:px-10 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
              <Layers className="w-3 h-3 text-primary" />
            </div>
            <span>© {new Date().getFullYear()} PrintingOS</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-foreground transition">سياسة الخصوصية</a>
            <a href="#" className="hover:text-foreground transition">الشروط</a>
            <Link to="/app" className="hover:text-foreground transition">دخول النظام</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
