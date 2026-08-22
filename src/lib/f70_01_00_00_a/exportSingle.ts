// F70_01_00_00_A — Export Single Template Utilities

import type { F70_01_00_00_AGeometry } from './types';

export function buildF70_01_00_00_ASingleTemplateSvg(geo: F70_01_00_00_AGeometry): string {
  return geo.svg;
}

export function downloadF70_01_00_00_ASingleTemplate(
  geo: F70_01_00_00_AGeometry,
  filename = 'F70_01_00_00_A-single-template.svg'
) {
  const svg = buildF70_01_00_00_ASingleTemplateSvg(geo);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function downloadF70_01_00_00_ASingleTemplatePdf(
  svgMarkup: string,
  filename = 'F70_01_00_00_A-single-template.pdf'
) {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-100000px';
  host.style.top = '0';
  host.style.visibility = 'hidden';
  host.innerHTML = svgMarkup;
  const svgEl = host.querySelector('svg') as SVGSVGElement | null;
  if (!svgEl) throw new Error('F70_01_00_00_A PDF export: failed to parse SVG.');
  document.body.appendChild(host);

  const vb = (svgEl.getAttribute('viewBox') || '0 0 0 0').split(/\s+/).map(Number);
  const pageW = vb[2] || 1;
  const pageH = vb[3] || 1;

  try {
    const [{ jsPDF }, { svg2pdf }] = await Promise.all([
      import('jspdf'),
      import('svg2pdf.js'),
    ]);
    const pdf = new jsPDF({
      unit: 'mm',
      format: [pageW, pageH],
      orientation: pageW >= pageH ? 'landscape' : 'portrait',
      compress: true,
    });
    await svg2pdf(svgEl, pdf, { x: 0, y: 0, width: pageW, height: pageH });
    pdf.save(filename);
  } finally {
    document.body.removeChild(host);
  }
}
