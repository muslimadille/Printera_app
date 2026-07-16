# Handoff: لوحة تحكم الأدمن (Admin Dashboard)

## Overview
Admin-facing screens for "قوالبلاين" (a cardboard/packaging template marketplace, similar to PackMyMan): a full admin dashboard (overview, templates, orders, users/roles, billing, settings) and a dedicated admin login screen. These are separate from the customer-facing pages (library, template detail, customer profile, pricing, billing) already handed off/shipped elsewhere in this codebase.

## About the Design Files
The files in this bundle (`لوحة تحكم-أدمن.dc.html`, `تسجيل دخول-أدمن.dc.html`) are **design references built in HTML** — working prototypes showing intended layout, states, and interaction, not production code to copy verbatim. Recreate these screens in your app's existing framework (React/Vue/etc.) using your established component patterns, routing, and data layer. If no frontend framework exists yet, React is a safe default given the componentized, tab/state-driven structure of these screens.

## Fidelity
**High-fidelity.** Colors, spacing, typography, and copy (Arabic, RTL) are final. Recreate pixel-perfectly. All data shown (order lists, user lists, stats) is placeholder/mock data — wire to your real API.

## Global Design Tokens
- **Direction**: RTL (`dir="rtl"`) throughout — mirror all icons/arrows accordingly.
- **Font**: 'Cairo' (Google Fonts, weights 400/500/600/700), fallback to system sans-serif.
- **Colors**:
  - Background (light): `#faf6f0`
  - Background (dark sidebar/login): `#2b2013`
  - Sidebar panel/card dark: `#332616`, dark border `#463a29`, dark active row `#463a29`
  - Primary text: `#2b2013`
  - Secondary text: `#5a4c3c`, muted text: `#9c8f7c`, dark-mode muted text: `#a89c88` / `#c9bfae`
  - Accent (brand orange): `#a9622f`, accent light variant `#c98a52`
  - Card background: `#fff`, card border: `#e6dccb`, row divider: `#f2e9d9` / `#eee2cf`
  - Status green (success/active): bg `#e6f4ea`, text `#3f8f5c`
  - Status yellow (pending/draft): bg `#fdf3d9`, text `#b98a17`
  - Status red (cancelled/suspended): bg `#fbe7e5`, text `#c0392b`
  - Role badges: أدمن (purple) bg `#f0e9f7` text `#7a5ea8`; محرر (blue) bg `#e8f0fb` text `#3b6bc9`; مستخدم (neutral) bg `#eee7da` text `#5a4c3c`
- **Radius**: uses design-system tokens `--radius-sm` / `--radius-md` / `--radius-lg` (pill buttons use `999px`).
- **Spacing**: uses design-system spacing scale tokens `--space-2` … `--space-8` (an 8px-based scale — check your design system's `styles.css` for exact px values).
- **Icons**: Phosphor Icons (`ph ph-*` classes), regular weight, sizes ~14–20px.

## Screens

### 1. Admin Login — `تسجيل دخول-أدمن.dc.html`
- **Purpose**: Restricted-access login for admin/staff, distinct from customer login (dark theme signals "this is not the storefront").
- **Layout**: Full-viewport dark (`#2b2013`) background with a subtle dot-grid pattern and a soft radial accent glow (orange, `rgba(169,98,47,0.3)`, top-inline-start). Centered card, max-width 400px, background `#332616`, border `#463a29`, radius `--radius-lg`, padding `--space-8`.
- **Card contents (top to bottom)**:
  - Logo row: 34×34px rounded-square badge (bg `#a9622f`, white "ق" glyph) + wordmark "قوالبلاين" (لاين in accent color `#c98a52`) + small label "لوحة تحكم الإدارة" (muted `#a89c88`).
  - H1 "تسجيل دخول المسؤول" (22px) + subtext "هذه اللوحة مخصصة لفريق الإدارة فقط." (13.5px, `#a89c88`).
  - Form fields (each: label 13px/600 in `#c9bfae`, input 46px tall, radius 10px, border `#463a29`, bg `#2b2013`, text `#f3ece0`, 14px):
    - البريد الإلكتروني الإداري (email, placeholder `admin@qawalibline.sa`)
    - كلمة المرور (password)
    - رمز التحقق (2FA) — 6-digit numeric OTP field, letter-spacing 4px, maxlength 6.
  - Submit button: full-width, 48px tall, pill radius, bg `#a9622f`, white bold text "دخول إلى لوحة الإدارة" + shield-check icon. Hover: lift 2px + shadow.
  - Footer note: "جميع محاولات الدخول مسجّلة لأغراض أمنية." with a lock icon, 12.5px, muted.
- **Behavior**: On submit, currently just navigates to the dashboard (`window.location.href`). Wire to real auth (including the 2FA/OTP verification step) — this design assumes email+password+OTP as a single form; you may want to split into a two-step flow (credentials → OTP) in production.

### 2. Admin Dashboard — `لوحة تحكم-أدمن.dc.html`
Single-page app with a persistent sidebar and a section switcher (all client-side state in this prototype — `activeSection` string). Recreate as routes (`/admin`, `/admin/templates`, `/admin/orders`, `/admin/users`, `/admin/billing`, `/admin/settings`) in your real app.

**Shell**
- Sidebar: fixed width 240px, dark (`#2b2013`), full height, sticky.
  - Top: logo row (same badge+wordmark as login) + "أدمن" pill badge (bg `#463a29`, text `#d8cbb5`).
  - Nav list: 5 items, each a full-width button with icon + label (Phosphor icons: `ph-squares-four` لوحة القيادة, `ph-cube` القوالب, `ph-shopping-cart` الطلبات, `ph-users` المستخدمون, `ph-receipt` الفوترة, `ph-gear` الإعدادات — 6 total incl. settings). Active state: bg `#463a29`, white bold text; inactive: transparent bg, `#c9bfae` text, weight 500.
  - Bottom: user chip (34px circle avatar with initial, name + "مدير النظام" role label) + sign-out icon link (→ admin login page).
- Top header (in main content area): sticky, bg `#faf6f0`, border-bottom `#e8ded0`, page title (19px, changes per section) on the right(RTL start), search input (pill, icon-prefixed, 220px) + "عرض الموقع" outline button on the left.
- Main content container: max-width 1180px, padding `--space-8`.

**Section: لوحة القيادة (Overview)** — default view
- Stats row: responsive grid (`auto-fit, minmax(220px,1fr)`), 4 cards. Each card: white bg, border `#e6dccb`, radius `--radius-lg`, padding `--space-5`, hover-lift. Contents: 36px icon chip (colored bg per stat) top-start, trend label (green/red) top-end, big number (24px/700), label below (13px muted).
  - Stats shown: إجمالي القوالب (312, +8), الطلبات هذا الشهر (1,204, +14%), المستخدمون النشطون (4,890, +3%), الإيرادات الشهرية (38,420 ر.س, -2%).
- Two-column row below (`1.6fr 1fr`):
  - "أحدث الطلبات" card: header with "عرض الكل" link (jumps to Orders section) + list rows (40px SVG thumbnail, title, customer+date, status pill).
  - "مستخدمون جدد" card: list rows (32px initial-avatar, name, joined-date).

**Section: القوالب (Templates)** — list + detail drill-in
- List view: header "إدارة القوالب" + "قالب جديد" solid button. Table: columns القالب (thumbnail+title) / التصنيف / التنزيلات / الحالة / actions (edit pencil, delete trash icons). Rows are clickable (open detail); the pencil icon also opens detail, trash icon is a stopped-propagation placeholder action — wire to a real delete confirmation.
- Detail view (opened by clicking a row): "رجوع إلى القوالب" back button, then a 2-column layout (`1fr 1.3fr`):
  - Left: SVG preview card (large, on tinted bg) + رقم القالب / التنزيلات readouts.
  - Right: editable form — اسم القالب (text input), التصنيف (text input) + الحالة (read-only pill for now), الطول/العرض/الارتفاع (مم) as 3 numeric-style text inputs, then "حفظ التغييرات" (solid) / "حذف القالب" (outline red) buttons. **These inputs are uncontrolled/decorative in the prototype — wire real state, validation, and save/delete API calls.**

**Section: الطلبات (Orders)**
- Table: القالب / العميل / التاريخ / الحالة. Same row/status-pill visual pattern as the dashboard's recent-orders list. No detail drill-in built yet — consider adding one that mirrors the template detail pattern if needed.

**Section: المستخدمون (Users)** — sub-tabbed
- Pill toggle (top-right of section): "المستخدمون" / "الأدوار والصلاحيات", local `usersTab` state.
- **المستخدمون** tab: table — المستخدم (avatar+name) / البريد الإلكتروني / الخطة / **الدور** (role pill: أدمن/محرر/مستخدم) / الحالة.
- **الأدوار والصلاحيات** tab: responsive card grid (`auto-fit, minmax(280px,1fr)`), one card per role (أدمن, محرر, مستخدم). Each card: role badge + user count, then a checklist of 5 permissions (إدارة القوالب / الطلبات / المستخدمين / الفوترة / إعدادات النظام) as label+checkbox rows (checkboxes reflect mock enabled/disabled state, accent-color `#a9622f`). Below the grid: dashed "إضافة دور جديد" button. **Checkboxes and "add role" are non-functional in the prototype — wire to real RBAC data.**

**Section: الفوترة (Billing)**
- 3 top stat cards (الإيرادات هذا الشهر, الاشتراكات النشطة, معدل التجديد) — simpler variant than the overview stats (no icon/trend).
- Invoices table: العميل / الخطة / المبلغ / التاريخ.

**Section: الإعدادات (Settings)**
- 2×2 responsive card grid:
  - عام: منصة اسم / بريد الدعم / العملة الافتراضية text inputs.
  - تصنيفات القوالب: list of category chips (name + count) + dashed "إضافة تصنيف" button.
  - الإشعارات: 3 toggle rows (label + checkbox) — إشعار طلب جديد, إشعار مستخدم جديد, ملخص أسبوعي.
  - منطقة الخطر (danger zone): red-bordered card, warning copy, "تعطيل المنصة مؤقتًا" outline-red button.
- Bottom: "حفظ الإعدادات" solid button.
- **All settings fields/toggles are decorative in the prototype — wire to real settings persistence.**

## Interactions & Behavior Summary
- All navigation between dashboard sections is client-state only (`activeSection`) — replace with real routing so URLs/back-button/deep-links work.
- Hover states: `.hover-lift` (translateY -3/-4px + shadow) on cards; `.row-hover` (bg tint) on table rows; `.side-link`/buttons use inline color/bg swaps on active state, no CSS hover class defined for nav items beyond active state — consider adding a hover state for accessibility.
- No loading/error/empty states are designed — add them for real data (e.g., empty templates list, failed fetch, etc.)
- No responsive/mobile layout was designed — this is desktop-admin only. Confirm if a mobile admin view is needed.

## State Management (prototype-only, replace with real data layer)
- `activeSection`: which sidebar section is showing.
- `selectedTemplateId`: drives templates list vs. detail view.
- `usersTab`: 'list' | 'roles' toggle within Users section.
- All list data (stats, orders, users, templates, roles, invoices, settings) are hardcoded mock arrays in the component — replace with API calls / global state (Redux, React Query, etc. per your stack).

## Assets
SVG template preview thumbnails used throughout (from the existing template library — reuse the same asset pipeline as the customer-facing pages):
`public/templates/preview/A10_20_02_02.svg`, `A10_10_03_03.svg`, `A10_75_03_03.svg`, `A10_10_02_02_11.svg` (referenced from this bundle's `public/templates/preview/` — copy these paths' real files from your template asset store).

## Files in This Bundle
- `لوحة تحكم-أدمن.dc.html` — full admin dashboard (all sections described above).
- `تسجيل دخول-أدمن.dc.html` — admin login screen.

Both are standalone HTML prototypes (open directly in a browser) built with inline styles — treat all inline `style` attributes as the source of truth for exact values when recreating in your framework of choice.
