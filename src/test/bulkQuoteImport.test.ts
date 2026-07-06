import { describe, expect, it } from 'vitest';
import { calculateQuote } from '@/lib/calcEngine';
import {
  bulkQuoteFieldAliases,
  parseFinishingItems,
  readBulkQuoteNumberField,
} from '@/lib/bulkQuoteImport';
import type { CalculatorInputs, PaperType, PriceSettings } from '@/store/printingStore';

describe('bulk quote import helpers', () => {
  it('supports legacy headers and preserves zero waste', () => {
    const row = {
      'عدد القطع': 5000,
      'نسبة الهدر %': 0,
      'عرض الطباعة (سم)': 21,
    };

    expect(readBulkQuoteNumberField(row, bulkQuoteFieldAliases.quantity, 0)).toBe(5000);
    expect(readBulkQuoteNumberField(row, bulkQuoteFieldAliases.wastePercent, 10)).toBe(0);
    expect(readBulkQuoteNumberField(row, bulkQuoteFieldAliases.printWidth, 0)).toBe(21);
  });

  it('parses finishing items from Arabic labels and localized numbers', () => {
    const items = parseFinishingItems({
      'تشطيب 1 - الاسم': 'ورنيش',
      'تشطيب 1 - نوع الحساب': 'لكل قطعة',
      'تشطيب 1 - عدد المتغيرات': '٢',
      'تشطيب 1 - السعر': '٠٫٥',
      'تشطيب 1 - سعر كل 1000 إضافي': '',
      'تشطيب 2 - الاسم': 'طي',
      'تشطيب 2 - نوع الحساب': 'لكل ألف',
      'تشطيب 2 - عدد المتغيرات': '1',
      'تشطيب 2 - السعر': '50',
      'تشطيب 2 - سعر كل 1000 إضافي': '20',
    });

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      name: 'ورنيش',
      enabled: true,
      calcType: 'per_piece',
      multiplier: 2,
      pricePerUnit: 0.5,
      extraPer1000: 0,
    });
    expect(items[1]).toMatchObject({
      name: 'طي',
      enabled: true,
      calcType: 'per_1000',
      multiplier: 1,
      pricePerUnit: 50,
      extraPer1000: 20,
    });
  });

  it('includes imported finishing in the calculated total', () => {
    const paperTypes: PaperType[] = [{
      name: 'كوشيه',
      entries: [{ grammage: 300, sizeName: '70×100', width: 70, height: 100, pricePerTon: 4000 }],
    }];
    const zeroColor = { sortPerFace: 0, printFirst1000PerFace: 0, printExtra1000PerFace: 0 };
    const priceSettings: PriceSettings = {
      sizes: [{
        sizeName: '70×100',
        width: 70,
        height: 100,
        color1: zeroColor,
        color2: zeroColor,
        color3: zeroColor,
        color4: zeroColor,
        diecut1st1000: 0,
        diecutExtra1000: 0,
        cellophanePerFace: 0,
      }],
    };
    const inputs: CalculatorInputs = {
      paperType: 'كوشيه',
      purchaseSize: '70×100',
      grammage: 300,
      quantity: 100,
      printWidth: 70,
      printHeight: 100,
      cutsPerSheet: 1,
      wastePercent: 0,
      colorCount: 0,
      printedFaces: 1,
      facesDifferent: false,
      cellophaneFaces: 0,
      dieCut: false,
      moldPrice: 0,
      extraColorCalcType: 'per_1000',
      extraColorPrice: 0,
      extraColorExtra1000: 0,
      extraColorCount: 1,
      wasteInCosts: true,
    };

    const result = calculateQuote(inputs, parseFinishingItems({
      'تشطيب 1 - الاسم': 'ورنيش',
      'تشطيب 1 - نوع الحساب': 'لكل قطعة',
      'تشطيب 1 - عدد المتغيرات': 1,
      'تشطيب 1 - السعر': 0.5,
    }), paperTypes, priceSettings);

    expect(result.valid).toBe(true);
    expect(result.totalFinishing).toBeCloseTo(50);
  });
});