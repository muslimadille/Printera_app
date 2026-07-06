export const calcTypeLabels: Record<string, { label: string; desc: string }> = {
  per_piece: { label: 'لكل قطعة', desc: 'الكمية × عدد المتغيرات × السعر' },
  per_1000: { label: 'لكل ألف', desc: 'عدد الآلاف × عدد المتغيرات × السعر' },
  tiered_1000: { label: 'شرائح ألف', desc: 'عدد المتغيرات × (أول ألف + كل ألف إضافي)' },
  flat: { label: 'مبلغ ثابت', desc: 'عدد المتغيرات × السعر (ثابت)' },
};

export const getCalcTypeLabel = (calcType: string): string => {
  return calcTypeLabels[calcType]?.label || calcType;
};
