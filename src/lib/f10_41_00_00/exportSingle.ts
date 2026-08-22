import { F10_41_00_00Dimensions } from './types';
import { generateF10_41_00_00Geometry } from './geometry';

export function getF10_41_00_00SingleSvg(dims: F10_41_00_00Dimensions): string {
  const geo = generateF10_41_00_00Geometry(dims);

  let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${geo.width}mm" height="${geo.height}mm" viewBox="0 0 ${geo.width} ${geo.height}">\n`;

  // Crease lines (Green)
  svg += `  <g id="CREASE" fill="none" stroke="#00A651" stroke-width="0.35" stroke-dasharray="3,2">\n`;
  for (const line of geo.creaseLines) {
    svg += `    <path d="M${line.start.x},${line.start.y} L${line.end.x},${line.end.y}" />\n`;
  }
  svg += `  </g>\n`;

  // Lock crease lines (Gold/Yellow)
  if (geo.lockCreaseLines.length > 0) {
    svg += `  <g id="LOCK_CREASE" fill="none" stroke="#c8b700" stroke-width="0.35">\n`;
    for (const line of geo.lockCreaseLines) {
      svg += `    <path d="M${line.start.x},${line.start.y} L${line.end.x},${line.end.y}" />\n`;
    }
    svg += `  </g>\n`;
  }

  // Cut lines (Red)
  svg += `  <g id="CUT" fill="none" stroke="#ED1C24" stroke-width="0.45" stroke-linecap="round">\n`;
  for (const line of geo.cutLines) {
    svg += `    <path d="M${line.start.x},${line.start.y} L${line.end.x},${line.end.y}" />\n`;
  }
  svg += `  </g>\n`;

  svg += `</svg>`;
  return svg;
}

export async function exportF10_41_00_00SinglePdf(dims: F10_41_00_00Dimensions, filename: string = 'F10_41_00_00.pdf') {
  const geo = generateF10_41_00_00Geometry(dims);
  const svgStr = getF10_41_00_00SingleSvg(dims);

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgStr, 'image/svg+xml');
  const svgEl = doc.documentElement;

  const { jsPDF } = await import('jspdf');
  await import('svg2pdf.js');

  const pdf = new jsPDF({
    orientation: geo.width > geo.height ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [geo.width + 20, geo.height + 20],
  });

  await (pdf as any).svg(svgEl, {
    x: 10,
    y: 10,
    width: geo.width,
    height: geo.height,
  });

  pdf.save(filename);
}
