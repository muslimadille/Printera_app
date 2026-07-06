---
name: Hybrid Engine Tab
description: New tab cloned from Smart Engine that adds a manual mode for dieline import + free layout editing, with the smart auto-distribution fully disabled in that mode.
type: feature
---
- File: `src/components/HybridEngineCalculator.tsx` (cloned from `SmartEngineCalculator.tsx`).
- Tab key: `hybridengine`, registered as a PRIMARY tab next to `smartengine` in `AppTabs.tsx` (icon: `Combine`).
- Two modes via top-bar toggle:
  - `smart` (default) — IDENTICAL behavior to Smart Engine.
  - `manual` — `EditableSheetLayout` + `DielineImportDialog`. NO auto-distribution, scenarios, or press auto-pick.
- **State isolation rule**: Manual mode owns its piece state 100%. To prevent the smart side or unrelated parent re-renders from wiping manual moves/rotations/duplicates:
  - Manual editor is wrapped in `ManualLayoutHost` (defined in same file). It creates the seed `LayoutPiece[]` ONCE via `useRef` so `EditableSheetLayout`'s `optimalPieces` prop reference is stable for the entire session.
  - Editor `key` is `manual-${activeSheetIdx}-${importedDieline?.fileName}` ONLY. Sheet/product size changes do NOT remount.
  - Without this, every keystroke in unrelated inputs would re-create the seed array, triggering EditableSheetLayout's re-seed effect and resetting the canvas.
- Manual flow: import dieline (optional) → starter piece at (0,0) → free move/rotate/duplicate → "اعتماد التوزيع" applies `cutsPerSheet = manualCount`, `baseCuts = 1`.
- Sheet (canvas) size in manual = `pressWidth × pressHeight` (falls back to master sheet).
- Saved quotes use `source_type: 'hybridengine'` and store `mode` in `quote_data`. Editing accepts both `hybridengine` and `smartengine` source types.
- Tour storage key: `hybridEngineTourSeen`.
- Defensive guard in `EditableSheetLayout.handlePointerMove`: if `pieces[primaryIdx]` is undefined (stale drag indices after a re-seed), the drag is aborted instead of throwing.
