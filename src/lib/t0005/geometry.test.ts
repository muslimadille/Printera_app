import { describe, it, expect } from "vitest";
import { buildT0005Geometry } from "./geometry";
import { buildT0005Reference } from "./reference";
import { T0005_DEFAULTS, T0005_REFERENCE } from "./types";

describe("T0005 geometry — Reference Clone Mode", () => {
  const refParams = { ...T0005_DEFAULTS, referenceMode: true };

  it("emits 19 segments: 8 CREASE + 11 OUTER/CUT", () => {
    const g = buildT0005Reference(refParams);
    expect(g.segments.length).toBe(19);
    expect(g.segments.filter(s => s.kind === "CREASE").length).toBe(8);
    expect(g.segments.filter(s => s.kind === "OUTER").length).toBe(11);
  });

  it("bbox in reference mode matches T0005.svg (885.58 × 602.112 pt ≈ 312.41 × 212.41 mm)", () => {
    const g = buildT0005Reference(refParams);
    expect(g.bbox.w).toBeGreaterThan(312.0);
    expect(g.bbox.w).toBeLessThan(313.0);
    expect(g.bbox.h).toBeGreaterThan(212.0);
    expect(g.bbox.h).toBeLessThan(213.0);
  });

  it("reference dimensions are baked in (W=100, H=150, D=50)", () => {
    const g = buildT0005Reference(refParams);
    expect(g.derived.W).toBe(T0005_REFERENCE.width);
    expect(g.derived.H).toBe(T0005_REFERENCE.height);
    expect(g.derived.D).toBe(T0005_REFERENCE.depth);
    expect(g.derived.Gf).toBe(T0005_REFERENCE.glueFlap);
  });
});

describe("T0005 geometry — Dynamic Mode Calibration", () => {
  const dynParams = { ...T0005_DEFAULTS, referenceMode: false };

  it("produces identical segment counts in dynamic mode", () => {
    const g = buildT0005Geometry(dynParams);
    expect(g.segments.length).toBe(19);
  });

  it("matches reference coordinates precisely at reference inputs", () => {
    const ref = buildT0005Reference({ ...T0005_DEFAULTS, referenceMode: true });
    const dyn = buildT0005Geometry(dynParams);
    for (let i = 0; i < ref.segments.length; i++) {
      const sRef = ref.segments[i];
      const getNum = (id: string) => id.split("_").pop();
      const sDyn = dyn.segments.find(s => getNum(s.svgId) === getNum(sRef.svgId));
      expect(sDyn).toBeDefined();
      const refPts = [sRef.start, sRef.end];
      const dynPts = [sDyn!.start, sDyn!.end];

      const tolerance = sRef.svgId === "LINE_6" ? 0.65 : 0.25;
      const matchNormal =
        Math.abs(refPts[0].x - dynPts[0].x) < tolerance &&
        Math.abs(refPts[0].y - dynPts[0].y) < tolerance &&
        Math.abs(refPts[1].x - dynPts[1].x) < tolerance &&
        Math.abs(refPts[1].y - dynPts[1].y) < tolerance;

      const matchSwapped =
        Math.abs(refPts[0].x - dynPts[1].x) < tolerance &&
        Math.abs(refPts[0].y - dynPts[1].y) < tolerance &&
        Math.abs(refPts[1].x - dynPts[0].x) < tolerance &&
        Math.abs(refPts[1].y - dynPts[0].y) < tolerance;

      if (!(matchNormal || matchSwapped)) {
        console.log(`Failed segment: ${sRef.svgId}`, {
          ref: { start: sRef.start, end: sRef.end },
          dyn: { start: sDyn!.start, end: sDyn!.end }
        });
      }
      expect(matchNormal || matchSwapped).toBe(true);
    }
  });
});
