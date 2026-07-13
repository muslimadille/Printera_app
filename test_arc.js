const earX = 10;
const yLidTop = 100;
const T = 20;
const tuckRadius = 10;
const shiftX = 0;
const shiftY = 0;

const startX = earX + shiftX;
const startY = yLidTop - T + tuckRadius + shiftY;
const endX = earX + tuckRadius + shiftX;
const endY = yLidTop - T + shiftY;

const d = `M ${startX},${startY} A ${tuckRadius},${tuckRadius} 0 0,1 ${endX},${endY}`;
console.log("Left Arc path:", d);
