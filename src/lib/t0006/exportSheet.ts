import jsPDF from "jspdf";
import type { T0006Geometry } from "./types";
import type { NestingResult } from "./nesting";

export function exportT0006SheetPdf(geo: T0006Geometry, nesting: NestingResult) {
  const sheetW = geo.params.sheetWidth;
  const sheetH = geo.params.sheetHeight;

  const pdf = new jsPDF({
    orientation: sheetW > sheetH ? "landscape" : "portrait",
    unit: "mm",
    format: [sheetW, sheetH]
  });

  const parser = new DOMParser();
  const doc = parser.parseFromString(geo.svg, "image/svg+xml");
  const svgEl = doc.documentElement;

  // Draw sheet margin
  const margin = geo.params.sheetMargin;
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.2);
  pdf.rect(margin, margin, sheetW - 2 * margin, sheetH - 2 * margin);

  // Draw gripper
  const gripper = geo.params.gripper;
  pdf.setFillColor(240, 240, 240);
  pdf.rect(margin, margin, sheetW - 2 * margin, gripper, "F");

  nesting.placements.forEach((place) => {
    pdf.saveGraphicsState();
    
    // Translation and rotation
    pdf.translate(place.x, place.y);
    if (place.rotation === 90) {
      pdf.rotate(90);
      pdf.translate(0, -geo.bbox.w);
    }

    // Draw creases
    pdf.setDrawColor(0, 150, 64);
    pdf.setLineWidth(0.12);
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

    // Draw cuts
    pdf.setDrawColor(227, 6, 19);
    pdf.setLineWidth(0.12);
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

    pdf.restoreGraphicsState();
  });

  pdf.save(`T0006_Layout_${sheetW}x${sheetH}_x${nesting.total}.pdf`);
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
      pdf.line(cx, cy, args[5], args[6]);
      cx = args[5];
      cy = args[6];
    }
  });
}
