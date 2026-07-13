const fs = require('fs');
const { JSDOM } = require('jsdom');

const svgContent = fs.readFileSync('./design files/newbox/BOX 1 TEMPLATE.svg', 'utf8');
const dom = new JSDOM(svgContent);
const doc = dom.window.document;

const result = {
  bbox: {},
  lines: [],
  paths: []
};

// get SVG dimensions
const svg = doc.querySelector('svg');
result.bbox = {
  width: svg.getAttribute('width'),
  height: svg.getAttribute('height'),
  viewBox: svg.getAttribute('viewBox')
};

// get all lines
const lines = doc.querySelectorAll('line');
lines.forEach(line => {
  let parent = line.parentElement;
  let kind = 'CUT';
  while (parent && parent.tagName !== 'svg') {
    if (parent.id === 'CREA' || parent.id === 'CREASE') kind = 'CREASE';
    if (parent.id === 'CUT') kind = 'CUT';
    parent = parent.parentElement;
  }
  
  result.lines.push({
    id: line.id || line.getAttribute('data-name'),
    kind,
    x1: parseFloat(line.getAttribute('x1')),
    y1: parseFloat(line.getAttribute('y1')),
    x2: parseFloat(line.getAttribute('x2')),
    y2: parseFloat(line.getAttribute('y2'))
  });
});

// get all paths
const paths = doc.querySelectorAll('path');
paths.forEach(path => {
  let parent = path.parentElement;
  let kind = 'CUT';
  while (parent && parent.tagName !== 'svg') {
    if (parent.id === 'CREA' || parent.id === 'CREASE') kind = 'CREASE';
    if (parent.id === 'CUT') kind = 'CUT';
    parent = parent.parentElement;
  }
  
  result.paths.push({
    id: path.id || path.getAttribute('data-name'),
    kind,
    d: path.getAttribute('d')
  });
});

fs.writeFileSync('box1_parsed.json', JSON.stringify(result, null, 2));
console.log('Parsed SVG to box1_parsed.json');
