import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { RotateCcw, Pause, Play } from 'lucide-react';
import { Label } from '@/components/ui/label';

export interface Panel2DInfo {
  x: number;
  y: number;
  w: number;
  h: number;
  polygon?: [number, number][];
}

interface MailerBox3DPreviewProps {
  svgMarkup: string;
  svgWidth: number;
  svgHeight: number;
  faceCoords: {
    bottom: Panel2DInfo;
    back: Panel2DInfo;
    front: Panel2DInfo;
    lid: Panel2DInfo;
    lidTuck: Panel2DInfo;
    leftWallOuter: Panel2DInfo;
    leftWallInner: Panel2DInfo;
    rightWallOuter: Panel2DInfo;
    rightWallInner: Panel2DInfo;
    frontDustLeft: Panel2DInfo;
    frontDustRight: Panel2DInfo;
    backDustLeft: Panel2DInfo;
    backDustRight: Panel2DInfo;
  };
}

function darkenHex(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent * 100);
  let R = (num >> 16) - amt;
  let G = ((num >> 8) & 0x00FF) - amt;
  let B = (num & 0x0000FF) - amt;
  R = R < 0 ? 0 : R > 255 ? 255 : R;
  G = G < 0 ? 0 : G > 255 ? 255 : G;
  B = B < 0 ? 0 : B > 255 ? 255 : B;
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

function buildCropTexture(
  svgMarkup: string,
  svgW: number,
  svgH: number,
  coord: Panel2DInfo,
  bgColor: string = '#faf5eb',
): THREE.CanvasTexture | null {
  if (!svgMarkup || coord.w <= 0 || coord.h <= 0) return null;
  const TEX_PPM = 3;
  const MAX_TEX = 2048;
  const rawCw = Math.round(coord.w * TEX_PPM);
  const rawCh = Math.round(coord.h * TEX_PPM);
  const texScale = Math.min(1, MAX_TEX / Math.max(rawCw, rawCh));
  const cw = Math.max(1, Math.round(rawCw * texScale));
  const ch = Math.max(1, Math.round(rawCh * texScale));
  if (cw < 1 || ch < 1) return null;

  const effPPM = TEX_PPM * texScale;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const grad = ctx.createLinearGradient(0, 0, cw, ch);
  grad.addColorStop(0, bgColor);
  grad.addColorStop(1, darkenHex(bgColor, 0.08));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const svgRenderW = svgW * effPPM;
  const svgRenderH = svgH * effPPM;
  const blob = new Blob([svgMarkup.replace(/<svg\b[^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" width="${svgRenderW}" height="${svgRenderH}">`)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, -coord.x * effPPM, -coord.y * effPPM, svgRenderW, svgRenderH);
    tex.needsUpdate = true;
    URL.revokeObjectURL(url);
  };
  img.src = url;
  return tex;
}

function createMesh(
  w: number,
  h: number,
  coord: Panel2DInfo,
  svgMarkup: string,
  svgW: number,
  svgH: number,
  pivotX: number,
  pivotY: number,
  doubleSided = true
) {
  const tex = buildCropTexture(svgMarkup, svgW, svgH, coord);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    roughness: 0.8,
    color: '#ffffff',
  });
  
  let geom: THREE.BufferGeometry;
  if (coord.polygon && coord.polygon.length > 2) {
    const shape = new THREE.Shape();
    shape.moveTo(coord.polygon[0][0] - coord.x, coord.h - (coord.polygon[0][1] - coord.y));
    for (let i = 1; i < coord.polygon.length; i++) {
      shape.lineTo(coord.polygon[i][0] - coord.x, coord.h - (coord.polygon[i][1] - coord.y));
    }
    shape.closePath();
    geom = new THREE.ShapeGeometry(shape);
    // Align center manually based on pivot
    geom.translate(-pivotX, -pivotY, 0);
  } else {
    geom = new THREE.PlaneGeometry(w, h);
    geom.translate(w / 2 - pivotX, h / 2 - pivotY, 0);
  }
  
  const mesh = new THREE.Mesh(geom, mat);
  return mesh;
}

const MailerBox3DPreview: React.FC<MailerBox3DPreviewProps> = ({
  svgMarkup, svgWidth, svgHeight, faceCoords
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [foldProgress, setFoldProgress] = useState(100);
  const [autoRotate, setAutoRotate] = useState(false);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const reqRef = useRef<number>(0);

  // Groups
  const nodes = useRef<Record<string, THREE.Group>>({});

  useEffect(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth;
    const h = 500;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    containerRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const S = 0.05; // Scaling factor
    const modelGrp = new THREE.Group();
    modelGrp.scale.set(S, S, S);
    scene.add(modelGrp);

    // Create geometries
    const buildNode = (name: string, p: Panel2DInfo, pX: number, pY: number) => {
      const g = new THREE.Group();
      g.add(createMesh(p.w, p.h, p, svgMarkup, svgWidth, svgHeight, pX, pY));
      nodes.current[name] = g;
      return g;
    };

    // 1. Bottom
    const bottom = buildNode('bottom', faceCoords.bottom, faceCoords.bottom.w / 2, faceCoords.bottom.h / 2);
    bottom.rotation.x = -Math.PI / 2; // Lay flat
    modelGrp.add(bottom);

    // 2. Back & its children
    const back = buildNode('back', faceCoords.back, faceCoords.back.w / 2, faceCoords.back.h); // Pivot at bottom edge
    back.position.set(0, faceCoords.bottom.h / 2, 0); // Position at top edge of bottom panel
    bottom.add(back);

    const lid = buildNode('lid', faceCoords.lid, faceCoords.lid.w / 2, faceCoords.lid.h);
    lid.position.set(0, faceCoords.back.h, 0);
    back.add(lid);

    const lidTuck = buildNode('lidTuck', faceCoords.lidTuck, faceCoords.lidTuck.w / 2, faceCoords.lidTuck.h);
    lidTuck.position.set(0, faceCoords.lid.h, 0);
    lid.add(lidTuck);

    const backDustL = buildNode('backDustL', faceCoords.backDustLeft, faceCoords.backDustLeft.w, faceCoords.backDustLeft.h / 2); // pivot right
    backDustL.position.set(-faceCoords.back.w / 2, faceCoords.back.h / 2, 0);
    back.add(backDustL);

    const backDustR = buildNode('backDustR', faceCoords.backDustRight, 0, faceCoords.backDustRight.h / 2); // pivot left
    backDustR.position.set(faceCoords.back.w / 2, faceCoords.back.h / 2, 0);
    back.add(backDustR);

    // 3. Front & its children
    const front = buildNode('front', faceCoords.front, faceCoords.front.w / 2, 0); // pivot top edge
    front.position.set(0, -faceCoords.bottom.h / 2, 0); // position at bottom edge of bottom panel
    bottom.add(front);

    const frontDustL = buildNode('frontDustL', faceCoords.frontDustLeft, faceCoords.frontDustLeft.w, faceCoords.frontDustLeft.h / 2);
    frontDustL.position.set(-faceCoords.front.w / 2, faceCoords.front.h / 2, 0);
    front.add(frontDustL);

    const frontDustR = buildNode('frontDustR', faceCoords.frontDustRight, 0, faceCoords.frontDustRight.h / 2);
    frontDustR.position.set(faceCoords.front.w / 2, faceCoords.front.h / 2, 0);
    front.add(frontDustR);

    // 4. Side Walls Outer
    const lwo = buildNode('leftWallOuter', faceCoords.leftWallOuter, faceCoords.leftWallOuter.w, faceCoords.leftWallOuter.h / 2);
    lwo.position.set(-faceCoords.bottom.w / 2, 0, 0);
    bottom.add(lwo);

    const lwi = buildNode('leftWallInner', faceCoords.leftWallInner, faceCoords.leftWallInner.w, faceCoords.leftWallInner.h / 2);
    lwi.position.set(-faceCoords.leftWallOuter.w, 0, 0);
    lwo.add(lwi);

    const rwo = buildNode('rightWallOuter', faceCoords.rightWallOuter, 0, faceCoords.rightWallOuter.h / 2);
    rwo.position.set(faceCoords.bottom.w / 2, 0, 0);
    bottom.add(rwo);

    const rwi = buildNode('rightWallInner', faceCoords.rightWallInner, 0, faceCoords.rightWallInner.h / 2);
    rwi.position.set(faceCoords.rightWallOuter.w, 0, 0);
    rwo.add(rwi);

    // Lighting
    const amb = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    const cam = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    cam.position.set(0, 15, 20);
    cameraRef.current = cam;

    const ctrl = new OrbitControls(cam, renderer.domElement);
    ctrl.enableDamping = true;
    controlsRef.current = ctrl;

    const animate = () => {
      reqRef.current = requestAnimationFrame(animate);
      ctrl.update();
      renderer.render(scene, cam);
    };
    animate();

    return () => {
      cancelAnimationFrame(reqRef.current);
      renderer.dispose();
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [faceCoords, svgMarkup]);

  // Update folds based on slider
  useEffect(() => {
    if (!nodes.current.back) return;
    const p = foldProgress / 100;

    // Mailer Box Folding Sequence
    // 1. Dust flaps fold in (Y axis)
    nodes.current.backDustL.rotation.y = p * (Math.PI / 2);
    nodes.current.backDustR.rotation.y = p * (-Math.PI / 2);
    nodes.current.frontDustL.rotation.y = p * (Math.PI / 2);
    nodes.current.frontDustR.rotation.y = p * (-Math.PI / 2);

    // 2. Back and Front fold up (X axis)
    nodes.current.back.rotation.x = p * (Math.PI / 2);
    nodes.current.front.rotation.x = p * (-Math.PI / 2);

    // 3. Side Walls Outer fold up (Y axis)
    nodes.current.leftWallOuter.rotation.y = p * (-Math.PI / 2);
    nodes.current.rightWallOuter.rotation.y = p * (Math.PI / 2);

    // 4. Side Walls Inner fold in (Y axis) - 180 deg
    nodes.current.leftWallInner.rotation.y = p * (-Math.PI);
    nodes.current.rightWallInner.rotation.y = p * (Math.PI);

    // 5. Lid folds over (X axis)
    nodes.current.lid.rotation.x = p * (Math.PI / 2);
    
    // 6. Lid Tuck folds in (X axis)
    nodes.current.lidTuck.rotation.x = p * (Math.PI / 2);

  }, [foldProgress]);

  // Auto rotate logic
  useEffect(() => {
    if (!autoRotate || !sceneRef.current) return;
    let req: number;
    const loop = () => {
      sceneRef.current!.rotation.y += 0.005;
      req = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(req);
  }, [autoRotate]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full h-[500px] bg-slate-50 border rounded-lg overflow-hidden" ref={containerRef} />
      
      <div className="flex items-center gap-4 bg-muted/30 p-3 rounded-lg border">
        <div className="flex-1 flex items-center gap-3">
          <Label className="text-sm font-medium shrink-0">الطي ({foldProgress}%)</Label>
          <Slider
            value={[foldProgress]}
            max={100} step={1}
            onValueChange={v => setFoldProgress(v[0])}
            className="cursor-pointer"
          />
        </div>
        
        <div className="flex items-center gap-2 border-r pr-4">
          <Button variant="outline" size="sm" onClick={() => setAutoRotate(!autoRotate)}>
            {autoRotate ? <Pause className="w-4 h-4 ml-1" /> : <Play className="w-4 h-4 ml-1" />}
            {autoRotate ? 'إيقاف الدوران' : 'دوران تلقائي'}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => {
            setFoldProgress(0);
            if (controlsRef.current) controlsRef.current.reset();
            if (sceneRef.current) sceneRef.current.rotation.y = 0;
          }}>
            <RotateCcw className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MailerBox3DPreview;
