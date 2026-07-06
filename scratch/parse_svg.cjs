// Detailed geometric analysis of A10_10_03_03_A.svg
// All paths have transform="translate(-6.5, -6.5)" so we must subtract 6.5 from the original coords

// The SVG viewBox = "0 0 885.58 706.997"
// All paths in absolute coords BEFORE translation (in SVG user space)

// STEP 1: Map the lines (already in viewBox space, no transform)
// CREASE lines (green, cls-1):
// Vertical creases:
//   V1: x=34.6,  y: 140.9 -> 566.1   (Glue flap crease)
//   V2: x=318.07, y: 142.6 -> 564.4  (Panel 1 | Panel 2 crease)  
//   V3: x=459.8,  y: 142.6 -> 564.4  (Panel 2 | Panel 3 crease)
//   V4: x=743.26, y: 142.6 -> 564.4  (Panel 3 | Panel 4 crease)

// CUT line (red, cls-2):
//   V5: x=883.58, y: 140.9 -> 566.1  (Right edge cut)

// Horizontal creases (top):
//   H1: (36.02, 139.48) -> (314.24, 139.48)  Panel 1 top
//   H2: (321.02, 140.9) -> (456.84, 140.9)   Panel 2 top
//   H3: (463.63, 139.48) -> (739.43, 139.48)  Panel 3 top
//   H4: (746.22, 140.9) -> (883.58, 140.9)   Panel 4 top

// Horizontal creases (bottom):
//   H5: (36.02, 567.52) -> (314.24, 567.52)  Panel 1 bottom
//   H6: (321.02, 566.1) -> (456.84, 566.1)   Panel 2 bottom
//   H7: (463.63, 567.52) -> (739.43, 567.52)  Panel 3 bottom
//   H8: (746.22, 566.1) -> (883.58, 566.1)   Panel 4 bottom

// STEP 2: Derive panel widths from vertical crease positions
// Glue flap: 0 -> 34.6 = 34.6
// Panel 1 (W):  34.6 -> 318.07 = 283.47
// Panel 2 (D):  318.07 -> 459.8 = 141.73
// Panel 3 (W):  459.8 -> 743.26 = 283.46  (≈ 283.47)
// Panel 4 (D):  743.26 -> 883.58 = 140.32  (≈ 141.73 - 1.41 clearance)

// Panel height (H): 140.9 -> 566.1 = 425.2

// So: W = 283.47, D = 141.73, H = 425.2, GF = 34.6

// STEP 3: Analyze the flap paths (after applying translate(-6.5,-6.5))
// Path coordinates in the SVG are in an untranslated system shifted by +6.5.
// After transform they become viewBox-space coordinates.

// Glue flap (polyline, already in viewBox space):
//   34.6,140.9 -> 2,149.34 -> 2,557.66 -> 34.6,566.1
//   This is a trapezoidal glue flap on the left.
//   Top chamfer: from (34.6,140.9) to (2,149.34) = inward 8.44mm in Y
//   Bottom chamfer: from (2,557.66) to (34.6,566.1) = inward 8.44mm in Y

// TOP FLAPS (paths with translate(-6.5,-6.5)):
// After applying translate, coordinates shift by -6.5 in both x and y.

// Top Flap 1 (Panel 1 - large tuck flap):
// d="M41.1,147.4 l21.26,-21.26 V8.5 H300.9 V126.14 l21.26,21.26 c.47,.47,1.47,1.7,2.41,1.7"
// After translate(-6.5,-6.5):
//   Start: (41.1-6.5, 147.4-6.5) = (34.6, 140.9) ← matches V1 crease top
//   l21.26,-21.26 → (55.86, 119.64)
//   V8.5 → (55.86, 2.0)  [8.5-6.5=2.0]
//   H300.9 → (294.4, 2.0) [300.9-6.5=294.4]
//   V126.14 → (294.4, 119.64) [126.14-6.5=119.64]
//   l21.26,21.26 → (315.66, 140.9) 
//   c.47,.47,1.47,1.7,2.41,1.7 → small curve to (318.07, 142.6)
//   End: (318.07, 142.6) ← matches V2 crease top
// Flap height: 140.9 - 2.0 = 138.9mm
// Chamfer: 21.26mm diagonal (45° cut)

// Top Flap 2 (Panel 2 - small dust flap):
// d="M324.57,149.1 a3.4,3.4,0,0,0,3.4,-3.4 V86.46 a8.508,8.508,0,0,1,8.5,-8.51 H454.39 a8.51,8.51,0,0,1,8.51,8.51 V145.7 a3.4,3.4,0,0,0,3.4,3.4"
// After translate(-6.5,-6.5):
//   Start: (318.07, 142.6)  
//   Arc r=3.4 → (321.47, 139.2) small corner radius
//   V86.46 → V79.96 (after translate)
//   Arc r=8.5 → rounded corner
//   H454.39 → H447.89
//   Arc r=8.51 → rounded corner
//   V145.7 → V139.2
//   Arc r=3.4 → end at (459.8, 142.6) [466.3-6.5=459.8]
// This is a small rounded dust flap
// Flap height: 142.6 - 79.96 ≈ 62.64mm  (roughly D/2 ≈ 70.87)

// Top Flap 3 (Panel 3 - large tuck flap with sloped ears):
// d="M466.3,149.1 c.94,0,1.93,-1.23,2.4,-1.7 l8.51,-8.5 L482.88,8.5 H733.19 l5.66,130.4 c8.98,8.97,9.97,10.2,10.91,10.2"
// After translate(-6.5,-6.5):
//   Start: (459.8, 142.6)
//   Small curve then l8.51,-8.5 → diagonal ear
//   L482.88-6.5=476.38, 8.5-6.5=2.0 → diagonal line to top
//   H733.19 → H726.69
//   l5.66,130.4 → (732.35, 132.4)
//   c8.98,8.97,9.97,10.2,10.91,10.2 → curve to (743.26, 142.6)
// This flap has sloped "ear" tabs on both sides

// Top Flap 4 (Panel 4 - dust flap with notch):
// d="M749.76,149.1 a3.406,3.406,0,0,0,3.41,-3.4 V86.46 a8.5,8.5,0,0,1,8.5,-8.51 H866.69 v26.22 a8.51,8.51,0,0,0,8.51,8.51 h14.88 V147.4"
// After translate(-6.5,-6.5):
//   Start: (743.26, 142.6)
//   Arc r=3.41 → (746.67, 139.2) small corner
//   V86.46 → V79.96
//   Arc r=8.5 → rounded corner
//   H866.69 → H860.19
//   v26.22 → drops down 26.22mm (notch area)
//   Arc r=8.51 → rounded corner
//   h14.88 → extends right
//   V147.4 → V140.9
//   End: (883.58, 140.9) ← matches right edge
// This has a notch/step on the right side (for interlocking)

// BOTTOM FLAPS:
// Bottom Flap 1 (Panel 1 - same as Top Flap 1, mirrored):
// d="M41.1,572.6 l21.26,21.26 V711.5 H300.9 V593.857 l21.26,-21.26 c.47,-.47,1.47,-1.7,2.41,-1.7"
// After translate: Start (34.6, 566.1), End (318.07, 564.4)

// Bottom Flap 3 (Panel 3 - mirrored from top flap 3):
// d="M466.3,570.9 c.94,0,1.93,1.23,2.4,1.7 l8.51,8.51,5.67,130.39 H733.19 l5.66,-130.39 c8.98,-8.98,9.97,-10.21,10.91,-10.21"

// Bottom Flap 2 (Panel 2 - dust flap with notch, DIFFERENT from top):
// d="M466.3,570.9 a3.4,3.4,0,0,0,-3.4,3.4 v59.25 a8.506,8.506,0,0,1,-8.5,8.5 H351.588 v-26.22 a8.5,8.5,0,0,0,-8.5,-8.5 h-15.12 V574.3 a3.4,3.4,0,0,0,-3.4,-3.4"
// After translate: Start (459.8, 564.4), End (318.07, 564.4)
// This one has a notch on the LEFT side (mirror of top flap 4)

// Bottom Flap 4 (Panel 4 - rounded dust flap):
// d="M749.76,570.9 a3.406,3.406,0,0,1,3.41,3.4 v59.25 a8.5,8.5,0,0,0,8.5,8.5 h119.9 a8.508,8.508,0,0,0,8.51,-8.5 V572.6"
// After translate: Start (743.26, 564.4), End (883.58, 566.1)

console.log("=== DERIVED PARAMETERS ===");
console.log("W (face panel width):", 318.07 - 34.6, "≈ 283.47mm");
console.log("D (depth panel width):", 459.8 - 318.07, "≈ 141.73mm");
console.log("H (box height):", 566.1 - 140.9, "= 425.2mm");
console.log("GF (glue flap width):", 34.6, "mm");
console.log("GH (glue chamfer):", 149.34 - 140.9, "≈ 8.44mm");
console.log("Tuck flap height (panel 1 top):", 140.9 - 2, "= 138.9mm");
console.log("Dust flap height (panel 2 top):", 142.6 - (86.46-6.5), "≈ 62.64mm");
console.log("Tuck flap chamfer (45°):", 21.26, "mm");
console.log("Dust flap corner radius:", 8.5, "mm");
console.log("Small corner radius:", 3.4, "mm");
console.log("Panel 4 D (with clearance):", 883.58 - 743.26, "= 140.32mm");
console.log("Clearance:", 141.73 - 140.32, "≈ 1.41mm");
