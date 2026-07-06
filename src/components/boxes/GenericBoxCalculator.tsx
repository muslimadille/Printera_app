// Generic Box Calculator — Parametric Dieline for any config-based template
// -------------------------------------------------------------------------
// Dropdown to select template → inputs for W/D/H/GF → SVG preview.

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { buildGenericBoxGeometry } from '@/lib/genericBox/engine';
import {
  TEMPLATE_REGISTRY,
  getTemplateConfig,
  type BoxTemplateConfig,
  type BoxParams,
} from '@/lib/genericBox';

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
const GenericPreview = ({
  config, params, showDebug = true,
}: {
  config: BoxTemplateConfig; params: BoxParams; showDebug?: boolean;
}) => {
  const geo = useMemo(() => buildGenericBoxGeometry(config, params), [config, params]);

  return (
    <div className="space-y-2">
      {showDebug && (
        <div className="text-xs text-muted-foreground">
          <b>{config.id}</b>
          {' · '}Segments: <b>{geo.segments}</b>
          {' · '}BBox: <b>{geo.bbox.w.toFixed(2)} × {geo.bbox.h.toFixed(2)} mm</b>
          {' · '}Panels: {config.panels.map(p => p.name).join(' ∙ ')}
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
const GenericBoxCalculator = () => {
  const [selectedId, setSelectedId] = useState<string>('A01.01.00.00');
  const [params, setParams] = useState<BoxParams>({ W: 283.47, D: 141.73, H: 425.2, GF: 32.6 });
  const [unit, setUnit] = useState<'mm' | 'cm' | 'in'>('mm');

  const config = useMemo(() => getTemplateConfig(selectedId) ?? TEMPLATE_REGISTRY[0], [selectedId]);

  const set = <K extends keyof BoxParams>(k: K, v: BoxParams[K]) =>
    setParams(prev => ({ ...prev, [k]: v }));

  const reset = () => setParams({ ...config.defaults });

  const selectTemplate = (id: string) => {
    setSelectedId(id);
    const cfg = getTemplateConfig(id);
    if (cfg) setParams({ ...cfg.defaults });
  };

  return (
    <div className="grid grid-cols-[300px_1fr] gap-4 p-4">
      {/* Left: Controls */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Generic Box</span>
            <Button variant="ghost" size="icon" onClick={reset} title="Reset defaults">
              <RotateCcw className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Template selector */}
          <div>
            <Label className="text-xs">Template</Label>
            <select
              className="w-full text-sm border rounded-lg p-2 bg-background mt-1"
              value={selectedId}
              onChange={e => selectTemplate(e.target.value)}
            >
              {TEMPLATE_REGISTRY.map(t => (
                <option key={t.id} value={t.id}>{t.id} — {t.name}</option>
              ))}
            </select>
          </div>

          <NumField label="Face Width (W)" value={params.W} onChange={v => set('W', v)} min="5" unit={unit} />
          <NumField label="Depth (D)" value={params.D} onChange={v => set('D', v)} min="5" unit={unit} />
          <NumField label="Height (H)" value={params.H} onChange={v => set('H', v)} min="5" unit={unit} />
          <NumField label="Glue Flap (GF)" value={params.GF} onChange={v => set('GF', v)} min="5" unit={unit} />

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
          <CardTitle className="text-sm">
            {config.id} — {config.catalog}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GenericPreview config={config} params={params} />
        </CardContent>
      </Card>
    </div>
  );
};

export default GenericBoxCalculator;
