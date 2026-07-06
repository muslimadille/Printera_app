import React, { useState, useEffect, useMemo } from 'react';
import { Pen, Move, Maximize2, Check, X, ZoomIn, ZoomOut, RefreshCcw } from 'lucide-react';

export interface Pt { x: number; y: number }
export interface Segment {
  id: number;
  svgId: string;
  kind: "OUTER" | "CUT" | "CREASE";
  geometry: "line" | "polyline" | "bezier" | string;
  start: Pt;
  end: Pt;
  points?: Pt[];
  bezier?: { c1: Pt; c2: Pt };
}

interface InteractiveSvgCanvasProps {
  segments: Segment[];
  svgWidth: number;
  svgHeight: number;
  dimensionsMarkup?: string;
  onChange?: (newSvg: string, newSegments: Segment[]) => void;
}

// Distance threshold to consider two points "connected"
const EPSILON = 0.01;

export function InteractiveSvgCanvas({ segments: initialSegments = [], svgWidth = 0, svgHeight = 0, dimensionsMarkup = '', onChange }: InteractiveSvgCanvasProps) {
  const [editMode, setEditMode] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Input states for the floating panel
  const [offsetDelta, setOffsetDelta] = useState<number>(0);
  const [lengthDelta, setLengthDelta] = useState<number>(0);

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  // Sync with parent when initialSegments change (e.g. params changed)
  useEffect(() => {
    // Deep clone to avoid mutating the prop
    const cloned = initialSegments.map(s => ({
      ...s,
      start: { ...s.start },
      end: { ...s.end },
      points: s.points ? s.points.map(p => ({ ...p })) : undefined,
    }));
    setSegments(cloned);
    setSelectedIds(new Set());
    setOffsetDelta(0);
    setLengthDelta(0);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [initialSegments]);

  // Generate SVG string based on current segments
  const currentSvgMarkup = useMemo(() => {
    const lines = segments.map(s => {
      const color = s.kind === "CREASE" ? "#00a651" : "#ed1c24";
      if (s.geometry === "line" || !s.geometry) {
        return `<line x1="${s.start.x.toFixed(4)}" y1="${s.start.y.toFixed(4)}" x2="${s.end.x.toFixed(4)}" y2="${s.end.y.toFixed(4)}" stroke="${color}" stroke-width="4" fill="none" />`;
      }
      if (s.geometry === "polyline" && s.points) {
        const pts = s.points.map(pt => `${pt.x.toFixed(4)},${pt.y.toFixed(4)}`).join(" ");
        return `<polyline points="${pts}" stroke="${color}" stroke-width="4" fill="none" />`;
      }
      if (s.geometry === "bezier" && s.bezier) {
        return `<path d="M ${s.start.x.toFixed(4)},${s.start.y.toFixed(4)} C ${s.bezier.c1.x.toFixed(4)},${s.bezier.c1.y.toFixed(4)} ${s.bezier.c2.x.toFixed(4)},${s.bezier.c2.y.toFixed(4)} ${s.end.x.toFixed(4)},${s.end.y.toFixed(4)}" stroke="${color}" stroke-width="4" fill="none" />`;
      }
      if (s.geometry === "arc" && s.arc) {
        return `<path d="M ${s.start.x.toFixed(4)},${s.start.y.toFixed(4)} A ${s.arc.rx.toFixed(4)} ${s.arc.ry.toFixed(4)} ${s.arc.xar} ${s.arc.laf} ${s.arc.sf} ${s.end.x.toFixed(4)},${s.end.y.toFixed(4)}" stroke="${color}" stroke-width="4" fill="none" />`;
      }
      return '';
    });
    return lines.join('\n');
  }, [segments]);

  const toggleSelection = (id: number, multi: boolean) => {
    if (!editMode) return;
    setSelectedIds(prev => {
      const next = new Set(multi ? prev : []);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const applyChanges = () => {
    if (selectedIds.size === 0) return;
    if (offsetDelta === 0 && lengthDelta === 0) return;

    const nextSegments = segments.map(s => ({
      ...s,
      start: { ...s.start },
      end: { ...s.end },
    }));

    // Find all points that need to move
    const pointMoves = new Map<string, { dx: number, dy: number }>();

    const addMove = (pt: Pt, dx: number, dy: number) => {
      let key = `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`;
      for (const k of pointMoves.keys()) {
        const [kx, ky] = k.split(',').map(Number);
        if (Math.abs(kx - pt.x) < EPSILON && Math.abs(ky - pt.y) < EPSILON) {
          key = k; break;
        }
      }
      
      const existing = pointMoves.get(key) || { dx: 0, dy: 0 };
      pointMoves.set(key, { dx: existing.dx + dx, dy: existing.dy + dy });
    };

    selectedIds.forEach(id => {
      const seg = nextSegments.find(s => s.id === id);
      if (!seg || seg.geometry !== "line") return;

      const dx = seg.end.x - seg.start.x;
      const dy = seg.end.y - seg.start.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return;

      if (offsetDelta !== 0) {
        const nx = (-dy / len) * offsetDelta;
        const ny = (dx / len) * offsetDelta;
        addMove(seg.start, nx, ny);
        addMove(seg.end, nx, ny);
      }

      if (lengthDelta !== 0) {
        const stretchX = (dx / len) * (lengthDelta / 2);
        const stretchY = (dy / len) * (lengthDelta / 2);
        addMove(seg.start, -stretchX, -stretchY);
        addMove(seg.end, stretchX, stretchY);
      }
    });

    nextSegments.forEach(seg => {
      for (const [key, move] of pointMoves.entries()) {
        const [kx, ky] = key.split(',').map(Number);
        
        if (Math.abs(seg.start.x - kx) < EPSILON && Math.abs(seg.start.y - ky) < EPSILON) {
          seg.start.x += move.dx;
          seg.start.y += move.dy;
        }
        if (Math.abs(seg.end.x - kx) < EPSILON && Math.abs(seg.end.y - ky) < EPSILON) {
          seg.end.x += move.dx;
          seg.end.y += move.dy;
        }
      }
    });

    setSegments(nextSegments);

    if (onChange) {
      const lines = nextSegments.map(s => {
        const color = s.kind === "CREASE" ? "#00a651" : "#ed1c24";
        if (s.geometry === "line" || !s.geometry) {
          return `<line x1="${s.start.x.toFixed(4)}" y1="${s.start.y.toFixed(4)}" x2="${s.end.x.toFixed(4)}" y2="${s.end.y.toFixed(4)}" stroke="${color}" stroke-width="4" fill="none" />`;
        }
        if (s.geometry === "polyline" && s.points) {
          const pts = s.points.map(pt => `${pt.x.toFixed(4)},${pt.y.toFixed(4)}`).join(" ");
          return `<polyline points="${pts}" stroke="${color}" stroke-width="4" fill="none" />`;
        }
        if (s.geometry === "bezier" && s.bezier) {
          return `<path d="M ${s.start.x.toFixed(4)},${s.start.y.toFixed(4)} C ${s.bezier.c1.x.toFixed(4)},${s.bezier.c1.y.toFixed(4)} ${s.bezier.c2.x.toFixed(4)},${s.bezier.c2.y.toFixed(4)} ${s.end.x.toFixed(4)},${s.end.y.toFixed(4)}" stroke="${color}" stroke-width="4" fill="none" />`;
        }
        if (s.geometry === "arc" && s.arc) {
          return `<path d="M ${s.start.x.toFixed(4)},${s.start.y.toFixed(4)} A ${s.arc.rx.toFixed(4)} ${s.arc.ry.toFixed(4)} ${s.arc.xar} ${s.arc.laf} ${s.arc.sf} ${s.end.x.toFixed(4)},${s.end.y.toFixed(4)}" stroke="${color}" stroke-width="4" fill="none" />`;
        }
        return '';
      });
      onChange(lines.join('\n'), nextSegments);
    }

    setOffsetDelta(0);
    setLengthDelta(0);
    setSelectedIds(new Set());
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (editMode && (e.target as Element).tagName === 'line') return;
    setIsPanning(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanning) return;
    setPan(prev => ({ 
      x: prev.x - e.movementX * zoom * 0.8,
      y: prev.y - e.movementY * zoom * 0.8
    }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsPanning(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleZoomIn = () => setZoom(z => Math.max(0.1, z * 0.8));
  const handleZoomOut = () => setZoom(z => Math.min(10, z * 1.25));
  const handleResetZoom = () => { setZoom(1); setPan({x:0, y:0}); };

  const vbWidth = (svgWidth + 40) * zoom;
  const vbHeight = (svgHeight + 40) * zoom;
  const vbX = -20 + pan.x + (svgWidth + 40) * (1 - zoom) / 2;
  const vbY = -20 + pan.y + (svgHeight + 40) * (1 - zoom) / 2;

  return (
    <div className="relative w-full h-full flex flex-col group">
      {/* Toolbar */}
      <div className="absolute top-2 right-2 flex gap-2 z-10">
        <div className="flex bg-white rounded shadow border border-gray-200 overflow-hidden">
          <button onClick={handleZoomIn} className="p-2 text-gray-700 hover:bg-gray-100" title="تكبير">
            <ZoomIn size={18} />
          </button>
          <button onClick={handleResetZoom} className="p-2 text-gray-700 hover:bg-gray-100 border-l border-r border-gray-200" title="إعادة الضبط">
            <RefreshCcw size={18} />
          </button>
          <button onClick={handleZoomOut} className="p-2 text-gray-700 hover:bg-gray-100" title="تصغير">
            <ZoomOut size={18} />
          </button>
        </div>

        <button
          onClick={() => {
            setEditMode(!editMode);
            setSelectedIds(new Set());
          }}
          className={`p-2 rounded shadow transition-colors ${editMode ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
          title="تعديل الخطوط"
        >
          <Pen size={18} />
        </button>
      </div>

      {/* Edit Panel */}
      {editMode && selectedIds.size > 0 && (
        <div className="absolute top-14 right-2 bg-white p-3 rounded shadow-lg border border-gray-200 z-10 flex flex-col gap-3 min-w-[200px]" dir="rtl">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-sm text-gray-800">تعديل {selectedIds.size} خط</h4>
            <button onClick={() => setSelectedIds(new Set())} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
          </div>
          
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600 flex items-center gap-1"><Maximize2 size={12}/> الإزاحة (Offset)</label>
            <div className="flex gap-1">
              <input 
                type="number" 
                value={offsetDelta} 
                onChange={e => setOffsetDelta(Number(e.target.value))}
                className="w-full border rounded px-2 py-1 text-sm text-left"
                dir="ltr"
              />
              <span className="text-xs text-gray-500 self-center">mm</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600 flex items-center gap-1"><Move size={12}/> تغيير الطول (Length)</label>
            <div className="flex gap-1">
              <input 
                type="number" 
                value={lengthDelta} 
                onChange={e => setLengthDelta(Number(e.target.value))}
                className="w-full border rounded px-2 py-1 text-sm text-left"
                dir="ltr"
              />
              <span className="text-xs text-gray-500 self-center">mm</span>
            </div>
          </div>

          <button 
            onClick={applyChanges}
            className="mt-2 bg-blue-600 text-white rounded py-1.5 text-sm font-semibold flex items-center justify-center gap-1 hover:bg-blue-700"
          >
            <Check size={16} /> تطبيق
          </button>
        </div>
      )}

      {/* SVG Canvas */}
      <div 
        className="flex-1 w-full h-full overflow-hidden relative touch-none"
        onClick={() => { if(editMode) setSelectedIds(new Set()); }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <svg
          viewBox={`${vbX} ${vbY} ${vbWidth} ${vbHeight}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
          style={{ cursor: isPanning ? 'grabbing' : (editMode ? 'crosshair' : 'grab') }}
        >
          {dimensionsMarkup && <g dangerouslySetInnerHTML={{ __html: dimensionsMarkup }} />}
          {segments.map(s => {
            const isSelected = selectedIds.has(s.id);
            const color = s.kind === "CREASE" ? "#00a651" : "#ed1c24";
            
            const renderShape = (props: any) => {
              if (s.geometry === "line" || !s.geometry) {
                return <line x1={s.start.x} y1={s.start.y} x2={s.end.x} y2={s.end.y} {...props} />;
              }
              if (s.geometry === "polyline" && s.points) {
                const pts = s.points.map(pt => `${pt.x},${pt.y}`).join(" ");
                return <polyline points={pts} {...props} />;
              }
              if (s.geometry === "bezier" && s.bezier) {
                return <path d={`M ${s.start.x},${s.start.y} C ${s.bezier.c1.x},${s.bezier.c1.y} ${s.bezier.c2.x},${s.bezier.c2.y} ${s.end.x},${s.end.y}`} {...props} />;
              }
              if (s.geometry === "arc" && s.arc) {
                return <path d={`M ${s.start.x},${s.start.y} A ${s.arc.rx} ${s.arc.ry} ${s.arc.xar} ${s.arc.laf} ${s.arc.sf} ${s.end.x},${s.end.y}`} {...props} />;
              }
              return null;
            };

            return (
              <g key={s.id} onClick={(e) => { e.stopPropagation(); toggleSelection(s.id, e.shiftKey); }}>
                {/* Invisible thicker line for easier clicking */}
                {editMode && renderShape({
                  stroke: "transparent",
                  strokeWidth: "15",
                  className: "cursor-pointer hover:stroke-blue-200/50 transition-colors"
                })}
                {renderShape({
                  stroke: isSelected ? "#3b82f6" : color,
                  strokeWidth: isSelected ? "6" : "4",
                  fill: "none",
                  className: editMode ? 'transition-all duration-200 cursor-pointer' : ''
                })}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
