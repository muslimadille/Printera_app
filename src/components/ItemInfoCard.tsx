import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package } from 'lucide-react';

export interface ItemInfo {
  itemName: string;
  itemNumber: string;
  itemSize: string;
}

interface ItemInfoCardProps {
  value: ItemInfo;
  onChange: (info: ItemInfo) => void;
  showValidation?: boolean;
}

const emptyBorder = 'border-destructive/50 ring-1 ring-destructive/30';

const ItemInfoCard = ({ value, onChange, showValidation }: ItemInfoCardProps) => {
  const set = (partial: Partial<ItemInfo>) => onChange({ ...value, ...partial });

  return (
    <Card className="shadow-sm border-primary/20 bg-primary/5">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <Package className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm text-foreground">بيانات الصنف</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">اسم الصنف</Label>
            <Input
              value={value.itemName}
              onChange={e => set({ itemName: e.target.value })}
              placeholder="اسم الصنف"
              className={`h-9 text-sm ${showValidation && !value.itemName.trim() ? emptyBorder : ''}`}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">رقم الصنف</Label>
            <Input
              value={value.itemNumber}
              onChange={e => set({ itemNumber: e.target.value })}
              placeholder="رقم الصنف"
              className={`h-9 text-sm ${showValidation && !value.itemNumber.trim() ? emptyBorder : ''}`}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">مقاس الصنف</Label>
            <Input
              value={value.itemSize}
              onChange={e => set({ itemSize: e.target.value })}
              placeholder="مقاس الصنف"
              className={`h-9 text-sm ${showValidation && !value.itemSize.trim() ? emptyBorder : ''}`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const validateItemInfo = (info: ItemInfo): boolean => {
  if (!info.itemName.trim() || !info.itemNumber.trim() || !info.itemSize.trim()) {
    return false;
  }
  return true;
};

export default ItemInfoCard;
