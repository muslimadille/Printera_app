# Carrying Handle Box — Reference Template

This folder is the **canonical reference** for the
[Template Onboarding Protocol (TOP v1.1)](../../../TEMPLATE_ONBOARDING_PROTOCOL.md).

Every new template must mirror the structure and discipline documented here.

## Why this template is the reference

It is the first template to successfully complete all 10 steps of the
New Template Certification Workflow (NTCW):

- ✅ Tagged SVG with `CUT` / `CREASE` / `HOLES` layers
- ✅ Mapping Audit (Boundaries derived purely from L / D / H / G)
- ✅ Piecewise Remap preserving original curves (no global scale)
- ✅ Preview ≡ Export (per-piece structural equality)
- ✅ Flattened Export Contract (no `<symbol>`, no `<use>`, no `matrix()`)
- ✅ Regression tests across 3 sizes
- ✅ Illustrator Open Test passed

## Files in this folder

| File                       | Purpose                                              |
|----------------------------|------------------------------------------------------|
| `template.svg`             | Tagged SVG (production source of truth)              |
| `template-color.svg`       | Colored variant used by the UI preview card          |
| `template-spec.md`         | Mapping contract — inputs, boundaries, axis rules    |
| `mapping-report.md`        | Approved mapping audit for the 3 test sizes          |
| `test-cases.md`            | Locked regression test cases (numeric + visual)      |
| `export-contract.md`       | Flattened Illustrator-compatible export contract     |
| `preview-validation.md`    | Visual validation procedure & approved results       |
| `illustrator-open-test.md` | Illustrator open / inspect test results              |
| `template-calibration.xlsx`| **Filled Reference Implementation** of the Master Excel Template (`docs/templates/_reference/TEMPLATE_CALIBRATION_MASTER.xlsx`). 9 sheets, validation-only. Documents S1–S4 (Supported) and S5–S6 (Future Engine). See TOP v1.1 §11–§12. |

## Live implementation

| Concern              | File                                                  |
|----------------------|-------------------------------------------------------|
| Engine & boundaries  | `src/lib/carryingHandleBoxEngine.ts`                  |
| Export builder       | `src/lib/carryingHandleBoxExport.ts`                  |
| Engine tests         | `src/lib/carryingHandleBoxEngine.test.ts`             |
| Export tests         | `src/lib/carryingHandleBoxExport.test.ts`             |
| Regression tests     | `src/lib/carryingHandleBoxRegression.test.ts`         |
| Visual fidelity      | `src/lib/carryingHandleBoxGeometryCleanup.test.ts`    |

**Do not modify the live implementation as part of onboarding a new template.**
This reference is read-only; clone the patterns into the new template's own files.
