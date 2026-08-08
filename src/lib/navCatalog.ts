import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  BookOpen,
  Box,
  Brain,
  Calculator,
  Combine,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  History,
  Layers,
  PenTool,
  Settings,
  ShoppingBag,
  Sparkles,
  UserPen,
  Users,
} from 'lucide-react';

export type NavItem = {
  key: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  children?: { key: string; label: string }[];
};

/** Top row: main calculators (mirrors AppTabs PRIMARY_TABS_TOP). */
export const PRIMARY_TABS_TOP: NavItem[] = [
  { key: 'hybridengine', label: 'حساب الصنف', icon: Combine },
  { key: 'itemcost', label: 'تكلفة صنف', icon: Combine },
  { key: 'flat', label: 'مسطح', icon: Combine },
  { key: 'templatecost', label: 'تكلفة بقالب', icon: Combine },
  {
    key: 'templates',
    label: 'قوالب',
    icon: Box,
    children: [
      { key: 'diecut', label: 'Die Cut' },
      { key: 'diecut2', label: 'Die Cut 2' },
      { key: 'diecut3', label: 'Die Cut 3' },
      { key: 'diecut4', label: 'Die Cut 4' },
      { key: 'diecut5', label: 'Die Cut 5' },
      { key: 'carryhandle', label: 'Carrying Handle Box' },
      { key: 'lidtuck', label: 'Lid Tuck Box' },
      { key: 'medicinebox1', label: 'Medicine Box #1' },
      { key: 'box10001', label: '10001' },
      { key: 'svgnest', label: 'SVG Auto Nesting' },
    ],
  },
  {
    key: 'boxes',
    label: 'علب',
    icon: Box,
    children: [
      { key: 'box_diecut', label: 'Die Cut' },
      { key: 'box_diecut2', label: 'Die Cut 2' },
      { key: 'box_diecut3', label: 'Die Cut 3' },
      { key: 'box_diecut4', label: 'Die Cut 4' },
      { key: 'box_diecut5', label: 'Die Cut 5' },
      { key: 'box_carryhandle', label: 'Carrying Handle Box' },
      { key: 'box_lidtuck', label: 'Lid Tuck Box' },
      { key: 'box_medicinebox1', label: 'Medicine Box #1' },
      { key: 'box_box10001', label: '10001' },
      { key: 'box_svgnest', label: 'SVG Auto Nesting' },
      { key: 'box_d001', label: 'D001' },
      { key: 'box_d003', label: 'D003' },
      { key: 'box_t0001', label: 'T0001' },
      { key: 'box_t0002', label: 'T0002' },
      { key: 'box_a01010000', label: 'A01010000' },
      { key: 'box_a01700000', label: 'A01700000' },
      { key: 'box_generic', label: 'Generic' },
    ],
  },
  { key: 'templatemontage', label: 'مونتاج قالب', icon: Sparkles },
  { key: 'magazinesheet', label: 'تكلفة مجلة', icon: BookOpen },
  { key: 'montage', label: 'مونتاج', icon: Combine },
  { key: 'bagcalc', label: 'حساب الأكياس', icon: ShoppingBag },
  { key: 'costcalc', label: 'حساب التكلفة', icon: Calculator },
  { key: 'smartengine', label: 'المحرك الذكي', icon: Brain },
  { key: 'mergeitems', label: 'دمج أصناف', icon: Layers },
  {
    key: 'montag',
    label: 'MONTAG',
    icon: Combine,
    children: [
      { key: 'montag_itemcost', label: 'تكلفة صنف' },
      { key: 'montag_box10001', label: '10001' },
    ],
  },
];

/** Bottom row: tools / settings. */
export const PRIMARY_TABS_BOTTOM: NavItem[] = [
  { key: 'savedquotes', label: 'التكاليف المحفوظة', icon: Archive },
  { key: 'settings', label: 'الإعدادات', icon: Settings },
  { key: 'papertypes', label: 'الورق', shortLabel: 'أنواع', icon: Layers },
];

export const PRIMARY_TABS: NavItem[] = [...PRIMARY_TABS_TOP, ...PRIMARY_TABS_BOTTOM];

/** Secondary tabs — hidden by default until permissioned. */
export const SECONDARY_TABS: NavItem[] = [
  { key: 'calculator', label: 'التسعير', shortLabel: 'حاسبة', icon: Calculator },
  { key: 'paperset', label: 'مجموعة أوراق', icon: Layers },
  { key: 'magazines', label: 'المجلات', icon: BookOpen },
  { key: 'newmagazine', label: 'المجلة', icon: BookOpen },
  { key: 'magazine', label: 'المجلات (قديم)', icon: BookOpen },
  { key: 'boxpricing', label: 'العلب والأكياس', icon: Box },
  { key: 'manual', label: 'يدوي', icon: PenTool },
  { key: 'employee', label: 'الموظف', shortLabel: 'إدخال', icon: UserPen },
  { key: 'quote', label: 'عرض سعر', icon: FileText },
  { key: 'finishing', label: 'التشطيبات', icon: Sparkles },
  { key: 'bulkimport', label: 'استيراد تسعيرات', icon: FileSpreadsheet },
];

export const ADMIN_TABS: NavItem[] = [
  { key: 'users', label: 'المستخدمين', icon: Users },
  { key: 'loginhistory', label: 'السجل', icon: History },
];

export const GUIDE_TAB: NavItem = { key: 'guide', label: 'الدليل', icon: HelpCircle };

export const MY_EMPLOYEES_TAB: NavItem = { key: 'myemployees', label: 'موظفيني', icon: Users };

/** Keys that count as "active" for a parent nav item with children. */
export function isNavItemActive(item: NavItem, activeTab: string): boolean {
  if (activeTab === item.key) return true;
  return !!item.children?.some((c) => c.key === activeTab);
}

/** Flat list of leaf tab keys (for responsive audits / e2e). Parents with children are expanded. */
export function getAllLeafTabKeys(): string[] {
  const keys: string[] = [];
  const walk = (items: NavItem[]) => {
    for (const item of items) {
      if (item.children?.length) {
        for (const child of item.children) keys.push(child.key);
      } else {
        keys.push(item.key);
      }
    }
  };
  walk(PRIMARY_TABS_TOP);
  walk(PRIMARY_TABS_BOTTOM);
  walk(SECONDARY_TABS);
  walk(ADMIN_TABS);
  keys.push(GUIDE_TAB.key, MY_EMPLOYEES_TAB.key);
  return [...new Set(keys)];
}
