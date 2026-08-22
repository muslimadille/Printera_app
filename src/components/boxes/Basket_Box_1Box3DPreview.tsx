import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { RotateCcw, Pause, Play } from 'lucide-react';

interface Props {
  width: number;        // L (mm)
  depth: number;        // W (mm)
  height: number;       // D (mm)
  handleNeckH: number;  // (mm)
  handleGripH: number;  // (mm)
}

export default function Basket_Box_1Box3DPreview({
  width: L,
  depth: W,
  height: D,
  handleNeckH,
  handleGripH,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [foldPercent, setFoldPercent] = useState<number>(100);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const boxRootRef = useRef<THREE.Group | null>(null);

  const wingW = W / 2;
  const handleW = Math.min(L - 20, 90);
  const handleH = 30;
  const handleR = 15;

  const handleResetCamera = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const maxDim = Math.max(L, W, D + handleNeckH + handleGripH, 100);
    cameraRef.current.position.set(maxDim * 1.6, maxDim * 1.4, maxDim * 2.0);
    cameraRef.current.lookAt(0, D * 0.5, 0);
    controlsRef.current.target.set(0, D * 0.5, 0);
    controlsRef.current.update();
  }, [L, W, D, handleNeckH, handleGripH]);

  const buildBox = useCallback(
    (t: number) => {
      const root = new THREE.Group();
      const foldRad = (t * Math.PI) / 2; // 0 to 90 degrees

      // Materials
      const matCardboard = new THREE.MeshPhysicalMaterial({
        color: 0xfcfbfa,
        roughness: 0.35,
        metalness: 0.02,
        clearcoat: 0.08,
        clearcoatRoughness: 0.2,
        side: THREE.DoubleSide,
        shadowSide: THREE.DoubleSide,
      });

      const matCrease = new THREE.LineBasicMaterial({ color: 0x00a651, linewidth: 1.5 });
      const matCut = new THREE.LineBasicMaterial({ color: 0xed1c24, linewidth: 1.8 });

      const createWireframe = (shape: THREE.Shape, mat: THREE.Material) => {
        const geom = new THREE.ShapeGeometry(shape);
        return new THREE.LineSegments(new THREE.EdgesGeometry(geom, 15), mat);
      };

      // ─────────────────────────────────────────────────────────────
      // 1. CENTRAL BASE FLOOR (In XZ plane at Y = 0)
      // ─────────────────────────────────────────────────────────────
      const baseShape = new THREE.Shape();
      baseShape.moveTo(-L / 2, -W / 2);
      baseShape.lineTo(L / 2, -W / 2);
      baseShape.lineTo(L / 2, W / 2);
      baseShape.lineTo(-L / 2, W / 2);
      baseShape.closePath();

      const baseMesh = new THREE.Mesh(new THREE.ShapeGeometry(baseShape), matCardboard);
      baseMesh.rotation.x = -Math.PI / 2;
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      baseMesh.add(createWireframe(baseShape, matCrease));
      root.add(baseMesh);

      // ─────────────────────────────────────────────────────────────
      // 2. FRONT WALL ASSEMBLY (Z = +W/2)
      // ─────────────────────────────────────────────────────────────
      const frontWallPivot = new THREE.Group();
      frontWallPivot.position.set(0, 0, W / 2);
      root.add(frontWallPivot);
      frontWallPivot.rotation.x = foldRad; // Folds UP

      // Front Wall Panel (Width L, Height D)
      const frontWallShape = new THREE.Shape();
      frontWallShape.moveTo(-L / 2, 0);
      frontWallShape.lineTo(L / 2, 0);
      frontWallShape.lineTo(L / 2, D);
      frontWallShape.lineTo(-L / 2, D);
      frontWallShape.closePath();

      const frontWallMesh = new THREE.Mesh(new THREE.ShapeGeometry(frontWallShape), matCardboard);
      frontWallMesh.castShadow = true;
      frontWallMesh.add(createWireframe(frontWallShape, matCrease));
      frontWallPivot.add(frontWallMesh);

      // Front-Left Corner Flap (Hinged to left of Front Wall at X = -L/2)
      const cornerFlapShape = new THREE.Shape();
      cornerFlapShape.moveTo(0, 0);
      cornerFlapShape.lineTo(D, 0);
      cornerFlapShape.lineTo(D, D);
      cornerFlapShape.lineTo(0, D);
      cornerFlapShape.closePath();

      const frontLeftCornerPivot = new THREE.Group();
      frontLeftCornerPivot.position.set(-L / 2, 0, 0);
      frontWallPivot.add(frontLeftCornerPivot);
      frontLeftCornerPivot.rotation.y = foldRad; // Folds backward along -Z

      const flMesh = new THREE.Mesh(new THREE.ShapeGeometry(cornerFlapShape), matCardboard);
      flMesh.scale.x = -1; // Extend to -X in flat state
      flMesh.castShadow = true;
      flMesh.add(createWireframe(cornerFlapShape, matCut));
      frontLeftCornerPivot.add(flMesh);

      // Front-Right Corner Flap (Hinged to right of Front Wall at X = +L/2)
      const frontRightCornerPivot = new THREE.Group();
      frontRightCornerPivot.position.set(L / 2, 0, 0);
      frontWallPivot.add(frontRightCornerPivot);
      frontRightCornerPivot.rotation.y = -foldRad; // Folds backward along -Z

      const frMesh = new THREE.Mesh(new THREE.ShapeGeometry(cornerFlapShape), matCardboard);
      frMesh.castShadow = true;
      frMesh.add(createWireframe(cornerFlapShape, matCut));
      frontRightCornerPivot.add(frMesh);

      // Front Handle Neck Panel (Attached to top of Front Wall at Y = D)
      const maxNeckAngle = Math.asin(Math.min(0.99, (W * 0.5) / Math.max(1, handleNeckH)));
      const neckAngle = maxNeckAngle * t;

      const frontNeckPivot = new THREE.Group();
      frontNeckPivot.position.set(0, D, 0);
      frontWallPivot.add(frontNeckPivot);
      frontNeckPivot.rotation.x = -neckAngle; // Tilts inward towards -Z

      const neckShape = new THREE.Shape();
      neckShape.moveTo(-L / 2 + 0.5, 0);
      neckShape.lineTo(L / 2 - 0.5, 0);
      neckShape.lineTo(L / 2 - 0.5, handleNeckH);
      neckShape.lineTo(-L / 2 + 0.5, handleNeckH);
      neckShape.closePath();

      const frontNeckMesh = new THREE.Mesh(new THREE.ShapeGeometry(neckShape), matCardboard);
      frontNeckMesh.castShadow = true;
      frontNeckMesh.add(createWireframe(neckShape, matCrease));
      frontNeckPivot.add(frontNeckMesh);

      // Front Handle Grip Panel (Attached to top of Neck at Y = handleNeckH)
      const frontGripPivot = new THREE.Group();
      frontGripPivot.position.set(0, handleNeckH, 0);
      frontNeckPivot.add(frontGripPivot);
      frontGripPivot.rotation.x = neckAngle; // Counter-rotates to stay upright

      const hookW = 20.0;
      const gripShape = new THREE.Shape();
      const xGripL = -L / 2 + 0.5;
      const xGripR = L / 2 - 0.5;

      gripShape.moveTo(xGripL, 0);
      gripShape.lineTo(xGripR, 0);
      gripShape.lineTo(xGripR, handleGripH);
      // Right Ear Hook Notch (Cubic Bezier curve from xGripR down and back to xGripR - hookW)
      gripShape.bezierCurveTo(xGripR, handleGripH + 3.57, xGripR - hookW + 18.09, handleGripH + 6.87, xGripR - hookW + 15.0, handleGripH + 8.66);
      gripShape.bezierCurveTo(xGripR - hookW + 11.91, handleGripH + 10.45, xGripR - hookW + 8.09, handleGripH + 10.45, xGripR - hookW + 5.0, handleGripH + 8.66);
      gripShape.bezierCurveTo(xGripR - hookW + 1.91, handleGripH + 6.87, xGripR - hookW, handleGripH + 3.57, xGripR - hookW, handleGripH);
      // Slope up to top flat edge
      gripShape.lineTo(xGripR - 25, handleGripH + 10);
      gripShape.lineTo(xGripL + 25, handleGripH + 10);
      gripShape.lineTo(xGripL + hookW, handleGripH);
      // Left Ear Hook Notch
      gripShape.bezierCurveTo(xGripL + hookW, handleGripH + 3.57, xGripL + 18.09, handleGripH + 6.87, xGripL + 15.0, handleGripH + 8.66);
      gripShape.bezierCurveTo(xGripL + 11.91, handleGripH + 10.45, xGripL + 8.09, handleGripH + 10.45, xGripL + 5.0, handleGripH + 8.66);
      gripShape.bezierCurveTo(xGripL + 1.91, handleGripH + 6.87, xGripL, handleGripH + 3.57, xGripL, handleGripH);
      gripShape.closePath();

      // Stadium handle cutout (85mm x 30mm, bottom at y=0 collinear with crease)
      const handleCutoutW = Math.min(L - 20, 85.0);
      const handleR = 15.0;
      const handleStraight = Math.max(10, handleCutoutW - 2 * handleR); // 55mm
      const handleHole = new THREE.Path();
      handleHole.moveTo(-handleStraight / 2, 0);
      handleHole.lineTo(handleStraight / 2, 0);
      handleHole.absarc(handleStraight / 2, handleR, handleR, -Math.PI / 2, Math.PI / 2, false);
      handleHole.lineTo(-handleStraight / 2, handleR * 2);
      handleHole.absarc(-handleStraight / 2, handleR, handleR, Math.PI / 2, (3 * Math.PI) / 2, false);
      handleHole.closePath();
      gripShape.holes.push(handleHole);

      const frontGripMesh = new THREE.Mesh(new THREE.ShapeGeometry(gripShape), matCardboard);
      frontGripMesh.castShadow = true;
      frontGripMesh.add(createWireframe(gripShape, matCut));
      frontGripPivot.add(frontGripMesh);

      // ─────────────────────────────────────────────────────────────
      // 3. BACK WALL ASSEMBLY (Z = -W/2)
      // ─────────────────────────────────────────────────────────────
      const backWallPivot = new THREE.Group();
      backWallPivot.position.set(0, 0, -W / 2);
      root.add(backWallPivot);
      backWallPivot.rotation.x = -foldRad; // Folds UP

      const backWallShape = new THREE.Shape();
      backWallShape.moveTo(-L / 2, 0);
      backWallShape.lineTo(L / 2, 0);
      backWallShape.lineTo(L / 2, D);
      backWallShape.lineTo(-L / 2, D);
      backWallShape.closePath();

      const backWallMesh = new THREE.Mesh(new THREE.ShapeGeometry(backWallShape), matCardboard);
      backWallMesh.castShadow = true;
      backWallMesh.add(createWireframe(backWallShape, matCrease));
      backWallPivot.add(backWallMesh);

      // Back-Left Corner Flap
      const backLeftCornerPivot = new THREE.Group();
      backLeftCornerPivot.position.set(-L / 2, 0, 0);
      backWallPivot.add(backLeftCornerPivot);
      backLeftCornerPivot.rotation.y = -foldRad; // Folds forward along +Z

      const blMesh = new THREE.Mesh(new THREE.ShapeGeometry(cornerFlapShape), matCardboard);
      blMesh.scale.x = -1;
      blMesh.castShadow = true;
      blMesh.add(createWireframe(cornerFlapShape, matCut));
      backLeftCornerPivot.add(blMesh);

      // Back-Right Corner Flap
      const backRightCornerPivot = new THREE.Group();
      backRightCornerPivot.position.set(L / 2, 0, 0);
      backWallPivot.add(backRightCornerPivot);
      backRightCornerPivot.rotation.y = foldRad; // Folds forward along +Z

      const brMesh = new THREE.Mesh(new THREE.ShapeGeometry(cornerFlapShape), matCardboard);
      brMesh.castShadow = true;
      brMesh.add(createWireframe(cornerFlapShape, matCut));
      backRightCornerPivot.add(brMesh);

      // Back Handle Neck Panel
      const backNeckPivot = new THREE.Group();
      backNeckPivot.position.set(0, D, 0);
      backWallPivot.add(backNeckPivot);
      backNeckPivot.rotation.x = neckAngle; // Tilts inward towards +Z

      const backNeckMesh = new THREE.Mesh(new THREE.ShapeGeometry(neckShape), matCardboard);
      backNeckMesh.castShadow = true;
      backNeckMesh.add(createWireframe(neckShape, matCrease));
      backNeckPivot.add(backNeckMesh);

      // Back Handle Grip Panel
      const backGripPivot = new THREE.Group();
      backGripPivot.position.set(0, handleNeckH, 0);
      backNeckPivot.add(backGripPivot);
      backGripPivot.rotation.x = -neckAngle; // Counter-rotates

      const backGripShape = gripShape.clone();
      const backGripMesh = new THREE.Mesh(new THREE.ShapeGeometry(backGripShape), matCardboard);
      backGripMesh.castShadow = true;
      backGripMesh.add(createWireframe(backGripShape, matCut));
      backGripPivot.add(backGripMesh);

      // ─────────────────────────────────────────────────────────────
      // 4. LEFT SIDE WALL ASSEMBLY (X = -L/2)
      // ─────────────────────────────────────────────────────────────
      const leftWallPivot = new THREE.Group();
      leftWallPivot.position.set(-L / 2, 0, 0);
      root.add(leftWallPivot);
      leftWallPivot.rotation.z = -foldRad; // Folds UP

      const leftWallShape = new THREE.Shape();
      leftWallShape.moveTo(0, -W / 2);
      leftWallShape.lineTo(0, W / 2);
      leftWallShape.lineTo(-D, W / 2);
      leftWallShape.lineTo(-D, -W / 2);
      leftWallShape.closePath();

      const leftWallMesh = new THREE.Mesh(new THREE.ShapeGeometry(leftWallShape), matCardboard);
      leftWallMesh.rotation.y = -Math.PI / 2;
      leftWallMesh.castShadow = true;
      leftWallMesh.add(createWireframe(leftWallShape, matCrease));
      leftWallPivot.add(leftWallMesh);

      // Left Curved Arch Flap
      const leftArchPivot = new THREE.Group();
      leftArchPivot.position.set(0, 0, 0);
      leftWallPivot.add(leftArchPivot);

      const leftArchShape = new THREE.Shape();
      leftArchShape.moveTo(-D, -W / 2);
      leftArchShape.bezierCurveTo(-D - wingW * 0.76, -W / 2, -D - wingW, -W * 0.28, -D - wingW, 0);
      leftArchShape.bezierCurveTo(-D - wingW, W * 0.28, -D - wingW * 0.76, W / 2, -D, W / 2);
      leftArchShape.closePath();

      const leftArchMesh = new THREE.Mesh(new THREE.ShapeGeometry(leftArchShape), matCardboard);
      leftArchMesh.rotation.y = -Math.PI / 2;
      leftArchMesh.castShadow = true;
      leftArchMesh.add(createWireframe(leftArchShape, matCut));
      leftArchPivot.add(leftArchMesh);

      // ─────────────────────────────────────────────────────────────
      // 5. RIGHT SIDE WALL ASSEMBLY (X = +L/2)
      // ─────────────────────────────────────────────────────────────
      const rightWallPivot = new THREE.Group();
      rightWallPivot.position.set(L / 2, 0, 0);
      root.add(rightWallPivot);
      rightWallPivot.rotation.z = foldRad; // Folds UP

      const rightWallShape = new THREE.Shape();
      rightWallShape.moveTo(0, -W / 2);
      rightWallShape.lineTo(0, W / 2);
      rightWallShape.lineTo(D, W / 2);
      rightWallShape.lineTo(D, -W / 2);
      rightWallShape.closePath();

      const rightWallMesh = new THREE.Mesh(new THREE.ShapeGeometry(rightWallShape), matCardboard);
      rightWallMesh.rotation.y = Math.PI / 2;
      rightWallMesh.castShadow = true;
      rightWallMesh.add(createWireframe(rightWallShape, matCrease));
      rightWallPivot.add(rightWallMesh);

      // Right Curved Arch Flap
      const rightArchShape = new THREE.Shape();
      rightArchShape.moveTo(D, -W / 2);
      rightArchShape.bezierCurveTo(D + wingW * 0.76, -W / 2, D + wingW, -W * 0.28, D + wingW, 0);
      rightArchShape.bezierCurveTo(D + wingW, W * 0.28, D + wingW * 0.76, W / 2, D, W / 2);
      rightArchShape.closePath();

      const rightArchMesh = new THREE.Mesh(new THREE.ShapeGeometry(rightArchShape), matCardboard);
      rightArchMesh.rotation.y = Math.PI / 2;
      rightArchMesh.castShadow = true;
      rightArchMesh.add(createWireframe(rightArchShape, matCut));
      rightWallPivot.add(rightArchMesh);

      return root;
    },
    [L, W, D, handleNeckH, handleGripH, wingW, handleW]
  );

  // Setup Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 2500;
    controls.minDistance = 30;
    controlsRef.current = controls;

    // Lighting
    const ambLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight1.position.set(200, 400, 300);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xfff5ea, 0.4);
    dirLight2.position.set(-200, 200, -200);
    scene.add(dirLight2);

    // Floor Shadow Plane
    const shadowGeo = new THREE.PlaneGeometry(1200, 1200);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.15 });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.1;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // Grid
    const grid = new THREE.GridHelper(1000, 50, 0xe2e8f0, 0xf1f5f9);
    grid.position.y = -0.2;
    scene.add(grid);

    handleResetCamera();

    let reqId: number;
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      if (controlsRef.current) {
        if (autoRotate) {
          controlsRef.current.autoRotate = true;
          controlsRef.current.autoRotateSpeed = 2.0;
        } else {
          controlsRef.current.autoRotate = false;
        }
        controlsRef.current.update();
      }
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current && rendererRef.current.domElement) {
        mountRef.current?.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, [handleResetCamera, autoRotate]);

  // Update box root on parameter or fold change
  useEffect(() => {
    if (!sceneRef.current) return;
    if (boxRootRef.current) {
      sceneRef.current.remove(boxRootRef.current);
    }
    const newBox = buildBox(foldPercent / 100);
    boxRootRef.current = newBox;
    sceneRef.current.add(newBox);
  }, [buildBox, foldPercent]);

  return (
    <div className="w-full h-full relative flex flex-col select-none">
      <div ref={mountRef} className="w-full flex-1 relative bg-slate-50" />

      {/* Floating 3D Controls Bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl rounded-2xl px-5 py-2.5 flex items-center gap-5 z-10 w-[92%] max-w-xl">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoRotate(!autoRotate)}
            className="h-8 px-2.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg gap-1.5"
          >
            {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{autoRotate ? 'إيقاف الدوران' : 'دوران تلقائي'}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetCamera}
            className="h-8 px-2 text-xs text-slate-700 hover:bg-slate-100 rounded-lg"
            title="إعادة ضبط الكاميرا"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="h-4 w-px bg-slate-200" />

        <div className="flex items-center gap-3 flex-1">
          <span className="text-xs font-bold text-slate-700 whitespace-nowrap">الطي:</span>
          <Slider
            value={[foldPercent]}
            min={0}
            max={100}
            step={1}
            onValueChange={vals => setFoldPercent(vals[0])}
            className="flex-1"
          />
          <span className="text-xs font-mono font-bold text-slate-800 w-10 text-left">
            {foldPercent}%
          </span>
        </div>
      </div>
    </div>
  );
}
