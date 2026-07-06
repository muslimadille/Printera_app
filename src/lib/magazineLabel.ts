// Pure helpers for Magazines calculator scenario labels.
// Extracted so label & scenario-shape logic can be unit-tested independently
// of the React component / pricing engine.

export interface BuildPagesPerSheetInput {
  /** Pages that fit on ONE face of the press sheet (e.g. 8 for 50×70 with A4 pages). */
  pagesPerFace: number;
  /** 1 for single-sided, 2 for duplex. */
  printedFaces: 1 | 2;
  /**
   * For duplex only: true → different plates each face (work-and-tumble),
   * false → same plate both faces (work-and-turn / "وجهين متطابقين").
   */
  facesDifferent: boolean;
}

/**
 * Returns the number of UNIQUE pages produced per press sheet — the value shown
 * in the scenario label "X صفحة/شيت".
 *
 * Rules:
 *  - Single-sided:                pagesPerFace
 *  - Duplex, different sides:     pagesPerFace × 2
 *  - Duplex, identical sides:     pagesPerFace
 *    (both faces print the same plate, so unique pages do NOT double)
 */
export function uniquePagesPerSheet({
  pagesPerFace,
  printedFaces,
  facesDifferent,
}: BuildPagesPerSheetInput): number {
  return printedFaces === 2 && facesDifferent ? pagesPerFace * 2 : pagesPerFace;
}

/** Build the full scenario label text. */
export function buildScenarioLabel(
  machineSizeName: string,
  input: BuildPagesPerSheetInput,
): string {
  return `${machineSizeName} • ${uniquePagesPerSheet(input)} صفحة/شيت`;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Scenario candidate builder — mirrors the loop in MagazinesCalculator so it */
/* can be tested without rendering the React component.                       */
/* ────────────────────────────────────────────────────────────────────────── */

export interface MachineSizeLite {
  /** Display name (e.g. "50×35"). */
  sizeName: string;
  width: number;
  height: number;
}

export interface ScenarioCandidate {
  machineIdx: number;
  machineSizeName: string;
  baseCuts: 1 | 2 | 4;
  pressW: number;
  pressH: number;
  pagesPerFace: number;
  uniquePages: number;
  label: string;
}

/** Sheet-fit count (rotations allowed). */
export function fitOnSheet(
  sheetW: number,
  sheetH: number,
  pieceW: number,
  pieceH: number,
): number {
  if (sheetW <= 0 || sheetH <= 0 || pieceW <= 0 || pieceH <= 0) return 0;
  const a = Math.floor(sheetW / pieceW) * Math.floor(sheetH / pieceH);
  const b = Math.floor(sheetW / pieceH) * Math.floor(sheetH / pieceW);
  return Math.max(a, b);
}

export interface BuildCandidatesInput {
  machines: MachineSizeLite[];
  masterW: number;
  masterH: number;
  pageW: number;
  pageH: number;
  printedFaces: 1 | 2;
  facesDifferent: boolean;
}

/**
 * Pure version of the scenario loop: returns one candidate per (machine, baseCuts)
 * combination whose press sheet physically fits the machine and yields ≥ 4 pages.
 *
 * Mirrors the rules used in MagazinesCalculator → smartScenarios so we can assert
 * that machines like 50×35 always appear when they're configured.
 */
export function buildScenarioCandidates({
  machines,
  masterW,
  masterH,
  pageW,
  pageH,
  printedFaces,
  facesDifferent,
}: BuildCandidatesInput): ScenarioCandidate[] {
  const out: ScenarioCandidate[] = [];
  machines.forEach((machine, machineIdx) => {
    ([1, 2, 4] as const).forEach(baseCuts => {
      let pw = masterW;
      let ph = masterH;
      if (baseCuts === 2) {
        if (pw >= ph) pw /= 2; else ph /= 2;
      } else if (baseCuts === 4) {
        pw /= 2;
        ph /= 2;
      }

      const fitsMachine =
        (pw <= machine.width && ph <= machine.height) ||
        (pw <= machine.height && ph <= machine.width);
      if (!fitsMachine) return;

      const fit = fitOnSheet(pw, ph, pageW, pageH);
      const pagesPerFace = Math.floor(fit / 4) * 4;
      if (pagesPerFace < 4) return;

      const labelInput: BuildPagesPerSheetInput = {
        pagesPerFace,
        printedFaces,
        facesDifferent,
      };
      out.push({
        machineIdx,
        machineSizeName: machine.sizeName,
        baseCuts,
        pressW: pw,
        pressH: ph,
        pagesPerFace,
        uniquePages: uniquePagesPerSheet(labelInput),
        label: buildScenarioLabel(machine.sizeName, labelInput),
      });
    });
  });
  return out;
}
