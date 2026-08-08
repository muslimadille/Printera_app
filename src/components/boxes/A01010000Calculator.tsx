// A01.01.00.00 — Parametric Dieline Calculator
// -----------------------------------------------
// Minimal component: input form + SVG preview.
// No flaps, no nesting, no 3D — just the flat die-cut.

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import {
  A01010000_DEFAULTS,
  A01010000_RULES,
  type A01010000Params,
} from '@/lib/a01010000';
import { buildA01010000Geometry } from '@/lib/a01010000/geometry';

const num = (v: string, fallback: number) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

const UNIT_FACTORS: Record<'mm' | 'cm' | 'in', number> = { mm: 1, cm: 10, in: 25.4 };
const toDisplay = (mm: number, unit: 'mm' | 'cm' | 'in') =>
  parseFloat((mm / UNIT_FACTORS[unit]).toFixed(4));
const toMm = (val: number, unit: 'mm' | 'cm' | 'in') => val * UNIT_FACTORS[unit];

const NumField = ({
  label, value, onChange, step = '0.01', min, unit, disabled,
}: {
  label: string; value: number; onChange: (v: number) => void;
  step?: string; min?: string; unit?: 'mm' | 'cm' | 'in'; disabled?: boolean;
}) => (
  <div>
    <Label className="text-xs">{label}</Label>
    <Input type="number" step={step} min={min}
      value={unit ? toDisplay(value, unit) : value}
      disabled={disabled}
      onChange={e => onChange(unit ? toMm(num(e.target.value, toDisplay(value, unit)), unit) : num(e.target.value, value))} />
  </div>
);

// ---- SVG Preview ----------------------------------------------------------
const A01010000Preview = ({
  params,
  showDebug = true,
}: {
  params: A01010000Params;
  showDebug?: boolean;
}) => {
  const geo = useMemo(() => buildA01010000Geometry(params), [params]);

  return (
    <div className="space-y-2">
      {showDebug && (
        <div className="text-xs text-muted-foreground">
          Segments: <b>{geo.segments}</b>
          {' · '}BBox: <b>{geo.bbox.w.toFixed(2)} × {geo.bbox.h.toFixed(2)} mm</b>
          {' · '}Panels: Face-Depth-Face-Depth
        </div>
      )}
      <div
        className="border rounded-lg p-3 bg-white overflow-auto flex justify-center"
        dangerouslySetInnerHTML={{ __html: geo.svg }}
        style={{ maxHeight: '65vh' }}
      />
    </div>
  );
};

// ---- Main Calculator ------------------------------------------------------
const A01010000Calculator = ({ isAdmin = false }: { isAdmin?: boolean }) => {
  const hiddenCls = isAdmin ? '' : 'hidden';
  const [params, setParams] = useState<A01010000Params>(A01010000_DEFAULTS);
  const [unit, setUnit] = useState<'mm' | 'cm' | 'in'>('mm');

  const set = <K extends keyof A01010000Params>(k: K, v: A01010000Params[K]) => {
    setParams(prev => ({ ...prev, [k]: v }));
  };

  const reset = () => setParams({ ...A01010000_DEFAULTS });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] gap-4 p-2 sm:p-4 min-w-0 w-full calc-shell">
      {/* Left: Controls */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>A01.01.00.00 — ECMA</span>
            <Button variant="ghost" size="icon" onClick={reset} title="Reset defaults">
              <RotateCcw className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <NumField label="Face Width (W)" value={params.W} onChange={v => set('W', v)}
            min={String(A01010000_RULES.minW)} unit={unit} />
          <NumField label="Depth (D)" value={params.D} onChange={v => set('D', v)}
            min={String(A01010000_RULES.minD)} unit={unit} />
          <NumField label="Height (H)" value={params.H} onChange={v => set('H', v)}
            min={String(A01010000_RULES.minH)} unit={unit} />
          <NumField label="Glue Flap (GF)" value={params.GF} onChange={v => set('GF', v)}
            min={String(A01010000_RULES.minGF)} unit={unit} />
          <NumField label="Glue Chamfer (GH)" value={params.GH ?? 8.44} onChange={v => set('GH', v)}
            min="0" unit={unit} />

          <div>
            <Label className="text-xs">Unit</Label>
            <div className="flex gap-1 mt-1">
              {(['mm', 'cm', 'in'] as const).map(u => (
                <Button
                  key={u}
                  variant={unit === u ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => setUnit(u)}
                >
                  {u}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Right: Preview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Dieline Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <A01010000Preview params={params} />
        </CardContent>
      </Card>
    </div>
  );
};

export default A01010000Calculator;
