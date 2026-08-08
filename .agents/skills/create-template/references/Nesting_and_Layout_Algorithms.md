# Nesting & Sheet Layout Algorithms Reference Guide

This reference guide describes the 2D nesting, interlocking, brick-shifting, and sheet layout yield algorithms used in `nesting.ts` for print sheet production.

---

## 1. Usable Sheet Area Calculation

Given print sheet dimensions ($W_{\text{sheet}}, H_{\text{sheet}}$), gripper margin ($G$), and edge margins ($M$):
$$\text{Usable Width } W_{\text{usable}} = W_{\text{sheet}} - 2 \times M$$
$$\text{Usable Height } H_{\text{usable}} = H_{\text{sheet}} - 2 \times M - G$$

---

## 2. Pitch & Grid Calculation

For a single template bounding box of width $W_{\text{bbox}}$ and height $H_{\text{bbox}}$, horizontal gap $G_h$, and vertical gap $G_v$:

### Normal Orientation (0°)
$$\text{Pitch}_X = W_{\text{bbox}} + G_h - \text{Interlock}_X$$
$$\text{Pitch}_Y = H_{\text{bbox}} + G_v - \text{Interlock}_Y$$
$$\text{Columns} = \left\lfloor \frac{W_{\text{usable}} + \text{Interlock}_X - G_h}{W_{\text{bbox}}} \right\rfloor$$
$$\text{Rows} = \left\lfloor \frac{H_{\text{usable}} + \text{Interlock}_Y - G_v}{H_{\text{bbox}}} \right\rfloor$$
$$\text{Total Yield}_{\text{normal}} = \text{Columns} \times \text{Rows}$$

### Rotated Orientation (90°)
$$\text{Pitch}_{X, \text{rot}} = H_{\text{bbox}} + G_h - \text{Interlock}_Y$$
$$\text{Pitch}_{Y, \text{rot}} = W_{\text{bbox}} + G_v - \text{Interlock}_X$$
$$\text{Columns}_{\text{rot}} = \left\lfloor \frac{W_{\text{usable}} + \text{Interlock}_Y - G_h}{H_{\text{bbox}}} \right\rfloor$$
$$\text{Rows}_{\text{rot}} = \left\lfloor \frac{H_{\text{usable}} + \text{Interlock}_X - G_v}{W_{\text{bbox}}} \right\rfloor$$
$$\text{Total Yield}_{\text{rot}} = \text{Columns}_{\text{rot}} \times \text{Rows}_{\text{rot}}$$

---

## 3. Best Orientation Selection

If `allowRotation` is enabled:
- **`rotationMode = 'auto'`**: Compare $\text{Total Yield}_{\text{normal}}$ vs $\text{Total Yield}_{\text{rot}}$:
  - If $\text{Total Yield}_{\text{rot}} > \text{Total Yield}_{\text{normal}}$, select `rotated`.
  - Otherwise, select `normal`.

---

## 4. Sheet Efficiency & Waste Ratios

$$\text{Total Template Area} = N \times (W_{\text{bbox}} \times H_{\text{bbox}})$$
$$\text{Sheet Area} = W_{\text{sheet}} \times H_{\text{sheet}}$$
$$\text{Efficiency Percentage} = \frac{\text{Total Template Area}}{\text{Sheet Area}} \times 100\%$$
$$\text{Waste Percentage} = 100\% - \text{Efficiency Percentage}$$
