// Central registry that maps a saved quote `source_type` to the tab that owns it,
// plus a friendly Arabic label for that tab.
// Used by the "open saved quote in alternate tab" safety flow.

import { TabPermission } from '@/lib/userApi';

// All tabs that can be a target for opening a saved quote.
export const QUOTE_CAPABLE_TABS: { key: string; label: string }[] = [
  { key: 'hybridengine', label: 'حساب الصنف' },
  { key: 'itemcost', label: 'تكلفة صنف' },
  { key: 'flat', label: 'مسطح' },
  { key: 'montage', label: 'مونتاج' },
  { key: 'templatecost', label: 'تكلفة بقالب' },
  { key: 'diecut', label: 'Die Cut' },
  { key: 'diecut2', label: 'Die Cut 2' },
  { key: 'diecut4', label: 'Die Cut 4' },
  { key: 'diecut5', label: 'Die Cut 5' },
  { key: 'medicinebox1', label: 'Medicine Box #1' },
  { key: 'box10001', label: '10001' },
  { key: 'templatemontage', label: 'مونتاج قالب' },
  { key: 'mergeitems', label: 'دمج أصناف' },
  { key: 'smartengine', label: 'المحرك الذكي' },
  { key: 'costcalc', label: 'حساب التكلفة' },
  { key: 'calculator', label: 'حاسبة التسعير' },
  { key: 'box_t0003', label: 'T003' },
  { key: 'paperset', label: 'مجموعة أوراق' },
  { key: 'magazines', label: 'المجلات' },
  { key: 'magazinesheet', label: 'تكلفة مجلة' },
  { key: 'bagcalc', label: 'حساب الأكياس' },
  { key: 'newmagazine', label: 'المجلة' },
  { key: 'magazine', label: 'المجلات (قديم)' },
  { key: 'boxpricing', label: 'العلب والأكياس' },
  { key: 'manual', label: 'يدوي' },
  { key: 'employee', label: 'إدخال الموظف' },
];

// Maps a saved quote source_type to its native tab key.
export const SOURCE_TO_TAB: Record<string, string> = {
  hybridengine: 'hybridengine',
  itemcost: 'itemcost',
  montage: 'montage',
  templatecost: 'templatecost',
  templatemontage: 'templatemontage',
  mergeitems: 'mergeitems',
  smartengine: 'smartengine',
  costcalc: 'costcalc',
  calculator: 'calculator',
  paperset: 'paperset',
  magazines: 'magazines',
  magazinesheet: 'magazinesheet',
  newmagazine: 'newmagazine',
  magazine: 'magazine',
  boxpricing: 'boxpricing',
  manual: 'manual',
  employee: 'employee',
};

export const getTabLabel = (tabKey: string): string => {
  const t = QUOTE_CAPABLE_TABS.find(x => x.key === tabKey);
  return t?.label || tabKey;
};

// Mirrors the rule used in AppTabs: primary tabs default ON, others default OFF
// unless an explicit permission row says otherwise. Admins always have access.
const DEFAULT_ON_KEYS = new Set<string>([
  'hybridengine', 'itemcost', 'flat', 'montage', 'templatecost', 'templates', 'diecut', 'diecut2', 'diecut3', 'diecut4', 'diecut5', 'carryhandle', 'lidtuck', 'medicinebox1', 'box10001', 'svgnest', 'templatemontage', 'magazinesheet', 'bagcalc', 'costcalc', 'smartengine', 'mergeitems',
  'montag', 'montag_itemcost', 'montag_box10001',
  'box_diecut', 'box_diecut2', 'box_diecut3', 'box_diecut4', 'box_diecut5', 'box_carryhandle', 'box_lidtuck', 'box_medicinebox1', 'box_box10001', 'box_svgnest', 'box_d001', 'box_t0002', 'box_t0003', 'box_t0005', 'box_t0006', 
  'savedquotes', 'settings', 'papertypes', 'guide',
]);

export const isTabAvailable = (
  tabKey: string,
  isAdmin: boolean,
  tabPermissions: TabPermission[],
): boolean => {
  if (isAdmin) return true;
  const perm = tabPermissions.find(p => p.tab_key === tabKey);
  if (perm) return perm.is_enabled;
  return DEFAULT_ON_KEYS.has(tabKey);
};

// Default tab is stored as a special permission row: tab_key = `default_tab:<key>`,
// is_enabled = true. Returns the chosen tab key, or null when none set.
export const DEFAULT_TAB_PREFIX = 'default_tab:';
export const getDefaultTabKey = (tabPermissions: TabPermission[]): string | null => {
  const row = tabPermissions.find(p => p.tab_key.startsWith(DEFAULT_TAB_PREFIX) && p.is_enabled);
  if (!row) return null;
  return row.tab_key.slice(DEFAULT_TAB_PREFIX.length) || null;
};
