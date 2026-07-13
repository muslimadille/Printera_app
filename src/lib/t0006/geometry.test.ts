import { describe, it, expect } from "vitest";
import { buildT0006Geometry } from "./geometry";
import { buildT0006Reference } from "./reference";
import { T0006_DEFAULTS } from "./types";

describe("T0006 geometry — Reference Clone Mode", () => {
  it("emits 32 segments: 14 CREASE + 18 OUTER/CUT", () => {
    const geo = buildT0006Reference({ ...T0006_DEFAULTS, referenceMode: true });
    const creases = geo.segments.filter((s) => s.kind === "CREASE");
    const cuts = geo.segments.filter((s) => s.kind === "OUTER" || s.kind === "CUT");

    expect(creases.length).toBe(14);
    expect(cuts.length).toBe(18);
    expect(geo.segments.length).toBe(32);
  });

  it("bbox in reference mode matches A10_10_03_03_32.svg", () => {
    const geo = buildT0006Reference({ ...T0006_DEFAULTS, referenceMode: true });
    // SVG viewBox: "0 0 885.58 775.027" -> translated to mm:
    const expectedW = 885.58 / 2.83464566929;
    const expectedH = 775.027 / 2.83464566929;

    expect(geo.bbox.w).toBeCloseTo(expectedW, 1);
    expect(geo.bbox.h).toBeCloseTo(expectedH, 1);
  });

  it("reference dimensions are baked in (W=100, H=150, D=50)", () => {
    const geo = buildT0006Reference({ ...T0006_DEFAULTS, referenceMode: true });
    expect(geo.derived.W).toBe(100);
    expect(geo.derived.H).toBe(150);
    expect(geo.derived.D).toBe(50);
  });
});

describe("T0006 geometry — Dynamic Mode Calibration", () => {
  const dynParams = {
    ...T0006_DEFAULTS,
    width: 100,
    height: 150,
    depth: 50,
    glueFlap: 12.21,
    lidTongue: 49.0,
    dustFlap: 32.0,
    referenceMode: false,
  };

  it("produces identical segment counts in dynamic mode", () => {
    const geo = buildT0006Geometry(dynParams);
    const creases = geo.segments.filter((s) => s.kind === "CREASE");
    const cuts = geo.segments.filter((s) => s.kind === "OUTER" || s.kind === "CUT");

    expect(creases.length).toBe(14);
    expect(cuts.length).toBe(18);
    expect(geo.segments.length).toBe(32);
  });

  it("matches reference coordinates precisely at reference inputs", () => {
    const ref = buildT0006Reference({ ...T0006_DEFAULTS, referenceMode: true });
    const dyn = buildT0006Geometry(dynParams);
    for (let i = 0; i < ref.segments.length; i++) {
      const sRef = ref.segments[i];
      const getNum = (id: string) => id.match(/\d+/)?.[0] || "";
      const isNotch = (id: string) => id.includes("NOTCH");
      const isTop = (s: any) => s.start.y < 130 || s.end.y < 130;
      const sDyn = dyn.segments.find(s => 
        getNum(s.svgId) === getNum(sRef.svgId) && 
        s.kind === sRef.kind && 
        isNotch(s.svgId) === isNotch(sRef.svgId) &&
        isTop(s) === isTop(sRef)
      );
      if (!sDyn) {
        console.log("Could not find dynamic match for ref segment:", sRef.svgId, "num:", getNum(sRef.svgId), "isNotch:", isNotch(sRef.svgId), "kind:", sRef.kind);
      }
      expect(sDyn).toBeDefined();
      const refPts = [sRef.start, sRef.end];
      const dynPts = [sDyn!.start, sDyn!.end];

      const isDustOrTuck = sRef.svgId.includes("POLY_18") || sRef.svgId.includes("POLY_19") || sRef.svgId.includes("POLY_24") || sRef.svgId.includes("POLY_25") || sRef.svgId === "LINE_6" || sRef.svgId === "LINE_13";
      const tolerance = isDustOrTuck ? 0.65 : 0.25;
      const matchNormal =
        (Math.abs(refPts[0].x - dynPts[0].x) <= tolerance && Math.abs(refPts[0].y - dynPts[0].y) <= tolerance) &&
        (Math.abs(refPts[1].x - dynPts[1].x) <= tolerance && Math.abs(refPts[1].y - dynPts[1].y) <= tolerance);

      const matchSwapped =
        (Math.abs(refPts[0].x - dynPts[1].x) <= tolerance && Math.abs(refPts[0].y - dynPts[1].y) <= tolerance) &&
        (Math.abs(refPts[1].x - dynPts[0].x) <= tolerance && Math.abs(refPts[1].y - dynPts[0].y) <= tolerance);

      if (!matchNormal && !matchSwapped) {
        console.log(`Failed segment: ${sRef.svgId}`, { ref: refPts, dyn: dynPts });
      }
      expect(matchNormal || matchSwapped).toBe(true);
    }
  });
});
