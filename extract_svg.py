import xml.etree.ElementTree as ET

tree = ET.parse('/Users/mslmadl/Downloads/TEMPLATE.svg')
root = tree.getroot()

def p(x,y): return (round(float(x),2), round(float(y),2))

for elem in root:
    if 'stroke' not in elem.attrib: continue
    color = elem.attrib['stroke'].lower()
    kind = 'CREASE' if color == '#00a651' else 'CUT'
    
    if elem.tag.endswith('line') and not elem.tag.endswith('polyline'):
        print(f"segments.push({kind}(id++, P({p(elem.attrib['x1'], elem.attrib['y1'])}), P({p(elem.attrib['x2'], elem.attrib['y2'])})));")
    elif elem.tag.endswith('polyline'):
        pts = [p(*pt.split(',')) if ',' in pt else pt for pt in elem.attrib['points'].strip().split()]
        if len(pts) > 0 and isinstance(pts[0], str):
             # some svgs use spaces between x and y
             pairs = []
             for i in range(0, len(pts), 2):
                 pairs.append(p(pts[i], pts[i+1]))
             pts = pairs
        pt_strs = [f"P({x}, {y})" for x,y in pts]
        print(f"segments.push({kind}Poly(id++, [{', '.join(pt_strs)}]));")
    elif elem.tag.endswith('path'):
        print(f"// path: {elem.attrib['d']} ({kind})")

