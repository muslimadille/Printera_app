# Packaging CAD Standards & Parametric Geometry Reference

This reference document synthesizes principles from *Fundamentals of Packaging Technology*, *Paperboard Packaging*, *Structural Package Designs*, *The Packaging Designer's Book of Patterns*, ArtiosCAD & EngView Manuals, ECMA Folding Carton Standards, and FEFCO Corrugated Standards.

---

## 1. Box Style Classification & Industry Codes

### ECMA (European Carton Makers Association) Folding Cartons
- **A-Group (A60/A20)**: Folding cartons with longitudinal seam (Glue flap on side).
  - `A60.20.01.01`: Straight Tuck Top with Auto-Lock Bottom (Crash Lock Bottom).
  - `A20.20.03.01`: Reverse Tuck Top with Tuck Bottom.
  - `A10.20.01.01`: Straight Tuck Top with Snap Bottom (1-2-3 Lock / Swedish Bottom).
- **B-Group**: Non-longitudinal seam cartons (Trays, Slotted boxes).
- **D-Group**: Trays assembled by folding and locking tabs.
- **F-Group**: Specialized cartons (Sleeves, Dispensers).

### FEFCO (European Federation of Corrugated Board Manufacturers)
- **FEFCO 02xx**: Commercial boxes / Regular Slotted Containers (RSC).
- **FEFCO 03xx**: Telescope boxes (Top and bottom separate lids).
- **FEFCO 04xx**: Folder-type boxes and trays (e.g., `FEFCO 0427` Roll-Over Side Tuck Mailer Box).
- **FEFCO 07xx**: Ready-glued boxes (Crash lock bottom corrugated).

---

## 2. Paperboard & Corrugated Board Mechanics

### Crease Allowance & Board Thickness ($T$)
When paperboard or corrugated board folds 90° or 180°, material thickness $T$ consumes space inside the fold.
- **Folding Boxboard (FBB / SBS / Kraft)**: $T = 0.3\text{mm} - 0.8\text{mm}$.
  - Clearance between overlapping panels = $1.0 \times T$.
  - Internal panel deduction (Back panel vs Front panel) = $0.5\text{mm}$.
- **E-Flute Corrugated**: $T = 1.5\text{mm} - 1.8\text{mm}$.
  - Roll-over double wall allowance = $2 \times T \approx 3.0\text{mm} - 3.5\text{mm}$.
- **B-Flute Corrugated**: $T = 2.8\text{mm} - 3.0\text{mm}$.
  - Roll-over double wall allowance = $2 \times T \approx 5.5\text{mm} - 6.0\text{mm}$.

---

## 3. Mathematical Geometry Formulas by Structural Component

### A. Glue Flap ($G_f$)
- **Width ($G_f$)**: Standard $11.5\text{mm} - 15.0\text{mm}$.
- **Top Chamfer Angle ($\theta_{\text{top}}$)**: $25^\circ - 45^\circ$, typical top offset = $3.0\text{mm}$.
- **Bottom Chamfer Angle ($\theta_{\text{bot}}$)**: $15^\circ - 30^\circ$, typical bottom offset = $12.5\text{mm}$.
- **Fold Crease Relief**: Crease line stops $1.0\text{mm}$ short of bottom cut edge to prevent bunching during folding.

### B. Auto Lock Bottom / Crash Lock Bottom Flaps (ECMA A60.20.01.01)
- **Main Flaps (Flap 1 & 3)**:
  - Max Flap Height ($H_{\text{crash}}$) = $0.675 \times W$.
  - Notch Step Position ($X_{\text{notch}}$) = $\min(W, D / 2)$.
  - Notch Step Height = $H_{\text{crash}} - 5.75\text{mm}$.
  - 45° Crease Line Start = $(X_{\text{start}}, Y_2 + W/2)$ where $X_{\text{start}} = \max(X_1 + X_{\text{notch}} + 5, X_1 + D - W/2)$.
  - 45° Crease Line End = $(X_1 + D - 5.3\text{mm}, Y_2 + 5.3\text{mm})$.
  - Crease Color = `#f39200` (Orange).
- **Support Flaps (Flap 2 & 4)**:
  - Flap Height = $W / 2 = 25.0\text{mm}$ (for $W=50$).
  - Slant Chamfer = $6.47\text{mm}$ in from panel edges.

### C. Top Tuck Lid & Curved Tuck Tongue
- **Main Lid Cover Height**: $D - 0.25\text{mm}$ (to allow clearance for top crease fold).
- **Tuck Tongue Height ($Tuck$)**: $12.5\text{mm} - 15.0\text{mm}$.
- **Tuck Tongue Side Clearance Margin**: $t_{\text{margin}} = \min(7.0\text{mm}, D \times 0.15)$.
- **Curved Bezier Path Formula**:
  $$\text{Path} = M(t_{\text{left}} + 0.6, y_{\text{tuck}}) \, V(y_0 + 10.0) \, C(...) \, H(t_{\text{right}} - 5.22) \, C(...) \, V(y_{\text{tuck}})$$
- **Tuck Friction Friction Locks (Cherry Locks)**: 1.5° undercut notch on side corners to ensure snug closure.

### D. Dust Flaps
- **Height ($H_{\text{dust}}$)**: $\min(32.0\text{mm}, D \times 0.6)$.
- **Crease Clearance Offset**: Offset flap cut line by $0.75\text{mm} - 1.0\text{mm}$ away from adjacent fold line to prevent binding.
- **Top Slant Angle**: $15^\circ - 30^\circ$ angle with $3.0\text{mm} \times 3.0\text{mm}$ entry chamfers.

### E. Mailer Box Roll-Over Double Sidewalls (FEFCO 0427)
- **Inner Sidewall Height**: $H_{\text{inner}} = H - 2 \times T$.
- **Roll-Over Top Crease Spacing**: Two parallel crease lines spaced by board thickness $T$.
- **Locking Tabs (Cherry / Friction Locks)**: $45^\circ$ entry bevels fitting into bottom slot cutouts $(L_{\text{slot}} \times W_{\text{slot}})$.

---

## 4. Stroke Colors & Standard Layers

| Layer Purpose | Color Code | Hex Value | SVG Class | Line Type |
| :--- | :--- | :--- | :--- | :--- |
| Outer Boundary & Cut Lines | Red | `#e30613` | `cls-2` | Solid |
| Internal Crease & Score Lines | Green | `#009640` | `cls-1` | Dashed (`4,4`) |
| Crash Lock 45° Fold Creases | Orange | `#f39200` | `cls-3` | Solid / Dashed |
| CAD Dimension Markings | Blue / Cyan | `#2563eb` | `cad-dim` | Thin Solid |
| Bleed & Artwork Bounds | Magenta | `#ec4899` | `cls-4` | Fine Dashed |
