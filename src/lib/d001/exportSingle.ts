// D001 — Export Single Template SVG
// Emits one SVG file (mm units) matching the current Dynamic Geometry preview.
// Two layers only:
//   - CREASE (#00A651): CREASE 56..67
//   - CUT    (#ED1C24): OUTER 1..47 + CUT 48..55  (painted on top)
// No <use>, <symbol>, <clipPath>, <foreignObject>, raster, or transform=scale.

import type { D001Geometry, Segment } from "./geometry";

const CUT_COLOR = "#ED1C24";
const CREASE_COLOR = "#00A651";
const r = (n: number) => Math.round(n * 100000) / 100000;

function renderSeg(s: Segment): string {
  if (s.geometry === "fillet" && s.via && s.bezier) {
    return `    <path d="M${s.start.x},${s.start.y} L${s.via.x},${s.via.y} C${s.bezier.c1.x},${s.bezier.c1.y} ${s.bezier.c2.x},${s.bezier.c2.y} ${s.end.x},${s.end.y}" data-id="${s.svgId}"/>`;
  }
  if (s.geometry === "bezier" && s.bezier) {
    return `    <path d="M${s.start.x},${s.start.y} C${s.bezier.c1.x},${s.bezier.c1.y} ${s.bezier.c2.x},${s.bezier.c2.y} ${s.end.x},${s.end.y}" data-id="${s.svgId}"/>`;
  }
  if (s.geometry === "polyline" && s.points && s.points.length >= 2) {
    const pts = s.points.map(p => `${p.x},${p.y}`).join(" ");
    return `    <polyline points="${pts}" data-id="${s.svgId}"/>`;
  }
  if (s.start.x === s.end.x && s.start.y === s.end.y) return "";
  return `    <line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}" data-id="${s.svgId}"/>`;
}

export function buildD001SingleTemplateSvg(geo: D001Geometry): string {
  const w = r(geo.bbox.w);
  const h = r(geo.bbox.h);
  const crease = geo.segments.filter(s => s.kind === "CREASE");
  // CUT layer = OUTER 1..47 + CUT 48..55 (preserve numeric id order)
  const cut = geo.segments
    .filter(s => s.kind === "OUTER" || s.kind === "CUT")
    .slice()
    .sort((a, b) => a.id - b.id);

  const out: string[] = [];
  out.push(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>`);
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" version="1.1" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">`);

  out.push(`  <g id="CREASE" inkscape:label="CREASE" fill="none" stroke="${CREASE_COLOR}" stroke-width="0.45" stroke-miterlimit="10">`);
  for (const s of crease) {
    const line = renderSeg(s);
    if (line) out.push(line);
  }
  out.push(`  </g>`);

  out.push(`  <g id="CUT" inkscape:label="CUT" fill="none" stroke="${CUT_COLOR}" stroke-width="0.45" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10">`);
  for (const s of cut) {
    const line = renderSeg(s);
    if (line) out.push(line);
  }
  out.push(`  </g>`);

  out.push(`</svg>`);
  return out.join("\n");
}

export function downloadD001SingleTemplate(geo: D001Geometry, filename = "D001-single-template.svg") {
  const svg = buildD001SingleTemplateSvg(geo);
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

export async function buildD001SingleTemplatePdf(svgMarkup: string) {
  const { generatePdfFromSvg } = await import("@/lib/pdf/pdfService");
  return generatePdfFromSvg(svgMarkup);
}

export async function downloadD001SingleTemplatePdf(
  svgMarkup: string,
  filename = "D001-single-template.pdf",
) {
  const { downloadPdf } = await import("@/lib/pdf/pdfService");
  const pdf = await buildD001SingleTemplatePdf(svgMarkup);
  downloadPdf(pdf, filename);
  return pdf;
}

export async function previewD001SingleTemplatePdf(
  svgMarkup: string,
  filename = "D001-single-template.pdf",
) {
  const { previewPdf } = await import("@/lib/pdf/pdfService");
  const pdf = await buildD001SingleTemplatePdf(svgMarkup);
  await previewPdf(pdf, filename);
  return pdf;
}
