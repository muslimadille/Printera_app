/**
 * Die Cut 3 — Phase 1 Zone Overlay Preview
 * Renders the Original SVG with a translucent overlay of every zone bbox
 * and its ID label. Read-only — no resize/calibration UI.
 */
import { useState } from 'react';
import templateUrl from '@/assets/diecut3/template.svg?url';
import colorTemplateUrl from '@/assets/diecut3/template-color.svg?url';
import {
  TEMPLATE_VIEWBOX,
  ZONES,
  ANCHORS_X,
  ANCHORS_Y,
  zoneWidth,
  zoneHeight,
  ptToMm,
} from '@/lib/diecut3ZoneMap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const ZONE_FILL = 'hsl(var(--primary) / 0.12)';
const ZONE_STROKE = 'hsl(var(--primary))';
const CHILD_FILL = 'hsl(var(--accent) / 0.22)';
const ANCHOR_X_COLOR = 'hsl(var(--destructive))';
const ANCHOR_Y_COLOR = 'hsl(var(--ring))';

export default function DieCut3ZoneOverlayPreview() {
  const [base, setBase] = useState<'original' | 'color'>('color');
  const [showZones, setShowZones] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showAnchors, setShowAnchors] = useState(true);

  const { w, h } = TEMPLATE_VIEWBOX;
  const bgUrl = base === 'original' ? templateUrl : colorTemplateUrl;

  return (
    <Card className="w-full">
      <CardHeader className="flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="text-base">
          Zone Overlay Preview — Phase 1 (Reference: L=300, D=150, H=180 mm)
        </CardTitle>
        <div className="flex items-center gap-4 flex-wrap text-sm">
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={base === 'original' ? 'default' : 'outline'}
              onClick={() => setBase('original')}
            >
              Original SVG
            </Button>
            <Button
              size="sm"
              variant={base === 'color' ? 'default' : 'outline'}
              onClick={() => setBase('color')}
            >
              Colored SVG
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="z-zones" checked={showZones} onCheckedChange={setShowZones} />
            <Label htmlFor="z-zones">Zones</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="z-labels" checked={showLabels} onCheckedChange={setShowLabels} />
            <Label htmlFor="z-labels">Labels</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="z-anchors" checked={showAnchors} onCheckedChange={setShowAnchors} />
            <Label htmlFor="z-anchors">Anchors</Label>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="relative w-full border rounded bg-muted/30 overflow-hidden">
          {/* Background = the actual source-of-truth SVG file, untouched. */}
          <img
            src={bgUrl}
            alt="Die Cut 3 template"
            className="block w-full h-auto select-none"
            style={{ aspectRatio: `${w} / ${h}` }}
          />

          {/* Overlay layer */}
          <svg
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 w-full h-full pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {showZones &&
              ZONES.map((z) => {
                const isChild = z.parent !== null;
                return (
                  <g key={z.id}>
                    <rect
                      x={z.startX}
                      y={z.startY}
                      width={zoneWidth(z)}
                      height={zoneHeight(z)}
                      fill={isChild ? CHILD_FILL : ZONE_FILL}
                      stroke={ZONE_STROKE}
                      strokeWidth={isChild ? 1.2 : 2}
                      strokeDasharray={isChild ? '4 3' : 'none'}
                    />
                    {showLabels && (
                      <text
                        x={z.startX + 6}
                        y={z.startY + 22}
                        fill={ZONE_STROKE}
                        fontSize={isChild ? 14 : 18}
                        fontFamily="sans-serif"
                        fontWeight={isChild ? 500 : 700}
                        style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: 3 }}
                      >
                        {z.id}
                      </text>
                    )}
                  </g>
                );
              })}

            {showAnchors && (
              <>
                {ANCHORS_X.map((a) => (
                  <g key={a.id}>
                    <line
                      x1={a.pt} x2={a.pt} y1={0} y2={h}
                      stroke={ANCHOR_X_COLOR}
                      strokeWidth={1.5}
                      strokeDasharray="6 4"
                      opacity={0.7}
                    />
                    <text
                      x={a.pt + 4}
                      y={h - 8}
                      fill={ANCHOR_X_COLOR}
                      fontSize={14}
                      fontFamily="sans-serif"
                      fontWeight={700}
                      style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: 3 }}
                    >
                      {a.id}
                    </text>
                  </g>
                ))}
                {ANCHORS_Y.map((a) => (
                  <g key={a.id}>
                    <line
                      x1={0} x2={w} y1={a.pt} y2={a.pt}
                      stroke={ANCHOR_Y_COLOR}
                      strokeWidth={1.5}
                      strokeDasharray="6 4"
                      opacity={0.7}
                    />
                    <text
                      x={8}
                      y={a.pt - 4}
                      fill={ANCHOR_Y_COLOR}
                      fontSize={14}
                      fontFamily="sans-serif"
                      fontWeight={700}
                      style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: 3 }}
                    >
                      {a.id}
                    </text>
                  </g>
                ))}
              </>
            )}
          </svg>
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          المصدر الموثوق الوحيد: Original SVG + Colored SVG + Excel. لا توجد محركات Resize/Calibration/Export في
          هذه المرحلة. كل bbox تم استخراجه مباشرة من إحداثيات SVG الأصلية. وحدة العرض = pt (1 mm = 2.83465 pt).
          القياس المرجعي: L = {ptToMm(978.0 - 127.6)} mm، D = {ptToMm(1403.1 - 978.0)} mm، H ={' '}
          {ptToMm(935.4 - 425.2)} mm.
        </p>
      </CardContent>
    </Card>
  );
}
