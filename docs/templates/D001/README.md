# D001 — Template Calibration Oracle

**File:** `template-calibration.xlsx`

## Purpose
Documentation / Validation Oracle for the D001 template logic.

## Important
- This file is **NOT read by the application** at runtime.
- It does **not** affect Dynamic Geometry, Single Template Preview/Export, Smart Auto Nesting, or Sheet Layout Export.
- It exists only as a human-readable reference and a future template-building methodology.

## Source of Truth (code)
- `src/lib/d001/types.ts`
- `src/lib/d001/geometry.ts`
- `src/lib/d001/reference.ts`
- `src/lib/d001/nesting.ts`
- `src/lib/d001/exportSingle.ts`
- `src/lib/d001/exportSheet.ts`

## Protocol Authority
`docs/TEMPLATE_BUILD_PROTOCOL.md`

## Sheets (23 total)
README, Inputs, ReferenceDimensions, SegmentFunctionalMap, ParameterInfluenceMap,
Rules_Lid, Rules_LidTongue, Rules_Lock, Rules_DepthTongue, Rules_InnerCut, Rules_Crease,
DerivedDimensions, Boundaries, Footprint_Pitch, PreviewExportContract, LayerProtocol,
SmartAutoNesting, SheetLayout, Orientation, AxisIndependence, ExportSheetContract,
CalibrationNotes, TestCases.
