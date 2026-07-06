/**
 * Bag (الأكياس) calculation engine.
 * Mirrors the logic from the reference Excel "حساب الأكياس حسب المكائن":
 *  - Flat (open) bag dimensions:
 *      flatWidth  = 2*W + 2*G + glueFlap
 *      flatHeight = H + base + topFlap
 *  - For each machine size row in priceSettings.sizes that matches the chosen colorCount:
 *      Try fitting the FLAT shape inside the machine sheet (both orientations).
 *      If it fits  -> compute bagsPerSheet, sheetsNeeded = ceil(qty / bagsPerSheet)
 *      If too big  -> compute how many print sheets per ONE bag (max 2). Beyond 2 -> reject.
 *  - Purchase sheets are computed from how many machine print-sheets come out of one
 *    purchase sheet (uses paper entry width/height).
 *  - Costs:  paper + sort + print + diecut (تكسير) + cellophane + mold + extras + finishing
 *  - Picks the cheapest valid scenario (best total).
 */
import type {
  PaperType,
  PriceSettings,
  SizePricing,
  ColorPricing,
} from '@/store/printingStore';

export interface BagInputs {
  width: number;        // W
  gusset: number;       // G
  height: number;       // H
  quantity: number;
  paperType: string;
  purchaseSize: string;
  grammage: number | null;
  colorCount: number;   // 1..4
  printedFaces: number; // 1 or 2
  topFlap: number;      // اللسان العلوي
  base: number;         // القاعدة (default = G/2 + 2.5)
  glueFlap: number;     // لسان اللصق
  cellophane: boolean;
  cellophaneFaces: number; // usually 1
  diecut: boolean;
  moldPrice: number;
  otherFinishing: number;
  wastePercent: number;
}

export interface BagScenario {
  machineLabel: string;     // e.g. "100×70"
  machineWidth: number;
  machineHeight: number;
  colorCount: number;
  valid: boolean;
  method: string;           // "X كيس/شيت" or "Y شيت/كيس"
  bagsPerSheet: number;     // 0 if big-bag mode
  sheetsPerBag: number;     // 0 if many-bags-per-sheet mode
  printSheets: number;      // total print sheets after waste
  purchaseSheets: number;   // total purchase sheets
  paperCost: number;
  sortCost: number;
  printCost: number;
  diecutCost: number;
  cellophaneCost: number;
  moldCost: number;
  otherCost: number;
  total: number;
  pricePerBag: number;
  note?: string;
}

export interface BagCalcResult {
  flatWidth: number;
  flatHeight: number;
  scenarios: BagScenario[];
  bestIndex: number; // -1 if none valid
}

const MAX_SHEETS_PER_BAG = 2;

function migrateSizePricing(s: any): SizePricing {
  if (s.color1) return s;
  const d: ColorPricing = { sortPerFace: 0, printFirst1000PerFace: 0, printExtra1000PerFace: 0 };
  return {
    ...s,
    color1: {
      sortPerFace: s.sortSingleFace || 0,
      printFirst1000PerFace: s.printFirst1000PerFace || 0,
      printExtra1000PerFace: s.printExtra1000PerFace || 0,
    },
    color2: { ...d },
    color3: { ...d },
    color4: { ...d },
  };
}

function getColorPricing(size: SizePricing, colorCount: number): ColorPricing | null {
  const m = migrateSizePricing(size);
  if (colorCount <= 0) return null;
  if (colorCount === 1) return m.color1;
  if (colorCount === 2) return m.color2;
  if (colorCount === 3) return m.color3;
  return m.color4;
}

function fmtSize(w: number, h: number) {
  return `${Math.round(w)}×${Math.round(h)}`;
}

export function calculateBag(
  inputs: BagInputs,
  paperTypes: PaperType[],
  priceSettings: PriceSettings,
): BagCalcResult {
  const flatWidth = 2 * inputs.width + 2 * inputs.gusset + inputs.glueFlap;
  const flatHeight = inputs.height + inputs.base + inputs.topFlap;

  const empty: BagCalcResult = { flatWidth, flatHeight, scenarios: [], bestIndex: -1 };

  if (!inputs.quantity || inputs.quantity <= 0) return empty;
  if (flatWidth <= 0 || flatHeight <= 0) return empty;

  // Resolve paper purchase entry
  const paper = paperTypes.find(t => t.name === inputs.paperType);
  const entry = paper?.entries.find(
    e => e.sizeName === inputs.purchaseSize && e.grammage === inputs.grammage,
  );
  if (!entry) return empty;

  const purchaseW = entry.width;
  const purchaseH = entry.height;
  const pricingUnit = entry.pricingUnit || 'ton';
  const pricePerSheet = pricingUnit === 'ream'
    ? (entry.pricePerReam || 0) / Math.max(1, entry.sheetsPerReam || 500)
    : ((purchaseW / 100) * (purchaseH / 100) * (inputs.grammage || 0)) * ((entry.pricePerTon || 0) / 1_000_000);

  // Distinct machine sizes from priceSettings rows that match colorCount
  // Use the row whose color1..4 matches: actually rows in priceSettings.sizes have all 4 columns
  // for each machine. So we just iterate unique machine sizes (one row per size) and pick the
  // appropriate ColorPricing for our colorCount.
  // We treat each distinct (width,height) as a machine.
  const seen = new Set<string>();
  const machines: SizePricing[] = [];
  for (const s of priceSettings.sizes) {
    const key = `${s.width}x${s.height}`;
    if (seen.has(key)) continue;
    seen.add(key);
    machines.push(s);
  }

  const scenarios: BagScenario[] = [];

  for (const m of machines) {
    const mw = m.width;
    const mh = m.height;

    // Cuts of MACHINE sheet from PURCHASE sheet (both orientations)
    const cutsA = Math.floor(purchaseW / mw) * Math.floor(purchaseH / mh);
    const cutsB = Math.floor(purchaseW / mh) * Math.floor(purchaseH / mw);
    const machineSheetsPerPurchase = Math.max(cutsA, cutsB);

    const cp = getColorPricing(m, inputs.colorCount);

    // Case A: Flat fits inside the machine sheet (try both orientations)
    const fitA = Math.floor(mw / flatWidth) * Math.floor(mh / flatHeight);
    const fitB = Math.floor(mw / flatHeight) * Math.floor(mh / flatWidth);
    const bagsPerSheet = Math.max(fitA, fitB);

    let scenario: BagScenario;

    if (bagsPerSheet > 0) {
      // many-bags-per-sheet
      const printSheetsBase = Math.ceil(inputs.quantity / bagsPerSheet);
      const printSheets = Math.ceil(printSheetsBase * (1 + (inputs.wastePercent || 0) / 100));
      const purchaseSheets = machineSheetsPerPurchase > 0
        ? Math.ceil(printSheets / machineSheetsPerPurchase)
        : 0;

      scenario = buildScenario({
        m, mw, mh, cp, inputs, flatWidth, flatHeight,
        bagsPerSheet, sheetsPerBag: 0, printSheets, purchaseSheets,
        pricePerSheet, machineSheetsPerPurchase,
        method: `${bagsPerSheet} كيس/شيت`,
      });
    } else {
      // Big-bag: one bag may need multiple machine sheets
      // sheets-per-bag = ceil(flatWidth / mw_used) * ceil(flatHeight / mh_used)
      // try both orientations and pick min
      const spbA = Math.ceil(flatWidth / mw) * Math.ceil(flatHeight / mh);
      const spbB = Math.ceil(flatWidth / mh) * Math.ceil(flatHeight / mw);
      const sheetsPerBag = Math.min(spbA, spbB);

      if (sheetsPerBag > MAX_SHEETS_PER_BAG) {
        scenarios.push({
          machineLabel: fmtSize(mw, mh),
          machineWidth: mw, machineHeight: mh, colorCount: inputs.colorCount,
          valid: false, method: `يحتاج ${sheetsPerBag} شيت/كيس`,
          bagsPerSheet: 0, sheetsPerBag, printSheets: 0, purchaseSheets: 0,
          paperCost: 0, sortCost: 0, printCost: 0, diecutCost: 0,
          cellophaneCost: 0, moldCost: 0, otherCost: 0,
          total: 0, pricePerBag: 0,
          note: `الكيس كبير على هذا المقاس (الحد الأقصى ${MAX_SHEETS_PER_BAG} شيت/كيس)`,
        });
        continue;
      }

      const printSheetsBase = sheetsPerBag * inputs.quantity;
      const printSheets = Math.ceil(printSheetsBase * (1 + (inputs.wastePercent || 0) / 100));
      const purchaseSheets = machineSheetsPerPurchase > 0
        ? Math.ceil(printSheets / machineSheetsPerPurchase)
        : 0;

      scenario = buildScenario({
        m, mw, mh, cp, inputs, flatWidth, flatHeight,
        bagsPerSheet: 0, sheetsPerBag, printSheets, purchaseSheets,
        pricePerSheet, machineSheetsPerPurchase,
        method: `${sheetsPerBag} شيت/كيس`,
      });
    }

    scenarios.push(scenario);
  }

  // Pick best valid by total
  let bestIdx = -1;
  let bestTotal = Infinity;
  scenarios.forEach((s, i) => {
    if (s.valid && s.total > 0 && s.total < bestTotal) {
      bestTotal = s.total;
      bestIdx = i;
    }
  });

  return { flatWidth, flatHeight, scenarios, bestIndex: bestIdx };
}

function buildScenario(args: {
  m: SizePricing;
  mw: number;
  mh: number;
  cp: ColorPricing | null;
  inputs: BagInputs;
  flatWidth: number;
  flatHeight: number;
  bagsPerSheet: number;
  sheetsPerBag: number;
  printSheets: number;
  purchaseSheets: number;
  pricePerSheet: number;
  machineSheetsPerPurchase: number;
  method: string;
}): BagScenario {
  const { m, mw, mh, cp, inputs, bagsPerSheet, sheetsPerBag,
    printSheets, purchaseSheets, pricePerSheet, machineSheetsPerPurchase, method } = args;

  const paperCost = pricePerSheet * purchaseSheets;
  const thousands = Math.max(1, Math.ceil(printSheets / 1000));

  let sortCost = 0;
  let printCost = 0;
  if (cp) {
    sortCost = cp.sortPerFace * inputs.printedFaces;
    printCost = inputs.printedFaces *
      (cp.printFirst1000PerFace + Math.max(0, thousands - 1) * cp.printExtra1000PerFace);
  }

  let diecutCost = 0;
  if (inputs.diecut) {
    diecutCost = m.diecut1st1000 + Math.max(0, thousands - 1) * m.diecutExtra1000;
  }

  let cellophaneCost = 0;
  if (inputs.cellophane && inputs.cellophaneFaces > 0) {
    cellophaneCost = printSheets * inputs.cellophaneFaces * (m.cellophanePerFace || 0);
  }

  const moldCost = inputs.moldPrice || 0;
  const otherCost = inputs.otherFinishing || 0;

  const total = paperCost + sortCost + printCost + diecutCost + cellophaneCost + moldCost + otherCost;
  const pricePerBag = inputs.quantity > 0 ? total / inputs.quantity : 0;

  return {
    machineLabel: fmtSize(mw, mh),
    machineWidth: mw,
    machineHeight: mh,
    colorCount: inputs.colorCount,
    valid: machineSheetsPerPurchase > 0 && (bagsPerSheet > 0 || sheetsPerBag > 0),
    method,
    bagsPerSheet,
    sheetsPerBag,
    printSheets,
    purchaseSheets,
    paperCost,
    sortCost,
    printCost,
    diecutCost,
    cellophaneCost,
    moldCost,
    otherCost,
    total,
    pricePerBag,
    note: machineSheetsPerPurchase === 0
      ? 'مقاس الماكينة لا يخرج من شيت الشراء'
      : undefined,
  };
}
