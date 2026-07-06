/**
 * Die Cut 4 — Phase 1 Tab (Fresh Independent Build)
 *
 * Phase 1 deliverables only:
 *   • Zone Table
 *   • Parent / Child Relationships
 *   • Anchor Tables (X + Y)
 *   • Zone Overlay Preview
 *
 * No Resize / Calibration / Packing / Footprint / Pitch / Export / Rotation.
 * Independent — no imports from Die Cut, Die Cut 2, or Die Cut 3.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import DieCut4ZoneOverlayPreview from '@/components/DieCut4ZoneOverlayPreview';
import {
  DC4_ANCHORS_X, DC4_ANCHORS_X_HANDLE,
  DC4_ANCHORS_Y, DC4_ANCHORS_Y_DEPTH_TONGUE,
  DC4_ZONES, DC4_ZONE_TREE, DC4_REFERENCE_DIMS_MM,
  dc4PtToMm, dc4ZoneHeight, dc4ZoneWidth,
} from '@/lib/diecut4ZoneMap';

const fmt = (v: number) => v.toFixed(1);
const short = (id: string) => id.replace(/^DC4_/, '');

export default function DieCutCalculator4() {
  const roots = DC4_ZONES.filter(z => z.parent === null);
  const children = DC4_ZONES.filter(z => z.parent !== null);

  return (
    <div className="space-y-4" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
            Die Cut 4 — Phase 1: Zone Mapping + Anchor Mapping
            <Badge variant="secondary">Fresh Independent Build</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>
            مرجع المقاسات: L = {DC4_REFERENCE_DIMS_MM.L} mm، D = {DC4_REFERENCE_DIMS_MM.D} mm، H ={' '}
            {DC4_REFERENCE_DIMS_MM.H} mm.
          </p>
          <p>
            المصدر الموثوق الوحيد: <code>src/assets/diecut4/template.svg</code> +{' '}
            <code>template-color.svg</code> + <code>Die_Cut_4_Strict_Calibration_Model.xlsx</code>.
          </p>
          <p className="text-destructive">
            لا يوجد Resize / Calibration / Packing / Export / Rotation في هذه المرحلة. توقف بعد العرض في انتظار
            الاعتماد.
          </p>
        </CardContent>
      </Card>

      <DieCut4ZoneOverlayPreview />

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
                {DC4_ANCHORS_X.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{short(a.id)}</TableCell>
                    <TableCell className="font-mono text-xs">{fmt(a.pt)}</TableCell>
                    <TableCell className="font-mono text-xs">{a.mm}</TableCell>
                    <TableCell><Badge variant="outline">{a.driver}</Badge></TableCell>
                    <TableCell className="text-xs">{a.label}</TableCell>
                  </TableRow>
                ))}
                {DC4_ANCHORS_X_HANDLE.map(a => (
                  <TableRow key={a.id} className="bg-muted/40">
                    <TableCell className="font-mono text-xs">{short(a.id)}</TableCell>
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
                {DC4_ANCHORS_Y.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{short(a.id)}</TableCell>
                    <TableCell className="font-mono text-xs">{fmt(a.pt)}</TableCell>
                    <TableCell className="font-mono text-xs">{a.mm}</TableCell>
                    <TableCell><Badge variant="outline">{a.driver}</Badge></TableCell>
                    <TableCell className="text-xs">{a.label}</TableCell>
                  </TableRow>
                ))}
                {DC4_ANCHORS_Y_DEPTH_TONGUE.map(a => (
                  <TableRow key={a.id} className="bg-muted/40">
                    <TableCell className="font-mono text-xs">{short(a.id)}</TableCell>
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
              {DC4_ZONES.map(z => {
                const w = dc4ZoneWidth(z), h = dc4ZoneHeight(z);
                return (
                  <TableRow key={z.id}>
                    <TableCell className="font-mono text-xs">{short(z.id)}</TableCell>
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
                    <TableCell className="font-mono text-[10px]">{z.parent ? short(z.parent) : '—'}</TableCell>
                    <TableCell className="font-mono text-[10px] whitespace-nowrap">
                      x:{fmt(z.startX)}→{fmt(z.endX)}<br/>y:{fmt(z.startY)}→{fmt(z.endY)}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] whitespace-nowrap">
                      {dc4PtToMm(w)} × {dc4PtToMm(h)}
                    </TableCell>
                    <TableCell className="text-[11px]">{z.widthRule}</TableCell>
                    <TableCell className="text-[11px]">{z.heightRule}</TableCell>
                    <TableCell className="text-[11px]">{z.driver}</TableCell>
                    <TableCell>
                      {z.sacredGeometry
                        ? <Badge variant="destructive">Sacred</Badge>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Parent / Child Relationships</CardTitle></CardHeader>
        <CardContent>
          <ul className="text-sm space-y-2 font-mono">
            {roots.map(p => {
              const kids = DC4_ZONE_TREE[p.id] || [];
              return (
                <li key={p.id}>
                  <span className="font-bold">{short(p.id)}</span>
                  <span className="text-muted-foreground"> — {p.name}</span>
                  {kids.length > 0 && (
                    <ul className="mr-6 mt-1 space-y-0.5 border-r-2 border-muted pr-3">
                      {kids.map(cid => {
                        const c = DC4_ZONES.find(x => x.id === cid)!;
                        const gks = DC4_ZONE_TREE[cid] || [];
                        return (
                          <li key={cid}>
                            ↳ <span>{short(cid)}</span>
                            <span className="text-muted-foreground text-xs"> — {c.name}</span>
                            {gks.length > 0 && (
                              <ul className="mr-6 mt-0.5 border-r-2 border-muted pr-3">
                                {gks.map(gid => {
                                  const g = DC4_ZONES.find(x => x.id === gid)!;
                                  return (
                                    <li key={gid} className="text-xs">
                                      ↳↳ {short(gid)}
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
            مجموع المناطق: <strong>{DC4_ZONES.length}</strong> ({roots.length} جذور + {children.length} أبناء).
          </p>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardContent className="pt-6 text-sm">
          <p className="font-semibold">⛔ توقف بعد Phase 1</p>
          <p className="text-muted-foreground">
            لا تنتقل إلى Movement Map / Resize / Calibration / Packing / Export قبل الاعتماد الصريح.
            عند الاعتماد سيتم بناء Phase 2 (Movement Map) كوحدة مستقلة بدون أي استيراد من Die Cut / Die Cut 2 / Die Cut 3.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
