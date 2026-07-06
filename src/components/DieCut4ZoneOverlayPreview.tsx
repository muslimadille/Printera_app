/**
 * Die Cut 4 — Phase 1 Zone Overlay Preview
 * Renders the Original SVG with a translucent overlay of every zone bbox
 * and its ID label. Read-only — no resize/calibration UI.
 *
 * INDEPENDENT — no imports from diecut/diecut2/diecut3.
 */
import { useState } from 'react';
import templateUrl from '@/assets/diecut4/template.svg?url';
import colorTemplateUrl from '@/assets/diecut4/template-color.svg?url';
import {
  DC4_TEMPLATE_VIEWBOX,
  DC4_ZONES,
  DC4_ANCHORS_X,
  DC4_ANCHORS_Y,
  dc4ZoneWidth,
  dc4ZoneHeight,
  dc4PtToMm,
} from '@/lib/diecut4ZoneMap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const ZONE_FILL = 'hsl(var(--primary) / 0.12)';
const ZONE_STROKE = 'hsl(var(--primary))';
const CHILD_FILL = 'hsl(var(--accent) / 0.22)';
const ANCHOR_X_COLOR = 'hsl(var(--destructive))';
const ANCHOR_Y_COLOR = 'hsl(var(--ring))';

export default function DieCut4ZoneOverlayPreview() {
  const [base, setBase] = useState<'original' | 'color'>('color');
  const [showZones, setShowZones] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showAnchors, setShowAnchors] = useState(true);

  const { w, h } = DC4_TEMPLATE_VIEWBOX;
  const bgUrl = base === 'original' ? templateUrl : colorTemplateUrl;

  return (
    <Card className="w-full">
      <CardHeader className="flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="text-base">
          Die Cut 4 — Zone Overlay (Reference: L=300, D=150, H=180 mm)
        </CardTitle>
        <div className="flex items-center gap-4 flex-wrap text-sm">
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant={base === 'original' ? 'default' : 'outline'} onClick={() => setBase('original')}>
              Original SVG
            </Button>
            <Button size="sm" variant={base === 'color' ? 'default' : 'outline'} onClick={() => setBase('color')}>
              Colored SVG
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="dc4-zones" checked={showZones} onCheckedChange={setShowZones} />
            <Label htmlFor="dc4-zones">Zones</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="dc4-labels" checked={showLabels} onCheckedChange={setShowLabels} />
            <Label htmlFor="dc4-labels">Labels</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="dc4-anchors" checked={showAnchors} onCheckedChange={setShowAnchors} />
            <Label htmlFor="dc4-anchors">Anchors</Label>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="relative w-full border rounded bg-muted/30 overflow-hidden">
          <img
            src={bgUrl}
            alt="Die Cut 4 template"
            className="block w-full h-auto select-none"
            style={{ aspectRatio: `${w} / ${h}` }}
          />
          <svg
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 w-full h-full pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {showZones &&
              DC4_ZONES.map((z) => {
                const isChild = z.parent !== null;
                return (
                  <g key={z.id}>
                    <rect
                      x={z.startX}
                      y={z.startY}
                      width={dc4ZoneWidth(z)}
                      height={dc4ZoneHeight(z)}
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
                        {z.id.replace(/^DC4_/, '')}
                      </text>
                    )}
                  </g>
                );
              })}

            {showAnchors && (
              <>
                {DC4_ANCHORS_X.map((a) => (
                  <g key={a.id}>
                    <line x1={a.pt} x2={a.pt} y1={0} y2={h} stroke={ANCHOR_X_COLOR}
                          strokeWidth={1.5} strokeDasharray="6 4" opacity={0.7} />
                    <text x={a.pt + 4} y={h - 8} fill={ANCHOR_X_COLOR} fontSize={14}
                          fontFamily="sans-serif" fontWeight={700}
                          style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: 3 }}>
                      {a.id.replace(/^DC4_/, '')}
                    </text>
                  </g>
                ))}
                {DC4_ANCHORS_Y.map((a) => (
                  <g key={a.id}>
                    <line x1={0} x2={w} y1={a.pt} y2={a.pt} stroke={ANCHOR_Y_COLOR}
                          strokeWidth={1.5} strokeDasharray="6 4" opacity={0.7} />
                    <text x={8} y={a.pt - 4} fill={ANCHOR_Y_COLOR} fontSize={14}
                          fontFamily="sans-serif" fontWeight={700}
                          style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: 3 }}>
                      {a.id.replace(/^DC4_/, '')}
                    </text>
                  </g>
                ))}
              </>
            )}
          </svg>
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          المصدر الموثوق الوحيد: Original SVG + Colored SVG + Excel. لا توجد محركات Resize/Calibration/Export في
          هذه المرحلة. كل bbox مستخرج مباشرة من إحداثيات SVG الأصلية. الوحدة = pt (1 mm = 2.83465 pt).
          القياس المرجعي: L = {dc4PtToMm(978.0 - 127.6)} mm، D = {dc4PtToMm(1403.1 - 978.0)} mm، H ={' '}
          {dc4PtToMm(935.4 - 425.2)} mm.
        </p>
      </CardContent>
    </Card>
  );
}
