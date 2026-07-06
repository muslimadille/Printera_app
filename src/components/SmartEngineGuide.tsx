import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { X, ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface GuideStep {
  selector: string;        // data-tour attribute value
  title: string;
  description: string;
  isFinal?: boolean;       // last step → show scenario hint
}

export interface GuideStepExt extends GuideStep {
  example?: string;
  hint?: string;
  requiredMessage?: string;
}

export const SMART_ENGINE_STEPS: GuideStepExt[] = [
  {
    selector: 'item-size',
    title: 'الخطوة 1 — مقاس الصنف',
    description: 'أدخل عرض وارتفاع الصنف بالسنتيمتر. هذه أول معلومة يحتاجها المحرك الذكي لاقتراح أفضل توزيع.',
    example: 'مثال: 15 × 21 سم',
    hint: 'تأكد من إدخال القيمتين قبل الانتقال.',
    requiredMessage: 'الرجاء إدخال عرض وارتفاع الصنف للمتابعة.',
  },
  {
    selector: 'paper-type',
    title: 'الخطوة 2 — نوع الورق',
    description: 'اختر نوع الورق والجرامية والمقاس الأساسي. سيحدد المحرك الذكي مقاس الشيت الأم تلقائياً.',
    example: 'مثال: كوشيه 150 جم — 70×100',
    requiredMessage: 'يجب اختيار نوع الورق والجرامية والمقاس.',
  },
  {
    selector: 'colors',
    title: 'الخطوة 3 — الألوان',
    description: 'اختر عدد الألوان من القائمة. هذا يحدد مقاس الماكينة وأسعار الطباعة والفرز تلقائياً.',
    example: 'مثال: 4 ألوان (CMYK)',
    requiredMessage: 'يرجى اختيار عدد الألوان.',
  },
  {
    selector: 'quantity',
    title: 'الخطوة 4 — كمية الصنف',
    description: 'أدخل العدد الإجمالي المطلوب من القطع.',
    example: 'مثال: 1000 قطعة',
    requiredMessage: 'يرجى إدخال كمية الصنف (أكبر من صفر).',
  },
  {
    selector: 'press-sheet',
    title: 'الخطوة 5 — مقاس شيت الطباعة',
    description: 'يُملأ تلقائياً بنفس مقاس الماكينة. يمكنك تعديله إذا أردت شيت أصغر.',
    example: 'افتراضي: نفس مقاس الماكينة',
  },
  {
    selector: 'preview',
    title: '🎯 أفضل نتيجة إنتاج',
    description: 'هذا هو السيناريو الأمثل المختار تلقائياً. يوضّح توزيع القطع داخل الشيت، العدد الناتج، وأفضل استفادة من المساحة المتاحة.',
    example: '✨ ركّز على السيناريو الأول — يمثّل أفضل إنتاج ممكن.',
    hint: 'يوجد سيناريوهات أخرى أسفل البطاقة يمكنك استعراضها والمقارنة بينها بحرية بعد إنهاء الجولة.',
  },
  {
    selector: 'tab-settings',
    title: '⚙️ مصدر الأسعار — الإعدادات',
    description: 'التكاليف المعروضة تعتمد على القيم والأسعار المحددة في إعدادات النظام، ويمكن تعديلها حسب الحاجة.',
    hint: 'لا حاجة لفتح التبويبة الآن — هذه إشارة بصرية فقط لتوضيح مصدر الأسعار.',
  },
  {
    selector: 'tab-papertypes',
    title: '📄 مصدر سعر الورق — نوع الورق',
    description: 'يتم احتساب التكاليف أيضاً بناءً على سعر الورق المحدد ضمن خانة نوع الورق.',
    hint: 'يمكنك مراجعة أو تعديل أسعار الورق لاحقاً من هذه التبويبة.',
    isFinal: true,
  },
];

interface SpotlightTourProps {
  open: boolean;
  steps: GuideStep[];
  onClose: () => void;
}

/** Full spotlight tour: dims background, highlights one field at a time */
export const SpotlightTour = ({ open, steps, onClose }: SpotlightTourProps) => {
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [protectedRect, setProtectedRect] = useState<DOMRect | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => { if (open) setStepIdx(0); }, [open]);

  // Detect any open Radix popover/select/dropdown so we can yield the overlay
  useEffect(() => {
    if (!open) return;
    const check = () => {
      // Radix-based popovers/selects/dropdowns
      const radix = document.querySelector(
        '[data-radix-popper-content-wrapper], [data-radix-select-content], [data-radix-popover-content], [data-radix-dropdown-menu-content]'
      );
      if (radix) { setPopoverOpen(true); return; }

      // Generic fallback: any visible listbox/menu/dialog or expanded trigger
      const generic = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[role="listbox"], [role="menu"], [role="dialog"], [role="combobox"][aria-expanded="true"], [aria-expanded="true"][aria-haspopup]'
        )
      ).some(el => {
        // Skip the highlighted trigger itself; only count actual open panels/visible menus
        const state = el.getAttribute('data-state');
        if (state === 'closed') return false;
        const ariaHidden = el.getAttribute('aria-hidden');
        if (ariaHidden === 'true') return false;
        const role = el.getAttribute('role');
        if (role === 'combobox' || el.hasAttribute('aria-haspopup')) {
          // It's a trigger that's expanded → assume an open panel exists
          return el.getAttribute('aria-expanded') === 'true';
        }
        // For listbox/menu/dialog panels, ensure they are rendered & visible
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      setPopoverOpen(generic);
    };
    check();
    const id = window.setInterval(check, 150);
    return () => window.clearInterval(id);
  }, [open]);

  const current = steps[stepIdx];

  useLayoutEffect(() => {
    if (!open || !current) return;
    const update = () => {
      const el = document.querySelector(`[data-tour="${current.selector}"]`) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        setTimeout(() => {
          const r = el.getBoundingClientRect();
          setRect(r);
        }, 250);
      } else {
        setRect(null);
      }
      // Always track the best-scenario card so we can keep it visible.
      const bestEl = document.querySelector('[data-tour="best-scenario"]') as HTMLElement | null;
      setProtectedRect(bestEl ? bestEl.getBoundingClientRect() : null);
    };
    update();
    const id = window.setInterval(update, 400);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, current, stepIdx]);

  // Poll the highlighted element to detect if its inputs/selects are empty
  useEffect(() => {
    if (!open || !current) { setIsEmpty(false); return; }
    const check = () => {
      const root = document.querySelector(`[data-tour="${current.selector}"]`) as HTMLElement | null;
      if (!root) { setIsEmpty(false); return; }
      const fields = root.querySelectorAll<HTMLElement>('input, select, [role="combobox"]');
      if (fields.length === 0) { setIsEmpty(false); return; }
      let empty = false;
      fields.forEach(f => {
        if (f.tagName === 'INPUT') {
          const v = (f as HTMLInputElement).value?.trim();
          if (!v || v === '0') empty = true;
        } else if (f.tagName === 'SELECT') {
          if (!(f as HTMLSelectElement).value) empty = true;
        } else {
          const txt = f.textContent?.trim() || '';
          if (!txt || txt.includes('اختر') || txt.toLowerCase().includes('select')) empty = true;
        }
      });
      setIsEmpty(empty);
    };
    check();
    const id = window.setInterval(check, 400);
    return () => window.clearInterval(id);
  }, [open, current, stepIdx]);

  if (!open || !current) return null;

  const isLast = stepIdx === steps.length - 1;
  const isFirst = stepIdx === 0;
  const progress = ((stepIdx + 1) / steps.length) * 100;

  // Tooltip position — below highlight if room, else above. Avoid overlapping protected rect.
  const PADDING = 8;
  const PROTECT_PAD = 12;
  const TOOLTIP_W = 340;
  const TOOLTIP_H_EST = 220;
  let tipTop = 0, tipLeft = 0;
  if (rect) {
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow > TOOLTIP_H_EST + 20) {
      tipTop = rect.bottom + PADDING + 8;
    } else {
      tipTop = Math.max(16, rect.top - TOOLTIP_H_EST - PADDING - 8);
    }
    tipLeft = Math.min(
      Math.max(16, rect.left + rect.width / 2 - TOOLTIP_W / 2),
      window.innerWidth - TOOLTIP_W - 16
    );

    // If the tooltip would intersect the protected best-scenario card, shove it away.
    if (protectedRect) {
      const tipBox = { left: tipLeft, top: tipTop, right: tipLeft + TOOLTIP_W, bottom: tipTop + TOOLTIP_H_EST };
      const pBox = {
        left: protectedRect.left - PROTECT_PAD,
        top: protectedRect.top - PROTECT_PAD,
        right: protectedRect.right + PROTECT_PAD,
        bottom: protectedRect.bottom + PROTECT_PAD,
      };
      const overlaps = !(tipBox.right < pBox.left || tipBox.left > pBox.right || tipBox.bottom < pBox.top || tipBox.top > pBox.bottom);
      if (overlaps) {
        // Try moving horizontally to the side with more room.
        const spaceLeft = pBox.left - 16;
        const spaceRight = window.innerWidth - pBox.right - 16;
        if (Math.max(spaceLeft, spaceRight) >= TOOLTIP_W) {
          tipLeft = spaceRight >= spaceLeft
            ? Math.min(window.innerWidth - TOOLTIP_W - 16, pBox.right + 8)
            : Math.max(16, pBox.left - TOOLTIP_W - 8);
        } else {
          // Otherwise stack vertically: above or below the protected rect.
          const spaceAbove = pBox.top - 16;
          const spaceBelowP = window.innerHeight - pBox.bottom - 16;
          if (spaceBelowP >= TOOLTIP_H_EST) {
            tipTop = pBox.bottom + 8;
          } else if (spaceAbove >= TOOLTIP_H_EST) {
            tipTop = Math.max(16, pBox.top - TOOLTIP_H_EST - 8);
          }
        }
      }
    }
  }

  const ext = current as GuideStepExt;

  return createPortal(
    <div className="fixed inset-0 z-[40] pointer-events-none" dir="rtl">
      {/* SVG mask — hidden when any dropdown/popover is open so options are fully visible */}
      {!popoverOpen && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              {rect && (
                <rect
                  x={rect.left - PADDING}
                  y={rect.top - PADDING}
                  width={rect.width + PADDING * 2}
                  height={rect.height + PADDING * 2}
                  rx="8"
                  fill="black"
                />
              )}
              {/* Protected: best-scenario card stays fully visible always */}
              {protectedRect && (
                <rect
                  x={protectedRect.left - PROTECT_PAD}
                  y={protectedRect.top - PROTECT_PAD}
                  width={protectedRect.width + PROTECT_PAD * 2}
                  height={protectedRect.height + PROTECT_PAD * 2}
                  rx="10"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="hsl(var(--background))"
            fillOpacity="0.72"
            mask="url(#spotlight-mask)"
          />
        </svg>
      )}

      {/* Glowing border around highlight */}
      {rect && !popoverOpen && (
        <div
          className="absolute pointer-events-none rounded-lg ring-2 ring-primary animate-pulse"
          style={{
            top: rect.top - PADDING,
            left: rect.left - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
            boxShadow: '0 0 0 4px hsl(var(--primary) / 0.25), 0 0 24px hsl(var(--primary) / 0.5)',
          }}
        />
      )}

      {/* Tooltip card — pointer-events-auto for buttons; doesn't block field interaction */}
      <div
        className="absolute bg-card border border-primary/30 rounded-xl shadow-2xl p-4 pointer-events-auto"
        style={{ top: tipTop, left: tipLeft, width: TOOLTIP_W }}
      >
        <div className="flex items-start gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            {current.isFinal ? <Sparkles className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm text-foreground leading-tight">{current.title}</h4>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 -mt-1 -ml-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed mb-2">{current.description}</p>

        {ext.example && (
          <div className="text-[11px] bg-primary/5 border border-primary/15 text-primary rounded-md px-2 py-1 mb-2">
            {ext.example}
          </div>
        )}
        {ext.hint && (
          <div className="text-[11px] text-muted-foreground bg-muted/50 rounded-md px-2 py-1 mb-2">
            💡 {ext.hint}
          </div>
        )}
        {isEmpty && ext.requiredMessage && (
          <div className="text-[11px] text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-2 py-1 mb-2 flex items-center gap-1">
            <span>⚠️</span>
            <span>{ext.requiredMessage}</span>
          </div>
        )}

        <div className="space-y-2">
          <Progress value={progress} className="h-1.5" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{stepIdx + 1} من {steps.length}</span>
            <div className="flex gap-1.5">
              {!isFirst && (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setStepIdx(s => s - 1)}>
                  <ArrowRight className="w-3 h-3" /> السابق
                </Button>
              )}
              {isLast ? (
                <Button size="sm" className="h-7 text-xs gap-1" onClick={onClose}>
                  ✓ إنهاء
                </Button>
              ) : (
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setStepIdx(s => s + 1)}>
                  التالي <ArrowLeft className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-[11px] text-muted-foreground hover:text-foreground w-full text-center pt-1">
            تخطي الجولة
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

/** Light tooltip-only mode: small hints next to fields, no overlay */
interface LightHintsProps {
  enabled: boolean;
  steps: GuideStep[];
  onDismiss: () => void;
}

export const LightHints = ({ enabled, steps, onDismiss }: LightHintsProps) => {
  const [positions, setPositions] = useState<{ top: number; left: number; text: string }[]>([]);

  useLayoutEffect(() => {
    if (!enabled) { setPositions([]); return; }
    const update = () => {
      const list: { top: number; left: number; text: string }[] = [];
      steps.forEach(step => {
        const el = document.querySelector(`[data-tour="${step.selector}"]`) as HTMLElement | null;
        if (el) {
          const r = el.getBoundingClientRect();
          list.push({
            top: r.top + window.scrollY - 8,
            left: r.right + window.scrollX + 8,
            text: step.title.replace(/^الخطوة \d+ — /, ''),
          });
        }
      });
      setPositions(list);
    };
    update();
    const t = setTimeout(update, 100);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [enabled, steps]);

  if (!enabled) return null;

  return createPortal(
    <>
      {positions.map((p, i) => (
        <div
          key={i}
          className="absolute z-[60] pointer-events-none animate-fade-in"
          style={{ top: p.top, left: p.left }}
        >
          <div className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-md shadow-lg whitespace-nowrap">
            {i + 1}. {p.text}
          </div>
        </div>
      ))}
      <button
        onClick={onDismiss}
        className="fixed bottom-20 lg:bottom-4 left-4 z-[60] bg-card border border-border rounded-full px-3 py-1.5 text-xs shadow-lg hover:bg-muted"
      >
        <X className="w-3 h-3 inline ml-1" /> إخفاء التلميحات
      </button>
    </>,
    document.body
  );
};
