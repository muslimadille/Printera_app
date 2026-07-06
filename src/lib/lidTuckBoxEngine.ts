/**
 * Lid Tuck Box v1 — Parametric Engine (Full Anchor-Delta Remap)
 * =============================================================
 *
 * Strategy: load the reference 200×50×200 SVG verbatim, parse every CREASE
 * line, CUT polyline, and CUT path, classify each coordinate against a fixed
 * inventory of named anchors (in mm), then re-emit each coordinate as
 *   target = target_anchor + (source - source_anchor).
 *
 * Because curve control points (handle bumps, side-flap rounded "ears",
 * closing-tab diagonals) sit within a couple millimetres of their endpoint's
 * anchor, both endpoint and handles classify to the same anchor and the curve
 * is preserved verbatim. Linear sections scale exactly because their two
 * endpoints land on different anchors that move with (L, D, H).
 *
 * Authoritative reference SVGs:
 *   docs/templates/_analysis/lid-tuck-box-v1/refs/template.svg            (200×50×200)
 *   docs/templates/_analysis/lid-tuck-box-v1/refs/200x200x50.svg          (= source)
 *   docs/templates/_analysis/lid-tuck-box-v1/refs/180x190x40.svg          (test A)
 *   docs/templates/_analysis/lid-tuck-box-v1/refs/220x210x60.svg          (test B)
 *
 * Per-row formulas (mm), validated on all three references:
 *   inner-flap visible = D − 0.75   double-crease gap = 1.5
 *   front-depth        = D          dual-crease gap   = 0.5
 *   base inner crease  = H − 1.0    dual-crease gap   = 0.5
 *   back-depth         = D          dual-crease gap   = 0.5
 *   lid inner crease   = H − 2.4    apex              = D − 0.25
 *   svgHeight  = 4·D + 2·H + 1.10   svgWidth = 2·D + L − 0.5
 *
 * No dependency on the runtime store, UI, or any other template engine.
 */

import {
  LID_TUCK_BOX_SOURCE_SVG,
  LID_TUCK_BOX_SOURCE_DIMS,
  MM_TO_PT,
} from './lidTuckBoxTemplate';

export interface LidTuckBoxInputs {
  L: number;
  D: number;
  H: number;
}

export interface CreaseLine {
  id: string;
  from: [number, number];
  to: [number, number];
}

export interface CutSubPath {
  id: string;
  d: string;
}

export interface LidTuckBoxGeometry {
  inputs: LidTuckBoxInputs;
  /** Final SVG width in mm. */
  flatWidth: number;
  /** Final SVG height in mm. */
  flatHeight: number;
  /** Inner body left edge anchor (= D mm). */
  B: number;
  /** All CREASE primitives, coordinates in mm. */
  creaseLines: CreaseLine[];
  /** All CUT sub-paths (slots, notch curve, side-flap edges), `d` in mm. */
  cutPaths: CutSubPath[];
  /** Single outer-contour cut, `d` in mm. */
  outerContour: CutSubPath;
  derived: {
    innerFlapHeight: number;
    frontDepth: number;
    backDepth: number;
    baseHeight: number;
    lidHeight: number;
    apexHeight: number;
    notchCenterX: number;
    slotAnchorsX: number[];
  };
}

// ---------------------------------------------------------------------------
// Anchor inventory (mm). Names are ordered; classification picks the nearest
// (in source units) for every coordinate.
// ---------------------------------------------------------------------------

interface AnchorSet {
  x: Record<string, number>;
  y: Record<string, number>;
}

export function computeAnchors(L: number, D: number, H: number): AnchorSet {
  return {
    x: {
      LEDGE: 0.25,
      ICOL_LV: D - 0.25,
      ICOL_LH: D,
      S1L: D + 0.2 * L,
      S1R: D + 0.4 * L,
      NOTCH_L: D + L / 2 - 7.5,
      CENTER: D + L / 2,
      NOTCH_R: D + L / 2 + 7.5,
      S2L: D + 0.6 * L,
      S2R: D + 0.8 * L,
      ICOL_RV: D + L - 0.25,
      ICOL_RH: D + L,
      REDGE: 2 * D + L - 0.75,
    },
    y: {
      TOP: 0.25,
      TAB_BOT: 2.5,
      IFLAP_BOT: D + 1.75,
      FDEPTH_TOP: D + 3.25,
      FDEPTH_BOT: 2 * D + 3.25,
      BASE_TOP: 2 * D + 3.75,
      BASE_BOT: 2 * D + H + 2.75,
      BDEPTH_TOP: 2 * D + H + 3.25,
      BDEPTH_BOT: 3 * D + H + 3.25,
      LID_TOP: 3 * D + H + 3.75,
      LID_BOT: 3 * D + 2 * H + 1.35,
      APEX_BOT: 4 * D + 2 * H + 1.1,
    },
  };
}

const SRC_ANCHORS = computeAnchors(
  LID_TUCK_BOX_SOURCE_DIMS.L,
  LID_TUCK_BOX_SOURCE_DIMS.D,
  LID_TUCK_BOX_SOURCE_DIMS.H,
);

function remap(
  v: number,
  axis: 'x' | 'y',
  src: AnchorSet,
  tgt: AnchorSet,
): number {
  const srcMap = src[axis];
  const tgtMap = tgt[axis];
  let bestKey = '';
  let bestDist = Infinity;
  for (const k of Object.keys(srcMap)) {
    const d = Math.abs(v - srcMap[k]);
    if (d < bestDist) {
      bestDist = d;
      bestKey = k;
    }
  }
  return tgtMap[bestKey] + (v - srcMap[bestKey]);
}

// ---------------------------------------------------------------------------
// SVG path parser → normalized absolute commands (in source mm).
// ---------------------------------------------------------------------------

type AbsCmd =
  | { c: 'M' | 'L'; x: number; y: number }
  | { c: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { c: 'Z' };

const NUM_RE = /-?\d*\.?\d+(?:[eE][+-]?\d+)?/g;

function tokenizePath(d: string): Array<{ cmd: string; nums: number[] }> {
  const out: Array<{ cmd: string; nums: number[] }> = [];
  let i = 0;
  while (i < d.length) {
    const ch = d[i];
    if (/[a-zA-Z]/.test(ch)) {
      // Find next command letter (or end).
      let j = i + 1;
      while (j < d.length && !/[a-zA-Z]/.test(d[j])) j++;
      const slice = d.slice(i + 1, j);
      const nums = (slice.match(NUM_RE) || []).map(Number);
      out.push({ cmd: ch, nums });
      i = j;
    } else {
      i++;
    }
  }
  return out;
}

/** Convert a path string from pt → absolute commands in mm. */
function normalizePathToAbsMm(d: string): AbsCmd[] {
  const tokens = tokenizePath(d);
  const cmds: AbsCmd[] = [];
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  let lastCtrlX = 0;
  let lastCtrlY = 0;
  let lastWasCubic = false;

  for (const t of tokens) {
    const C = t.cmd;
    const isRel = C === C.toLowerCase();
    const k = C.toUpperCase();
    const n = t.nums;
    const toMm = (pt: number) => pt / MM_TO_PT;

    let i = 0;
    // For multi-pair: implicit command repetition.
    while (i < n.length || k === 'Z') {
      if (k === 'M') {
        let x = toMm(n[i]);
        let y = toMm(n[i + 1]);
        if (isRel) {
          x += cx;
          y += cy;
        }
        cmds.push({ c: 'M', x, y });
        cx = x;
        cy = y;
        startX = x;
        startY = y;
        i += 2;
        // Subsequent pairs of M behave like L.
        while (i + 1 < n.length) {
          let xl = toMm(n[i]);
          let yl = toMm(n[i + 1]);
          if (isRel) {
            xl += cx;
            yl += cy;
          }
          cmds.push({ c: 'L', x: xl, y: yl });
          cx = xl;
          cy = yl;
          i += 2;
        }
        lastWasCubic = false;
        break;
      } else if (k === 'L') {
        let x = toMm(n[i]);
        let y = toMm(n[i + 1]);
        if (isRel) {
          x += cx;
          y += cy;
        }
        cmds.push({ c: 'L', x, y });
        cx = x;
        cy = y;
        i += 2;
        lastWasCubic = false;
      } else if (k === 'H') {
        let x = toMm(n[i]);
        if (isRel) x += cx;
        cmds.push({ c: 'L', x, y: cy });
        cx = x;
        i += 1;
        lastWasCubic = false;
      } else if (k === 'V') {
        let y = toMm(n[i]);
        if (isRel) y += cy;
        cmds.push({ c: 'L', x: cx, y });
        cy = y;
        i += 1;
        lastWasCubic = false;
      } else if (k === 'C') {
        let x1 = toMm(n[i]);
        let y1 = toMm(n[i + 1]);
        let x2 = toMm(n[i + 2]);
        let y2 = toMm(n[i + 3]);
        let x = toMm(n[i + 4]);
        let y = toMm(n[i + 5]);
        if (isRel) {
          x1 += cx;
          y1 += cy;
          x2 += cx;
          y2 += cy;
          x += cx;
          y += cy;
        }
        cmds.push({ c: 'C', x1, y1, x2, y2, x, y });
        lastCtrlX = x2;
        lastCtrlY = y2;
        cx = x;
        cy = y;
        i += 6;
        lastWasCubic = true;
      } else if (k === 'S') {
        // Smooth cubic — first control mirror of previous cubic.
        const rx1 = lastWasCubic ? 2 * cx - lastCtrlX : cx;
        const ry1 = lastWasCubic ? 2 * cy - lastCtrlY : cy;
        let x2 = toMm(n[i]);
        let y2 = toMm(n[i + 1]);
        let x = toMm(n[i + 2]);
        let y = toMm(n[i + 3]);
        if (isRel) {
          x2 += cx;
          y2 += cy;
          x += cx;
          y += cy;
        }
        cmds.push({ c: 'C', x1: rx1, y1: ry1, x2, y2, x, y });
        lastCtrlX = x2;
        lastCtrlY = y2;
        cx = x;
        cy = y;
        i += 4;
        lastWasCubic = true;
      } else if (k === 'Z') {
        cmds.push({ c: 'Z' });
        cx = startX;
        cy = startY;
        lastWasCubic = false;
        break;
      } else {
        // Unsupported command — skip remaining nums to avoid loop hang.
        i = n.length;
        break;
      }
    }
  }
  return cmds;
}

const fmt = (n: number) => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : r.toString();
};

/** Remap absolute commands (mm) → string `d` attribute, coords in mm. */
function remapCmdsToD(cmds: AbsCmd[], tgt: AnchorSet): string {
  const out: string[] = [];
  for (const c of cmds) {
    if (c.c === 'Z') {
      out.push('Z');
    } else if (c.c === 'M' || c.c === 'L') {
      const x = remap(c.x, 'x', SRC_ANCHORS, tgt);
      const y = remap(c.y, 'y', SRC_ANCHORS, tgt);
      out.push(`${c.c}${fmt(x)},${fmt(y)}`);
    } else if (c.c === 'C') {
      const x1 = remap(c.x1, 'x', SRC_ANCHORS, tgt);
      const y1 = remap(c.y1, 'y', SRC_ANCHORS, tgt);
      const x2 = remap(c.x2, 'x', SRC_ANCHORS, tgt);
      const y2 = remap(c.y2, 'y', SRC_ANCHORS, tgt);
      const x = remap(c.x, 'x', SRC_ANCHORS, tgt);
      const y = remap(c.y, 'y', SRC_ANCHORS, tgt);
      out.push(
        `C${fmt(x1)},${fmt(y1)} ${fmt(x2)},${fmt(y2)} ${fmt(x)},${fmt(y)}`,
      );
    }
  }
  return out.join(' ');
}

// ---------------------------------------------------------------------------
// Tiny SVG XML reader — extracts <line>, <polyline>, <path> children of
// <g id="CREASE"> and <g id="CUT"> from the source string.
// ---------------------------------------------------------------------------

interface SrcLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
interface SrcPoly {
  id: string;
  points: Array<[number, number]>;
}
interface SrcPath {
  id: string;
  d: string;
}

function attr(tag: string, name: string): string | null {
  const re = new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`);
  const m = tag.match(re);
  return m ? m[1] : null;
}

function parseSourceLayer(svg: string, gid: string): {
  lines: SrcLine[];
  polys: SrcPoly[];
  paths: SrcPath[];
} {
  const gStart = svg.indexOf(`<g id="${gid}"`);
  const gEnd = svg.indexOf('</g>', gStart);
  const slice = svg.slice(gStart, gEnd);
  const lines: SrcLine[] = [];
  const polys: SrcPoly[] = [];
  const paths: SrcPath[] = [];
  const tagRe = /<(line|polyline|path)\b[^/>]*\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(slice)) !== null) {
    const tag = m[0];
    const id = attr(tag, 'id') ?? '';
    if (m[1] === 'line') {
      lines.push({
        id,
        x1: parseFloat(attr(tag, 'x1') || '0'),
        y1: parseFloat(attr(tag, 'y1') || '0'),
        x2: parseFloat(attr(tag, 'x2') || '0'),
        y2: parseFloat(attr(tag, 'y2') || '0'),
      });
    } else if (m[1] === 'polyline') {
      const pts = (attr(tag, 'points') || '')
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      const points: Array<[number, number]> = [];
      for (let i = 0; i + 1 < pts.length; i += 2) {
        points.push([pts[i], pts[i + 1]]);
      }
      polys.push({ id, points });
    } else {
      paths.push({ id, d: attr(tag, 'd') || '' });
    }
  }
  return { lines, polys, paths };
}

const SRC_CREASE = parseSourceLayer(LID_TUCK_BOX_SOURCE_SVG, 'CREASE');
const SRC_CUT = parseSourceLayer(LID_TUCK_BOX_SOURCE_SVG, 'CUT');

// ---------------------------------------------------------------------------
// Main entry point.
// ---------------------------------------------------------------------------

export function buildLidTuckBoxGeometry(
  inputs: LidTuckBoxInputs,
): LidTuckBoxGeometry {
  const { L, D, H } = inputs;
  const tgt = computeAnchors(L, D, H);

  const remapPtX = (pt: number) => remap(pt / MM_TO_PT, 'x', SRC_ANCHORS, tgt);
  const remapPtY = (pt: number) => remap(pt / MM_TO_PT, 'y', SRC_ANCHORS, tgt);

  const creaseLines: CreaseLine[] = SRC_CREASE.lines.map(l => ({
    id: l.id,
    from: [remapPtX(l.x1), remapPtY(l.y1)],
    to: [remapPtX(l.x2), remapPtY(l.y2)],
  }));

  const cutPaths: CutSubPath[] = [];
  for (const p of SRC_CUT.polys) {
    const segs: string[] = [];
    p.points.forEach((pt, idx) => {
      const x = remapPtX(pt[0]);
      const y = remapPtY(pt[1]);
      segs.push(`${idx === 0 ? 'M' : 'L'}${fmt(x)},${fmt(y)}`);
    });
    cutPaths.push({ id: p.id, d: segs.join(' ') });
  }
  let outerContour: CutSubPath = { id: 'CUT_OUTER_CONTOUR', d: '' };
  for (const p of SRC_CUT.paths) {
    const cmds = normalizePathToAbsMm(p.d);
    const d = remapCmdsToD(cmds, tgt);
    if (p.id === 'CUT_OUTER_CONTOUR') {
      outerContour = { id: p.id, d };
    } else {
      cutPaths.push({ id: p.id, d });
    }
  }

  const flatWidth = 2 * D + L - 0.5;
  const flatHeight = 4 * D + 2 * H + 1.1;

  return {
    inputs,
    flatWidth,
    flatHeight,
    B: D,
    creaseLines,
    cutPaths,
    outerContour,
    derived: {
      innerFlapHeight: D - 0.75,
      frontDepth: D,
      backDepth: D,
      baseHeight: H - 1,
      lidHeight: H - 2.4,
      apexHeight: D - 0.25,
      notchCenterX: D + L / 2,
      slotAnchorsX: [0.2, 0.4, 0.6, 0.8].map(a => D + a * L),
    },
  };
}

/** Default inputs (matches the source reference). */
export const LID_TUCK_BOX_DEFAULTS: LidTuckBoxInputs = { L: 200, D: 50, H: 200 };

/** Provisional verified ranges (template-spec.md §4). */
export const LID_TUCK_BOX_RANGES = {
  L: [180, 220] as const,
  D: [40, 60] as const,
  H: [190, 210] as const,
};
