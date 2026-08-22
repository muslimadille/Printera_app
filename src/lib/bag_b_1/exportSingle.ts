import { Bag_B_1Dimensions } from './types';
import { generateBag_B_1Geometry } from './geometry';

export function getBag_B_1SingleSvg(dims: Bag_B_1Dimensions): string {
  const geo = generateBag_B_1Geometry(dims);

  let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${geo.width}mm" height="${geo.height}mm" viewBox="0 0 ${geo.width} ${geo.height}">\n`;

  // Draw crease lines (green, dashed)
  svg += `  <g id="CREASE" fill="none" stroke="#00A651" stroke-width="0.35" stroke-dasharray="3,2">\n`;
  for (const line of geo.creaseLines) {
    svg += `    <path d="M${line.start.x},${line.start.y} L${line.end.x},${line.end.y}" />\n`;
  }
  svg += `  </g>\n`;

  // Draw cut lines (red, solid)
  svg += `  <g id="CUT" fill="none" stroke="#ED1C24" stroke-width="0.45" stroke-linecap="round">\n`;
  for (const line of geo.cutLines) {
    svg += `    <path d="M${line.start.x},${line.start.y} L${line.end.x},${line.end.y}" />\n`;
  }
  for (const c of geo.cutCircles) {
    svg += `    <circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" />\n`;
  }
  svg += `  </g>\n`;

  svg += `</svg>`;
  return svg;
}

export async function exportBag_B_1SinglePdf(dims: Bag_B_1Dimensions, filename: string = 'Bag_B_1.pdf') {
  const geo = generateBag_B_1Geometry(dims);
  const svgStr = getBag_B_1SingleSvg(dims);

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
