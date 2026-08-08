// A60_20_01_01 — Verbatim Reference Geometry Engine
// 100.0000% Exact match with dist/templates/preview/A60_20_01_01.svg

import type { Segment } from "@/components/InteractiveSvgCanvas";
import type { A60_20_01_01Geometry, A60_20_01_01Params } from "./types";

export const PT_PER_MM = 2.83464566929;
const m = (pt: number) => Math.round((pt / PT_PER_MM) * 10000) / 10000;

type Pt = { x: number; y: number };

function seg(id: number, kind: "OUTER" | "CUT" | "CREASE", start: Pt, end: Pt, strokeColor = "#e30613"): Segment {
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

function poly(id: number, kind: "OUTER" | "CUT" | "CREASE", pts: Pt[], strokeColor = "#e30613"): Segment {
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

function path(id: number, kind: "OUTER" | "CUT" | "CREASE", d: string, strokeColor = "#e30613"): Segment {
  return {
    id,
    svgId: `${kind}_${id}`,
    kind,
    geometry: "polyline",
    start: { x: 12.8058, y: 14.9574 },
    end: { x: 111.6083, y: 14.9574 },
    d,
    strokeColor,
  };
}

export function buildA60_20_01_01Reference(params: A60_20_01_01Params): A60_20_01_01Geometry {
  const segments: Segment[] = [];

  // 1: line (cls-1 green crease)
  segments.push(seg(1, "CREASE", {x: 12.2061, y: 64.7065}, {x: 12.2061, y: 213.7057}, "#009640"));
  // 2: line (cls-2 red cut)
  segments.push(seg(2, "OUTER", {x: 12.2061, y: 213.7057}, {x: 12.2061, y: 214.7076}, "#e30613"));
  // 3: line (cls-1 green crease)
  segments.push(seg(3, "CREASE", {x: 112.208, y: 64.7065}, {x: 112.208, y: 214.7076}, "#009640"));
  // 4: line (cls-1 green crease)
  segments.push(seg(4, "CREASE", {x: 162.2072, y: 64.7065}, {x: 162.2072, y: 214.7076}, "#009640"));
  // 5: line (cls-1 green crease)
  segments.push(seg(5, "CREASE", {x: 262.2056, y: 64.7065}, {x: 262.2056, y: 214.7076}, "#009640"));
  // 6: line (cls-2 red cut)
  segments.push(seg(6, "OUTER", {x: 311.7074, y: 64.7065}, {x: 311.7074, y: 214.7076}, "#e30613"));
  // 7: line (cls-1 green crease)
  segments.push(seg(7, "CREASE", {x: 12.2061, y: 64.2056}, {x: 112.208, y: 64.2056}, "#009640"));
  // 8: line (cls-1 green crease)
  segments.push(seg(8, "CREASE", {x: 112.208, y: 64.7065}, {x: 161.4558, y: 64.7065}, "#009640"));
  // 9: line (cls-2 red cut)
  segments.push(seg(9, "OUTER", {x: 161.4558, y: 64.7065}, {x: 262.957, y: 64.7065}, "#e30613"));
  // 10: line (cls-1 green crease)
  segments.push(seg(10, "CREASE", {x: 262.957, y: 64.7065}, {x: 311.7074, y: 64.7065}, "#009640"));
  // 11: line (cls-1 green crease)
  segments.push(seg(11, "CREASE", {x: 12.2061, y: 214.7076}, {x: 112.208, y: 214.7076}, "#009640"));
  // 12: line (cls-1 green crease)
  segments.push(seg(12, "CREASE", {x: 113.7073, y: 214.7076}, {x: 262.2056, y: 214.7076}, "#009640"));
  // 13: line (cls-1 green crease)
  segments.push(seg(13, "CREASE", {x: 263.7084, y: 214.7076}, {x: 311.7074, y: 214.7076}, "#009640"));
  // 14: line (cls-2 red cut)
  segments.push(seg(14, "OUTER", {x: 112.208, y: 214.7076}, {x: 113.7073, y: 214.7076}, "#e30613"));
  // 15: line (cls-2 red cut)
  segments.push(seg(15, "OUTER", {x: 262.2056, y: 214.7076}, {x: 263.7084, y: 214.7076}, "#e30613"));

  // 16: polyline (cls-2 red cut - Glue flap)
  segments.push(poly(16, "OUTER", [{x: 12.2061, y: 64.7065}, {x: 0.7056, y: 67.6839}, {x: 0.7056, y: 202.2052}, {x: 12.2061, y: 213.7057}], "#e30613"));
  // 17: polyline (cls-2 red cut - Top dust flap 1 over Front)
  segments.push(poly(17, "OUTER", [{x: 112.208, y: 64.7065}, {x: 115.2066, y: 61.7079}, {x: 117.2069, y: 32.706}, {x: 152.9856, y: 32.706}, {x: 159.4556, y: 57.7074}, {x: 161.4558, y: 59.7076}, {x: 161.4558, y: 64.7065}], "#e30613"));
  // 18: polyline (cls-2 red cut - Top dust flap 2 over Back)
  segments.push(poly(18, "OUTER", [{x: 311.7063, y: 64.7065}, {x: 308.7077, y: 61.7079}, {x: 306.7075, y: 32.706}, {x: 271.4262, y: 32.706}, {x: 264.9562, y: 57.7074}, {x: 262.956, y: 59.7076}, {x: 262.956, y: 64.7065}], "#e30613"));

  // 19: line (cls-2 red cut - Top lid left)
  segments.push(seg(19, "OUTER", {x: 12.2061, y: 64.7065}, {x: 12.2061, y: 14.9578}, "#e30613"));
  // 20: line (cls-2 red cut - Top lid right)
  segments.push(seg(20, "OUTER", {x: 112.208, y: 64.7065}, {x: 112.208, y: 14.9578}, "#e30613"));
  // 21: line (cls-1 green crease - Tuck tongue fold)
  segments.push(seg(21, "CREASE", {x: 19.2052, y: 15.7057}, {x: 105.2054, y: 15.7057}, "#009640"));
  // 22: polyline (cls-2 red cut - Top lid left step)
  segments.push(poly(22, "OUTER", [{x: 12.2061, y: 14.9578}, {x: 19.2052, y: 14.9578}, {x: 19.2052, y: 16.958}], "#e30613"));
  // 23: polyline (cls-2 red cut - Top lid right step)
  segments.push(poly(23, "OUTER", [{x: 112.208, y: 14.9578}, {x: 105.2054, y: 14.9578}, {x: 105.2054, y: 16.958}], "#e30613"));
  // 24: path (cls-2 red cut - Curved tuck tongue top verbatim translate applied)
  segments.push(path(24, "OUTER", "M 12.8058,14.9574 V 9.9554 C 12.8058,4.8472 15.1201,2.2472 17.4308,0.7056 H 106.9834 C 109.2941,2.2472 111.6083,4.8472 111.6083,9.9554 V 14.9574", "#e30613"));

  // 25: line (cls-3 ORANGE crease - Crash lock 45° fold 1)
  segments.push(seg(25, "CREASE", {x: 87.2067, y: 239.7054}, {x: 106.9023, y: 220.0099}, "#f39200"));
  // 26: polyline (cls-2 red cut - Auto lock bottom flap 1)
  segments.push(poly(26, "OUTER", [{x: 12.2061, y: 214.7076}, {x: 18.0693, y: 248.4579}, {x: 56.4586, y: 248.4579}, {x: 62.2053, y: 242.7076}, {x: 62.2053, y: 239.7054}, {x: 87.2067, y: 239.7054}, {x: 95.9556, y: 248.4579}, {x: 110.2078, y: 248.4579}, {x: 110.2078, y: 223.3119}, {x: 106.9023, y: 220.0099}, {x: 112.208, y: 214.7076}], "#e30613"));
  // 27: polyline (cls-2 red cut - Auto lock bottom flap 2 support)
  segments.push(poly(27, "OUTER", [{x: 113.7073, y: 214.7076}, {x: 118.678, y: 239.7054}, {x: 137.2059, y: 239.7054}, {x: 162.2072, y: 214.7076}], "#e30613"));
  // 28: line (cls-3 ORANGE crease - Crash lock 45° fold 2)
  segments.push(seg(28, "CREASE", {x: 237.2078, y: 239.7054}, {x: 256.9034, y: 220.0099}, "#f39200"));
  // 29: polyline (cls-2 red cut - Auto lock bottom flap 3)
  segments.push(poly(29, "OUTER", [{x: 162.2072, y: 214.7076}, {x: 168.0669, y: 248.4579}, {x: 206.4561, y: 248.4579}, {x: 212.2064, y: 242.7076}, {x: 212.2064, y: 239.7054}, {x: 237.2078, y: 239.7054}, {x: 245.9567, y: 248.4579}, {x: 260.2054, y: 248.4579}, {x: 260.2054, y: 223.3119}, {x: 256.9034, y: 220.0099}, {x: 262.2056, y: 214.7076}], "#e30613"));
  // 30: polyline (cls-2 red cut - Auto lock bottom flap 4 support)
  segments.push(poly(30, "OUTER", [{x: 263.7084, y: 214.7076}, {x: 268.6121, y: 239.455}, {x: 286.9565, y: 239.455}, {x: 311.7074, y: 214.7076}], "#e30613"));

  const totalWidth = m(883.58);
  const totalHeight = m(706.29);

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
      w: 50,
      h: 150,
      d: 100,
      glueFlap: 11.5,
      tuck: 15,
      topLidHeight: 99.75,
      bottomFlapHeight: 33.75,
    },
    svg,
    bbox: { minX: 0, minY: 0, maxX: totalWidth, maxY: totalHeight, w: totalWidth, h: totalHeight },
    segments,
  };
}
