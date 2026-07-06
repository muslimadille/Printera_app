// D003 — Export Single Template SVG and PDF
// Emits one SVG/PDF file (mm units) matching the current Dynamic Geometry preview.
// Two layers only, with sub-groups for outer and slot cuts to preserve colors:
//   - CREASE (#00A651)
//   - CUT (containing OUTER #ED1C24 and INNER_CUTS #2028B0)

import type { D003Geometry, Segment } from "./geometry";

const CUT_COLOR = "#ED1C24";
const SLOT_COLOR = "#2028B0";
const CREASE_COLOR = "#00A651";
const r = (n: number) => Math.round(n * 100000) / 100000;

function renderSeg(s: Segment): string {
  if (s.start.x === s.end.x && s.start.y === s.end.y) return "";
  return `    <line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}" data-id="${s.svgId}"/>`;
}

export function buildD003SingleTemplateSvg(geo: D003Geometry): string {
  const w = r(geo.bbox.w);
  const h = r(geo.bbox.h);
  
  const crease = geo.segments.filter(s => s.kind === "CREASE");
  const outerCuts = geo.segments.filter(s => s.kind === "OUTER");
  const innerCuts = geo.segments.filter(s => s.kind === "CUT");

  const out: string[] = [];
  out.push(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>`);
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" version="1.1" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">`);

  // Crease Layer
  out.push(`  <g id="CREASE" inkscape:label="CREASE" fill="none" stroke="${CREASE_COLOR}" stroke-width="0.45" stroke-miterlimit="10">`);
  for (const s of crease) {
    const line = renderSeg(s);
    if (line) out.push(line);
  }
  out.push(`  </g>`);

  // Cut Layer
  out.push(`  <g id="CUT" inkscape:label="CUT" fill="none" stroke-width="0.45" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10">`);
  
  // Outer cuts sub-group
  out.push(`    <g id="OUTER_CUT_CONTOUR" inkscape:label="OUTER CUT CONTOUR" stroke="${CUT_COLOR}">`);
  for (const s of outerCuts) {
    const line = renderSeg(s);
    if (line) out.push(line);
  }
  out.push(`    </g>`);

  // Inner cuts sub-group
  out.push(`    <g id="INNER_CUTS" inkscape:label="INNER CUTS" stroke="${SLOT_COLOR}">`);
  for (const s of innerCuts) {
    const line = renderSeg(s);
    if (line) out.push(line);
  }
  out.push(`    </g>`);

  out.push(`  </g>`);
  out.push(`</svg>`);
  
  return out.join("\n");
}

export function downloadD003SingleTemplate(geo: D003Geometry, filename = "D003-single-template.svg") {
  const svg = buildD003SingleTemplateSvg(geo);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function downloadD003SingleTemplatePdf(
  svgMarkup: string,
  filename = "D003-single-template.pdf",
) {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-100000px";
  host.style.top = "0";
  host.style.visibility = "hidden";
  host.innerHTML = svgMarkup;
  const svgEl = host.querySelector("svg") as SVGSVGElement | null;
  if (!svgEl) throw new Error("D003 PDF export: failed to parse SVG.");
  document.body.appendChild(host);

  const vb = (svgEl.getAttribute("viewBox") || "0 0 0 0").split(/\s+/).map(Number);
  const pageW = vb[2] || 1;
  const pageH = vb[3] || 1;

  try {
    const [{ jsPDF }, { svg2pdf }] = await Promise.all([
      import("jspdf"),
      import("svg2pdf.js"),
    ]);
    const pdf = new jsPDF({
      unit: "mm",
      format: [pageW, pageH],
      orientation: pageW >= pageH ? "landscape" : "portrait",
      compress: true,
    });
    await svg2pdf(svgEl, pdf, { x: 0, y: 0, width: pageW, height: pageH });
    pdf.save(filename);
  } finally {
    document.body.removeChild(host);
  }
}
