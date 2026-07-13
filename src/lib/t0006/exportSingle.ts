import jsPDF from "jspdf";
import type { T0006Geometry } from "./types";

export function exportT0006SinglePdf(geo: T0006Geometry) {
  const w = geo.bbox.w;
  const h = geo.bbox.h;

  const pdf = new jsPDF({
    orientation: w > h ? "landscape" : "portrait",
    unit: "mm",
    format: [w, h]
  });

  const parser = new DOMParser();
  const doc = parser.parseFromString(geo.svg, "image/svg+xml");
  const svgEl = doc.documentElement;

  // Draw creases (green)
  pdf.setDrawColor(0, 150, 64);
  pdf.setLineWidth(0.15);
  const creases = svgEl.querySelectorAll("#CREASE line, #CREASE path");
  creases.forEach((el) => {
    const d = el.getAttribute("d");
    if (d) {
      drawPath(pdf, d);
    } else {
      const x1 = parseFloat(el.getAttribute("x1") || "0");
      const y1 = parseFloat(el.getAttribute("y1") || "0");
      const x2 = parseFloat(el.getAttribute("x2") || "0");
      const y2 = parseFloat(el.getAttribute("y2") || "0");
      pdf.line(x1, y1, x2, y2);
    }
  });

  // Draw cuts (red)
  pdf.setDrawColor(227, 6, 19);
  pdf.setLineWidth(0.15);
  const cuts = svgEl.querySelectorAll("#CUT line, #CUT path, #CUT polyline");
  cuts.forEach((el) => {
    const d = el.getAttribute("d");
    if (d) {
      drawPath(pdf, d);
    } else {
      const points = el.getAttribute("points");
      if (points) {
        const pts = points.trim().split(/\s+/).map((p) => {
          const [x, y] = p.split(",").map(parseFloat);
          return { x, y };
        });
        for (let i = 0; i < pts.length - 1; i++) {
          pdf.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
        }
      } else {
        const x1 = parseFloat(el.getAttribute("x1") || "0");
        const y1 = parseFloat(el.getAttribute("y1") || "0");
        const x2 = parseFloat(el.getAttribute("x2") || "0");
        const y2 = parseFloat(el.getAttribute("y2") || "0");
        pdf.line(x1, y1, x2, y2);
      }
    }
  });

  pdf.save(`T0006_Dieline_${geo.params.width}x${geo.params.height}x${geo.params.depth}.pdf`);
}

function drawPath(pdf: jsPDF, d: string) {
  const parts = d.trim().split(/(?=[MLCAZmlcaz])/);
  let cx = 0, cy = 0;
  parts.forEach((part) => {
    const cmd = part[0];
    const args = part.slice(1).trim().split(/[\s,]+/).map(parseFloat);
    if (cmd === "M" || cmd === "m") {
      cx = args[0];
      cy = args[1];
    } else if (cmd === "L" || cmd === "l") {
      pdf.line(cx, cy, args[0], args[1]);
      cx = args[0];
      cy = args[1];
    } else if (cmd === "C" || cmd === "c") {
      pdf.curve(cx, cy, args[0], args[1], args[2], args[3], args[4], args[5]);
      cx = args[4];
      cy = args[5];
    } else if (cmd === "A" || cmd === "a") {
      // Approximate arc with line for simplicity in single vector pdf
      pdf.line(cx, cy, args[5], args[6]);
      cx = args[5];
      cy = args[6];
    }
  });
}
