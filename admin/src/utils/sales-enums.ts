export const SalesOpportunityStatus = {
  following: 1,
  paused: 2,
  closed: 3,
} as const;

export const salesOpportunityStatusOptions = [
  { label: '跟进中', value: SalesOpportunityStatus.following },
  { label: '已暂停', value: SalesOpportunityStatus.paused },
  { label: '已关闭', value: SalesOpportunityStatus.closed },
];

export const salesOpportunityStatusColors: Record<number, string> = {
  [SalesOpportunityStatus.following]: 'processing',
  [SalesOpportunityStatus.paused]: 'warning',
  [SalesOpportunityStatus.closed]: 'default',
};

export function salesOpportunityStatusLabel(value?: number) {
  return (
    salesOpportunityStatusOptions.find((option) => option.value === value)
      ?.label ?? '-'
  );
}

export function salesOpportunityStatusValueEnum() {
  return Object.fromEntries(
    salesOpportunityStatusOptions.map((option) => [
      option.value,
      {
        text: option.label,
        status: salesOpportunityStatusColors[option.value],
      },
    ]),
  );
}
