---
name: create-packaging-template
description: Generates a complete production-ready packaging template (2D geometry, 3D topology, nesting, and UI calculator) from a screenshot and SVG dieline. Trigger this when the user asks to add a new template, e.g., "Add template T0005" or "Add template A60_20_01_01".
---

# Master Packaging Template Engineering Skill

This skill provides an end-to-end, zero-flaw engineering workflow to reverse-engineer and construct any parametric packaging box template (Folding Cartons ECMA, Corrugated Boxes FEFCO, Mailer Boxes, Crash-Lock Bottoms, Rigid Boxes, Sleeve Containers) from an SVG dieline file and/or a screenshot image.

It synthesizes deep industry standards, image vision analysis, vector SVG parsing, and computational geometry literature:
- *Fundamentals of Packaging Technology* & *Paperboard Packaging*
- *Structural Package Designs* & *Corrugated Packaging*
- *The Packaging Designer's Book of Patterns*
- *ArtiosCAD & EngView Parametric CAD Manuals*
- *Paper Folding Geometry, Crease Line Detection & Folding Kinematics*
- *SVG Vector Parsing, XML DOM Analysis & Matrix Transformations*
- *Computer Vision Dieline Recognition & Spatial Feature Detection*

---

## 1. Primary Objectives & Output Files

When asked to create or add a new template (e.g. `T0005` or `A60_20_01_01`), you MUST generate 100% complete, error-free TypeScript code across the following project structure:

```
src/
├── lib/{TEMPLATE_NAME}/
│   ├── types.ts              # Parameters interface, defaults, reference standards
│   ├── reference.ts          # Verbatim reference SVG clone generator (referenceMode)
│   ├── geometry.ts           # Parametric 2D manufacturing dieline engine (Segment[])
│   ├── dimensionsOverlay.ts  # CAD visual dimension markings generator (in mm space)
│   ├── nesting.ts             # 2D sheet nesting & yield calculation engine
│   ├── exportSingle.ts        # SVG/PDF single template export utilities
│   ├── exportSheet.ts         # SVG/PDF sheet layout export utilities
│   └── index.ts               # Module aggregator
├── components/boxes/
│   ├── {TEMPLATE_NAME}Calculator.tsx          # Main UI Calculator component
│   ├── {TEMPLATE_NAME}PrintSummary.tsx        # Print summary dialog modal
│   └── {TEMPLATE_NAME}SheetNestingPreview.tsx # Sheet layout nesting preview component
```

And register the template in system files:
- `src/hooks/useAppTemplates.ts`
- `src/services/adminTemplateService.ts`
- `src/lib/tabRegistry.ts`
- `src/components/AppTabs.tsx`
- `src/pages/TemplateDetail.tsx`

---

## 2. The 10-Phase Engineering Protocol

### Phase 1: Computer Vision & Screenshot Analysis
- Inspect the screenshot/image to identify box style (e.g. ECMA A60 Straight Tuck, FEFCO 0427 Mailer Box, Crash Lock Bottom, Snap Bottom).
- Detect structural features: Main panels, side walls, glue flaps, lock tabs, 45° diagonal fold creases, thumb notches.
- Build spatial adjacency graph (Front, Back, Side 1, Side 2, Glue Flap).
- *See reference:* [`Computer_Vision_and_Image_Analysis.md`](file:///Users/mslmadl/Documents/Print%20logic/.agents/skills/create-template/references/Computer_Vision_and_Image_Analysis.md)

### Phase 2: SVG Vector Parsing & Unit Normalization
- Inspect SVG `<svg viewBox="..." width="..." height="...">`.
- **Unit Conversion Formula**: If SVG is exported in Points (`pt`) or Pixels (`px`):
  $$1 \text{ mm} = 2.83464566929 \text{ pt}$$
- Convert all coordinates into **Millimeter User Space (`mm`)**.
- Parse all `<line>`, `<polyline>`, `<path>`, `<rect>` elements and flatten `matrix()` or `translate()` transforms.
- *See reference:* [`SVG_Parsing_and_Vector_Analysis.md`](file:///Users/mslmadl/Documents/Print%20logic/.agents/skills/create-template/references/SVG_Parsing_and_Vector_Analysis.md)

### Phase 3: Parametric Variable Definition (`types.ts`)
Define the parameter interface with strict types and sensible defaults:
```typescript
export interface TemplateParams {
  width: number;       // W (mm)
  height: number;      // H (mm)
  depth: number;       // D (mm)
  glueFlap: number;    // Gf (mm)
  tuck: number;        // Tuck tongue height (mm)
  sheetWidth: number;  // Print sheet W (mm)
  sheetHeight: number; // Print sheet H (mm)
  gripper: number;     // Gripper margin (mm)
  sheetMargin: number; // Border margin (mm)
  referenceMode?: boolean; // Verbatim SVG reference toggle
}
```

### Phase 4: Verbatim Reference Clone Generator (`reference.ts`)
Generate `build{TEMPLATE_NAME}Reference(params)` rendering the 100% exact SVG lines from the original reference file with zero distortion.
- Include explicit stroke colors:
  - Red (`#e30613`) for Cut / Outer boundary (`cls-2`).
  - Green (`#009640`) for Crease lines (`cls-1`).
  - Orange (`#f39200`) for 45° Crash-Lock Creases (`cls-3`).

### Phase 5: Dynamic Parametric Geometry Engine (`geometry.ts`)
Implement `build{TEMPLATE_NAME}Geometry(params)` returning `Segment[]` in mm space.
- Bound all notches, steps, and fold coordinates dynamically to prevent self-intersections when parameters $W, H, D$ change.
- Example for Crash-Lock Flap 1:
  - `stepX = Math.min(W, D * 0.5)`
  - `foldStartX = Math.max(x1 + stepX + 5, x1 + D - suppH)`
  - 45° crease line: `(foldStartX, y2 + suppH)` to `(x2 - 5.3, y2 + 5.3)` (`#f39200`).
- Return complete geometry object containing `svg`, `bbox`, `derived`, and `segments`.

### Phase 6: CAD Visual Dimension Markings (`dimensionsOverlay.ts`)
Generate CAD blue dimension overlay SVG strings directly in millimeter user space:
- Font size: `3.5mm`
- Arrow head size: `1.6mm`
- Line stroke width: `0.35mm`
- Text padding: `1.2mm`

### Phase 7: 3D Topology & Unfold Kinematics (`faceCoords` & `Box3DPreview.tsx`)
Construct `faceCoords` for Three.js 3D rendering:
- Define `body`, `topFlaps`, `bottomFlaps`, and `glue`.
- **CRITICAL EARCUT TRIANGULATION RULE**:
  - `polygon` array MUST NOT contain duplicate adjacent vertices.
  - Points must be ordered Counter-Clockwise (CCW).
- **INTERIOR HOLES & SLOTS**:
  - Slots, thumb notches, and interior windows must be defined in `holes: [[[x1, y1], [x2, y2], ...]]` ordered Clockwise (CW).
- **COVER + TONGUE DYNAMIC SPLITTING**:
  - Define `polygon` to span full length (cover + tongue). `Box3DPreview` will slice at tuck crease line for independent rotation.
- *See reference:* [`3D_Topology_and_Kinematics.md`](file:///Users/mslmadl/Documents/Print%20logic/.agents/skills/create-template/references/3D_Topology_and_Kinematics.md)

### Phase 8: 2D Nesting & Production Export (`nesting.ts`, `exportSingle.ts`, `exportSheet.ts`, `SheetNestingPreview.tsx`)
- Compute optimal layout pitch ($X_{\text{pitch}}, Y_{\text{pitch}}$), brick-shift interlock, and 0° vs 90° orientation yield.
- Render `SheetNestingPreview` supporting `<path>`, `<polyline>`, and `<line>` elements with proper stroke colors.
- *See reference:* [`Nesting_and_Layout_Algorithms.md`](file:///Users/mslmadl/Documents/Print%20logic/.agents/skills/create-template/references/Nesting_and_Layout_Algorithms.md)

### Phase 9: UI Calculator Component (`Calculator.tsx`)
- Use `TemplateEditorLayout` from `@/components/layouts/TemplateEditorLayout`.
- Use `InteractiveSvgCanvas` with thin strokes (`0.45px` default, `1.5px` selected) and invisible hover bounds (`strokeWidth="15"`).
- Support `segmentOverrides` state for interactive line adjustments.

### Phase 10: Automated Verification & Type Check
- Run `npx tsc --noEmit` and ensure **0 errors**.
- Build production bundle (`npm run build`).
- Deploy and verify live link on Firebase Hosting.

---

## 3. Critical Rules Checklist

1. **NEVER HARDCODE SVG POINTS AS MILLIMETERS**: Always convert SVG `pt` or `px` coordinates to `mm` ($1\text{mm} = 2.83464566929\text{pt}$).
2. **BOUND ALL DYNAMIC FORMULAS**: Use `Math.min()` and `Math.max()` so changing $W, H, D$ never causes panel overlap or self-intersection.
3. **PRESERVE ALL CREASE COLORS**:
   - Red `#e30613` (Cut)
   - Green `#009640` (Crease)
   - Orange `#f39200` (45° Crash-Lock Crease)
4. **NO DUPLICATE POLYGON VERTICES**: Prevent Three.js Earcut triangulation crashes.
5. **DO NOT SKIP TYPE CHECKING**: `npx tsc --noEmit` must pass with zero errors.

---

## 4. Reference Guides

For deep technical details, consult the following specialized references inside `.agents/skills/create-template/references/`:
- [`SVG_Parsing_and_Vector_Analysis.md`](file:///Users/mslmadl/Documents/Print%20logic/.agents/skills/create-template/references/SVG_Parsing_and_Vector_Analysis.md): SVG parsing, matrix transformations, unit conversions, and path decoding.
- [`Computer_Vision_and_Image_Analysis.md`](file:///Users/mslmadl/Documents/Print%20logic/.agents/skills/create-template/references/Computer_Vision_and_Image_Analysis.md): Screenshot visual features, panel graphs, line classification, and OCR extraction.
- [`Packaging_CAD_Standards.md`](file:///Users/mslmadl/Documents/Print%20logic/.agents/skills/create-template/references/Packaging_CAD_Standards.md): ECMA/FEFCO formulas, crease allowances, crash lock math, and clearance rules.
- [`3D_Topology_and_Kinematics.md`](file:///Users/mslmadl/Documents/Print%20logic/.agents/skills/create-template/references/3D_Topology_and_Kinematics.md): Three.js Earcut triangulation, polygon coordinates, and interior hole subtraction.
- [`Nesting_and_Layout_Algorithms.md`](file:///Users/mslmadl/Documents/Print%20logic/.agents/skills/create-template/references/Nesting_and_Layout_Algorithms.md): 2D interlock nesting math and sheet yield optimization.
