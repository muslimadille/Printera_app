import React from 'react';

interface SvgPreviewWithOverlayProps {
  svgContent: string;
  overlayElements?: any[];
  viewBoxWidth: number;
  viewBoxHeight: number;
}

export function SvgPreviewWithOverlay({
  svgContent,
  overlayElements = [],
  viewBoxWidth,
  viewBoxHeight
}: SvgPreviewWithOverlayProps) {
  // A simple component that displays the SVG content and overlays the dimension lines
  // We extract the <svg> internals and render them inside a responsive svg container.
  
  // Basic dimensions renderer
  const renderDimension = (el: any, i: number) => {
    if (el.type === 'dimension') {
      const isVertical = Math.abs(el.start.x - el.end.x) < 0.1;
      const textX = isVertical ? el.start.x + 5 : (el.start.x + el.end.x) / 2;
      const textY = isVertical ? (el.start.y + el.end.y) / 2 : el.start.y - 5;
      
      return (
        <g key={`dim-${i}`}>
          <line 
            x1={el.start.x} y1={el.start.y} 
            x2={el.end.x} y2={el.end.y} 
            stroke="#000" strokeWidth={el.strokeWidth || 1} 
            strokeDasharray="2,2" 
          />
          <text 
            x={textX} y={textY} 
            fontSize={el.fontSize || 12} 
            fill="#000"
            textAnchor={isVertical ? "start" : "middle"}
            alignmentBaseline="middle"
          >
            {el.label}
          </text>
        </g>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full relative" style={{ minHeight: 400 }}>
      <style>{`
        .svg-preview-container path, .svg-preview-container circle, .svg-preview-container line {
          vector-effect: non-scaling-stroke;
          stroke-width: 1.5px !important;
        }
      `}</style>
      <svg
        viewBox={`0 0 ${viewBoxWidth + 100} ${viewBoxHeight + 100}`}
        className="w-full h-full object-contain svg-preview-container"
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform="translate(50, 50)">
          {/* Render the original SVG by dangerously setting inner HTML inside a group */}
          <g dangerouslySetInnerHTML={{ __html: svgContent.replace(/<svg[^>]*>|<\/svg>/g, '') }} />
          
          {/* Render Overlay */}
          <g className="dimensions-overlay">
            {overlayElements.map((el, i) => renderDimension(el, i))}
          </g>
        </g>
      </svg>
    </div>
  );
}
