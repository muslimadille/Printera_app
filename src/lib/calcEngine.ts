/**
 * Standalone calculation engine (no React hooks).
 * Mirrors useCalculations() from printingStore but works with plain data.
 */
import type { PaperType, SizePricing, SizeCustomField, ColorPricing, CalculatorInputs, FinishingItem, PriceSettings, ExtraColorConfig } from '@/store/printingStore';
import { finite, num, safeDiv, sheetsPerPurchase } from '@/lib/safeNumber';

function migrateSizePricing(s: any): SizePricing {
  if (s.color1) return s;
  const d: ColorPricing = { sortPerFace: 0, printFirst1000PerFace: 0, printExtra1000PerFace: 0 };
  return { ...s, color1: { sortPerFace: s.sortSingleFace || 0, printFirst1000PerFace: s.printFirst1000PerFace || 0, printExtra1000PerFace: s.printExtra1000PerFace || 0 }, color2: { ...d }, color3: { ...d }, color4: { ...d } };
}

function getColorPricing(size: SizePricing, colorCount: number): ColorPricing | null {
  const m = migrateSizePricing(size);
  if (colorCount === 0) return null;
  if (colorCount === 1) return m.color1;
  if (colorCount === 2) return m.color2;
  if (colorCount === 3) return m.color3;
  return m.color4;
}

function findSizePricing(sizes: SizePricing[], pw: number, ph: number): SizePricing | undefined {
  return sizes.find(s => (s.width === pw && s.height === ph) || (s.width === ph && s.height === pw));
}

function calcExtraColorCost(config: ExtraColorConfig, quantity: number, thousands: number): number {
  const { extraColorCalcType, extraColorPrice, extraColorExtra1000, extraColorCount } = config;
  if (!extraColorPrice || !extraColorCount) return 0;
  let costPerColor = 0;
  switch (extraColorCalcType) {
    case 'per_1000': costPerColor = thousands * extraColorPrice; break;
    case 'tiered_1000': costPerColor = extraColorPrice + Math.max(0, thousands - 1) * extraColorExtra1000; break;
    default: costPerColor = 0;
  }
  return finite(costPerColor * extraColorCount);
}
function calcCustomFieldCost(f: SizeCustomField, quantity: number, thousands: number): number {
  const m = num(f.multiplier, 1);
  const p = num(f.pricePerUnit);
  if (p <= 0) return 0;
  switch (f.calcType) {
    case 'per_piece': return finite(quantity * m * p);
    case 'per_1000': return finite(thousands * m * p);
    case 'tiered_1000': return finite(m * (p + Math.max(thousands - 1, 0) * num(f.extraPer1000)));
    case 'flat': return finite(m * p);
    default: return 0;
  }
}

const EMPTY_RESULT = (): CalcResult => ({
  paperCost: 0, sortCost: 0, printCost: 0, extraColorCost: 0, cellophaneCost: 0, dieCutCost: 0,
  customFieldsCost: 0, customFieldsBreakdown: [], totalCost: 0, totalFinishing: 0, grandTotal: 0,
  pricePerPiece: 0, printSheetsPerPurchase: 0, printSheetsBeforeWaste: 0, printSheetsAfterWaste: 0,
  purchaseSheetsNeeded: 0, thousands: 0, valid: false, error: 'بيانات ناقصة',
});

export interface CalcResult {
  paperCost: number;
  sortCost: number;
  printCost: number;
  extraColorCost: number;
  cellophaneCost: number;
  dieCutCost: number;
  customFieldsCost: number;
  customFieldsBreakdown: { name: string; value: number }[];
  totalCost: number;
  totalFinishing: number;
  grandTotal: number;
  pricePerPiece: number;
  printSheetsPerPurchase: number;
  printSheetsBeforeWaste: number;
  printSheetsAfterWaste: number;
  purchaseSheetsNeeded: number;
  thousands: number;
  valid: boolean;
  error?: string;
}

export interface CalcOverrides {
  /** Index in priceSettings.sizes that represents the chosen MACHINE size (from color row).
   * Print/Sort prices are taken from this row, regardless of the actual product print size. */
  machineSizeIdx?: number;
  /** When defined and >= 0, overrides cellophane price per face (used when press size
   * is not in the color size list and the user opted to enter a manual price). */
  cellophaneOverridePerFace?: number;
}

export function calculateQuote(
  inputs: CalculatorInputs,
  finishingItems: FinishingItem[],
  paperTypes: PaperType[],
  priceSettings: PriceSettings,
  overrides: CalcOverrides = {},
): CalcResult {
  const quantity = num(inputs.quantity);
  const cutsPerSheet = num(inputs.cutsPerSheet);
  const pw = num(inputs.printWidth);
  const ph = num(inputs.printHeight);

  const selectedType = paperTypes.find(t => t.name === inputs.paperType);
  const selectedEntry = selectedType?.entries.find(
    e => e.sizeName === inputs.purchaseSize && e.grammage === inputs.grammage
  );

  if (!selectedEntry || quantity <= 0 || cutsPerSheet <= 0 || pw <= 0 || ph <= 0) {
    return EMPTY_RESULT();
  }

  const purchaseWidth = num(selectedEntry.width);
  const purchaseHeight = num(selectedEntry.height);
  const pricePerTon = num(selectedEntry.pricePerTon);
  const pricingUnit = selectedEntry.pricingUnit || 'ton';
  const pricePerReam = num(selectedEntry.pricePerReam);
  const sheetsPerReam = num(selectedEntry.sheetsPerReam, 500);

  const purchaseArea = (purchaseWidth / 100) * (purchaseHeight / 100);
  const purchaseWeight = purchaseArea * num(inputs.grammage);
  const pricePerGram = safeDiv(pricePerTon, 1_000_000);
  const pricePerSheet = pricingUnit === 'ream' && sheetsPerReam > 0
    ? safeDiv(pricePerReam, sheetsPerReam)
    : finite(purchaseWeight * pricePerGram);

  const autoPrintSheetsPerPurchase = sheetsPerPurchase(purchaseWidth, purchaseHeight, pw, ph);
  const baseCuts = num((inputs as { baseCuts?: number }).baseCuts);
  const printSheetsPerPurchase = baseCuts > 0 ? baseCuts : autoPrintSheetsPerPurchase;

  if (printSheetsPerPurchase === 0) {
    return {
      ...EMPTY_RESULT(),
      error: 'مقاس الطباعة لا يخرج من ورقة الشراء',
    };
  }

  const printSheetsBeforeWaste = Math.ceil(safeDiv(quantity, cutsPerSheet));
  const wasteMode = (inputs as { wasteMode?: string }).wasteMode || 'percent';
  const printSheetsAfterWaste = wasteMode === 'number'
    ? printSheetsBeforeWaste + num(inputs.wastePercent)
    : Math.ceil(printSheetsBeforeWaste * (1 + num(inputs.wastePercent) / 100));
  const purchaseSheetsNeeded = Math.ceil(safeDiv(printSheetsAfterWaste, printSheetsPerPurchase));
  const paperCost = finite(pricePerSheet * purchaseSheetsNeeded);

  // wasteInCosts controls whether non-paper costs use sheets WITH waste or WITHOUT waste
  // Paper always uses waste. When false, printing/cellophane/finishing use printSheetsBeforeWaste.
  const useWasteInCosts = inputs.wasteInCosts !== false;
  const effectiveSheets = useWasteInCosts ? printSheetsAfterWaste : printSheetsBeforeWaste;

  const matchedSize = findSizePricing(priceSettings.sizes, pw, ph);
  // Machine size = the size row chosen via the color picker. Print & sort prices come from here.
  const machineSize = (overrides.machineSizeIdx != null && overrides.machineSizeIdx >= 0)
    ? priceSettings.sizes[overrides.machineSizeIdx]
    : matchedSize;
  const thousands = Math.max(1, Math.ceil(safeDiv(effectiveSheets, 1000)));
  const effectiveColorCount = num(inputs.colorCount) >= 5 ? 4 : num(inputs.colorCount);

  let sortCost = 0;
  if (machineSize && effectiveColorCount > 0) {
    const cp = getColorPricing(machineSize, effectiveColorCount);
    if (cp) {
      sortCost = (inputs.printedFaces === 2 && inputs.facesDifferent) ? num(cp.sortPerFace) * 2 : num(cp.sortPerFace);
    }
  }

  let printCost = 0;
  if (machineSize && effectiveColorCount > 0) {
    const cp = getColorPricing(machineSize, effectiveColorCount);
    if (cp) {
      printCost = num(inputs.printedFaces) * (num(cp.printFirst1000PerFace) + Math.max(0, thousands - 1) * num(cp.printExtra1000PerFace));
    }
  }

  let extraColorCost = 0;
  if (num(inputs.colorCount) >= 5 && num(inputs.extraColorPrice) > 0) {
    extraColorCost = calcExtraColorCost(inputs, quantity, thousands);
  }

  // Cellophane: priority — manual override > matched product size > machine size
  let cellophaneCost = 0;
  const isFieldHidden = (field: string) => (machineSize ?? matchedSize)?.hiddenFields?.includes(field) ?? false;
  if (num(inputs.cellophaneFaces) > 0 && !isFieldHidden('cellophane')) {
    let perFace = 0;
    if (overrides.cellophaneOverridePerFace != null && overrides.cellophaneOverridePerFace >= 0) {
      perFace = num(overrides.cellophaneOverridePerFace);
    } else {
      perFace = num(matchedSize?.cellophanePerFace ?? machineSize?.cellophanePerFace);
    }
    cellophaneCost = finite(effectiveSheets * num(inputs.cellophaneFaces) * perFace);
  }

  let dieCutCost = 0;
  if (inputs.dieCut && machineSize && !isFieldHidden('diecut')) {
    dieCutCost = num(machineSize.diecut1st1000) + Math.max(0, thousands - 1) * num(machineSize.diecutExtra1000);
  }

  // Custom fields cost
  let customFieldsCost = 0;
  const customFieldsDetail: { name: string; cost: number }[] = [];
  if (matchedSize?.customFields) {
    for (const f of matchedSize.customFields) {
      const cost = calcCustomFieldCost(f, quantity, thousands);
      customFieldsCost += cost;
      if (cost > 0) customFieldsDetail.push({ name: f.name, cost });
    }
  }

  const moldCost = num(inputs.moldPrice);
  const totalCost = finite(paperCost + sortCost + printCost + extraColorCost + cellophaneCost + dieCutCost + customFieldsCost + moldCost);

  const finishingCosts = finishingItems.map(item => {
    const multiplier = Number.isFinite(item.multiplier) && item.multiplier > 0 ? item.multiplier : 1;
    const pricePerUnit = Number.isFinite(item.pricePerUnit) ? item.pricePerUnit : 0;
    const extraPer1000 = Number.isFinite(item.extraPer1000) ? item.extraPer1000 : 0;
    if (!item.enabled || pricePerUnit <= 0) return 0;
    switch (item.calcType) {
      case 'per_piece': return finite(quantity * multiplier * pricePerUnit);
      case 'per_1000': return finite(thousands * multiplier * pricePerUnit);
      case 'tiered_1000': return finite(multiplier * (pricePerUnit + Math.max(thousands - 1, 0) * extraPer1000));
      case 'flat': return finite(multiplier * pricePerUnit);
      default: return 0;
    }
  });

  const totalFinishing = finite(finishingCosts.reduce((a, b) => a + b, 0));
  const grandTotal = finite(totalCost + totalFinishing);
  const pricePerPiece = quantity === 0 ? 0 : safeDiv(grandTotal, quantity);

  const customFieldsBreakdown = customFieldsDetail.map(d => ({ name: d.name, value: finite(d.cost) }));

  return {
    paperCost: finite(paperCost),
    sortCost: finite(sortCost),
    printCost: finite(printCost),
    extraColorCost: finite(extraColorCost),
    cellophaneCost: finite(cellophaneCost),
    dieCutCost: finite(dieCutCost),
    customFieldsCost: finite(customFieldsCost),
    customFieldsBreakdown,
    totalCost,
    totalFinishing,
    grandTotal,
    pricePerPiece,
    printSheetsPerPurchase: finite(printSheetsPerPurchase),
    printSheetsBeforeWaste: finite(printSheetsBeforeWaste),
    printSheetsAfterWaste: finite(printSheetsAfterWaste),
    purchaseSheetsNeeded: finite(purchaseSheetsNeeded),
    thousands: finite(thousands),
    valid: true,
  };
}
