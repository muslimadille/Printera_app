// Three.js 3D Box Preview — Strictly standardized to Box3DPreview.tsx (T0002 reference standard)
// Features:
// 1. Exact matching UI layout, viewport badges ("اسحب للدوران • العجلة للتكبير", "قيد الطي / مغلق"), and bottom control bar with capsules.
// 2. Continuous lenticular 3D pillow box folding kinematics with vertex-welded chamfered glue flap and recessed cap closure.

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { RotateCcw, Pause, Play } from 'lucide-react';

interface PillowBox3DPreviewProps {
  width: number;
  height: number;
  depth: number;
  glueFlap: number;
  svgMarkup: string;
  svgWidth: number;
  svgHeight: number;
}

export default function PillowBox3DPreview({
  width,
  height,
  depth,
  glueFlap,
  svgMarkup,
  svgWidth,
  svgHeight,
}: PillowBox3DPreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number>(0);

  const [foldPercent, setFoldPercent] = useState(100);
  const [autoRotate, setAutoRotate] = useState(false);
  const [cardboardColor] = useState('#e2d4b7'); // Kraft beige

  const modelGroupRef = useRef<THREE.Group | null>(null);

  // High-Resolution SVG Texture for crisp dieline lines & cardboard appearance
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

  // Generates the continuous 3D Pillow Box Mesh Group based on fold progress t in [0, 1]
  const buildMeshGroup = useCallback(
    (tProgress: number) => {
      const group = new THREE.Group();
      const t = tProgress / 100; // 0 = flat 2D dieline, 1 = fully assembled 3D pillow box

      const W = width;
      const H = height;
      const D = depth;
      const Gf = glueFlap;

      // Arc sagitta and radius derived from width and depth
      const s = Math.max(6, Math.min(W * 0.48, D * 0.675));
      const R = s / 2 + (W * W) / (8 * s);
      const rn = Math.min(W * 0.22, 13.5);

      const segsX = 48;
      const segsY = 36;
      const segsFlap = 20;
      const segsGlue = 16;

      // Material with cardboard finish
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(cardboardColor),
        roughness: 0.6,
        metalness: 0.05,
        side: THREE.DoubleSide,
        map: texture || undefined,
      });

      // Kinematic Progressions
      const tBody = Math.min(1, t / 0.7);
      const tFlap1 = Math.min(1, Math.max(0, (t - 0.3) / 0.55));
      const tFlap2 = Math.min(1, Math.max(0, (t - 0.55) / 0.45));
      const tGlue = Math.min(1, Math.max(0, (t - 0.2) / 0.65));

      // UV space layout factors matching 2D SVG
      const totalSvgW = Gf + 2 * W;
      const totalSvgH = H + 2 * s;
      const u0_glue = 0.0;
      const u1_glue = Gf / totalSvgW;
      const u0_p1 = Gf / totalSvgW;       // Face 1 left (glue crease)
      const u1_p1 = (Gf + W) / totalSvgW; // Face 1 right (center crease)
      const u0_p2 = (Gf + W) / totalSvgW; // Face 2 left (center crease)
      const u1_p2 = 1.0;                 // Face 2 right (outer cut)

      // =========================================================================
      // 1. FRONT PANEL (Face 1) - Body + Top/Bottom Flaps
      // =========================================================================
      const frontGroup = new THREE.Group();
      group.add(frontGroup);

      // --- Front Body Mesh (bounded by green curved crease lines) ---
      const fbGeo = new THREE.BufferGeometry();
      const fbPositions: number[] = [];
      const fbUVs: number[] = [];
      const fbIndices: number[] = [];

      for (let j = 0; j <= segsY; j++) {
        const vRatio = j / segsY; // 0 at bottom crease, 1 at top crease

        for (let i = 0; i <= segsX; i++) {
          const uRatio = i / segsX; // 0 at left edge, 1 at right edge
          const uNorm = -1 + 2 * uRatio; // -1 to +1

          const xBase = uNorm * (W / 2);
          const dyCrease = Math.sqrt(Math.max(0, R * R - xBase * xBase)) - (R - s);
          const yTopCrease = H / 2 - dyCrease;
          const yBotCrease = -H / 2 + dyCrease;

          const y2D = yBotCrease + vRatio * (yTopCrease - yBotCrease);
          const uTex = u0_p1 + uRatio * (u1_p1 - u0_p1);
          const vTex = (totalSvgH - (y2D + H / 2 + s)) / totalSvgH;

          // 3D position
          const xFlat = -W + uRatio * W;
          const xFolded = uNorm * (W / 2) * (1 - tBody * 0.08);
          const x = (1 - tBody) * xFlat + tBody * xFolded;

          const bulge = Math.sqrt(Math.max(0, 1 - uNorm * uNorm));
          const z = tBody * (D / 2) * bulge;

          fbPositions.push(x, y2D, z);
          fbUVs.push(uTex, vTex);
        }
      }

      for (let j = 0; j < segsY; j++) {
        for (let i = 0; i < segsX; i++) {
          const r1 = j * (segsX + 1);
          const r2 = (j + 1) * (segsX + 1);
          fbIndices.push(r1 + i, r2 + i, r1 + i + 1);
          fbIndices.push(r1 + i + 1, r2 + i, r2 + i + 1);
        }
      }

      fbGeo.setAttribute('position', new THREE.Float32BufferAttribute(fbPositions, 3));
      fbGeo.setAttribute('uv', new THREE.Float32BufferAttribute(fbUVs, 2));
      fbGeo.setIndex(fbIndices);
      fbGeo.computeVertexNormals();
      const fbMesh = new THREE.Mesh(fbGeo, material);
      frontGroup.add(fbMesh);

      // --- Front Top Flap (Flap 1 Top) ---
      const ftFlapGeo = new THREE.BufferGeometry();
      const ftPositions: number[] = [];
      const ftUVs: number[] = [];
      const ftIndices: number[] = [];

      for (let j = 0; j <= segsFlap; j++) {
        const lam = j / segsFlap;

        for (let i = 0; i <= segsX; i++) {
          const uRatio = i / segsX;
          const uNorm = -1 + 2 * uRatio;

          const xBase = uNorm * (W / 2);
          const dyCrease = Math.sqrt(Math.max(0, R * R - xBase * xBase)) - (R - s);
          const yTopCrease = H / 2 - dyCrease;
          const yTopCut = H / 2 + dyCrease;
          const flapH = yTopCut - yTopCrease;

          const y2D = yTopCrease + lam * flapH;
          const uTex = u0_p1 + uRatio * (u1_p1 - u0_p1);
          const vTex = (totalSvgH - (y2D + H / 2 + s)) / totalSvgH;

          const xFlat = -W + uRatio * W;
          const xFolded = uNorm * (W / 2) * (1 - tBody * 0.08);
          const x = (1 - tBody) * xFlat + tBody * xFolded;

          const bulge = Math.sqrt(Math.max(0, 1 - uNorm * uNorm));
          const zRimFront = tBody * (D / 2) * bulge;
          const zRimBack = -tBody * (D / 2) * bulge;

          const angle = tFlap1 * (Math.PI * 0.5);
          const yFold = yTopCrease + lam * flapH * Math.cos(angle) * (1 - tFlap1 * 0.4);
          const zFold = zRimFront - lam * (zRimFront - zRimBack) * Math.sin(angle);

          ftPositions.push(x, yFold, zFold);
          ftUVs.push(uTex, vTex);
        }
      }

      for (let j = 0; j < segsFlap; j++) {
        for (let i = 0; i < segsX; i++) {
          const r1 = j * (segsX + 1);
          const r2 = (j + 1) * (segsX + 1);
          ftIndices.push(r1 + i, r2 + i, r1 + i + 1);
          ftIndices.push(r1 + i + 1, r2 + i, r2 + i + 1);
        }
      }

      ftFlapGeo.setAttribute('position', new THREE.Float32BufferAttribute(ftPositions, 3));
      ftFlapGeo.setAttribute('uv', new THREE.Float32BufferAttribute(ftUVs, 2));
      ftFlapGeo.setIndex(ftIndices);
      ftFlapGeo.computeVertexNormals();
      const ftFlapMesh = new THREE.Mesh(ftFlapGeo, material);
      frontGroup.add(ftFlapMesh);

      // --- Front Bottom Flap (Flap 1 Bottom) ---
      const fbFlapGeo = new THREE.BufferGeometry();
      const fbpPositions: number[] = [];
      const fbpUVs: number[] = [];
      const fbpIndices: number[] = [];

      for (let j = 0; j <= segsFlap; j++) {
        const lam = j / segsFlap;

        for (let i = 0; i <= segsX; i++) {
          const uRatio = i / segsX;
          const uNorm = -1 + 2 * uRatio;

          const xBase = uNorm * (W / 2);
          const dyCrease = Math.sqrt(Math.max(0, R * R - xBase * xBase)) - (R - s);
          const yBotCrease = -H / 2 + dyCrease;
          const yBotCut = -H / 2 - dyCrease;
          const flapH = yBotCrease - yBotCut;

          const y2D = yBotCrease - lam * flapH;
          const uTex = u0_p1 + uRatio * (u1_p1 - u0_p1);
          const vTex = (totalSvgH - (y2D + H / 2 + s)) / totalSvgH;

          const xFlat = -W + uRatio * W;
          const xFolded = uNorm * (W / 2) * (1 - tBody * 0.08);
          const x = (1 - tBody) * xFlat + tBody * xFolded;

          const bulge = Math.sqrt(Math.max(0, 1 - uNorm * uNorm));
          const zRimFront = tBody * (D / 2) * bulge;
          const zRimBack = -tBody * (D / 2) * bulge;

          const angle = tFlap1 * (Math.PI * 0.5);
          const yFold = yBotCrease - lam * flapH * Math.cos(angle) * (1 - tFlap1 * 0.4);
          const zFold = zRimFront - lam * (zRimFront - zRimBack) * Math.sin(angle);

          fbpPositions.push(x, yFold, zFold);
          fbpUVs.push(uTex, vTex);
        }
      }

      for (let j = 0; j < segsFlap; j++) {
        for (let i = 0; i < segsX; i++) {
          const r1 = j * (segsX + 1);
          const r2 = (j + 1) * (segsX + 1);
          fbpIndices.push(r1 + i, r2 + i, r1 + i + 1);
          fbpIndices.push(r1 + i + 1, r2 + i, r2 + i + 1);
        }
      }

      fbFlapGeo.setAttribute('position', new THREE.Float32BufferAttribute(fbpPositions, 3));
      fbFlapGeo.setAttribute('uv', new THREE.Float32BufferAttribute(fbpUVs, 2));
      fbFlapGeo.setIndex(fbpIndices);
      fbFlapGeo.computeVertexNormals();
      const fbFlapMesh = new THREE.Mesh(fbFlapGeo, material);
      frontGroup.add(fbFlapMesh);

      // =========================================================================
      // 2. BACK PANEL (Face 2) - Body + Top/Bottom Flaps with Thumb Notch
      // =========================================================================
      const backGroup = new THREE.Group();
      group.add(backGroup);

      // --- Back Body Mesh ---
      const bbGeo = new THREE.BufferGeometry();
      const bbPositions: number[] = [];
      const bbUVs: number[] = [];
      const bbIndices: number[] = [];

      for (let j = 0; j <= segsY; j++) {
        const vRatio = j / segsY;

        for (let i = 0; i <= segsX; i++) {
          const uRatio = i / segsX;
          const uNorm = -1 + 2 * uRatio;

          const xBase = uNorm * (W / 2);
          const dyCrease = Math.sqrt(Math.max(0, R * R - xBase * xBase)) - (R - s);
          const yTopCrease = H / 2 - dyCrease;
          const yBotCrease = -H / 2 + dyCrease;

          const y2D = yBotCrease + vRatio * (yTopCrease - yBotCrease);
          const uTex = u0_p2 + uRatio * (u1_p2 - u0_p2);
          const vTex = (totalSvgH - (y2D + H / 2 + s)) / totalSvgH;

          const xFlat = uRatio * W;
          const xFolded = uNorm * (W / 2) * (1 - tBody * 0.08);
          const x = (1 - tBody) * xFlat + tBody * xFolded;

          const bulge = Math.sqrt(Math.max(0, 1 - uNorm * uNorm));
          const z = -tBody * (D / 2) * bulge;

          bbPositions.push(x, y2D, z);
          bbUVs.push(uTex, vTex);
        }
      }

      for (let j = 0; j < segsY; j++) {
        for (let i = 0; i < segsX; i++) {
          const r1 = j * (segsX + 1);
          const r2 = (j + 1) * (segsX + 1);
          bbIndices.push(r1 + i, r2 + i, r1 + i + 1);
          bbIndices.push(r1 + i + 1, r2 + i, r2 + i + 1);
        }
      }

      bbGeo.setAttribute('position', new THREE.Float32BufferAttribute(bbPositions, 3));
      bbGeo.setAttribute('uv', new THREE.Float32BufferAttribute(bbUVs, 2));
      bbGeo.setIndex(bbIndices);
      bbGeo.computeVertexNormals();
      const bbMesh = new THREE.Mesh(bbGeo, material);
      backGroup.add(bbMesh);

      // --- Back Top Flap (Flap 2 Top - with Thumb Notch) ---
      const btFlapGeo = new THREE.BufferGeometry();
      const btPositions: number[] = [];
      const btUVs: number[] = [];
      const btIndices: number[] = [];

      for (let j = 0; j <= segsFlap; j++) {
        const lam = j / segsFlap;

        for (let i = 0; i <= segsX; i++) {
          const uRatio = i / segsX;
          const uNorm = -1 + 2 * uRatio;

          const xBase = uNorm * (W / 2);
          const dyCrease = Math.sqrt(Math.max(0, R * R - xBase * xBase)) - (R - s);
          const yTopCrease = H / 2 - dyCrease;

          let notchIndent = 0;
          if (Math.abs(xBase) < rn) {
            notchIndent = Math.sqrt(Math.max(0, rn * rn - xBase * xBase));
          }
          const yTopCut = H / 2 + dyCrease - notchIndent;
          const flapH = Math.max(0.1, yTopCut - yTopCrease);

          const y2D = yTopCrease + lam * flapH;
          const uTex = u0_p2 + uRatio * (u1_p2 - u0_p2);
          const vTex = (totalSvgH - (y2D + H / 2 + s)) / totalSvgH;

          const xFlat = uRatio * W;
          const xFolded = uNorm * (W / 2) * (1 - tBody * 0.08);
          const x = (1 - tBody) * xFlat + tBody * xFolded;

          const bulge = Math.sqrt(Math.max(0, 1 - uNorm * uNorm));
          const zRimFront = tBody * (D / 2) * bulge;
          const zRimBack = -tBody * (D / 2) * bulge;

          const angle = tFlap2 * (Math.PI * 0.5);
          const yFold = yTopCrease + lam * flapH * Math.cos(angle) * (1 - tFlap2 * 0.4);
          const zFold = zRimBack + lam * (zRimFront - zRimBack) * Math.sin(angle);

          btPositions.push(x, yFold, zFold);
          btUVs.push(uTex, vTex);
        }
      }

      for (let j = 0; j < segsFlap; j++) {
        for (let i = 0; i < segsX; i++) {
          const r1 = j * (segsX + 1);
          const r2 = (j + 1) * (segsX + 1);
          btIndices.push(r1 + i, r2 + i, r1 + i + 1);
          btIndices.push(r1 + i + 1, r2 + i, r2 + i + 1);
        }
      }

      btFlapGeo.setAttribute('position', new THREE.Float32BufferAttribute(btPositions, 3));
      btFlapGeo.setAttribute('uv', new THREE.Float32BufferAttribute(btUVs, 2));
      btFlapGeo.setIndex(btIndices);
      btFlapGeo.computeVertexNormals();
      const btFlapMesh = new THREE.Mesh(btFlapGeo, material);
      backGroup.add(btFlapMesh);

      // --- Back Bottom Flap (Flap 2 Bottom - with Thumb Notch) ---
      const bbFlapGeo = new THREE.BufferGeometry();
      const bbpPositions: number[] = [];
      const bbpUVs: number[] = [];
      const bbpIndices: number[] = [];

      for (let j = 0; j <= segsFlap; j++) {
        const lam = j / segsFlap;

        for (let i = 0; i <= segsX; i++) {
          const uRatio = i / segsX;
          const uNorm = -1 + 2 * uRatio;

          const xBase = uNorm * (W / 2);
          const dyCrease = Math.sqrt(Math.max(0, R * R - xBase * xBase)) - (R - s);
          const yBotCrease = -H / 2 + dyCrease;

          let notchIndent = 0;
          if (Math.abs(xBase) < rn) {
            notchIndent = Math.sqrt(Math.max(0, rn * rn - xBase * xBase));
          }
          const yBotCut = -H / 2 - dyCrease + notchIndent;
          const flapH = Math.max(0.1, yBotCrease - yBotCut);

          const y2D = yBotCrease - lam * flapH;
          const uTex = u0_p2 + uRatio * (u1_p2 - u0_p2);
          const vTex = (totalSvgH - (y2D + H / 2 + s)) / totalSvgH;

          const xFlat = uRatio * W;
          const xFolded = uNorm * (W / 2) * (1 - tBody * 0.08);
          const x = (1 - tBody) * xFlat + tBody * xFolded;

          const bulge = Math.sqrt(Math.max(0, 1 - uNorm * uNorm));
          const zRimFront = tBody * (D / 2) * bulge;
          const zRimBack = -tBody * (D / 2) * bulge;

          const angle = tFlap2 * (Math.PI * 0.5);
          const yFold = yBotCrease - lam * flapH * Math.cos(angle) * (1 - tFlap2 * 0.4);
          const zFold = zRimBack + lam * (zRimFront - zRimBack) * Math.sin(angle);

          bbpPositions.push(x, yFold, zFold);
          bbpUVs.push(uTex, vTex);
        }
      }

      for (let j = 0; j < segsFlap; j++) {
        for (let i = 0; i < segsX; i++) {
          const r1 = j * (segsX + 1);
          const r2 = (j + 1) * (segsX + 1);
          bbpIndices.push(r1 + i, r2 + i, r1 + i + 1);
          bbpIndices.push(r1 + i + 1, r2 + i, r2 + i + 1);
        }
      }

      bbFlapGeo.setAttribute('position', new THREE.Float32BufferAttribute(bbpPositions, 3));
      bbFlapGeo.setAttribute('uv', new THREE.Float32BufferAttribute(bbpUVs, 2));
      bbFlapGeo.setIndex(bbpIndices);
      bbFlapGeo.computeVertexNormals();
      const bbFlapMesh = new THREE.Mesh(bbFlapGeo, material);
      backGroup.add(bbFlapMesh);

      // =========================================================================
      // 3. GLUE FLAP (Diagonal Chamfers + 180° Inward Fold to Adhere to Back Face)
      // =========================================================================
      const glueGeo = new THREE.BufferGeometry();
      const gluePositions: number[] = [];
      const glueUVs: number[] = [];
      const glueIndices: number[] = [];

      const angleGlue = tGlue * Math.PI;

      for (let j = 0; j <= segsY; j++) {
        const vRatio = j / segsY;

        for (let i = 0; i <= segsGlue; i++) {
          const lam = i / segsGlue;
          const uTex = u1_glue + lam * (u0_glue - u1_glue);

          const yTopChamfer = H / 2 - lam * Gf * 0.85;
          const yBotChamfer = -H / 2 + lam * Gf * 0.85;
          const y2D = yBotChamfer + vRatio * (yTopChamfer - yBotChamfer);
          const vTex = (totalSvgH - (y2D + H / 2 + s)) / totalSvgH;

          const xSeamFlat = -W;
          const xSeamFolded = -(W / 2) * (1 - tBody * 0.08);
          const xSeam = (1 - tBody) * xSeamFlat + tBody * xSeamFolded;

          const xFlat = -W - lam * Gf;

          const uNorm_back = -1 + 2 * ((lam * Gf) / W);
          const zBack = -tBody * (D / 2) * Math.sqrt(Math.max(0, 1 - uNorm_back * uNorm_back));

          const xTabFolded = xSeam + lam * Gf * ((1 - Math.cos(angleGlue)) / 2) * (1 - tBody * 0.08);
          const zTabFolded =
            -Math.sin(angleGlue) * lam * Gf * 0.5 + ((1 - Math.cos(angleGlue)) / 2) * (zBack - 0.6);

          const x = (1 - tBody) * xFlat + tBody * xTabFolded;
          const z = (1 - tBody) * 0.0 + tBody * zTabFolded;

          gluePositions.push(x, y2D, z);
          glueUVs.push(uTex, vTex);
        }
      }

      for (let j = 0; j < segsY; j++) {
        for (let i = 0; i < segsGlue; i++) {
          const r1 = j * (segsGlue + 1);
          const r2 = (j + 1) * (segsGlue + 1);
          glueIndices.push(r1 + i, r2 + i, r1 + i + 1);
          glueIndices.push(r1 + i + 1, r2 + i, r2 + i + 1);
        }
      }

      glueGeo.setAttribute('position', new THREE.Float32BufferAttribute(gluePositions, 3));
      glueGeo.setAttribute('uv', new THREE.Float32BufferAttribute(glueUVs, 2));
      glueGeo.setIndex(glueIndices);
      glueGeo.computeVertexNormals();
      const glueMesh = new THREE.Mesh(glueGeo, material);
      group.add(glueMesh);

      // Center the whole model in viewport
      const centerOffsetX = (1 - t) * (Gf / 2);
      group.position.set(centerOffsetX, 0, 0);

      return group;
    },
    [width, height, depth, glueFlap, cardboardColor, texture]
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
    camera.position.set(0, 30, 420);
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
    cameraRef.current.position.set(0, 30, 420);
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
