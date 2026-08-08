// A60_20_01_01 — Export Single Template SVG & PDF
// Precision exporter supporting path, polyline, line elements and explicit layer colors

import type { A60_20_01_01Geometry } from "./types";
import type { Segment } from "@/components/InteractiveSvgCanvas";

const CUT_COLOR = "#ED1C24";
const CREASE_COLOR = "#00A651";
const r = (n: number) => Math.round(n * 10000) / 10000;

function renderSeg(s: Segment, defaultColor: string): string {
  const stroke = s.strokeColor || defaultColor;
  const dash = s.kind === "CREASE" && stroke !== "#f39200" && stroke !== "#F39200" ? 'stroke-dasharray="4,4"' : "";

  if (s.d) {
    return `    <path d="${s.d}" stroke="${stroke}" stroke-width="0.5" fill="none" data-id="${s.svgId}"/>`;
  }
  if (s.points && s.points.length >= 2) {
    const ptsStr = s.points.map(p => `${r(p.x)},${r(p.y)}`).join(" ");
    return `    <polyline points="${ptsStr}" stroke="${stroke}" stroke-width="0.5" fill="none" ${dash} data-id="${s.svgId}"/>`;
  }
  if (s.start.x === s.end.x && s.start.y === s.end.y) return "";
  return `    <line x1="${r(s.start.x)}" y1="${r(s.start.y)}" x2="${r(s.end.x)}" y2="${r(s.end.y)}" stroke="${stroke}" stroke-width="0.5" fill="none" ${dash} data-id="${s.svgId}"/>`;
}

export function buildA60_20_01_01SingleTemplateSvg(geo: A60_20_01_01Geometry): string {
  const w = r(geo.bbox.w);
  const h = r(geo.bbox.h);

  const crease = geo.segments.filter(s => s.kind === "CREASE");
  const cut = geo.segments.filter(s => s.kind === "OUTER" || s.kind === "CUT");

  const out: string[] = [];
  out.push(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>`);
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" version="1.1" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">`);

  out.push(`  <g id="CREASE" inkscape:label="CREASE" fill="none" stroke="${CREASE_COLOR}" stroke-miterlimit="10">`);
  for (const s of crease) {
    const el = renderSeg(s, CREASE_COLOR);
    if (el) out.push(el);
  }
  out.push(`  </g>`);

  out.push(`  <g id="CUT" inkscape:label="CUT" fill="none" stroke="${CUT_COLOR}" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10">`);
  for (const s of cut) {
    const el = renderSeg(s, CUT_COLOR);
    if (el) out.push(el);
  }
  out.push(`  </g>`);

  out.push(`</svg>`);
  return out.join("\n");
}

export function downloadA60_20_01_01SingleTemplate(geo: A60_20_01_01Geometry, filename = "A60_20_01_01.svg") {
  const svg = buildA60_20_01_01SingleTemplateSvg(geo);
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

export async function downloadA60_20_01_01SingleTemplatePdf(
  svgMarkup: string,
  filename = "A60_20_01_01.pdf",
) {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-100000px";
  host.style.top = "0";
  host.style.visibility = "hidden";
  host.innerHTML = svgMarkup;
  const svgEl = host.querySelector("svg") as SVGSVGElement | null;
  if (!svgEl) throw new Error("A60_20_01_01 PDF export: failed to parse SVG.");
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
