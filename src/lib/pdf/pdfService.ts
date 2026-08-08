/**
 * Shared PDF pipeline for Printera.
 *
 * Preview → inline blob stream (in-app dialog; iOS Safari → new tab).
 * Download → real .pdf file.
 * No window.print() / browser print dialog anywhere.
 */
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';

export type PdfSource = jsPDF | Blob | ArrayBuffer | Uint8Array;

export interface GenerateFromElementOptions {
  /** Page margins in mm (default 10). */
  marginMm?: number;
  /** Host width in CSS px used for layout (default ~A4 @ 96dpi). */
  windowWidth?: number;
}

export interface GenerateFromSvgOptions {
  widthMm?: number;
  heightMm?: number;
}

type PreviewState = { url: string; filename: string } | null;
type PreviewListener = (state: PreviewState) => void;

const previewListeners = new Set<PreviewListener>();
let previewState: PreviewState = null;

const LIGHT_PRINT_CSS = `
.pdf-light-root {
  color-scheme: light !important;
  background: #ffffff !important;
  color: #0f172a !important;
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
  --card: 0 0% 100%;
  --card-foreground: 222 47% 11%;
  --popover: 0 0% 100%;
  --popover-foreground: 222 47% 11%;
  --primary: 221 83% 53%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96%;
  --secondary-foreground: 222 47% 11%;
  --muted: 210 40% 96%;
  --muted-foreground: 215 16% 47%;
  --accent: 161 60% 45%;
  --accent-foreground: 0 0% 100%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;
  --border: 214 20% 90%;
  --input: 214 20% 88%;
  --ring: 221 83% 53%;
  --success: 161 60% 45%;
  --success-foreground: 0 0% 100%;
  --warning: 38 92% 50%;
  --warning-foreground: 0 0% 100%;
  --info: 221 83% 53%;
  --info-foreground: 0 0% 100%;
}
.pdf-light-root .dark { color-scheme: light !important; }
.pdf-light-root .print\\:hidden,
.pdf-light-root [data-pdf-hide] {
  display: none !important;
}
`;

function isJsPdf(source: PdfSource): source is jsPDF {
  return (
    typeof source === 'object' &&
    source !== null &&
    !(source instanceof Blob) &&
    !(source instanceof ArrayBuffer) &&
    !(source instanceof Uint8Array) &&
    typeof (source as jsPDF).output === 'function'
  );
}

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iP(ad|hone|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/i.test(ua);
  const criOS = /CriOS/i.test(ua);
  const fxIOS = /FxiOS/i.test(ua);
  return iOS && webkit && !criOS && !fxIOS;
}

export function toPdfBlob(source: PdfSource): Blob {
  if (source instanceof Blob) {
    return source.type === 'application/pdf'
      ? source
      : new Blob([source], { type: 'application/pdf' });
  }
  if (source instanceof ArrayBuffer) {
    return new Blob([source], { type: 'application/pdf' });
  }
  if (source instanceof Uint8Array) {
    const ab = new ArrayBuffer(source.byteLength);
    new Uint8Array(ab).set(source);
    return new Blob([ab], { type: 'application/pdf' });
  }
  return source.output('blob');
}

function ensurePdfFilename(filename: string): string {
  const base = (filename || 'document').trim() || 'document';
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

/** Arabic-friendly quote/export filenames. */
export function buildQuotePdfFilename(parts: {
  quoteNumber?: string;
  customerName?: string;
  prefix?: string;
}): string {
  const date = new Date().toISOString().slice(0, 10);
  const raw =
    parts.quoteNumber?.trim() ||
    parts.customerName?.trim() ||
    'عرض';
  const safe = raw.replace(/[^\w\u0600-\u06FF\-_.]+/g, '_').slice(0, 60);
  const prefix = parts.prefix ?? 'عرض-سعر';
  return `${prefix}-${safe}-${date}.pdf`;
}

export function subscribePdfPreview(listener: PreviewListener): () => void {
  previewListeners.add(listener);
  listener(previewState);
  return () => {
    previewListeners.delete(listener);
  };
}

export function closePdfPreview(): void {
  if (previewState?.url) {
    URL.revokeObjectURL(previewState.url);
  }
  previewState = null;
  previewListeners.forEach((l) => l(null));
}

function openPreviewState(url: string, filename: string): void {
  if (previewState?.url) {
    URL.revokeObjectURL(previewState.url);
  }
  previewState = { url, filename };
  previewListeners.forEach((l) => l(previewState));
}

function mountLightClone(source: HTMLElement, windowWidth: number): { host: HTMLElement; clone: HTMLElement } {
  const host = document.createElement('div');
  host.setAttribute('data-pdf-clone-host', '1');
  host.style.cssText = [
    'position:fixed',
    'left:-100000px',
    'top:0',
    `width:${windowWidth}px`,
    'background:#ffffff',
    'color:#0f172a',
    'color-scheme:light',
    'pointer-events:none',
    'z-index:-1',
  ].join(';');

  const style = document.createElement('style');
  style.textContent = LIGHT_PRINT_CSS;
  host.appendChild(style);

  const clone = source.cloneNode(true) as HTMLElement;
  clone.classList.add('pdf-light-root');
  clone.classList.remove('dark');
  clone.querySelectorAll('.dark').forEach((n) => n.classList.remove('dark'));
  clone.style.background = '#ffffff';
  clone.style.color = '#0f172a';
  clone.style.width = '100%';
  clone.style.maxWidth = '100%';
  clone.style.boxSizing = 'border-box';
  clone.removeAttribute('hidden');

  host.appendChild(clone);
  document.body.appendChild(host);
  return { host, clone };
}

/**
 * DOM → A4 multi-page PDF via jsPDF.html + html2canvas.
 * Clones the node and forces light styling so dark mode never leaks.
 */
export async function generatePdfFromElement(
  el: HTMLElement,
  opts: GenerateFromElementOptions = {},
): Promise<jsPDF> {
  if (!el) throw new Error('generatePdfFromElement: element is required');

  await document.fonts.ready.catch(() => undefined);

  const margin = opts.marginMm ?? 10;
  const windowWidth = opts.windowWidth ?? 794;
  const { host, clone } = mountLightClone(el, windowWidth);

  try {
    const pdf = new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
      compress: true,
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const contentWidth = Math.max(pageWidth - margin * 2, 10);

    await pdf.html(clone, {
      x: margin,
      y: margin,
      width: contentWidth,
      windowWidth: clone.scrollWidth || windowWidth,
      autoPaging: 'text',
      margin: [margin, margin, margin, margin],
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (doc) => {
          doc.documentElement.classList.remove('dark');
          doc.body?.classList.remove('dark');
          const root = doc.querySelector('.pdf-light-root') as HTMLElement | null;
          if (root) {
            root.style.background = '#ffffff';
            root.style.color = '#0f172a';
          }
        },
      },
    });

    return pdf;
  } finally {
    host.remove();
  }
}

/**
 * Full HTML document string → PDF (for Template/Magazine report builders).
 * Uses the document body (or a wrapper) as the source element.
 */
export async function generatePdfFromHtml(
  html: string,
  opts: GenerateFromElementOptions = {},
): Promise<jsPDF> {
  await document.fonts.ready.catch(() => undefined);

  const host = document.createElement('div');
  host.setAttribute('data-pdf-html-host', '1');
  host.style.cssText =
    'position:fixed;left:-100000px;top:0;width:794px;background:#fff;color:#0f172a;color-scheme:light;z-index:-1;';

  const lightStyle = document.createElement('style');
  lightStyle.textContent = LIGHT_PRINT_CSS;
  host.appendChild(lightStyle);

  // Preserve <style> blocks from the source HTML head.
  const styleMatches = html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi);
  for (const match of styleMatches) {
    const s = document.createElement('style');
    s.textContent = match[1];
    host.appendChild(s);
  }

  const wrap = document.createElement('div');
  wrap.className = 'pdf-light-root';
  wrap.setAttribute('dir', 'rtl');
  wrap.style.width = '100%';
  wrap.style.boxSizing = 'border-box';

  // Prefer body content when a full document is provided.
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  wrap.innerHTML = bodyMatch ? bodyMatch[1] : html;
  // Strip auto-print scripts if present.
  wrap.querySelectorAll('script').forEach((s) => s.remove());

  host.appendChild(wrap);
  document.body.appendChild(host);

  try {
    // Render the mounted wrap directly (styles live on `host`).
    const margin = opts.marginMm ?? 10;
    const windowWidth = opts.windowWidth ?? 794;
    const pdf = new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
      compress: true,
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const contentWidth = Math.max(pageWidth - margin * 2, 10);

    await pdf.html(wrap, {
      x: margin,
      y: margin,
      width: contentWidth,
      windowWidth: wrap.scrollWidth || windowWidth,
      autoPaging: 'text',
      margin: [margin, margin, margin, margin],
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      },
    });
    return pdf;
  } finally {
    host.remove();
  }
}

/** Thin svg2pdf wrapper for vector die-cut / box / sheet exports. */
export async function generatePdfFromSvg(
  svg: SVGSVGElement | string,
  opts: GenerateFromSvgOptions = {},
): Promise<jsPDF> {
  let host: HTMLElement | null = null;
  let svgEl: SVGSVGElement;

  if (typeof svg === 'string') {
    host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;';
    host.innerHTML = svg;
    const found = host.querySelector('svg');
    if (!found) throw new Error('generatePdfFromSvg: failed to parse SVG markup');
    svgEl = found;
    document.body.appendChild(host);
  } else {
    svgEl = svg;
  }

  try {
    const vb = (svgEl.getAttribute('viewBox') || '0 0 210 297')
      .split(/[\s,]+/)
      .map(Number);
    const pageW = opts.widthMm ?? (Number.isFinite(vb[2]) && vb[2] > 0 ? vb[2] : 210);
    const pageH = opts.heightMm ?? (Number.isFinite(vb[3]) && vb[3] > 0 ? vb[3] : 297);

    const pdf = new jsPDF({
      unit: 'mm',
      format: [pageW, pageH],
      orientation: pageW >= pageH ? 'landscape' : 'portrait',
      compress: true,
    });
    await svg2pdf(svgEl, pdf, { x: 0, y: 0, width: pageW, height: pageH });
    return pdf;
  } finally {
    host?.remove();
  }
}

/**
 * Preview = PDF stream (blob URL) in the in-app viewer.
 * iOS Safari falls back to opening the blob in a new tab.
 */
export async function previewPdf(source: PdfSource, filename = 'document.pdf'): Promise<void> {
  const safe = ensurePdfFilename(filename);
  const blob = toPdfBlob(source);
  const url = URL.createObjectURL(blob);

  if (isIosSafari()) {
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      // Popup blocked — still expose via download as last resort UX.
      downloadPdf(blob, safe);
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  openPreviewState(url, safe);
}

/** Download a real .pdf file. */
export function downloadPdf(source: PdfSource, filename = 'document.pdf'): void {
  const safe = ensurePdfFilename(filename);
  if (isJsPdf(source)) {
    source.save(safe);
    return;
  }
  const blob = toPdfBlob(source);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safe;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
