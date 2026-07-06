---
name: Smart Engine Auto Press-Sheet Selection
description: Smart Engine auto-picks the best press-sheet size from production scenarios, fills it back into the form, and lets the user override by clicking any scenario card.
type: feature
---
- After enumerating production scenarios (direct A vs subdivisions B…), `SheetLayoutPreview` auto-applies `best.pressW/pressH` to the parent piece via `onPressSizeChange`.
- The component tracks a stable **machine envelope** (`machineW/machineH` state) so subdivision enumeration is not narrowed when the auto-pick reduces `pressWidth/pressHeight`. The envelope only updates when the user manually edits press dims in the item card (detected via `lastAutoRef` mismatch).
- Each `ScenarioBox` is now a button. Clicking it sets `userPickedPressRef = true` and calls `onPressSizeChange`, locking the choice against re-auto-pick.
- The currently active scenario shows a "مُطبَّق" badge (left) plus ring; the highest-output one shows "أفضل إنتاج" 🏆 (right).
- Wired in `CostCalculator`, `PaperSetCalculator`, `NewMagazineCalculator` via `update({ pressWidth, pressHeight })`.
