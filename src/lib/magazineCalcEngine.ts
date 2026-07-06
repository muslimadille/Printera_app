/**
 * Magazine Calculation Engine — تبويبة "حساب المجلة"
 *
 * محرك حساب نقي (بدون React) يطبق منطق ملف Excel المرجعي:
 *   ملف_حساب_المجلات_مع_الغلاف.xlsx
 *
 * القواعد الأساسية (من شيت "منطق حساب المجلات مع الغلاف"):
 *  1) كل 4 صفحات داخلية = ورقة واحدة مطبوعة وجهين (ملزمة).
 *  2) سعة صفحات/ملزمة:
 *       - مختلفين:  أوراق_تستوعبها_الماكينة × 4
 *       - متطابقين: أوراق_تستوعبها_الماكينة × 2
 *  3) كمية طباعة الملزمة:
 *       - مختلفين:  الكمية كاملة
 *       - متطابقين: الكمية / 2  (نفس البليت يطبع وجهين)
 *  4) أوجه الطباعة لكل ملزمة = 2 (الوجهين دائمًا)، باستثناء حالة عدم وجود طباعة.
 *  5) شيتات الطباعة = ملازم × كمية_طباعة_الملزمة.
 *  6) شيتات شراء = ceil(شيتات_الطباعة × (1 + هدر) / تفصيل_شيت_الشراء).
 *  7) الفرز = sortPerFace × أوجه_الفرز × عدد_الملازم.
 *     (في "مختلفين": وجهين فرز/ملزمة، في "متطابقين": وجه واحد فرز/ملزمة).
 *  8) الطباعة لكل ملزمة = أوجه × (طباعة_أول_ألف + max(0, ألوف-1) × طباعة_ألف_إضافي).
 *  9) قيمة قالب التكسير تُعرض كبند مستقل ولا تُدمج مع تكلفة التكسير.
 * 10) الغلاف = ورقة مستقلة، تُكرَّر داخل شيت الطباعة حسب سعة الماكينة.
 *     - مختلفين: شيتات_طباعة_الغلاف = ceil(الكمية / تكرار_الغلاف_بالشيت)
 *     - متطابقين: ceil((الكمية/2) / تكرار_الغلاف_بالشيت)
 * 11) التشطيبات: تُحسب على إجمالي شيتات الطباعة (داخل + غلاف) وفق نوع الحساب.
 */

import type {
  PaperType,
  PriceSettings,
  SizePricing,
  ColorPricing,
} from '@/store/printingStore';

/* ──────────────────────────── Types ──────────────────────────── */

export type FacesMode = 'different' | 'identical';
export type CalcType = 'per_piece' | 'per_1000' | 'tiered_1000' | 'flat';

export interface MagazineFinishing {
  name: string;
  enabled: boolean;
  calcType: CalcType;
  multiplier: number;
  pricePerUnit: number;
  extraPer1000: number;
  /**
   * نطاق التشطيب: 'inner' للداخل فقط، 'cover' للغلاف فقط، 'both' لكلاهما.
   * افتراضي 'both' للحفاظ على التوافق مع البيانات القديمة.
   */
  scope?: 'inner' | 'cover' | 'both';
}

export interface InnerInputs {
  pageWidth: number;        // مقاس الصفحة بعد القص (سم)
  pageHeight: number;
  pagesCount: number;       // عدد صفحات الداخل (يُفضل مضاعف 4)
  quantity: number;         // الكمية المطلوبة
  facesMode: FacesMode;     // مختلفين / متطابقين
  colorCount: 0 | 1 | 2 | 3 | 4;
  paperType: string;        // اسم نوع الورق
  grammage: number | null;
  purchaseSize: string;     // اسم مقاس شيت الشراء
  diecut: boolean;
  diecutMoldPrice: number;  // قيمة القالب (مستقلة)
  cellophaneFaces: 0 | 1 | 2;
  wastePercent: number;     // %
}

export interface CoverInputs {
  enabled: boolean;
  paperType: string;
  grammage: number | null;
  purchaseSize: string;
  colorCount: 0 | 1 | 2 | 3 | 4;
  facesMode: FacesMode;
  diecut: boolean;
  diecutMoldPrice: number;
  cellophaneFaces: 0 | 1 | 2;
  /** عدد أوجه طباعة الغلاف (1 = وجه واحد، 2 = وجهين). افتراضي 2. */
  printFaces?: 1 | 2;
  /**
   * مقاس ماكينة مخصص للغلاف. إذا تُرك فارغًا يُستخدم نفس مقاس ماكينة الداخل
   * في كل سيناريو. مفيد عندما يُطبع الغلاف على ماكينة مختلفة.
   */
  machineSizeName?: string;
}

export interface MagazineCalcInputs {
  inner: InnerInputs;
  cover: CoverInputs;
  finishing: MagazineFinishing[];
}

/** سيناريو نتيجة لمقاس ماكينة واحد. */
export interface MagazineScenario {
  machineSizeName: string;
  machineWidth: number;
  machineHeight: number;

  // ── معلومات الورقة بعد الطي ──
  sheetWidth: number;       // مقاس ورقة الداخل (= مقاس الصفحة × 2)
  sheetHeight: number;

  // ── الداخل ──
  innerSheetsPerMachine: number;   // كم ورقة داخل تخرج من شيت الماكينة
  innerPagesPerSignature: number;  // سعة الملزمة الكاملة (capacity)
  innerSignatures: number;          // عدد الملازم (يشمل الجزئية)
  innerPrintQtyPerSig: number;     // كمية طباعة/ملزمة
  /** تفصيل الملازم الفعلي: كل عنصر = ملزمة بعدد صفحاتها وأوراقها. */
  innerSignaturesBreakdown: { pages: number; sheetsPerCopy: number; machineWidth: number; machineHeight: number }[];
  innerPrintFacesPerSig: number;   // أوجه طباعة/ملزمة (2 إن طبع)
  innerSortDesignsPerSig: number;  // تصاميم فرز/ملزمة
  innerPrintSheets: number;         // إجمالي شيتات طباعة الداخل
  innerSheetsPerPurchase: number;  // شيتات طباعة من شيت شراء واحد
  innerPurchaseSheets: number;      // شيتات شراء الداخل (مع الهدر)
  innerPaperCost: number;
  innerSortCost: number;
  innerPrintCost: number;
  innerDiecutCost: number;
  innerCellophaneCost: number;
  innerMoldCost: number;

  // ── الغلاف ──
  coverEnabled: boolean;
  coverRepeatPerSheet: number;     // تكرار الغلاف داخل شيت الطباعة
  coverPrintSheets: number;
  coverSheetsPerPurchase: number;
  coverPurchaseSheets: number;
  coverPaperCost: number;
  coverSortCost: number;
  coverPrintCost: number;
  coverDiecutCost: number;
  coverCellophaneCost: number;
  coverMoldCost: number;

  // ── التشطيبات والإجماليات ──
  totalPrintSheets: number;        // داخل + غلاف
  finishingCost: number;
  finishingBreakdown: { name: string; cost: number; scope?: 'inner' | 'cover' | 'both' }[];
  totalCost: number;               // المجموع الكلي
  pricePerCopy: number;

  // شرح
  explanation: string;
  warnings: string[];

  // ── معلومات تشغيل مستقل للصفحات الزائدة (split run) ──
  /** هل هذا سيناريو "تشغيل مستقل" للصفحات الزائدة على ماكينة أخرى؟ */
  isSplitRun?: boolean;
  /** اسم ماكينة الصفحات الزائدة (للتشغيل المستقل). */
  splitMachineSizeName?: string;
  /** عدد صفحات التشغيل المستقل. */
  splitPagesCount?: number;
  /** تكلفة جزء التشغيل المستقل (ورق + طباعة + فرز + سلوفان + تكسير). */
  splitInnerCost?: number;
}


/* ──────────────────────────── Helpers ──────────────────────────── */

const fitOnSheet = (sw: number, sh: number, pw: number, ph: number): number => {
  if (sw <= 0 || sh <= 0 || pw <= 0 || ph <= 0) return 0;
  const a = Math.floor(sw / pw) * Math.floor(sh / ph);
  const b = Math.floor(sw / ph) * Math.floor(sh / pw);
  return Math.max(a, b);
};

/** ورقة بعد الطي = عرض الصفحة × 2 (العرض يتضاعف، الطول يبقى كما هو). */
export const computeFoldedSheet = (pageW: number, pageH: number) => {
  return { width: pageW * 2, height: pageH };
};

const getColorPricing = (size: SizePricing, colorCount: number): ColorPricing | null => {
  if (colorCount <= 0) return null;
  if (colorCount === 1) return size.color1;
  if (colorCount === 2) return size.color2;
  if (colorCount === 3) return size.color3;
  return size.color4;
};

export const findPaperEntry = (
  paperTypes: PaperType[],
  paperName: string,
  grammage: number | null,
  sizeName: string,
) => {
  const t = paperTypes.find(p => p.name === paperName);
  if (!t) return null;
  return t.entries.find(e =>
    e.sizeName === sizeName &&
    (grammage == null || e.grammage === grammage),
  ) || null;
};

export const paperPricePerSheet = (entry: ReturnType<typeof findPaperEntry>): number => {
  if (!entry) return 0;
  const unit = entry.pricingUnit || 'ton';
  if (unit === 'ream' && (entry.sheetsPerReam ?? 0) > 0) {
    return (entry.pricePerReam || 0) / (entry.sheetsPerReam || 1);
  }
  // ton
  const areaM2 = (entry.width / 100) * (entry.height / 100);
  const weightG = areaM2 * (entry.grammage || 0);
  const pricePerGram = (entry.pricePerTon || 0) / 1_000_000;
  return weightG * pricePerGram;
};

/**
 * يعيد وحدة التسعير الفعلية المُطبَّقة (رزمة/طن) وسعر الشيت المحسوب،
 * مأخوذة مباشرة من إعدادات المستخدم لنوع الورق المختار.
 * تُستخدم في الواجهة لإظهار شارة "التسعير: رزمة/طن" تلقائيًا.
 */
export interface ActivePaperPricing {
  unit: 'ream' | 'ton';
  pricePerSheet: number;
  pricePerReam?: number;
  sheetsPerReam?: number;
  pricePerTon?: number;
  grammage?: number;
  width?: number;
  height?: number;
}

export const getActivePaperPricing = (
  paperTypes: PaperType[],
  paperName: string,
  grammage: number | null,
  sizeName: string,
): ActivePaperPricing | null => {
  const entry = findPaperEntry(paperTypes, paperName, grammage, sizeName);
  if (!entry) return null;
  const unit: 'ream' | 'ton' =
    (entry.pricingUnit === 'ream' && (entry.sheetsPerReam ?? 0) > 0) ? 'ream' : 'ton';
  return {
    unit,
    pricePerSheet: paperPricePerSheet(entry),
    pricePerReam: entry.pricePerReam,
    sheetsPerReam: entry.sheetsPerReam,
    pricePerTon: entry.pricePerTon,
    grammage: entry.grammage,
    width: entry.width,
    height: entry.height,
  };
};

const calcFinishingCost = (
  item: MagazineFinishing,
  totalPrintSheets: number,
): number => {
  if (!item.enabled || item.pricePerUnit <= 0) return 0;
  const m = item.multiplier > 0 ? item.multiplier : 1;
  const thousands = Math.max(1, Math.ceil(totalPrintSheets / 1000));
  switch (item.calcType) {
    case 'per_piece':   return totalPrintSheets * m * item.pricePerUnit;
    case 'per_1000':    return thousands * m * item.pricePerUnit;
    case 'tiered_1000': return m * (item.pricePerUnit + Math.max(0, thousands - 1) * item.extraPer1000);
    case 'flat':        return m * item.pricePerUnit;
    default:            return 0;
  }
};

/* ──────────────────────────── Engine ──────────────────────────── */

export interface BuildScenariosArgs {
  inputs: MagazineCalcInputs;
  paperTypes: PaperType[];
  priceSettings: PriceSettings;
}

/**
 * يبني سيناريو واحد لكل مقاس ماكينة موجود في إعدادات المستخدم.
 * يعيد فقط السيناريوهات التي تستوعب الورقة فعليًا.
 */
/**
 * نتيجة حساب الداخل لماكينة واحدة وعدد صفحات معين.
 * تُستخدم داخليًا لبناء السيناريو الأساسي وكذلك لتشغيل مستقل للصفحات الزائدة.
 */
interface InnerComputation {
  sheetsPerMachine: number;
  pagesPerSig: number;
  signaturesBreakdown: { pages: number; sheetsPerCopy: number; machineWidth: number; machineHeight: number }[];
  printQtyPerSig: number;
  printFacesPerSig: number;
  sortDesignsPerSig: number;
  printSheets: number;
  sheetsPerPurchase: number;
  purchaseSheets: number;
  paperCost: number;
  sortCost: number;
  printCost: number;
  diecutCost: number;
  cellophaneCost: number;
  moldCost: number;
  /** مجموع تكاليف الإنتاج الداخلية (بدون التشطيبات ولا الغلاف). */
  totalInnerCost: number;
  warnings: string[];
}

function computeInnerForMachine(
  machine: PriceSettings['sizes'][number],
  pages: number,
  inner: InnerInputs,
  folded: { width: number; height: number },
  innerPaperEntry: ReturnType<typeof findPaperEntry>,
  innerPricePerSheet: number,
  innerWasteFactor: number,
): InnerComputation | null {
  const sheetsPerMachine = fitOnSheet(machine.width, machine.height, folded.width, folded.height);
  if (sheetsPerMachine <= 0) return null;

  const pagesPerSig = inner.facesMode === 'different'
    ? sheetsPerMachine * 4
    : sheetsPerMachine * 2;
  if (pagesPerSig < 4) return null;
  if (pages <= 0) return null;

  const pagesPerSheet = inner.facesMode === 'different' ? 4 : 2;

  const fullSigs = Math.floor(pages / pagesPerSig);
  const remainderPages = pages - fullSigs * pagesPerSig;
  const signaturesBreakdown: { pages: number; sheetsPerCopy: number; machineWidth: number; machineHeight: number }[] = [];
  for (let i = 0; i < fullSigs; i++) {
    signaturesBreakdown.push({ pages: pagesPerSig, sheetsPerCopy: 1, machineWidth: machine.width, machineHeight: machine.height });
  }
  if (remainderPages > 0) {
    const partialSheets = Math.ceil(remainderPages / pagesPerSheet);
    signaturesBreakdown.push({ pages: remainderPages, sheetsPerCopy: partialSheets / sheetsPerMachine, machineWidth: machine.width, machineHeight: machine.height });
  }
  const signatures = signaturesBreakdown.length;

  const printQtyPerSig = inner.facesMode === 'different'
    ? inner.quantity
    : Math.ceil(inner.quantity / 2);

  const printFacesPerSig = inner.colorCount > 0 ? 2 : 0;
  const sortDesignsPerSig = inner.facesMode === 'different' ? 2 : 1;

  const printSheets = signaturesBreakdown.reduce(
    (sum, sig) => sum + Math.ceil(sig.sheetsPerCopy * printQtyPerSig),
    0,
  );

  const warnings: string[] = [];
  let sheetsPerPurchase = 0;
  if (innerPaperEntry) {
    sheetsPerPurchase = fitOnSheet(
      innerPaperEntry.width, innerPaperEntry.height,
      machine.width, machine.height,
    );
  }
  const purchaseSheets = sheetsPerPurchase > 0
    ? Math.ceil((printSheets * innerWasteFactor) / sheetsPerPurchase)
    : 0;
  if (innerPaperEntry && sheetsPerPurchase === 0) {
    warnings.push(`شيت الشراء للداخل لا يستوعب ماكينة ${machine.sizeName}`);
  }

  const paperCost = purchaseSheets * innerPricePerSheet;

  const cp = getColorPricing(machine, inner.colorCount);
  const sortCost = cp ? cp.sortPerFace * sortDesignsPerSig * signatures : 0;

  let printCost = 0;
  if (cp && printFacesPerSig > 0) {
    const thousands = Math.max(1, Math.ceil(printQtyPerSig / 1000));
    const perSig = printFacesPerSig * (
      cp.printFirst1000PerFace + Math.max(0, thousands - 1) * cp.printExtra1000PerFace
    );
    printCost = perSig * signatures;
  }

  let diecutCost = 0;
  if (inner.diecut) {
    const thousands = Math.max(1, Math.ceil(printSheets / 1000));
    diecutCost = machine.diecut1st1000 + Math.max(0, thousands - 1) * machine.diecutExtra1000;
  }
  const moldCost = inner.diecut ? inner.diecutMoldPrice : 0;

  const cellophaneCost = inner.cellophaneFaces > 0
    ? printSheets * inner.cellophaneFaces * (machine.cellophanePerFace || 0)
    : 0;

  const totalInnerCost = paperCost + sortCost + printCost + diecutCost + cellophaneCost + moldCost;

  return {
    sheetsPerMachine,
    pagesPerSig,
    signaturesBreakdown,
    printQtyPerSig,
    printFacesPerSig,
    sortDesignsPerSig,
    printSheets,
    sheetsPerPurchase,
    purchaseSheets,
    paperCost,
    sortCost,
    printCost,
    diecutCost,
    cellophaneCost,
    moldCost,
    totalInnerCost,
    warnings,
  };
}

/** يحسب جزء الغلاف لماكينة داخل معينة. */
function computeCoverPart(
  machine: PriceSettings['sizes'][number],
  cover: CoverInputs,
  inner: InnerInputs,
  folded: { width: number; height: number },
  priceSettings: PriceSettings,
  coverPaperEntry: ReturnType<typeof findPaperEntry>,
  coverPricePerSheet: number,
  innerWasteFactor: number,
  baseSheetsPerMachine: number,
) {
  const result = {
    coverRepeatPerSheet: 0,
    coverPrintSheets: 0,
    coverSheetsPerPurchase: 0,
    coverPurchaseSheets: 0,
    coverPaperCost: 0,
    coverSortCost: 0,
    coverPrintCost: 0,
    coverDiecutCost: 0,
    coverCellophaneCost: 0,
    coverMoldCost: 0,
    warnings: [] as string[],
  };
  if (!cover.enabled) return result;

  const coverMachine = (cover.machineSizeName
    ? priceSettings.sizes.find(s => s.sizeName === cover.machineSizeName)
    : machine) || machine;

  result.coverRepeatPerSheet = (cover.machineSizeName && coverMachine !== machine)
    ? fitOnSheet(coverMachine.width, coverMachine.height, folded.width, folded.height)
    : baseSheetsPerMachine;
  const coverFinalQty = cover.facesMode === 'different'
    ? inner.quantity
    : Math.ceil(inner.quantity / 2);
  result.coverPrintSheets = result.coverRepeatPerSheet > 0
    ? Math.ceil(coverFinalQty / result.coverRepeatPerSheet)
    : 0;

  if (coverPaperEntry) {
    result.coverSheetsPerPurchase = fitOnSheet(
      coverPaperEntry.width, coverPaperEntry.height,
      coverMachine.width, coverMachine.height,
    );
    result.coverPurchaseSheets = result.coverSheetsPerPurchase > 0
      ? Math.ceil((result.coverPrintSheets * innerWasteFactor) / result.coverSheetsPerPurchase)
      : 0;
    result.coverPaperCost = result.coverPurchaseSheets * coverPricePerSheet;
    if (result.coverSheetsPerPurchase === 0) {
      result.warnings.push('شيت الشراء للغلاف لا يستوعب مقاس ماكينة الغلاف');
    }
  }

  const cpCover = getColorPricing(coverMachine, cover.colorCount);
  const coverPrintFaces = cover.colorCount > 0 ? (cover.printFaces ?? 2) : 0;
  const coverSortDesigns = cover.facesMode === 'different' ? 2 : 1;

  if (cpCover) {
    result.coverSortCost = cpCover.sortPerFace * coverSortDesigns;
    if (coverPrintFaces > 0) {
      const thousands = Math.max(1, Math.ceil(coverFinalQty / 1000));
      result.coverPrintCost = coverPrintFaces * (
        cpCover.printFirst1000PerFace + Math.max(0, thousands - 1) * cpCover.printExtra1000PerFace
      );
    }
  }

  if (cover.diecut) {
    const thousands = Math.max(1, Math.ceil(result.coverPrintSheets / 1000));
    result.coverDiecutCost = coverMachine.diecut1st1000 + Math.max(0, thousands - 1) * coverMachine.diecutExtra1000;
  }
  result.coverMoldCost = cover.diecut ? cover.diecutMoldPrice : 0;

  result.coverCellophaneCost = cover.cellophaneFaces > 0
    ? result.coverPrintSheets * cover.cellophaneFaces * (coverMachine.cellophanePerFace || 0)
    : 0;

  return result;
}

export function buildMagazineScenarios({
  inputs,
  paperTypes,
  priceSettings,
}: BuildScenariosArgs): MagazineScenario[] {
  const { inner, cover, finishing } = inputs;
  const scenarios: MagazineScenario[] = [];

  if (!inner.pageWidth || !inner.pageHeight || !inner.pagesCount || !inner.quantity) {
    return scenarios;
  }

  const folded = computeFoldedSheet(inner.pageWidth, inner.pageHeight);
  const innerPaperEntry = findPaperEntry(paperTypes, inner.paperType, inner.grammage, inner.purchaseSize);
  const coverPaperEntry = cover.enabled
    ? findPaperEntry(paperTypes, cover.paperType, cover.grammage, cover.purchaseSize)
    : null;
  const innerPricePerSheet = paperPricePerSheet(innerPaperEntry);
  const coverPricePerSheet = paperPricePerSheet(coverPaperEntry);

  const innerWasteFactor = 1 + Math.max(0, inner.wastePercent) / 100;

  /** يبني سيناريو نهائي بدمج جزء الداخل (قد يكون مركّبًا) مع الغلاف والتشطيبات. */
  const buildScenario = (
    baseMachine: PriceSettings['sizes'][number],
    mainPart: InnerComputation,
    splitPart: InnerComputation | null,
    splitMachine: PriceSettings['sizes'][number] | null,
    extraWarnings: string[],
  ): MagazineScenario => {
    // الداخل المعروض = نتيجة الجزء الرئيسي + الجزء المستقل (إن وُجد)
    const combinedBreakdown = [
      ...mainPart.signaturesBreakdown,
      ...(splitPart ? splitPart.signaturesBreakdown : []),
    ];
    const innerPrintSheets = mainPart.printSheets + (splitPart?.printSheets ?? 0);
    const innerPaperCost = mainPart.paperCost + (splitPart?.paperCost ?? 0);
    const innerSortCost = mainPart.sortCost + (splitPart?.sortCost ?? 0);
    const innerPrintCost = mainPart.printCost + (splitPart?.printCost ?? 0);
    const innerDiecutCost = mainPart.diecutCost + (splitPart?.diecutCost ?? 0);
    const innerCellophaneCost = mainPart.cellophaneCost + (splitPart?.cellophaneCost ?? 0);
    // قيمة القالب لا تُضاعف: تُحسب مرة واحدة فقط
    const innerMoldCost = mainPart.moldCost;
    const innerPurchaseSheets = mainPart.purchaseSheets + (splitPart?.purchaseSheets ?? 0);

    // الغلاف يُبنى دائمًا على الماكينة الأساسية
    const coverPart = computeCoverPart(
      baseMachine, cover, inner, folded, priceSettings,
      coverPaperEntry, coverPricePerSheet, innerWasteFactor, mainPart.sheetsPerMachine,
    );

    const totalPrintSheets = innerPrintSheets + coverPart.coverPrintSheets;
    const finishingBreakdown = finishing
      .map(f => {
        const scope = f.scope ?? 'both';
        const sheetsForScope =
          scope === 'inner' ? innerPrintSheets :
          scope === 'cover' ? coverPart.coverPrintSheets :
          totalPrintSheets;
        return { name: f.name, cost: calcFinishingCost(f, sheetsForScope), scope };
      })
      .filter(x => x.cost > 0);
    const finishingCost = finishingBreakdown.reduce((s, x) => s + x.cost, 0);

    const totalCost =
      innerPaperCost + innerSortCost + innerPrintCost + innerDiecutCost +
      innerCellophaneCost + innerMoldCost +
      coverPart.coverPaperCost + coverPart.coverSortCost + coverPart.coverPrintCost +
      coverPart.coverDiecutCost + coverPart.coverCellophaneCost + coverPart.coverMoldCost +
      finishingCost;

    const pricePerCopy = inner.quantity > 0 ? totalCost / inner.quantity : 0;

    const splitNote = splitPart && splitMachine
      ? ` • تشغيل مستقل: ${splitPart.signaturesBreakdown.map(s => s.pages).join('+')} صفحة على ${splitMachine.sizeName}`
      : '';
    const explanation = [
      `الداخل: ${combinedBreakdown.length} ملزمة × ${mainPart.printQtyPerSig.toLocaleString()} شيت`,
      cover.enabled ? `الغلاف: ${coverPart.coverPrintSheets.toLocaleString()} شيت (×${coverPart.coverRepeatPerSheet}/شيت)` : 'بدون غلاف',
      `ماكينة ${baseMachine.sizeName}، ${mainPart.pagesPerSig} صفحة/ملزمة، ${inner.facesMode === 'different' ? 'وجهين مختلفين' : 'وجهين متطابقين'}`,
    ].join(' • ') + splitNote;

    const warnings = [...mainPart.warnings, ...(splitPart?.warnings ?? []), ...coverPart.warnings, ...extraWarnings];

    return {
      machineSizeName: baseMachine.sizeName,
      machineWidth: baseMachine.width,
      machineHeight: baseMachine.height,
      sheetWidth: folded.width,
      sheetHeight: folded.height,
      innerSheetsPerMachine: mainPart.sheetsPerMachine,
      innerPagesPerSignature: mainPart.pagesPerSig,
      innerSignatures: combinedBreakdown.length,
      innerPrintQtyPerSig: mainPart.printQtyPerSig,
      innerSignaturesBreakdown: combinedBreakdown,
      innerPrintFacesPerSig: mainPart.printFacesPerSig,
      innerSortDesignsPerSig: mainPart.sortDesignsPerSig,
      innerPrintSheets,
      innerSheetsPerPurchase: mainPart.sheetsPerPurchase,
      innerPurchaseSheets,
      innerPaperCost,
      innerSortCost,
      innerPrintCost,
      innerDiecutCost,
      innerCellophaneCost,
      innerMoldCost,
      coverEnabled: cover.enabled,
      coverRepeatPerSheet: coverPart.coverRepeatPerSheet,
      coverPrintSheets: coverPart.coverPrintSheets,
      coverSheetsPerPurchase: coverPart.coverSheetsPerPurchase,
      coverPurchaseSheets: coverPart.coverPurchaseSheets,
      coverPaperCost: coverPart.coverPaperCost,
      coverSortCost: coverPart.coverSortCost,
      coverPrintCost: coverPart.coverPrintCost,
      coverDiecutCost: coverPart.coverDiecutCost,
      coverCellophaneCost: coverPart.coverCellophaneCost,
      coverMoldCost: coverPart.coverMoldCost,
      totalPrintSheets,
      finishingCost,
      finishingBreakdown,
      totalCost,
      pricePerCopy,
      explanation,
      warnings,
      isSplitRun: !!splitPart,
      splitMachineSizeName: splitMachine?.sizeName,
      splitPagesCount: splitPart ? splitPart.signaturesBreakdown.reduce((a, s) => a + s.pages, 0) : undefined,
      splitInnerCost: splitPart?.totalInnerCost,
    };
  };

  for (const machine of priceSettings.sizes) {
    // ── السيناريو الأساسي: كل الصفحات على نفس الماكينة ──
    const fullInner = computeInnerForMachine(
      machine, inner.pagesCount, inner, folded,
      innerPaperEntry, innerPricePerSheet, innerWasteFactor,
    );
    if (!fullInner) continue;

    scenarios.push(buildScenario(machine, fullInner, null, null, []));

    // ── سيناريوهات تشغيل مستقل للصفحات الزائدة ──
    // إن وُجدت ملزمة جزئية في السيناريو الأساسي، جرّب فصلها على ماكينة أخرى.
    const lastSig = fullInner.signaturesBreakdown[fullInner.signaturesBreakdown.length - 1];
    const hasPartial = !!lastSig && lastSig.pages < fullInner.pagesPerSig;
    if (!hasPartial) continue;

    const fullPagesOnly = inner.pagesCount - lastSig.pages;
    if (fullPagesOnly <= 0) continue; // كل الصفحات جزئية → لا قيمة للفصل

    // الجزء الرئيسي بدون الجزئية
    const mainPart = computeInnerForMachine(
      machine, fullPagesOnly, inner, folded,
      innerPaperEntry, innerPricePerSheet, innerWasteFactor,
    );
    if (!mainPart) continue;

    // ابحث عن أفضل ماكينة بديلة لطباعة الصفحات الزائدة كتشغيل مستقل.
    // الماكينة الأصلية مستثناة (لأن ذلك = السيناريو الأساسي نفسه).
    let bestSplit: { part: InnerComputation; machine: PriceSettings['sizes'][number] } | null = null;
    for (const altMachine of priceSettings.sizes) {
      if (altMachine.sizeName === machine.sizeName) continue;
      const splitInner = computeInnerForMachine(
        altMachine, lastSig.pages, inner, folded,
        innerPaperEntry, innerPricePerSheet, innerWasteFactor,
      );
      if (!splitInner) continue;
      if (!bestSplit || splitInner.totalInnerCost < bestSplit.part.totalInnerCost) {
        bestSplit = { part: splitInner, machine: altMachine };
      }
    }

    if (bestSplit) {
      scenarios.push(
        buildScenario(machine, mainPart, bestSplit.part, bestSplit.machine, [
          `تشغيل مستقل للصفحات الزائدة (${lastSig.pages} صفحة) على ماكينة ${bestSplit.machine.sizeName}`,
        ]),
      );
    }
  }

  // الترتيب: من الأرخص للأغلى
  return scenarios.sort((a, b) => a.totalCost - b.totalCost);
}


/** التحقق من صحة عدد الصفحات. */
export const validatePagesCount = (pagesCount: number): { ok: boolean; message: string } => {
  if (!pagesCount || pagesCount <= 0) return { ok: false, message: 'أدخل عدد صفحات الداخل' };
  if (pagesCount % 4 !== 0) {
    return { ok: false, message: `عدد الصفحات يفضل أن يقبل القسمة على 4 (الأقرب: ${Math.ceil(pagesCount / 4) * 4})` };
  }
  return { ok: true, message: 'عدد الصفحات صحيح' };
};
