import xml.etree.ElementTree as ET
import sys
import re

def parse_svg(filepath):
    tree = ET.parse(filepath)
    root = tree.getroot()
    ns = {'svg': 'http://www.w3.org/2000/svg'}
    
    # 1 mm = 2.834645 pt
    pt_to_mm = 2.834645
    
    print("--- LINES ---")
    for line in root.findall('.//svg:line', ns):
        x1 = float(line.get('x1', 0)) / pt_to_mm
        y1 = float(line.get('y1', 0)) / pt_to_mm
        x2 = float(line.get('x2', 0)) / pt_to_mm
        y2 = float(line.get('y2', 0)) / pt_to_mm
        stroke = line.get('stroke', 'none')
        print(f"LINE: ({x1:.3f}, {y1:.3f}) -> ({x2:.3f}, {y2:.3f}) color={stroke}")
        
    print("\n--- POLYLINES ---")
    for polyline in root.findall('.//svg:polyline', ns):
        points_str = polyline.get('points', '')
        stroke = polyline.get('stroke', 'none')
        # parse coordinates
        coords = [float(c) / pt_to_mm for c in re.split(r'[, \s]+', points_str.strip()) if c]
        pts = [(coords[i], coords[i+1]) for i in range(0, len(coords), 2)]
        pts_str = " -> ".join([f"({x:.3f}, {y:.3f})" for x, y in pts])
        print(f"POLYLINE color={stroke}:\n  {pts_str}")
        
    print("\n--- PATHS ---")
    for path in root.findall('.//svg:path', ns):
        d = path.get('d', '')
        stroke = path.get('stroke', 'none')
        print(f"PATH color={stroke}:\n  {d}")

if __name__ == '__main__':
    parse_svg(sys.argv[1])

