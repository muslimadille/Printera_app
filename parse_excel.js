const xlsx = require('xlsx');
const fs = require('fs');

const workbook = xlsx.readFile('/Users/mslmadl/Documents/Print logic/design files/newbox/BOX1_Dynamic_Geometry_Blueprint_V4_Full_Dynamic_CDEF_HLines.xlsx');
const sheetNames = workbook.SheetNames;
let output = '';

sheetNames.forEach(name => {
  output += `\n--- Sheet: ${name} ---\n`;
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[name], { header: 1 });
  output += data.map(row => row.join('\t')).join('\n');
});

fs.writeFileSync('excel_dump.txt', output);
console.log('Parsed successfully to excel_dump.txt');
