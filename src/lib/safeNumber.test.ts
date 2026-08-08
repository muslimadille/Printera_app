import { describe, expect, it } from 'vitest';
import { finite, formatMoney, num, safeDiv, sheetsPerPurchase } from './safeNumber';
import { calculateQuote } from './calcEngine';
import type { CalculatorInputs, FinishingItem, PaperType, PriceSettings } from '@/store/printingStore';

describe('safeNumber helpers', () => {
  it('num coerces empty/null/NaN to fallback', () => {
    expect(num('')).toBe(0);
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num(NaN)).toBe(0);
    expect(num('12.5')).toBe(12.5);
    expect(num('x', 3)).toBe(3);
  });

  it('safeDiv and sheetsPerPurchase never return NaN', () => {
    expect(safeDiv(10, 0)).toBe(0);
    expect(safeDiv(0, 0)).toBe(0);
    expect(sheetsPerPurchase(70, 100, 0, 0)).toBe(0);
    expect(sheetsPerPurchase(0, 0, 10, 10)).toBe(0);
    expect(sheetsPerPurchase(70, 100, 35, 50)).toBeGreaterThan(0);
  });

  it('formatMoney never prints NaN', () => {
    expect(formatMoney(NaN)).toBe('—');
    expect(formatMoney(Infinity)).toBe('—');
    expect(formatMoney(12.345, 2)).toBe('12.35');
  });
});

describe('calculateQuote empty / zero inputs', () => {
  const paperTypes: PaperType[] = [];
  const priceSettings: PriceSettings = { sizes: [] };
  const finishing: FinishingItem[] = [];

  const emptyInputs = {
    quantity: 0,
    colorCount: 0,
    printWidth: 0,
    printHeight: 0,
    cutsPerSheet: 0,
    paperType: '',
    grammage: null,
    purchaseSize: '',
    printedFaces: 1,
    facesDifferent: false,
    wastePercent: 0,
    cellophaneFaces: 0,
    dieCut: false,
    moldPrice: 0,
    wasteInCosts: true,
    extraColorCalcType: 'per_1000' as const,
    extraColorPrice: 0,
    extraColorExtra1000: 0,
    extraColorCount: 0,
  } satisfies CalculatorInputs;

  it('returns all-finite zeros and valid=false when inputs are empty', () => {
    const result = calculateQuote(emptyInputs, finishing, paperTypes, priceSettings);
    expect(result.valid).toBe(false);
    for (const [key, value] of Object.entries(result)) {
      if (typeof value === 'number') {
        expect(Number.isFinite(value), `${key} should be finite`).toBe(true);
        expect(value).not.toBeNaN();
      }
    }
    expect(result.grandTotal).toBe(0);
    expect(result.pricePerPiece).toBe(0);
    expect(formatMoney(result.grandTotal)).not.toMatch(/NaN|Infinity/i);
  });

  it('guards zero print size even when paper + qty are set', () => {
    const papers: PaperType[] = [{
      name: 'كوشيه',
      entries: [{ grammage: 300, sizeName: '70×100', width: 70, height: 100, pricePerTon: 20000 }],
    }];
    const result = calculateQuote(
      { ...emptyInputs, quantity: 1000, cutsPerSheet: 8, paperType: 'كوشيه', grammage: 300, purchaseSize: '70×100', printWidth: 0, printHeight: 0 },
      finishing,
      papers,
      priceSettings,
    );
    expect(result.valid).toBe(false);
    expect(finite(result.grandTotal)).toBe(0);
    expect(Number.isFinite(result.printSheetsPerPurchase)).toBe(true);
  });
});
