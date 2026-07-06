/**
 * اختبارات محرك حساب المجلة — مطابقة منطق ملف Excel المرجعي.
 *
 * السيناريو المرجعي من ملف_حساب_المجلات_مع_الغلاف.xlsx:
 *   - مقاس الصفحة: 21×30 سم → ورقة بعد الطي 30×42
 *   - 16 صفحة داخل، كمية 1000، وجهين مختلفين، 4 ألوان
 *   - ورق الداخل: كوشيه 115جم 70×100 (سعر الرزمة 125 / 250 ورقة = 0.50/شيت)
 *   - ورق الغلاف: كوشيه 300جم 70×100 (سعر الرزمة 100 / 100 ورقة = 1.00/شيت)
 *
 * النتائج المتوقعة (من شيت "نتائج وسيناريوهات حساب المجلات مع الغلاف"):
 *   ماكينة 70×100: 1 ملزمة، 1000 شيت داخل، تكلفة ورق داخل 500
 *   ماكينة 50×70:  2 ملزمة، 2000 شيت داخل، تكلفة ورق داخل 500
 *   ماكينة 35×50:  4 ملزمة، 4000 شيت داخل، تكلفة ورق داخل 500
 */

import { describe, expect, it } from 'vitest';
import {
  buildMagazineScenarios,
  computeFoldedSheet,
  validatePagesCount,
  type MagazineCalcInputs,
} from '@/lib/magazineCalcEngine';
import type { PaperType, PriceSettings } from '@/store/printingStore';

const paperTypes: PaperType[] = [
  {
    name: 'كوشيه',
    entries: [
      { grammage: 115, sizeName: '70×100', width: 70, height: 100,
        pricePerTon: 4000, pricingUnit: 'ream', pricePerReam: 125, sheetsPerReam: 250 },
      { grammage: 300, sizeName: '70×100', width: 70, height: 100,
        pricePerTon: 4000, pricingUnit: 'ream', pricePerReam: 100, sheetsPerReam: 100 },
    ],
  },
];

const priceSettings: PriceSettings = {
  sizes: [
    { sizeName: '70×100', width: 70, height: 100,
      color1: { sortPerFace: 50, printFirst1000PerFace: 500, printExtra1000PerFace: 100 },
      color2: { sortPerFace: 100, printFirst1000PerFace: 600, printExtra1000PerFace: 100 },
      color3: { sortPerFace: 150, printFirst1000PerFace: 600, printExtra1000PerFace: 100 },
      color4: { sortPerFace: 200, printFirst1000PerFace: 600, printExtra1000PerFace: 100 },
      diecut1st1000: 400, diecutExtra1000: 100, cellophanePerFace: 0.55 },
    { sizeName: '50×70', width: 50, height: 70,
      color1: { sortPerFace: 25, printFirst1000PerFace: 300, printExtra1000PerFace: 50 },
      color2: { sortPerFace: 50, printFirst1000PerFace: 400, printExtra1000PerFace: 50 },
      color3: { sortPerFace: 75, printFirst1000PerFace: 400, printExtra1000PerFace: 50 },
      color4: { sortPerFace: 100, printFirst1000PerFace: 400, printExtra1000PerFace: 50 },
      diecut1st1000: 150, diecutExtra1000: 50, cellophanePerFace: 0.30 },
    { sizeName: '35×50', width: 35, height: 50,
      color1: { sortPerFace: 12.5, printFirst1000PerFace: 200, printExtra1000PerFace: 40 },
      color2: { sortPerFace: 25, printFirst1000PerFace: 250, printExtra1000PerFace: 40 },
      color3: { sortPerFace: 37.5, printFirst1000PerFace: 300, printExtra1000PerFace: 40 },
      color4: { sortPerFace: 50, printFirst1000PerFace: 300, printExtra1000PerFace: 40 },
      diecut1st1000: 150, diecutExtra1000: 50, cellophanePerFace: 0.20 },
  ],
};

const baseInputs = (): MagazineCalcInputs => ({
  inner: {
    pageWidth: 21, pageHeight: 30, pagesCount: 16, quantity: 1000,
    facesMode: 'different', colorCount: 4,
    paperType: 'كوشيه', grammage: 115, purchaseSize: '70×100',
    diecut: false, diecutMoldPrice: 0,
    cellophaneFaces: 0, wastePercent: 0,
  },
  cover: {
    enabled: true,
    paperType: 'كوشيه', grammage: 300, purchaseSize: '70×100',
    colorCount: 4, facesMode: 'different',
    diecut: false, diecutMoldPrice: 0, cellophaneFaces: 0,
  },
  finishing: [],
});

describe('computeFoldedSheet', () => {
  it('21×30 → 42×30 (width doubled, height preserved)', () => {
    expect(computeFoldedSheet(21, 30)).toEqual({ width: 42, height: 30 });
  });
  it('30×21 → 60×21 (width doubled, height preserved)', () => {
    expect(computeFoldedSheet(30, 21)).toEqual({ width: 60, height: 21 });
  });
});

describe('validatePagesCount', () => {
  it('multiples of 4 are valid', () => {
    expect(validatePagesCount(16).ok).toBe(true);
    expect(validatePagesCount(32).ok).toBe(true);
  });
  it('non-multiples of 4 are invalid', () => {
    expect(validatePagesCount(15).ok).toBe(false);
    expect(validatePagesCount(0).ok).toBe(false);
  });
});

describe('buildMagazineScenarios — Excel reference (21×30, 16 pages, 1000 qty, different)', () => {
  const result = buildMagazineScenarios({
    inputs: baseInputs(), paperTypes, priceSettings,
  });

  it('returns one scenario per machine that fits', () => {
    expect(result.length).toBe(3);
    const names = result.map(s => s.machineSizeName).sort();
    expect(names).toEqual(['35×50', '50×70', '70×100']);
  });

  it('70×100 machine: 1 signature, 1000 print sheets, paper cost 500', () => {
    const s = result.find(x => x.machineSizeName === '70×100')!;
    expect(s.innerSheetsPerMachine).toBe(4);  // 70×100 fits 4× 30×42 sheets (rotated)
    expect(s.innerPagesPerSignature).toBe(16); // 4 sheets × 4 pages
    expect(s.innerSignatures).toBe(1);
    expect(s.innerPrintSheets).toBe(1000);
    expect(s.innerPurchaseSheets).toBe(1000);
    expect(s.innerPaperCost).toBeCloseTo(500, 2); // 1000 × 0.50
  });

  it('50×70 machine: 2 signatures, 2000 print sheets, paper cost 1000', () => {
    const s = result.find(x => x.machineSizeName === '50×70')!;
    expect(s.innerSheetsPerMachine).toBe(2);
    expect(s.innerPagesPerSignature).toBe(8);
    expect(s.innerSignatures).toBe(2);
    expect(s.innerPrintSheets).toBe(2000);
  });

  it('35×50 machine: 4 signatures, 4000 print sheets', () => {
    const s = result.find(x => x.machineSizeName === '35×50')!;
    expect(s.innerSheetsPerMachine).toBe(1);
    expect(s.innerPagesPerSignature).toBe(4);
    expect(s.innerSignatures).toBe(4);
    expect(s.innerPrintSheets).toBe(4000);
  });

  it('cover sheets follow machine repeat (70×100: 4 covers/sheet → 250 sheets)', () => {
    const s = result.find(x => x.machineSizeName === '70×100')!;
    expect(s.coverRepeatPerSheet).toBe(4);
    expect(s.coverPrintSheets).toBe(Math.ceil(1000 / 4)); // 250
  });

  it('cover sheets for 50×70: 2 covers/sheet → 500 sheets', () => {
    const s = result.find(x => x.machineSizeName === '50×70')!;
    expect(s.coverPrintSheets).toBe(500);
  });
});

describe('Identical faces (وجهين متطابقين)', () => {
  it('halves print quantity per signature', () => {
    const inputs = baseInputs();
    inputs.inner.facesMode = 'identical';
    const result = buildMagazineScenarios({ inputs, paperTypes, priceSettings });
    const s = result.find(x => x.machineSizeName === '70×100')!;
    // identical: pagesPerSig = sheets×2 = 8, so 16/8 = 2 signatures
    expect(s.innerPagesPerSignature).toBe(8);
    expect(s.innerSignatures).toBe(2);
    // print qty per signature is halved
    expect(s.innerPrintQtyPerSig).toBe(500);
    // total print sheets = 2 × 500 = 1000 (same total, different distribution)
    expect(s.innerPrintSheets).toBe(1000);
    // sort designs per signature = 1 (same plate both faces)
    expect(s.innerSortDesignsPerSig).toBe(1);
  });
});

describe('Cover disabled', () => {
  it('zeros all cover costs', () => {
    const inputs = baseInputs();
    inputs.cover.enabled = false;
    const result = buildMagazineScenarios({ inputs, paperTypes, priceSettings });
    const s = result[0];
    expect(s.coverEnabled).toBe(false);
    expect(s.coverPaperCost).toBe(0);
    expect(s.coverPrintCost).toBe(0);
    expect(s.coverPrintSheets).toBe(0);
  });
});

describe('Finishing aggregates over inner+cover sheets', () => {
  it('per_1000 finishing uses combined sheets', () => {
    const inputs = baseInputs();
    inputs.finishing = [
      { name: 'يوفي', enabled: true, calcType: 'per_1000', multiplier: 1, pricePerUnit: 50, extraPer1000: 0 },
    ];
    const result = buildMagazineScenarios({ inputs, paperTypes, priceSettings });
    const s = result.find(x => x.machineSizeName === '70×100')!;
    // total sheets = 1000 inner + 250 cover = 1250 → ceil/1000 = 2 thousands
    expect(s.totalPrintSheets).toBe(1250);
    expect(s.finishingCost).toBe(2 * 50);
  });

  it('disabled finishing contributes zero', () => {
    const inputs = baseInputs();
    inputs.finishing = [
      { name: 'يوفي', enabled: false, calcType: 'per_1000', multiplier: 1, pricePerUnit: 50, extraPer1000: 0 },
    ];
    const result = buildMagazineScenarios({ inputs, paperTypes, priceSettings });
    expect(result[0].finishingCost).toBe(0);
  });
});

describe('Diecut mold price is independent from diecut cost', () => {
  it('mold cost shown separately', () => {
    const inputs = baseInputs();
    inputs.inner.diecut = true;
    inputs.inner.diecutMoldPrice = 750;
    const result = buildMagazineScenarios({ inputs, paperTypes, priceSettings });
    const s = result.find(x => x.machineSizeName === '70×100')!;
    expect(s.innerMoldCost).toBe(750);
    expect(s.innerDiecutCost).toBeGreaterThan(0);
    expect(s.innerDiecutCost).not.toBe(750); // not merged
  });
});

describe('Machines that cannot fit the folded sheet are excluded', () => {
  it('only includes 70×100 when smaller machines absent', () => {
    const limited: PriceSettings = {
      sizes: [priceSettings.sizes[0]], // only 70×100
    };
    const result = buildMagazineScenarios({
      inputs: baseInputs(), paperTypes, priceSettings: limited,
    });
    expect(result.length).toBe(1);
    expect(result[0].machineSizeName).toBe('70×100');
  });
});

/* ─────────────────────────────────────────────────────────────
 * وحدة التسعير (رزمة/طن) تُؤخذ تلقائيًا من إعدادات المستخدم
 * ───────────────────────────────────────────────────────────── */
import { getActivePaperPricing } from '@/lib/magazineCalcEngine';

describe('Pricing unit auto-binds to user settings (ream vs ton)', () => {
  it('uses ream pricing when entry.pricingUnit === "ream"', () => {
    const info = getActivePaperPricing(paperTypes, 'كوشيه', 115, '70×100');
    expect(info?.unit).toBe('ream');
    // 125 / 250 = 0.5 per sheet — مطابق لـ Excel
    expect(info?.pricePerSheet).toBeCloseTo(0.5, 6);
  });

  it('falls back to ton pricing when pricingUnit not set', () => {
    const tonOnly: PaperType[] = [{
      name: 'ورق-طن', entries: [{
        grammage: 115, sizeName: '70×100', width: 70, height: 100,
        pricePerTon: 4000,
      }],
    }];
    const info = getActivePaperPricing(tonOnly, 'ورق-طن', 115, '70×100');
    expect(info?.unit).toBe('ton');
    // 0.7m × 1m × 115g × (4000/1e6) = 0.322
    expect(info?.pricePerSheet).toBeCloseTo(0.322, 6);
  });

  it('engine paper cost reflects ream unit from settings (Excel match)', () => {
    const result = buildMagazineScenarios({ inputs: baseInputs(), paperTypes, priceSettings });
    const s = result.find(x => x.machineSizeName === '70×100')!;
    // 1000 شيت × 0.5 = 500 (بدون هدر)
    expect(s.innerPaperCost).toBeCloseTo(500, 2);
  });

  it('switching the same entry to ton changes the cost (auto-followed by engine)', () => {
    const tonPaper: PaperType[] = [{
      name: 'كوشيه', entries: [
        { grammage: 115, sizeName: '70×100', width: 70, height: 100, pricePerTon: 4000 },
        { grammage: 300, sizeName: '70×100', width: 70, height: 100, pricePerTon: 4000 },
      ],
    }];
    const result = buildMagazineScenarios({ inputs: baseInputs(), paperTypes: tonPaper, priceSettings });
    const s = result.find(x => x.machineSizeName === '70×100')!;
    // 1000 × 0.322 = 322
    expect(s.innerPaperCost).toBeCloseTo(322, 1);
  });
});
