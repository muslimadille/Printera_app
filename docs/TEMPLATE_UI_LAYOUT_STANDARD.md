# Template UI Layout Standard — Based on D001

**Status:** Official · **Authority:** Mandatory for all new templates · **Reference Implementation:** `src/components/boxes/D001Calculator.tsx`

The D001 tab UI is hereby adopted as the **official, reusable UI layout** for every new template added to the "علب" (Boxes) section (and any analogous template group). Any new template MUST visually and behaviorally match D001 at 100% on the UI layer. Only the underlying template logic is allowed to differ.

---

## 1. Why this standard exists

D001 reached a satisfactory UX state after multiple iterations (preview toggle, unified preview container, side panel grouping, export dropdowns, dimension overlay with unit selector, brief distribution summary, admin-only diagnostic sections). Re-deriving this layout per template wastes effort and produces inconsistent UX. From this point forward, new templates **inherit** the D001 layout shell.

## 2. Mandatory UI structure (must match D001 exactly)

### 2.1 Preview toggle buttons
- `معاينة القالب` (Single Template Preview) — **default active on tab open**
- `معاينة التوزيع على الشيت` (Sheet Layout Preview)
- Same visual treatment for active/inactive states as D001.

### 2.2 Export dropdowns (placed in the CardHeader, same row as preview toggles)
- `تصدير القالب` → dropdown: `تصدير SVG`, `تصدير PDF`
- `تصدير التوزيع` → dropdown: distribution export options (SVG/PDF), matching D001.

### 2.3 Unified preview area
- One container hosts both preview modes.
- Single Template preview MUST share the same viewBox/scale-to-fit behavior as the Sheet preview container — no distortion, centered, fits the box.
- Sheet preview renders numbered pieces (1, 2, 3 …) centered on each item, matching D001.

### 2.4 Right-side input panel (440px width)
Sections, in this exact order:
1. **أبعاد القالب** (Template Dimensions)
2. **تخصيص متقدم** (Advanced Customization — tongues/flaps/locks for that template)
3. **إعدادات الشيت** (Sheet Settings)
4. **ملخص التوزيع** (Distribution Summary — concise read-only block at the bottom)

Field components MUST use the same `NumField` style: same size, same spacing, same focus/select-on-focus behavior, same labels-above-inputs pattern.

### 2.5 Display options (above or inside the preview header, as in D001)
- `إظهار القياسات` switch — only visible in single-template mode.
- Unit selector — `mm` / `cm` / `in`. Applied to:
  - The dimension overlay (Width / Height / Depth only, LTR `value unit` format, constant visual size regardless of zoom).
  - Every input field (display only; internal math stays in mm).
  - Every value in the distribution summary.
- Hover highlight: hovering an input highlights the related geometry region in the preview (same pattern as D001).

### 2.6 Admin-only diagnostic sections
The header card, derived dimensions card, nesting settings card, and results card are hidden for non-admins and visible for admins — same `isAdmin` gating as D001.

## 3. The only allowed differences per template

A new template MAY differ from D001 ONLY in:
- Template shape and visual geometry.
- Geometry build logic (`geometry.ts` equivalent).
- Template-specific geometric rules / Segment Map.
- Nesting calibration if the shape needs custom pitch/interlock logic.
- **Field labels and which advanced fields appear**, when the template genuinely needs different parameters.

Anything else — layout, ordering, sizing, interactions, export menus, preview toggles, unit handling, dimension overlay, summary block, admin gating — MUST remain identical to D001.

## 4. Technical implementation rule for new templates

When adding a new template (e.g. `D002`, `D003`, …):

1. **Copy `src/components/boxes/D001Calculator.tsx` as the starting shell.** Do not start from a blank component or a different calculator.
2. Replace ONLY:
   - Geometry engine import (`src/lib/d001/geometry.ts` → `src/lib/<id>/geometry.ts`)
   - Types/defaults (`src/lib/d001/types.ts` → `src/lib/<id>/types.ts`)
   - Single + sheet export modules
   - Nesting module if calibration differs
   - Field set inside `تخصيص متقدم` if the template needs different parameters
3. Do NOT change: section order, section titles, preview toggle behavior, export dropdown structure, unit selector logic, dimension overlay logic, summary placement, admin-gated diagnostic cards, side-panel width, `NumField` usage.
4. Reuse the shared building blocks already factored out (e.g. `NumField`, `ColorDropdown`, dimension overlay) instead of duplicating them.

## 5. Non-goals of this document

- This is a forward-looking standard. **No changes to D001 itself are implied or required by this document.**
- D001's current geometry, export, nesting, and UI remain untouched.

## 6. Future refactor (optional, non-blocking)

A future cleanup MAY extract the D001 shell into a generic `<TemplateCalculatorShell />` that accepts a `templateEngine` prop (geometry + export + nesting + field schema). Until that refactor lands, the copy-and-replace rule in §4 is the binding contract.

---

**Owner:** Template Build Protocol (`docs/TEMPLATE_BUILD_PROTOCOL.md`).
**Reference UI source of truth:** `src/components/boxes/D001Calculator.tsx`.
