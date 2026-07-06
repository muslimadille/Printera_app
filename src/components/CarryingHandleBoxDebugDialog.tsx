import { useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bug, CheckCircle2, AlertTriangle } from 'lucide-react';
import { carryDebugReport, type CarryHandleInputs } from '@/lib/carryingHandleBoxEngine';

interface Props { inputs: CarryHandleInputs; }

/**
 * Phase-2 Debug Report
 * Shows live mapping between the Tagged-SVG crease names (CREASE_X_*, CREASE_Y_*)
 * and the engine's cumulative boundaries — driven entirely by the existing
 * Length / Depth / Height fields. No inputs added, no geometry mutated.
 */
const CarryingHandleBoxDebugDialog = ({ inputs }: Props) => {
  const [open, setOpen] = useState(false);
  const report = useMemo(() => carryDebugReport(inputs), [inputs]);

  const Pass = ({ ok }: { ok: boolean }) =>
    ok ? (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] gap-1">
        <CheckCircle2 className="w-3 h-3" /> PASS
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px] gap-1">
        <AlertTriangle className="w-3 h-3" /> FAIL
      </Badge>
    );

  const fmt = (n: number) => Number(n.toFixed(3)).toString();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Bug className="w-3.5 h-3.5" />
          Debug Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="w-4 h-4 text-primary" />
            Carrying Handle Box — Debug Report
          </DialogTitle>
          <DialogDescription>
            ربط Tagged-SVG Mapping بحدود المحرك الحالية باستخدام نفس خانات
            Length / Depth / Height. لا توجد حقول جديدة، ولا Scale عام.
          </DialogDescription>
        </DialogHeader>

        {/* Inputs */}
        <section className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold">المدخلات الحالية</h4>
            <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/30">
              Tagged Mapping: {report.usedTaggedMapping ? 'نعم' : 'لا'}
            </Badge>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <Stat label="Length" v={`${report.inputs.length} mm`} />
            <Stat label="Depth" v={`${report.inputs.depth} mm`} />
            <Stat label="Height" v={`${report.inputs.height} mm`} />
            <Stat label="GlueFlap" v={`${report.inputs.glueFlap} mm`} />
          </div>
        </section>

        {/* Footprint */}
        <section className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          <h4 className="text-xs font-bold">Footprint</h4>
          <table className="w-full text-xs">
            <thead className="text-[10px] text-muted-foreground">
              <tr><th className="text-start">المحور</th><th className="text-start">Expected</th><th className="text-start">Actual</th><th></th></tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              <tr><td>Width</td><td>{fmt(report.footprint.expectedW)}</td><td>{fmt(report.footprint.actualW)}</td><td><Pass ok={report.footprint.passW} /></td></tr>
              <tr><td>Height</td><td>{fmt(report.footprint.expectedH)}</td><td>{fmt(report.footprint.actualH)}</td><td><Pass ok={report.footprint.passH} /></td></tr>
            </tbody>
          </table>
        </section>

        {/* X boundaries */}
        <section className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold">X Boundaries (Cumulative: GlueFlap + L + D + L + D)</h4>
            <Pass ok={report.xPass} />
          </div>
          <table className="w-full text-xs">
            <thead className="text-[10px] text-muted-foreground">
              <tr><th className="text-start">Index</th><th className="text-start">Expected</th><th className="text-start">Actual</th><th className="text-start">Crease Tag</th></tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {report.xExpected.map((exp, i) => {
                const tag = ['(origin)',
                  'CREASE_X_GLUE_TO_FRONT_1',
                  'CREASE_X_FRONT_1_TO_DEPTH_1',
                  'CREASE_X_DEPTH_1_TO_FRONT_2',
                  'CREASE_X_FRONT_2_TO_DEPTH_2',
                  '(footprint W)'][i];
                return (
                  <tr key={i}>
                    <td>X{i}</td>
                    <td>{fmt(exp)}</td>
                    <td>{fmt(report.xActual[i])}</td>
                    <td className="text-[10px] text-muted-foreground">{tag}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Y boundaries */}
        <section className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold">Y Boundaries (Top Stack / Body=H / Bottom Stack)</h4>
            <Pass ok={report.yPass} />
          </div>
          <table className="w-full text-xs">
            <thead className="text-[10px] text-muted-foreground">
              <tr><th className="text-start">Index</th><th className="text-start">Expected</th><th className="text-start">Actual</th><th className="text-start">Region</th></tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {report.yExpected.map((exp, i) => {
                const region = ['(origin)',
                  'CREASE_Y_TOP_TO_BODY_* (Depth)',
                  'CREASE_Y_BODY_TO_BOTTOM_* (after H)',
                  '(footprint H)'][i];
                return (
                  <tr key={i}>
                    <td>Y{i}</td>
                    <td>{fmt(exp)}</td>
                    <td>{fmt(report.yActual[i])}</td>
                    <td className="text-[10px] text-muted-foreground">{region}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="text-[11px] text-muted-foreground">
            Height: expected <span className="font-mono">{fmt(report.height.expected)}</span>, actual <span className="font-mono">{fmt(report.height.actual)}</span> <Pass ok={report.height.pass} />
          </div>
        </section>

        {/* Behavior */}
        <section className="rounded-lg border border-border bg-muted/20 p-3 space-y-2 text-xs">
          <h4 className="font-bold">السلوك لكل عنصر</h4>
          <Group title="يتحرك / يتمدد مع Length+Depth (محور X):" items={report.resizedX} />
          <Group title="يتحرك / يتمدد مع Height (محور Y):" items={report.resizedY} />
          <Group title="ثابت داخل لوحته (يتحرك بدون تشويه):" items={report.anchoredOnly} />
        </section>

        {/* Warnings */}
        <section className="rounded-lg border border-border bg-muted/20 p-3 text-xs">
          <h4 className="font-bold mb-1">Warnings</h4>
          {report.warnings.length === 0 ? (
            <p className="text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> لا توجد تحذيرات — Mapping متطابق بالكامل.
            </p>
          ) : (
            <ul className="list-disc ms-4 space-y-0.5 text-destructive">
              {report.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
};

const Stat = ({ label, v }: { label: string; v: string }) => (
  <div className="rounded bg-background border border-border/50 px-2 py-1">
    <p className="text-[9px] text-muted-foreground">{label}</p>
    <p className="text-xs font-bold tabular-nums">{v}</p>
  </div>
);

const Group = ({ title, items }: { title: string; items: string[] }) => (
  <div>
    <p className="text-[11px] font-semibold text-muted-foreground">{title}</p>
    <ul className="list-disc ms-4 text-[11px]">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  </div>
);

export default CarryingHandleBoxDebugDialog;
