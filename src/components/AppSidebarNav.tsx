import { useMemo, useState } from 'react';
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { TabPermission } from '@/lib/userApi';
import { isTabAvailable } from '@/lib/tabRegistry';
import {
  ADMIN_TABS,
  GUIDE_TAB,
  MY_EMPLOYEES_TAB,
  NavItem,
  PRIMARY_TABS_BOTTOM,
  PRIMARY_TABS_TOP,
  SECONDARY_TABS,
  isNavItemActive,
} from '@/lib/navCatalog';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';

export interface AppSidebarNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isAdmin: boolean;
  tabPermissions: TabPermission[];
  maxEmployees: number;
}

function NavRow({
  item,
  activeTab,
  onSelect,
}: {
  item: NavItem;
  activeTab: string;
  onSelect: (key: string) => void;
}) {
  const active = isNavItemActive(item, activeTab);
  const [open, setOpen] = useState(active);
  const Icon = item.icon;

  if (item.children?.length) {
    return (
      <Collapsible open={open || active} onOpenChange={setOpen} className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              isActive={active}
              data-tour={`tab-${item.key}`}
              className="text-start transition-colors duration-200"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              <ChevronDown className="ms-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub className="border-s border-e-0 border-sidebar-border mx-3.5 me-3.5 ms-0">
              {item.children.map((child) => (
                <SidebarMenuSubItem key={child.key}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={activeTab === child.key}
                  >
                    <button
                      type="button"
                      data-tour={`tab-${child.key}`}
                      className="w-full justify-start text-right transition-colors duration-150"
                      onClick={() => onSelect(child.key)}
                    >
                      <span className="truncate">{child.label}</span>
                    </button>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={activeTab === item.key}
        tooltip={item.label}
        data-tour={`tab-${item.key}`}
        className="text-start transition-colors duration-200 min-h-11"
        onClick={() => onSelect(item.key)}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function GroupBlock({
  label,
  items,
  activeTab,
  onSelect,
}: {
  label: string;
  items: NavItem[];
  activeTab: string;
  onSelect: (key: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[11px] font-bold tracking-wide text-sidebar-foreground/60">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <NavRow key={item.key} item={item} activeTab={activeTab} onSelect={onSelect} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function CollapseControl() {
  const { toggleSidebar, state, isMobile } = useSidebar();
  if (isMobile) return null;
  const collapsed = state === 'collapsed';
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start gap-2 h-9 text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors duration-200"
      onClick={toggleSidebar}
      aria-label={collapsed ? 'توسيع الشريط الجانبي' : 'طي الشريط الجانبي'}
    >
      {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      <span className={cn(collapsed && 'sr-only')}>{collapsed ? 'توسيع' : 'طي القائمة'}</span>
    </Button>
  );
}

/**
 * Right-side (RTL) navigation mirroring AppTabs groups.
 * Mount inside SidebarProvider. Uses the same isTabAvailable gate.
 */
export default function AppSidebarNav({
  activeTab,
  onTabChange,
  isAdmin,
  tabPermissions,
  maxEmployees,
}: AppSidebarNavProps) {
  const { setOpenMobile, isMobile } = useSidebar();

  const select = (key: string) => {
    onTabChange(key);
    if (isMobile) setOpenMobile(false);
  };

  const { calculators, tools, extras, admin, guide } = useMemo(() => {
    const gate = (items: NavItem[]) =>
      items.filter((t) => isTabAvailable(t.key, isAdmin, tabPermissions));

    const calc = gate(PRIMARY_TABS_TOP);
    if (!isAdmin && maxEmployees > 0) {
      calc.push(MY_EMPLOYEES_TAB);
    }

    return {
      calculators: calc,
      tools: gate(PRIMARY_TABS_BOTTOM),
      extras: gate(SECONDARY_TABS),
      admin: isAdmin ? gate(ADMIN_TABS) : [],
      guide: isTabAvailable(GUIDE_TAB.key, isAdmin, tabPermissions) ? [GUIDE_TAB] : [],
    };
  }, [isAdmin, tabPermissions, maxEmployees]);

  return (
    <Sidebar side="right" collapsible="icon" variant="sidebar" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2 px-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold">
            ط
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-bold text-sidebar-foreground">القائمة</p>
            <p className="truncate text-[10px] text-sidebar-foreground/55">التنقّل بين الأدوات</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        <GroupBlock label="الحاسبات" items={calculators} activeTab={activeTab} onSelect={select} />
        <GroupBlock label="الأدوات" items={tools} activeTab={activeTab} onSelect={select} />
        <GroupBlock label="إضافية" items={extras} activeTab={activeTab} onSelect={select} />
        <GroupBlock label="الإدارة" items={admin} activeTab={activeTab} onSelect={select} />
        <GroupBlock label="المساعدة" items={guide} activeTab={activeTab} onSelect={select} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <CollapseControl />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
