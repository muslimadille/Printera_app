import xml.etree.ElementTree as ET

tree = ET.parse('/Users/mslmadl/Documents/Print logic/newbox/BOX 1 TEMPLATE.svg')
root = tree.getroot()

def parse_line(el):
    return {
        'type': 'line',
        'id': el.get('id', ''),
        'x1': float(el.get('x1')),
        'y1': float(el.get('y1')),
        'x2': float(el.get('x2')),
        'y2': float(el.get('y2')),
        'stroke': el.get('stroke')
    }

def parse_path(el):
    return {
        'type': 'path',
        'id': el.get('id', ''),
        'd': el.get('d'),
        'stroke': el.get('stroke')
    }

elements = []
for el in root.iter():
    if el.tag.endswith('line'):
        try:
            elements.append(parse_line(el))
        except: pass
    elif el.tag.endswith('path'):
        try:
            elements.append(parse_path(el))
        except: pass

creases = [e for e in elements if e['stroke'] == '#00a651']
cuts = [e for e in elements if e['stroke'] == '#ed1c24']

print(f"Total creases: {len(creases)}")
for c in creases:
    if c['type'] == 'line':
        print(f"CREASE: ({c['x1']}, {c['y1']}) -> ({c['x2']}, {c['y2']})")

print(f"Total cuts: {len(cuts)}")
for c in cuts:
    if c['type'] == 'line':
        print(f"CUT: ({c['x1']}, {c['y1']}) -> ({c['x2']}, {c['y2']})")
    else:
        print(f"CUT PATH: {c['d']}")
