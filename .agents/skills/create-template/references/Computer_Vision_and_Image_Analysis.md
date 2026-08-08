# Computer Vision & Image Analysis Reference Guide for Dielines

This reference guide provides specialized computer vision (CV) and image analysis protocols for reverse-engineering packaging structures from dieline screenshots, technical drawings, and 3D box photos.

---

## 1. Visual Feature Detection & Semantic Recognition

When analyzing an image of a box dieline or 3D package, execute the following 6-step visual analysis protocol:

```
[ Screenshot Image ]
         │
         ▼
1. Box Type Identification (ECMA A60/A20, FEFCO 0427, Crash Lock, Mailer, Tray)
         │
         ▼
2. Spatial Panel Layout & Connectivity Graph (Front, Back, Side 1, Side 2, Glue Flap)
         │
         ▼
3. Edge & Line Type Classification (Solid Red Cut Lines vs Dashed Green Crease Lines)
         │
         ▼
4. Structural Detail Extraction (Chamfer Slants, Lock Tab Bevels, Friction Locks, Thumb Notches)
         │
         ▼
5. OCR & CAD Annotation Text Recognition (W, H, D, Lg, Tuck Height)
         │
         ▼
6. Cross-Validation with SVG Vector Coordinates
```

---

## 2. Structural Panel Graph & Adjacency

Analyze the visual topology to build a structural panel adjacency graph:

| Panel Code | Panel Role | Typical Width | Adjacency Connections |
| :--- | :--- | :--- | :--- |
| `P1` | Side Panel 1 | Depth $D$ | Left: Glue Flap ($G_f$), Right: Front Panel ($W$), Top: Lid ($D - 0.25$), Bottom: Flap 1 |
| `P2` | Front Panel | Width $W$ | Left: Side 1 ($D$), Right: Side 2 ($D$), Top: Dust Flap 1, Bottom: Flap 2 |
| `P3` | Side Panel 2 | Depth $D$ | Left: Front Panel ($W$), Right: Back Panel ($W - 0.5$), Top: None / Cutout, Bottom: Flap 3 |
| `P4` | Back Panel | Width $W - 0.5$ | Left: Side 2 ($D$), Right: Outer Cut Edge, Top: Dust Flap 2, Bottom: Flap 4 |
| `G_f` | Glue Flap | $11.5\text{mm} - 15\text{mm}$ | Attached to left edge of Side 1 ($P1$) |

---

## 3. Visual Feature Detection Patterns

### A. Auto-Lock Bottom (Crash-Lock) Visual Markers
- **Visual Sign**: 45° diagonal crease fold lines appearing on Flaps 1 and 3.
- **Notch Step**: A right-angled step cut midway across the bottom flap length.
- **Support Flaps**: Trapezius-shaped bottom flaps under Front and Back panels.

### B. Mailer Box (FEFCO 0427) Visual Markers
- **Visual Sign**: Double sidewall panels connected by twin parallel fold creases.
- **Roll-over Lock Tabs**: Rounded friction lock tabs protruding from top edge of inner sidewalls.
- **Bottom Locking Slots**: Rectangular slot cutouts along bottom crease lines of the main tray.

### C. Cherry Locks / Tuck End Locks
- **Visual Sign**: Small 1.5° angled notches or semi-circular cutouts at the corners of tuck flap tongues to prevent the lid from springing open.

---

## 4. OCR & CAD Annotation Extraction

1. Look for text labels on the drawing (e.g. `50 mm`, `150 mm`, `100 mm`, `W=50`, `H=150`, `D=100`).
2. Map text labels to structural parameters ($W, H, D, G_f, Tuck$).
3. Compare extracted OCR values with vector SVG measurements to establish the exact physical scaling ratio.
