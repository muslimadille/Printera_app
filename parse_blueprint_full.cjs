const xlsx = require('xlsx');

const filePath = '/Users/mslmadl/Documents/Print logic/newbox/BOX1_Dynamic_Geometry_Blueprint_V4_Full_Dynamic_CDEF_HLines.xlsx';
const workbook = xlsx.readFile(filePath);

const sheetNames = workbook.SheetNames;

for (const sheetName of sheetNames) {
    if (!['Dynamic_Points', 'Dynamic_Lines', 'Inputs', 'SVG_Line_Export'].includes(sheetName)) continue;
    
    console.log(`\n\n--- Sheet: ${sheetName} ---`);
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Print all rows (up to 200)
    for (let i = 0; i < Math.min(200, data.length); i++) {
        console.log(data[i].join('\t'));
    }
}
