import xml.etree.ElementTree as ET

tree = ET.parse('/Users/mslmadl/Downloads/t00010.svg')
root = tree.getroot()
ns = {'svg': 'http://www.w3.org/2000/svg'}

print("Lines:")
for el in root.findall('.//svg:line', ns) + root.findall('.//line'):
    print(f"[{el.attrib.get('stroke', 'none')}] Line ({el.attrib.get('x1')}, {el.attrib.get('y1')}) to ({el.attrib.get('x2')}, {el.attrib.get('y2')})")

print("\nPolylines:")
for el in root.findall('.//svg:polyline', ns) + root.findall('.//polyline'):
    print(f"[{el.attrib.get('stroke', 'none')}] Polyline: {el.attrib.get('points')}")

print("\nPaths:")
for el in root.findall('.//svg:path', ns) + root.findall('.//path'):
    print(f"[{el.attrib.get('stroke', 'none')}] Path: {el.attrib.get('d')}")
