# Project Rules & Standards

## Template UI & Layout Standardization Directive
- **Gold Standard Reference**: Template `T0002` (`T0002Calculator.tsx`) is the official reference implementation for all packaging template calculators.
- **UI Consistency**: Every existing and newly created template calculator MUST strictly utilize `TemplateEditorLayout` and `Box3DPreview` (or identical full-height 3D canvas preview + ultra-compact 1-row bottom control bar) without UI structural deviations.
- **Save Changes Button Workflow**: Parameters are edited in draft state and applied to the 2D/3D models and calculations ONLY upon clicking "حفظ التعديلات" (Save Changes).
