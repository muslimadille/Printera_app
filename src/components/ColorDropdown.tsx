import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Plus } from 'lucide-react';

/**
 * ColorDropdown — موحّد مع تبويبة "مسطح" بنفس طريقة العرض والسلوك.
 * يعرض الألوان مع مقاس الماكينة المرتبط بها من إعدادات الأسعار.
 */
export interface ColorDropdownProps {
  sizes: { sizeName: string; width: number; height: number }[];
  selectedSizeIdx: number;
  colorCount: number;
  extraColors: number;
  onSelect: (sizeIdx: number, colors: number) => void;
  onExtraChange: (extra: number) => void;
}

export const ColorDropdown = ({
  sizes, selectedSizeIdx, colorCount, extraColors, onSelect, onExtraChange,
}: ColorDropdownProps) => {
  const [open, setOpen] = useState(false);

  const selectedLabel = selectedSizeIdx >= 0 && sizes[selectedSizeIdx]
    ? `${colorCount >= 5 ? `4+${extraColors}` : colorCount} ألوان - ${sizes[selectedSizeIdx].width}x${sizes[selectedSizeIdx].height}`
    : 'اختر الألوان';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between h-9 text-sm font-normal">
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[360px] p-3" align="start">
        <div className="space-y-2">
          {sizes.map((size, sIdx) => (
            <div key={sIdx} className={`flex items-center gap-2 p-2 rounded-lg transition-all ${selectedSizeIdx === sIdx ? 'bg-primary/10 border border-primary/30' : 'bg-muted/30 border border-transparent'}`}>
              <span className="text-xs font-semibold text-muted-foreground min-w-[65px] text-center">{size.width}x{size.height}</span>
              <div className="flex gap-1.5 items-center">
                {[0, 1, 2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => { onSelect(sIdx, n); setOpen(false); }}
                    className={`w-8 h-8 rounded-md text-sm font-bold transition-all border
                      ${selectedSizeIdx === sIdx && colorCount === n
                        ? 'bg-primary text-primary-foreground border-primary shadow-md'
                        : 'bg-background text-foreground border-border hover:border-primary/50 hover:bg-primary/5'
                      }`}
                  >
                    {n}
                  </button>
                ))}
                {selectedSizeIdx === sIdx && colorCount >= 5 ? (
                  <div className="flex items-center gap-0.5 mr-1">
                    <button
                      onClick={() => {
                        if (extraColors <= 1) { onSelect(sIdx, 4); onExtraChange(0); }
                        else onExtraChange(extraColors - 1);
                      }}
                      className="w-6 h-8 rounded-md text-xs font-bold border border-border hover:border-destructive/50 hover:bg-destructive/5 text-muted-foreground transition-all"
                    >−</button>
                    <span className="w-7 text-center text-sm font-bold text-primary">+{extraColors}</span>
                    <button
                      onClick={() => onExtraChange(extraColors + 1)}
                      className="w-6 h-8 rounded-md text-xs font-bold border border-border hover:border-primary/50 hover:bg-primary/5 text-muted-foreground transition-all"
                    >+</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { onSelect(sIdx, 5); onExtraChange(1); setOpen(false); }}
                    className="w-8 h-8 rounded-md text-sm font-bold transition-all border border-dashed border-primary/40 text-primary/70 hover:bg-primary/10 hover:border-primary"
                  >
                    <Plus className="w-4 h-4 mx-auto" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ColorDropdown;
