import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { RotateCcw, Pause, Play } from 'lucide-react';

interface Bag_B_1Box3DPreviewProps {
  width: number;
  height: number;
  depth: number;
  topHem: number;
  bottomFlap: number;
  glueFlap: number;
  svgMarkup?: string;
  svgWidth?: number;
  svgHeight?: number;
}

export default function Bag_B_1Box3DPreview({
  width: W,
  height: H,
  depth: D,
  topHem,
  bottomFlap,
  glueFlap,
}: Bag_B_1Box3DPreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [foldPercent, setFoldPercent] = useState(100);
  const [autoRotate, setAutoRotate] = useState(false);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const bagMeshGroupRef = useRef<THREE.Group | null>(null);

  const totalBottom = D / 2 + bottomFlap;

  // Reset Camera
  const resetCamera = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const maxDim = Math.max(W, H, D, 100);
    cameraRef.current.position.set(maxDim * 1.35, maxDim * 1.1, maxDim * 1.75);
    controlsRef.current.target.set(0, H * 0.45, 0);
    controlsRef.current.update();
  }, [W, H, D]);

  // Construct 3D Folding Geometry Procedurally
  const buildBagMesh = useCallback((t: number) => {
    const group = new THREE.Group();

    // ─────────────────────────────────────────────────────────────
    // Materials
    // ─────────────────────────────────────────────────────────────
    const matOuter = new THREE.MeshPhysicalMaterial({
      color: 0xe8d7b2, // Warm Kraft paper
      roughness: 0.82,
      metalness: 0.04,
      clearcoat: 0.06,
      clearcoatRoughness: 0.3,
      side: THREE.DoubleSide,
      shadowSide: THREE.DoubleSide,
    });

    const matInner = new THREE.MeshPhysicalMaterial({
      color: 0xddc79e, // Slightly darker kraft interior
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });

    const matFloor = new THREE.MeshPhysicalMaterial({
      color: 0xd8c297, // Solid bottom base
      roughness: 0.85,
      metalness: 0.03,
      side: THREE.DoubleSide,
    });

    const matCrease = new THREE.LineBasicMaterial({ color: 0x0a9748, linewidth: 1.5 }); // Green crease line
    const matCut = new THREE.LineBasicMaterial({ color: 0xe21f26, linewidth: 1.8 });    // Red cut line

    const matEyelet = new THREE.MeshStandardMaterial({
      color: 0xb89243, // Golden brass ring
      metalness: 0.85,
      roughness: 0.25,
      side: THREE.DoubleSide,
    });

    const matRope = new THREE.MeshStandardMaterial({
      color: 0xf5f0e6, // White woven cotton cord
      roughness: 0.95,
      metalness: 0.0,
    });

    // Helper to create a 3D Quad mesh from 4 vertices
    const addQuad = (
      p0: THREE.Vector3,
      p1: THREE.Vector3,
      p2: THREE.Vector3,
      p3: THREE.Vector3,
      mat: THREE.Material,
      withEdges = true,
      edgeMat = matCrease
    ) => {
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array([
        p0.x, p0.y, p0.z,
        p1.x, p1.y, p1.z,
        p2.x, p2.y, p2.z,
        p0.x, p0.y, p0.z,
        p2.x, p2.y, p2.z,
        p3.x, p3.y, p3.z,
      ]);
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      if (withEdges) {
        const edgeGeo = new THREE.BufferGeometry().setFromPoints([p0, p1, p2, p3, p0]);
        const wire = new THREE.Line(edgeGeo, edgeMat);
        group.add(wire);
      }
      return mesh;
    };

    // Helper to create a single line segment
    const addLine = (p0: THREE.Vector3, p1: THREE.Vector3, mat = matCrease) => {
      const edgeGeo = new THREE.BufferGeometry().setFromPoints([p0, p1]);
      const wire = new THREE.Line(edgeGeo, mat);
      group.add(wire);
    };

    // ─────────────────────────────────────────────────────────────
    // 1. KINEMATIC KEYPOINTS CALCULATION
    // ─────────────────────────────────────────────────────────────
    // Depth separation between front and back
    const curD = D * t;
    const halfD = curD / 2;

    // Inward Gusset Pinch (ثني منتصف الجوانب للداخل):
    // At t=0: flat (0). At t=1: folded inward by pinchDepth.
    const pinchDepth = (D * 0.25) * t;

    // 2D Flat X Offsets (at t = 0):
    // Glue flap: [-D/2 - Gf, -D/2]
    // Left gusset Part 1: [-D/2, 0]
    // Front Panel: [0, W] centered as [-W/2, W/2]
    // Right Gusset Part 1: [W/2, W/2 + D/2]
    // Right Gusset Part 2: [W/2 + D/2, W/2 + D]
    // Back Panel: [W/2 + D, 3W/2 + D]
    // Left Gusset Part 2: [3W/2 + D, 3W/2 + 1.5D]

    // 3D Corner Coordinates in XZ plane (at Y):
    // 1. Front-Left
    const ptFL = new THREE.Vector2(-W / 2, halfD);
    // 2. Front-Right
    const ptFR = new THREE.Vector2(W / 2, halfD);

    // 3. Right Gusset Center Crease (folds INWARD into the bag)
    const rightFlatX = W / 2 + D / 2;
    const rightClosedX = W / 2 - pinchDepth;
    const ptRC = new THREE.Vector2(
      rightFlatX * (1 - t) + rightClosedX * t,
      0 // Center crease at Z = 0
    );

    // 4. Back-Right
    const backRightFlatX = W / 2 + D;
    const backRightClosedX = W / 2;
    const ptBR = new THREE.Vector2(
      backRightFlatX * (1 - t) + backRightClosedX * t,
      -halfD
    );

    // 5. Back-Left
    const backLeftFlatX = W / 2 + D + W;
    const backLeftClosedX = -W / 2;
    const ptBL = new THREE.Vector2(
      backLeftFlatX * (1 - t) + backLeftClosedX * t,
      -halfD
    );

    // 6. Left Gusset Center Crease (folds INWARD into the bag)
    const leftFlatX = -W / 2 - D / 2;
    const leftClosedX = -W / 2 + pinchDepth;
    const ptLC = new THREE.Vector2(
      leftFlatX * (1 - t) + leftClosedX * t,
      0 // Center crease at Z = 0
    );

    // 7. Left Trailing Tab (Part B) from Back panel to Left Crease
    const leftPartBFlatX = backLeftFlatX + D / 2;
    const leftPartBClosedX = leftClosedX;
    const ptLB = new THREE.Vector2(
      leftPartBFlatX * (1 - t) + leftPartBClosedX * t,
      leftClosedX === 0 ? 0 : 0
    );

    // 8. Glue Flap Outer Edge
    const glueOuterFlatX = -W / 2 - D / 2 - glueFlap;
    const glueOuterClosedX = -W / 2 - (glueFlap * (1 - t));
    const ptGlue = new THREE.Vector2(
      glueOuterFlatX * (1 - t) + glueOuterClosedX * t,
      (halfD * 0.8) * t
    );

    // ─────────────────────────────────────────────────────────────
    // 2. MAIN BODY VERTICAL WALLS (Y = 0 to Y = H)
    // ─────────────────────────────────────────────────────────────
    // Helper to make 3D vector from (Vector2, Y)
    const v3 = (v2: THREE.Vector2, y: number) => new THREE.Vector3(v2.x, y, v2.y);

    // 1. Front Panel
    addQuad(v3(ptFL, 0), v3(ptFR, 0), v3(ptFR, H), v3(ptFL, H), matOuter);

    // 2. Right Gusset Part 1 (Front half)
    addQuad(v3(ptFR, 0), v3(ptRC, 0), v3(ptRC, H), v3(ptFR, H), matOuter);

    // 3. Right Gusset Part 2 (Back half)
    addQuad(v3(ptRC, 0), v3(ptBR, 0), v3(ptBR, H), v3(ptRC, H), matOuter);

    // 4. Back Panel
    addQuad(v3(ptBR, 0), v3(ptBL, 0), v3(ptBL, H), v3(ptBR, H), matOuter);

    // 5. Left Gusset Part 1 (Front half attached to Front Left)
    addQuad(v3(ptLC, 0), v3(ptFL, 0), v3(ptFL, H), v3(ptLC, H), matOuter);

    // 6. Left Gusset Part 2 (Back half attached to Back Left when flat, joins ptLC in 3D)
    if (t < 0.98) {
      addQuad(v3(ptBL, 0), v3(ptLB, 0), v3(ptLB, H), v3(ptBL, H), matOuter);
    } else {
      addQuad(v3(ptBL, 0), v3(ptLC, 0), v3(ptLC, H), v3(ptBL, H), matOuter);
    }

    // 7. Glue Flap (attached to Left Gusset Part 1)
    if (glueFlap > 0) {
      addQuad(v3(ptGlue, 0), v3(ptLC, 0), v3(ptLC, H), v3(ptGlue, H), matInner, true, matCut);
    }

    // ─────────────────────────────────────────────────────────────
    // 3. TOP HEMS (الطيات العلوية)
    // ─────────────────────────────────────────────────────────────
    // At t=0: extends upward from Y = H to Y = H + topHem.
    // At t=1: folds inward 180 degrees down inside the bag from Y = H to Y = H - topHem.
    const topHemAngle = t * Math.PI; // 0 to 180 deg
    const hemCos = Math.cos(topHemAngle);
    const hemSin = Math.sin(topHemAngle);

    const hemY = H + topHem * hemCos;
    const hemInwardZ = (topHem * hemSin) * (t > 0 ? 0.95 : 0);

    // Front Top Hem
    const hemFL = new THREE.Vector3(ptFL.x, hemY, ptFL.y - hemInwardZ);
    const hemFR = new THREE.Vector3(ptFR.x, hemY, ptFR.y - hemInwardZ);
    addQuad(v3(ptFL, H), v3(ptFR, H), hemFR, hemFL, matInner, true, matCut);

    // Back Top Hem
    const hemBR = new THREE.Vector3(ptBR.x, hemY, ptBR.y + hemInwardZ);
    const hemBL = new THREE.Vector3(ptBL.x, hemY, ptBL.y + hemInwardZ);
    addQuad(v3(ptBR, H), v3(ptBL, H), hemBL, hemBR, matInner, true, matCut);

    // Right Top Hems
    const hemRC = new THREE.Vector3(ptRC.x, hemY, ptRC.y);
    addQuad(v3(ptFR, H), v3(ptRC, H), hemRC, hemFR, matInner, true, matCut);
    addQuad(v3(ptRC, H), v3(ptBR, H), hemBR, hemRC, matInner, true, matCut);

    // Left Top Hems
    const hemLC = new THREE.Vector3(ptLC.x, hemY, ptLC.y);
    addQuad(v3(ptLC, H), v3(ptFL, H), hemFL, hemLC, matInner, true, matCut);
    if (t < 0.98) {
      const hemLB = new THREE.Vector3(ptLB.x, hemY, ptLB.y);
      addQuad(v3(ptBL, H), v3(ptLB, H), hemLB, hemBL, matInner, true, matCut);
    } else {
      addQuad(v3(ptBL, H), v3(ptLC, H), hemLC, hemBL, matInner, true, matCut);
    }

    // ─────────────────────────────────────────────────────────────
    // 4. BOTTOM CLOSURE & FLAPS (قاعدة الإغلاق السفلية)
    // ─────────────────────────────────────────────────────────────
    // At t=0: extends downward from Y = 0 to Y = -totalBottom.
    // At t=1: folds under the bag 90 degrees horizontally at Y = 0.
    const botFoldAngle = (t * Math.PI) / 2; // 0 to 90 deg
    const botCos = Math.cos(botFoldAngle);
    const botSin = Math.sin(botFoldAngle);

    const flapY = -totalBottom * botCos;
    const flapZFront = halfD - totalBottom * botSin;
    const flapZBack = -halfD + totalBottom * botSin;

    // Front Bottom Flap (folds under towards -Z)
    const bfFL = new THREE.Vector3(ptFL.x, flapY, flapZFront);
    const bfFR = new THREE.Vector3(ptFR.x, flapY, flapZFront);
    addQuad(v3(ptFL, 0), v3(ptFR, 0), bfFR, bfFL, matOuter, true, matCut);

    // Back Bottom Flap (folds under towards +Z)
    const bfBR = new THREE.Vector3(ptBR.x, flapY, flapZBack);
    const bfBL = new THREE.Vector3(ptBL.x, flapY, flapZBack);
    addQuad(v3(ptBR, 0), v3(ptBL, 0), bfBL, bfBR, matOuter, true, matCut);

    // Side Bottom Gussets
    if (t < 0.95) {
      const bfRC = new THREE.Vector3(ptRC.x, flapY, 0);
      addQuad(v3(ptFR, 0), v3(ptRC, 0), bfRC, bfFR, matOuter, true, matCut);
      addQuad(v3(ptRC, 0), v3(ptBR, 0), bfBR, bfRC, matOuter, true, matCut);

      const bfLC = new THREE.Vector3(ptLC.x, flapY, 0);
      addQuad(v3(ptLC, 0), v3(ptFL, 0), bfFL, bfLC, matOuter, true, matCut);
      const bfLB = new THREE.Vector3(ptLB.x, flapY, 0);
      addQuad(v3(ptBL, 0), v3(ptLB, 0), bfLB, bfBL, matOuter, true, matCut);
    }

    // ─────────────────────────────────────────────────────────────
    // 5. SOLID BASE FLOOR AT FULL CLOSURE (100% Sealed Bottom Floor)
    // ─────────────────────────────────────────────────────────────
    if (t > 0.3) {
      const floorOpacity = Math.min(1, (t - 0.3) / 0.5);
      const floorMat = matFloor.clone();
      floorMat.transparent = floorOpacity < 1;
      floorMat.opacity = floorOpacity;

      // Solid floor quad spanning [-W/2, W/2] and [-halfD, halfD]
      addQuad(
        new THREE.Vector3(-W / 2, 0.2, halfD),
        new THREE.Vector3(W / 2, 0.2, halfD),
        new THREE.Vector3(W / 2, 0.2, -halfD),
        new THREE.Vector3(-W / 2, 0.2, -halfD),
        floorMat,
        false
      );

      // Bottom Crease Outline
      addLine(new THREE.Vector3(-W / 2, 0.3, halfD), new THREE.Vector3(W / 2, 0.3, halfD), matCrease);
      addLine(new THREE.Vector3(W / 2, 0.3, halfD), new THREE.Vector3(W / 2, 0.3, -halfD), matCrease);
      addLine(new THREE.Vector3(W / 2, 0.3, -halfD), new THREE.Vector3(-W / 2, 0.3, -halfD), matCrease);
      addLine(new THREE.Vector3(-W / 2, 0.3, -halfD), new THREE.Vector3(-W / 2, 0.3, halfD), matCrease);
    }

    // ─────────────────────────────────────────────────────────────
    // 6. HANDLE HOLES & LUXURY COTTON ROPE HANDLES
    // ─────────────────────────────────────────────────────────────
    const holeRadius = Math.max(2.5, Math.min(6.5, (topHem / 76.7) * 5.0));
    const holeOffsetX = W / 4;
    const holeY = H - topHem / 2;

    const eyeletGeo = new THREE.RingGeometry(holeRadius * 0.85, holeRadius * 1.35, 24);

    // Front Eyelets
    const eyeletF1 = new THREE.Mesh(eyeletGeo, matEyelet);
    eyeletF1.position.set(-holeOffsetX, holeY, halfD + 0.3);
    group.add(eyeletF1);

    const eyeletF2 = new THREE.Mesh(eyeletGeo, matEyelet);
    eyeletF2.position.set(holeOffsetX, holeY, halfD + 0.3);
    group.add(eyeletF2);

    // Back Eyelets
    const eyeletB1 = new THREE.Mesh(eyeletGeo, matEyelet);
    eyeletB1.position.set(-holeOffsetX, holeY, -halfD - 0.3);
    group.add(eyeletB1);

    const eyeletB2 = new THREE.Mesh(eyeletGeo, matEyelet);
    eyeletB2.position.set(holeOffsetX, holeY, -halfD - 0.3);
    group.add(eyeletB2);

    if (t > 0.2) {
      // Helper to build handle rope curve between two hole points
      const createRopeHandle = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, outwardZ: number) => {
        const midX = (x1 + x2) / 2;
        const ropePeakY = Math.max(y1, y2) + Math.min(W * 0.45, H * 0.38);
        const ropePeakZ = ((z1 + z2) / 2) + outwardZ * Math.min(D * 0.45, 45);

        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(x1, y1, z1),
          new THREE.Vector3(x1 + (midX - x1) * 0.25, y1 + (ropePeakY - y1) * 0.7, z1 + outwardZ * 15),
          new THREE.Vector3(midX, ropePeakY, ropePeakZ),
          new THREE.Vector3(x2 + (midX - x2) * 0.25, y2 + (ropePeakY - y2) * 0.7, z2 + outwardZ * 15),
          new THREE.Vector3(x2, y2, z2),
        ]);

        const tubeGeo = new THREE.TubeGeometry(curve, 32, Math.max(2, holeRadius * 0.65), 10, false);
        const ropeMesh = new THREE.Mesh(tubeGeo, matRope);
        ropeMesh.castShadow = true;
        return ropeMesh;
      };

      // Front Rope Handle
      const frontRope = createRopeHandle(-holeOffsetX, holeY, halfD + 1, holeOffsetX, holeY, halfD + 1, 1);
      group.add(frontRope);

      // Back Rope Handle
      const backRope = createRopeHandle(-holeOffsetX, holeY, -halfD - 1, holeOffsetX, holeY, -halfD - 1, -1);
      group.add(backRope);
    }

    return group;
  }, [W, H, D, topHem, bottomFlap, glueFlap, totalBottom]);

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
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 10000);
    camera.position.set(maxDim * 1.35, maxDim * 1.1, maxDim * 1.75);
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
    controls.target.set(0, H * 0.45, 0);
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 2.0;
    controlsRef.current = controls;

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfffaed, 1.25);
    keyLight.position.set(maxDim * 1.8, maxDim * 2.5, maxDim * 2.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe8f0fe, 0.65);
    fillLight.position.set(-maxDim * 1.5, maxDim * 1.0, -maxDim * 1.5);
    scene.add(fillLight);

    const bottomLight = new THREE.DirectionalLight(0xffffff, 0.4);
    bottomLight.position.set(0, -maxDim * 1.5, maxDim * 0.5);
    scene.add(bottomLight);

    // Subtle Ground Shadow Plane
    const groundGeo = new THREE.PlaneGeometry(maxDim * 6, maxDim * 6);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.15 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);

    // Initial build
    const meshGroup = buildBagMesh(foldPercent / 100);
    bagMeshGroupRef.current = meshGroup;
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
  }, [W, H, D, topHem, bottomFlap, glueFlap, totalBottom, buildBagMesh]);

  // Update Box Geometry on Fold Percentage change
  useEffect(() => {
    if (!sceneRef.current) return;
    if (bagMeshGroupRef.current) {
      sceneRef.current.remove(bagMeshGroupRef.current);
    }
    const newMesh = buildBagMesh(foldPercent / 100);
    bagMeshGroupRef.current = newMesh;
    sceneRef.current.add(newMesh);
  }, [foldPercent, buildBagMesh]);

  // Update auto-rotate
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  const foldLabel = foldPercent === 0 ? 'مفرود بالكامل (2D)'
    : foldPercent === 100 ? 'كيس ورقي مجسم ومغلق بالكامل (3D)'
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
