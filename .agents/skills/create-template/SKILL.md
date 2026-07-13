---
name: create-packaging-template
description: Generates a complete production-ready packaging template (2D geometry, 3D topology, nesting, and UI calculator) from a screenshot and SVG dieline. Trigger this when the user asks to add a new template, e.g., "Add template T0005".
---

# Role
Act as a Senior Packaging CAD Engineer, Computational Geometry Engineer, and Software Architect.
Your goal is to convert a packaging dieline into a fully parametric template that integrates seamlessly into the existing project.

# Input
The user will provide:
1. An image/screenshot of the packaging dieline or a 3D box.
2. A template name (e.g., T0005).
(Optional) An SVG if available, but NOT required.

The image is used to identify semantic meaning (panel types, folds, tabs, glue areas, and visual relationships) and the specific box style (e.g., Mailer Box, Straight Tuck, Reverse Tuck, Crash Lock).

# Primary Goal
Reverse engineer the packaging structure exactly as if it were originally created in professional CAD software (ArtiosCAD, Esko).
Apply industry-standard packaging geometry rules (ECMA Carton Standards, FEFCO) to convert the visual reference into a completely parametric template.

# Geometry Analysis & Expert Knowledge
Act as an expert in:
- ECMA Carton Standards & FEFCO Corrugated Standards
- ArtiosCAD & Esko Packaging Design
- Folding Carton Design Manuals

Analyze the image to detect every structural element:
- Cut Lines, Fold Lines, Crease Lines
- Glue Flaps, Dust Flaps, Lock Tabs (Cherry Locks, Tuck Ends), Slots, Windows
- Bleed, Safe Area, Auto Lock Bottoms, Crash Locks.
Derive the exact mathematical proportions (W, H, D) based on standard carton design rules. Never ignore small details (like clearances for dust flaps, chamfers, or lock tab angles).

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
- **No Duplicate Vertices**: The `polygon` array MUST NOT contain duplicate adjacent points (e.g., repeating the same corner point twice, or matching the start/end points of Bézier curves with the corners). Duplicate adjacent points will cause the Three.js Earcut triangulation library to crash at runtime.
- **Flap Cover + Tongue Coordination**: For flaps split into a cover panel and a locking tongue (e.g., straight tuck boxes), define the `polygon` array to span the **entire** flap length (cover + tongue). The 3D engine in `Box3DPreview` will dynamically split and filter the polygon points based on `lidTongue` so that the cover stays flat and the tongue rotates independently without visual duplicates.


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

3. **VERIFY EXACT MATHEMATICAL RELATIONSHIPS (ECMA STANDARDS):**
   Use standard packaging design rules to derive chamfers, angles (like 45-degree dust flap cutbacks), slots, and locking tabs. Relate these back to the `W`, `H`, `D` variables. Apply professional clearances (e.g., 0.5mm - 1.5mm for folding tolerances) where panels meet.

4. **FLAP LENGTHS MATCH PROPORTIONS:**
   Ensure that the length/height of the closing flaps (لسان الغلق) is calculated parametrically (e.g., `D` for full overlapping flaps, `D/2` for dust flaps, or standard tuck lengths like 15-20mm depending on box size).

5. **STROKE WIDTHS IN EXPORTED SVGS:**
   Never hardcode thick `stroke-width` attributes in exported SVGs. Avoid specifying `stroke-width` in the SVG `<line>`, `<path>`, or `<g>` tags entirely (matching the style of `template (3).svg`). This ensures they open with standard thin line weights in Illustrator, AutoCAD, or other vector editors.

6. **DIMENSION OVERLAY SIZING:**
   Always define the CAD visual dimension overlay elements (`dimensionsOverlay.ts`) directly in millimeter user space units (e.g., font size ~3.5mm, arrow head size ~1.6mm, stroke width ~0.35mm, padding X ~1.2mm, padding Y ~0.8mm) rather than scaling by screen-pixels or using large defaults like 14px. This ensures dimension markings fit proportionally within the box layout panel widths (e.g. W=50mm) without overlapping or cluttering the visual area.

7. **INTERACTIVE PREVIEW LINE THICKNESS:**
   Configure the `InteractiveSvgCanvas` preview lines to use thin rendering stroke-width (e.g., `0.45px` default line weight, `1.5px` selected weight) to keep the on-screen preview clean and visually accurate, while utilizing the thick invisible hover bounds (`strokeWidth="15"` or similar) for easy mouse/touch selection and editing.

8. **INTERACTIVE PREVIEW FOR COMPLEX PATHS (d Property):**
   When defining complex shapes (such as interlocking tabs, notch cutouts, or non-trivial closing tongues) in `geometry.ts` and `reference.ts`, define the exact pre-computed SVG path string in the optional `d` property of the `Segment` object. The `InteractiveSvgCanvas` component will read this `d` property to render the path with 100% precision instead of trying to reconstruct it from a simple start/end segment.

9. **SYNCHRONIZE faceCoords POLYGONS AND geometry.ts:**
   The `polygon` array defined inside `faceCoords` (for `bottomFlaps`, `topFlaps`, `glue`, etc.) in the `Calculator.tsx` file must match the exact mathematical coordinates of the outer cut boundaries defined in `geometry.ts` (including clearances, slants, and custom notches). If they mismatch, the 3D preview crop textures will align incorrectly, resulting in visible alignment shifts or missing graphic areas on the 3D model.

10. **MANUFACTURING CLEARANCE FOR DUST FLAPS:**
    Pay close attention to dust flaps adjacent to main crease folds. Typically, professional CAD designs offset the edge of the dust flap next to a fold line by a clearance (e.g., `0.5mm` to `1.0mm`) to prevent the flap from catching on the folded panel. Analyze the reference SVG to identify these clearances (e.g., a vertical notch cut starting a fraction of a millimeter away from the crease) and parameterize them precisely (e.g., `Xd1 + 0.5` instead of `Xd1`).

11. **3D HOLES AND CUTOUTS FOR SLOTS/NOTCHES:**
    Any closed red cut shape located inside a panel's main boundary (e.g., thumb notches, locking slots, or interior windows) must be defined in the `holes` property of the corresponding panel in `faceCoords` (as an array of coordinate loops: `holes: [[[x1,y1], [x2,y2], ...]]`). The 3D engine in [Box3DPreview.tsx](file:///Users/mslmadl/Documents/Print%20logic/src/components/boxes/Box3DPreview.tsx) parses these polygons and subtracts them from the panel mesh using Three.js `ShapeGeometry.holes` to render real, hollowed-out physical openings rather than just lines on the cardboard.
