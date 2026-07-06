/**
 * SVG Auto Nesting — Manual Nesting Pattern.
 *
 * Workflow:
 *   1) User uploads an SVG template (kept as-is — no parametric resizing).
 *   2) User arranges several copies of it inside a workspace exactly the way
 *      they want them nested (drag, rotate 90/180/270, copy, delete).
 *   3) User clicks "اعتماد نمط التوزيع" — the relative positions and rotations
 *      of all copies become the pattern (treated as a tileable block).
 *   4) User clicks "أفضل توزيع" — the pattern is repeated across the sheet
 *      using its own pitch / block size, plus an optional user gap.
 *   5) Preview === Export.
 *
 * The imported SVG is NOT a parametric template:
 *   • No dimension editing
 *   • No L/D/H extraction
 *   • No stretch zones / calibration / resize engine
 *   • Only its real cut geometry is reused, copied and tiled.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Upload, Sparkles, Download, AlertTriangle, FileText, Copy, Trash2,
  RotateCw, RotateCcw, RefreshCw, Save, Grid3x3, Hash, Plus,
} from 'lucide-react';
import { toast } from 'sonner';

type DistributionStats = {
  finalCopies: number;
  rulesUsed: number;
  iterations: number;
  hitSafetyLimit: boolean;
  maxCopies: number;
  maxIterations: number;
  bestSeed: string;
};

type DebugRuleRow = {
  ruleId: string;
  dx: number;
  dy: number;
  rotation: Rotation;
  candidateX: number;
  candidateY: number;
  inside: boolean;
  duplicate: boolean;
  collision: string;
  accepted: boolean;
  reason: string;
};

/* ──────────────────────────────────────────────────────────── *
 * Units & helpers                                              *
 * ──────────────────────────────────────────────────────────── */

const PT_TO_MM = 25.4 / 72;
const IN_TO_MM = 25.4;
const PX_TO_MM = 25.4 / 96;

const parseUnitToMm = (raw: string | null | undefined): number => {
  if (!raw) return 0;
  const s = String(raw).trim();
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*(mm|cm|in|pt|px)?$/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const u = (m[2] || 'px').toLowerCase();
  if (u === 'mm') return n;
  if (u === 'cm') return n * 10;
  if (u === 'in') return n * IN_TO_MM;
  if (u === 'pt') return n * PT_TO_MM;
  return n * PX_TO_MM;
};

const NAMED_COLORS: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000',
  blue: '#0000ff', yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff',
  gray: '#808080', grey: '#808080', orange: '#ffa500', purple: '#800080',
};

const normaliseColor = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  let v = raw.trim().toLowerCase();
  if (!v || v === 'none' || v === 'transparent' || v === 'currentcolor' || v === 'inherit') return null;
  if (v.startsWith('url(')) return null;
  if (NAMED_COLORS[v]) v = NAMED_COLORS[v];
  const m = v.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (m) {
    const toHex = (n: string) => Number(n).toString(16).padStart(2, '0');
    v = `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`;
  }
  if (/^#[0-9a-f]{3}$/.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return v;
};

const readStyleProp = (el: Element, prop: string): string | null => {
  const direct = el.getAttribute(prop);
  if (direct) return direct;
  const style = el.getAttribute('style') || '';
  const m = style.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i'));
  return m ? m[1].trim() : null;
};

const effectivePaint = (el: Element, prop: 'stroke' | 'fill'): string | null => {
  let cur: Element | null = el;
  while (cur && cur.tagName.toLowerCase() !== 'svg') {
    const v = readStyleProp(cur, prop);
    if (v) {
      const norm = normaliseColor(v);
      if (norm) return norm;
      if (/^(none|transparent)$/i.test(v.trim())) return null;
    }
    cur = cur.parentElement;
  }
  if (prop === 'fill') return '#000000';
  return null;
};

const DRAWABLE = ['path', 'polyline', 'polygon', 'line', 'rect', 'circle', 'ellipse'];
const ALL_VISIBLE = '__all_visible__';

/* ──────────────────────────────────────────────────────────── *
 * SVG parsing                                                  *
 * ──────────────────────────────────────────────────────────── */

interface ParsedSvg {
  fileName: string;
  raw: string;
  vbX: number; vbY: number; vbW: number; vbH: number;
  widthMm: number;
  heightMm: number;
  colors: { color: string; count: number; kind: 'stroke' | 'fill' | 'both' }[];
}

const parseSvgFile = async (file: File): Promise<ParsedSvg> => {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('ملف SVG غير صالح');
  const svg = doc.documentElement;
  if (svg.tagName.toLowerCase() !== 'svg') throw new Error('لم يتم العثور على وسم <svg>');

  let vbX = 0, vbY = 0, vbW = 0, vbH = 0;
  const vb = svg.getAttribute('viewBox');
  if (vb) {
    const p = vb.split(/[\s,]+/).map(Number);
    if (p.length === 4 && p.every(Number.isFinite)) { [vbX, vbY, vbW, vbH] = p; }
  }
  const wAttr = svg.getAttribute('width');
  const hAttr = svg.getAttribute('height');
  const hasUnit = (s: string | null) => !!s && /(mm|cm|in|pt|px)\s*$/i.test(s);

  let widthMm = 0, heightMm = 0;
  if (hasUnit(wAttr) && hasUnit(hAttr)) {
    widthMm = parseUnitToMm(wAttr);
    heightMm = parseUnitToMm(hAttr);
  } else if (vbW > 0 && vbH > 0) {
    widthMm = vbW * PT_TO_MM;
    heightMm = vbH * PT_TO_MM;
  } else if (wAttr && hAttr) {
    widthMm = parseUnitToMm(wAttr);
    heightMm = parseUnitToMm(hAttr);
  }
  if (widthMm > 5000 || heightMm > 5000) {
    if (vbW > 0 && vbH > 0) { widthMm = vbW * PT_TO_MM; heightMm = vbH * PT_TO_MM; }
  }
  if (!widthMm || !heightMm) throw new Error('تعذر تحديد مقاس القالب من الملف');
  if (!vbW || !vbH) { vbW = widthMm; vbH = heightMm; }

  const strokeCounts = new Map<string, number>();
  const fillCounts = new Map<string, number>();
  doc.querySelectorAll(DRAWABLE.join(',')).forEach((el) => {
    const s = effectivePaint(el, 'stroke');
    if (s) strokeCounts.set(s, (strokeCounts.get(s) || 0) + 1);
    const f = effectivePaint(el, 'fill');
    if (f) fillCounts.set(f, (fillCounts.get(f) || 0) + 1);
  });
  const merged = new Map<string, { count: number; kind: 'stroke' | 'fill' | 'both' }>();
  strokeCounts.forEach((c, k) => merged.set(k, { count: c, kind: 'stroke' }));
  fillCounts.forEach((c, k) => {
    const ex = merged.get(k);
    if (ex) merged.set(k, { count: ex.count + c, kind: 'both' });
    else merged.set(k, { count: c, kind: 'fill' });
  });
  const colors = Array.from(merged.entries())
    .map(([color, v]) => ({ color, count: v.count, kind: v.kind }))
    .sort((a, b) => b.count - a.count);

  return { fileName: file.name, raw: text, vbX, vbY, vbW, vbH, widthMm, heightMm, colors };
};

const buildFilteredMarkup = (rawSvg: string, target: string): string => {
  const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml');
  const svg = doc.documentElement;
  svg.querySelectorAll('text, tspan, title, desc, metadata').forEach((el) => el.parentNode?.removeChild(el));
  const keepable = new Set([...DRAWABLE, 'g', 'svg', 'defs', 'clipPath', 'mask', 'use']);
  Array.from(svg.querySelectorAll('*')).forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (!keepable.has(tag)) { el.parentNode?.removeChild(el); return; }
    if (!DRAWABLE.includes(tag)) return;
    if (target === ALL_VISIBLE) return;
    const s = effectivePaint(el, 'stroke');
    const f = effectivePaint(el, 'fill');
    if (s !== target && f !== target) el.parentNode?.removeChild(el);
  });
  return new XMLSerializer().serializeToString(svg);
};

/* ──────────────────────────────────────────────────────────── *
 * Instance & Pattern model (all in mm)                         *
 * ──────────────────────────────────────────────────────────── */

type Rotation = 0 | 90 | 180 | 270;

interface Instance {
  id: string;
  /** Top-left (in mm) of the instance's *unrotated* bounding box anchor.
   *  The instance is drawn rotated about its own center.               */
  x: number;
  y: number;
  rotation: Rotation;
}

interface PatternRelInstance {
  /** Absolute top-left of the instance footprint in sheet coords (mm). */
  dx: number;
  dy: number;
  rotation: Rotation;
}

type NeighborDir = 'R' | 'L' | 'T' | 'B';

interface NeighborRule {
  sourceIndex: number;
  dir: NeighborDir;
  /** Offset (mm) from the anchor piece's top-left to this neighbor's top-left. */
  dx: number;
  dy: number;
  /** Absolute teaching-area top-left in the same sheet coordinates used by preview/export. */
  x: number;
  y: number;
  rotation: Rotation;
}

interface NestingPattern {
  name: string;
  seedX: number;
  seedY: number;
  seedRotation: Rotation;
  rules: NeighborRule[];
  /** Stats only: bbox of seed + all rules (mm). */
  blockW: number;
  blockH: number;
}

/** Footprint of an instance: rotated dieline bbox. */
const footprint = (w: number, h: number, rot: Rotation) =>
  (rot === 90 || rot === 270) ? { w: h, h: w } : { w, h };

const transformedBounds = (x: number, y: number, w: number, h: number, rot: Rotation) => {
  const fp = footprint(w, h, rot);
  return { x0: x, y0: y, x1: x + fp.w, y1: y + fp.h, w: fp.w, h: fp.h };
};

const newId = () => Math.random().toString(36).slice(2, 9);

/* ──────────────────────────────────────────────────────────── *
 * Main component                                               *
 * ──────────────────────────────────────────────────────────── */

interface Props { isAdmin?: boolean }

const SvgAutoNestingCalculator = ({}: Props) => {
  // Source SVG
  const [parsed, setParsed] = useState<ParsedSvg | null>(null);
  const [cutColor, setCutColor] = useState<string>(ALL_VISIBLE);
  const filteredMarkup = useMemo(
    () => (parsed ? buildFilteredMarkup(parsed.raw, cutColor) : ''),
    [parsed, cutColor],
  );

  // Workspace
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showNumbers, setShowNumbers] = useState(true);
  const [fineNudge, setFineNudge] = useState(false); // 0.1mm vs 1mm

  // Sheet
  const [sheetWmm, setSheetWmm] = useState<number>(700);
  const [sheetHmm, setSheetHmm] = useState<number>(500);
  const [gapMm, setGapMm] = useState<number>(0);

  // Pattern
  const [pattern, setPattern] = useState<NestingPattern | null>(null);
  const [tilePlacements, setTilePlacements] = useState<PatternRelInstance[]>([]);
  const [savedPatterns, setSavedPatterns] = useState<NestingPattern[]>([]);
  const [patternNameDraft, setPatternNameDraft] = useState('');
  const [isComputingDistribution, setIsComputingDistribution] = useState(false);
  const [distributionStats, setDistributionStats] = useState<DistributionStats | null>(null);
  const [debugRows, setDebugRows] = useState<DebugRuleRow[]>([]);

  const tmplW = parsed?.widthMm ?? 0;
  const tmplH = parsed?.heightMm ?? 0;

  /* ── File upload ───────────────────────────────────────── */
  const handleFile = async (file: File | null) => {
    if (!file) return;
    try {
      const p = await parseSvgFile(file);
      setParsed(p);
      setCutColor(ALL_VISIBLE);
      // Reset workspace; place the first instance at top-left
      setInstances([{ id: newId(), x: 0, y: 0, rotation: 0 }]);
      setSelectedId(null);
      setPattern(null);
      setTilePlacements([]);
      setDistributionStats(null);
      setDebugRows([]);
      toast.success(`تم رفع ${p.fileName}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذر قراءة الملف');
    }
  };

  /* ── Workspace mutations ───────────────────────────────── */
  const updateInstance = (id: string, patch: Partial<Instance>) =>
    setInstances((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const duplicateInstance = (id: string | null) => {
    if (!parsed) { toast.error('ارفع ملف SVG أولاً'); return; }
    const src = id ? instances.find((i) => i.id === id) : instances[instances.length - 1];
    const base = src ?? { x: 0, y: 0, rotation: 0 as Rotation };
    const fp = footprint(tmplW, tmplH, base.rotation);
    const copy: Instance = {
      id: newId(),
      x: base.x + fp.w, // place to the right
      y: base.y,
      rotation: base.rotation,
    };
    setInstances((l) => [...l, copy]);
    setSelectedId(copy.id);
  };

  const addInstance = () => {
    if (!parsed) { toast.error('ارفع ملف SVG أولاً'); return; }
    const inst: Instance = { id: newId(), x: 0, y: 0, rotation: 0 };
    setInstances((l) => [...l, inst]);
    setSelectedId(inst.id);
  };

  const deleteInstance = (id: string) => {
    setInstances((l) => {
      // Keep at least one instance
      if (l.length <= 1) { toast.info('لا يمكن حذف النسخة الأصلية'); return l; }
      return l.filter((i) => i.id !== id);
    });
    if (selectedId === id) setSelectedId(null);
  };

  const rotateInstance = (id: string, rot: Rotation) =>
    updateInstance(id, { rotation: rot });

  /* ── Drag in workspace ─────────────────────────────────── */
  const wsRef = useRef<SVGSVGElement | null>(null);
  const dragState = useRef<{ id: string; startX: number; startY: number; ix: number; iy: number } | null>(null);

  const onPiecePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    const inst = instances.find((i) => i.id === id);
    if (!inst || !wsRef.current) return;
    const pt = wsRef.current.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = wsRef.current.getScreenCTM();
    if (!ctm) return;
    const local = pt.matrixTransform(ctm.inverse());
    dragState.current = { id, startX: local.x, startY: local.y, ix: inst.x, iy: inst.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPiecePointerMove = (e: React.PointerEvent) => {
    const d = dragState.current;
    if (!d || !wsRef.current) return;
    const pt = wsRef.current.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = wsRef.current.getScreenCTM();
    if (!ctm) return;
    const local = pt.matrixTransform(ctm.inverse());
    updateInstance(d.id, {
      x: d.ix + (local.x - d.startX),
      y: d.iy + (local.y - d.startY),
    });
  };
  const onPiecePointerUp = (e: React.PointerEvent) => {
    if (dragState.current) {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      dragState.current = null;
    }
  };

  /* ── Keyboard nudge of selected ────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedId) return;
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const step = fineNudge ? 0.1 : 1;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else return;
      e.preventDefault();
      setInstances((l) => l.map((i) => i.id === selectedId ? { ...i, x: i.x + dx, y: i.y + dy } : i));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, fineNudge]);

  /* ── Pattern derivation: keep EVERY manual neighbor as its own rule ── */
  const computePattern = (): NestingPattern | null => {
    if (!parsed || instances.length < 1) return null;
    const seed = instances[0];
    const rules: NeighborRule[] = [];
    const seenKeys = new Set<string>();
    for (let i = 1; i < instances.length; i++) {
      const n = instances[i];
      const dx = n.x - seed.x;
      const dy = n.y - seed.y;
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) continue;
      // Dedup only exact-duplicate teachings (same offset + rotation), NOT by direction.
      const k = `${Math.round(dx * 10)}|${Math.round(dy * 10)}|${n.rotation}`;
      if (seenKeys.has(k)) continue;
      seenKeys.add(k);
      const dir: NeighborDir =
        Math.abs(dx) >= Math.abs(dy)
          ? (dx >= 0 ? 'R' : 'L')
          : (dy >= 0 ? 'B' : 'T');
      rules.push({ sourceIndex: i + 1, dir, dx, dy, x: n.x, y: n.y, rotation: n.rotation });
    }

    // Stats bbox = seed footprint + each rule's neighbor footprint
    const fp0 = footprint(tmplW, tmplH, seed.rotation);
    let minX = 0, minY = 0, maxX = fp0.w, maxY = fp0.h;
    for (const r of rules) {
      const bounds = transformedBounds(r.dx, r.dy, tmplW, tmplH, r.rotation);
      minX = Math.min(minX, bounds.x0);
      minY = Math.min(minY, bounds.y0);
      maxX = Math.max(maxX, bounds.x1);
      maxY = Math.max(maxY, bounds.y1);
    }
    return {
      name: patternNameDraft || `Pattern ${savedPatterns.length + 1}`,
      seedX: seed.x,
      seedY: seed.y,
      seedRotation: seed.rotation,
      rules,
      blockW: maxX - minX,
      blockH: maxY - minY,
    };
  };

  /* ── Overlap warning (advisory only, no enforcement) ───── */
  const hasOverlapWarning = useMemo(() => {
    if (instances.length < 2) return false;
    const boxes = instances.map((i) => {
      return transformedBounds(i.x, i.y, tmplW, tmplH, i.rotation);
    });
    for (let a = 0; a < boxes.length; a++) {
      for (let b = a + 1; b < boxes.length; b++) {
        const A = boxes[a], B = boxes[b];
        const ix = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0);
        const iy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
        if (ix > 1 && iy > 1) {
          // require a meaningful area overlap to flag
          const area = ix * iy;
          if (area > (tmplW * tmplH) * 0.15) return true;
        }
      }
    }
    return false;
  }, [instances, tmplW, tmplH]);

  const approvePattern = () => {
    if (!parsed || instances.length === 0) { toast.error('أضف نسخة واحدة على الأقل'); return; }
    if (hasOverlapWarning) {
      const ok = window.confirm('قد توجد نسخ متداخلة داخل النمط اليدوي. هل تريد اعتماد النمط رغم ذلك؟');
      if (!ok) return;
    }
    const p = computePattern();
    if (!p) return;
    setPattern(p);
    setTilePlacements([]);
    setDistributionStats(null);
    setDebugRows([]);
    toast.success(
      `تم اعتماد علاقات الجوار — ${p.rules.length} قاعدة (${p.rules.map(r => ({R:'يمين',L:'يسار',T:'أعلى',B:'أسفل'} as const)[r.dir]).join(' / ') || 'لا توجد'})`,
    );
  };

  /* ── Best distribution: expand from a seed via neighbor rules ─ */
  const computeBestDistribution = async () => {
    const activePattern = pattern;
    if (!activePattern) { toast.error('اعتمد علاقات الجوار أولاً'); return; }
    if (activePattern.rules.length === 0) {
      toast.error('أضف نسخة واحدة على الأقل حول الأصل لتعليم اتجاه');
      return;
    }
    if (!parsed || tmplW <= 0 || tmplH <= 0 || sheetWmm <= 0 || sheetHmm <= 0) {
      toast.error('تأكد من ملف SVG ومقاس الشيت');
      return;
    }

    setIsComputingDistribution(true);
    setDistributionStats(null);
    setTilePlacements([]);
    setDebugRows([]);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));

    const tol = 0.5;
    const templateArea = Math.max(1, tmplW * tmplH);
    const areaBasedLimit = Math.ceil((sheetWmm * sheetHmm) / templateArea * 6);
    const maxCopies = Math.min(500, Math.max(50, areaBasedLimit));
    const maxIterations = Math.min(10000, Math.max(1000, maxCopies * Math.max(1, activePattern.rules.length) * 8));
    type P = { x: number; y: number; rotation: Rotation };
    const keyOf = (p: P) => `${Math.round(p.x / tol)}|${Math.round(p.y / tol)}|${p.rotation}`;
    const fitsInsideSheet = (p: P) => {
      const b = transformedBounds(p.x, p.y, tmplW, tmplH, p.rotation);
      return b.x0 >= -0.001 && b.y0 >= -0.001 && b.x1 <= sheetWmm + 0.001 && b.y1 <= sheetHmm + 0.001;
    };
    const overlapTol = 1.0; // mm — warning only for learned-neighborhood rebuild
    const overlapsAny = (p: P, others: P[]) => {
      const b = transformedBounds(p.x, p.y, tmplW, tmplH, p.rotation);
      const ax0 = b.x0, ay0 = b.y0, ax1 = b.x1, ay1 = b.y1;
      for (const o of others) {
        const ob = transformedBounds(o.x, o.y, tmplW, tmplH, o.rotation);
        const ix = Math.min(ax1, ob.x1) - Math.max(ax0, ob.x0);
        const iy = Math.min(ay1, ob.y1) - Math.max(ay0, ob.y0);
        if (ix > overlapTol && iy > overlapTol) return true;
      }
      return false;
    };

    let iterations = 0;
    let hitSafetyLimit = false;
    let bestPlacements: PatternRelInstance[] = [];
    try {
      const manualAnchor: P = { x: activePattern.seedX, y: activePattern.seedY, rotation: activePattern.seedRotation };

      // Phase A: mandatory rebuild around the exact manual anchor first.
      // Manual neighbor placements are the source of truth: each taught rule is
      // accepted independently when inside the sheet; collision is diagnostic only.
      const rebuilt: P[] = fitsInsideSheet(manualAnchor) ? [manualAnchor] : [];
      const acceptedKeys = new Set<string>(rebuilt.map(keyOf));
      const diagnostics: DebugRuleRow[] = [];
      for (const [idx, r] of activePattern.rules.entries()) {
        const candidate: P = {
          x: Number.isFinite(r.x) ? r.x : manualAnchor.x + r.dx,
          y: Number.isFinite(r.y) ? r.y : manualAnchor.y + r.dy,
          rotation: r.rotation,
        };
        const key = keyOf(candidate);
        const inside = fitsInsideSheet(candidate);
        const duplicate = acceptedKeys.has(key);
        const collisionWarning = overlapsAny(candidate, rebuilt);
        const accepted = inside && !duplicate;
        const reason = accepted
          ? (collisionWarning ? 'accepted — collision warning only' : 'accepted')
          : !inside
            ? 'outside sheet'
            : duplicate
              ? 'duplicate'
              : 'rejected';

        diagnostics.push({
          ruleId: `T${r.sourceIndex ?? idx + 2}`,
          dx: r.dx,
          dy: r.dy,
          rotation: r.rotation,
          candidateX: candidate.x,
          candidateY: candidate.y,
          inside,
          duplicate,
          collision: collisionWarning ? 'warning ignored' : 'none',
          accepted,
          reason,
        });

        if (accepted) {
          rebuilt.push(candidate);
          acceptedKeys.add(key);
        }
      }

      bestPlacements = rebuilt.map((p) => ({ dx: p.x, dy: p.y, rotation: p.rotation }));
      setDebugRows(diagnostics);
      console.table(diagnostics);

      // Current priority: preview/export must first match the learned manual
      // neighborhood exactly. Do not replace it with roaming seed optimization
      // until the teaching-coordinate rebuild is proven correct.
      setTilePlacements(bestPlacements);
      setDistributionStats({
        finalCopies: bestPlacements.length,
        rulesUsed: activePattern.rules.length,
        iterations,
        hitSafetyLimit,
        maxCopies,
        maxIterations,
        bestSeed: `Manual Anchor (${manualAnchor.x.toFixed(1)}, ${manualAnchor.y.toFixed(1)})`,
      });
      if (bestPlacements.length <= 1) {
        toast.warning('تمت إعادة البناء حول القالب الأصلي فقط — راجع جدول التشخيص لمعرفة سبب رفض الجيران.');
      } else {
        toast.success(`تمت إعادة بناء علاقات الجوار · ${bestPlacements.length} قالب داخل الشيت`);
      }
      return;

    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذر حساب أفضل توزيع');
    } finally {
      setIsComputingDistribution(false);
    }
  };

  /* ── Saved patterns (in-memory) ────────────────────────── */
  const savePattern = () => {
    if (!pattern) { toast.error('اعتمد النمط أولاً'); return; }
    const name = patternNameDraft.trim() || `Pattern ${savedPatterns.length + 1}`;
    setSavedPatterns((l) => [...l, { ...pattern, name }]);
    toast.success(`تم حفظ النمط: ${name}`);
    setPatternNameDraft('');
  };
  const loadSavedPattern = (name: string) => {
    const p = savedPatterns.find((s) => s.name === name);
    if (!p) return;
    setPattern(p);
    setTilePlacements([]);
    setDistributionStats(null);
    setDebugRows([]);
    toast.success(`تم تحميل النمط: ${name}`);
  };

  /* ── SVG rendering helpers ─────────────────────────────── */
  const innerMarkup = useMemo(() => {
    if (!filteredMarkup) return '';
    return filteredMarkup.replace(/^<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
  }, [filteredMarkup]);

  /** Render one template instance at given top-left + rotation (rendered in mm). */
  const renderTemplate = (
    dx: number, dy: number, rot: Rotation, opts: { stroke?: string; key?: string | number; idx?: number | null; selectable?: boolean; instId?: string },
  ) => {
    if (!parsed) return null;
    const fp = footprint(tmplW, tmplH, rot);
    const vb = `${parsed.vbX} ${parsed.vbY} ${parsed.vbW} ${parsed.vbH}`;
    const cx = dx + fp.w / 2;
    const cy = dy + fp.h / 2;
    // We render the template at its natural (un-rotated) size then rotate about the center.
    const transform = `translate(${cx} ${cy}) rotate(${rot}) translate(${-tmplW / 2} ${-tmplH / 2})`;
    const stroke = opts.stroke ?? '#1d4ed8';
    const sw = Math.max(0.1, Math.min(sheetWmm, sheetHmm) * 0.0015);
    const highlight = opts.selectable && selectedId === opts.instId;
    return (
      <g
        key={opts.key}
        transform={transform}
        onPointerDown={opts.selectable && opts.instId ? (e) => onPiecePointerDown(e, opts.instId!) : undefined}
        style={{ cursor: opts.selectable ? 'move' : 'default' }}
      >
        <g
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          dangerouslySetInnerHTML={{
            __html: `<svg width="${tmplW}" height="${tmplH}" viewBox="${vb}" preserveAspectRatio="none" overflow="visible"><g fill="none" stroke="${stroke}" stroke-width="${sw}" style="fill:none !important;stroke:${stroke} !important;">${innerMarkup}</g></svg>`,
          }}
        />
        {/* footprint outline (selection/visual aid) */}
        <rect
          x={0} y={0}
          width={tmplW} height={tmplH}
          fill="transparent"
          stroke={highlight ? '#16a34a' : 'transparent'}
          strokeWidth={sw * 2}
          strokeDasharray={`${sw * 6} ${sw * 4}`}
        />
        {showNumbers && opts.idx != null && (
          <text
            x={tmplW / 2}
            y={tmplH / 2}
            fontSize={Math.min(tmplW, tmplH) * 0.18}
            fill={stroke}
            opacity={0.55}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {opts.idx}
          </text>
        )}
      </g>
    );
  };

  /* ── Workspace SVG ─────────────────────────────────────── */
  // Workspace is rendered at sheet size so the user immediately sees how the
  // pattern relates to the actual sheet they're targeting.
  const workspaceSvg = (
    <svg
      ref={wsRef}
      viewBox={`0 0 ${sheetWmm} ${sheetHmm}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', background: '#fafafa', cursor: 'default', touchAction: 'none' }}
      onPointerMove={onPiecePointerMove}
      onPointerUp={onPiecePointerUp}
      onPointerLeave={onPiecePointerUp}
      onPointerDown={() => setSelectedId(null)}
    >
      {/* Sheet rect */}
      <rect x={0} y={0} width={sheetWmm} height={sheetHmm} fill="white" stroke="#333" strokeWidth={Math.min(sheetWmm, sheetHmm) * 0.001} />
      {/* Grid */}
      {showGrid && (() => {
        const step = 10; // 10mm
        const lines: JSX.Element[] = [];
        const lw = Math.min(sheetWmm, sheetHmm) * 0.0005;
        for (let x = step; x < sheetWmm; x += step) {
          lines.push(<line key={`vx${x}`} x1={x} y1={0} x2={x} y2={sheetHmm} stroke="#e5e7eb" strokeWidth={lw} />);
        }
        for (let y = step; y < sheetHmm; y += step) {
          lines.push(<line key={`hy${y}`} x1={0} y1={y} x2={sheetWmm} y2={y} stroke="#e5e7eb" strokeWidth={lw} />);
        }
        return <g>{lines}</g>;
      })()}
      {/* Instances */}
      {parsed && instances.map((i, idx) =>
        renderTemplate(i.x, i.y, i.rotation, {
          key: i.id,
          idx: idx + 1,
          selectable: true,
          instId: i.id,
          stroke: idx === 0 ? '#dc2626' : '#1d4ed8',
        }),
      )}
    </svg>
  );

  /* ── Preview SVG (best distribution result) ────────────── */
  const previewSvg = (
    <svg
      viewBox={`0 0 ${sheetWmm} ${sheetHmm}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', background: 'white' }}
    >
      <rect x={0} y={0} width={sheetWmm} height={sheetHmm} fill="white" stroke="#333" strokeWidth={Math.min(sheetWmm, sheetHmm) * 0.001} />
      {parsed && tilePlacements.map((p, idx) =>
        renderTemplate(p.dx, p.dy, p.rotation, { key: idx, idx: showNumbers ? idx + 1 : null, stroke: '#dc2626' }),
      )}
    </svg>
  );

  /* ── Stats ─────────────────────────────────────────────── */
  const sheetArea = sheetWmm * sheetHmm;
  const usedArea = tilePlacements.length * tmplW * tmplH;
  const usagePercent = sheetArea > 0 ? (usedArea / sheetArea) * 100 : 0;
  const rotationsUsed = useMemo(() => {
    const set = new Set(tilePlacements.map((p) => p.rotation));
    return Array.from(set).sort().map((r) => `${r}°`).join(' / ') || '—';
  }, [tilePlacements]);

  /* ── Export = current preview ──────────────────────────── */
  const exportSvg = () => {
    if (!parsed || tilePlacements.length === 0) { toast.error('لا يوجد توزيع للتصدير'); return; }
    const vb = `${parsed.vbX} ${parsed.vbY} ${parsed.vbW} ${parsed.vbH}`;
    const sw = Math.max(0.1, Math.min(sheetWmm, sheetHmm) * 0.0015);
    const placements = tilePlacements.map((p) => {
      const fp = footprint(tmplW, tmplH, p.rotation);
      const cx = p.dx + fp.w / 2;
      const cy = p.dy + fp.h / 2;
      const tr = `translate(${cx} ${cy}) rotate(${p.rotation}) translate(${-tmplW / 2} ${-tmplH / 2})`;
      return `<g transform="${tr}"><svg width="${tmplW}" height="${tmplH}" viewBox="${vb}" preserveAspectRatio="none" overflow="visible">${innerMarkup}</svg></g>`;
    }).join('');
    const out = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetWmm}mm" height="${sheetHmm}mm" viewBox="0 0 ${sheetWmm} ${sheetHmm}"><rect x="0" y="0" width="${sheetWmm}" height="${sheetHmm}" fill="white" stroke="#333" stroke-width="${sw * 2}"/>${placements}</svg>`;
    const blob = new Blob([out], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(parsed.fileName || 'nesting').replace(/\.svg$/i, '')}-manual-pattern.svg`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const selected = instances.find((i) => i.id === selectedId) || null;

  /* ──────────────────────────────────────────────────────── *
   * Render                                                    *
   * ──────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4" dir="rtl">
      {/* Upload + color */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-primary" />
            SVG Auto Nesting — تعليم التوزيع من ترتيب يدوي
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="file" accept=".svg,image/svg+xml" className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
              <span className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90">
                <Upload className="w-4 h-4" /> رفع ملف SVG
              </span>
            </label>
            {parsed && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="w-3.5 h-3.5" />
                <span className="font-medium">{parsed.fileName}</span>
                <span>—</span>
                <span>{parsed.widthMm.toFixed(1)} × {parsed.heightMm.toFixed(1)} مم</span>
              </div>
            )}
          </div>
          {parsed && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">لون خطوط القص</Label>
                <Select value={cutColor} onValueChange={(v) => setCutColor(v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VISIBLE}>كل المسارات المرئية</SelectItem>
                    {parsed.colors.map((c) => (
                      <SelectItem key={c.color} value={c.color}>
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-block w-3 h-3 rounded border" style={{ background: c.color }} />
                          <span>{c.color}</span>
                          <span className="text-[10px] text-muted-foreground">({c.count} · {c.kind})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sheet settings */}
      <Card>
        <CardHeader><CardTitle className="text-base">إعدادات الشيت</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">عرض الشيت (مم)</Label>
            <Input type="number" value={sheetWmm} onChange={(e) => setSheetWmm(Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">ارتفاع الشيت (مم)</Label>
            <Input type="number" value={sheetHmm} onChange={(e) => setSheetHmm(Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">التباعد بين النمط/النسخ (مم)</Label>
            <Input type="number" value={gapMm} onChange={(e) => setGapMm(Number(e.target.value) || 0)} step="0.5" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">حركة دقيقة (0.1mm) بالأسهم</Label>
            <div className="h-10 flex items-center"><Switch checked={fineNudge} onCheckedChange={setFineNudge} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Manual workspace */}
      {parsed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>تعليم علاقات الجوار — رتّب نسخاً حول القالب الأصلي (يمين / يسار / أعلى / أسفل)</span>
              <span className="text-xs font-normal text-muted-foreground">
                {instances.length} نسخة · حدد ثم استخدم الأسهم للتحريك
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Toolbar */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={addInstance}><Plus className="w-4 h-4" /> إضافة نسخة</Button>
              <Button size="sm" variant="outline" onClick={() => duplicateInstance(selectedId)}>
                <Copy className="w-4 h-4" /> نسخ
              </Button>
              <Button size="sm" variant="outline" disabled={!selected} onClick={() => selected && deleteInstance(selected.id)}>
                <Trash2 className="w-4 h-4" /> حذف
              </Button>
              <div className="w-px bg-border mx-1" />
              <Button size="sm" variant="outline" disabled={!selected} onClick={() => selected && rotateInstance(selected.id, 90)}>
                <RotateCw className="w-4 h-4" /> 90°
              </Button>
              <Button size="sm" variant="outline" disabled={!selected} onClick={() => selected && rotateInstance(selected.id, 180)}>
                180°
              </Button>
              <Button size="sm" variant="outline" disabled={!selected} onClick={() => selected && rotateInstance(selected.id, 270)}>
                <RotateCcw className="w-4 h-4" /> 270°
              </Button>
              <Button size="sm" variant="outline" disabled={!selected} onClick={() => selected && rotateInstance(selected.id, 0)}>
                <RefreshCw className="w-4 h-4" /> 0°
              </Button>
              <div className="w-px bg-border mx-1" />
              <Button size="sm" variant={showGrid ? 'default' : 'outline'} onClick={() => setShowGrid((v) => !v)}>
                <Grid3x3 className="w-4 h-4" /> خطوط الشيت
              </Button>
              <Button size="sm" variant={showNumbers ? 'default' : 'outline'} onClick={() => setShowNumbers((v) => !v)}>
                <Hash className="w-4 h-4" /> أرقام النسخ
              </Button>
            </div>

            {/* Workspace */}
            <div
              className="w-full rounded border bg-white"
              style={{ aspectRatio: `${sheetWmm} / ${sheetHmm}`, maxHeight: 640 }}
            >
              {workspaceSvg}
            </div>

            {selected && (
              <div className="text-xs text-muted-foreground">
                نسخة محددة · X: <b>{selected.x.toFixed(2)}</b> mm · Y: <b>{selected.y.toFixed(2)}</b> mm · دوران: <b>{selected.rotation}°</b>
              </div>
            )}

            {hasOverlapWarning && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                قد توجد نسخ متداخلة داخل النمط اليدوي (فحص تحذيري فقط — يمكنك المتابعة).
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button onClick={approvePattern} disabled={!parsed || instances.length === 0}>
                <Sparkles className="w-4 h-4" /> اعتماد علاقات الجوار
              </Button>
              <Button variant="default" onClick={computeBestDistribution} disabled={!pattern || isComputingDistribution}>
                <Sparkles className="w-4 h-4" /> {isComputingDistribution ? 'جاري حساب أفضل توزيع...' : 'أفضل توزيع'}
              </Button>
              <div className="flex items-center gap-2">
                <Input
                  className="w-44 h-9"
                  placeholder="اسم النمط"
                  value={patternNameDraft}
                  onChange={(e) => setPatternNameDraft(e.target.value)}
                />
                <Button variant="outline" onClick={savePattern} disabled={!pattern}>
                  <Save className="w-4 h-4" /> حفظ النمط
                </Button>
              </div>
              {savedPatterns.length > 0 && (
                <Select onValueChange={loadSavedPattern}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="استدعاء نمط محفوظ" /></SelectTrigger>
                  <SelectContent>
                    {savedPatterns.map((p) => (
                      <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {isComputingDistribution && (
              <div className="text-xs rounded-md border bg-muted/30 p-3">
                جاري حساب أفضل توزيع... يتم فحص المواقع مع حدود أمان لمنع تعليق الواجهة.
              </div>
            )}

            {pattern && (
              <div className="text-xs rounded-md border bg-muted/30 p-3 space-y-0.5">
                <div className="font-semibold">علاقات الجوار المعتمدة:</div>
                <div>عدد القواعد: <b>{pattern.rules.length}</b></div>
                <div>الاتجاهات: <b>{pattern.rules.map(r => ({R:'يمين',L:'يسار',T:'أعلى',B:'أسفل'} as const)[r.dir]).join(' / ') || '—'}</b></div>
                <div>مكان الأصل وقت الاعتماد: <b>X={pattern.seedX.toFixed(2)} · Y={pattern.seedY.toFixed(2)}</b></div>
                <div>دوران الأصل: <b>{pattern.seedRotation}°</b></div>
                {pattern.rules.map((r, i) => (
                  <div key={i} className="text-[11px] text-muted-foreground">
                    {({R:'يمين',L:'يسار',T:'أعلى',B:'أسفل'} as const)[r.dir]}: ΔX={r.dx.toFixed(1)} ΔY={r.dy.toFixed(1)} دوران={r.rotation}°
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {(tilePlacements.length > 0 || debugRows.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>المعاينة — توزيع مبني من علاقات الجوار</span>
              <span className="text-xs font-normal text-muted-foreground">
                {tilePlacements.length} قالب · استغلال {usagePercent.toFixed(1)}%
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className="w-full rounded border bg-white"
              style={{ aspectRatio: `${sheetWmm} / ${sheetHmm}`, maxHeight: 640 }}
            >
              {previewSvg}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <Stat label="قواعد الجوار" value={distributionStats ? distributionStats.rulesUsed.toString() : (pattern ? pattern.rules.length.toString() : '—')} />
              <Stat label="إجمالي القوالب" value={distributionStats ? distributionStats.finalCopies.toString() : tilePlacements.length.toString()} />
              <Stat label="عدد المحاولات" value={distributionStats ? distributionStats.iterations.toString() : '—'} />
              <Stat label="حد الأمان" value={distributionStats ? (distributionStats.hitSafetyLimit ? 'تم الوصول' : 'لم يتم الوصول') : '—'} />
              <Stat label="حد النسخ" value={distributionStats ? distributionStats.maxCopies.toString() : '—'} />
              <Stat label="حد المحاولات" value={distributionStats ? distributionStats.maxIterations.toString() : '—'} />
              <Stat label="أفضل إزاحة Seed" value={distributionStats ? distributionStats.bestSeed : '—'} />
              <Stat label="نسبة الاستغلال" value={`${usagePercent.toFixed(1)}%`} />
              <Stat label="مقاس الشيت" value={`${sheetWmm} × ${sheetHmm} مم`} />
              <Stat label="التباعد بين النسخ" value={`${gapMm} مم`} />
              <Stat label="المساحة المتبقية" value={`${(100 - usagePercent).toFixed(1)}%`} />
              <Stat label="الاتجاهات المستخدمة" value={rotationsUsed} />
              <Stat label="مساحة الشيت (سم²)" value={(sheetArea / 100).toFixed(1)} />
              <Stat label="مساحة مستخدمة (سم²)" value={(usedArea / 100).toFixed(1)} />
            </div>
            {distributionStats?.hitSafetyLimit && (
              <div className="text-xs rounded-md border border-amber-200 bg-amber-50 text-amber-800 p-2">
                تم إيقاف البحث عند حد الأمان، وهذه أفضل نتيجة تم الوصول إليها.
              </div>
            )}
            {debugRows.length > 0 && (
              <div className="rounded-md border bg-muted/20 p-3 space-y-2">
                <div className="text-xs font-semibold">Debug — إعادة بناء علاقات الجوار حول Anchor اليدوي</div>
                <div className="overflow-auto">
                  <table className="w-full min-w-[760px] text-xs">
                    <thead className="border-b text-muted-foreground">
                      <tr>
                        <th className="py-1 text-right">Rule ID</th>
                        <th className="py-1 text-right">dx</th>
                        <th className="py-1 text-right">dy</th>
                        <th className="py-1 text-right">rotation</th>
                        <th className="py-1 text-right">candidate x</th>
                        <th className="py-1 text-right">candidate y</th>
                        <th className="py-1 text-right">inside</th>
                        <th className="py-1 text-right">duplicate</th>
                        <th className="py-1 text-right">collision</th>
                        <th className="py-1 text-right">accepted</th>
                        <th className="py-1 text-right">reject reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {debugRows.map((row) => (
                        <tr key={row.ruleId} className="border-b last:border-0">
                          <td className="py-1 font-semibold">{row.ruleId}</td>
                          <td className="py-1">{row.dx.toFixed(2)}</td>
                          <td className="py-1">{row.dy.toFixed(2)}</td>
                          <td className="py-1">{row.rotation}°</td>
                          <td className="py-1">{row.candidateX.toFixed(2)}</td>
                          <td className="py-1">{row.candidateY.toFixed(2)}</td>
                          <td className="py-1">{row.inside ? 'true' : 'false'}</td>
                          <td className="py-1">{row.duplicate ? 'true' : 'false'}</td>
                          <td className="py-1">{row.collision}</td>
                          <td className="py-1 font-semibold">{row.accepted ? 'true' : 'false'}</td>
                          <td className="py-1">{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <Button variant="outline" onClick={exportSvg}>
              <Download className="w-4 h-4" /> تصدير التوزيع SVG
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border bg-muted/30 p-2">
    <div className="text-[10px] text-muted-foreground">{label}</div>
    <div className="text-sm font-semibold">{value}</div>
  </div>
);

export default SvgAutoNestingCalculator;
