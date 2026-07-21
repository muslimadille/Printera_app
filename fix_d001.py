import re

with open('src/components/boxes/D001Calculator.tsx', 'r') as f:
    content = f.read()

# We want to find `const D001Calculator = ({ isAdmin = false }: { isAdmin?: boolean }) => {`
# and modify it.
content = content.replace("const D001Calculator = ({ isAdmin = false }: { isAdmin?: boolean }) => {", "const D001Calculator = () => {")

# Then we find the `return (` block and replace it.
# We also need to fix the imports.

imports_to_add = """import { TemplateEditorLayout, PreviewMode } from '@/components/layouts/TemplateEditorLayout';"""

if "TemplateEditorLayout" not in content:
    content = content.replace("import { ChevronDown, Download, RotateCcw } from 'lucide-react';", "import { ChevronDown, Download, RotateCcw } from 'lucide-react';\n" + imports_to_add)

# Change previewMode state
content = content.replace("useState<'template' | 'sheet' | 'three'>('template');", "useState<PreviewMode>('template');")
content = content.replace("const hiddenCls = isAdmin ? '' : 'hidden';", "")


start_idx = content.find("  return (\n    <div dir=\"rtl\" className=\"space-y-4\">")
end_idx = content.find("  );\n};\n\nconst ExportSingleButton")

if start_idx != -1 and end_idx != -1:
    new_return = """  return (
    <>
      <TemplateEditorLayout
        title="D001 — قالب ديناميكي"
        hasReferenceMode={true}
        referenceModeOn={refOn}
        onReferenceModeChange={v => set('referenceMode', v)}
        previewMode={previewMode}
        onPreviewModeChange={setPreviewMode}
        hasSheetPreview={showNestingPreview}
        has3DPreview={show3DPreview}
        showDimensions={showDimensions}
        onShowDimensionsChange={setShowDimensions}
        dimUnit={dimUnit}
        onDimUnitChange={setDimUnit}
        actionButtons={
          <>
            <Button variant="outline" size="sm" onClick={() => setPrintOpen(true)}>
              ملخص الطباعة
            </Button>
            <ExportSingleButton params={params} />
            <ExportSheetButton params={params} nesting={nesting} result={nestingResult} />
          </>
        }
        referenceModeMessage={
          `وضع المرجعية مفعّل: الأبعاد الافتراضية مقفلة للمعايرة (W=${D001_REFERENCE.width}، H=${D001_REFERENCE.height}، D=${D001_REFERENCE.depth}، Glue_Flap=${D001_REFERENCE.glueFlap}، Lid_Tongue=${D001_REFERENCE.lidTongue}، Dust_Flap=${D001_REFERENCE.dustFlap} مم).`
        }
        topPanels={null}
        previewArea={
          previewMode === 'template' ? (
            <div className="w-full h-full flex flex-col">
              <D001Preview params={params} fitContainer showDebug={false} showDimensions={showDimensions} dimUnit={dimUnit} />
            </div>
          ) : previewMode === 'sheet' ? (
            <D001SheetNestingPreview params={params} nesting={nesting} result={nestingResult} />
          ) : (
            <Box3DPreview
              boxType="D001"
              lidTongue={params.lidTongue}
              panelWidths={[params.width, params.depth, params.width, params.depth - 0.5]}
              panelHeights={params.height}
              glueFlapWidth={params.glueFlap}
              topFlapHeights={[
                faceCoords.topFlaps[0].h,
                faceCoords.topFlaps[1].h,
                faceCoords.topFlaps[2].h,
                faceCoords.topFlaps[3].h
              ]}
              bottomFlapHeights={[
                faceCoords.bottomFlaps[0].h,
                faceCoords.bottomFlaps[1].h,
                faceCoords.bottomFlaps[2].h,
                faceCoords.bottomFlaps[3].h
              ]}
              svgMarkup={geo.svg}
              svgWidth={geo.bbox.w}
              svgHeight={geo.bbox.h}
              faceCoords={faceCoords}
            />
          )
        }
        floatingSummary={
          <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md border border-brand-border rounded-xl p-4 shadow-lg flex items-center justify-around z-10 print:hidden">
            <div className="text-center">
              <div className="text-[11px] text-brand-muted mb-1 font-bold uppercase tracking-wider">إجمالي القطع</div>
              <div className="text-2xl font-bold text-brand-navy leading-none">
                {nestingResult.bestTotal} <span className="text-sm font-normal text-brand-muted">قطعة</span>
              </div>
            </div>
            <div className="w-px h-10 bg-brand-border hidden sm:block"></div>
            <div className="text-center hidden sm:block">
              <div className="text-[11px] text-brand-muted mb-1 font-bold uppercase tracking-wider">المستغل</div>
              <div className="text-xl font-bold text-brand-navy leading-none" dir="ltr">
                {toDisplay(distributionFootprint.w, dimUnit).toFixed(0)} × {toDisplay(distributionFootprint.h, dimUnit).toFixed(0)} <span className="text-sm font-normal text-brand-muted">{dimUnit}</span>
              </div>
            </div>
            <div className="w-px h-10 bg-brand-border"></div>
            <div className="text-center">
              <div className="text-[11px] text-brand-muted mb-1 font-bold uppercase tracking-wider">اتجاه التوزيع الأفضل</div>
              <div className="text-lg font-bold text-brand-navy leading-none mt-1">
                {nestingResult.bestOrientation === 'normal' ? 'بدون تدوير' : 'مدوّر 90°'}
              </div>
            </div>
          </div>
        }
        sidebarArea={
          <div className="space-y-6">
            <section>
              <h3 className="text-sm font-bold mb-3 text-brand-navy border-b border-brand-border pb-2">أبعاد القالب الأساسية</h3>
              <div className="grid grid-cols-3 gap-2">
                <NumField label="العرض" value={params.width} disabled={refOn} unit={dimUnit}
                  onChange={v => set('width', v)} />
                <NumField label="الارتفاع" value={params.height} disabled={refOn} unit={dimUnit}
                  onChange={v => set('height', v)} />
                <NumField label="العمق" value={params.depth} disabled={refOn} unit={dimUnit}
                  onChange={v => set('depth', v)} />
              </div>
            </section>

            <section>
              <h3 className="text-sm font-bold mb-3 text-brand-navy border-b border-brand-border pb-2 mt-4">تخصيص متقدم</h3>
              <div className="grid grid-cols-3 gap-2">
                <NumField label="لسان اللصق" value={params.glueFlap} disabled={refOn} unit={dimUnit}
                  onChange={v => set('glueFlap', v)} />
                <NumField label="لسان الغطاء" value={params.lidTongue} disabled={refOn} unit={dimUnit}
                  onChange={v => set('lidTongue', v)} />
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">ارتفاع لسان العمق</Label>
                    <button type="button" disabled={refOn}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                      title="إعادة ضبط"
                      onClick={() => {
                        tongueTotalTouched.current = false;
                        set('depthTongueTotalHeight', autoDepthTongueTotalHeight(params.depthTongue, params.depth));
                      }}>
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>
                  <Input type="number" step="0.01"
                    value={toDisplay(params.depthTongueTotalHeight ?? autoDepthTongueTotalHeight(params.depthTongue, params.depth), dimUnit)}
                    disabled={refOn}
                    onChange={e => {
                      tongueTotalTouched.current = true;
                      set('depthTongueTotalHeight', toMm(num(e.target.value, toDisplay(params.depthTongueTotalHeight ?? autoDepthTongueTotalHeight(params.depthTongue, params.depth), dimUnit)), dimUnit));
                    }} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div>
                  <Label className="text-xs">زاوية لسان اللصق</Label>
                  <div className="grid grid-cols-2 gap-1">
                    <Input type="number" step="0.1" min="0" max="89"
                      placeholder="علوي"
                      value={params.glueFlapTopAngle ?? 25} disabled={refOn}
                      onChange={e => set('glueFlapTopAngle', num(e.target.value, 25))} />
                    <Input type="number" step="0.1" min="0" max="89"
                      placeholder="سفلي"
                      value={params.glueFlapBottomAngle ?? 25} disabled={refOn}
                      onChange={e => set('glueFlapBottomAngle', num(e.target.value, 25))} />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                    <span>علوي</span><span>سفلي</span>
                  </div>
                </div>
                <NumField label="زاوية لسان العمق" value={params.depthTongueCornerRadius ?? 0}
                  disabled={refOn} step="0.1" min="0" unit={dimUnit}
                  onChange={v => set('depthTongueCornerRadius', v)} />
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">القفل</Label>
                    <button type="button" disabled={refOn}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                      title={`إعادة ضبط إلى ${toDisplay(defaultDepthTongueForWidth(params.width), dimUnit)}${dimUnit}`}
                      onClick={() => {
                        depthTongueTouched.current = false;
                        set('depthTongue', defaultDepthTongueForWidth(params.width));
                      }}>
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>
                  <Input type="number" step="0.01" value={toDisplay(params.depthTongue, dimUnit)}
                    disabled={refOn}
                    onChange={e => {
                      depthTongueTouched.current = true;
                      set('depthTongue', toMm(num(e.target.value, toDisplay(params.depthTongue, dimUnit)), dimUnit));
                    }} />
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-bold mb-3 text-brand-navy border-b border-brand-border pb-2 mt-4">إعدادات التعشيق الذكي (Smart Auto)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between h-8">
                    <Label className="text-xs">التعشيق التلقائي</Label>
                    <Switch id="d001-smart" checked={!!nesting.smartAuto} onCheckedChange={v => setN('smartAuto', v)} />
                  </div>
                  <div className="text-[10px] text-muted-foreground leading-tight">
                    {nesting.smartAuto ? 'يحسب Pitch و Interlock تلقائياً' : 'يدوي (Interlock من المستخدم)'}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between h-8">
                    <Label className="text-xs">السماح بالدوران</Label>
                    <Switch id="d001-allow-rot" checked={nesting.allowRotation} onCheckedChange={v => setN('allowRotation', v)} />
                  </div>
                  <div className="text-[10px] text-muted-foreground leading-tight">
                    {nesting.allowRotation ? 'مسموح' : 'غير مسموح'}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <NumField label="التداخل الأفقي" value={nesting.horizontalInterlock} step="0.1" min="0" unit={dimUnit}
                  disabled={!!nesting.smartAuto}
                  onChange={v => setN('horizontalInterlock', v)} />
                <NumField label="التداخل العمودي" value={nesting.verticalInterlock} step="0.1" min="0" unit={dimUnit}
                  disabled={!!nesting.smartAuto}
                  onChange={v => setN('verticalInterlock', v)} />
              </div>
              <div className="mt-2">
                <Label className="text-xs mb-1 block">وضع الدوران (Rotation Mode)</Label>
                <select
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
                  disabled={!nesting.allowRotation}
                  value={nesting.rotationMode}
                  onChange={e => setN('rotationMode', e.target.value as RotationMode)}
                >
                  <option value="normal">بدون تدوير (Normal)</option>
                  <option value="rotated">مدوّر 90° (Rotated)</option>
                  <option value="auto">تلقائي (Auto)</option>
                </select>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-bold mb-3 text-brand-navy border-b border-brand-border pb-2 mt-4">{"إعدادات الشيت"}</h3>
              <div className="grid grid-cols-3 gap-2">
                <NumField label="عرض الشيت" value={params.sheetWidth} unit={dimUnit}
                  onChange={v => set('sheetWidth', v)} />
                <NumField label="ارتفاع الشيت" value={params.sheetHeight} unit={dimUnit}
                  onChange={v => set('sheetHeight', v)} />
                <NumField label="القابض" value={params.gripper} unit={dimUnit}
                  onChange={v => set('gripper', v)} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <NumField label="الهامش" value={params.sheetMargin} unit={dimUnit}
                  onChange={v => set('sheetMargin', v)} />
                <NumField label="التباعد الأفقي" value={nesting.horizontalGap} step="0.1" min="0" unit={dimUnit}
                  onChange={v => setN('horizontalGap', v)} />
                <NumField label="التباعد العمودي" value={nesting.verticalGap} step="0.1" min="0" unit={dimUnit}
                  onChange={v => setN('verticalGap', v)} />
              </div>
              <div className="mt-3 text-[11px] text-muted-foreground bg-muted/20 p-2 rounded border border-brand-border/50 text-center">
                الصافي: <span dir="ltr" className="font-mono">{usable.width.toFixed(2)} × {usable.height.toFixed(2)} mm</span>
              </div>
            </section>
          </div>
        }
      />

      <D001PrintSummary
        open={printOpen}
        onOpenChange={setPrintOpen}
        params={params}
        nesting={nesting}
        nestingResult={nestingResult}
        dimUnit={dimUnit}
        distributionFootprint={distributionFootprint}
        derived={derived}
      />
    </>"""
    
    content = content[:start_idx] + new_return + content[end_idx:]

with open('src/components/boxes/D001Calculator.tsx', 'w') as f:
    f.write(content)

