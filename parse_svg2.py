import xml.etree.ElementTree as ET

tree = ET.parse('/Users/mslmadl/Documents/Print logic/newbox/BOX 1 TEMPLATE.svg')
root = tree.getroot()

def get_coords(el):
    if el.tag.endswith('line'):
        return { 'type': 'line', 'x1': float(el.get('x1')), 'y1': float(el.get('y1')), 'x2': float(el.get('x2')), 'y2': float(el.get('y2')), 'stroke': el.get('stroke') }
    elif el.tag.endswith('path'):
        return { 'type': 'path', 'd': el.get('d'), 'stroke': el.get('stroke') }
    return None

lines = []
for el in root.iter():
    c = get_coords(el)
    if c: lines.append(c)

baseX = 186.66919
baseY = 738.00787

print("Coordinates relative to Base (0,0):")
for l in lines:
    if l['type'] == 'line':
        x1, y1 = l['x1'] - baseX, l['y1'] - baseY
        x2, y2 = l['x2'] - baseX, l['y2'] - baseY
        kind = 'CREASE' if l['stroke'] == '#00a651' else 'CUT'
        print(f"{kind}: ({x1:.1f}, {y1:.1f}) -> ({x2:.1f}, {y2:.1f})")
