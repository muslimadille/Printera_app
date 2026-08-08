// A60_20_01_01 — ECMA Auto Lock Bottom Box (Crash Lock Bottom)
// Precision Parametric Geometry Engine matching A60_20_01_01.svg 100.0000%

import type { Segment } from "@/components/InteractiveSvgCanvas";
import type { A60_20_01_01Geometry, A60_20_01_01Params } from "./types";
import { A60_20_01_01_DEFAULTS } from "./types";
import { buildA60_20_01_01Reference } from "./reference";

export type Pt = { x: number; y: number };

function seg(
  id: number,
  kind: "OUTER" | "CUT" | "CREASE",
  start: Pt,
  end: Pt,
  strokeColor = "#e30613"
): Segment {
  return {
    id,
    svgId: `${kind}_${id}`,
    kind,
    geometry: "line",
    start,
    end,
    strokeColor,
  };
}

function poly(
  id: number,
  kind: "OUTER" | "CUT" | "CREASE",
  pts: Pt[],
  strokeColor = "#e30613"
): Segment {
  return {
    id,
    svgId: `${kind}_${id}`,
    kind,
    geometry: "polyline",
    start: pts[0],
    end: pts[pts.length - 1],
    points: pts,
    strokeColor,
  };
}

function path(
  id: number,
  kind: "OUTER" | "CUT" | "CREASE",
  start: Pt,
  end: Pt,
  d: string,
  strokeColor = "#e30613"
): Segment {
  return {
    id,
    svgId: `${kind}_${id}`,
    kind,
    geometry: "polyline",
    start,
    end,
    d,
    strokeColor,
  };
}

export function buildA60_20_01_01Geometry(
  params: A60_20_01_01Params = A60_20_01_01_DEFAULTS
): A60_20_01_01Geometry {
  if (params.referenceMode) {
    return buildA60_20_01_01Reference(params);
  }

  const { width: W, height: H, depth: D, glueFlap: Gf, tuck: Tuck } = params;

  // Panel widths (mm): Width W is Front/Back panel width (100mm), Depth D is Side panel depth (50mm)
  const w1 = W;                         // Front Panel 1 (100mm)
  const w2 = D;                         // Side Panel 2 (50mm)
  const w3 = W;                         // Back Panel 3 (100mm)
  const w4 = Math.max(10, D - 0.5);    // Side Panel 4 (49.5mm)

  // X Coordinates (mm)
  const x0 = 0;
  const x1 = Gf;                       // 11.5mm
  const x2 = x1 + w1;                  // 111.5mm
  const x3 = x2 + w2;                  // 161.5mm
  const x4 = x3 + w3;                  // 261.5mm
  const x5 = x4 + w4;                  // 311.0mm

  // Y Coordinates (mm)
  // Top Lid Cover Height (without tuck tongue) MUST equal Depth D minus clearance (D - 0.25mm)
  const lidCoverH = Math.max(10, D - 0.25); // 49.75mm for D=50mm
  const y0 = 0;
  const yTuckCrease = y0 + Tuck;       // 15.0mm (Tuck fold line)
  const y1 = yTuckCrease + lidCoverH; // 64.75mm (Body top crease line)
  const y2 = y1 + H;                 // 214.75mm (Body bottom crease line)

  const crashH = 0.675 * D;          // Height of main crash lock flap (33.75mm for D=50)
  const suppH = D / 2;               // Height of support flaps 2 & 4 (25.0mm for D=50)
  const y3 = y2 + crashH;

  const segments: Segment[] = [];

  // Vertical Main Crease & Cut Lines
  segments.push(seg(1, "CREASE", { x: x1, y: y1 }, { x: x1, y: y2 - 1.0 }, "#009640"));
  segments.push(seg(2, "CUT", { x: x1, y: y2 - 1.0 }, { x: x1, y: y2 }, "#e30613"));
  segments.push(seg(3, "CREASE", { x: x2, y: y1 }, { x: x2, y: y2 }, "#009640"));
  segments.push(seg(4, "CREASE", { x: x3, y: y1 }, { x: x3, y: y2 }, "#009640"));
  segments.push(seg(5, "CREASE", { x: x4, y: y1 }, { x: x4, y: y2 }, "#009640"));
  segments.push(seg(6, "OUTER", { x: x5, y: y1 }, { x: x5, y: y2 }, "#e30613"));

  // Horizontal Top Body Crease Lines
  segments.push(seg(7, "CREASE", { x: x1, y: y1 - 0.5 }, { x: x2, y: y1 - 0.5 }, "#009640"));
  segments.push(seg(8, "CREASE", { x: x2, y: y1 }, { x: x2 + D - 0.75, y: y1 }, "#009640"));
  segments.push(seg(9, "OUTER", { x: x2 + D - 0.75, y: y1 }, { x: x4, y: y1 }, "#e30613"));
  segments.push(seg(10, "CREASE", { x: x4, y: y1 }, { x: x5, y: y1 }, "#009640"));

  // Horizontal Bottom Body Crease & Cut Lines (100% EXPLICIT FOR ALL 4 PANELS)
  segments.push(seg(11, "CREASE", { x: x1, y: y2 }, { x: x2, y: y2 }, "#009640"));               // Under Panel 1 (x1 to x2)
  segments.push(seg(14, "CUT", { x: x2, y: y2 }, { x: x2 + 1.5, y: y2 }, "#e30613"));              // Cut gap 1 (x2 to x2 + 1.5)
  segments.push(seg(12, "CREASE", { x: x2 + 1.5, y: y2 }, { x: x3, y: y2 }, "#009640"));          // Under Panel 2 (x2+1.5 to x3)
  segments.push(seg(13, "CREASE", { x: x3, y: y2 }, { x: x4, y: y2 }, "#009640"));               // Under Panel 3 (x3 to x4)
  segments.push(seg(15, "CUT", { x: x4, y: y2 }, { x: x4 + 1.5, y: y2 }, "#e30613"));              // Cut gap 2 (x4 to x4 + 1.5)
  segments.push(seg(31, "CREASE", { x: x4 + 1.5, y: y2 }, { x: x5, y: y2 }, "#009640"));          // Under Panel 4 (x4+1.5 to x5)

  // Glue Flap Contour
  const gfPoly: Pt[] = [
    { x: x1, y: y1 },
    { x: x0, y: y1 + 3.0 },
    { x: x0, y: y2 - 12.5 },
    { x: x1, y: y2 - 1.0 },
  ];
  segments.push(poly(16, "OUTER", gfPoly, "#e30613"));

  // Top Dust Flap 1 (over Side Panel 2, width D)
  const dustH = Math.min(32.0, D * 0.6);
  const df1Pts: Pt[] = [
    { x: x2, y: y1 },
    { x: x2 + 3.0, y: y1 - 3.0 },
    { x: x2 + 5.0, y: y1 - dustH },
    { x: x3 - 9.2, y: y1 - dustH },
    { x: x3 - 2.7, y: y1 - 7.0 },
    { x: x3 - 0.75, y: y1 - 5.0 },
    { x: x3 - 0.75, y: y1 },
  ];
  segments.push(poly(17, "OUTER", df1Pts, "#e30613"));

  // Top Dust Flap 2 (over Side Panel 4, width w4) - Mirrored notched orientation
  const df2Pts: Pt[] = [
    { x: x5, y: y1 },
    { x: x5 - 3.0, y: y1 - 3.0 },
    { x: x5 - 5.0, y: y1 - dustH },
    { x: x4 + 9.2, y: y1 - dustH },
    { x: x4 + 2.75, y: y1 - 7.0 },
    { x: x4 + 0.75, y: y1 - 5.0 },
    { x: x4 + 0.75, y: y1 },
  ];
  segments.push(poly(18, "OUTER", df2Pts, "#e30613"));

  // Top Lid (over Front Panel 1, width W)
  const tMargin = Math.min(7.0, W * 0.15);
  const yLidSideTop = yTuckCrease - 0.75;
  segments.push(seg(19, "OUTER", { x: x1, y: y1 }, { x: x1, y: yLidSideTop }, "#e30613"));
  segments.push(seg(20, "OUTER", { x: x2, y: y1 }, { x: x2, y: yLidSideTop }, "#e30613"));
  segments.push(seg(21, "CREASE", { x: x1 + tMargin, y: yTuckCrease }, { x: x2 - tMargin, y: yTuckCrease }, "#009640"));

  const lidStepLeft: Pt[] = [
    { x: x1, y: yLidSideTop },
    { x: x1 + tMargin, y: yLidSideTop },
    { x: x1 + tMargin, y: yTuckCrease + 1.25 },
  ];
  segments.push(poly(22, "OUTER", lidStepLeft, "#e30613"));

  const lidStepRight: Pt[] = [
    { x: x2, y: yLidSideTop },
    { x: x2 - tMargin, y: yLidSideTop },
    { x: x2 - tMargin, y: yTuckCrease + 1.25 },
  ];
  segments.push(poly(23, "OUTER", lidStepRight, "#e30613"));

  // Curved Tuck Tongue Top Path matching A60_20_01_01.svg
  const tLeft = x1 + 0.6;
  const tRight = x2 - 0.6;
  const hTop = y0 + 0.7056;
  const vArcMid = y0 + 9.9554;
  const tuckPathStr = `M ${tLeft.toFixed(4)},${yLidSideTop.toFixed(4)} V ${vArcMid.toFixed(4)} C ${tLeft.toFixed(4)},${(y0 + 4.8472).toFixed(4)} ${(x1 + 2.9143).toFixed(4)},${(y0 + 2.2472).toFixed(4)} ${(x1 + 5.225).toFixed(4)},${hTop.toFixed(4)} H ${(x2 - 5.225).toFixed(4)} C ${(x2 - 2.9143).toFixed(4)},${(y0 + 2.2472).toFixed(4)} ${tRight.toFixed(4)},${(y0 + 4.8472).toFixed(4)} ${tRight.toFixed(4)},${vArcMid.toFixed(4)} V ${yLidSideTop.toFixed(4)}`;
  segments.push(path(24, "OUTER", { x: tLeft, y: yLidSideTop }, { x: tRight, y: yLidSideTop }, tuckPathStr, "#e30613"));

  // Auto Lock Bottom Flap 1 (under Front Panel 1, x1 to x2)
  const stepX = Math.min(D, W * 0.5);
  const foldStartX = x1 + W - suppH;

  const f1Pts: Pt[] = [
    { x: x1, y: y2 },
    { x: x1 + 5.8632, y: y2 + crashH },
    { x: x1 + stepX - 5.75, y: y2 + crashH },
    { x: x1 + stepX, y: y2 + crashH - 5.75 },
    { x: x1 + stepX, y: y2 + suppH },
    { x: foldStartX, y: y2 + suppH },
    { x: x1 + W - D / 4 - 1.25, y: y2 + crashH },
    { x: x2 - 2.0, y: y2 + crashH },
    { x: x2 - 2.0, y: y2 + 8.6 },
    { x: x2 - 5.3, y: y2 + 5.3 },
    { x: x2, y: y2 },
  ];
  segments.push(poly(26, "OUTER", f1Pts, "#e30613"));

  // 45-degree crash lock fold crease line on Flap 1 (ORANGE)
  segments.push(seg(25, "CREASE", { x: foldStartX, y: y2 + suppH }, { x: x2 - 5.3, y: y2 + 5.3 }, "#f39200"));

  // Auto Lock Bottom Flap 2 (under Side Panel 2, x2 to x3)
  const f2Pts: Pt[] = [
    { x: x2 + 1.5, y: y2 },
    { x: x2 + 6.47, y: y2 + suppH },
    { x: x2 + suppH, y: y2 + suppH },
    { x: x3, y: y2 },
  ];
  segments.push(poly(27, "OUTER", f2Pts, "#e30613"));

  // Auto Lock Bottom Flap 3 (under Back Panel 3, x3 to x4)
  const foldStartX3 = x3 + W - suppH;
  const f3Pts: Pt[] = [
    { x: x3, y: y2 },
    { x: x3 + 5.8632, y: y2 + crashH },
    { x: x3 + stepX - 5.75, y: y2 + crashH },
    { x: x3 + stepX, y: y2 + crashH - 5.75 },
    { x: x3 + stepX, y: y2 + suppH },
    { x: foldStartX3, y: y2 + suppH },
    { x: x3 + W - D / 4 - 1.25, y: y2 + crashH },
    { x: x4 - 2.0, y: y2 + crashH },
    { x: x4 - 2.0, y: y2 + 8.6 },
    { x: x4 - 5.3, y: y2 + 5.3 },
    { x: x4, y: y2 },
  ];
  segments.push(poly(29, "OUTER", f3Pts, "#e30613"));

  // 45-degree crash lock fold crease line on Flap 3 (ORANGE)
  segments.push(seg(28, "CREASE", { x: foldStartX3, y: y2 + suppH }, { x: x4 - 5.3, y: y2 + 5.3 }, "#f39200"));

  // Auto Lock Bottom Flap 4 (under Side Panel 4, x4 to x5)
  const f4Pts: Pt[] = [
    { x: x4 + 1.5, y: y2 },
    { x: x4 + 6.4065, y: y2 + suppH - 0.25 },
    { x: x4 + w4 / 2, y: y2 + suppH - 0.25 },
    { x: x5, y: y2 },
  ];
  segments.push(poly(30, "OUTER", f4Pts, "#e30613"));

  const totalWidth = x5;
  const totalHeight = y3;

  const pathElements = segments.map((seg) => {
    const stroke = seg.strokeColor || (seg.kind === "CREASE" ? "#009640" : "#e30613");
    const dash = seg.kind === "CREASE" && stroke !== "#f39200" ? 'stroke-dasharray="4,4"' : "";

    if (seg.d) {
      return `<path d="${seg.d}" stroke="${stroke}" stroke-width="0.5" fill="none" />`;
    }
    if (seg.points && seg.points.length >= 2) {
      const ptsStr = seg.points.map(p => `${p.x.toFixed(4)},${p.y.toFixed(4)}`).join(' ');
      return `<polyline points="${ptsStr}" stroke="${stroke}" stroke-width="0.5" fill="none" ${dash} />`;
    }
    return `<line x1="${seg.start.x.toFixed(4)}" y1="${seg.start.y.toFixed(4)}" x2="${seg.end.x.toFixed(4)}" y2="${seg.end.y.toFixed(4)}" stroke="${stroke}" stroke-width="0.5" fill="none" ${dash} />`;
  }).join("\n  ");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth.toFixed(2)} ${totalHeight.toFixed(2)}" width="${totalWidth.toFixed(2)}mm" height="${totalHeight.toFixed(2)}mm">\n  ${pathElements}\n</svg>`;

  return {
    params,
    derived: {
      totalWidth,
      totalHeight,
      w: W,
      h: H,
      d: D,
      glueFlap: Gf,
      tuck: Tuck,
      topLidHeight: lidCoverH,
      bottomFlapHeight: crashH,
    },
    svg,
    bbox: { minX: 0, minY: 0, maxX: totalWidth, maxY: totalHeight, w: totalWidth, h: totalHeight },
    segments,
  };
}
