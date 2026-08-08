/**
 * Production Export Layer
 * --------------------------------------------------------------
 * Generates production-ready vector files (SVG / PDF / EPS) for a
 * sheet layout. Each piece is exported as an independent vector
 * object, with optional layers for the sheet boundary, piece
 * numbers and waste area.
 *
 * When a Dieline is imported, every piece is replaced by the
 * dieline's actual geometry (cut + crease lines), scaled and
 * positioned to fit each piece slot. This produces production-
 * ready cutting files instead of plain rectangles.
 *
 * NOTE on units:
 *   - Internal app units are centimetres (cm).
 *   - 1 cm = 10 mm, and 1 mm = 2.83464567 PostScript points (pt).
 *     ➜ 1 cm = 28.3464567 pt
 *   - PDF & EPS use the PostScript coordinate system (origin = bottom-left).
 *   - SVG uses top-left origin in user units (we set 1 user unit = 1 mm).
 */

import type { LayoutPiece } from './sheetLayoutOptimizer';
import type { ParsedDieline } from './dielineImport';

export type ExportFormat = 'svg' | 'pdf' | 'eps' | 'ai';

export interface ExportOptions {
  /** Sheet width in cm */
  sheetW: number;
  /** Sheet height in cm */
  sheetH: number;
  /** Pieces (positions/sizes are in cm; origin = top-left of sheet) */
  pieces: LayoutPiece[];
  /** Optional file title/metadata */
  title?: string;
  /** Show piece numbers (Optional layer) */
  includeNumbers?: boolean;
  /** Show waste/empty area as a grey overlay */
  includeWaste?: boolean;
  /** Include sheet boundary rectangle */
  includeBoundary?: boolean;
  /** Clean print mode = no numbers, no waste, only piece outlines + boundary */
  cleanMode?: boolean;
  /** Optional imported dieline — when present each piece is rendered using its geometry */
  dieline?: ParsedDieline | null;
  /** Optional native template vector dieline paths for production export */
  dielinePaths?: {
    cutD: string;
    creaseD: string;
    bbox: { w: number; h: number };
  } | null;
}

/* ───────────────── Unit helpers ───────────────── */
const CM_TO_MM = 10;
const MM_TO_PT = 2.83464566929; // PostScript points per mm
const CM_TO_PT = CM_TO_MM * MM_TO_PT; // ≈ 28.346

/* ───────────────── Dieline → SVG fragment ─────────────────
 * Returns a piece-sized <svg> element containing the dieline geometry,
 * positioned at (xMm,yMm) with the requested size in mm.
 */
function dielineSvgFragment(
  dieline: ParsedDieline,
  xMm: number,
  yMm: number,
  wMm: number,
  hMm: number,
  id: string,
): string {
  const m = dieline.svgMarkup.match(/viewBox\s*=\s*"([^"]+)"/);
  const viewBox = m ? m[1] : `0 0 ${dieline.width} ${dieline.height}`;
  const inner = dieline.svgMarkup
    .replace(/^<svg[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '');
  return `    <svg id="${id}" x="${xMm.toFixed(4)}" y="${yMm.toFixed(4)}" width="${wMm.toFixed(4)}" height="${hMm.toFixed(4)}" viewBox="${viewBox}" preserveAspectRatio="none">${inner}</svg>`;
}

/* ───────────────── SVG element → PostScript path commands ─────────────────
 * Best-effort converter for the most common dieline primitives. Returns
 * PostScript path operators (without stroke) in the dieline's own viewBox
 * coordinate system. The caller wraps these inside a transform that scales
 * the dieline into a piece slot.
 */
function svgElementsToPathOps(dieline: ParsedDieline): { ops: string; vbW: number; vbH: number } {
  const m = dieline.svgMarkup.match(/viewBox\s*=\s*"([^"]+)"/);
  let vbW = dieline.width, vbH = dieline.height;
  if (m) {
    const parts = m[1].split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      vbW = parts[2]; vbH = parts[3];
    }
  }

  const doc = new DOMParser().parseFromString(dieline.svgMarkup, 'image/svg+xml');
  const lines: string[] = [];

  doc.querySelectorAll('line').forEach((el) => {
    const x1 = parseFloat(el.getAttribute('x1') || '0');
    const y1 = parseFloat(el.getAttribute('y1') || '0');
    const x2 = parseFloat(el.getAttribute('x2') || '0');
    const y2 = parseFloat(el.getAttribute('y2') || '0');
    lines.push(`newpath ${x1.toFixed(4)} ${y1.toFixed(4)} moveto ${x2.toFixed(4)} ${y2.toFixed(4)} lineto stroke`);
  });

  doc.querySelectorAll('rect').forEach((el) => {
    const x = parseFloat(el.getAttribute('x') || '0');
    const y = parseFloat(el.getAttribute('y') || '0');
    const w = parseFloat(el.getAttribute('width') || '0');
    const h = parseFloat(el.getAttribute('height') || '0');
    if (w > 0 && h > 0) {
      lines.push(`newpath ${x.toFixed(4)} ${y.toFixed(4)} moveto ${w.toFixed(4)} 0 rlineto 0 ${h.toFixed(4)} rlineto ${(-w).toFixed(4)} 0 rlineto closepath stroke`);
    }
  });

  const pointsToOps = (raw: string, close: boolean) => {
    const pts = raw.trim().split(/\s+/).map((pair) => pair.split(',').map(Number));
    if (pts.length < 2) return '';
    const [x0, y0] = pts[0];
    let s = `newpath ${x0.toFixed(4)} ${y0.toFixed(4)} moveto`;
    for (let i = 1; i < pts.length; i++) {
      s += ` ${pts[i][0].toFixed(4)} ${pts[i][1].toFixed(4)} lineto`;
    }
    s += close ? ' closepath stroke' : ' stroke';
    return s;
  };
  doc.querySelectorAll('polyline').forEach((el) => {
    const ops = pointsToOps(el.getAttribute('points') || '', false);
    if (ops) lines.push(ops);
  });
  doc.querySelectorAll('polygon').forEach((el) => {
    const ops = pointsToOps(el.getAttribute('points') || '', true);
    if (ops) lines.push(ops);
  });

  // Path: convert M/L/Z (absolute) — most dielines use straight lines.
  // Curves are approximated as line segments to keep the converter
  // dependency-free; complex curved dielines should use SVG export.
  doc.querySelectorAll('path').forEach((el) => {
    const d = el.getAttribute('d') || '';
    const ops = pathDataToPS(d);
    if (ops) lines.push(ops);
  });

  return { ops: lines.join('\n'), vbW, vbH };
}

/** SVG path-data → PostScript converter (M/L/H/V/C/S/Q/A/Z, both cases) */
function pathDataToPS(d: string): string {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[+-]?\d+)?/gi);
  if (!tokens) return '';
  const out: string[] = [];
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0;
  let lastControlX = 0, lastControlY = 0;
  let started = false;
  const num = () => parseFloat(tokens[i++] || '0');
  const isCmd = (t: string) => /^[a-zA-Z]$/.test(t);

  while (i < tokens.length) {
    const t = tokens[i];
    if (isCmd(t)) { cmd = t; i++; }

    if (cmd === 'M' || cmd === 'm') {
      const nx = num(), ny = num();
      x = cmd === 'M' ? nx : x + nx;
      y = cmd === 'M' ? ny : y + ny;
      sx = x; sy = y;
      lastControlX = x; lastControlY = y;
      if (!started) { out.push('newpath'); started = true; }
      out.push(`${x.toFixed(4)} ${y.toFixed(4)} moveto`);
      cmd = cmd === 'M' ? 'L' : 'l';
    } else if (cmd === 'L' || cmd === 'l') {
      const nx = num(), ny = num();
      x = cmd === 'L' ? nx : x + nx;
      y = cmd === 'L' ? ny : y + ny;
      lastControlX = x; lastControlY = y;
      out.push(`${x.toFixed(4)} ${y.toFixed(4)} lineto`);
    } else if (cmd === 'H' || cmd === 'h') {
      const nx = num();
      x = cmd === 'H' ? nx : x + nx;
      lastControlX = x; lastControlY = y;
      out.push(`${x.toFixed(4)} ${y.toFixed(4)} lineto`);
    } else if (cmd === 'V' || cmd === 'v') {
      const ny = num();
      y = cmd === 'V' ? ny : y + ny;
      lastControlX = x; lastControlY = y;
      out.push(`${x.toFixed(4)} ${y.toFixed(4)} lineto`);
    } else if (cmd === 'C' || cmd === 'c') {
      const x1 = cmd === 'C' ? num() : x + num();
      const y1 = cmd === 'C' ? num() : y + num();
      const x2 = cmd === 'C' ? num() : x + num();
      const y2 = cmd === 'C' ? num() : y + num();
      const x3 = cmd === 'C' ? num() : x + num();
      const y3 = cmd === 'C' ? num() : y + num();
      out.push(`${x1.toFixed(4)} ${y1.toFixed(4)} ${x2.toFixed(4)} ${y2.toFixed(4)} ${x3.toFixed(4)} ${y3.toFixed(4)} curveto`);
      lastControlX = x2; lastControlY = y2;
      x = x3; y = y3;
    } else if (cmd === 'S' || cmd === 's') {
      const x1 = 2 * x - lastControlX;
      const y1 = 2 * y - lastControlY;
      const x2 = cmd === 'S' ? num() : x + num();
      const y2 = cmd === 'S' ? num() : y + num();
      const x3 = cmd === 'S' ? num() : x + num();
      const y3 = cmd === 'S' ? num() : y + num();
      out.push(`${x1.toFixed(4)} ${y1.toFixed(4)} ${x2.toFixed(4)} ${y2.toFixed(4)} ${x3.toFixed(4)} ${y3.toFixed(4)} curveto`);
      lastControlX = x2; lastControlY = y2;
      x = x3; y = y3;
    } else if (cmd === 'Q' || cmd === 'q') {
      const qx = cmd === 'Q' ? num() : x + num();
      const qy = cmd === 'Q' ? num() : y + num();
      const qx2 = cmd === 'Q' ? num() : x + num();
      const qy2 = cmd === 'Q' ? num() : y + num();
      const cx1 = x + (2 / 3) * (qx - x);
      const cy1 = y + (2 / 3) * (qy - y);
      const cx2 = qx2 + (2 / 3) * (qx - qx2);
      const cy2 = qy2 + (2 / 3) * (qy - qy2);
      out.push(`${cx1.toFixed(4)} ${cy1.toFixed(4)} ${cx2.toFixed(4)} ${cy2.toFixed(4)} ${qx2.toFixed(4)} ${qy2.toFixed(4)} curveto`);
      lastControlX = qx; lastControlY = qy;
      x = qx2; y = qy2;
    } else if (cmd === 'A' || cmd === 'a') {
      num(); num(); num(); num(); num();
      const ex = cmd === 'A' ? num() : x + num();
      const ey = cmd === 'A' ? num() : y + num();
      out.push(`${ex.toFixed(4)} ${ey.toFixed(4)} lineto`);
      x = ex; y = ey;
      lastControlX = x; lastControlY = y;
    } else if (cmd === 'Z' || cmd === 'z') {
      out.push('closepath');
      x = sx; y = sy;
      lastControlX = x; lastControlY = y;
    } else {
      i++;
    }
  }
  if (started) out.push('stroke');
  return out.join(' ');
}

/* ───────────────── SVG ───────────────── */
export function buildSVG(opts: ExportOptions): string {
  const {
    sheetW, sheetH, pieces,
    includeNumbers = true,
    includeWaste = false,
    includeBoundary = true,
    cleanMode = false,
    title = 'Sheet Layout',
    dieline = null,
  } = opts;

  const showNumbers = !cleanMode && includeNumbers;
  const showWaste = !cleanMode && includeWaste;

  const w = sheetW * CM_TO_MM;
  const h = sheetH * CM_TO_MM;

  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const boundaryLayer = includeBoundary
    ? `  <g inkscape:groupmode="layer" inkscape:label="Sheet Boundary" id="layer-boundary">
    <rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="#000000" stroke-width="0.25" />
  </g>\n`
    : '';

  const turnsOf = (p: LayoutPiece): number => {
    if (typeof p.rotation === 'number') return ((p.rotation % 4) + 4) % 4;
    return p.rotated ? 1 : 0;
  };

  const piecesXml = pieces
    .map((p) => {
      const px = p.x * CM_TO_MM;
      const py = p.y * CM_TO_MM;
      const pw = p.w * CM_TO_MM;
      const ph = p.h * CM_TO_MM;
      const turns = turnsOf(p);
      const angle = turns * 90;
      const cx = px + pw / 2;
      const cy = py + ph / 2;
      // For 90°/270° turns, the dieline's natural (un-rotated) extents must
      // span the slot's swapped dims so that after rotating around the center
      // it fills the slot exactly. We draw the inner content at (cx - h/2, cy - w/2)
      // with size (h × w) and then rotate by `angle` around (cx, cy).
      const innerW = (turns % 2 === 1) ? ph : pw;
      const innerH = (turns % 2 === 1) ? pw : ph;
      const ix = cx - innerW / 2;
      const iy = cy - innerH / 2;
      const transform = angle ? ` transform="rotate(${angle} ${cx.toFixed(4)} ${cy.toFixed(4)})"` : '';
      if (opts.dielinePaths && opts.dielinePaths.cutD) {
        const bboxW = opts.dielinePaths.bbox.w;
        const bboxH = opts.dielinePaths.bbox.h;
        const mmCx = bboxW / 2;
        const mmCy = bboxH / 2;
        const transform = `transform="translate(${cx.toFixed(4)} ${cy.toFixed(4)}) rotate(${angle}) ${p.mirrored ? 'scale(-1 1) ' : ''}translate(${-mmCx.toFixed(4)} ${-mmCy.toFixed(4)})"`;
        const creasePart = opts.dielinePaths.creaseD
          ? `      <path d="${opts.dielinePaths.creaseD}" fill="none" stroke="#00A651" stroke-width="0.35" stroke-dasharray="2 1" />\n`
          : '';
        const cutPart = `      <path d="${opts.dielinePaths.cutD}" fill="none" stroke="#ED1C24" stroke-width="0.45" stroke-linecap="round" stroke-linejoin="round" />`;
        return `    <g id="piece-${p.index}" ${transform}>\n${creasePart}${cutPart}\n    </g>`;
      }
      if (dieline) {
        const inner = dielineSvgFragment(dieline, ix, iy, innerW, innerH, `piece-${p.index}`);
        return angle ? `    <g${transform}>\n${inner}\n    </g>` : inner;
      }
      return `    <rect id="piece-${p.index}" data-rotated="${!!p.rotated}" data-rotation="${turns}" x="${ix.toFixed(4)}" y="${iy.toFixed(4)}" width="${innerW.toFixed(4)}" height="${innerH.toFixed(4)}" fill="none" stroke="#000000" stroke-width="0.2"${transform} />`;
    })
    .join('\n');

  const piecesLayer = `  <g inkscape:groupmode="layer" inkscape:label="${dieline ? 'Dielines' : 'Pieces'}" id="layer-pieces">
${piecesXml}
  </g>\n`;

  const numbersLayer = showNumbers
    ? `  <g inkscape:groupmode="layer" inkscape:label="Numbers" id="layer-numbers" font-family="Helvetica" fill="#444444">
${pieces
  .map((p) => {
    const cx = (p.x + p.w / 2) * CM_TO_MM;
    const cy = (p.y + p.h / 2) * CM_TO_MM;
    const fs = Math.max(2, Math.min(p.w, p.h) * CM_TO_MM * 0.18);
    return `    <text x="${cx.toFixed(2)}" y="${cy.toFixed(2)}" text-anchor="middle" dominant-baseline="central" font-size="${fs.toFixed(2)}">${p.index}</text>`;
  })
  .join('\n')}
  </g>\n`
    : '';

  const wasteLayer = showWaste
    ? `  <g inkscape:groupmode="layer" inkscape:label="Waste" id="layer-waste" opacity="0.25">
    <defs>
      <mask id="waste-mask">
        <rect x="0" y="0" width="${w}" height="${h}" fill="white" />
${pieces
  .map((p) => {
    const px = p.x * CM_TO_MM;
    const py = p.y * CM_TO_MM;
    const pw = p.w * CM_TO_MM;
    const ph = p.h * CM_TO_MM;
    return `        <rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="black" />`;
  })
  .join('\n')}
      </mask>
    </defs>
    <rect x="0" y="0" width="${w}" height="${h}" fill="#888888" mask="url(#waste-mask)" />
  </g>\n`
    : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     width="${w}mm" height="${h}mm"
     viewBox="0 0 ${w} ${h}">
  <title>${escape(title)}</title>
  <desc>Production layout — ${pieces.length} pieces · sheet ${sheetW}×${sheetH} cm${dieline ? ` · dieline: ${dieline.fileName}` : ''}</desc>
${boundaryLayer}${wasteLayer}${piecesLayer}${numbersLayer}</svg>`;
}

/* ───────────────── EPS / AI ───────────────── */
export function buildEPS(opts: ExportOptions): string {
  const {
    sheetW, sheetH, pieces,
    includeNumbers = true,
    includeWaste = false,
    includeBoundary = true,
    cleanMode = false,
    title = 'Sheet Layout',
    dieline = null,
  } = opts;

  const showNumbers = !cleanMode && includeNumbers;
  const showWaste = !cleanMode && includeWaste;

  const wPt = sheetW * CM_TO_PT;
  const hPt = sheetH * CM_TO_PT;
  const toPtX = (xCm: number) => xCm * CM_TO_PT;
  const toPtY = (yCm: number, hCm: number) => (sheetH - yCm - hCm) * CM_TO_PT;

  // Pre-convert dieline to a reusable PostScript path procedure
  let dielinePS: { ops: string; vbW: number; vbH: number } | null = null;
  if (dieline) dielinePS = svgElementsToPathOps(dieline);

  const lines: string[] = [];
  lines.push('%!PS-Adobe-3.0 EPSF-3.0');
  lines.push(`%%Title: ${title}`);
  lines.push('%%Creator: Pricing Calculator — Production Export Layer');
  lines.push(`%%BoundingBox: 0 0 ${Math.ceil(wPt)} ${Math.ceil(hPt)}`);
  lines.push(`%%HiResBoundingBox: 0 0 ${wPt.toFixed(4)} ${hPt.toFixed(4)}`);
  lines.push('%%LanguageLevel: 2');
  lines.push('%%Pages: 1');
  lines.push('%%EndComments');
  lines.push('%%BeginProlog');
  lines.push('/rectStroke { 4 dict begin /h exch def /w exch def /y exch def /x exch def');
  lines.push('  newpath x y moveto w 0 rlineto 0 h rlineto w neg 0 rlineto closepath stroke end } bind def');
  lines.push('/rectFill { 4 dict begin /h exch def /w exch def /y exch def /x exch def');
  lines.push('  newpath x y moveto w 0 rlineto 0 h rlineto w neg 0 rlineto closepath fill end } bind def');
  if (dielinePS) {
    // Define a procedure that draws the dieline at the current transform
    lines.push('/drawDieline {');
    lines.push(dielinePS.ops);
    lines.push('} bind def');
  }
  lines.push('%%EndProlog');
  lines.push('%%Page: 1 1');
  lines.push('gsave');
  lines.push('0 setgray 0.25 setlinewidth 1 setlinejoin 1 setlinecap');

  if (showWaste) {
    lines.push('%% --- Waste Layer ---');
    lines.push('gsave 0.85 setgray');
    lines.push(`0 0 ${wPt.toFixed(4)} ${hPt.toFixed(4)} rectFill`);
    lines.push('1 setgray');
    pieces.forEach((p) => {
      lines.push(`${toPtX(p.x).toFixed(4)} ${toPtY(p.y, p.h).toFixed(4)} ${(p.w * CM_TO_PT).toFixed(4)} ${(p.h * CM_TO_PT).toFixed(4)} rectFill`);
    });
    lines.push('grestore');
  }

  if (includeBoundary) {
    lines.push('%% --- Sheet Boundary ---');
    lines.push('gsave 0 setgray 0.4 setlinewidth');
    lines.push(`0 0 ${wPt.toFixed(4)} ${hPt.toFixed(4)} rectStroke`);
    lines.push('grestore');
  }

  // Pieces (or dielines)
  lines.push(`%% --- ${dielinePS ? 'Dielines' : 'Pieces'} ---`);
  lines.push('gsave 0 setgray 0.25 setlinewidth');
  pieces.forEach((p) => {
    const x = toPtX(p.x);
    const y = toPtY(p.y, p.h);
    const wPiecePt = p.w * CM_TO_PT;
    const hPiecePt = p.h * CM_TO_PT;
    const turns = ((((p.rotation ?? (p.rotated ? 1 : 0)) as number) % 4) + 4) % 4;
    lines.push(`%% piece ${p.index}${turns ? ` (rot ${turns * 90}°)` : ''}`);
    if (dielinePS && dielinePS.vbW > 0 && dielinePS.vbH > 0) {
      const innerWPt = (turns % 2 === 1) ? hPiecePt : wPiecePt;
      const innerHPt = (turns % 2 === 1) ? wPiecePt : hPiecePt;
      const sx = innerWPt / dielinePS.vbW;
      const sy = innerHPt / dielinePS.vbH;
      const cx = x + wPiecePt / 2;
      const cy = y + hPiecePt / 2;
      // PS rotate is CCW in degrees. Screen rotation is CW → negate.
      const angle = -turns * 90;
      lines.push('gsave');
      lines.push(`${cx.toFixed(4)} ${cy.toFixed(4)} translate`);
      if (angle) lines.push(`${angle} rotate`);
      lines.push(`${(-innerWPt / 2).toFixed(4)} ${(innerHPt / 2).toFixed(4)} translate`);
      lines.push(`${sx.toFixed(6)} ${(-sy).toFixed(6)} scale`);
      lines.push('drawDieline');
      lines.push('grestore');
    } else {
      lines.push(`${x.toFixed(4)} ${y.toFixed(4)} ${wPiecePt.toFixed(4)} ${hPiecePt.toFixed(4)} rectStroke`);
    }
  });
  lines.push('grestore');

  if (showNumbers) {
    lines.push('%% --- Piece Numbers ---');
    lines.push('gsave 0.25 setgray');
    lines.push('/Helvetica findfont 1 scalefont setfont');
    pieces.forEach((p) => {
      const cx = toPtX(p.x + p.w / 2);
      const cy = toPtY(p.y, p.h) + (p.h * CM_TO_PT) / 2;
      const fs = Math.max(6, Math.min(p.w, p.h) * CM_TO_PT * 0.18);
      const label = String(p.index);
      lines.push(`/Helvetica findfont ${fs.toFixed(2)} scalefont setfont`);
      lines.push(`${cx.toFixed(2)} ${(cy - fs * 0.35).toFixed(2)} moveto`);
      lines.push(`(${label}) dup stringwidth pop 2 div neg 0 rmoveto show`);
    });
    lines.push('grestore');
  }

  lines.push('grestore');
  lines.push('showpage');
  lines.push('%%Trailer');
  lines.push('%%EOF');
  return lines.join('\n');
}

/* ───────────────── PDF ───────────────── */
export function buildPDF(opts: ExportOptions): Uint8Array {
  const {
    sheetW, sheetH, pieces,
    includeNumbers = true,
    includeWaste = false,
    includeBoundary = true,
    cleanMode = false,
    title = 'Sheet Layout',
    dieline = null,
  } = opts;

  const showNumbers = !cleanMode && includeNumbers;
  const showWaste = !cleanMode && includeWaste;

  const wPt = sheetW * CM_TO_PT;
  const hPt = sheetH * CM_TO_PT;
  const toPtX = (xCm: number) => xCm * CM_TO_PT;
  const toPtY = (yCm: number, hCm: number) => (sheetH - yCm - hCm) * CM_TO_PT;

  // Build dieline PDF path operators (in dieline viewBox space).
  // PDF uses similar primitives to PS: m, l, h, S (stroke), re (rect).
  let dielinePDF: { ops: string; vbW: number; vbH: number } | null = null;
  if (dieline) {
    const ps = svgElementsToPathOps(dieline);
    // Convert PS ops → PDF ops with simple substitution
    const pdfOps = ps.ops
      .replace(/newpath/g, '')
      .replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) moveto/g, '$1 $2 m')
      .replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) lineto/g, '$1 $2 l')
      .replace(/closepath stroke/g, 'h S')
      .replace(/closepath/g, 'h')
      .replace(/\bstroke\b/g, 'S');
    dielinePDF = { ops: pdfOps, vbW: ps.vbW, vbH: ps.vbH };
  }

  const stream: string[] = [];

  if (showWaste) {
    stream.push('q 0.85 0.85 0.85 rg');
    stream.push(`0 0 ${wPt.toFixed(4)} ${hPt.toFixed(4)} re f`);
    stream.push('1 1 1 rg');
    pieces.forEach((p) => {
      stream.push(`${toPtX(p.x).toFixed(4)} ${toPtY(p.y, p.h).toFixed(4)} ${(p.w * CM_TO_PT).toFixed(4)} ${(p.h * CM_TO_PT).toFixed(4)} re f`);
    });
    stream.push('Q');
  }

  if (includeBoundary) {
    stream.push('q 0 0 0 RG 0.4 w');
    stream.push(`0 0 ${wPt.toFixed(4)} ${hPt.toFixed(4)} re S`);
    stream.push('Q');
  }

function psToPDF(ps: string): string {
  return ps
    .replace(/newpath/g, '')
    .replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) moveto/g, '$1 $2 m')
    .replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) lineto/g, '$1 $2 l')
    .replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) curveto/g, '$1 $2 $3 $4 $5 $6 c')
    .replace(/closepath stroke/g, 'h S')
    .replace(/closepath/g, 'h')
    .replace(/\bstroke\b/g, 'S');
}

  // Build dieline PDF path operators for native template dielinePaths
  let nativeCutOps = '';
  let nativeCreaseOps = '';
  let nativeBboxW = 0;
  let nativeBboxH = 0;
  if (opts.dielinePaths && opts.dielinePaths.cutD) {
    const cutPs = pathDataToPS(opts.dielinePaths.cutD);
    nativeCutOps = psToPDF(cutPs);
    if (opts.dielinePaths.creaseD) {
      const creasePs = pathDataToPS(opts.dielinePaths.creaseD);
      nativeCreaseOps = psToPDF(creasePs);
    }
    nativeBboxW = opts.dielinePaths.bbox.w;
    nativeBboxH = opts.dielinePaths.bbox.h;
  }

  // Pieces (or dielines)
  stream.push('q 0 0 0 RG 0.25 w');
  pieces.forEach((p) => {
    const x = toPtX(p.x);
    const y = toPtY(p.y, p.h);
    const wPiecePt = p.w * CM_TO_PT;
    const hPiecePt = p.h * CM_TO_PT;
    const turns = ((((p.rotation ?? (p.rotated ? 1 : 0)) as number) % 4) + 4) % 4;

    if (nativeCutOps && nativeBboxW > 0 && nativeBboxH > 0) {
      const mmCx = nativeBboxW / 2;
      const mmCy = nativeBboxH / 2;
      const cxPt = (p.x + p.w / 2) * CM_TO_PT;
      const cyPt = (sheetH - p.y - p.h / 2) * CM_TO_PT;
      const angleRad = -turns * Math.PI / 2;
      const scale = MM_TO_PT;
      const cos = Math.cos(angleRad) * scale;
      const sin = Math.sin(angleRad) * scale;
      const mirror = p.mirrored ? -1 : 1;
      const a = cos * mirror;
      const b = sin * mirror;
      const c = sin;
      const d = -cos;
      const tx = -mmCx;
      const ty = -mmCy;
      const e = cxPt + a * tx + c * ty;
      const f = cyPt + b * tx + d * ty;
      stream.push('q');
      stream.push(`${a.toFixed(6)} ${b.toFixed(6)} ${c.toFixed(6)} ${d.toFixed(6)} ${e.toFixed(4)} ${f.toFixed(4)} cm`);
      if (nativeCreaseOps) {
        stream.push('0 0.65 0.32 RG [2 1] 0 d 1.0 w');
        stream.push(nativeCreaseOps);
      }
      stream.push('0.93 0.02 0.07 RG [] 0 d 1.4 w');
      stream.push(nativeCutOps);
      stream.push('Q');
    } else if (dielinePDF && dielinePDF.vbW > 0 && dielinePDF.vbH > 0) {
      // Inner (un-rotated) dieline extents — swapped on quarter turns so that
      // rotating around the piece center fills the (already swapped) slot.
      const innerWPt = (turns % 2 === 1) ? hPiecePt : wPiecePt;
      const innerHPt = (turns % 2 === 1) ? wPiecePt : hPiecePt;
      const sx = innerWPt / dielinePDF.vbW;
      const sy = innerHPt / dielinePDF.vbH;
      const cx = x + wPiecePt / 2;
      const cy = y + hPiecePt / 2;
      // PDF rotation is counter-clockwise. SVG/screen rotation is clockwise.
      // To match the screen preview, negate the angle.
      const angleRad = -turns * Math.PI / 2;
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
      // Compose: T(cx,cy) · R(angle) · T(-innerW/2, +innerH/2) · S(sx, -sy)
      // The translate-by-(-w/2, +h/2) places the dieline's top-left at the
      // un-rotated bounding box, then S(sx,-sy) flips Y for PDF coords.
      // Final matrix sent to `cm`: a b c d e f
      const a = sx * cos;
      const b = sx * sin;
      const c = -(-sy) * sin; // = sy * sin
      const d = (-sy) * cos;  // = -sy * cos
      const tx = -innerWPt / 2;
      const ty = innerHPt / 2;
      const e = cx + cos * tx - sin * ty;
      const f = cy + sin * tx + cos * ty;
      stream.push('q');
      stream.push(`${a.toFixed(6)} ${b.toFixed(6)} ${c.toFixed(6)} ${d.toFixed(6)} ${e.toFixed(4)} ${f.toFixed(4)} cm`);
      stream.push(dielinePDF.ops);
      stream.push('Q');
    } else {
      stream.push(`${x.toFixed(4)} ${y.toFixed(4)} ${wPiecePt.toFixed(4)} ${hPiecePt.toFixed(4)} re S`);
    }
  });
  stream.push('Q');

  if (showNumbers) {
    stream.push('q 0.25 0.25 0.25 rg');
    pieces.forEach((p) => {
      const fs = Math.max(6, Math.min(p.w, p.h) * CM_TO_PT * 0.18);
      const cx = toPtX(p.x + p.w / 2);
      const cy = toPtY(p.y, p.h) + (p.h * CM_TO_PT) / 2 - fs * 0.35;
      const label = String(p.index);
      const approxW = label.length * fs * 0.5;
      stream.push('BT');
      stream.push(`/F1 ${fs.toFixed(2)} Tf`);
      stream.push(`${(cx - approxW / 2).toFixed(2)} ${cy.toFixed(2)} Td`);
      stream.push(`(${label}) Tj`);
      stream.push('ET');
    });
    stream.push('Q');
  }

  const content = stream.join('\n');

  const objects: string[] = [];
  objects.push(`1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj`);
  objects.push(`2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj`);
  objects.push(`3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt.toFixed(4)} ${hPt.toFixed(4)}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj`);
  objects.push(`4 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`);
  objects.push(`5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`);

  const header = `%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`;
  let body = '';
  const offsets: number[] = [];
  const enc = new TextEncoder();
  let cursor = enc.encode(header).length;
  objects.forEach((obj) => {
    offsets.push(cursor);
    const chunk = obj + '\n';
    body += chunk;
    cursor += enc.encode(chunk).length;
  });

  const xrefOffset = cursor;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    xref += `${off.toString().padStart(10, '0')} 00000 n \n`;
  });
  const trailer = `trailer << /Size ${objects.length + 1} /Root 1 0 R /Info << /Title (${title}) /Creator (Pricing Calculator) >> >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const full = header + body + xref + trailer;
  return enc.encode(full);
}

/* ───────────────── Trigger downloads ───────────────── */
export function downloadBlob(filename: string, mime: string, data: string | Uint8Array) {
  let blob: Blob;
  if (data instanceof Uint8Array) {
    const ab = new ArrayBuffer(data.byteLength);
    new Uint8Array(ab).set(data);
    blob = new Blob([ab], { type: mime });
  } else {
    blob = new Blob([data], { type: mime });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportLayout(format: ExportFormat, opts: ExportOptions, baseName = 'layout') {
  const safeName = baseName.replace(/[^\w\u0600-\u06FF\-_.]+/g, '_');
  switch (format) {
    case 'svg': {
      downloadBlob(`${safeName}.svg`, 'image/svg+xml;charset=utf-8', buildSVG(opts));
      break;
    }
    case 'eps': {
      downloadBlob(`${safeName}.eps`, 'application/postscript', buildEPS(opts));
      break;
    }
    case 'ai': {
      downloadBlob(`${safeName}.ai`, 'application/postscript', buildEPS(opts));
      break;
    }
    case 'pdf': {
      downloadBlob(`${safeName}.pdf`, 'application/pdf', buildPDF(opts));
      break;
    }
  }
}
