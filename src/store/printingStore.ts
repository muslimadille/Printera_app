import { create } from 'zustand';
import { finite, num, safeDiv, sheetsPerPurchase } from '@/lib/safeNumber';

export type PricingUnit = 'ton' | 'ream';

export interface PaperEntry {
  grammage: number;
  sizeName: string;
  width: number;
  height: number;
  pricePerTon: number;
  pricingUnit?: PricingUnit;
  pricePerReam?: number;
  sheetsPerReam?: number;
}

export interface PaperType {
  name: string;
  entries: PaperEntry[];
}

export interface ColorPricing {
  sortPerFace: number;
  printFirst1000PerFace: number;
  printExtra1000PerFace: number;
}

export interface SizeCustomField {
  id: string;
  name: string;
  calcType: 'per_piece' | 'per_1000' | 'tiered_1000' | 'flat';
  multiplier: number;
  pricePerUnit: number;
  extraPer1000: number;
}

export interface SizePricing {
  sizeName: string;
  width: number;
  height: number;
  color1: ColorPricing;
  color2: ColorPricing;
  color3: ColorPricing;
  color4: ColorPricing;
  diecut1st1000: number;
  diecutExtra1000: number;
  cellophanePerFace: number;
  hiddenFields?: string[];
  customFields?: SizeCustomField[];
  // Legacy fields for backward compat
  sortSingleFace?: number;
  printFirst1000PerFace?: number;
  printExtra1000PerFace?: number;
}

export interface PriceSettings {
  sizes: SizePricing[];
}

export interface FinishingItem {
  name: string;
  enabled: boolean;
  calcType: 'per_piece' | 'per_1000' | 'tiered_1000' | 'flat';
  multiplier: number;
  pricePerUnit: number;
  extraPer1000: number;
  notes: string;
}

export interface ExtraColorConfig {
  extraColorCalcType: 'per_1000' | 'tiered_1000';
  extraColorPrice: number;
  extraColorExtra1000: number;
  extraColorCount: number;
}

export interface CalculatorInputs extends ExtraColorConfig {
  paperType: string;
  purchaseSize: string;
  grammage: number | null;
  printWidth: number;
  printHeight: number;
  quantity: number;
  cutsPerSheet: number;
  wastePercent: number;
  colorCount: number; // 0=no printing, 1-4, 5=more than 4
  printedFaces: number;
  facesDifferent: boolean;
  cellophaneFaces: number;
  dieCut: boolean;
  moldPrice: number;
  wasteInCosts: boolean;
}

export interface MagazineSectionInputs extends ExtraColorConfig {
  paperType: string;
  purchaseSize: string;
  grammage: number | null;
  printWidth: number;
  printHeight: number;
  wastePercent: number;
  colorCount: number;
  printedFaces: number;
  facesDifferent: boolean;
  cellophaneFaces: number;
  dieCut: boolean;
  moldPrice: number;
}

export interface MagazineFinishingItem {
  name: string;
  enabled: boolean;
  calcType: 'per_piece' | 'per_1000' | 'tiered_1000' | 'flat';
  multiplier: number;
  pricePerUnit: number;
  extraPer1000: number;
}

export interface MagazineInputs {
  quantity: number;
  totalPages: number;
  pagesPerSheet: number;
  cutsPerSheetInner: number;
  cutsPerSheetCover: number;
  assemblyCostPer1000: number;
  inner: MagazineSectionInputs;
  cover: MagazineSectionInputs;
  innerFinishing: MagazineFinishingItem[];
  coverFinishing: MagazineFinishingItem[];
}

export interface QuoteInfo {
  customerName: string;
  quoteNumber: string;
  itemName: string;
  itemNumber: string;
  itemSize: string;
  montageUrl: string;
}

export interface UnifiedQuoteData {
  sourceType: 'calculator' | 'employee' | 'magazine' | 'boxpricing' | 'manual';
  sourceLabel: string;
  quantity: number;
  details: { label: string; value: string }[];
  costBreakdown: { label: string; value: number }[];
  totalCost: number;
  totalFinishing: number;
  grandTotal: number;
  pricePerPiece: number;
  pieceLabel: string;
}

interface PrintingStore {
  currentUsername: string;
  paperTypes: PaperType[];
  priceSettings: PriceSettings;
  inputs: CalculatorInputs;
  finishingItems: FinishingItem[];
  profitMargins: number[];
  quoteInfo: QuoteInfo;
  unifiedQuote: UnifiedQuoteData | null;
  magazineInputs: MagazineInputs;
  dirtyPaper: boolean;
  dirtyPriceSettings: boolean;
  dirtyFinishing: boolean;
  editingQuoteData: Record<string, any> | null;
  setCurrentUsername: (username: string) => void;
  setPaperTypes: (types: PaperType[]) => void;
  addPaperType: (type: PaperType) => void;
  updatePaperType: (index: number, type: PaperType) => void;
  removePaperType: (index: number) => void;
  setPriceSettings: (settings: Partial<PriceSettings>) => void;
  updateSizePricing: (index: number, size: Partial<SizePricing>) => void;
  addSizePricing: (size: SizePricing) => void;
  removeSizePricing: (index: number) => void;
  setInputs: (inputs: Partial<CalculatorInputs>) => void;
  setFinishingItems: (items: FinishingItem[]) => void;
  updateFinishingItem: (index: number, item: Partial<FinishingItem>) => void;
  addFinishingItem: (item: FinishingItem) => void;
  setProfitMargins: (margins: number[]) => void;
  removeFinishingItem: (index: number) => void;
  setQuoteInfo: (info: Partial<QuoteInfo>) => void;
  setUnifiedQuote: (quote: UnifiedQuoteData | null) => void;
  setMagazineInputs: (inputs: Partial<MagazineInputs>) => void;
  setMagazineSection: (section: 'inner' | 'cover', inputs: Partial<MagazineSectionInputs>) => void;
  setMagazineFinishing: (section: 'inner' | 'cover', items: MagazineFinishingItem[]) => void;
  updateMagazineFinishingItem: (section: 'inner' | 'cover', index: number, item: Partial<MagazineFinishingItem>) => void;
  addMagazineFinishingItem: (section: 'inner' | 'cover', item: MagazineFinishingItem) => void;
  removeMagazineFinishingItem: (section: 'inner' | 'cover', index: number) => void;
  savePaperTypes: () => void;
  savePriceSettings: () => void;
  saveFinishingItems: () => void;
  loadSavedData: () => void;
  loadCloudSettings: (settings: Record<string, any>) => void;
  setEditingQuoteData: (data: Record<string, any> | null) => void;
}

const defaultPaperTypes: PaperType[] = [
  {
    name: 'كوشيه',
    entries: [
      { grammage: 300, sizeName: '70×100', width: 70, height: 100, pricePerTon: 4000 },
      { grammage: 300, sizeName: '50×70', width: 50, height: 70, pricePerTon: 4000 },
    ],
  },
  {
    name: 'كرافت',
    entries: [
      { grammage: 300, sizeName: '70×100', width: 70, height: 100, pricePerTon: 3800 },
      { grammage: 300, sizeName: '50×70', width: 50, height: 70, pricePerTon: 3800 },
    ],
  },
  {
    name: 'ايفوري',
    entries: [
      { grammage: 250, sizeName: '70×100', width: 70, height: 100, pricePerTon: 4200 },
      { grammage: 250, sizeName: '50×70', width: 50, height: 70, pricePerTon: 4200 },
    ],
  },
];

const defaultColorPricing: ColorPricing = { sortPerFace: 0, printFirst1000PerFace: 0, printExtra1000PerFace: 0 };

const defaultPriceSettings: PriceSettings = {
  sizes: [
    {
      sizeName: '70×100',
      width: 70,
      height: 100,
      color1: { sortPerFace: 200, printFirst1000PerFace: 600, printExtra1000PerFace: 100 },
      color2: { sortPerFace: 250, printFirst1000PerFace: 700, printExtra1000PerFace: 120 },
      color3: { sortPerFace: 300, printFirst1000PerFace: 800, printExtra1000PerFace: 140 },
      color4: { sortPerFace: 350, printFirst1000PerFace: 900, printExtra1000PerFace: 160 },
      diecut1st1000: 400,
      diecutExtra1000: 100,
      cellophanePerFace: 0.55,
    },
    {
      sizeName: '50×70',
      width: 50,
      height: 70,
      color1: { sortPerFace: 100, printFirst1000PerFace: 400, printExtra1000PerFace: 50 },
      color2: { sortPerFace: 120, printFirst1000PerFace: 450, printExtra1000PerFace: 60 },
      color3: { sortPerFace: 140, printFirst1000PerFace: 500, printExtra1000PerFace: 70 },
      color4: { sortPerFace: 160, printFirst1000PerFace: 550, printExtra1000PerFace: 80 },
      diecut1st1000: 150,
      diecutExtra1000: 50,
      cellophanePerFace: 0.30,
    },
  ],
};

const defaultFinishingItems: FinishingItem[] = [
  { name: 'ورنيش', enabled: false, calcType: 'per_piece', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'وتر بيز', enabled: false, calcType: 'per_piece', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'يوفي', enabled: false, calcType: 'per_piece', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'بصمة', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'فويل', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'تخريم', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'نافذة', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'تجليد', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'خدمة إضافية 1', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'خدمة إضافية 2', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
  { name: 'خدمة إضافية 3', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0, notes: '' },
];

const defaultSectionInputs: MagazineSectionInputs = {
  paperType: '', purchaseSize: '', grammage: null,
  printWidth: 50, printHeight: 70, wastePercent: 0,
  colorCount: 4, printedFaces: 1, facesDifferent: false, cellophaneFaces: 0,
  dieCut: false, moldPrice: 0,
  extraColorCalcType: 'per_1000', extraColorPrice: 0, extraColorExtra1000: 0, extraColorCount: 1,
};

const defaultMagFinishing: MagazineFinishingItem[] = [
  { name: 'ورنيش', enabled: false, calcType: 'per_piece', multiplier: 1, pricePerUnit: 0, extraPer1000: 0 },
  { name: 'وتر بيز', enabled: false, calcType: 'per_piece', multiplier: 1, pricePerUnit: 0, extraPer1000: 0 },
  { name: 'يوفي', enabled: false, calcType: 'per_piece', multiplier: 1, pricePerUnit: 0, extraPer1000: 0 },
  { name: 'خدمة إضافية', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 0, extraPer1000: 0 },
];

const defaultMagazineInputs: MagazineInputs = {
  quantity: 1000, totalPages: 16, pagesPerSheet: 4,
  cutsPerSheetInner: 1, cutsPerSheetCover: 1, assemblyCostPer1000: 0,
  inner: { ...defaultSectionInputs },
  cover: { ...defaultSectionInputs },
  innerFinishing: defaultMagFinishing.map(f => ({ ...f, name: f.name + ' داخلي' })),
  coverFinishing: [
    { name: 'ورنيش غلاف', enabled: false, calcType: 'per_piece', multiplier: 1, pricePerUnit: 0, extraPer1000: 0 },
    { name: 'يوفي غلاف', enabled: false, calcType: 'per_piece', multiplier: 1, pricePerUnit: 0, extraPer1000: 0 },
    { name: 'فويل غلاف', enabled: false, calcType: 'per_piece', multiplier: 1, pricePerUnit: 0, extraPer1000: 0 },
    { name: 'بصمة غلاف', enabled: false, calcType: 'per_piece', multiplier: 1, pricePerUnit: 0, extraPer1000: 0 },
  ],
};

const loadFromStorage = <T>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch { return fallback; }
};

const hasChanges = <T extends Record<string, any>>(current: T, updates: Partial<T>) =>
  Object.entries(updates).some(([key, value]) => !Object.is(current[key as keyof T], value));

export const usePrintingStore = create<PrintingStore>((set, get) => ({
  currentUsername: '',
  paperTypes: loadFromStorage('printCalc_paperTypes', defaultPaperTypes),
  priceSettings: loadFromStorage('printCalc_priceSettings', defaultPriceSettings),
  inputs: loadFromStorage('printCalc_draft_inputs', {
    paperType: '', purchaseSize: '', grammage: null,
    printWidth: 50, printHeight: 70, quantity: 1000, cutsPerSheet: 1,
    wastePercent: 0, colorCount: 4, printedFaces: 1, facesDifferent: false,
    cellophaneFaces: 0, dieCut: false, moldPrice: 0, wasteInCosts: true,
    extraColorCalcType: 'per_1000', extraColorPrice: 0, extraColorExtra1000: 0, extraColorCount: 1,
  }),
  finishingItems: defaultFinishingItems,
  profitMargins: [10, 15, 20],
  quoteInfo: loadFromStorage('printCalc_draft_quoteInfo', { customerName: '', quoteNumber: '', itemName: '', itemNumber: '', itemSize: '', montageUrl: '' }),
  unifiedQuote: null,
  magazineInputs: loadFromStorage('printCalc_draft_magazineInputs', defaultMagazineInputs),
  dirtyPaper: false,
  dirtyPriceSettings: false,
  dirtyFinishing: false,
  editingQuoteData: null,
  setEditingQuoteData: (data) => set({ editingQuoteData: data }),
  setCurrentUsername: (username) => {
    set({ currentUsername: username });
    // Load user-specific data
    const prefix = `printCalc_${username}_`;
    set({
      paperTypes: loadFromStorage(prefix + 'paperTypes', loadFromStorage('printCalc_paperTypes', defaultPaperTypes)),
      priceSettings: loadFromStorage(prefix + 'priceSettings', loadFromStorage('printCalc_priceSettings', defaultPriceSettings)),
      finishingItems: loadFromStorage(prefix + 'finishingItems', defaultFinishingItems),
    });
  },
  setPaperTypes: (types) => set({ paperTypes: types, dirtyPaper: true }),
  addPaperType: (type) => set((s) => ({ paperTypes: [...s.paperTypes, type], dirtyPaper: true })),
  updatePaperType: (index, type) =>
    set((s) => ({ paperTypes: s.paperTypes.map((t, i) => (i === index ? type : t)), dirtyPaper: true })),
  removePaperType: (index) =>
    set((s) => ({ paperTypes: s.paperTypes.filter((_, i) => i !== index), dirtyPaper: true })),
  setPriceSettings: (settings) =>
    set((s) => ({ priceSettings: { ...s.priceSettings, ...settings }, dirtyPriceSettings: true })),
  updateSizePricing: (index, updates) =>
    set((s) => ({
      priceSettings: {
        ...s.priceSettings,
        sizes: s.priceSettings.sizes.map((sz, i) => (i === index ? { ...sz, ...updates } : sz)),
      },
      dirtyPriceSettings: true,
    })),
  addSizePricing: (size) =>
    set((s) => ({
      priceSettings: { ...s.priceSettings, sizes: [...s.priceSettings.sizes, size] },
      dirtyPriceSettings: true,
    })),
  removeSizePricing: (index) =>
    set((s) => ({
      priceSettings: {
        ...s.priceSettings,
        sizes: s.priceSettings.sizes.filter((_, i) => i !== index),
      },
      dirtyPriceSettings: true,
    })),
  setInputs: (inputs) => set((s) => {
    if (!hasChanges(s.inputs, inputs)) return s;
    const next = { ...s.inputs, ...inputs };
    try { localStorage.setItem('printCalc_draft_inputs', JSON.stringify(next)); } catch {}
    return { inputs: next };
  }),
  setFinishingItems: (items) => set({ finishingItems: items, dirtyFinishing: true }),
  updateFinishingItem: (index, item) =>
    set((s) => ({
      finishingItems: s.finishingItems.map((f, i) => (i === index ? { ...f, ...item } : f)),
      dirtyFinishing: true,
    })),
  addFinishingItem: (item) =>
    set((s) => ({ finishingItems: [...s.finishingItems, item], dirtyFinishing: true })),
  removeFinishingItem: (index) =>
    set((s) => ({ finishingItems: s.finishingItems.filter((_, i) => i !== index), dirtyFinishing: true })),
  setQuoteInfo: (info) => set((s) => {
    const next = { ...s.quoteInfo, ...info };
    try { localStorage.setItem('printCalc_draft_quoteInfo', JSON.stringify(next)); } catch {}
    return { quoteInfo: next };
  }),
  setUnifiedQuote: (quote) => set({ unifiedQuote: quote }),
  setProfitMargins: (margins) => set({ profitMargins: margins }),
  setMagazineInputs: (inputs) =>
    set((s) => {
      const next = { ...s.magazineInputs, ...inputs };
      try { localStorage.setItem('printCalc_draft_magazineInputs', JSON.stringify(next)); } catch {}
      return { magazineInputs: next };
    }),
  setMagazineSection: (section, inputs) =>
    set((s) => ({
      magazineInputs: {
        ...s.magazineInputs,
        [section]: { ...s.magazineInputs[section], ...inputs },
      },
    })),
  setMagazineFinishing: (section, items) =>
    set((s) => ({
      magazineInputs: {
        ...s.magazineInputs,
        [section === 'inner' ? 'innerFinishing' : 'coverFinishing']: items,
      },
    })),
  updateMagazineFinishingItem: (section, index, item) =>
    set((s) => {
      const key = section === 'inner' ? 'innerFinishing' : 'coverFinishing';
      return {
        magazineInputs: {
          ...s.magazineInputs,
          [key]: s.magazineInputs[key].map((f, i) => (i === index ? { ...f, ...item } : f)),
        },
      };
    }),
  addMagazineFinishingItem: (section, item) =>
    set((s) => {
      const key = section === 'inner' ? 'innerFinishing' : 'coverFinishing';
      return {
        magazineInputs: {
          ...s.magazineInputs,
          [key]: [...s.magazineInputs[key], item],
        },
      };
    }),
  removeMagazineFinishingItem: (section, index) =>
    set((s) => {
      const key = section === 'inner' ? 'innerFinishing' : 'coverFinishing';
      return {
        magazineInputs: {
          ...s.magazineInputs,
          [key]: s.magazineInputs[key].filter((_, i) => i !== index),
        },
      };
    }),
  savePaperTypes: () => {
    const { paperTypes, currentUsername } = get();
    const prefix = currentUsername ? `printCalc_${currentUsername}_` : 'printCalc_';
    localStorage.setItem(prefix + 'paperTypes', JSON.stringify(paperTypes));
    localStorage.setItem('printCalc_paperTypes', JSON.stringify(paperTypes));
    set({ dirtyPaper: false });
    import('@/lib/activityTracker').then(m => m.trackActivity('settings_change', 'papertypes'));
  },
  savePriceSettings: () => {
    const { priceSettings, currentUsername } = get();
    const prefix = currentUsername ? `printCalc_${currentUsername}_` : 'printCalc_';
    localStorage.setItem(prefix + 'priceSettings', JSON.stringify(priceSettings));
    localStorage.setItem('printCalc_priceSettings', JSON.stringify(priceSettings));
    set({ dirtyPriceSettings: false });
    import('@/lib/activityTracker').then(m => m.trackActivity('settings_change', 'settings'));
  },
  saveFinishingItems: () => {
    const { finishingItems, currentUsername } = get();
    const prefix = currentUsername ? `printCalc_${currentUsername}_` : 'printCalc_';
    localStorage.setItem(prefix + 'finishingItems', JSON.stringify(finishingItems));
    set({ dirtyFinishing: false });
    import('@/lib/activityTracker').then(m => m.trackActivity('settings_change', 'finishing'));
  },
  loadSavedData: () => {
    const { currentUsername } = get();
    const prefix = currentUsername ? `printCalc_${currentUsername}_` : 'printCalc_';
    set({
      paperTypes: loadFromStorage(prefix + 'paperTypes', loadFromStorage('printCalc_paperTypes', defaultPaperTypes)),
      priceSettings: loadFromStorage(prefix + 'priceSettings', loadFromStorage('printCalc_priceSettings', defaultPriceSettings)),
      finishingItems: loadFromStorage(prefix + 'finishingItems', defaultFinishingItems),
    });
  },
  loadCloudSettings: (settings: Record<string, any>) => {
    const updates: Partial<PrintingStore> = {};
    if (settings.paperTypes) updates.paperTypes = settings.paperTypes;
    if (settings.priceSettings) updates.priceSettings = settings.priceSettings;
    if (settings.finishingItems) updates.finishingItems = settings.finishingItems;
    if (settings.profitMargins) updates.profitMargins = settings.profitMargins;
    if (Object.keys(updates).length > 0) set(updates as any);
  },
}));

// Helper: migrate legacy SizePricing that has old fields
function migrateSizePricing(s: any): SizePricing {
  if (s.color1) return s; // already migrated
  const defaultCP: ColorPricing = { sortPerFace: 0, printFirst1000PerFace: 0, printExtra1000PerFace: 0 };
  return {
    ...s,
    color1: { sortPerFace: s.sortSingleFace || 0, printFirst1000PerFace: s.printFirst1000PerFace || 0, printExtra1000PerFace: s.printExtra1000PerFace || 0 },
    color2: { ...defaultCP },
    color3: { ...defaultCP },
    color4: { ...defaultCP },
  };
}

// Helper: get color pricing for a given color count
export function getColorPricing(size: SizePricing, colorCount: number): ColorPricing | null {
  const migrated = migrateSizePricing(size);
  if (colorCount === 0) return null; // no printing
  if (colorCount === 1) return migrated.color1;
  if (colorCount === 2) return migrated.color2;
  if (colorCount === 3) return migrated.color3;
  return migrated.color4;
}

// Helper: find matching size pricing by print dimensions
function findSizePricing(sizes: SizePricing[], pw: number, ph: number): SizePricing | undefined {
  return sizes.find(
    (s) =>
      (s.width === pw && s.height === ph) ||
      (s.width === ph && s.height === pw)
  );
}

// Helper: calculate extra color cost based on calc type
export function calcExtraColorCost(
  config: ExtraColorConfig,
  quantity: number,
  thousands: number,
): number {
  const { extraColorCalcType, extraColorPrice, extraColorExtra1000, extraColorCount } = config;
  if (!extraColorPrice || !extraColorCount) return 0;
  let costPerColor = 0;
  switch (extraColorCalcType) {
    case 'per_1000': costPerColor = thousands * extraColorPrice; break;
    case 'tiered_1000': costPerColor = extraColorPrice + Math.max(0, thousands - 1) * extraColorExtra1000; break;
    default: costPerColor = 0;
  }
  return costPerColor * extraColorCount;
}

// Calculation engine - replicates all Excel formulas
export function useCalculations() {
  const { paperTypes, priceSettings, inputs, finishingItems } = usePrintingStore();

  // Find the selected paper entry
  const selectedType = paperTypes.find((t) => t.name === inputs.paperType);
  const selectedEntry = selectedType?.entries.find(
    (e) => e.sizeName === inputs.purchaseSize && e.grammage === inputs.grammage
  );

  // Purchase paper dimensions
  const purchaseWidth = selectedEntry?.width || 0;
  const purchaseHeight = selectedEntry?.height || 0;
  const pricePerTon = selectedEntry?.pricePerTon || 0;

  // Available grammages for selected paper type
  const availableGrammages = selectedType
    ? [...new Set(selectedType.entries.map((e) => e.grammage))]
    : [];

  // Available sizes for selected paper type + grammage
  const availableSizes = selectedType
    ? [...new Set(selectedType.entries
        .filter((e) => inputs.grammage === null || e.grammage === inputs.grammage)
        .map((e) => e.sizeName))]
    : [];

  // G5: Purchase sheet area (m²)
  const purchaseArea = (purchaseWidth / 100) * (purchaseHeight / 100);

  // G6: Purchase sheet weight (grams)
  const purchaseWeight = purchaseArea * (inputs.grammage || 0);

  // Pricing unit handling
  const pricingUnit = selectedEntry?.pricingUnit || 'ton';
  const pricePerReam = selectedEntry?.pricePerReam || 0;
  const sheetsPerReam = selectedEntry?.sheetsPerReam || 500;

  // G7: Price per gram (for ton pricing)
  const pricePerGram = safeDiv(pricePerTon, 1_000_000);

  // G8: Price per purchase sheet
  const pricePerSheet = pricingUnit === 'ream' && sheetsPerReam > 0
    ? safeDiv(pricePerReam, sheetsPerReam)
    : finite(purchaseWeight * pricePerGram);

  // G9: Print sheets from one purchase sheet
  const pw = num(inputs.printWidth);
  const ph = num(inputs.printHeight);
  const printSheetsPerPurchase = sheetsPerPurchase(purchaseWidth, purchaseHeight, pw, ph);

  // G10: Print sheets needed before waste
  const qty = num(inputs.quantity);
  const cuts = num(inputs.cutsPerSheet);
  const printSheetsBeforeWaste =
    qty <= 0 || cuts <= 0
      ? 0
      : Math.ceil(safeDiv(qty, cuts));

  // G11: Print sheets after waste
  const printSheetsAfterWaste = Math.ceil(
    printSheetsBeforeWaste * (1 + num(inputs.wastePercent) / 100)
  );

  // G12: Purchase sheets needed
  const purchaseSheetsNeeded =
    printSheetsPerPurchase === 0 ? 0 : Math.ceil(safeDiv(printSheetsAfterWaste, printSheetsPerPurchase));

  // G13: Paper cost
  const paperCost = finite(pricePerSheet * purchaseSheetsNeeded);

  // Find matching size pricing dynamically
  const matchedSize = findSizePricing(priceSettings.sizes, pw, ph);
  const printSizeType = matchedSize ? matchedSize.sizeName : 'مقاس غير معتمد';

  // G15: Thousands of prints
  const thousands = Math.max(1, Math.ceil(printSheetsAfterWaste / 1000));

  // G16: Sort cost - for colorCount 5 (more than 4), use color4 pricing
  const effectiveColorCount = inputs.colorCount >= 5 ? 4 : inputs.colorCount;
  let sortCost = 0;
  if (matchedSize && effectiveColorCount > 0) {
    const cp = getColorPricing(matchedSize, effectiveColorCount);
    if (cp) {
      if (inputs.printedFaces === 1) {
        sortCost = cp.sortPerFace;
      } else if (inputs.printedFaces === 2 && inputs.facesDifferent) {
        sortCost = cp.sortPerFace * 2;
      } else {
        sortCost = cp.sortPerFace;
      }
    }
  }

  // G17: Print cost
  let printCost = 0;
  if (matchedSize && effectiveColorCount > 0) {
    const cp = getColorPricing(matchedSize, effectiveColorCount);
    if (cp) {
      printCost =
        inputs.printedFaces *
        (cp.printFirst1000PerFace +
          Math.max(0, thousands - 1) * cp.printExtra1000PerFace);
    }
  }

  // Extra color cost (when more than 4 colors)
  let extraColorCost = 0;
  if (inputs.colorCount >= 5 && inputs.extraColorPrice > 0) {
    extraColorCost = calcExtraColorCost(inputs, inputs.quantity, thousands);
  }

  // G18: Cellophane cost
  const isFieldHidden = (field: string) => matchedSize?.hiddenFields?.includes(field) ?? false;
  let cellophaneCost = 0;
  if (matchedSize && !isFieldHidden('cellophane')) {
    cellophaneCost = printSheetsAfterWaste * inputs.cellophaneFaces * matchedSize.cellophanePerFace;
  }

  // G19: Die cut cost
  let dieCutCost = 0;
  if (inputs.dieCut && matchedSize && !isFieldHidden('diecut')) {
    dieCutCost =
      matchedSize.diecut1st1000 +
      Math.max(0, thousands - 1) * matchedSize.diecutExtra1000;
  }

  // Custom fields cost
  let customFieldsCost = 0;
  if (matchedSize?.customFields) {
    for (const f of matchedSize.customFields) {
      const m = f.multiplier || 1;
      const p = f.pricePerUnit || 0;
      if (p <= 0) continue;
      switch (f.calcType) {
        case 'per_piece': customFieldsCost += inputs.quantity * m * p; break;
        case 'per_1000': customFieldsCost += thousands * m * p; break;
        case 'tiered_1000': customFieldsCost += m * (p + Math.max(thousands - 1, 0) * (f.extraPer1000 || 0)); break;
        case 'flat': customFieldsCost += m * p; break;
      }
    }
  }

  // G20: Total cost
  const totalCost = finite(
    paperCost + sortCost + printCost + extraColorCost + cellophaneCost + dieCutCost + customFieldsCost + num(inputs.moldPrice),
  );

  // G21: Price per piece (will be recalculated after finishing)
  let pricePerPiece = 0;

  // Finishing calculations
  const finishingThousands = thousands; // based on print sheets thousands, not final quantity
  const finishingCosts = finishingItems.map((item) => {
    if (!item.enabled || !item.pricePerUnit) return 0;
    switch (item.calcType) {
      case 'per_piece':
        return finite(qty * item.multiplier * item.pricePerUnit);
      case 'per_1000':
        return finite(finishingThousands * item.multiplier * item.pricePerUnit);
      case 'tiered_1000':
        return finite(item.multiplier * (item.pricePerUnit + Math.max(finishingThousands - 1, 0) * item.extraPer1000));
      case 'flat':
        return finite(item.multiplier * item.pricePerUnit);
      default:
        return 0;
    }
  });

  const totalFinishing = finite(finishingCosts.reduce((a, b) => a + b, 0));
  const grandTotal = finite(totalCost + totalFinishing);

  // G21: Price per piece (including finishing)
  pricePerPiece = qty === 0 ? 0 : safeDiv(grandTotal, qty);

  // Validation message
  let validationMessage = '';
  if (cuts <= 0 || qty <= 0) {
    validationMessage = 'أدخل عدد القطع وعدد ما يفصل في الشيت';
  } else if (pw <= 0 || ph <= 0) {
    validationMessage = 'أدخل مقاس الطباعة';
  } else if (printSheetsPerPurchase === 0) {
    validationMessage = 'مقاس ورقة الطباعة لا يخرج من ورقة الشراء';
  } else if (!inputs.paperType || !inputs.purchaseSize || !inputs.grammage) {
    validationMessage = 'اختر نوع الورق والجرامية ومقاس الشراء';
  } else if (!matchedSize) {
    validationMessage = 'مقاس الطباعة غير مسجل في الإعدادات';
  }

  return {
    purchaseWidth,
    purchaseHeight,
    pricePerTon,
    purchaseArea: finite(purchaseArea),
    purchaseWeight: finite(purchaseWeight),
    pricePerGram: finite(pricePerGram),
    pricePerSheet: finite(pricePerSheet),
    printSheetsPerPurchase: finite(printSheetsPerPurchase),
    printSheetsBeforeWaste: finite(printSheetsBeforeWaste),
    printSheetsAfterWaste: finite(printSheetsAfterWaste),
    purchaseSheetsNeeded: finite(purchaseSheetsNeeded),
    paperCost: finite(paperCost),
    printSizeType,
    thousands: finite(thousands),
    sortCost: finite(sortCost),
    extraColorCost: finite(extraColorCost),
    printCost: finite(printCost),
    cellophaneCost: finite(cellophaneCost),
    dieCutCost: finite(dieCutCost),
    totalCost,
    pricePerPiece,
    finishingCosts,
    totalFinishing,
    grandTotal,
    validationMessage,
    availableGrammages,
    availableSizes,
    pricingUnit,
    pricePerReam,
    sheetsPerReam,
  };
}

// Magazine section calculation helper
function calcSection(
  section: MagazineSectionInputs,
  sheetsBeforeWaste: number,
  paperTypes: PaperType[],
  sizes: SizePricing[]
) {
  const selectedType = paperTypes.find((t) => t.name === section.paperType);
  const selectedEntry = selectedType?.entries.find(
    (e) => e.sizeName === section.purchaseSize && e.grammage === section.grammage
  );

  const purchaseWidth = selectedEntry?.width || 0;
  const purchaseHeight = selectedEntry?.height || 0;
  const pricePerTon = selectedEntry?.pricePerTon || 0;

  const availableGrammages = selectedType
    ? [...new Set(selectedType.entries.map((e) => e.grammage))]
    : [];
  const availableSizes = selectedType
    ? [...new Set(selectedType.entries
        .filter((e) => section.grammage === null || e.grammage === section.grammage)
        .map((e) => e.sizeName))]
    : [];

  const pw = num(section.printWidth);
  const ph = num(section.printHeight);
  const printSheetsPerPurchase = sheetsPerPurchase(purchaseWidth, purchaseHeight, pw, ph);

  const sheetsAfterWaste = Math.ceil(sheetsBeforeWaste * (1 + num(section.wastePercent) / 100));
  const purchaseSheetsNeeded = printSheetsPerPurchase === 0 ? 0 : Math.ceil(safeDiv(sheetsAfterWaste, printSheetsPerPurchase));

  const purchaseArea = (purchaseWidth / 100) * (purchaseHeight / 100);
  const purchaseWeight = purchaseArea * num(section.grammage);
  const pricePerGram = safeDiv(pricePerTon, 1_000_000);

  // Paper cost - handle ream vs ton pricing
  const pricingUnit = selectedEntry?.pricingUnit || 'ton';
  const sheetsPerReam = selectedEntry?.sheetsPerReam || 500;
  const pricePerReam = selectedEntry?.pricePerReam || 0;

  const pricePerSheet = pricingUnit === 'ream' && sheetsPerReam > 0
    ? safeDiv(pricePerReam, sheetsPerReam)
    : finite(purchaseWeight * pricePerGram);

  let paperCost = 0;
  if (pricingUnit === 'ream' && sheetsPerReam > 0) {
    paperCost = safeDiv(pricePerReam, sheetsPerReam) * purchaseSheetsNeeded;
  } else if (purchaseWidth && purchaseHeight && section.grammage && pricePerTon) {
    paperCost = safeDiv(purchaseWidth * purchaseHeight * num(section.grammage) * pricePerTon * purchaseSheetsNeeded, 10_000_000_000);
  }

  const matchedSize = findSizePricing(sizes, pw, ph);
  const sizeType = matchedSize ? matchedSize.sizeName : 'مقاس غير معتمد';
  const thousands = Math.max(1, Math.ceil(sheetsAfterWaste / 1000));

  const effectiveColorCount = section.colorCount >= 5 ? 4 : section.colorCount;

  let sortCost = 0;
  if (matchedSize && effectiveColorCount > 0) {
    const cp = getColorPricing(matchedSize, effectiveColorCount);
    if (cp) {
      if (section.printedFaces === 1) sortCost = cp.sortPerFace;
      else if (section.printedFaces === 2 && section.facesDifferent) sortCost = cp.sortPerFace * 2;
      else sortCost = cp.sortPerFace;
    }
  }

  let printCost = 0;
  if (matchedSize && effectiveColorCount > 0) {
    const cp = getColorPricing(matchedSize, effectiveColorCount);
    if (cp) {
      printCost = section.printedFaces * (cp.printFirst1000PerFace + Math.max(0, thousands - 1) * cp.printExtra1000PerFace);
    }
  }

  let extraColorCost = 0;
  if (section.colorCount >= 5 && section.extraColorPrice > 0) {
    extraColorCost = calcExtraColorCost(section, sheetsBeforeWaste, thousands);
  }

  let cellophaneCost = 0;
  if (matchedSize) {
    cellophaneCost = sheetsAfterWaste * section.cellophaneFaces * matchedSize.cellophanePerFace;
  }

  let dieCutCost = 0;
  if (section.dieCut && matchedSize) {
    dieCutCost = matchedSize.diecut1st1000 + Math.max(0, thousands - 1) * matchedSize.diecutExtra1000;
  }
  dieCutCost += section.moldPrice;

  const baseCost = finite(paperCost + sortCost + printCost + extraColorCost + cellophaneCost + dieCutCost);

  return {
    purchaseWidth, purchaseHeight, pricePerTon,
    purchaseArea: finite(purchaseArea),
    purchaseWeight: finite(purchaseWeight),
    pricePerGram: finite(pricePerGram),
    pricePerSheet: finite(pricePerSheet),
    printSheetsPerPurchase: finite(printSheetsPerPurchase),
    sheetsBeforeWaste: finite(sheetsBeforeWaste),
    sheetsAfterWaste: finite(sheetsAfterWaste),
    purchaseSheetsNeeded: finite(purchaseSheetsNeeded),
    paperCost: Math.round(finite(paperCost) * 10000) / 10000,
    sizeType,
    thousands: finite(thousands),
    sortCost: finite(sortCost),
    printCost: finite(printCost),
    extraColorCost: finite(extraColorCost),
    cellophaneCost: finite(cellophaneCost),
    dieCutCost: finite(dieCutCost),
    baseCost,
    availableGrammages, availableSizes,
    pricingUnit, pricePerReam, sheetsPerReam,
  };
}

export function useMagazineCalculations() {
  const { paperTypes, priceSettings, magazineInputs: mag } = usePrintingStore();

  const sheetsPerMagazine = mag.totalPages && mag.pagesPerSheet ? safeDiv(mag.totalPages, mag.pagesPerSheet) : 0;
  const totalInnerPieces = num(mag.quantity) * sheetsPerMagazine;
  const innerSheetsBeforeWaste = mag.cutsPerSheetInner ? Math.ceil(safeDiv(totalInnerPieces, mag.cutsPerSheetInner)) : 0;
  const coverSheetsBeforeWaste = mag.cutsPerSheetCover ? Math.ceil(safeDiv(mag.quantity, mag.cutsPerSheetCover)) : 0;
  const referenceThousands = Math.max(1, Math.ceil(safeDiv(mag.quantity, 1000)));
  const assemblyCost = finite(referenceThousands * num(mag.assemblyCostPer1000));

  const inner = calcSection(mag.inner, innerSheetsBeforeWaste, paperTypes, priceSettings.sizes);
  const cover = calcSection(mag.cover, coverSheetsBeforeWaste, paperTypes, priceSettings.sizes);

  // Finishing calculations
  const calcFinishing = (items: MagazineFinishingItem[], thousands: number) =>
    items.map((item) => {
      if (!item.enabled || !item.pricePerUnit) return 0;
      switch (item.calcType) {
        case 'per_piece': return mag.quantity * item.multiplier * item.pricePerUnit;
        case 'per_1000': return thousands * item.multiplier * item.pricePerUnit;
        case 'tiered_1000': return item.multiplier * (item.pricePerUnit + Math.max(thousands - 1, 0) * item.extraPer1000);
        case 'flat': return item.multiplier * item.pricePerUnit;
        default: return 0;
      }
    });

  const innerFinishingCosts = calcFinishing(mag.innerFinishing, inner.thousands);
  const coverFinishingCosts = calcFinishing(mag.coverFinishing, cover.thousands);
  const totalInnerFinishing = innerFinishingCosts.reduce((a, b) => a + b, 0);
  const totalCoverFinishing = coverFinishingCosts.reduce((a, b) => a + b, 0);

  const innerTotal = finite(inner.baseCost + totalInnerFinishing);
  const coverTotal = finite(cover.baseCost + totalCoverFinishing);
  const magazineTotal = finite(innerTotal + coverTotal + assemblyCost);
  const pricePerCopy = mag.quantity ? safeDiv(magazineTotal, mag.quantity) : 0;

  return {
    sheetsPerMagazine: finite(sheetsPerMagazine),
    totalInnerPieces: finite(totalInnerPieces),
    innerSheetsBeforeWaste: finite(innerSheetsBeforeWaste),
    coverSheetsBeforeWaste: finite(coverSheetsBeforeWaste),
    referenceThousands: finite(referenceThousands),
    assemblyCost,
    inner, cover,
    innerFinishingCosts, coverFinishingCosts,
    totalInnerFinishing: finite(totalInnerFinishing),
    totalCoverFinishing: finite(totalCoverFinishing),
    innerTotal, coverTotal, magazineTotal, pricePerCopy,
  };
}
