import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AppTemplateItem {
  id: string;
  title: string;
  category: string;
  categoryLabel?: string;
  desc?: string;
  tags?: string[];
  pro?: boolean;
  svg?: string;
  default_w?: number;
  default_h?: number;
  default_d?: number;
  downloads?: number;
  status?: 'active' | 'inactive';
}

export const SYSTEM_DEFAULT_TEMPLATES: AppTemplateItem[] = [
  {
    id: 'A60_20_01_01',
    title: 'علبة ذاتية القفل (ECMA Auto Lock Bottom)',
    category: 'folding',
    categoryLabel: 'علب قابلة للطي',
    desc: 'علبة كرتون بقاع أوتوماتيكي سريع الغلق (Crash Lock / 2-Point Gluing)',
    tags: ['ذاتية القفل', 'ECMA', 'كرتون', 'طي'],
    pro: false,
    svg: '/templates/preview/A60_20_01_01.svg',
    default_w: 50,
    default_h: 150,
    default_d: 100,
  },
  {
    id: 'T0002',
    title: 'علبة قابلة للطي (Straight Tuck End)',
    category: 'folding',
    categoryLabel: 'علب قابلة للطي',
    desc: 'علبة كرتون قياسية قابلة للطي مع ألسنة إغلاق علوية وسفلية',
    tags: ['كرتون', 'طي', 'تغليف'],
    pro: false,
    svg: '/templates/preview/T0002.svg',
    default_w: 200,
    default_h: 120,
    default_d: 80,
  },
];

const ALLOWED_TEMPLATE_IDS = new Set(['A60_20_01_01', 'T0002']);

const EVENT_NAME = 'appTemplatesUpdated';

export function getMergedTemplatesList(dbData?: any[]): AppTemplateItem[] {
  const map = new Map<string, AppTemplateItem>();
  SYSTEM_DEFAULT_TEMPLATES.forEach(item => map.set(item.id, { ...item }));

  if (dbData && dbData.length > 0) {
    dbData.forEach((row: any) => {
      if (!ALLOWED_TEMPLATE_IDS.has(row.id)) return;
      const existing = map.get(row.id) || { id: row.id, title: row.title, category: row.category || 'folding', status: 'active' };
      map.set(row.id, {
        ...existing,
        ...row,
        title: row.title || existing.title,
        categoryLabel: row.category_label || row.categoryLabel || existing.categoryLabel,
        default_w: row.default_w ?? existing.default_w,
        default_h: row.default_h ?? existing.default_h,
        default_d: row.default_d ?? existing.default_d,
        status: row.status || existing.status || 'active',
      });
    });
  }

  const rawOverrides = localStorage.getItem('printCalc_customTemplateOverrides');
  if (rawOverrides) {
    try {
      const overrides = JSON.parse(rawOverrides);
      Object.keys(overrides).forEach(id => {
        if (!ALLOWED_TEMPLATE_IDS.has(id)) return;
        const ov = overrides[id];
        const existing = map.get(id);
        if (existing && ov) {
          map.set(id, {
            ...existing,
            title: ov.title !== undefined && ov.title !== '' ? ov.title : existing.title,
            categoryLabel: ov.categoryLabel !== undefined && ov.categoryLabel !== '' ? ov.categoryLabel : existing.categoryLabel,
            default_w: ov.defaultW ?? ov.default_w ?? existing.default_w,
            default_h: ov.defaultH ?? ov.default_h ?? existing.default_h,
            default_d: ov.defaultD ?? ov.default_d ?? existing.default_d,
            status: ov.status || existing.status || 'active',
          });
        }
      });
    } catch (e) {
      console.error('Error parsing template overrides:', e);
    }
  }

  return Array.from(map.values()).filter(t => ALLOWED_TEMPLATE_IDS.has(t.id));
}

export function useAppTemplates() {
  const [templates, setTemplates] = useState<AppTemplateItem[]>(() => getMergedTemplatesList());
  const [isLoading, setIsLoading] = useState(true);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const { data: dbData } = await supabase.from('app_templates').select('*');
      const merged = getMergedTemplatesList(dbData || []);
      setTemplates(merged);
    } catch (err) {
      console.error('Error fetching app templates:', err);
      setTemplates(getMergedTemplatesList());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
    window.addEventListener(EVENT_NAME, loadTemplates);
    window.addEventListener('appContentUpdated', loadTemplates);
    window.addEventListener('storage', loadTemplates);
    return () => {
      window.removeEventListener(EVENT_NAME, loadTemplates);
      window.removeEventListener('appContentUpdated', loadTemplates);
      window.removeEventListener('storage', loadTemplates);
    };
  }, []);

  return { templates, isLoading, reloadTemplates: loadTemplates };
}
