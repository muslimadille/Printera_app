import {
  Basket_Box_1Params,
  Basket_Box_1Derived,
  Basket_Box_1Geometry,
  Basket_Box_1Segment,
} from './types';

export function computeBasket_Box_1Derived(p: Basket_Box_1Params): Basket_Box_1Derived {
  const L = Math.max(20, p.width);
  const W = Math.max(20, p.depth);
  const D = Math.max(10, p.height);

  // Score offset compensation (0.5mm)
  const cornerGeometryH = 10.0;
  const handleGripH = p.handleGripH && p.handleGripH > 0 ? p.handleGripH : 40.0;
  // Neck height corresponds to half box width minus folding clearance
  const handleNeckH =
    p.handleNeckH && p.handleNeckH > 0 ? p.handleNeckH : Math.max(10, W / 2.0 - 0.33);

  const wingW = W / 2.0;

  const xMain = wingW + D;
  const yMain = cornerGeometryH + handleGripH + handleNeckH + D;

  const totalW = L + 2 * D + 2 * wingW;
  const totalH = 2 * (cornerGeometryH + handleGripH + handleNeckH + D) + W;

  return {
    L,
    W,
    D,
    handleNeckH,
    handleGripH,
    cornerGeometryH,
    wingW,
    totalW,
    totalH,
    xMain,
    yMain,
  };
}

export function generateBasket_Box_1Geometry(p: Basket_Box_1Params): Basket_Box_1Geometry {
  const derived = computeBasket_Box_1Derived(p);
  const { L, W, D, handleNeckH, handleGripH, cornerGeometryH, wingW, totalW, totalH, xMain, yMain } =
    derived;

  const segments: Basket_Box_1Segment[] = [];

  const SCORE_OFFSET = 0.5;
  const RED = '#ED1C24';
  const GREEN = '#00A651';

  // Key Coordinates
  const xLeftWing = xMain - D - wingW;
  const xLeftSide = xMain - D;
  const xMainL = xMain;
  const xMainR = xMain + L;
  const xRightSide = xMain + L + D;
  const xRightWing = xMain + L + D + wingW;

  const xTopFlapL = xMain + SCORE_OFFSET;
  const xTopFlapR = xMain + L - SCORE_OFFSET;

  const yTop0 = 0.353;
  const yTopEarBase = yTop0 + cornerGeometryH; // ~10.353
  const yTopGripCrease = yTopEarBase + handleGripH; // ~50.353
  const yTopNeckCrease = yTopGripCrease + handleNeckH; // ~125.023 for W=150
  const yTopWallCrease = yMain; // ~175.023
  const yMidW = yMain + W / 2; // ~250.023
  const yBotWallCrease = yMain + W; // ~325.023
  const yBotNeckCrease = yBotWallCrease + D; // ~375.023
  const yBotGripCrease = yBotNeckCrease + handleNeckH; // ~449.693
  const yBotEarBase = yBotGripCrease + handleGripH; // ~489.693
  const yBot0 = yBotEarBase + cornerGeometryH; // ~499.693

  // -------------------------------------------------------------
  // 1. CREASE LINES (Green folding lines)
  // -------------------------------------------------------------

  // Central Floor Creases
  segments.push({ kind: 'CREASE', geometry: 'line', start: { x: xMainL, y: yTopWallCrease }, end: { x: xMainR, y: yTopWallCrease }, strokeColor: GREEN });
  segments.push({ kind: 'CREASE', geometry: 'line', start: { x: xMainL, y: yBotWallCrease }, end: { x: xMainR, y: yBotWallCrease }, strokeColor: GREEN });
  segments.push({ kind: 'CREASE', geometry: 'line', start: { x: xMainL, y: yTopWallCrease }, end: { x: xMainL, y: yBotWallCrease }, strokeColor: GREEN });
  segments.push({ kind: 'CREASE', geometry: 'line', start: { x: xMainR, y: yTopWallCrease }, end: { x: xMainR, y: yBotWallCrease }, strokeColor: GREEN });

  // Left & Right Side Wall Creases (interrupted by 2mm slot at center)
  segments.push({ kind: 'CREASE', geometry: 'line', start: { x: xLeftSide, y: yTopWallCrease }, end: { x: xLeftSide, y: yMidW - 1 }, strokeColor: GREEN });
  segments.push({ kind: 'CREASE', geometry: 'line', start: { x: xLeftSide, y: yMidW + 1 }, end: { x: xLeftSide, y: yBotWallCrease }, strokeColor: GREEN });
  segments.push({ kind: 'CREASE', geometry: 'line', start: { x: xRightSide, y: yTopWallCrease }, end: { x: xRightSide, y: yMidW - 1 }, strokeColor: GREEN });
  segments.push({ kind: 'CREASE', geometry: 'line', start: { x: xRightSide, y: yMidW + 1 }, end: { x: xRightSide, y: yBotWallCrease }, strokeColor: GREEN });

  // Handle Cutout Constants matching K018 reference
  const handleCutoutW = Math.min(L - 20, 85.0);
  const handleR = 15.0;
  const handleStraightW = Math.max(10, handleCutoutW - 2 * handleR); // 55mm for 85mm cutout
  const handleHalfW = handleCutoutW / 2;
  const xCenter = xMain + L / 2;

  // Top Flap Creases
  segments.push({ kind: 'CREASE', geometry: 'line', start: { x: xTopFlapL, y: yTopNeckCrease }, end: { x: xTopFlapR, y: yTopNeckCrease }, strokeColor: GREEN, name: 'ثنية الرقبة العلوية' });
  segments.push({ kind: 'CREASE', geometry: 'line', start: { x: xTopFlapL, y: yTopWallCrease - 1 }, end: { x: xTopFlapL, y: yTopNeckCrease }, strokeColor: GREEN, name: 'ثنية الرقبة العلوية يسار' });
  segments.push({ kind: 'CREASE', geometry: 'line', start: { x: xTopFlapR, y: yTopWallCrease - 1 }, end: { x: xTopFlapR, y: yTopNeckCrease }, strokeColor: GREEN, name: 'ثنية الرقبة العلوية يمين' });
  
  // Top Grip Crease (segments on sides of handle cutout)
  segments.push({ kind: 'CREASE', geometry: 'line', start: { x: xTopFlapL, y: yTopGripCrease }, end: { x: xCenter - handleStraightW / 2, y: yTopGripCrease }, strokeColor: GREEN, name: 'ثنية قبضة اليد العلوية يسار' });
  segments.push({ kind: 'CREASE', geometry: 'line', start: { x: xCenter + handleStraightW / 2, y: yTopGripCrease }, end: { x: xTopFlapR, y: yTopGripCrease }, strokeColor: GREEN, name: 'ثنية قبضة اليد العلوية يمين' });

  // Bottom Flap Creases
  segments.push({ kind: 'CREASE', geometry: 'line', start: { x: xTopFlapL, y: yBotNeckCrease }, end: { x: xTopFlapR, y: yBotNeckCrease }, strokeColor: GREEN, name: 'ثنية الرقبة السفلية' });
  segments.push({ kind: 'CREASE', geometry: 'line', start: { x: xTopFlapL, y: yBotWallCrease + 1 }, end: { x: xTopFlapL, y: yBotNeckCrease }, strokeColor: GREEN, name: 'ثنية الرقبة السفلية يسار' });
  segments.push({ kind: 'CREASE', geometry: 'line', start: { x: xTopFlapR, y: yBotWallCrease + 1 }, end: { x: xTopFlapR, y: yBotNeckCrease }, strokeColor: GREEN, name: 'ثنية الرقبة السفلية يمين' });
  
  // Bottom Grip Crease
  segments.push({ kind: 'CREASE', geometry: 'line', start: { x: xTopFlapL, y: yBotGripCrease }, end: { x: xCenter - handleStraightW / 2, y: yBotGripCrease }, strokeColor: GREEN, name: 'ثنية قبضة اليد السفلية يسار' });
  segments.push({ kind: 'CREASE', geometry: 'line', start: { x: xCenter + handleStraightW / 2, y: yBotGripCrease }, end: { x: xTopFlapR, y: yBotGripCrease }, strokeColor: GREEN, name: 'ثنية قبضة اليد السفلية يمين' });

  // -------------------------------------------------------------
  // 2. CUT LINES & INNER CUTOUTS (Red)
  // -------------------------------------------------------------

  // Corner Flap Cuts (Separations between corner flaps and central wall flaps)
  // Top-Left corner flap
  segments.push({ kind: 'CUT', geometry: 'line', start: { x: xLeftSide, y: yTopNeckCrease }, end: { x: xTopFlapL, y: yTopNeckCrease }, strokeColor: RED });
  segments.push({ kind: 'CUT', geometry: 'line', start: { x: xLeftSide, y: yTopNeckCrease }, end: { x: xLeftSide, y: yTopWallCrease - 2 }, strokeColor: RED });
  segments.push({ kind: 'CUT', geometry: 'line', start: { x: xLeftSide, y: yTopWallCrease - 2 }, end: { x: xMainL - SCORE_OFFSET, y: yTopWallCrease - 2 }, strokeColor: RED });
  // Relief notch at (xMainL - 0.5, yTopWallCrease - 2) to (xMainL, yTopWallCrease)
  const dNotchTL = `M ${xMainL - SCORE_OFFSET} ${yTopWallCrease - 2} C ${xMainL - SCORE_OFFSET + 1} ${yTopWallCrease - 2} ${xMainL} ${yTopWallCrease - 1} ${xMainL} ${yTopWallCrease}`;
  segments.push({ kind: 'CUT', geometry: 'path', start: { x: xMainL - SCORE_OFFSET, y: yTopWallCrease - 2 }, end: { x: xMainL, y: yTopWallCrease }, d: dNotchTL, strokeColor: RED });
  segments.push({ kind: 'CUT', geometry: 'line', start: { x: xMainL, y: yTopWallCrease }, end: { x: xLeftSide, y: yTopWallCrease }, strokeColor: RED });

  // Top-Right corner flap
  segments.push({ kind: 'CUT', geometry: 'line', start: { x: xTopFlapR, y: yTopNeckCrease }, end: { x: xRightSide, y: yTopNeckCrease }, strokeColor: RED });
  segments.push({ kind: 'CUT', geometry: 'line', start: { x: xRightSide, y: yTopNeckCrease }, end: { x: xRightSide, y: yTopWallCrease - 2 }, strokeColor: RED });
  segments.push({ kind: 'CUT', geometry: 'line', start: { x: xRightSide, y: yTopWallCrease - 2 }, end: { x: xMainR + SCORE_OFFSET, y: yTopWallCrease - 2 }, strokeColor: RED });
  const dNotchTR = `M ${xMainR} ${yTopWallCrease} C ${xMainR} ${yTopWallCrease - 1} ${xMainR + SCORE_OFFSET - 1} ${yTopWallCrease - 2} ${xMainR + SCORE_OFFSET} ${yTopWallCrease - 2}`;
  segments.push({ kind: 'CUT', geometry: 'path', start: { x: xMainR, y: yTopWallCrease }, end: { x: xMainR + SCORE_OFFSET, y: yTopWallCrease - 2 }, d: dNotchTR, strokeColor: RED });
  segments.push({ kind: 'CUT', geometry: 'line', start: { x: xMainR, y: yTopWallCrease }, end: { x: xRightSide, y: yTopWallCrease }, strokeColor: RED });

  // Bottom-Left corner flap
  segments.push({ kind: 'CUT', geometry: 'line', start: { x: xLeftSide, y: yBotNeckCrease }, end: { x: xTopFlapL, y: yBotNeckCrease }, strokeColor: RED });
  segments.push({ kind: 'CUT', geometry: 'line', start: { x: xLeftSide, y: yBotNeckCrease }, end: { x: xLeftSide, y: yBotWallCrease + 2 }, strokeColor: RED });
  segments.push({ kind: 'CUT', geometry: 'line', start: { x: xLeftSide, y: yBotWallCrease + 2 }, end: { x: xMainL - SCORE_OFFSET, y: yBotWallCrease + 2 }, strokeColor: RED });
  const dNotchBL = `M ${xMainL} ${yBotWallCrease} C ${xMainL} ${yBotWallCrease + 1} ${xMainL - SCORE_OFFSET + 1} ${yBotWallCrease + 2} ${xMainL - SCORE_OFFSET} ${yBotWallCrease + 2}`;
  segments.push({ kind: 'CUT', geometry: 'path', start: { x: xMainL, y: yBotWallCrease }, end: { x: xMainL - SCORE_OFFSET, y: yBotWallCrease + 2 }, d: dNotchBL, strokeColor: RED });
  segments.push({ kind: 'CUT', geometry: 'line', start: { x: xMainL, y: yBotWallCrease }, end: { x: xLeftSide, y: yBotWallCrease }, strokeColor: RED });

  // Bottom-Right corner flap
  segments.push({ kind: 'CUT', geometry: 'line', start: { x: xTopFlapR, y: yBotNeckCrease }, end: { x: xRightSide, y: yBotNeckCrease }, strokeColor: RED });
  segments.push({ kind: 'CUT', geometry: 'line', start: { x: xRightSide, y: yBotNeckCrease }, end: { x: xRightSide, y: yBotWallCrease + 2 }, strokeColor: RED });
  segments.push({ kind: 'CUT', geometry: 'line', start: { x: xRightSide, y: yBotWallCrease + 2 }, end: { x: xMainR + SCORE_OFFSET, y: yBotWallCrease + 2 }, strokeColor: RED });
  const dNotchBR = `M ${xMainR + SCORE_OFFSET} ${yBotWallCrease + 2} C ${xMainR + SCORE_OFFSET - 1} ${yBotWallCrease + 2} ${xMainR} ${yBotWallCrease + 1} ${xMainR} ${yBotWallCrease}`;
  segments.push({ kind: 'CUT', geometry: 'path', start: { x: xMainR + SCORE_OFFSET, y: yBotWallCrease + 2 }, end: { x: xMainR, y: yBotWallCrease }, d: dNotchBR, strokeColor: RED });
  segments.push({ kind: 'CUT', geometry: 'line', start: { x: xMainR, y: yBotWallCrease }, end: { x: xRightSide, y: yBotWallCrease }, strokeColor: RED });

  // -------------------------------------------------------------
  // 3. SIDE CURVED WINGS & LOCK SLITS (Outer & Cut)
  // -------------------------------------------------------------
  // Left Curved Wing Outer Profile (Exact semicircle arc of radius wingW = W/2)
  const dLeftWing = `M ${xLeftSide} ${yBotWallCrease} ` +
    `A ${wingW} ${wingW} 0 0 1 ${xLeftSide} ${yTopWallCrease}`;
  segments.push({ kind: 'OUTER', geometry: 'path', start: { x: xLeftSide, y: yBotWallCrease }, end: { x: xLeftSide, y: yTopWallCrease }, d: dLeftWing, strokeColor: RED, name: 'قوس القفل الجانبي الأيسر' });

  // Left Side Lock Slit (49mm x 2mm rounded slot extending into wing)
  const slotW = Math.min(wingW - 1, 49.0);
  const xSlotLeftEnd = xLeftSide - slotW;
  const dLeftSlot = `M ${xLeftSide} ${yMidW - 1} ` +
    `L ${xSlotLeftEnd + 1} ${yMidW - 1} ` +
    `A 1 1 0 0 0 ${xSlotLeftEnd + 1} ${yMidW + 1} ` +
    `L ${xLeftSide} ${yMidW + 1}`;
  segments.push({ kind: 'CUT', geometry: 'path', start: { x: xLeftSide, y: yMidW - 1 }, end: { x: xLeftSide, y: yMidW + 1 }, d: dLeftSlot, strokeColor: RED, name: 'فتحة القفل الجانبية اليسرى' });
  segments.push({ kind: 'CUT', geometry: 'line', start: { x: xLeftSide, y: yMidW - 1 }, end: { x: xLeftSide, y: yMidW + 1 }, strokeColor: RED });

  // Right Curved Wing Outer Profile
  const dRightWing = `M ${xRightSide} ${yTopWallCrease} ` +
    `A ${wingW} ${wingW} 0 0 1 ${xRightSide} ${yBotWallCrease}`;
  segments.push({ kind: 'OUTER', geometry: 'path', start: { x: xRightSide, y: yTopWallCrease }, end: { x: xRightSide, y: yBotWallCrease }, d: dRightWing, strokeColor: RED, name: 'قوس القفل الجانبي الأيمن' });

  // Right Side Lock Slit
  const xSlotRightEnd = xRightSide + slotW;
  const dRightSlot = `M ${xRightSide} ${yMidW - 1} ` +
    `L ${xSlotRightEnd - 1} ${yMidW - 1} ` +
    `A 1 1 0 0 1 ${xSlotRightEnd - 1} ${yMidW + 1} ` +
    `L ${xRightSide} ${yMidW + 1}`;
  segments.push({ kind: 'CUT', geometry: 'path', start: { x: xRightSide, y: yMidW - 1 }, end: { x: xRightSide, y: yMidW + 1 }, d: dRightSlot, strokeColor: RED, name: 'فتحة القفل الجانبية اليمنى' });
  segments.push({ kind: 'CUT', geometry: 'line', start: { x: xRightSide, y: yMidW - 1 }, end: { x: xRightSide, y: yMidW + 1 }, strokeColor: RED });

  // -------------------------------------------------------------
  // 4. TOP & BOTTOM HANDLE GRIP & EAR HOOK GEOMETRY
  // -------------------------------------------------------------
  // Top Outer Boundary (Neck sides, Grip sides, Ear hooks, and Top Edge)
  segments.push({ kind: 'OUTER', geometry: 'line', start: { x: xTopFlapL, y: yTopNeckCrease }, end: { x: xTopFlapL, y: yTopGripCrease }, strokeColor: RED });
  segments.push({ kind: 'OUTER', geometry: 'line', start: { x: xTopFlapR, y: yTopNeckCrease }, end: { x: xTopFlapR, y: yTopGripCrease }, strokeColor: RED });
  segments.push({ kind: 'OUTER', geometry: 'line', start: { x: xTopFlapL, y: yTopGripCrease }, end: { x: xTopFlapL, y: yTopEarBase }, strokeColor: RED });
  segments.push({ kind: 'OUTER', geometry: 'line', start: { x: xTopFlapR, y: yTopGripCrease }, end: { x: xTopFlapR, y: yTopEarBase }, strokeColor: RED });

  // Top Ear Hooks & Edge
  const hookW = 20.0;
  const topEdgeStart = xTopFlapL + 25.0;
  const topEdgeEnd = xTopFlapR - 25.0;

  // Left Ear Hook Notch (Cubic Bezier matching K018 reference)
  const dTopHookL = `M ${xTopFlapL} ${yTopEarBase} ` +
    `C ${xTopFlapL} ${yTopEarBase - 3.57} ${xTopFlapL + 1.91} ${yTopEarBase - 6.87} ${xTopFlapL + 5.0} ${yTopEarBase - 8.66} ` +
    `C ${xTopFlapL + 8.09} ${yTopEarBase - 10.45} ${xTopFlapL + 11.91} ${yTopEarBase - 10.45} ${xTopFlapL + 15.0} ${yTopEarBase - 8.66} ` +
    `C ${xTopFlapL + 18.09} ${yTopEarBase - 6.87} ${xTopFlapL + hookW} ${yTopEarBase - 3.57} ${xTopFlapL + hookW} ${yTopEarBase}`;
  segments.push({ kind: 'OUTER', geometry: 'path', start: { x: xTopFlapL, y: yTopEarBase }, end: { x: xTopFlapL + hookW, y: yTopEarBase }, d: dTopHookL, strokeColor: RED });

  // 45 degree slope up to top edge
  segments.push({ kind: 'OUTER', geometry: 'line', start: { x: xTopFlapL + hookW, y: yTopEarBase }, end: { x: topEdgeStart, y: yTop0 }, strokeColor: RED });
  // Top straight edge
  segments.push({ kind: 'OUTER', geometry: 'line', start: { x: topEdgeStart, y: yTop0 }, end: { x: topEdgeEnd, y: yTop0 }, strokeColor: RED });
  // 45 degree slope down to right hook
  segments.push({ kind: 'OUTER', geometry: 'line', start: { x: topEdgeEnd, y: yTop0 }, end: { x: xTopFlapR - hookW, y: yTopEarBase }, strokeColor: RED });

  // Right Ear Hook Notch
  const dTopHookR = `M ${xTopFlapR - hookW} ${yTopEarBase} ` +
    `C ${xTopFlapR - hookW} ${yTopEarBase - 3.57} ${xTopFlapR - hookW + 1.91} ${yTopEarBase - 6.87} ${xTopFlapR - hookW + 5.0} ${yTopEarBase - 8.66} ` +
    `C ${xTopFlapR - hookW + 8.09} ${yTopEarBase - 10.45} ${xTopFlapR - hookW + 11.91} ${yTopEarBase - 10.45} ${xTopFlapR - hookW + 15.0} ${yTopEarBase - 8.66} ` +
    `C ${xTopFlapR - hookW + 18.09} ${yTopEarBase - 6.87} ${xTopFlapR} ${yTopEarBase - 3.57} ${xTopFlapR} ${yTopEarBase}`;
  segments.push({ kind: 'OUTER', geometry: 'path', start: { x: xTopFlapR - hookW, y: yTopEarBase }, end: { x: xTopFlapR, y: yTopEarBase }, d: dTopHookR, strokeColor: RED });

  // Bottom Outer Boundary
  segments.push({ kind: 'OUTER', geometry: 'line', start: { x: xTopFlapL, y: yBotNeckCrease }, end: { x: xTopFlapL, y: yBotGripCrease }, strokeColor: RED });
  segments.push({ kind: 'OUTER', geometry: 'line', start: { x: xTopFlapR, y: yBotNeckCrease }, end: { x: xTopFlapR, y: yBotGripCrease }, strokeColor: RED });
  segments.push({ kind: 'OUTER', geometry: 'line', start: { x: xTopFlapL, y: yBotGripCrease }, end: { x: xTopFlapL, y: yBotEarBase }, strokeColor: RED });
  segments.push({ kind: 'OUTER', geometry: 'line', start: { x: xTopFlapR, y: yBotGripCrease }, end: { x: xTopFlapR, y: yBotEarBase }, strokeColor: RED });

  // Bottom Ear Hooks & Edge
  const dBotHookL = `M ${xTopFlapL + hookW} ${yBotEarBase} ` +
    `C ${xTopFlapL + hookW} ${yBotEarBase + 3.57} ${xTopFlapL + 18.09} ${yBotEarBase + 6.87} ${xTopFlapL + 15.0} ${yBotEarBase + 8.66} ` +
    `C ${xTopFlapL + 11.91} ${yBotEarBase + 10.45} ${xTopFlapL + 8.09} ${yBotEarBase + 10.45} ${xTopFlapL + 5.0} ${yBotEarBase + 8.66} ` +
    `C ${xTopFlapL + 1.91} ${yBotEarBase + 6.87} ${xTopFlapL} ${yBotEarBase + 3.57} ${xTopFlapL} ${yBotEarBase}`;
  segments.push({ kind: 'OUTER', geometry: 'path', start: { x: xTopFlapL + hookW, y: yBotEarBase }, end: { x: xTopFlapL, y: yBotEarBase }, d: dBotHookL, strokeColor: RED });

  segments.push({ kind: 'OUTER', geometry: 'line', start: { x: xTopFlapL + hookW, y: yBotEarBase }, end: { x: topEdgeStart, y: yBot0 }, strokeColor: RED });
  segments.push({ kind: 'OUTER', geometry: 'line', start: { x: topEdgeStart, y: yBot0 }, end: { x: topEdgeEnd, y: yBot0 }, strokeColor: RED });
  segments.push({ kind: 'OUTER', geometry: 'line', start: { x: topEdgeEnd, y: yBot0 }, end: { x: xTopFlapR - hookW, y: yBotEarBase }, strokeColor: RED });

  const dBotHookR = `M ${xTopFlapR} ${yBotEarBase} ` +
    `C ${xTopFlapR} ${yBotEarBase + 3.57} ${xTopFlapR - hookW + 18.09} ${yBotEarBase + 6.87} ${xTopFlapR - hookW + 15.0} ${yBotEarBase + 8.66} ` +
    `C ${xTopFlapR - hookW + 11.91} ${yBotEarBase + 10.45} ${xTopFlapR - hookW + 8.09} ${yBotEarBase + 10.45} ${xTopFlapR - hookW + 5.0} ${yBotEarBase + 8.66} ` +
    `C ${xTopFlapR - hookW + 1.91} ${yBotEarBase + 6.87} ${xTopFlapR - hookW} ${yBotEarBase + 3.57} ${xTopFlapR - hookW} ${yBotEarBase}`;
  segments.push({ kind: 'OUTER', geometry: 'path', start: { x: xTopFlapR, y: yBotEarBase }, end: { x: xTopFlapR - hookW, y: yBotEarBase }, d: dBotHookR, strokeColor: RED });

  // -------------------------------------------------------------
  // 5. STADIUM HANDLE CUTOUTS (85mm x 30mm, Radius = 15mm, collinear with grip crease)
  // -------------------------------------------------------------
  const xHandleMidL = xCenter - handleStraightW / 2;
  const xHandleMidR = xCenter + handleStraightW / 2;

  // Top Handle Cutout (30mm height: from yTopGripCrease - 30 to yTopGripCrease)
  const yTopHandleTop = yTopGripCrease - 30.0;
  const yTopHandleBot = yTopGripCrease;

  // Top handle: top straight cut, right arc, bottom straight cut (collinear with grip crease), left arc
  segments.push({ kind: 'CUT', geometry: 'line', start: { x: xHandleMidL, y: yTopHandleTop }, end: { x: xHandleMidR, y: yTopHandleTop }, strokeColor: RED, name: 'فتحة المقبض العلوي أعلى' });
  segments.push({ kind: 'CUT', geometry: 'line', start: { x: xHandleMidL, y: yTopHandleBot }, end: { x: xHandleMidR, y: yTopHandleBot }, strokeColor: RED, name: 'فتحة المقبض العلوي أسفل' });
  
  const dTopHandleArcL = `M ${xHandleMidL} ${yTopHandleBot} A ${handleR} ${handleR} 0 0 1 ${xHandleMidL} ${yTopHandleTop}`;
  segments.push({ kind: 'CUT', geometry: 'path', start: { x: xHandleMidL, y: yTopHandleBot }, end: { x: xHandleMidL, y: yTopHandleTop }, d: dTopHandleArcL, strokeColor: RED, name: 'قوس فتحة المقبض العلوي يسار' });
  
  const dTopHandleArcR = `M ${xHandleMidR} ${yTopHandleTop} A ${handleR} ${handleR} 0 0 1 ${xHandleMidR} ${yTopHandleBot}`;
  segments.push({ kind: 'CUT', geometry: 'path', start: { x: xHandleMidR, y: yTopHandleTop }, end: { x: xHandleMidR, y: yTopHandleBot }, d: dTopHandleArcR, strokeColor: RED, name: 'قوس فتحة المقبض العلوي يمين' });

  // Bottom Handle Cutout (30mm height: from yBotGripCrease to yBotGripCrease + 30)
  const yBotHandleTop = yBotGripCrease;
  const yBotHandleBot = yBotGripCrease + 30.0;

  segments.push({ kind: 'CUT', geometry: 'line', start: { x: xHandleMidL, y: yBotHandleTop }, end: { x: xHandleMidR, y: yBotHandleTop }, strokeColor: RED, name: 'فتحة المقبض السفلي أعلى' });
  segments.push({ kind: 'CUT', geometry: 'line', start: { x: xHandleMidL, y: yBotHandleBot }, end: { x: xHandleMidR, y: yBotHandleBot }, strokeColor: RED, name: 'فتحة المقبض السفلي أسفل' });
  
  const dBotHandleArcL = `M ${xHandleMidL} ${yBotHandleTop} A ${handleR} ${handleR} 0 0 0 ${xHandleMidL} ${yBotHandleBot}`;
  segments.push({ kind: 'CUT', geometry: 'path', start: { x: xHandleMidL, y: yBotHandleTop }, end: { x: xHandleMidL, y: yBotHandleBot }, d: dBotHandleArcL, strokeColor: RED, name: 'قوس فتحة المقبض السفلي يسار' });
  
  const dBotHandleArcR = `M ${xHandleMidR} ${yBotHandleBot} A ${handleR} ${handleR} 0 0 0 ${xHandleMidR} ${yBotHandleTop}`;
  segments.push({ kind: 'CUT', geometry: 'path', start: { x: xHandleMidR, y: yBotHandleBot }, end: { x: xHandleMidR, y: yBotHandleTop }, d: dBotHandleArcR, strokeColor: RED, name: 'قوس فتحة المقبض السفلي يمين' });

  // -------------------------------------------------------------
  // 6. GENERATE SVG
  // -------------------------------------------------------------
  let svgPaths = '';
  for (const s of segments) {
    const stroke = s.strokeColor || (s.kind === 'CREASE' ? GREEN : RED);
    const dash = s.kind === 'CREASE' ? ' stroke-dasharray="3,3"' : '';
    if (s.geometry === 'path' && s.d) {
      svgPaths += `<path d="${s.d}" fill="none" stroke="${stroke}" stroke-width="0.75"${dash} />\n`;
    } else {
      svgPaths += `<line x1="${s.start.x.toFixed(3)}" y1="${s.start.y.toFixed(3)}" x2="${s.end.x.toFixed(3)}" y2="${s.end.y.toFixed(3)}" stroke="${stroke}" stroke-width="0.75"${dash} />\n`;
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW.toFixed(2)} ${totalH.toFixed(2)}" width="${totalW.toFixed(2)}mm" height="${totalH.toFixed(2)}mm">\n${svgPaths}</svg>`;

  return {
    derived,
    bbox: { width: totalW, height: totalH },
    segments,
    svg,
  };
}
