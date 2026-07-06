/**
 * PDF → SVG converter (vector-preserving)
 * ────────────────────────────────────────
 * Walks pdf.js operatorList for a single PDF page and emits an SVG that keeps
 * the original vector paths intact (no rasterisation). Designed specifically
 * for dieline workflows: cut/crease lines, strokes, fills, dashes, transforms.
 *
 * Output SVG is in PDF user space (1 unit = 1 pt) with a viewBox set to the
 * page mediaBox in points. The dieline importer converts pt → cm using the
 * existing PT_TO_CM logic, so sizes stay accurate.
 */

import * as pdfjsLib from 'pdfjs-dist';
// Use the bundled worker so we don't depend on an external CDN.
// Vite handles the ?url import to ship the worker file.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- Vite-specific URL import
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

import {
  type Mat,
  type BBox,
  IDENTITY,
  mulMat,
  matToSvg,
  D_MOVE,
  D_LINE,
  D_CURVE,
  D_QUAD,
  D_CLOSE,
  newBBox,
  drawOpsToPathD,
  cropContentToSvg,
} from './pdfToSvgInternals';

const OPS = (pdfjsLib as any).OPS as Record<string, number>;


type ColorSpace = 'gray' | 'rgb' | 'cmyk';

interface GState {
  ctm: Mat;
  strokeRGB: string;
  fillRGB: string;
  strokeAlpha: number;
  fillAlpha: number;
  lineWidth: number;
  lineCap: number;       // 0=butt, 1=round, 2=square
  lineJoin: number;      // 0=miter, 1=round, 2=bevel
  miterLimit: number;
  dash: number[] | null;
  dashPhase: number;
  strokeSpace: ColorSpace;
  fillSpace: ColorSpace;
}

const defaultState = (): GState => ({
  ctm: [...IDENTITY] as Mat,
  strokeRGB: '#000000',
  fillRGB: '#000000',
  strokeAlpha: 1,
  fillAlpha: 1,
  lineWidth: 1,
  lineCap: 0,
  lineJoin: 0,
  miterLimit: 10,
  dash: null,
  dashPhase: 0,
  strokeSpace: 'gray',
  fillSpace: 'gray',
});

const cloneState = (s: GState): GState => ({
  ...s,
  ctm: [...s.ctm] as Mat,
  dash: s.dash ? [...s.dash] : null,
});

const rgbHex = (r: number, g: number, b: number) => {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
};

const grayHex = (g: number) => {
  const v = Math.round(g * 255);
  return rgbHex(v, v, v);
};

const cmykHex = (c: number, m: number, y: number, k: number) =>
  rgbHex(255 * (1 - c) * (1 - k), 255 * (1 - m) * (1 - k), 255 * (1 - y) * (1 - k));

/** Best-effort generic color decoding for setStrokeColor / setFillColor */
const decodeColor = (args: number[], space: ColorSpace): string => {
  if (!args || !args.length) return '#000000';
  if (args.length === 1) return grayHex(args[0]);
  if (args.length === 3) return rgbHex(args[0] * 255, args[1] * 255, args[2] * 255);
  if (args.length === 4) return cmykHex(args[0], args[1], args[2], args[3]);
  // Fall back to the declared color space
  if (space === 'gray') return grayHex(args[0]);
  if (space === 'rgb') return rgbHex(args[0] * 255, args[1] * 255, args[2] * 255);
  return cmykHex(args[0] || 0, args[1] || 0, args[2] || 0, args[3] || 0);
};

const csNameToSpace = (name: any): ColorSpace | null => {
  if (typeof name !== 'string') return null;
  if (name === 'DeviceGray' || name === 'CalGray' || name === 'G') return 'gray';
  if (name === 'DeviceRGB' || name === 'CalRGB' || name === 'RGB') return 'rgb';
  if (name === 'DeviceCMYK' || name === 'CMYK') return 'cmyk';
  return null;
};

// (matrix math, draw-ops → path-d, viewBox cropping live in pdfToSvgInternals.ts)

const LINE_CAP = ['butt', 'round', 'square'];
const LINE_JOIN = ['miter', 'round', 'bevel'];

export interface PdfToSvgOptions {
  pageNumber?: number;
}

export interface PdfToSvgResult {
  svg: string;
  widthPt: number;
  heightPt: number;
  pageCount: number;
}

export const convertPdfToSvg = async (
  file: File | ArrayBuffer,
  options: PdfToSvgOptions = {},
): Promise<PdfToSvgResult> => {
  const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const loadingTask = (pdfjsLib as any).getDocument({ data, isEvalSupported: false });
  const pdf = await loadingTask.promise;
  const pageNum = Math.max(1, Math.min(pdf.numPages, options.pageNumber ?? 1));
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const opList = await page.getOperatorList();

  const fnArray: number[] = opList.fnArray;
  const argsArray: any[] = opList.argsArray;

  const stack: GState[] = [];
  let state = defaultState();

  // We collect path elements into `pathOut` first; the wrapping <svg> is built at
  // the end so we can tightly crop it around the actual artwork bounding box.
  // Otherwise the dieline rotates/translates around the full PAGE center, not
  // its own center — exactly the symptom the user reported with PDF imports.
  const pathOut: string[] = [];
  const contentBBox = newBBox();
  const vt = (viewport as any).transform as number[];
  const rootMat: Mat = vt && vt.length === 6
    ? [vt[0], vt[1], vt[2], vt[3], vt[4], vt[5]]
    : [1, 0, 0, -1, 0, viewport.height];

  let pendingPathD = '';

  const strokeAttrs = (): string[] => {
    const a: string[] = [];
    a.push(`stroke="${state.strokeRGB}"`);
    a.push(`stroke-width="${state.lineWidth || 0.5}"`);
    if (state.strokeAlpha < 1) a.push(`stroke-opacity="${state.strokeAlpha.toFixed(3)}"`);
    if (state.lineCap > 0) a.push(`stroke-linecap="${LINE_CAP[state.lineCap]}"`);
    if (state.lineJoin > 0) a.push(`stroke-linejoin="${LINE_JOIN[state.lineJoin]}"`);
    if (state.lineJoin === 0 && state.miterLimit && state.miterLimit !== 10) {
      a.push(`stroke-miterlimit="${state.miterLimit}"`);
    }
    if (state.dash && state.dash.length) {
      a.push(`stroke-dasharray="${state.dash.join(' ')}"`);
      if (state.dashPhase) a.push(`stroke-dashoffset="${state.dashPhase}"`);
    }
    a.push('vector-effect="non-scaling-stroke"');
    return a;
  };

  const emit = (kind: 'fill' | 'stroke' | 'fillstroke', evenOdd: boolean) => {
    if (!pendingPathD) return;
    const attrs: string[] = [`d="${pendingPathD}"`];
    if (kind === 'stroke') {
      attrs.push('fill="none"');
      attrs.push(...strokeAttrs());
    } else if (kind === 'fill') {
      attrs.push(`fill="${state.fillRGB}"`);
      if (state.fillAlpha < 1) attrs.push(`fill-opacity="${state.fillAlpha.toFixed(3)}"`);
      if (evenOdd) attrs.push('fill-rule="evenodd"');
      attrs.push('stroke="none"');
    } else {
      attrs.push(`fill="${state.fillRGB}"`);
      if (state.fillAlpha < 1) attrs.push(`fill-opacity="${state.fillAlpha.toFixed(3)}"`);
      if (evenOdd) attrs.push('fill-rule="evenodd"');
      attrs.push(...strokeAttrs());
    }
    pathOut.push(`<path ${attrs.join(' ')} />`);
  };

  const applyExtGState = (entries: any[]) => {
    if (!Array.isArray(entries)) return;
    for (const entry of entries) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const [key, value] = entry;
      switch (key) {
        case 'LW': state.lineWidth = value; break;
        case 'LC': state.lineCap = value; break;
        case 'LJ': state.lineJoin = value; break;
        case 'ML': state.miterLimit = value; break;
        case 'D': // [dashArray, dashPhase]
          if (Array.isArray(value) && Array.isArray(value[0])) {
            state.dash = value[0].length ? [...value[0]] : null;
            state.dashPhase = value[1] || 0;
          }
          break;
        case 'CA': state.strokeAlpha = Number(value) || 0; break;
        case 'ca': state.fillAlpha = Number(value) || 0; break;
        default: break;
      }
    }
  };

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i];

    switch (fn) {
      case OPS.save:
        stack.push(cloneState(state));
        break;
      case OPS.restore:
        if (stack.length) state = stack.pop()!;
        break;
      case OPS.transform: {
        const t = args as Mat;
        state.ctm = mulMat(state.ctm, [t[0], t[1], t[2], t[3], t[4], t[5]]);
        break;
      }
      case OPS.setLineWidth:
        state.lineWidth = args[0];
        break;
      case OPS.setLineCap:
        state.lineCap = args[0];
        break;
      case OPS.setLineJoin:
        state.lineJoin = args[0];
        break;
      case OPS.setMiterLimit:
        state.miterLimit = args[0];
        break;
      case OPS.setDash:
        // pdf.js: args = [dashArray, dashPhase]
        state.dash = Array.isArray(args[0]) && args[0].length ? [...args[0]] : null;
        state.dashPhase = Number(args[1]) || 0;
        break;
      case OPS.setGState:
        // args = [[[key,value], ...]]
        applyExtGState(args[0]);
        break;
      case OPS.setStrokeTransparent:
        state.strokeAlpha = 0;
        break;
      case OPS.setFillTransparent:
        state.fillAlpha = 0;
        break;
      case OPS.setStrokeColorSpace: {
        const sp = csNameToSpace(args?.[0]?.name ?? args?.[0]);
        if (sp) state.strokeSpace = sp;
        break;
      }
      case OPS.setFillColorSpace: {
        const sp = csNameToSpace(args?.[0]?.name ?? args?.[0]);
        if (sp) state.fillSpace = sp;
        break;
      }
      case OPS.setStrokeColor:
      case OPS.setStrokeColorN:
        state.strokeRGB = decodeColor(args as number[], state.strokeSpace);
        break;
      case OPS.setFillColor:
      case OPS.setFillColorN:
        state.fillRGB = decodeColor(args as number[], state.fillSpace);
        break;
      case OPS.setStrokeRGBColor: {
        const v = args[0];
        state.strokeRGB = rgbHex(v[0], v[1], v[2]);
        state.strokeSpace = 'rgb';
        break;
      }
      case OPS.setFillRGBColor: {
        const v = args[0];
        state.fillRGB = rgbHex(v[0], v[1], v[2]);
        state.fillSpace = 'rgb';
        break;
      }
      case OPS.setStrokeGray:
        state.strokeRGB = grayHex(args[0]);
        state.strokeSpace = 'gray';
        break;
      case OPS.setFillGray:
        state.fillRGB = grayHex(args[0]);
        state.fillSpace = 'gray';
        break;
      case OPS.setStrokeCMYKColor:
        state.strokeRGB = cmykHex(args[0], args[1], args[2], args[3]);
        state.strokeSpace = 'cmyk';
        break;
      case OPS.setFillCMYKColor:
        state.fillRGB = cmykHex(args[0], args[1], args[2], args[3]);
        state.fillSpace = 'cmyk';
        break;
      case OPS.constructPath: {
        const innerOp = args?.[0];
        const data = args?.[1]?.[0];
        pendingPathD = drawOpsToPathD(data, mulMat(rootMat, state.ctm), contentBBox);
        let consumed = true;
        switch (innerOp) {
          case OPS.stroke:
          case OPS.closeStroke:
            emit('stroke', false); break;
          case OPS.fill:
          case OPS.rawFillPath:
            emit('fill', false); break;
          case OPS.eoFill:
            emit('fill', true); break;
          case OPS.fillStroke:
          case OPS.closeFillStroke:
            emit('fillstroke', false); break;
          case OPS.eoFillStroke:
          case OPS.closeEOFillStroke:
            emit('fillstroke', true); break;
          default:
            // Path built but not yet painted; keep d for follow-up paint op
            consumed = false; break;
        }
        if (consumed) pendingPathD = '';
        break;
      }
      case OPS.stroke:
      case OPS.closeStroke:
        emit('stroke', false); pendingPathD = ''; break;
      case OPS.fill:
      case OPS.rawFillPath:
        emit('fill', false); pendingPathD = ''; break;
      case OPS.eoFill:
        emit('fill', true); pendingPathD = ''; break;
      case OPS.fillStroke:
      case OPS.closeFillStroke:
        emit('fillstroke', false); pendingPathD = ''; break;
      case OPS.eoFillStroke:
      case OPS.closeEOFillStroke:
        emit('fillstroke', true); pendingPathD = ''; break;
      case OPS.endPath:
      case OPS.clip:
      case OPS.eoClip:
        // Clipping paths consume the current path without painting it.
        pendingPathD = '';
        break;
      default:
        break;
    }
  }

  const { svg, widthPt, heightPt } = cropContentToSvg(
    viewport.width,
    viewport.height,
    contentBBox,
    pathOut,
  );

  return {
    svg,
    widthPt,
    heightPt,
    pageCount: pdf.numPages,
  };
};

/** Convenience: convert PDF File → SVG File (same base name). */
export const pdfFileToSvgFile = async (
  file: File,
  options: PdfToSvgOptions = {},
): Promise<{ file: File; pageCount: number; widthPt: number; heightPt: number }> => {
  const { svg, widthPt, heightPt, pageCount } = await convertPdfToSvg(file, options);
  const baseName = file.name.replace(/\.pdf$/i, '');
  const outName = pageCount > 1
    ? `${baseName}-page${options.pageNumber ?? 1}.svg`
    : `${baseName}.svg`;
  const svgFile = new File([svg], outName, { type: 'image/svg+xml' });
  return { file: svgFile, pageCount, widthPt, heightPt };
};
