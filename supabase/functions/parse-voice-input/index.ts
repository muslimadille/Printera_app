import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, calcType, paperTypeNames } = await req.json();

    if (!transcript) {
      return new Response(JSON.stringify({ fields: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fieldDescriptions: Record<string, string> = {
      employee: `
        - paperType (string): نوع الورق، الخيارات المتاحة: [${(paperTypeNames || []).join(', ')}]
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
      `,
      box: `
        - quantity (number): الكمية الإجمالية
        - pieces[].paperType (string): نوع الورق، الخيارات: [${(paperTypeNames || []).join(', ')}]
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
      `,
      magazine: `
        - quantity (number): عدد النسخ
        - totalPages (number): إجمالي الصفحات
        - pagesPerSheet (number): عدد الصفحات في الشيت
        - inner.paperType (string): نوع ورق الداخلي، الخيارات: [${(paperTypeNames || []).join(', ')}]
        - inner.grammage (number): جرامية الداخلي
        - inner.colorCount (number): ألوان الداخلي
        - cover.paperType (string): نوع ورق الغلاف
        - cover.grammage (number): جرامية الغلاف
        - cover.colorCount (number): ألوان الغلاف
        - cover.cellophaneFaces (number): سلفان الغلاف
        - itemName (string): اسم الصنف
      `,
      manual: `
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
      `,
    };

    const systemPrompt = `أنت مساعد ذكي متخصص في استخراج بيانات الطباعة من النص العربي المحكي.
المستخدم سيتحدث ببيانات طباعة بأي ترتيب، واستخرج منها الحقول التالية حسب ما ذُكر فقط.
لا تخمن قيم لم يذكرها المستخدم. أرجع فقط الحقول التي ذُكرت بوضوح.

الحقول المطلوبة لنوع الحاسبة "${calcType}":
${fieldDescriptions[calcType] || fieldDescriptions.employee}

تعليمات مهمة:
- إذا قال "ألف" أو "آلاف" بعد رقم فاضرب في 1000 (مثال: "خمس آلاف" = 5000)
- "كوشيه" = كوشيه، "دوبلكس" = دوبلكس، "بريستول" = بريستول
- "أربع ألوان" = colorCount: 4
- "وجه واحد" = 1، "وجهين" = 2
- "بدون سلفان" = 0، "سلفان وجه" = 1، "سلفان وجهين" = 2
- "مع تكسير" = dieCut: true، "بدون تكسير" = dieCut: false
- أرجع JSON فقط بدون أي نص إضافي`;

    const userPrompt = `استخرج بيانات الطباعة من هذا النص:
"${transcript}"

أرجع النتيجة كـ JSON object يحتوي على الحقول المستخرجة فقط.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const response = await fetch("https://ai-gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error [${response.status}]: ${errorText}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "{}";

    let fields: Record<string, any>;
    try {
      fields = JSON.parse(content);
    } catch {
      fields = {};
    }

    return new Response(JSON.stringify({ fields, transcript }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
