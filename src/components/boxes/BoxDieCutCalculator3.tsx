/**
 * Die Cut 3 — Phase 1 Tab (Clean Fresh Build)
 *
 * Phase 1 deliverables only:
 *   • Zone Table
 *   • Parent / Child Relationships
 *   • Anchor Tables (X + Y)
 *   • Zone Overlay Preview
 *
 * No Resize / Calibration / Packing / Footprint / Pitch / Export / Rotation.
 * Nothing reused from Die Cut, Die Cut 2, or the deleted previous Die Cut 3.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import DieCut3ZoneOverlayPreview from '@/components/DieCut3ZoneOverlayPreview';
import {
  ANCHORS_X, ANCHORS_X_HANDLE, ANCHORS_Y, ANCHORS_Y_DEPTH_TONGUE,
  ZONES, ZONE_TREE, REFERENCE_DIMS_MM, ptToMm, zoneHeight, zoneWidth,
} from '@/lib/diecut3ZoneMap';

const fmt = (v: number) => v.toFixed(1);

export default function DieCutCalculator3() {
  const roots = ZONES.filter(z => z.parent === null);
  const children = ZONES.filter(z => z.parent !== null);

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Die Cut 3 — Phase 1: Zone Mapping + Anchor Mapping
            <Badge variant="secondary">Clean Fresh Build</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>
            مرجع المقاسات: L = {REFERENCE_DIMS_MM.L} mm، D = {REFERENCE_DIMS_MM.D} mm، H ={' '}
            {REFERENCE_DIMS_MM.H} mm.
          </p>
          <p>
            المصدر الموثوق الوحيد: <code>src/assets/diecut3/template.svg</code> +{' '}
            <code>template-color.svg</code> + <code>Die_Cut_3_Strict_Calibration_Model.xlsx</code>.
          </p>
          <p className="text-destructive">
            لا يوجد Resize / Calibration / Packing / Export / Rotation في هذه المرحلة. توقف بعد العرض.
          </p>
        </CardContent>
      </Card>

      {/* Zone Overlay Preview */}
      <DieCut3ZoneOverlayPreview />

      {/* Anchor Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Horizontal Anchors (X)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead><TableHead>X (pt)</TableHead>
                  <TableHead>X (mm)</TableHead><TableHead>Driver</TableHead>
                  <TableHead>Label</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ANCHORS_X.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.id}</TableCell>
                    <TableCell className="font-mono text-xs">{fmt(a.pt)}</TableCell>
                    <TableCell className="font-mono text-xs">{a.mm}</TableCell>
                    <TableCell><Badge variant="outline">{a.driver}</Badge></TableCell>
                    <TableCell className="text-xs">{a.label}</TableCell>
                  </TableRow>
                ))}
                {ANCHORS_X_HANDLE.map(a => (
                  <TableRow key={a.id} className="bg-muted/40">
                    <TableCell className="font-mono text-xs">{a.id}</TableCell>
                    <TableCell className="font-mono text-xs">{fmt(a.pt)}</TableCell>
                    <TableCell className="font-mono text-xs">{a.mm}</TableCell>
                    <TableCell><Badge variant="outline">{a.driver}</Badge></TableCell>
                    <TableCell className="text-xs">{a.label}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Vertical Anchors (Y)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead><TableHead>Y (pt)</TableHead>
                  <TableHead>Y (mm)</TableHead><TableHead>Driver</TableHead>
                  <TableHead>Label</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ANCHORS_Y.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.id}</TableCell>
                    <TableCell className="font-mono text-xs">{fmt(a.pt)}</TableCell>
                    <TableCell className="font-mono text-xs">{a.mm}</TableCell>
                    <TableCell><Badge variant="outline">{a.driver}</Badge></TableCell>
                    <TableCell className="text-xs">{a.label}</TableCell>
                  </TableRow>
                ))}
                {ANCHORS_Y_DEPTH_TONGUE.map(a => (
                  <TableRow key={a.id} className="bg-muted/40">
                    <TableCell className="font-mono text-xs">{a.id}</TableCell>
                    <TableCell className="font-mono text-xs">{fmt(a.pt)}</TableCell>
                    <TableCell className="font-mono text-xs">{a.mm}</TableCell>
                    <TableCell><Badge variant="outline">{a.driver}</Badge></TableCell>
                    <TableCell className="text-xs">{a.label}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Zone Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Zone Table — كل المناطق</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Excel Ref</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>BBox (pt)</TableHead>
                <TableHead>W × H (mm)</TableHead>
                <TableHead>Width Rule</TableHead>
                <TableHead>Height Rule</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Sacred</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ZONES.map(z => {
                const w = zoneWidth(z), h = zoneHeight(z);
                return (
                  <TableRow key={z.id}>
                    <TableCell className="font-mono text-xs">{z.id}</TableCell>
                    <TableCell className="text-xs">{z.name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{z.category}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{z.excelRef ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block w-3 h-3 rounded border border-foreground/20"
                          style={{ background: z.color }}
                        />
                        <code className="text-[10px]">{z.color}</code>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-[10px]">{z.parent ?? '—'}</TableCell>
                    <TableCell className="font-mono text-[10px] whitespace-nowrap">
                      x:{fmt(z.startX)}→{fmt(z.endX)}<br/>y:{fmt(z.startY)}→{fmt(z.endY)}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] whitespace-nowrap">
                      {ptToMm(w)} × {ptToMm(h)}
                    </TableCell>
                    <TableCell className="text-[11px]">{z.widthRule}</TableCell>
                    <TableCell className="text-[11px]">{z.heightRule}</TableCell>
                    <TableCell className="text-[11px]">{z.driver}</TableCell>
                    <TableCell>
                      {z.sacredGeometry ? <Badge variant="destructive">Sacred</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Parent / Child tree */}
      <Card>
        <CardHeader><CardTitle className="text-base">Parent / Child Relationships</CardTitle></CardHeader>
        <CardContent>
          <ul className="text-sm space-y-2 font-mono">
            {roots.map(p => {
              const kids = ZONE_TREE[p.id] || [];
              return (
                <li key={p.id}>
                  <span className="font-bold">{p.id}</span>
                  <span className="text-muted-foreground"> — {p.name}</span>
                  {kids.length > 0 && (
                    <ul className="mr-6 mt-1 space-y-0.5 border-r-2 border-muted pr-3">
                      {kids.map(cid => {
                        const c = ZONES.find(x => x.id === cid)!;
                        const gks = ZONE_TREE[cid] || [];
                        return (
                          <li key={cid}>
                            ↳ <span>{cid}</span>
                            <span className="text-muted-foreground text-xs"> — {c.name}</span>
                            {gks.length > 0 && (
                              <ul className="mr-6 mt-0.5 border-r-2 border-muted pr-3">
                                {gks.map(gid => {
                                  const g = ZONES.find(x => x.id === gid)!;
                                  return (
                                    <li key={gid} className="text-xs">
                                      ↳↳ {gid}
                                      <span className="text-muted-foreground"> — {g.name}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground mt-3">
            مجموع المناطق: <strong>{ZONES.length}</strong> ({roots.length} جذور + {children.length} أبناء).
          </p>
        </CardContent>
      </Card>

      {/* End-of-phase notice */}
      <Card className="border-destructive/40">
        <CardContent className="pt-6 text-sm">
          <p className="font-semibold">⛔ توقف بعد Phase 1</p>
          <p className="text-muted-foreground">
            لا تنتقل إلى Movement Map / Resize / Calibration / Packing / Export قبل الاعتماد الصريح.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
