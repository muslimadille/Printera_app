const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = '/Users/mslmadl/Documents/Print logic/newbox/BOX1_Dynamic_Geometry_Blueprint_V4_Full_Dynamic_CDEF_HLines.xlsx';
const workbook = xlsx.readFile(filePath);

const sheetNames = workbook.SheetNames;
console.log("Sheets:", sheetNames);

for (const sheetName of sheetNames) {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Print first 30 rows
    for (let i = 0; i < Math.min(30, data.length); i++) {
        console.log(data[i].join('\t'));
    }
}
