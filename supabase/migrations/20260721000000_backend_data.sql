-- 1. Categories Table
CREATE TABLE public.app_categories (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

-- 2. Templates Table
CREATE TABLE public.app_templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL REFERENCES public.app_categories(id),
  category_label TEXT NOT NULL,
  description TEXT NOT NULL,
  pro BOOLEAN NOT NULL DEFAULT false,
  svg TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}'
);

-- 3. Subscription Plans Table
CREATE TABLE public.subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price_monthly TEXT NOT NULL,
  price_yearly TEXT NOT NULL,
  cta TEXT NOT NULL,
  featured BOOLEAN NOT NULL DEFAULT false
);

-- 4. Plan Features Table
CREATE TABLE public.plan_features (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- 5. Export History Table
CREATE TABLE public.export_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  format TEXT NOT NULL,
  exported_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_history ENABLE ROW LEVEL SECURITY;

-- Policies for public access on read-only tables
CREATE POLICY "Anyone can read app_categories" ON public.app_categories FOR SELECT USING (true);
CREATE POLICY "Anyone can read app_templates" ON public.app_templates FOR SELECT USING (true);
CREATE POLICY "Anyone can read subscription_plans" ON public.subscription_plans FOR SELECT USING (true);
CREATE POLICY "Anyone can read plan_features" ON public.plan_features FOR SELECT USING (true);

-- Policies for export history (since custom auth is used, we allow anon insert and read, client side filters by user_id)
CREATE POLICY "Anyone can read export_history" ON public.export_history FOR SELECT USING (true);
CREATE POLICY "Anyone can insert export_history" ON public.export_history FOR INSERT WITH CHECK (true);

-- ==========================================
-- SEED DATA
-- ==========================================

-- Insert Categories
INSERT INTO public.app_categories (id, label) VALUES
  ('all', 'الكل'),
  ('folding', 'طي وصواني'),
  ('tube', 'علب أسطوانية'),
  ('heavy', 'تغليف ثقيل'),
  ('lidbase', 'غطاء وقاعدة'),
  ('retail', 'تغليف تجزئة'),
  ('slide', 'علب سحب'),
  ('nonrect', 'أشكال غير مستطيلة');

-- Insert Templates
INSERT INTO public.app_templates (id, title, category, category_label, description, pro, svg, tags) VALUES
  ('T00012', 'علبة بريدية بغطاء ملتف', 'retail', 'تغليف تجزئة', 'علبة بريدية مغلقة بالكامل مع غطاء ملتف، مناسبة للشحن المباشر للعميل.', true, 'public/templates/preview/A10_20_03_01.svg', '{"T00012", "بريد"}'),
  ('T0002', 'علبة مستقيمة الإغلاق', 'folding', 'طي وصواني', 'التصميم الأساسي لعلب الطي الكرتونية، إغلاق علوي وسفلي بسيط بدون لصق.', false, 'public/templates/preview/A10_10_03_03.svg', '{"T0002", "أساسية"}'),
  ('T0005', 'صندوق غطاء مفتوح بقفل', 'folding', 'طي وصواني', 'غطاء علوي مفتوح مع لسان قفل ولسان غبار جانبي لثبات إضافي.', false, 'public/templates/preview/A10_20_02_02.svg', '{"T0005", "قفل"}'),
  ('T0006', 'علبة قفل مزدوج الجدار', 'lidbase', 'غطاء وقاعدة', 'جدار مزدوج للمتانة، غطاء وقاعدة منفصلان بنفس آلية القفل.', false, 'public/templates/preview/A10_75_03_03.svg', '{"T0006", "جدار مزدوج"}'),
  ('D001-H', 'علبة كيك بمقبض حمل', 'retail', 'تغليف تجزئة', 'علبة كلاسيكية بمقبض حمل مدمج، مثالية للمخبوزات والهدايا الصغيرة.', true, 'public/templates/preview/A10_10_02_02_11.svg', '{"مقبض", "كيك"}');

-- Insert Subscription Plans
INSERT INTO public.subscription_plans (id, name, description, price_monthly, price_yearly, cta, featured) VALUES
  ('starter', 'البداية', 'للتجربة الفردية وتصميم عينات محدودة.', 'مجانًا', 'مجانًا', 'ابدأ الآن', false),
  ('business', 'الأعمال', 'لمصممي التغليف والوكالات التي تنتج بانتظام.', '149', '119', 'اشترك الآن', true),
  ('factory', 'المصنع', 'لخطوط الإنتاج ومصانع الكرتون متعددة الماكينات.', '449', '359', 'تواصل مع المبيعات', false);

-- Insert Plan Features
-- Starter Features
INSERT INTO public.plan_features (plan_id, feature, sort_order) VALUES
  ('starter', '5 قوالب قياسية', 1),
  ('starter', 'تصدير SVG فقط', 2),
  ('starter', 'معاينة ثلاثية الأبعاد', 3),
  ('starter', 'دعم عبر البريد', 4);

-- Business Features
INSERT INTO public.plan_features (plan_id, feature, sort_order) VALUES
  ('business', 'كل قوالب المكتبة', 1),
  ('business', 'تصدير SVG وDXF وPDF', 2),
  ('business', 'توزيع تلقائي على الشيت', 3),
  ('business', 'دعم أولوية عبر الدردشة', 4),
  ('business', 'حتى 3 مستخدمين', 5);

-- Factory Features
INSERT INTO public.plan_features (plan_id, feature, sort_order) VALUES
  ('factory', 'كل مزايا خطة الأعمال', 1),
  ('factory', 'قوالب مخصصة عند الطلب', 2),
  ('factory', 'تكامل API للتصدير الآلي', 3),
  ('factory', 'مستخدمون غير محدودين', 4),
  ('factory', 'مدير حساب مخصص', 5);
