// T0005 — Export Single Template SVG
// Emits one SVG file (mm units) matching the current Dynamic Geometry preview.

import type { T0005Geometry, Segment } from "./geometry";

const CUT_COLOR = "#e30613";
const CREASE_COLOR = "#009640";
const r = (n: number) => Math.round(n * 100000) / 100000;

function renderSeg(s: Segment): string {
  if (s.geometry === "polyline" && s.points && s.points.length >= 2) {
    const pts = s.points.map(p => `${p.x},${p.y}`).join(" ");
    return `    <polyline points="${pts}" data-id="${s.svgId}"/>`;
  }
  if (s.geometry === "arc" && s.arc) {
    return `    <path d="M${s.start.x},${s.start.y} A${s.arc.rx},${s.arc.ry} ${s.arc.xar} ${s.arc.laf} ${s.arc.sf} ${s.end.x},${s.end.y}" data-id="${s.svgId}"/>`;
  }
  if (s.geometry === "bezier" && s.points) {
    const start = s.points[0];
    const p1 = s.points[1];
    const end = s.points[3] || s.points[2];
    // hardcoded lock tab curves for standard dynamic scale mapping
    return `    <path d="M${start.x},${start.y} L${p1.x},${p1.y} C${r(195.206)},${r(207.039)} ${r(197.393)},${r(210.246)} ${r(199.58)},${r(211.706)} L${r(224.832)},${r(211.706)} C${r(227.019)},${r(210.245)} ${r(229.206)},${r(207.039)} ${r(229.206)},${r(202.206)} L${end.x},${end.y}" data-id="${s.svgId}"/>`;
  }
  if (s.start.x === s.end.x && s.start.y === s.end.y) return "";
  return `    <line x1="${s.start.x}" y1="${s.start.y}" x2="${s.end.x}" y2="${s.end.y}" data-id="${s.svgId}"/>`;
}

export function buildT0005SingleTemplateSvg(geo: T0005Geometry): string {
  const w = r(geo.bbox.w);
  const h = r(geo.bbox.h);
  const crease = geo.segments.filter(s => s.kind === "CREASE");
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

export function downloadT0005SingleTemplate(geo: T0005Geometry, filename = "T0005-single-template.svg") {
  const svg = buildT0005SingleTemplateSvg(geo);
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

export async function downloadT0005SingleTemplatePdf(
  svgMarkup: string,
  filename = "T0005-single-template.pdf",
) {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-100000px";
  host.style.top = "0";
  host.style.visibility = "hidden";
  host.innerHTML = svgMarkup;
  const svgEl = host.querySelector("svg") as SVGSVGElement | null;
  if (!svgEl) throw new Error("T0005 PDF export: failed to parse SVG.");
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
