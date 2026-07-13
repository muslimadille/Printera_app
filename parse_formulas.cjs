const xlsx = require('xlsx');

const filePath = '/Users/mslmadl/Documents/Print logic/newbox/BOX1_Dynamic_Geometry_Blueprint_V4_Full_Dynamic_CDEF_HLines.xlsx';
const workbook = xlsx.readFile(filePath, { cellFormula: true });

const worksheet = workbook.Sheets['Dynamic_Points'];

console.log("Point_ID\tX_Formula\tY_Formula");

// Start from row 2
let row = 2;
while (worksheet['A' + row]) {
    const id = worksheet['A' + row].v;
    const xCell = worksheet['E' + row];
    const yCell = worksheet['G' + row];
    
    const xForm = xCell && xCell.f ? xCell.f : (xCell ? xCell.v : '');
    const yForm = yCell && yCell.f ? yCell.f : (yCell ? yCell.v : '');
    
    console.log(`${id}\t${xForm}\t${yForm}`);
    row++;
}
