---
name: Smart Engine 3-column Layout & Scenario Cards
description: Smart Engine tab uses a 3-col layout (cost summary | item data | visual scenarios) and a dedicated SmartSheetLayoutPreview with collapsible/selectable scenario cards. No manual edit, no dieline import.
type: feature
---
- Layout grid is `lg:grid-cols-12`: cost-summary `col-span-3` (sticky, order-1) | inputs `col-span-5` (order-2) | visual `col-span-4` (order-3).
- `SmartSheetLayoutPreview` (src/components/SmartSheetLayoutPreview.tsx) is independent — does NOT reuse `SheetLayoutPreview`. Only used inside SmartEngineCalculator.
- Each scenario rendered as a card with: selection radio (top-right corner), expand/collapse arrow (top-left), "أفضل إنتاج" badge for best (highest total), "مُطبَّق" badge when active.
- Default open state: ONLY the best scenario starts expanded. User can toggle each individually OR use "فتح الكل" / "إغلاق الكل" buttons.
- Auto-pick: best scenario's pressW/pressH applied automatically via `onPressSizeChange`. Manual click sets `userPickedRef = true` to lock against re-auto-pick.
- Selection propagates: pressW/H + selectedStage1Id (baseCuts = pressPerBase) + selectedStage2Id (cutsPerSheet = productsPerPress).
- Manual edit mode (`EditableSheetLayout`) and dieline import (`DielineImportDialog`) are intentionally NOT included — pending future re-design.
- The visual preview targets the FIRST piece on the active sheet (`mainPiece`), matching the typical Smart Engine single-piece flow.
- Cost calculator tab (`CostCalculator`) is untouched — still uses the original `SheetLayoutPreview` with full features.
