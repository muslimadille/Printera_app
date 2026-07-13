import type { T0003Params, T0003Geometry, T0003FaceCoords } from './types';
import type { Segment } from '@/components/InteractiveSvgCanvas';
import type { Panel2DInfo } from '@/components/boxes/MailerBox3DPreview';

export function buildT0003Geometry(params: T0003Params): T0003Geometry {
  const segments: Segment[] = [];
  const W = params.width;
  const H = params.height;
  const L = params.depth;

  // Constants deduced from standard Mailer Box geometry
  const GAP = 2.83; // Folding gap offset
  const EAR_W = 25.5; // Width of the lid cherry lock ear
  const T = 56.69; // Lid tuck total height
  const T_CUT = 22.68; // Lid tuck vertical cut height
  const T_RADIUS = 34.02; // Lid tuck corner radius
  const TUCK_IN = 1.42; // Lid tuck inset

  const DUST_Y = 8.5; // Dust flap small offset
  const DUST_X_OFFSET = 36.85; // Dust flap large offset

  const FLAP = 43.93; // Side wall inner flap drop
  const OUTER_FLAP_DROP = 10.26;
  const TUCK_CLEARANCE = 17; // Inner flap angled clearance

  // Y-coordinates
  const Y_TUCK_TOP = -T;
  const Y2 = 0; // Top of Lid Panel (Ear top edge)
  const Y_CREASE = GAP; // The actual folding crease of the lid
  const Y_SLIT_BOTTOM = 2 * GAP; // Bottom of the cherry lock slit
  const Y3 = L; // Top of Back Panel
  const Y4 = L + H; // Top of Bottom Panel
  const Y5 = 2 * L + H; // Top of Front Panel
  const Y6 = 2 * L + 2 * H; // Bottom of Front Panel

  // X-coordinates
  const X_LEFT = H + FLAP; // Outer limit of left side wall (bounding box left)
  const XL = X_LEFT; // X coord of the box body left edge
  const XR = X_LEFT + W; // X coord of the box body right edge
  const X_RIGHT = XR + H + FLAP;

  // Bounding box dimensions
  const bboxW = X_RIGHT;
  const bboxH = Y6 + T;

  const pt = (x: number, y: number) => ({ x, y });

  const cut = (p1: { x: number; y: number }, p2: { x: number; y: number }, id?: string) => {
    segments.push({ type: 'cut', start: p1, end: p2, id });
  };
  const crease = (p1: { x: number; y: number }, p2: { x: number; y: number }, id?: string) => {
    segments.push({ type: 'crease', start: p1, end: p2, id });
  };

  // Build Lid Tuck Curve function
  // We approximate the quarter circle with a bezier curve
  const addBezier = (
    p1: { x: number; y: number },
    cp1: { x: number; y: number },
    cp2: { x: number; y: number },
    p2: { x: number; y: number }
  ) => {
    // Generate polyline segments for the bezier
    const steps = 16;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const w1 = mt * mt * mt;
      const w2 = 3 * mt * mt * t;
      const w3 = 3 * mt * t * t;
      const w4 = t * t * t;
      pts.push(pt(
        w1 * p1.x + w2 * cp1.x + w3 * cp2.x + w4 * p2.x,
        w1 * p1.y + w2 * cp1.y + w3 * cp2.y + w4 * p2.y
      ));
    }
    segments.push({
      type: 'cut',
      geometry: 'polyline',
      start: p1,
      end: p2,
      points: pts
    });
  };

  // --- 1. Horizontal Creases ---
  crease(pt(XL, Y_CREASE), pt(XR, Y_CREASE), 'crease_lid_fold');
  crease(pt(XL, Y3), pt(XR, Y3), 'crease_back_top');
  crease(pt(XL, Y4), pt(XR, Y4), 'crease_bottom_top');
  crease(pt(XL, Y5), pt(XR, Y5), 'crease_front_top');

  // --- 2. Vertical Creases ---
  // Main Body Folds (Side Walls)
  crease(pt(XL, Y4), pt(XL, Y5), 'crease_body_left');
  crease(pt(XR, Y4), pt(XR, Y5), 'crease_body_right');
  
  // Back Dust Flaps
  crease(pt(XL, Y3), pt(XL, Y4), 'crease_back_dust_left');
  crease(pt(XR, Y3), pt(XR, Y4), 'crease_back_dust_right');

  // Front Dust Flaps
  crease(pt(XL, Y5), pt(XL, Y6), 'crease_front_dust_left');
  crease(pt(XR, Y5), pt(XR, Y6), 'crease_front_dust_right');

  // Inner Flap Creases (Side Walls)
  const X_INNER_L = XL - H;
  const X_INNER_R = XR + H;
  crease(pt(X_INNER_L, Y4 + GAP), pt(X_INNER_L, Y5 - GAP), 'crease_inner_left');
  crease(pt(X_INNER_R, Y4 + GAP), pt(X_INNER_R, Y5 - GAP), 'crease_inner_right');

  // --- 3. 45-Degree Side Wall Creases ---
  const diagTopStartL = pt(XL - GAP, Y4 + GAP);
  const diagTopEndL = pt(X_INNER_L - FLAP, Y4 + GAP + (H + FLAP - GAP));
  crease(diagTopStartL, diagTopEndL);
  
  const diagBotStartL = pt(XL - GAP, Y5 - GAP);
  const diagBotEndL = pt(X_INNER_L - FLAP, Y5 - GAP - (H + FLAP - GAP));
  crease(diagBotStartL, diagBotEndL);

  const diagTopStartR = pt(XR + GAP, Y4 + GAP);
  const diagTopEndR = pt(X_INNER_R + FLAP, Y4 + GAP + (H + FLAP - GAP));
  crease(diagTopStartR, diagTopEndR);
  
  const diagBotStartR = pt(XR + GAP, Y5 - GAP);
  const diagBotEndR = pt(X_INNER_R + FLAP, Y5 - GAP - (H + FLAP - GAP));
  crease(diagBotStartR, diagBotEndR);

  // --- 4. Lid Tuck & Ears (Top) ---
  // Left Ear & Slit
  cut(pt(XL, Y2), pt(XL + EAR_W, Y2)); // Ear top
  cut(pt(XL + EAR_W, Y2), pt(XL + EAR_W, Y_SLIT_BOTTOM)); // Slit vertical
  cut(pt(XL, Y2), pt(XL, Y3)); // Lid left edge
  
  // Right Ear & Slit
  cut(pt(XR, Y2), pt(XR - EAR_W, Y2));
  cut(pt(XR - EAR_W, Y2), pt(XR - EAR_W, Y_SLIT_BOTTOM));
  cut(pt(XR, Y2), pt(XR, Y3)); // Lid right edge

  // Tuck Flap
  const TUCK_L = XL + TUCK_IN;
  const TUCK_R = XR - TUCK_IN;
  cut(pt(XL + EAR_W, Y2), pt(TUCK_L, Y2)); // Cut connecting ear to tuck start
  cut(pt(XR - EAR_W, Y2), pt(TUCK_R, Y2));

  // Left curve of tuck
  const LT1 = pt(TUCK_L, Y2);
  const LT2 = pt(TUCK_L, Y2 - T_CUT);
  const LT3 = pt(TUCK_L + T_RADIUS, Y_TUCK_TOP);
  cut(LT1, LT2);
  // Bezier approximation of quarter circle (kappa ~ 0.55228)
  const kappa = 0.55228;
  addBezier(
    LT2,
    pt(TUCK_L, Y2 - T_CUT - T_RADIUS * kappa),
    pt(TUCK_L + T_RADIUS * (1 - kappa), Y_TUCK_TOP),
    LT3
  );

  // Right curve of tuck
  const RT1 = pt(TUCK_R, Y2);
  const RT2 = pt(TUCK_R, Y2 - T_CUT);
  const RT3 = pt(TUCK_R - T_RADIUS, Y_TUCK_TOP);
  cut(RT1, RT2);
  addBezier(
    RT2,
    pt(TUCK_R, Y2 - T_CUT - T_RADIUS * kappa),
    pt(TUCK_R - T_RADIUS * (1 - kappa), Y_TUCK_TOP),
    RT3
  );

  // Top horizontal cut
  cut(LT3, RT3);

  // --- 5. Back Dust Flaps ---
  const bdf_left = [
    pt(XL, Y4),
    pt(XL - DUST_Y, Y4 - DUST_Y),
    pt(XL - H, Y4 - DUST_X_OFFSET),
    pt(XL - H, Y3 + DUST_Y),
    pt(XL - DUST_Y, Y3 + DUST_Y),
    pt(XL, Y3)
  ];
  for (let i = 0; i < bdf_left.length - 1; i++) cut(bdf_left[i], bdf_left[i + 1]);

  const bdf_right = [
    pt(XR, Y4),
    pt(XR + DUST_Y, Y4 - DUST_Y),
    pt(XR + H, Y4 - DUST_X_OFFSET),
    pt(XR + H, Y3 + DUST_Y),
    pt(XR + DUST_Y, Y3 + DUST_Y),
    pt(XR, Y3)
  ];
  for (let i = 0; i < bdf_right.length - 1; i++) cut(bdf_right[i], bdf_right[i + 1]);

  // --- 6. Front Dust Flaps ---
  const fdf_left = [
    pt(XL, Y5),
    pt(XL - DUST_Y, Y5 + DUST_Y),
    pt(XL - H, Y5 + DUST_X_OFFSET),
    pt(XL - H, Y6 - DUST_Y),
    pt(XL - DUST_Y, Y6 - DUST_Y),
    pt(XL, Y6)
  ];
  for (let i = 0; i < fdf_left.length - 1; i++) cut(fdf_left[i], fdf_left[i + 1]);

  const fdf_right = [
    pt(XR, Y5),
    pt(XR + DUST_Y, Y5 + DUST_Y),
    pt(XR + H, Y5 + DUST_X_OFFSET),
    pt(XR + H, Y6 - DUST_Y),
    pt(XR + DUST_Y, Y6 - DUST_Y),
    pt(XR, Y6)
  ];
  for (let i = 0; i < fdf_right.length - 1; i++) cut(fdf_right[i], fdf_right[i + 1]);

  // Front Panel bottom edge
  cut(pt(XL, Y6), pt(XR, Y6));

  // --- 7. Side Walls ---
  // Left side wall perimeter
  const sw_left = [
    pt(XL, Y4),
    pt(XL - GAP, Y4 + GAP),
    pt(X_INNER_L, Y4 + GAP),
    pt(X_INNER_L - FLAP, Y4 + GAP + OUTER_FLAP_DROP),
    pt(X_INNER_L - FLAP, Y5 - GAP - OUTER_FLAP_DROP),
    pt(X_INNER_L - TUCK_CLEARANCE, Y5 - GAP),
    pt(X_INNER_L, Y5 - GAP),
    pt(XL - GAP, Y5 - GAP),
    pt(XL, Y5)
  ];
  for (let i = 0; i < sw_left.length - 1; i++) cut(sw_left[i], sw_left[i + 1]);

  // Right side wall perimeter
  const sw_right = [
    pt(XR, Y4),
    pt(XR + GAP, Y4 + GAP),
    pt(X_INNER_R, Y4 + GAP),
    pt(X_INNER_R + FLAP, Y4 + GAP + OUTER_FLAP_DROP),
    pt(X_INNER_R + FLAP, Y5 - GAP - OUTER_FLAP_DROP),
    pt(X_INNER_R + TUCK_CLEARANCE, Y5 - GAP),
    pt(X_INNER_R, Y5 - GAP),
    pt(XR + GAP, Y5 - GAP),
    pt(XR, Y5)
  ];
  for (let i = 0; i < sw_right.length - 1; i++) cut(sw_right[i], sw_right[i + 1]);


  // --- Face Coordinates generation ---
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bboxW} ${bboxH}">
    ${segments.map(s => {
      const color = s.type === 'cut' ? '#ed1c24' : '#00a651';
      if (s.geometry === 'polyline' && s.points) {
        return `<polyline points="${s.points.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2" />`;
      }
      return `<line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}" fill="none" stroke="${color}" stroke-width="2" />`;
    }).join('\n')}
  </svg>`;

  const faceCoords: T0003FaceCoords = {
    lid: { x: XL, y: Y2, w: W, h: L }, // Note: the fold is at Y_CREASE, but bounding box is Y2
    back: { x: XL, y: Y3, w: W, h: H },
    bottom: { x: XL, y: Y4, w: W, h: L },
    front: { x: XL, y: Y5, w: W, h: H },
    lidTuck: {
      x: TUCK_L, y: Y_TUCK_TOP, w: W - 2 * TUCK_IN, h: T,
      polygon: [
        [TUCK_L, Y2],
        [TUCK_L, Y2 - T_CUT],
        [TUCK_L + T_RADIUS, Y_TUCK_TOP],
        [TUCK_R - T_RADIUS, Y_TUCK_TOP],
        [TUCK_R, Y2 - T_CUT],
        [TUCK_R, Y2]
      ]
    },
    leftWallOuter: {
      x: X_INNER_L, y: Y4, w: H, h: L,
      polygon: [
        [XL, Y4], [X_INNER_L, Y4 + GAP], [X_INNER_L, Y5 - GAP], [XL, Y5]
      ]
    },
    leftWallInner: {
      x: X_INNER_L - FLAP, y: Y4, w: FLAP, h: L,
      polygon: [
        [X_INNER_L, Y4 + GAP], [X_INNER_L - FLAP, Y4 + GAP + OUTER_FLAP_DROP],
        [X_INNER_L - FLAP, Y5 - GAP - OUTER_FLAP_DROP], [X_INNER_L - TUCK_CLEARANCE, Y5 - GAP],
        [X_INNER_L, Y5 - GAP]
      ]
    },
    rightWallOuter: {
      x: XR, y: Y4, w: H, h: L,
      polygon: [
        [XR, Y4], [X_INNER_R, Y4 + GAP], [X_INNER_R, Y5 - GAP], [XR, Y5]
      ]
    },
    rightWallInner: {
      x: X_INNER_R, y: Y4, w: FLAP, h: L,
      polygon: [
        [X_INNER_R, Y4 + GAP], [X_INNER_R + FLAP, Y4 + GAP + OUTER_FLAP_DROP],
        [X_INNER_R + FLAP, Y5 - GAP - OUTER_FLAP_DROP], [X_INNER_R + TUCK_CLEARANCE, Y5 - GAP],
        [X_INNER_R, Y5 - GAP]
      ]
    },
    backDustLeft: {
      x: XL - H, y: Y3, w: H, h: H,
      polygon: bdf_left.map(p => [p.x, p.y]) as [number, number][]
    },
    backDustRight: {
      x: XR, y: Y3, w: H, h: H,
      polygon: bdf_right.map(p => [p.x, p.y]) as [number, number][]
    },
    frontDustLeft: {
      x: XL - H, y: Y5, w: H, h: H,
      polygon: fdf_left.map(p => [p.x, p.y]) as [number, number][]
    },
    frontDustRight: {
      x: XR, y: Y5, w: H, h: H,
      polygon: fdf_right.map(p => [p.x, p.y]) as [number, number][]
    }
  };

  return {
    svg,
    segments,
    bbox: { w: bboxW, h: bboxH },
    faceCoords,
    derived: {
      width: bboxW,
      height: bboxH
    }
  };
}
