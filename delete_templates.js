const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

// 1. Delete directories
const dirsToDelete = [
  'lib/t0001',
  'lib/t0003',
  'lib/t0004',
  'lib/d003',
  'lib/t0007',
  'lib/t0009',
  'lib/a01010000',
  'lib/a01700000',
  'lib/genericBox'
];

dirsToDelete.forEach(d => {
  const p = path.join(srcDir, d);
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
    console.log(`Deleted ${p}`);
  }
});

// 2. Delete components
const filesToDelete = [
  'components/boxes/T0001Calculator.tsx',
  'components/boxes/T0001PrintSummary.tsx',
  'components/boxes/T0001SheetNestingPreview.tsx',
  'components/boxes/T0003Calculator.tsx',
  'components/boxes/T0003PrintSummary.tsx',
  'components/boxes/T0003SheetNestingPreview.tsx',
  'components/boxes/T0004Calculator.tsx',
  'components/boxes/T0004PrintSummary.tsx',
  'components/boxes/T0004SheetNestingPreview.tsx',
  'components/boxes/D003Calculator.tsx',
  'components/boxes/D003PrintSummary.tsx',
  'components/boxes/D003SheetNestingPreview.tsx',
  'components/boxes/T0007Calculator.tsx',
  'components/boxes/T0007PrintSummary.tsx',
  'components/boxes/T0007SheetNestingPreview.tsx',
  'components/boxes/T0009Calculator.tsx',
  'components/boxes/A01010000Calculator.tsx',
  'components/boxes/A01700000Calculator.tsx',
  'components/boxes/GenericBoxCalculator.tsx'
];

filesToDelete.forEach(f => {
  const p = path.join(srcDir, f);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log(`Deleted ${p}`);
  }
});

// 3. Update tabRegistry.ts
const tabRegistryPath = path.join(srcDir, 'lib/tabRegistry.ts');
let tabRegistryContent = fs.readFileSync(tabRegistryPath, 'utf8');

const keysToRemove = [
  "'box_t0001'", "'box_t0003'", "'box_t0004'", "'box_d003'", "'box_t0007'", "'box_t0009'", "'box_a01010000'", "'box_a01700000'", "'box_generic'"
];
keysToRemove.forEach(k => {
  tabRegistryContent = tabRegistryContent.replace(new RegExp(`${k},? ?`, 'g'), '');
});
tabRegistryContent = tabRegistryContent.replace(/\{ key: 'box_t0009', label: 'T0009' \},\n\s*/g, '');

fs.writeFileSync(tabRegistryPath, tabRegistryContent);
console.log('Updated tabRegistry.ts');

// 4. Update Box3DPreview.tsx
const box3DPath = path.join(srcDir, 'components/boxes/Box3DPreview.tsx');
let box3DContent = fs.readFileSync(box3DPath, 'utf8');

box3DContent = box3DContent.replace(
  /boxType\?: 'T0001' \| 'T0002' \| 'T0003' \| 'T0004' \| 'T0005' \| 'T0006' \| 'D001' \| 'D003' \| 'T0008' \| 'T0010';/,
  "boxType?: 'T0002' | 'T0005' | 'T0006' | 'D001' | 'T0008' | 'T0010';"
);
box3DContent = box3DContent.replace(
  /boxType !== 'T0003' && boxType !== 'T0005'/g,
  "boxType !== 'T0005'"
);
// T0003 side ears code block removing:
const t0003BlockRegex = /if \(boxType === 'T0003'\) \{[\s\S]*?\} else if \(splitTf3\) \{/;
box3DContent = box3DContent.replace(t0003BlockRegex, "if (splitTf3) {");

const t0003EarsRotRegex = /\/\/ T0003 Side Ears[\s\S]*?angle3;/;
box3DContent = box3DContent.replace(t0003EarsRotRegex, "");

fs.writeFileSync(box3DPath, box3DContent);
console.log('Updated Box3DPreview.tsx');

// 5. Update AppTabs.tsx
const appTabsPath = path.join(srcDir, 'components/AppTabs.tsx');
let appTabsContent = fs.readFileSync(appTabsPath, 'utf8');

const importsToRemove = [
  'D003Calculator', 'T0001Calculator', 'T0003Calculator', 'T0004Calculator', 
  'T0007Calculator', 'T0009Calculator', 'A01010000Calculator', 'A01700000Calculator', 'GenericBoxCalculator'
];
importsToRemove.forEach(imp => {
  const regex = new RegExp(`const ${imp} = lazy\\(\\(.*?\\n`, 'g');
  appTabsContent = appTabsContent.replace(regex, '');
});

const bSubKeysToRemove = [
  "'box_d003'", "'box_t0001'", "'box_t0003'", "'box_t0004'", "'box_t0007'", "'box_t0009'", "'box_a01010000'", "'box_a01700000'", "'box_generic'"
];
bSubKeysToRemove.forEach(k => {
  appTabsContent = appTabsContent.replace(new RegExp(` \\| ${k}`, 'g'), '');
});

const defaultBSubRegexs = [
  /: activeTab === 'box_d003' \? 'box_d003'\s*/g,
  /: activeTab === 'box_t0001' \? 'box_t0001'\s*/g,
  /: activeTab === 'box_t0003' \? 'box_t0003'\s*/g,
  /: activeTab === 'box_t0004' \? 'box_t0004'\s*/g,
  /: activeTab === 'box_t0007' \? 'box_t0007'\s*/g,
  /: activeTab === 'box_t0009' \? 'box_t0009'\s*/g,
  /: activeTab === 'box_a01010000' \? 'box_a01010000'\s*/g,
  /: activeTab === 'box_a01700000' \? 'box_a01700000'\s*/g,
  /: activeTab === 'box_generic' \? 'box_generic'\s*/g,
  /\|\| activeTab === 'box_d003' /g,
  /\|\| activeTab === 'box_t0001' /g,
  /\|\| activeTab === 'box_t0003' /g,
  /\|\| activeTab === 'box_t0004' /g,
  /\|\| activeTab === 'box_t0007' /g,
  /\|\| activeTab === 'box_t0009' /g,
  /\|\| activeTab === 'box_a01010000' /g,
  /\|\| activeTab === 'box_a01700000' /g,
  /\|\| activeTab === 'box_generic' /g,
];
defaultBSubRegexs.forEach(r => {
  appTabsContent = appTabsContent.replace(r, '');
});

const renderItemsToRemove = [
  "{ key: 'box_d003', label: 'D003' },\n",
  "{ key: 'box_t0001', label: 'T0001' },\n",
  "{ key: 'box_t0003', label: 'T0003' },\n",
  "{ key: 'box_t0004', label: 'T0004' },\n",
  "{ key: 'box_t0007', label: 'BOX 1' },\n",
  "{ key: 'box_t0009', label: 'T0009' },\n",
  "{ key: 'box_a01010000', label: 'A01.01' },\n",
  "{ key: 'box_a01700000', label: 'A01.70' },\n",
  "{ key: 'box_generic', label: 'Generic' },\n",
];
renderItemsToRemove.forEach(r => {
  appTabsContent = appTabsContent.replace(r, '');
});

const showsToRemove = [
  "const showBD003 = shouldRenderTab('box_d003');\n",
  "const showBT0001 = shouldRenderTab('box_t0001');\n",
  "const showBT0003 = shouldRenderTab('box_t0003');\n",
  "const showBT0004 = shouldRenderTab('box_t0004');\n",
  "const showBT0007 = shouldRenderTab('box_t0007');\n",
  "const showBT0009 = shouldRenderTab('box_t0009');\n",
  "const showBA01010000 = shouldRenderTab('box_a01010000');\n",
  "const showBA01700000 = shouldRenderTab('box_a01700000');\n",
  "const showBGeneric = shouldRenderTab('box_generic');\n",
];
showsToRemove.forEach(r => {
  appTabsContent = appTabsContent.replace(r, '');
});

const blocksToRemove = [
  /<div hidden=\{effectiveBSub !== 'box_d003'\}[\s\S]*?<\/div>\s*/,
  /<div hidden=\{effectiveBSub !== 'box_t0001'\}[\s\S]*?<\/div>\s*/,
  /<div hidden=\{effectiveBSub !== 'box_t0003'\}[\s\S]*?<\/div>\s*/,
  /<div hidden=\{effectiveBSub !== 'box_t0004'\}[\s\S]*?<\/div>\s*/,
  /<div hidden=\{effectiveBSub !== 'box_t0007'\}[\s\S]*?<\/div>\s*/,
  /<div hidden=\{effectiveBSub !== 'box_t0009'\}[\s\S]*?<\/div>\s*/,
  /<div hidden=\{effectiveBSub !== 'box_a01010000'\}[\s\S]*?<\/div>\s*/,
  /<div hidden=\{effectiveBSub !== 'box_a01700000'\}[\s\S]*?<\/div>\s*/,
  /<div hidden=\{effectiveBSub !== 'box_generic'\}[\s\S]*?<\/div>\s*/,
];
blocksToRemove.forEach(r => {
  appTabsContent = appTabsContent.replace(r, '');
});

fs.writeFileSync(appTabsPath, appTabsContent);
console.log('Updated AppTabs.tsx');

