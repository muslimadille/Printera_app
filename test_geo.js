var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/t0011/geometry.ts
var geometry_exports = {};
__export(geometry_exports, {
  buildT0011Geometry: () => buildT0011Geometry
});
module.exports = __toCommonJS(geometry_exports);

// src/lib/t0011/types.ts
var T0011_REFERENCE = {
  width: 100,
  height: 150,
  depth: 50,
  glueFlap: 15
};
var T0011_DEFAULTS = {
  width: T0011_REFERENCE.width,
  height: T0011_REFERENCE.height,
  depth: T0011_REFERENCE.depth,
  glueFlap: T0011_REFERENCE.glueFlap,
  sheetWidth: 1e3,
  sheetHeight: 700,
  sheetMargin: 10,
  gripper: 10
};

// src/lib/t0011/geometry.ts
function buildT0011Geometry(p) {
  const W = p.referenceMode ? T0011_REFERENCE.width : p.width;
  const H = p.referenceMode ? T0011_REFERENCE.height : p.height;
  const D = p.referenceMode ? T0011_REFERENCE.depth : p.depth;
  const Gf = p.referenceMode ? T0011_REFERENCE.glueFlap : p.glueFlap;
  const F = D;
  const DF = D / 2;
  const ox = 2;
  const oy = 2;
  const X0 = ox;
  const X1 = ox + Gf;
  const X2 = X1 + D;
  const X3 = X2 + W;
  const X4 = X3 + D;
  const X5 = X4 + W;
  const Y0 = oy;
  const Y1_dust = oy + F - DF;
  const Y1 = oy + F;
  const Y2 = Y1 + H;
  const Y3 = Y2 + F;
  const segs = [];
  let idCounter = 1;
  const addCut = (x1, y1, x2, y2) => {
    segs.push({ id: idCounter++, svgId: `OUTER_${idCounter}`, kind: "OUTER", geometry: "line", start: { x: x1, y: y1 }, end: { x: x2, y: y2 } });
  };
  const addCrease = (x1, y1, x2, y2) => {
    segs.push({ id: idCounter++, svgId: `CREASE_${idCounter}`, kind: "CREASE", geometry: "line", start: { x: x1, y: y1 }, end: { x: x2, y: y2 } });
  };
  const addInnerCut = (x1, y1, x2, y2) => {
    segs.push({ id: idCounter++, svgId: `CUT_${idCounter}`, kind: "CUT", geometry: "line", start: { x: x1, y: y1 }, end: { x: x2, y: y2 } });
  };
  const P = (x, y) => ({ x, y });
  const arc = (s, e, rx, ry, xar, laf, sf, kind) => ({
    id: idCounter++,
    svgId: `${kind}_${idCounter}`,
    kind,
    geometry: "arc",
    start: s,
    end: e,
    arc: { rx, ry, xar, laf, sf }
  });
  const gfSlant = 2;
  addCut(X1, Y1, X0, Y1 + gfSlant);
  addCut(X0, Y1 + gfSlant, X0, Y2 - gfSlant);
  addCut(X0, Y2 - gfSlant, X1, Y2);
  addCut(X1, Y2, X1, Y3);
  addCut(X1, Y3, X2, Y3);
  addCut(X2, Y3, X2, Y2);
  addCut(X2, Y2, X2, Y3);
  addCut(X2, Y3, X3, Y3);
  addCut(X3, Y3, X3, Y2);
  addCut(X3, Y2, X3, Y3);
  addCut(X3, Y3, X4, Y3);
  addCut(X4, Y3, X4, Y2);
  addCut(X4, Y2, X4, Y3);
  addCut(X4, Y3, X5, Y3);
  addCut(X5, Y3, X5, Y2);
  addCut(X1, Y1, X1, Y1_dust);
  addCut(X1, Y1_dust, X2, Y1_dust);
  addCut(X2, Y1_dust, X2, Y1);
  addCut(X3, Y1, X3, Y1_dust);
  addCut(X3, Y1_dust, X4, Y1_dust);
  addCut(X4, Y1_dust, X4, Y1);
  addCut(X4, Y1, X4, Y0);
  addCut(X4, Y0, X5, Y0);
  addCut(X5, Y0, X5, Y1);
  const Xc2 = X2 + W / 2;
  const handleScale = Math.min(1, W / 200);
  const hOffset = 1.42;
  const hTopW = 122.835 * handleScale;
  const hArcR = 9.45 * handleScale;
  const hBaseW = 28.346 * handleScale;
  const hNeckH = 18.9 * handleScale;
  const hSlantH = 47.952 * handleScale;
  const hTotalNeckW = hTopW + 2 * hArcR + 2 * hBaseW;
  const hSlantW = (W - hTotalNeckW) / 2;
  const Y_handle_base = Y1 - hOffset;
  const Y_neck_bot = Y_handle_base - hSlantH;
  const Y_neck_top = Y_neck_bot - hNeckH;
  const Y_handle_top = Y_neck_top - hArcR;
  addCut(X2, Y_handle_base, X2 + hSlantW, Y_neck_bot);
  addCut(X2 + hSlantW, Y_neck_bot, X2 + hSlantW + hBaseW, Y_neck_bot);
  addCut(X2 + hSlantW + hBaseW, Y_neck_bot, X2 + hSlantW + hBaseW, Y_neck_top);
  segs.push(arc(P(X2 + hSlantW + hBaseW, Y_neck_top), P(X2 + hSlantW + hBaseW + hArcR, Y_handle_top), hArcR, hArcR, 0, 0, 1, "OUTER"));
  addCut(X2 + hSlantW + hBaseW + hArcR, Y_handle_top, Xc2 + hTopW / 2, Y_handle_top);
  segs.push(arc(P(Xc2 + hTopW / 2, Y_handle_top), P(Xc2 + hTopW / 2 + hArcR, Y_neck_top), hArcR, hArcR, 0, 0, 1, "OUTER"));
  addCut(Xc2 + hTopW / 2 + hArcR, Y_neck_top, Xc2 + hTopW / 2 + hArcR, Y_neck_bot);
  addCut(Xc2 + hTopW / 2 + hArcR, Y_neck_bot, Xc2 + hTopW / 2 + hArcR + hBaseW, Y_neck_bot);
  addCut(Xc2 + hTopW / 2 + hArcR + hBaseW, Y_neck_bot, X3, Y_handle_base);
  const Xc4 = X4 + W / 2;
  const slotDistBaseRatio = 82.984 / 141.732;
  const slotH = 9.378 * handleScale;
  const slotW_bot = 140.669 * handleScale;
  const slotW_top = 157.677 * handleScale;
  const Y_slot_bot = Y1 - D * slotDistBaseRatio;
  const Y_slot_top = Y_slot_bot - slotH;
  addInnerCut(Xc4 - slotW_top / 2, Y_slot_top, Xc4 - slotW_bot / 2, Y_slot_bot);
  addInnerCut(Xc4 - slotW_bot / 2, Y_slot_bot, Xc4 + slotW_bot / 2, Y_slot_bot);
  addInnerCut(Xc4 + slotW_bot / 2, Y_slot_bot, Xc4 + slotW_top / 2, Y_slot_top);
  addCrease(X1, Y1, X2, Y1);
  addCrease(X2, Y_handle_base, X3, Y_handle_base);
  addCrease(X3, Y1, X4, Y1);
  addCrease(X4, Y_handle_base, X5, Y_handle_base);
  addCrease(X1, Y2, X5, Y2);
  addCrease(X1, Y1, X1, Y2);
  addCrease(X2, Y1, X2, Y2);
  addCrease(X3, Y1, X3, Y2);
  addCrease(X4, Y1, X4, Y2);
  const bboxW = X5 + ox;
  const bboxH = Y3 + oy;
  const svgLines = [];
  svgLines.push(`<svg id="T0011" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bboxW} ${bboxH}" width="${bboxW}mm" height="${bboxH}mm">`);
  svgLines.push(`  <defs><style>
    .crease-line { fill: none; stroke: #00a651; stroke-width: 1.5; stroke-miterlimit: 10; }
    .outer-line { fill: none; stroke: #ed1c24; stroke-width: 1.5; stroke-miterlimit: 10; }
    .inner-cut-line { fill: none; stroke: #ed1c24; stroke-width: 1.5; stroke-miterlimit: 10; }
  </style></defs>`);
  const rounded = (n) => parseFloat(n.toFixed(4));
  const render = (s, cls) => {
    if (s.geometry === "line") return `  <line class="${cls}" x1="${rounded(s.start.x)}" y1="${rounded(s.start.y)}" x2="${rounded(s.end.x)}" y2="${rounded(s.end.y)}" id="${s.svgId}" />`;
    if (s.geometry === "arc" && s.arc) return `  <path class="${cls}" d="M ${rounded(s.start.x)},${rounded(s.start.y)} A ${rounded(s.arc.rx)} ${rounded(s.arc.ry)} ${s.arc.xar} ${s.arc.laf} ${s.arc.sf} ${rounded(s.end.x)},${rounded(s.end.y)}" id="${s.svgId}" />`;
    return "";
  };
  segs.filter((s) => s.kind === "CREASE").forEach((s) => svgLines.push(render(s, "crease-line")));
  segs.filter((s) => s.kind === "OUTER").forEach((s) => svgLines.push(render(s, "outer-line")));
  segs.filter((s) => s.kind === "CUT").forEach((s) => svgLines.push(render(s, "inner-cut-line")));
  svgLines.push("</svg>");
  return {
    params: p,
    derived: { W, H, D, Gf },
    segments: segs,
    bbox: { w: bboxW, h: bboxH },
    svg: svgLines.join("\n")
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildT0011Geometry
});
