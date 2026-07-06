// T0002 — Reference Clone Geometry
// ----------------------------------------------------------------------------
// Every coordinate below is lifted from template.svg
// (the bundled TEMPLATE.svg) and converted from pt to mm using
//   PT_PER_MM = 2.83464566929 pt/mm  ⇔  1 pt = 0.35277777778 mm
//
// The OUTER contour reproduces TEMPLATE.svg verbatim. Bezier control points
// (Seg 12, 14, 41, 43) are preserved as absolute mm coordinates derived from
// the path's c-deltas.
//
// User-required anchors:
//   Seg 1   — glue-flap top chamfer  (Face1 TL → Glue TL)
//   Seg 47  — glue-flap left vertical (Glue TL → Glue BL)
//   Seg 46  — glue-flap bottom chamfer (Glue BL → Face1 BL)
//   Seg 12  — top-lid LEFT  curl (preserved Bézier)
//   Seg 14  — top-lid RIGHT curl (preserved Bézier)
//   Seg 41  — bottom-lid RIGHT curl (preserved Bézier)
//   Seg 43  — bottom-lid LEFT  curl (preserved Bézier)
//   Total: 47 OUTER + 8 CUT + 12 CREASE = 67 segments.
// ----------------------------------------------------------------------------

import type { Pt, Segment, T0002Geometry } from "./geometry";
import type { T0002Params } from "./types";
import { T0002_REFERENCE } from "./types";

export const PT_PER_MM = 2.83464566929;
const m = (pt: number) => pt / PT_PER_MM;
const P = (xPt: number, yPt: number): Pt => ({ x: m(xPt), y: m(yPt) });

function outer(id: number, start: Pt, end: Pt): Segment {
  return { id, svgId: `LINE_${id}`, kind: "OUTER", geometry: "line", start, end };
}
function outerBezier(id: number, start: Pt, c1: Pt, c2: Pt, end: Pt): Segment {
  return {
    id, svgId: `LINE_${id}`, kind: "OUTER", geometry: "bezier",
    start, end, bezier: { c1, c2 }, preserved: true,
  };
}
function cut(id: number, s: Pt, e: Pt): Segment {
  return { id, svgId: `CUT_${id}`, kind: "CUT", geometry: "line", start: s, end: e };
}
function cutPolyline(id: number, pts: Pt[]): Segment {
  return {
    id, svgId: `CUT_${id}`, kind: "CUT", geometry: "polyline",
    start: pts[0], end: pts[pts.length - 1], points: pts,
  };
}
function crease(id: number, s: Pt, e: Pt): Segment {
  return { id, svgId: `CREASE_${id}`, kind: "CREASE", geometry: "line", start: s, end: e };
}

// ============================================================================
export function buildT0002Reference(params: T0002Params): T0002Geometry {
  const segments: Segment[] = [];

  // ====== OUTER CUT CONTOUR — 47 segments, CCW from Face1 TL ===============
  // Glue flap (3 segments closing as a sub-loop):
  segments.push(outer( 1, P( 34.51575, 153.57089), P(  0.50000, 169.43268))); // Face1 TL → Glue TL
  segments.push(outer(47, P(  0.50000, 169.43268), P(  0.50000, 506.21295))); // Glue TL  → Glue BL
  segments.push(outer(46, P(  0.50000, 506.21295), P( 34.51575, 522.07477))); // Glue BL  → Face1 BL

  // Bottom-lid panel + tongue (CCW Face1 BL → Depth1 BL):
  segments.push(outer(45, P( 34.51575, 522.07477), P( 34.51575, 634.75196))); // Face1 left vertical DOWN
  segments.push(outer(44, P( 34.51575, 634.75196), P( 35.93311, 634.75196))); // 0.5mm RIGHT
  segments.push(outerBezier(43,
    P( 35.93311, 634.75196),
    P( 35.93311, 651.05622), P( 44.17737, 666.25477),
    P( 57.84424, 675.14564))); // bottom-LEFT curl DOWN-RIGHT (preserved Bézier)
  segments.push(outer(42, P( 57.84424, 675.14564), P(152.91968, 675.14564))); // apex horizontal RIGHT
  segments.push(outerBezier(41,
    P(152.91968, 675.14564),
    P(166.58643, 666.25477), P(174.83075, 651.05622),
    P(174.83075, 634.75196))); // bottom-RIGHT curl UP-RIGHT (preserved Bézier)
  segments.push(outer(40, P(174.83075, 634.75196), P(176.24811, 634.75196))); // 0.5mm RIGHT
  segments.push(outer(39, P(176.24811, 634.75196), P(176.24811, 522.07477))); // Depth1 BL vertical UP

  // Depth1 bottom tongue (CCW Depth1 BL → Face2 BL−0.75):
  segments.push(outer(38, P(176.24811, 522.07477), P(184.75202, 530.57874))); // DOWN-RIGHT chamfer (3,3)
  segments.push(outer(37, P(184.75202, 530.57874), P(190.42133, 598.61023))); // DOWN-RIGHT long ramp
  segments.push(outer(36, P(190.42133, 598.61023), P(266.64783, 598.61023))); // horizontal RIGHT (≈26.9mm)
  segments.push(outer(35, P(266.64783, 598.61023), P(281.83863, 541.91730))); // UP-RIGHT long ramp
  segments.push(outer(34, P(281.83863, 541.91730), P(287.50794, 536.24799))); // UP-RIGHT chamfer
  segments.push(outer(33, P(287.50794, 536.24799), P(287.50794, 522.07477))); // UP 5mm to face_bot

  // Face2 bottom (cmd 35 split into 3 sub-segments at the two 0.75mm stubs):
  segments.push(outer(32, P(287.50794, 522.07477), P(289.63392, 522.07477))); // 0.75 RIGHT (face1/face2 stub)
  segments.push(outer(31, P(289.63392, 522.07477), P(431.36621, 522.07477))); // Face2 bottom 50mm RIGHT
  segments.push(outer(30, P(431.36621, 522.07477), P(433.49219, 522.07477))); // 0.75 RIGHT (face2/depth2 stub)

  // Depth2 bottom tongue (CCW Face2 BR+0.75 → Depth2 BR):
  segments.push(outer(29, P(433.49219, 522.07477), P(433.49219, 536.24799))); // DOWN 5mm
  segments.push(outer(28, P(433.49219, 536.24799), P(439.16150, 541.91730))); // DOWN-RIGHT chamfer
  segments.push(outer(27, P(439.16150, 541.91730), P(454.35230, 598.61023))); // DOWN-RIGHT ramp
  segments.push(outer(26, P(454.35230, 598.61023), P(529.16150, 598.61023))); // horizontal RIGHT
  segments.push(outer(25, P(529.16150, 598.61023), P(534.83069, 530.57874))); // UP-RIGHT ramp
  segments.push(outer(24, P(534.83069, 530.57874), P(543.33472, 522.07477))); // UP-RIGHT chamfer

  // Depth2 right vertical + top chamfer:
  segments.push(outer(23, P(543.33472, 522.07477), P(543.33472, 139.39764))); // Depth2 right vertical UP (full H)
  segments.push(outer(22, P(543.33472, 139.39764), P(537.66541, 133.72833))); // UP-LEFT 2,2 chamfer

  // Depth2 top tongue (CCW from upper-right back down to Face2 TR):
  segments.push(outer(21, P(537.66541, 133.72833), P(522.47461,  77.03546))); // UP-LEFT long ramp
  segments.push(outer(20, P(522.47461,  77.03546), P(445.53943,  77.03546))); // LEFT 27.15mm
  segments.push(outer(19, P(445.53943,  77.03546), P(439.87012, 145.06695))); // DOWN-LEFT long ramp
  segments.push(outer(18, P(439.87012, 145.06695), P(431.36621, 153.57086))); // DOWN-LEFT chamfer (→ Face2 TR)

  // Face2 right edge UP to top-lid tongue base, then top-lid tongue:
  segments.push(outer(17, P(431.36621, 153.57086), P(431.36621,  40.89368))); // Face2 right vertical UP (cover 39.75)
  segments.push(outer(16, P(431.36621,  40.89368), P(429.94885,  40.89368))); // 0.5mm LEFT
  segments.push(outer(15, P(429.94885,  40.89368), P(429.94885,  40.89368))); // [reserved spacer — see Note A]

  // Note A: TEMPLATE.svg has 7 path commands in the top-lid region but Excel
  // numbering allocates 8 IDs (10..17). We keep ID 15 as a 0-length anchor at
  // the right-curl base so all 47 IDs are populated. The right curl starts
  // immediately at NODES[6] = (429.94885, 40.89368).

  segments.push(outerBezier(14,
    P(429.94885,  40.89368),
    P(429.94885,  24.58942), P(421.70459,   9.39087),
    P(408.03772,   0.50000))); // top-RIGHT curl UP-LEFT (preserved Bézier)
  segments.push(outer(13, P(408.03772,   0.50000), P(312.96234,   0.50000))); // apex horizontal LEFT
  segments.push(outerBezier(12,
    P(312.96234,   0.50000),
    P(299.29553,   9.39087), P(291.05121,  24.58942),
    P(291.05121,  40.89368))); // top-LEFT curl DOWN-LEFT (preserved Bézier)
  segments.push(outer(11, P(291.05121,  40.89368), P(289.63391,  40.89368))); // 0.5mm LEFT
  segments.push(outer(10, P(289.63391,  40.89368), P(289.63391, 153.57088))); // Depth1 right vertical DOWN (cover 39.75)

  // Depth1 top tongue (CCW Face2 TL → Face1 TR+0.75):
  segments.push(outer( 9, P(289.63391, 153.57088), P(281.12994, 145.06697))); // UP-LEFT chamfer
  segments.push(outer( 8, P(281.12994, 145.06697), P(275.46069,  77.03548))); // UP-LEFT long ramp
  segments.push(outer( 7, P(275.46069,  77.03548), P(199.23419,  77.03548))); // LEFT 26.9mm
  segments.push(outer( 6, P(199.23419,  77.03548), P(184.04333, 133.72836))); // DOWN-LEFT long ramp
  segments.push(outer( 5, P(184.04333, 133.72836), P(178.37408, 139.39767))); // DOWN-LEFT chamfer
  segments.push(outer( 4, P(178.37408, 139.39767), P(178.37408, 153.57089))); // DOWN 5mm to face_top

  // Face1 top (cmd 18 split into 2 sub-segments at the depth1-stub):
  segments.push(outer( 3, P(178.37408, 153.57089), P(176.24811, 153.57089))); // 0.75 LEFT (depth1 stub)
  segments.push(outer( 2, P(176.24811, 153.57089), P( 34.51575, 153.57089))); // Face1 top 50mm LEFT to Face1 TL

  // ====== ATTACHED CUT LINES (Segments 48..55) — verbatim from TEMPLATE.svg
  // TEMPLATE.svg encodes each notch as a 4-point polyline (DOWN → horizontal
  // → vertical). We map each polyline to a 2-segment pair:
  //   • 48/50/52/54  = L-shape (vertical stub + horizontal hop)  — polyline
  //   • 49/51/53/55  = the inner vertical (2.25 mm) — line, anchored at L tip.
  // Anchoring CUT_49/51/53/55 at the L-tip (NOT on the outer cut x) is what
  // makes them visible — otherwise they overlap OUTER segs 17/10/45/39.
  // Top-right notch (Face2 / Depth2 corner, near top-lid):
  segments.push(cutPolyline(48, [
    P(431.36621, 43.01969), P(431.36621, 40.89370), P(411.52368, 40.89370),
  ]));
  segments.push(cut(49, P(411.52368, 40.89370), P(411.52368, 47.27166)));
  // Top-left notch (Face1 / Depth1 corner, near top-lid):
  segments.push(cutPolyline(50, [
    P(289.63391, 43.01969), P(289.63391, 40.89370), P(309.47644, 40.89370),
  ]));
  segments.push(cut(51, P(309.47644, 40.89370), P(309.47644, 47.27166)));
  // Bottom-left notch (Face1 / Glue corner, near bottom-lid):
  segments.push(cutPolyline(52, [
    P( 34.51575, 632.62598), P( 34.51575, 634.75195), P( 54.35828, 634.75195),
  ]));
  segments.push(cut(53, P( 54.35828, 634.75195), P( 54.35828, 628.37396)));
  // Bottom-right notch (Face1 / Depth1 corner, near bottom-lid):
  segments.push(cutPolyline(54, [
    P(176.24811, 632.62598), P(176.24811, 634.75195), P(156.40552, 634.75195),
  ]));
  segments.push(cut(55, P(156.40552, 634.75195), P(156.40552, 628.37396)));

  // ====== CREASE LINES (Segments 56..67) — verbatim from TEMPLATE.svg ======
  segments.push(crease(56, P(431.36621, 153.57088), P(431.36621, 522.07477)));
  segments.push(crease(57, P(289.63391, 153.57088), P(289.63391, 522.07477)));
  segments.push(crease(58, P(176.24811, 522.07477), P(176.24811, 153.57088)));
  segments.push(crease(59, P( 34.51575, 522.07477), P( 34.51575, 153.57088)));
  segments.push(crease(60, P(433.49219, 522.07477), P(543.33472, 522.07477)));
  segments.push(crease(61, P( 34.51575, 523.49213), P(176.24811, 523.49213)));
  segments.push(crease(62, P(156.40552, 632.62598), P( 54.35828, 632.62598)));
  segments.push(crease(63, P(287.50790, 522.07477), P(176.24808, 522.07477)));
  segments.push(crease(64, P(178.37399, 153.57088), P(289.63382, 153.57088)));
  segments.push(crease(65, P(543.33472, 153.57088), P(431.36621, 153.57088)));
  segments.push(crease(66, P(289.63385, 152.15355), P(431.36615, 152.15355)));
  segments.push(crease(67, P(411.52368,  43.01969), P(309.47644,  43.01969)));

  return finalize(params, segments);
}

// ----------------------------------------------------------------------------
function finalize(params: T0002Params, segs: Segment[]): T0002Geometry {
  const all: Pt[] = [];
  for (const s of segs) {
    all.push(s.start, s.end);
    if (s.bezier) all.push(s.bezier.c1, s.bezier.c2);
    if (s.points) all.push(...s.points);
  }
  const minX = Math.min(...all.map(p => p.x));
  const minY = Math.min(...all.map(p => p.y));
  const maxX = Math.max(...all.map(p => p.x));
  const maxY = Math.max(...all.map(p => p.y));
  const bbox = { w: maxX - minX, h: maxY - minY };
  const r = (n: number) => Math.round(n * 100000) / 100000;
  const shift = (p: Pt): Pt => ({ x: r(p.x - minX), y: r(p.y - minY) });
  const shifted: Segment[] = segs.map(s => ({
    ...s,
    start: shift(s.start),
    end:   shift(s.end),
    bezier: s.bezier ? { c1: shift(s.bezier.c1), c2: shift(s.bezier.c2) } : undefined,
    points: s.points ? s.points.map(shift) : undefined,
  }));

  return {
    params,
    derived: {
      W: T0002_REFERENCE.width,
      H: T0002_REFERENCE.height,
      D: T0002_REFERENCE.depth,
      glueFlap: T0002_REFERENCE.glueFlap,
      faceHeight: T0002_REFERENCE.height + 0.5,
      depth1: T0002_REFERENCE.depth,
      depth2: T0002_REFERENCE.depth - 0.5,
      coverVertical: T0002_REFERENCE.depth - 0.25,
      lidCurveHeight: T0002_REFERENCE.lidTongue,
      seg4Height: T0002_REFERENCE.depthTongue,
      width: bbox.w,
      height: bbox.h,
    },
    segments: shifted,
    bbox,
    svg: renderReferenceSvg(shifted, bbox),
  };
}

function renderReferenceSvg(segs: Segment[], bbox: { w: number; h: number }): string {
  const r = (n: number) => Math.round(n * 100000) / 100000;
  const cutCol = "#ED1C24";
  const crsCol = "#00A651";
  const w = r(bbox.w), h = r(bbox.h);
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">`);

  // ---- Layer order (bottom → top): CREASE → OUTER → CUT ---------------------
  out.push(`  <g id="CREASE" fill="none" stroke="${crsCol}" stroke-miterlimit="10">`);
  for (const s of segs.filter(s => s.kind === "CREASE")) {
    out.push(`    <line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}" data-id="${s.svgId}"/>`);
  }
  out.push(`  </g>`);

  out.push(`  <g id="OUTER" fill="none" stroke="${cutCol}" stroke-miterlimit="10">`);
  for (const s of segs.filter(s => s.kind === "OUTER")) {
    if (s.geometry === "line" && s.start.x === s.end.x && s.start.y === s.end.y) continue;
    if (s.geometry === "bezier" && s.bezier) {
      out.push(`    <path d="M${s.start.x},${s.start.y} C${s.bezier.c1.x},${s.bezier.c1.y} ${s.bezier.c2.x},${s.bezier.c2.y} ${s.end.x},${s.end.y}" data-id="${s.svgId}" data-preserved="true"/>`);
    } else {
      out.push(`    <line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}" data-id="${s.svgId}"/>`);
    }
  }
  out.push(`  </g>`);

  out.push(`  <g id="CUT" fill="none" stroke="${cutCol}" stroke-linecap="round" stroke-linejoin="round" opacity="1">`);
  for (const s of segs.filter(s => s.kind === "CUT")) {
    if (s.geometry === "polyline" && s.points && s.points.length >= 2) {
      const pts = s.points.map(p => `${p.x},${p.y}`).join(" ");
      out.push(`    <polyline points="${pts}" data-id="${s.svgId}"/>`);
    } else {
      out.push(`    <line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}" data-id="${s.svgId}"/>`);
    }
  }
  out.push(`  </g>`);

  out.push(`</svg>`);
  return out.join("\n");
}
