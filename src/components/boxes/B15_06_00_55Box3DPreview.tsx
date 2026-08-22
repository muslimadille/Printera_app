// Three.js 3D Box Preview for ECMA B15_06_00_55 (Lock-Bottom Box with Rollover Lid)
// Strictly standardized to Box3DPreview.tsx (T0002 reference standard)
// Realizes full 10-step physical folding kinematics with 100% closed sealed structure.

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { RotateCcw, Pause, Play } from 'lucide-react';

interface B15_06_00_55Box3DPreviewProps {
  width: number;
  height: number;
  depth: number;
  tuckFlap: number;
  svgMarkup: string;
  svgWidth: number;
  svgHeight: number;
}

export default function B15_06_00_55Box3DPreview({
  width,
  height,
  depth,
  tuckFlap,
  svgMarkup,
  svgWidth,
  svgHeight,
}: B15_06_00_55Box3DPreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number>(0);

  const [foldPercent, setFoldPercent] = useState(100);
  const [autoRotate, setAutoRotate] = useState(false);
  const [cardboardColor] = useState('#e2d4b7'); // Kraft cardboard color

  const modelGroupRef = useRef<THREE.Group | null>(null);

  // High-Resolution SVG Texture for crisp dieline lines & cardboard finish
  const texture = useMemo(() => {
    if (!svgMarkup) return null;
    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = Math.max(512, Math.min(2048, Math.round(svgWidth * scale)));
    canvas.height = Math.max(512, Math.min(2048, Math.round(svgHeight * scale)));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = cardboardColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      tex.needsUpdate = true;
      URL.revokeObjectURL(url);
    };
    img.src = url;

    return tex;
  }, [svgMarkup, svgWidth, svgHeight, cardboardColor]);

  // Helper to map custom UVs from SVG 2D bounding box
  const applyUVs = (geo: THREE.BufferGeometry, uMin: number, vMin: number, uMax: number, vMax: number, totalW: number, totalH: number) => {
    const pos = geo.attributes.position;
    const uvs = new Float32Array(pos.count * 2);

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const tx = (x - minX) / rangeX;
      const ty = (y - minY) / rangeY;

      const uSvg = uMin + tx * (uMax - uMin);
      const vSvg = vMin + ty * (vMax - vMin);

      uvs[i * 2] = uSvg / totalW;
      uvs[i * 2 + 1] = 1.0 - vSvg / totalH;
    }

    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  };

  // Generates the hierarchical 3D Box Mesh Group based on fold progress t in [0, 100]
  const buildMeshGroup = useCallback(
    (tProgress: number) => {
      const rootGroup = new THREE.Group();
      const t = tProgress / 100;

      const W = width;
      const H = height;
      const D = depth;
      const Tf = tuckFlap || D;

      const totalW = D + W + D + W + Tf;
      const totalH = D + H + D;

      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(cardboardColor),
        roughness: 0.65,
        metalness: 0.05,
        side: THREE.DoubleSide,
        map: texture || undefined,
      });

      // Kinematic Stages (Smooth ease-in-out intervals)
      const ease = (v: number) => (v < 0.5 ? 2 * v * v : -1 + (4 - 2 * v) * v);
      const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

      // 1. Side Walls Fold (t: 0.0 -> 0.40)
      const tWalls = ease(clamp01(t / 0.40));
      const angleWall = tWalls * (Math.PI / 2);

      // 2. Small Hook Flaps Fold (t: 0.25 -> 0.65)
      const tSideFlaps = ease(clamp01((t - 0.25) / 0.40));
      const angleSideFlap = tSideFlaps * (Math.PI / 2);

      // 3. Rectangular Dust Flaps Fold (t: 0.45 -> 0.80)
      const tRectFlaps = ease(clamp01((t - 0.45) / 0.35));
      const angleRectFlap = tRectFlaps * (Math.PI / 2);

      // 4. Curved Rollover Tuck Flaps Fold (t: 0.65 -> 1.00)
      const tLidFlaps = ease(clamp01((t - 0.65) / 0.35));
      const angleLidFlap = tLidFlaps * (Math.PI / 2);

      // Cardboard thickness layer offset to prevent z-fighting
      const th1 = 0.2;
      const th2 = 0.4;

      // =========================================================================
      // 1. BASE PANEL (Panel 2 / Main Front Panel) - Centered at (0, 0, 0)
      // =========================================================================
      const p2Shape = new THREE.Shape();
      p2Shape.moveTo(-W / 2, -H / 2);
      p2Shape.lineTo(W / 2, -H / 2);
      p2Shape.lineTo(W / 2, H / 2);
      p2Shape.lineTo(-W / 2, H / 2);
      p2Shape.closePath();

      const p2Geo = new THREE.ShapeGeometry(p2Shape);
      applyUVs(p2Geo, D, D, D + W, D + H, totalW, totalH);
      const p2Mesh = new THREE.Mesh(p2Geo, material);
      rootGroup.add(p2Mesh);

      // --- Top Rectangular Flap (Panel 2 Top) ---
      const p2TopGroup = new THREE.Group();
      p2TopGroup.position.set(0, H / 2, 0);
      rootGroup.add(p2TopGroup);

      const p2TopShape = new THREE.Shape();
      p2TopShape.moveTo(-W / 2, 0);
      p2TopShape.lineTo(W / 2, 0);
      p2TopShape.lineTo(W / 2, D);
      p2TopShape.lineTo(-W / 2, D);
      p2TopShape.closePath();

      const p2TopGeo = new THREE.ShapeGeometry(p2TopShape);
      applyUVs(p2TopGeo, D, 0, D + W, D, totalW, totalH);
      const p2TopMesh = new THREE.Mesh(p2TopGeo, material);
      p2TopGroup.add(p2TopMesh);
      p2TopGroup.rotation.x = angleRectFlap; // folds inward (+Z)

      // --- Bottom Rectangular Flap (Panel 2 Bottom) ---
      const p2BotGroup = new THREE.Group();
      p2BotGroup.position.set(0, -H / 2, 0);
      rootGroup.add(p2BotGroup);

      const p2BotShape = new THREE.Shape();
      p2BotShape.moveTo(-W / 2, 0);
      p2BotShape.lineTo(W / 2, 0);
      p2BotShape.lineTo(W / 2, -D);
      p2BotShape.lineTo(-W / 2, -D);
      p2BotShape.closePath();

      const p2BotGeo = new THREE.ShapeGeometry(p2BotShape);
      applyUVs(p2BotGeo, D, D + H, D + W, D + H + D, totalW, totalH);
      const p2BotMesh = new THREE.Mesh(p2BotGeo, material);
      p2BotGroup.add(p2BotMesh);
      p2BotGroup.rotation.x = -angleRectFlap; // folds inward (+Z)

      // =========================================================================
      // 2. RIGHT SIDE WALL (Panel 3 / Side Panel A) - Hinge at x = +W/2
      // =========================================================================
      const p3Hinge = new THREE.Group();
      p3Hinge.position.set(W / 2, 0, 0);
      rootGroup.add(p3Hinge);

      const p3Shape = new THREE.Shape();
      p3Shape.moveTo(0, -H / 2);
      p3Shape.lineTo(D, -H / 2);
      p3Shape.lineTo(D, H / 2);
      p3Shape.lineTo(0, H / 2);
      p3Shape.closePath();

      const p3Geo = new THREE.ShapeGeometry(p3Shape);
      applyUVs(p3Geo, D + W, D, D + W + D, D + H, totalW, totalH);
      const p3Mesh = new THREE.Mesh(p3Geo, material);
      p3Hinge.add(p3Mesh);
      p3Hinge.rotation.y = angleWall; // folds inward (+Z)

      // --- Panel 3 Top Hook Flap ---
      const p3TopGroup = new THREE.Group();
      p3TopGroup.position.set(0, H / 2, 0);
      p3Hinge.add(p3TopGroup);

      const p3TopShape = new THREE.Shape();
      const p3HookTipX = 0.7253 * D;
      const p3HookTipY = 0.7383 * D;
      p3TopShape.moveTo(0, 0);
      p3TopShape.lineTo(0.30 * D, 0.313 * D);
      p3TopShape.absarc(0.30 * D + 0.212 * D, 0.313 * D + 0.212 * D, 0.30 * D, -Math.PI * 0.75, Math.PI * 0.25, false);
      p3TopShape.lineTo(p3HookTipX, p3HookTipY);
      p3TopShape.lineTo(D - 0.40 * D, 0.60 * D);
      p3TopShape.lineTo(D, 0.455 * D);
      p3TopShape.lineTo(D, 0);
      p3TopShape.closePath();

      const p3TopGeo = new THREE.ShapeGeometry(p3TopShape);
      applyUVs(p3TopGeo, D + W, 0, D + W + D, D, totalW, totalH);
      const p3TopMesh = new THREE.Mesh(p3TopGeo, material);
      p3TopGroup.add(p3TopMesh);
      p3TopGroup.rotation.x = angleSideFlap; // folds inward under main flap

      // --- Panel 3 Bottom Hook Flap ---
      const p3BotGroup = new THREE.Group();
      p3BotGroup.position.set(0, -H / 2, 0);
      p3Hinge.add(p3BotGroup);

      const p3BotShape = new THREE.Shape();
      p3BotShape.moveTo(0, 0);
      p3BotShape.lineTo(0.30 * D, -0.313 * D);
      p3BotShape.absarc(0.30 * D + 0.212 * D, -0.313 * D - 0.212 * D, 0.30 * D, Math.PI * 0.75, -Math.PI * 0.25, true);
      p3BotShape.lineTo(p3HookTipX, -p3HookTipY);
      p3BotShape.lineTo(D - 0.40 * D, -0.60 * D);
      p3BotShape.lineTo(D, -0.455 * D);
      p3BotShape.lineTo(D, 0);
      p3BotShape.closePath();

      const p3BotGeo = new THREE.ShapeGeometry(p3BotShape);
      applyUVs(p3BotGeo, D + W, D + H, D + W + D, D + H + D, totalW, totalH);
      const p3BotMesh = new THREE.Mesh(p3BotGeo, material);
      p3BotGroup.add(p3BotMesh);
      p3BotGroup.rotation.x = -angleSideFlap; // folds inward under main flap

      // =========================================================================
      // 3. BACK PANEL (Panel 4 / Main Panel B) - Attached to Panel 3 edge at x = D
      // =========================================================================
      const p4Hinge = new THREE.Group();
      p4Hinge.position.set(D, 0, 0);
      p3Hinge.add(p4Hinge);

      const p4Shape = new THREE.Shape();
      p4Shape.moveTo(0, -H / 2);
      p4Shape.lineTo(W, -H / 2);
      p4Shape.lineTo(W, H / 2);
      p4Shape.lineTo(0, H / 2);
      p4Shape.closePath();

      const p4Geo = new THREE.ShapeGeometry(p4Shape);
      applyUVs(p4Geo, D + W + D, D, D + W + D + W, D + H, totalW, totalH);
      const p4Mesh = new THREE.Mesh(p4Geo, material);
      p4Hinge.add(p4Mesh);
      p4Hinge.rotation.y = angleWall; // folds 90 deg relative to Panel 3 (to z = +D)

      // --- Panel 4 Top Rollover Flap (Folds +90° around local X to seal top from z = D to z = 0) ---
      const p4TopGroup = new THREE.Group();
      p4TopGroup.position.set(0, H / 2, th1 * t);
      p4Hinge.add(p4TopGroup);

      const p4TopShape = new THREE.Shape();
      p4TopShape.moveTo(0, 0);
      p4TopShape.lineTo(W * 0.092, D * 0.563);
      p4TopShape.bezierCurveTo(W * 0.136, D * 0.832, W * 0.246, D, W * 0.362, D);
      p4TopShape.lineTo(W - 22, D);
      p4TopShape.absarc(W - 22, D - 22, 22, Math.PI / 2, 0, true);
      p4TopShape.lineTo(W, 0);
      p4TopShape.closePath();

      const p4TopGeo = new THREE.ShapeGeometry(p4TopShape);
      applyUVs(p4TopGeo, D + W + D, 0, D + W + D + W, D, totalW, totalH);
      const p4TopMesh = new THREE.Mesh(p4TopGeo, material);
      p4TopGroup.add(p4TopMesh);
      p4TopGroup.rotation.x = angleLidFlap; // folds +90° inward from z = +D to z = 0 to completely seal top

      // --- Panel 4 Bottom Rollover Flap (Folds -90° around local X to seal bottom from z = D to z = 0) ---
      const p4BotGroup = new THREE.Group();
      p4BotGroup.position.set(0, -H / 2, th1 * t);
      p4Hinge.add(p4BotGroup);

      const p4BotShape = new THREE.Shape();
      p4BotShape.moveTo(0, 0);
      p4BotShape.lineTo(W * 0.092, -D * 0.563);
      p4BotShape.bezierCurveTo(W * 0.136, -D * 0.832, W * 0.246, -D, W * 0.362, -D);
      p4BotShape.lineTo(W - 22, -D);
      p4BotShape.absarc(W - 22, -D + 22, 22, -Math.PI / 2, 0, false);
      p4BotShape.lineTo(W, 0);
      p4BotShape.closePath();

      const p4BotGeo = new THREE.ShapeGeometry(p4BotShape);
      applyUVs(p4BotGeo, D + W + D, D + H, D + W + D + W, D + H + D, totalW, totalH);
      const p4BotMesh = new THREE.Mesh(p4BotGeo, material);
      p4BotGroup.add(p4BotMesh);
      p4BotGroup.rotation.x = -angleLidFlap; // folds -90° inward from z = +D to z = 0 to completely seal bottom

      // =========================================================================
      // 4. RIGHT TUCK / SIDE FLAP (Panel 5 / Side Panel B) - Attached to Panel 4 edge at x = W
      // =========================================================================
      const p5Hinge = new THREE.Group();
      p5Hinge.position.set(W, 0, th1 * t);
      p4Hinge.add(p5Hinge);

      const rn = Math.min(20, H * 0.08);
      const p5Shape = new THREE.Shape();
      p5Shape.moveTo(0, -H / 2);
      p5Shape.lineTo(Tf, -H / 2);
      p5Shape.lineTo(Tf, -rn);
      p5Shape.absarc(Tf, 0, rn, -Math.PI / 2, Math.PI / 2, true); // half circle thumb notch
      p5Shape.lineTo(Tf, H / 2);
      p5Shape.lineTo(0, H / 2);
      p5Shape.closePath();

      const p5Geo = new THREE.ShapeGeometry(p5Shape);
      applyUVs(p5Geo, D + W + D + W, D, totalW, D + H, totalW, totalH);
      const p5Mesh = new THREE.Mesh(p5Geo, material);
      p5Hinge.add(p5Mesh);
      p5Hinge.rotation.y = angleWall; // folds 90 deg along left wall (x = -W/2) from z = +D to z = 0

      // --- Panel 5 Top Hook Flap ---
      const p5TopGroup = new THREE.Group();
      p5TopGroup.position.set(0, H / 2, 0);
      p5Hinge.add(p5TopGroup);

      const p5TopShape = new THREE.Shape();
      p5TopShape.moveTo(0, 0);
      p5TopShape.lineTo(0.30 * D, 0.313 * D);
      p5TopShape.absarc(0.30 * D + 0.212 * D, 0.313 * D + 0.212 * D, 0.30 * D, -Math.PI * 0.75, Math.PI * 0.25, false);
      p5TopShape.lineTo(p3HookTipX, p3HookTipY);
      p5TopShape.lineTo(Tf - 0.40 * D, 0.60 * D);
      p5TopShape.lineTo(Tf, 0.455 * D);
      p5TopShape.lineTo(Tf, 0);
      p5TopShape.closePath();

      const p5TopGeo = new THREE.ShapeGeometry(p5TopShape);
      applyUVs(p5TopGeo, D + W + D + W, 0, totalW, D, totalW, totalH);
      const p5TopMesh = new THREE.Mesh(p5TopGeo, material);
      p5TopGroup.add(p5TopMesh);
      p5TopGroup.rotation.x = angleSideFlap;

      // --- Panel 5 Bottom Hook Flap ---
      const p5BotGroup = new THREE.Group();
      p5BotGroup.position.set(0, -H / 2, 0);
      p5Hinge.add(p5BotGroup);

      const p5BotShape = new THREE.Shape();
      p5BotShape.moveTo(0, 0);
      p5BotShape.lineTo(0.30 * D, -0.313 * D);
      p5BotShape.absarc(0.30 * D + 0.212 * D, -0.313 * D - 0.212 * D, 0.30 * D, Math.PI * 0.75, -Math.PI * 0.25, true);
      p5BotShape.lineTo(p3HookTipX, -p3HookTipY);
      p5BotShape.lineTo(Tf - 0.40 * D, -0.60 * D);
      p5BotShape.lineTo(Tf, -0.455 * D);
      p5BotShape.lineTo(Tf, 0);
      p5BotShape.closePath();

      const p5BotGeo = new THREE.ShapeGeometry(p5BotShape);
      applyUVs(p5BotGeo, D + W + D + W, D + H, totalW, D + H + D, totalW, totalH);
      const p5BotMesh = new THREE.Mesh(p5BotGeo, material);
      p5BotGroup.add(p5BotMesh);
      p5BotGroup.rotation.x = -angleSideFlap;

      // =========================================================================
      // 5. LEFT SIDE FLAP (Panel 1 / Side Flap) - Hinge at x = -W/2
      // =========================================================================
      const p1Hinge = new THREE.Group();
      p1Hinge.position.set(-W / 2, 0, 0);
      rootGroup.add(p1Hinge);

      const p1Shape = new THREE.Shape();
      p1Shape.moveTo(0, -H / 2);
      p1Shape.lineTo(-D, -H / 2);
      p1Shape.lineTo(-D, H / 2);
      p1Shape.lineTo(0, H / 2);
      p1Shape.closePath();

      const p1Geo = new THREE.ShapeGeometry(p1Shape);
      applyUVs(p1Geo, 0, D, D, D + H, totalW, totalH);
      const p1Mesh = new THREE.Mesh(p1Geo, material);
      p1Hinge.add(p1Mesh);
      p1Hinge.rotation.y = angleWall; // folds inward (+Z) from z = 0 to z = +D

      // --- Panel 1 Top Hook Flap ---
      const p1TopGroup = new THREE.Group();
      p1TopGroup.position.set(0, H / 2, 0);
      p1Hinge.add(p1TopGroup);

      const p1TopShape = new THREE.Shape();
      p1TopShape.moveTo(0, 0);
      p1TopShape.lineTo(-0.30 * D, 0.313 * D);
      p1TopShape.absarc(-0.30 * D - 0.212 * D, 0.313 * D + 0.212 * D, 0.30 * D, -Math.PI * 0.25, Math.PI * 0.75, false);
      p1TopShape.lineTo(-p3HookTipX, p3HookTipY);
      p1TopShape.lineTo(-D + 0.40 * D, 0.60 * D);
      p1TopShape.lineTo(-D, 0.455 * D);
      p1TopShape.lineTo(-D, 0);
      p1TopShape.closePath();

      const p1TopGeo = new THREE.ShapeGeometry(p1TopShape);
      applyUVs(p1TopGeo, 0, 0, D, D, totalW, totalH);
      const p1TopMesh = new THREE.Mesh(p1TopGeo, material);
      p1TopGroup.add(p1TopMesh);
      p1TopGroup.rotation.x = angleSideFlap; // folds inward under main flap

      // --- Panel 1 Bottom Hook Flap ---
      const p1BotGroup = new THREE.Group();
      p1BotGroup.position.set(0, -H / 2, 0);
      p1Hinge.add(p1BotGroup);

      const p1BotShape = new THREE.Shape();
      p1BotShape.moveTo(0, 0);
      p1BotShape.lineTo(-0.30 * D, -0.313 * D);
      p1BotShape.absarc(-0.30 * D - 0.212 * D, -0.313 * D - 0.212 * D, 0.30 * D, Math.PI * 0.25, -Math.PI * 0.75, true);
      p1BotShape.lineTo(-p3HookTipX, -p3HookTipY);
      p1BotShape.lineTo(-D + 0.40 * D, -0.60 * D);
      p1BotShape.lineTo(-D, -0.455 * D);
      p1BotShape.lineTo(-D, 0);
      p1BotShape.closePath();

      const p1BotGeo = new THREE.ShapeGeometry(p1BotShape);
      applyUVs(p1BotGeo, 0, D + H, D, D + H + D, totalW, totalH);
      const p1BotMesh = new THREE.Mesh(p1BotGeo, material);
      p1BotGroup.add(p1BotMesh);
      p1BotGroup.rotation.x = -angleSideFlap; // folds inward under main flap

      // Center the whole model in viewport
      const centerZOffset = -t * (D / 2);
      rootGroup.position.set(0, 0, centerZOffset);

      return rootGroup;
    },
    [width, height, depth, tuckFlap, cardboardColor, texture]
  );

  // Initialize Three.js Scene matching Box3DPreview standard
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const w = container.clientWidth || 600;
    const h = container.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, w / h, 1, 3000);
    camera.position.set(160, 220, 360);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 1500;
    controls.minDistance = 40;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.5;
    controlsRef.current = controls;

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.3);
    dirLight1.position.set(180, 260, 220);
    dirLight1.castShadow = true;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.65);
    dirLight2.position.set(-180, -120, -180);
    scene.add(dirLight2);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);
    modelGroupRef.current = rootGroup;

    // Animation Loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animFrameRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // Update controls autoRotate
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Update Model Mesh when FoldPercent, dimensions, or materials change
  useEffect(() => {
    const root = modelGroupRef.current;
    if (!root) return;

    while (root.children.length > 0) {
      root.remove(root.children[0]);
    }

    const meshGroup = buildMeshGroup(foldPercent);
    root.add(meshGroup);
  }, [foldPercent, buildMeshGroup]);

  const resetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(160, 220, 360);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  const foldLabel =
    foldPercent === 0
      ? 'مفرود (2D Dieline)'
      : foldPercent === 100
      ? 'علبة مغلقة بالكامل'
      : 'قيد الطي';

  return (
    <div className="w-full h-full flex flex-col justify-between p-3 gap-3">
      {/* ── Viewport (Stretches to fill 100% of height) ── */}
      <div
        ref={mountRef}
        className="relative w-full flex-1 min-h-[350px] rounded-xl overflow-hidden border border-slate-200 select-none shadow-xs"
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
            title={autoRotate ? 'إيقاف الدوران' : 'تشغيل الدوران'}
            onClick={() => setAutoRotate(v => !v)}
            className="w-8 h-8 p-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg flex items-center justify-center shadow-2xs border border-slate-800 shrink-0 cursor-pointer"
          >
            {autoRotate ? <Pause className="w-3 h-3 shrink-0" /> : <Play className="w-3 h-3 shrink-0" />}
          </Button>
          <Button
            type="button"
            title="إعادة ضبط العرض"
            onClick={resetCamera}
            className="w-8 h-8 p-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg flex items-center justify-center shadow-2xs border border-slate-800 shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 shrink-0" />
          </Button>
        </div>
      </div>
    </div>
  );
}
