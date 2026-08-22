// F70_01_00_00_A — Verbatim Reference SVG Generator
// Recreates the exact reference SVG geometry converted from pt to mm (1 mm = 2.83464566929 pt).

import type { F70_01_00_00_AParams, F70_01_00_00_AGeometry } from './types';
import type { Segment } from '@/components/InteractiveSvgCanvas';

const PT_PER_MM = 2.83464566929;
const toMm = (pt: number) => Math.round((pt / PT_PER_MM) * 1000) / 1000;

export function buildF70_01_00_00_AReference(params: F70_01_00_00_AParams): F70_01_00_00_AGeometry {
  // viewBox: 0 0 811.874 769.759 in pt -> 0 0 286.411 271.554 in mm
  const wMm = toMm(811.874);
  const hMm = toMm(769.759);

  const dCrease3 = `M 18.534 36.764 a 84.384 84.384 0 0 0 29.782 24.859 a 84.42 84.42 0 0 0 37.753 8.91 a 84.427 84.427 0 0 0 37.757 -8.91 a 84.427 84.427 0 0 0 29.781 -24.859`;
  const dCrease4 = `M 153.608 38.117 a 84.443 84.443 0 0 0 29.533 24.73 a 84.41 84.41 0 0 0 37.443 9.035 a 84.44 84.44 0 0 0 37.563 -8.537 a 84.407 84.407 0 0 0 29.853 -24.34`;
  const dCrease5 = `M 153.608 239.372 a 84.423 84.423 0 0 0 -135.074 0`;
  const dCrease6 = `M 288.000 237.132 a 84.42 84.42 0 0 0 -134.392 0.891`;

  const dCut12 = `M 2.999 53.965 a 84.223 84.223 0 0 0 15.535 -15.848`;
  const dCut13 = `M 18.534 238.023 a 84.251 84.251 0 0 0 -15.535 -15.853`;
  const dCut15 = `M 153.608 36.764 a 84.422 84.422 0 0 0 -135.074 0`;
  const dCut16 = `M 18.534 239.372 a 84.423 84.423 0 0 0 135.074 0`;
  const dCut17 = `M 288.000 37.226 a 84.424 84.424 0 0 0 -53.397 -31.797`;
  const dCut18 = `M 207.676 5.429 a 84.387 84.387 0 0 0 -54.069 32.688`;
  const dCut19 = `M 207.676 5.429 a 13.507 13.507 0 0 0 26.927 0`;
  const dCut20 = `M 153.608 238.023 a 84.404 84.404 0 0 0 54.069 32.683`;
  const dCut21 = `M 234.603 270.706 a 84.406 84.406 0 0 0 53.397 -31.797`;
  const dCut22 = `M 234.603 270.706 a 13.507 13.507 0 0 0 -26.927 0`;

  const segments: Segment[] = [
    // Crease lines (Green)
    {
      id: 1,
      name: 'خط طي لسان اللصق',
      kind: 'CREASE',
      geometry: 'line',
      start: { x: toMm(46.033), y: toMm(101.547) },
      end: { x: toMm(46.033), y: toMm(668.211) },
      svgId: 'CREASE_1',
    },
    {
      id: 2,
      name: 'خط طي الفاصل الأوسط',
      kind: 'CREASE',
      geometry: 'line',
      start: { x: toMm(428.919), y: toMm(101.547) },
      end: { x: toMm(428.919), y: toMm(668.211) },
      svgId: 'CREASE_2',
    },
    {
      id: 3,
      name: 'قوس طي علوي - الوجه الأول',
      kind: 'CREASE',
      geometry: 'arc',
      start: { x: toMm(52.537 - 6.504), y: toMm(104.212 - 6.5) },
      end: { x: toMm(435.423 - 6.504), y: toMm(104.212 - 6.5) },
      d: dCrease3,
      svgId: 'CREASE_3',
    },
    {
      id: 4,
      name: 'قوس طي علوي - الوجه الثاني',
      kind: 'CREASE',
      geometry: 'arc',
      start: { x: toMm(435.423 - 6.504), y: toMm(108.048 - 6.5) },
      end: { x: toMm(816.378 - 6.504), y: toMm(105.522 - 6.5) },
      d: dCrease4,
      svgId: 'CREASE_4',
    },
    {
      id: 5,
      name: 'قوس طي سفلي - الوجه الأول',
      kind: 'CREASE',
      geometry: 'arc',
      start: { x: toMm(435.423 - 6.504), y: toMm(678.534 - 6.5) },
      end: { x: toMm(52.537 - 6.504), y: toMm(678.534 - 6.5) },
      d: dCrease5,
      svgId: 'CREASE_5',
    },
    {
      id: 6,
      name: 'قوس طي سفلي - الوجه الثاني',
      kind: 'CREASE',
      geometry: 'arc',
      start: { x: toMm(816.378 - 6.504), y: toMm(672.186 - 6.5) },
      end: { x: toMm(435.423 - 6.504), y: toMm(674.712 - 6.5) },
      d: dCrease6,
      svgId: 'CREASE_6',
    },

    // Cut lines (Red)
    {
      id: 7,
      name: 'خط قص خارجي يمين',
      kind: 'OUTER',
      geometry: 'line',
      start: { x: toMm(809.874), y: toMm(99.022) },
      end: { x: toMm(809.874), y: toMm(670.724) },
      svgId: 'CUT_7',
    },
    {
      id: 8,
      name: 'وصلة قص علوية 1',
      kind: 'CUT',
      geometry: 'line',
      start: { x: toMm(46.033), y: toMm(97.711) },
      end: { x: toMm(46.033), y: toMm(101.547) },
      svgId: 'CUT_8',
    },
    {
      id: 9,
      name: 'وصلة قص علوية 2',
      kind: 'CUT',
      geometry: 'line',
      start: { x: toMm(428.919), y: toMm(97.711) },
      end: { x: toMm(428.919), y: toMm(101.547) },
      svgId: 'CUT_9',
    },
    {
      id: 10,
      name: 'وصلة قص سفلية 1',
      kind: 'CUT',
      geometry: 'line',
      start: { x: toMm(46.033), y: toMm(672.034) },
      end: { x: toMm(46.033), y: toMm(668.211) },
      svgId: 'CUT_10',
    },
    {
      id: 11,
      name: 'وصلة قص سفلية 2',
      kind: 'CUT',
      geometry: 'line',
      start: { x: toMm(428.919), y: toMm(672.034) },
      end: { x: toMm(428.919), y: toMm(668.211) },
      svgId: 'CUT_11',
    },
    {
      id: 12,
      name: 'قص لسان اللصق علوي',
      kind: 'OUTER',
      geometry: 'arc',
      start: { x: toMm(8.5 - 6.504), y: toMm(152.972 - 6.5) },
      end: { x: toMm(52.537 - 6.504), y: toMm(108.048 - 6.5) },
      d: dCut12,
      svgId: 'CUT_12',
    },
    {
      id: 13,
      name: 'قص لسان اللصق سفلي',
      kind: 'OUTER',
      geometry: 'arc',
      start: { x: toMm(52.537 - 6.504), y: toMm(674.712 - 6.5) },
      end: { x: toMm(8.5 - 6.504), y: toMm(629.773 - 6.5) },
      d: dCut13,
      svgId: 'CUT_13',
    },
    {
      id: 14,
      name: 'خط قص خارجي يسار لسان اللصق',
      kind: 'OUTER',
      geometry: 'line',
      start: { x: toMm(2), y: toMm(146.472) },
      end: { x: toMm(2), y: toMm(623.273) },
      svgId: 'CUT_14',
    },
    {
      id: 15,
      name: 'قوس قص علوي - الوجه الأول',
      kind: 'OUTER',
      geometry: 'arc',
      start: { x: toMm(435.423 - 6.504), y: toMm(104.212 - 6.5) },
      end: { x: toMm(52.537 - 6.504), y: toMm(104.212 - 6.5) },
      d: dCut15,
      svgId: 'CUT_15',
    },
    {
      id: 16,
      name: 'قوس قص سفلي - الوجه الأول',
      kind: 'OUTER',
      geometry: 'arc',
      start: { x: toMm(52.537 - 6.504), y: toMm(678.534 - 6.5) },
      end: { x: toMm(435.423 - 6.504), y: toMm(678.534 - 6.5) },
      d: dCut16,
      svgId: 'CUT_16',
    },
    {
      id: 17,
      name: 'قوس قص علوي يمين - الوجه الثاني',
      kind: 'OUTER',
      geometry: 'arc',
      start: { x: toMm(816.378 - 6.504), y: toMm(105.522 - 6.5) },
      end: { x: toMm(665.017 - 6.504), y: toMm(15.389 - 6.5) },
      d: dCut17,
      svgId: 'CUT_17',
    },
    {
      id: 18,
      name: 'قوس قص علوي يسار - الوجه الثاني',
      kind: 'OUTER',
      geometry: 'arc',
      start: { x: toMm(588.689 - 6.504), y: toMm(15.389 - 6.5) },
      end: { x: toMm(435.423 - 6.504), y: toMm(108.048 - 6.5) },
      d: dCut18,
      svgId: 'CUT_18',
    },
    {
      id: 19,
      name: 'فتحة الإصبع العلوية',
      kind: 'OUTER',
      geometry: 'arc',
      start: { x: toMm(588.689 - 6.504), y: toMm(15.389 - 6.5) },
      end: { x: toMm(665.017 - 6.504), y: toMm(15.389 - 6.5) },
      d: dCut19,
      svgId: 'CUT_19',
    },
    {
      id: 20,
      name: 'قوس قص سفلي يسار - الوجه الثاني',
      kind: 'OUTER',
      geometry: 'arc',
      start: { x: toMm(435.423 - 6.504), y: toMm(674.712 - 6.5) },
      end: { x: toMm(588.689 - 6.504), y: toMm(767.357 - 6.5) },
      d: dCut20,
      svgId: 'CUT_20',
    },
    {
      id: 21,
      name: 'قوس قص سفلي يمين - الوجه الثاني',
      kind: 'OUTER',
      geometry: 'arc',
      start: { x: toMm(665.017 - 6.504), y: toMm(767.357 - 6.5) },
      end: { x: toMm(816.378 - 6.504), y: toMm(672.186 - 6.5) },
      d: dCut21,
      svgId: 'CUT_21',
    },
    {
      id: 22,
      name: 'فتحة الإصبع السفلية',
      kind: 'OUTER',
      geometry: 'arc',
      start: { x: toMm(665.017 - 6.504), y: toMm(767.357 - 6.5) },
      end: { x: toMm(588.689 - 6.504), y: toMm(767.357 - 6.5) },
      d: dCut22,
      svgId: 'CUT_22',
    },
  ];

  const svg = `<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 811.874 769.759"><defs><style>.cls-1,.cls-2{fill:none;stroke-miterlimit:10;stroke-width:4px;}.cls-1{stroke:#009640;}.cls-2{stroke:#e30613;}</style></defs><line class="cls-1" x1="46.033" y1="101.547" x2="46.033" y2="668.211" data-id="CREASE_1"/><line class="cls-1" x1="428.919" y1="101.547" x2="428.919" y2="668.211" data-id="CREASE_2"/><path class="cls-1" d="M52.537,104.212a239.2,239.2,0,0,0,84.42,70.466,239.3,239.3,0,0,0,107.016,25.258A239.321,239.321,0,0,0,351,174.678a239.32,239.32,0,0,0,84.419-70.466" transform="translate(-6.504 -6.5)" data-id="CREASE_3"/><path class="cls-1" d="M435.423,108.048a239.366,239.366,0,0,0,83.717,70.1,239.272,239.272,0,0,0,106.139,25.61,239.358,239.358,0,0,0,106.477-24.2,239.264,239.264,0,0,0,84.622-68.994" transform="translate(-6.504 -6.5)" data-id="CREASE_4"/><path class="cls-1" d="M435.423,678.534a239.309,239.309,0,0,0-382.886,0" transform="translate(-6.504 -6.5)" data-id="CREASE_5"/><path class="cls-1" d="M816.378,672.186a239.3,239.3,0,0,0-380.955,2.526" transform="translate(-6.504 -6.5)" data-id="CREASE_6"/><line class="cls-2" x1="809.874" y1="99.022" x2="809.874" y2="670.724" data-id="CUT_7"/><line class="cls-2" x1="46.033" y1="97.711" x2="46.033" y2="101.547" data-id="CUT_8"/><line class="cls-2" x1="428.919" y1="97.711" x2="428.919" y2="101.547" data-id="CUT_9"/><line class="cls-2" x1="46.033" y1="672.034" x2="46.033" y2="668.211" data-id="CUT_10"/><line class="cls-2" x1="428.919" y1="672.034" x2="428.919" y2="668.211" data-id="CUT_11"/><path class="cls-2" d="M8.5,152.972a238.743,238.743,0,0,0,44.033-44.924" transform="translate(-6.504 -6.5)" data-id="CUT_12"/><path class="cls-2" d="M52.537,674.712A238.823,238.823,0,0,0,8.5,629.773" transform="translate(-6.504 -6.5)" data-id="CUT_13"/><line class="cls-2" x1="2" y1="146.472" x2="2" y2="623.273" data-id="CUT_14"/><path class="cls-2" d="M435.423,104.212a239.307,239.307,0,0,0-382.886,0" transform="translate(-6.504 -6.5)" data-id="CUT_15"/><path class="cls-2" d="M52.537,678.534a239.308,239.308,0,0,0,382.886,0" transform="translate(-6.504 -6.5)" data-id="CUT_16"/><path class="cls-2" d="M816.378,105.522A239.313,239.313,0,0,0,665.017,15.389" transform="translate(-6.504 -6.5)" data-id="CUT_17"/><path class="cls-2" d="M588.689,15.389a239.208,239.208,0,0,0-153.266,92.659" transform="translate(-6.504 -6.5)" data-id="CUT_18"/><path class="cls-2" d="M588.689,15.389a38.287,38.287,0,0,0,76.328,0" transform="translate(-6.504 -6.5)" data-id="CUT_19"/><path class="cls-2" d="M435.423,674.712a239.255,239.255,0,0,0,153.266,92.645" transform="translate(-6.504 -6.5)" data-id="CUT_20"/><path class="cls-2" d="M665.017,767.357a239.262,239.262,0,0,0,151.361-90.133" transform="translate(-6.504 -6.5)" data-id="CUT_21"/><path class="cls-2" d="M665.017,767.357a38.287,38.287,0,0,0-76.328,0" transform="translate(-6.504 -6.5)" data-id="CUT_22"/></svg>`;

  return {
    params,
    derived: {
      totalWidth: wMm,
      totalHeight: hMm,
      w: 135.0,
      h: 200.0,
      d: 50.0,
      glueFlap: 15.5,
      arcSagitta: 33.76,
      arcRadius: 84.42,
      thumbNotchRadius: 13.5,
    },
    svg,
    bbox: {
      minX: 0,
      minY: 0,
      maxX: wMm,
      maxY: hMm,
      w: wMm,
      h: hMm,
    },
    segments,
  };
}
