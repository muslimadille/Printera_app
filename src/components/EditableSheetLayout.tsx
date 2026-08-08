import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Edit3, RotateCw, Undo2, Redo2, Plus, Trash2, Check, Move, History, FileUp, ZoomIn, ZoomOut, Maximize2, AlertTriangle, Copy, Sparkles, FlipHorizontal, Lock, Unlock, Grid } from 'lucide-react';
import type { LayoutPiece } from '@/lib/sheetLayoutOptimizer';
import SheetLayoutExportMenu from './SheetLayoutExportMenu';
import AutoNestDialog from './AutoNestDialog';
import DielineImportDialog from './DielineImportDialog';
import type { ParsedDieline } from '@/lib/dielineImport';
import {
  translateRings,
  rotateRings90,
  shapesOverlap,
  shapeInsideSheet,
  polygonIntersection,
  polygonToSvgPath,
  type Polygon,
  type DielineShape,
} from '@/lib/dielineGeometry';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface EditableSheetLayoutProps {
  /** Sheet (canvas) dimensions in cm */
  sheetW: number;
  sheetH: number;
  /** Product piece base size in cm (un-rotated) */
  productW: number;
  productH: number;
  /** Gap between pieces in cm */
  gap: number;
  /** Pieces from the optimal scenario (used as the starting point + reset target) */
  optimalPieces: LayoutPiece[];
  /** Called whenever the user changes the layout — passes the live count */
  onCountChange?: (count: number, pieces: LayoutPiece[]) => void;
  /** Optional initial enabled state for editing (defaults to true) */
  initialEnabled?: boolean;
  /** Callback when user finishes/exits edit mode */
  onExitEdit?: () => void;
  /** Optional imported dieline; when present the user can stamp it into the sheet */
  importedDieline?: ParsedDieline | null;
  /** Called when a new dieline is imported from inside this editor */
  onDielineImported?: (dieline: ParsedDieline) => void;
  /**
   * Optional library of multiple imported dielines (used by the "Merge Items" tab).
   * When provided, the toolbar shows quick-pick chips to switch the active dieline
   * and an extra "+" import button. Purely additive — when omitted, behavior is
   * identical to before (single-dieline Hybrid Engine flow is untouched).
   */
  dielineLibrary?: ParsedDieline[];
  /** Called when the user picks a dieline from the library chips. */
  onDielineSelected?: (dieline: ParsedDieline) => void;
  /** Called when the user removes a dieline from the library. */
  onDielineRemoved?: (fileName: string) => void;
  /**
   * Engine variant for the auto-nest button.
   *  • 'basic'    → no auto-nest button (default — original behavior unchanged).
   *  • 'advanced' → shows the "تعشيق ذكي" button which runs the V2 engine
   *                 (per-piece 4-rotation + Skyline BLF). Used by the new
   *                 "مونتاج قالب" tab only.
   */
  engineVariant?: 'basic' | 'advanced';
  /** Optional native template dieline paths for drawing exact 2D box dielines */
  dielinePaths?: {
    cutD: string;
    creaseD: string;
    bbox: { w: number; h: number };
  } | null;
}

interface EditablePiece extends LayoutPiece {
  /** Quarter-turn rotation count (0, 1, 2, 3) for 0/90/180/270 degrees CW.
   *  When omitted, falls back to `rotated` (true → 1 quarter-turn). */
  rotation?: 0 | 1 | 2 | 3;
}

/** Returns the quarter-turn count for a piece (0..3). */
const turnsOf = (p: EditablePiece): number => {
  if (typeof p.rotation === 'number') return ((p.rotation % 4) + 4) % 4;
  return p.rotated ? 1 : 0;
};

/**
 * Build world-space rings of a piece (translated/rotated onto the sheet)
 * using the imported dieline shape. `useSimplified` swaps in the
 * Douglas-Peucker outline for smooth real-time dragging.
 *
 * Rotation is applied as N consecutive 90° CW turns around the dieline's
 * geometric centre, so 0/90/180/270 all align inside the same bounding box
 * (which is what the sheet packing math expects).
 */
const ringsForPiece = (
  p: EditablePiece,
  shape: DielineShape | null,
  useSimplified = false,
): Polygon[] | null => {
  if (!shape) return null;
  const base = useSimplified ? shape.ringsSimplified : shape.rings;
  const turns = turnsOf(p);
  let oriented = base;
  let curW = shape.width;
  let curH = shape.height;
  for (let t = 0; t < turns; t++) {
    oriented = rotateRings90(oriented, curW, curH);
    // After a 90° CW turn the dimensions swap.
    const tmp = curW;
    curW = curH;
    curH = tmp;
  }
  if (p.mirrored) {
    oriented = oriented.map((ring) => ring.map((pt) => ({ x: curW - pt.x, y: pt.y })));
  }
  return translateRings(oriented, p.x, p.y);
};

/** Rectangle-only fallback when no dieline shape is loaded. */
const overlapsRect = (a: EditablePiece, b: EditablePiece, gap: number) =>
  !(a.x + a.w + gap <= b.x ||
    b.x + b.w + gap <= a.x ||
    a.y + a.h + gap <= b.y ||
    b.y + b.h + gap <= a.y);

const fits = (p: EditablePiece, sheetW: number, sheetH: number) =>
  p.x >= 0 && p.y >= 0 && p.x + p.w <= sheetW + 1e-6 && p.y + p.h <= sheetH + 1e-6;

const snap = (v: number, grid: number) => (grid > 0 ? Math.round(v / grid) * grid : v);

export interface EditableSheetLayoutHandle {
  /** Returns a deep copy of the current pieces (positions, sizes, rotations). */
  getCurrentPieces: () => LayoutPiece[];
  /** Forces an immediate onCountChange callback with the current pieces. */
  syncNow: () => void;
}

const EditableSheetLayout = forwardRef<EditableSheetLayoutHandle, EditableSheetLayoutProps>(({
  sheetW,
  sheetH,
  productW,
  productH,
  gap,
  optimalPieces,
  onCountChange,
  importedDieline,
  onDielineImported,
  dielineLibrary,
  onDielineSelected,
  onDielineRemoved,
  engineVariant = 'basic',
  dielinePaths,
}, ref) => {
  const [enabled, setEnabled] = useState(false);
  const [autoNestOpen, setAutoNestOpen] = useState(false);
  
  // When a dieline is imported, its size overrides the product size used for new pieces.
  const effProductW = importedDieline?.width ?? productW;
  const effProductH = importedDieline?.height ?? productH;
  const [pieces, setPieces] = useState<EditablePiece[]>(optimalPieces);
  const [grid, setGrid] = useState(1);
  const [selectedIdxs, setSelectedIdxs] = useState<Set<number>>(new Set());
  /** Convenience: the "primary" selected index (first one). null if none. */
  const selectedIdx: number | null = selectedIdxs.size > 0
    ? Math.min(...Array.from(selectedIdxs))
    : null;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragState = useRef<{
    /** All indices being dragged together (the full active selection). */
    indices: number[];
    /** Pointer offset in cm relative to the *primary* (clicked) piece. */
    offsetX: number;
    offsetY: number;
    /** Pointer-down position of the clicked piece (so we can compute deltas). */
    anchorX: number;
    anchorY: number;
    startSnapshot: EditablePiece[];
    moved: boolean;
    /** When true (Alt held on pointer-down), the drag starts a duplicate. */
    duplicate: boolean;
    /** Indices of the freshly-cloned pieces being dragged (when duplicate=true). */
    clonedIndices: number[];
  } | null>(null);

  /** Marquee (rubber-band) selection state — set when user drags on empty sheet area. */
  const marqueeState = useRef<{ startX: number; startY: number; additive: boolean } | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Undo / redo history (capped at 50 steps)
  const HISTORY_LIMIT = 50;
  const [history, setHistory] = useState<EditablePiece[][]>([]);
  const [future, setFuture] = useState<EditablePiece[][]>([]);

  // Preview zoom (visual only — does not affect coordinates or math).
  const [zoom, setZoom] = useState(1);
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 3;
  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, +(z + 0.25).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, +(z - 0.25).toFixed(2)));
  const zoomReset = () => setZoom(1);

  const cloneState = (arr: EditablePiece[]): EditablePiece[] => arr.map((p) => ({ ...p }));

  /** Helper: set a single-piece selection (replaces prior selection). */
  const selectOnly = (idx: number | null) => {
    setSelectedIdxs(idx === null ? new Set() : new Set([idx]));
  };
  /** Helper: clear selection. */
  const clearSelection = () => setSelectedIdxs(new Set());

  /** Snapshot current pieces into history before a discrete mutation. */
  const pushHistory = (snapshot: EditablePiece[]) => {
    setHistory((h) => {
      const updated = [...h, cloneState(snapshot)];
      return updated.length > HISTORY_LIMIT ? updated.slice(updated.length - HISTORY_LIMIT) : updated;
    });
    setFuture([]);
  };

  const undo = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prevState = h[h.length - 1];
      setFuture((f) => [cloneState(pieces), ...f].slice(0, HISTORY_LIMIT));
      setPieces(prevState);
      clearSelection();
      return h.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const nextState = f[0];
      setHistory((h) => [...h, cloneState(pieces)].slice(-HISTORY_LIMIT));
      setPieces(nextState);
      clearSelection();
      return f.slice(1);
    });
  };

const safeToFixed = (val: any, decimals: number = 2): string => {
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(decimals) : '0';
};

  const optimalKey = useMemo(() => {
    if (!Array.isArray(optimalPieces)) return `${sheetW}_${sheetH}_${productW}_${productH}_0`;
    return `${sheetW}_${sheetH}_${productW}_${productH}_${optimalPieces.length}_` + optimalPieces.map(p => `${safeToFixed(p?.x)},${safeToFixed(p?.y)},${safeToFixed(p?.w)},${safeToFixed(p?.h)}`).join(';');
  }, [optimalPieces, sheetW, sheetH, productW, productH]);

  const prevKeyRef = useRef(optimalKey);

  // Reset internal state ONLY when the actual layout parameters or piece layout key change
  useEffect(() => {
    if (prevKeyRef.current !== optimalKey) {
      prevKeyRef.current = optimalKey;
      setPieces(optimalPieces.map((p) => ({ ...p })));
      clearSelection();
      setHistory([]);
      setFuture([]);
    }
  }, [optimalKey, optimalPieces]);

  // Lock uniform spacing state (from settings)
  const [lockSpacing, setLockSpacing] = useState(false);
  const [gapX, setGapX] = useState<number>(gap);
  const [gapY, setGapY] = useState<number>(gap);

  useEffect(() => {
    setGapX(gap);
    setGapY(gap);
  }, [gap]);

  // Keyboard shortcuts (Ctrl/Cmd+Z = undo, Ctrl/Cmd+Y = redo, Ctrl/Cmd+D = duplicate, Ctrl/Cmd+M = mirror)
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); redo(); }
      else if (key === 'd') { e.preventDefault(); duplicateSelected(); }
      else if (key === 'm') { e.preventDefault(); mirrorSelected(); }
      else if (key === 'a') {
        e.preventDefault();
        setSelectedIdxs(new Set(pieces.map((_, i) => i)));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pieces, history, future]);

  // Notify parent of any meaningful change to the pieces (count, position,
  // rotation, size). Previously this only fired on length changes, which
  // meant moving/rotating pieces never updated the parent's stored layout —
  // so saved presets captured a stale distribution.
  // We also fire when `enabled` is false so that programmatic seeding still
  // propagates to the parent (e.g. after a preset load).
  const lastReportedRef = useRef<number>(optimalPieces.length);
  const lastSignatureRef = useRef<string>('');
  // Always-fresh mirror of the current pieces array. Used by the imperative
  // syncNow() handle so the button never sees a stale closure.
  const piecesRef = useRef<EditablePiece[]>(pieces);
  useEffect(() => { piecesRef.current = pieces; }, [pieces]);

  const sigOf = (arr: EditablePiece[]) => (Array.isArray(arr) ? arr : [])
    .map((p) => `${safeToFixed(p?.x, 4)},${safeToFixed(p?.y, 4)},${safeToFixed(p?.w, 4)},${safeToFixed(p?.h, 4)},${turnsOf(p)}`)
    .join('|');

  useEffect(() => {
    const sig = sigOf(pieces);
    if (sig === lastSignatureRef.current && lastReportedRef.current === pieces.length) return;
    lastSignatureRef.current = sig;
    lastReportedRef.current = pieces.length;
    onCountChange?.(pieces.length, pieces);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieces]);

  // Imperative handle — uses piecesRef so the very latest layout is sent
  // even if React hasn't re-committed since the last edit.
  useImperativeHandle(ref, () => ({
    getCurrentPieces: () => piecesRef.current.map((p) => ({ ...p })),
    syncNow: () => {
      const cur = piecesRef.current;
      lastSignatureRef.current = sigOf(cur);
      lastReportedRef.current = cur.length;
      onCountChange?.(cur.length, cur.map((p) => ({ ...p })));
    },
  }), [onCountChange]);

  const maxSvgWidth = 360;
  const scale = Math.min(maxSvgWidth / sheetW, 240 / sheetH);
  const svgW = sheetW * scale;
  const svgH = sheetH * scale;

  // Visual-only landscape rotation (matches the smart engine preview).
  // When the sheet is portrait we rotate the SVG content 90° clockwise for display,
  // and invert that rotation here so drag math still operates in real sheet coordinates.
  const isPortrait = sheetH > sheetW;

  // Convert a client-space pointer position to real (un-rotated) sheet coordinates.
  // Uses getScreenCTM so any SVG transforms (including the portrait→landscape rotation
  // applied to the inner <g>) are inverted automatically.
  const pointToCm = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = (svg as any).getScreenCTM?.();
    const rect = svg.getBoundingClientRect();
    if (isPortrait) {
      // Displayed (rotated) viewport: width ↔ sheetH, height ↔ sheetW.
      const nx = (clientX - rect.left) / rect.width;
      const ny = (clientY - rect.top) / rect.height;
      return { x: ny * sheetW, y: sheetH - nx * sheetH };
    }
    const x = ((clientX - rect.left) / rect.width) * sheetW;
    const y = ((clientY - rect.top) / rect.height) * sheetH;
    return { x, y };
  };

  // Pre-resolve the dieline shape (concave polygon) from the imported file.
  const dlShape: DielineShape | null = importedDieline?.shape ?? null;

  /**
   * Validates a candidate placement. When a dieline shape is loaded, runs the
   * full shape-vs-shape collision against every other piece. `useSimplified`
   * lets the drag handler use the lower-resolution outline for performance,
   * while drop / button operations validate against the full geometry.
   * Bounds-checking also uses the actual outline rather than the bbox so that
   * concave outlines hugging the edge are accepted correctly.
   */
  const isValidPlacement = (candidate: EditablePiece, ignoreIdx: number, useSimplified = false) => {
    if (dlShape) {
      const candRings = ringsForPiece(candidate, dlShape, useSimplified);
      if (!candRings) return false;
      if (!shapeInsideSheet(candRings, sheetW, sheetH)) return false;
      for (let i = 0; i < pieces.length; i++) {
        if (i === ignoreIdx) continue;
        const otherRings = ringsForPiece(pieces[i], dlShape, useSimplified);
        if (!otherRings) continue;
        if (shapesOverlap(candRings, otherRings, gap)) return false;
      }
      return true;
    }
    // Fallback: rectangle collision (no dieline imported)
    if (!fits(candidate, sheetW, sheetH)) return false;
    for (let i = 0; i < pieces.length; i++) {
      if (i === ignoreIdx) continue;
      if (overlapsRect(candidate, pieces[i], gap)) return false;
    }
    return true;
  };

  const handlePointerDown = (e: React.PointerEvent<SVGGElement>, arrIdx: number) => {
    if (!enabled) return;
    e.stopPropagation();

    // Determine the active selection AFTER processing this click.
    // - Shift / Ctrl / Meta → toggle this piece in the current selection.
    // - Plain click on a non-selected piece → select only this piece.
    // - Plain click on an already-selected piece → keep the current selection
    //   (so the user can drag the whole group).
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    let activeSet: Set<number>;
    if (additive) {
      activeSet = new Set(selectedIdxs);
      if (activeSet.has(arrIdx)) activeSet.delete(arrIdx);
      else activeSet.add(arrIdx);
      setSelectedIdxs(activeSet);
      // Don't start a drag on a shift-toggle; user is just adjusting selection.
      return;
    }
    if (!selectedIdxs.has(arrIdx)) {
      activeSet = new Set([arrIdx]);
      setSelectedIdxs(activeSet);
    } else {
      activeSet = new Set(selectedIdxs);
    }

    const { x, y } = pointToCm(e.clientX, e.clientY);
    const p = pieces[arrIdx];

    // Alt / Option held → start a duplicate-drag: clone the active selection
    // and drag the clones (originals stay put).
    const altDuplicate = e.altKey;
    let indices = Array.from(activeSet).sort((a, b) => a - b);
    let clonedIndices: number[] = [];
    let snapshot = cloneState(pieces);
    if (altDuplicate) {
      pushHistory(pieces);
      const clones = indices.map((i) => ({ ...pieces[i] }));
      const startLen = pieces.length;
      const newIndices = clones.map((_, k) => startLen + k);
      setPieces((prev) => [
        ...prev,
        ...clones.map((c, k) => ({ ...c, index: prev.length + k + 1 })),
      ]);
      // From now on the drag operates on the clones, not the originals.
      indices = newIndices;
      clonedIndices = newIndices;
      setSelectedIdxs(new Set(newIndices));
      snapshot = [...snapshot, ...clones];
    }

    dragState.current = {
      indices,
      offsetX: x - p.x,
      offsetY: y - p.y,
      anchorX: p.x,
      anchorY: p.y,
      startSnapshot: snapshot,
      moved: false,
      duplicate: altDuplicate,
      clonedIndices,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  // Smart guides shown while dragging
  const [activeGuides, setActiveGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  // Overlap regions (red shading) shown while the user drags onto a colliding piece.
  // Each entry is a closed polygon (cm) describing the *exact* intersection area —
  // computed via Clipper boolean intersection on the real dieline outlines.
  const [overlapRegions, setOverlapRegions] = useState<Polygon[]>([]);
  const SNAP_TOL_CM = Math.max(0.3, Math.min(sheetW, sheetH) * 0.01);

  /**
   * Compute the *true* overlap regions between a candidate piece and every
   * other piece. When a dieline shape is available, uses Clipper polygon
   * intersection on the **full** (un-simplified) outlines so the red shading
   * matches the curved/tapered edges exactly. Falls back to rectangle
   * intersection only when no dieline is loaded.
   *
   * Note: collision *detection* during dragging still uses the simplified
   * outline for performance — only the visual shading uses full geometry.
   */
  const computeOverlapRegions = (cand: EditablePiece, ignoreIdx: number): Polygon[] => {
    const out: Polygon[] = [];
    // Use the FULL rings (not ringsSimplified) so the intersection captures
    // every curve and tapered flap of the dieline outline.
    const candRings = dlShape ? ringsForPiece(cand, dlShape, false) : null;
    for (let i = 0; i < pieces.length; i++) {
      if (i === ignoreIdx) continue;
      const o = pieces[i];
      if (dlShape && candRings) {
        const otherRings = ringsForPiece(o, dlShape, false);
        if (!otherRings) continue;
        const inter = polygonIntersection(candRings, otherRings);
        for (const poly of inter) if (poly.length >= 3) out.push(poly);
      } else {
        // Rectangle fallback (no dieline imported)
        const x1 = Math.max(cand.x, o.x);
        const y1 = Math.max(cand.y, o.y);
        const x2 = Math.min(cand.x + cand.w, o.x + o.w);
        const y2 = Math.min(cand.y + cand.h, o.y + o.h);
        if (x2 > x1 && y2 > y1) {
          out.push([
            { x: x1, y: y1 },
            { x: x2, y: y1 },
            { x: x2, y: y2 },
            { x: x1, y: y2 },
          ]);
        }
      }
    }
    return out;
  };

  const handlePointerMove = (e: React.PointerEvent<SVGGElement>) => {
    // ── Marquee selection (drag started on empty sheet area) ──
    if (marqueeState.current) {
      const { startX, startY } = marqueeState.current;
      const cur = pointToCm(e.clientX, e.clientY);
      const x = Math.min(startX, cur.x);
      const y = Math.min(startY, cur.y);
      const w = Math.abs(cur.x - startX);
      const h = Math.abs(cur.y - startY);
      setMarquee({ x, y, w, h });
      return;
    }

    if (!enabled || !dragState.current) return;
    const ds = dragState.current;
    const primaryIdx = ds.indices[0];
    if (primaryIdx == null) return;
    const { offsetX, offsetY, anchorX, anchorY } = ds;
    const { x, y } = pointToCm(e.clientX, e.clientY);
    const cur = pieces[primaryIdx];
    // Guard: indices captured at pointer-down may be stale if `pieces`
    // was re-seeded (e.g. parent passed a new optimalPieces array).
    if (!cur) {
      dragState.current = null;
      return;
    }

    let nx = snap(x - offsetX, grid);
    let ny = snap(y - offsetY, grid);

    // Snap targets: sheet edges/center + every non-dragged piece's edges/center
    const dragSet = new Set(ds.indices);
    const others = pieces.filter((_, i) => !dragSet.has(i));
    const vTargets: number[] = [0, sheetW / 2, sheetW];
    const hTargets: number[] = [0, sheetH / 2, sheetH];
    others.forEach((p) => {
      vTargets.push(p.x, p.x + p.w / 2, p.x + p.w);
      hTargets.push(p.y, p.y + p.h / 2, p.y + p.h);
    });

    const xCands = [nx, nx + cur.w / 2, nx + cur.w];
    const yCands = [ny, ny + cur.h / 2, ny + cur.h];

    let bestDx = Infinity;
    const matchedV: number[] = [];
    xCands.forEach((cx) => {
      vTargets.forEach((t) => {
        const d = t - cx;
        if (Math.abs(d) <= SNAP_TOL_CM) {
          matchedV.push(t);
          if (Math.abs(d) < Math.abs(bestDx)) bestDx = d;
        }
      });
    });
    let bestDy = Infinity;
    const matchedH: number[] = [];
    yCands.forEach((cy) => {
      hTargets.forEach((t) => {
        const d = t - cy;
        if (Math.abs(d) <= SNAP_TOL_CM) {
          matchedH.push(t);
          if (Math.abs(d) < Math.abs(bestDy)) bestDy = d;
        }
      });
    });
    if (bestDx !== Infinity) nx += bestDx;
    if (bestDy !== Infinity) ny += bestDy;

    const guides = { v: Array.from(new Set(matchedV)), h: Array.from(new Set(matchedH)) };
    if (nx === cur.x && ny === cur.y) {
      setActiveGuides(guides);
      setOverlapRegions(computeOverlapRegions(cur, primaryIdx));
      return;
    }

    // Compute group delta from the original anchor — preserves relative spacing.
    const dx = nx - anchorX;
    const dy = ny - anchorY;
    // Take the snapshot positions for all dragged indices and offset by (dx, dy).
    const snap0 = ds.startSnapshot;
    setPieces((prev) =>
      prev.map((p, i) => {
        if (!dragSet.has(i)) return p;
        const base = snap0[i] ?? p;
        return { ...p, x: base.x + dx, y: base.y + dy };
      }),
    );
    // Overlap shading: compute against the primary piece's new position only.
    const candidate = { ...cur, x: nx, y: ny };
    setOverlapRegions(computeOverlapRegions(candidate, primaryIdx));
    ds.moved = true;
    setActiveGuides(guides);
  };

  const handlePointerUp = (e?: React.PointerEvent<SVGGElement>) => {
    // Finalize a marquee selection.
    if (marqueeState.current && marquee) {
      const { additive } = marqueeState.current;
      const { x, y, w, h } = marquee;
      // Pick any piece whose bounding rect intersects the marquee rect.
      const hits: number[] = [];
      pieces.forEach((p, i) => {
        const ix = !(p.x + p.w < x || p.x > x + w);
        const iy = !(p.y + p.h < y || p.y > y + h);
        if (ix && iy) hits.push(i);
      });
      setSelectedIdxs((prev) => {
        const next = additive ? new Set(prev) : new Set<number>();
        hits.forEach((i) => next.add(i));
        return next;
      });
      marqueeState.current = null;
      setMarquee(null);
      return;
    }

    const ds = dragState.current;
    if (ds?.moved) {
      // Flexible mode: always commit the move and snapshot for undo.
      // The final overlap/out-of-bounds check happens when the user exits
      // or exports — see `attemptExit` and `validateLayout` below.
      pushHistory(ds.startSnapshot);
    } else if (ds?.duplicate && !ds.moved && ds.clonedIndices.length > 0) {
      // Alt-click without movement: undo the speculative duplicate.
      const { clonedIndices } = ds;
      setPieces((prev) => prev.filter((_, i) => !clonedIndices.includes(i)).map((p, i) => ({ ...p, index: i + 1 })));
      // Restore the originals as the active selection.
      setSelectedIdxs(new Set(ds.indices.map((i) => i - clonedIndices.length)));
    }
    dragState.current = null;
    setActiveGuides({ v: [], h: [] });
    setOverlapRegions([]);
  };

  /** Pointer-down on the empty sheet area — start a marquee box selection. */
  const handleSheetPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!enabled) return;
    // Ignore when clicking inside a piece (its own handler stops propagation).
    const { x, y } = pointToCm(e.clientX, e.clientY);
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    if (!additive) clearSelection();
    marqueeState.current = { startX: x, startY: y, additive };
    setMarquee({ x, y, w: 0, h: 0 });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const rotateSelected = () => {
    if (pieces.length === 0) return;
    pushHistory(pieces);
    setPieces((prev) => {
      const targetIndices = selectedIdxs.size > 0 ? selectedIdxs : new Set(prev.map((_, i) => i));
      return prev.map((cur, i) => {
        if (!targetIndices.has(i)) return cur;
        const curTurns = turnsOf(cur);
        const nextTurns = ((curTurns + 1) % 4) as 0 | 1 | 2 | 3;
        const newW = cur.h;
        const newH = cur.w;
        const cx = cur.x + cur.w / 2;
        const cy = cur.y + cur.h / 2;
        return {
          ...cur,
          x: cx - newW / 2,
          y: cy - newH / 2,
          w: newW,
          h: newH,
          rotated: nextTurns % 2 === 1,
          rotation: nextTurns,
        };
      });
    });
  };

  const mirrorSelected = () => {
    if (pieces.length === 0) return;
    pushHistory(pieces);
    setPieces((prev) => {
      const targetIndices = selectedIdxs.size > 0 ? selectedIdxs : new Set(prev.map((_, i) => i));
      return prev.map((cur, i) => {
        if (!targetIndices.has(i)) return cur;
        return {
          ...cur,
          mirrored: !cur.mirrored,
        };
      });
    });
    toast({
      title: 'انعكاس أفقياً (ميرور)',
      description: `تم تعكيس اتجاه ${selectedIdxs.size} قطعة أفقياً.`,
    });
  };

  const applyUniformSpacing = (customGapX?: number, customGapY?: number) => {
    const gx = customGapX ?? gapX;
    const gy = customGapY ?? gapY;
    if (pieces.length === 0) return;
    pushHistory(pieces);

    const pW = pieces[0].w;
    const pH = pieces[0].h;
    const cols = Math.max(1, Math.floor((sheetW + gx) / (pW + gx)));

    setPieces((prev) =>
      prev.map((p, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        return {
          ...p,
          x: snap(c * (p.w + gx), grid),
          y: snap(r * (p.h + gy), grid),
        };
      }),
    );
    toast({
      title: 'تثبيت وتنسيق المسافات بين القوالب',
      description: `تم إعادة ضبط المسافات بين جميع القوالب بتباعد (${gx} سم × ${gy} سم).`,
    });
  };

  const deleteSelected = () => {
    if (selectedIdxs.size === 0) return;
    pushHistory(pieces);
    setPieces((prev) => prev.filter((_, i) => !selectedIdxs.has(i)).map((p, i) => ({ ...p, index: i + 1 })));
    clearSelection();
  };

  /**
   * Duplicate the active selection, preserving each piece's position, rotation,
   * size, and the spatial relationships between them. The clones are placed
   * with a small offset (right/down) so they don't sit exactly on top of the
   * originals, and they become the new active selection.
   */
  const duplicateSelected = () => {
    if (selectedIdxs.size === 0) return;
    const indices = Array.from(selectedIdxs).sort((a, b) => a - b);
    const offset = Math.max(grid, 1); // small visual nudge
    pushHistory(pieces);
    const startLen = pieces.length;
    const clones: EditablePiece[] = indices.map((i, k) => {
      const src = pieces[i];
      return {
        ...src,
        x: src.x + offset,
        y: src.y + offset,
        index: startLen + k + 1,
      };
    });
    const newIndices = clones.map((_, k) => startLen + k);
    setPieces((prev) => [...prev, ...clones]);
    setSelectedIdxs(new Set(newIndices));
  };

  // Add a piece freely — mirrors the flexibility of move/rotate.
  // No bounds or overlap restriction is enforced here; the user is free to
  // place the new piece wherever they like, and the final overlap /
  // out-of-bounds check happens only on Exit / Export (see `validateLayout`).
  // We first try to find a free spot for convenience, but if none exists we
  // still add the piece (defaulting near the top-left or beside the selection).
  const addPiece = () => {
    const w = effProductW;
    const h = effProductH;
    const step = Math.max(grid, 0.5);

    // Convenience pass: try to find an in-bounds, non-overlapping spot.
    for (const rot of [false, true]) {
      const cw = rot ? h : w;
      const ch = rot ? w : h;
      for (let y = 0; y + ch <= sheetH + 1e-6; y += step) {
        for (let x = 0; x + cw <= sheetW + 1e-6; x += step) {
          const candidate: EditablePiece = {
            x: snap(x, grid),
            y: snap(y, grid),
            w: cw,
            h: ch,
            rotated: rot,
            index: pieces.length + 1,
          };
          if (isValidPlacement(candidate, -1)) {
            pushHistory(pieces);
            setPieces((prev) => [...prev, candidate]);
            selectOnly(pieces.length);
            return;
          }
        }
      }
    }

    // Fallback: add freely even if it overlaps or sits outside the sheet.
    // Position it near the currently selected piece (offset) or at origin.
    const base = selectedIdx != null ? pieces[selectedIdx] : null;
    const fx = base ? snap(base.x + Math.max(grid, 1), grid) : 0;
    const fy = base ? snap(base.y + Math.max(grid, 1), grid) : 0;
    const fallback: EditablePiece = {
      x: fx,
      y: fy,
      w,
      h,
      rotated: false,
      index: pieces.length + 1,
    };
    pushHistory(pieces);
    setPieces((prev) => [...prev, fallback]);
    selectOnly(pieces.length);
  };

  const resetToOptimal = () => {
    const optimal = optimalPieces.map((p) => ({ ...p }));
    const same =
      pieces.length === optimal.length &&
      pieces.every((p, i) => p.x === optimal[i].x && p.y === optimal[i].y && p.w === optimal[i].w && p.h === optimal[i].h);
    if (!same) pushHistory(pieces);
    setPieces(optimal);
    clearSelection();
  };

  // ────────────────────────────────────────────────────────────────────
  // Final-pass validation (used on Exit / Export)
  // Counts overlapping pairs and out-of-bounds pieces using the FULL
  // (un-simplified) dieline geometry. Edit Mode allows these states freely;
  // this check only runs when the user wants to commit / export.
  // ────────────────────────────────────────────────────────────────────
  const validateLayout = useMemo(() => {
    let overlapPairs = 0;
    let outOfBounds = 0;
    for (let i = 0; i < pieces.length; i++) {
      const a = pieces[i];
      // Bounds check
      if (dlShape) {
        const aRings = ringsForPiece(a, dlShape, false);
        if (aRings && !shapeInsideSheet(aRings, sheetW, sheetH)) outOfBounds++;
      } else if (!fits(a, sheetW, sheetH)) {
        outOfBounds++;
      }
      // Pairwise overlap check
      for (let j = i + 1; j < pieces.length; j++) {
        const b = pieces[j];
        if (dlShape) {
          const ar = ringsForPiece(a, dlShape, false);
          const br = ringsForPiece(b, dlShape, false);
          if (ar && br && shapesOverlap(ar, br, gap)) overlapPairs++;
        } else if (overlapsRect(a, b, gap)) {
          overlapPairs++;
        }
      }
    }
    return { overlapPairs, outOfBounds, hasIssues: overlapPairs > 0 || outOfBounds > 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieces, dlShape, sheetW, sheetH, gap]);

  const [pendingExit, setPendingExit] = useState(false);

  const attemptExit = () => {
    if (validateLayout.hasIssues) {
      setPendingExit(true);
      return;
    }
    setEnabled(false);
    clearSelection();
    onExitEdit?.();
  };

  const exitEdit = () => {
    setEnabled(false);
    clearSelection();
    setPendingExit(false);
    onExitEdit?.();
  };

  const isModified =
    pieces.length !== optimalPieces.length ||
    pieces.some((p, i) => {
      const o = optimalPieces[i];
      return !o || o.x !== p.x || o.y !== p.y || o.w !== p.w || o.h !== p.h;
    });

  const usagePercent = useMemo(() => {
    const used = pieces.reduce((s, p) => s + p.w * p.h, 0);
    const total = sheetW * sheetH;
    return total > 0 ? (used / total) * 100 : 0;
  }, [pieces, sheetW, sheetH]);

  if (optimalPieces.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Edit3 className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">وضع التعديل اليدوي</span>
          {enabled && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
              {pieces.length} قطعة {isModified ? '(معدّل)' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {onDielineImported && (
            <DielineImportDialog onImported={onDielineImported} compact />
          )}
          {dielineLibrary && dielineLibrary.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {dielineLibrary.map((dl) => {
                const active = importedDieline?.fileName === dl.fileName;
                return (
                  <span
                    key={dl.fileName}
                    className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
                      active
                        ? 'bg-primary/15 text-primary border-primary/40'
                        : 'bg-muted text-muted-foreground border-border hover:bg-muted/70 cursor-pointer'
                    }`}
                    onClick={() => !active && onDielineSelected?.(dl)}
                    title={`${safeToFixed(dl?.width, 1)}×${safeToFixed(dl?.height, 1)} سم`}
                  >
                    {dl.fileName}
                    {onDielineRemoved && (
                      <button
                        type="button"
                        className="ml-0.5 text-destructive hover:text-destructive/70"
                        onClick={(e) => { e.stopPropagation(); onDielineRemoved(dl.fileName); }}
                        aria-label="حذف القالب"
                      >×</button>
                    )}
                  </span>
                );
              })}
            </div>
          )}
          {importedDieline && (!dielineLibrary || dielineLibrary.length === 0) && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">
              قالب: {importedDieline.fileName} ({safeToFixed(importedDieline?.width, 1)}×{safeToFixed(importedDieline?.height, 1)})
            </span>
          )}
          <SheetLayoutExportMenu
            sheetW={sheetW}
            sheetH={sheetH}
            pieces={pieces}
            baseName={`layout-${sheetW}x${sheetH}-${pieces.length}pcs`}
            dieline={importedDieline}
            dielinePaths={dielinePaths}
            compact
          />
          {!enabled ? (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setEnabled(true)}>
              <Edit3 className="w-3 h-3" />
              تفعيل التعديل
            </Button>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={attemptExit}>
              <Check className="w-3 h-3" />
              إنهاء
            </Button>
          )}
          {enabled && validateLayout.hasIssues && (
            <span
              className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive border border-destructive/30"
              title="يوجد تداخل أو تجاوز حدود الشيت — يمكنك المتابعة في وضع التعديل، وسيظهر تنبيه عند الإنهاء"
            >
              <AlertTriangle className="w-3 h-3" />
              {validateLayout.overlapPairs > 0 && `تداخل: ${validateLayout.overlapPairs}`}
              {validateLayout.overlapPairs > 0 && validateLayout.outOfBounds > 0 && ' • '}
              {validateLayout.outOfBounds > 0 && `خارج الحدود: ${validateLayout.outOfBounds}`}
            </span>
          )}
        </div>
      </div>

      {enabled && (
        <>
          <div className="flex items-center gap-2 flex-wrap text-[10px]">
            <label className="text-muted-foreground whitespace-nowrap">دقة الشبكة (سم):</label>
            <input
              type="number"
              min={0.1}
              max={5}
              step={0.1}
              value={grid}
              onChange={(e) => setGrid(Math.max(0.1, Math.min(5, Number(e.target.value) || 0.1)))}
              className="h-6 w-16 rounded border border-input bg-background px-1.5 text-xs"
            />
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">الاستغلال: {safeToFixed(usagePercent, 1)}%</span>
            <div className="flex items-center gap-1 mr-auto flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] gap-1"
                onClick={undo}
                disabled={history.length === 0}
                title="تراجع (Ctrl+Z)"
              >
                <Undo2 className="w-3 h-3" /> تراجع
                {history.length > 0 && <span className="text-muted-foreground">({history.length})</span>}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] gap-1"
                onClick={redo}
                disabled={future.length === 0}
                title="إعادة (Ctrl+Y)"
              >
                <Redo2 className="w-3 h-3" /> إعادة
                {future.length > 0 && <span className="text-muted-foreground">({future.length})</span>}
              </Button>
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1" onClick={addPiece}>
                <Plus className="w-3 h-3" /> إضافة
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] gap-1 font-semibold border-blue-200 text-blue-700 hover:bg-blue-50"
                onClick={rotateSelected}
                disabled={pieces.length === 0}
                title="تدوير 90° متتالية مع كل ضغطة (0° → 90° → 180° → 270°)"
              >
                <RotateCw className="w-3 h-3" />
                تدوير 90°
                {pieces.length > 0 && (
                  <span className="text-blue-600 font-bold bg-blue-100 px-1 rounded font-sans">
                    {turnsOf(pieces[selectedIdx ?? 0]) * 90}°
                  </span>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] gap-1 font-semibold border-slate-200 text-slate-700 hover:bg-slate-50"
                onClick={mirrorSelected}
                disabled={pieces.length === 0}
                title="ميرور / انعكاس أفقي للقالب (Ctrl+M)"
              >
                <FlipHorizontal className="w-3 h-3" />
                ميرور
                {pieces.length > 0 && pieces[selectedIdx ?? 0]?.mirrored && (
                  <span className="text-emerald-600 font-bold font-sans">✓</span>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] gap-1"
                onClick={duplicateSelected}
                disabled={selectedIdxs.size === 0}
                title="نسخ التحديد بنفس الوضعية (Ctrl+D)"
              >
                <Copy className="w-3 h-3" /> نسخ
                {selectedIdxs.size > 1 && (
                  <span className="text-muted-foreground">({selectedIdxs.size})</span>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] gap-1 text-destructive"
                onClick={deleteSelected}
                disabled={selectedIdxs.size === 0}
              >
                <Trash2 className="w-3 h-3" /> حذف
                {selectedIdxs.size > 1 && (
                  <span className="text-muted-foreground">({selectedIdxs.size})</span>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] gap-1"
                onClick={resetToOptimal}
                disabled={!isModified}
                title="إعادة إلى أفضل نتيجة"
              >
                <History className="w-3 h-3" /> الأمثل
              </Button>
              {engineVariant === 'advanced' && (
                <Button
                  size="sm"
                  variant="default"
                  className="h-6 px-2 text-[10px] gap-1 bg-gradient-to-r from-primary to-primary/80"
                  onClick={() => setAutoNestOpen(true)}
                  disabled={!importedDieline?.shape}
                  title="تعشيق ذكي متقدم: 4 اتجاهات + Skyline BLF"
                >
                  <Sparkles className="w-3 h-3" /> تعشيق ذكي
                </Button>
              )}
            </div>
          </div>

          {/* Controls bar: Lock Uniform Spacing & Gaps */}
          <div className="flex items-center gap-3 p-2 rounded-lg bg-background border border-border/60 text-[10px] flex-wrap">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Button
                size="sm"
                variant={lockSpacing ? 'default' : 'outline'}
                className={`h-6 px-2 text-[10px] gap-1 ${lockSpacing ? 'bg-primary text-primary-foreground' : ''}`}
                onClick={() => {
                  const nextLock = !lockSpacing;
                  setLockSpacing(nextLock);
                  if (nextLock) applyUniformSpacing();
                }}
                title="تثبيت القواعد والمسافات بين القوالب من الإعدادات"
              >
                {lockSpacing ? <Lock className="w-3 h-3 text-emerald-400" /> : <Unlock className="w-3 h-3" />}
                {lockSpacing ? 'المسافات مثبتة' : 'تثبيت المسافات'}
              </Button>
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-muted-foreground whitespace-nowrap">التباعد الأفقي (سم):</label>
              <input
                type="number"
                min={0}
                max={20}
                step={0.1}
                value={gapX}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  setGapX(val);
                  if (lockSpacing) applyUniformSpacing(val, gapY);
                }}
                className="h-6 w-14 rounded border border-input bg-background px-1 text-xs text-center"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <label className="text-muted-foreground whitespace-nowrap">التباعد العمودي (سم):</label>
              <input
                type="number"
                min={0}
                max={20}
                step={0.1}
                value={gapY}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  setGapY(val);
                  if (lockSpacing) applyUniformSpacing(gapX, val);
                }}
                className="h-6 w-14 rounded border border-input bg-background px-1 text-xs text-center"
              />
            </div>

            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px] gap-1 mr-auto"
              onClick={() => applyUniformSpacing()}
              title="إعادة توزيع جميع القوالب بمسافات منتظمة فوراً"
            >
              <Grid className="w-3 h-3" />
              تنسيق المسافات
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground flex items-center gap-1 flex-wrap">
            <Move className="w-3 h-3" /> اسحب لتحريك • Shift/Ctrl+نقر لتحديد متعدد • Alt+سحب نسخة • Ctrl+D نسخ • Ctrl+M ميرور • أسهم الكيبورد للتحريك الدقيق
          </p>
        </>
      )}

      {/* Zoom toolbar — visual-only scaling of the preview */}
      <div className="flex items-center justify-end gap-1 text-[10px]">
        <span className="text-muted-foreground">تكبير:</span>
        <Button
          size="sm"
          variant="outline"
          className="h-6 w-6 p-0"
          onClick={zoomOut}
          disabled={zoom <= ZOOM_MIN + 1e-6}
          title="تصغير"
        >
          <ZoomOut className="w-3 h-3" />
        </Button>
        <span className="min-w-[2.75rem] text-center tabular-nums font-semibold">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-6 w-6 p-0"
          onClick={zoomIn}
          disabled={zoom >= ZOOM_MAX - 1e-6}
          title="تكبير"
        >
          <ZoomIn className="w-3 h-3" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-1.5"
          onClick={zoomReset}
          disabled={Math.abs(zoom - 1) < 1e-6}
          title="إعادة الحجم"
        >
          <Maximize2 className="w-3 h-3" />
        </Button>
      </div>

      <div
        className="relative flex justify-center bg-background rounded-md border border-border/50 p-2 overflow-auto"
        style={{ maxHeight: zoom > 1 ? '70vh' : undefined }}
      >
        {(() => {
          const hasPieces = pieces.length > 0;
          const bbMinX = hasPieces ? Math.min(...pieces.map((p) => p.x)) : 0;
          const bbMinY = hasPieces ? Math.min(...pieces.map((p) => p.y)) : 0;
          const bbMaxX = hasPieces ? Math.max(...pieces.map((p) => p.x + p.w)) : 0;
          const bbMaxY = hasPieces ? Math.max(...pieces.map((p) => p.y + p.h)) : 0;
          const bbW = Math.max(0, bbMaxX - bbMinX);
          const bbH = Math.max(0, bbMaxY - bbMinY);

          const padX = Math.max(sheetW * 0.09, 3);
          const padY = Math.max(sheetH * 0.11, 3);
          // viewBox dims based on real sheet, then swap for portrait so display is landscape
          const realVbW = sheetW + padX * 2;
          const realVbH = sheetH + padY * 2;
          const vbW = isPortrait ? realVbH : realVbW;
          const vbH = isPortrait ? realVbW : realVbH;
          const labelFont = Math.max(Math.min(sheetW, sheetH) * 0.045, 1.6);
          const baseScale = Math.min(maxSvgWidth / vbW, 260 / vbH);
          // Apply zoom on top of the auto-fit base scale.
          const innerScale = baseScale * zoom;
          const renderW = vbW * innerScale;
          const renderH = vbH * innerScale;
          const guideStroke = Math.max(0.12, 0.4 / innerScale);
          // Rotation transform: rotate scene +90° CW so a portrait sheet displays landscape.
          // After rotate(90), point (x, y) → (-y, x); translate by sheetH to bring it back into view.
          const rotateAttr = isPortrait ? `translate(${sheetH} 0) rotate(90)` : undefined;
          return (
            <svg
              ref={svgRef}
              width={renderW}
              height={renderH}
              viewBox={isPortrait ? `${-padY} ${-padX} ${realVbH} ${realVbW}` : `${-padX} ${-padY} ${realVbW} ${realVbH}`}
              className="block touch-none select-none"
              style={zoom > 1 ? { width: renderW, height: renderH } : { maxWidth: '100%', height: 'auto' }}
              onPointerDown={handleSheetPointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              <g transform={rotateAttr}>
              {/* Top: sheet width */}
              <g fontFamily="Cairo, sans-serif" fill="hsl(var(--muted-foreground))">
                <line x1={0} y1={-padY * 0.45} x2={sheetW} y2={-padY * 0.45} stroke="hsl(var(--muted-foreground))" strokeWidth={0.08} />
                <line x1={0} y1={-padY * 0.55} x2={0} y2={-padY * 0.35} stroke="hsl(var(--muted-foreground))" strokeWidth={0.08} />
                <line x1={sheetW} y1={-padY * 0.55} x2={sheetW} y2={-padY * 0.35} stroke="hsl(var(--muted-foreground))" strokeWidth={0.08} />
                <text x={sheetW / 2} y={-padY * 0.6} textAnchor="middle" fontSize={labelFont} fontWeight="600">
                  {sheetW} سم
                </text>
              </g>

              {/* Right: sheet height */}
              <g fontFamily="Cairo, sans-serif" fill="hsl(var(--muted-foreground))">
                <line x1={sheetW + padX * 0.45} y1={0} x2={sheetW + padX * 0.45} y2={sheetH} stroke="hsl(var(--muted-foreground))" strokeWidth={0.08} />
                <line x1={sheetW + padX * 0.35} y1={0} x2={sheetW + padX * 0.55} y2={0} stroke="hsl(var(--muted-foreground))" strokeWidth={0.08} />
                <line x1={sheetW + padX * 0.35} y1={sheetH} x2={sheetW + padX * 0.55} y2={sheetH} stroke="hsl(var(--muted-foreground))" strokeWidth={0.08} />
                <text
                  x={sheetW + padX * 0.6}
                  y={sheetH / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={labelFont}
                  fontWeight="600"
                  transform={`rotate(90, ${sheetW + padX * 0.6}, ${sheetH / 2})`}
                >
                  {sheetH} سم
                </text>
              </g>

              {/* Bottom: total used width (pieces bbox) */}
              {hasPieces && bbW > 0 && (
                <g fontFamily="Cairo, sans-serif" fill="hsl(var(--primary))">
                  <line x1={bbMinX} y1={sheetH + padY * 0.45} x2={bbMaxX} y2={sheetH + padY * 0.45} stroke="hsl(var(--primary))" strokeWidth={0.08} />
                  <line x1={bbMinX} y1={sheetH + padY * 0.35} x2={bbMinX} y2={sheetH + padY * 0.55} stroke="hsl(var(--primary))" strokeWidth={0.08} />
                  <line x1={bbMaxX} y1={sheetH + padY * 0.35} x2={bbMaxX} y2={sheetH + padY * 0.55} stroke="hsl(var(--primary))" strokeWidth={0.08} />
                  <text x={(bbMinX + bbMaxX) / 2} y={sheetH + padY * 0.85} textAnchor="middle" fontSize={labelFont} fontWeight="700">
                    عرض القطع: {safeToFixed(bbW, 1)} سم
                  </text>
                </g>
              )}

              {/* Left: total used height (pieces bbox) */}
              {hasPieces && bbH > 0 && (
                <g fontFamily="Cairo, sans-serif" fill="hsl(var(--primary))">
                  <line x1={-padX * 0.45} y1={bbMinY} x2={-padX * 0.45} y2={bbMaxY} stroke="hsl(var(--primary))" strokeWidth={0.08} />
                  <line x1={-padX * 0.55} y1={bbMinY} x2={-padX * 0.35} y2={bbMinY} stroke="hsl(var(--primary))" strokeWidth={0.08} />
                  <line x1={-padX * 0.55} y1={bbMaxY} x2={-padX * 0.35} y2={bbMaxY} stroke="hsl(var(--primary))" strokeWidth={0.08} />
                  <text
                    x={-padX * 0.75}
                    y={(bbMinY + bbMaxY) / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={labelFont}
                    fontWeight="700"
                    transform={`rotate(-90, ${-padX * 0.75}, ${(bbMinY + bbMaxY) / 2})`}
                  >
                    ارتفاع القطع: {safeToFixed(bbH, 1)} سم
                  </text>
                </g>
              )}

              <rect
                x={0}
                y={0}
                width={sheetW}
                height={sheetH}
                fill="hsl(var(--muted))"
                stroke="hsl(var(--border))"
                strokeWidth={0.5 / innerScale}
              />
              {enabled && grid > 0 && (
                <g opacity={0.25}>
                  {Array.from({ length: Math.floor(sheetW / grid) + 1 }).map((_, i) => (
                    <line key={`vx${i}`} x1={i * grid} y1={0} x2={i * grid} y2={sheetH} stroke="hsl(var(--border))" strokeWidth={0.15 / innerScale} />
                  ))}
                  {Array.from({ length: Math.floor(sheetH / grid) + 1 }).map((_, i) => (
                    <line key={`hy${i}`} x1={0} y1={i * grid} x2={sheetW} y2={i * grid} stroke="hsl(var(--border))" strokeWidth={0.15 / innerScale} />
                  ))}
                </g>
              )}

              {/* Pieces bbox dashed outline */}
              {hasPieces && bbW > 0 && bbH > 0 && (
                <rect
                  x={bbMinX}
                  y={bbMinY}
                  width={bbW}
                  height={bbH}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth={0.15 / innerScale}
                  strokeDasharray={`${0.6} ${0.6}`}
                  opacity={0.45}
                  style={{ pointerEvents: 'none' }}
                />
              )}

              {pieces.map((p, i) => {
                const selected = selectedIdxs.has(i);
                const fillColor = selected ? 'hsl(var(--primary) / 0.35)' : 'hsl(var(--primary) / 0.18)';
                const strokeColor = 'hsl(var(--primary))';
                const dlW = importedDieline?.width ?? 0;
                const dlH = importedDieline?.height ?? 0;
                const showDieline = !!importedDieline && dlW > 0 && dlH > 0;
                // When a dieline shape is parsed, draw the *actual* outline as the
                // piece silhouette so the user sees the real curved/tapered edges
                // (and where they overlap a neighbour) — instead of a rectangle.
                const pieceRings = dlShape ? ringsForPiece(p, dlShape, false) : null;
                const outlinePath = pieceRings && pieceRings.length > 0
                  ? pieceRings.map(polygonToSvgPath).join(' ')
                  : null;
                // Extract viewBox from imported dieline svgMarkup
                let dielineVB = `0 0 ${dlW} ${dlH}`;
                let dielineInner = '';
                if (showDieline) {
                  const m = importedDieline!.svgMarkup.match(/viewBox\s*=\s*"([^"]+)"/);
                  if (m) dielineVB = m[1];
                  dielineInner = importedDieline!.svgMarkup
                    .replace(/^<svg[^>]*>/i, '')
                    .replace(/<\/svg>\s*$/i, '');
                }
                return (
                  <g key={i} onPointerDown={(e) => handlePointerDown(e, i)} style={{ cursor: enabled ? 'grab' : 'default' }}>
                    {outlinePath ? (
                      <>
                        {/* Invisible bbox rect — keeps the whole piece area pointer-interactive */}
                        <rect
                          x={p.x}
                          y={p.y}
                          width={p.w}
                          height={p.h}
                          fill="transparent"
                        />
                        {/* Real dieline silhouette — fill + outline */}
                        <path
                          d={outlinePath}
                          fill={fillColor}
                          stroke={strokeColor}
                          strokeWidth={(selected ? 0.6 : 0.3) / innerScale}
                          strokeLinejoin="round"
                          fillRule="evenodd"
                          style={{ pointerEvents: 'none' }}
                        />
                      </>
                    ) : dielinePaths && dielinePaths.cutD ? (() => {
                      const turns = turnsOf(p);
                      const bboxW = dielinePaths.bbox.w;
                      const bboxH = dielinePaths.bbox.h;
                      // Determine unit scaling: if bboxW > 30 (which means it's in mm e.g. 194mm), scale is 0.1 to convert to cm
                      const scaleFactor = bboxW > 30 ? 0.1 : 1;
                      const cx = p.x + p.w / 2;
                      const cy = p.y + p.h / 2;
                      const angle = turns * 90;
                      // Center origin in native mm coordinates
                      const mmCx = bboxW / 2;
                      const mmCy = bboxH / 2;
                      const transform = `translate(${cx} ${cy}) scale(${scaleFactor}) rotate(${angle}) ${p.mirrored ? 'scale(-1, 1)' : ''} translate(${-mmCx} ${-mmCy})`;

                      const strokeCutWidth = (selected ? 2.5 : 1.4) / innerScale;
                      const strokeCreaseWidth = 1.0 / innerScale;
                      const numSize = Math.min(bboxW, bboxH) * 0.22;

                      return (
                        <>
                          {/* Invisible touch/drag container */}
                          <rect
                            x={p.x}
                            y={p.y}
                            width={p.w}
                            height={p.h}
                            fill="transparent"
                            stroke={selected ? 'hsl(var(--primary))' : 'none'}
                            strokeWidth={(selected ? 0.3 : 0) / innerScale}
                            strokeDasharray="0.4 0.4"
                            rx={0.2}
                          />
                          <g transform={transform} style={{ pointerEvents: 'none' }}>
                            {/* White paper background shape of the dieline cut */}
                            <path d={dielinePaths.cutD} fill={selected ? 'hsl(var(--primary) / 0.18)' : '#ffffff'} stroke="none" />
                            
                            {/* Green dashed crease lines */}
                            {dielinePaths.creaseD && (
                              <path
                                d={dielinePaths.creaseD}
                                fill="none"
                                stroke="#00A651"
                                strokeWidth={strokeCreaseWidth}
                                strokeDasharray="3 2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            )}
                            
                            {/* Red solid outer cut lines */}
                            <path
                              d={dielinePaths.cutD}
                              fill="none"
                              stroke="#ED1C24"
                              strokeWidth={strokeCutWidth}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />

                            {/* Piece number centered inside the box */}
                            <text
                              x={mmCx}
                              y={mmCy}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize={numSize}
                              fontWeight="700"
                              fill="hsl(var(--primary))"
                              opacity={0.6}
                            >
                              {i + 1}
                            </text>
                          </g>
                        </>
                      );
                    })() : (
                      <rect
                        x={p.x}
                        y={p.y}
                        width={p.w}
                        height={p.h}
                        fill={showDieline ? 'hsl(var(--background))' : fillColor}
                        stroke={strokeColor}
                        strokeWidth={(selected ? 0.6 : 0.3) / innerScale}
                        rx={0.2}
                      />
                    )}
                    {showDieline && (() => {
                      const turns = turnsOf(p);
                      // The piece's bbox (p.w × p.h) is the *rotated* bbox.
                      // For odd turns the original dieline (dlW × dlH) maps onto a
                      // (p.h × p.w) inner box that we then rotate around the piece centre.
                      const innerW = turns % 2 === 1 ? p.h : p.w;
                      const innerH = turns % 2 === 1 ? p.w : p.h;
                      const innerX = p.x + (p.w - innerW) / 2;
                      const innerY = p.y + (p.h - innerH) / 2;
                      const cx = p.x + p.w / 2;
                      const cy = p.y + p.h / 2;
                      const angle = turns * 90;
                      const rotateTransform = angle === 0 ? '' : `rotate(${angle} ${cx} ${cy})`;
                      const mirrorTransform = p.mirrored ? `translate(${p.x + p.w} 0) scale(-1 1) translate(${-p.x} 0)` : '';
                      const transform = [rotateTransform, mirrorTransform].filter(Boolean).join(' ') || undefined;
                      return (
                        <g transform={transform} style={{ pointerEvents: 'none' }}>
                          <svg
                            x={innerX}
                            y={innerY}
                            width={innerW}
                            height={innerH}
                            viewBox={dielineVB}
                            preserveAspectRatio="none"
                            style={{ pointerEvents: 'none', overflow: 'visible' }}
                            dangerouslySetInnerHTML={{ __html: dielineInner }}
                          />
                        </g>
                      );
                    })()}
                    {!dielinePaths && (
                      <text
                        x={p.x + p.w / 2}
                        y={p.y + p.h / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={strokeColor}
                        fontSize={Math.min(p.w, p.h) * 0.35}
                        fontWeight="bold"
                        fontFamily="Cairo, sans-serif"
                        opacity={showDieline ? 0.5 : 1}
                        style={{ pointerEvents: 'none' }}
                      >
                        {i + 1}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Overlap shading — exact polygon intersection of the dragged piece
                  with every other piece (uses Clipper boolean intersection on the
                  real dieline outline when available, else rectangle fallback). */}
              {overlapRegions.length > 0 && (
                <g style={{ pointerEvents: 'none' }}>
                  {overlapRegions.map((poly, i) => (
                    <path
                      key={`ov${i}`}
                      d={polygonToSvgPath(poly)}
                      fill="hsl(0 84% 60% / 0.45)"
                      stroke="hsl(0 84% 50%)"
                      strokeWidth={Math.max(0.08, 0.25 / innerScale)}
                      strokeDasharray={`${0.4} ${0.3}`}
                      strokeLinejoin="round"
                    />
                  ))}
                </g>
              )}

              {/* Smart guides while dragging */}
              {(activeGuides.v.length > 0 || activeGuides.h.length > 0) && (
                <g style={{ pointerEvents: 'none' }}>
                  {activeGuides.v.map((vx, i) => (
                    <line
                      key={`gv${i}`}
                      x1={vx}
                      y1={-padY * 0.2}
                      x2={vx}
                      y2={sheetH + padY * 0.2}
                      stroke="hsl(0 84% 60%)"
                      strokeWidth={guideStroke}
                      strokeDasharray={`${0.5} ${0.4}`}
                    />
                  ))}
                  {activeGuides.h.map((hy, i) => (
                    <line
                      key={`gh${i}`}
                      x1={-padX * 0.2}
                      y1={hy}
                      x2={sheetW + padX * 0.2}
                      y2={hy}
                      stroke="hsl(0 84% 60%)"
                      strokeWidth={guideStroke}
                      strokeDasharray={`${0.5} ${0.4}`}
                    />
                  ))}
                </g>
              )}

              {/* Marquee selection rectangle */}
              {marquee && (marquee.w > 0 || marquee.h > 0) && (
                <rect
                  x={marquee.x}
                  y={marquee.y}
                  width={marquee.w}
                  height={marquee.h}
                  fill="hsl(var(--primary) / 0.10)"
                  stroke="hsl(var(--primary))"
                  strokeWidth={Math.max(0.08, 0.25 / innerScale)}
                  strokeDasharray={`${0.5} ${0.4}`}
                  style={{ pointerEvents: 'none' }}
                />
              )}
              </g>
            </svg>
          );
        })()}
      </div>

      {/* Final-pass validation prompt — shown only when the user tries to exit
          while overlaps or out-of-bounds pieces exist. Edit Mode itself remains
          fully flexible. */}
      <AlertDialog open={pendingExit} onOpenChange={setPendingExit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              التوزيع يحتوي على مشاكل
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-right">
              <span className="block">تم اكتشاف ما يلي في التوزيع الحالي:</span>
              <ul className="list-disc pr-5 space-y-1 text-foreground">
                {validateLayout.overlapPairs > 0 && (
                  <li>تداخل بين القوالب: <strong>{validateLayout.overlapPairs}</strong> زوج</li>
                )}
                {validateLayout.outOfBounds > 0 && (
                  <li>قطع خارج حدود الشيت: <strong>{validateLayout.outOfBounds}</strong></li>
                )}
              </ul>
              <span className="block text-xs text-muted-foreground mt-2">
                يمكنك المتابعة كما هو، أو الإلغاء والعودة لتعديل التوزيع.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء (متابعة التعديل)</AlertDialogCancel>
            <AlertDialogAction onClick={exitEdit}>
              متابعة على أي حال
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {engineVariant === 'advanced' && (
        <AutoNestDialog
          open={autoNestOpen}
          onOpenChange={setAutoNestOpen}
          sheetW={sheetW}
          sheetH={sheetH}
          gap={gap}
          currentPieces={pieces}
          dieline={importedDieline ?? null}
          workerVariant="advanced"
          onApply={(newPieces) => {
            pushHistory(pieces);
            setPieces(newPieces.map((p, i) => ({ ...p, index: i + 1 })));
            clearSelection();
          }}
        />
      )}
    </div>
  );
});
EditableSheetLayout.displayName = 'EditableSheetLayout';

export default EditableSheetLayout;
