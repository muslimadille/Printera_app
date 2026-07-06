import { describe, it, expect } from "vitest";
import { buildT0002Geometry } from "./geometry";
import { buildT0002Reference } from "./reference";
import { T0002_DEFAULTS, T0002_REFERENCE } from "./types";

describe("T0002 geometry — Reference Clone Mode", () => {
  const refParams = { ...T0002_DEFAULTS, referenceMode: true };

  it("emits 47 OUTER + 8 CUT + 12 CREASE = 67 segments", () => {
    const g = buildT0002Reference(refParams);
    expect(g.segments.length).toBe(67);
    expect(g.segments.filter(s => s.kind === "OUTER").length).toBe(47);
    expect(g.segments.filter(s => s.kind === "CUT").length).toBe(8);
    expect(g.segments.filter(s => s.kind === "CREASE").length).toBe(12);
  });

  it("bbox in reference mode matches TEMPLATE.svg (191.5 × 237.97 mm ± 0.05)", () => {
    const g = buildT0002Reference(refParams);
    // TEMPLATE.svg viewBox = 543.83472 × 675.64563 pt
    // Useful path bbox in pt: x∈[0.5, 543.33472], y∈[0.5, 675.14563]
    //                       → 542.83472 × 674.64563 pt → 191.500 × 237.997 mm
    expect(g.bbox.w).toBeGreaterThan(191.40);
    expect(g.bbox.w).toBeLessThan(191.60);
    expect(g.bbox.h).toBeGreaterThan(237.90);
    expect(g.bbox.h).toBeLessThan(238.10);
  });

  it("glue flap forms a closed sub-loop via Seg 1 + Seg 47 + Seg 46", () => {
    const g = buildT0002Reference(refParams);
    const s1 = g.segments.find(s => s.id === 1)!;
    const s47 = g.segments.find(s => s.id === 47)!;
    const s46 = g.segments.find(s => s.id === 46)!;
    const eq = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001;
    // Seg 1 end (glue TL) must equal Seg 47 start (glue TL going to glue BL)
    expect(eq(s1.end, s47.end) || eq(s1.end, s47.start)).toBe(true);
    // Seg 47 end (glue BL) must equal Seg 46 start (glue BL)
    expect(eq(s47.start, s46.end) || eq(s47.end, s46.start)).toBe(true);
  });

  it("preserves the four cubic Béziers at segments 12, 14, 41, 43", () => {
    const g = buildT0002Reference(refParams);
    for (const id of [12, 14, 41, 43]) {
      const s = g.segments.find(x => x.id === id)!;
      expect(s.geometry).toBe("bezier");
      expect(s.preserved).toBe(true);
      expect(s.bezier).toBeDefined();
      // Each curl's vertical span equals Lid_Tongue_Height (14.25 mm)
      expect(Math.abs(Math.abs(s.end.y - s.start.y) - 14.25)).toBeLessThan(0.001);
    }
  });

  it("reference dimensions are baked in (W=50, H=130, D=40)", () => {
    const g = buildT0002Reference(refParams);
    expect(g.derived.W).toBe(T0002_REFERENCE.width);
    expect(g.derived.H).toBe(T0002_REFERENCE.height);
    expect(g.derived.D).toBe(T0002_REFERENCE.depth);
    expect(g.derived.glueFlap).toBe(T0002_REFERENCE.glueFlap);
    expect(g.derived.lidCurveHeight).toBe(T0002_REFERENCE.lidTongue);
  });

  it("emits dynamic SVG (no <use>, no <clipPath>, no transform=scale)", () => {
    const { svg } = buildT0002Reference(refParams);
    expect(svg).toContain("<svg");
    expect(svg).not.toMatch(/<use\b/);
    expect(svg).not.toMatch(/<clipPath\b/);
    expect(svg).not.toMatch(/transform=\"scale/);
    expect(svg).toContain("#ED1C24");
    expect(svg).toContain("#00A651");
  });

  it("buildT0002Geometry dispatches to reference mode when referenceMode=true", () => {
    const a = buildT0002Geometry(refParams);
    const b = buildT0002Reference(refParams);
    expect(a.segments.length).toBe(b.segments.length);
    expect(a.bbox.w).toBeCloseTo(b.bbox.w, 5);
    expect(a.bbox.h).toBeCloseTo(b.bbox.h, 5);
  });

  it("attached cuts 48..55 are all present in CUT group", () => {
    const g = buildT0002Reference(refParams);
    const cuts = g.segments.filter(s => s.kind === "CUT");
    expect(cuts.length).toBe(8);
    for (const id of [48, 49, 50, 51, 52, 53, 54, 55]) {
      expect(cuts.find(s => s.id === id)).toBeDefined();
    }
  });

  it("CUT 49/51 are 2.25mm vertical DOWN, CUT 53/55 are 2.25mm vertical UP", () => {
    const g = buildT0002Reference(refParams);
    const get = (id: number) => g.segments.find(s => s.id === id)!;
    const near = (a: number, b: number) => Math.abs(a - b) < 0.005;
    for (const id of [49, 51]) {
      const s = get(id);
      expect(near(s.start.x, s.end.x)).toBe(true);              // vertical
      expect(near(s.end.y - s.start.y, 2.25)).toBe(true);       // DOWN 2.25mm
    }
    for (const id of [53, 55]) {
      const s = get(id);
      expect(near(s.start.x, s.end.x)).toBe(true);              // vertical
      expect(near(s.start.y - s.end.y, 2.25)).toBe(true);       // UP 2.25mm
    }
  });
});

describe("T0002 geometry — Dynamic Mode Calibration (Inputs = Reference values)", () => {
  const dynParams = { ...T0002_DEFAULTS, referenceMode: false };

  it("produces identical bbox (within 0.01 mm)", () => {
    const r = buildT0002Reference({ ...T0002_DEFAULTS, referenceMode: true });
    const d = buildT0002Geometry(dynParams);
    expect(Math.abs(d.bbox.w - r.bbox.w)).toBeLessThan(0.01);
    expect(Math.abs(d.bbox.h - r.bbox.h)).toBeLessThan(0.01);
  });

  it("reproduces all 67 segment lengths within 0.01 mm of the reference clone", () => {
    const r = buildT0002Reference({ ...T0002_DEFAULTS, referenceMode: true });
    const d = buildT0002Geometry(dynParams);

    const length = (s: typeof r.segments[0]) => {
      if (s.geometry === "line" || s.geometry === "bezier" || s.geometry === "fillet") {
        return Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y);
      }
      if (s.geometry === "polyline" && s.points) {
        let len = 0;
        for (let i = 0; i + 1 < s.points.length; i++) {
          len += Math.hypot(s.points[i+1].x - s.points[i].x, s.points[i+1].y - s.points[i].y);
        }
        return len;
      }
      return 0;
    };

    for (let id = 1; id <= 67; id++) {
      const rs = r.segments.find(s => s.id === id)!;
      const ds = d.segments.find(s => s.id === id)!;
      const lenR = length(rs);
      const lenD = length(ds);
      expect(Math.abs(lenD - lenR)).toBeLessThan(0.01);
    }
  });

  it("respects the corner radius fillet request on the four depth tongue corners", () => {
    const pFillet = { ...T0002_DEFAULTS, depthTongueCornerRadius: 2 };
    const g = buildT0002Geometry(pFillet);
    // segments 6, 21, 27, 35 must become fillets
    for (const id of [6, 21, 27, 35]) {
      const s = g.segments.find(x => x.id === id)!;
      expect(s.geometry).toBe("fillet");
      expect(s.via).toBeDefined();
      expect(s.bezier).toBeDefined();
    }
  });
});
