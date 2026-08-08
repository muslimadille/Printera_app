// Three.js 3D Box Preview — مشابه لموقع EasyPackMaker
// يدعم: دوران تلقائي، OrbitControls، إضاءة احترافية، طي متحرك، texture من SVG

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { RotateCcw, Pause, Play } from 'lucide-react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export interface Panel2DInfo {
  x: number;
  y: number;
  w: number;
  h: number;
  polygon?: [number, number][];
  holes?: [number, number][][];
}

interface Box3DPreviewProps {
  boxType?: 'T0002' | 'T0005' | 'T0006' | 'D001' | 'T0008' | 'T0010' | 'A60_20_01_01';
  lidTongue?: number;
  panelWidths: [number, number, number, number];
  panelHeights: number;
  glueFlapWidth: number;
  topFlapHeights: [number, number, number, number];
  bottomFlapHeights: [number, number, number, number];
  svgMarkup: string;
  svgWidth: number;
  svgHeight: number;
  faceCoords: {
    body: [Panel2DInfo, Panel2DInfo, Panel2DInfo, Panel2DInfo];
    glue: Panel2DInfo;
    topFlaps: [Panel2DInfo, Panel2DInfo, Panel2DInfo, Panel2DInfo];
    bottomFlaps: [Panel2DInfo, Panel2DInfo, Panel2DInfo, Panel2DInfo];
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

// ─────────────────────────────────────────────
// تحويل منطقة SVG إلى Canvas Texture
// ─────────────────────────────────────────────
function drawCutAndCreaseLinesDirectly(
  ctx: CanvasRenderingContext2D,
  svgMarkup: string,
  coord: Panel2DInfo,
  effPPM: number
) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgMarkup, 'image/svg+xml');
    const elements = doc.querySelectorAll('line, path, polyline');

    ctx.save();
    ctx.translate(-coord.x * effPPM, -coord.y * effPPM);
    ctx.scale(effPPM, effPPM);

    elements.forEach(el => {
      const dataId = el.getAttribute('data-id') || '';
      const parentId = el.parentElement?.getAttribute('id') || '';
      const isCrease = parentId.includes('CREASE') || dataId.includes('CREASE');

      ctx.beginPath();
      if (isCrease) {
        ctx.strokeStyle = '#00A651'; // Green crease line
        ctx.lineWidth = 1.2;          // 1.2mm stroke width
        ctx.setLineDash([3.5, 2]);   // Dashed pattern
      } else {
        ctx.strokeStyle = '#ED1C24'; // Red cut line
        ctx.lineWidth = 1.4;          // 1.4mm stroke width
        ctx.setLineDash([]);         // Solid line
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (el.tagName === 'line') {
        const x1 = parseFloat(el.getAttribute('x1') || '0');
        const y1 = parseFloat(el.getAttribute('y1') || '0');
        const x2 = parseFloat(el.getAttribute('x2') || '0');
        const y2 = parseFloat(el.getAttribute('y2') || '0');
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      } else if (el.tagName === 'polyline') {
        const ptsStr = el.getAttribute('points');
        if (ptsStr) {
          const pairs = ptsStr.trim().split(/\s+/);
          pairs.forEach((p, idx) => {
            const [x, y] = p.split(',').map(Number);
            if (Number.isFinite(x) && Number.isFinite(y)) {
              if (idx === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
          });
          ctx.stroke();
        }
      } else if (el.tagName === 'path') {
        const d = el.getAttribute('d');
        if (d) {
          ctx.stroke(new Path2D(d));
        }
      }
    });

    ctx.restore();
  } catch (e) {
    console.error('Direct canvas line rendering error:', e);
  }
}

// ─────────────────────────────────────────────
// تحويل منطقة SVG إلى Canvas Texture
// ─────────────────────────────────────────────
function buildCropTexture(
  svgMarkup: string,
  svgW: number,
  svgH: number,
  coord: Panel2DInfo,
  _S: number,            // kept for API compat; no longer used for texture sizing
  bgColor: string = '#faf5eb',
): THREE.CanvasTexture | null {
  if (!svgMarkup || coord.w <= 0 || coord.h <= 0) return null;

  // Use a fixed pixels-per-mm ratio for texture resolution.
  const TEX_PPM = 3.5;
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

  // تدرج لوني واقعي للكرتون
  const grad = ctx.createLinearGradient(0, 0, cw, ch);
  grad.addColorStop(0, bgColor);
  grad.addColorStop(1, darkenHex(bgColor, 0.08));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);

  // رسم خطوط القص (أحمر) والطي (أخضر) مباشرة بشكل فوري ومتزامن
  drawCutAndCreaseLinesDirectly(ctx, svgMarkup, coord, effPPM);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  return tex;
}

// ─────────────────────────────────────────────
// بناء Panel mesh مع material
// ─────────────────────────────────────────────
function buildPanel(
  w: number,
  h: number,
  tex: THREE.Texture | null,
  coord?: Panel2DInfo,
  S: number = 1,
  innerColor: string = '#cfa87b' // Kraft cardboard brown color
): THREE.Object3D {
  let geo: THREE.BufferGeometry;
  
  if (coord && coord.polygon && coord.polygon.length > 0) {
    const shape = new THREE.Shape();
    coord.polygon.forEach((pt, i) => {
      const lx = (pt[0] - coord.x - coord.w / 2) * S;
      const ly = -(pt[1] - coord.y - coord.h / 2) * S;
      if (i === 0) shape.moveTo(lx, ly);
      else shape.lineTo(lx, ly);
    });
    
    if (coord.holes && coord.holes.length > 0) {
      coord.holes.forEach(holePoly => {
        const path = new THREE.Path();
        holePoly.forEach((pt, idx) => {
          const lx = (pt[0] - coord.x - coord.w / 2) * S;
          const ly = -(pt[1] - coord.y - coord.h / 2) * S;
          if (idx === 0) path.moveTo(lx, ly);
          else path.lineTo(lx, ly);
        });
        shape.holes.push(path);
      });
    }
    
    geo = new THREE.ShapeGeometry(shape);
    
    // Calculate UVs to match exactly how PlaneGeometry does it, so texture aligns
    const pos = geo.attributes.position;
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
       const lx = pos.getX(i);
       const ly = pos.getY(i);
       uvs[i * 2] = (lx / w) + 0.5;
       uvs[i * 2 + 1] = (ly / h) + 0.5;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  } else {
    geo = new THREE.PlaneGeometry(w, h);
  }

  // Outer material (displays the printed SVG texture or a default outer color)
  const matOuter = new THREE.MeshStandardMaterial({
    map: tex,
    color: tex ? 0xffffff : 0xf5e9c8,
    roughness: 0.75,
    metalness: 0.0,
    side: THREE.FrontSide, // Front side only!
  });
  const meshOuter = new THREE.Mesh(geo, matOuter);
  meshOuter.castShadow = true;
  meshOuter.receiveShadow = true;

  // Inner material (solid kraft brown or distinct color)
  const matInner = new THREE.MeshStandardMaterial({
    color: new THREE.Color(innerColor),
    roughness: 0.85,
    metalness: 0.0,
    side: THREE.BackSide, // Back side only!
  });
  const meshInner = new THREE.Mesh(geo, matInner);
  meshInner.castShadow = true;
  meshInner.receiveShadow = true;

  const group = new THREE.Group();
  group.add(meshOuter);
  group.add(meshInner);

  return group;
}

// ─────────────────────────────────────────────
// بناء Glue Flap بشكل متوازي أضلاع (15° bevel)
// المحور عند x=0 (حافة اللصق مع اللوح الأول)
// اللوح يمتد من x=0 إلى x=-gf
// ─────────────────────────────────────────────
function buildGlueFlap(gf: number, ph: number, tex: THREE.Texture | null, innerColor: string = '#cfa87b'): THREE.Object3D {
  // زاوية الإمالة: tan(15°) ≈ 0.2679
  const bevel = gf * 0.2679;

  // رسم الشكل: محاذاة مع مستوى XY (نفس PlaneGeometry)
  // الحافة اليمنى (x=0) = خط الطي مع اللوح
  // الحافة اليسرى (x=-gf) = حافة القص الحرة
  const shape = new THREE.Shape();
  shape.moveTo(0,    ph / 2);           // أعلى اليمين (خط الطي)
  shape.lineTo(-gf,  ph / 2 - bevel);   // أعلى اليسار (حافة القص المشطورة)
  shape.lineTo(-gf, -ph / 2 + bevel);   // أسفل اليسار (حافة القص المشطورة)
  shape.lineTo(0,   -ph / 2);           // أسفل اليمين (خط الطي)
  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape);

  const matOuter = new THREE.MeshStandardMaterial({
    map: tex,
    color: tex ? 0xffffff : 0xf5e9c8,
    roughness: 0.75,
    metalness: 0.0,
    side: THREE.FrontSide,
  });
  const meshOuter = new THREE.Mesh(geo, matOuter);
  meshOuter.castShadow = true;
  meshOuter.receiveShadow = true;

  const matInner = new THREE.MeshStandardMaterial({
    color: new THREE.Color(innerColor),
    roughness: 0.85,
    metalness: 0.0,
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

// guard: تجاهل الرفارف ذات الارتفاع الصفري أو السالب
function hasHeight(h: number): boolean {
  return h > 0.001;
}

// ─────────────────────────────────────────────
// المكوّن الرئيسي
// ─────────────────────────────────────────────
const Box3DPreview: React.FC<Box3DPreviewProps> = ({
  boxType,
  lidTongue,
  panelWidths,
  panelHeights,
  glueFlapWidth,
  topFlapHeights,
  bottomFlapHeights,
  svgMarkup,
  svgWidth,
  svgHeight,
  faceCoords,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rafRef = useRef<number>(0);
  const pivotRefs = useRef<{
    p1: THREE.Group;  // pivot for panel1 (rotates Y around right edge)
    p3: THREE.Group;  // pivot for panel3 (rotates Y around left edge)
    p4: THREE.Group;  // pivot for panel4 (rotates Y around left edge of p3)
    gluePivot: THREE.Group;
    tf1: THREE.Group; tf2: THREE.Group; tf3: THREE.Group; tf4: THREE.Group;
    bf1: THREE.Group; bf2: THREE.Group; bf3: THREE.Group; bf4: THREE.Group;
    tf3Tongue?: THREE.Group;
    bf1Tongue?: THREE.Group;
    tf3LeftEar?: THREE.Group;
    tf3RightEar?: THREE.Group;
  } | null>(null);

  const [foldPercent, setFoldPercent] = useState(50);
  const [autoRotate, setAutoRotate] = useState(true);

  // حساب scale بحيث يتناسب النموذج مع نافذة العرض
  // نستهدف أن يشغل النموذج المبسوط نحو 80% من أصغر بُعد في الـ viewport
  const S = useMemo(() => {
    const totalW = panelWidths.reduce((a, b) => a + b, 0) + glueFlapWidth;
    const totalH = panelHeights + Math.max(...topFlapHeights) + Math.max(...bottomFlapHeights);
    // القيمة المستهدفة بـ Three.js units: لا تتجاوز 12 وحدة في أكبر بُعد
    const TARGET = 12;
    return Math.min(TARGET / Math.max(1, totalW, totalH), 0.8);
  }, [panelWidths, panelHeights, glueFlapWidth, topFlapHeights, bottomFlapHeights]);

  const pw = panelWidths.map(v => v * S) as [number, number, number, number];
  const ph = panelHeights * S;
  const gf = glueFlapWidth * S;
  const tf = topFlapHeights.map(v => v * S);
  const bf = bottomFlapHeights.map(v => v * S);

  // textures مستقرة
  const texList = useMemo(() => {
    if (!svgMarkup) return null;
    return {
      body: faceCoords.body.map((c, idx) => {
        // Alternate face colors: front/back lighter, sides darker for depth perception
        const bgPalette = ['#faf5eb', '#efe4c8', '#f5ecd6', '#efe4c8'];
        return buildCropTexture(svgMarkup, svgWidth, svgHeight, c, S, bgPalette[idx]);
      }),
      glue: buildCropTexture(svgMarkup, svgWidth, svgHeight, faceCoords.glue, S, '#e0d4b0'),
      top: faceCoords.topFlaps.map(c => buildCropTexture(svgMarkup, svgWidth, svgHeight, c, S, '#e8dcc0')),
      bot: faceCoords.bottomFlaps.map(c => buildCropTexture(svgMarkup, svgWidth, svgHeight, c, S, '#e8dcc0')),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgMarkup, svgWidth, svgHeight, S]);

  // ── إنشاء Three.js Scene ──
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Scene & Background ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    scene.fog = new THREE.Fog(0xffffff, 80, 250);

    // ── Grid ──
    const grid = new THREE.GridHelper(100, 40, 0xe2e8f0, 0xf1f5f9);
    grid.position.y = -(ph / 2 + Math.max(...bf) + 3);
    scene.add(grid);

    // ── Lighting ──
    scene.add(new THREE.AmbientLight(0xfff4e0, 0.65));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(12, 18, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 100;
    const d = 15;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xb0c8ff, 0.35);
    fill.position.set(-10, -5, -8);
    scene.add(fill);
    const point = new THREE.PointLight(0x4060ff, 0.25, 80);
    point.position.set(0, 12, 22);
    scene.add(point);

    // ── Camera — تحسب المسافة تلقائياً لتناسب حجم النموذج ──
    const W = mount.clientWidth;
    const H = mount.clientHeight;
    const cam = new THREE.PerspectiveCamera(42, W / H, 0.1, 800);
    // boxSpan = أكبر بُعد أفقي للنموذج المبسوط
    const boxSpan = pw[0] + pw[1] + pw[2] + pw[3] + gf;
    const boxH = ph + Math.max(...tf) + Math.max(...bf);
    const maxDim = Math.max(boxSpan, boxH);
    // مسافة الكاميرا = maxDim / tan(FOV/2) + هامش 30%
    const fovRad = (42 * Math.PI) / 180;
    const dist = (maxDim / 2 / Math.tan(fovRad / 2)) * 1.6;
    cam.position.set(pw[1] * 0.6, ph * 0.4, dist);
    cam.lookAt(0, 0, 0);
    cameraRef.current = cam;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    // ── OrbitControls ──
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.5;
    controls.minDistance = 4;
    controls.maxDistance = 120;
    controlsRef.current = controls;

    //  ══════════════════════════════════════════
    //  بناء هيكل العلبة
    //  Panel 2 ثابت في المركز على Z=0
    //  Panel 1 يُطوى إلى اليسار (Y-)
    //  Panel 3 يُطوى إلى اليمين (Y+)
    //  Panel 4 يُطوى بعد Panel 3
    //  ══════════════════════════════════════════

    let texTf1Cover: THREE.CanvasTexture | null = null;
    let texTf1Tongue: THREE.CanvasTexture | null = null;
    let texTf3Cover: THREE.CanvasTexture | null = null;
    let texTf3Tongue: THREE.CanvasTexture | null = null;
    let texBf1Cover: THREE.CanvasTexture | null = null;
    let texBf1Tongue: THREE.CanvasTexture | null = null;

    const splitTf1 = boxType === 'A60_20_01_01' && !!(lidTongue && lidTongue > 0 && tf[0] > lidTongue * S + 0.001);
    const splitTf3 = boxType !== 'A60_20_01_01' && boxType !== 'T0005' && boxType !== 'T0006' && !!(lidTongue && lidTongue > 0 && tf[2] > lidTongue * S + 0.001);
    const splitBf1 = boxType !== 'A60_20_01_01' && boxType !== 'T0005' && boxType !== 'T0006' && !!(lidTongue && lidTongue > 0 && bf[0] > lidTongue * S + 0.001);

    if (splitTf1) {
      const tf1Coord = faceCoords.topFlaps[0];
      const lidS = (lidTongue as number);
      const coordTf1Cover = {
        x: tf1Coord.x,
        y: tf1Coord.y + lidS,
        w: tf1Coord.w,
        h: tf1Coord.h - lidS,
      };
      const coordTf1Tongue = {
        x: tf1Coord.x,
        y: tf1Coord.y,
        w: tf1Coord.w,
        h: lidS,
        polygon: tf1Coord.polygon,
      };

      texTf1Cover = buildCropTexture(svgMarkup, svgWidth, svgHeight, coordTf1Cover, S, '#e8dcc0');
      texTf1Tongue = buildCropTexture(svgMarkup, svgWidth, svgHeight, coordTf1Tongue, S, '#e8dcc0');
    }

    if (splitTf3) {
      // Top Cover & Tongue
      const tf3Coord = faceCoords.topFlaps[2];
      const coordTf3Cover = {
        x: tf3Coord.x,
        y: lidTongue,
        w: tf3Coord.w,
        h: tf3Coord.h - lidTongue,
      };
      const coordTf3Tongue = {
        x: tf3Coord.x,
        y: 0,
        w: tf3Coord.w,
        h: lidTongue,
        polygon: tf3Coord.polygon,
      };

      texTf3Cover = buildCropTexture(svgMarkup, svgWidth, svgHeight, coordTf3Cover, S, '#e8dcc0');
      texTf3Tongue = buildCropTexture(svgMarkup, svgWidth, svgHeight, coordTf3Tongue, S, '#e8dcc0');
    }

    if (splitBf1) {
      // Bottom Cover & Tongue
      const bf1Coord = faceCoords.bottomFlaps[0];
      const coordBf1Cover = {
        x: bf1Coord.x,
        y: bf1Coord.y,
        w: bf1Coord.w,
        h: bf1Coord.h - lidTongue,
      };
      const coordBf1Tongue = {
        x: bf1Coord.x,
        y: bf1Coord.y + (bf1Coord.h - lidTongue),
        w: bf1Coord.w,
        h: lidTongue,
        polygon: bf1Coord.polygon,
      };

      texBf1Cover = buildCropTexture(svgMarkup, svgWidth, svgHeight, coordBf1Cover, S, '#e8dcc0');
      texBf1Tongue = buildCropTexture(svgMarkup, svgWidth, svgHeight, coordBf1Tongue, S, '#e8dcc0');
    }

    // ── Panel 2 (ثابت) ──
    const p2 = buildPanel(pw[1], ph, texList?.body[1] ?? null, faceCoords.body[1], S);
    scene.add(p2);

    // ── Panel 2 Flaps ──
    const tf2Pivot = new THREE.Group();
    tf2Pivot.position.y = ph / 2;
    scene.add(tf2Pivot);
    if (hasHeight(tf[1])) {
      const tf2Mesh = buildPanel(pw[1], tf[1], texList?.top[1] ?? null, faceCoords.topFlaps[1], S);
      tf2Mesh.position.y = tf[1] / 2;
      tf2Pivot.add(tf2Mesh);
    }

    const bf2Pivot = new THREE.Group();
    bf2Pivot.position.y = -ph / 2;
    scene.add(bf2Pivot);
    if (hasHeight(bf[1])) {
      const bf2Mesh = buildPanel(pw[1], bf[1], texList?.bot[1] ?? null, faceCoords.bottomFlaps[1], S);
      bf2Mesh.position.y = -bf[1] / 2;
      bf2Pivot.add(bf2Mesh);
    }

    // ── Panel 1 (يسار p2) — المحور على الحافة اليمنى لـ p1 = اليسرى لـ p2 ──
    const p1Pivot = new THREE.Group();
    p1Pivot.position.x = -pw[1] / 2;   // حافة p2 اليسرى
    scene.add(p1Pivot);

    const p1Mesh = buildPanel(pw[0], ph, texList?.body[0] ?? null, faceCoords.body[0], S);
    p1Mesh.position.x = -pw[0] / 2;    // مركز p1 بالنسبة للمحور
    p1Pivot.add(p1Mesh);

    // Top/Bot flaps للـ p1 — داخل مجموعة p1Pivot
    const tf1Pivot = new THREE.Group();
    tf1Pivot.position.set(-pw[0] / 2, ph / 2, 0);  // أعلى مركز p1
    p1Pivot.add(tf1Pivot);
    const tf1Inner = new THREE.Group();
    tf1Pivot.add(tf1Inner);

    let tf1TongueG: THREE.Group | undefined = undefined;

    if (hasHeight(tf[0])) {
      if (splitTf1) {
        const lidS = (lidTongue as number) * S;
        const covS = tf[0] - lidS;

        // 1. Cover panel
        const coverMesh = buildPanel(pw[0], covS, texTf1Cover, undefined, S);
        coverMesh.position.y = covS / 2;
        tf1Inner.add(coverMesh);

        // 2. Tongue pivot & panel
        tf1TongueG = new THREE.Group();
        tf1TongueG.position.y = covS;
        tf1Inner.add(tf1TongueG);

        const filteredPolygon = faceCoords.topFlaps[0].polygon?.filter(pt => pt[1] <= faceCoords.topFlaps[0].y + (lidTongue as number) + 0.01);

        const tongueMesh = buildPanel(pw[0], lidS, texTf1Tongue, {
          ...faceCoords.topFlaps[0],
          y: faceCoords.topFlaps[0].y,
          h: (lidTongue as number),
          polygon: filteredPolygon,
        }, S);
        tongueMesh.position.y = lidS / 2;
        tf1TongueG.add(tongueMesh);
      } else {
        const tf1Mesh = buildPanel(pw[0], tf[0], texList?.top[0] ?? null, faceCoords.topFlaps[0], S);
        tf1Mesh.position.y = tf[0] / 2;
        tf1Inner.add(tf1Mesh);
      }
    }

    const bf1Pivot = new THREE.Group();
    bf1Pivot.position.set(-pw[0] / 2, -ph / 2, 0);
    p1Pivot.add(bf1Pivot);
    const bf1Inner = new THREE.Group();
    bf1Pivot.add(bf1Inner);

    let bf1TongueG: THREE.Group | undefined = undefined;
 
    if (hasHeight(bf[0])) {
      if (splitBf1) {
        const lidS = (lidTongue as number) * S;
        const covS = bf[0] - lidS;

        // 1. Cover panel
        const coverMesh = buildPanel(pw[0], covS, texBf1Cover, undefined, S);
        coverMesh.position.y = -covS / 2;
        bf1Inner.add(coverMesh);

        // 2. Tongue pivot & panel
        bf1TongueG = new THREE.Group();
        bf1TongueG.position.y = -covS; // At the bottom edge of cover panel
        bf1Inner.add(bf1TongueG);

        const yBound = faceCoords.bottomFlaps[0].y + (faceCoords.bottomFlaps[0].h - (lidTongue as number));
        const filteredPolygon = faceCoords.bottomFlaps[0].polygon?.filter(pt => pt[1] >= yBound - 0.01);

        const tongueMesh = buildPanel(pw[0], lidS, texBf1Tongue, {
          ...faceCoords.bottomFlaps[0],
          y: yBound,
          h: (lidTongue as number),
          polygon: filteredPolygon,
        }, S);
        tongueMesh.position.y = -lidS / 2;
        bf1TongueG.add(tongueMesh);
      } else {
        const bf1Mesh = buildPanel(pw[0], bf[0], texList?.bot[0] ?? null, faceCoords.bottomFlaps[0], S);
        bf1Mesh.position.y = -bf[0] / 2;
        bf1Inner.add(bf1Mesh);
      }
    }

    // ── Glue flap — يسار p1 (شكل متوازي أضلاع) ──
    // المحور عند الحافة اليسرى لـ p1 = نقطة خط الطي الحقيقية
    const gluePivotG = new THREE.Group();
    gluePivotG.position.x = -pw[0];  // حافة p1 اليسرى = خط الطي
    p1Pivot.add(gluePivotG);
    // buildGlueFlap: الشكل يمتد من x=0 إلى x=-gf، محور الطي عند x=0
    const glueMesh = buildGlueFlap(gf, ph, texList?.glue ?? null);
    // لا نحتاج offset إضافي — الشكل مرسوم بالفعل من 0 إلى -gf
    gluePivotG.add(glueMesh);

    // ── Panel 3 (يمين p2) ──
    const p3Pivot = new THREE.Group();
    p3Pivot.position.x = pw[1] / 2;   // حافة p2 اليمنى
    scene.add(p3Pivot);

    const p3Mesh = buildPanel(pw[2], ph, texList?.body[2] ?? null, faceCoords.body[2], S);
    p3Mesh.position.x = pw[2] / 2;
    p3Pivot.add(p3Mesh);

    const tf3Pivot = new THREE.Group();
    tf3Pivot.position.set(pw[2] / 2, ph / 2, 0);
    p3Pivot.add(tf3Pivot);
    const tf3Inner = new THREE.Group();
    tf3Pivot.add(tf3Inner);

    let tf3TongueG: THREE.Group | undefined = undefined;
    let tf3LeftEarG: THREE.Group | undefined = undefined;
    let tf3RightEarG: THREE.Group | undefined = undefined;

    if (hasHeight(tf[2])) {
      if (splitTf3) {
        const lidS = (lidTongue as number) * S;
        const covS = tf[2] - lidS;

        // 1. Cover panel
        const coverMesh = buildPanel(pw[2], covS, texTf3Cover, undefined, S);
        coverMesh.position.y = covS / 2;
        tf3Inner.add(coverMesh);

        // 2. Tongue pivot & panel
        tf3TongueG = new THREE.Group();
        tf3TongueG.position.y = covS; // At the top edge of cover panel
        tf3Inner.add(tf3TongueG);

        const filteredPolygon = faceCoords.topFlaps[2].polygon?.filter(pt => pt[1] <= (lidTongue as number) + 0.01);

        const tongueMesh = buildPanel(pw[2], lidS, texTf3Tongue, {
          ...faceCoords.topFlaps[2],
          y: 0,
          h: (lidTongue as number),
          polygon: filteredPolygon,
        }, S);
        tongueMesh.position.y = lidS / 2;
        tf3TongueG.add(tongueMesh);
      } else {
        const tf3Mesh = buildPanel(pw[2], tf[2], texList?.top[2] ?? null, faceCoords.topFlaps[2], S);
        tf3Mesh.position.y = tf[2] / 2;
        tf3Inner.add(tf3Mesh);
      }
    }

    const bf3Pivot = new THREE.Group();
    bf3Pivot.position.set(pw[2] / 2, -ph / 2, 0);
    p3Pivot.add(bf3Pivot);
    const bf3Inner = new THREE.Group();
    bf3Pivot.add(bf3Inner);
    if (hasHeight(bf[2])) {
      const bf3Mesh = buildPanel(pw[2], bf[2], texList?.bot[2] ?? null, faceCoords.bottomFlaps[2], S);
      bf3Mesh.position.y = -bf[2] / 2;
      bf3Inner.add(bf3Mesh);
    }

    // ── Panel 4 (يمين p3) ──
    const p4Pivot = new THREE.Group();
    p4Pivot.position.x = pw[2];  // حافة p3 اليمنى
    p3Pivot.add(p4Pivot);

    const p4Mesh = buildPanel(pw[3], ph, texList?.body[3] ?? null, faceCoords.body[3], S);
    p4Mesh.position.x = pw[3] / 2;
    p4Pivot.add(p4Mesh);

    const tf4Pivot = new THREE.Group();
    tf4Pivot.position.set(pw[3] / 2, ph / 2, 0);
    p4Pivot.add(tf4Pivot);
    const tf4Inner = new THREE.Group();
    tf4Pivot.add(tf4Inner);
    if (hasHeight(tf[3])) {
      const tf4Mesh = buildPanel(pw[3], tf[3], texList?.top[3] ?? null, faceCoords.topFlaps[3], S);
      tf4Mesh.position.y = tf[3] / 2;
      tf4Inner.add(tf4Mesh);
    }

    const bf4Pivot = new THREE.Group();
    bf4Pivot.position.set(pw[3] / 2, -ph / 2, 0);
    p4Pivot.add(bf4Pivot);
    const bf4Inner = new THREE.Group();
    bf4Pivot.add(bf4Inner);
    if (hasHeight(bf[3])) {
      const bf4Mesh = buildPanel(pw[3], bf[3], texList?.bot[3] ?? null, faceCoords.bottomFlaps[3], S);
      bf4Mesh.position.y = -bf[3] / 2;
      bf4Inner.add(bf4Mesh);
    }

    // حفظ مراجع المحاور
    pivotRefs.current = {
      p1: p1Pivot, p3: p3Pivot, p4: p4Pivot,
      gluePivot: gluePivotG,
      tf1: tf1Inner, tf2: tf2Pivot, tf3: tf3Inner, tf4: tf4Inner,
      bf1: bf1Inner, bf2: bf2Pivot, bf3: bf3Inner, bf4: bf4Inner,
      tf1Tongue: tf1TongueG,
      tf3Tongue: tf3TongueG,
      bf1Tongue: bf1TongueG,
      tf3LeftEar: tf3LeftEarG,
      tf3RightEar: tf3RightEarG,
    };

    // ── Render Loop ──
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, cam);
    };
    tick();

    // ── Resize ──
    const onResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h2 = mount.clientHeight;
      renderer.setSize(w, h2);
      cam.aspect = w / h2;
      cam.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(rafRef.current);
      controls.dispose();
      renderer.dispose();
      
      // Dispose our custom textures to prevent memory leaks!
      if (texTf3Cover) texTf3Cover.dispose();
      if (texTf3Tongue) texTf3Tongue.dispose();
      if (texBf1Cover) texBf1Cover.dispose();
      if (texBf1Tongue) texBf1Tongue.dispose();

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      pivotRefs.current = null;
    };
    // إعادة البناء فقط عند تغيّر الأبعاد الجوهرية
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // نستخدم JSON string بدل spread لتجنب infinite loops
    JSON.stringify({ pw, ph, gf, tf, bf }),
  ]);

  // ── تطبيق زاوية الطي عند تغيّر foldPercent ──
  useEffect(() => {
    const refs = pivotRefs.current;
    if (!refs) return;

    // Phase 1: Body Panels (0% to 40%)
    const p1Factor = Math.min(1, Math.max(0, foldPercent / 40));
    const angle1 = p1Factor * (Math.PI / 2);

    // Phase 2: Dust Flaps (40% to 70%)
    const p2Factor = Math.min(1, Math.max(0, (foldPercent - 40) / 30));
    const angle2 = p2Factor * (Math.PI / 2);

    // Phase 3: Locking Tongues (70% to 85%)
    const p3Factor = Math.min(1, Math.max(0, (foldPercent - 70) / 15));
    const angle3 = p3Factor * (Math.PI / 2);

    // Phase 4: Lid Covers (85% to 100%)
    const p4Factor = Math.min(1, Math.max(0, (foldPercent - 85) / 15));
    const angle4 = p4Factor * (Math.PI / 2);

    // Panel 1, 3, 4, Glue (Body Panels)
    refs.p1.rotation.y = -angle1;
    refs.p3.rotation.y = angle1;
    refs.p4.rotation.y = angle1;
    refs.gluePivot.rotation.y = -angle1;

    if (boxType === 'A60_20_01_01') {
      // Top dust flaps (tf2 over Side 1, tf4 over Side 2) rotate inwards
      refs.tf2.rotation.x = -angle2;
      refs.tf4.rotation.x = -angle2;

      // Top Lid Cover (tf1 over Front Panel 1) rotates inward
      refs.tf1.rotation.x = -angle4;
      if (refs.tf1Tongue) refs.tf1Tongue.rotation.x = -angle3;

      // Auto-Lock Bottom Flaps (bf1, bf2, bf3, bf4) rotate inward 90 deg into crash lock bottom floor
      refs.bf1.rotation.x = angle4;
      refs.bf2.rotation.x = angle2;
      refs.bf3.rotation.x = angle4;
      refs.bf4.rotation.x = angle2;
    } else if (boxType === 'T0005' || boxType === 'T0006') {
      // Dust Flaps (tf2, tf4, bf2, bf4) -> rotate inwards (angle2)
      refs.tf2.rotation.x = -angle2;
      refs.tf4.rotation.x = -angle2;
      refs.bf2.rotation.x = angle2;
      refs.bf4.rotation.x = angle2;

      // Tuck & Lock Flaps (tf1, tf3, bf1, bf3) -> rotate inwards (angle4)
      refs.tf1.rotation.x = -angle4;
      refs.tf3.rotation.x = -angle4;
      refs.bf1.rotation.x = angle4;
      refs.bf3.rotation.x = angle4;
    } else {
      // Dust Flaps (tf1, tf2, tf4) -> rotate inwards (negative X)
      refs.tf1.rotation.x = -angle2;
      refs.tf2.rotation.x = -angle2;
      refs.tf4.rotation.x = -angle2;

      // Dust Flaps (bf2, bf3, bf4) -> rotate inwards (positive X)
      refs.bf2.rotation.x = angle2;
      refs.bf3.rotation.x = angle2;
      refs.bf4.rotation.x = angle2;

      // Lid Covers (tf3, bf1) -> rotate inwards (X)
      refs.tf3.rotation.x = -angle4;
      refs.bf1.rotation.x = angle4;
    }

    // Locking Tongues (tf1Tongue, tf3Tongue, bf1Tongue) -> rotate inwards relative to covers
    if (refs.tf1Tongue) refs.tf1Tongue.rotation.x = -angle3;
    if (refs.tf3Tongue) refs.tf3Tongue.rotation.x = -angle3;
    if (refs.bf1Tongue) refs.bf1Tongue.rotation.x = angle3;

    
    if (refs.tf3RightEar) refs.tf3RightEar.rotation.y = -angle3;
  }, [foldPercent]);

  // ── تفعيل/إيقاف الدوران التلقائي ──
  useEffect(() => {
    if (controlsRef.current) controlsRef.current.autoRotate = autoRotate;
  }, [autoRotate]);

  // ── إعادة ضبط الكاميرا ──
  const resetCamera = useCallback(() => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    cam.position.set(pw[1] * 0.9, ph * 0.85, (pw[0] + pw[1] + pw[2]) * 1.3);
    ctrl.target.set(0, 0, 0);
    ctrl.update();
  }, [pw, ph]);

  const foldLabel =
    foldPercent === 0 ? 'مفرود مسطح (2D)'
    : foldPercent === 100 ? 'علبة مغلقة بالكامل'
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
};

export default Box3DPreview;
