import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { RotateCcw, Pause, Play } from 'lucide-react';

interface F10_41_00_00Box3DPreviewProps {
  width: number;
  height: number;
  depth: number;
  glueFlap: number;
  hasWindow?: boolean;
  svgMarkup: string;
  svgWidth: number;
  svgHeight: number;
}

export default function F10_41_00_00Box3DPreview({
  width: W,
  height: H,
  depth: D,
  glueFlap: Gf,
  hasWindow = true,
  svgMarkup,
  svgWidth,
  svgHeight,
}: F10_41_00_00Box3DPreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number>(0);

  const [foldPercent, setFoldPercent] = useState(100);
  const [autoRotate, setAutoRotate] = useState(false);
  const [cardboardColor] = useState('#f8fafc');

  const modelGroupRef = useRef<THREE.Group | null>(null);

  // High-Resolution SVG Texture
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

  // Build 3D folding hierarchy
  const buildBoxMesh = useCallback((f: number) => {
    const group = new THREE.Group();
    const foldRad = (f / 100) * (Math.PI / 2);

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.45,
      metalness: 0.05,
      side: THREE.DoubleSide,
      map: texture || undefined,
    });

    const createPlane = (w: number, h: number, hole?: { w: number; h: number }) => {
      if (hole && hasWindow) {
        const shape = new THREE.Shape();
        shape.moveTo(-w / 2, -h / 2);
        shape.lineTo(w / 2, -h / 2);
        shape.lineTo(w / 2, h / 2);
        shape.lineTo(-w / 2, h / 2);
        shape.closePath();

        const holePath = new THREE.Path();
        const hw = hole.w / 2;
        const hh = hole.h / 2;
        holePath.moveTo(-hw, -hh);
        holePath.lineTo(hw, -hh);
        holePath.lineTo(hw, hh);
        holePath.lineTo(-hw, hh);
        holePath.closePath();
        shape.holes.push(holePath);

        return new THREE.ShapeGeometry(shape);
      }
      return new THREE.PlaneGeometry(w, h);
    };

    // 1. Back Panel (Anchor)
    const backPanel = new THREE.Mesh(createPlane(W, H), mat);
    group.add(backPanel);

    // Left Glue Flap on Back Panel
    const gluePivot = new THREE.Group();
    gluePivot.position.set(-W / 2, 0, 0);
    const glueMesh = new THREE.Mesh(createPlane(Gf, H), mat);
    glueMesh.position.set(-Gf / 2, 0, 0);
    gluePivot.add(glueMesh);
    gluePivot.rotation.y = foldRad;
    backPanel.add(gluePivot);

    // 2. Right Side 1 Panel (folds at x = W/2)
    const side1Pivot = new THREE.Group();
    side1Pivot.position.set(W / 2, 0, 0);
    const side1Mesh = new THREE.Mesh(createPlane(D, H), mat);
    side1Mesh.position.set(D / 2, 0, 0);
    side1Pivot.add(side1Mesh);
    side1Pivot.rotation.y = foldRad;
    backPanel.add(side1Pivot);

    // 3. Front Panel with Window (folds at x = D on side 1)
    const frontPivot = new THREE.Group();
    frontPivot.position.set(D, 0, 0);
    const frontMesh = new THREE.Mesh(createPlane(W, H, { w: Math.max(10, W - 30), h: Math.max(10, H - 20) }), mat);
    frontMesh.position.set(W / 2, 0, 0);
    frontPivot.add(frontMesh);
    frontPivot.rotation.y = foldRad;
    side1Pivot.add(frontPivot);

    // 4. Side 2 Panel (folds at x = W on front panel)
    const side2Pivot = new THREE.Group();
    side2Pivot.position.set(W, 0, 0);
    const side2Mesh = new THREE.Mesh(createPlane(D, H), mat);
    side2Mesh.position.set(D / 2, 0, 0);
    side2Pivot.add(side2Mesh);
    side2Pivot.rotation.y = foldRad;
    frontPivot.add(side2Pivot);

    // Top & Bottom Flaps
    const flapH = D * 0.675;
    
    // Top Flap on Back
    const topBackPivot = new THREE.Group();
    topBackPivot.position.set(0, H / 2, 0);
    const topBackMesh = new THREE.Mesh(createPlane(W, flapH), mat);
    topBackMesh.position.set(0, flapH / 2, 0);
    topBackPivot.add(topBackMesh);
    topBackPivot.rotation.x = -foldRad;
    backPanel.add(topBackPivot);

    // Bottom Flap on Back
    const botBackPivot = new THREE.Group();
    botBackPivot.position.set(0, -H / 2, 0);
    const botBackMesh = new THREE.Mesh(createPlane(W, flapH), mat);
    botBackMesh.position.set(0, -flapH / 2, 0);
    botBackPivot.add(botBackMesh);
    botBackPivot.rotation.x = foldRad;
    backPanel.add(botBackPivot);

    // Top Flap on Front
    const topFrontPivot = new THREE.Group();
    topFrontPivot.position.set(W / 2, H / 2, 0);
    const topFrontMesh = new THREE.Mesh(createPlane(W, flapH), mat);
    topFrontMesh.position.set(0, flapH / 2, 0);
    topFrontPivot.add(topFrontMesh);
    topFrontPivot.rotation.x = -foldRad;
    frontPivot.add(topFrontPivot);

    // Bottom Flap on Front
    const botFrontPivot = new THREE.Group();
    botFrontPivot.position.set(W / 2, -H / 2, 0);
    const botFrontMesh = new THREE.Mesh(createPlane(W, flapH), mat);
    botFrontMesh.position.set(0, -flapH / 2, 0);
    botFrontPivot.add(botFrontMesh);
    botFrontPivot.rotation.x = foldRad;
    frontPivot.add(botFrontPivot);

    return group;
  }, [W, H, D, Gf, hasWindow, texture]);

  // Setup Three.js Scene
  useEffect(() => {
    if (!mountRef.current) return;
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0xf8fafc);

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
    const maxDim = Math.max(W, H, D);
    camera.position.set(maxDim * 1.8, maxDim * 1.5, maxDim * 2.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight1.position.set(maxDim * 2, maxDim * 3, maxDim * 2);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight2.position.set(-maxDim * 2, -maxDim, -maxDim * 2);
    scene.add(dirLight2);

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      if (autoRotate && modelGroupRef.current) {
        modelGroupRef.current.rotation.y += 0.008;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [W, H, D, autoRotate]);

  // Update folding model when foldPercent changes
  useEffect(() => {
    if (!sceneRef.current) return;
    if (modelGroupRef.current) {
      sceneRef.current.remove(modelGroupRef.current);
    }
    const newModel = buildBoxMesh(foldPercent);
    modelGroupRef.current = newModel;
    sceneRef.current.add(newModel);
  }, [foldPercent, buildBoxMesh]);

  const resetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    const maxDim = Math.max(W, H, D);
    cameraRef.current.position.set(maxDim * 1.8, maxDim * 1.5, maxDim * 2.5);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
    if (modelGroupRef.current) {
      modelGroupRef.current.rotation.set(0, 0, 0);
    }
  };

  return (
    <div className="relative w-full h-full bg-slate-50 overflow-hidden rounded-xl">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Standardized 1-Row Ultra-Compact Bottom Control Bar */}
      <div className="absolute bottom-3 inset-x-3 z-10 flex items-center justify-between gap-3 bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-200/80 shadow-md">
        <div className="flex items-center gap-3 flex-1 max-w-sm">
          <span className="text-xs font-bold text-slate-700 whitespace-nowrap">نسبة الطي:</span>
          <Slider
            value={[foldPercent]}
            min={0}
            max={100}
            step={1}
            onValueChange={(val) => setFoldPercent(val[0])}
            className="flex-1"
          />
          <span className="text-xs font-mono font-bold text-blue-600 min-w-[3ch]">{foldPercent}%</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={foldPercent === 0 ? "default" : "outline"}
            className="h-7 text-xs px-2.5 rounded-lg font-bold"
            onClick={() => setFoldPercent(0)}
          >
            مفرود
          </Button>
          <Button
            size="sm"
            variant={foldPercent === 50 ? "default" : "outline"}
            className="h-7 text-xs px-2.5 rounded-lg font-bold"
            onClick={() => setFoldPercent(50)}
          >
            نصف طي
          </Button>
          <Button
            size="sm"
            variant={foldPercent === 100 ? "default" : "outline"}
            className="h-7 text-xs px-2.5 rounded-lg font-bold"
            onClick={() => setFoldPercent(100)}
          >
            مغلق
          </Button>
        </div>

        <div className="flex items-center gap-1.5 border-r pr-2 border-slate-200">
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7 rounded-lg"
            onClick={() => setAutoRotate(!autoRotate)}
            title={autoRotate ? "إيقاف التدوير" : "تدوير تلقائي"}
          >
            {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7 rounded-lg"
            onClick={resetCamera}
            title="إعادة ضبط الكاميرا"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
