import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Download, Box as BoxIcon } from 'lucide-react';
import LidTuckBoxPreview from './LidTuckBoxPreview';
import {
  buildLidTuckBoxGeometry,
  LID_TUCK_BOX_DEFAULTS,
  LID_TUCK_BOX_RANGES,
} from '@/lib/lidTuckBoxEngine';
import { downloadLidTuckBoxSvg } from '@/lib/lidTuckBoxExport';

const round3 = (n: number) => Math.round(n * 1000) / 1000;

const LidTuckBoxCalculator = () => {
  const [L, setL] = useState<number>(LID_TUCK_BOX_DEFAULTS.L);
  const [D, setD] = useState<number>(LID_TUCK_BOX_DEFAULTS.D);
  const [H, setH] = useState<number>(LID_TUCK_BOX_DEFAULTS.H);

  const geometry = useMemo(() => {
    const safeL = Number.isFinite(L) && L > 0 ? L : LID_TUCK_BOX_DEFAULTS.L;
    const safeD = Number.isFinite(D) && D > 0 ? D : LID_TUCK_BOX_DEFAULTS.D;
    const safeH = Number.isFinite(H) && H > 0 ? H : LID_TUCK_BOX_DEFAULTS.H;
    return buildLidTuckBoxGeometry({ L: safeL, D: safeD, H: safeH });
  }, [L, D, H]);

  const outsideRange = (val: number, range: readonly [number, number]) =>
    val < range[0] || val > range[1];

  const warn =
    outsideRange(L, LID_TUCK_BOX_RANGES.L) ||
    outsideRange(D, LID_TUCK_BOX_RANGES.D) ||
    outsideRange(H, LID_TUCK_BOX_RANGES.H);

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] min-w-0 w-full calc-shell" dir="rtl">
      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BoxIcon className="w-4 h-4 text-primary" />
            Lid Tuck Box
            <span className="text-[10px] font-normal text-muted-foreground">
              lid-tuck-box-v1
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ltb-L">Length (mm)</Label>
              <Input
                id="ltb-L"
                type="number"
                inputMode="decimal"
                step="1"
                value={L}
                onFocus={e => e.currentTarget.select()}
                onChange={e => setL(parseFloat(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ltb-D">Depth (mm)</Label>
              <Input
                id="ltb-D"
                type="number"
                inputMode="decimal"
                step="1"
                value={D}
                onFocus={e => e.currentTarget.select()}
                onChange={e => setD(parseFloat(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ltb-H">Height (mm)</Label>
              <Input
                id="ltb-H"
                type="number"
                inputMode="decimal"
                step="1"
                value={H}
                onFocus={e => e.currentTarget.select()}
                onChange={e => setH(parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Flat width</span>
              <span className="font-mono font-semibold">
                {round3(geometry.flatWidth)} mm
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Flat height</span>
              <span className="font-mono font-semibold">
                {round3(geometry.flatHeight)} mm
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Inner flap</span>
              <span className="font-mono">
                {round3(geometry.derived.innerFlapHeight)} mm
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lid height</span>
              <span className="font-mono">
                {round3(geometry.derived.lidHeight)} mm
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Base height</span>
              <span className="font-mono">
                {round3(geometry.derived.baseHeight)} mm
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Apex height</span>
              <span className="font-mono">
                {round3(geometry.derived.apexHeight)} mm
              </span>
            </div>
          </div>

          {warn && (
            <div className="rounded-md border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-[11px] p-2">
              قيمة خارج النطاق الموثّق (L 180–220, D 40–60, H 190–210). النتيجة
              مبنية على نفس الصِيغ لكن لم يتم التحقّق منها على عيّنة فعلية.
            </div>
          )}

          <Button
            type="button"
            onClick={() => downloadLidTuckBoxSvg(geometry)}
            className="w-full"
          >
            <Download className="w-4 h-4 ml-2" />
            تنزيل SVG
          </Button>

          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Phase-1: SVG inline download only. PDF / DXF / Illustrator-specific
            export, SheetLayout, و Nesting مؤجَّلة لمرحلة لاحقة.
          </p>
        </CardContent>
      </Card>

      <LidTuckBoxPreview geometry={geometry} />
    </div>
  );
};

export default LidTuckBoxCalculator;
