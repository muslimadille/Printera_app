/**
 * Die Cut 5 — Original SVG path templates (sacred).
 *
 * Each template stores:
 *   • d            : the LITERAL `d` attribute from the Original SVG
 *                    (absolute coordinates in SVG pt, never approximated)
 *   • srcBbox      : the source bounding box (in SVG pt) that the template
 *                    was authored against
 *
 * At render time, each template is transformed into an engine zone bbox
 * (in mm) using `transformSvgPath`. This preserves the original curves
 * (cubic/quadratic/arc) exactly — no procedural rectangles, no generic
 * approximations.
 *
 * Reference dimensions used to author the SVG: L=300, D=150, H=180.
 *   PT_PER_MM = 2.8347, viewBox = "0 0 2677.3 1233.1"
 *   AX(pt) = 0, 127.6, 977.97, 1403.17, 2253.57, 2677.37
 *   AY(pt) = 0, 212.6, 425.2, 935.4, 1233.1
 */

export interface SvgTemplate {
  d: string;
  srcBbox: { x: number; y: number; w: number; h: number };
}

// Left handle slot — class="st1" subpath #3 (closed stadium)
export const HANDLE_SLOT_F1: SvgTemplate = {
  d: 'M467.7,65.2 h170.1 c15.2,0 29.2,8.1 36.8,21.3 s7.6,29.4 0,42.5 c-7.6,13.2 -21.6,21.3 -36.8,21.3 H467.7 c-15.2,0 -29.2,-8.1 -36.8,-21.3 c-7.6,-13.2 -7.6,-29.4 0,-42.5 C438.5,73.3 452.5,65.2 467.7,65.2 Z',
  // Authored inside Face1 handle band: x in [129..976.5] pt, y in [0..212.6] pt.
  srcBbox: { x: 129, y: 0, w: 847.5, h: 212.6 },
};

// Right handle slot — class="st1" subpath #4 (open in source; we close it here)
export const HANDLE_SLOT_F2: SvgTemplate = {
  d: 'M1743.3,65.2 c-15.2,0 -29.2,8.1 -36.8,21.3 c-7.6,13.2 -7.6,29.4 0,42.5 c7.6,13.2 21.6,21.3 36.8,21.3 h170.1 c15.2,0 29.2,-8.1 36.8,-21.3 c7.6,-13.2 7.6,-29.4 0,-42.5 c-7.6,-13.2 -21.6,-21.3 -36.8,-21.3 Z',
  // Authored inside Face2 handle band: x in [1404.6..2252.1] pt, y in [0..212.6] pt.
  srcBbox: { x: 1404.6, y: 0, w: 847.5, h: 212.6 },
};

// Left purple tongue — class="st1" subpath #2 (thin vertical stadium)
export const TONGUE_D1: SvgTemplate = {
  d: 'M1194.8,419.5 V268.2 c0,-1.5 -0.8,-2.9 -2.1,-3.7 c-1.3,-0.8 -2.9,-0.8 -4.3,0 c-1.3,0.8 -2.1,2.2 -2.1,3.7 v151.3 c0,1.5 0.8,2.9 2.1,3.7 c1.3,0.8 2.9,0.8 4.3,0 C1194,422.4 1194.8,421 1194.8,419.5 Z',
  // Authored at the bottom of Depth1's above-body strip (column AX2..AX3 = 977.97..1403.17 pt, AY0..AY2 = 0..425.2 pt).
  srcBbox: { x: 977.97, y: 0, w: 425.2, h: 425.2 },
};

// Right purple tongue — class="st1" subpath #1
export const TONGUE_D2: SvgTemplate = {
  d: 'M2470.4,419.5 V268.2 c0,-1.5 -0.8,-2.9 -2.1,-3.7 c-1.3,-0.8 -2.9,-0.8 -4.3,0 c-1.3,0.8 -2.1,2.2 -2.1,3.7 v151.3 c0,1.5 0.8,2.9 2.1,3.7 c1.3,0.8 2.9,0.8 4.3,0 C2469.6,422.4 2470.4,421 2470.4,419.5 Z',
  // Authored at the bottom of Depth2's above-body strip (column AX4..AX5 = 2253.57..2677.37 pt, AY0..AY2 = 0..425.2 pt).
  srcBbox: { x: 2253.57, y: 0, w: 423.8, h: 425.2 },
};

// Outer dieline contour — class="st1" subpath #5 (the entire perimeter:
// glue tab, top tongue tabs, side, bottom interlock flaps). Used to provide
// the Original SVG visual shape for the dieline boundary. Authored against
// the full source viewBox (0,0,2677.3,1233.1).
export const OUTER_CONTOUR: SvgTemplate = {
  d: 'M127.6,425.2 c0.4,0 0.7,-0.1 1,-0.4 s0.4,-0.6 0.4,-1 V79.4 c0,-13.2 7,-25.3 18.4,-31.9 s25.4,-6.6 36.9,0 c11.4,6.6 18.4,18.7 18.4,31.9 s0,0.4 0.3,0.5 c0.2,0.1 0.4,0.2 0.6,0.2 s0.4,-0.2 0.5,-0.3 l45.5,-79.1 c0.1,-0.2 0.3,-0.4 0.5,-0.5 c0.3,-0.2 0.5,-0.2 0.7,-0.2 h603.8 c0.5,0 1,0.3 1.2,0.7 l45.6,79 c0.1,0.2 0.3,0.3 0.5,0.3 s0.4,0 0.6,-0.2 c0.2,-0.1 0.3,-0.3 0.3,-0.5 c0,-13.2 7,-25.3 18.4,-31.9 s25.4,-6.6 36.9,0 c11.4,6.6 18.4,18.7 18.4,31.9 v344.4 c0,0.4 0.2,0.8 0.5,1 c0.3,0.3 0.7,0.4 1.1,0.4 c0.4,0 0.8,-0.2 1,-0.5 l167.1,-210.2 c10.8,-13.5 27.1,-21.4 44.4,-21.4 s33.6,7.9 44.4,21.4 l167.1,210.2 c0.2,0.3 0.6,0.5 1,0.5 s0.8,-0.1 1.1,-0.4 c0.3,-0.3 0.5,-0.6 0.5,-1 V79.4 c0,-13.2 7,-25.3 18.4,-31.9 s25.4,-6.6 36.9,0 c11.4,6.6 18.4,18.7 18.4,31.9 s0,0.4 0.3,0.5 c0.2,0.1 0.4,0.2 0.6,0.2 s0.4,-0.2 0.5,-0.3 l45.4,-79.1 c0.1,-0.2 0.3,-0.4 0.5,-0.5 s0.5,-0.2 0.7,-0.2 h603.8 c0.2,0 0.5,0 0.7,0.2 c0.2,0.1 0.4,0.3 0.5,0.5 l45.6,79 c0.1,0.2 0.3,0.3 0.5,0.3 s0.4,0 0.6,-0.2 c0.2,-0.1 0.3,-0.3 0.3,-0.5 c0,-13.2 7,-25.3 18.4,-31.9 s25.4,-6.6 36.9,0 c11.4,6.6 18.4,18.7 18.4,31.9 v344.4 c0,0.4 0.2,0.8 0.5,1 c0.3,0.3 0.7,0.4 1.1,0.4 c0.4,0 0.8,-0.2 1,-0.5 l167.1,-210.2 c10.8,-13.5 27.1,-21.4 44.4,-21.4 s33.6,7.9 44.4,21.4 l166.8,209.3 v511.7 L2466.2,1148 v62.4 c0,6 -2.4,11.8 -6.6,16 s-10,6.6 -16,6.6 h-188.5 V936.2 c0,-0.4 -0.2,-0.8 -0.5,-1 c-0.3,-0.3 -0.7,-0.4 -1.1,-0.4 s-0.8,0.2 -1,0.6 L2040.3,1148 v62.4 c0,6 -2.4,11.8 -6.6,16 c-4.3,4.3 -10,6.6 -16,6.6 h-378.4 c-6,0 -11.8,-2.4 -16,-6.6 c-4.3,-4.3 -6.6,-10 -6.6,-16 V1148 l-212.2,-212.6 c-0.2,-0.3 -0.6,-0.5 -1,-0.6 c-0.4,0 -0.8,0 -1.1,0.4 c-0.3,0.3 -0.5,0.6 -0.5,1 V1233 h-188.5 c-6,0 -11.8,-2.4 -16,-6.6 c-4.3,-4.3 -6.6,-10 -6.6,-16 V1148 L979.3,935.4 c-0.2,-0.3 -0.6,-0.5 -1,-0.6 c-0.4,0 -0.8,0 -1.1,0.4 c-0.3,0.3 -0.5,0.6 -0.5,1 V1233 H788.2 c-6,0 -11.8,-2.4 -16,-6.6 c-4.3,-4.3 -6.6,-10 -6.6,-16 V1148 H340.4 v62.4 c0,6 -2.4,11.8 -6.6,16 c-4.3,4.3 -10,6.6 -16,6.6 H129.3 V936.2 c0,-0.4 -0.1,-0.7 -0.4,-1 c-0.3,-0.3 -0.6,-0.4 -1,-0.4 L0,900.7 V459.4 L127.6,425.2 Z',
  srcBbox: { x: 0, y: 0, w: 2677.3, h: 1233.1 },
};

// ── SVG path transformer ──────────────────────────────────────────────────
// Parses an SVG `d` string, re-emits it with every coordinate mapped from
// `srcBbox` (the source coordinate system the path was authored in) into a
// target bbox. Absolute commands transform absolute points; relative
// commands scale their deltas. Supports M, L, H, V, C, S, Q, T, A, Z and
// their lowercase variants. No approximation — control points and end
// points are preserved exactly.

const CMD_RE = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
const NUM_RE = /-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;

const fmt = (n: number) => {
  // Avoid scientific notation; 4 decimals is plenty for mm-scale geometry.
  if (!Number.isFinite(n)) return '0';
  return Math.abs(n) < 1e-6 ? '0' : n.toFixed(4).replace(/\.?0+$/, '');
};

interface BBox { x: number; y: number; w: number; h: number }

export function transformSvgPath(d: string, src: BBox, dst: BBox): string {
  const sx = dst.w / (src.w || 1);
  const sy = dst.h / (src.h || 1);
  const mapX = (x: number) => dst.x + (x - src.x) * sx;
  const mapY = (y: number) => dst.y + (y - src.y) * sy;
  const dX = (dx: number) => dx * sx;
  const dY = (dy: number) => dy * sy;

  const out: string[] = [];
  let m: RegExpExecArray | null;
  CMD_RE.lastIndex = 0;
  while ((m = CMD_RE.exec(d)) !== null) {
    const cmd = m[1];
    const nums = (m[2].match(NUM_RE) || []).map(Number);
    const isAbs = cmd === cmd.toUpperCase();
    const c = cmd.toUpperCase();

    if (c === 'Z') { out.push('Z'); continue; }

    const parts: number[] = [];
    let i = 0;
    while (i < nums.length) {
      switch (c) {
        case 'M':
        case 'L':
        case 'T': {
          const x = nums[i++]; const y = nums[i++];
          parts.push(isAbs ? mapX(x) : dX(x), isAbs ? mapY(y) : dY(y));
          break;
        }
        case 'H': {
          const x = nums[i++];
          parts.push(isAbs ? mapX(x) : dX(x));
          break;
        }
        case 'V': {
          const y = nums[i++];
          parts.push(isAbs ? mapY(y) : dY(y));
          break;
        }
        case 'C': {
          const x1 = nums[i++], y1 = nums[i++];
          const x2 = nums[i++], y2 = nums[i++];
          const x = nums[i++], y = nums[i++];
          parts.push(
            isAbs ? mapX(x1) : dX(x1), isAbs ? mapY(y1) : dY(y1),
            isAbs ? mapX(x2) : dX(x2), isAbs ? mapY(y2) : dY(y2),
            isAbs ? mapX(x)  : dX(x),  isAbs ? mapY(y)  : dY(y),
          );
          break;
        }
        case 'S':
        case 'Q': {
          const x1 = nums[i++], y1 = nums[i++];
          const x = nums[i++], y = nums[i++];
          parts.push(
            isAbs ? mapX(x1) : dX(x1), isAbs ? mapY(y1) : dY(y1),
            isAbs ? mapX(x)  : dX(x),  isAbs ? mapY(y)  : dY(y),
          );
          break;
        }
        case 'A': {
          const rx = nums[i++], ry = nums[i++];
          const rot = nums[i++];
          const laf = nums[i++], sf = nums[i++];
          const x = nums[i++], y = nums[i++];
          // Scale radii independently (non-uniform scale → approximate).
          parts.push(rx * sx, ry * sy, rot, laf, sf,
            isAbs ? mapX(x) : dX(x), isAbs ? mapY(y) : dY(y));
          break;
        }
        default: i = nums.length;
      }
    }
    out.push(cmd + ' ' + parts.map(fmt).join(' '));
  }
  return out.join(' ');
}
