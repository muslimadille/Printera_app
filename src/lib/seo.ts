// Dynamic SEO meta tag manager. Updates document title, description,
// canonical, OG and Twitter tags based on the current active tab.
import { useEffect } from 'react';

const BASE_URL = 'https://printlogic.online';
const SITE_NAME = 'حاسبة تكلفة الطباعة الذكية';
const DEFAULT_IMAGE = 'https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/3a2ae119-cbbe-47f8-84e9-8f018cd73782/id-preview-f2a1bfd2--584406a2-4d03-48c5-8313-465afef78bb0.lovable.app-1775340185678.png';

export interface TabSEO {
  title: string;
  description: string;
  path?: string;
}

// Per-tab SEO content. Title kept under 60 chars, description under 160.
export const TAB_SEO: Record<string, TabSEO> = {
  itemcost: {
    title: 'تكلفة صنف | حاسبة تكلفة الطباعة الذكية',
    description: 'احسب تكلفة الطباعة لأي صنف بدقة في ثوانٍ — ورق، ألوان، تشطيب وهامش ربح.',
    path: '/itemcost',
  },
  hybridengine: {
    title: 'حساب الصنف | المحرك الهجين الذكي',
    description: 'محرك حساب هجين بوضع ذكي ويدوي لتوزيع الأصناف على الفرخ بأقل هدر.',
    path: '/hybridengine',
  },
  templatecost: {
    title: 'تكلفة بقالب جاهز | حاسبة الطباعة',
    description: 'احسب تكلفة الطباعة بسرعة باستخدام قوالب جاهزة لأشهر المقاسات والمنتجات.',
    path: '/templatecost',
  },
  templatemontage: {
    title: 'مونتاج قالب | تعشيق ذكي بأربع اتجاهات',
    description: 'محرك تعشيق متقدم للقوالب: تدوير مستقل لكل نسخة (0/90/180/270) مع Skyline BLF لأعلى استفادة من الفرخ.',
    path: '/templatemontage',
  },
  mergeitems: {
    title: 'دمج أصناف على فرخ واحد | توفير التكلفة',
    description: 'ادمج أكثر من صنف على نفس الفرخ لتقليل تكلفة الطباعة وزيادة الكفاءة.',
    path: '/mergeitems',
  },
  smartengine: {
    title: 'المحرك الذكي للطباعة | اختيار الفرخ الأمثل',
    description: 'محرك ذكي يختار أفضل فرخ ومقاس طباعة تلقائيًا لتقليل الهدر وأقل سعر.',
    path: '/smartengine',
  },
  magazinesheet: {
    title: 'تكلفة مجلة | حساب الأوراق والغلاف',
    description: 'احسب تكلفة طباعة المجلات بدقة: عدد الصفحات، الغلاف، التجليد والتشطيب.',
    path: '/magazine',
  },
  bagcalc: {
    title: 'حاسبة الأكياس الورقية | تكلفة الإنتاج',
    description: 'احسب تكلفة طباعة وتصنيع الأكياس الورقية بمختلف المقاسات والخامات.',
    path: '/bags',
  },
  boxpricing: {
    title: 'تكلفة العلب والأكياس | تسعير دقيق',
    description: 'تسعير العلب الكرتونية والأكياس بناءً على المقاس، الخامة، الطباعة والتشطيب.',
    path: '/boxes',
  },
  paperset: {
    title: 'مجموعة أوراق | حساب القص والتوزيع',
    description: 'احسب توزيع وتقطيع مجموعات الأوراق على مرحلتين بكفاءة عالية.',
    path: '/paperset',
  },
  manual: {
    title: 'تسعير يدوي | تحكم كامل بالتكاليف',
    description: 'وضع التسعير اليدوي للتحكم الكامل بمنطق قص الورق والتكاليف.',
    path: '/manual',
  },
  savedquotes: {
    title: 'العروض المحفوظة | إدارة عروض الأسعار',
    description: 'تصفح وعدّل وأعد طباعة عروض الأسعار المحفوظة لعملائك.',
    path: '/quotes',
  },
  settings: {
    title: 'الإعدادات | حاسبة تكلفة الطباعة',
    description: 'إدارة إعدادات التسعير، هوامش الربح، وأسعار الورق والخدمات.',
    path: '/settings',
  },
  papertypes: {
    title: 'أنواع الورق وأسعارها | إدارة الخامات',
    description: 'إدارة قائمة أنواع الورق والمقاسات والأسعار حسب الجرامات والوحدة.',
    path: '/papers',
  },
  employees: {
    title: 'إدارة الموظفين | حاسبة الطباعة',
    description: 'إدارة حسابات الموظفين وصلاحيات التبويبات وحدود الأجهزة.',
    path: '/employees',
  },
  users: {
    title: 'إدارة المستخدمين | لوحة المسؤول',
    description: 'إنشاء وإدارة حسابات المستخدمين والصلاحيات في النظام.',
    path: '/users',
  },
  loginhistory: {
    title: 'سجل تسجيل الدخول | متابعة النشاط',
    description: 'مراجعة سجل تسجيل دخول المستخدمين والأجهزة المستخدمة.',
    path: '/login-history',
  },
  guide: {
    title: 'دليل الاستخدام | حاسبة تكلفة الطباعة',
    description: 'دليل شامل لاستخدام حاسبة تكلفة الطباعة الذكية بكل ميزاتها.',
    path: '/guide',
  },
};

const DEFAULT_SEO: TabSEO = {
  title: 'حاسبة تكلفة الطباعة الذكية | احسب تكاليف الطباعة في ثوانٍ',
  description: 'احسب تكاليف الطباعة في أقل من 30 ثانية — حاسبة تكلفة الطباعة الذكية للورق والتشطيب.',
  path: '/',
};

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

// Supported language versions of the site. Add new entries here when more
// localized builds are published. Each entry maps to its full URL prefix.
const HREFLANG_LOCALES: { code: string; prefix: string }[] = [
  { code: 'ar', prefix: BASE_URL },
  // { code: 'en', prefix: 'https://printlogic.online/en' },
];

function setHreflangLinks(path: string) {
  // Remove old hreflang alternates so we don't accumulate duplicates per tab.
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach(n => n.remove());
  HREFLANG_LOCALES.forEach(({ code, prefix }) => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'alternate');
    link.setAttribute('hreflang', code);
    link.setAttribute('href', `${prefix}${path}`);
    document.head.appendChild(link);
  });
  // x-default points to the primary (Arabic) version.
  const xDefault = document.createElement('link');
  xDefault.setAttribute('rel', 'alternate');
  xDefault.setAttribute('hreflang', 'x-default');
  xDefault.setAttribute('href', `${BASE_URL}${path}`);
  document.head.appendChild(xDefault);
}

/**
 * Optional context that overrides/augments the base tab SEO. When the user is
 * editing a quote or has filled item info, we surface that in:
 *   - the browser tab title (document.title)
 *   - the OG/Twitter title and description (so shared links show the same)
 */
export interface SEOContext {
  itemName?: string;
  itemNumber?: string;
  customerName?: string;
  quoteNumber?: string;
}

// Hard length limits to keep titles/descriptions readable in browser tabs,
// search results, and social card previews.
const MAX_TITLE_LEN = 60;       // Google/most browsers truncate around 60.
const MAX_DESC_LEN = 160;       // Search snippet ceiling.
const MAX_FIELD_LEN = 24;       // Per-field cap (item/customer name).
const MAX_NUMBER_LEN = 16;      // Per-field cap (quote/item number).
const ELLIPSIS = '…';

function truncate(s: string | undefined, max: number): string {
  if (!s) return '';
  const t = s.trim();
  return t.length > max ? t.slice(0, max - 1) + ELLIPSIS : t;
}

function clampTotal(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + ELLIPSIS : s;
}

function buildContextSuffix(ctx?: SEOContext): { titlePrefix: string; descSuffix: string } {
  if (!ctx) return { titlePrefix: '', descSuffix: '' };

  // Compact title prefix: "<item> — <customer> · "
  const item = truncate(ctx.itemName, MAX_FIELD_LEN);
  const customer = truncate(ctx.customerName, MAX_FIELD_LEN);
  const titleBits = [item, customer].filter(Boolean);
  const titlePrefix = titleBits.length ? `${titleBits.join(' — ')} · ` : '';

  // Description suffix: more verbose, with quote/item numbers when present.
  const descBits: string[] = [];
  if (ctx.quoteNumber) descBits.push(`عرض رقم ${truncate(ctx.quoteNumber, MAX_NUMBER_LEN)}`);
  if (ctx.itemNumber) descBits.push(`صنف ${truncate(ctx.itemNumber, MAX_NUMBER_LEN)}`);
  if (customer) descBits.push(`للعميل ${customer}`);
  const descSuffix = descBits.length ? ` — ${descBits.join(' · ')}` : '';

  return { titlePrefix, descSuffix };
}

export const STATIC_TITLE_KEY = 'printCalc_staticBrowserTitle';
export const STATIC_TITLE = SITE_NAME;

export function applyTabSEO(tabKey: string, ctx?: SEOContext) {
  const seo = TAB_SEO[tabKey] || DEFAULT_SEO;
  const path = seo.path || '/';
  const url = `${BASE_URL}${path}`;
  const { titlePrefix, descSuffix } = buildContextSuffix(ctx);

  // When context is present, prefer a compact title: "<prefix><short tab name>"
  // to leave room for the prefix without exceeding the 60-char ceiling.
  const shortTabTitle = seo.title.split('|')[0].trim();
  const baseTitle = titlePrefix ? `${titlePrefix}${shortTabTitle}` : seo.title;
  const title = clampTotal(baseTitle, MAX_TITLE_LEN);
  const description = clampTotal(`${seo.description}${descSuffix}`, MAX_DESC_LEN);

  // User preference: keep browser tab title static.
  let staticTitle = false;
  try { staticTitle = localStorage.getItem(STATIC_TITLE_KEY) === '1'; } catch {}
  document.title = staticTitle ? STATIC_TITLE : title;

  setMeta('meta[name="description"]', 'name', 'description', description);
  setLink('canonical', url);
  setHreflangLinks(path);


  // Open Graph — kept in sync with the browser title so shared links match.
  setMeta('meta[property="og:title"]', 'property', 'og:title', title);
  setMeta('meta[property="og:description"]', 'property', 'og:description', description);
  setMeta('meta[property="og:url"]', 'property', 'og:url', url);
  setMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
  setMeta('meta[property="og:site_name"]', 'property', 'og:site_name', SITE_NAME);
  setMeta('meta[property="og:locale"]', 'property', 'og:locale', 'ar_AR');
  setMeta('meta[property="og:image"]', 'property', 'og:image', DEFAULT_IMAGE);

  // Twitter — same content, different namespace.
  setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
  setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', DEFAULT_IMAGE);
}

/** Hook: applies SEO meta tags whenever the active tab or context changes. */
export function useTabSEO(tabKey: string, ctx?: SEOContext) {
  const key = `${ctx?.itemName || ''}|${ctx?.itemNumber || ''}|${ctx?.customerName || ''}|${ctx?.quoteNumber || ''}`;
  useEffect(() => {
    applyTabSEO(tabKey, ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabKey, key]);
}
