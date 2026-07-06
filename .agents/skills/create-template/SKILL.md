---
name: create-packaging-template
description: Generates a complete production-ready packaging template (2D geometry, 3D topology, nesting, and UI calculator) from a screenshot and SVG dieline. Trigger this when the user asks to add a new template, e.g., "Add template T0005".
---

# Role
Act as a Senior Packaging CAD Engineer, Computational Geometry Engineer, and Software Architect.
Your goal is to convert a packaging dieline into a fully parametric template that integrates seamlessly into the existing project.

# Input
The user will provide:
1. A screenshot of the packaging dieline.
2. The original SVG of the same dieline.
3. A template name (e.g., T0005).

The SVG is the source of truth for geometry.
The screenshot is only used to identify semantic meaning (panel types, folds, tabs, glue areas, and visual relationships).

# Primary Goal
Reverse engineer the dieline exactly as if it were originally created in professional CAD software.
Preserve every manufacturing detail while converting it into a completely parametric template.

# Geometry Analysis
Analyze the SVG in full detail. Detect every structural element:
- Cut Lines, Fold Lines, Crease Lines
- Glue Flaps, Dust Flaps, Lock Tabs, Slots, Windows
- Rounded Corners, Chamfers, Perforations
Never ignore small details, never simplify geometry, and never smooth paths.

# Geometric & Parametric Reconstruction
Calculate position, width, height, angles, and radii for all elements.
Build a complete structural graph describing how every component connects.
Infer symmetry and proportional relationships.
Everything must be parameter-driven. Changing any dimension should automatically regenerate all features.

# Architecture & Project Integration (CRITICAL)
Do NOT generate a generic JSON configuration. This project uses a strict TypeScript architecture for templates.
You MUST generate the following files following the exact structure of existing templates (use T0001 or T0003 as a reference):

1. `src/lib/{TEMPLATE_NAME}/types.ts`: Define the parameters interface.
2. `src/lib/{TEMPLATE_NAME}/reference.ts`: Provide reference standard dimensions.
3. `src/lib/{TEMPLATE_NAME}/geometry.ts`: Build the 2D manufacturing SVG using `Segment[]` (OUTER, CUT, CREASE). Preserve all Beziers and arcs accurately.
   - **Crucial:** You must add parametric dimension lines to the final SVG markup to display the template's dimensions (W, H, D, Flaps).
4. `src/lib/{TEMPLATE_NAME}/nesting.ts`: Implement auto-nesting and brick-shift logic.
5. `src/components/boxes/{TEMPLATE_NAME}Calculator.tsx`: The UI component and the 3D topology mapping (`faceCoords`).
   - **Interactive 2D Preview:** You MUST use the `InteractiveSvgCanvas` component (`import { InteractiveSvgCanvas, type Segment } from '@/components/InteractiveSvgCanvas';`) for the 2D view.
   - **Edit State:** The calculator must maintain a `segmentOverrides` state: `const [segmentOverrides, setSegmentOverrides] = useState<{ svg: string | null; segments: Segment[] | null }>({ svg: null, segments: null });`.
   - **Derived Geometry:** Compute a `geo` variable using `useMemo` that replaces `baseGeo.svg` and `baseGeo.segments` with `segmentOverrides` if they exist. Also recompute the bounding box (`geo.bbox`) based on the updated segments.
   - **3D & Export Integration:** Pass the derived `geo.svg`, `geo.bbox.w`, and `geo.bbox.h` to `Box3DPreview` and export functions so that interactive line edits are reflected everywhere.

## 3D Topology Requirements (`faceCoords`)
The generated `faceCoords` inside the Calculator component must contain:
- `body`: The main structural panels.
- `topFlaps` and `bottomFlaps`: The closing flaps.
- `glue`: The glue flap.
For exact 3D cutting (especially for complex shapes like lock tabs), you must include the `polygon` array for each flap (e.g., `polygon: [[x1,y1], [x2,y2], ...]`) if the flap is not a perfect rectangle. The 3D engine uses these polygons to cut the shape via `ShapeGeometry`.

# Validation & Registration
- Ensure fold lines are hinges and do not become cut paths.
- Automatically register the template inside the project's template registry (e.g., `tabRegistry.ts` and `AppTabs.tsx`).
- Verify that the generated SVG visually matches the original dieline and the 3D preview folds correctly without intersecting panels.

# ⚠️ CRITICAL RULES & COMMON PITFALLS TO AVOID ⚠️

1. **DO NOT BLINDLY COPY ANOTHER TEMPLATE:** 
   Just because a template looks similar (e.g. mailer box vs tuck box), do not copy its geometry logic assuming it applies. You MUST write custom geometry logic that matches the exact paths, notches, chamfers, and folds found in the provided SVG.

2. **BEWARE OF UNITS IN THE SVG:**
   Before extracting lengths or offsets from the provided SVG, check what units it is exported in (e.g., Points, Pixels, or mm). 
   - Look at `<svg width="..." height="..." viewBox="...">`.
   - If the numbers are massive (e.g. `2271.7` for a box that's ~800mm), **convert them!** (e.g. 1 mm = 2.834645 pt). 
   - **Do not hardcode dimensions in Points thinking they are Millimeters.** This will cause massive distortion.
   - *Best Practice:* Write a small Python or Node script to parse the SVG `<line>` and `<polyline>` points, convert them to `mm`, and calculate their delta offsets relative to `W`, `H`, and `D`.

3. **VERIFY EXACT MATHEMATICAL RELATIONSHIPS:**
   Extract exact lengths for chamfers, angles (like 45-degree corner pop-ups), slots, and locking tabs. Relate these back to the `W`, `H`, `D` variables. Do not use approximations or "eyeball" it from the screenshot. The SVG is the absolute source of mathematical truth.

4. **FLAP LENGTHS MATCH DEPTH:**
   Ensure that the length/height of the closing flaps (لسان الغلق) is exactly the same as the depth (`D`), or parametrically linked to it (e.g., `D/2` for dust flaps). Do not use hardcoded values for flap heights; they must be dynamic to fit with any design proportions based on the depth.
