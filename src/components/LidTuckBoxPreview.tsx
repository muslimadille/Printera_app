import { useMemo } from 'react';
import type { LidTuckBoxGeometry } from '@/lib/lidTuckBoxEngine';

interface Props {
  geometry: LidTuckBoxGeometry;
  /** Optional override; default fits container responsively. */
  maxHeightPx?: number;
}

/**
 * Renders the lid-tuck-box-v1 flat-pattern preview as a real SVG built from
 * the engine output. Preview === export geometry; no helpers or debug strokes.
 */
const LidTuckBoxPreview = ({ geometry: g, maxHeightPx = 520 }: Props) => {
  const { svgViewBox, creasePaths, cutSubPaths } = useMemo(() => {
    const pad = 4;
    return {
      svgViewBox: `${-pad} ${-pad} ${g.flatWidth + pad * 2} ${g.flatHeight + pad * 2}`,
      creasePaths: g.creaseLines,
      cutSubPaths: g.cutPaths,
    };
  }, [g]);

  return (
    <div
      className="w-full overflow-hidden rounded-xl border border-primary/15 bg-card/60 backdrop-blur-sm p-3"
      dir="ltr"
    >
      <svg
        viewBox={svgViewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: 'auto', maxHeight: maxHeightPx }}
        role="img"
        aria-label={`Lid Tuck Box flat pattern L=${g.inputs.L} D=${g.inputs.D} H=${g.inputs.H}`}
      >
        {/* CUT layer */}
        <g
          id="CUT"
          fill="none"
          stroke="hsl(346 87% 50%)"
          strokeWidth={0.35}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d={g.outerContour.d} data-id={g.outerContour.id} />
          {cutSubPaths.map(p => (
            <path key={p.id} d={p.d} data-id={p.id} />
          ))}
        </g>
        {/* CREASE layer */}
        <g
          id="CREASE"
          fill="none"
          stroke="hsl(221 83% 53%)"
          strokeWidth={0.3}
          strokeDasharray="2,1"
        >
          {creasePaths.map(c => (
            <line
              key={c.id}
              x1={c.from[0]}
              y1={c.from[1]}
              x2={c.to[0]}
              y2={c.to[1]}
              data-id={c.id}
            />
          ))}
        </g>
      </svg>
    </div>
  );
};

export default LidTuckBoxPreview;
