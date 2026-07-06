---
name: Template UI Layout Standard
description: D001 calculator UI is the mandatory shell for every new dieline template — preview toggles, export dropdowns, side panel sections, unit selector, dimension overlay, admin-gated diagnostics
type: preference
---

The D001 tab UI (`src/components/boxes/D001Calculator.tsx`) is the official reusable UI layout for every new template added under "علب" / template groups. Full spec lives in `docs/TEMPLATE_UI_LAYOUT_STANDARD.md`.

**Why:** D001 reached a satisfactory UX after many iterations. Re-deriving the layout per template wastes effort and produces inconsistent UX.

**How to apply when adding a new template (e.g. D002):**
1. Copy `D001Calculator.tsx` as the starting shell — never start blank or from a different calculator.
2. Replace ONLY: geometry engine, types/defaults, single+sheet export modules, nesting (if calibration differs), and the field set inside "تخصيص متقدم" if the template needs different parameters.
3. Keep identical: section order & titles (`أبعاد القالب` → `تخصيص متقدم` → `إعدادات الشيت` → `ملخص التوزيع`), 440px right side panel, `NumField` usage, preview toggle (`معاينة القالب` default + `معاينة التوزيع على الشيت`), export dropdowns in CardHeader (`تصدير القالب` SVG/PDF, `تصدير التوزيع` SVG/PDF), unified preview container with scale-to-fit, numbered pieces in sheet preview, `إظهار القياسات` switch (single-template only), unit selector mm/cm/in applied to overlay + inputs (display only, math stays mm) + summary, hover-to-highlight pattern, admin-only diagnostic cards via `isAdmin`.
4. **Do NOT modify D001 itself** as part of adopting this standard — it is forward-looking only.
