import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Suspense, useState, useCallback, useEffect } from 'react';
import { lazyWithRetry as lazy } from '@/lib/lazyWithRetry';
import { Calculator, UserPen, FileText, Sparkles, Layers, Settings, BookOpen, PenTool, Users, History, HelpCircle, Box, Archive, FileSpreadsheet, Brain, Combine, ShoppingBag } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { TabPermission, SavedQuote } from '@/lib/userApi';
import { usePrintingStore } from '@/store/printingStore';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import TabErrorBoundary from '@/components/TabErrorBoundary';

const PricingCalculator = lazy(() => import('@/components/PricingCalculator'));
const CostCalculator = lazy(() => import('@/components/CostCalculator'));
const SmartEngineCalculator = lazy(() => import('@/components/SmartEngineCalculator'));
const HybridEngineCalculator = lazy(() => import('@/components/HybridEngineCalculator'));
const ItemCostCalculator = lazy(() => import('@/components/ItemCostCalculator'));
const FlatCalculator = lazy(() => import('@/components/FlatCalculator'));
const MontageCalculator = lazy(() => import('@/components/MontageCalculator'));
const TemplateCostCalculator = lazy(() => import('@/components/TemplateCostCalculator'));
const DieCutCalculator = lazy(() => import('@/components/DieCutCalculator'));
const DieCutCalculator2 = lazy(() => import('@/components/DieCutCalculator2'));
const DieCutCalculator3 = lazy(() => import('@/components/DieCutCalculator3'));
const DieCutCalculator4 = lazy(() => import('@/components/DieCutCalculator4'));
const DieCutCalculator5 = lazy(() => import('@/components/DieCutCalculator5'));
const DieCutCalculatorMedicine1 = lazy(() => import('@/components/DieCutCalculatorMedicine1'));
const DieCutCalculator10001 = lazy(() => import('@/components/DieCutCalculator10001'));
const SvgAutoNestingCalculator = lazy(() => import('@/components/SvgAutoNestingCalculator'));
const CarryingHandleBoxCalculator = lazy(() => import('@/components/CarryingHandleBoxCalculator'));
const LidTuckBoxCalculator = lazy(() => import('@/components/LidTuckBoxCalculator'));
const MontagItemCostCalculator = lazy(() => import('@/components/MontagItemCostCalculator'));
const MontagDieCutCalculator10001 = lazy(() => import('@/components/MontagDieCutCalculator10001'));
const MergeItemsCalculator = lazy(() => import('@/components/MergeItemsCalculator'));
const EmployeeInput = lazy(() => import('@/components/EmployeeInput'));
const PriceQuote = lazy(() => import('@/components/PriceQuote'));
const FinishingServices = lazy(() => import('@/components/FinishingServices'));
const PaperTypesManager = lazy(() => import('@/components/PaperTypesManager'));
const PriceSettingsPanel = lazy(() => import('@/components/PriceSettingsPanel'));
const MagazineCalculator = lazy(() => import('@/components/MagazineCalculator'));
const ManualPricing = lazy(() => import('@/components/ManualPricing'));
const BoxPricingCalculator = lazy(() => import('@/components/BoxPricingCalculator'));
const UserManagement = lazy(() => import('@/components/UserManagement'));
const LoginHistory = lazy(() => import('@/components/LoginHistory'));
const UserGuide = lazy(() => import('@/components/UserGuide'));
const EmployeeManagement = lazy(() => import('@/components/EmployeeManagement'));
const SavedQuotes = lazy(() => import('@/components/SavedQuotes'));
const BulkQuoteImport = lazy(() => import('@/components/BulkQuoteImport'));
const PaperSetCalculator = lazy(() => import('@/components/PaperSetCalculator'));
const NewMagazineCalculator = lazy(() => import('@/components/NewMagazineCalculator'));
const MagazinesCalculator = lazy(() => import('@/components/MagazinesCalculator'));
const MagazineSheetCalculator = lazy(() => import('@/components/MagazineSheetCalculator'));
const BagCalculator = lazy(() => import('@/components/BagCalculator'));
// === "علب" group — independent clones of the "قوالب" sub-calculators ===
const BoxDieCutCalculator = lazy(() => import('@/components/boxes/BoxDieCutCalculator'));
const BoxDieCutCalculator2 = lazy(() => import('@/components/boxes/BoxDieCutCalculator2'));
const BoxDieCutCalculator3 = lazy(() => import('@/components/boxes/BoxDieCutCalculator3'));
const BoxDieCutCalculator4 = lazy(() => import('@/components/boxes/BoxDieCutCalculator4'));
const BoxDieCutCalculator5 = lazy(() => import('@/components/boxes/BoxDieCutCalculator5'));
const BoxDieCutCalculatorMedicine1 = lazy(() => import('@/components/boxes/BoxDieCutCalculatorMedicine1'));
const BoxDieCutCalculator10001 = lazy(() => import('@/components/boxes/BoxDieCutCalculator10001'));
const BoxSvgAutoNestingCalculator = lazy(() => import('@/components/boxes/BoxSvgAutoNestingCalculator'));
const BoxCarryingHandleBoxCalculator = lazy(() => import('@/components/boxes/BoxCarryingHandleBoxCalculator'));
const BoxLidTuckBoxCalculator = lazy(() => import('@/components/boxes/BoxLidTuckBoxCalculator'));
const D001Calculator = lazy(() => import('@/components/boxes/D001Calculator'));
const D003Calculator = lazy(() => import('@/components/boxes/D003Calculator'));
const T0001Calculator = lazy(() => import('@/components/boxes/T0001Calculator'));
const T0002Calculator = lazy(() => import('@/components/boxes/T0002Calculator'));
const A01010000Calculator = lazy(() => import('@/components/boxes/A01010000Calculator'));
const A01700000Calculator = lazy(() => import('@/components/boxes/A01700000Calculator'));
const GenericBoxCalculator = lazy(() => import('@/components/boxes/GenericBoxCalculator'));


const TabLoading = () => (
  <div className="space-y-4 p-6 animate-fade-in">
    <Skeleton className="h-8 w-48 rounded-lg" />
    <Skeleton className="h-36 w-full rounded-xl" />
    <Skeleton className="h-36 w-full rounded-xl" />
  </div>
);

interface AppTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isAdmin: boolean;
  currentUser: { username: string; is_admin: boolean };
  currentPassword: string;
  tabPermissions: TabPermission[];
  sessionToken: string;
  maxEmployees: number;
  userId: string;
  employeesCanViewQuotes: boolean;
  onEmployeesViewChange: (enabled: boolean) => void;
  onLoadQuote?: (quote: SavedQuote) => void;
  editingQuoteId?: string | null;
  editingAttachment?: { url: string; name: string } | null;
  onClearEditingQuote?: () => void;
}

// Primary tabs - always visible by default
// Top row: main calculators
const PRIMARY_TABS_TOP = [
  { key: 'hybridengine', label: 'حساب الصنف', shortLabel: '', icon: Combine },
  { key: 'itemcost', label: 'تكلفة صنف', shortLabel: '', icon: Combine },
  { key: 'flat', label: 'مسطح', shortLabel: '', icon: Combine },
  { key: 'templatecost', label: 'تكلفة بقالب', shortLabel: '', icon: Combine },
  { key: 'templates', label: 'قوالب', shortLabel: '', icon: Box },
  { key: 'boxes', label: 'علب', shortLabel: '', icon: Box },
  { key: 'templatemontage', label: 'مونتاج قالب', shortLabel: '', icon: Sparkles },
  { key: 'magazinesheet', label: 'تكلفة مجلة', shortLabel: '', icon: BookOpen },
  { key: 'montage', label: 'مونتاج', shortLabel: '', icon: Combine },
  { key: 'bagcalc', label: 'حساب الأكياس', shortLabel: '', icon: ShoppingBag },
  { key: 'costcalc', label: 'حساب التكلفة', shortLabel: '', icon: Calculator },
  { key: 'smartengine', label: 'المحرك الذكي', shortLabel: '', icon: Brain },
  { key: 'mergeitems', label: 'دمج أصناف', shortLabel: '', icon: Layers },
  { key: 'montag', label: 'MONTAG', shortLabel: '', icon: Combine },
];
// Bottom row: tools / settings
const PRIMARY_TABS_BOTTOM = [
  { key: 'savedquotes', label: 'التكاليف المحفوظة', shortLabel: '', icon: Archive },
  { key: 'settings', label: 'الإعدادات', shortLabel: '', icon: Settings },
  { key: 'papertypes', label: 'الورق', shortLabel: 'أنواع', icon: Layers },
];
const PRIMARY_TABS = [...PRIMARY_TABS_TOP, ...PRIMARY_TABS_BOTTOM];

// Secondary tabs - hidden by default, admin can enable per user
const SECONDARY_TABS = [
  { key: 'calculator', label: 'التسعير', shortLabel: 'حاسبة', icon: Calculator },
  { key: 'paperset', label: 'مجموعة أوراق', shortLabel: '', icon: Layers },
  { key: 'magazines', label: 'المجلات', shortLabel: '', icon: BookOpen },
  { key: 'newmagazine', label: 'المجلة', shortLabel: '', icon: BookOpen },
  { key: 'magazine', label: 'المجلات (قديم)', shortLabel: '', icon: BookOpen },
  { key: 'boxpricing', label: 'العلب والأكياس', shortLabel: '', icon: Box },
  { key: 'manual', label: 'يدوي', shortLabel: '', icon: PenTool },
  { key: 'employee', label: 'الموظف', shortLabel: 'إدخال', icon: UserPen },
  { key: 'quote', label: 'عرض سعر', shortLabel: '', icon: FileText },
  { key: 'finishing', label: 'التشطيبات', shortLabel: '', icon: Sparkles },
  { key: 'bulkimport', label: 'استيراد تسعيرات', shortLabel: '', icon: FileSpreadsheet },
];

const ADMIN_TABS = [
  { key: 'users', label: 'المستخدمين', shortLabel: '', icon: Users },
  { key: 'loginhistory', label: 'السجل', shortLabel: '', icon: History },
];

const GUIDE_TAB = { key: 'guide', label: 'الدليل', shortLabel: '', icon: HelpCircle };

const AppTabs = ({ activeTab, onTabChange, isAdmin, currentUser, currentPassword, tabPermissions, sessionToken, maxEmployees, userId, employeesCanViewQuotes, onEmployeesViewChange, onLoadQuote, editingQuoteId, editingAttachment, onClearEditingQuote }: AppTabsProps) => {
  const { dirtyPaper, dirtyPriceSettings, dirtyFinishing, savePaperTypes, savePriceSettings, saveFinishingItems } = usePrintingStore();
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set([activeTab]));
  const [templateSub, setTemplateSub] = useState<'diecut' | 'diecut2' | 'diecut3' | 'diecut4' | 'diecut5' | 'medicinebox1' | 'box10001' | 'svgnest' | 'carryhandle' | 'lidtuck'>(
    activeTab === 'diecut2' ? 'diecut2'
    : activeTab === 'diecut3' ? 'diecut3'
    : activeTab === 'diecut4' ? 'diecut4'
    : activeTab === 'diecut5' ? 'diecut5'
    : activeTab === 'carryhandle' ? 'carryhandle'
    : activeTab === 'lidtuck' ? 'lidtuck'
    : activeTab === 'medicinebox1' ? 'medicinebox1'
    : activeTab === 'box10001' ? 'box10001'
    : activeTab === 'svgnest' ? 'svgnest'
    : 'diecut'
  );
  const [montagSub, setMontagSub] = useState<'montag_itemcost' | 'montag_box10001'>(
    activeTab === 'montag_box10001' ? 'montag_box10001' : 'montag_itemcost'
  );
  type BoxesSubKey = 'box_diecut' | 'box_diecut2' | 'box_diecut3' | 'box_diecut4' | 'box_diecut5' | 'box_medicinebox1' | 'box_box10001' | 'box_svgnest' | 'box_carryhandle' | 'box_lidtuck' | 'box_d001' | 'box_d003' | 'box_t0001' | 'box_t0002' | 'box_a01010000' | 'box_a01700000' | 'box_generic';
  const [boxesSub, setBoxesSub] = useState<BoxesSubKey>(
    activeTab === 'box_diecut2' ? 'box_diecut2'
    : activeTab === 'box_diecut3' ? 'box_diecut3'
    : activeTab === 'box_diecut4' ? 'box_diecut4'
    : activeTab === 'box_diecut5' ? 'box_diecut5'
    : activeTab === 'box_carryhandle' ? 'box_carryhandle'
    : activeTab === 'box_lidtuck' ? 'box_lidtuck'
    : activeTab === 'box_medicinebox1' ? 'box_medicinebox1'
    : activeTab === 'box_box10001' ? 'box_box10001'
    : activeTab === 'box_svgnest' ? 'box_svgnest'
    : activeTab === 'box_d001' ? 'box_d001'
    : activeTab === 'box_t0001' ? 'box_t0001'
    : activeTab === 'box_t0002' ? 'box_t0002'
    : activeTab === 'box_a01010000' ? 'box_a01010000'
    : activeTab === 'box_a01700000' ? 'box_a01700000'
    : activeTab === 'box_generic' ? 'box_generic'
    : 'box_diecut'
  );

  // Keep visited set in sync so all Die Cut panels stay mounted once opened.
  useEffect(() => {
    if (activeTab === 'templates') {
      setVisitedTabs(prev => prev.has(templateSub) ? prev : new Set(prev).add(templateSub));
    }
    if (activeTab === 'montag') {
      setVisitedTabs(prev => prev.has(montagSub) ? prev : new Set(prev).add(montagSub));
    }
    if (activeTab === 'boxes') {
      setVisitedTabs(prev => prev.has(boxesSub) ? prev : new Set(prev).add(boxesSub));
    }
  }, [activeTab, templateSub, montagSub, boxesSub]);

  useEffect(() => {
    setVisitedTabs(prev => prev.has(activeTab) ? prev : new Set(prev).add(activeTab));
  }, [activeTab]);

  const SETTINGS_TABS = ['papertypes', 'settings', 'finishing'];

  const getDirtyLabel = (tab: string) => {
    if (tab === 'papertypes' && dirtyPaper) return 'أنواع الورق';
    if (tab === 'settings' && dirtyPriceSettings) return 'إعدادات الأسعار';
    if (tab === 'finishing' && dirtyFinishing) return 'التشطيبات';
    return null;
  };

  const handleTabChange = useCallback((newTab: string) => {
    if (SETTINGS_TABS.includes(activeTab)) {
      const dirty = getDirtyLabel(activeTab);
      if (dirty) {
        setPendingTab(newTab);
        return;
      }
    }
    onTabChange(newTab);
  }, [activeTab, dirtyPaper, dirtyPriceSettings, dirtyFinishing, onTabChange]);

  const handleSaveAndSwitch = () => {
    if (activeTab === 'papertypes') savePaperTypes();
    if (activeTab === 'settings') savePriceSettings();
    if (activeTab === 'finishing') saveFinishingItems();
    if (pendingTab) { onTabChange(pendingTab); setPendingTab(null); }
  };

  const handleDiscardAndSwitch = () => {
    if (pendingTab) { onTabChange(pendingTab); setPendingTab(null); }
  };

  // Tabs/flags that default to ENABLED when no explicit permission exists.
  // Anything not listed here defaults to DISABLED so newly-added tabs/features
  // never appear suddenly in active sessions — admin must explicitly enable them.
  const DEFAULT_ON_KEYS = new Set<string>([
    ...PRIMARY_TABS.map(t => t.key),
    'guide',
  ]);

  const isTabEnabled = (tabKey: string) => {
    if (isAdmin) return true;
    const perm = tabPermissions.find(p => p.tab_key === tabKey);
    if (perm) return perm.is_enabled;
    return DEFAULT_ON_KEYS.has(tabKey);
  };

  const visiblePrimaryTopTabs = PRIMARY_TABS_TOP.filter(t => isTabEnabled(t.key));
  const visiblePrimaryBottomTabs = PRIMARY_TABS_BOTTOM.filter(t => isTabEnabled(t.key));
  const visibleSecondaryTabs = SECONDARY_TABS.filter(t => isTabEnabled(t.key));

  const keepAliveClass = (tabKey: string) => activeTab !== tabKey ? 'hidden' : '';
  const shouldRenderTab = (tabKey: string) => activeTab === tabKey || visitedTabs.has(tabKey);
  const renderKeepAlive = (tabKey: string, child: JSX.Element) => {
    // Strict permission gate: never render content for tabs the user is not
    // authorized to view, regardless of activeTab state.
    if (!isTabEnabled(tabKey)) return null;
    return (
      <div
        role="tabpanel"
        data-state={activeTab === tabKey ? 'active' : 'inactive'}
        hidden={activeTab !== tabKey}
        className={`mt-2 ring-offset-background ${keepAliveClass(tabKey)}`}
      >
        {shouldRenderTab(tabKey) ? (
          <TabErrorBoundary tabKey={tabKey}>{child}</TabErrorBoundary>
        ) : null}
      </div>
    );
  };

  const renderTrigger = (tab: typeof PRIMARY_TABS[0]) => (
    <TabsTrigger key={tab.key} value={tab.key} data-tour={`tab-${tab.key}`} className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs md:text-sm rounded-lg px-2.5 sm:px-3 py-2 min-h-[40px] data-[state=active]:shadow-md data-[state=active]:shadow-primary/20">
      <tab.icon className="w-4 h-4 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
      <span className="leading-tight">{tab.label}</span>
    </TabsTrigger>
  );

  return (
    <>
    <AlertDialog open={!!pendingTab} onOpenChange={(open) => { if (!open) setPendingTab(null); }}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>تغييرات غير محفوظة</AlertDialogTitle>
          <AlertDialogDescription>
            لديك تعديلات غير محفوظة في {getDirtyLabel(activeTab)}. هل تريد حفظها قبل المتابعة؟
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex gap-2 sm:flex-row-reverse">
          <AlertDialogAction onClick={handleSaveAndSwitch}>حفظ والمتابعة</AlertDialogAction>
          <AlertDialogCancel onClick={handleDiscardAndSwitch}>متابعة بدون حفظ</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Tabs value={activeTab} onValueChange={handleTabChange} dir="rtl">
      <div className="tabs-scroll mb-4 sm:mb-6 space-y-1.5 sm:space-y-2">
        {/* Primary Top Row - main calculators */}
        <TabsList className="w-full flex-wrap h-auto gap-1 sm:gap-1.5 bg-card/80 backdrop-blur-sm border border-primary/20 p-1.5 sm:p-2 rounded-xl shadow-[0_2px_12px_-2px_hsl(221_83%_53%_/_0.08)]">
          {visiblePrimaryTopTabs.map(renderTrigger)}
          {!isAdmin && maxEmployees > 0 && (
            <TabsTrigger value="myemployees" className="gap-1 sm:gap-1.5 text-[11px] sm:text-xs md:text-sm rounded-lg px-2.5 sm:px-3 py-2 min-h-[40px] data-[state=active]:shadow-md data-[state=active]:shadow-primary/20">
              <Users className="w-4 h-4 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" /> موظفيني
            </TabsTrigger>
          )}
          {isAdmin && ADMIN_TABS.map(renderTrigger)}
        </TabsList>

        {/* Primary Bottom Row - tools & settings */}
        {visiblePrimaryBottomTabs.length > 0 && (
          <TabsList className="w-full flex-wrap h-auto gap-1 sm:gap-1.5 bg-card/80 backdrop-blur-sm border border-primary/15 p-1.5 sm:p-2 rounded-xl shadow-[0_2px_12px_-2px_hsl(221_83%_53%_/_0.06)]">
            {visiblePrimaryBottomTabs.map(renderTrigger)}
          </TabsList>
        )}

        {/* Secondary Row - hidden by default, shown when enabled */}
        {visibleSecondaryTabs.length > 0 && (
          <TabsList className="w-full flex-wrap h-auto gap-1 sm:gap-1.5 bg-card/80 backdrop-blur-sm border border-border/50 p-1.5 sm:p-2 rounded-xl shadow-[0_2px_12px_-2px_hsl(221_83%_53%_/_0.04)]">
            <span className="text-[10px] font-bold text-muted-foreground/70 px-2 py-0.5 bg-muted/60 rounded-md ml-1 select-none">إضافية</span>
            {visibleSecondaryTabs.map(renderTrigger)}
          </TabsList>
        )}
      </div>

      <div className="animate-fade-in-scale">
        <Suspense fallback={<TabLoading />}>
          {renderKeepAlive('calculator', <PricingCalculator onNavigateToQuote={() => onTabChange('quote')} />)}
          {renderKeepAlive('costcalc', <CostCalculator onNavigateToQuote={() => onTabChange('quote')} sessionToken={sessionToken} />)}
          {renderKeepAlive('smartengine', <SmartEngineCalculator onNavigateToQuote={() => onTabChange('quote')} sessionToken={sessionToken} />)}
          {renderKeepAlive('hybridengine', <HybridEngineCalculator onNavigateToQuote={() => onTabChange('quote')} sessionToken={sessionToken} />)}
          {renderKeepAlive('itemcost', <ItemCostCalculator onNavigateToQuote={() => onTabChange('quote')} sessionToken={sessionToken} />)}
          {renderKeepAlive('flat', <FlatCalculator onNavigateToQuote={() => onTabChange('quote')} sessionToken={sessionToken} />)}
          {renderKeepAlive('montage', <MontageCalculator />)}
          {renderKeepAlive('templatecost', <TemplateCostCalculator onNavigateToQuote={() => onTabChange('quote')} sessionToken={sessionToken} />)}
          {(() => {
            if (!isTabEnabled('templates')) return null;
            type Sub = 'diecut' | 'diecut2' | 'diecut3' | 'diecut4' | 'diecut5' | 'medicinebox1' | 'box10001' | 'svgnest' | 'carryhandle' | 'lidtuck';
            const isTemplatesView = activeTab === 'templates' || activeTab === 'diecut' || activeTab === 'diecut2' || activeTab === 'diecut3' || activeTab === 'diecut4' || activeTab === 'diecut5' || activeTab === 'medicinebox1' || activeTab === 'box10001' || activeTab === 'svgnest' || activeTab === 'carryhandle' || activeTab === 'lidtuck';
            const effectiveSub: Sub =
              activeTab === 'diecut2' ? 'diecut2'
              : activeTab === 'diecut3' ? 'diecut3'
              : activeTab === 'diecut4' ? 'diecut4'
              : activeTab === 'diecut5' ? 'diecut5'
              : activeTab === 'carryhandle' ? 'carryhandle'
              : activeTab === 'lidtuck' ? 'lidtuck'
              : activeTab === 'medicinebox1' ? 'medicinebox1'
              : activeTab === 'box10001' ? 'box10001'
              : activeTab === 'svgnest' ? 'svgnest'
              : activeTab === 'diecut' ? 'diecut'
              : (templateSub as Sub);
            const subItems: { key: Sub; label: string }[] = [
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
            ];
            const selectSub = (k: Sub) => {
              setTemplateSub(k);
              onTabChange(k);
            };
            const showDiecut = shouldRenderTab('diecut');
            const showDiecut2 = shouldRenderTab('diecut2');
            const showDiecut3 = shouldRenderTab('diecut3');
            const showDiecut4 = shouldRenderTab('diecut4');
            const showDiecut5 = shouldRenderTab('diecut5');
            const showCarryHandle = shouldRenderTab('carryhandle');
            const showLidTuck = shouldRenderTab('lidtuck');
            const showMedicineBox1 = shouldRenderTab('medicinebox1');
            const showBox10001 = shouldRenderTab('box10001');
            const showSvgNest = shouldRenderTab('svgnest');
            return (
              <div
                role="tabpanel"
                data-state={isTemplatesView ? 'active' : 'inactive'}
                hidden={!isTemplatesView}
                className={`mt-2 ring-offset-background ${isTemplatesView ? '' : 'hidden'}`}
              >
                <div className="mb-3 flex flex-wrap gap-1.5 bg-card/80 backdrop-blur-sm border border-primary/15 p-1.5 rounded-xl">
                  {subItems.map(item => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => selectSub(item.key)}
                      data-state={effectiveSub === item.key ? 'active' : 'inactive'}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=inactive]:hover:bg-muted/60"
                    >
                      <Box className="w-4 h-4 ml-1.5" />
                      {item.label}
                    </button>
                  ))}
                </div>
                <div hidden={effectiveSub !== 'diecut'} className={effectiveSub !== 'diecut' ? 'hidden' : ''}>
                  {showDiecut ? <TabErrorBoundary tabKey="diecut"><DieCutCalculator isAdmin={isAdmin} /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveSub !== 'diecut2'} className={effectiveSub !== 'diecut2' ? 'hidden' : ''}>
                  {showDiecut2 ? <TabErrorBoundary tabKey="diecut2"><DieCutCalculator2 /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveSub !== 'diecut3'} className={effectiveSub !== 'diecut3' ? 'hidden' : ''}>
                  {showDiecut3 ? <TabErrorBoundary tabKey="diecut3"><DieCutCalculator3 /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveSub !== 'diecut4'} className={effectiveSub !== 'diecut4' ? 'hidden' : ''}>
                  {showDiecut4 ? <TabErrorBoundary tabKey="diecut4"><DieCutCalculator4 /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveSub !== 'diecut5'} className={effectiveSub !== 'diecut5' ? 'hidden' : ''}>
                  {showDiecut5 ? <TabErrorBoundary tabKey="diecut5"><DieCutCalculator5 /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveSub !== 'carryhandle'} className={effectiveSub !== 'carryhandle' ? 'hidden' : ''}>
                  {showCarryHandle ? <TabErrorBoundary tabKey="carryhandle"><CarryingHandleBoxCalculator /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveSub !== 'lidtuck'} className={effectiveSub !== 'lidtuck' ? 'hidden' : ''}>
                  {showLidTuck ? <TabErrorBoundary tabKey="lidtuck"><LidTuckBoxCalculator /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveSub !== 'medicinebox1'} className={effectiveSub !== 'medicinebox1' ? 'hidden' : ''}>
                  {showMedicineBox1 ? <TabErrorBoundary tabKey="medicinebox1"><DieCutCalculatorMedicine1 isAdmin={isAdmin} /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveSub !== 'box10001'} className={effectiveSub !== 'box10001' ? 'hidden' : ''}>
                  {showBox10001 ? <TabErrorBoundary tabKey="box10001"><DieCutCalculator10001 isAdmin={isAdmin} /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveSub !== 'svgnest'} className={effectiveSub !== 'svgnest' ? 'hidden' : ''}>
                  {showSvgNest ? <TabErrorBoundary tabKey="svgnest"><SvgAutoNestingCalculator isAdmin={isAdmin} /></TabErrorBoundary> : null}
                </div>
              </div>
            );
          })()}
          {(() => {
            if (!isTabEnabled('boxes')) return null;
            type BSub = BoxesSubKey;
            const isBoxesView = activeTab === 'boxes' || activeTab === 'box_diecut' || activeTab === 'box_diecut2' || activeTab === 'box_diecut3' || activeTab === 'box_diecut4' || activeTab === 'box_diecut5' || activeTab === 'box_medicinebox1' || activeTab === 'box_box10001' || activeTab === 'box_svgnest' || activeTab === 'box_carryhandle' || activeTab === 'box_lidtuck' || activeTab === 'box_d001' || activeTab === 'box_d003' || activeTab === 'box_t0001' || activeTab === 'box_t0002' || activeTab === 'box_a01010000' || activeTab === 'box_a01700000' || activeTab === 'box_generic';
            const effectiveBSub: BSub =
              activeTab === 'box_diecut2' ? 'box_diecut2'
              : activeTab === 'box_diecut3' ? 'box_diecut3'
              : activeTab === 'box_diecut4' ? 'box_diecut4'
              : activeTab === 'box_diecut5' ? 'box_diecut5'
              : activeTab === 'box_carryhandle' ? 'box_carryhandle'
              : activeTab === 'box_lidtuck' ? 'box_lidtuck'
              : activeTab === 'box_medicinebox1' ? 'box_medicinebox1'
              : activeTab === 'box_box10001' ? 'box_box10001'
              : activeTab === 'box_svgnest' ? 'box_svgnest'
              : activeTab === 'box_d001' ? 'box_d001'
              : activeTab === 'box_d003' ? 'box_d003'
              : activeTab === 'box_t0001' ? 'box_t0001'
              : activeTab === 'box_t0002' ? 'box_t0002'
              : activeTab === 'box_a01010000' ? 'box_a01010000'
              : activeTab === 'box_a01700000' ? 'box_a01700000'
              : activeTab === 'box_generic' ? 'box_generic'
              : activeTab === 'box_diecut' ? 'box_diecut'
              : (boxesSub as BSub);
            const bSubItems: { key: BSub; label: string }[] = [
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
              { key: 'box_a01010000', label: 'A01.01' },
              { key: 'box_a01700000', label: 'A01.70' },
              { key: 'box_generic', label: 'Generic' },
            ];
            const selectBSub = (k: BSub) => {
              setBoxesSub(k);
              onTabChange(k);
            };
            const showBDiecut = shouldRenderTab('box_diecut');
            const showBDiecut2 = shouldRenderTab('box_diecut2');
            const showBDiecut3 = shouldRenderTab('box_diecut3');
            const showBDiecut4 = shouldRenderTab('box_diecut4');
            const showBDiecut5 = shouldRenderTab('box_diecut5');
            const showBCarryHandle = shouldRenderTab('box_carryhandle');
            const showBLidTuck = shouldRenderTab('box_lidtuck');
            const showBMedicineBox1 = shouldRenderTab('box_medicinebox1');
            const showBBox10001 = shouldRenderTab('box_box10001');
            const showBSvgNest = shouldRenderTab('box_svgnest');
            const showBD001 = shouldRenderTab('box_d001');
            const showBD003 = shouldRenderTab('box_d003');
            const showBT0001 = shouldRenderTab('box_t0001');
            const showBT0002 = shouldRenderTab('box_t0002');
            const showBA01010000 = shouldRenderTab('box_a01010000');
            const showBA01700000 = shouldRenderTab('box_a01700000');
            const showBGeneric = shouldRenderTab('box_generic');
            return (
              <div
                role="tabpanel"
                data-state={isBoxesView ? 'active' : 'inactive'}
                hidden={!isBoxesView}
                className={`mt-2 ring-offset-background ${isBoxesView ? '' : 'hidden'}`}
              >
                <div className="mb-3 flex flex-wrap gap-1.5 bg-card/80 backdrop-blur-sm border border-primary/15 p-1.5 rounded-xl">
                  {bSubItems.map(item => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => selectBSub(item.key)}
                      data-state={effectiveBSub === item.key ? 'active' : 'inactive'}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=inactive]:hover:bg-muted/60"
                    >
                      <Box className="w-4 h-4 ml-1.5" />
                      {item.label}
                    </button>
                  ))}
                </div>
                <div hidden={effectiveBSub !== 'box_diecut'} className={effectiveBSub !== 'box_diecut' ? 'hidden' : ''}>
                  {showBDiecut ? <TabErrorBoundary tabKey="box_diecut"><BoxDieCutCalculator isAdmin={isAdmin} /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveBSub !== 'box_diecut2'} className={effectiveBSub !== 'box_diecut2' ? 'hidden' : ''}>
                  {showBDiecut2 ? <TabErrorBoundary tabKey="box_diecut2"><BoxDieCutCalculator2 /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveBSub !== 'box_diecut3'} className={effectiveBSub !== 'box_diecut3' ? 'hidden' : ''}>
                  {showBDiecut3 ? <TabErrorBoundary tabKey="box_diecut3"><BoxDieCutCalculator3 /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveBSub !== 'box_diecut4'} className={effectiveBSub !== 'box_diecut4' ? 'hidden' : ''}>
                  {showBDiecut4 ? <TabErrorBoundary tabKey="box_diecut4"><BoxDieCutCalculator4 /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveBSub !== 'box_diecut5'} className={effectiveBSub !== 'box_diecut5' ? 'hidden' : ''}>
                  {showBDiecut5 ? <TabErrorBoundary tabKey="box_diecut5"><BoxDieCutCalculator5 /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveBSub !== 'box_carryhandle'} className={effectiveBSub !== 'box_carryhandle' ? 'hidden' : ''}>
                  {showBCarryHandle ? <TabErrorBoundary tabKey="box_carryhandle"><BoxCarryingHandleBoxCalculator /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveBSub !== 'box_lidtuck'} className={effectiveBSub !== 'box_lidtuck' ? 'hidden' : ''}>
                  {showBLidTuck ? <TabErrorBoundary tabKey="box_lidtuck"><BoxLidTuckBoxCalculator /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveBSub !== 'box_medicinebox1'} className={effectiveBSub !== 'box_medicinebox1' ? 'hidden' : ''}>
                  {showBMedicineBox1 ? <TabErrorBoundary tabKey="box_medicinebox1"><BoxDieCutCalculatorMedicine1 isAdmin={isAdmin} /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveBSub !== 'box_box10001'} className={effectiveBSub !== 'box_box10001' ? 'hidden' : ''}>
                  {showBBox10001 ? <TabErrorBoundary tabKey="box_box10001"><BoxDieCutCalculator10001 isAdmin={isAdmin} /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveBSub !== 'box_svgnest'} className={effectiveBSub !== 'box_svgnest' ? 'hidden' : ''}>
                  {showBSvgNest ? <TabErrorBoundary tabKey="box_svgnest"><BoxSvgAutoNestingCalculator isAdmin={isAdmin} /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveBSub !== 'box_d001'} className={effectiveBSub !== 'box_d001' ? 'hidden' : ''}>
                  {showBD001 ? <TabErrorBoundary tabKey="box_d001"><D001Calculator isAdmin={isAdmin} /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveBSub !== 'box_d003'} className={effectiveBSub !== 'box_d003' ? 'hidden' : ''}>
                  {showBD003 ? <TabErrorBoundary tabKey="box_d003"><D003Calculator isAdmin={isAdmin} /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveBSub !== 'box_t0001'} className={effectiveBSub !== 'box_t0001' ? 'hidden' : ''}>
                  {showBT0001 ? <TabErrorBoundary tabKey="box_t0001"><T0001Calculator isAdmin={isAdmin} /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveBSub !== 'box_t0002'} className={effectiveBSub !== 'box_t0002' ? 'hidden' : ''}>
                  {showBT0002 ? <TabErrorBoundary tabKey="box_t0002"><T0002Calculator isAdmin={isAdmin} /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveBSub !== 'box_a01010000'} className={effectiveBSub !== 'box_a01010000' ? 'hidden' : ''}>
                  {showBA01010000 ? <TabErrorBoundary tabKey="box_a01010000"><A01010000Calculator isAdmin={isAdmin} /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveBSub !== 'box_a01700000'} className={effectiveBSub !== 'box_a01700000' ? 'hidden' : ''}>
                  {showBA01700000 ? <TabErrorBoundary tabKey="box_a01700000"><A01700000Calculator isAdmin={isAdmin} /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveBSub !== 'box_generic'} className={effectiveBSub !== 'box_generic' ? 'hidden' : ''}>
                  {showBGeneric ? <TabErrorBoundary tabKey="box_generic"><GenericBoxCalculator /></TabErrorBoundary> : null}
                </div>
              </div>
            );
          })()}
          {(() => {
            if (!isTabEnabled('montag')) return null;
            type MSub = 'montag_itemcost' | 'montag_box10001';
            const isMontagView = activeTab === 'montag' || activeTab === 'montag_itemcost' || activeTab === 'montag_box10001';
            const effectiveMSub: MSub =
              activeTab === 'montag_box10001' ? 'montag_box10001'
              : activeTab === 'montag_itemcost' ? 'montag_itemcost'
              : (montagSub as MSub);
            const mSubItems: { key: MSub; label: string }[] = [
              { key: 'montag_itemcost', label: 'تكلفة صنف' },
              { key: 'montag_box10001', label: '10001' },
            ];
            const selectMSub = (k: MSub) => {
              setMontagSub(k);
              onTabChange(k);
            };
            const showMItemCost = shouldRenderTab('montag_itemcost');
            const showMBox10001 = shouldRenderTab('montag_box10001');
            return (
              <div
                role="tabpanel"
                data-state={isMontagView ? 'active' : 'inactive'}
                hidden={!isMontagView}
                className={`mt-2 ring-offset-background ${isMontagView ? '' : 'hidden'}`}
              >
                <div className="mb-3 flex flex-wrap gap-1.5 bg-card/80 backdrop-blur-sm border border-primary/15 p-1.5 rounded-xl">
                  {mSubItems.map(item => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => selectMSub(item.key)}
                      data-state={effectiveMSub === item.key ? 'active' : 'inactive'}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=inactive]:hover:bg-muted/60"
                    >
                      <Combine className="w-4 h-4 ml-1.5" />
                      {item.label}
                    </button>
                  ))}
                </div>
                <div hidden={effectiveMSub !== 'montag_itemcost'} className={effectiveMSub !== 'montag_itemcost' ? 'hidden' : ''}>
                  {showMItemCost ? <TabErrorBoundary tabKey="montag_itemcost"><MontagItemCostCalculator onNavigateToQuote={() => onTabChange('quote')} sessionToken={sessionToken} /></TabErrorBoundary> : null}
                </div>
                <div hidden={effectiveMSub !== 'montag_box10001'} className={effectiveMSub !== 'montag_box10001' ? 'hidden' : ''}>
                  {showMBox10001 ? <TabErrorBoundary tabKey="montag_box10001"><MontagDieCutCalculator10001 isAdmin={isAdmin} /></TabErrorBoundary> : null}
                </div>
              </div>
            );
          })()}
          {renderKeepAlive('templatemontage', <TemplateCostCalculator onNavigateToQuote={() => onTabChange('quote')} sessionToken={sessionToken} engineVariant="advanced" />)}
          {renderKeepAlive('mergeitems', <MergeItemsCalculator onNavigateToQuote={() => onTabChange('quote')} sessionToken={sessionToken} />)}
          {renderKeepAlive('employee', <EmployeeInput onNavigateToQuote={() => onTabChange('quote')} />)}
          {renderKeepAlive('quote', <PriceQuote sessionToken={sessionToken} editingQuoteId={editingQuoteId} onClearEditingQuote={onClearEditingQuote} existingAttachment={editingAttachment} />)}
          {renderKeepAlive('finishing', <FinishingServices />)}
          {renderKeepAlive('papertypes', <PaperTypesManager />)}
          {renderKeepAlive('settings', <PriceSettingsPanel />)}
          {renderKeepAlive('magazine', <MagazineCalculator onNavigateToQuote={() => onTabChange('quote')} />)}
          {renderKeepAlive('manual', <ManualPricing onNavigateToQuote={() => onTabChange('quote')} />)}
          {renderKeepAlive('paperset', <PaperSetCalculator onNavigateToQuote={() => onTabChange('quote')} sessionToken={sessionToken} />)}
          {renderKeepAlive('newmagazine', <NewMagazineCalculator onNavigateToQuote={() => onTabChange('quote')} sessionToken={sessionToken} />)}
          {renderKeepAlive('magazines', <MagazinesCalculator onNavigateToQuote={() => onTabChange('quote')} sessionToken={sessionToken} />)}
          {renderKeepAlive('magazinesheet', <MagazineSheetCalculator onNavigateToQuote={() => onTabChange('quote')} sessionToken={sessionToken} />)}
          {renderKeepAlive('bagcalc', <BagCalculator onNavigateToQuote={() => onTabChange('quote')} sessionToken={sessionToken} />)}
          {renderKeepAlive('boxpricing', <BoxPricingCalculator onNavigateToQuote={() => onTabChange('quote')} />)}
          {isAdmin && (
            <div role="tabpanel" data-state={activeTab === 'users' ? 'active' : 'inactive'} hidden={activeTab !== 'users'} className={`mt-2 ring-offset-background ${keepAliveClass('users')}`}>
              <UserManagement currentUser={currentUser} currentPassword={currentPassword} />
            </div>
          )}
          {isAdmin && (
            <div role="tabpanel" data-state={activeTab === 'loginhistory' ? 'active' : 'inactive'} hidden={activeTab !== 'loginhistory'} className={`mt-2 ring-offset-background ${keepAliveClass('loginhistory')}`}><LoginHistory currentUser={currentUser} currentPassword={currentPassword} /></div>
          )}
          {!isAdmin && maxEmployees > 0 && (
            <div role="tabpanel" data-state={activeTab === 'myemployees' ? 'active' : 'inactive'} hidden={activeTab !== 'myemployees'} className={`mt-2 ring-offset-background ${keepAliveClass('myemployees')}`}>
              <EmployeeManagement sessionToken={sessionToken} maxEmployees={maxEmployees} parentTabPermissions={tabPermissions} userId={userId} />
            </div>
          )}
          {isTabEnabled('savedquotes') && (
            <div role="tabpanel" data-state={activeTab === 'savedquotes' ? 'active' : 'inactive'} hidden={activeTab !== 'savedquotes'} className={`mt-2 ring-offset-background ${keepAliveClass('savedquotes')}`}>
              <SavedQuotes
                sessionToken={sessionToken}
                userId={userId}
                isEmployee={!isAdmin && !!currentUser && !currentUser.is_admin && maxEmployees === 0}
                employeesCanViewQuotes={employeesCanViewQuotes}
                onEmployeesViewChange={onEmployeesViewChange}
                onLoadQuote={onLoadQuote}
                canExport={isAdmin || isTabEnabled('export_quotes')}
                showEmployeesView={isAdmin || isTabEnabled('sq_show_employees_view')}
                showTransfer={isAdmin || isTabEnabled('sq_show_transfer')}
                showImport={isAdmin || isTabEnabled('sq_show_import')}
                showExport={isAdmin || isTabEnabled('sq_show_export')}
                showRowActions={isAdmin || isTabEnabled('sq_show_actions')}
              />
            </div>
          )}
          {isTabEnabled('bulkimport') && (
            <div role="tabpanel" data-state={activeTab === 'bulkimport' ? 'active' : 'inactive'} hidden={activeTab !== 'bulkimport'} className={`mt-2 ring-offset-background ${keepAliveClass('bulkimport')}`}>
              <BulkQuoteImport sessionToken={sessionToken} onComplete={() => onTabChange('savedquotes')} />
            </div>
          )}
          {isTabEnabled('guide') && (
            <div role="tabpanel" data-state={activeTab === 'guide' ? 'active' : 'inactive'} hidden={activeTab !== 'guide'} className={`mt-2 ring-offset-background ${keepAliveClass('guide')}`}><UserGuide /></div>
          )}
        </Suspense>
      </div>
    </Tabs>
    </>
  );
};

export default AppTabs;
