import { supabase } from '@/integrations/supabase/client';

export interface SiteInfo {
  name: string;
  tagline: string;
  supportEmail: string;
  phone: string;
  address: string;
  copyright: string;
}

export interface HomeTexts {
  heroTitle: string;
  heroSubtitle: string;
  badgeText: string;
}

export interface AboutTexts {
  title: string;
  subtitle: string;
  content: string;
}

export interface ContactTexts {
  title: string;
  subtitle: string;
}

export interface GlobalFeatureFlags {
  globalNestingEnabled: boolean;
  global3DEnabled: boolean;
  globalExportEnabled: boolean;
  maintenanceMode: boolean;
}

export interface SiteSettings {
  siteInfo: SiteInfo;
  homeTexts: HomeTexts;
  aboutTexts: AboutTexts;
  contactTexts: ContactTexts;
  featureFlags: GlobalFeatureFlags;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteInfo: {
    name: 'برينتيرا',
    tagline: 'منصة إنتاج وتصميم قوالب التغليف البارامترية الهندسية بدقة متناهية، جاهزة للقص المباشر.',
    supportEmail: 'support@printera.app',
    phone: '+966 50 000 0000',
    address: 'الرياض، المملكة العربية السعودية',
    copyright: 'جميع الحقوق محفوظة © 2026 برينتيرا',
  },
  homeTexts: {
    heroTitle: 'قوالب تغليف كرتون تفاعلية بالبكسل',
    heroSubtitle: 'صمم وقس وقص وسدد مباشرة بدون أخطاء. هندسة دقيقة بلغة سريعة وأدوات احترافية.',
    badgeText: 'منصة تصميم قوالب التغليف الهندسية رقم #1',
  },
  aboutTexts: {
    title: 'عن برينتيرا',
    subtitle: 'نبتكر مستقبل تصميم قوالب التغليف بالشرق الأوسط',
    content: 'تم تطوير برينتيرا لتمكين المطابع ومصممي التغليف ومصانع الكرتون من حساب وتصدير قوالب التغليف البارامترية بسهولة وبدقة متناهية دون الحاجة لخبرة برمجية معقدة.',
  },
  contactTexts: {
    title: 'تواصل معنا',
    subtitle: 'نحن هنا لمساعدتك وتلقي استفساراتك واقتراحاتك على مدار الساعة.',
  },
  featureFlags: {
    globalNestingEnabled: true,
    global3DEnabled: true,
    globalExportEnabled: true,
    maintenanceMode: false,
  },
};

const STORAGE_KEY = 'printera_site_settings_v1';

export async function fetchSiteSettings(): Promise<SiteSettings> {
  try {
    const { data, error } = await supabase.from('site_settings').select('*');
    if (!error && data && data.length > 0) {
      const merged: any = { ...DEFAULT_SITE_SETTINGS };
      data.forEach((row: any) => {
        if (row.key && row.value) {
          merged[row.key] = { ...merged[row.key], ...row.value };
        }
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (e) {
    console.warn('Failed to fetch site settings from Supabase, using local fallback:', e);
  }

  // Fallback to local storage or defaults
  try {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      return { ...DEFAULT_SITE_SETTINGS, ...JSON.parse(local) };
    }
  } catch (e) {
    console.error('Local storage parse error:', e);
  }

  return DEFAULT_SITE_SETTINGS;
}

export async function updateSiteSettingSection<K extends keyof SiteSettings>(
  sectionKey: K,
  value: SiteSettings[K]
): Promise<boolean> {
  // Update local storage first for snappy UI
  try {
    const current = await fetchSiteSettings();
    const updated = { ...current, [sectionKey]: value };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed updating local storage:', e);
  }

  // Persist to Supabase DB
  try {
    const { error } = await supabase.from('site_settings').upsert(
      {
        key: sectionKey,
        value: value as any,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
    if (error) {
      console.warn('Supabase upsert warning for site_settings:', error.message);
    }
    return true;
  } catch (e) {
    console.error('Supabase error saving site settings:', e);
    return true; // Local update still succeeded
  }
}
