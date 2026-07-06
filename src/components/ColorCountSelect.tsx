import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { ExtraColorConfig } from '@/components/ExtraColorDialog';

interface Props {
  colorCount: number;
  onColorCountChange: (val: number) => void;
  extraColorConfig: ExtraColorConfig;
  onExtraColorChange: (config: Partial<ExtraColorConfig>) => void;
  label?: string;
  triggerClassName?: string;
}

const ColorCountSelect = ({
  colorCount,
  onColorCountChange,
  extraColorConfig,
  onExtraColorChange,
  label = 'عدد الألوان',
  triggerClassName = 'h-9 text-sm',
}: Props) => {
  return (
    <>
      <div className="space-y-1.5">
        {label && <Label className="text-xs">{label}</Label>}
        <Select value={colorCount.toString()} onValueChange={(val) => onColorCountChange(Number(val))}>
          <SelectTrigger className={triggerClassName}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">بدون طباعة</SelectItem>
            <SelectItem value="1">1 لون</SelectItem>
            <SelectItem value="2">2 لون</SelectItem>
            <SelectItem value="3">3 ألوان</SelectItem>
            <SelectItem value="4">4 ألوان</SelectItem>
            <SelectItem value="5">أكثر من 4</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {colorCount === 5 && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">عدد الألوان الإضافية</Label>
            <Input
              type="number"
              min={1}
              className="h-9 text-sm"
              value={extraColorConfig.extraColorCount || 1}
              onChange={(e) => onExtraColorChange({ extraColorCount: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">نوع حساب اللون الإضافي</Label>
            <Select
              value={extraColorConfig.extraColorCalcType}
              onValueChange={(val: any) => onExtraColorChange({ extraColorCalcType: val })}
            >
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="per_1000">لكل ألف</SelectItem>
                <SelectItem value="tiered_1000">شرائح ألف</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">سعر أول ألف (للون الواحد)</Label>
            <Input
              type="number"
              className="h-9 text-sm"
              value={extraColorConfig.extraColorPrice}
              onChange={(e) => onExtraColorChange({ extraColorPrice: Number(e.target.value) })}
            />
          </div>
          {extraColorConfig.extraColorCalcType === 'tiered_1000' && (
            <div className="space-y-1.5">
              <Label className="text-xs">ألف إضافي (للون الواحد)</Label>
              <Input
                type="number"
                className="h-9 text-sm"
                value={extraColorConfig.extraColorExtra1000}
                onChange={(e) => onExtraColorChange({ extraColorExtra1000: Number(e.target.value) })}
              />
            </div>
          )}
        </>
      )}
    </>
  );
};

export default ColorCountSelect;
