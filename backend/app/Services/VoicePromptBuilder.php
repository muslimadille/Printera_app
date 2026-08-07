<?php

namespace App\Services;

/**
 * The prompts sent to the AI provider by POST /voice/parse, copied VERBATIM from
 * supabase/functions/parse-voice-input/index.ts.
 *
 * These are part of the product's behavior, not incidental strings: they encode the
 * Egyptian print-shop vocabulary the model is expected to understand ("أربع ألوان" → 4,
 * "بدون سلفان" → 0) and the field names must match what the SPA writes into the calculator
 * forms. Do not translate, reword or "improve" them, and do not renumber the field lists —
 * the keys map onto the store's field names.
 *
 * Kept apart from VoiceService so the long heredocs do not bury the request logic, and so a
 * test can assert the prompt text without going near the HTTP layer.
 */
class VoicePromptBuilder
{
    /**
     * Per-calculator field catalogues. `employee` is the fallback for an unknown
     * calcType, exactly as `fieldDescriptions[calcType] || fieldDescriptions.employee`
     * does in the reference.
     *
     * @param  array<int,string>  $paperTypeNames
     * @return array<string,string>
     */
    private function fieldDescriptions(array $paperTypeNames): array
    {
        $papers = implode(', ', $paperTypeNames);

        return [
            'employee' => "
        - paperType (string): نوع الورق، الخيارات المتاحة: [{$papers}]
        - grammage (number): الجرامية مثل 80, 100, 130, 200, 250, 300, 350
        - printWidth (number): عرض ورقة الطباعة بالسم
        - printHeight (number): طول ورقة الطباعة بالسم
        - quantity (number): عدد القطع المطلوبة
        - cutsPerSheet (number): كم تفصل في الشيت
        - wastePercent (number): نسبة الهدر %
        - colorCount (number): عدد الألوان (1-4)
        - printedFaces (number): عدد الأوجه المطبوعة (1 أو 2)
        - cellophaneFaces (number): عدد أوجه السلفان (0 أو 1 أو 2)
        - dieCut (boolean): تكسير / قالب خاص
        - moldPrice (number): قيمة القالب بالريال
        - itemName (string): اسم الصنف
        - itemNumber (string): رقم الصنف
        - itemSize (string): مقاس الصنف
      ",
            'box' => "
        - quantity (number): الكمية الإجمالية
        - pieces[].paperType (string): نوع الورق، الخيارات: [{$papers}]
        - pieces[].grammage (number): الجرامية
        - pieces[].printWidth (number): عرض الطباعة بالسم
        - pieces[].printHeight (number): طول الطباعة بالسم
        - pieces[].cutsPerSheet (number): كم تفصل في الشيت
        - pieces[].colorCount (number): عدد الألوان
        - pieces[].printedFaces (number): عدد الأوجه
        - pieces[].cellophaneFaces (number): أوجه السلفان
        - pieces[].dieCut (boolean): تكسير
        - itemName (string): اسم الصنف
        - itemNumber (string): رقم الصنف
        - itemSize (string): مقاس الصنف
      ",
            'magazine' => "
        - quantity (number): عدد النسخ
        - totalPages (number): إجمالي الصفحات
        - pagesPerSheet (number): عدد الصفحات في الشيت
        - inner.paperType (string): نوع ورق الداخلي، الخيارات: [{$papers}]
        - inner.grammage (number): جرامية الداخلي
        - inner.colorCount (number): ألوان الداخلي
        - cover.paperType (string): نوع ورق الغلاف
        - cover.grammage (number): جرامية الغلاف
        - cover.colorCount (number): ألوان الغلاف
        - cover.cellophaneFaces (number): سلفان الغلاف
        - itemName (string): اسم الصنف
      ",
            'manual' => '
        - paperName (string): اسم الورق
        - grammage (number): الجرامية
        - purchaseWidth (number): عرض ورق الشراء
        - purchaseHeight (number): طول ورق الشراء
        - pricePerTon (number): سعر الطن
        - printWidth (number): عرض الطباعة
        - printHeight (number): طول الطباعة
        - quantity (number): الكمية
        - cutsPerSheet (number): عدد التفصيلات
        - wastePercent (number): نسبة الهدر
        - printedFaces (number): عدد الأوجه
        - cellophaneFaces (number): أوجه السلفان
        - dieCut (boolean): تكسير
        - itemName (string): اسم الصنف
        - itemNumber (string): رقم الصنف
        - itemSize (string): مقاس الصنف
      ',
        ];
    }

    /** @param  array<int,string>  $paperTypeNames */
    public function systemPrompt(string $calcType, array $paperTypeNames): string
    {
        $descriptions = $this->fieldDescriptions($paperTypeNames);
        $fields = $descriptions[$calcType] ?? $descriptions['employee'];

        return "أنت مساعد ذكي متخصص في استخراج بيانات الطباعة من النص العربي المحكي.
المستخدم سيتحدث ببيانات طباعة بأي ترتيب، واستخرج منها الحقول التالية حسب ما ذُكر فقط.
لا تخمن قيم لم يذكرها المستخدم. أرجع فقط الحقول التي ذُكرت بوضوح.

الحقول المطلوبة لنوع الحاسبة \"{$calcType}\":
{$fields}

تعليمات مهمة:
- إذا قال \"ألف\" أو \"آلاف\" بعد رقم فاضرب في 1000 (مثال: \"خمس آلاف\" = 5000)
- \"كوشيه\" = كوشيه، \"دوبلكس\" = دوبلكس، \"بريستول\" = بريستول
- \"أربع ألوان\" = colorCount: 4
- \"وجه واحد\" = 1، \"وجهين\" = 2
- \"بدون سلفان\" = 0، \"سلفان وجه\" = 1، \"سلفان وجهين\" = 2
- \"مع تكسير\" = dieCut: true، \"بدون تكسير\" = dieCut: false
- أرجع JSON فقط بدون أي نص إضافي";
    }

    public function userPrompt(string $transcript): string
    {
        return "استخرج بيانات الطباعة من هذا النص:
\"{$transcript}\"

أرجع النتيجة كـ JSON object يحتوي على الحقول المستخرجة فقط.";
    }
}
