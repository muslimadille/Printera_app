// D003 — Sheet Nesting Preview
// Visualizes the sheet, margins, gripper, and the arrayed templates
// using the active dynamic geometry and the computed nesting result.

import { useMemo } from 'react';
import type { D003Params } from '@/lib/d003/types';
import { usableSheet } from '@/lib/d003/types';
import { buildD003Geometry, type Segment } from '@/lib/d003/geometry';
import type { D003NestingParams, D003NestingResult } from '@/lib/d003/nesting';

const CUT_COLOR = '#ED1C24';
const SLOT_COLOR = '#2028B0';
const CREASE_COLOR = '#00A651';

function segPath(s: Segment): string | null {
  if (s.start.x === s.end.x && s.start.y === s.end.y) return null;
  return `M${s.start.x},${s.start.y} L${s.end.x},${s.end.y}`;
}

interface Props {
  params: D003Params;
  nesting: D003NestingParams;
  result: D003NestingResult;
}

const D003SheetNestingPreview = ({ params, nesting, result }: Props) => {
  const geo = useMemo(() => buildD003Geometry(params), [params]);
  const usable = useMemo(() => usableSheet(params), [params]);

  const sheetW = Math.max(1, params.sheetWidth);
  const sheetH = Math.max(1, params.sheetHeight);
  const margin = Math.max(0, params.sheetMargin);
  const gripper = Math.max(0, params.gripper);

  const usableX = margin;
  const usableY = margin + gripper;

  const orientation = result.bestOrientation;
  const grid = orientation === 'rotated' ? result.rotated : result.normal;
  const tW = geo.bbox.w;
  const tH = geo.bbox.h;

  const cellW = orientation === 'rotated' ? tH : tW;
  const cellH = orientation === 'rotated' ? tW : tH;
  const pitchX = grid.pitchX;
  const pitchY = grid.pitchY;

  const creaseSegs = geo.segments.filter(s => s.kind === 'CREASE');
  const outerSegs = geo.segments.filter(s => s.kind === 'OUTER');
  const innerSegs = geo.segments.filter(s => s.kind === 'CUT');

  const creaseD = creaseSegs.map(segPath).filter(Boolean).join(' ');
  const outerD = outerSegs.map(segPath).filter(Boolean).join(' ');
  const innerD = innerSegs.map(segPath).filter(Boolean).join(' ');

  const items: { x: number; y: number }[] = [];
  for (let r = 0; r < grid.rows; r++) {
    const cols = grid.perRowCols[r] ?? 0;
    for (let c = 0; c < cols; c++) {
      items.push({
        x: usableX + c * pitchX,
        y: usableY + r * pitchY,
      });
    }
  }

  const sw = Math.max(0.15, Math.min(sheetW, sheetH) / 1200);
  const sheetSw = Math.max(0.3, Math.min(sheetW, sheetH) / 800);

  return (
    <div className="space-y-2">
      <div className="border rounded-lg p-3 bg-white overflow-auto flex justify-end">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${sheetW} ${sheetH}`}
          width="100%"
          style={{ maxWidth: '900px', height: 'auto', background: '#fafafa' }}
        >
          {/* Sheet outline */}
          <rect x={0} y={0} width={sheetW} height={sheetH}
            fill="#ffffff" stroke="#111827" strokeWidth={sheetSw} />
          {/* Gripper band (top) */}
          {gripper > 0 && (
            <rect x={0} y={0} width={sheetW} height={margin + gripper}
              fill="#fee2e2" fillOpacity={0.55} stroke="none" />
          )}
          {/* Margin frame */}
          <rect x={margin} y={margin}
            width={Math.max(0, sheetW - 2 * margin)}
            height={Math.max(0, sheetH - 2 * margin)}
            fill="none" stroke="#94a3b8" strokeWidth={sheetSw}
            strokeDasharray={`${sheetSw * 6} ${sheetSw * 4}`} />
          {/* Usable area frame */}
          <rect x={usableX} y={usableY}
            width={usable.width} height={usable.height}
            fill="none" stroke="#3b82f6" strokeWidth={sheetSw}
            strokeDasharray={`${sheetSw * 3} ${sheetSw * 3}`} />

          {/* Items */}
          {items.length === 0 && (
            <text x={sheetW / 2} y={sheetH / 2}
              fontSize={Math.max(6, Math.min(sheetW, sheetH) / 40)}
              fill="#dc2626" textAnchor="middle" dominantBaseline="middle">
              القالب لا يدخل داخل الشيت بالقيم الحالية
            </text>
          )}
          {items.map((it, i) => {
            const transform = orientation === 'rotated'
              ? `translate(${it.x + tH} ${it.y}) rotate(90)`
              : `translate(${it.x} ${it.y})`;
            const labelSize = Math.min(cellW, cellH) * 0.22;
            return (
              <g key={i}>
                <g transform={transform}>
                  <path d={creaseD} fill="none"
                    stroke={CREASE_COLOR} strokeWidth={sw}
                    strokeLinecap="round" strokeLinejoin="round" />
                  <path d={outerD} fill="none"
                    stroke={CUT_COLOR} strokeWidth={sw * 1.4}
                    strokeLinecap="round" strokeLinejoin="round" />
                  <path d={innerD} fill="none"
                    stroke={SLOT_COLOR} strokeWidth={sw * 1.4}
                    strokeLinecap="round" strokeLinejoin="round" />
                </g>
                <text x={it.x + cellW / 2} y={it.y + cellH / 2}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={labelSize} fontWeight={700}
                  fill="hsl(var(--primary))" opacity={0.55}
                  style={{ pointerEvents: 'none' }}>
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
        <span><span className="inline-block w-3 h-3 align-middle mr-1" style={{ background: '#fee2e2' }} /> منطقة القابض</span>
        <span><span className="inline-block w-3 h-3 align-middle mr-1 border" style={{ borderColor: '#94a3b8', borderStyle: 'dashed' }} /> الهامش</span>
        <span><span className="inline-block w-3 h-3 align-middle mr-1 border" style={{ borderColor: '#3b82f6', borderStyle: 'dashed' }} /> المنطقة الصافية</span>
        <span><span className="inline-block w-3 h-3 align-middle mr-1" style={{ background: CUT_COLOR }} /> OUTER CUT</span>
        <span><span className="inline-block w-3 h-3 align-middle mr-1" style={{ background: SLOT_COLOR }} /> SLOT CUT (Die-cut)</span>
        <span><span className="inline-block w-3 h-3 align-middle mr-1" style={{ background: CREASE_COLOR }} /> CREASE</span>
      </div>
    </div>
  );
};

export default D003SheetNestingPreview;
