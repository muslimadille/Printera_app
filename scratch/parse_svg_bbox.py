import xml.etree.ElementTree as ET
import sys
import re

def parse_svg(filepath):
    tree = ET.parse(filepath)
    root = tree.getroot()
    ns = {'svg': 'http://www.w3.org/2000/svg'}
    
    min_x, min_y, max_x, max_y = float('inf'), float('inf'), float('-inf'), float('-inf')
    
    for line in root.findall('.//svg:line', ns):
        for k in ['x1', 'x2']:
            x = float(line.get(k, 0))
            if x < min_x: min_x = x
            if x > max_x: max_x = x
        for k in ['y1', 'y2']:
            y = float(line.get(k, 0))
            if y < min_y: min_y = y
            if y > max_y: max_y = y
            
    for path in root.findall('.//svg:path', ns):
        d = path.get('d', '')
        nums = [float(n) for n in re.findall(r'-?\d+\.?\d*', d)]
        for i in range(0, len(nums), 2):
            if i+1 < len(nums):
                x, y = nums[i], nums[i+1]
                if x < min_x: min_x = x
                if x > max_x: max_x = x
                if y < min_y: min_y = y
                if y > max_y: max_y = y
                
    print(f"BBOX: X({min_x:.2f} -> {max_x:.2f}), Y({min_y:.2f} -> {max_y:.2f})")
    print(f"WIDTH: {max_x - min_x:.2f}, HEIGHT: {max_y - min_y:.2f}")

if __name__ == '__main__':
    parse_svg(sys.argv[1])
