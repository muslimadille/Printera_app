const fs = require('fs');

let content = fs.readFileSync('src/lib/t00012/geometry.ts', 'utf8');

const replacement = `  const faceCoords: T00012FaceCoords = {
    lidTuck: { x: shiftX + Left, y: shiftY + baseY - 20, w: L, h: 20 },
    lid: { x: shiftX + Left, y: shiftY + baseY, w: L, h: W },
    back: { x: shiftX + Left, y: shiftY + baseY + W, w: L, h: H },
    bottom: { x: shiftX + Left, y: shiftY + baseY + W + H, w: L, h: W },
    front: { x: shiftX + Left, y: shiftY + baseY + 2*W + H, w: L, h: H },
    
    // Left side panels (roll ends) attached to Base
    leftWallOuter: { x: shiftX + Left - H, y: shiftY + baseY + W + H, w: H, h: W },
    leftWallInner: { x: shiftX + Left - 2*H, y: shiftY + baseY + W + H, w: H, h: W },
    
    // Right side panels (roll ends) attached to Base
    rightWallOuter: { x: shiftX + Right, y: shiftY + baseY + W + H, w: H, h: W },
    rightWallInner: { x: shiftX + Right + H, y: shiftY + baseY + W + H, w: H, h: W },
    
    // Dust flaps attached to Back panel
    backDustLeft: { x: shiftX + Left - H, y: shiftY + baseY + W, w: H, h: H },
    backDustRight: { x: shiftX + Right, y: shiftY + baseY + W, w: H, h: H },
    
    // Dust flaps attached to Front panel
    frontDustLeft: { x: shiftX + Left - H, y: shiftY + baseY + 2*W + H, w: H, h: H },
    frontDustRight: { x: shiftX + Right, y: shiftY + baseY + 2*W + H, w: H, h: H },
  };`;

content = content.replace(/const faceCoords: T00012FaceCoords = {[\s\S]*?body: \[[\s\S]*?\]\n  };/, replacement);
fs.writeFileSync('src/lib/t00012/geometry.ts', content);
