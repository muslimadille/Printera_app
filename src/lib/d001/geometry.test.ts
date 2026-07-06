import { describe, it, expect } from "vitest";
import { buildD001Geometry } from "./geometry";
import { buildD001Reference } from "./reference";
import { D001_DEFAULTS, D001_REFERENCE } from "./types";

describe("D001 geometry — Reference Clone Mode", () => {
  const refParams = { ...D001_DEFAULTS, referenceMode: true };

  it("emits 47 OUTER + 8 CUT + 12 CREASE = 67 segments", () => {
    const g = buildD001Reference(refParams);
    expect(g.segments.length).toBe(67);
    expect(g.segments.filter(s => s.kind === "OUTER").length).toBe(47);
    expect(g.segments.filter(s => s.kind === "CUT").length).toBe(8);
    expect(g.segments.filter(s => s.kind === "CREASE").length).toBe(12);
  });

  it("bbox in reference mode matches TEMPLATE.svg (191.5 × 237.97 mm ± 0.05)", () => {
    const g = buildD001Reference(refParams);
    // TEMPLATE.svg viewBox = 543.83472 × 675.64563 pt
    // Useful path bbox in pt: x∈[0.5, 543.33472], y∈[0.5, 675.14563]
    //                       → 542.83472 × 674.64563 pt → 191.500 × 237.997 mm
    expect(g.bbox.w).toBeGreaterThan(191.40);
    expect(g.bbox.w).toBeLessThan(191.60);
    expect(g.bbox.h).toBeGreaterThan(237.90);
    expect(g.bbox.h).toBeLessThan(238.10);
  });

  it("glue flap forms a closed sub-loop via Seg 1 + Seg 47 + Seg 46", () => {
    const g = buildD001Reference(refParams);
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
    const g = buildD001Reference(refParams);
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
    const g = buildD001Reference(refParams);
    expect(g.derived.W).toBe(D001_REFERENCE.width);
    expect(g.derived.H).toBe(D001_REFERENCE.height);
    expect(g.derived.D).toBe(D001_REFERENCE.depth);
    expect(g.derived.glueFlap).toBe(D001_REFERENCE.glueFlap);
    expect(g.derived.lidCurveHeight).toBe(D001_REFERENCE.lidTongue);
  });

  it("emits dynamic SVG (no <use>, no <clipPath>, no transform=scale)", () => {
    const { svg } = buildD001Reference(refParams);
    expect(svg).toContain("<svg");
    expect(svg).not.toMatch(/<use\b/);
    expect(svg).not.toMatch(/<clipPath\b/);
    expect(svg).not.toMatch(/transform=\"scale/);
    expect(svg).toContain("#ED1C24");
    expect(svg).toContain("#00A651");
  });

  it("buildD001Geometry dispatches to reference mode when referenceMode=true", () => {
    const a = buildD001Geometry(refParams);
    const b = buildD001Reference(refParams);
    expect(a.segments.length).toBe(b.segments.length);
    expect(a.bbox.w).toBeCloseTo(b.bbox.w, 5);
    expect(a.bbox.h).toBeCloseTo(b.bbox.h, 5);
  });

  it("attached cuts 48..55 are all present in CUT group", () => {
    const g = buildD001Reference(refParams);
    const cuts = g.segments.filter(s => s.kind === "CUT");
    expect(cuts.length).toBe(8);
    for (const id of [48, 49, 50, 51, 52, 53, 54, 55]) {
      expect(cuts.find(s => s.id === id)).toBeDefined();
    }
  });

  it("CUT 49/51 are 2.25mm vertical DOWN, CUT 53/55 are 2.25mm vertical UP", () => {
    const g = buildD001Reference(refParams);
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
    // Anchors: 49 starts at end of 48, 51 at 50, 53 at 52, 55 at 54.
    const pairs: [number, number][] = [[48, 49], [50, 51], [52, 53], [54, 55]];
    for (const [a, b] of pairs) {
      const A = get(a), B = get(b);
      expect(near(A.end.x, B.start.x)).toBe(true);
      expect(near(A.end.y, B.start.y)).toBe(true);
    }
  });

  it("rendered SVG paints CUT group LAST and contains all 8 attached cuts", () => {
    const { svg } = buildD001Reference(refParams);
    for (const id of [48, 49, 50, 51, 52, 53, 54, 55]) {
      expect(svg).toContain(`data-id="CUT_${id}"`);
    }
    // CUT_48/50/52/54 are polylines (L-shape), 49/51/53/55 are <line>s.
    for (const id of [48, 50, 52, 54]) {
      expect(svg).toMatch(new RegExp(`<polyline[^/]*data-id="CUT_${id}"`));
    }
    for (const id of [49, 51, 53, 55]) {
      expect(svg).toMatch(new RegExp(`<line[^/]*data-id="CUT_${id}"`));
    }
    // CUT group is painted after OUTER group (so it cannot be overwritten).
    const outerIdx = svg.indexOf('id="OUTER"');
    const cutIdx = svg.indexOf('id="CUT"');
    expect(outerIdx).toBeGreaterThan(-1);
    expect(cutIdx).toBeGreaterThan(outerIdx);
  });
});

describe("D001 geometry — Phase 2B Dynamic Mode", () => {
  const dynParams = { ...D001_DEFAULTS, referenceMode: false };

  it("produces 47 OUTER + 8 CUT + 12 CREASE = 67 segments", () => {
    const g = buildD001Geometry(dynParams);
    expect(g.segments.length).toBe(67);
    expect(g.segments.filter(s => s.kind === "OUTER").length).toBe(47);
    expect(g.segments.filter(s => s.kind === "CUT").length).toBe(8);
    expect(g.segments.filter(s => s.kind === "CREASE").length).toBe(12);
  });

  it("at reference inputs, bbox matches Reference Clone within 0.05mm", () => {
    const d = buildD001Geometry(dynParams);
    const r = buildD001Reference(dynParams);
    expect(Math.abs(d.bbox.w - r.bbox.w)).toBeLessThan(0.05);
    expect(Math.abs(d.bbox.h - r.bbox.h)).toBeLessThan(0.05);
  });

  it("at reference inputs, every line segment matches Reference within 0.01mm (orientation-agnostic)", () => {
    const d = buildD001Geometry(dynParams);
    const r = buildD001Reference(dynParams);
    const rmap = new Map(r.segments.map(s => [s.id, s]));
    let maxDelta = 0;
    let worstId = -1;
    for (const s of d.segments) {
      const rs = rmap.get(s.id);
      if (!rs || s.geometry !== "line") continue;
      // A line is direction-agnostic: pick the orientation minimising distance.
      const aFwd = Math.max(Math.abs(s.start.x - rs.start.x), Math.abs(s.start.y - rs.start.y),
                            Math.abs(s.end.x   - rs.end.x),   Math.abs(s.end.y   - rs.end.y));
      const aRev = Math.max(Math.abs(s.start.x - rs.end.x),   Math.abs(s.start.y - rs.end.y),
                            Math.abs(s.end.x   - rs.start.x), Math.abs(s.end.y   - rs.start.y));
      const d2 = Math.min(aFwd, aRev);
      if (d2 > maxDelta) { maxDelta = d2; worstId = s.id; }
    }
    if (maxDelta >= 0.01) console.warn(`worst seg id=${worstId} delta=${maxDelta}`);
    expect(maxDelta).toBeLessThan(0.01);
  });

  it("preserves all 4 cubic Béziers (Seg 12, 14, 41, 43)", () => {
    const g = buildD001Geometry(dynParams);
    for (const id of [12, 14, 41, 43]) {
      const s = g.segments.find(x => x.id === id)!;
      expect(s.geometry).toBe("bezier");
      expect(s.preserved).toBe(true);
      expect(s.bezier).toBeDefined();
      expect(Math.abs(Math.abs(s.end.y - s.start.y) - D001_REFERENCE.lidTongue))
        .toBeLessThan(0.01);
    }
  });

  it("glue flap is closed: Seg 1 → Seg 47 → Seg 46 connect end-to-end", () => {
    const g = buildD001Geometry(dynParams);
    const s1 = g.segments.find(s => s.id === 1)!;
    const s47 = g.segments.find(s => s.id === 47)!;
    const s46 = g.segments.find(s => s.id === 46)!;
    const eq = (a:{x:number;y:number}, b:{x:number;y:number}) =>
      Math.abs(a.x-b.x) < 0.01 && Math.abs(a.y-b.y) < 0.01;
    expect(eq(s1.end, s47.start)).toBe(true);
    expect(eq(s47.end, s46.start)).toBe(true);
  });

  it("CUT 48..55 are all present in CUT group with same shapes as reference", () => {
    const g = buildD001Geometry(dynParams);
    const cuts = g.segments.filter(s => s.kind === "CUT");
    expect(cuts.length).toBe(8);
    for (const id of [48, 50, 52, 54]) {
      expect(g.segments.find(s => s.id === id)!.geometry).toBe("polyline");
    }
    for (const id of [49, 51, 53, 55]) {
      const s = g.segments.find(x => x.id === id)!;
      expect(s.geometry).toBe("line");
      expect(Math.abs(Math.abs(s.end.y - s.start.y) - 2.25)).toBeLessThan(0.01);
    }
  });

  it("CREASE 56..67 are all present", () => {
    const g = buildD001Geometry(dynParams);
    for (let id = 56; id <= 67; id++) {
      expect(g.segments.find(s => s.id === id)).toBeDefined();
    }
  });

  it("rendered SVG paints CUT group LAST (layer order CREASE → OUTER → CUT)", () => {
    const { svg } = buildD001Geometry(dynParams);
    const ic = svg.indexOf('id="CREASE"');
    const io = svg.indexOf('id="OUTER"');
    const ix = svg.indexOf('id="CUT"');
    expect(ic).toBeGreaterThan(-1);
    expect(io).toBeGreaterThan(ic);
    expect(ix).toBeGreaterThan(io);
    expect(svg).not.toMatch(/<use\b/);
    expect(svg).not.toMatch(/<clipPath\b/);
    expect(svg).not.toMatch(/transform=\"scale/);
  });

  // -------- Per-parameter sensitivity (every input drives geometry) -------
  function expectDifferent(a: ReturnType<typeof buildD001Geometry>,
                            b: ReturnType<typeof buildD001Geometry>) {
    const delta = Math.abs(a.bbox.w - b.bbox.w) + Math.abs(a.bbox.h - b.bbox.h);
    expect(delta).toBeGreaterThan(0.1);
  }

  it("changing Width only updates geometry", () => {
    const a = buildD001Geometry({ ...dynParams });
    const b = buildD001Geometry({ ...dynParams, width: 80 });
    expectDifferent(a, b);
    expect(b.segments.length).toBe(67);
  });

  it("changing Height only updates geometry", () => {
    const a = buildD001Geometry({ ...dynParams });
    const b = buildD001Geometry({ ...dynParams, height: 200 });
    expectDifferent(a, b);
    expect(Math.abs(b.bbox.h - a.bbox.h - 70)).toBeLessThan(0.01);
  });

  it("changing Depth only stretches the cover (bbox.h grows by 2·ΔD)", () => {
    const a = buildD001Geometry({ ...dynParams });
    const b = buildD001Geometry({ ...dynParams, depth: 60 });
    // Cover_Vertical = D - 0.25 → each cover panel grows by ΔD on top and bottom.
    expect(Math.abs(b.bbox.h - a.bbox.h - 2 * 20)).toBeLessThan(0.01);
    expect(b.segments.length).toBe(67);
  });

  it("changing Depth does NOT affect lid tongue (Béziers) or depth tongue heights", () => {
    const a = buildD001Geometry({ ...dynParams });
    const b = buildD001Geometry({ ...dynParams, depth: 60 });
    for (const id of [12, 14, 41, 43]) {
      const sa = a.segments.find(s => s.id === id)!;
      const sb = b.segments.find(s => s.id === id)!;
      expect(Math.abs(Math.abs(sa.end.y - sa.start.y) - Math.abs(sb.end.y - sb.start.y)))
        .toBeLessThan(0.001);
    }
  });

  it("changing Glue_Flap only updates geometry", () => {
    const a = buildD001Geometry({ ...dynParams });
    const b = buildD001Geometry({ ...dynParams, glueFlap: 20 });
    expect(Math.abs(b.bbox.w - a.bbox.w - 8)).toBeLessThan(0.01);
  });

  it("changing Lid_Tongue only updates geometry (taller lid curls)", () => {
    const a = buildD001Geometry({ ...dynParams });
    const b = buildD001Geometry({ ...dynParams, lidTongue: 20 });
    expect(Math.abs(b.bbox.h - a.bbox.h - 2 * (20 - 14.25))).toBeLessThan(0.01);
  });

  it("changing Lid_Tongue does NOT affect cover or depth tongue heights", () => {
    const a = buildD001Geometry({ ...dynParams });
    const b = buildD001Geometry({ ...dynParams, lidTongue: 25 });
    // Cover_Vertical = D - 0.25 unchanged → face top/bottom Y distance unchanged.
    // Probe with Seg 10 / Seg 45 length (cover panel vertical).
    const len = (g: typeof a, id: number) => {
      const s = g.segments.find(x => x.id === id)!;
      return Math.abs(s.end.y - s.start.y);
    };
    for (const id of [10, 16, 39, 45]) {
      expect(Math.abs(len(a, id) - len(b, id))).toBeLessThan(0.001);
    }
  });

  it("changing Depth_Tongue only updates depth tongue heights (not cover, not lid)", () => {
    const a = buildD001Geometry({ ...dynParams });
    const b = buildD001Geometry({ ...dynParams, depthTongue: 12 });
    // Cover panels (Seg 10/16/39/45) unchanged.
    const len = (g: typeof a, id: number) => {
      const s = g.segments.find(x => x.id === id)!;
      return Math.abs(s.end.y - s.start.y);
    };
    for (const id of [10, 16, 39, 45]) {
      expect(Math.abs(len(a, id) - len(b, id))).toBeLessThan(0.001);
    }
    // Lid Béziers unchanged.
    for (const id of [12, 14, 41, 43]) {
      const sa = a.segments.find(s => s.id === id)!;
      const sb = b.segments.find(s => s.id === id)!;
      expect(Math.abs(Math.abs(sa.end.y - sa.start.y) - Math.abs(sb.end.y - sb.start.y)))
        .toBeLessThan(0.001);
    }
    // Seg 4 / Seg 29 / Seg 17 / Seg 23 carry the depth-tongue vertical (seg4H).
    // Seg 4 length should grow by exactly Δdepth_tongue (12 - 5 = 7 mm).
    const s4a = a.segments.find(s => s.id === 4)!;
    const s4b = b.segments.find(s => s.id === 4)!;
    expect(Math.abs((Math.abs(s4b.end.y - s4b.start.y)) - (Math.abs(s4a.end.y - s4a.start.y)) - 7))
      .toBeLessThan(0.01);
  });
});
