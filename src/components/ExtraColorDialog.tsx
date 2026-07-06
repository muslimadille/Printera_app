// ExtraColorConfig type - kept here for backward compatibility of imports
export interface ExtraColorConfig {
  extraColorCalcType: 'per_1000' | 'tiered_1000';
  extraColorPrice: number;
  extraColorExtra1000: number;
  extraColorCount: number;
}

// Dialog is no longer used - extra color settings are now inline in ColorCountSelect
export default function ExtraColorDialog() {
  return null;
}
