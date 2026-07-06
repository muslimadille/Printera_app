import xml.etree.ElementTree as ET

tree = ET.parse('/Users/mslmadl/Downloads/t00010.svg')
root = tree.getroot()

def pt_to_mm(pt):
    return pt / 2.834645

W_base = 329.40137
Y_base = 1164.20471

for elem in root.iter():
    tag = elem.tag.split('}')[-1]
    if tag == 'line':
        x1 = pt_to_mm(float(elem.attrib['x1']) - W_base)
        y1 = pt_to_mm(float(elem.attrib['y1']) - Y_base)
        x2 = pt_to_mm(float(elem.attrib['x2']) - W_base)
        y2 = pt_to_mm(float(elem.attrib['y2']) - Y_base)
        color = elem.attrib.get('stroke', 'none')
        print(f"LINE {color}: ({x1:.1f}, {y1:.1f}) -> ({x2:.1f}, {y2:.1f})")
    elif tag == 'polyline':
        points = elem.attrib['points'].replace(',', ' ').split()
        pts = [(pt_to_mm(float(points[i]) - W_base), pt_to_mm(float(points[i+1]) - Y_base)) for i in range(0, len(points), 2)]
        color = elem.attrib.get('stroke', 'none')
        pts_str = " -> ".join([f"({x:.1f}, {y:.1f})" for x,y in pts])
        print(f"POLY {color}: {pts_str}")
