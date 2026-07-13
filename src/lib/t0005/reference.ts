import type { T0005Params, T0005Geometry, Segment, Pt } from "./types";

export const PT_PER_MM = 2.83464566929;
const m = (pt: number) => Math.round((pt / PT_PER_MM) * 100000) / 100000;
const P = (xPt: number, yPt: number): Pt => ({ x: m(xPt), y: m(yPt) });

export function buildT0005Reference(p: T0005Params): T0005Geometry {
  const W = 100;
  const H = 150;
  const D = 50;
  const Gf = 12.21;
  const Lt = 49.0;
  const Df = 32.0;
  const d2 = 49.5;

  const segments: Segment[] = [
    // === CREASE LINES (kind: "CREASE") ===
    {
      id: 1,
      svgId: "CREASE_1",
      kind: "CREASE",
      geometry: "line",
      start: P(34.6, 2),
      end: P(34.6, 427.2)
    },
    {
      id: 2,
      svgId: "CREASE_2",
      kind: "CREASE",
      geometry: "line",
      start: P(318.07, 2),
      end: P(318.07, 427.2)
    },
    {
      id: 3,
      svgId: "CREASE_3",
      kind: "CREASE",
      geometry: "line",
      start: P(459.8, 2),
      end: P(459.8, 427.2)
    },
    {
      id: 4,
      svgId: "CREASE_4",
      kind: "CREASE",
      geometry: "line",
      start: P(743.26, 2),
      end: P(743.26, 427.2)
    },
    {
      id: 7,
      svgId: "CREASE_7",
      kind: "CREASE",
      geometry: "line",
      start: P(36.02, 428.617),
      end: P(128.15, 428.617)
    },
    {
      id: 8,
      svgId: "CREASE_8",
      kind: "CREASE",
      geometry: "line",
      start: P(224.52, 428.617),
      end: P(316.65, 428.617)
    },
    {
      id: 11,
      svgId: "CREASE_11",
      kind: "CREASE",
      geometry: "line",
      start: P(318.07, 427.2),
      end: P(883.58, 427.2)
    },
    {
      id: 14,
      svgId: "CREASE_14",
      kind: "CREASE",
      geometry: "line",
      start: P(567.11, 566.092),
      end: P(635.95, 566.092)
    },

    // === OUTER CUT LINES (kind: "OUTER") ===
    {
      id: 5,
      svgId: "LINE_5",
      kind: "OUTER",
      geometry: "line",
      start: P(883.58, 2),
      end: P(883.58, 427.2)
    },
    {
      id: 6,
      svgId: "LINE_6",
      kind: "OUTER",
      geometry: "line",
      start: P(34.6, 2),
      end: P(885, 2)
    },
    {
      id: 9,
      svgId: "LINE_9",
      kind: "OUTER",
      geometry: "polyline",
      start: P(128.15, 428.617),
      end: P(224.52, 428.617),
      points: [
        P(128.15, 428.617),
        P(141.91, 428.617),
        P(144.04, 430.737),
        P(208.63, 430.737),
        P(210.76, 428.617),
        P(224.52, 428.617)
      ]
    },
    {
      id: 10,
      svgId: "LINE_10",
      kind: "OUTER",
      geometry: "arc",
      start: P(158.74 - 6.5, 437.24 - 6.503),
      end: P(158.74 - 6.5 + 48.19, 437.24 - 6.503),
      arc: { rx: m(26.1), ry: m(26.1), xar: 0, laf: 0, sf: 1 }
    },
    {
      id: 12,
      svgId: "LINE_12",
      kind: "OUTER",
      geometry: "polyline",
      start: P(34.6, 2),
      end: P(34.6, 427.2),
      points: [
        P(34.6, 2),
        P(2, 10.44),
        P(2, 418.76),
        P(34.6, 427.2)
      ]
    },
    {
      id: 13,
      svgId: "LINE_13",
      kind: "OUTER",
      geometry: "polyline",
      start: P(34.6, 427.192),
      end: P(318.07, 427.192),
      points: [
        P(34.6, 427.192),
        P(43.11, 435.702),
        P(43.11, 566.092),
        P(309.56, 566.092),
        P(309.56, 435.702),
        P(318.07, 427.192)
      ]
    },
    {
      id: 15,
      svgId: "LINE_15",
      kind: "OUTER",
      geometry: "polyline",
      start: P(459.8, 427.192),
      end: P(567.11, 566.092),
      points: [
        P(459.8, 427.192),
        P(459.8, 568.222),
        P(567.11, 568.222),
        P(567.11, 566.092)
      ]
    },
    {
      id: 16,
      svgId: "LINE_16",
      kind: "OUTER",
      geometry: "polyline",
      start: P(635.95, 566.092),
      end: P(743.26, 427.192),
      points: [
        P(635.95, 566.092),
        P(635.95, 568.222),
        P(743.26, 568.222),
        P(743.26, 427.192)
      ]
    },
    {
      id: 17,
      svgId: "LINE_17",
      kind: "OUTER",
      geometry: "bezier",
      start: P(559.84 - 6.5, 574.725 - 6.503),
      end: P(559.84 - 6.5 + 71.58 + 12.4*2, 574.725 - 6.503),
      // We will render it as a polyline or bezier path in dynamic mode. For reference, let's keep it clean
      points: [
        P(559.84 - 6.5, 574.725 - 6.503),
        P(559.84 - 6.5, 574.725 - 6.503 + 4.96),
        // Bezier 1:
        // start: [195.206, 202.206]
        // c1: [195.206, 207.039]
        // c2: [197.393, 210.246]
        // end: [199.580, 211.706]
        // Horizontal:
        // end: [224.832, 211.706]
        // Bezier 2:
        // c1: [227.019, 210.245]
        // c2: [229.206, 207.039]
        // end: [229.206, 202.206]
        P(229.206, 202.206),
        P(229.206, 200.456)
      ],
      bezier: {
        c1: P(559.84 - 6.5, 574.725 - 6.503 + 4.96 + 13.7),
        c2: P(559.84 - 6.5 + 6.2, 574.725 - 6.503 + 4.96 + 22.79)
      },
      d: "M195.2065,200.4564 L195.2065,202.2064 C195.2065,207.039 197.393,210.246 199.58,211.706 L224.832,211.706 C227.019,210.245 229.206,207.039 229.206,202.206 L229.206,200.4564"
    },
    {
      id: 18,
      svgId: "LINE_18",
      kind: "OUTER",
      geometry: "polyline",
      start: P(743.26, 427.192),
      end: P(883.58, 427.192),
      points: [
        P(743.26, 427.192),
        P(751.77, 435.702),
        P(757.44, 517.902),
        P(867.83, 517.902),
        P(883.58, 435.702),
        P(883.58, 427.192)
      ]
    },
    {
      id: 19,
      svgId: "LINE_19",
      kind: "OUTER",
      geometry: "polyline",
      start: P(459.798, 427.192),
      end: P(319.488, 427.192),
      points: [
        P(459.798, 427.192),
        P(451.298, 435.702),
        P(445.628, 517.902),
        P(335.238, 517.902),
        P(319.488, 435.702),
        P(319.488, 427.192)
      ]
    }
  ];

  const totalW = m(885.58);
  const totalH = m(602.112);

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
    if (s.start.x === s.end.x && s.start.y === s.end.y) continue;
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
    } else if (s.geometry === "bezier" && s.points) {
      // Custom draw lock tab
      const start = s.points[0];
      const p1 = s.points[1];
      const end = s.points[3] || s.points[2];
      out.push(`    <path d="M${start.x},${start.y} L${p1.x},${p1.y} C${r(195.206)},${r(207.039)} ${r(197.393)},${r(210.246)} ${r(199.58)},${r(211.706)} L${r(224.832)},${r(211.706)} C${r(227.019)},${r(210.245)} ${r(229.206)},${r(207.039)} ${r(229.206)},${r(202.206)} L${end.x},${end.y}" data-id="${s.svgId}"/>`);
    } else {
      out.push(`    <line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}" data-id="${s.svgId}"/>`);
    }
  }
  out.push(`  </g>`);
  out.push(`</svg>`);
  return out.join("\n");
}
