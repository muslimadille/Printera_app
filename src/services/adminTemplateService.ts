import { supabase } from '@/integrations/supabase/client';

export interface DbTemplate {
  id: string;
  title: string;
  category: string;
  category_label: string;
  description: string;
  pro: boolean;
  is_visible: boolean;
  enable_nesting: boolean;
  enable_3d: boolean;
  svg?: string;
  tags?: string[];
  downloads?: number;
  width_default?: number;
  height_default?: number;
  depth_default?: number;
}

export const INITIAL_TEMPLATES: DbTemplate[] = [
  {
    id: 'A60_20_01_01',
    title: 'علبة ذاتية القفل ECMA',
    category: 'folding',
    category_label: 'طي وصواني',
    description: 'علبة كرتون بقاع أوتوماتيكي سريع الغلق (Crash Lock / 2-Point Gluing).',
    pro: false,
    is_visible: true,
    enable_nesting: true,
    enable_3d: true,
    downloads: 2150,
    width_default: 50,
    height_default: 150,
    depth_default: 100,
  },
  {
    id: 'T0002',
    title: 'علبة مستقيمة الإغلاق',
    category: 'folding',
    category_label: 'طي وصواني',
    description: 'التصميم الأساسي لعلب الطي الكرتونية، إغلاق علوي وسفلي بسيط بدون لصق.',
    pro: false,
    is_visible: true,
    enable_nesting: true,
    enable_3d: true,
    downloads: 3890,
    width_default: 150,
    height_default: 100,
    depth_default: 50,
  },
];

const ALLOWED_IDS = new Set(['A60_20_01_01', 'T0002']);

const LOCAL_STORAGE_TEMPLATES_KEY = 'printera_admin_templates_v1';

export async function fetchAllAdminTemplates(): Promise<DbTemplate[]> {
  let cachedMap: Record<string, DbTemplate> = {};
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_TEMPLATES_KEY);
    if (cached) {
      const arr: DbTemplate[] = JSON.parse(cached);
      arr.forEach(t => { if (ALLOWED_IDS.has(t.id)) cachedMap[t.id] = t; });
    }
  } catch (e) {
    console.error('Local template parse error:', e);
  }

  try {
    const { data, error } = await supabase.from('app_templates').select('*');
    if (!error && data && data.length > 0) {
      const dbTemplates: DbTemplate[] = data
        .filter((item: any) => ALLOWED_IDS.has(item.id))
        .map((item: any) => ({
          id: item.id,
          title: item.title,
          category: item.category || 'folding',
          category_label: item.category_label || item.categoryLabel || 'طي وصواني',
          description: item.description || item.desc || '',
          pro: Boolean(item.pro),
          is_visible: item.is_visible !== undefined ? Boolean(item.is_visible) : true,
          enable_nesting: item.enable_nesting !== undefined ? Boolean(item.enable_nesting) : true,
          enable_3d: item.enable_3d !== undefined ? Boolean(item.enable_3d) : true,
          downloads: item.downloads || 0,
          width_default: item.width_default || 200,
          height_default: item.height_default || 120,
          depth_default: item.depth_default || 80,
          svg: item.svg,
          tags: item.tags,
        }));

      // Merge cached local edits over DB results if local has newer/overridden items
      const mergedMap: Record<string, DbTemplate> = {};
      dbTemplates.forEach(t => {
        mergedMap[t.id] = { ...t, ...(cachedMap[t.id] || {}) };
      });
      // Merge missing defaults from INITIAL_TEMPLATES
      INITIAL_TEMPLATES.forEach(initial => {
        if (!mergedMap[initial.id]) {
          mergedMap[initial.id] = initial;
        }
      });

      const result = Object.values(mergedMap).filter(t => ALLOWED_IDS.has(t.id));
      localStorage.setItem(LOCAL_STORAGE_TEMPLATES_KEY, JSON.stringify(result));
      return result;
    }
  } catch (e) {
    console.warn('Failed fetching templates from Supabase, resorting to local fallback:', e);
  }

  // Local storage fallback
  INITIAL_TEMPLATES.forEach(initial => {
    if (!cachedMap[initial.id]) {
      cachedMap[initial.id] = initial;
    }
  });
  return Object.values(cachedMap).filter(t => ALLOWED_IDS.has(t.id));id => {
        if (!mergedMap[id]) {
          mergedMap[id] = cachedMap[id];
        }
      });
      // Merge missing defaults from INITIAL_TEMPLATES
      INITIAL_TEMPLATES.forEach(initial => {
        if (!mergedMap[initial.id]) {
          mergedMap[initial.id] = initial;
        }
      });

      const result = Object.values(mergedMap);
      localStorage.setItem(LOCAL_STORAGE_TEMPLATES_KEY, JSON.stringify(result));
      return result;
    }
  } catch (e) {
    console.warn('Failed fetching templates from Supabase, resorting to local fallback:', e);
  }

  // Local storage fallback
  if (Object.keys(cachedMap).length > 0) {
    // Ensure all INITIAL_TEMPLATES exist
    INITIAL_TEMPLATES.forEach(initial => {
      if (!cachedMap[initial.id]) {
        cachedMap[initial.id] = initial;
      }
    });
    return Object.values(cachedMap);
  }

  return INITIAL_TEMPLATES;
}

export async function saveOrUpdateTemplate(template: DbTemplate): Promise<boolean> {
  // Update local storage cache
  try {
    const current = await fetchAllAdminTemplates();
    const index = current.findIndex(t => t.id === template.id);
    let updated: DbTemplate[];
    if (index >= 0) {
      updated = [...current];
      updated[index] = { ...updated[index], ...template };
    } else {
      updated = [...current, template];
    }
    localStorage.setItem(LOCAL_STORAGE_TEMPLATES_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Local storage template update error:', e);
  }

  // Update Supabase
  try {
    const payload = {
      id: template.id,
      title: template.title,
      category: template.category,
      category_label: template.category_label,
      description: template.description,
      pro: template.pro,
      is_visible: template.is_visible,
      enable_nesting: template.enable_nesting,
      enable_3d: template.enable_3d,
      downloads: template.downloads || 0,
      width_default: template.width_default || 200,
      height_default: template.height_default || 120,
      depth_default: template.depth_default || 80,
    };
    const { error } = await supabase.from('app_templates').upsert(payload as any, { onConflict: 'id' });
    if (error) {
      console.warn('Supabase upsert warning for app_templates:', error.message);
    }
    return true;
  } catch (e) {
    console.error('Supabase save error:', e);
    return true;
  }
}

export async function deleteTemplateFromDb(templateId: string): Promise<boolean> {
  // Local storage removal
  try {
    const current = await fetchAllAdminTemplates();
    const updated = current.filter(t => t.id !== templateId);
    localStorage.setItem(LOCAL_STORAGE_TEMPLATES_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Local storage delete error:', e);
  }

  // Supabase DB delete
  try {
    const { error } = await supabase.from('app_templates').delete().eq('id', templateId);
    if (error) console.warn('Supabase template delete warning:', error.message);
  } catch (e) {
    console.error('Supabase delete error:', e);
  }

  return true;
}
