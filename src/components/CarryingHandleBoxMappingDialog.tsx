/**
 * Carrying Handle Box — Phase 1 SVG Mapping Analyzer
 * ---------------------------------------------------
 * Read-only diagnostic: ingests a tagged dieline SVG, identifies layers
 * (CUT / CREASE / HOLES), reads element ids and geometry, and reports
 * everything in a structured table + summary. NO resize, NO transform,
 * NO geometry mutation — Phase 1 only.
 */
import { useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { FileSearch, Upload, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

type Role = 'CUT' | 'CREASE' | 'HOLES' | 'UNKNOWN';

interface MappedElement {
  id: string;
  parentLayer: string;
  role: Role;
  tag: string;
  bbox: { x: number; y: number; w: number; h: number } | null;
  pathLength: number | null;
  hasTransform: boolean;
  status: 'ok' | 'warn';
  warning?: string;
}

interface SvgSummary {
  ok: boolean;
  width: string;
  height: string;
  viewBox: string;
  unit: string;
  bboxW: number;
  bboxH: number;
  counts: { CUT: number; CREASE: number; HOLES: number; UNKNOWN: number };
  hasTransforms: boolean;
  unsupported: string[];
  ready: boolean;
  raw: string;
}

const KNOWN_CUT = [
  'CUT_GLUE_FLAP_OUTER',
  'CUT_TOP_COVER_FRONT_1', 'CUT_BOTTOM_FRONT_FLAP_1', 'CUT_UPPER_DEPTH_FLAP_1', 'CUT_LOWER_DEPTH_FLAP_1',
  'CUT_TOP_COVER_FRONT_2', 'CUT_BOTTOM_FRONT_FLAP_2', 'CUT_UPPER_DEPTH_FLAP_2', 'CUT_LOWER_DEPTH_FLAP_2',
  'CUT_RIGHT_DEPTH_2_OUTER_EDGE',
];
const KNOWN_CREASE = [
  'CREASE_X_GLUE_TO_FRONT_1',
  'CREASE_Y_TOP_TO_BODY_FRONT_1', 'CREASE_Y_BODY_TO_BOTTOM_FRONT_1', 'CREASE_TOP_COVER_FRONT_1_MID_FOLD',
  'CREASE_X_FRONT_1_TO_DEPTH_1',
  'CREASE_Y_TOP_TO_BODY_DEPTH_1', 'CREASE_Y_BODY_TO_BOTTOM_DEPTH_1',
  'CREASE_X_DEPTH_1_TO_FRONT_2',
  'CREASE_Y_TOP_TO_BODY_FRONT_2', 'CREASE_Y_BODY_TO_BOTTOM_FRONT_2', 'CREASE_TOP_COVER_FRONT_2_MID_FOLD',
  'CREASE_X_FRONT_2_TO_DEPTH_2',
  'CREASE_Y_TOP_TO_BODY_DEPTH_2', 'CREASE_Y_BODY_TO_BOTTOM_DEPTH_2',
];
const KNOWN_HOLES = [
  'HOLE_HANDLE_FRONT_1', 'HOLE_HANDLE_FRONT_2', 'HOLE_LOCK_SLOT_1', 'HOLE_LOCK_SLOT_2',
];

const SUPPORTED_TAGS = new Set(['path', 'line', 'polyline', 'polygon', 'rect', 'circle', 'ellipse']);

const detectUnit = (w: string | null): string => {
  if (!w) return 'unknown';
  const m = w.trim().match(/(mm|cm|in|pt|px)$/i);
  return m ? m[1].toLowerCase() : 'user-units';
};

const analyzeSvg = (raw: string): {
  summary: SvgSummary;
  elements: MappedElement[];
  missing: { CUT: string[]; CREASE: string[]; HOLES: string[] };
} => {
  const doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('ملف SVG غير صالح');
  const svg = doc.documentElement as unknown as SVGSVGElement;

  const width = svg.getAttribute('width') || '';
  const height = svg.getAttribute('height') || '';
  const viewBox = svg.getAttribute('viewBox') || '';
  const unit = detectUnit(width);

  // Mount offscreen for getBBox/getTotalLength
  const host = document.createElement('div');
  host.style.position = 'absolute';
  host.style.left = '-99999px';
  host.style.width = '0';
  host.style.height = '0';
  host.style.overflow = 'hidden';
  host.innerHTML = raw;
  document.body.appendChild(host);
  const liveSvg = host.querySelector('svg') as SVGSVGElement;

  let bboxW = 0, bboxH = 0;
  try {
    const b = liveSvg.getBBox();
    bboxW = b.width; bboxH = b.height;
  } catch { /* noop */ }

  const elements: MappedElement[] = [];
  const counts = { CUT: 0, CREASE: 0, HOLES: 0, UNKNOWN: 0 };
  const unsupported: string[] = [];
  let hasTransforms = false;

  const layers = Array.from(liveSvg.querySelectorAll(':scope > g'));
  const seen = new Set<string>();

  const classifyByParent = (gid: string): Role => {
    const u = gid.toUpperCase();
    if (u === 'CUT') return 'CUT';
    if (u === 'CREASE') return 'CREASE';
    if (u === 'HOLES' || u === 'HOLE') return 'HOLES';
    return 'UNKNOWN';
  };
  const classifyById = (id: string): Role => {
    const u = id.toUpperCase();
    if (u.startsWith('CUT')) return 'CUT';
    if (u.startsWith('CREASE')) return 'CREASE';
    if (u.startsWith('HOLE')) return 'HOLES';
    return 'UNKNOWN';
  };

  const visit = (el: Element, parentLayer: string, parentRole: Role) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'g') {
      const gid = el.getAttribute('id') || parentLayer;
      const role = parentRole !== 'UNKNOWN' ? parentRole : classifyByParent(gid);
      Array.from(el.children).forEach(c => visit(c, gid, role));
      return;
    }
    if (!SUPPORTED_TAGS.has(tag)) {
      if (tag !== 'defs' && tag !== 'title' && tag !== 'desc' && tag !== 'metadata') {
        unsupported.push(`<${tag}>${el.id ? ` id=${el.id}` : ''}`);
      }
      return;
    }
    const id = el.getAttribute('id') || '(no-id)';
    const idRole = classifyById(id);
    const role: Role = idRole !== 'UNKNOWN' ? idRole : parentRole;
    let bbox: MappedElement['bbox'] = null;
    try {
      const b = (el as SVGGraphicsElement).getBBox();
      bbox = { x: b.x, y: b.y, w: b.width, h: b.height };
    } catch { /* ignore */ }
    let pathLength: number | null = null;
    if (tag === 'path' || tag === 'line' || tag === 'polyline' || tag === 'polygon') {
      try { pathLength = (el as SVGPathElement).getTotalLength(); } catch { pathLength = null; }
    }
    const transformAttr = el.getAttribute('transform');
    const hasTransform = !!(transformAttr && transformAttr.trim() && transformAttr.trim() !== 'none');
    if (hasTransform) hasTransforms = true;

    let status: 'ok' | 'warn' = 'ok';
    let warning: string | undefined;
    if (id === '(no-id)') { status = 'warn'; warning = 'بدون id'; }
    else if (idRole !== 'UNKNOWN' && parentRole !== 'UNKNOWN' && idRole !== parentRole) {
      status = 'warn'; warning = `id يقول ${idRole} لكن الطبقة ${parentRole}`;
    } else if (role === 'UNKNOWN') {
      status = 'warn'; warning = 'تعذر تصنيف الدور';
    }
    if (seen.has(id) && id !== '(no-id)') {
      status = 'warn'; warning = (warning ? warning + ' · ' : '') + 'id مكرر';
    }
    seen.add(id);
    counts[role] += 1;
    elements.push({
      id, parentLayer, role, tag, bbox, pathLength, hasTransform, status, warning,
    });
  };

  if (layers.length === 0) {
    Array.from(liveSvg.children).forEach(c => visit(c, '(root)', 'UNKNOWN'));
  } else {
    layers.forEach(g => visit(g, g.getAttribute('id') || '(g)', classifyByParent(g.getAttribute('id') || '')));
  }

  document.body.removeChild(host);

  const ids = new Set(elements.map(e => e.id));
  const missing = {
    CUT: KNOWN_CUT.filter(n => !ids.has(n)),
    CREASE: KNOWN_CREASE.filter(n => !ids.has(n)),
    HOLES: KNOWN_HOLES.filter(n => !ids.has(n)),
  };

  const ready =
    counts.CUT > 0 && counts.CREASE > 0 && counts.HOLES > 0 &&
    missing.CUT.length === 0 && missing.CREASE.length === 0 && missing.HOLES.length === 0 &&
    !hasTransforms && unsupported.length === 0;

  return {
    summary: {
      ok: true, width, height, viewBox, unit, bboxW, bboxH,
      counts, hasTransforms, unsupported, ready, raw,
    },
    elements, missing,
  };
};

const roleColor: Record<Role, string> = {
  CUT: 'bg-red-500/15 text-red-600 border-red-500/30',
  CREASE: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  HOLES: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  UNKNOWN: 'bg-muted text-muted-foreground border-border',
};

const fmt = (n: number | null, d = 2) => (n == null ? '—' : n.toFixed(d));

const CarryingHandleBoxMappingDialog = () => {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SvgSummary | null>(null);
  const [elements, setElements] = useState<MappedElement[]>([]);
  const [missing, setMissing] = useState<{ CUT: string[]; CREASE: string[]; HOLES: string[] } | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setError(null); setSummary(null); setElements([]); setMissing(null); setFileName('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const onFile = async (f: File) => {
    reset();
    try {
      const raw = await f.text();
      const res = analyzeSvg(raw);
      setSummary(res.summary);
      setElements(res.elements);
      setMissing(res.missing);
      setFileName(f.name);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحليل الملف');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setTimeout(reset, 200); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <FileSearch className="w-3.5 h-3.5" />
          تحليل قالب SVG
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="w-4 h-4 text-primary" />
            المرحلة 1 — قراءة وتحليل قالب SVG (Mapping Report)
          </DialogTitle>
          <DialogDescription>
            تشخيص فقط: قراءة الطبقات CUT / CREASE / HOLES والعناصر بأسمائها. بدون أي تعديل على الأبعاد أو الرسم.
          </DialogDescription>
        </DialogHeader>

        {!summary && !error && (
          <div
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer rounded-lg border-2 border-dashed border-border bg-muted/20 hover:bg-muted/40 p-8 text-center"
          >
            <Upload className="w-10 h-10 mx-auto text-primary mb-3" />
            <p className="text-sm font-semibold">اضغط لرفع ملف SVG معلَّم</p>
            <p className="text-xs text-muted-foreground mt-1">
              الطبقات المتوقعة: <code>CUT</code> · <code>CREASE</code> · <code>HOLES</code>
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".svg,image/svg+xml"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
            />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-destructive">تعذر القراءة</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={reset}>
                <RefreshCw className="w-3.5 h-3.5 ml-1" /> إعادة المحاولة
              </Button>
            </div>
          </div>
        )}

        {summary && missing && (
          <div className="space-y-4">
            {/* Preview — raw SVG as-is */}
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs font-semibold mb-2 text-muted-foreground">
                Preview حقيقي للقالب — يُعرض ملف SVG كما هو (بدون أي إعادة رسم)
              </p>
              <div className="w-full flex items-center justify-center bg-muted/10 rounded p-2 overflow-auto"
                style={{ maxHeight: 360 }}>
                <div
                  className="max-w-full"
                  dangerouslySetInnerHTML={{ __html: summary.raw }}
                />
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {summary.ready ? (
                    <><CheckCircle2 className="w-4 h-4 text-emerald-600" /> الملف جاهز للمرحلة الثانية</>
                  ) : (
                    <><AlertCircle className="w-4 h-4 text-amber-600" /> الملف مقروء — راجع التحذيرات قبل المتابعة</>
                  )}
                </div>
                <span className="text-xs text-muted-foreground truncate">{fileName}</span>
                <Button size="sm" variant="ghost" onClick={reset}>
                  <RefreshCw className="w-3.5 h-3.5 ml-1" /> ملف آخر
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                <Cell k="width" v={summary.width || '—'} />
                <Cell k="height" v={summary.height || '—'} />
                <Cell k="unit" v={summary.unit} />
                <Cell k="viewBox" v={summary.viewBox || '—'} mono />
                <Cell k="bbox W" v={fmt(summary.bboxW)} />
                <Cell k="bbox H" v={fmt(summary.bboxH)} />
                <Cell k="CUT" v={String(summary.counts.CUT)} />
                <Cell k="CREASE" v={String(summary.counts.CREASE)} />
                <Cell k="HOLES" v={String(summary.counts.HOLES)} />
                <Cell k="UNKNOWN" v={String(summary.counts.UNKNOWN)} />
                <Cell k="transforms" v={summary.hasTransforms ? 'نعم ⚠' : 'لا'} />
                <Cell k="unsupported" v={summary.unsupported.length ? `${summary.unsupported.length} ⚠` : 'لا'} />
              </div>
              {summary.unsupported.length > 0 && (
                <p className="text-[11px] text-amber-600">
                  عناصر غير مدعومة: {summary.unsupported.join(', ')}
                </p>
              )}
            </div>

            {/* Missing names */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <MissingBox title="CUT — أسماء مفقودة" items={missing.CUT} />
              <MissingBox title="CREASE — أسماء مفقودة" items={missing.CREASE} />
              <MissingBox title="HOLES — أسماء مفقودة" items={missing.HOLES} />
            </div>

            {/* Elements table */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="max-h-[380px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted z-10">
                    <TableRow>
                      <TableHead className="text-[10px]">element id</TableHead>
                      <TableHead className="text-[10px]">parent layer</TableHead>
                      <TableHead className="text-[10px]">role</TableHead>
                      <TableHead className="text-[10px]">tag</TableHead>
                      <TableHead className="text-[10px]">bbox (x, y, w, h)</TableHead>
                      <TableHead className="text-[10px]">path length</TableHead>
                      <TableHead className="text-[10px]">transform?</TableHead>
                      <TableHead className="text-[10px]">status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {elements.map((e, i) => (
                      <TableRow key={`${e.id}-${i}`}>
                        <TableCell className="font-mono text-[11px] py-1.5">{e.id}</TableCell>
                        <TableCell className="text-[11px] py-1.5">{e.parentLayer}</TableCell>
                        <TableCell className="py-1.5">
                          <Badge variant="outline" className={`text-[10px] ${roleColor[e.role]}`}>{e.role}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-[11px] py-1.5">{e.tag}</TableCell>
                        <TableCell className="font-mono text-[10px] py-1.5 tabular-nums">
                          {e.bbox ? `${fmt(e.bbox.x, 1)}, ${fmt(e.bbox.y, 1)}, ${fmt(e.bbox.w, 1)}, ${fmt(e.bbox.h, 1)}` : '—'}
                        </TableCell>
                        <TableCell className="font-mono text-[10px] py-1.5 tabular-nums">{fmt(e.pathLength, 1)}</TableCell>
                        <TableCell className="text-[11px] py-1.5">{e.hasTransform ? 'نعم' : 'لا'}</TableCell>
                        <TableCell className="py-1.5">
                          {e.status === 'ok'
                            ? <span className="text-emerald-600 text-[11px]">OK</span>
                            : <span className="text-amber-600 text-[11px]" title={e.warning}>⚠ {e.warning}</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              المرحلة 1 فقط — لا يتم تطبيق أي Resize أو Transform. عند الموافقة على هذا التقرير، انتقل للمرحلة 2 لتطبيق الأبعاد.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const Cell = ({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) => (
  <div className="rounded border border-border/60 bg-background px-2 py-1">
    <p className="text-[9px] text-muted-foreground uppercase">{k}</p>
    <p className={`text-[11px] font-semibold ${mono ? 'font-mono' : ''} truncate`} title={v}>{v}</p>
  </div>
);

const MissingBox = ({ title, items }: { title: string; items: string[] }) => (
  <div className={`rounded border p-2 ${items.length ? 'border-amber-500/40 bg-amber-500/5' : 'border-emerald-500/40 bg-emerald-500/5'}`}>
    <p className="font-semibold mb-1">{title}</p>
    {items.length === 0
      ? <p className="text-emerald-600">كل الأسماء موجودة ✓</p>
      : <ul className="list-disc pr-4 space-y-0.5">{items.map(i => <li key={i} className="font-mono text-[10px]">{i}</li>)}</ul>}
  </div>
);

export default CarryingHandleBoxMappingDialog;
