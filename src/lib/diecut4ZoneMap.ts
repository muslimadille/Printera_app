/**
 * Die Cut 4 — Phase 1: Zone Map + Anchor Map (Fresh Independent Build)
 * ─────────────────────────────────────────────────────────────────────
 * Source of Truth (الوحيدة):
 *   1) Original SVG : src/assets/diecut4/template.svg
 *   2) Colored SVG  : src/assets/diecut4/template-color.svg
 *   3) Excel        : Die_Cut_4_Strict_Calibration_Model.xlsx
 *
 * Reference dimensions (from Excel): L = 300 mm, D = 150 mm, H = 180 mm.
 * Coordinate unit = template viewBox unit (pt). 1 mm = 72/25.4 pt = 2.83465 pt.
 *
 * INDEPENDENT MODULE — nothing imported or copied from Die Cut, Die Cut 2,
 * or Die Cut 3. No Resize / Calibration / Packing / Export / Rotation /
 * Movement logic in this file. Pure structural identification only.
 */

export const DC4_TEMPLATE_VIEWBOX = { w: 2677.3, h: 1233.1 } as const;
export const DC4_MM_TO_PT = 72 / 25.4;       // 2.83465
export const DC4_PT_TO_MM = 25.4 / 72;       // 0.35278

export const DC4_REFERENCE_DIMS_MM = { L: 300, D: 150, H: 180 } as const;

const mm = (pt: number) => +(pt * DC4_PT_TO_MM).toFixed(2);

// ─── Anchors ─────────────────────────────────────────────────────────────────

export type DC4AnchorDriver =
  | 'edge'
  | 'glue-flap-fixed'
  | 'L'
  | 'D'
  | 'D-0.5'
  | 'H'
  | 'D×0.5'
  | 'D×0.5×1.086'
  | 'D×0.07'
  | 'handle-slot'
  | 'lock-band';

export interface DC4AnchorDef {
  id: string;
  pt: number;
  mm: number;
  driver: DC4AnchorDriver;
  label: string;
}

// Horizontal (X) anchors — 5 structural columns
// (Glue Flap → Front Face → Depth 1 → Back Face → Depth 2)
export const DC4_ANCHORS_X: DC4AnchorDef[] = [
  { id: 'DC4_AX0', pt: 0,      mm: mm(0),      driver: 'edge',            label: 'حافة يسرى' },
  { id: 'DC4_AX1', pt: 127.6,  mm: mm(127.6),  driver: 'glue-flap-fixed', label: 'نهاية لسان اللصق / بداية الواجهة الأولى' },
  { id: 'DC4_AX2', pt: 978.0,  mm: mm(978.0),  driver: 'L',               label: 'نهاية الواجهة الأولى / بداية العمق الأول' },
  { id: 'DC4_AX3', pt: 1403.1, mm: mm(1403.1), driver: 'D',               label: 'نهاية العمق الأول / بداية الواجهة الثانية' },
  { id: 'DC4_AX4', pt: 2253.5, mm: mm(2253.5), driver: 'L',               label: 'نهاية الواجهة الثانية / بداية العمق الثاني' },
  { id: 'DC4_AX5', pt: 2677.3, mm: mm(2677.3), driver: 'D-0.5',           label: 'حافة يمنى (نهاية العمق الثاني − 0.5mm)' },
];

// Handle-slot horizontal anchors inside the two Handle Areas.
// Straight segment 170.1 pt + radius ~42.55 pt at each end (stadium shape).
export const DC4_ANCHORS_X_HANDLE: DC4AnchorDef[] = [
  { id: 'DC4_AXH1L', pt: 467.7,  mm: mm(467.7),  driver: 'handle-slot', label: 'بداية فتحة اليد — الواجهة الأولى' },
  { id: 'DC4_AXH2L', pt: 637.8,  mm: mm(637.8),  driver: 'handle-slot', label: 'نهاية فتحة اليد — الواجهة الأولى' },
  { id: 'DC4_AXH1R', pt: 1743.3, mm: mm(1743.3), driver: 'handle-slot', label: 'بداية فتحة اليد — الواجهة الثانية' },
  { id: 'DC4_AXH2R', pt: 1913.4, mm: mm(1913.4), driver: 'handle-slot', label: 'نهاية فتحة اليد — الواجهة الثانية' },
];

// Vertical (Y) anchors — structural rows
export const DC4_ANCHORS_Y: DC4AnchorDef[] = [
  { id: 'DC4_AY0', pt: 0,      mm: mm(0),      driver: 'edge',        label: 'حافة علوية' },
  { id: 'DC4_AY1', pt: 65.2,   mm: mm(65.2),   driver: 'handle-slot', label: 'حافة فتحة اليد العلوية' },
  { id: 'DC4_AY2', pt: 150.3,  mm: mm(150.3),  driver: 'handle-slot', label: 'حافة فتحة اليد السفلية' },
  { id: 'DC4_AY3', pt: 212.6,  mm: mm(212.6),  driver: 'D×0.5',       label: 'فاصل حامل اليد / الغطاء' },
  { id: 'DC4_AY4', pt: 425.2,  mm: mm(425.2),  driver: 'D×0.5',       label: 'نهاية القسم العلوي / بداية الجسم' },
  { id: 'DC4_AY5', pt: 935.4,  mm: mm(935.4),  driver: 'H',           label: 'نهاية الجسم / بداية الألسنة السفلية' },
  { id: 'DC4_AY6', pt: 1147.4, mm: mm(1147.4), driver: 'lock-band',   label: 'حافة شريط القفل السفلي للواجهة (62.4pt)' },
  { id: 'DC4_AY7', pt: 1233.1, mm: mm(1233.1), driver: 'edge',        label: 'حافة سفلية' },
];

// Apex of the two purple Top-Depth Tongues (Depth columns), apex-up.
// Triangle height derived from Excel: (D × 0.5) × 1.086.
export const DC4_ANCHORS_Y_DEPTH_TONGUE: DC4AnchorDef[] = [
  { id: 'DC4_AYDT_apex', pt: 193.0, mm: mm(193.0), driver: 'D×0.5×1.086', label: 'قمة اللسان العلوي للعمق' },
  { id: 'DC4_AYDT_base', pt: 423.8, mm: mm(423.8), driver: 'D×0.5',       label: 'قاعدة اللسان العلوي للعمق' },
];

// ─── Zone definitions ────────────────────────────────────────────────────────

export type DC4ZoneCategory =
  | 'glue-flap'
  | 'face-column'
  | 'depth-column'
  | 'handle-area'
  | 'top-lid'
  | 'body-face'
  | 'bottom-face-flap'
  | 'top-depth-tongue'
  | 'body-depth'
  | 'bottom-depth-flap'
  | 'handle-slot'
  | 'tongue-post';

export interface DC4ZoneDef {
  id: string;
  name: string;                 // Arabic
  category: DC4ZoneCategory;
  excelRef?: string;            // matches HX## / VZ## in the Excel
  color: string;                // colored-SVG reference fill (hex)
  parent: string | null;
  startX: number; endX: number;
  startY: number; endY: number;
  widthRule: string;
  heightRule: string;
  driver: string;
  sacredGeometry: boolean;
  notes?: string;
}

export const DC4_ZONES: DC4ZoneDef[] = [
  // ── Horizontal column parents ──────────────────────────────────────────
  {
    id: 'DC4_HX01-GlueFlap',
    name: 'لسان اللصق',
    category: 'glue-flap',
    excelRef: 'HX01',
    color: '#231f20',
    parent: null,
    startX: 0, endX: 127.6,
    startY: 425.2, endY: 934.9,
    widthRule: 'Fixed from Original SVG = 127.6 pt (45.00 mm)',
    heightRule: 'H',
    driver: 'H only',
    sacredGeometry: true,
    notes: 'Trapezoidal narrowing at top/bottom — preserve st5 path verbatim.',
  },
  {
    id: 'DC4_HX02-FrontFaceColumn',
    name: 'عمود الواجهة الأولى',
    category: 'face-column',
    excelRef: 'HX02',
    color: '#00aeef',
    parent: null,
    startX: 127.6, endX: 978.0,
    startY: 0, endY: 1233.1,
    widthRule: 'L',
    heightRule: 'full sheet (D + D + H + bottom-flap zone)',
    driver: 'L + H + D',
    sacredGeometry: false,
    notes: 'Parent column. Children: VZ01 handle, VZ02 lid, VZ03 body, VZ04 bottom face flap.',
  },
  {
    id: 'DC4_HX03-Depth1Column',
    name: 'عمود العمق الأول',
    category: 'depth-column',
    excelRef: 'HX03',
    color: '#4cb85e',
    parent: null,
    startX: 978.0, endX: 1403.1,
    startY: 0, endY: 1233.1,
    widthRule: 'D',
    heightRule: 'full sheet',
    driver: 'D + H',
    sacredGeometry: false,
    notes: 'Parent column. Children: VZ05 purple top tongue (sacred), VZ06 body, VZ07 bottom depth flap.',
  },
  {
    id: 'DC4_HX04-BackFaceColumn',
    name: 'عمود الواجهة الثانية',
    category: 'face-column',
    excelRef: 'HX04',
    color: '#00aeef',
    parent: null,
    startX: 1403.1, endX: 2253.5,
    startY: 0, endY: 1233.1,
    widthRule: 'L',
    heightRule: 'full sheet',
    driver: 'L + H + D',
    sacredGeometry: false,
    notes: 'Mirror column of HX02. Children: VZ08 (handle+lid+body), VZ09 bottom face flap (interlock shape DIFFERENT from VZ04).',
  },
  {
    id: 'DC4_HX05-Depth2Column',
    name: 'عمود العمق الثاني',
    category: 'depth-column',
    excelRef: 'HX05',
    color: '#007c41',
    parent: null,
    startX: 2253.5, endX: 2677.3,
    startY: 0, endY: 1233.1,
    widthRule: 'D − 0.5 mm (D-Cal)',
    heightRule: 'full sheet',
    driver: 'D-Cal + H',
    sacredGeometry: false,
    notes: 'Compensated depth panel — always 0.5 mm narrower than HX03. Width = 423.8 pt at reference.',
  },

  // ── HX02 Front Face Column — child zones ──────────────────────────────
  {
    id: 'DC4_VZ01-FrontHandleArea',
    name: 'خانة حامل اليد — الواجهة الأولى',
    category: 'handle-area',
    excelRef: 'VZ01',
    color: '#004a8f',
    parent: 'DC4_HX02-FrontFaceColumn',
    startX: 129.0, endX: 976.5,
    startY: 0, endY: 212.6,
    widthRule: 'L − 1 mm',
    heightRule: 'D × 0.50',
    driver: 'L + D',
    sacredGeometry: true,
    notes: 'Trapezoidal upper outline with rounded handle pegs. Holds child handle-slot.',
  },
  {
    id: 'DC4_VZ01a-FrontHandleSlot',
    name: 'فتحة اليد — الواجهة الأولى',
    category: 'handle-slot',
    color: '#fdb515',
    parent: 'DC4_VZ01-FrontHandleArea',
    startX: 467.7, endX: 637.8,
    startY: 65.2,  endY: 150.3,
    widthRule: 'Fixed stadium (pill) from Original SVG, r ≈ 42.55 pt',
    heightRule: 'Fixed pill height = 85.1 pt',
    driver: 'follows parent VZ01 (move only — do not stretch shape)',
    sacredGeometry: true,
  },
  {
    id: 'DC4_VZ02-FrontTopLid',
    name: 'خانة الغطاء — الواجهة الأولى',
    category: 'top-lid',
    excelRef: 'VZ02',
    color: '#ec008c',
    parent: 'DC4_HX02-FrontFaceColumn',
    startX: 129.0, endX: 976.5,
    startY: 212.6, endY: 425.2,
    widthRule: 'L − 1 mm',
    heightRule: 'D × 0.50',
    driver: 'L + D',
    sacredGeometry: false,
  },
  {
    id: 'DC4_VZ03-FrontBodyFace',
    name: 'الواجهة الأولى',
    category: 'body-face',
    excelRef: 'VZ03',
    color: '#00aeef',
    parent: 'DC4_HX02-FrontFaceColumn',
    startX: 127.6, endX: 978.0,
    startY: 425.2, endY: 934.9,
    widthRule: 'L',
    heightRule: 'H',
    driver: 'L + H',
    sacredGeometry: false,
  },
  {
    id: 'DC4_VZ04-FrontBottomFlap',
    name: 'لسان غطاء أسفل الواجهة الأولى',
    category: 'bottom-face-flap',
    excelRef: 'VZ04',
    color: '#fa0000',
    parent: 'DC4_HX02-FrontFaceColumn',
    startX: 128.7, endX: 976.8,
    startY: 935.4, endY: 1233.0,
    widthRule: 'L (split into two halves of L/2 − 0.5 each; center gap = D/5 = D × 0.20)',
    heightRule: 'D × 0.07 (calibrated flap) + 62.4 pt lock-band from SVG',
    driver: 'L + D',
    sacredGeometry: true,
    notes: 'Curved cuts at 8° on both sides of the center gap. Use original SVG curve verbatim.',
  },

  // ── HX03 Depth 1 Column — child zones ─────────────────────────────────
  {
    id: 'DC4_VZ05-Depth1TopTongue',
    name: 'اللسان العلوي للعمق الأول',
    category: 'top-depth-tongue',
    excelRef: 'VZ05',
    color: '#6212b2',
    parent: 'DC4_HX03-Depth1Column',
    startX: 979.8, endX: 1401.3,
    startY: 193.0, endY: 423.8,
    widthRule: 'D − 1.5 mm',
    heightRule: '(D × 0.50) × 1.086',
    driver: 'D + top-lid height',
    sacredGeometry: true,
    notes: 'Apex-up tongue with rounded apex — preserve original Bézier verbatim.',
  },
  {
    id: 'DC4_VZ05a-Depth1TonguePost',
    name: 'مسمار اللسان — العمق الأول',
    category: 'tongue-post',
    color: '#fff200',
    parent: 'DC4_VZ05-Depth1TopTongue',
    startX: 1186.3, endX: 1194.8,
    startY: 264.5,  endY: 423.2,
    widthRule: 'Fixed micro-rect from Original SVG (~8.5 pt × 159 pt)',
    heightRule: 'Fixed from Original SVG',
    driver: 'follows parent VZ05',
    sacredGeometry: true,
  },
  {
    id: 'DC4_VZ06-Depth1Body',
    name: 'العمق الأول',
    category: 'body-depth',
    excelRef: 'VZ06',
    color: '#4cb85e',
    parent: 'DC4_HX03-Depth1Column',
    startX: 978.0, endX: 1403.1,
    startY: 425.2, endY: 934.9,
    widthRule: 'D',
    heightRule: 'H',
    driver: 'D + H',
    sacredGeometry: false,
  },
  {
    id: 'DC4_VZ07-Depth1BottomFlap',
    name: 'لسان غطاء أسفل العمق الأول',
    category: 'bottom-depth-flap',
    excelRef: 'VZ07',
    color: '#897f68',
    parent: 'DC4_HX03-Depth1Column',
    startX: 979.1, endX: 1402.0,
    startY: 935.4, endY: 1233.0,
    widthRule: 'D',
    heightRule: 'D × 0.07 (calibrated) carried with full bottom-band geometry from SVG',
    driver: 'D',
    sacredGeometry: true,
  },

  // ── HX04 Back Face Column — child zones (mirror of HX02) ──────────────
  {
    id: 'DC4_VZ08a-BackHandleArea',
    name: 'خانة حامل اليد — الواجهة الثانية',
    category: 'handle-area',
    excelRef: 'VZ08',
    color: '#2b4656',
    parent: 'DC4_HX04-BackFaceColumn',
    startX: 1404.6, endX: 2252.1,
    startY: 0,      endY: 212.6,
    widthRule: 'L − 1 mm',
    heightRule: 'D × 0.50',
    driver: 'L + D',
    sacredGeometry: true,
  },
  {
    id: 'DC4_VZ08a1-BackHandleSlot',
    name: 'فتحة اليد — الواجهة الثانية',
    category: 'handle-slot',
    color: '#34226b',
    parent: 'DC4_VZ08a-BackHandleArea',
    startX: 1743.3, endX: 1913.4,
    startY: 65.2,   endY: 150.3,
    widthRule: 'Fixed stadium (pill) from Original SVG, r ≈ 42.55 pt',
    heightRule: 'Fixed pill height = 85.1 pt',
    driver: 'follows parent VZ08a (move only)',
    sacredGeometry: true,
  },
  {
    id: 'DC4_VZ08b-BackTopLid',
    name: 'خانة الغطاء — الواجهة الثانية',
    category: 'top-lid',
    excelRef: 'VZ08',
    color: '#5d4e89',
    parent: 'DC4_HX04-BackFaceColumn',
    startX: 1404.6, endX: 2252.1,
    startY: 212.6,  endY: 425.2,
    widthRule: 'L − 1 mm',
    heightRule: 'D × 0.50',
    driver: 'L + D',
    sacredGeometry: false,
  },
  {
    id: 'DC4_VZ08c-BackBodyFace',
    name: 'الواجهة الثانية',
    category: 'body-face',
    excelRef: 'VZ08',
    color: '#00aeef',
    parent: 'DC4_HX04-BackFaceColumn',
    startX: 1403.2, endX: 2253.6,
    startY: 425.2,  endY: 934.9,
    widthRule: 'L',
    heightRule: 'H',
    driver: 'L + H',
    sacredGeometry: false,
  },
  {
    id: 'DC4_VZ09-BackBottomFlap',
    name: 'لسان غطاء أسفل الواجهة الثانية',
    category: 'bottom-face-flap',
    excelRef: 'VZ09',
    color: '#6b5f42',
    parent: 'DC4_HX04-BackFaceColumn',
    startX: 1404.3, endX: 2252.4,
    startY: 935.4,  endY: 1233.0,
    widthRule: 'L (split, center gap = D × 0.20)',
    heightRule: 'D × 0.07 calibrated, plus 62.4 pt lock-band from SVG',
    driver: 'L + D',
    sacredGeometry: true,
    notes: 'Interlock shape DIFFERENT from VZ04 — must interlock using original SVG geometry. Do not symmetrize.',
  },

  // ── HX05 Depth 2 Column — child zones ─────────────────────────────────
  {
    id: 'DC4_VZ05-2-Depth2TopTongue',
    name: 'اللسان العلوي للعمق الثاني',
    category: 'top-depth-tongue',
    excelRef: 'VZ05 (mirror)',
    color: '#93f',
    parent: 'DC4_HX05-Depth2Column',
    startX: 2255.4, endX: 2677.3,
    startY: 193.0,  endY: 423.7,
    widthRule: '(D − 0.5) − 1.5 mm  (follows HX05 compensated width)',
    heightRule: '(D × 0.50) × 1.086',
    driver: 'D-Cal + top-lid height',
    sacredGeometry: true,
  },
  {
    id: 'DC4_VZ05a-2-Depth2TonguePost',
    name: 'مسمار اللسان — العمق الثاني',
    category: 'tongue-post',
    color: '#a69f8e',
    parent: 'DC4_VZ05-2-Depth2TopTongue',
    startX: 2461.9, endX: 2470.4,
    startY: 264.5,  endY: 423.2,
    widthRule: 'Fixed micro-rect from Original SVG',
    heightRule: 'Fixed from Original SVG',
    driver: 'follows parent VZ05-2',
    sacredGeometry: true,
  },
  {
    id: 'DC4_VZ06-2-Depth2Body',
    name: 'العمق الثاني',
    category: 'body-depth',
    excelRef: 'VZ06 (mirror)',
    color: '#007c41',
    parent: 'DC4_HX05-Depth2Column',
    startX: 2253.5, endX: 2677.3,
    startY: 425.2,  endY: 934.9,
    widthRule: 'D − 0.5 mm',
    heightRule: 'H',
    driver: 'D-Cal + H',
    sacredGeometry: false,
  },
  {
    id: 'DC4_VZ07-2-Depth2BottomFlap',
    name: 'لسان غطاء أسفل العمق الثاني',
    category: 'bottom-depth-flap',
    excelRef: 'VZ07 (mirror)',
    color: '#897f68',
    parent: 'DC4_HX05-Depth2Column',
    startX: 2254.7, endX: 2677.3,
    startY: 935.4,  endY: 1233.0,
    widthRule: 'D − 0.5 mm',
    heightRule: 'D × 0.07 calibrated, bottom-band from SVG',
    driver: 'D-Cal',
    sacredGeometry: true,
  },
];

// ─── Derived: parent → children adjacency ───────────────────────────────────
export const DC4_ZONE_TREE: Record<string, string[]> = (() => {
  const tree: Record<string, string[]> = { __root__: [] };
  for (const z of DC4_ZONES) {
    const k = z.parent ?? '__root__';
    (tree[k] ||= []).push(z.id);
  }
  return tree;
})();

export const dc4ZoneWidth  = (z: DC4ZoneDef) => z.endX - z.startX;
export const dc4ZoneHeight = (z: DC4ZoneDef) => z.endY - z.startY;
export const dc4PtToMm = (v: number) => +(v * DC4_PT_TO_MM).toFixed(2);
