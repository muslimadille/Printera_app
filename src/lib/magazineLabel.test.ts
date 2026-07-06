import { describe, it, expect } from 'vitest';
import {
  uniquePagesPerSheet,
  buildScenarioLabel,
  buildScenarioCandidates,
  type MachineSizeLite,
} from '@/lib/magazineLabel';

describe('magazineLabel — وجهين متطابقين', () => {
  it('does NOT double pages when faces are identical (work-and-turn)', () => {
    // 50×70 with 8 pages/face, identical duplex → 8 unique pages, NOT 16
    expect(
      uniquePagesPerSheet({
        pagesPerFace: 8,
        printedFaces: 2,
        facesDifferent: false,
      }),
    ).toBe(8);

    // 70×100 with 16 pages/face, identical duplex → 16 unique pages, NOT 32
    expect(
      uniquePagesPerSheet({
        pagesPerFace: 16,
        printedFaces: 2,
        facesDifferent: false,
      }),
    ).toBe(16);
  });

  it('doubles pages when faces are different (work-and-tumble)', () => {
    expect(
      uniquePagesPerSheet({
        pagesPerFace: 8,
        printedFaces: 2,
        facesDifferent: true,
      }),
    ).toBe(16);

    expect(
      uniquePagesPerSheet({
        pagesPerFace: 16,
        printedFaces: 2,
        facesDifferent: true,
      }),
    ).toBe(32);
  });

  it('single-sided returns pagesPerFace untouched', () => {
    expect(
      uniquePagesPerSheet({
        pagesPerFace: 8,
        printedFaces: 1,
        facesDifferent: false,
      }),
    ).toBe(8);
  });

  it('does not multiply by copy yield when showing unique pages', () => {
    // 8 pages/face with identical duplex yields 2 physical copies/sheet,
    // but the label must stay 8 unique pages/sheet, not 16.
    expect(
      uniquePagesPerSheet({
        pagesPerFace: 8,
        printedFaces: 2,
        facesDifferent: false,
      }),
    ).toBe(8);
  });

  it('label format: machine name • N صفحة/شيت (identical sides do not inflate)', () => {
    const label = buildScenarioLabel('70×100', {
      pagesPerFace: 8,
      printedFaces: 2,
      facesDifferent: false,
    });
    expect(label).toBe('70×100 • 8 صفحة/شيت');
    expect(label).not.toContain('16');
  });

  it('label format: different sides DO inflate', () => {
    const label = buildScenarioLabel('70×100', {
      pagesPerFace: 8,
      printedFaces: 2,
      facesDifferent: true,
    });
    expect(label).toBe('70×100 • 16 صفحة/شيت');
  });
});

describe('magazineLabel — ماكينة 50×35 في السيناريوهات', () => {
  // A4-ish page (21×14.85 → use 14.85×21 to keep numbers clean) on master 70×100.
  // baseCuts=4 → press sheet 35×50. Page 14.85×21 fits 4 per face on 35×50.
  const machines: MachineSizeLite[] = [
    { sizeName: '50×35', width: 50, height: 35 },
    { sizeName: '70×50', width: 70, height: 50 },
    { sizeName: '100×70', width: 100, height: 70 },
  ];
  const baseInput = {
    machines,
    masterW: 70,
    masterH: 100,
    pageW: 14.85,
    pageH: 21,
    printedFaces: 2 as const,
  };

  it('includes a scenario for 50×35 when configured (different sides)', () => {
    const candidates = buildScenarioCandidates({ ...baseInput, facesDifferent: true });
    const m50x35 = candidates.filter(c => c.machineSizeName === '50×35');
    expect(m50x35.length).toBeGreaterThan(0);

    const c = m50x35[0];
    expect(c.baseCuts).toBe(4);
    // Press sheet 35×50, A4-ish page → 4 pages/face (multiple of 4).
    expect(c.pagesPerFace).toBe(4);
    // Different sides → unique pages = pagesPerFace × 2.
    expect(c.uniquePages).toBe(8);
    expect(c.label).toBe('50×35 • 8 صفحة/شيت');
  });

  it('50×35 scenario uses unique-page rule for identical sides (no doubling)', () => {
    const candidates = buildScenarioCandidates({ ...baseInput, facesDifferent: false });
    const c = candidates.find(x => x.machineSizeName === '50×35');
    expect(c).toBeDefined();
    expect(c!.uniquePages).toBe(c!.pagesPerFace); // identical sides → no double
    expect(c!.label).toBe('50×35 • 4 صفحة/شيت');
  });

  it('omits 50×35 only when it is NOT in the configured machines list', () => {
    const without50x35 = machines.filter(m => m.sizeName !== '50×35');
    const candidates = buildScenarioCandidates({
      ...baseInput,
      machines: without50x35,
      facesDifferent: true,
    });
    expect(candidates.find(c => c.machineSizeName === '50×35')).toBeUndefined();
  });

  it('every configured machine that physically fits the press sheet appears at least once', () => {
    const candidates = buildScenarioCandidates({ ...baseInput, facesDifferent: true });
    for (const m of machines) {
      expect(candidates.find(c => c.machineSizeName === m.sizeName)).toBeDefined();
    }
  });
});
