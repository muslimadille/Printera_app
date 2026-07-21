const fs = require('fs');
const path = require('path');

const colorMap = {
  '#faf6f0': '#f8fafc',
  '#2b2013': '#1e293b',
  '#a9622f': '#3b82f6',
  '#e6dccb': '#e2e8f0',
  '#8a7d6d': '#64748b',
  '#c1461f': '#ef4444',
  '#d8cbb5': '#cbd5e1',
  '#c8bba5': '#94a3b8',
  '#eee2cf': '#e2e8f0',
  '#fdfaf5': '#f8fafc',
  '#f4ede1': '#f1f5f9',
  '#463a29': '#334155',
  '#9c8f7c': '#94a3b8',
  '#e8ded0': '#e2e8f0',
  '#f3ece0': '#f1f5f9'
};

function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(filePath));
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.css')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = walkDir(path.join(__dirname, 'src'));

let totalReplaced = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  for (const [oldColor, newColor] of Object.entries(colorMap)) {
    // Replace lowercase and uppercase hex
    const regex = new RegExp(oldColor, 'gi');
    content = content.replace(regex, newColor);
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    totalReplaced++;
    console.log(`Updated ${file}`);
  }
});

console.log(`Updated ${totalReplaced} files.`);
