import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  R = Math.max(0, Math.min(255, R));
  G = Math.max(0, Math.min(255, G));
  B = Math.max(0, Math.min(255, B));
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
  const cleanedSvg = svgMarkup.replace(/<svg([^>]*)>/i, (_, attrs) => {
    const stripped = attrs
      .replace(/\bwidth\s*=\s*"[^"]*"/gi, '')
      .replace(/\bheight\s*=\s*"[^"]*"/gi, '')
      .replace(/\bviewBox\s*=\s*"[^"]*"/gi, '')
      .replace(/\bstyle\s*=\s*"[^"]*"/gi, '');
    return `<svg${stripped} xmlns="http://www.w3.org/2000/svg" width="${svgRenderW}" height="${svgRenderH}" viewBox="0 0 ${svgW} ${svgH}">`;
  });

  const blob = new Blob([cleanedSvg], { type: 'image/svg+xml' });
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
  tex: THREE.CanvasTexture | null,
  pivotX: number,
  pivotY: number,
  innerColor: string = '#cfa87b'
) {
  let geo: THREE.BufferGeometry;
  if (coord.polygon && coord.polygon.length > 2) {
    const shape = new THREE.Shape();
    shape.moveTo(coord.polygon[0][0] - coord.x, coord.h - (coord.polygon[0][1] - coord.y));
    for (let i = 1; i < coord.polygon.length; i++) {
      shape.lineTo(coord.polygon[i][0] - coord.x, coord.h - (coord.polygon[i][1] - coord.y));
    }
    shape.closePath();
    geo = new THREE.ShapeGeometry(shape);
    geo.translate(-pivotX, -pivotY, 0);

    const pos = geo.attributes.position;
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
       const lx = pos.getX(i) + pivotX;
       const ly = pos.getY(i) + pivotY;
       uvs[i * 2] = lx / w;
       uvs[i * 2 + 1] = ly / h;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  } else {
    geo = new THREE.PlaneGeometry(w, h);
    geo.translate(w / 2 - pivotX, h / 2 - pivotY, 0);
  }

  const matOuter = new THREE.MeshStandardMaterial({
    map: tex,
    color: tex ? 0xffffff : 0xf5e9c8,
    roughness: 0.75,
    side: THREE.FrontSide,
  });
  const meshOuter = new THREE.Mesh(geo, matOuter);
  meshOuter.castShadow = true;
  meshOuter.receiveShadow = true;

  const matInner = new THREE.MeshStandardMaterial({
    color: new THREE.Color(innerColor),
    roughness: 0.85,
    side: THREE.BackSide,
  });
  const meshInner = new THREE.Mesh(geo, matInner);
  meshInner.castShadow = true;
  meshInner.receiveShadow = true;

  const group = new THREE.Group();
  group.add(meshOuter);
  group.add(meshInner);

  return group;
}

const MailerBox3DPreview: React.FC<MailerBox3DPreviewProps> = ({
  svgMarkup, svgWidth, svgHeight, faceCoords
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [foldProgress, setFoldProgress] = useState(50);
  const [autoRotate, setAutoRotate] = useState(true);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const reqRef = useRef<number>(0);

  const nodes = useRef<Record<string, THREE.Group>>({});

  const texList = useMemo(() => {
    return {
      bottom: buildCropTexture(svgMarkup, svgWidth, svgHeight, faceCoords.bottom, '#faf5eb'),
      back: buildCropTexture(svgMarkup, svgWidth, svgHeight, faceCoords.back, '#efe4c8'),
      front: buildCropTexture(svgMarkup, svgWidth, svgHeight, faceCoords.front, '#efe4c8'),
      lid: buildCropTexture(svgMarkup, svgWidth, svgHeight, faceCoords.lid, '#faf5eb'),
      lidTuck: buildCropTexture(svgMarkup, svgWidth, svgHeight, faceCoords.lidTuck, '#e8dcc0'),
      lwo: buildCropTexture(svgMarkup, svgWidth, svgHeight, faceCoords.leftWallOuter, '#f5ecd6'),
      lwi: buildCropTexture(svgMarkup, svgWidth, svgHeight, faceCoords.leftWallInner, '#e8dcc0'),
      rwo: buildCropTexture(svgMarkup, svgWidth, svgHeight, faceCoords.rightWallOuter, '#f5ecd6'),
      rwi: buildCropTexture(svgMarkup, svgWidth, svgHeight, faceCoords.rightWallInner, '#e8dcc0'),
      bdL: buildCropTexture(svgMarkup, svgWidth, svgHeight, faceCoords.backDustLeft, '#e8dcc0'),
      bdR: buildCropTexture(svgMarkup, svgWidth, svgHeight, faceCoords.backDustRight, '#e8dcc0'),
      fdL: buildCropTexture(svgMarkup, svgWidth, svgHeight, faceCoords.frontDustLeft, '#e8dcc0'),
      fdR: buildCropTexture(svgMarkup, svgWidth, svgHeight, faceCoords.frontDustRight, '#e8dcc0'),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgMarkup, svgWidth, svgHeight]);

  useEffect(() => {
    if (!mountRef.current) return;
    const w = mountRef.current.clientWidth;
    const h = 480;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.Fog(0x0f172a, 80, 200);
    sceneRef.current = scene;

    const grid = new THREE.GridHelper(80, 30, 0x1e293b, 0x1e293b);
    grid.position.y = -1;
    scene.add(grid);

    scene.add(new THREE.AmbientLight(0xfff4e0, 0.65));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(12, 18, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xb0c8ff, 0.35);
    fill.position.set(-10, -5, -8);
    scene.add(fill);
    const point = new THREE.PointLight(0x4060ff, 0.25, 80);
    point.position.set(0, 12, 22);
    scene.add(point);

    // Dynamic scale to fit viewport
    const TARGET = 12;
    const maxDim = Math.max(svgWidth, svgHeight);
    const S = Math.min(TARGET / Math.max(1, maxDim), 0.8);

    const modelGrp = new THREE.Group();
    modelGrp.scale.set(S, S, S);
    scene.add(modelGrp);

    // Create geometries
    const buildNode = (name: string, p: Panel2DInfo, pX: number, pY: number, tex: THREE.CanvasTexture | null) => {
      const g = new THREE.Group();
      g.add(createMesh(p.w, p.h, p, tex, pX, pY));
      nodes.current[name] = g;
      return g;
    };

    // 1. Bottom
    const bottom = buildNode('bottom', faceCoords.bottom, faceCoords.bottom.w / 2, faceCoords.bottom.h / 2, texList.bottom);
    // +Z is printed side. We want it OUTSIDE (facing DOWN when sitting on floor)
    bottom.rotation.x = Math.PI / 2;
    bottom.position.y = 1 / S; // slight lift above grid
    modelGrp.add(bottom);

    // 2. Back & its children
    const back = buildNode('back', faceCoords.back, faceCoords.back.w / 2, 0, texList.back); // Pivot at bottom edge
    back.position.set(0, faceCoords.bottom.h / 2, 0); // Position at top edge of bottom panel
    bottom.add(back);

    const lid = buildNode('lid', faceCoords.lid, faceCoords.lid.w / 2, 0, texList.lid); // Pivot at bottom edge
    lid.position.set(0, faceCoords.back.h, 0); // Position at top edge of back panel
    back.add(lid);

    const lidTuck = buildNode('lidTuck', faceCoords.lidTuck, faceCoords.lidTuck.w / 2, 0, texList.lidTuck); // Pivot at bottom edge
    lidTuck.position.set(0, faceCoords.lid.h, 0); // Position at top edge of lid panel
    lid.add(lidTuck);

    const backDustL = buildNode('backDustL', faceCoords.backDustLeft, faceCoords.backDustLeft.w, faceCoords.backDustLeft.h / 2, texList.bdL); // pivot right edge
    backDustL.position.set(-faceCoords.back.w / 2, faceCoords.back.h / 2, 0); // Position at left edge, centered vertically
    back.add(backDustL);

    const backDustR = buildNode('backDustR', faceCoords.backDustRight, 0, faceCoords.backDustRight.h / 2, texList.bdR); // pivot left edge
    backDustR.position.set(faceCoords.back.w / 2, faceCoords.back.h / 2, 0); // Position at right edge, centered vertically
    back.add(backDustR);

    // 3. Front & its children
    const front = buildNode('front', faceCoords.front, faceCoords.front.w / 2, faceCoords.front.h, texList.front); // pivot top edge
    front.position.set(0, -faceCoords.bottom.h / 2, 0); // position at bottom edge of bottom panel
    bottom.add(front);

    const frontDustL = buildNode('frontDustL', faceCoords.frontDustLeft, faceCoords.frontDustLeft.w, faceCoords.frontDustLeft.h / 2, texList.fdL); // pivot right edge
    frontDustL.position.set(-faceCoords.front.w / 2, -faceCoords.front.h / 2, 0); // Position at left edge, centered vertically in front's geometry
    front.add(frontDustL);

    const frontDustR = buildNode('frontDustR', faceCoords.frontDustRight, 0, faceCoords.frontDustRight.h / 2, texList.fdR); // pivot left edge
    frontDustR.position.set(faceCoords.front.w / 2, -faceCoords.front.h / 2, 0); // Position at right edge, centered vertically in front's geometry
    front.add(frontDustR);

    // 4. Side Walls Outer
    const lwo = buildNode('leftWallOuter', faceCoords.leftWallOuter, faceCoords.leftWallOuter.w, faceCoords.leftWallOuter.h / 2, texList.lwo); // pivot right edge
    lwo.position.set(-faceCoords.bottom.w / 2, 0, 0); // position at left edge of bottom panel
    bottom.add(lwo);

    const lwi = buildNode('leftWallInner', faceCoords.leftWallInner, faceCoords.leftWallInner.w, faceCoords.leftWallInner.h / 2, texList.lwi); // pivot right edge
    lwi.position.set(-faceCoords.leftWallOuter.w, 0, 0); // position at left edge of lwo
    lwo.add(lwi);

    const rwo = buildNode('rightWallOuter', faceCoords.rightWallOuter, 0, faceCoords.rightWallOuter.h / 2, texList.rwo); // pivot left edge
    rwo.position.set(faceCoords.bottom.w / 2, 0, 0); // position at right edge of bottom panel
    bottom.add(rwo);

    const rwi = buildNode('rightWallInner', faceCoords.rightWallInner, 0, faceCoords.rightWallInner.h / 2, texList.rwi); // pivot left edge
    rwi.position.set(faceCoords.rightWallOuter.w, 0, 0); // position at right edge of rwo
    rwo.add(rwi);

    const cam = new THREE.PerspectiveCamera(42, w / h, 0.1, 800);
    const dist = (maxDim * S) * 1.5;
    cam.position.set(dist * 0.5, dist * 0.7, dist);
    cam.lookAt(0, 0, 0);
    cameraRef.current = cam;

    const ctrl = new OrbitControls(cam, renderer.domElement);
    ctrl.enableDamping = true;
    ctrl.dampingFactor = 0.06;
    controlsRef.current = ctrl;

    const animate = () => {
      reqRef.current = requestAnimationFrame(animate);
      ctrl.update();
      renderer.render(scene, cam);
    };
    animate();

    const onResize = () => {
      if (!mountRef.current) return;
      const w2 = mountRef.current.clientWidth;
      const h2 = mountRef.current.clientHeight;
      renderer.setSize(w2, h2);
      cam.aspect = w2 / h2;
      cam.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(reqRef.current);
      renderer.dispose();
      Object.values(texList).forEach(t => t?.dispose());
      if (mountRef.current) mountRef.current.innerHTML = '';
    };
  }, [faceCoords, texList, svgWidth, svgHeight]);

  useEffect(() => {
    if (!nodes.current.back) return;
    const p = foldProgress / 100;
    
    // In bottom's local space: +Z points DOWN, +Y points INTO screen, +X is RIGHT.
    // To fold UP (-Z), we rotate AWAY from Z.

    // 1. Dust flaps fold in (Y axis)
    nodes.current.backDustL.rotation.y = p * (-Math.PI / 2);
    nodes.current.frontDustL.rotation.y = p * (-Math.PI / 2);
    nodes.current.backDustR.rotation.y = p * (Math.PI / 2);
    nodes.current.frontDustR.rotation.y = p * (Math.PI / 2);

    // 2. Back and Front fold up (X axis)
    // back is at +Y. Fold UP (-Z). Right hand X (+RIGHT): thumb -Z means negative X rot.
    nodes.current.back.rotation.x = p * (-Math.PI / 2);
    // front is at -Y. Fold UP (-Z). Positive X rot.
    nodes.current.front.rotation.x = p * (Math.PI / 2);

    // 3. Side Walls Outer fold up (Y axis)
    nodes.current.leftWallOuter.rotation.y = p * (-Math.PI / 2);
    nodes.current.rightWallOuter.rotation.y = p * (Math.PI / 2);

    // 4. Side Walls Inner fold in (Y axis) - 180 deg
    nodes.current.leftWallInner.rotation.y = p * (-Math.PI);
    nodes.current.rightWallInner.rotation.y = p * Math.PI;

    // 5. Lid folds over (X axis)
    // lid is at +Y of back. Fold OVER. Negative X rot.
    nodes.current.lid.rotation.x = p * (-Math.PI / 2);
    
    // 6. Lid Tuck folds in (X axis)
    nodes.current.lidTuck.rotation.x = p * (-Math.PI / 2);

  }, [foldProgress]);

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.autoRotate = autoRotate;
  }, [autoRotate]);

  const resetCamera = useCallback(() => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    const TARGET = 12;
    const S = Math.min(TARGET / Math.max(1, Math.max(svgWidth, svgHeight)), 0.8);
    const dist = (Math.max(svgWidth, svgHeight) * S) * 1.5;
    cam.position.set(dist * 0.5, dist * 0.7, dist);
    ctrl.target.set(0, 0, 0);
    ctrl.update();
  }, [svgWidth, svgHeight]);

  const foldLabel = foldProgress === 0 ? 'مفرود مسطح (2D)' : foldProgress === 100 ? 'علبة مغلقة بالكامل' : 'قيد الطي';

  return (
    <div className="space-y-3">
      <div
        ref={mountRef}
        className="relative w-full rounded-xl overflow-hidden border border-slate-800 select-none"
        style={{ height: 480, background: '#0f172a' }}
      >
        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          <span className="text-[10px] font-mono text-slate-400 bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
            🖱 اسحب للدوران • العجلة للتكبير
          </span>
        </div>

        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
            onClick={() => setAutoRotate(!autoRotate)}
          >
            {autoRotate ? <Pause className="w-3.5 h-3.5 ml-1" /> : <Play className="w-3.5 h-3.5 ml-1" />}
            {autoRotate ? 'إيقاف' : 'دوران تلقائي'}
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-7 w-7 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
            onClick={resetCamera}
            title="إعادة ضبط الكاميرا"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-lg p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-300">مستوى الطي</Label>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                {foldProgress}% — {foldLabel}
              </span>
            </div>
            <Slider
              value={[foldProgress]}
              max={100}
              step={1}
              onValueChange={v => setFoldProgress(v[0])}
              className="cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MailerBox3DPreview;

