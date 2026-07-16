import os
import re

calc_dir = 'src/components/boxes'
calc_dir2 = 'src/components'

files_to_check = []
for d in [calc_dir, calc_dir2]:
    if os.path.exists(d):
        for f in os.listdir(d):
            if f.endswith('.tsx') and 'Calculator' in f:
                files_to_check.append(os.path.join(d, f))

modified_count = 0

for file_path in files_to_check:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    needs_nesting = 'معاينة التوزيع' in content or 'sheet' in content.lower()
    needs_3d = 'معاينة ثلاثية الأبعاد' in content or '3d' in content.lower()
    
    if not (needs_nesting or needs_3d):
        continue
        
    if 'usePreviewSettings' in content:
        continue
        
    import_statement = "import { usePreviewSettings } from '@/hooks/usePreviewSettings';\n"
    last_import_idx = content.rfind('\nimport ')
    if last_import_idx != -1:
        end_of_line = content.find('\n', last_import_idx + 1)
        content = content[:end_of_line+1] + import_statement + content[end_of_line+1:]
    else:
        content = import_statement + content

    hook_call = "\n  const { showNestingPreview, show3DPreview } = usePreviewSettings();\n"
    
    # Let's find all components and inject into the one that has the buttons or SheetPreview
    # Or just inject into ALL components in the file. It's safe if unused (TS might complain about unused vars, but we can prefix with `// @ts-ignore` or just use it).
    # Even better: inject it just before the return statement of the component that contains setPreviewMode or SheetPreview.
    
    # Let's find the main calculator component. It usually has "Calculator" in its name.
    # e.g., `const BoxDieCutCalculator = ({` or `const D001Calculator = ({`
    
    component_match = re.search(r'(const \w*Calculator = \(.*?\) =>\s*\{)', content)
    if component_match:
        insert_pos = component_match.end()
        content = content[:insert_pos] + hook_call + content[insert_pos:]
    else:
        # Fallback to default export function
        component_match = re.search(r'(export default function \w*Calculator\(.*?\)\s*\{)', content)
        if component_match:
            insert_pos = component_match.end()
            content = content[:insert_pos] + hook_call + content[insert_pos:]
        else:
            # Fallback to any Calculator named const
            component_match = re.search(r'(const \w*Calculator = \(.*?\) =>\s*\{)', content)
            if component_match:
                insert_pos = component_match.end()
                content = content[:insert_pos] + hook_call + content[insert_pos:]
            else:
                # If still nothing, just grab the last component in the file
                matches = list(re.finditer(r'(const [A-Z]\w* = \(.*?\) =>\s*\{)', content))
                if matches:
                    insert_pos = matches[-1].end()
                    content = content[:insert_pos] + hook_call + content[insert_pos:]
        
    # 1. 3D button
    content = re.sub(
        r'(<button[^>]*onClick={\(\) => setPreviewMode\(\'three\'\)}[^>]*>.*?معاينة ثلاثية الأبعاد 3D\s*</button>)',
        r'{show3DPreview && (\1)}',
        content,
        flags=re.DOTALL
    )
    
    # 2. Nesting tab button
    content = re.sub(
        r'(<button[^>]*onClick={\(\) => setPreviewMode\(\'sheet\'\)}[^>]*>.*?معاينة التوزيع على الشيت\s*</button>)',
        r'{showNestingPreview && (\1)}',
        content,
        flags=re.DOTALL
    )
    
    # 3. SheetPreview / SectionHeader
    content = re.sub(
        r'(<SheetPreview\b[^>]*/>)',
        r'{showNestingPreview && \1}',
        content
    )
    content = re.sub(
        r'(<SectionHeader[^>]*title="معاينة التوزيع[^"]*"[^>]*/>)',
        r'{showNestingPreview && \1}',
        content
    )

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    modified_count += 1

print(f"Total files updated: {modified_count}")
