import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { RotateCcw, Pause, Play } from 'lucide-react';

interface Props {
  width: number;       // W (mm)
  height: number;      // H (mm)
  depth: number;       // D (mm)
  glueFlap: number;    // Gf (mm)
  svgMarkup?: string;
  svgWidth?: number;
  svgHeight?: number;
}

export default function Gable_Box_1Box3DPreview({
  width: W,
  height: H,
  depth: D,
  glueFlap: Gf,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [foldPercent, setFoldPercent] = useState<number>(100);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const boxRootRef = useRef<THREE.Group | null>(null);

  // Scaled dimensions strictly from K027A master specification
  const baseScale = D / 120;
  const topTotalH = 142.5 * baseScale;
  const snapFlapH = 84.0 * baseScale;
  const yHeaderCrease1 = 31.0 * baseScale; // Upper crease (punch holes)
  const yHeaderCrease2 = 61.0 * baseScale; // Lower crease / roof slope junction
  const slopeH = topTotalH - yHeaderCrease2; // Height of inclined roof slope (~81.5 * baseScale)
  const headerH = yHeaderCrease2;             // Height of vertical header (~61.0 * baseScale)
  const handleTabW = Math.min(D * 0.46, 54 * baseScale);
  const tabOffset = (D - handleTabW) / 2;
  const tabH = topTotalH - slopeH;           // Height of handle lock tab (~61.0 * baseScale)
  const holeMarginX = Math.min(W * 0.25, 95 * (W / 370));
  const rHole = 2.5;

  // Reset Camera
  const handleResetCamera = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const maxDim = Math.max(W, H, D, 100);
    cameraRef.current.position.set(maxDim * 1.5, maxDim * 1.3, maxDim * 2.0);
    cameraRef.current.lookAt(0, H * 0.2, 0);
    controlsRef.current.target.set(0, H * 0.2, 0);
    controlsRef.current.update();
  }, [W, H, D]);

  // Construct 3D Folding Geometry Hierarchy
  const buildBox = useCallback((t: number) => {
    const root = new THREE.Group();
    const foldRad = (t * Math.PI) / 2; // 0 to 90 degrees

    // Packaging materials
    const matOuter = new THREE.MeshPhysicalMaterial({
      color: 0xfbfbfd, // Premium clean white cardstock
      roughness: 0.35,
      metalness: 0.02,
      clearcoat: 0.05,
      clearcoatRoughness: 0.2,
      side: THREE.DoubleSide,
      shadowSide: THREE.DoubleSide,
    });

    const matInner = new THREE.MeshPhysicalMaterial({
      color: 0xebedf0, // Light neutral interior
      roughness: 0.6,
      metalness: 0.01,
      side: THREE.DoubleSide,
    });

    const matCrease = new THREE.LineBasicMaterial({ color: 0x0a9748, linewidth: 1.5 }); // Green crease #0a9748
    const matCut = new THREE.LineBasicMaterial({ color: 0xe21f26, linewidth: 1.8 });    // Red cut #e21f26

    const matEyelet = new THREE.MeshStandardMaterial({
      color: 0xc89d44, // Golden brass ring
      metalness: 0.88,
      roughness: 0.25,
      side: THREE.DoubleSide,
    });

    const matRope = new THREE.MeshStandardMaterial({
      color: 0x1f2421, // Luxury dark charcoal braided cord
      roughness: 0.95,
      metalness: 0.0,
    });

    // Helper to create outline wireframes
    const createWireframe = (shape: THREE.Shape, mat: THREE.Material) => {
      const geom = new THREE.ShapeGeometry(shape);
      return new THREE.LineSegments(new THREE.EdgesGeometry(geom, 15), mat);
    };

    // Center entire template in world
    const centerOffset = new THREE.Group();
    centerOffset.position.set(-W / 2, -H / 2, -D / 2 * t);
    root.add(centerOffset);

    // ─────────────────────────────────────────────────────────────
    // 1. FRONT BODY PANEL (Panel 1: Anchor)
    // ─────────────────────────────────────────────────────────────
    const frontShape = new THREE.Shape();
    frontShape.moveTo(0, 0);
    frontShape.lineTo(W, 0);
    frontShape.lineTo(W, H);
    frontShape.lineTo(0, H);
    frontShape.closePath();

    const frontPanel = new THREE.Mesh(new THREE.ShapeGeometry(frontShape), matOuter);
    frontPanel.castShadow = true;
    frontPanel.receiveShadow = true;
    frontPanel.add(createWireframe(frontShape, matCrease));
    centerOffset.add(frontPanel);

    // ── Left Glue Flap (Folds -90° into the box to adhere flush on inner face of Side 2) ──
    const gluePivot = new THREE.Group();
    gluePivot.position.set(0, 0, 0);
    frontPanel.add(gluePivot);

    const glueShape = new THREE.Shape();
    glueShape.moveTo(0, 0);
    glueShape.lineTo(-Gf, 10);
    glueShape.lineTo(-Gf, H - 10);
    glueShape.lineTo(0, H);
    glueShape.closePath();
    const glueMesh = new THREE.Mesh(new THREE.ShapeGeometry(glueShape), matInner);
    glueMesh.add(createWireframe(glueShape, matCut));
    gluePivot.add(glueMesh);
    // Negative rotation folds the glue flap towards -Z inside the left wall (Side 2)
    gluePivot.rotation.y = -foldRad;

    // ── Bottom Flap 1 (under Front Panel - Snap flap with 2 notches) ──
    const bot1Pivot = new THREE.Group();
    bot1Pivot.position.set(0, 0, 0);
    frontPanel.add(bot1Pivot);

    const notchW = Math.min(W * 0.23, 84 * (W / 370));
    const notchH = 19 * baseScale;
    const spaceW = (W - (notchW * 2) - 40) / 3;
    const rNotch = 5;

    const b1Shape = new THREE.Shape();
    b1Shape.moveTo(0, 0);
    b1Shape.lineTo(W, 0);
    b1Shape.lineTo(W - 20, -snapFlapH);
    b1Shape.lineTo(W - 20 - spaceW, -snapFlapH);
    b1Shape.lineTo(W - 20 - spaceW - rNotch, -snapFlapH + notchH);
    b1Shape.lineTo(W - 20 - spaceW - notchW + rNotch, -snapFlapH + notchH);
    b1Shape.lineTo(W - 20 - spaceW - notchW, -snapFlapH);
    b1Shape.lineTo(20 + spaceW + notchW, -snapFlapH);
    b1Shape.lineTo(20 + spaceW + notchW - rNotch, -snapFlapH + notchH);
    b1Shape.lineTo(20 + spaceW + rNotch, -snapFlapH + notchH);
    b1Shape.lineTo(20 + spaceW, -snapFlapH);
    b1Shape.lineTo(0, -snapFlapH);
    b1Shape.closePath();

    const bot1Mesh = new THREE.Mesh(new THREE.ShapeGeometry(b1Shape), matOuter);
    bot1Mesh.add(createWireframe(b1Shape, matCut));
    bot1Pivot.add(bot1Mesh);
    bot1Pivot.rotation.x = foldRad;

    // ── Front Roof Slope & Vertical Header ──
    const maxSlopeAngle = Math.asin(Math.min(0.99, (D * 0.5) / slopeH));
    const slopeAngle = maxSlopeAngle * t;

    const frontSlopePivot = new THREE.Group();
    frontSlopePivot.position.set(0, H, 0);
    frontPanel.add(frontSlopePivot);
    frontSlopePivot.rotation.x = -slopeAngle;

    // Front Roof Slope Quad
    const slopeShape = new THREE.Shape();
    slopeShape.moveTo(0, 0);
    slopeShape.lineTo(W, 0);
    slopeShape.lineTo(W, slopeH);
    slopeShape.lineTo(0, slopeH);
    slopeShape.closePath();
    const frontSlopeMesh = new THREE.Mesh(new THREE.ShapeGeometry(slopeShape), matOuter);
    frontSlopeMesh.add(createWireframe(slopeShape, matCrease));
    frontSlopePivot.add(frontSlopeMesh);

    // Front Standing Header Pivot (at Y = slopeH)
    const frontHeaderPivot = new THREE.Group();
    frontHeaderPivot.position.set(0, slopeH, 0);
    frontSlopePivot.add(frontHeaderPivot);
    frontHeaderPivot.rotation.x = slopeAngle;

    const cornerR = 10;
    const headerShape = new THREE.Shape();
    headerShape.moveTo(0, 0);
    headerShape.lineTo(W, 0);
    headerShape.lineTo(W, headerH - cornerR);
    headerShape.absarc(W - cornerR, headerH - cornerR, cornerR, 0, Math.PI / 2, false);
    headerShape.lineTo(cornerR, headerH);
    headerShape.absarc(cornerR, headerH - cornerR, cornerR, Math.PI / 2, Math.PI, false);
    headerShape.closePath();

    const holeYOnHeader = headerH - yHeaderCrease1;
    const hole1 = new THREE.Path();
    hole1.absarc(holeMarginX, holeYOnHeader, rHole, 0, Math.PI * 2, false);
    headerShape.holes.push(hole1);

    const hole2 = new THREE.Path();
    hole2.absarc(W - holeMarginX, holeYOnHeader, rHole, 0, Math.PI * 2, false);
    headerShape.holes.push(hole2);

    const frontHeaderMesh = new THREE.Mesh(new THREE.ShapeGeometry(headerShape), matOuter);
    frontHeaderMesh.add(createWireframe(headerShape, matCut));
    frontHeaderPivot.add(frontHeaderMesh);

    const headerCreaseGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, holeYOnHeader, 0.1),
      new THREE.Vector3(W, holeYOnHeader, 0.1),
    ]);
    frontHeaderPivot.add(new THREE.Line(headerCreaseGeo, matCrease));

    // ─────────────────────────────────────────────────────────────
    // 2. GABLE 1 / SIDE 1 (Panel 2: Right of Front, folds +90°)
    // ─────────────────────────────────────────────────────────────
    const side1Pivot = new THREE.Group();
    side1Pivot.position.set(W, 0, 0);
    frontPanel.add(side1Pivot);
    side1Pivot.rotation.y = foldRad;

    const side1Shape = new THREE.Shape();
    side1Shape.moveTo(0, 0);
    side1Shape.lineTo(D, 0);
    side1Shape.lineTo(D, H);
    side1Shape.lineTo(0, H);
    side1Shape.closePath();
    const side1Mesh = new THREE.Mesh(new THREE.ShapeGeometry(side1Shape), matOuter);
    side1Mesh.add(createWireframe(side1Shape, matCrease));
    side1Pivot.add(side1Mesh);

    // ── Bottom Flap 2 (under Side 1 - Tuck Flap) ──
    const bot2Pivot = new THREE.Group();
    bot2Pivot.position.set(0, 0, 0);
    side1Pivot.add(bot2Pivot);

    const b2Shape = new THREE.Shape();
    b2Shape.moveTo(0, 0);
    b2Shape.lineTo(D, 0);
    b2Shape.lineTo(D * 0.5 + 10, -snapFlapH * 0.72);
    b2Shape.lineTo(D * 0.5, -snapFlapH);
    b2Shape.lineTo(0, -snapFlapH);
    b2Shape.closePath();
    const bot2Mesh = new THREE.Mesh(new THREE.ShapeGeometry(b2Shape), matOuter);
    bot2Mesh.add(createWireframe(b2Shape, matCut));
    bot2Pivot.add(bot2Mesh);
    bot2Pivot.rotation.x = foldRad;

    // ── Gable 1 Base Triangular Panel (from Y = 0 to Y = slopeH above body) ──
    const side1GableBase = new THREE.Group();
    side1GableBase.position.set(0, H, 0);
    side1Pivot.add(side1GableBase);

    // Lower gable profile with cut shoulders
    const gableBaseShape1 = new THREE.Shape();
    gableBaseShape1.moveTo(0, 0);
    gableBaseShape1.lineTo(D, 0);
    gableBaseShape1.lineTo(D, slopeH);
    gableBaseShape1.lineTo(D - tabOffset, slopeH);
    gableBaseShape1.lineTo(tabOffset, slopeH);
    gableBaseShape1.lineTo(0, slopeH);
    gableBaseShape1.closePath();

    const side1GableBaseMesh = new THREE.Mesh(new THREE.ShapeGeometry(gableBaseShape1), matOuter);
    side1GableBase.add(side1GableBaseMesh);

    // Red cut lines for outer shoulders
    const shoulderCutGeo1 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0.1),
      new THREE.Vector3(0, slopeH, 0.1),
      new THREE.Vector3(tabOffset, slopeH, 0.1),
    ]);
    side1GableBase.add(new THREE.Line(shoulderCutGeo1, matCut));

    const shoulderCutGeo2 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(D - tabOffset, slopeH, 0.1),
      new THREE.Vector3(D, slopeH, 0.1),
      new THREE.Vector3(D, 0, 0.1),
    ]);
    side1GableBase.add(new THREE.Line(shoulderCutGeo2, matCut));

    // Green diagonal creases and top horizontal crease on lower gable
    const gableCreaseGeo1 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0.1),
      new THREE.Vector3(tabOffset, slopeH, 0.1),
      new THREE.Vector3(D - tabOffset, slopeH, 0.1),
      new THREE.Vector3(D, 0, 0.1),
    ]);
    side1GableBase.add(new THREE.Line(gableCreaseGeo1, matCrease));

    const topCreaseGeo1 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(tabOffset, slopeH, 0.1),
      new THREE.Vector3(D - tabOffset, slopeH, 0.1),
    ]);
    side1GableBase.add(new THREE.Line(topCreaseGeo1, matCrease));

    // ── Gable 1 Handle Lock Tab (Folds ONLY at the top horizontal crease line Y = slopeH with tilt) ──
    const tabCornerR = 5;
    const side1LockTabPivot = new THREE.Group();
    side1LockTabPivot.position.set(tabOffset, slopeH, 0);
    side1GableBase.add(side1LockTabPivot);

    const lockTabShape1 = new THREE.Shape();
    lockTabShape1.moveTo(0, 0);
    lockTabShape1.lineTo(handleTabW, 0);
    lockTabShape1.lineTo(handleTabW, tabH - tabCornerR);
    lockTabShape1.absarc(handleTabW - tabCornerR, tabH - tabCornerR, tabCornerR, 0, Math.PI / 2, false);
    lockTabShape1.lineTo(tabCornerR, tabH);
    lockTabShape1.absarc(tabCornerR, tabH - tabCornerR, tabCornerR, Math.PI / 2, Math.PI, false);
    lockTabShape1.closePath();

    // Laser Cut Slot on Lock Tab (77 mm scaled)
    const slotW = 2.5;
    const slotH = 77 * baseScale * (tabH / topTotalH);
    const slotYTop = 10 * baseScale;
    const slotX = handleTabW / 2;
    const rSlot = slotW / 2;

    const slot1 = new THREE.Path();
    slot1.moveTo(slotX - rSlot, tabH - slotYTop - rSlot);
    slot1.absarc(slotX, tabH - slotYTop - rSlot, rSlot, Math.PI, 0, false);
    slot1.lineTo(slotX + rSlot, tabH - slotYTop - slotH + rSlot);
    slot1.absarc(slotX, tabH - slotYTop - slotH + rSlot, rSlot, 0, Math.PI, false);
    slot1.closePath();
    lockTabShape1.holes.push(slot1);

    const side1LockTabMesh = new THREE.Mesh(new THREE.ShapeGeometry(lockTabShape1), matOuter);
    side1LockTabMesh.add(createWireframe(lockTabShape1, matCut));
    side1LockTabPivot.add(side1LockTabMesh);

    // Lock Tab tilted inward by ~18° (0.32 rad) for authentic locking posture
    const tabTiltRad = 0.32 * t;
    side1LockTabPivot.rotation.x = -tabTiltRad;

    // ─────────────────────────────────────────────────────────────
    // 3. BACK PANEL (Panel 3: Right of Side 1, folds +90°)
    // ─────────────────────────────────────────────────────────────
    const backPivot = new THREE.Group();
    backPivot.position.set(D, 0, 0);
    side1Pivot.add(backPivot);
    backPivot.rotation.y = foldRad;

    const backShape = new THREE.Shape();
    backShape.moveTo(0, 0);
    backShape.lineTo(W, 0);
    backShape.lineTo(W, H);
    backShape.lineTo(0, H);
    backShape.closePath();
    const backPanel = new THREE.Mesh(new THREE.ShapeGeometry(backShape), matOuter);
    backPanel.add(createWireframe(backShape, matCrease));
    backPivot.add(backPanel);

    // ── Bottom Flap 3 (under Back Panel - Snap Base with 2 notches) ──
    const bot3Pivot = new THREE.Group();
    bot3Pivot.position.set(0, 0, 0);
    backPivot.add(bot3Pivot);

    const bot3Mesh = new THREE.Mesh(new THREE.ShapeGeometry(b1Shape), matOuter);
    bot3Mesh.add(createWireframe(b1Shape, matCut));
    bot3Pivot.add(bot3Mesh);
    bot3Pivot.rotation.x = foldRad;

    // ── Back Roof Slope & Standing Carrier Header ──
    const backSlopePivot = new THREE.Group();
    backSlopePivot.position.set(0, H, 0);
    backPivot.add(backSlopePivot);
    backSlopePivot.rotation.x = -slopeAngle;

    const backSlopeMesh = new THREE.Mesh(new THREE.ShapeGeometry(slopeShape), matOuter);
    backSlopeMesh.add(createWireframe(slopeShape, matCrease));
    backSlopePivot.add(backSlopeMesh);

    const backHeaderPivot = new THREE.Group();
    backHeaderPivot.position.set(0, slopeH, 0);
    backSlopePivot.add(backHeaderPivot);
    backHeaderPivot.rotation.x = slopeAngle;

    const backHeaderShape = new THREE.Shape();
    backHeaderShape.moveTo(0, 0);
    backHeaderShape.lineTo(W, 0);
    backHeaderShape.lineTo(W, headerH - cornerR);
    backHeaderShape.absarc(W - cornerR, headerH - cornerR, cornerR, 0, Math.PI / 2, false);
    backHeaderShape.lineTo(cornerR, headerH);
    backHeaderShape.absarc(cornerR, headerH - cornerR, cornerR, Math.PI / 2, Math.PI, false);
    backHeaderShape.closePath();

    const hole3 = new THREE.Path();
    hole3.absarc(holeMarginX, holeYOnHeader, rHole, 0, Math.PI * 2, false);
    backHeaderShape.holes.push(hole3);

    const hole4 = new THREE.Path();
    hole4.absarc(W - holeMarginX, holeYOnHeader, rHole, 0, Math.PI * 2, false);
    backHeaderShape.holes.push(hole4);

    const backHeaderMesh = new THREE.Mesh(new THREE.ShapeGeometry(backHeaderShape), matOuter);
    backHeaderMesh.add(createWireframe(backHeaderShape, matCut));
    backHeaderPivot.add(backHeaderMesh);

    backHeaderPivot.add(new THREE.Line(headerCreaseGeo, matCrease));

    // ─────────────────────────────────────────────────────────────
    // 4. GABLE 2 / SIDE 2 (Panel 4: Right of Back, folds +90°)
    // ─────────────────────────────────────────────────────────────
    const side2Pivot = new THREE.Group();
    side2Pivot.position.set(W, 0, 0);
    backPivot.add(side2Pivot);
    side2Pivot.rotation.y = foldRad;

    const side2Mesh = new THREE.Mesh(new THREE.ShapeGeometry(side1Shape), matOuter);
    side2Mesh.add(createWireframe(side1Shape, matCrease));
    side2Pivot.add(side2Mesh);

    // ── Bottom Flap 4 (under Side 2 - Tuck Flap) ──
    const bot4Pivot = new THREE.Group();
    bot4Pivot.position.set(0, 0, 0);
    side2Pivot.add(bot4Pivot);

    const b4Shape = new THREE.Shape();
    b4Shape.moveTo(0, 0);
    b4Shape.lineTo(D, 0);
    b4Shape.lineTo(D, -snapFlapH);
    b4Shape.lineTo(D * 0.5, -snapFlapH);
    b4Shape.lineTo(D * 0.5 - 10, -snapFlapH * 0.72);
    b4Shape.closePath();
    const bot4Mesh = new THREE.Mesh(new THREE.ShapeGeometry(b4Shape), matOuter);
    bot4Mesh.add(createWireframe(b4Shape, matCut));
    bot4Pivot.add(bot4Mesh);
    bot4Pivot.rotation.x = foldRad;

    // ── Gable 2 Base Triangular Panel ──
    const side2GableBase = new THREE.Group();
    side2GableBase.position.set(0, H, 0);
    side2Pivot.add(side2GableBase);

    const side2GableBaseMesh = new THREE.Mesh(new THREE.ShapeGeometry(gableBaseShape1), matOuter);
    side2GableBase.add(side2GableBaseMesh);

    side2GableBase.add(new THREE.Line(shoulderCutGeo1, matCut));
    side2GableBase.add(new THREE.Line(shoulderCutGeo2, matCut));
    side2GableBase.add(new THREE.Line(gableCreaseGeo1, matCrease));
    side2GableBase.add(new THREE.Line(topCreaseGeo1, matCrease));

    // ── Gable 2 Handle Lock Tab (Folds ONLY at the top horizontal crease line Y = slopeH with tilt) ──
    const side2LockTabPivot = new THREE.Group();
    side2LockTabPivot.position.set(tabOffset, slopeH, 0);
    side2GableBase.add(side2LockTabPivot);

    const side2LockTabMesh = new THREE.Mesh(new THREE.ShapeGeometry(lockTabShape1), matOuter);
    side2LockTabMesh.add(createWireframe(lockTabShape1, matCut));
    side2LockTabPivot.add(side2LockTabMesh);

    side2LockTabPivot.rotation.x = -tabTiltRad;

    // ─────────────────────────────────────────────────────────────
    // 5. ROPE CARRYING HANDLES & BRASS EYELETS
    // ─────────────────────────────────────────────────────────────
    const eyeletGeo = new THREE.RingGeometry(rHole * 0.85, rHole * 1.5, 24);

    // Front Brass Eyelets
    const eyeletF1 = new THREE.Mesh(eyeletGeo, matEyelet);
    eyeletF1.position.set(holeMarginX, holeYOnHeader, 0.2);
    frontHeaderPivot.add(eyeletF1);

    const eyeletF2 = new THREE.Mesh(eyeletGeo, matEyelet);
    eyeletF2.position.set(W - holeMarginX, holeYOnHeader, 0.2);
    frontHeaderPivot.add(eyeletF2);

    // Back Brass Eyelets
    const eyeletB1 = new THREE.Mesh(eyeletGeo, matEyelet);
    eyeletB1.position.set(holeMarginX, holeYOnHeader, 0.2);
    backHeaderPivot.add(eyeletB1);

    const eyeletB2 = new THREE.Mesh(eyeletGeo, matEyelet);
    eyeletB2.position.set(W - holeMarginX, holeYOnHeader, 0.2);
    backHeaderPivot.add(eyeletB2);

    // Rope handles arching gracefully when folding
    if (t > 0.05) {
      const createRopeHandle = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, outwardZ: number) => {
        const midX = (x1 + x2) / 2;
        const ropeArchH = Math.min(W * 0.38, 75 * baseScale) * t;
        const ropePeakY = y1 + ropeArchH;
        const ropePeakZ = ((z1 + z2) / 2) + outwardZ * Math.min(D * 0.32, 28) * t;

        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(x1, y1, z1),
          new THREE.Vector3(x1 + (midX - x1) * 0.25, y1 + ropeArchH * 0.75, z1 + outwardZ * 10 * t),
          new THREE.Vector3(midX, ropePeakY, ropePeakZ),
          new THREE.Vector3(x2 + (midX - x2) * 0.25, y2 + ropeArchH * 0.75, z2 + outwardZ * 10 * t),
          new THREE.Vector3(x2, y2, z2),
        ]);

        const tubeGeo = new THREE.TubeGeometry(curve, 32, Math.max(1.8, rHole * 0.7), 10, false);
        const ropeMesh = new THREE.Mesh(tubeGeo, matRope);
        ropeMesh.castShadow = true;
        return ropeMesh;
      };

      // Front Rope attached to frontHeaderPivot
      const frontRope = createRopeHandle(holeMarginX, holeYOnHeader, 1.0, W - holeMarginX, holeYOnHeader, 1.0, 1);
      frontHeaderPivot.add(frontRope);

      // Back Rope attached to backHeaderPivot
      const backRope = createRopeHandle(holeMarginX, holeYOnHeader, 1.0, W - holeMarginX, holeYOnHeader, 1.0, 1);
      backHeaderPivot.add(backRope);
    }

    return root;
  }, [W, H, D, Gf, slopeH, headerH, topTotalH, snapFlapH, yHeaderCrease1, baseScale, holeMarginX, handleTabW, tabOffset, tabH, rHole]);

  // Three.js Scene Setup & Render Loop
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    // Camera
    const maxDim = Math.max(W, H, D, 100);
    const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 1, 10000);
    camera.position.set(maxDim * 1.5, maxDim * 1.3, maxDim * 2.0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, H * 0.2, 0);
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 2.0;
    controlsRef.current = controls;

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.88);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfffaed, 1.15);
    keyLight.position.set(maxDim * 1.8, maxDim * 2.5, maxDim * 2.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe8f0fe, 0.55);
    fillLight.position.set(-maxDim * 1.5, maxDim * 1.0, -maxDim * 1.5);
    scene.add(fillLight);

    const bottomLight = new THREE.DirectionalLight(0xffffff, 0.35);
    bottomLight.position.set(0, -maxDim * 1.5, maxDim * 0.5);
    scene.add(bottomLight);

    // Ground Shadow Plane
    const groundGeo = new THREE.PlaneGeometry(maxDim * 6, maxDim * 6);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.12 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -H * 0.5 - 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Initial build
    const meshGroup = buildBox(foldPercent / 100);
    boxRootRef.current = meshGroup;
    scene.add(meshGroup);

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      container.innerHTML = '';
    };
  }, [W, H, D, Gf, slopeH, headerH, topTotalH, snapFlapH, yHeaderCrease1, baseScale, holeMarginX, handleTabW, tabOffset, tabH, rHole, buildBox]);

  // Update Box Geometry on Fold Percentage change
  useEffect(() => {
    if (!sceneRef.current) return;
    if (boxRootRef.current) {
      sceneRef.current.remove(boxRootRef.current);
    }
    const newMesh = buildBox(foldPercent / 100);
    boxRootRef.current = newMesh;
    sceneRef.current.add(newMesh);
  }, [foldPercent, buildBox]);

  // Update auto-rotate
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  const foldLabel = foldPercent === 0 ? 'مفرود بالكامل (2D)'
    : foldPercent === 100 ? 'صندوق جملوني مغلق ومجسم (3D)'
    : `قيد التجميع (${foldPercent}%)`;

  return (
    <div className="w-full h-full flex flex-col justify-between p-3 gap-3">
      {/* ── Viewport (Stretches to fill 100% of height) ── */}
      <div
        ref={mountRef}
        className="relative w-full flex-1 min-h-[380px] rounded-xl overflow-hidden border border-slate-200 select-none shadow-xs"
        style={{ background: '#ffffff' }}
      >
        {/* شريط معلومات علوي يسار */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          <span className="text-[10px] font-mono text-slate-600 bg-white/90 shadow-sm px-2.5 py-1 rounded-md border border-slate-200">
            🖱 اسحب للدوران • العجلة للتكبير
          </span>
        </div>

        {/* مؤشر حالة الطي — أسفل يسار */}
        <div className="absolute bottom-3 left-3 z-10 pointer-events-none">
          <span className="text-[10px] font-medium text-slate-600 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-md border border-slate-200 shadow-sm">
            {foldLabel}
          </span>
        </div>
      </div>

      {/* ── شريط التحكم المدمج بذكاء (Ultra-Compact 1-Row Control Bar at Bottom) ── */}
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs mt-auto">
        {/* 1. السلايدر ونسبة المئوية */}
        <div className="flex items-center gap-3 flex-1 min-w-[180px]">
          <Slider
            value={[foldPercent]}
            onValueChange={([v]) => setFoldPercent(v)}
            min={0}
            max={100}
            step={1}
            className="flex-1 py-1"
          />
          <span className="text-xs font-mono font-bold text-slate-900 bg-white border border-slate-200/80 px-2 py-0.5 rounded-md shadow-2xs min-w-[42px] text-center">
            {foldPercent}%
          </span>
        </div>

        {/* 2. تابات الوصول السريع (كبسولات مدمجة) */}
        <div className="inline-flex items-center bg-slate-200/60 p-0.5 rounded-full border border-slate-300/40">
          {([0, 50, 100] as const).map(v => (
            <button
              key={v}
              type="button"
              className={`text-xs font-bold px-3 py-1 rounded-full transition-all duration-150 whitespace-nowrap ${
                foldPercent === v
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 bg-transparent'
              }`}
              onClick={() => setFoldPercent(v)}
            >
              {v === 0 ? 'مفرود' : v === 50 ? 'نصف طي' : 'مغلق'}
            </button>
          ))}
        </div>

        {/* 3. أزرار الدوران وإعادة الضبط بالأيقونات الصغيرة والحشو المريح */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            title={autoRotate ? "إيقاف الدوران" : "تشغيل الدوران"}
            onClick={() => setAutoRotate(v => !v)}
            className="w-8 h-8 p-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg flex items-center justify-center shadow-2xs border border-slate-800 shrink-0 cursor-pointer"
          >
            {autoRotate ? <Pause className="w-3 h-3 shrink-0" /> : <Play className="w-3 h-3 shrink-0" />}
          </Button>
          <Button
            type="button"
            title="إعادة ضبط العرض"
            onClick={handleResetCamera}
            className="w-8 h-8 p-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg flex items-center justify-center shadow-2xs border border-slate-800 shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 shrink-0" />
          </Button>
        </div>
      </div>
    </div>
  );
}
