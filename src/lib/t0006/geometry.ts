import type { T0006Params, T0006Geometry, Segment, Pt } from "./types";
import { buildT0006Reference } from "./reference";

export const PT_PER_MM = 2.83464566929;

export function buildT0006Geometry(p: T0006Params): T0006Geometry {
  if (p.referenceMode) return buildT0006Reference(p);
  return buildT0006Dynamic(p);
}

function buildT0006Dynamic(p: T0006Params): T0006Geometry {
  const W = p.width;
  const H = p.height;
  const D = p.depth;
  const Gf = p.glueFlap;
  const Lt = p.lidTongue;
  const Df = p.dustFlap;
  const d2 = D - 0.5;

  // X Anchors (origin = left edge of Panel 1 crease)
  const Xg = 0;
  const Xf1 = Gf;
  const Xd1 = Gf + W;
  const Xf2 = Gf + W + D;
  const Xd2 = Gf + 2 * W + D;
  const Xd2R = Xd2 + d2;

  // Y Anchors (origin = top edge of top flaps bounding box)
  const Yft = Lt + 12.707; // top crease line
  const Yfb = Yft + H;      // bottom crease line
  const YtuckBottom = Yfb + Lt;
  const YdustBottom = Yfb + Df;
  const YtuckTop = Yft - Lt;
  const YdustTop = Yft - Df;

  const segments: Segment[] = [];
  let segId = 1;

  const addCrease = (start: Pt, end: Pt, label: string) => {
    segments.push({
      id: segId++,
      svgId: `CREASE_${label}`,
      kind: "CREASE",
      geometry: "line",
      start,
      end,
    });
  };

  const addCut = (start: Pt, end: Pt, label: string) => {
    segments.push({
      id: segId++,
      svgId: `LINE_${label}`,
      kind: "OUTER",
      geometry: "line",
      start,
      end,
    });
  };

  const addPoly = (points: Pt[], label: string) => {
    segments.push({
      id: segId++,
      svgId: `POLY_${label}`,
      kind: "OUTER",
      geometry: "polyline",
      start: points[0],
      end: points[points.length - 1],
      points,
    });
  };

  const addArc = (start: Pt, end: Pt, rx: number, ry: number, xar: number, laf: number, sf: number, label: string) => {
    segments.push({
      id: segId++,
      svgId: `LINE_${label}`,
      kind: "OUTER",
      geometry: "arc",
      start,
      end,
      arc: { rx, ry, xar, laf, sf }
    });
  };

  // ==========================================
  // 1. CREASE LINES
  // ==========================================
  addCrease({ x: Xf1, y: Yft }, { x: Xf1, y: Yfb }, "1"); // Glue flap to Panel 1
  addCrease({ x: Xd1, y: Yft }, { x: Xd1, y: Yfb }, "2"); // Panel 1 to Panel 2
  addCrease({ x: Xf2, y: Yft }, { x: Xf2, y: Yfb }, "3"); // Panel 2 to Panel 3
  addCrease({ x: Xd2, y: Yft }, { x: Xd2, y: Yfb }, "4"); // Panel 3 to Panel 4

  // Top horizontal creases
  addCrease({ x: Xf1 + 0.5, y: Yft - 0.5 }, { x: Xf1 + 0.33 * W, y: Yft - 0.5 }, "7");
  addCrease({ x: Xf1 + 0.67 * W, y: Yft - 0.5 }, { x: Xd1 - 0.5, y: Yft - 0.5 }, "8");
  addCrease({ x: Xd1, y: Yft }, { x: Xf2, y: Yft }, "9");
  addCrease({ x: Xf2, y: Yft - 0.5 }, { x: Xd2, y: Yft - 0.5 }, "10"); // top tab base crease
  addCrease({ x: Xd2, y: Yft }, { x: Xd2R, y: Yft }, "11");
  addCrease({ x: Xf2 + 0.37857 * W, y: Yft - Lt }, { x: Xf2 + 0.62143 * W, y: Yft - Lt }, "15"); // top tab crease

  // Bottom horizontal creases
  addCrease({ x: Xf1 + 0.5, y: Yfb + 0.5 }, { x: Xf1 + 0.33 * W, y: Yfb + 0.5 }, "12");
  addCrease({ x: Xf1 + 0.67 * W, y: Yfb + 0.5 }, { x: Xd1 - 0.5, y: Yfb + 0.5 }, "13");
  addCrease({ x: Xd1, y: Yfb }, { x: Xd2R, y: Yfb }, "14");
  addCrease({ x: Xf2 + 0.37857 * W, y: Yfb + Lt }, { x: Xf2 + 0.62143 * W, y: Yfb + Lt }, "16"); // bottom tab crease

  // ==========================================
  // 2. OUTER CUT LINES
  // ==========================================
  addCut({ x: Xd2R, y: Yft }, { x: Xd2R, y: Yfb }, "5"); // right cut edge

  // Top slot cutout & notch
  addPoly([
    { x: Xf1 + 0.33 * W, y: Yft - 0.5 },
    { x: Xf1 + 0.37857 * W, y: Yft - 0.5 },
    { x: Xf1 + 0.3857 * W, y: Yft - 1.25 },
    { x: Xf1 + 0.6143 * W, y: Yft - 1.25 },
    { x: Xf1 + 0.62143 * W, y: Yft - 0.5 },
    { x: Xf1 + 0.67 * W, y: Yft - 0.5 }
  ], "6");
  addArc(
    { x: Xf1 + 0.415 * W, y: Yft - 1.25 },
    { x: Xf1 + 0.585 * W, y: Yft - 1.25 },
    9.2, 9.2, 0, 0, 0, "10_NOTCH"
  );

  // Bottom slot cutout & notch
  addPoly([
    { x: Xf1 + 0.33 * W, y: Yfb + 0.5 },
    { x: Xf1 + 0.37857 * W, y: Yfb + 0.5 },
    { x: Xf1 + 0.3857 * W, y: Yfb + 1.25 },
    { x: Xf1 + 0.6143 * W, y: Yfb + 1.25 },
    { x: Xf1 + 0.62143 * W, y: Yfb + 0.5 },
    { x: Xf1 + 0.67 * W, y: Yfb + 0.5 }
  ], "13");
  addArc(
    { x: Xf1 + 0.415 * W, y: Yfb + 1.25 },
    { x: Xf1 + 0.585 * W, y: Yfb + 1.25 },
    9.2, 9.2, 0, 0, 1, "12_NOTCH"
  );

  // Glue flap left contour
  addPoly([
    { x: Xf1, y: Yft },
    { x: Xg + 0.71, y: Yft + 3.0 },
    { x: Xg + 0.71, y: Yfb - 3.0 },
    { x: Xf1, y: Yfb }
  ], "12");

  // Top flaps
  addPoly([
    { x: Xf1, y: Yft },
    { x: Xf1 + 3.0, y: Yft - 3.0 },
    { x: Xf1 + 3.0, y: YtuckTop },
    { x: Xd1 - 3.0, y: YtuckTop },
    { x: Xd1 - 3.0, y: Yft - 3.0 },
    { x: Xd1, y: Yft }
  ], "13_TOP");

  addPoly([
    { x: Xf2, y: Yft },
    { x: Xf2, y: Yft - Lt - 0.75 },
    { x: Xf2 + 0.37857 * W, y: Yft - Lt - 0.75 },
    { x: Xf2 + 0.37857 * W, y: Yft - Lt }
  ], "15_TOP");

  addPoly([
    { x: Xf2 + 0.62143 * W, y: Yft - Lt },
    { x: Xf2 + 0.62143 * W, y: Yft - Lt - 0.75 },
    { x: Xd2, y: Yft - Lt - 0.75 },
    { x: Xd2, y: Yft }
  ], "16_TOP");

  const tabStartX = Xf2 + 0.33 * W;
  const tabEndX = Xf2 + 0.67 * W;
  const dValTop = `M ${tabStartX.toFixed(4)},${(Yft - Lt - 0.75).toFixed(4)} L ${tabStartX.toFixed(4)},${(Yft - Lt - 2.5).toFixed(4)} C ${(tabStartX).toFixed(4)},${(Yft - Lt - 7.33).toFixed(4)} ${(tabStartX + 2.2).toFixed(4)},${(Yft - Lt - 10.54).toFixed(4)} ${(tabStartX + 4.4).toFixed(4)},${(Yft - Lt - 12.0).toFixed(4)} L ${(tabEndX - 4.4).toFixed(4)},${(Yft - Lt - 12.0).toFixed(4)} C ${(tabEndX - 2.2).toFixed(4)},${(Yft - Lt - 10.54).toFixed(4)} ${(tabEndX).toFixed(4)},${(Yft - Lt - 7.33).toFixed(4)} ${(tabEndX).toFixed(4)},${(Yft - Lt - 2.5).toFixed(4)} L ${tabEndX.toFixed(4)},${(Yft - Lt - 0.75).toFixed(4)}`;
  segments.push({
    id: segId++,
    svgId: `LINE_17`,
    kind: "OUTER",
    geometry: "bezier",
    start: { x: tabStartX, y: Yft - Lt - 0.75 },
    end: { x: tabEndX, y: Yft - Lt - 0.75 },
    points: [
      { x: tabStartX, y: Yft - Lt - 0.75 },
      { x: tabStartX, y: Yft - Lt - 2.5 },
      { x: tabEndX, y: Yft - Lt - 2.5 },
      { x: tabEndX, y: Yft - Lt - 0.75 }
    ],
    d: dValTop
  });

  addPoly([
    { x: Xd2, y: Yft },
    { x: Xd2 + 3.0, y: Yft - 3.0 },
    { x: Xd2 + 5.0, y: YdustTop },
    { x: Xd2R - 5.0, y: YdustTop },
    { x: Xd2R - 3.0, y: Yft - 3.0 },
    { x: Xd2R, y: Yft }
  ], "18_TOP");

  addPoly([
    { x: Xf2, y: Yft },
    { x: Xf2 - 3.0, y: Yft - 3.0 },
    { x: Xf2 - 5.0, y: YdustTop },
    { x: Xd1 + 6.0, y: YdustTop },
    { x: Xd1 + 0.5, y: Yft - 3.0 },
    { x: Xd1 + 0.5, y: Yft }
  ], "19_TOP");

  // Bottom flaps
  addPoly([
    { x: Xf1, y: Yfb },
    { x: Xf1 + 3.0, y: Yfb + 3.0 },
    { x: Xf1 + 3.0, y: YtuckBottom },
    { x: Xd1 - 3.0, y: YtuckBottom },
    { x: Xd1 - 3.0, y: Yfb + 3.0 },
    { x: Xd1, y: Yfb }
  ], "20_BOT");

  addPoly([
    { x: Xf2, y: Yfb },
    { x: Xf2, y: Yfb + Lt + 0.75 },
    { x: Xf2 + 0.37857 * W, y: Yfb + Lt + 0.75 },
    { x: Xf2 + 0.37857 * W, y: Yfb + Lt }
  ], "21_BOT");

  addPoly([
    { x: Xf2 + 0.62143 * W, y: Yfb + Lt },
    { x: Xf2 + 0.62143 * W, y: Yfb + Lt + 0.75 },
    { x: Xd2, y: Yfb + Lt + 0.75 },
    { x: Xd2, y: Yfb }
  ], "22_BOT");

  const dValBottom = `M ${tabStartX.toFixed(4)},${(Yfb + Lt + 0.75).toFixed(4)} L ${tabStartX.toFixed(4)},${(Yfb + Lt + 2.5).toFixed(4)} C ${(tabStartX).toFixed(4)},${(Yfb + Lt + 7.33).toFixed(4)} ${(tabStartX + 2.2).toFixed(4)},${(Yfb + Lt + 10.54).toFixed(4)} ${(tabStartX + 4.4).toFixed(4)},${(Yfb + Lt + 12.0).toFixed(4)} L ${(tabEndX - 4.4).toFixed(4)},${(Yfb + Lt + 12.0).toFixed(4)} C ${(tabEndX - 2.2).toFixed(4)},${(Yfb + Lt + 10.54).toFixed(4)} ${(tabEndX).toFixed(4)},${(Yfb + Lt + 7.33).toFixed(4)} ${(tabEndX).toFixed(4)},${(Yfb + Lt + 2.5).toFixed(4)} L ${tabEndX.toFixed(4)},${(Yfb + Lt + 0.75).toFixed(4)}`;
  segments.push({
    id: segId++,
    svgId: `LINE_23`,
    kind: "OUTER",
    geometry: "bezier",
    start: { x: tabStartX, y: Yfb + Lt + 0.75 },
    end: { x: tabEndX, y: Yfb + Lt + 0.75 },
    points: [
      { x: tabStartX, y: Yfb + Lt + 0.75 },
      { x: tabStartX, y: Yfb + Lt + 2.5 },
      { x: tabEndX, y: Yfb + Lt + 2.5 },
      { x: tabEndX, y: Yfb + Lt + 0.75 }
    ],
    d: dValBottom
  });

  addPoly([
    { x: Xd2, y: Yfb },
    { x: Xd2 + 3.0, y: Yfb + 3.0 },
    { x: Xd2 + 5.0, y: YdustBottom },
    { x: Xd2R - 5.0, y: YdustBottom },
    { x: Xd2R - 3.0, y: Yfb + 3.0 },
    { x: Xd2R, y: Yfb }
  ], "24_BOT");

  addPoly([
    { x: Xf2, y: Yfb },
    { x: Xf2 - 3.0, y: Yfb + 3.0 },
    { x: Xf2 - 5.0, y: YdustBottom },
    { x: Xd1 + 6.0, y: YdustBottom },
    { x: Xd1 + 0.5, y: Yfb + 3.0 },
    { x: Xd1 + 0.5, y: Yfb }
  ], "25_BOT");

  // Helper to generate SVG string
  const creases = segments.filter((s) => s.kind === "CREASE");
  const cuts = segments.filter((s) => s.kind === "OUTER");

  const buildSvgPath = (s: Segment) => {
    if (s.geometry === "line" || !s.geometry) {
      return `M ${s.start.x.toFixed(4)},${s.start.y.toFixed(4)} L ${s.end.x.toFixed(4)},${s.end.y.toFixed(4)}`;
    }
    if (s.geometry === "polyline" && s.points) {
      return "M " + s.points.map((pt) => `${pt.x.toFixed(4)},${pt.y.toFixed(4)}`).join(" L ");
    }
    if (s.geometry === "arc" && s.arc) {
      return `M ${s.start.x.toFixed(4)},${s.start.y.toFixed(4)} A ${s.arc.rx.toFixed(4)} ${s.arc.ry.toFixed(4)} ${s.arc.xar} ${s.arc.laf} ${s.arc.sf} ${s.end.x.toFixed(4)},${s.end.y.toFixed(4)}`;
    }
    if (s.geometry === "bezier" && s.d) {
      return s.d;
    }
    return "";
  };

  const creasePaths = creases.map((s) => `<path id="${s.svgId}" d="${buildSvgPath(s)}" stroke="#009640" stroke-width="0.45" fill="none" />`).join("\n    ");
  const cutPaths = cuts.map((s) => `<path id="${s.svgId}" d="${buildSvgPath(s)}" stroke="#e30613" stroke-width="0.45" fill="none" />`).join("\n    ");

  const totalW = Xd2R;
  const totalH = Yfb + Lt + 20.0; // bounding box height

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW.toFixed(2)} ${totalH.toFixed(2)}" width="${totalW.toFixed(2)}mm" height="${totalH.toFixed(2)}mm">
  <g id="CREASE">
    ${creasePaths}
  </g>
  <g id="CUT">
    ${cutPaths}
  </g>
</svg>`;

  return {
    params: p,
    derived: {
      W, H, D, Gf, Lt, Df, d2,
      width: totalW,
      height: totalH
    },
    segments,
    svg,
    bbox: { w: totalW, h: totalH }
  };
}
