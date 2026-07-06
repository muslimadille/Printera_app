import xml.etree.ElementTree as ET

tree = ET.parse('/Users/mslmadl/Downloads/t00010.svg')
root = tree.getroot()
ns = {'svg': 'http://www.w3.org/2000/svg'}

BASE_X = 329.40161
BASE_Y = 1164.20471
W = 992.126
H = 822.05
D = 283.464
HLID = 819.213
TONGUE = 59.527

def format_x(x):
    rx = x - BASE_X
    if abs(rx) < 1: return "0"
    if abs(rx - W) < 1: return "W"
    if abs(rx - W/2) < 1: return "W/2"
    if rx < 0:
        if abs(rx - (-D)) < 1: return "-D"
        return f"{rx:.1f}"
    else:
        if abs(rx - (W + D)) < 1: return "W+D"
        return f"W + {rx - W:.1f}"

def format_y(y):
    ry = y - BASE_Y
    if abs(ry) < 1: return "0"
    if abs(ry - H) < 1: return "H"
    if abs(ry - (-D)) < 1: return "-D"
    if abs(ry - (-D - HLID)) < 1: return "-D - H_lid"
    if abs(ry - (-D - HLID - TONGUE)) < 1: return "-D - H_lid - tongue"
    if abs(ry - (H + D)) < 1: return "H + D"
    if ry < 0:
        if ry > -D: return f"{ry:.1f}"
        if ry > -D - HLID: return f"-D - {abs(ry + D):.1f}"
        return f"-D - H_lid - {abs(ry + D + HLID):.1f}"
    else:
        if ry < H: return f"{ry:.1f}"
        return f"H + {ry - H:.1f}"

def process_point(pt):
    x, y = map(float, pt.split(',')) if ',' in pt else map(float, pt.split())
    return f"[{format_x(x)}, {format_y(y)}]"

for el in root.findall('.//svg:line', ns) + root.findall('.//line'):
    color = el.attrib.get('stroke', 'none')
    x1, y1 = float(el.attrib.get('x1')), float(el.attrib.get('y1'))
    x2, y2 = float(el.attrib.get('x2')), float(el.attrib.get('y2'))
    type_ = 'CREASE' if color == '#00a651' else 'CUT'
    print(f"Line {type_}: {format_x(x1)}, {format_y(y1)} -> {format_x(x2)}, {format_y(y2)}")

for el in root.findall('.//svg:polyline', ns) + root.findall('.//polyline'):
    color = el.attrib.get('stroke', 'none')
    pts = el.attrib.get('points').split()
    type_ = 'CREASE' if color == '#00a651' else 'CUT'
    parsed_pts = []
    for i in range(0, len(pts), 2):
        x, y = float(pts[i]), float(pts[i+1])
        parsed_pts.append(f"[{format_x(x)}, {format_y(y)}]")
    print(f"Polyline {type_}: " + " -> ".join(parsed_pts))

for el in root.findall('.//svg:path', ns) + root.findall('.//path'):
    color = el.attrib.get('stroke', 'none')
    type_ = 'CREASE' if color == '#00a651' else 'CUT'
    print(f"Path {type_}: {el.attrib.get('d')}")
