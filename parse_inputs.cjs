const xlsx = require('xlsx');

const filePath = '/Users/mslmadl/Documents/Print logic/newbox/BOX1_Dynamic_Geometry_Blueprint_V4_Full_Dynamic_CDEF_HLines.xlsx';
const workbook = xlsx.readFile(filePath);

const worksheet = workbook.Sheets['Inputs'];
const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
for (let i = 0; i < data.length; i++) {
    console.log(data[i].join('\t'));
}
