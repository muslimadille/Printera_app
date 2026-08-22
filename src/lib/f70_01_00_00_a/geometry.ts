// F70_01_00_00_A — ECMA Pillow Box Parametric Geometry Engine
// Generates manufacturing dieline segments and production SVG markup matching ECMA F70.01.00.00 verbatim.

import type { F70_01_00_00_AParams, F70_01_00_00_AGeometry } from './types';
import { buildF70_01_00_00_AReference } from './reference';
import type { Segment } from '@/components/InteractiveSvgCanvas';

const round = (val: number, decimals = 3) => {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
};

export function buildF70_01_00_00_AGeometry(params: F70_01_00_00_AParams): F70_01_00_00_AGeometry {
  if (params.referenceMode) {
    return buildF70_01_00_00_AReference(params);
  }

  const W = Math.max(20, params.width);
  const H = Math.max(30, params.height);
  const D = Math.max(10, params.depth);
  const Gf = Math.max(8, params.glueFlap);

  // Arc sagitta (height of curved flap) derived from depth D & width W
  const s = round(Math.max(6, Math.min(W * 0.48, D * 0.675)));
  // Radius of arc passing through chord W with sagitta s: R = s/2 + W^2 / (8s)
  const R = round(s / 2 + (W * W) / (8 * s));

  // Thumb notch radius
  const rn = round(Math.max(5, Math.min(W * 0.22, params.thumbNotchRadius || 13.5)));

  // X Layout coordinates
  const x0 = 0; // Glue flap outer left
  const x1 = round(Gf); // Glue crease
  const x2 = round(Gf + W); // Center crease
  const x3 = round(Gf + 2 * W); // Outer right cut
  const totalW = x3;

  // Y Layout coordinates
  const yTopBase = s;
  const yBotBase = round(s + H);
  const yBotApex = round(s + H + s);
  const totalH = yBotApex;

  // Thumb notch intersection on top flap 2:
  // Circle center for top flap 2: (x2 + W/2, yTopBase - s + R)
  const xMid2 = round(x2 + W / 2);
  const yTopCenter = round(yTopBase - s + R);
  const dyTop = Math.sqrt(Math.max(0, R * R - rn * rn));
  const yNotchTop = round(yTopCenter - dyTop);

  // Circle center for bot flap 2: (x2 + W/2, yBotBase + s - R)
  const yBotCenter = round(yBotBase + s - R);
  const yNotchBot = round(yBotCenter + dyTop);

  // Crease Arc Path Strings
  const dCrease3 = `M ${x1} ${yTopBase} A ${R} ${R} 0 0 0 ${x2} ${yTopBase}`;
  const dCrease4 = `M ${x2} ${yTopBase} A ${R} ${R} 0 0 0 ${x3} ${yTopBase}`;
  const dCrease5 = `M ${x2} ${yBotBase} A ${R} ${R} 0 0 0 ${x1} ${yBotBase}`;
  const dCrease6 = `M ${x3} ${yBotBase} A ${R} ${R} 0 0 0 ${x2} ${yBotBase}`;

  // Cut Path Strings
  const dCut12 = `M ${x0} ${round(yTopBase + s * 0.55)} A ${R} ${R} 0 0 0 ${x1} ${yTopBase}`;
  const dCut13 = `M ${x1} ${yBotBase} A ${R} ${R} 0 0 0 ${x0} ${round(yBotBase - s * 0.55)}`;
  const dCut15 = `M ${x2} ${yTopBase} A ${R} ${R} 0 0 0 ${x1} ${yTopBase}`;
  const dCut16 = `M ${x1} ${yBotBase} A ${R} ${R} 0 0 0 ${x2} ${yBotBase}`;
  const dCut17 = `M ${x3} ${yTopBase} A ${R} ${R} 0 0 0 ${round(xMid2 + rn)} ${yNotchTop}`;
  const dCut18 = `M ${round(xMid2 - rn)} ${yNotchTop} A ${R} ${R} 0 0 0 ${x2} ${yTopBase}`;
  const dCut19 = `M ${round(xMid2 - rn)} ${yNotchTop} A ${rn} ${rn} 0 0 0 ${round(xMid2 + rn)} ${yNotchTop}`;
  const dCut20 = `M ${x2} ${yBotBase} A ${R} ${R} 0 0 0 ${round(xMid2 - rn)} ${yNotchBot}`;
  const dCut21 = `M ${round(xMid2 + rn)} ${yNotchBot} A ${R} ${R} 0 0 0 ${x3} ${yBotBase}`;
  const dCut22 = `M ${round(xMid2 + rn)} ${yNotchBot} A ${rn} ${rn} 0 0 0 ${round(xMid2 - rn)} ${yNotchBot}`;

  const segments: Segment[] = [
    // 1. Crease lines (Green - 6 elements)
    {
      id: 1,
      name: 'خط طي لسان اللصق',
      kind: 'CREASE',
      geometry: 'line',
      start: { x: x1, y: yTopBase },
      end: { x: x1, y: yBotBase },
      svgId: 'CREASE_1',
    },
    {
      id: 2,
      name: 'خط طي الفاصل الأوسط',
      kind: 'CREASE',
      geometry: 'line',
      start: { x: x2, y: yTopBase },
      end: { x: x2, y: yBotBase },
      svgId: 'CREASE_2',
    },
    {
      id: 3,
      name: 'قوس طي علوي - الوجه الأول',
      kind: 'CREASE',
      geometry: 'arc',
      start: { x: x1, y: yTopBase },
      end: { x: x2, y: yTopBase },
      d: dCrease3,
      svgId: 'CREASE_3',
    },
    {
      id: 4,
      name: 'قوس طي علوي - الوجه الثاني',
      kind: 'CREASE',
      geometry: 'arc',
      start: { x: x2, y: yTopBase },
      end: { x: x3, y: yTopBase },
      d: dCrease4,
      svgId: 'CREASE_4',
    },
    {
      id: 5,
      name: 'قوس طي سفلي - الوجه الأول',
      kind: 'CREASE',
      geometry: 'arc',
      start: { x: x2, y: yBotBase },
      end: { x: x1, y: yBotBase },
      d: dCrease5,
      svgId: 'CREASE_5',
    },
    {
      id: 6,
      name: 'قوس طي سفلي - الوجه الثاني',
      kind: 'CREASE',
      geometry: 'arc',
      start: { x: x3, y: yBotBase },
      end: { x: x2, y: yBotBase },
      d: dCrease6,
      svgId: 'CREASE_6',
    },

    // 2. Cut lines (Red - 16 elements matching reference)
    {
      id: 7,
      name: 'خط قص خارجي يمين',
      kind: 'OUTER',
      geometry: 'line',
      start: { x: x3, y: yTopBase },
      end: { x: x3, y: yBotBase },
      svgId: 'CUT_7',
    },
    {
      id: 8,
      name: 'قص لسان اللصق علوي',
      kind: 'OUTER',
      geometry: 'arc',
      start: { x: x0, y: round(yTopBase + s * 0.55) },
      end: { x: x1, y: yTopBase },
      d: dCut12,
      svgId: 'CUT_8',
    },
    {
      id: 9,
      name: 'قص لسان اللصق سفلي',
      kind: 'OUTER',
      geometry: 'arc',
      start: { x: x1, y: yBotBase },
      end: { x: x0, y: round(yBotBase - s * 0.55) },
      d: dCut13,
      svgId: 'CUT_9',
    },
    {
      id: 10,
      name: 'خط قص خارجي يسار لسان اللصق',
      kind: 'OUTER',
      geometry: 'line',
      start: { x: x0, y: round(yTopBase + s * 0.55) },
      end: { x: x0, y: round(yBotBase - s * 0.55) },
      svgId: 'CUT_10',
    },
    {
      id: 11,
      name: 'قوس قص علوي - الوجه الأول',
      kind: 'OUTER',
      geometry: 'arc',
      start: { x: x2, y: yTopBase },
      end: { x: x1, y: yTopBase },
      d: dCut15,
      svgId: 'CUT_11',
    },
    {
      id: 12,
      name: 'قوس قص سفلي - الوجه الأول',
      kind: 'OUTER',
      geometry: 'arc',
      start: { x: x1, y: yBotBase },
      end: { x: x2, y: yBotBase },
      d: dCut16,
      svgId: 'CUT_12',
    },
    {
      id: 13,
      name: 'قوس قص علوي يمين - الوجه الثاني',
      kind: 'OUTER',
      geometry: 'arc',
      start: { x: x3, y: yTopBase },
      end: { x: round(xMid2 + rn), y: yNotchTop },
      d: dCut17,
      svgId: 'CUT_13',
    },
    {
      id: 14,
      name: 'قوس قص علوي يسار - الوجه الثاني',
      kind: 'OUTER',
      geometry: 'arc',
      start: { x: round(xMid2 - rn), y: yNotchTop },
      end: { x: x2, y: yTopBase },
      d: dCut18,
      svgId: 'CUT_14',
    },
    {
      id: 15,
      name: 'فتحة الإصبع العلوية',
      kind: 'OUTER',
      geometry: 'arc',
      start: { x: round(xMid2 - rn), y: yNotchTop },
      end: { x: round(xMid2 + rn), y: yNotchTop },
      d: dCut19,
      svgId: 'CUT_15',
    },
    {
      id: 16,
      name: 'قوس قص سفلي يسار - الوجه الثاني',
      kind: 'OUTER',
      geometry: 'arc',
      start: { x: x2, y: yBotBase },
      end: { x: round(xMid2 - rn), y: yNotchBot },
      d: dCut20,
      svgId: 'CUT_16',
    },
    {
      id: 17,
      name: 'قوس قص سفلي يمين - الوجه الثاني',
      kind: 'OUTER',
      geometry: 'arc',
      start: { x: round(xMid2 + rn), y: yNotchBot },
      end: { x: x3, y: yBotBase },
      d: dCut21,
      svgId: 'CUT_17',
    },
    {
      id: 18,
      name: 'فتحة الإصبع السفلية',
      kind: 'OUTER',
      geometry: 'arc',
      start: { x: round(xMid2 + rn), y: yNotchBot },
      end: { x: round(xMid2 - rn), y: yNotchBot },
      d: dCut22,
      svgId: 'CUT_18',
    },
  ];

  // Build SVG Markup
  const svg = `<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}mm" height="${totalH}mm">
<defs>
  <style>
    .cls-1, .cls-2 { fill: none; stroke-miterlimit: 10; stroke-width: 0.45px; }
    .cls-1 { stroke: #009640; stroke-dasharray: 2.5, 1.5; }
    .cls-2 { stroke: #e30613; }
  </style>
</defs>
<g id="CREASE">
  <line class="cls-1" x1="${x1}" y1="${yTopBase}" x2="${x1}" y2="${yBotBase}" data-id="CREASE_1" />
  <line class="cls-1" x1="${x2}" y1="${yTopBase}" x2="${x2}" y2="${yBotBase}" data-id="CREASE_2" />
  <path class="cls-1" d="${dCrease3}" data-id="CREASE_3" />
  <path class="cls-1" d="${dCrease4}" data-id="CREASE_4" />
  <path class="cls-1" d="${dCrease5}" data-id="CREASE_5" />
  <path class="cls-1" d="${dCrease6}" data-id="CREASE_6" />
</g>
<g id="CUT">
  <line class="cls-2" x1="${x3}" y1="${yTopBase}" x2="${x3}" y2="${yBotBase}" data-id="CUT_7" />
  <path class="cls-2" d="${dCut12}" data-id="CUT_8" />
  <path class="cls-2" d="${dCut13}" data-id="CUT_9" />
  <line class="cls-2" x1="${x0}" y1="${round(yTopBase + s * 0.55)}" x2="${x0}" y2="${round(yBotBase - s * 0.55)}" data-id="CUT_10" />
  <path class="cls-2" d="${dCut15}" data-id="CUT_11" />
  <path class="cls-2" d="${dCut16}" data-id="CUT_12" />
  <path class="cls-2" d="${dCut17}" data-id="CUT_13" />
  <path class="cls-2" d="${dCut18}" data-id="CUT_14" />
  <path class="cls-2" d="${dCut19}" data-id="CUT_15" />
  <path class="cls-2" d="${dCut20}" data-id="CUT_16" />
  <path class="cls-2" d="${dCut21}" data-id="CUT_17" />
  <path class="cls-2" d="${dCut22}" data-id="CUT_18" />
</g>
</svg>`;

  return {
    params,
    derived: {
      totalWidth: totalW,
      totalHeight: totalH,
      w: W,
      h: H,
      d: D,
      glueFlap: Gf,
      arcSagitta: s,
      arcRadius: R,
      thumbNotchRadius: rn,
    },
    svg,
    bbox: {
      minX: 0,
      minY: 0,
      maxX: totalW,
      maxY: totalH,
      w: totalW,
      h: totalH,
    },
    segments,
  };
}
