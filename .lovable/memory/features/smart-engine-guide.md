---
name: Smart Engine Interactive Guide
description: Spotlight tour + light tooltip hints for Smart Engine tab. Auto-shows once via localStorage flag 'smartEngineTourSeen'. Two modes — Spotlight (full overlay, step-by-step) and Light Hints (small numbered chips beside fields, no overlay). Steps target data-tour selectors: item-size, paper-type, colors, quantity, press-sheet, preview.
type: feature
---
- File: `src/components/SmartEngineGuide.tsx` exports `SpotlightTour`, `LightHints`, `SMART_ENGINE_STEPS`.
- Triggered from header buttons in `SmartEngineCalculator`: "شرح تفاعلي" (HelpCircle) → spotlight, "تلميحات" (Lightbulb) → light hints toggle.
- Auto-show on first visit only; flag stored in localStorage.
- data-tour attributes added only on the FIRST piece (pieceIdx === 0) of the active sheet to avoid duplicate selectors.
- Spotlight uses SVG mask for dimming, portal-rendered, scrolls highlighted element into view.
