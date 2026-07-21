import os
import re

files = [
    'src/components/boxes/T0002Calculator.tsx',
    'src/components/boxes/T0005Calculator.tsx',
    'src/components/boxes/T0006Calculator.tsx',
    'src/components/boxes/T00012Calculator.tsx'
]

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Identify the start of the return block
    return_idx = content.find('  return (\n')
    if return_idx == -1:
        print(f"Could not find return in {file}")
        continue
    
    # Try finding the top panels based on Card components before the main Sheet preview Card
    sheet_preview_idx = content.find('{/* Sheet preview + side input panel */}')
    top_panels = ""
    if sheet_preview_idx != -1:
        first_card_end = content.find('</Card>', return_idx)
        if first_card_end != -1 and first_card_end < sheet_preview_idx:
            top_panels = content[first_card_end + 7:sheet_preview_idx].strip()
            
    # Extract previewArea
    preview_match = re.search(r'<div className="min-w-0">(.*?)</div>\s*<aside', content, re.DOTALL)
    if not preview_match:
        print(f"Could not find preview area in {file}")
        continue
    preview_area = preview_match.group(1).strip()
    
    # Extract sidebarArea
    aside_match = re.search(r'<aside[^>]*>(.*?)</aside>', content, re.DOTALL)
    if not aside_match:
        print(f"Could not find sidebar aside in {file}")
        continue
    sidebar_area = aside_match.group(1).strip()
    
    # Find PrintSummary inside the return block
    summary_match = re.search(r'(<T000\w+PrintSummary.*?(?:/>|</T000\w+PrintSummary>))', content, re.DOTALL)
    summary_code = summary_match.group(1) if summary_match else ""

    box_id = file.split('/')[-1].replace('Calculator.tsx', '')
    title_match = re.search(r'<CardTitle className="text-lg">([^<]+)</CardTitle>', content)
    title = title_match.group(1) if title_match else f"{box_id} — Template"

    # Find the end of the Calculator component, which is '  );\n};' or '  );\n}'
    end_idx = content.find('  );\n};\n', return_idx)
    if end_idx == -1:
        end_idx = content.find('  );\n}\n', return_idx)
        
    if end_idx == -1:
        print(f"Could not find end of component in {file}")
        continue

    # Construct the new return block
    top_panels_prop = f"\n        topPanels={{\n          <>\n            {top_panels}\n          </>\n        }}" if top_panels else ""
    
    # For actionButtons, try to see if they exist in the file:
    has_export_single = 'ExportSingleButton' in content
    has_export_sheet = 'ExportSheetButton' in content
    
    action_btns = """<Button variant="outline" size="sm" onClick={() => setPrintOpen(true)}>
              ملخص الطباعة
            </Button>"""
    if has_export_single:
        action_btns += "\n            <ExportSingleButton params={params} geo={geo} />"
    if has_export_sheet:
        action_btns += "\n            <ExportSheetButton params={params} nesting={nesting} result={nestingResult} />"
    
    new_return = f"""  return (
    <>
      <TemplateEditorLayout
        title="{title}"
        hasReferenceMode={{true}}
        referenceModeOn={{refOn}}
        onReferenceModeChange={{v => set('referenceMode', v)}}
        previewMode={{previewMode}}
        onPreviewModeChange={{setPreviewMode}}
        hasSheetPreview={{showNestingPreview}}
        has3DPreview={{show3DPreview}}
        showDimensions={{showDimensions}}
        onShowDimensionsChange={{setShowDimensions}}
        dimUnit={{dimUnit}}
        onDimUnitChange={{setDimUnit}}{top_panels_prop}
        actionButtons={{
          <>
            {action_btns}
          </>
        }}
        previewArea={{
          <>
            {preview_area}
          </>
        }}
        sidebarArea={{
          <>
            {sidebar_area}
          </>
        }}
      />

      {summary_code}
    </>"""
    
    content = content[:return_idx] + new_return + content[end_idx:]
    
    if "import { TemplateEditorLayout" not in content:
        import_stmt = "import { TemplateEditorLayout, PreviewMode } from '@/components/layouts/TemplateEditorLayout';\n"
        content = import_stmt + content
        
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Fixed {file}")

