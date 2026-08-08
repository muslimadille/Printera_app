// T0002 — Export Single Template SVG and PDF
// Emits one SVG/PDF file (mm units) matching the current Dynamic Geometry preview.

import type { T0002Geometry } from "./types";
import type { Segment } from "./geometry";

const CUT_COLOR = "#ED1C24";
const SLOT_COLOR = "#2028B0";
const CREASE_COLOR = "#00A651";
const r = (n: number) => Math.round(n * 100000) / 100000;

function renderSeg(s: Segment): string {
  if (s.geometry === "line") {
    if (s.start.x === s.end.x && s.start.y === s.end.y) return "";
    return `    <line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}" data-id="${s.svgId}"/>`;
  }
  if (s.geometry === "polyline" && s.points) {
    const pts = s.points.map(p => `${p.x},${p.y}`).join(" ");
    return `    <polyline points="${pts}" data-id="${s.svgId}"/>`;
  }
  if (s.geometry === "bezier" && s.bezier) {
    return `    <path d="M${s.start.x},${s.start.y} C${s.bezier.c1.x},${s.bezier.c1.y} ${s.bezier.c2.x},${s.bezier.c2.y} ${s.end.x},${s.end.y}" data-id="${s.svgId}"/>`;
  }
  if (s.geometry === "arc" && s.arc) {
    return `    <path d="M ${s.start.x},${s.start.y} A ${s.arc.rx} ${s.arc.ry} ${s.arc.xar} ${s.arc.laf} ${s.arc.sf} ${s.end.x},${s.end.y}" data-id="${s.svgId}"/>`;
  }
  return "";
}

export function buildT0002SingleTemplateSvg(geo: T0002Geometry): string {
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

export function downloadT0002SingleTemplate(geo: T0002Geometry, filename = "T0002-single-template.svg") {
  const svg = buildT0002SingleTemplateSvg(geo);
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

export async function buildT0002SingleTemplatePdf(svgMarkup: string) {
  const { generatePdfFromSvg } = await import("@/lib/pdf/pdfService");
  return generatePdfFromSvg(svgMarkup);
}

export async function downloadT0002SingleTemplatePdf(
  svgMarkup: string,
  filename = "T0002-single-template.pdf",
) {
  const { downloadPdf } = await import("@/lib/pdf/pdfService");
  const pdf = await buildT0002SingleTemplatePdf(svgMarkup);
  downloadPdf(pdf, filename);
  return pdf;
}

export async function previewT0002SingleTemplatePdf(
  svgMarkup: string,
  filename = "T0002-single-template.pdf",
) {
  const { previewPdf } = await import("@/lib/pdf/pdfService");
  const pdf = await buildT0002SingleTemplatePdf(svgMarkup);
  await previewPdf(pdf, filename);
  return pdf;
}
