import type { T0006Params, T0006Geometry, Segment, Pt } from "./types";

export const PT_PER_MM = 2.83464566929;
const m = (pt: number) => Math.round((pt / PT_PER_MM) * 100000) / 100000;
const P = (xPt: number, yPt: number): Pt => ({ x: m(xPt), y: m(yPt) });

export function buildT0006Reference(p: T0006Params): T0006Geometry {
  const W = 100;
  const H = 150;
  const D = 50;
  const Gf = 12.21;
  const Lt = 49.0;
  const Df = 32.0;
  const d2 = 49.5;

  const segments: Segment[] = [
    // === CREASE LINES (kind: "CREASE") ===
    { id: 1, svgId: "CREASE_1", kind: "CREASE", geometry: "line", start: P(34.6, 174.92), end: P(34.6, 600.11) },
    { id: 2, svgId: "CREASE_2", kind: "CREASE", geometry: "line", start: P(318.07, 174.92), end: P(318.07, 600.11) },
    { id: 3, svgId: "CREASE_3", kind: "CREASE", geometry: "line", start: P(459.8, 174.92), end: P(459.8, 600.11) },
    { id: 4, svgId: "CREASE_4", kind: "CREASE", geometry: "line", start: P(743.26, 174.92), end: P(743.26, 600.11) },
    
    // Top crease lines
    { id: 7, svgId: "CREASE_7", kind: "CREASE", geometry: "line", start: P(36.02, 173.5), end: P(128.15, 173.5) },
    { id: 8, svgId: "CREASE_8", kind: "CREASE", geometry: "line", start: P(224.52, 173.5), end: P(316.65, 173.5) },
    { id: 9, svgId: "CREASE_9", kind: "CREASE", geometry: "line", start: P(318.07, 174.92), end: P(459.8, 174.92) },
    { id: 10, svgId: "CREASE_10", kind: "CREASE", geometry: "line", start: P(459.8, 173.5), end: P(743.26, 173.5) },
    { id: 11, svgId: "CREASE_11", kind: "CREASE", geometry: "line", start: P(743.26, 174.92), end: P(883.58, 174.92) },
    { id: 15, svgId: "CREASE_15", kind: "CREASE", geometry: "line", start: P(567.11, 36.02), end: P(635.95, 36.02) },

    // Bottom crease lines
    { id: 12, svgId: "CREASE_12", kind: "CREASE", geometry: "line", start: P(36.02, 601.531), end: P(128.15, 601.531) },
    { id: 13, svgId: "CREASE_13", kind: "CREASE", geometry: "line", start: P(224.52, 601.531), end: P(316.65, 601.531) },
    { id: 14, svgId: "CREASE_14", kind: "CREASE", geometry: "line", start: P(318.07, 600.11), end: P(883.58, 600.11) },
    { id: 16, svgId: "CREASE_16", kind: "CREASE", geometry: "line", start: P(567.11, 739.007), end: P(635.95, 739.007) },

    // === OUTER CUT LINES (kind: "OUTER") ===
    { id: 5, svgId: "LINE_5", kind: "OUTER", geometry: "line", start: P(883.58, 174.92), end: P(883.58, 600.11) },
    
    // Top cutouts
    {
      id: 6, svgId: "LINE_6", kind: "OUTER", geometry: "polyline",
      start: P(128.15, 173.5), end: P(224.52, 173.5),
      points: [P(128.15, 173.5), P(141.91, 173.5), P(144.04, 171.37), P(208.63, 171.37), P(210.76, 173.5), P(224.52, 173.5)]
    },
    {
      id: 100, svgId: "LINE_10_NOTCH", kind: "OUTER", geometry: "arc",
      start: P(158.74 - 6.5, 177.871 - 6.501), end: P(158.74 - 6.5 + 48.19, 177.871 - 6.501),
      arc: { rx: m(26.1), ry: m(26.1), xar: 0, laf: 0, sf: 0 }
    },

    // Bottom cutouts
    {
      id: 130, svgId: "LINE_13", kind: "OUTER", geometry: "polyline",
      start: P(128.15, 601.531), end: P(224.52, 601.531),
      points: [P(128.15, 601.531), P(141.91, 601.531), P(144.04, 603.661), P(208.63, 603.661), P(210.76, 601.531), P(224.52, 601.531)]
    },
    {
      id: 120, svgId: "LINE_12_NOTCH", kind: "OUTER", geometry: "arc",
      start: P(158.74 - 6.5, 610.162 - 6.501), end: P(158.74 - 6.5 + 48.19, 610.162 - 6.501),
      arc: { rx: m(26.1), ry: m(26.1), xar: 0, laf: 0, sf: 1 }
    },

    // Glue flap
    {
      id: 122, svgId: "POLY_12", kind: "OUTER", geometry: "polyline",
      start: P(34.6, 174.92), end: P(34.6, 600.11),
      points: [P(34.6, 174.92), P(2, 183.35), P(2, 591.68), P(34.6, 600.11)]
    },

    // Top closing panels
    {
      id: 131, svgId: "POLY_13", kind: "OUTER", geometry: "polyline",
      start: P(34.6, 174.92), end: P(318.07, 174.92),
      points: [P(34.6, 174.92), P(43.11, 166.41), P(43.11, 36.02), P(309.56, 36.02), P(309.56, 166.41), P(318.07, 174.92)]
    },
    {
      id: 151, svgId: "POLY_15", kind: "OUTER", geometry: "polyline",
      start: P(459.8, 174.92), end: P(567.11, 36.02),
      points: [P(459.8, 174.92), P(459.8, 33.89), P(567.11, 33.89), P(567.11, 36.02)]
    },
    {
      id: 161, svgId: "POLY_16", kind: "OUTER", geometry: "polyline",
      start: P(635.95, 36.02), end: P(743.26, 174.92),
      points: [P(635.95, 36.02), P(635.95, 33.89), P(743.26, 33.89), P(743.26, 174.92)]
    },
    {
      id: 171, svgId: "LINE_17", kind: "OUTER", geometry: "bezier",
      start: P(559.84 - 6.5, 40.391 - 6.501), end: P(559.84 - 6.5 + 71.58 + 12.4*2, 40.391 - 6.501),
      points: [
        P(559.84 - 6.5, 40.391 - 6.501),
        P(559.84 - 6.5, 40.391 - 6.501 - 4.96),
        P(559.84 - 6.5 + 71.58 + 12.4*2, 40.391 - 6.501 - 4.96),
        P(559.84 - 6.5 + 71.58 + 12.4*2, 40.391 - 6.501)
      ],
      bezier: {
        c1: P(559.84 - 6.5, 40.391 - 6.501 - 4.96 - 13.7),
        c2: P(559.84 - 6.5 + 6.2, 40.391 - 6.501 - 4.96 - 22.79)
      },
      d: "M195.2065,11.9564 L195.2065,10.2064 C195.2065,5.3738 197.393,2.167 199.58,0.707 L224.832,0.707 C227.019,2.167 229.206,5.3738 229.206,10.2064 L229.206,11.9564"
    },
    {
      id: 181, svgId: "POLY_18", kind: "OUTER", geometry: "polyline",
      start: P(743.26, 174.92), end: P(883.58, 174.92),
      points: [P(743.26, 174.92), P(751.77, 166.41), P(757.44, 84.21), P(867.83, 84.21), P(883.58, 166.41), P(883.58, 174.92)]
    },
    {
      id: 191, svgId: "POLY_19", kind: "OUTER", geometry: "polyline",
      start: P(459.798, 174.92), end: P(318.068, 174.92),
      points: [P(459.798, 174.92), P(451.298, 166.41), P(445.628, 84.21), P(333.818, 84.21), P(318.068, 166.41), P(318.068, 174.92)]
    },

    // Bottom closing panels
    {
      id: 201, svgId: "POLY_20", kind: "OUTER", geometry: "polyline",
      start: P(34.6, 600.117), end: P(318.07, 600.117),
      points: [P(34.6, 600.117), P(43.11, 608.617), P(43.11, 739.007), P(309.56, 739.007), P(309.56, 608.617), P(318.07, 600.117)]
    },
    {
      id: 211, svgId: "POLY_21", kind: "OUTER", geometry: "polyline",
      start: P(459.8, 600.117), end: P(567.11, 739.007),
      points: [P(459.8, 600.117), P(459.8, 741.137), P(567.11, 741.137), P(567.11, 739.007)]
    },
    {
      id: 221, svgId: "POLY_22", kind: "OUTER", geometry: "polyline",
      start: P(635.95, 739.007), end: P(743.26, 600.117),
      points: [P(635.95, 739.007), P(635.95, 741.137), P(743.26, 741.137), P(743.26, 600.117)]
    },
    {
      id: 231, svgId: "LINE_23", kind: "OUTER", geometry: "bezier",
      start: P(559.84 - 6.5, 747.638 - 6.501), end: P(559.84 - 6.5 + 71.58 + 12.4*2, 747.638 - 6.501),
      points: [
        P(559.84 - 6.5, 747.638 - 6.501),
        P(559.84 - 6.5, 747.638 - 6.501 + 4.96),
        P(559.84 - 6.5 + 71.58 + 12.4*2, 747.638 - 6.501 + 4.96),
        P(559.84 - 6.5 + 71.58 + 12.4*2, 747.638 - 6.501)
      ],
      bezier: {
        c1: P(559.84 - 6.5, 747.638 - 6.501 + 4.96 + 13.7),
        c2: P(559.84 - 6.5 + 6.2, 747.638 - 6.501 + 4.96 + 22.79)
      },
      d: "M195.2065,260.4564 L195.2065,262.2064 C195.2065,267.039 197.393,270.246 199.58,271.706 L224.832,271.706 C227.019,270.245 229.206,267.039 229.206,262.206 L229.206,260.4564"
    },
    {
      id: 241, svgId: "POLY_24", kind: "OUTER", geometry: "polyline",
      start: P(743.26, 600.117), end: P(883.58, 600.117),
      points: [P(743.26, 600.117), P(751.77, 608.617), P(757.44, 690.827), P(867.83, 690.827), P(883.58, 608.617), P(883.58, 600.117)]
    },
    {
      id: 251, svgId: "POLY_25", kind: "OUTER", geometry: "polyline",
      start: P(459.798, 600.117), end: P(319.488, 600.117),
      points: [P(459.798, 600.117), P(451.298, 608.617), P(445.628, 690.827), P(335.238, 690.827), P(319.488, 608.617), P(319.488, 600.117)]
    }
  ];

  const totalW = m(885.58);
  const totalH = m(775.027);

  const r = (n: number) => Math.round(n * 100000) / 100000;
  const sh = (pt: Pt): Pt => ({ x: r(pt.x), y: r(pt.y) });
  const shifted = segments.map(s => ({
    ...s,
    start: sh(s.start),
    end: sh(s.end),
    points: s.points ? s.points.map(sh) : undefined,
  }));

  const svg = renderSvgMarkup(shifted, { w: totalW, h: totalH });

  return {
    params: p,
    derived: {
      W, H, D, Gf, Lt, Df, d2,
      width: totalW,
      height: totalH
    },
    segments: shifted,
    svg,
    bbox: { w: totalW, h: totalH }
  };
}

function renderSvgMarkup(segs: Segment[], bbox: { w: number; h: number }): string {
  const r = (n: number) => Math.round(n * 100000) / 100000;
  const w = r(bbox.w), h = r(bbox.h);
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">`);

  out.push(`  <g id="CREASE" fill="none" stroke="#009640" stroke-width="0.45" stroke-miterlimit="10">`);
  for (const s of segs.filter(s => s.kind === "CREASE")) {
    out.push(`    <line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}" data-id="${s.svgId}"/>`);
  }
  out.push(`  </g>`);

  out.push(`  <g id="CUT" fill="none" stroke="#e30613" stroke-width="0.45" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10">`);
  for (const s of segs.filter(s => s.kind === "OUTER" || s.kind === "CUT")) {
    if (s.geometry === "polyline" && s.points && s.points.length >= 2) {
      const pts = s.points.map(p => `${p.x},${p.y}`).join(" ");
      out.push(`    <polyline points="${pts}" data-id="${s.svgId}"/>`);
    } else if (s.geometry === "arc" && s.arc) {
      out.push(`    <path d="M${s.start.x},${s.start.y} A${s.arc.rx},${s.arc.ry} ${s.arc.xar} ${s.arc.laf} ${s.arc.sf} ${s.end.x},${s.end.y}" data-id="${s.svgId}"/>`);
    } else if (s.geometry === "bezier" && s.d) {
      out.push(`    <path d="${s.d}" data-id="${s.svgId}"/>`);
    } else {
      out.push(`    <line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}" data-id="${s.svgId}"/>`);
    }
  }
  out.push(`  </g>`);
  out.push(`</svg>`);
  return out.join("\n");
}
