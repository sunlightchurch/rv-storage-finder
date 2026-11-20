export const feeFields = [
  ['admin', 'Admin or setup'],
  ['gate_card', 'Gate card'],
  ['deposit', 'Deposit'],
  ['access_24h', '24-hour access fee'],
  ['late', 'Late fee'],
  ['lock_or_insurance', 'Required lock or insurance'],
] as const;

export type FeeKey = (typeof feeFields)[number][0];

export function termLabel(term: 'month-to-month' | 'short-term' | null): string {
  if (term === 'month-to-month') return 'Month-to-month';
  if (term === 'short-term') return 'Seasonal or short-term terms';
  return 'Not listed';
}
