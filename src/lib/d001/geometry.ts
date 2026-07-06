// D001 — Geometry Engine (Phase 2B)
// ----------------------------------------------------------------------------
// Two modes:
//   1) Reference Clone Mode  (referenceMode = true)
//      → delegates to reference.ts which emits TEMPLATE.svg verbatim.
//   2) Dynamic Geometry Mode (referenceMode = false / undefined)
//      → fully parametric. Every coordinate is derived from
//        (W, H, D, Glue_Flap, Lid_Tongue, Depth_Tongue).
//        At reference inputs (W=50, H=130, D=40, Gf=12, Lid=14.25, DT=39.75)
//        the dynamic engine reproduces the Reference Clone within ≤ 0.01 mm.
//
// Rules (enforced in tests):
//  - All units are mm; SVG viewBox is mm-based.
//  - No global scaling, no transform=scale, no <use>, no <clipPath>.
//  - 4 cubic Béziers (Seg 12, 14, 41, 43) preserved with deltas from
//    TEMPLATE.svg (curl_dx = 7.7297 mm, curl_dy = Lid_Tongue).
//  - Layer order in SVG: CREASE → OUTER → CUT (CUT painted last).
//  - Output always contains: 47 OUTER + 8 CUT + 12 CREASE = 67 segments.

import type { D001Params } from "./types";
import { buildD001Reference } from "./reference";

// ---- shared constants -------------------------------------------------------
export const PT_PER_MM = 2.83464566929;

// Calibrated micro-feature constants (mm)
const GLUE_FLAP_ANGLE_DEG = 25;
const TAN_GLUE = Math.tan((GLUE_FLAP_ANGLE_DEG * Math.PI) / 180);
const SEG3_LEN = 0.75;             // depth1/face2/depth2 stubs
const SEG5_LEG = 2;                // 45° leg at upper-outer corner
const SEG9_LEG = 3;                // 45° chamfer at depth corner
const RAMP_RATIO = 5.358 / 20;     // tongue slant dx per (D/2)
const SEG7_LID_GAP = 5;            // horizontal stops 5 mm before lid edge
const SEG8_LEG = 2;                // small dx of return ramp
const SEG48_EXTRA = 2;             // CUT_48 length = seg4H + 2
const ATTACHED_CUT_DROP = 2.25;    // CUT_49/51/53/55 vertical depth
const CREASE_OFFSET = 0.5;         // panel-edge offsets (Seg11/15/40/44)
const CREASE_INSET = 0.75;         // CREASE 61/62/67 inward inset
const FACE1_BOT_OFFSET = 0.5;      // CREASE 61 offset below faceBot
const FACE2_TOP_OFFSET = 0.5;      // CREASE 66 offset above faceTop

// Preserved cubic Bézier curl horizontal extent (mm).
// Curl vertical extent = Lid_Tongue (parametric per call).
const CURL_DX = 7.7297;

// ---- types ----------------------------------------------------------------
export interface Pt { x: number; y: number }
export interface Segment {
  id: number;                  // 1..67
  svgId: string;               // LINE_n / CUT_n / CREASE_n
  kind: "OUTER" | "CUT" | "CREASE";
  geometry: "line" | "bezier" | "polyline" | "fillet";
  start: Pt;
  end: Pt;
  bezier?: { c1: Pt; c2: Pt };
  points?: Pt[];
  /** Fillet only: intermediate tangent point. Path = line(start→via) + bezier(via→end). */
  via?: Pt;
  preserved?: boolean;
}
export interface D001Derived {
  W: number; H: number; D: number;
  glueFlap: number;
  faceHeight: number;
  depth1: number; depth2: number;
  coverVertical: number;
  lidCurveHeight: number;
  seg4Height: number;
  width: number;
  height: number;
}
export interface D001Geometry {
  params: D001Params;
  derived: D001Derived;
  segments: Segment[];
  bbox: { w: number; h: number };
  svg: string;
}

// ============================================================================
//                              PUBLIC API
// ============================================================================
export function buildD001Geometry(p: D001Params): D001Geometry {
  if (p.referenceMode) return buildD001Reference(p);
  return buildD001Dynamic(p);
}

// ============================================================================
//                       DYNAMIC GEOMETRY MODE (Phase 2B)
// ============================================================================
export function buildD001Dynamic(p: D001Params): D001Geometry {
  const W   = p.width;
  const H   = p.height;
  const D   = p.depth;
  const Gf  = p.glueFlap;
  const Lid = p.lidTongue;          // controls ONLY lid Béziers (Seg 12/14/41/43)
  const DT  = p.depthTongue;        // controls ONLY depth tongue heights (seg4H)
  const Cov = D - 0.25;             // Cover_Vertical derived ONLY from Depth
  const d2  = D - 0.5;

  // X anchors (origin = glue-flap left)
  const Xg  = 0;
  const Xf1 = Gf;
  const Xd1 = Gf + W;
  const Xf2 = Gf + W + D;
  const Xd2 = Gf + 2 * W + D;
  const Xd2R = Xd2 + d2;

  // Y anchors (origin = top apex of TOP lid tongue)
  const Y0   = 0;
  const Ylp  = Lid;                 // lid panel top
  const Yft  = Lid + Cov;           // face top
  const Yfb  = Yft + H;             // face bottom
  const Ybe  = Yfb + Cov;           // bottom-lid panel edge
  const Yab  = Ybe + Lid;           // bottom apex
  void Yab; void Y0; // used implicitly via Y values

  // Glue flap chamfer — Seg 1 (top) and Seg 46 (bottom) have independent angles.
  const topAngle = (Number.isFinite(p.glueFlapTopAngle) && (p.glueFlapTopAngle as number) >= 0)
    ? (p.glueFlapTopAngle as number) : GLUE_FLAP_ANGLE_DEG;
  const botAngle = (Number.isFinite(p.glueFlapBottomAngle) && (p.glueFlapBottomAngle as number) >= 0)
    ? (p.glueFlapBottomAngle as number) : GLUE_FLAP_ANGLE_DEG;
  const gDyTop = Gf * Math.tan((topAngle * Math.PI) / 180);
  const gDyBot = Gf * Math.tan((botAngle * Math.PI) / 180);

  // Depth-tongue starting height (Seg 4/22/29/33) = LOCK.
  // Depth_Tongue (DT) is the actual control. Width rule (W<=25 → 3mm, W>25 → 5mm)
  // is only a minimum fallback when DT is missing/invalid.
  const widthFallback = W <= 25 ? 3 : 5;
  const seg4H  = (Number.isFinite(DT) && DT > 0) ? DT : widthFallback;
  const halfD  = D / 2;

  // Depth Tongue TOTAL height (Seg 4→7 vertical extent above face top).
  // Auto = seg4H + SEG5_LEG + halfD (the reference geometry).
  // User override flexes ONLY the middle ramp region (Seg 6/7),
  // preserving Lock (Seg 4) and end chamfers (Seg 5/9).
  const autoTongueH = seg4H + SEG5_LEG + halfD;
  const userTongueH = p.depthTongueTotalHeight;
  const tongueTotalH = (Number.isFinite(userTongueH) && (userTongueH as number) > 0)
    ? (userTongueH as number)
    : autoTongueH;
  // Middle ramp vertical extent (replaces halfD in Seg 6/7/19/20/21/25/26/27/35/36).
  // Clamp to a tiny positive minimum so Seg 6's slant angle is preserved.
  const middleExt = Math.max(0.001, tongueTotalH - seg4H - SEG5_LEG);
  // Seg 6's horizontal extent preserves its original slope (RAMP_RATIO = dx/dy).
  const rampDx = middleExt * RAMP_RATIO;
  // Seg 8 closes back from Seg 9 chamfer to Seg 7 horizontal line.
  const seg8Dy = tongueTotalH - SEG9_LEG;

  // Lid attachment X
  const Xtpl = Xf2 + CREASE_OFFSET;  // top lid panel LEFT  attachment
  const Xtpr = Xd2 - CREASE_OFFSET;  // top lid panel RIGHT attachment
  const Xbpl = Xf1 + CREASE_OFFSET;  // bottom lid panel LEFT
  const Xbpr = Xd1 - CREASE_OFFSET;  // bottom lid panel RIGHT
  const Xtal = Xtpl + CURL_DX;       // top apex LEFT  inflection
  const Xtar = Xtpr - CURL_DX;       // top apex RIGHT inflection
  const Xbal = Xbpl + CURL_DX;       // bot apex LEFT  inflection
  const Xbar = Xbpr - CURL_DX;       // bot apex RIGHT inflection

  // Bézier deltas (vertical components scale with Lid)
  const k = Lid / 14.25;
  const B_TL_apex = { c1:{x:-4.8228, y: 3.1385*k}, c2:{x:-CURL_DX, y: 8.5019*k}, end:{x:-CURL_DX, y: Lid} };
  const B_TR_panel= { c1:{x: 0,      y:-5.7518*k}, c2:{x:-2.9087,  y:-11.1135*k},end:{x:-CURL_DX, y:-Lid} };
  const B_BR_apex = { c1:{x: 4.8228, y:-3.1385*k}, c2:{x: CURL_DX, y:-8.5019*k}, end:{x: CURL_DX, y:-Lid} };
  const B_BL_panel= { c1:{x: 0,      y: 5.7518*k}, c2:{x: 2.9087,  y: 11.1135*k},end:{x: CURL_DX, y: Lid} };

  const segs: Segment[] = [];

  // ---------- OUTER (47 segments, IDs 1..47) -------------------------------
  // Glue flap closing sub-loop
  segs.push(outer( 1, P(Xf1,       Yft),                 P(Xg,        Yft + gDyTop)));
  segs.push(outer(47, P(Xg,        Yft + gDyTop),         P(Xg,        Yfb - gDyBot)));
  segs.push(outer(46, P(Xg,        Yfb - gDyBot),         P(Xf1,       Yfb)));

  // Face1 left + bottom-lid panel + tongue
  segs.push(outer(45, P(Xf1,       Yfb),                 P(Xf1,       Ybe)));
  segs.push(outer(44, P(Xf1,       Ybe),                 P(Xbpl,      Ybe)));
  segs.push(bez  (43, P(Xbpl,      Ybe),                 B_BL_panel));
  segs.push(outer(42, P(Xbal,      Yab),                 P(Xbar,      Yab)));
  segs.push(bez  (41, P(Xbar,      Yab),                 B_BR_apex));
  segs.push(outer(40, P(Xbpr,      Ybe),                 P(Xd1,       Ybe)));
  segs.push(outer(39, P(Xd1,       Ybe),                 P(Xd1,       Yfb)));

  // Depth1 bottom tongue (Seg 38..33)
  segs.push(outer(38, P(Xd1,                   Yfb),                            P(Xd1 + SEG9_LEG,           Yfb + SEG9_LEG)));
  segs.push(outer(37, P(Xd1 + SEG9_LEG,        Yfb + SEG9_LEG),                 P(Xd1 + SEG9_LEG + SEG8_LEG,Yfb + SEG9_LEG + seg8Dy)));
  segs.push(outer(36, P(Xd1 + SEG9_LEG + SEG8_LEG, Yfb + tongueTotalH),
                      P(Xf2 - SEG3_LEN - SEG5_LEG - rampDx, Yfb + tongueTotalH)));
  segs.push(outer(35, P(Xf2 - SEG3_LEN - SEG5_LEG - rampDx, Yfb + tongueTotalH),
                      P(Xf2 - SEG3_LEN - SEG5_LEG,          Yfb + seg4H + SEG5_LEG)));
  segs.push(outer(34, P(Xf2 - SEG3_LEN - SEG5_LEG,          Yfb + seg4H + SEG5_LEG),
                      P(Xf2 - SEG3_LEN,                     Yfb + seg4H)));
  segs.push(outer(33, P(Xf2 - SEG3_LEN, Yfb + seg4H),       P(Xf2 - SEG3_LEN, Yfb)));

  // Face2 bottom stubs + edge
  segs.push(outer(32, P(Xf2,                  Yfb), P(Xf2 - SEG3_LEN, Yfb)));
  segs.push(outer(31, P(Xd2,                  Yfb), P(Xf2,            Yfb)));
  segs.push(outer(30, P(Xd2 + SEG3_LEN,       Yfb), P(Xd2,            Yfb)));

  // Depth2 bottom tongue (Seg 29..24)
  segs.push(outer(29, P(Xd2 + SEG3_LEN,                     Yfb),
                      P(Xd2 + SEG3_LEN,                     Yfb + seg4H)));
  segs.push(outer(28, P(Xd2 + SEG3_LEN,                     Yfb + seg4H),
                      P(Xd2 + SEG3_LEN + SEG5_LEG,          Yfb + seg4H + SEG5_LEG)));
  segs.push(outer(27, P(Xd2 + SEG3_LEN + SEG5_LEG,          Yfb + seg4H + SEG5_LEG),
                      P(Xd2 + SEG3_LEN + SEG5_LEG + rampDx, Yfb + tongueTotalH)));
  segs.push(outer(26, P(Xd2 + SEG3_LEN + SEG5_LEG + rampDx, Yfb + tongueTotalH),
                      P(Xd2R - SEG9_LEG - SEG8_LEG,         Yfb + tongueTotalH)));
  segs.push(outer(25, P(Xd2R - SEG9_LEG - SEG8_LEG,         Yfb + tongueTotalH),
                      P(Xd2R - SEG9_LEG,                    Yfb + SEG9_LEG)));
  segs.push(outer(24, P(Xd2R - SEG9_LEG,                    Yfb + SEG9_LEG),
                      P(Xd2R,                               Yfb)));

  // Depth2 right vertical
  segs.push(outer(23, P(Xd2R, Yfb), P(Xd2R, Yft - seg4H)));

  // Depth2 top tongue (Seg 22..17)
  segs.push(outer(22, P(Xd2R - SEG5_LEG,                    Yft - seg4H - SEG5_LEG),
                      P(Xd2R,                               Yft - seg4H)));
  segs.push(outer(21, P(Xd2R - SEG5_LEG - rampDx,           Yft - tongueTotalH),
                      P(Xd2R - SEG5_LEG,                    Yft - seg4H - SEG5_LEG)));
  segs.push(outer(20, P(Xd2 + SEG7_LID_GAP,                 Yft - tongueTotalH),
                      P(Xd2R - SEG5_LEG - rampDx,           Yft - tongueTotalH)));
  segs.push(outer(19, P(Xd2 + SEG7_LID_GAP,                 Yft - tongueTotalH),
                      P(Xd2 + SEG9_LEG,                     Yft - SEG9_LEG)));
  segs.push(outer(18, P(Xd2 + SEG9_LEG, Yft - SEG9_LEG),    P(Xd2, Yft)));
  segs.push(outer(17, P(Xd2,            Yft),               P(Xd2, Ylp)));

  // Top-lid tongue (Seg 16..10)
  segs.push(outer(16, P(Xd2,   Ylp), P(Xtpr, Ylp)));
  segs.push(outer(15, P(Xtpr,  Ylp), P(Xtpr, Ylp)));         // 0-length spacer
  segs.push(bez  (14, P(Xtpr,  Ylp), B_TR_panel));
  segs.push(outer(13, P(Xtar,  Y0),  P(Xtal, Y0)));
  segs.push(bez  (12, P(Xtal,  Y0),  B_TL_apex));
  segs.push(outer(11, P(Xtpl,  Ylp), P(Xf2, Ylp)));
  segs.push(outer(10, P(Xf2,   Ylp), P(Xf2, Yft)));

  // Depth1 top tongue (Seg 9..4)
  segs.push(outer( 9, P(Xf2 - SEG9_LEG,                Yft - SEG9_LEG),
                      P(Xf2,                           Yft)));
  segs.push(outer( 8, P(Xf2 - SEG9_LEG - SEG8_LEG,     Yft - SEG9_LEG - seg8Dy),
                      P(Xf2 - SEG9_LEG,                Yft - SEG9_LEG)));
  segs.push(outer( 7, P(Xd1 + SEG3_LEN + SEG5_LEG + rampDx, Yft - tongueTotalH),
                      P(Xf2 - SEG7_LID_GAP,                 Yft - tongueTotalH)));
  segs.push(outer( 6, P(Xd1 + SEG3_LEN + SEG5_LEG,     Yft - seg4H - SEG5_LEG),
                      P(Xd1 + SEG3_LEN + SEG5_LEG + rampDx, Yft - tongueTotalH)));
  segs.push(outer( 5, P(Xd1 + SEG3_LEN,                Yft - seg4H),
                      P(Xd1 + SEG3_LEN + SEG5_LEG,     Yft - seg4H - SEG5_LEG)));
  segs.push(outer( 4, P(Xd1 + SEG3_LEN,                Yft - seg4H),
                      P(Xd1 + SEG3_LEN,                Yft)));

  // Face1 top stubs + edge
  segs.push(outer( 3, P(Xd1 + SEG3_LEN, Yft), P(Xd1, Yft)));
  segs.push(outer( 2, P(Xd1,            Yft), P(Xf1, Yft)));

  // ---------- CUT (8 segments, IDs 48..55) --------------------------------
  const cutLen = seg4H + SEG48_EXTRA;
  segs.push(cutPoly(48, [P(Xd2, Ylp + CREASE_INSET), P(Xd2, Ylp), P(Xd2 - cutLen, Ylp)]));
  segs.push(cutLine(49, P(Xd2 - cutLen, Ylp), P(Xd2 - cutLen, Ylp + ATTACHED_CUT_DROP)));
  segs.push(cutPoly(50, [P(Xf2, Ylp + CREASE_INSET), P(Xf2, Ylp), P(Xf2 + cutLen, Ylp)]));
  segs.push(cutLine(51, P(Xf2 + cutLen, Ylp), P(Xf2 + cutLen, Ylp + ATTACHED_CUT_DROP)));
  segs.push(cutPoly(52, [P(Xf1, Ybe - CREASE_INSET), P(Xf1, Ybe), P(Xf1 + cutLen, Ybe)]));
  segs.push(cutLine(53, P(Xf1 + cutLen, Ybe), P(Xf1 + cutLen, Ybe - ATTACHED_CUT_DROP)));
  segs.push(cutPoly(54, [P(Xd1, Ybe - CREASE_INSET), P(Xd1, Ybe), P(Xd1 - cutLen, Ybe)]));
  segs.push(cutLine(55, P(Xd1 - cutLen, Ybe), P(Xd1 - cutLen, Ybe - ATTACHED_CUT_DROP)));

  // ---------- CREASE (12 segments, IDs 56..67) ----------------------------
  segs.push(crs(56, P(Xd2, Yft), P(Xd2, Yfb)));
  segs.push(crs(57, P(Xf2, Yft), P(Xf2, Yfb)));
  segs.push(crs(58, P(Xd1, Yfb), P(Xd1, Yft)));
  segs.push(crs(59, P(Xf1, Yfb), P(Xf1, Yft)));
  segs.push(crs(60, P(Xd2 + SEG3_LEN, Yfb), P(Xd2R, Yfb)));
  segs.push(crs(61, P(Xf1, Yfb + FACE1_BOT_OFFSET), P(Xd1, Yfb + FACE1_BOT_OFFSET)));
  segs.push(crs(62, P(Xd1 - cutLen, Ybe - CREASE_INSET), P(Xf1 + cutLen, Ybe - CREASE_INSET)));
  segs.push(crs(63, P(Xf2 - SEG3_LEN, Yfb), P(Xd1, Yfb)));
  segs.push(crs(64, P(Xd1 + SEG3_LEN, Yft), P(Xf2, Yft)));
  segs.push(crs(65, P(Xd2R, Yft), P(Xd2, Yft)));
  segs.push(crs(66, P(Xf2, Yft - FACE2_TOP_OFFSET), P(Xd2, Yft - FACE2_TOP_OFFSET)));
  segs.push(crs(67, P(Xd2 - cutLen, Ylp + CREASE_INSET), P(Xf2 + cutLen, Ylp + CREASE_INSET)));

  // ---------- Depth-tongue corner fillet (4 corners only) -----------------
  const R = Number.isFinite(p.depthTongueCornerRadius) ? Math.max(0, p.depthTongueCornerRadius as number) : 0;
  if (R > 0) {
    const byId = new Map(segs.map(s => [s.id, s] as const));
    applyDepthFillet(byId.get(6)!,  byId.get(7)!,  R); // top-depth1
    applyDepthFillet(byId.get(21)!, byId.get(20)!, R); // top-depth2
    applyDepthFillet(byId.get(27)!, byId.get(26)!, R); // bot-depth2
    applyDepthFillet(byId.get(35)!, byId.get(36)!, R); // bot-depth1
  }

  return finalize(p, segs, {
    W, H, D, glueFlap: Gf,
    faceHeight: H + 0.5,
    depth1: D, depth2: d2,
    coverVertical: Cov,
    lidCurveHeight: Lid,
    seg4Height: seg4H,
  });
}

// ============================================================================
//                              HELPERS
// ============================================================================
const P = (x: number, y: number): Pt => ({ x, y });

function outer(id: number, s: Pt, e: Pt): Segment {
  return { id, svgId: `LINE_${id}`, kind: "OUTER", geometry: "line", start: s, end: e };
}
function bez(id: number, start: Pt, d: { c1: Pt; c2: Pt; end: Pt }): Segment {
  const c1  = { x: start.x + d.c1.x,  y: start.y + d.c1.y  };
  const c2  = { x: start.x + d.c2.x,  y: start.y + d.c2.y  };
  const end = { x: start.x + d.end.x, y: start.y + d.end.y };
  return {
    id, svgId: `LINE_${id}`, kind: "OUTER", geometry: "bezier",
    start, end, bezier: { c1, c2 }, preserved: true,
  };
}
function cutLine(id: number, s: Pt, e: Pt): Segment {
  return { id, svgId: `CUT_${id}`, kind: "CUT", geometry: "line", start: s, end: e };
}
function cutPoly(id: number, pts: Pt[]): Segment {
  return {
    id, svgId: `CUT_${id}`, kind: "CUT", geometry: "polyline",
    start: pts[0], end: pts[pts.length - 1], points: pts,
  };
}
function crs(id: number, s: Pt, e: Pt): Segment {
  return { id, svgId: `CREASE_${id}`, kind: "CREASE", geometry: "line", start: s, end: e };
}

/**
 * Replace the sharp meeting between a ramp segment and a horizontal segment of
 * a depth tongue with a tangent fillet of radius R (auto-clamped). The fillet
 * lives entirely on the ramp segment as geometry "fillet": line(start→via) then
 * cubic-Bezier(via→end). The horizontal segment is trimmed so its corner
 * endpoint becomes the second tangent point. Total segment count is preserved.
 */
function applyDepthFillet(ramp: Segment, horiz: Segment, R: number): void {
  const eq = (a: Pt, b: Pt) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
  let corner: Pt, rampOther: Pt, horizOther: Pt;
  let cornerAtRampEnd: boolean, cornerAtHorizStart: boolean;
  if (eq(ramp.end, horiz.start))      { corner = ramp.end;   rampOther = ramp.start; horizOther = horiz.end;   cornerAtRampEnd = true;  cornerAtHorizStart = true;  }
  else if (eq(ramp.end, horiz.end))   { corner = ramp.end;   rampOther = ramp.start; horizOther = horiz.start; cornerAtRampEnd = true;  cornerAtHorizStart = false; }
  else if (eq(ramp.start, horiz.start)){corner = ramp.start; rampOther = ramp.end;   horizOther = horiz.end;   cornerAtRampEnd = false; cornerAtHorizStart = true;  }
  else if (eq(ramp.start, horiz.end)) { corner = ramp.start; rampOther = ramp.end;   horizOther = horiz.start; cornerAtRampEnd = false; cornerAtHorizStart = false; }
  else return;

  const dx1 = rampOther.x - corner.x, dy1 = rampOther.y - corner.y;
  const dx2 = horizOther.x - corner.x, dy2 = horizOther.y - corner.y;
  const l1 = Math.hypot(dx1, dy1), l2 = Math.hypot(dx2, dy2);
  if (l1 < 1e-6 || l2 < 1e-6) return;
  const u1 = { x: dx1 / l1, y: dy1 / l1 };
  const u2 = { x: dx2 / l2, y: dy2 / l2 };
  const cosT = Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y));
  const theta = Math.acos(cosT);
  if (theta < 1e-4 || Math.PI - theta < 1e-4) return;
  const tHalf = Math.tan(theta / 2);
  const tMaxSafe = Math.min(l1, l2) * 0.9;
  let t = R / tHalf;
  let Reff = R;
  if (t > tMaxSafe) { t = tMaxSafe; Reff = t * tHalf; }
  const ta = { x: corner.x + u1.x * t, y: corner.y + u1.y * t };
  const tb = { x: corner.x + u2.x * t, y: corner.y + u2.y * t };
  const alpha = Math.PI - theta;
  const L = (4 / 3) * Math.tan(alpha / 4) * Reff;
  // tangent at ta points toward corner (= -u1); tangent at tb points away from corner (= +u2)
  const c1 = { x: ta.x - u1.x * L, y: ta.y - u1.y * L };
  const c2 = { x: tb.x - u2.x * L, y: tb.y - u2.y * L };

  ramp.geometry = "fillet";
  ramp.start = rampOther;
  ramp.via = ta;
  ramp.end = tb;
  ramp.bezier = { c1, c2 };
  void cornerAtRampEnd; // path orientation no longer matters for rendering
  if (cornerAtHorizStart) horiz.start = tb; else horiz.end = tb;
}

function finalize(
  params: D001Params,
  segs: Segment[],
  base: Omit<D001Derived, "width" | "height">,
): D001Geometry {
  const all: Pt[] = [];
  for (const s of segs) {
    all.push(s.start, s.end);
    if (s.bezier) all.push(s.bezier.c1, s.bezier.c2);
    if (s.points) all.push(...s.points);
    if (s.via) all.push(s.via);
  }
  const minX = Math.min(...all.map(p => p.x));
  const minY = Math.min(...all.map(p => p.y));
  const maxX = Math.max(...all.map(p => p.x));
  const maxY = Math.max(...all.map(p => p.y));
  const bbox = { w: maxX - minX, h: maxY - minY };
  const r = (n: number) => Math.round(n * 100000) / 100000;
  const sh = (p: Pt): Pt => ({ x: r(p.x - minX), y: r(p.y - minY) });
  const shifted: Segment[] = segs.map(s => ({
    ...s,
    start: sh(s.start),
    end:   sh(s.end),
    bezier: s.bezier ? { c1: sh(s.bezier.c1), c2: sh(s.bezier.c2) } : undefined,
    points: s.points ? s.points.map(sh) : undefined,
    via:    s.via ? sh(s.via) : undefined,
  }));
  return {
    params,
    derived: { ...base, width: bbox.w, height: bbox.h },
    segments: shifted,
    bbox,
    svg: renderDynamicSvg(shifted, bbox),
  };
}

function renderDynamicSvg(segs: Segment[], bbox: { w: number; h: number }): string {
  const r = (n: number) => Math.round(n * 100000) / 100000;
  const cutCol = "#ED1C24";
  const crsCol = "#00A651";
  const w = r(bbox.w), h = r(bbox.h);
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">`);

  // Layer order (bottom → top): CREASE → OUTER → CUT
  out.push(`  <g id="CREASE" fill="none" stroke="${crsCol}" stroke-width="0.45" stroke-miterlimit="10">`);
  for (const s of segs.filter(s => s.kind === "CREASE")) {
    out.push(`    <line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}" data-id="${s.svgId}"/>`);
  }
  out.push(`  </g>`);

  out.push(`  <g id="OUTER" fill="none" stroke="${cutCol}" stroke-width="0.45" stroke-miterlimit="10">`);
  for (const s of segs.filter(s => s.kind === "OUTER")) {
    if (s.geometry === "line" && s.start.x === s.end.x && s.start.y === s.end.y) continue;
    if (s.geometry === "fillet" && s.via && s.bezier) {
      out.push(`    <path d="M${s.start.x},${s.start.y} L${s.via.x},${s.via.y} C${s.bezier.c1.x},${s.bezier.c1.y} ${s.bezier.c2.x},${s.bezier.c2.y} ${s.end.x},${s.end.y}" data-id="${s.svgId}" data-fillet="true"/>`);
    } else if (s.geometry === "bezier" && s.bezier) {
      out.push(`    <path d="M${s.start.x},${s.start.y} C${s.bezier.c1.x},${s.bezier.c1.y} ${s.bezier.c2.x},${s.bezier.c2.y} ${s.end.x},${s.end.y}" data-id="${s.svgId}" data-preserved="true"/>`);
    } else {
      out.push(`    <line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}" data-id="${s.svgId}"/>`);
    }
  }
  out.push(`  </g>`);

  out.push(`  <g id="CUT" fill="none" stroke="${cutCol}" stroke-width="0.45" stroke-linecap="round" stroke-linejoin="round" opacity="1">`);
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
