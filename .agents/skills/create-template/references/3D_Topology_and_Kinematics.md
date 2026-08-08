# 3D Topology & Kinematics Reference Guide

This document details the mathematical rules for generating 3D box models, face coordinate mappings (`faceCoords`), interior hole subtraction, and panel rotation kinematics for the web 3D renderer (`Box3DPreview.tsx`).

---

## 1. 3D Face Coordinate Mapping Structure (`faceCoords`)

Every 3D box component relies on a `faceCoords` object passed to `Box3DPreview`. The object defines the 2D bounding polygons and 3D folding hinges for each panel:

```typescript
export interface FaceCoords {
  body: Array<{
    id: string;
    w: number;
    h: number;
    x: number;
    y: number;
    polygon?: Array<[number, number]>;
    holes?: Array<Array<[number, number]>>;
  }>;
  topFlaps: Array<{
    id: string;
    w: number;
    h: number;
    x: number;
    y: number;
    polygon?: Array<[number, number]>;
    holes?: Array<Array<[number, number]>>;
  }>;
  bottomFlaps: Array<{
    id: string;
    w: number;
    h: number;
    x: number;
    y: number;
    polygon?: Array<[number, number]>;
    holes?: Array<Array<[number, number]>>;
  }>;
  glue?: {
    w: number;
    h: number;
    x: number;
    y: number;
    polygon?: Array<[number, number]>;
  };
}
```

---

## 2. Strict Rules for `polygon` Arrays (Preventing Three.js Crashes)

Three.js uses the **Earcut** library to triangulate 2D polygons into 3D meshes. Incorrect polygon data will cause `Earcut` to fail or produce distorted 3D meshes.

### Rule 1: No Duplicate Adjacent Vertices
NEVER include the same point twice consecutively:
- ❌ **WRONG**: `[[10, 20], [10, 20], [50, 20], ...]`
- ✅ **CORRECT**: `[[10, 20], [50, 20], ...]`

### Rule 2: Winding Order (Counter-Clockwise)
Outer polygon points must be ordered **Counter-Clockwise (CCW)** in 2D millimeter space so that 3D normals point outward towards the camera.

### Rule 3: Flap Cover + Tongue Split Mechanics
For flaps consisting of a cover panel plus a tuck tongue (e.g., straight tuck top):
- Define the `polygon` array to span the **full length** (cover + tongue).
- `Box3DPreview` will automatically slice the mesh along the tuck crease line so the cover panel remains rigid while the tuck tongue rotates independently at $90^\circ$ fold angle.

---

## 4. Interior Cutouts & Holes (`holes`)

Interior openings (such as thumb notches, handle cutouts, or locking slots) are subtracted from the panel mesh using `ShapeGeometry.holes`:
- Each hole is an array of 2D points: `[[x1, y1], [x2, y2], ...]`.
- Points inside a `holes` loop must be ordered **Clockwise (CW)** (opposite of outer polygon).

---

## 5. Panel Unfold & Folding Kinematics

1. **Front Panel (Main Anchor)**: Fixed at origin $(0, 0, 0)$.
2. **Side Panel 1 (Left)**: Rotates $-90^\circ$ along fold crease line $X = X_1$.
3. **Side Panel 2 (Right)**: Rotates $+90^\circ$ along fold crease line $X = X_3$.
4. **Back Panel**: Rotates $+90^\circ$ relative to Side Panel 2 along fold crease line $X = X_4$.
5. **Top Cover Lid**: Rotates $-90^\circ$ relative to Front panel along top crease line $Y = Y_1$.
6. **Top Tuck Tongue**: Rotates $-90^\circ$ relative to Top Cover Lid along crease line $Y = Y_{\text{tuck}}$.
7. **Crash Lock Bottom Flaps**: Flap 1 and Flap 3 fold inward at $90^\circ$, while their 45° crease line allows the crash lock structure to fold flat automatically.
